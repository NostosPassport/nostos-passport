import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useAnnounce } from "@/lib/a11y";
import { colors, maxFontSizeMultiplier, space } from "@/theme";
import { Button } from "./button";
import { Icon, type SymbolName } from "./icon";
import { Text } from "./text";

type Action = { label: string; onPress: () => void };

type Props =
  | { kind: "loading"; label?: string }
  | { kind: "empty"; title: string; message?: string; icon?: SymbolName; action?: Action }
  | { kind: "error"; message: string; onRetry?: () => void; retrying?: boolean };

/**
 * The one way a screen (or a large region of one) says "loading", "nothing here yet" or "couldn't load" (RC-7).
 * Centered, editorial, never an alert. Use InlineError for an error inside a form, and SkeletonRows when a list's
 * shape is known while it loads.
 */
export function ScreenState(props: Props) {
  useAnnounce(props.kind === "error" ? props.message : null);
  if (props.kind === "loading") {
    return (
      <View style={styles.wrap} accessible accessibilityRole="progressbar" accessibilityLabel={props.label ?? "Loading"}>
        <ActivityIndicator color={colors.accent} />
        {props.label ? <Text variant="footnote" color="textSecondary" align="center">{props.label}</Text> : null}
      </View>
    );
  }
  if (props.kind === "error") {
    return (
      <View style={styles.wrap} accessibilityRole="alert">
        <Icon name="exclamationmark.circle" color="textSecondary" />
        <Text variant="callout" color="textSecondary" align="center">{props.message}</Text>
        {props.onRetry ? <Button title="Try again" variant="secondary" compact block={false} loading={props.retrying} onPress={props.onRetry} /> : null}
      </View>
    );
  }
  return (
    <View style={styles.wrap}>
      {props.icon ? <Icon name={props.icon} color="accent" /> : null}
      <Text variant="title2" align="center" accessibilityRole="header" maxFontSizeMultiplier={maxFontSizeMultiplier}>{props.title}</Text>
      {props.message ? <Text variant="callout" color="textSecondary" align="center">{props.message}</Text> : null}
      {props.action ? <Button title={props.action.label} block={false} onPress={props.action.onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.xl },
});
