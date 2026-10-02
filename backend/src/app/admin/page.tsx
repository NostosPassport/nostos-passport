import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { TopBar } from "@/components/TopBar";
import { ClaimDecision, PaidToggle } from "@/components/owner/AdminControls";
import { VerificationTools } from "@/components/owner/VerificationTools";
import { getCurrentActor } from "@/server/current";
import { adminOverview } from "@/server/services/admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login?next=/admin");
  if (actor.role !== "ADMIN") notFound();
  const { claims, promos } = await adminOverview(prisma, actor);
  return (
    <>
      <TopBar actor={actor} title="Admin" />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-5">
        <section>
          <h2 className="mb-2 font-semibold">Pending venue claims ({claims.length})</h2>
          {claims.length === 0 && <p className="rounded-2xl bg-panel p-4 text-sm text-muted">Nothing to review.</p>}
          <ul className="space-y-2">
            {claims.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded-2xl bg-panel px-3 py-2.5 text-sm">
                <span>
                  <Link href={`/u/${c.user.handle}`} className="text-accent">@{c.user.handle}</Link> wants to manage{" "}
                  <Link href={`/v/${c.venue.slug}`} className="font-medium">{c.venue.name}</Link>
                  {c.venue.claims.length > 0 && (
                    <span className="mt-0.5 block text-xs text-warn">
                      ⚠ Already managed by {c.venue.claims.map((o) => `@${o.user.handle}`).join(", ")}
                    </span>
                  )}
                </span>
                <ClaimDecision claimId={c.id} />
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="mb-1 font-semibold">Current &amp; upcoming promos</h2>
          <p className="mb-2 text-xs text-muted">Marking a promo paid only adds the &quot;Promoted&quot; label. It never affects how user content is ranked or shown.</p>
          <ul className="space-y-2">
            {promos.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-2xl bg-panel px-3 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{p.title}</span>
                  <span className="block truncate text-xs text-muted">{p.venue.name}</span>
                </span>
                <PaidToggle promoId={p.id} isPaid={p.isPaid} />
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="mb-1 font-semibold">Verified badges</h2>
          <p className="mb-2 text-xs text-muted">Handpicked, no applications. A note is required and every change is logged. The badge changes nothing else: not ranking, featuring or reports.</p>
          <VerificationTools />
        </section>
      </main>
    </>
  );
}
