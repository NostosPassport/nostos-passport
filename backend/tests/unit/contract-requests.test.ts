import { describe, expect, it } from "vitest";
import type { ZodTypeAny } from "zod";
import * as C from "@/contracts/api";
import { loginSchema, loginStartSchema, signupSchema, signupStartSchema } from "@/server/services/auth";
import { changeEmailSchema, startEmailChangeSchema } from "@/server/services/email";
import { deleteAccountSchema } from "@/server/services/account";
import { stampEditSchema } from "@/server/services/stamps";

function agree(contract: ZodTypeAny, server: ZodTypeAny, samples: unknown[]) {
  for (const s of samples) expect(contract.safeParse(s).success, JSON.stringify(s)).toBe(server.safeParse(s).success);
}

const CHALLENGE = "11111111-1111-4111-8111-111111111111";

describe("contract request schemas agree with server validation", () => {
  it("signup start", () =>
    agree(C.SignupStartRequest, signupStartSchema, [
      { email: "a@b.co", displayName: "A", handle: "abc", birthdate: "1990-05-05", acceptTerms: true },
      { email: "nope", displayName: "A", handle: "abc", birthdate: "1990-05-05", acceptTerms: true },
      { email: "a@b.co", displayName: "", handle: "abc", birthdate: "1990-05-05", acceptTerms: true },
      { email: "a@b.co", displayName: "A", handle: "a", birthdate: "1990-05-05", acceptTerms: true },
      { email: "a@b.co", displayName: "A", handle: "bad-handle", birthdate: "1990-05-05", acceptTerms: true },
      { email: "a@b.co", displayName: "A", handle: "abc", birthdate: "2001-02-29", acceptTerms: true },
      { email: "a@b.co", displayName: "A", handle: "abc", birthdate: "1990-05-05", acceptTerms: false },
      { email: "a@b.co", displayName: "A", birthdate: "1990-05-05", acceptTerms: true },
      { email: "a@b.co", displayName: "A", handle: "abc", birthdate: "1990-05-05" },
      { email: "a@b.co", displayName: "A", handle: "abc", birthdate: "1990-05-05", acceptTerms: true, extra: true },
    ]));

  it("signup completion", () =>
    agree(C.SignupRequest, signupSchema, [
      { challengeId: CHALLENGE, code: "123456", displayName: "A", handle: "abc", acceptTerms: true },
      { challengeId: CHALLENGE, code: "123456", displayName: "A", handle: "abc.def_123", acceptTerms: true },
      { challengeId: "bad", code: "123456", displayName: "A", handle: "abc", acceptTerms: true },
      { challengeId: CHALLENGE, code: "12345", displayName: "A", handle: "abc", acceptTerms: true },
      { challengeId: CHALLENGE, code: "abcdef", displayName: "A", handle: "abc", acceptTerms: true },
      { challengeId: CHALLENGE, code: "123456", displayName: "A", handle: "a", acceptTerms: true },
      { challengeId: CHALLENGE, code: "123456", displayName: "A", handle: "a".repeat(31), acceptTerms: true },
      { challengeId: CHALLENGE, code: "123456", displayName: "A", handle: "bad-handle", acceptTerms: true },
      { challengeId: CHALLENGE, code: "123456", displayName: "A", handle: "ABC_ok", acceptTerms: true },
      { challengeId: CHALLENGE, code: "123456", displayName: "A", handle: "abc", acceptTerms: false },
      { challengeId: CHALLENGE, code: "123456", displayName: "A", handle: "abc", acceptTerms: true, extra: 1 },
    ]));

  it("login", () => {
    agree(C.LoginStartRequest, loginStartSchema, [
      { email: "a@b.co" }, { identifier: "ava" }, { email: "nope" }, { email: "a@b.co", extra: true },
    ]);
    agree(C.LoginRequest, loginSchema, [
      { challengeId: CHALLENGE, code: "123456" },
      { challengeId: "bad", code: "123456" },
      { challengeId: CHALLENGE, code: "12345" },
      { challengeId: CHALLENGE, code: "abcdef" },
      { challengeId: CHALLENGE, code: "123456", extra: true },
    ]);
  });

  it("email change and deletion", () => {
    agree(C.EmailChangeStartRequest, startEmailChangeSchema, [
      { email: "new@b.co" }, { email: "nope" }, { email: "new@b.co", extra: true },
    ]);
    agree(C.EmailChangeRequest, changeEmailSchema, [
      { challengeId: CHALLENGE, code: "123456" }, { challengeId: "bad", code: "123456" }, { challengeId: CHALLENGE, code: "12345" }, {},
    ]);
    agree(C.DeleteAccountRequest, deleteAccountSchema, [
      { challengeId: CHALLENGE, code: "123456" }, { challengeId: "bad", code: "123456" }, { challengeId: CHALLENGE, code: "12345" }, {},
    ]);
  });

  it("stamp edits, including visit dates", () =>
    agree(C.StampEditRequest, stampEditSchema, [
      { caption: "new caption" }, { caption: "x".repeat(280) }, { caption: "x".repeat(281) }, {}, { caption: "ok", extra: 1 },
      { song: null }, { song: { title: "T", artist: "A" } }, { song: { title: "T" } }, { song: { title: "", artist: "A" } },
      { song: { title: "T", artist: "A", artUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music/x/300x300bb.jpg", sourceId: "123" } },
      { song: { title: "T", artist: "A", artUrl: "https://evil.example/pixel.gif" } }, { song: { title: "T", artist: "A", artUrl: "http://a.mzstatic.com/x.jpg" } },
      { song: { title: "T", artist: "A", artUrl: null } },
      { visitedAt: "2026-10-08T16:00:00.000Z" }, { visitedAt: "not-a-date" },
    ]));
});
