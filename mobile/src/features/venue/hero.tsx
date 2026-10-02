import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import { mediaUrl } from "@/api";
import type { VibeState } from "@/api/contracts";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { formatDistance, initial } from "@/lib/format";
import { colors, radius, size, space, vibeTints } from "@/theme";

type Props = {
  name: string;
  neighborhood: string;
  address: string;
  vibe: VibeState;
  photoUrl: string | null;
  distanceM: number | null;
  /** The page hasn't loaded: don't guess between photo and fallback. */
  loading?: boolean;
};

/** Official photo labelled "From the venue", or a vibe-tinted surface with the initial. */
export function VenueHero({ name, neighborhood, address, vibe, photoUrl, distanceM, loading }: Props) {
  const place = [address || null, neighborhood, distanceM !== null ? `${formatDistance(distanceM)} away` : null].filter(Boolean).join(" · ");
  return (
    <View style={styles.wrap}>
      {loading ? (
        <Skeleton height={size.heroHeight} />
      ) : photoUrl ? (
        <View style={styles.media}>
          <Image
            // Signed URLs rotate every few minutes; cache by the path so the photo doesn't reload and fade in again.
            source={{ uri: mediaUrl(photoUrl), cacheKey: photoUrl.split("?")[0] }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            accessibilityLabel={`Photo of ${name}, from the venue`}
          />
          <View style={styles.badge}>
            <Badge label="From the venue" onMedia />
          </View>
        </View>
      ) : (
        <View style={[styles.media, styles.fallback, { backgroundColor: vibeTints[vibe] }]} accessible={false}>
          <Text variant="largeTitle" color="textSecondary" maxFontSizeMultiplier={1}>
            {initial(name)}
          </Text>
        </View>
      )}
      <View style={styles.text}>
        <Text variant="title" accessibilityRole="header">
          {name}
        </Text>
        <Text variant="subhead" color="textSecondary" tabular>
          {place}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  media: { height: size.heroHeight, borderRadius: radius.largeCard, overflow: "hidden", backgroundColor: colors.elevated },
  fallback: { alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", left: space.sm, bottom: space.sm },
  text: { gap: space.xxs },
});
