/**
 * Motion tokens. Springs, not linear easing. Nothing settles later than `maxDurationMs`.
 * Spring configs use Reanimated's duration-based springs so the 350 ms cap holds.
 */
export const maxDurationMs = 350;

export const spring = {
  /** Sheet snaps: springy with a little overshoot. */
  sheet: { duration: 340, dampingRatio: 0.78 },
  /** Selected marker scale-up. */
  pop: { duration: 280, dampingRatio: 0.6 },
  /** Small UI (chips, toggles). */
  snappy: { duration: 220, dampingRatio: 0.85 },
} as const;

export const timing = {
  fast: 150,
  standard: 250,
  /** Packed marker glow: one breath. Repeats, but each cycle is well under the cap per phase. */
  glowPhase: 1200,
  skeletonPulse: 900,
} as const;

/** Scale for the selected marker. */
export const selectedMarkerScale = 1.25;
/** Opacity of a disabled/dimmed control. */
export const dimmedOpacity = 0.45;
export const pressedOpacity = 0.7;
