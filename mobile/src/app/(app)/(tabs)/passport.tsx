import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icon";
import { PassportBook } from "@/features/book/PassportBook";
import { colors, size, space } from "@/theme";

export default function Passport() {
  const insets = useSafeAreaInsets();
  const top = insets.top + space.xs;
  return (
    <View style={styles.root}>
      <PassportBook />
      <Pressable
        onPress={() => router.push("/collections")}
        accessibilityRole="button"
        accessibilityLabel="Collections"
        hitSlop={space.xs}
        style={[styles.collections, { top }]}
      >
        <Icon name="book" color="textPrimary" size={size.icon} />
      </Pressable>
      <Pressable
        onPress={() => router.push("/gallery")}
        accessibilityRole="button"
        accessibilityLabel="Stamp gallery"
        hitSlop={space.xs}
        style={[styles.gallery, { top }]}
      >
        <Icon name="square.grid.2x2" color="textPrimary" size={size.iconSmall} />
      </Pressable>
      <Pressable
        onPress={() => router.push("/settings")}
        accessibilityRole="button"
        accessibilityLabel="Settings"
        hitSlop={space.xs}
        style={[styles.gear, { top }]}
      >
        <Icon name="gearshape" color="textPrimary" size={size.icon} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  collections: { position: "absolute", left: space.md, minWidth: size.hitTarget, minHeight: size.hitTarget, alignItems: "center", justifyContent: "center" },
  gallery: { position: "absolute", left: space.md + size.hitTarget + space.xs, minWidth: size.hitTarget, minHeight: size.hitTarget, alignItems: "center", justifyContent: "center" },
  gear: { position: "absolute", right: space.md, minWidth: size.hitTarget, minHeight: size.hitTarget, alignItems: "center", justifyContent: "center" },
});
