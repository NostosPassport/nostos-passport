import { FlatList, Pressable, StyleSheet, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { colors, screenPadding, size, space } from "@/theme";
import type { IndexRow } from "./index-data";
import { ProgressRing } from "./ProgressRing";

type Props = { rows: IndexRow[]; onJump: (page: number) => void; onClose: () => void };

/** The index: every neighborhood with a progress ring. Tap one you've started to turn to its first page. */
export function IndexList({ rows, onJump, onClose }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text variant="title2" color="brass" accessibilityRole="header">
          Index
        </Text>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close the index" hitSlop={space.sm} style={styles.close}>
          <Icon name="xmark" color="accent" size={size.icon} />
        </Pressable>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text variant="callout" color="textSecondary" align="center" style={styles.empty}>
            No neighborhoods yet. Stamp a place and its neighborhood appears here.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            disabled={item.page === null}
            onPress={() => item.page !== null && onJump(item.page)}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityHint={item.page === null ? undefined : "Turns to its first page"}
            accessibilityState={{ disabled: item.page === null }}
            style={[styles.row, item.page === null && styles.unstarted]}
          >
            <ProgressRing visited={item.visited} total={item.total} size={size.avatarLarge - space.md} stroke={space.xxs} complete={item.complete} />
            <View style={styles.names}>
              <Text variant="headline" numberOfLines={1}>
                {item.name}
              </Text>
              <Text variant="typewriterSmall" color="textSecondary">
                {item.borough}
              </Text>
            </View>
            <View style={styles.right}>
              <Text variant="typewriter" color={item.complete ? "brass" : "textPrimary"} tabular>
                {item.visited}/{item.total}
              </Text>
              {item.complete ? (
                <Text variant="typewriterSmall" color="brass">
                  COMPLETE
                </Text>
              ) : item.page !== null ? (
                <Text variant="typewriterSmall" color="dimBrass">
                  p. {item.page}
                </Text>
              ) : null}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignSelf: "stretch", backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: screenPadding, paddingTop: space.md },
  close: { minWidth: size.hitTarget, minHeight: size.hitTarget, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: screenPadding, paddingBottom: space.xxxl, gap: space.xs },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: size.listRow, paddingVertical: space.xs },
  unstarted: { opacity: 0.55 },
  names: { flex: 1, gap: space.xxs },
  right: { alignItems: "flex-end", gap: space.xxs },
  empty: { marginTop: space.xxl },
});
