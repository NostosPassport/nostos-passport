/**
 * A procedural photo studio for the passport's glass: one overhead softbox, two vertical strips at the sides, a brass rim
 * light behind and a dim warm fill. Colors come from the theme (`scene3d`), nothing reaches white. Pure math, so it is
 * tested; the lab uploads the pixels as an equirect texture (clearcoat) or as six cube faces (the fake reflection).
 */
import { scene3d } from "@/theme";

type Rgb = readonly [number, number, number];
type Vec3 = readonly [number, number, number];

const rgbOf = (hex: string): Rgb => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const TONES = {
  base: rgbOf(scene3d.studio),
  softbox: rgbOf(scene3d.softbox),
  strip: rgbOf(scene3d.strip),
  rim: rgbOf(scene3d.rim),
  fill: rgbOf(scene3d.fill),
  floor: rgbOf(scene3d.floor),
};
/** No channel may exceed this: nothing in the studio is white. */
const CEILING = 236;

const smooth = (edge0: number, edge1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Unit direction from an azimuth (0 faces the viewer, toward +z) and an elevation, both in radians. */
export const directionOf = (azimuth: number, elevation: number): Vec3 => [Math.cos(elevation) * Math.sin(azimuth), Math.sin(elevation), Math.cos(elevation) * Math.cos(azimuth)];

/** Light level 0..1 of one source: a soft-edged band in azimuth and elevation. */
const band = (az: number, el: number, centerAz: number, halfAz: number, loEl: number, hiEl: number) =>
  (1 - smooth(halfAz * 0.6, halfAz, Math.abs(wrapPi(az - centerAz)))) * smooth(loEl - 0.12, loEl, el) * (1 - smooth(hiEl, hiEl + 0.12, el));

/** The studio's color in a world direction. */
export function envColor(dir: Vec3): [number, number, number] {
  const [x, y, z] = dir;
  const az = Math.atan2(x, z);
  const el = Math.asin(Math.max(-1, Math.min(1, y)));
  const softbox = 1 - smooth(0.45, 0.6, Math.acos(Math.max(-1, Math.min(1, y)))); // a round softbox straight overhead
  const stripL = band(az, el, Math.PI / 2, 0.3, -0.35, 0.85);
  const stripR = band(az, el, -Math.PI / 2, 0.3, -0.35, 0.85);
  const rim = band(az, el, Math.PI, 0.22, -0.15, 0.6);
  const floor = Math.max(0, -y) * 0.3;
  const front = Math.max(0, z) * 0.14;
  const out: [number, number, number] = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const v = Math.max(
      TONES.base[c]!,
      TONES.softbox[c]! * 0.92 * softbox,
      TONES.strip[c]! * 0.85 * Math.max(stripL, stripR),
      TONES.rim[c]! * 0.9 * rim,
      TONES.floor[c]! * floor,
      TONES.fill[c]! * front,
    );
    out[c] = Math.round(Math.min(CEILING, v));
  }
  return out;
}

/** Equirect RGBA pixels, row 0 at the bottom (three's convention for an unflipped DataTexture). */
export function buildEquirect(width: number, height: number): Uint8Array {
  const px = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const el = ((y + 0.5) / height - 0.5) * Math.PI;
    for (let x = 0; x < width; x++) {
      const phi = ((x + 0.5) / width - 0.5) * 2 * Math.PI;
      const [r, g, b] = envColor([Math.cos(el) * Math.cos(phi), Math.sin(el), Math.cos(el) * Math.sin(phi)]);
      const i = (y * width + x) * 4;
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = 255;
    }
  }
  return px;
}

/** One cube face (0..5 = +x, -x, +y, -y, +z, -z) as RGBA, row 0 at the top. The studio is mirror-symmetric, so handedness cannot show. */
export function buildCubeFace(face: number, size: number): Uint8Array {
  const px = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    const v = ((j + 0.5) / size) * 2 - 1;
    for (let i = 0; i < size; i++) {
      const u = ((i + 0.5) / size) * 2 - 1;
      const faces: Vec3[] = [[1, -v, -u], [-1, -v, u], [u, 1, v], [u, -1, -v], [u, -v, 1], [-u, -v, -1]];
      const d = faces[face]!;
      const len = Math.hypot(d[0], d[1], d[2]);
      const [r, g, b] = envColor([d[0] / len, d[1] / len, d[2] / len]);
      const k = (j * size + i) * 4;
      px[k] = r;
      px[k + 1] = g;
      px[k + 2] = b;
      px[k + 3] = 255;
    }
  }
  return px;
}
