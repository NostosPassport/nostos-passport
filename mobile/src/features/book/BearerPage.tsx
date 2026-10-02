import { StyleSheet, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { bookStyle, colors, space } from "@/theme";
import { type Bearer, bearerFields, machineZone } from "./bearer";
import { PageStock } from "./PageStock";

/** The first page: the holder's photo and details, and the machine-readable zone along the bottom. Yours alone to see. */
export function BearerPage({ width, height, bearer, avatarUrl }: { width: number; height: number; bearer: Bearer; avatarUrl: string | null }) {
  const fields = bearerFields(bearer);
  const zone = machineZone(bearer);
  const pad = Math.round(width * 0.09);
  const photo = Math.round(width * 0.3);
  return (
    <PageStock width={width} height={height}>
      <View style={[styles.body, { padding: pad }]} accessible accessibilityLabel={`Passport of ${bearer.displayName}, at ${bearer.handle}. ${fields.map((f) => `${f.label.toLowerCase()}: ${f.value}`).join(". ")}`}>
        <Text variant="serifLabel" color="brass" align="center">
          NOSTOS PASSPORT
        </Text>
        <View style={styles.row}>
          <View style={[styles.photo, { width: photo, height: Math.round(photo * 1.25) }]}>
            <Avatar name={bearer.displayName} uri={avatarUrl} size={photo - 6} variant="title" />
          </View>
          <View style={styles.fields}>
            {fields.map((f) => (
              <View key={f.label}>
                <Text variant="typewriterSmall" color="dimBrass">
                  {f.label}
                </Text>
                <Text variant="typewriter" color="textPrimary" numberOfLines={f.label === "REMARKS" ? 3 : 1}>
                  {f.value}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.zone} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {zone.map((line, i) => (
            <Text key={i} variant="typewriterSmall" color="boneFaint" numberOfLines={1} adjustsFontSizeToFit style={styles.mono}>
              {line}
            </Text>
          ))}
        </View>
      </View>
    </PageStock>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: "space-between" },
  row: { flexDirection: "row", gap: space.lg },
  photo: { borderWidth: bookStyle.pageRule, borderColor: colors.dimBrass, alignItems: "center", justifyContent: "center", backgroundColor: colors.elevated },
  fields: { flex: 1, gap: space.sm },
  zone: { gap: space.xxs },
  mono: { letterSpacing: 0 },
});
