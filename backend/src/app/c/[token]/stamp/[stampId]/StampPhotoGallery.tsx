"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";

type Photo = { id: string; url: string };

export function StampPhotoGallery({ photos }: { photos: Photo[] }) {
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    if (active === null) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActive(null);
      if (event.key === "ArrowLeft") setActive((value) => value === null ? null : Math.max(0, value - 1));
      if (event.key === "ArrowRight") setActive((value) => value === null ? null : Math.min(photos.length - 1, value + 1));
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [active, photos.length]);

  if (!photos.length) return <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted">No photos</p>;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((photo, index) => (
          <button key={photo.id} type="button" className="group relative aspect-square overflow-hidden bg-panel text-left" onClick={() => setActive(index)} aria-label={`Enlarge photo ${index + 1} of ${photos.length}`}>
            <img src={photo.url} alt="" className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]" />
            {index === 0 ? <span className="absolute bottom-2 left-2 bg-black/65 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white">Stamp cover</span> : null}
          </button>
        ))}
      </div>
      {active !== null ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={`Photo ${active + 1} of ${photos.length}`} onClick={() => setActive(null)}>
          <button type="button" onClick={() => setActive(null)} className="absolute right-4 top-4 z-10 rounded-full bg-black/55 px-4 py-2 text-sm text-white" aria-label="Close enlarged photo">Close</button>
          {active > 0 ? <button type="button" className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/55 px-4 py-3 text-2xl text-white" onClick={(event) => { event.stopPropagation(); setActive(active - 1); }} aria-label="Previous photo">‹</button> : null}
          <img src={photos[active]!.url} alt="" className="max-h-[92vh] max-w-[94vw] object-contain" onClick={(event) => event.stopPropagation()} />
          {active < photos.length - 1 ? <button type="button" className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/55 px-4 py-3 text-2xl text-white" onClick={(event) => { event.stopPropagation(); setActive(active + 1); }} aria-label="Next photo">›</button> : null}
        </div>
      ) : null}
    </>
  );
}
