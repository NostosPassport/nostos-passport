import { Asset } from "expo-asset";
import { File, Paths } from "expo-file-system";
import { FilterMode, ImageFormat, MipmapMode, Skia, rect, type SkImage } from "@shopify/react-native-skia";

const WATERMARK_ASSET = require("../../../assets/images/nostos-watermark.png");
const WATERMARK_SHARE = 0.095;
const WATERMARK_INSET_SHARE = 0.03;
const WATERMARK_OPACITY = 0.35;
const JPEG_QUALITY = 80;

let watermarkImagePromise: Promise<SkImage> | null = null;

async function decodeImage(uri: string): Promise<SkImage> {
  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error("Couldn't decode image");
  return image;
}

async function watermarkImage(): Promise<SkImage> {
  watermarkImagePromise ??= (async () => {
    const asset = Asset.fromModule(WATERMARK_ASSET);
    const loaded = asset.localUri ? asset : await asset.downloadAsync();
    const uri = loaded.localUri ?? loaded.uri;
    if (!uri) throw new Error("Couldn't load Nostos watermark");
    return decodeImage(uri);
  })();
  return watermarkImagePromise;
}

export function watermarkRect(width: number, height: number) {
  const shortEdge = Math.min(width, height);
  const box = Math.max(1, Math.round(shortEdge * WATERMARK_SHARE));
  const inset = Math.max(1, Math.round(shortEdge * WATERMARK_INSET_SHARE));
  return { x: width - box - inset, y: height - box - inset, width: box, height: box };
}

export async function addNostosWatermark(input: { uri: string; width: number; height: number }) {
  const [photo, mark] = await Promise.all([decodeImage(input.uri), watermarkImage()]);
  const surface = Skia.Surface.MakeOffscreen(input.width, input.height);
  if (!surface) {
    photo.dispose();
    throw new Error("Couldn't create watermark surface");
  }

  let snapshot: SkImage | null = null;
  try {
    const canvas = surface.getCanvas();
    const paint = Skia.Paint();
    canvas.drawImageRectOptions(
      photo,
      rect(0, 0, photo.width(), photo.height()),
      rect(0, 0, input.width, input.height),
      FilterMode.Linear,
      MipmapMode.Linear,
      paint,
    );

    const target = watermarkRect(input.width, input.height);
    paint.setAlphaf(WATERMARK_OPACITY);
    canvas.drawImageRectOptions(
      mark,
      rect(0, 0, mark.width(), mark.height()),
      rect(target.x, target.y, target.width, target.height),
      FilterMode.Linear,
      MipmapMode.Linear,
      paint,
    );

    surface.flush();
    snapshot = surface.makeImageSnapshot();
    const bytes = snapshot.encodeToBytes(ImageFormat.JPEG, JPEG_QUALITY);
    const output = new File(Paths.cache, `nostos-camera-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
    output.writeSync(bytes);
    return { uri: output.uri, width: input.width, height: input.height };
  } finally {
    snapshot?.dispose();
    photo.dispose();
    (surface as { dispose?: () => void }).dispose?.();
  }
}
