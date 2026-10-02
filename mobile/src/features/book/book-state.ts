/** The book's four moments, and where the stage (the whole book) sits in each. Pure, so the sequence can be tested. */
export type Phase = "closed" | "opening" | "open" | "closing";
export type PhaseEvent = "tapCover" | "coverSettled" | "closeBook";

export function nextPhase(phase: Phase, event: PhaseEvent): Phase {
  if (phase === "closed" && event === "tapCover") return "opening";
  if (phase === "opening" && event === "coverSettled") return "open";
  if (phase === "open" && event === "closeBook") return "closing";
  if (phase === "closing" && event === "coverSettled") return "closed";
  return phase;
}

export const isOpenish = (phase: Phase) => phase === "opening" || phase === "open";

/**
 * The stage is two pages wide with the cover on its right half. Closed, the cover is centered on the screen at full size;
 * open, the whole spread is centered, scaled down to fit. `p` is 0 closed, 1 open.
 */
export function stageTransform(p: number, pageWidth: number, openScale: number): { scale: number; translateX: number } {
  const t = Math.min(1, Math.max(0, p));
  const scale = 1 + (openScale - 1) * t;
  return { scale, translateX: -(pageWidth / 2) * scale * (1 - t) };
}

/** What the footer says about the spread on screen. */
export function spreadLabel(spread: number, pageCount: number): string {
  if (spread <= 0) return "Bearer page";
  const left = spread * 2 - 1;
  const right = Math.min(left + 1, pageCount);
  return right > left ? `Pages ${left} and ${right}` : `Page ${left}`;
}
