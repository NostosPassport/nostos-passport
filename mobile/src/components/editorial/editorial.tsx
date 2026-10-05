import type { PropsWithChildren, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icon";
import { colors, fonts } from "@/theme";

export function EditorialScreen({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function EditorialSafeContent({ children, bottom = false }: PropsWithChildren<{ bottom?: boolean }>) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.safe, { paddingTop: insets.top + 4, paddingBottom: bottom ? insets.bottom : 0 }]}>{children}</View>;
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return <Text style={[styles.wordmark, compact && styles.wordmarkCompact]}>NOSTOS</Text>;
}

export function DisplayTitle({ children, size = 58, style }: PropsWithChildren<{ size?: number; style?: TextStyle }>) {
  return <Text style={[styles.display, { fontSize: size, lineHeight: size * 0.9 }, style]}>{children}</Text>;
}

export function Kicker({ children, muted = false }: PropsWithChildren<{ muted?: boolean }>) {
  return <Text style={[styles.kicker, muted && styles.muted]}>{children}</Text>;
}

export function Body({ children, muted = false, size = 14 }: PropsWithChildren<{ muted?: boolean; size?: number }>) {
  return <Text style={[styles.body, { fontSize: size }, muted && styles.muted]}>{children}</Text>;
}

export function Rule() {
  return <View style={styles.rule} />;
}

export function EditorialHeader({ compact = false, action }: { compact?: boolean; action?: ReactNode }) {
  return (
    <View style={styles.header}>
      <Wordmark compact={compact} />
      {action}
    </View>
  );
}

export function GearButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Settings" style={styles.iconTarget}>
      <Icon name="gearshape" color="textPrimary" size={22} />
    </Pressable>
  );
}

export function EditorialButton({ label, onPress, disabled = false, outline = false }: { label: string; onPress: () => void; disabled?: boolean; outline?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }} style={({ pressed }) => [styles.button, outline && styles.buttonOutline, disabled && styles.disabled, pressed && !disabled && styles.pressed]}>
      <Text style={[styles.buttonText, outline && styles.buttonOutlineText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1, paddingHorizontal: 24 },
  header: { height: 82, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  wordmark: { color: colors.accent, fontFamily: fonts.serifRegular, fontSize: 66, lineHeight: 68, letterSpacing: -2.5 },
  wordmarkCompact: { fontSize: 46, lineHeight: 48 },
  display: { color: colors.textPrimary, fontFamily: fonts.serifRegular, letterSpacing: -1.6 },
  kicker: { color: colors.textPrimary, fontFamily: fonts.monoBold, fontSize: 11, lineHeight: 14, letterSpacing: 1.35, textTransform: "uppercase" },
  body: { color: colors.textPrimary, fontFamily: fonts.sans, lineHeight: 18 },
  muted: { color: colors.textSecondary },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, width: "100%" },
  iconTarget: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  button: { height: 48, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent, borderRadius: 1 },
  buttonOutline: { backgroundColor: colors.transparent, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.accent },
  buttonText: { color: colors.onAccent, fontFamily: fonts.sans, fontSize: 14, fontWeight: "500" },
  buttonOutlineText: { color: colors.accent },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.78 },
});
