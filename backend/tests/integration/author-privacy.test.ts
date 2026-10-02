/**
 * Every payload that names an author is resolved per viewer: a private author's handle never reaches a viewer who
 * can't see it. Covers the venue page (live photos, earlier photos, comments, venue replies), the owner dashboard's
 * embedded page, over HTTP, for every kind of viewer.
 */
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { getVenuePage } from "@/server/services/venues";
import { ownerVenueDashboard } from "@/server/services/owner";
import { addComment, replyAsVenue } from "@/server/services/comments";
import { decideFollowRequest, follow } from "@/server/services/people";
import { createSession } from "@/lib/auth/session";
import { GET as venueRoute } from "@/app/api/venues/[id]/route";
import type { Actor } from "@/server/actor";
import { makeActor, makeOwner, makeUser, makeVenue, INSIDE, verify } from "./factories";

async function scene() {
  const venue = await makeVenue();
  const priv = await makeActor({ handle: "secret_sam" });
  const pub = await makeActor({ handle: "open_olive", isPrivate: false });
  await verify(pub.userId);
  const photo = (u: Actor, key: string, createdAt = new Date()) =>
    prisma.photo.create({ data: { userId: u.userId, venueId: venue.id, storageKey: `photos/${key}.png`, mimeType: "image/png", caption: key, ...INSIDE, rating: 7, shared: true, createdAt } });
  await photo(priv, "priv_live");
  await photo(priv, "priv_earlier", new Date(Date.now() - 5 * 3600_000));
  await photo(pub, "pub_live");
  // An unshared post never appears on the venue page, for anyone.
  await prisma.photo.create({ data: { userId: pub.userId, venueId: venue.id, storageKey: "photos/pub_unshared.png", mimeType: "image/png", caption: "pub_unshared", ...INSIDE, rating: 9, shared: false } });
  const c1 = await addComment(prisma, priv, venue.id, { body: "private comment" });
  await addComment(prisma, pub, venue.id, { body: "public comment" });
  const owner = await makeOwner(venue.id); // venue accounts are private by default too
  await replyAsVenue(prisma, owner, c1.id, { body: "thanks" });
  const follower = await makeActor();
  await follow(prisma, follower, priv.handle);
  await decideFollowRequest(prisma, priv, follower.handle, { approve: true });
  const requester = await makeActor();
  await follow(prisma, requester, priv.handle);
  return { venue, priv, pub, owner, follower, requester };
}

type Page = Awaited<ReturnType<typeof getVenuePage>>;
const authors = (page: Page) => [
  ...page.live.livePhotos.map((p) => [p.caption, p.author] as const),
  ...page.live.earlierPhotos.map((p) => [p.caption, p.author] as const),
  ...page.live.comments.flatMap((c) => [[c.body, c.author] as const, ...c.replies.map((r) => [r.body, r.author] as const)]),
];

describe("authors on venue pages are resolved per viewer", () => {
  it("strangers, signed-out viewers, pending requesters and the venue's owner see private authors as Anonymous", async () => {
    const s = await scene();
    const viewers: [string, Actor | null][] = [["signed out", null], ["stranger", await makeActor()], ["requester", s.requester], ["venue owner", s.owner]];
    for (const [label, viewer] of viewers) {
      const page = await getVenuePage(prisma, s.venue.slug, viewer);
      const byText = Object.fromEntries(authors(page));
      expect(byText["priv_live"], label).toEqual({ kind: "anonymous" });
      expect(byText["priv_earlier"], label).toEqual({ kind: "anonymous" });
      expect(byText["private comment"], label).toEqual({ kind: "anonymous" });
      expect(byText["pub_live"], label).toEqual({ kind: "user", handle: "open_olive", verified: true, regular: false });
      expect(byText["public comment"], label).toMatchObject({ kind: "user", handle: "open_olive" });
      // The owner's own reply shows its handle to the owner (self); to everyone else the private venue account is Anonymous.
      expect(byText["thanks"], label).toEqual(viewer === s.owner ? { kind: "user", handle: s.owner.handle, verified: false, regular: false } : { kind: "anonymous" });
      const json = JSON.stringify(page);
      expect(json, label).not.toContain("secret_sam");
      expect(json, label).not.toContain("pub_unshared");
    }
  });

  it("approved followers, the author and moderators see the real handle", async () => {
    const s = await scene();
    for (const viewer of [s.follower, s.priv, await makeActor({ role: "MODERATOR" }), await makeActor({ role: "ADMIN" })]) {
      const byText = Object.fromEntries(authors(await getVenuePage(prisma, s.venue.slug, viewer)));
      expect(byText["priv_live"]).toEqual({ kind: "user", handle: "secret_sam", verified: false, regular: false });
      expect(byText["private comment"]).toMatchObject({ kind: "user", handle: "secret_sam" });
    }
  });

  it("the owner dashboard's embedded page is resolved for the owner, like any viewer", async () => {
    const s = await scene();
    const dash = await ownerVenueDashboard(prisma, s.owner, s.venue.id);
    expect(JSON.stringify(dash)).not.toContain("secret_sam");
  });

  it("over HTTP, a stranger's token never receives the private handle", async () => {
    const s = await scene();
    const stranger = await makeUser();
    const { token } = await createSession(prisma, stranger.id, { client: "IOS" });
    const res = await venueRoute(new Request("http://x", { headers: { authorization: `Bearer ${token}` } }), { params: Promise.resolve({ id: s.venue.slug }) });
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).not.toContain("secret_sam");
    expect(text).toContain("open_olive");
    const anon = await venueRoute(new Request("http://x"), { params: Promise.resolve({ id: s.venue.slug }) });
    expect(await anon.text()).not.toContain("secret_sam");
  });

  it("making the account public reveals the handle; removing a follower hides it again", async () => {
    const s = await scene();
    const stranger = await makeActor();
    await prisma.user.update({ where: { id: s.priv.userId }, data: { isPrivate: false } });
    expect(JSON.stringify(await getVenuePage(prisma, s.venue.slug, stranger))).toContain("secret_sam");
    await prisma.user.update({ where: { id: s.priv.userId }, data: { isPrivate: true } });
    await prisma.follow.deleteMany({ where: { followerId: s.follower.userId } });
    expect(JSON.stringify(await getVenuePage(prisma, s.venue.slug, s.follower))).not.toContain("secret_sam");
  });
});
