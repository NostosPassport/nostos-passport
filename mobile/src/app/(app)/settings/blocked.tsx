import { ScrollView, StyleSheet, View } from "react-native";

import { errorText } from "@/api";
import { useBlocks } from "@/api/queries";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/inline-error";
import { ListGroup, ListRow } from "@/components/ui/list-row";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { ToastHost } from "@/components/ui/toast";
import { useBlock } from "@/features/moderation/content-actions";
import { colors, screenPadding, space } from "@/theme";

export default function Blocked() {
  const blocks = useBlocks();
  const block = useBlock();
  const list = blocks.data?.blocks ?? [];

  return (
    <View style={styles.root}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        {blocks.isPending ? (
          <SkeletonRows count={3} />
        ) : blocks.isError ? (
          <InlineError message={errorText(blocks.error, "Couldn't load blocked users.")} onRetry={() => void blocks.refetch()} retrying={blocks.isFetching} />
        ) : list.length === 0 ? (
          <Text variant="callout" color="textSecondary">
            You haven&apos;t blocked anyone.
          </Text>
        ) : (
          <ListGroup footer="Blocked people can't see your stamps or profile, and you can't see theirs.">
            {list.map((b) => (
              <ListRow
                key={b.handle}
                leading={<Avatar name={b.handle} />}
                title={`@${b.handle}`}
                trailing={
                  <Button
                    title="Unblock"
                    variant="secondary"
                    compact
                    block={false}
                    loading={block.isPending && block.variables?.handle === b.handle}
                    onPress={() => block.mutate({ handle: b.handle, block: false })}
                    accessibilityLabel={`Unblock @${b.handle}`}
                  />
                }
              />
            ))}
          </ListGroup>
        )}
      </ScrollView>
      <ToastHost bottom={space.xxl} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: screenPadding, paddingTop: space.md, paddingBottom: space.xxxl, gap: space.md },
});
