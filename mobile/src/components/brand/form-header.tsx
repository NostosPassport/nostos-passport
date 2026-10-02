import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { size, space } from "@/theme";
import { EmblemMark } from "./emblem-mark";

/** The head of a sign-in or sign-up form: the emblem, a serif title, and one quiet line. */
export function FormHeader({ title, line }: { title: string; line?: string }) {
  return (
    <View style={styles.head}>
      <EmblemMark size={size.avatarLarge} />
      <Text variant="title" color="brass" align="center" accessibilityRole="header">
        {title}
      </Text>
      {line ? (
        <Text variant="callout" color="textSecondary" align="center">
          {line}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ head: { alignItems: "center", gap: space.xs, paddingVertical: space.md } });
