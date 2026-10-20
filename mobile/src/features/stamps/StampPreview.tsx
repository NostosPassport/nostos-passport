import { useEffect, useState } from "react";
import type { Place } from "@/api/contracts";
import { CategoryStampMark } from "@/features/book/CategoryStampMark";
import { fetchMichelinPreview, michelinPreviewDraft, type MichelinStars } from "@/features/stamps/michelin-preview";
import { localityLabel } from "@/lib/place";
import { resolveCategoryStamp } from "../../../../shared/category-stamp-artwork";

export function StampPreview({ place, visitedAt, photoUri, size }: { place: Place; visitedAt: string; photoUri?: string | null; size: number }) {
  const artwork = resolveCategoryStamp(place);
  const key = place.googlePlaceId ?? place.id;
  const [michelinStars, setMichelinStars] = useState<MichelinStars | null>(null);

  useEffect(() => {
    let live = true;
    michelinPreviewDraft.select(key);
    setMichelinStars(null);
    if (place.category !== "restaurant") return () => michelinPreviewDraft.clear(key);
    void fetchMichelinPreview(key).then((preview) => {
      if (!live) return;
      michelinPreviewDraft.resolve(key, preview);
      setMichelinStars(preview.stars);
    }).catch(() => {
      if (live) michelinPreviewDraft.resolve(key, { venueId: place.id, stars: null, proof: null });
    });
    return () => {
      live = false;
      michelinPreviewDraft.clear(key);
    };
  }, [key, place.category, place.id]);

  if (!artwork) return null;
  return (
    <CategoryStampMark
      artwork={{ ...artwork, michelinStars }}
      name={place.name}
      locality={localityLabel(place)}
      visitedAt={visitedAt}
      timeZone={place.timeZone}
      photoUri={photoUri}
      size={size}
      seed={place.id}
    />
  );
}
