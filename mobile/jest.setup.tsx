/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});

jest.mock("expo-media-library", () => ({
  Asset: { create: jest.fn(async (uri: string) => ({ id: uri })) },
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true, status: "granted", expires: "never", accessPrivileges: "all" })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true, status: "granted", expires: "never", accessPrivileges: "all" })),
}));

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 393, height: 852 };
  return {
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    SafeAreaView: ({ children, ...props }: { children?: React.ReactNode }) => React.createElement(View, props, children),
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { insets, frame },
  };
});

jest.mock("expo-symbols", () => {
  const { View } = require("react-native");
  return { SymbolView: (props: object) => <View {...props} /> };
});

jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => ({ ...require("react-native-reanimated/mock"), useSharedValue: (value: unknown) => require("react").useState(() => ({ value }))[0], useReducedMotion: () => false }));

// Skia draws on a GPU canvas that doesn't exist in Jest. Components render as plain Views (Canvas) or nothing, so the book's
// structure, labels and logic can be tested; how it looks is a device check (DEVICE-CHECKLIST.md).
jest.mock("@shopify/react-native-skia", () => {
  const { View } = require("react-native");
  const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  const target: Record<string, unknown> = {
    Canvas: ({ children, ...rest }: { children?: React.ReactNode }) => <View {...rest}>{children}</View>,
    vec: (x: number, y: number) => ({ x, y }),
    useFont: () => null,
    useImage: () => null,
    Skia: { Path: { Make: () => ({ moveTo() {}, lineTo() {}, close() {}, addCircle() {} }), MakeFromSVGString: () => ({}) }, RuntimeEffect: { Make: () => null }, Color: (c: string) => c },
  };
  return new Proxy(target, { get: (t, k) => (k === "__esModule" ? true : k in t ? t[k as string] : passthrough) });
});
jest.mock("expo-sensors", () => ({ DeviceMotion: { isAvailableAsync: async () => false, addListener: () => ({ remove() {} }), setUpdateInterval() {} } }));
jest.mock("expo-camera", () => ({ CameraView: () => null, useCameraPermissions: () => [{ granted: true }, jest.fn()] }));
