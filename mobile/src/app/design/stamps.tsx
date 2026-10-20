import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";

import { Text } from "@/components/ui/text";
import { CategoryStampMark } from "@/features/book/CategoryStampMark";
import { DesignGuard } from "@/features/gallery/DesignGuard";
import { colors, space } from "@/theme";
import { stampSheetCases } from "../../../../shared/category-stamp-sheets";
import { STAMP_DETAIL_SHARE } from "../../../../shared/passport-artwork";

/** Development builds only: the sample stamp sheets from the web preview, drawn by the native renderer. `?set=reference|long|photos&scale=1`. */
const PHOTO_HOST = process.env.EXPO_PUBLIC_STAMP_PHOTO_HOST ?? "http://localhost:3001";

export default function StampSheet() {
  const { set = "reference", scale = "1" } = useLocalSearchParams<{ set?: string; scale?: string }>();
  const { width } = useWindowDimensions();
  const k = Number(scale) || 1;
  return (
    <DesignGuard>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        {stampSheetCases(String(set)).map((c, i) => (
          <View key={i} style={styles.cell}>
            <CategoryStampMark
              design={c.design}
              visitedAt={c.visitedAt}
              size={width * STAMP_DETAIL_SHARE[c.design.template] * k}
              seed={c.seed}
              photoUri={__DEV__ && c.photo ? `${PHOTO_HOST}/dev/stamp-templates/photo/${c.photo}` : null}
            />
            {c.caption ? <Text variant="footnote" color="textTertiary">{c.caption}</Text> : null}
          </View>
        ))}
      </ScrollView>
    </DesignGuard>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  content: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", paddingVertical: space.xxxl, paddingHorizontal: space.xs, gap: space.sm },
  cell: { alignItems: "center", gap: space.xxs },
});
