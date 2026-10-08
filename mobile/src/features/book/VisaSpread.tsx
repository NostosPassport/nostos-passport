import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

import { api, errorText } from "@/api";
import type { StampView } from "@/api/contracts";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import { patchStamp } from "@/features/stamps/cache";
import { haptics } from "@/lib/haptics";
import { colors, screenPadding, space } from "@/theme";
import { bookSize } from "./dimensions";
import { PageStock } from "./PageStock";
import { PhotoViewer } from "./PhotoViewer";
import { ScrapbookPage } from "./ScrapbookPage";
import { slotPlacement } from "./slots";
import { Spread } from "./Spread";
import { StampMark } from "./StampMark";
import { TicketStub } from "./TicketStub";
import { useTypewriter } from "./typewriter";
import { visaLabel, visaStamp } from "./visa";

export function VisaSpread({ stamp, onSaveLayout }: { stamp: StampView; onSaveLayout?: (body: Parameters<typeof api.stamps.layout>[1]) => void }) {
  const { width: sw, height: sh } = useWindowDimensions();
  const queryClient = useQueryClient();
  const [viewing, setViewing] = useState<number | null>(null);
  const book = bookSize(sw, sh);
  const pageW = Math.floor((sw - screenPadding * 2) / 2);
  const pageH = Math.floor(pageW * (book.pageHeight / book.pageWidth));
  const { date, time } = visaStamp(stamp.visitedAt);
  const typed = useTypewriter(stamp.caption);
  const place = slotPlacement(stamp.id, stamp.slot ?? 1, pageW, pageH);
  const save = useMutation({ mutationFn: (body: Parameters<typeof api.stamps.layout>[1]) => api.stamps.layout(stamp.id, body), onSuccess: (r) => patchStamp(queryClient, stamp.id, () => r.stamp), onError: (e) => { haptics.warning(); toast.show(errorText(e, "Couldn't save the photo layout. Try again."), "neutral"); } });
  return <View style={styles.root}>
    <Spread pageWidth={pageW} pageHeight={pageH} spreadIndex={0} spreadTotal={1}><View style={styles.row}>
      <PageStock width={pageW} height={pageH} spine="right"><View style={styles.stampPage} accessible accessibilityLabel={`Stamp, ${stamp.place.name}`}><View style={{ transform: [{ rotate: `${place.rotation}deg` }] }}><StampMark input={{ placeId: stamp.place.id, placeName: stamp.place.name, neighborhoodId: stamp.place.neighborhoodId, neighborhoodName: stamp.place.neighborhood }} size={Math.round(pageW * 0.8)} /></View></View></PageStock>
      <ScrapbookPage stampId={stamp.id} photos={stamp.photos} width={pageW} height={pageH} editable onLayout={(body) => (onSaveLayout ? onSaveLayout(body) : save.mutate(body))} onOpenPhoto={setViewing} />
    </View></Spread>
    <View style={styles.slip} accessible={false}>
      <Text variant="typewriterSmall" color="dimBrass" accessibilityLabel={visaLabel(stamp.place.name, stamp.place.neighborhood, stamp.visitedAt, stamp.page)}>{[date, time].filter(Boolean).join("  ·  ")}</Text>
      <Pressable onPress={() => router.push({ pathname: "/place/[id]", params: { id: stamp.place.id } })} accessibilityRole="button" hitSlop={space.xs}><Text variant="title2" color="brass">{stamp.place.name}</Text></Pressable>
      <Text variant="typewriterSmall" color="textSecondary">{stamp.place.neighborhood}{stamp.page ? `  ·  page ${stamp.page}` : ""}</Text>
      <Text variant="footnote" color={stamp.verified ? "accent" : "textTertiary"}>{stamp.verified ? "Nostos visit verified" : "Visit not location verified"}</Text>
      {stamp.caption !== "" ? <View><Text variant="typewriter" color={typed >= stamp.caption.length ? "textPrimary" : "transparent"}>{stamp.caption}</Text>{typed < stamp.caption.length ? <Text variant="typewriter" style={styles.typed} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{stamp.caption.slice(0, typed)}</Text> : null}</View> : null}
      {stamp.song ? <TicketStub song={stamp.song} /> : null}{stamp.editedAt ? <Text variant="footnote" color="textTertiary">Edited</Text> : null}
    </View>
    <PhotoViewer photos={stamp.photos} index={viewing} onClose={() => setViewing(null)} />
  </View>;
}
const styles = StyleSheet.create({ root: { alignItems: "center", gap: space.xl, paddingTop: space.md }, row: { flexDirection: "row" }, stampPage: { flex: 1, alignItems: "center", justifyContent: "center" }, slip: { alignSelf: "stretch", gap: space.xs, paddingHorizontal: screenPadding }, typed: { position: "absolute", top: 0, left: 0, right: 0, color: colors.textPrimary } });
