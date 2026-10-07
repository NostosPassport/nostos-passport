import { File } from "expo-file-system";
import * as piexif from "piexifjs";

export type NostosCameraMetadata = {
  capturedAt: number;
  lat?: number;
  lng?: number;
};

const pad = (value: number) => String(value).padStart(2, "0");

function localExifDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}:${pad(date.getMonth() + 1)}:${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function utcGpsDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getUTCFullYear()}:${pad(date.getUTCMonth() + 1)}:${pad(date.getUTCDate())}`;
}

function bytesToBinary(bytes: Uint8Array): string {
  const chunks: string[] = [];
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) chunks.push(String.fromCharCode(...bytes.subarray(i, Math.min(i + size, bytes.length))));
  return chunks.join("");
}

function binaryToBytes(binary: string): Uint8Array {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i) & 0xff;
  return bytes;
}

/** Adds provenance that survives when the accepted Nostos capture is saved to Photos. */
export async function addNostosCameraMetadata(uri: string, metadata: NostosCameraMetadata): Promise<void> {
  const file = new File(uri);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const zeroth: Record<number, unknown> = {
    [piexif.ImageIFD.Software]: "Nostos",
    [piexif.ImageIFD.ImageDescription]: "Taken on Nostos",
  };
  const taken = localExifDate(metadata.capturedAt);
  const exif: Record<number, unknown> = {
    [piexif.ExifIFD.DateTimeOriginal]: taken,
    [piexif.ExifIFD.DateTimeDigitized]: taken,
  };
  const gps: Record<number, unknown> = {};
  const lat = metadata.lat;
  const lng = metadata.lng;

  if (typeof lat === "number" && Number.isFinite(lat) && typeof lng === "number" && Number.isFinite(lng)) {
    const date = new Date(metadata.capturedAt);
    gps[piexif.GPSIFD.GPSVersionID] = [2, 3, 0, 0];
    gps[piexif.GPSIFD.GPSLatitudeRef] = lat < 0 ? "S" : "N";
    gps[piexif.GPSIFD.GPSLatitude] = piexif.GPSHelper.degToDmsRational(Math.abs(lat));
    gps[piexif.GPSIFD.GPSLongitudeRef] = lng < 0 ? "W" : "E";
    gps[piexif.GPSIFD.GPSLongitude] = piexif.GPSHelper.degToDmsRational(Math.abs(lng));
    gps[piexif.GPSIFD.GPSDateStamp] = utcGpsDate(metadata.capturedAt);
    gps[piexif.GPSIFD.GPSTimeStamp] = [
      [date.getUTCHours(), 1],
      [date.getUTCMinutes(), 1],
      [date.getUTCSeconds() * 1000 + date.getUTCMilliseconds(), 1000],
    ];
  }

  const exifBytes = piexif.dump({ "0th": zeroth, Exif: exif, GPS: gps });
  const tagged = piexif.insert(exifBytes, bytesToBinary(bytes));
  file.write(binaryToBytes(tagged));
}
