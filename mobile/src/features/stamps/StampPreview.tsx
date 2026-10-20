import type { Place } from "@/api/contracts";
import { CategoryStampMark } from "@/features/book/CategoryStampMark";
import { localityLabel } from "@/lib/place";
import { resolveCategoryStamp } from "../../../../shared/category-stamp-artwork";

export function StampPreview({ place, visitedAt, photoUri, size }: { place: Place; visitedAt: string; photoUri?: string | null; size: number }) {
  const artwork = resolveCategoryStamp(place);
  if (!artwork) return null;
  return (
    <CategoryStampMark
      artwork={artwork}
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
