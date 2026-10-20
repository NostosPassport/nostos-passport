export type MichelinStars = 1 | 2 | 3;

export function michelinMarkCenters(
  mark: { cx: number; cy: number; r: number },
  stars: MichelinStars,
) {
  const spacing = 11;
  const center = mark.cx - 8;
  const start = center - ((stars - 1) * spacing) / 2;
  return Array.from({ length: stars }, (_, index) => ({
    cx: start + index * spacing,
    cy: mark.cy,
    r: mark.r,
  }));
}
