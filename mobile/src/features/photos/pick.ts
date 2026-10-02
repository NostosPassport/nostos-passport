import * as Device from "expo-device";
import * as ImagePicker from "expo-image-picker";
import { Alert, Linking } from "react-native";

export type PickedImage = { uri: string; width: number; height: number };
/** Why the camera didn't produce a photo. "cancelled" means the person backed out. */
export type CameraOutcome = PickedImage | "cancelled" | "denied" | "no-camera" | "failed";

const OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1, exif: false, allowsEditing: false };

function first(res: ImagePicker.ImagePickerResult): PickedImage | null {
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  return { uri: a.uri, width: a.width, height: a.height };
}

/**
 * Camera first. The system asks for camera access (with the purpose string) the first time. If access
 * was already refused before this tap, offer Settings; a fresh "Don't Allow" is respected silently.
 */
export async function takePhoto(): Promise<CameraOutcome> {
  if (!Device.isDevice) return "no-camera";
  const before = await ImagePicker.getCameraPermissionsAsync();
  const perm = before.granted ? before : await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    if (before.status === ImagePicker.PermissionStatus.DENIED && !before.canAskAgain) {
      Alert.alert("Camera is off for Nostos", "Turn on camera access in Settings to take photos at a venue.", [
        { text: "Not now", style: "cancel" },
        { text: "Open Settings", onPress: () => void Linking.openSettings() },
      ]);
    }
    return "denied";
  }
  try {
    return first(await ImagePicker.launchCameraAsync(OPTIONS)) ?? "cancelled";
  } catch {
    return "failed";
  }
}

/** The system photo picker (no library permission needed on iOS 14+). */
export async function pickFromLibrary(): Promise<PickedImage | null> {
  return first(await ImagePicker.launchImageLibraryAsync(OPTIONS));
}

/** What to tell someone when the camera didn't open. */
export const CAMERA_NOTE: Record<Exclude<CameraOutcome, PickedImage | "cancelled">, string> = {
  denied: "Camera access is off. Turn it on in Settings to post from here.",
  "no-camera": "Posting needs a camera. Photos are taken in the app, at the venue.",
  failed: "Couldn't open the camera. Try again.",
};
