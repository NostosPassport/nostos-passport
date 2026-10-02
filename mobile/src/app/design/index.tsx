import { router, Stack } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";

import { ListGroup, ListRow } from "@/components/ui/list-row";
import { Text } from "@/components/ui/text";
import { DesignGuard } from "@/features/gallery/DesignGuard";
import { GALLERY_SECTIONS } from "@/features/gallery/sections";
import { colors, screenPadding, space } from "@/theme";

/** Development only: every visual piece of Nostos, on made-up data, with no account and no server. */
export default function DesignGallery() {
  return (
    <DesignGuard>
      <Stack.Screen options={{ title: "Design gallery" }} />
      <ScrollView style={styles.root} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <Text variant="callout" color="textSecondary">
          Everything here is made-up data. Nothing is saved or sent. Development builds only.
        </Text>
        <ListGroup>
          {GALLERY_SECTIONS.map((s) => (
            <ListRow key={s.id} title={s.title} subtitle={s.note} chevron onPress={() => router.push({ pathname: "/design/[section]", params: { section: s.id } })} />
          ))}
        </ListGroup>
      </ScrollView>
    </DesignGuard>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: screenPadding, gap: space.lg, paddingBottom: space.xxxl },
});
