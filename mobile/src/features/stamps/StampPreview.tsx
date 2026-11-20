import { useEffect, useState } from "react";
import Animated, { FadeIn } from "react-native-reanimated";
import type { Place } from "@/api/contracts";
import { CategoryStampMark } from "@/features/book/CategoryStampMark";
import { fetchMichelinPreview, michelinPreviewDraft, type MichelinStars } from "@/features/stamps/michelin-preview";
import { localityLabel } from "@/lib/place";
import { timing } from "@/theme";
import { resolveCategoryStamp } from "../../../../shared/category-stamp-artwork";

/** How long a restaurant's preview waits for its Michelin stars before drawing without them. */
const STARS_WAIT_MS = 800;

/** Whether this place has stamp artwork to preview. The composer hides the preview block when it doesn't (P-096). */
export function hasStampArtwork(place: Place): boolean {
  return resolveCategoryStamp(place) !== null;
}

export function StampPreview({ place, visitedAt, photoUri, size }: { place: Place; visitedAt: string; photoUri?: string | null; size: number }) {
  const artwork = resolveCategoryStamp(place);
  const key = place.googlePlaceId ?? place.id;
  const [preview, setPreview] = useState<{ key: string; stars: MichelinStars | null } | null>(null);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const michelinStars = preview?.key === key ? preview.stars : null;
  // A restaurant's stamp waits briefly for its stars, then fades in once, instead of drawing and then jumping.
  const waiting = place.category === "restaurant" && settledKey !== key;

  useEffect(() => {
    let live = true;
    michelinPreviewDraft.select(key);
    if (place.category !== "restaurant") return () => michelinPreviewDraft.clear(key);
    const giveUp = setTimeout(() => { if (live) setSettledKey(key); }, STARS_WAIT_MS);
    void fetchMichelinPreview(key).then((result) => {
      if (!live) return;
      michelinPreviewDraft.resolve(key, result);
      setPreview({ key, stars: result.stars });
      setSettledKey(key);
    }).catch(() => {
      if (!live) return;
      michelinPreviewDraft.resolve(key, { venueId: place.id, stars: null, proof: null });
      setSettledKey(key);
    });
    return () => {
      live = false;
      clearTimeout(giveUp);
      michelinPreviewDraft.clear(key);
    };
  }, [key, place.category, place.id]);

  if (!artwork || waiting) return null;
  return (
    <Animated.View key={key} entering={FadeIn.duration(timing.standard)}>
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
    </Animated.View>
  );
}
