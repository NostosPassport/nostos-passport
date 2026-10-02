import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Linking, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { invalidateVenue, qk, useMe } from "@/api/queries";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { RatingPicker } from "@/components/ui/rating-picker";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import { locationStore } from "@/features/location/location-store";
import { CAMERA_NOTE, takePhoto, type PickedImage } from "@/features/photos/pick";
import { prepareImage } from "@/features/photos/prepare";
import { uploadStore } from "@/features/photos/upload-store";
import { captionMax, defaultShare } from "@/features/posts/composer";
import { cooldowns } from "@/features/venue/cooldowns";
import { requestPresencePing } from "@/features/venue/presence";
import { haptics } from "@/lib/haptics";
import { colors, dimmedOpacity, maxFontSizeMultiplier, radius, screenPadding, size, space, type as typeScale } from "@/theme";

/**
 * The post composer. The in-app camera already ran on the venue screen (the photo arrives as params); there is no
 * library option, because a post is proof you were there. Then a 1-10 rating, a caption and "Share to venue page".
 * Without a rating it's a live-only photo, as before (see mobile/DECISIONS.md).
 */
export default function PhotoComposer() {
  const params = useLocalSearchParams<{ id: string; name?: string; uri?: string; note?: string }>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [image, setImage] = useState<PickedImage | null>(params.uri ? { uri: params.uri, width: 0, height: 0 } : null);
  const [caption, setCaption] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const me = useMe();
  // Follows the account's default until the person flips it.
  const [shareChoice, setShareChoice] = useState<boolean | null>(null);
  const shared = shareChoice ?? defaultShare(me.data?.user.isPrivate ?? true);
  const maxCaption = captionMax(rating);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.note ?? null);
  const [needsLocation, setNeedsLocation] = useState(false);
  const venueId = params.id;
  // A ref, not state: two fast taps on Post must not start two uploads.
  const posting = useRef(false);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const retake = async () => {
    const shot = await takePhoto();
    if (typeof shot === "object") {
      setImage(shot);
      setError(null);
    } else if (shot !== "cancelled") setError(CAMERA_NOTE[shot]);
  };

  const post = async () => {
    if (!image || posting.current || caption.trim().length > maxCaption) return;
    posting.current = true;
    setBusy(true);
    setError(null);
    setNeedsLocation(false);
    try {
      const coords = await locationStore.currentForPosting();
      if (!coords) {
        setError("We need your location to confirm you're here.");
        setNeedsLocation(true);
        return;
      }
      const prepared = await prepareImage(image.uri);
      // Cancelled while preparing: don't post.
      if (!mounted.current) return;
      uploadStore.start(
        { venueId, uri: prepared.uri, caption: caption.trim(), coords, post: rating === null ? null : { rating, shared } },
        {
          onSuccess: () => {
            haptics.success();
            cooldowns.clear(venueId, "PHOTO");
            toast.show(rating === null ? "Photo posted. Thanks." : "Posted.");
            void invalidateVenue(queryClient, venueId);
            const handle = me.data?.user.handle;
            if (rating !== null && handle) void queryClient.invalidateQueries({ queryKey: qk.user(handle) });
          },
          onError: (e) => {
            haptics.warning();
            if (e.status === 429) cooldowns.set(venueId, "PHOTO", e.message);
            if (e.status === 403) requestPresencePing(venueId);
          },
        },
      );
      // The venue screen shows the upload as a tile with progress.
      router.back();
    } catch {
      if (mounted.current) setError("Couldn't prepare that photo. Try another one.");
    } finally {
      posting.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior="padding">
      <View style={[styles.top, { paddingTop: insets.top + space.xs }]}>
        <Pressable
          onPress={() => router.back()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          accessibilityState={{ disabled: busy }}
          hitSlop={space.xs}
          style={[styles.round, busy && styles.dimmed]}
        >
          <Icon name="xmark" color="textPrimary" size={size.iconSmall} weight="bold" />
        </Pressable>
        <Text variant="headline" numberOfLines={1} style={styles.title}>
          {params.name ?? "New photo"}
        </Text>
        <View style={styles.round} />
      </View>

      <OfflineBanner top={insets.top + size.hitTarget + space.sm} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.md }]} keyboardShouldPersistTaps="handled">
        {image ? (
          <View style={styles.preview}>
            <Image source={{ uri: image.uri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Selected photo" />
          </View>
        ) : (
          <View style={[styles.preview, styles.empty]}>
            <Icon name="photo.on.rectangle" color="textTertiary" size={size.iconLarge} />
            <Text color="textSecondary">Take a photo of what it&apos;s like right now.</Text>
          </View>
        )}

        <View style={styles.sources}>
          <Button title={image ? "Retake" : "Take photo"} icon="camera.fill" variant="secondary" compact block={false} onPress={() => void retake()} />
        </View>

        <View style={styles.block}>
          <Text variant="footnote" color="textSecondary" weight="semibold" style={styles.label}>
            Your rating
          </Text>
          <RatingPicker value={rating} onChange={setRating} disabled={busy} />
          {rating !== null && (
            <Button title="Clear rating" variant="plain" compact block={false} onPress={() => setRating(null)} accessibilityLabel="Clear rating, post a live photo only" />
          )}
        </View>

        <View style={styles.captionWrap}>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Add a caption (optional)"
            placeholderTextColor={colors.textTertiary}
            selectionColor={colors.accent}
            keyboardAppearance="dark"
            maxLength={maxCaption}
            multiline
            maxFontSizeMultiplier={maxFontSizeMultiplier}
            accessibilityLabel="Caption"
            style={styles.caption}
          />
          <Text variant="caption" color={caption.length > maxCaption ? "danger" : "textTertiary"} tabular style={styles.count}>
            {caption.length}/{maxCaption}
          </Text>
        </View>

        {rating !== null && (
          <View style={styles.block}>
            <View style={styles.switchRow}>
              <Text variant="body" style={styles.flex}>
                Share to venue page
              </Text>
              <Switch value={shared} onValueChange={setShareChoice} trackColor={{ true: colors.accent, false: colors.elevated }} accessibilityLabel="Share to venue page" />
            </View>
            <Text variant="footnote" color="textTertiary" style={styles.label}>
              {shared ? "Shows in the venue's photos, where it can be liked and featured." : "Only on your profile."}
            </Text>
          </View>
        )}

        {error && <InlineError message={error} />}
        {needsLocation && (
          <Button
            title={locationStore.get().permission === "denied" ? "Open Settings" : "Share location"}
            variant="secondary"
            onPress={() => (locationStore.get().permission === "denied" ? void Linking.openSettings() : router.push("/location-permission"))}
          />
        )}
        <Button
          title={rating === null ? "Post live photo" : "Post"}
          onPress={() => void post()}
          disabled={!image || caption.length > maxCaption}
          loading={busy}
        />
        <Text variant="footnote" color="textTertiary">
          {rating === null
            ? "Without a rating, it's a live photo: on the venue page for 3 hours, not on your profile. Location data is removed from the file."
            : "Posts stay on your profile. You can change the rating until 5 am. Location data is removed from the file."}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: screenPadding, gap: space.sm },
  title: { flex: 1, textAlign: "center" },
  round: { width: size.hitTarget, height: size.hitTarget, borderRadius: radius.pill, backgroundColor: colors.elevated, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: screenPadding, paddingTop: space.md, gap: space.md },
  preview: { aspectRatio: 3 / 4, borderRadius: radius.largeCard, overflow: "hidden", backgroundColor: colors.surface },
  empty: { alignItems: "center", justifyContent: "center", gap: space.sm, padding: space.xl },
  sources: { flexDirection: "row", gap: space.xs },
  block: { gap: space.xs },
  label: { paddingHorizontal: space.xxs },
  switchRow: { flexDirection: "row", alignItems: "center", minHeight: size.fieldHeight, paddingHorizontal: space.md, backgroundColor: colors.surface, borderRadius: radius.card },
  flex: { flex: 1 },
  captionWrap: { borderRadius: radius.card, backgroundColor: colors.surface, paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.xxs },
  caption: { ...typeScale.body, color: colors.textPrimary, minHeight: size.hitTarget },
  count: { alignSelf: "flex-end" },
  dimmed: { opacity: dimmedOpacity },
});
