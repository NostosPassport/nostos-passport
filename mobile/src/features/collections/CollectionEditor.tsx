import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { errorText } from "@/api";
import { COLLECTION_NAME_MAX, type CollectionColor } from "@/api/collection-contracts";
import type { StampView } from "@/api/contracts";
import { Kicker, Rule } from "@/components/editorial/editorial";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { colors, fonts, hairlineWidth, size, space } from "@/theme";
import { COLLECTION_COLORS } from "./colors";
import { useMyStamps } from "./use-my-stamps";

export type CollectionDraft = { name: string; color: CollectionColor; stampIds: string[] };

type Props = {
  initial: CollectionDraft;
  submitLabel: string;
  busy?: boolean;
  error?: unknown;
  onSubmit: (draft: CollectionDraft) => void;
  onDelete?: () => void;
  deleting?: boolean;
};

const stampDate = (stamp: StampView) => new Date(stamp.visitedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export function CollectionEditor({ initial, submitLabel, busy, error, onSubmit, onDelete, deleting }: Props) {
  const source = useMyStamps();
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState<CollectionColor>(initial.color);
  const [stampIds, setStampIds] = useState(initial.stampIds);
  const byId = new Map(source.stamps.map((stamp) => [stamp.id, stamp]));
  const selected = stampIds.map((id) => byId.get(id)).filter((stamp): stamp is StampView => !!stamp);
  const available = source.stamps.filter((stamp) => !stampIds.includes(stamp.id));
  const valid = name.trim().length > 0 && name.trim().length <= COLLECTION_NAME_MAX && !busy;

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
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <View style={styles.field}>
        <Kicker>NAME</Kicker>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={COLLECTION_NAME_MAX}
          placeholder="Date Nights"
          placeholderTextColor={colors.textTertiary}
          style={styles.nameInput}
          accessibilityLabel="Collection name"
        />
        <Text variant="footnote" color="textTertiary" align="right">{name.length} / {COLLECTION_NAME_MAX}</Text>
      </View>

      <Rule />
      <View style={styles.field}>
        <Kicker>COVER COLOR</Kicker>
        <View style={styles.colors}>
          {COLLECTION_COLORS.map((option) => {
            const active = option.id === color;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityLabel={`${option.label} cover`}
                accessibilityState={{ selected: active }}
                onPress={() => setColor(option.id)}
                style={[styles.colorTarget, active && styles.colorTargetActive]}
              >
                <View style={[styles.swatch, { backgroundColor: option.value }]} />
              </Pressable>
            );
          })}
        </View>
      </View>

      <Rule />
      <View style={styles.field}>
        <Kicker>IN THIS COLLECTION · {stampIds.length}</Kicker>
        {source.pending ? <SkeletonRows count={3} /> : null}
        {source.error ? <InlineError message="Couldn't load your stamps." onRetry={source.retry} /> : null}
        {!source.pending && !source.error && selected.length === 0 ? <Text variant="callout" color="textSecondary">No stamps yet. Add any stamp from your master Passport below.</Text> : null}
        {selected.map((stamp, index) => (
          <View key={stamp.id} style={styles.stampRow}>
            <View style={styles.stampText}>
              <Text variant="body" weight="semibold" numberOfLines={1}>{stamp.place.name}</Text>
              <Text variant="footnote" color="textSecondary" numberOfLines={1}>{stamp.place.neighborhood} · {stampDate(stamp)}</Text>
            </View>
            <View style={styles.rowActions}>
              <Pressable disabled={index === 0} onPress={() => move(index, -1)} accessibilityRole="button" accessibilityLabel={`Move ${stamp.place.name} up`} style={[styles.iconButton, index === 0 && styles.disabled]}><Icon name="chevron.up" size={size.iconSmall} /></Pressable>
              <Pressable disabled={index === selected.length - 1} onPress={() => move(index, 1)} accessibilityRole="button" accessibilityLabel={`Move ${stamp.place.name} down`} style={[styles.iconButton, index === selected.length - 1 && styles.disabled]}><Icon name="chevron.down" size={size.iconSmall} /></Pressable>
              <Pressable onPress={() => remove(stamp.id)} accessibilityRole="button" accessibilityLabel={`Remove ${stamp.place.name} from collection`} style={styles.iconButton}><Icon name="xmark" size={size.iconSmall} /></Pressable>
            </View>
          </View>
        ))}
      </View>

      {!source.pending && !source.error && available.length > 0 ? <>
        <Rule />
        <View style={styles.field}>
          <Kicker>ADD STAMPS</Kicker>
          {available.map((stamp) => (
            <Pressable key={stamp.id} onPress={() => add(stamp.id)} accessibilityRole="button" accessibilityLabel={`Add ${stamp.place.name} to collection`} style={styles.addRow}>
              <View style={styles.stampText}>
                <Text variant="body" weight="semibold" numberOfLines={1}>{stamp.place.name}</Text>
                <Text variant="footnote" color="textSecondary" numberOfLines={1}>{stamp.place.neighborhood} · {stampDate(stamp)}</Text>
              </View>
              <Icon name="plus" color="accent" size={size.iconSmall} />
            </Pressable>
          ))}
        </View>
      </> : null}

      {error ? <InlineError message={errorText(error, "Couldn't save this collection. Try again.")} /> : null}
      <Button title={submitLabel} loading={busy} disabled={!valid} onPress={() => onSubmit({ name: name.trim(), color, stampIds })} />
      {onDelete ? <Button title="Delete collection" variant="destructive" loading={deleting} onPress={onDelete} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: 48, gap: space.lg },
  field: { gap: space.sm },
  nameInput: { minHeight: 52, borderBottomWidth: hairlineWidth, borderColor: colors.textPrimary, color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 32, paddingVertical: space.xs },
  colors: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  colorTarget: { width: 48, height: 48, borderWidth: hairlineWidth, borderColor: colors.hairline, alignItems: "center", justifyContent: "center" },
  colorTargetActive: { borderWidth: 2, borderColor: colors.accent },
  swatch: { width: 34, height: 34, borderRadius: 17 },
  stampRow: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: space.sm, borderBottomWidth: hairlineWidth, borderBottomColor: colors.hairline },
  addRow: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: space.sm, borderBottomWidth: hairlineWidth, borderBottomColor: colors.hairline },
  stampText: { flex: 1, gap: 2 },
  rowActions: { flexDirection: "row", alignItems: "center" },
  iconButton: { width: size.hitTarget, height: size.hitTarget, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.25 },
});
