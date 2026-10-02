import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { errorText } from "@/api";
import { useUserSearch } from "@/api/queries";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/inline-error";
import { ListGroup } from "@/components/ui/list-row";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { ToastHost } from "@/components/ui/toast";
import { PersonRow } from "@/features/people/person-row";
import { followButton, useFollow } from "@/features/people/use-follow";
import { colors, screenPadding, space } from "@/theme";

/** Find people by name or handle and follow them. Native search bar in the navigation bar. */
export default function People() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const search = useUserSearch(query);
  const follow = useFollow();

  // Search as you type, after a short pause.
  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim().replace(/^@/, "")), 250);
    return () => clearTimeout(t);
  }, [input]);

  const users = search.data?.users ?? [];

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: "Search by name or handle",
            autoCapitalize: "none",
            autoFocus: true,
            hideWhenScrolling: false,
            barTintColor: colors.surface,
            tintColor: colors.accent,
            textColor: colors.textPrimary,
            onChangeText: (e) => setInput(e.nativeEvent.text),
          },
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.content}>
        {query.length < 2 ? (
          <Text variant="callout" color="textSecondary">
            Type at least two letters.
          </Text>
        ) : search.isPending ? (
          <SkeletonRows count={3} />
        ) : search.isError ? (
          <InlineError message={errorText(search.error, "Couldn't search right now.")} onRetry={() => void search.refetch()} retrying={search.isFetching} />
        ) : users.length === 0 ? (
          <Text variant="callout" color="textSecondary">
            No one matches {"“"}
            {query}
            {"”"}.
          </Text>
        ) : (
          <ListGroup>
            {users.map((u) => {
              const b = followButton(u.follow, u.handle);
              const toggle = () => follow.toggle(u.handle, u.follow);
              return (
                <PersonRow
                  key={u.handle}
                  person={u}
                  subtitle={u.isSelf ? "You" : undefined}
                  actions={u.isSelf ? [] : [{ label: b.label, onPress: toggle }]}
                  trailing={
                    u.isSelf ? undefined : <Button
                      title={b.title}
                      variant={b.variant}
                      compact
                      block={false}
                      onPress={toggle}
                      accessibilityLabel={b.label}
                      accessibilityState={{ busy: follow.isPendingFor(u.handle) }}
                    />
                  }
                />
              );
            })}
          </ListGroup>
        )}
      </ScrollView>
      <ToastHost bottom={space.xxl} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: screenPadding, paddingTop: space.md, paddingBottom: space.xxxl, gap: space.lg },
});
