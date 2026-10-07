/** Decodes PNG or JPEG bytes to RGBA with Skia (native, already in the app), for the 3D lab's textures. Rows run top to bottom. */
import { AlphaType, ColorType, Skia } from "@shopify/react-native-skia";

import type { DecodedImage } from "./load-model";

export function decodeImage(bytes: Uint8Array): DecodedImage | null {
  const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(bytes));
  if (!image) return null;
  const width = image.width();
  const height = image.height();
  const pixels = image.readPixels(0, 0, { width, height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
  image.dispose();
  return pixels instanceof Uint8Array ? { data: pixels, width, height } : null;
}

/** Reverses the row order (an equirect DataTexture without flipY wants its first row at the bottom). */
export function flipRows({ data, width, height }: DecodedImage): DecodedImage {
  const row = width * 4;
  const out = new Uint8Array(data.length);
  for (let y = 0; y < height; y++) out.set(data.subarray(y * row, (y + 1) * row), (height - 1 - y) * row);
  return { data: out, width, height };
}
