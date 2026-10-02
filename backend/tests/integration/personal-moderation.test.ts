import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { flagContent, moderate, moderationQueue, recentModerationLog, recentlyHidden } from "@/server/services/moderation";
import * as queue from "@/app/api/mod/queue/route";
import * as hidden from "@/app/api/mod/hidden/route";
import * as log from "@/app/api/mod/log/route";
import * as actions from "@/app/api/mod/actions/route";
import { installMemoryStorage } from "./mem-storage";
import { makeActor, makeStamp, makeVenue } from "./factories";

installMemoryStorage();
afterEach(() => vi.unstubAllEnvs());

describe("personal moderation boundary", () => {
  it.each(["MODERATOR", "ADMIN"] as const)("%s HTTP and web services hide legacy flags, hidden and App Review content without changing records", async (role) => {
    const staff = await makeActor({ role });
    const author = await makeActor({ isPrivate: false });
    const reviewer = await makeActor();
    await prisma.user.update({ where: { id: reviewer.userId }, data: { geofenceExempt: true } });
    const exempt = { ...reviewer, geofenceExempt: true };
    const stamps = [await makeStamp(author, (await makeVenue()).id), await makeStamp(exempt, (await makeVenue()).id), await makeStamp(staff, (await makeVenue()).id)];
    for (const s of stamps) {
      await prisma.photo.update({ where: { id: s.id }, data: { hiddenAt: new Date() } });
      await prisma.flag.create({ data: { targetType: "PHOTO", targetId: s.id, flaggerId: author.userId, reason: "legacy secret", venueId: s.place.id } });
      await prisma.moderationEvent.create({ data: { targetType: "PHOTO", targetId: s.id, action: "HIDE", actorId: author.userId, note: "legacy secret" } });
    }
    await prisma.flag.create({ data: { targetType: "USER", targetId: author.userId, flaggerId: staff.userId, reason: "legacy account" } });
    const before = { flags: await prisma.flag.findMany(), events: await prisma.moderationEvent.findMany() };
    const token = (await createSession(prisma, staff.userId, { client: "IOS" })).token;
    vi.stubEnv("SOCIAL_ENABLED", "0");
    for (const handler of [queue.GET, hidden.GET, log.GET]) {
      const res = await handler(new Request("http://localhost/api/mod", { headers: { authorization: `Bearer ${token}` } }), undefined as never);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "not_found", message: "Not found" });
    }
    for (const s of stamps) {
      const res = await actions.POST(new Request("http://localhost/api/mod/actions", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ targetType: "STAMP", targetId: s.id, action: "RESTORE" }) }), undefined as never);
      expect(res.status).toBe(404);
      await expect(moderate(prisma, staff, { targetType: "STAMP", targetId: s.id, action: "RESTORE" })).rejects.toMatchObject({ status: 404 });
    }
    for (const service of [moderationQueue, recentlyHidden, recentModerationLog]) await expect(service(prisma, staff)).rejects.toMatchObject({ status: 404 });
    await expect(flagContent(prisma, staff, { targetType: "USER", targetId: author.userId, reason: "probing" })).rejects.toMatchObject({ status: 404 });
    expect({ flags: await prisma.flag.findMany(), events: await prisma.moderationEvent.findMany() }).toEqual(before);
    expect(await prisma.photo.count({ where: { id: { in: stamps.map((s) => s.id) }, hiddenAt: { not: null } } })).toBe(3);
  });
});
