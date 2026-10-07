import { distanceMeters } from "@/lib/geo";

import type { PickedImage } from "./pick";

const HOUR_MS = 60 * 60 * 1000;

export const PHOTO_VALIDATION = {
  baseScore: 50,
  acceptScore: 45,
  locationMissing: -10,
  locationMatch: 30,
  locationNear: 10,
  locationDistant: -20,
  locationMinimumMatchMeters: 250,
  locationNearMeters: 500,
  locationRejectMeters: 750,
  sourceCamera: 15,
  sourcePartialCamera: 5,
  sourceExternal: -10,
  sourceUnknown: -5,
  timestampMissing: -5,
  timestampMax: 20,
  timestampBeforeHours: 2,
  timestampAfterHours: 6,
} as const;

export type PhotoSourceEvidence = "camera-metadata" | "partial-camera-metadata" | "external-or-edited" | "unknown" | "screenshot";
export type PhotoRejection = "screenshot" | "location" | "timestamp" | "low-confidence" | null;

export type LibraryPhotoValidationContext = {
  place: { name: string; lat: number; lng: number; geofenceMeters: number };
  stampAt: number;
};

export type LibraryPhotoValidation = {
  viable: boolean;
  score: number;
  locationScore: number;
  sourceScore: number;
  timestampScore: number;
  source: PhotoSourceEvidence;
  distanceMeters: number | null;
  capturedAt: number | null;
  rejection: PhotoRejection;
  reason: string | null;
};

const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

function valueFor(exif: Record<string, unknown> | null, ...names: string[]): unknown {
  if (!exif) return undefined;
  const wanted = names.map(key);
  for (const [rawKey, value] of Object.entries(exif)) {
    const normalized = key(rawKey);
    if (wanted.some((name) => normalized === name || normalized.endsWith(name))) return value;
  }
  return undefined;
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function numericParts(value: unknown): number[] {
  if (typeof value === "number" && Number.isFinite(value)) return [value];
  if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
  if (typeof value !== "string") return [];
  return (value.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number).filter(Number.isFinite);
}

function coordinate(value: unknown, refValue: unknown, negativeRef: "S" | "W"): number | null {
  const parts = numericParts(value);
  if (parts.length === 0) return null;
  const absolute = Math.abs(parts[0]!) + (parts[1] ?? 0) / 60 + (parts[2] ?? 0) / 3600;
  const raw = typeof value === "number" ? value : parts[0]!;
  const ref = text(refValue).toUpperCase();
  const embeddedRef = typeof value === "string" ? value.toUpperCase() : "";
  const negative = raw < 0 || ref === negativeRef || embeddedRef.includes(negativeRef);
  return negative ? -absolute : absolute;
}

function photoLocation(exif: Record<string, unknown> | null): { lat: number; lng: number } | null {
  const lat = coordinate(valueFor(exif, "GPSLatitude", "Latitude"), valueFor(exif, "GPSLatitudeRef", "LatitudeRef"), "S");
  const lng = coordinate(valueFor(exif, "GPSLongitude", "Longitude"), valueFor(exif, "GPSLongitudeRef", "LongitudeRef"), "W");
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function parseExifDate(value: unknown, offsetValue: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value > 10_000_000_000 ? value : value * 1000;
    return Number.isFinite(milliseconds) ? milliseconds : null;
  }
  if (typeof value !== "string" || !value.trim()) return null;

  const raw = value.trim();
  const match = raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (match) {
    const [, year, month, day, hour, minute, second] = match;
    const offset = text(offsetValue);
    if (/^[+-]\d{2}:?\d{2}$/.test(offset)) {
      const normalizedOffset = offset.includes(":") ? offset : `${offset.slice(0, 3)}:${offset.slice(3)}`;
      const parsed = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}${normalizedOffset}`);
      return Number.isFinite(parsed) ? parsed : null;
    }
    const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }

  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function capturedAt(exif: Record<string, unknown> | null): number | null {
  const timestamp = valueFor(exif, "DateTimeOriginal", "DateTimeDigitized", "DateTime", "CreationDate", "CreateDate");
  const offset = valueFor(exif, "OffsetTimeOriginal", "OffsetTimeDigitized", "OffsetTime");
  return parseExifDate(timestamp, offset);
}

function isScreenshot(photo: PickedImage): boolean {
  if (/screenshot/i.test(photo.fileName ?? "")) return true;
  const comment = text(valueFor(photo.exif, "UserComment", "ImageDescription"));
  return /\bscreenshot\b/i.test(comment);
}

function sourceEvidence(photo: PickedImage): { source: PhotoSourceEvidence; score: number } {
  if (isScreenshot(photo)) return { source: "screenshot", score: 0 };

  const make = text(valueFor(photo.exif, "Make"));
  const model = text(valueFor(photo.exif, "Model"));
  const technical = ["LensModel", "ExposureTime", "FNumber", "ISOSpeedRatings", "PhotographicSensitivity", "FocalLength"]
    .some((name) => text(valueFor(photo.exif, name)) !== "");

  if (make && model && technical) return { source: "camera-metadata", score: PHOTO_VALIDATION.sourceCamera };
  if (make || model || technical) return { source: "partial-camera-metadata", score: PHOTO_VALIDATION.sourcePartialCamera };

  const software = text(valueFor(photo.exif, "Software", "CreatorTool", "ProcessingSoftware")).toLowerCase();
  const externalMarkers = ["photoshop", "lightroom", "instagram", "snapchat", "canva", "gimp", "affinity", "pixelmator", "vsco"];
  if (externalMarkers.some((marker) => software.includes(marker))) return { source: "external-or-edited", score: PHOTO_VALIDATION.sourceExternal };

  return { source: "unknown", score: PHOTO_VALIDATION.sourceUnknown };
}

function locationEvidence(photo: PickedImage, context: LibraryPhotoValidationContext): { score: number; distance: number | null; reject: boolean } {
  const location = photoLocation(photo.exif);
  if (!location) return { score: PHOTO_VALIDATION.locationMissing, distance: null, reject: false };

  const distance = distanceMeters(location, { lat: context.place.lat, lng: context.place.lng });
  const matchRadius = Math.max(context.place.geofenceMeters * 2, PHOTO_VALIDATION.locationMinimumMatchMeters);
  const nearRadius = Math.max(matchRadius, PHOTO_VALIDATION.locationNearMeters);
  const rejectRadius = Math.max(nearRadius, PHOTO_VALIDATION.locationRejectMeters);

  if (distance <= matchRadius) return { score: PHOTO_VALIDATION.locationMatch, distance, reject: false };
  if (distance <= nearRadius) return { score: PHOTO_VALIDATION.locationNear, distance, reject: false };
  if (distance <= rejectRadius) return { score: PHOTO_VALIDATION.locationDistant, distance, reject: false };
  return { score: PHOTO_VALIDATION.locationDistant, distance, reject: true };
}

function timestampEvidence(photo: PickedImage, context: LibraryPhotoValidationContext): { score: number; capturedAt: number | null; reject: boolean } {
  const takenAt = capturedAt(photo.exif);
  if (takenAt === null) return { score: PHOTO_VALIDATION.timestampMissing, capturedAt: null, reject: false };

  const delta = takenAt - context.stampAt;
  const before = PHOTO_VALIDATION.timestampBeforeHours * HOUR_MS;
  const after = PHOTO_VALIDATION.timestampAfterHours * HOUR_MS;
  if (delta < -before || delta > after) return { score: 0, capturedAt: takenAt, reject: true };

  const span = delta <= 0 ? before : after;
  const score = Math.round(PHOTO_VALIDATION.timestampMax * (1 - Math.abs(delta) / span));
  return { score: Math.max(0, score), capturedAt: takenAt, reject: false };
}

export function validateLibraryPhoto(photo: PickedImage, context: LibraryPhotoValidationContext): LibraryPhotoValidation {
  const source = sourceEvidence(photo);
  const location = locationEvidence(photo, context);
  const timestamp = timestampEvidence(photo, context);
  const score = Math.max(0, Math.min(100, PHOTO_VALIDATION.baseScore + location.score + source.score + timestamp.score));

  let rejection: PhotoRejection = null;
  let reason: string | null = null;
  if (source.source === "screenshot") {
    rejection = "screenshot";
    reason = "Screenshots can't be used for a stamp.";
  } else if (location.reject) {
    rejection = "location";
    reason = `This photo was taken too far from ${context.place.name}.`;
  } else if (timestamp.reject) {
    rejection = "timestamp";
    reason = "This photo was taken outside the allowed time for this stamp.";
  } else if (score < PHOTO_VALIDATION.acceptScore) {
    rejection = "low-confidence";
    reason = "We couldn't verify that this photo belongs with this stamp.";
  }

  return {
    viable: rejection === null,
    score,
    locationScore: location.score,
    sourceScore: source.score,
    timestampScore: timestamp.score,
    source: source.source,
    distanceMeters: location.distance,
    capturedAt: timestamp.capturedAt,
    rejection,
    reason,
  };
}
