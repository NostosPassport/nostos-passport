import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text as NativeText, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { errorText } from "@/api";
import type { Song, SongResult } from "@/api/contracts";
import { useSongSearch } from "@/api/queries";
import { Kicker } from "@/components/editorial/editorial";
import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { ListGroup, ListRow } from "@/components/ui/list-row";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { songDraft } from "@/features/stamps/song-draft";
import { colors, fonts, radius, screenPadding, size, space } from "@/theme";

/** Search songs (Apple's iTunes catalog, through Nostos) and pick one for the stamp. Metadata only: nothing plays. */
export default function SongPicker() {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const search = useSongSearch(query);

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
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cancel" style={styles.cancelTarget}>
          <Kicker>CANCEL</Kicker>
        </Pressable>
      </View>
      <NativeText style={styles.title}>Add a song</NativeText>
      <Text variant="callout" color="textSecondary" style={styles.subtitle}>Attach a song to this memory.</Text>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.searchField}>
          <Kicker>SONG OR ARTIST</Kicker>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Search songs or artists"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={styles.searchInput}
            accessibilityLabel="Song or artist"
          />
        </View>

        {query.length < 2 ? (
          <Text variant="footnote" color="textSecondary">Start typing to search Apple Music.</Text>
        ) : search.isPending ? (
          <SkeletonRows count={4} />
        ) : search.isError ? (
          <InlineError message={errorText(search.error, "Couldn't search for songs right now.")} onRetry={() => void search.refetch()} retrying={search.isFetching} />
        ) : songs.length === 0 ? (
          <Text variant="callout" color="textSecondary">Nothing found for “{query}”.</Text>
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
          <NativeText style={styles.noneText}>No song</NativeText>
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
  topbar: { height: 44, marginTop: 4, paddingHorizontal: screenPadding - 7, alignItems: "flex-end", justifyContent: "center" },
  cancelTarget: { minWidth: 64, height: 44, alignItems: "center", justifyContent: "center" },
  title: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 50, lineHeight: 52, letterSpacing: -0.7, paddingHorizontal: screenPadding, marginTop: 8 },
  subtitle: { paddingHorizontal: screenPadding, marginTop: 4, marginBottom: 18 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: screenPadding, gap: 12 },
  searchField: { gap: 7 },
  searchInput: { height: 44, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline, color: colors.textPrimary, fontSize: 14, paddingHorizontal: 10, paddingVertical: 0 },
  art: { width: size.avatarLarge - space.md, height: size.avatarLarge - space.md, borderRadius: radius.chip, backgroundColor: colors.elevated, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  none: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  noneText: { color: colors.textPrimary, fontSize: 14, fontWeight: "500" },
});
