import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";

import { createQueryClient } from "@/api/query-client";
import { Text } from "@/components/ui/text";
import { DesignGuard } from "@/features/gallery/DesignGuard";
import { GALLERY_SECTIONS } from "@/features/gallery/sections";
import { colors, screenPadding, space } from "@/theme";

/** One section of the Design gallery. */
export default function DesignSection() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const found = GALLERY_SECTIONS.find((s) => s.id === section);
  // Some pieces (the visa spread) use the data layer; give them a private client that never talks to anything.
  const [client] = useState(createQueryClient);
  return (
    <DesignGuard>
      <Stack.Screen options={{ title: found?.title ?? "Design gallery" }} />
      <ScrollView style={styles.root} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        {found ? (
          <QueryClientProvider client={client}>
            <Text variant="callout" color="textSecondary">
              {found.note}
            </Text>
            <found.Component />
          </QueryClientProvider>
        ) : (
          <Text variant="callout" color="textSecondary">
            There is no section called {section}.
          </Text>
        )}
      </ScrollView>
    </DesignGuard>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: screenPadding, gap: space.lg, paddingBottom: space.xxxl },
});
