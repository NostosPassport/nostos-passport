import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { farewellNotice } from "@/auth/auth-context";
import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useAnnounce } from "@/lib/a11y";
import { bookSize } from "@/features/book/dimensions";
import { Cover } from "@/features/book/Cover";
import { colors, radius, screenPadding, size, space } from "@/theme";

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const book = bookSize(width, height);
  // Shown once after deleting an account.
  const [farewell] = useState(() => farewellNotice.take());
  useAnnounce(farewell);

  return (
    <View style={styles.root}>
      {/* The closed passport, for show: it shimmers and follows a finger like the real one, but there is nothing to open yet. */}
      <View style={[styles.hero, { top: insets.top + space.xxxl + space.md }]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Cover width={book.width * 0.7} height={book.height * 0.7} counts={{ stamps: 0, places: 0, neighborhoods: 0 }} showCounts={false} />
      </View>
      <View style={[styles.top, { paddingTop: insets.top + space.xs }]}>
        <BrandMark />
      </View>
      <View style={[styles.panel, { paddingBottom: insets.bottom + space.sm }]}>
        {farewell && (
          <View style={styles.farewell}>
            <Icon name="checkmark.circle.fill" color="success" size={size.iconSmall} />
            <Text variant="subhead" weight="semibold">
              {farewell}
            </Text>
          </View>
        )}
        <Text variant="largeTitle" accessibilityRole="header">
          Go somewhere. Get a stamp.
        </Text>
        <Text variant="body" color="textSecondary">
          Your passport for New York: a photo, a few words or a song from every place you go. Only you can see it.
        </Text>
        <View style={styles.actions}>
          <Button title="Create account" onPress={() => router.push("/sign-up")} />
          <Button title="Sign in" variant="secondary" onPress={() => router.push("/sign-in")} />
          <Button title="Look around first" variant="plain" onPress={() => router.push("/age-gate")} accessibilityHint="Asks your birthdate, then shows you the map without an account" />
        </View>
        <Text variant="footnote" color="textTertiary">
          For adults 21 and over.
        </Text>
        {__DEV__ ? <Button title="Design gallery (development)" variant="plain" compact block={false} onPress={() => router.push("/design")} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  top: { paddingHorizontal: screenPadding },
  hero: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  panel: {
    marginTop: "auto",
    gap: space.sm,
    paddingTop: space.xl,
    paddingHorizontal: screenPadding,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  actions: { gap: space.xs, marginTop: space.sm },
  farewell: { flexDirection: "row", alignItems: "center", gap: space.xs },
});
