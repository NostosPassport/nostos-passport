import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ApiError, errorText } from "@/api";
import type { MapVenue, PhotoView, VenuePageResponse, VenuesResponse } from "@/api/contracts";
import { qk, useMe, useVenue } from "@/api/queries";
import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { ToastHost } from "@/components/ui/toast";
import { useLocationState } from "@/features/location/location-store";
import { CommentsSection } from "@/features/comments/comments-section";
import { CAMERA_NOTE, takePhoto } from "@/features/photos/pick";
import { PhotosSection } from "@/features/photos/photos-section";
import { uploadStore, useUploads } from "@/features/photos/upload-store";
import { useLivePhotos } from "@/features/photos/use-live-photos";
import { useCooldownNotice } from "@/features/venue/cooldowns";
import { VenueHero } from "@/features/venue/hero";
import { FeaturedSection } from "@/features/venue/featured-section";
import { LiveSection } from "@/features/venue/live-section";
import { OfficialSection } from "@/features/venue/official-section";
import { usePresence } from "@/features/venue/presence";
import { ReportBar } from "@/features/venue/report-bar";
import { reportBarState } from "@/features/venue/report-bar-state";
import { haptics } from "@/lib/haptics";
import { distanceMeters } from "@/lib/geo";
import { colors, radius, screenPadding, size, space } from "@/theme";

const NO_PHOTOS: PhotoView[] = [];
const EPOCH = new Date(0).toISOString();

export default function VenueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { status } = useAuth();
  const signedIn = status === "signedIn";
  const venue = useVenue(id);
  const page = venue.data;
  const { refetch, dataUpdatedAt } = venue;
  const location = useLocationState();
  const [refreshing, setRefreshing] = useState(false);

  // While the page loads, draw the hero from the map's copy of this venue.
  const fromMap: MapVenue | undefined = queryClient.getQueryData<VenuesResponse>(qk.venues)?.venues.find((v) => v.id === id || v.slug === id);

  const canPing = signedIn && !!page && !page.viewer.ownsVenue && (location.permission === "granted" || !!location.simulated);
  const presence = usePresence(page?.official.id, canPing);
  const notice = useCooldownNotice(page?.official.id ?? id);
  const me = useMe();
  const bar = reportBarState({
    signedIn,
    ownsVenue: page?.viewer.ownsVenue ?? false,
    geofenceExempt: me.data?.settings.geofenceExempt ?? false,
    permission: location.permission,
    presence,
  });

  const rsvp = useMutation({
    mutationFn: (going: boolean) => api.venues.rsvp(page!.official.id, going),
    onMutate: async (going) => {
      await queryClient.cancelQueries({ queryKey: qk.venue(id) });
      const previous = queryClient.getQueryData<VenuePageResponse>(qk.venue(id));
      if (previous) {
        queryClient.setQueryData<VenuePageResponse>(qk.venue(id), {
          ...previous,
          viewer: { ...previous.viewer, going },
          live: { ...previous.live, goingTonight: Math.max(0, previous.live.goingTonight + (going ? 1 : -1)) },
        });
      }
      return { previous };
    },
    onSuccess: (res) => {
      haptics.success();
      queryClient.setQueryData<VenuePageResponse>(qk.venue(id), (p) => (p ? { ...p, viewer: { ...p.viewer, going: res.going }, live: { ...p.live, goingTonight: res.goingTonight } } : p));
      void queryClient.invalidateQueries({ queryKey: qk.venues });
    },
    onError: (_e, _going, ctx) => {
      haptics.warning();
      if (ctx?.previous) queryClient.setQueryData(qk.venue(id), ctx.previous);
    },
  });

  const toggleGoing = () => {
    if (!signedIn) return router.push("/sign-in");
    if (!page || rsvp.isPending) return;
    rsvp.mutate(!page.viewer.going);
  };

  const openReport = (kind: "VIBE" | "LINE" | "COVER") => {
    if (!page) return;
    haptics.select();
    router.push({ pathname: "/venue/report", params: { id: page.official.id, kind, name: page.official.name } });
  };

  // Camera first: open it straight from the bar, then rating, caption and post in the composer. Posts are
  // camera-only; without a camera (denied, Simulator) the composer opens with the reason and a Retake button.
  const openCamera = async () => {
    if (!page) return;
    haptics.select();
    const shot = await takePhoto();
    if (shot === "cancelled") return;
    const params: Record<string, string> = { id: page.official.id, name: page.official.name };
    if (typeof shot === "object") params.uri = shot.uri;
    else params.note = CAMERA_NOTE[shot];
    router.push({ pathname: "/venue/photo", params });
  };

  const onPhotoExpired = useCallback(() => void refetch(), [refetch]);
  const livePhotos = useLivePhotos(page?.live.livePhotos ?? NO_PHOTOS, page?.now ?? EPOCH, venue.dataUpdatedAt, onPhotoExpired);
  const uploads = useUploads(page?.official.id ?? id);
  const failedUpload = uploads.find((u) => u.status === "failed");
  // Drop optimistic tiles once the refetched page includes the real photo.
  const livePhotoIds = page?.live.livePhotos.map((p) => p.id).join(",") ?? "";
  const pageVenueId = page?.official.id;
  useEffect(() => {
    if (pageVenueId) uploadStore.settle(pageVenueId, new Set(livePhotoIds.split(",")));
  }, [pageVenueId, livePhotoIds]);

  // Coming back from the report sheet or photo viewer: refresh if the page is getting old.
  useFocusEffect(
    useCallback(() => {
      if (dataUpdatedAt && Date.now() - dataUpdatedAt > 30_000) void refetch();
    }, [refetch, dataUpdatedAt]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await venue.refetch().finally(() => setRefreshing(false));
  };

  const serverDistance = presence.status === "done" ? presence.result.distanceM : null;
  const userCoords = location.simulated ?? (location.device ? { lat: location.device.lat, lng: location.device.lng } : null);
  const shownDistance =
    serverDistance ?? (userCoords && page ? distanceMeters(userCoords, { lat: page.official.lat, lng: page.official.lng }) : null);

  const barVisible = bar.kind !== "hidden" && !!page;
  const bottomSpace = insets.bottom + (barVisible ? size.reportBarHeight + space.xxxl + space.xl : space.xl);
  const notFound = venue.error instanceof ApiError && venue.error.status === 404;

  return (
    <GestureHandlerRootView style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomSpace }]}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.textSecondary} />}
        showsVerticalScrollIndicator={false}
      >
        {page ? (
          <>
            <VenueHero
              name={page.official.name}
              neighborhood={page.official.neighborhood}
              address={page.official.address}
              vibe={page.live.consensus.vibe.status === "ok" ? page.live.consensus.vibe.value : "NO_DATA"}
              photoUrl={page.official.officialPhotoUrl}
              distanceM={shownDistance}
            />
            <LiveSection
              page={page}
              onToggleGoing={toggleGoing}
              goingPending={rsvp.isPending}
              goingError={rsvp.error ? errorText(rsvp.error, "Couldn't update your plans. Try again.") : null}
            />
            <PhotosSection
              // The route's key: the viewer reads this page from the same cache entry.
              venueId={id}
              live={livePhotos}
              earlier={page.live.earlierPhotos}
              pending={uploads}
              serverNow={page.now}
              canPost={bar.kind === "ready"}
              onTakePhoto={() => void openCamera()}
              onRetryUpload={(localId) => uploadStore.retry(localId)}
            />
            {failedUpload?.error && <InlineError message={failedUpload.error} onRetry={() => uploadStore.retry(failedUpload.localId)} />}
            <FeaturedSection venueId={id} featured={page.featured} />
            <CommentsSection page={page} signedIn={signedIn} />
            <OfficialSection official={page.official} now={page.now} />
          </>
        ) : notFound ? (
          <View style={styles.empty}>
            <Text variant="title2">This venue isn&apos;t available</Text>
            <Text color="textSecondary">It may have closed or been removed.</Text>
            <Button title="Back to the map" variant="secondary" block={false} onPress={() => router.back()} />
          </View>
        ) : (
          <>
            {fromMap ? (
              <VenueHero name={fromMap.name} neighborhood={fromMap.neighborhood} address={fromMap.address} vibe={fromMap.vibe} photoUrl={null} distanceM={null} loading />
            ) : (
              <Skeleton height={size.heroHeight} />
            )}
            {venue.isError ? (
              <InlineError message={errorText(venue.error, "Couldn't load this venue. Try again.")} onRetry={() => void venue.refetch()} retrying={venue.isFetching} />
            ) : (
              <VenueSkeleton />
            )}
          </>
        )}
      </ScrollView>

      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" hitSlop={space.xs} style={styles.close}>
        <Icon name="xmark" color="textPrimary" size={size.iconTiny} weight="bold" />
      </Pressable>

      {/* Below the grabber and close button. */}
      <OfflineBanner top={space.lg + size.avatar + space.xs} />
      <ToastHost bottom={insets.bottom + (barVisible ? size.reportBarHeight + space.xxl : space.lg)} />

      {barVisible && (
        <View style={[styles.bar, { bottom: insets.bottom + space.xs }]}>
          <ReportBar
            state={bar}
            notice={notice}
            onReport={openReport}
            onCamera={() => void openCamera()}
            onSignIn={() => router.push("/sign-in")}
            onEnableLocation={() => router.push("/location-permission")}
            onOpenSettings={() => void Linking.openSettings()}
          />
        </View>
      )}
    </GestureHandlerRootView>
  );
}

function VenueSkeleton() {
  return (
    <View style={styles.skeleton} accessibilityLabel="Loading venue" accessibilityRole="progressbar">
      <Skeleton width="40%" height={size.iconLarge} />
      <Skeleton width="70%" height={size.iconLarge + space.sm} />
      <View style={styles.skeletonRow}>
        <Skeleton height={size.avatarLarge + space.md} />
        <Skeleton height={size.avatarLarge + space.md} />
      </View>
      <Skeleton height={size.buttonHeight} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: screenPadding, paddingTop: space.xl, gap: space.xxl },
  close: {
    position: "absolute",
    top: space.lg,
    right: screenPadding,
    width: size.avatar - space.xxs,
    height: size.avatar - space.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.scrim,
    alignItems: "center",
    justifyContent: "center",
  },
  bar: { position: "absolute", left: space.sm, right: space.sm },
  empty: { gap: space.sm, paddingTop: space.xxxl, alignItems: "flex-start" },
  skeleton: { gap: space.md },
  skeletonRow: { flexDirection: "row", gap: space.md },
});
