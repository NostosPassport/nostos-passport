import { StyleSheet } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Tappable } from "@/components/ui/tappable";
import { Text } from "@/components/ui/text";
import { colors, hairlineWidth, size, space } from "@/theme";

/**
 * "Add a song", drawn like the SongRow that replaces it once a song is chosen (hairline-ruled list row), so the
 * composer and Edit memory show one control in one place. It carries its own rules: don't put a Rule next to it.
 */
export function AddSongRow({ onPress }: { onPress: () => void }) {
  return (
    <Tappable onPress={onPress} accessibilityRole="button" accessibilityLabel="Add a song" style={styles.row}>
      <Icon name="music.note" color="accent" size={size.icon} />
      <Text variant="body" style={styles.label}>Add a song</Text>
      <Icon name="chevron.right" color="textTertiary" size={size.iconSmall} />
    </Tappable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: size.listRow, paddingVertical: space.sm, borderTopWidth: hairlineWidth, borderBottomWidth: hairlineWidth, borderColor: colors.hairline },
  label: { flex: 1 },
});
