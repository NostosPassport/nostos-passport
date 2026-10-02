import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { recomputeAllReputations } from "@/server/services/reputation";
import { makeUser, makeVenue, INSIDE } from "./factories";

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

async function vibe(userId: string, venueId: string, vibe: "PACKED" | "DEAD" | "BUSY", at: Date, hidden = false) {
  return prisma.report.create({ data: { userId, venueId, type: "VIBE", vibe, ...INSIDE, createdAt: at, hiddenAt: hidden ? new Date() : null } });
}

describe("reputation job", () => {
  it("raises agreeing reporters, lowers a contrarian, leaves newcomers at 0.5", async () => {
    const now = new Date();
    const venue = await makeVenue();
    const honest = await Promise.all([1, 2, 3, 4].map(() => makeUser()));
    const troll = await makeUser();
    const newbie = await makeUser({ ageDays: 0 });
    for (let d = 1; d <= 16; d++) {
      const base = now.getTime() - d * DAY;
      await vibe(troll.id, venue.id, "DEAD", new Date(base)); // troll reports first; honest crowd follows
      // rotate order so every honest user is sometimes early enough to be judged by later peers
      for (let i = 0; i < honest.length; i++) await vibe(honest[(i + d) % honest.length]!.id, venue.id, "PACKED", new Date(base + (i + 1) * MIN));
    }
    await recomputeAllReputations(prisma, now);
    const reps = Object.fromEntries((await prisma.user.findMany()).map((u) => [u.id, u.reputation]));
    for (const u of honest) expect(reps[u.id]).toBeGreaterThan(0.9);
    expect(reps[troll.id]).toBeLessThan(0.3);
    expect(reps[troll.id]).toBeGreaterThanOrEqual(0.2);
    expect(reps[newbie.id]).toBe(0.5);
  });

  it("ignores hidden reports on both sides", async () => {
    const now = new Date();
    const venue = await makeVenue();
    const [a, b, troll] = await Promise.all([makeUser(), makeUser(), makeUser()]);
    for (let d = 1; d <= 5; d++) {
      const base = now.getTime() - d * DAY;
      await vibe(troll.id, venue.id, "DEAD", new Date(base), true); // hidden by a moderator
      await vibe(a.id, venue.id, "PACKED", new Date(base + MIN));
      await vibe(b.id, venue.id, "PACKED", new Date(base + 2 * MIN));
    }
    await recomputeAllReputations(prisma, now);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: troll.id } })).reputation).toBe(0.5);
  });

  it("does not judge reports younger than 30 minutes", async () => {
    const now = new Date();
    const venue = await makeVenue();
    const [a, b, c] = await Promise.all([makeUser(), makeUser(), makeUser()]);
    await vibe(c.id, venue.id, "DEAD", new Date(now.getTime() - 20 * MIN));
    await vibe(a.id, venue.id, "BUSY", new Date(now.getTime() - 10 * MIN));
    await vibe(b.id, venue.id, "BUSY", new Date(now.getTime() - 5 * MIN));
    expect((await recomputeAllReputations(prisma, now)).judged).toBe(0);
  });

  it("gives at most one verdict per user/venue/metric/hour (no farming by re-reporting)", async () => {
    const now = new Date();
    const venue = await makeVenue();
    const [farmer, a, b] = await Promise.all([makeUser(), makeUser(), makeUser()]);
    const base = new Date(Math.floor((now.getTime() - DAY) / (60 * MIN)) * 60 * MIN).getTime();
    for (const m of [0, 15, 30, 45]) await vibe(farmer.id, venue.id, "PACKED", new Date(base + m * MIN));
    for (const m of [50, 55]) await vibe(a.id, venue.id, "PACKED", new Date(base + m * MIN));
    await vibe(b.id, venue.id, "PACKED", new Date(base + 58 * MIN));
    const res = await recomputeAllReputations(prisma, now);
    // farmer: 1 verdict (first report in the hour); a: 1 (the 50-min report, judged by b + a's own later report is excluded)
    expect(res.judged).toBeLessThanOrEqual(2);
  });

  it("keeps the current reputation for users with no verdicts in the lookback", async () => {
    const quiet = await makeUser({ reputation: 0.25 });
    await recomputeAllReputations(prisma, new Date());
    expect((await prisma.user.findUniqueOrThrow({ where: { id: quiet.id } })).reputation).toBe(0.25);
  });
});
