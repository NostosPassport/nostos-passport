import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import type { Song } from "@/api/contracts";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { colors, radius, size, space } from "@/theme";

/** The spoken form: "Song: Heroes by David Bowie". */
export function songLabel(song: Pick<Song, "title" | "artist">): string {
  return `Song: ${song.title} by ${song.artist}`;
}

/** A song's art, title and artist. Metadata only: there is no playback. */
export function SongRow({ song, trailing }: { song: Pick<Song, "title" | "artist" | "artUrl">; trailing?: React.ReactNode }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={songLabel(song)}>
      {song.artUrl ? (
        <Image source={{ uri: song.artUrl, cacheKey: song.artUrl }} style={styles.art} contentFit="cover" transition={150} accessible={false} />
      ) : (
        <View style={styles.art} accessible={false}>
          <Icon name="music.note" color="textSecondary" size={size.icon} />
        </View>
      )}
      <View style={styles.text}>
        <Text variant="subhead" weight="semibold" numberOfLines={1}>
          {song.title}
        </Text>
        <Text variant="footnote" color="textSecondary" numberOfLines={1}>
          {song.artist}
        </Text>
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.xs, borderRadius: radius.card, backgroundColor: colors.surface },
  art: { width: size.listRow - space.md, height: size.listRow - space.md, borderRadius: radius.chip, backgroundColor: colors.elevated, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  text: { flex: 1, gap: space.xxs },
});
