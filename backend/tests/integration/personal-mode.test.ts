// SOCIAL_ENABLED off (the default for Nostos v1): strictly personal. Every social route is a 404 and a passport is
// visible only to its owner. (The rest of the suite runs with the flag on: see vitest.config.ts.)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { socialEnabled } from "@/server/social";
import { getStamp, listUserStamps } from "@/server/services/stamps";
import { getProfile } from "@/server/services/people";
import { installMemoryStorage } from "./mem-storage";
import { makeActor, makeStamp, makeVenue } from "./factories";

installMemoryStorage();

import * as feed from "@/app/api/feed/route";
import * as flags from "@/app/api/flags/route";
import * as activity from "@/app/api/me/activity/route";
import * as meBlocks from "@/app/api/me/blocks/route";
import * as reqs from "@/app/api/me/follow-requests/route";
import * as reqOne from "@/app/api/me/follow-requests/[handle]/route";
import * as approveAll from "@/app/api/me/follow-requests/approve-all/route";
import * as meFollower from "@/app/api/me/followers/[handle]/route";
import * as meFollowing from "@/app/api/me/following/route";
import * as like from "@/app/api/stamps/[id]/like/route";
import * as search from "@/app/api/users/route";
import * as block from "@/app/api/users/[handle]/block/route";
import * as follow from "@/app/api/users/[handle]/follow/route";
import * as followers from "@/app/api/users/[handle]/followers/route";
import * as following from "@/app/api/users/[handle]/following/route";
import * as userR from "@/app/api/users/[handle]/route";
import * as userStamps from "@/app/api/users/[handle]/stamps/route";
import * as userPlaces from "@/app/api/users/[handle]/places/route";
import * as stampR from "@/app/api/stamps/[id]/route";

type H = (req: Request, ctx: never) => Promise<Response>;
beforeEach(() => vi.stubEnv("SOCIAL_ENABLED", "0"));
afterEach(() => vi.unstubAllEnvs());

async function call(h: H, method: string, token: string, params: Record<string, string> = {}, query = "") {
  const res = await h(new Request(`http://localhost/x${query}`, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: method === "GET" ? undefined : "{}" }), { params: Promise.resolve(params) } as never);
  return res;
}

describe("the flag", () => {
  it("is off unless set", () => {
    expect(socialEnabled({})).toBe(false);
    expect(socialEnabled({ SOCIAL_ENABLED: "0" })).toBe(false);
    expect(socialEnabled({ SOCIAL_ENABLED: "1" })).toBe(true);
    expect(socialEnabled({ SOCIAL_ENABLED: "true" })).toBe(true);
  });
});

describe("with social off", () => {
  async function scene() {
    const venue = await makeVenue();
    const me = await makeActor({ isPrivate: false });
    const other = await makeActor({ isPrivate: false });
    const mine = await makeStamp(me, venue.id);
    const theirs = await makeStamp(other, (await makeVenue()).id);
    const token = (await createSession(prisma, me.userId, { client: "IOS" })).token;
    const staff = await makeActor({ role: "MODERATOR" });
    return { me, other, mine, theirs, token, staffToken: (await createSession(prisma, staff.userId, { client: "IOS" })).token, staff };
  }

  it("every social route is a 404", async () => {
    const s = await scene();
    const h = { handle: s.other.handle, id: s.theirs.id };
    const cases: [H, string, Record<string, string>, string?][] = [
      [feed.GET as H, "GET", {}], [flags.POST as H, "POST", {}], [activity.GET as H, "GET", {}], [meBlocks.GET as H, "GET", {}],
      [reqs.GET as H, "GET", {}], [reqOne.POST as H, "POST", h], [approveAll.POST as H, "POST", {}], [meFollower.DELETE as H, "DELETE", h],
      [meFollowing.GET as H, "GET", {}], [like.PUT as H, "PUT", h], [like.DELETE as H, "DELETE", h], [search.GET as H, "GET", {}, "?q=abc"],
      [block.POST as H, "POST", h], [block.DELETE as H, "DELETE", h], [follow.PUT as H, "PUT", h], [follow.DELETE as H, "DELETE", h],
      [followers.GET as H, "GET", h], [following.GET as H, "GET", h],
      // Other people's passports.
      [userR.GET as H, "GET", h], [userStamps.GET as H, "GET", h], [userPlaces.GET as H, "GET", h],
    ];
    for (const [fn, method, params, q] of cases) expect((await call(fn, method, s.token, params, q)).status, `${method} ${JSON.stringify(params)}`).toBe(404);
  });

  it("your own passport still works, and nobody else's stamp opens, not even for staff", async () => {
    const s = await scene();
    const own = { handle: s.me.handle };
    expect((await call(userR.GET as H, "GET", s.token, own)).status).toBe(200);
    expect((await call(userStamps.GET as H, "GET", s.token, own)).status).toBe(200);
    expect((await call(userPlaces.GET as H, "GET", s.token, own)).status).toBe(200);
    expect((await call(stampR.GET as H, "GET", s.token, { id: s.mine.id })).status).toBe(200);
    expect((await call(stampR.GET as H, "GET", s.token, { id: s.theirs.id })).status).toBe(404);
    expect((await call(stampR.GET as H, "GET", s.staffToken, { id: s.mine.id })).status).toBe(404);
    expect((await call(userR.GET as H, "GET", s.token, { handle: s.me.handle.toUpperCase() })).status).toBe(200);
  });

  it("services agree: another person's passport is a 404 without handles or stamps, for everyone", async () => {
    const s = await scene();
    for (const v of [null, s.me, s.staff]) {
      await expect(getStamp(prisma, v, s.theirs.id)).rejects.toMatchObject({ status: 404 });
      await expect(getProfile(prisma, s.other.handle, v)).rejects.toMatchObject({ status: 404 });
      await expect(listUserStamps(prisma, v, s.other.handle)).rejects.toMatchObject({ status: 404 });
    }
    expect((await getProfile(prisma, s.me.handle, s.me)).access).toBe("full");
  });
});
