import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { space } from "@/theme";
import { PageStock } from "./PageStock";

/** The inside of the front cover, facing the bearer page. */
export function InsideCover({ width, height }: { width: number; height: number }) {
  return (
    <PageStock width={width} height={height} spine="right">
      <View style={styles.center} accessible accessibilityLabel="Nostos. The longing to return home.">
        <Text variant="serifLabel" color="dimBrass" align="center">
          NOSTOS
        </Text>
        <Text variant="typewriterSmall" color="boneFaint" align="center">
          the longing to return home
        </Text>
      </View>
    </PageStock>
  );
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.xs, padding: space.lg } });
