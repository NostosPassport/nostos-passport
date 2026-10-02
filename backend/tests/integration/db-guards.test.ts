import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { makeUser, makeVenue, INSIDE } from "./factories";

// Database-level backstops for invariant 5 (hide, never delete; append-only log) and invariant 6.
describe("database guards", () => {
  async function fixtures() {
    const user = await makeUser();
    const venue = await makeVenue();
    const report = await prisma.report.create({ data: { userId: user.id, venueId: venue.id, type: "VIBE", vibe: "BUSY", ...INSIDE } });
    const photo = await prisma.photo.create({
      data: { userId: user.id, venueId: venue.id, storageKey: "photos/t.png", mimeType: "image/png", caption: "x", ...INSIDE },
    });
    const comment = await prisma.comment.create({ data: { userId: user.id, venueId: venue.id, body: "hi" } });
    const event = await prisma.moderationEvent.create({ data: { action: "HIDE", targetType: "PHOTO", targetId: photo.id, actorId: user.id } });
    return { user, venue, report, photo, comment, event };
  }

  it("rejects UPDATE and DELETE on moderation_event", async () => {
    const { event } = await fixtures();
    await expect(prisma.moderationEvent.update({ where: { id: event.id }, data: { note: "rewrite history" } })).rejects.toThrow(/append-only/);
    await expect(prisma.moderationEvent.delete({ where: { id: event.id } })).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRawUnsafe(`DELETE FROM moderation_event`)).rejects.toThrow(/append-only/);
    expect(await prisma.moderationEvent.count()).toBe(1);
  });

  it("rejects DELETE of user content", async () => {
    const { report, photo, comment } = await fixtures();
    await expect(prisma.report.delete({ where: { id: report.id } })).rejects.toThrow(/hide user content/);
    await expect(prisma.photo.delete({ where: { id: photo.id } })).rejects.toThrow(/hide user content/);
    await expect(prisma.comment.delete({ where: { id: comment.id } })).rejects.toThrow(/hide user content/);
  });

  it("allows hiding but not rewriting user content", async () => {
    const { report, photo, comment } = await fixtures();
    await prisma.photo.update({ where: { id: photo.id }, data: { hiddenAt: new Date() } });
    await expect(prisma.photo.update({ where: { id: photo.id }, data: { createdAt: new Date() } })).rejects.toThrow(/immutable/);
    await expect(prisma.report.update({ where: { id: report.id }, data: { vibe: "DEAD" } })).rejects.toThrow(/immutable/);
    await expect(prisma.comment.update({ where: { id: comment.id }, data: { userId: (await makeUser()).id } })).rejects.toThrow(/only body/);
    await prisma.comment.update({ where: { id: comment.id }, data: { body: "edited", editedAt: new Date() } });
  });

  it("rejects UPDATE/DELETE on the official cover history", async () => {
    const { venue } = await fixtures();
    const row = await prisma.venueCoverHistory.findFirstOrThrow({ where: { venueId: venue.id } });
    await expect(prisma.venueCoverHistory.update({ where: { id: row.id }, data: { coverCents: 0 } })).rejects.toThrow(/append-only/);
    await expect(prisma.venueCoverHistory.delete({ where: { id: row.id } })).rejects.toThrow(/append-only/);
  });

  it("enforces value constraints", async () => {
    const { user, venue } = await fixtures();
    await expect(prisma.user.update({ where: { id: user.id }, data: { reputation: 2 } })).rejects.toThrow();
    await expect(
      prisma.report.create({ data: { userId: user.id, venueId: venue.id, type: "COVER", vibe: "BUSY", ...INSIDE } }),
    ).rejects.toThrow();
    await expect(prisma.comment.create({ data: { userId: user.id, venueId: venue.id, body: "x", isVenueReply: true } })).rejects.toThrow();
  });
});
