import type { NativeStackNavigationOptions } from "expo-router";

import { colors, type } from "@/theme";

/** Native iOS stack chrome on the dark palette. */
export const stackOptions: NativeStackNavigationOptions = {
  contentStyle: { backgroundColor: colors.background },
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.accent,
  headerTitleStyle: { color: colors.textPrimary, fontSize: type.headline.fontSize, fontWeight: type.headline.fontWeight },
  headerLargeTitleStyle: { color: colors.textPrimary },
  headerShadowVisible: false,
  headerBackButtonDisplayMode: "minimal",
};
