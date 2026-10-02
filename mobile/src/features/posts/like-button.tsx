import type { ReactNode } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import type { LikeSummary } from "@/api/contracts";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { plural } from "@/lib/format";
import { size, space } from "@/theme";

/** Spoken like state: "Like, 4 likes" / "Unlike, 5 likes, you liked this". */
export function likeLabel(likes: LikeSummary): string {
  return `${likes.viewerLiked ? "Unlike" : "Like"}, ${plural(likes.count, "like")}${likes.viewerLiked ? ", you liked this" : ""}`;
}

/** Heart and count. `disabled` for your own posts: you see the count but can't like them. */
export function LikeButton({ likes, onPress, disabled, onMedia }: { likes: LikeSummary; onPress: () => void; disabled?: boolean; onMedia?: boolean }) {
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
      <Icon name={likes.viewerLiked ? "heart.fill" : "heart"} color={likes.viewerLiked ? "accent" : onMedia ? "textPrimary" : "textSecondary"} size={size.icon} />
      <Text variant="subhead" weight="semibold" tabular color={onMedia ? "textPrimary" : "textSecondary"}>
        {likes.count}
      </Text>
    </Pressable>
  );
}

/**
 * Double-tap anywhere on the photo to like it (never unlikes). With `onSingleTap`, a single tap waits until it can't be
 * the start of a double-tap, so one gesture never does both.
 */
export function DoubleTapToLike({ enabled, onDoubleTap, onSingleTap, children }: { enabled: boolean; onDoubleTap: () => void; onSingleTap?: () => void; children: ReactNode }) {
  const double = Gesture.Tap().numberOfTaps(2).enabled(enabled).runOnJS(true).onEnd((_e, success) => {
    if (success) onDoubleTap();
  });
  const single = Gesture.Tap().enabled(!!onSingleTap).runOnJS(true).onEnd((_e, success) => {
    if (success) onSingleTap?.();
  });
  return <GestureDetector gesture={Gesture.Exclusive(double, single)}>{children}</GestureDetector>;
}

const styles = StyleSheet.create({
  button: { flexDirection: "row", alignItems: "center", gap: space.xxs, minHeight: size.hitTarget, minWidth: size.hitTarget },
});
