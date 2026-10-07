/** Pure rules for when the 3D lab renders and how often. The render loop asks these every tick. */

export const FPS = { idle: 30, active: 60, lowPower: 30 } as const;

export type LoopInputs = { focused: boolean; appActive: boolean; visible: boolean };

/** The loop runs only while the screen is focused, the app is in the foreground and the model is on screen. */
export const loopActive = (i: LoopInputs) => i.focused && i.appActive && i.visible;

/** 60 fps while the finger is down, the model is coasting or the soak test runs; 30 otherwise; 30 always in Low Power Mode. */
export const targetFps = ({ active, lowPower }: { active: boolean; lowPower: boolean }) => (lowPower ? FPS.lowPower : active ? FPS.active : FPS.idle);

/** A display tick can land a little early, so allow this much slack against the frame interval (ms). */
const VSYNC_SLACK_MS = 2;

export function shouldRender(nowMs: number, lastRenderMs: number | null, fps: number): boolean {
  if (lastRenderMs === null) return true;
  return nowMs - lastRenderMs >= 1000 / fps - VSYNC_SLACK_MS;
}

/** Render resolution: the device ratio, capped at 2 (1.5 in Low Power Mode). */
export const pixelRatioFor = (devicePixelRatio: number, lowPower: boolean) => Math.min(devicePixelRatio, lowPower ? 1.5 : 2);
