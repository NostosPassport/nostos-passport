import { Stack } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { errorText } from "@/api";
import { useFollowRequests } from "@/api/queries";
import { Button } from "@/components/ui/button";
import { HeaderButton } from "@/components/ui/header-button";
import { InlineError } from "@/components/ui/inline-error";
import { ListGroup } from "@/components/ui/list-row";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { ToastHost } from "@/components/ui/toast";
import { PersonRow } from "@/features/people/person-row";
import { confirmApproveAll, useApproveAll, useDecideRequest } from "@/features/people/use-requests";
import { formatAge } from "@/lib/format";
import { colors, screenPadding, space } from "@/theme";

/** People asking to follow your private account: Approve or Decline each, or approve them all. */
export default function FollowRequests() {
  const requests = useFollowRequests();
  const decide = useDecideRequest();
  const approveAll = useApproveAll();
  const [refreshing, setRefreshing] = useState(false);
  const rows = requests.data?.requests ?? [];

  const refresh = async () => {
    setRefreshing(true);
    await requests.refetch().finally(() => setRefreshing(false));
  };

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          headerRight:
            rows.length > 1
              ? () => <HeaderButton label="Approve all" disabled={approveAll.isPending} onPress={() => confirmApproveAll(rows.length, () => approveAll.mutate())} />
              : undefined,
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.textSecondary} />}
      >
        {requests.isPending ? (
          <SkeletonRows count={4} />
        ) : requests.isError ? (
          <InlineError message={errorText(requests.error, "Couldn't load requests.")} onRetry={() => void requests.refetch()} retrying={requests.isFetching} />
        ) : rows.length === 0 ? (
          <Text variant="callout" color="textSecondary">
            No requests right now.
          </Text>
        ) : (
          <ListGroup footer="Approved people see your stamps and places.">
            {rows.map(({ person, requestedAt }) => {
              const approve = () => decide.mutate({ handle: person.handle, approve: true });
              const decline = () => decide.mutate({ handle: person.handle, approve: false });
              return (
                <PersonRow
                  key={person.handle}
                  person={person}
                  subtitle={formatAge(requestedAt)}
                  actions={[
                    { label: `Approve @${person.handle}`, onPress: approve },
                    { label: `Decline @${person.handle}`, onPress: decline },
                  ]}
                  trailing={
                    <View style={styles.buttons}>
                      <Button title="Approve" compact block={false} onPress={approve} accessibilityLabel={`Approve @${person.handle}`} />
                      <Button title="Decline" variant="secondary" compact block={false} onPress={decline} accessibilityLabel={`Decline @${person.handle}`} />
                    </View>
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
  buttons: { flexDirection: "row", gap: space.xs },
});
