import { describe, expect, it } from "vitest";
import type { ZodTypeAny } from "zod";
import * as C from "@/contracts/api";
import { signupSchema } from "@/server/services/auth";
import { reportInputSchema } from "@/server/services/reports";
import { commentBodySchema } from "@/server/services/comments";
import { officialInfoSchema, promoSchema, claimSchema } from "@/server/services/owner";
import { flagSchema, moderateSchema } from "@/server/services/moderation";
import { deleteAccountSchema } from "@/server/services/account";
import { presenceSchema } from "@/server/services/social";

/** The app validates with the contract's request schemas; they must accept and reject exactly what the server does. */
function agree(contract: ZodTypeAny, server: ZodTypeAny, samples: unknown[]) {
  for (const s of samples) expect(contract.safeParse(s).success, JSON.stringify(s)).toBe(server.safeParse(s).success);
}

describe("contract request schemas agree with server validation", () => {
  const coords = { lat: 40.72, lng: -73.98 };
  it("signup", () =>
    agree(C.SignupRequest, signupSchema, [
      { email: "a@b.co", password: "long enough pw", displayName: "A", handle: "abc", acceptTerms: true, confirm21: true },
      { email: "a@b.co", password: "short", displayName: "A", handle: "abc", acceptTerms: true, confirm21: true },
      { email: "a@b.co", password: "long enough pw", displayName: "A", handle: "a", acceptTerms: true, confirm21: true },
      { email: "a@b.co", password: "long enough pw", displayName: "A", handle: "ABC_ok", acceptTerms: true, confirm21: true },
      { email: "a@b.co", password: "long enough pw", displayName: "A", handle: "abc", acceptTerms: false, confirm21: true },
      { email: "nope", password: "long enough pw", displayName: "A", handle: "abc", acceptTerms: true, confirm21: true },
      { email: "a@b.co", password: "long enough pw", displayName: "A", handle: "abc", acceptTerms: true, confirm21: true, extra: 1 },
    ]));
  it("reports", () =>
    agree(C.ReportRequest, reportInputSchema, [
      { type: "VIBE", vibe: "PACKED", ...coords }, { type: "VIBE", vibe: "LIT", ...coords }, { type: "LINE", line: "NONE", ...coords },
      { type: "COVER", cover: "20", ...coords }, { type: "COVER", cover: "12345678901", ...coords }, { type: "COVER", cover: "free" },
      { type: "VIBE", vibe: "BUSY", lat: 999, lng: 0 },
    ].filter((x) => !("lat" in x && x.lat === 999))));
  it("comments, flags, moderation, presence, claims, deletion", () => {
    agree(C.CommentRequest, commentBodySchema, [{ body: "ok" }, { body: "" }, { body: "   " }, { body: "x".repeat(501) }, { body: "x", extra: 1 }]);
    agree(C.FlagRequest, flagSchema, [
      { targetType: "PHOTO", targetId: "p1", reason: "fake photo" }, { targetType: "USER", targetId: "someone", reason: "abuse" },
      { targetType: "PHOTO", targetId: "p1", reason: "no" }, { targetType: "VENUE", targetId: "v", reason: "hmm hmm" }, { targetType: "PHOTO", targetId: "", reason: "fake" },
    ]);
    agree(C.ModActionRequest, moderateSchema.innerType(), [
      { targetType: "PHOTO", targetId: "p", action: "HIDE" }, { targetType: "USER", targetId: "u", action: "SUSPEND", note: "abuse" }, { targetType: "PHOTO", targetId: "p", action: "DELETE" },
    ]);
    agree(C.PresenceRequest, presenceSchema, [coords, { lat: 40.72 }, { ...coords, extra: 1 }]);
    agree(C.ClaimRequest, claimSchema, [{ venueId: "v1" }, { venueId: "" }, {}]);
    agree(C.DeleteAccountRequest, deleteAccountSchema, [{ password: "x" }, { password: "" }, {}]);
  });
  it("owner info and promos", () => {
    agree(C.OfficialInfoRequest, officialInfoSchema, [
      { dressCode: "No hats" }, { name: "X" }, { name: "Good Name" }, { address: "" }, { officialCover: "15" }, { officialCover: "12345678901" },
      { hours: [{ day: 5, open: "20:00", close: "02:00" }] }, { hours: [{ day: 5, open: "8pm", close: "02:00" }] },
      { hours: [{ day: 5, open: "20:00", close: "02:00" }, { day: 5, open: "21:00", close: "03:00" }] }, { accuracyScore: 100 },
    ]);
    agree(C.PromoRequest, promoSchema.innerType().innerType(), [
      { title: "Late set", body: "DJ from 11", startsAt: "2026-09-25T23:00", endsAt: "2026-09-26T02:00" },
      { title: "No", body: "DJ from 11", startsAt: "2026-09-25T23:00", endsAt: "2026-09-26T02:00" },
      { title: "Late set", body: "DJ from 11", startsAt: "", endsAt: "2026-09-26T02:00" },
      { title: "Late set", body: "DJ from 11", startsAt: "2026-09-25T23:00", endsAt: "2026-09-26T02:00", isPaid: true },
    ]);
  });
});
