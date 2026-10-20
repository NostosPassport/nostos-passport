import { footprintOf, slotPlacement as place } from "../../../../shared/passport-artwork";

export {
  STAMP_SHARE,
  footprintOf,
  placementHeight,
  boxOf,
  overlapShare,
  slotPlacement,
} from "../../../../shared/passport-artwork";

export type { Placement, StampFootprint } from "../../../../shared/passport-artwork";

/** Where a stored stamp sits on its page: sized by its artwork (category stamps) or the legacy neutral size. */
export const stampPlacement = (stamp: { id: string; slot: number | null; artwork?: { kind?: string; template?: string } | null }, width: number, height: number) =>
  place(stamp.id, stamp.slot ?? 1, width, height, footprintOf(stamp.artwork));
