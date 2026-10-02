export const MAX_PINS = 4;

export type PinChange = { kind: "pin" | "unpin"; ids: string[] } | { kind: "full" };

/** Pin or unpin one stamp, given the ids pinned now (in order). A fifth pin is refused: unpin one first. */
export function pinChange(current: readonly string[], id: string): PinChange {
  if (current.includes(id)) return { kind: "unpin", ids: current.filter((x) => x !== id) };
  if (current.length >= MAX_PINS) return { kind: "full" };
  return { kind: "pin", ids: [...current, id] };
}
