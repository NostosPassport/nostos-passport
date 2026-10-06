import { describe, expect, it } from "vitest";
import type { ZodTypeAny } from "zod";
import * as C from "@/contracts/api";
import { loginSchema, signupSchema } from "@/server/services/auth";
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
      { email: "a@b.co", password: "long enough pw1", displayName: "A", handle: "abc", acceptTerms: true, birthdate: "1990-05-05" },
      { email: "a@b.co", password: "long enough pw1", displayName: "A", handle: "abc.def_123", acceptTerms: true, birthdate: "1990-05-05" },
      { email: "a@b.co", password: "short1", displayName: "A", handle: "abc", acceptTerms: true, birthdate: "1990-05-05" },
      { email: "a@b.co", password: "abcdefghij", displayName: "A", handle: "abc", acceptTerms: true, birthdate: "1990-05-05" },
      { email: "a@b.co", password: "1234567890", displayName: "A", handle: "abc", acceptTerms: true, birthdate: "1990-05-05" },
      { email: "a@b.co", password: "long enough pw1", displayName: "A", handle: "a", acceptTerms: true, birthdate: "1990-05-05" },
      { email: "a@b.co", password: "long enough pw1", displayName: "A", handle: "a".repeat(31), acceptTerms: true, birthdate: "1990-05-05" },
      { email: "a@b.co", password: "long enough pw1", displayName: "A", handle: "bad-handle", acceptTerms: true, birthdate: "1990-05-05" },
      { email: "a@b.co", password: "long enough pw1", displayName: "A", handle: "ABC_ok", acceptTerms: true, birthdate: "1990-05-05" },
      { email: "a@b.co", password: "long enough pw1", displayName: "A", handle: "abc", acceptTerms: false, birthdate: "1990-05-05" },
      { email: "nope", password: "long enough pw1", displayName: "A", handle: "abc", acceptTerms: true, birthdate: "1990-05-05" },
      { email: "a@b.co", password: "long enough pw1", displayName: "A", handle: "abc", acceptTerms: true, birthdate: "1990-05-05", extra: 1 },
    ]));
  it("login", () =>
    agree(C.LoginRequest, loginSchema, [
      { email: "a@b.co", password: "anything" },
      { email: "abc.def_123", password: "anything" },
      { email: "ABCD", password: "anything" },
      { email: "ab", password: "anything" },
      { email: "a".repeat(201), password: "anything" },
      { email: "abc", password: "x".repeat(201) },
      { email: "abc", password: "anything", extra: true },
    ]));
  it("flags, moderation, deletion", () => {
    agree(C.FlagRequest, flagSchema, [
      { targetType: "STAMP", targetId: "p1", reason: "fake photo" }, { targetType: "USER", targetId: "someone", reason: "abuse" },
      { targetType: "STAMP", targetId: "p1", reason: "no" }, { targetType: "PHOTO", targetId: "p1", reason: "fake photo" }, { targetType: "COMMENT", targetId: "c", reason: "hmm hmm" },
      { targetType: "STAMP", targetId: "", reason: "fake" },
      { targetType: "STAMP", targetId: "p1", reason: "not here", category: "NOT_AT_PLACE" }, { targetType: "USER", targetId: "u", reason: "too young", category: "UNDERAGE" },
      { targetType: "USER", targetId: "u", reason: "follows me", category: "STALKING" }, { targetType: "USER", targetId: "u", reason: "nope nope", category: "BORING" },
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
