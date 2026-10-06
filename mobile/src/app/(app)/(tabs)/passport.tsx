import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icon";
import { PassportBook } from "@/features/book/PassportBook";
import { colors, size, space } from "@/theme";

export default function Passport() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <PassportBook />
      <Pressable
        onPress={() => router.push("/settings")}
        accessibilityRole="button"
        accessibilityLabel="Settings"
        hitSlop={space.xs}
        style={[styles.gear, { top: insets.top + space.xs }]}
      >
        <Icon name="gearshape" color="textPrimary" size={size.icon} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  gear: { position: "absolute", right: space.md, minWidth: size.hitTarget, minHeight: size.hitTarget, alignItems: "center", justifyContent: "center" },
});
