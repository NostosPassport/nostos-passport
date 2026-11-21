import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCollections, useStampBooks } from "@/api/queries";
import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { ScreenState } from "@/components/ui/screen-state";
import { Tappable } from "@/components/ui/tappable";
import { Text } from "@/components/ui/text";
import { PASSPORT_BOOK, useBookActions } from "@/features/books/books";
import { usePassport } from "@/features/book/use-passport";
import { collectionColorValue } from "@/features/collections/colors";
import { nav } from "@/lib/nav";
import { colors, fonts, hairlineWidth, maxFontSizeMultiplier, screenPadding, size, space } from "@/theme";

/**
 * "Add to…": the books a stamp can sit in, the main passport first, then each collection. With one stamp the rows are
 * checkboxes; with several selected in the gallery each row adds all of them. A stamp always stays in the gallery.
 */
export default function AddTo() {
  const params = useLocalSearchParams<{ ids?: string }>();
  const ids = (params.ids ?? "").split(",").filter(Boolean);
  const single = ids.length === 1 ? ids[0]! : "";
  const insets = useSafeAreaInsets();
  const collections = useCollections();
  const books = useStampBooks(single, single !== "");
  const passport = usePassport();
  const { setIn } = useBookActions();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Books changed in this sheet: their state wins over the last loaded membership until it refetches.
  const [local, setLocal] = useState<Record<string, boolean>>({});

  const selected = new Set(ids);
  const allInPassport = ids.length > 0 && passport.stamps.filter((s) => selected.has(s.id)).every((s) => s.page !== null);
  const isIn = (book: string): boolean => {
    if (book in local) return local[book]!;
    if (single) return book === PASSPORT_BOOK ? books.data?.inPassport === true : books.data?.collectionIds.includes(book) === true;
    return book === PASSPORT_BOOK && allInPassport;
  };

  const toggle = async (book: string) => {
    if (busy) return;
    const add = single ? !isIn(book) : true;
    if (!single && isIn(book)) return;
    setBusy(book);
    setError(null);
    try {
      await setIn(book, ids, add);
      setLocal((prev) => ({ ...prev, [book]: add }));
    } catch {
      setError("Couldn't update that book. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  const newCollection = () => {
    router.dismiss();
    nav.push({ pathname: "/collections/new", params: { stampIds: ids.join(",") } });
  };

  const loading = collections.isPending || (single !== "" && books.isPending);
  const failed = collections.isError || (single !== "" && books.isError);
  const count = ids.length;

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + space.md }]}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={maxFontSizeMultiplier}>Add to…</Text>
        <Text variant="footnote" color="textSecondary" maxFontSizeMultiplier={maxFontSizeMultiplier}>
          {count > 1 ? `${count} stamps. ` : ""}Every stamp stays in your gallery, whichever books it&apos;s in.
        </Text>
      </View>
      {error ? <InlineError message={error} /> : null}
      {loading ? (
        <View style={styles.state}><ScreenState kind="loading" label="Loading your books" /></View>
      ) : failed ? (
        <View style={styles.state}><ScreenState kind="error" message="Couldn't load your books." onRetry={() => { void collections.refetch(); if (single) void books.refetch(); }} /></View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          <BookRow label="Main passport" detail="Where every new stamp lands" swatch={colors.accent} checked={isIn(PASSPORT_BOOK)} busy={busy === PASSPORT_BOOK} multi={!single} onPress={() => void toggle(PASSPORT_BOOK)} />
          {(collections.data?.collections ?? []).map((c) => (
            <BookRow
              key={c.id}
              label={c.name}
              detail={`${c.stampCount} ${c.stampCount === 1 ? "stamp" : "stamps"}`}
              swatch={collectionColorValue(c.color)}
              checked={isIn(c.id)}
              busy={busy === c.id}
              multi={!single}
              onPress={() => void toggle(c.id)}
            />
          ))}
          <Tappable onPress={newCollection} accessibilityRole="button" accessibilityLabel={count > 1 ? `New collection with these ${count} stamps` : "New collection with this stamp"} style={styles.row}>
            <View style={styles.newIcon}><Icon name="plus" color="accent" size={size.iconSmall} /></View>
            <Text variant="body" weight="semibold" color="accent" maxFontSizeMultiplier={maxFontSizeMultiplier}>New collection</Text>
          </Tappable>
        </ScrollView>
      )}
    </View>
  );
}

function BookRow({ label, detail, swatch, checked, busy, multi, onPress }: { label: string; detail: string; swatch: string; checked: boolean; busy: boolean; multi: boolean; onPress: () => void }) {
  const state = multi ? (checked ? "Added" : "Add") : null;
  return (
    <Tappable
      onPress={onPress}
      disabled={busy}
      accessibilityRole={multi ? "button" : "checkbox"}
      accessibilityLabel={multi ? `${state} to ${label}` : label}
      accessibilityState={multi ? { disabled: busy } : { checked, disabled: busy }}
      style={styles.row}
    >
      <View style={[styles.swatch, { backgroundColor: swatch }]} />
      <View style={styles.copy}>
        <Text variant="body" weight="semibold" numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier}>{label}</Text>
        <Text variant="footnote" color="textSecondary" numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier}>{detail}</Text>
      </View>
      <Icon name={checked ? "checkmark.circle.fill" : multi ? "plus.circle" : "circle"} color={checked ? "accent" : "textTertiary"} size={size.icon} />
    </Tappable>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: space.xl, gap: space.md },
  head: { paddingHorizontal: screenPadding, gap: space.xs },
  title: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 40, lineHeight: 44, letterSpacing: -0.9 },
  state: { minHeight: 180, alignItems: "center", justifyContent: "center" },
  list: { maxHeight: 420 },
  listContent: { paddingHorizontal: screenPadding },
  row: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: space.md, borderBottomWidth: hairlineWidth, borderBottomColor: colors.hairline },
  swatch: { width: 14, height: 18, borderRadius: 2 },
  copy: { flex: 1, minWidth: 0 },
  newIcon: { width: 14, alignItems: "center" },
});
