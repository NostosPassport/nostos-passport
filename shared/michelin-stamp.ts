export type MichelinStars = 1 | 2 | 3;

export type MichelinMark = { cx: number; cy: number; r: number };

export function michelinMarkCenters(
  mark: MichelinMark,
  stars: MichelinStars,
) {
  const radius = mark.r * 0.72;
  const spacing = 11.5;
  const center = mark.cx - 8;
  const start = center - ((stars - 1) * spacing) / 2;
  return Array.from({ length: stars }, (_, index) => ({
    cx: start + index * spacing,
    cy: mark.cy,
    r: radius,
  }));
}

function rotatePoint(x: number, y: number, angle: number, cx: number, cy: number) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: cx + x * c - y * s, y: cy + x * s + y * c };
}

const n = (value: number) => Number(value.toFixed(2));

export function michelinStarPath(mark: MichelinMark) {
  const r = mark.r;
  const inner = r * 0.24;
  const side = r * 0.62;
  const outer = r * 1.52;
  const shoulder = r * 1.04;
  const paths: string[] = [];

  for (let index = 0; index < 6; index++) {
    const angle = (index * Math.PI) / 3;
    const p0 = rotatePoint(0, -inner, angle, mark.cx, mark.cy);
    const c1 = rotatePoint(-r * 0.32, -r * 0.46, angle, mark.cx, mark.cy);
    const c2 = rotatePoint(-side, -r * 0.72, angle, mark.cx, mark.cy);
    const p1 = rotatePoint(-side, -shoulder, angle, mark.cx, mark.cy);
    const c3 = rotatePoint(-side * 0.9, -r * 1.35, angle, mark.cx, mark.cy);
    const c4 = rotatePoint(-r * 0.28, -outer, angle, mark.cx, mark.cy);
    const p2 = rotatePoint(0, -outer, angle, mark.cx, mark.cy);
    const c5 = rotatePoint(r * 0.28, -outer, angle, mark.cx, mark.cy);
    const c6 = rotatePoint(side * 0.9, -r * 1.35, angle, mark.cx, mark.cy);
    const p3 = rotatePoint(side, -shoulder, angle, mark.cx, mark.cy);
    const c7 = rotatePoint(side, -r * 0.72, angle, mark.cx, mark.cy);
    const c8 = rotatePoint(r * 0.32, -r * 0.46, angle, mark.cx, mark.cy);

    paths.push(
      `M ${n(p0.x)} ${n(p0.y)} C ${n(c1.x)} ${n(c1.y)} ${n(c2.x)} ${n(c2.y)} ${n(p1.x)} ${n(p1.y)} C ${n(c3.x)} ${n(c3.y)} ${n(c4.x)} ${n(c4.y)} ${n(p2.x)} ${n(p2.y)} C ${n(c5.x)} ${n(c5.y)} ${n(c6.x)} ${n(c6.y)} ${n(p3.x)} ${n(p3.y)} C ${n(c7.x)} ${n(c7.y)} ${n(c8.x)} ${n(c8.y)} ${n(p0.x)} ${n(p0.y)} Z`,
    );
  }

  return paths.join(" ");
}

export const michelinStarStrokeWidth = (mark: MichelinMark) => Math.max(1, mark.r * 0.34);
