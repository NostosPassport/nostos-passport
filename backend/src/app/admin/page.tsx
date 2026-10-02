import { notFound, redirect } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { VerificationTools } from "@/components/admin/VerificationTools";
import { getCurrentActor } from "@/server/current";

import { socialEnabled } from "@/server/social";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!socialEnabled()) notFound();
  const actor = await getCurrentActor();
  if (!actor) redirect("/login?next=/admin");
  if (actor.role !== "ADMIN") notFound();
  return (
    <>
      <TopBar actor={actor} title="Admin" />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-5">
        <section>
          <h2 className="mb-1 font-semibold">Verified badges</h2>
          <p className="mb-2 text-xs text-muted">Handpicked, no applications. A note is required and every change is logged. The badge changes nothing else: not visibility, order or anything a person can do.</p>
          <VerificationTools />
        </section>
      </main>
    </>
  );
}
