import { StyleSheet, View } from "react-native";

import { useAnnounce } from "@/lib/a11y";
import { colors, radius, space } from "@/theme";
import { Button } from "./button";
import { Icon } from "./icon";
import { Text } from "./text";

type Props = { message: string; onRetry?: () => void; retrying?: boolean };

/** An error shown in place, with an optional retry. Never a generic alert. */
export function InlineError({ message, onRetry, retrying }: Props) {
  useAnnounce(message);
  return (
    <View style={styles.wrap} accessibilityRole="alert">
      <View style={styles.row}>
        <Icon name="exclamationmark.circle.fill" color="danger" />
        <Text variant="subhead" style={styles.text}>
          {message}
        </Text>
      </View>
      {onRetry && <Button title="Try again" variant="plain" compact block={false} onPress={onRetry} loading={retrying} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs, padding: space.md, borderRadius: radius.card, backgroundColor: colors.surface },
  row: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  text: { flex: 1 },
});
