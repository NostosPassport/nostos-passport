import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { TopBar } from "@/components/TopBar";
import { ClaimForm } from "@/components/owner/ClaimForm";
import { getCurrentActor } from "@/server/current";
import { ownerOverview } from "@/server/services/owner";

export const dynamic = "force-dynamic";

export default async function OwnerHome() {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login?next=/owner");
  const { venues, claims } = await ownerOverview(prisma, actor);
  const canClaim = actor.role === "USER" || actor.role === "VENUE_OWNER";
  const allVenues = canClaim
    ? await prisma.venue.findMany({ where: { id: { notIn: actor.ownedVenueIds } }, orderBy: { name: "asc" }, select: { id: true, name: true } })
    : [];
  return (
    <>
      <TopBar actor={actor} title="My venues" />
      <main className="mx-auto max-w-lg space-y-5 px-4 py-5">
        {venues.length > 0 ? (
          <ul className="space-y-2">
            {venues.map((v) => (
              <li key={v.id}>
                <Link href={`/owner/${v.id}`} className="flex items-center justify-between rounded-2xl border border-venue/40 bg-panel px-4 py-3">
                  <span className="font-medium">{v.name}</span>
                  <span className="text-sm text-venue">Dashboard →</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-panel p-4 text-sm text-muted">You don&apos;t manage any venues yet.</p>
        )}
        {claims.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold">Your claims</h2>
            <ul className="space-y-1 text-sm">
              {claims.map((c) => (
                <li key={c.id} className="flex justify-between rounded-xl bg-panel px-3 py-2">
                  <span>{c.venue.name}</span>
                  <span className={c.status === "PENDING" ? "text-warn" : "text-packed"}>{c.status.toLowerCase()}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {canClaim && (
          <section className="rounded-2xl bg-panel p-4">
            <h2 className="font-semibold">{venues.length ? "Manage another venue?" : "Run a venue?"}</h2>
            <p className="mb-3 mt-1 text-sm text-muted">
              Claim it to manage official info, post promos and reply to comments. An admin reviews every claim. Venue accounts
              can&apos;t post live reports or edit what people say.
            </p>
            <ClaimForm venues={allVenues} />
          </section>
        )}
      </main>
    </>
  );
}
