import { Asset, getPermissionsAsync, requestPermissionsAsync } from "expo-media-library";

export type SaveCameraPhotoResult = "saved" | "permission-denied" | "failed";

/** Saves the final accepted camera file. Call only after Apple's camera UI returns from Use Photo. */
export async function saveAcceptedCameraPhoto(uri: string): Promise<SaveCameraPhotoResult> {
  try {
    let permission = await getPermissionsAsync(true);
    if (!permission.granted && permission.canAskAgain) permission = await requestPermissionsAsync(true);
    if (!permission.granted) return "permission-denied";

    await Asset.create(uri);
    return "saved";
  } catch {
    return "failed";
  }
}
