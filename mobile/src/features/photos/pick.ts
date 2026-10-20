import * as Device from "expo-device";
import * as ImagePicker from "expo-image-picker";
import { Alert, Linking } from "react-native";

export type PickedImage = {
  uri: string;
  width: number;
  height: number;
  assetId: string | null;
  fileName: string | null;
  mimeType: string | null;
  exif: Record<string, unknown> | null;
};

export type CameraOutcome = PickedImage | "cancelled" | "denied" | "no-camera" | "failed";

const CAMERA_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  quality: 1,
  exif: false,
  allowsEditing: false,
};

const LIBRARY_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  quality: 1,
  exif: true,
  allowsEditing: false,
  shouldDownloadFromNetwork: true,
  preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
};

function image(asset: ImagePicker.ImagePickerAsset): PickedImage {
  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    assetId: asset.assetId ?? null,
    fileName: asset.fileName ?? null,
    mimeType: asset.mimeType ?? null,
    exif: (asset.exif as Record<string, unknown> | null | undefined) ?? null,
  };
}

function all(res: ImagePicker.ImagePickerResult): PickedImage[] {
  if (res.canceled || !res.assets) return [];
  return res.assets.map(image);
}

function first(res: ImagePicker.ImagePickerResult): PickedImage | null {
  return all(res)[0] ?? null;
}

export async function takePhoto(): Promise<CameraOutcome> {
  if (!Device.isDevice) return "no-camera";
  const before = await ImagePicker.getCameraPermissionsAsync();
  const perm = before.granted ? before : await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    if (before.status === ImagePicker.PermissionStatus.DENIED && !before.canAskAgain) {
      Alert.alert("Camera is off for Nostos", "Turn on camera access in Settings to take a photo for your stamp.", [
        { text: "Not now", style: "cancel" },
        { text: "Open Settings", onPress: () => void Linking.openSettings() },
      ]);
    }
    return "denied";
  }
  try {
    return first(await ImagePicker.launchCameraAsync(CAMERA_OPTIONS)) ?? "cancelled";
  } catch {
    return "failed";
  }
}

export async function pickFromLibrary(): Promise<PickedImage | null> {
  try {
    return first(await ImagePicker.launchImageLibraryAsync(LIBRARY_OPTIONS));
  } catch {
    return null;
  }
}

export async function pickManyFromLibrary(selectionLimit = 0): Promise<PickedImage[]> {
  try {
    return all(await ImagePicker.launchImageLibraryAsync({
      ...LIBRARY_OPTIONS,
      allowsMultipleSelection: true,
      selectionLimit,
    }));
  } catch {
    return [];
  }
}

export const CAMERA_NOTE: Record<Exclude<CameraOutcome, PickedImage | "cancelled">, string> = {
  denied: "Camera access is off. Turn it on in Settings to take a photo for your stamp.",
  "no-camera": "This device doesn't have a camera available.",
  failed: "Couldn't open the camera. Try again.",
};
