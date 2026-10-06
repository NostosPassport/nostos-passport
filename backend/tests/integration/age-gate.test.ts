import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { login, signup, UNDERAGE_MESSAGE } from "@/server/services/auth";
import { POST as signupRoute } from "@/app/api/auth/signup/route";

const NOW = new Date("2026-10-02T16:00:00Z");
const base = { email: "kid@x.dev", password: "long enough pw1", displayName: "Kid", handle: "kid_user", acceptTerms: true };

/** Row counts of every table in the public schema. */
async function rowCounts() {
  const tables = await prisma.$queryRaw<{ table_name: string }[]>`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'`;
  const out: Record<string, number> = {};
  for (const { table_name } of tables) out[table_name] = Number((await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "${table_name}"`))[0]!.n);
  return out;
}

describe("the 21+ age gate at signup", () => {
  it("turns away someone one day short of 21 with 403 underage, and stores nothing at all", async () => {
    const before = await rowCounts();
    await expect(signup(prisma, { ...base, birthdate: "2005-10-03" }, { now: NOW })).rejects.toMatchObject({ status: 403, code: "underage", message: UNDERAGE_MESSAGE });
    expect(await rowCounts()).toEqual(before);
    // Not even a login attempt, a session or a user row for that email or handle.
    expect(await prisma.user.count({ where: { OR: [{ email: base.email }, { handle: base.handle }] } })).toBe(0);
  });

  it("the refusal comes before the duplicate check, so it reveals nothing about existing accounts", async () => {
    await signup(prisma, { ...base, birthdate: "1990-05-05" }, { now: NOW });
    await expect(signup(prisma, { ...base, birthdate: "2010-01-01" }, { now: NOW })).rejects.toMatchObject({ status: 403, code: "underage" });
    await expect(signup(prisma, { ...base, birthdate: "1990-05-05" }, { now: NOW })).rejects.toMatchObject({ status: 409 });
  });

  it("lets someone in on their 21st birthday, and keeps no birthdate or age anywhere", async () => {
    const { user } = await signup(prisma, { ...base, birthdate: "2005-10-02" }, { now: NOW });
    expect(JSON.stringify(user)).not.toMatch(/2005|birth|dob|age/i);
    const cols = await prisma.$queryRaw<{ table_name: string; column_name: string }[]>`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`;
    expect(cols.filter((c) => /birth|dob|age$|^age/i.test(c.column_name)).map((c) => `${c.table_name}.${c.column_name}`)).toEqual([]);
    expect(await login(prisma, { email: base.email, password: base.password })).toBeTruthy();
  });

  it("requires a real birthdate in YYYY-MM-DD form", async () => {
    for (const bad of [undefined, "", "05/05/1990", "1990-13-01", "1990-02-30", "not a date"]) {
      await expect(signup(prisma, { ...base, birthdate: bad }, { now: NOW })).rejects.toThrow();
    }
    expect(await prisma.user.count()).toBe(0);
    // The old checkbox is gone: it is no longer accepted in place of a birthdate.
    await expect(signup(prisma, { ...base, confirm21: true }, { now: NOW })).rejects.toThrow();
  });

  it("over HTTP: an under-21 gets 403 underage and no session cookie or token", async () => {
    const res = await signupRoute(
      new Request("http://localhost/api/auth/signup", { method: "POST", headers: { "content-type": "application/json", "x-client": "ios" }, body: JSON.stringify({ ...base, birthdate: "2015-06-01" }) }),
      undefined as never,
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "underage", message: UNDERAGE_MESSAGE });
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(await prisma.session.count()).toBe(0);
  });
});
