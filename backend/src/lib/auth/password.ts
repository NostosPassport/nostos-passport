import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

// scrypt parameters. N=2^15, r=8, p=1 is the OWASP-recommended floor for interactive logins (~32 MiB, ~50ms).
export const SCRYPT_PARAMS = { N: 32768, r: 8, p: 1, keyLen: 64, saltLen: 16 } as const;
const MAXMEM = 64 * 1024 * 1024;

function scrypt(password: string, salt: Buffer, keyLen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password.normalize("NFKC"), salt, keyLen, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** Returns "scrypt$N$r$p$saltB64$hashB64" so parameters can be raised later without breaking old hashes. */
export async function hashPassword(password: string): Promise<string> {
  const { N, r, p, keyLen, saltLen } = SCRYPT_PARAMS;
  const salt = randomBytes(saltLen);
  const key = await scrypt(password, salt, keyLen, { N, r, p, maxmem: MAXMEM });
  return ["scrypt", N, r, p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nS, rS, pS, saltB64, hashB64] = parts as [string, string, string, string, string, string];
  const N = Number(nS), r = Number(rS), p = Number(pS);
  if (![N, r, p].every(Number.isSafeInteger)) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, { N, r, p, maxmem: MAXMEM });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** A real hash of a random password, used to keep login timing flat when the email doesn't exist. */
let dummyHash: Promise<string> | null = null;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  return dummyHash;
}
