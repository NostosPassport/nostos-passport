import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { lockAndCheckCooldown } from "@/server/services/geofence";

describe("stamp cooldown", () => {
  it("only considers live stamps, so a removed stamp does not block restamping", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(0),
      photo: { findFirst },
    } as unknown as Prisma.TransactionClient;

    await lockAndCheckCooldown(tx, { userId: "u1", venueId: "v1" }, new Date("2026-10-07T12:00:00Z"));

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "u1", venueId: "v1", removedAt: null }),
      }),
    );
  });
});
