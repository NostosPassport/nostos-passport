import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { DevLoginList } from "./DevLoginList";

export const dynamic = "force-dynamic";

export default async function DevLoginPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const password = process.env.DEV_SEED_PASSWORD ?? "lastcall-dev";
  const users = await prisma.user.findMany({
    where: { email: { endsWith: "@lastcall.dev" } },
    orderBy: { handle: "asc" },
    select: { email: true, handle: true, displayName: true, createdAt: true },
  });
  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="text-xl font-bold">Dev login</h1>
      <p className="mt-1 text-sm text-muted">Every seeded account uses the password <code className="rounded bg-panel-2 px-1.5 py-0.5 text-warn">{password}</code>.</p>
      <DevLoginList password={password} users={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))} />
    </main>
  );
}
