import { Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { errorText } from "@/api";
import { COLLECTION_NAME_MAX, type CollectionColorValue } from "@/api/collection-contracts";
import type { StampView } from "@/api/contracts";
import { Kicker, Rule } from "@/components/editorial/editorial";
import { Button } from "@/components/ui/button";
import { HeaderButton, headerTextButtons } from "@/components/ui/header-button";
import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { StampMark } from "@/features/book/StampMark";
import { localityKey, localityLabel } from "@/lib/place";
import { colors, hairlineWidth, radius, size, space, type as typeScale, maxFontSizeMultiplier, pressedOpacity } from "@/theme";
import { COLLECTION_COLORS } from "./colors";
import { useMyStamps } from "./use-my-stamps";
import { Tappable } from "@/components/ui/tappable";

/** Stamp mark size in the editor rows; fits inside a standard list row. */
const THUMB = size.hitTarget + space.xs;

export type CollectionDraft = { name: string; color: CollectionColorValue; stampIds: string[] };

type Props = {
  initial: CollectionDraft;
  /** The header action ("Create", "Save"). The sheet title already names the screen (P-130). */
  submitLabel: string;
  busy?: boolean;
  error?: unknown;
  /** Copy for `error` when the server gives none. Defaults to the save message. */
  errorFallback?: string;
  onSubmit: (draft: CollectionDraft) => void;
  onDelete?: () => void;
  deleting?: boolean;
  /** Stamps already known (the collection's own), shown while the full library is still loading. */
  knownStamps?: StampView[];
};

const stampDate = (stamp: StampView) => new Date(stamp.visitedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: stamp.place.timeZone });
const stampSubtitle = (stamp: StampView) => [localityLabel(stamp.place), stampDate(stamp)].filter(Boolean).join(" · ");

/** The stamp's own mark, so rows read like the Gallery's rather than a bare list of names. */
function StampThumb({ stamp }: { stamp: StampView }) {
  return (
    <View style={styles.thumb} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <StampMark
        input={{ placeId: stamp.place.id, placeName: stamp.place.name, localityKey: localityKey(stamp.place), localityName: localityLabel(stamp.place) }}
        size={THUMB}
        artwork={stamp.artwork}
        photoUrl={stamp.photoUrl}
        visitedAt={stamp.visitedAt}
        timeZone={stamp.place.timeZone}
      />
    </View>
  );
}

export function CollectionEditor({ initial, submitLabel, busy, error, errorFallback, onSubmit, onDelete, deleting, knownStamps }: Props) {
  const source = useMyStamps();
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState<CollectionColorValue>(initial.color);
  const [stampIds, setStampIds] = useState(initial.stampIds);
  const byId = new Map([...(knownStamps ?? []), ...source.stamps].map((stamp) => [stamp.id, stamp]));
  const selected = stampIds.map((id) => byId.get(id)).filter((stamp): stamp is StampView => !!stamp);
  const available = source.stamps.filter((stamp) => !stampIds.includes(stamp.id));
  const named = name.trim().length > 0 && name.trim().length <= COLLECTION_NAME_MAX;
  // Save and Delete never run together (P-133).
  const valid = named && !busy && !deleting;
  const submit = () => onSubmit({ name: name.trim(), color, stampIds });

  const remove = (id: string) => setStampIds((ids) => ids.filter((value) => value !== id));
  const add = (id: string) => setStampIds((ids) => [...ids, id]);
  const move = (index: number, delta: number) => {
    setStampIds((ids) => {
      const target = index + delta;
      if (target < 0 || target >= ids.length) return ids;
      const next = [...ids];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentContainerStyle={styles.content}>
      {/* The action lives in the header, so it stays in reach above a long stamp list (P-127). */}
      <Stack.Screen options={headerTextButtons({ right: <HeaderButton label={submitLabel} bold loading={busy} disabled={!valid} onPress={submit} /> })} />
      {/* Errors sit at the top, next to the header action that caused them. */}
      {error ? <InlineError message={errorText(error, errorFallback ?? "Couldn't save this collection. Try again.")} /> : null}
      <View style={styles.field}>
        <Kicker>NAME</Kicker>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={COLLECTION_NAME_MAX}
          placeholder="Date Nights"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="words"
          returnKeyType="done"
          selectionColor={colors.accent}
          maxFontSizeMultiplier={maxFontSizeMultiplier}
          style={styles.nameInput}
          accessibilityLabel="Collection name"
        />
        <View style={styles.nameMeta}>
          {named ? null : <Text variant="footnote" color="textTertiary" style={styles.hint}>Add a name to {submitLabel.toLowerCase()}.</Text>}
          <Text variant="footnote" color="textTertiary">{name.trim().length} / {COLLECTION_NAME_MAX}</Text>
        </View>
      </View>

      <Rule />
      <View style={styles.field}>
        <Kicker>COVER COLOR</Kicker>
        <View style={styles.colors} accessibilityRole="radiogroup" accessibilityLabel="Cover color">
          {COLLECTION_COLORS.map((option) => {
            const active = option.id === color;
            return (
              <Tappable
                key={option.id}
                accessibilityRole="radio"
                accessibilityLabel={`${option.label} cover`}
                accessibilityState={{ checked: active }}
                onPress={() => setColor(option.id)}
                style={[styles.colorTarget, active && styles.colorTargetActive]}
              >
                <View style={[styles.swatch, { backgroundColor: option.value }]} />
              </Tappable>
            );
          })}
        </View>
      </View>

      <Rule />
      <View style={styles.field}>
        <Kicker>IN THIS COLLECTION · {stampIds.length}</Kicker>
        {source.pending && selected.length < stampIds.length ? <SkeletonRows count={Math.min(3, stampIds.length - selected.length)} /> : null}
        {source.error ? <InlineError message="Couldn't load your stamps." onRetry={source.retry} /> : null}
        {!source.pending && !source.error && stampIds.length === 0 ?<Text variant="callout" color="textSecondary">No stamps yet. Add any stamp from your master Passport below.</Text> : null}
        {selected.map((stamp, index) => (
          <View key={stamp.id} style={styles.stampRow}>
            <StampThumb stamp={stamp} />
            <View style={styles.stampText}>
              <Text variant="body" weight="semibold" numberOfLines={1}>{stamp.place.name}</Text>
              <Text variant="footnote" color="textSecondary" numberOfLines={1}>{stampSubtitle(stamp)}</Text>
            </View>
            <View style={styles.rowActions}>
              <Tappable disabled={index === 0} onPress={() => move(index, -1)} accessibilityRole="button" accessibilityLabel={`Move ${stamp.place.name} up`} style={[styles.iconButton, index === 0 && styles.disabled]}><Icon name="chevron.up" size={size.iconSmall} /></Tappable>
              <Tappable disabled={index === selected.length - 1} onPress={() => move(index, 1)} accessibilityRole="button" accessibilityLabel={`Move ${stamp.place.name} down`} style={[styles.iconButton, index === selected.length - 1 && styles.disabled]}><Icon name="chevron.down" size={size.iconSmall} /></Tappable>
              <Tappable onPress={() => remove(stamp.id)} accessibilityRole="button" accessibilityLabel={`Remove ${stamp.place.name} from collection`} style={styles.iconButton}><Icon name="xmark" size={size.iconSmall} /></Tappable>
            </View>
          </View>
        ))}
      </View>

      {!source.pending && !source.error && available.length > 0 ? <>
        <Rule />
        <View style={styles.field}>
          <Kicker>ADD STAMPS</Kicker>
          {available.map((stamp) => (
            <Tappable key={stamp.id} onPress={() => add(stamp.id)} accessibilityRole="button" accessibilityLabel={`Add ${stamp.place.name} to collection`} style={({ pressed }) => [styles.stampRow, pressed && styles.pressed]}>
              <StampThumb stamp={stamp} />
              <View style={styles.stampText}>
                <Text variant="body" weight="semibold" numberOfLines={1}>{stamp.place.name}</Text>
                <Text variant="footnote" color="textSecondary" numberOfLines={1}>{stampSubtitle(stamp)}</Text>
              </View>
              <Icon name="plus" color="accent" size={size.iconSmall} />
            </Tappable>
          ))}
          {source.loadingMore ? <ActivityIndicator color={colors.textSecondary} style={styles.more} accessibilityLabel="Loading more stamps" /> : null}
        </View>
      </> : null}

      {onDelete ? <Button title="Delete collection" variant="destructive" loading={deleting} disabled={busy} onPress={onDelete} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxxl, gap: space.lg },
  field: { gap: space.sm },
  nameMeta: { flexDirection: "row", justifyContent: "flex-end", gap: space.sm },
  hint: { flex: 1 },
  more: { paddingVertical: space.sm },
  // No lineHeight: on a single-line iOS input it pushes the caret off the placeholder's baseline.
  nameInput: { fontFamily: typeScale.title.fontFamily, fontSize: typeScale.title.fontSize, minHeight: size.fieldHeight, borderBottomWidth: hairlineWidth, borderColor: colors.textPrimary, color: colors.textPrimary, paddingVertical: space.xs },
  colors: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  // A round swatch in a round target: the selection reads as a ring around the chip, not a square box around a circle.
  colorTarget: { width: size.hitTarget, height: size.hitTarget, borderRadius: radius.pill, borderWidth: size.markerRing, borderColor: colors.transparent, alignItems: "center", justifyContent: "center" },
  colorTargetActive: { borderColor: colors.accent },
  swatch: { width: size.avatar - space.xxs, height: size.avatar - space.xxs, borderRadius: radius.pill },
  stampRow: { minHeight: size.listRow, flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.xs, borderBottomWidth: hairlineWidth, borderBottomColor: colors.hairline },
  thumb: { width: THUMB, height: THUMB, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: pressedOpacity },
  stampText: { flex: 1, gap: space.xxs },
  rowActions: { flexDirection: "row", alignItems: "center" },
  iconButton: { width: size.hitTarget, height: size.hitTarget, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.25 },
});
