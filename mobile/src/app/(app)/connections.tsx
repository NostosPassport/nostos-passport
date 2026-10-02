import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { ApiError, errorText } from "@/api";
import { useMe, usePeopleList } from "@/api/queries";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { ListGroup } from "@/components/ui/list-row";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { ToastHost } from "@/components/ui/toast";
import { PersonRow } from "@/features/people/person-row";
import { followButton, useFollow } from "@/features/people/use-follow";
import { useRemoveFollower } from "@/features/people/use-requests";
import { colors, screenPadding, size, space } from "@/theme";

/** Followers or Following of a profile. On your own followers: Remove. Elsewhere: Follow / Requested / Following. */
export default function Connections() {
  const { handle, list: listParam } = useLocalSearchParams<{ handle: string; list: string }>();
  const list = listParam === "following" ? "following" : "followers";
  const people = usePeopleList(handle, list);
  const me = useMe();
  const follow = useFollow();
  const remove = useRemoveFollower();
  const [refreshing, setRefreshing] = useState(false);
  const ownFollowers = list === "followers" && me.data?.user.handle === handle;
  const rows = people.data?.people ?? [];
  const isPrivate = people.error instanceof ApiError && people.error.code === "private_account";

  const refresh = async () => {
    setRefreshing(true);
    await people.refetch().finally(() => setRefreshing(false));
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: list === "followers" ? "Followers" : "Following" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.textSecondary} />}
      >
        {people.isPending ? (
          <SkeletonRows count={5} />
        ) : isPrivate ? (
          <View style={styles.private}>
            <Icon name="lock.fill" color="textSecondary" size={size.icon} />
            <Text variant="headline">This account is private</Text>
            <Text variant="callout" color="textSecondary">
              Follow @{handle} to see who they follow and who follows them.
            </Text>
          </View>
        ) : people.isError ? (
          <InlineError message={errorText(people.error, "Couldn't load this list.")} onRetry={() => void people.refetch()} retrying={people.isFetching} />
        ) : rows.length === 0 ? (
          <Text variant="callout" color="textSecondary">
            {list === "followers" ? "No followers yet." : "Not following anyone yet."}
          </Text>
        ) : (
          <ListGroup>
            {rows.map((p) => {
              if (p.isSelf) return <PersonRow key={p.handle} person={p} subtitle="You" />;
              if (ownFollowers) {
                const label = `Remove @${p.handle} as a follower`;
                return (
                  <PersonRow
                    key={p.handle}
                    person={p}
                    actions={[{ label, onPress: () => remove.confirm(p.handle) }]}
                    trailing={<Button title="Remove" variant="secondary" compact block={false} onPress={() => remove.confirm(p.handle)} accessibilityLabel={label} />}
                  />
                );
              }
              const b = followButton(p.follow, p.handle);
              const toggle = () => follow.toggle(p.handle, p.follow);
              return (
                <PersonRow
                  key={p.handle}
                  person={p}
                  actions={[{ label: b.label, onPress: toggle }]}
                  trailing={
                    <Button
                      title={b.title}
                      variant={b.variant}
                      compact
                      block={false}
                      onPress={toggle}
                      accessibilityLabel={b.label}
                      accessibilityState={{ busy: follow.isPendingFor(p.handle) }}
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
  private: { gap: space.xs, alignItems: "flex-start" },
});
