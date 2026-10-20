import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";

import { DesignGuard } from "@/features/gallery/DesignGuard";
import { sampleStamp } from "@/features/gallery/sample";
import { PageView } from "@/features/book/PageView";
import { colors, screenPadding } from "@/theme";
import { resolveCategoryStamp } from "../../../../shared/category-stamp-artwork";
import { PASSPORT_PAGE_ASPECT } from "../../../../shared/passport-artwork";

/**
 * Development builds only: one passport page of category stamps, drawn by the real PageView at phone size.
 * `?mix=a|b|c` picks the three stamps. Photos come from the dev web server's fixture route.
 */
const HOST = process.env.EXPO_PUBLIC_STAMP_PHOTO_HOST ?? "http://localhost:3001";
const photo = (name: string) => [{ id: `p-${name}`, url: `${HOST}/dev/stamp-templates/photo/${name}`, position: 0, x: null, y: null, rotation: null }];
const ITALIAN = resolveCategoryStamp({ id: "it", category: "restaurant", primaryType: "italian_restaurant" });
const BAR = resolveCategoryStamp({ id: "br", category: "bar", primaryType: "cocktail_bar" });
const FRENCH = resolveCategoryStamp({ id: "fr", category: "restaurant", primaryType: "french_restaurant" });

const MIXES: Record<string, { name: string; art: typeof ITALIAN; photo: string; area?: string }[]> = {
  a: [{ name: "Osteria della Piazza", art: ITALIAN, photo: "restaurant" }, { name: "Midnight Social", art: BAR, photo: "bar", area: "West Village" }, { name: "Café de l'Étoile", art: FRENCH, photo: "airport" }],
  b: [{ name: "The Extraordinary Restaurant at Washington Square", art: FRENCH, photo: "portrait" }, { name: "An Exceptionally Long Cocktail Lounge", art: BAR, photo: "lowres" }, { name: "Joe's", art: ITALIAN, photo: "dark" }],
};

export default function Pages() {
  const { mix = "a" } = useLocalSearchParams<{ mix?: string }>();
  const { width: sw } = useWindowDimensions();
  const width = sw - screenPadding * 2;
  const height = Math.round(width * PASSPORT_PAGE_ASPECT);
  const stamps = (MIXES[String(mix)] ?? MIXES.a!).map((m, i) => {
    const base = sampleStamp(i, { photos: photo(m.photo), photoUrl: photo(m.photo)[0]!.url, artwork: m.art, slot: i + 1, page: 1 });
    return { ...base, place: { ...base.place, name: m.name, area: m.area ?? base.place.area, city: "New York" } };
  });
  return (
    <DesignGuard>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <View style={{ width, height }}>
          <PageView page={1} side="right" width={width} height={height} stamps={stamps} />
        </View>
      </ScrollView>
    </DesignGuard>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.black }, content: { alignItems: "center", paddingHorizontal: screenPadding } });
