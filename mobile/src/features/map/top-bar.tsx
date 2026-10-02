import { BlurView } from "expo-blur";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { colors, hairlineWidth, pressedOpacity, radius, screenPadding, size, space } from "@/theme";

type Props = { name: string | null | undefined; avatarUrl?: string | null; guest: boolean; onSearch: () => void; onProfile: () => void };

/** Floating search pill and profile button on blurred surfaces. */
export function TopBar({ name, avatarUrl, guest, onSearch, onProfile }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { top: insets.top + space.xs }]} pointerEvents="box-none">
      <Pressable
        onPress={onSearch}
        accessibilityRole="button"
        accessibilityLabel="Search bars"
        accessibilityHint="Opens the list with a search field"
        style={({ pressed }) => [styles.pillWrap, pressed && styles.pressed]}
      >
        <BlurView intensity={60} tint="dark" style={styles.pill}>
          <Icon name="magnifyingglass" color="textSecondary" size={size.iconSmall} />
          <Text variant="body" color="textSecondary" numberOfLines={1}>
            Search bars
          </Text>
        </BlurView>
      </Pressable>
      <Pressable
        onPress={onProfile}
        accessibilityRole="button"
        accessibilityLabel={guest ? "Sign in" : "Profile and settings"}
        style={({ pressed }) => [styles.avatarWrap, pressed && styles.pressed]}
      >
        <BlurView intensity={60} tint="dark" style={styles.avatar}>
          {guest || !name ? <Icon name="person.fill" color="textSecondary" size={size.icon} /> : <Avatar name={name} uri={avatarUrl} size={size.avatar} />}
        </BlurView>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: "absolute", left: screenPadding, right: screenPadding, flexDirection: "row", gap: space.sm, alignItems: "center" },
  pillWrap: { flex: 1, borderRadius: radius.pill, overflow: "hidden" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: size.topBarHeight,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: hairlineWidth,
    borderColor: colors.hairline,
  },
  avatarWrap: { borderRadius: radius.pill, overflow: "hidden" },
  pressed: { opacity: pressedOpacity, transform: [{ scale: 0.97 }] },
  avatar: {
    width: size.topBarHeight,
    height: size.topBarHeight,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: hairlineWidth,
    borderColor: colors.hairline,
  },
});
