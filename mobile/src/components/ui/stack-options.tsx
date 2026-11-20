import type { NativeStackNavigationOptions } from "expo-router";

import { colors, fonts, type } from "@/theme";
import { HeaderBackButton } from "./header-button";

/** Native iOS stack chrome on the editorial cream palette, with the editorial serif for titles. */
export const stackOptions: NativeStackNavigationOptions = {
  contentStyle: { backgroundColor: colors.background },
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.accent,
  headerTitleStyle: { color: colors.textPrimary, fontFamily: fonts.serif, fontSize: type.title2.fontSize },
  headerLargeTitleStyle: { color: colors.textPrimary, fontFamily: fonts.serif },
  headerShadowVisible: false,
  headerBackButtonDisplayMode: "minimal",
  // An editorial chevron instead of the iOS 26 glass back capsule (P-001). Swipe-back still works.
  unstable_headerLeftItems: ({ canGoBack }) => (canGoBack ? [{ type: "custom", element: <HeaderBackButton />, hidesSharedBackground: true }] : []),
};
