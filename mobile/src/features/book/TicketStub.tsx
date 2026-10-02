import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import type { Song } from "@/api/contracts";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { songLabel } from "@/features/stamps/song-row";
import { bookStyle, colors, radius, size, space } from "@/theme";

/** A song, as the stub torn off a ticket: art, title and artist, a perforated edge and a notch on each side. Metadata only. */
export function TicketStub({ song }: { song: Pick<Song, "title" | "artist" | "artUrl"> }) {
  return (
    <View style={styles.stub} accessible accessibilityLabel={songLabel(song)}>
      <View style={styles.notchLeft} />
      <View style={styles.notchRight} />
      <View style={styles.art}>
        {song.artUrl ? <Image source={{ uri: song.artUrl, cacheKey: song.artUrl }} style={styles.fill} contentFit="cover" accessible={false} /> : <Icon name="music.note" color="dimBrass" size={size.icon} />}
      </View>
      <View style={styles.perf} />
      <View style={styles.text}>
        <Text variant="typewriterSmall" color="dimBrass">
          SOUNDTRACK
        </Text>
        <Text variant="typewriter" color="textPrimary" numberOfLines={1}>
          {song.title}
        </Text>
        <Text variant="typewriterSmall" color="textSecondary" numberOfLines={1}>
          {song.artist}
        </Text>
      </View>
    </View>
  );
}

const NOTCH = space.sm;
const styles = StyleSheet.create({
  stub: { flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.sm, borderRadius: radius.chip, backgroundColor: colors.surface, borderWidth: bookStyle.pageRule, borderColor: colors.dimBrass, overflow: "hidden" },
  notchLeft: { position: "absolute", left: -NOTCH / 2, top: "50%", marginTop: -NOTCH / 2, width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2, backgroundColor: colors.background },
  notchRight: { position: "absolute", right: -NOTCH / 2, top: "50%", marginTop: -NOTCH / 2, width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2, backgroundColor: colors.background },
  art: { width: size.listRow - space.md, height: size.listRow - space.md, borderRadius: radius.chip / 2, backgroundColor: colors.elevated, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  fill: { width: "100%", height: "100%" },
  perf: { alignSelf: "stretch", borderLeftWidth: bookStyle.pageRule, borderStyle: "dashed", borderColor: colors.dimBrass },
  text: { flex: 1, gap: space.xxs },
});
