import { describe, expect, it } from "vitest";
import type { ZodTypeAny } from "zod";
import * as C from "@/contracts/api";
import { signupSchema } from "@/server/services/auth";
import { flagSchema, moderateSchema } from "@/server/services/moderation";
import { deleteAccountSchema } from "@/server/services/account";
import { stampEditSchema } from "@/server/services/stamps";

/** The app validates with the contract's request schemas; they must accept and reject exactly what the server does. */
function agree(contract: ZodTypeAny, server: ZodTypeAny, samples: unknown[]) {
  for (const s of samples) expect(contract.safeParse(s).success, JSON.stringify(s)).toBe(server.safeParse(s).success);
}

describe("contract request schemas agree with server validation", () => {
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
  it("flags, moderation, deletion", () => {
    agree(C.FlagRequest, flagSchema, [
      { targetType: "STAMP", targetId: "p1", reason: "fake photo" }, { targetType: "USER", targetId: "someone", reason: "abuse" },
      { targetType: "STAMP", targetId: "p1", reason: "no" }, { targetType: "PHOTO", targetId: "p1", reason: "fake photo" }, { targetType: "COMMENT", targetId: "c", reason: "hmm hmm" },
      { targetType: "STAMP", targetId: "", reason: "fake" },
    ]);
    agree(C.ModActionRequest, moderateSchema.innerType(), [
      { targetType: "STAMP", targetId: "p", action: "HIDE" }, { targetType: "USER", targetId: "u", action: "SUSPEND", note: "abuse" }, { targetType: "STAMP", targetId: "p", action: "DELETE" },
      { targetType: "PHOTO", targetId: "p", action: "HIDE" },
    ]);
    agree(C.DeleteAccountRequest, deleteAccountSchema, [{ password: "x" }, { password: "" }, {}]);
  });
  it("stamp edits", () =>
    agree(C.StampEditRequest, stampEditSchema, [
      { caption: "new caption" }, { caption: "x".repeat(280) }, { caption: "x".repeat(281) }, {}, { caption: "ok", extra: 1 },
      { song: null }, { song: { title: "T", artist: "A" } }, { song: { title: "T" } }, { song: { title: "", artist: "A" } },
      { song: { title: "T", artist: "A", artUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music/x/300x300bb.jpg", sourceId: "123" } },
      { song: { title: "T", artist: "A", artUrl: "https://evil.example/pixel.gif" } }, { song: { title: "T", artist: "A", artUrl: "http://a.mzstatic.com/x.jpg" } },
      { song: { title: "T", artist: "A", artUrl: null } },
    ]));
});
