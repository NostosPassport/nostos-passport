/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { ServiceError } from "@/server/errors";
import { resolveCollectionShare } from "@/server/services/collection-sharing";

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
  blue: "#123BFF",
  navy: "#1F2C4C",
  green: "#355D45",
  burgundy: "#713642",
  sand: "#B69A70",
  plum: "#5E466D",
};

function dateLabel(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(new Date(value));
}

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
  const coverColor = coverColors[collection.color] ?? coverColors.blue;

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <header className="mb-10 flex items-center justify-between border-b border-line pb-4">
        <a href="/" className="font-serif text-2xl tracking-tight text-text">Nostos</a>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Shared collection</span>
      </header>

      <section className="mb-12 grid gap-7 md:grid-cols-[220px_1fr] md:items-end">
        <div className="aspect-[0.72] w-40 rounded-sm border border-black/10 shadow-xl md:w-52" style={{ backgroundColor: coverColor }}>
          <div className="flex h-full flex-col justify-between p-5 text-white">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-80">Nostos</span>
            <span className="font-serif text-2xl leading-none">{collection.name}</span>
          </div>
        </div>
        <div className="max-w-2xl">
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.16em] text-muted">Shared by {owner.displayName}</p>
          <h1 className="text-5xl leading-[0.95] sm:text-6xl">{collection.name}</h1>
          <p className="mt-4 text-sm text-muted">{collection.stampCount} {collection.stampCount === 1 ? "stamp" : "stamps"}</p>
        </div>
      </section>

      {collection.stamps.length === 0 ? (
        <section className="border-t border-line py-12">
          <p className="font-serif text-2xl">This collection is empty right now.</p>
        </section>
      ) : (
        <section className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {collection.stamps.map((stamp) => (
            <article key={stamp.id} className="min-w-0 border-t border-line pt-4">
              {stamp.photos[0] ? (
                <div className="relative mb-4 aspect-[4/3] overflow-hidden bg-panel-2">
                  <img src={stamp.photos[0].url} alt={`${stamp.place.name} visit`} className="h-full w-full object-cover" />
                  {stamp.photos.length > 1 ? <span className="absolute bottom-2 right-2 bg-text px-2 py-1 font-mono text-[10px] text-ink">+{stamp.photos.length - 1}</span> : null}
                </div>
              ) : null}

              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="truncate text-2xl leading-tight">{stamp.place.name}</h2>
                  <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted">{stamp.place.neighborhood}</p>
                </div>
                <time className="shrink-0 pt-1 font-mono text-[11px] text-muted" dateTime={new Date(stamp.visitedAt).toISOString()}>{dateLabel(stamp.visitedAt)}</time>
              </div>

              {stamp.caption ? <p className="mt-4 whitespace-pre-wrap text-[15px] leading-6">{stamp.caption}</p> : null}
              {stamp.song ? (
                <div className="mt-4 border-l-2 border-accent pl-3">
                  <p className="text-sm">{stamp.song.title}</p>
                  <p className="text-xs text-muted">{stamp.song.artist}</p>
                </div>
              ) : null}
              {stamp.verified ? <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Verified visit</p> : null}
            </article>
          ))}
        </section>
      )}

      <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-xs text-muted">
        <span>Shared from Nostos. This link can be disabled by the collection owner at any time.</span>
        <a href="/support" className="underline underline-offset-2">Report this collection</a>
      </footer>
    </main>
  );
}
