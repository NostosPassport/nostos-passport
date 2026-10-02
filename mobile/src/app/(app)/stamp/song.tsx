import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { errorText } from "@/api";
import type { Song, SongResult } from "@/api/contracts";
import { useSongSearch } from "@/api/queries";
import { HeaderButton } from "@/components/ui/header-button";
import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { ListGroup, ListRow } from "@/components/ui/list-row";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { songDraft } from "@/features/stamps/song-draft";
import { colors, radius, screenPadding, size, space } from "@/theme";

/** Search songs (Apple's iTunes catalog, through Nostos) and pick one for the stamp. Metadata only: nothing plays. */
export default function SongPicker() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const search = useSongSearch(query);

  // Search as you type, after a short pause.
  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), 350);
    return () => clearTimeout(t);
  }, [input]);

  const choose = (r: SongResult) => {
    const song: Song = { title: r.title, artist: r.artist, artUrl: r.artUrl, sourceId: r.sourceId };
    songDraft.choose(song);
    router.back();
  };
  const songs = search.data?.songs ?? [];

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: "Add a song",
          headerLeft: () => <HeaderButton label="Cancel" onPress={() => router.back()} />,
          headerSearchBarOptions: {
            placeholder: "Song or artist",
            autoCapitalize: "none",
            autoFocus: true,
            hideWhenScrolling: false,
            barTintColor: colors.surface,
            tintColor: colors.accent,
            textColor: colors.textPrimary,
            onChangeText: (e) => setInput(e.nativeEvent.text),
          },
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.content}>
        {query.length < 2 ? (
          <Text variant="callout" color="textSecondary">
            Type a song or an artist.
          </Text>
        ) : search.isPending ? (
          <SkeletonRows count={4} />
        ) : search.isError ? (
          <InlineError message={errorText(search.error, "Couldn't search for songs right now.")} onRetry={() => void search.refetch()} retrying={search.isFetching} />
        ) : songs.length === 0 ? (
          <Text variant="callout" color="textSecondary">
            Nothing found for {"“"}
            {query}
            {"”"}.
          </Text>
        ) : (
          <ListGroup footer="Song info from Apple Music. Nostos doesn't play music.">
            {songs.map((s) => (
              <ListRow
                key={s.sourceId}
                leading={<Art url={s.artUrl} />}
                title={s.title}
                subtitle={[s.artist, s.album].filter(Boolean).join(" · ")}
                accessibilityLabel={`${s.title} by ${s.artist}`}
                accessibilityHint="Adds this song to your stamp"
                onPress={() => choose(s)}
              />
            ))}
          </ListGroup>
        )}
        <Pressable
          onPress={() => {
            songDraft.choose(null);
            router.back();
          }}
          accessibilityRole="button"
          accessibilityLabel="No song"
          style={styles.none}
        >
          <Text variant="callout" color="accent">
            No song
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Art({ url }: { url: string | null }) {
  return url ? (
    <Image source={{ uri: url, cacheKey: url }} style={styles.art} contentFit="cover" transition={150} accessible={false} />
  ) : (
    <View style={styles.art}>
      <Icon name="music.note" color="textSecondary" size={size.icon} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: screenPadding, paddingTop: space.md, paddingBottom: space.xxxl, gap: space.lg },
  art: { width: size.avatarLarge - space.md, height: size.avatarLarge - space.md, borderRadius: radius.chip, backgroundColor: colors.elevated, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  none: { minHeight: size.hitTarget, justifyContent: "center" },
});
