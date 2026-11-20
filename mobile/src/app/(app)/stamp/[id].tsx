import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActionSheetIOS, ActivityIndicator, Alert, ScrollView, StyleSheet, Text as NativeText, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ApiError, errorText, mediaUrl } from "@/api";
import type { StampView } from "@/api/contracts";
import { useStamp } from "@/api/queries";
import { Kicker } from "@/components/editorial/editorial";
import { Icon } from "@/components/ui/icon";
import { ScreenState } from "@/components/ui/screen-state";
import { Text } from "@/components/ui/text";
import { toast, ToastHost } from "@/components/ui/toast";
import { PhotoViewer } from "@/features/book/PhotoViewer";
import { StampMark } from "@/features/book/StampMark";
import { dropStamp } from "@/features/stamps/cache";
import { SongRow } from "@/features/stamps/song-row";
import { haptics } from "@/lib/haptics";
import { localityLabel } from "@/lib/place";
import { colors, dimmedOpacity, fonts, maxFontSizeMultiplier, radius, size, space, type } from "@/theme";
import { nav } from "@/lib/nav";
import { Tappable } from "@/components/ui/tappable";

const NOSTOS_MARK = require("../../../../assets/images/nostos-watermark.png");
/** Captions longer than this drop from the 44pt display serif to the title size so a paragraph stays readable. */
const LONG_CAPTION = 80;
/** The display title may shrink to this fraction of its size to fit a long place name in three lines. */
const TITLE_MIN_SCALE = 0.6;
type StampAction = { label: string; destructive?: boolean; onPress: () => void };

export default function StampDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const stamp = useStamp(id);
  const s = stamp.data?.stamp;
  const { actions, deleting } = useActions(s);
  const gone = stamp.error instanceof ApiError && (stamp.error.status === 404 || stamp.error.status === 403);
  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      {s ? (
        <Memory stamp={s} actions={actions} deleting={deleting} />
      ) : (
        // Loading, gone and failed all keep the back button: the edge swipe is not the only way out (P-110).
        <View style={[styles.stateScreen, { paddingTop: insets.top + space.xxs, paddingBottom: insets.bottom }]}>
          <TopBar />
          <View style={styles.centerState}>
            {gone ? (
              <ScreenState kind="empty" title="This memory isn't available" action={{ label: "Close", onPress: () => nav.back() }} />
            ) : stamp.isError ? (
              <ScreenState kind="error" message={errorText(stamp.error, "Couldn't load this memory.")} onRetry={() => void stamp.refetch()} retrying={stamp.isFetching} />
            ) : (
              <ScreenState kind="loading" label="Loading this memory" />
            )}
          </View>
        </View>
      )}
      <ToastHost />
    </View>
  );
}

function TopBar({ actions, disabled }: { actions?: StampAction[]; disabled?: boolean }) {
  return (
    <View style={styles.memoryTopbar}>
      <Tappable onPress={() => nav.back()} accessibilityRole="button" accessibilityLabel="Back" style={styles.hitTarget}>
        <Icon name="chevron.left" color="textPrimary" size={size.icon} />
      </Tappable>
      {actions?.length ? (
        <Tappable onPress={() => showActions(actions)} disabled={disabled} accessibilityRole="button" accessibilityLabel="More options" accessibilityState={{ disabled: !!disabled }} style={styles.hitTarget}>
          <Icon name="ellipsis" color={disabled ? "textTertiary" : "textPrimary"} size={size.icon} />
        </Tappable>
      ) : null}
    </View>
  );
}

function showActions(actions: StampAction[]) {
  const options = [...actions.map((a) => a.label), "Cancel"];
  const destructiveButtonIndex = actions.findIndex((a) => a.destructive);
  ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: options.length - 1, destructiveButtonIndex: destructiveButtonIndex >= 0 ? destructiveButtonIndex : undefined }, (index) => { if (index < actions.length) actions[index]?.onPress(); });
}

function Memory({ stamp, actions, deleting }: { stamp: StampView; actions: StampAction[]; deleting: boolean }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [activePhoto, setActivePhoto] = useState(0);
  const [viewingPhoto, setViewingPhoto] = useState<number | null>(null);
  const date = new Date(stamp.visitedAt);
  const dateLabel = date.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric", timeZone: stamp.place.timeZone }).toUpperCase();
  // Only number the memory when its passport page and slot are known; never show a made-up "NO. 001".
  const number = stamp.page !== null && stamp.slot !== null ? String((stamp.page - 1) * 3 + stamp.slot).padStart(3, "0") : null;
  const photoWidth = Math.max(1, width - 48);
  const photoCount = stamp.photos.length;
  const locality = localityLabel(stamp.place);
  const localityKey = stamp.place.area ?? stamp.place.city ?? stamp.place.countryCode ?? stamp.place.country ?? stamp.place.id;
  const stampSize = Math.min(300, Math.max(220, width - 72));
  return <>
    <View style={styles.memoryWrap} pointerEvents={deleting ? "none" : "auto"}>
      <ScrollView style={deleting && styles.dimmed} contentContainerStyle={[styles.memory, { paddingTop: insets.top + 4, paddingBottom: insets.bottom + 20 }]}>
        <TopBar actions={actions} disabled={deleting} />
        <Kicker>{number ? `NO. ${number} / ${dateLabel}` : dateLabel}</Kicker>
        <Tappable onPress={() => nav.push({ pathname: "/place/[id]", params: { id: stamp.place.id } })} accessibilityRole="link" accessibilityLabel={stamp.place.name} accessibilityHint="Shows every visit you stamped here">
          <NativeText style={styles.memoryTitle} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={TITLE_MIN_SCALE} maxFontSizeMultiplier={maxFontSizeMultiplier}>{stamp.place.name}</NativeText>
        </Tappable>
        {locality ? <Kicker>{locality.toUpperCase()}</Kicker> : null}
        <View style={styles.stampArt}><StampMark input={{ placeId: stamp.place.id, placeName: stamp.place.name, localityKey, localityName: locality }} size={stampSize} artwork={stamp.artwork} photoUrl={stamp.photos[0]?.url ?? stamp.photoUrl} visitedAt={stamp.visitedAt} timeZone={stamp.place.timeZone} /></View>
        <View style={styles.heroFrame}>{photoCount ? <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} bounces={photoCount > 1} onMomentumScrollEnd={(event) => setActivePhoto(Math.round(event.nativeEvent.contentOffset.x / photoWidth))}>{stamp.photos.map((photo, index) => <Tappable key={photo.id} onPress={() => setViewingPhoto(index)} accessibilityRole="imagebutton" accessibilityLabel={`Photo ${index + 1} of ${photoCount}`} accessibilityHint="Opens the photo full screen" style={[styles.photoPage, { width: photoWidth }]}><Image source={{ uri: mediaUrl(photo.url), cacheKey: photo.id }} style={StyleSheet.absoluteFill} contentFit="cover" /></Tappable>)}</ScrollView> : <View style={styles.emptyPhoto} />}</View>
        {/* User text is never truncated; a long caption steps down to the title size instead. */}
        {stamp.caption ? <NativeText style={[styles.caption, stamp.caption.length > LONG_CAPTION && styles.captionLong]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{stamp.caption}</NativeText> : null}{stamp.song ? <SongRow song={stamp.song} /> : null}
        <View style={styles.photoMeta}><Kicker>{photoCount === 0 ? "NO PHOTOS" : `${activePhoto + 1} OF ${photoCount} ${photoCount === 1 ? "PHOTO" : "PHOTOS"}`}</Kicker><View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{stamp.photos.slice(0, 6).map((photo, index) => <View key={photo.id} style={[styles.dot, index === activePhoto && styles.dotActive]} />)}</View></View>
        {/* Compact bottom metadata. Unverified is muted fine print, never an error. */}
        {stamp.verified ? <View style={styles.verified}><Image source={NOSTOS_MARK} style={styles.verifiedLogo} contentFit="contain" /><Text variant="typewriterSmall" color="accent">LOCATION VERIFIED BY NOSTOS</Text></View> : <Text variant="typewriterSmall" color="textTertiary" align="right" style={styles.unverified}>VISIT NOT LOCATION VERIFIED</Text>}
      </ScrollView>
    </View>
    {deleting ? (
      <View style={styles.busy} accessible accessibilityRole="progressbar" accessibilityLabel="Deleting this memory" accessibilityState={{ busy: true }}>
        <View style={styles.busyPill}><ActivityIndicator color={colors.accent} /><Text variant="subhead" weight="semibold">Deleting</Text></View>
      </View>
    ) : null}
    <PhotoViewer photos={stamp.photos} index={viewingPhoto} onClose={() => setViewingPhoto(null)} />
  </>;
}

function useActions(stamp: StampView | undefined): { actions: StampAction[]; deleting: boolean } {
  const queryClient = useQueryClient();
  const remove = useMutation({ mutationFn: (id: string) => api.stamps.remove(id), onSuccess: (_r, id) => { haptics.success(); dropStamp(queryClient, id); nav.back(); }, onError: (e) => { haptics.warning(); toast.show(errorText(e, "Couldn't delete that. Try again."), "neutral"); } });
  // Stays busy after success too, so the screen doesn't flash back to normal while it pops.
  const deleting = remove.isPending || remove.isSuccess;
  if (!stamp) return { actions: [], deleting };
  return {
    deleting,
    actions: [
      { label: "Edit memory", onPress: () => nav.push({ pathname: "/stamp/edit", params: { id: stamp.id } }) },
      { label: "Delete from passport", destructive: true, onPress: () => Alert.alert("Delete from your passport?", "This memory is removed for good.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => { if (!remove.isPending) remove.mutate(stamp.id); } }]) },
    ],
  };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  stateScreen: { flex: 1, paddingHorizontal: space.xl },
  centerState: { flex: 1, alignItems: "center", justifyContent: "center" },
  memoryWrap: { flex: 1 },
  dimmed: { opacity: dimmedOpacity },
  busy: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  busyPill: { flexDirection: "row", alignItems: "center", gap: space.xs, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: colors.paperRaised },
  memory: { paddingHorizontal: 24, gap: 10 },
  memoryTopbar: { height: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: -7 },
  hitTarget: { width: size.hitTarget, height: size.hitTarget, alignItems: "center", justifyContent: "center" },
  // Display serif: line height sits above the font size so ascenders and descenders never clip (P-086).
  memoryTitle: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 64, lineHeight: 70, letterSpacing: -1.6, paddingTop: 2 },
  stampArt: { minHeight: 230, alignItems: "center", justifyContent: "center", paddingVertical: 8 },
  heroFrame: { height: 301, marginTop: 4, overflow: "hidden", backgroundColor: colors.elevated, position: "relative" },
  photoPage: { height: 301, backgroundColor: colors.elevated },
  emptyPhoto: { flex: 1, backgroundColor: colors.elevated },
  caption: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 44, lineHeight: 50, letterSpacing: -1.1, marginVertical: 4, paddingTop: 2 },
  captionLong: { fontSize: type.title.fontSize, lineHeight: type.title.lineHeight, letterSpacing: 0 },
  photoMeta: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dots: { flexDirection: "row", gap: 10 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.textTertiary, opacity: 0.45 },
  dotActive: { backgroundColor: colors.accent, opacity: 1 },
  verified: { minHeight: 22, marginTop: 4, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 5 },
  verifiedLogo: { width: size.iconTiny, height: size.iconTiny, opacity: 0.72 },
  unverified: { minHeight: 22, marginTop: 4 },
});
