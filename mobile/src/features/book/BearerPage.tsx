import { StyleSheet, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { bookStyle, colors } from "@/theme";
import { type Bearer, bearerFields, machineZone } from "./bearer";
import { PageStock } from "./PageStock";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function BearerPage({ width, height, bearer, avatarUrl }: { width: number; height: number; bearer: Bearer; avatarUrl: string | null }) {
  const fields = bearerFields(bearer);
  const zone = machineZone(bearer);
  const pad = Math.round(width * 0.075);
  const photo = Math.round(width * 0.28);
  const rowGap = clamp(Math.round(width * 0.035), 5, 10);
  const fieldGap = clamp(Math.round(width * 0.025), 3, 7);
  const titleSize = clamp(width * 0.052, 9, 13);
  const labelSize = clamp(width * 0.031, 6, 8);
  const valueSize = clamp(width * 0.044, 8, 11);
  const zoneSize = clamp(width * 0.027, 5.5, 7.5);

  return (
    <PageStock width={width} height={height} spine="left">
      <View style={[styles.body, { padding: pad }]} accessible accessibilityLabel={`Passport of ${bearer.displayName}, at ${bearer.handle}. ${fields.map((f) => `${f.label.toLowerCase()}: ${f.value}`).join(". ")}`}>
        <Text variant="serifLabel" color="bookAccent" align="center" maxFontSizeMultiplier={1.15} style={{ fontSize: titleSize, lineHeight: titleSize * 1.18 }}>
          NOSTOS PASSPORT
        </Text>
        <View style={[styles.row, { gap: rowGap }]}>
          <View style={[styles.photo, { width: photo, height: Math.round(photo * 1.25) }]}>
            <Avatar name={bearer.displayName} uri={avatarUrl} size={photo - 6} variant="title" />
          </View>
          <View style={[styles.fields, { gap: fieldGap }]}>
            {fields.map((f) => (
              <View key={f.label}>
                <Text variant="typewriterSmall" color="dimBrass" maxFontSizeMultiplier={1.15} style={{ fontSize: labelSize, lineHeight: labelSize * 1.3 }}>
                  {f.label}
                </Text>
                <Text
                  variant="typewriter"
                  color="textPrimary"
                  numberOfLines={f.label === "REMARKS" ? 3 : 1}
                  adjustsFontSizeToFit={f.label !== "REMARKS"}
                  minimumFontScale={0.65}
                  maxFontSizeMultiplier={1.15}
                  style={{ fontSize: valueSize, lineHeight: valueSize * 1.35 }}
                >
                  {f.value}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <View style={[styles.zone, { gap: Math.max(1, fieldGap / 2) }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {zone.map((line, i) => (
            <Text
              key={i}
              variant="typewriterSmall"
              color="boneFaint"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              maxFontSizeMultiplier={1.1}
              style={[styles.mono, { fontSize: zoneSize, lineHeight: zoneSize * 1.3 }]}
            >
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
  row: { flexDirection: "row" },
  photo: { borderWidth: bookStyle.pageRule, borderColor: colors.dimBrass, alignItems: "center", justifyContent: "center", backgroundColor: colors.elevated },
  fields: { flex: 1 },
  zone: {},
  mono: { letterSpacing: 0 },
});
