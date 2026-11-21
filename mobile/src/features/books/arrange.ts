/**
 * Hand placement of stamps in a book. Each book (the main passport, or one collection) keeps its own placement per
 * stamp: the centre as fractions of the page, a size relative to the stamp's automatic size, and a tilt. Stamps with
 * no placement sit in their automatic slot.
 */
import { useCallback, useMemo, useState } from "react";

import { api, errorText } from "@/api";
import type { StampPlacementInputData } from "@/api/collection-contracts";
import { useBookLayout } from "@/api/queries";
import { toast } from "@/components/ui/toast";
import type { Placement } from "@/features/book/slots";
import { haptics } from "@/lib/haptics";
import { PASSPORT_BOOK, useBookActions } from "./books";

export type StampLayout = StampPlacementInputData;

export const MIN_SCALE = 0.4;
export const MAX_SCALE = 2.5;

export function clampScale(s: number): number {
  "worklet";
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

/** Keeps a tilt in -180..180. */
export function normRotation(deg: number): number {
  "worklet";
  const r = ((deg + 180) % 360 + 360) % 360 - 180;
  return r === -180 ? 180 : r;
}

export function clamp01(v: number): number {
  "worklet";
  return Math.min(1, Math.max(0, v));
}

/** The automatic placement with the owner's hand placement applied, in page points. */
export function applyLayout(auto: Placement, layout: StampLayout | undefined, width: number, height: number): Placement {
  if (!layout) return auto;
  return {
    cx: layout.x * width,
    cy: layout.y * height,
    size: auto.size * layout.scale,
    rotation: layout.rotation,
    ...(auto.height !== undefined ? { height: auto.height * layout.scale } : {}),
  };
}

/** Turns a placement in page points back into the stored fractions. `auto` is the stamp's automatic size. */
export function toLayout(p: { cx: number; cy: number; size: number; rotation: number }, autoSize: number, width: number, height: number): StampLayout {
  return {
    x: clamp01(p.cx / width),
    y: clamp01(p.cy / height),
    scale: clampScale(p.size / autoSize),
    rotation: normRotation(p.rotation),
  };
}

/**
 * The placements for one book, with the owner's changes applied at once and saved in the background. A failed save
 * puts the stamp back where it was. `takeOut` removes a stamp from this book only; it stays in the gallery.
 */
export function useArrange(book: string, bookName: string) {
  const layout = useBookLayout(book);
  const { setIn } = useBookActions();
  const [pending, setPending] = useState<Record<string, StampLayout>>({});
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());

  const layouts = useMemo(() => {
    const map = new Map<string, StampLayout>();
    for (const p of layout.data?.placements ?? []) map.set(p.stampId, { x: p.x, y: p.y, scale: p.scale, rotation: p.rotation });
    for (const [id, l] of Object.entries(pending)) map.set(id, l);
    return map;
  }, [layout.data, pending]);

  const place = useCallback((stampId: string, next: StampLayout) => {
    setPending((prev) => ({ ...prev, [stampId]: next }));
    api.books.place(book, stampId, next)
      .then(() => layout.refetch())
      .catch((e: unknown) => {
        haptics.warning();
        toast.show(errorText(e, "Couldn't save where that stamp goes. Try again."), "neutral");
      })
      .finally(() => setPending(({ [stampId]: _done, ...rest }) => rest));
  }, [book, layout]);

  const takeOut = useCallback((stampId: string) => {
    setHidden((prev) => new Set(prev).add(stampId));
    haptics.success();
    setIn(book, [stampId], false)
      .then(() => toast.show(book === PASSPORT_BOOK ? "Taken out of your passport. It's still in your gallery." : `Taken out of ${bookName}. It's still in your gallery.`, "neutral"))
      .catch((e: unknown) => {
        setHidden((prev) => { const next = new Set(prev); next.delete(stampId); return next; });
        haptics.warning();
        toast.show(errorText(e, "Couldn't take that stamp out. Try again."), "neutral");
      });
  }, [book, bookName, setIn]);

  return { layouts, hidden, place, takeOut };
}
