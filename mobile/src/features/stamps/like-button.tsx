import { Pressable, StyleSheet } from "react-native";

import type { LikeSummary } from "@/api/contracts";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { plural } from "@/lib/format";
import { size, space } from "@/theme";

/** Spoken like state: "Like, 4 likes" / "Unlike, 5 likes, you liked this". */
export function likeLabel(likes: LikeSummary): string {
  return `${likes.viewerLiked ? "Unlike" : "Like"}, ${plural(likes.count, "like")}${likes.viewerLiked ? ", you liked this" : ""}`;
}

/** Heart and count. `disabled` for your own stamps: you see the count but can't like them. */
export function LikeButton({ likes, onPress, disabled }: { likes: LikeSummary; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={disabled ? plural(likes.count, "like") : likeLabel(likes)}
      accessibilityState={{ selected: likes.viewerLiked, disabled: !!disabled }}
      hitSlop={space.xs}
      style={styles.button}
    >
      <Icon name={likes.viewerLiked ? "heart.fill" : "heart"} color={likes.viewerLiked ? "accent" : "textSecondary"} size={size.icon} />
      <Text variant="subhead" weight="semibold" tabular color="textSecondary">
        {likes.count}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: "row", alignItems: "center", gap: space.xxs, minHeight: size.hitTarget, minWidth: size.hitTarget },
});
