import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import type { AuthorView } from "@/api/contracts";
import { Badge } from "@/components/ui/badge";
import { Text, type TextProps } from "@/components/ui/text";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { space } from "@/theme";
import { authorLabel } from "./author";

/** Spoken author: "@sam, verified, Regular here", "Anonymous", "Deleted user". */
export function authorSpoken(a: AuthorView): string {
  if (a.kind !== "user") return authorLabel(a);
  return [authorLabel(a), a.verified ? "verified" : null, a.regular ? "Regular here" : null].filter(Boolean).join(", ");
}

/**
 * An author as the server resolved it for you: "@handle" with the verified badge and "Regular" (at this venue), or
 * "Anonymous" / "Deleted user" with no badge and no link. Only a handle opens a profile.
 */
export function AuthorLine({ author, variant = "subhead", onMedia, modal }: { author: AuthorView; variant?: TextProps["variant"]; onMedia?: boolean; modal?: boolean }) {
  const content = (
    <View style={styles.row}>
      <Text variant={variant} weight="semibold" color={author.kind === "user" || onMedia ? "textPrimary" : "textSecondary"} numberOfLines={1} style={styles.shrink}>
        {authorLabel(author)}
      </Text>
      {author.kind === "user" && author.verified && <VerifiedBadge accessible={false} />}
      {author.kind === "user" && author.regular && <Badge label="Regular" onMedia={onMedia} />}
    </View>
  );
  if (author.kind !== "user") {
    return (
      <View accessible accessibilityLabel={authorSpoken(author)}>
        {content}
      </View>
    );
  }
  const handle = author.handle;
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/user/[handle]", params: modal ? { handle, modal: "1" } : { handle } })}
      accessibilityRole="button"
      accessibilityLabel={authorSpoken(author)}
      accessibilityHint="Opens their profile"
      hitSlop={space.xs}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.xxs },
  shrink: { flexShrink: 1 },
});
