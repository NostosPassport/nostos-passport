import type { PropsWithChildren, ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text as RNText, View, type TextProps, type TextStyle, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icon";
import { Tappable } from "@/components/ui/tappable";
import { colors, fonts, maxFontSizeMultiplier, pressedOpacity } from "@/theme";

/** Editorial text with the app-wide Dynamic Type cap, so big type grows but never past what the layout holds. */
function Text(props: TextProps) {
  return <RNText maxFontSizeMultiplier={maxFontSizeMultiplier} {...props} />;
}

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

export function DisplayTitle({ children, size = 58, style, ...rest }: PropsWithChildren<{ size?: number; style?: TextStyle } & Omit<TextProps, "style">>) {
  return <Text accessibilityRole="header" {...rest} style={[styles.display, { fontSize: size, lineHeight: size * 1.02 }, style]}>{children}</Text>;
}

export function Kicker({ children, muted = false, style, ...rest }: PropsWithChildren<{ muted?: boolean; style?: TextStyle } & Omit<TextProps, "style">>) {
  return <Text {...rest} style={[styles.kicker, muted && styles.muted, style]}>{children}</Text>;
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
    <Tappable onPress={onPress} accessibilityRole="button" accessibilityLabel="Settings" style={styles.iconTarget}>
      <Icon name="gearshape" color="textPrimary" size={22} />
    </Tappable>
  );
}

/** `loading` keeps the button at full strength with a spinner, so a slow save reads as working, not disabled. */
export function EditorialButton({ label, onPress, disabled = false, loading = false, outline = false, style }: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean; outline?: boolean; style?: ViewStyle }) {
  const inactive = disabled || loading;
  return (
    <Tappable onPress={onPress} disabled={inactive} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: inactive, busy: loading }} style={({ pressed }) => [styles.button, outline && styles.buttonOutline, style, disabled && !loading && styles.disabled, pressed && !inactive && styles.pressed]}>
      <View style={styles.buttonRow}>
        {loading ? <ActivityIndicator color={outline ? colors.accent : colors.onAccent} /> : null}
        <Text style={[styles.buttonText, outline && styles.buttonOutlineText]}>{label}</Text>
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1, paddingHorizontal: 24 },
  header: { height: 82, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  wordmark: { color: colors.accent, fontFamily: fonts.serifRegular, fontSize: 66, lineHeight: 68, letterSpacing: -2.5 },
  wordmarkCompact: { fontSize: 46, lineHeight: 48 },
  display: { color: colors.textPrimary, fontFamily: fonts.serifRegular, letterSpacing: -1.6, paddingTop: 2 },
  kicker: { color: colors.textPrimary, fontFamily: fonts.monoBold, fontSize: 11, lineHeight: 14, letterSpacing: 1.35, textTransform: "uppercase" },
  body: { color: colors.textPrimary, fontFamily: fonts.sans, lineHeight: 18 },
  muted: { color: colors.textSecondary },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, width: "100%" },
  iconTarget: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  button: { minHeight: 48, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent, borderRadius: 1 },
  buttonRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  buttonOutline: { backgroundColor: colors.transparent, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.accent },
  buttonText: { color: colors.onAccent, fontFamily: fonts.sans, fontSize: 14, fontWeight: "500" },
  buttonOutlineText: { color: colors.accent },
  disabled: { opacity: 0.42 },
  pressed: { opacity: pressedOpacity },
});
