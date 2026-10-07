import { PHOTO_VALIDATION, validateLibraryPhoto } from "../validate-library";
import type { PickedImage } from "../pick";

const stampAt = 1_800_000_000_000;
const context = {
  place: { name: "Katz's", lat: 40.7222, lng: -73.9874, geofenceMeters: 100 },
  stampAt,
};

const photo = (over: Partial<PickedImage> = {}): PickedImage => ({
  uri: "file://photo.jpg",
  width: 3024,
  height: 4032,
  assetId: "asset-1",
  fileName: "IMG_1234.HEIC",
  mimeType: "image/heic",
  exif: {},
  ...over,
});

const cameraExif = (over: Record<string, unknown> = {}) => ({
  Make: "Apple",
  Model: "iPhone",
  LensModel: "iPhone back camera",
  DateTimeOriginal: stampAt,
  GPSLatitude: context.place.lat,
  GPSLongitude: context.place.lng,
  ...over,
});

describe("library photo validation", () => {
  it("accepts a camera photo whose location and time match the stamp", () => {
    const result = validateLibraryPhoto(photo({ exif: cameraExif() }), context);
    expect(result.viable).toBe(true);
    expect(result.rejection).toBeNull();
    expect(result.source).toBe("camera-metadata");
    expect(result.locationScore).toBe(PHOTO_VALIDATION.locationMatch);
    expect(result.timestampScore).toBe(PHOTO_VALIDATION.timestampMax);
    expect(result.score).toBe(100);
  });

  it("rejects a screenshot marked by iOS metadata", () => {
    const result = validateLibraryPhoto(photo({ exif: { UserComment: "Screenshot", DateTimeOriginal: stampAt } }), context);
    expect(result.viable).toBe(false);
    expect(result.rejection).toBe("screenshot");
    expect(result.reason).toBe("Screenshots can't be used for a stamp.");
  });

  it("rejects a screenshot identified by its filename", () => {
    const result = validateLibraryPhoto(photo({ fileName: "Screenshot 2026-10-06.png", mimeType: "image/png", exif: { DateTimeOriginal: stampAt } }), context);
    expect(result.viable).toBe(false);
    expect(result.rejection).toBe("screenshot");
  });

  it("does not reject a good camera photo just because GPS is missing", () => {
    const result = validateLibraryPhoto(photo({ exif: cameraExif({ GPSLatitude: undefined, GPSLongitude: undefined }) }), context);
    expect(result.viable).toBe(true);
    expect(result.distanceMeters).toBeNull();
    expect(result.locationScore).toBe(PHOTO_VALIDATION.locationMissing);
  });

  it("rejects a photo whose GPS is clearly far from the stamp", () => {
    const result = validateLibraryPhoto(photo({ exif: cameraExif({ GPSLatitude: 40.75, GPSLongitude: -73.99 }) }), context);
    expect(result.viable).toBe(false);
    expect(result.rejection).toBe("location");
  });

  it("rejects a photo more than two hours before the stamp", () => {
    const result = validateLibraryPhoto(photo({ exif: cameraExif({ DateTimeOriginal: stampAt - 2 * 60 * 60 * 1000 - 1 }) }), context);
    expect(result.viable).toBe(false);
    expect(result.rejection).toBe("timestamp");
  });

  it("rejects a photo more than six hours after the stamp", () => {
    const result = validateLibraryPhoto(photo({ exif: cameraExif({ DateTimeOriginal: stampAt + 6 * 60 * 60 * 1000 + 1 }) }), context);
    expect(result.viable).toBe(false);
    expect(result.rejection).toBe("timestamp");
  });

  it("decreases timestamp confidence toward either allowed boundary", () => {
    const oneHourBefore = validateLibraryPhoto(photo({ exif: cameraExif({ DateTimeOriginal: stampAt - 60 * 60 * 1000 }) }), context);
    const threeHoursAfter = validateLibraryPhoto(photo({ exif: cameraExif({ DateTimeOriginal: stampAt + 3 * 60 * 60 * 1000 }) }), context);
    expect(oneHourBefore.timestampScore).toBe(10);
    expect(threeHoursAfter.timestampScore).toBe(10);
    expect(oneHourBefore.viable).toBe(true);
    expect(threeHoursAfter.viable).toBe(true);
  });

  it("allows a recent externally processed image when the combined evidence is still strong enough", () => {
    const result = validateLibraryPhoto(photo({ exif: { Software: "Adobe Photoshop", DateTimeOriginal: stampAt } }), context);
    expect(result.source).toBe("external-or-edited");
    expect(result.score).toBe(50);
    expect(result.viable).toBe(true);
  });

  it("rejects a completely unverifiable image on low confidence rather than a single missing field", () => {
    const result = validateLibraryPhoto(photo({ exif: {} }), context);
    expect(result.score).toBe(30);
    expect(result.viable).toBe(false);
    expect(result.rejection).toBe("low-confidence");
  });
});
