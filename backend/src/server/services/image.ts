import sharp from "sharp";
import { MAX_UPLOAD_BYTES, sniffImage, type ImageKind } from "@/lib/storage";
import { badRequest, ServiceError } from "@/server/errors";

export const MAX_IMAGE_DIMENSION = 2048;

/**
 * Validates and re-encodes an upload. Size limit and magic-byte type check first (client Content-Type is
 * ignored), then a full decode + re-encode with sharp. It applies EXIF orientation, caps each side at 2048px
 * and writes a fresh file with **no metadata** (EXIF/GPS/XMP/ICC dropped), so a phone's location never
 * leaks through a photo (rule 5). Anything sharp can't decode is rejected as unsupported.
 */
export async function processImage(input: Buffer): Promise<{ bytes: Buffer; kind: ImageKind }> {
  if (input.length === 0) throw badRequest("Empty file");
  if (input.length > MAX_UPLOAD_BYTES) throw new ServiceError(413, "too_large", "Photos must be 5 MB or smaller");
  const kind = sniffImage(input);
  if (!kind) throw new ServiceError(415, "unsupported_type", "Only JPEG, PNG or WebP images are allowed");
  try {
    const pipeline = sharp(input, { failOn: "error", limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION, fit: "inside", withoutEnlargement: true });
    const out =
      kind.ext === "png" ? pipeline.png({ compressionLevel: 9 }) : kind.ext === "webp" ? pipeline.webp({ quality: 85 }) : pipeline.jpeg({ quality: 85 });
    return { bytes: await out.toBuffer(), kind };
  } catch {
    throw new ServiceError(415, "unsupported_type", "That image couldn't be read. Try a JPEG, PNG or WebP photo.");
  }
}
