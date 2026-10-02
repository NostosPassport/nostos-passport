import { StyleSheet, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";

import { useOffline } from "@/lib/network";
import { colors, hairlineWidth, radius, screenPadding, size, space, timing } from "@/theme";
import { Icon } from "./icon";
import { Text } from "./text";

/**
 * "You're offline." pill. Each screen places it below its own chrome (top bar, header, grabber) with
 * `top`. The root layout announces the change once; banners stay silent.
 */
export function OfflineBanner({ top }: { top: number }) {
  const offline = useOffline();
  return (
    <View pointerEvents="none" style={[styles.wrap, { top }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {offline && (
        <Animated.View entering={FadeInUp.duration(timing.standard)} exiting={FadeOutUp.duration(timing.fast)} style={styles.banner}>
          <Icon name="wifi.slash" color="warning" size={size.iconTiny} />
          <Text variant="footnote" weight="semibold" style={styles.text}>
            You&apos;re offline. Some things may be out of date.
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: screenPadding, right: screenPadding, alignItems: "center", zIndex: 10 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    minHeight: size.hitTarget - space.sm,
    borderRadius: radius.largeCard,
    backgroundColor: colors.elevated,
    borderWidth: hairlineWidth,
    borderColor: colors.hairline,
  },
  text: { flexShrink: 1 },
});
