import { describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { listPins, MAX_PINS, setPins } from "@/server/services/pins";
import { removeStamp } from "@/server/services/stamps";
import { getProfile } from "@/server/services/people";
import { installMemoryStorage } from "./mem-storage";
import { makeActor, makeStamp, makeVenue } from "./factories";

installMemoryStorage();
async function stamps(actor: Awaited<ReturnType<typeof makeActor>>, n: number) {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push((await makeStamp(actor, (await makeVenue()).id, { caption: `s${i}` })).id);
  return out;
}

describe("pinned stamps", () => {
  it("up to four of your own, in the order given, replaced as a set", async () => {
    const me = await makeActor();
    const ids = await stamps(me, 6);
    expect(MAX_PINS).toBe(4);
    expect((await setPins(prisma, me, { stampIds: [ids[2]!, ids[0]!, ids[5]!, ids[1]!] })).stamps.map((s) => s.id)).toEqual([ids[2], ids[0], ids[5], ids[1]]);
    expect((await setPins(prisma, me, { stampIds: [ids[3]!] })).stamps.map((s) => s.id)).toEqual([ids[3]]);
    expect((await setPins(prisma, me, { stampIds: [] })).stamps).toEqual([]);
    await expect(setPins(prisma, me, { stampIds: ids.slice(0, 5) })).rejects.toThrow(/up to 4/);
    await expect(setPins(prisma, me, { stampIds: [ids[0]!, ids[0]!] })).rejects.toMatchObject({ status: 400 });
    await expect(setPins(prisma, null, { stampIds: [] })).rejects.toMatchObject({ status: 401 });
  });

  it("only your own stamps, in the service and in the database", async () => {
    const me = await makeActor();
    const other = await makeActor({ isPrivate: false });
    const [mine] = await stamps(me, 1);
    const [theirs] = await stamps(other, 1);
    await expect(setPins(prisma, me, { stampIds: [theirs!] })).rejects.toMatchObject({ status: 400 });
    await expect(setPins(prisma, me, { stampIds: ["nope"] })).rejects.toMatchObject({ status: 400 });
    await expect(prisma.pinnedStamp.create({ data: { userId: me.userId, stampId: theirs!, position: 0 } })).rejects.toThrow(/only pin your own/);
    await expect(prisma.pinnedStamp.create({ data: { userId: me.userId, stampId: mine!, position: 4 } })).rejects.toThrow();
  });

  it("owner only: nobody else's view of you carries pins, and a removed stamp drops out of yours", async () => {
    vi.stubEnv("SOCIAL_ENABLED", "1");
    const me = await makeActor({ isPrivate: false });
    const ids = await stamps(me, 2);
    await setPins(prisma, me, { stampIds: ids });
    const viewer = await makeActor();
    expect(JSON.stringify(await getProfile(prisma, me.handle, viewer))).not.toMatch(/pin/i);
    await expect(listPins(prisma, viewer)).resolves.toEqual({ stamps: [] });
    await removeStamp(prisma, me, ids[0]!);
    expect((await listPins(prisma, me)).stamps.map((s) => s.id)).toEqual([ids[1]]);
    vi.unstubAllEnvs();
  });
});
