import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { ServiceError } from "@/server/errors";
import { resolveCollectionShare } from "@/server/services/collection-sharing";
import { SharedPassportReader } from "./SharedPassportReader";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Shared collection · Nostos",
  description: "A collection shared from Nostos.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

type Ctx = { params: Promise<{ token: string }> };

const coverColors: Record<string, string> = {
  blue: "#5F84D7",
  navy: "#355078",
  green: "#55705F",
  burgundy: "#7B4E59",
  sand: "#B29872",
  plum: "#6B587A",
};

export default async function SharedCollectionPage({ params }: Ctx) {
  noStore();
  const { token } = await params;
  let shared: Awaited<ReturnType<typeof resolveCollectionShare>>;
  try {
    shared = await resolveCollectionShare(prisma, token);
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }

  const { collection, owner } = shared;
  const coverColor = coverColors[collection.color] ?? "#5F84D7";
  const stamps = collection.stamps.map((stamp) => ({
    id: stamp.id,
    caption: stamp.caption,
    visitedAt: new Date(stamp.visitedAt).toISOString(),
    verified: stamp.verified,
    artwork: stamp.artwork ?? null,
    page: stamp.page ?? 1,
    slot: stamp.slot ?? 1,
    photos: stamp.photos.map((photo) => ({ id: photo.id, url: photo.url })),
    song: stamp.song ? { title: stamp.song.title, artist: stamp.song.artist } : null,
    place: {
      id: stamp.place.id,
      name: stamp.place.name,
      neighborhood: stamp.place.neighborhood,
      neighborhoodId: stamp.place.neighborhoodId,
    },
  }));

  return (
    <main className="min-h-screen px-4 py-7 sm:px-8 sm:py-10">
      <header className="mx-auto mb-4 flex w-full max-w-6xl items-center justify-between border-b border-line pb-4">
        <Link href="/" className="font-serif text-2xl tracking-tight text-text">Nostos</Link>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Shared collection</span>
      </header>

      <SharedPassportReader
        collectionName={collection.name}
        ownerName={owner.displayName}
        coverColor={coverColor}
        stamps={stamps}
      />

      <footer className="mx-auto mt-12 flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-xs text-muted">
        <span>Shared from Nostos. This link can be disabled by the collection owner at any time.</span>
        <Link href="/support" className="underline underline-offset-2">Report this collection</Link>
      </footer>
    </main>
  );
}
