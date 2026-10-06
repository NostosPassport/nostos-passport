import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { colors, fonts, space } from "@/theme";

export function FormHeader({ title, line }: { title: string; line?: string }) {
  return (
    <View style={styles.head}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {line ? (
        <Text variant="callout" color="textSecondary">
          {line}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: "stretch", gap: space.xs, paddingTop: space.md, paddingBottom: space.sm },
  title: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 48, lineHeight: 50, letterSpacing: -1.1 },
});
