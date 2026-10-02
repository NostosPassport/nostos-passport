import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { TopBar } from "@/components/TopBar";
import { OfficialPanel } from "@/components/venue/OfficialPanel";
import { LivePanel } from "@/components/venue/LivePanel";
import { getCurrentActor } from "@/server/current";
import { ServiceError } from "@/server/errors";
import { getVenuePage } from "@/server/services/venues";
import { venueBySlug } from "@/server/queries";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const venue = await venueBySlug((await params).slug);
  return { title: venue ? `${venue.name} · Nostos` : "Venue · Nostos" };
}

export default async function VenuePage({ params }: Props) {
  const { slug } = await params;
  const actor = await getCurrentActor();
  let page;
  try {
    page = await getVenuePage(prisma, slug, actor);
  } catch (e) {
    if (e instanceof ServiceError && e.status === 404) notFound();
    throw e;
  }
  return (
    <>
      <TopBar actor={actor} title={page.official.name} />
      <main className="mx-auto max-w-2xl space-y-4 px-4 pb-16 pt-4">
        <div>
          <h2 className="text-2xl font-bold leading-tight">{page.official.name}</h2>
          <p className="text-sm text-muted">
            {page.official.address ? `${page.official.address} · ${page.official.neighborhood}` : page.official.neighborhood}
          </p>
        </div>
        <LivePanel page={page} signedIn={Boolean(actor)} />
        <OfficialPanel page={page} />
      </main>
    </>
  );
}
