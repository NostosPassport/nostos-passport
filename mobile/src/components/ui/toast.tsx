import { useEffect, useSyncExternalStore } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, hairlineWidth, radius, screenPadding, size, space, timing } from "@/theme";
import { Icon } from "./icon";
import { Text } from "./text";

type Toast = { id: number; message: string; tone: "success" | "neutral" };

let current: Toast | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Short confirmations ("Vibe posted. Thanks."). Errors are shown inline, never as toasts. */
export const toast = {
  show(message: string, tone: Toast["tone"] = "success") {
    current = { id: ++seq, message, tone };
    // Announced here, once, however many hosts are mounted.
    AccessibilityInfo.announceForAccessibility(message);
    emit();
  },
  hide(id: number) {
    if (current?.id !== id) return;
    current = null;
    emit();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => current,
};

export const TOAST_MS = 2600;

/**
 * Renders the current toast. Place one per native presentation (sheets sit above the root view).
 * `bottom` defaults to just above the home indicator (`insets.bottom + space.md`).
 */
export function ToastHost({ bottom }: { bottom?: number }) {
  const t = useSyncExternalStore(toast.subscribe, toast.get, toast.get);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!t) return;
    const timer = setTimeout(() => toast.hide(t.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [t]);
  // The wrapper stays mounted so the toast's own `exiting` animation can play when it goes away.
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: bottom ?? insets.bottom + space.md }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {t ? (
        <Animated.View key={t.id} entering={FadeInDown.duration(timing.standard)} exiting={FadeOutDown.duration(timing.fast)} style={styles.toast}>
          <Icon name={t.tone === "success" ? "checkmark.circle.fill" : "info.circle.fill"} color={t.tone === "success" ? "success" : "textSecondary"} size={size.iconSmall} />
          <Text variant="subhead" weight="semibold" numberOfLines={3} style={styles.message}>
            {t.message}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: screenPadding, right: screenPadding, alignItems: "center" },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    maxWidth: "100%",
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    minHeight: size.hitTarget - space.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.elevated,
    borderWidth: hairlineWidth,
    borderColor: colors.hairline,
  },
  message: { flexShrink: 1 },
});
