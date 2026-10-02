import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, SCRYPT_PARAMS } from "@/lib/auth/password";

describe("password hashing (scrypt)", () => {
  it("round-trips and encodes parameters", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash.startsWith(`scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$`)).toBe(true);
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("correct horse batterY", hash)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same")).not.toEqual(await hashPassword("same"));
  });

  it("rejects malformed stored hashes", async () => {
    expect(await verifyPassword("x", "plaintext")).toBe(false);
    expect(await verifyPassword("x", "scrypt$abc$8$1$AA$AA")).toBe(false);
  });
});
