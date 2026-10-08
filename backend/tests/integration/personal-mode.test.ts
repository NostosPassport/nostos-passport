import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { getStamp, listUserPlaces, listUserStamps } from "@/server/services/stamps";
import { installMemoryStorage } from "./mem-storage";
import { makeActor, makeStamp, makeVenue } from "./factories";

installMemoryStorage();

describe("personal mode", () => {
  it("only exposes a passport and place history to its owner", async () => {
    const me = await makeActor();
    const other = await makeActor();
    const mine = await makeStamp(me, (await makeVenue()).id);
    const theirs = await makeStamp(other, (await makeVenue()).id);

    await expect(getStamp(prisma, me, mine.id)).resolves.toBeTruthy();
    await expect(getStamp(prisma, me, theirs.id)).rejects.toMatchObject({ status: 404 });
    await expect(getStamp(prisma, other, mine.id)).rejects.toMatchObject({ status: 404 });

    await expect(listUserStamps(prisma, me, me.handle)).resolves.toBeTruthy();
    await expect(listUserPlaces(prisma, me, me.handle)).resolves.toBeTruthy();
    await expect(listUserStamps(prisma, me, other.handle)).rejects.toMatchObject({ status: 404 });
    await expect(listUserPlaces(prisma, me, other.handle)).rejects.toMatchObject({ status: 404 });
  });

  it("signed-out requests cannot read owner resources", async () => {
    const me = await makeActor();
    const mine = await makeStamp(me, (await makeVenue()).id);
    await expect(getStamp(prisma, null, mine.id)).rejects.toMatchObject({ status: 401 });
    await expect(listUserStamps(prisma, null, me.handle)).rejects.toMatchObject({ status: 401 });
    await expect(listUserPlaces(prisma, null, me.handle)).rejects.toMatchObject({ status: 401 });
  });
});
