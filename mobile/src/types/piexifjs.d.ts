declare module "piexifjs" {
  export type Rational = [number, number];

  export const ImageIFD: {
    ImageDescription: number;
    Software: number;
  };

  export const ExifIFD: {
    DateTimeOriginal: number;
    DateTimeDigitized: number;
  };

  export const GPSIFD: {
    GPSVersionID: number;
    GPSLatitudeRef: number;
    GPSLatitude: number;
    GPSLongitudeRef: number;
    GPSLongitude: number;
    GPSDateStamp: number;
    GPSTimeStamp: number;
  };

  export const GPSHelper: {
    degToDmsRational(value: number): Rational[];
  };

  export function dump(exif: Record<string, unknown>): string;
  export function insert(exifBytes: string, jpegData: string): string;
}
