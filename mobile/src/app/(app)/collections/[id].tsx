import { router, Stack, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icon";
import { PassportBook } from "@/features/book/PassportBook";
import { colors, size, space } from "@/theme";

export default function CollectionPassportScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = typeof rawId === "string" ? rawId : "";
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <PassportBook collectionId={id} />
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back to collections"
        hitSlop={space.xs}
        style={[styles.back, { top: insets.top + space.xs }]}
      >
        <Icon name="chevron.left" color="textPrimary" size={size.icon} />
      </Pressable>
      <Pressable
        onPress={() => router.push({ pathname: "/collections/[id]/share", params: { id } })}
        accessibilityRole="button"
        accessibilityLabel="Share collection"
        hitSlop={space.xs}
        style={[styles.share, { top: insets.top + space.xs }]}
      >
        <Icon name="square.and.arrow.up" color="textPrimary" size={size.icon} />
      </Pressable>
      <Pressable
        onPress={() => router.push({ pathname: "/collections/[id]/edit", params: { id } })}
        accessibilityRole="button"
        accessibilityLabel="Edit collection"
        hitSlop={space.xs}
        style={[styles.edit, { top: insets.top + space.xs }]}
      >
        <Icon name="gearshape" color="textPrimary" size={size.icon} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  back: { position: "absolute", left: space.md, minWidth: size.hitTarget, minHeight: size.hitTarget, alignItems: "center", justifyContent: "center" },
  share: { position: "absolute", right: space.md + size.hitTarget + space.xs, minWidth: size.hitTarget, minHeight: size.hitTarget, alignItems: "center", justifyContent: "center" },
  edit: { position: "absolute", right: space.md, minWidth: size.hitTarget, minHeight: size.hitTarget, alignItems: "center", justifyContent: "center" },
});
