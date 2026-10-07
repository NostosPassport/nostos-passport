import { Asset } from "expo-media-library";

/** Saves the final accepted camera file. Call only after Apple's camera UI returns from Use Photo. */
export async function saveAcceptedCameraPhoto(uri: string): Promise<boolean> {
  try {
    await Asset.create(uri);
    return true;
  } catch {
    return false;
  }
}
