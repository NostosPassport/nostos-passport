import { ImageManipulator, SaveFormat, type ImageRef } from "expo-image-manipulator";

import { addNostosWatermark } from "./watermark";

/** The server re-encodes to 2048 px anyway; sending less keeps uploads fast and under its 5 MB cap. */
export const MAX_EDGE = 2048;
const QUALITY = 0.8;

export type PreparedImage = { uri: string; width: number; height: number };
export type PrepareImageOptions = { watermark?: boolean };

/**
 * Re-encode as JPEG (HEIC from the library too) with the long edge at most MAX_EDGE. Dimensions come
 * from the decoded image (already rotated), not the picker. Native images are released right away.
 */
export async function prepareImage(uri: string, options: PrepareImageOptions = {}): Promise<PreparedImage> {
  const refs: { release(): void }[] = [];
  try {
    const baseCtx = ImageManipulator.manipulate(uri);
    refs.push(baseCtx);
    const base: ImageRef = await baseCtx.renderAsync();
    refs.push(base);
    let out = base;
    const long = Math.max(base.width, base.height);
    if (long > MAX_EDGE) {
      const ctx = ImageManipulator.manipulate(base);
      refs.push(ctx);
      ctx.resize(base.width >= base.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
      out = await ctx.renderAsync();
      refs.push(out);
    }
    const saved = await out.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });
    const prepared = { uri: saved.uri, width: saved.width, height: saved.height };
    return options.watermark ? addNostosWatermark(prepared) : prepared;
  } finally {
    for (const r of refs.reverse()) {
      try {
        r.release();
      } catch {
        // Already released.
      }
    }
  }
}
