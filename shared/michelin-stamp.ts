export type MichelinStars = 1 | 2 | 3;

export function michelinMarkCenters(
  mark: { cx: number; cy: number; r: number },
  stars: MichelinStars,
) {
  const spacing = 13;
  const start = mark.cx - ((stars - 1) * spacing) / 2;
  return Array.from({ length: stars }, (_, index) => ({
    cx: start + index * spacing,
    cy: mark.cy,
    r: mark.r,
  }));
}
