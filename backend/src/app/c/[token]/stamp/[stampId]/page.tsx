import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { STAMP_ARTWORK_STYLE, STAMP_BOX, motifPath, ringsFor, shapePath, stampDesign } from "@/lib/passport-artwork";
import { ServiceError } from "@/server/errors";
import { resolveCollectionShare } from "@/server/services/collection-sharing";
import { CategoryStampSvg } from "../../CategoryStampSvg";
import { StampPhotoGallery } from "./StampPhotoGallery";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Shared stamp · Nostos",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

type Ctx = { params: Promise<{ token: string; stampId: string }> };
type SharedStamp = Awaited<ReturnType<typeof resolveCollectionShare>>["collection"]["stamps"][number];

function locality(stamp: SharedStamp) {
  return stamp.place.area ?? stamp.place.city ?? stamp.place.region ?? stamp.place.country ?? "";
}

function LegacyStamp({ stamp }: { stamp: SharedStamp }) {
  const area = locality(stamp);
  const design = stampDesign({
    placeId: stamp.place.id,
    placeName: stamp.place.name,
    localityKey: stamp.place.area ?? stamp.place.city ?? stamp.place.countryCode ?? stamp.place.country ?? stamp.place.id,
    localityName: area,
  });
  const rings = ringsFor(design.border, STAMP_ARTWORK_STYLE.strokes);
  const textSize = STAMP_ARTWORK_STYLE.text.name * design.nameScale;
  const arcId = `shared-detail-${stamp.id.replace(/[^A-Za-z0-9_-]/g, "")}`;
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${STAMP_BOX} ${STAMP_BOX}`} role="img" aria-label={`${stamp.place.name} stamp`}>
      <defs><path id={arcId} d="M 22 60 A 38 38 0 0 1 98 60" /></defs>
      <g opacity={design.ink} fill="none" stroke="currentColor">
        {rings.map((ring, index) => <path key={index} d={shapePath(design.shape, ring.inset)} strokeWidth={ring.width} strokeDasharray={ring.dash?.join(" ")} strokeLinecap={ring.round ? "round" : "butt"} />)}
      </g>
      <g transform={`translate(60 ${design.layout === "arc" ? 64 : 46})`}><path d={motifPath(design.motif, design.layout === "arc" ? 15 : 12)} fill="currentColor" /></g>
      {design.layout === "arc" ? (
        <text fill="currentColor" fontFamily="var(--font-serif)" fontSize={textSize} letterSpacing={STAMP_ARTWORK_STYLE.text.arcTrack}><textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">{design.arcText}</textPath></text>
      ) : design.lines.map((line, index) => (
        <text key={index} x="60" y={72 + index * (textSize + 3)} fill="currentColor" fontFamily="var(--font-serif)" fontSize={textSize} textAnchor="middle" letterSpacing={STAMP_ARTWORK_STYLE.text.bannerTrack}>{line}</text>
      ))}
      <text x="60" y={design.layout === "arc" ? 100 : 72 + design.lines.length * (textSize + 3) + 3} fill="currentColor" opacity="0.6" fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" fontSize={STAMP_ARTWORK_STYLE.text.area} textAnchor="middle">{design.area}</text>
    </svg>
  );
}

function StampArtwork({ stamp }: { stamp: SharedStamp }) {
  const area = locality(stamp);
  if (stamp.artwork) {
    return <CategoryStampSvg artwork={stamp.artwork} name={stamp.place.name} locality={area} visitedAt={new Date(stamp.visitedAt).toISOString()} timeZone={stamp.place.timeZone} photoUrl={stamp.photos[0]?.url} seed={stamp.place.id} />;
  }
  return <LegacyStamp stamp={stamp} />;
}

export default async function SharedStampPage({ params }: Ctx) {
  noStore();
  const { token, stampId } = await params;
  let shared: Awaited<ReturnType<typeof resolveCollectionShare>>;
  try {
    shared = await resolveCollectionShare(prisma, token);
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }

  const stamp = shared.collection.stamps.find((candidate) => candidate.id === stampId);
  if (!stamp) notFound();
  const area = locality(stamp);
  const visited = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: stamp.place.timeZone }).format(new Date(stamp.visitedAt));
  const backHref = `/c/${encodeURIComponent(token)}`;

  return (
    <main className="min-h-screen px-4 py-6 sm:px-8 sm:py-10">
      <header className="mx-auto mb-8 flex w-full max-w-6xl items-center justify-between border-b border-line pb-4">
        <Link href={backHref} className="font-mono text-xs uppercase tracking-[0.16em] text-muted hover:text-text">← Back to collection</Link>
        <Link href="/" className="font-serif text-2xl tracking-tight text-text">Nostos</Link>
      </header>

      <article className="mx-auto w-full max-w-6xl">
        <div className="mb-8 border-b border-line pb-8">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">{shared.collection.name} · {visited}</p>
          <h1 className="font-serif text-5xl leading-none tracking-tight text-text sm:text-7xl">{stamp.place.name}</h1>
          {area ? <p className="mt-3 font-mono text-xs uppercase tracking-[0.18em] text-muted">{area}</p> : null}
        </div>

        <div className="grid gap-10 lg:grid-cols-[minmax(300px,420px)_1fr] lg:items-start">
          <section>
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Stamp</p>
            <div className="mx-auto aspect-[1.5/1] w-full max-w-[420px] text-text lg:mx-0">
              <StampArtwork stamp={stamp} />
            </div>
          </section>

          <section className="space-y-8">
            {stamp.caption ? (
              <div>
                <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Memory</p>
                <p className="max-w-2xl font-serif text-3xl leading-tight text-text sm:text-4xl">{stamp.caption}</p>
              </div>
            ) : null}
            {stamp.song ? (
              <div className="border-y border-line py-4">
                <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Song</p>
                <p className="text-base text-text">{stamp.song.title}</p>
                <p className="text-sm text-muted">{stamp.song.artist}</p>
              </div>
            ) : null}
            <div>
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Photos · {stamp.photos.length}</p>
              <StampPhotoGallery photos={stamp.photos.map((photo) => ({ id: photo.id, url: photo.url }))} />
            </div>
          </section>
        </div>

        <div className="mt-12 flex items-center gap-2 border-t border-line pt-4 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stamp.verified ? "#5FA37D" : "#D09A52" }} aria-hidden="true" />
          <span>{stamp.verified ? "Location verified by Nostos" : "Visit not location verified"}</span>
        </div>
      </article>
    </main>
  );
}
