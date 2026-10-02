"worklet";
/**
 * The stamp landing, as a function of time. The stamp hovers large, slams down, and on impact the ink spreads, the page shakes
 * and a glow flares and fades. Pure: the screen reads `landingFrame(t)` every frame, and the haptic fires at `LANDING.impact`.
 * With Reduce Motion the stamp only fades in: no scale, no shake, no flare.
 */
export const LANDING = { rise: 140, impact: 230, ink: 420, glow: 900, shake: 280, total: 1200 };

export type LandingFrame = {
  /** Stamp scale: large while it hovers, 1 at rest, a small settle after impact. */
  scale: number;
  opacity: number;
  /** 0 at impact to 1 when the ink has finished spreading. */
  inkSpread: number;
  /** 0 to 1: flares on impact, fades out. */
  glow: number;
  shakeX: number;
  shakeY: number;
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function landingFrame(tMs: number, reduced: boolean): LandingFrame {
  if (reduced) return { scale: 1, opacity: clamp01(tMs / 220), inkSpread: 1, glow: 0, shakeX: 0, shakeY: 0 };
  if (tMs <= 0) return { scale: 1.7, opacity: 0, inkSpread: 0, glow: 0, shakeX: 0, shakeY: 0 };
  if (tMs < LANDING.impact) {
    // Hover (fade up at full size), then fall: slow at first, fast at the end.
    const fall = clamp01((tMs - LANDING.rise) / (LANDING.impact - LANDING.rise));
    return { scale: 1.7 - 0.7 * fall * fall, opacity: 0.9 * clamp01(tMs / LANDING.rise) + 0.1 * fall, inkSpread: 0, glow: 0, shakeX: 0, shakeY: 0 };
  }
  const dt = tMs - LANDING.impact;
  const ink = clamp01(dt / LANDING.ink);
  const attack = LANDING.glow * 0.25;
  const glow = dt < attack ? dt / attack : clamp01(1 - (dt - attack) / (LANDING.glow - attack));
  const left = clamp01(1 - dt / LANDING.shake);
  const amp = 4 * left * left;
  return {
    scale: 1 + 0.05 * Math.sin(ink * Math.PI),
    opacity: 1,
    inkSpread: 1 - (1 - ink) * (1 - ink),
    glow,
    shakeX: amp * Math.sin(dt * 0.11),
    shakeY: amp * 0.6 * Math.cos(dt * 0.13),
  };
}
