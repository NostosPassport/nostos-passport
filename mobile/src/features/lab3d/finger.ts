/** The finger on the 3D passport: tracks the drag offset and recent samples, turns a release into a velocity. Time is passed in. */
import { type PointerSample, releaseVelocity } from "./rotation";

export type Finger = {
  dragging: boolean;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  lastAt: number;
  samples: (PointerSample & { at: number })[];
};

const MAX_SAMPLES = 12;
/** Assumed gap for the first move of a drag, ms. */
const FIRST_DT = 16;

export const createFinger = (): Finger => ({ dragging: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0, lastAt: 0, samples: [] });

export function grab(f: Finger, x: number, y: number, at: number) {
  f.dragging = true;
  f.startX = x;
  f.startY = y;
  f.offsetX = 0;
  f.offsetY = 0;
  f.lastAt = at;
  f.samples = [];
}

/** Records a move and returns the horizontal step in px since the last move. */
export function move(f: Finger, x: number, y: number, at: number): number {
  const dx = x - f.startX - f.offsetX;
  f.offsetX = x - f.startX;
  f.offsetY = y - f.startY;
  f.samples.push({ dx, dt: f.samples.length ? at - f.lastAt : FIRST_DT, age: 0, at });
  f.lastAt = at;
  if (f.samples.length > MAX_SAMPLES) f.samples.shift();
  return dx;
}

/** Ends the drag and returns the spin velocity (rad/s) from the last 100 ms. */
export function release(f: Finger, at: number): number {
  const v = releaseVelocity(f.samples.map((s) => ({ dx: s.dx, dt: s.dt, age: at - s.at })));
  f.dragging = false;
  f.offsetX = 0;
  f.offsetY = 0;
  f.samples = [];
  return v;
}
