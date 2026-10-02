import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccountGate } from "@/features/account/account-gate";
import { PassportBook } from "@/features/book/PassportBook";
import { Icon } from "@/components/ui/icon";
import { colors, size, space } from "@/theme";

/** Your passport: a closed book on black. The gear at the top right opens settings. */
export default function Passport() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <AccountGate title="Your passport" message="Sign in to collect stamps and see your passport.">
        <PassportBook />
        <Pressable
          onPress={() => router.push("/settings")}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          hitSlop={space.xs}
          style={[styles.gear, { top: insets.top + space.xs }]}
        >
          <Icon name="gearshape" color="dimBrass" size={size.icon} />
        </Pressable>
      </AccountGate>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  gear: { position: "absolute", right: space.md, minWidth: size.hitTarget, minHeight: size.hitTarget, alignItems: "center", justifyContent: "center" },
});
