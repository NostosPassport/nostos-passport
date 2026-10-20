import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { startSignup, UNDERAGE_MESSAGE } from "@/server/services/auth";
import { POST as signupStartRoute } from "@/app/api/auth/signup/start/route";

const NOW = new Date("2026-10-02T16:00:00Z");
const base = { email: "kid@x.dev", displayName: "Kid", handle: "kid_user", acceptTerms: true };

async function rowCounts() {
  const tables = await prisma.$queryRaw<{ table_name: string }[]>`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'`;
  const out: Record<string, number> = {};
  for (const { table_name } of tables) out[table_name] = Number((await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "${table_name}"`))[0]!.n);
  return out;
}

describe("the 13+ age gate at signup", () => {
  it("turns away someone one day short of 13 before storing anything", async () => {
    const before = await rowCounts();
    await expect(startSignup(prisma, { ...base, birthdate: "2013-10-03" }, { ip: "127.0.0.1", now: NOW })).rejects.toMatchObject({
      status: 403,
      code: "underage",
      message: UNDERAGE_MESSAGE,
    });
    expect(await rowCounts()).toEqual(before);
  });

  it("checks age before duplicate-account disclosure", async () => {
    await prisma.user.create({ data: { email: base.email, handle: base.handle, displayName: base.displayName } });
    await expect(startSignup(prisma, { ...base, birthdate: "2014-01-01" }, { ip: "127.0.0.1", now: NOW })).rejects.toMatchObject({ status: 403, code: "underage" });
    await expect(startSignup(prisma, { ...base, birthdate: "1990-05-05" }, { ip: "127.0.0.1", now: NOW })).rejects.toMatchObject({ status: 409 });
  });

  it("accepts someone on their 13th birthday and never persists the birthdate", async () => {
    const realKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    try {
      const challenge = await startSignup(prisma, { ...base, birthdate: "2013-10-02" }, { ip: "127.0.0.1", now: NOW });
      expect(challenge.challengeId).toBeTruthy();
    } finally {
      if (realKey) process.env.RESEND_API_KEY = realKey;
    }

    const cols = await prisma.$queryRaw<{ table_name: string; column_name: string }[]>`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`;
    expect(cols.filter((c) => /birth|dob/i.test(c.column_name)).map((c) => `${c.table_name}.${c.column_name}`)).toEqual([]);
  });

  it("requires a real YYYY-MM-DD birthdate", async () => {
    for (const birthdate of [undefined, "", "05/05/1990", "1990-13-01", "1990-02-30", "not a date"]) {
      await expect(startSignup(prisma, { ...base, birthdate }, { ip: "127.0.0.1", now: NOW })).rejects.toThrow();
    }
  });

  it("returns 403 underage over HTTP with no session or challenge", async () => {
    const beforeChallenges = await prisma.emailChallenge.count();
    const res = await signupStartRoute(
      new Request("http://localhost/api/auth/signup/start", {
        method: "POST",
        headers: { "content-type": "application/json", "x-client": "ios" },
        body: JSON.stringify({ ...base, birthdate: "2015-06-01" }),
      }),
      undefined as never,
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "underage", message: UNDERAGE_MESSAGE });
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(await prisma.session.count()).toBe(0);
    expect(await prisma.emailChallenge.count()).toBe(beforeChallenges);
  });
});
