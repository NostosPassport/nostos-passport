import { router, Stack } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { useCollections } from "@/api/queries";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { collectionColorValue } from "@/features/collections/colors";
import { colors, hairlineWidth, radius, size, space } from "@/theme";

export default function CollectionsScreen() {
  const query = useCollections();
  const collections = query.data?.collections ?? [];

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: "Collections", headerLargeTitle: true }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <Text variant="callout" color="textSecondary">Build smaller passports from stamps in your master Passport. A stamp can appear in as many collections as you want.</Text>
        {query.isPending ? <SkeletonRows count={3} /> : null}
        {query.isError ? <InlineError message="Couldn't load your collections." onRetry={() => void query.refetch()} /> : null}
        {!query.isPending && !query.isError && collections.length === 0 ? <View style={styles.empty}><Icon name="book" color="accent" size={size.iconLarge} /><Text variant="title2">No collections yet</Text><Text variant="callout" color="textSecondary" align="center">Create a passport for favorites, date nights, a trip, or anything else you want to keep together.</Text></View> : null}
        <View style={styles.list}>
          {collections.map((collection) => (
            <Pressable key={collection.id} onPress={() => router.push({ pathname: "/collections/[id]", params: { id: collection.id } })} accessibilityRole="button" accessibilityLabel={`Open ${collection.name}`} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <View style={[styles.book, { backgroundColor: collectionColorValue(collection.color) }]}><View style={styles.bookRule} /></View>
              <View style={styles.rowText}>
                <Text variant="title2" numberOfLines={1}>{collection.name}</Text>
                <Text variant="footnote" color="textSecondary">{collection.stampCount} {collection.stampCount === 1 ? "stamp" : "stamps"}</Text>
              </View>
              <Icon name="chevron.right" color="textTertiary" size={size.iconSmall} />
            </Pressable>
          ))}
        </View>
        <Button title="+ Create collection" onPress={() => router.push("/collections/new")} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, paddingBottom: space.xxxl, gap: space.lg },
  list: { gap: space.sm },
  row: { minHeight: size.listRow, flexDirection: "row", alignItems: "center", gap: space.md, borderBottomWidth: hairlineWidth, borderBottomColor: colors.hairline, paddingVertical: space.sm },
  book: { width: size.buttonHeight, height: size.avatarLarge, borderRadius: radius.chip, paddingLeft: space.xs, justifyContent: "center" },
  bookRule: { width: hairlineWidth, height: "80%", backgroundColor: colors.foilHighlight },
  rowText: { flex: 1, gap: space.xxs },
  pressed: { opacity: 0.72 },
  empty: { minHeight: size.heroHeight, alignItems: "center", justifyContent: "center", gap: space.sm, paddingHorizontal: space.xl },
});
