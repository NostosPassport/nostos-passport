import { type ReactNode, useMemo, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { Button } from "@/components/ui/button";
import { ListGroup, ListRow } from "@/components/ui/list-row";
import { Text } from "@/components/ui/text";
import { BearerPage } from "@/features/book/BearerPage";
import { Counts, Cover } from "@/features/book/Cover";
import { FirstRunHint } from "@/features/book/FirstRunHint";
import { FlipBook } from "@/features/book/FlipBook";
import { InsideCover } from "@/features/book/InsideCover";
import { LandingScene } from "@/features/book/LandingScene";
import { OpeningCover } from "@/features/book/OpeningCover";
import { PageView } from "@/features/book/PageView";
import { PhotoViewer } from "@/features/book/PhotoViewer";
import { Spread } from "@/features/book/Spread";
import { type PageFace, groupByPage, spreadCountFor } from "@/features/book/spreads";
import { BORDERS, MOTIFS, SHAPES, stampDesign } from "@/features/book/stamp-design";
import { StampMark } from "@/features/book/StampMark";
import { TicketStub } from "@/features/book/TicketStub";
import { VisaSpread } from "@/features/book/VisaSpread";
import { bookSize } from "@/features/book/dimensions";
import { PinMarker } from "@/features/map/PinMarker";
import { PlaceSheet } from "@/features/map/PlaceSheet";
import { localityKey, localityLabel } from "@/lib/place";
import { bookMotion, colors, fonts, palette, radius, screenPadding, shadows, size, space, stampStyle, type as typeScale } from "@/theme";
import { SAMPLE_PHOTOS } from "./sample-photos";
import { SAMPLE_USER, SAMPLE_VISA_STAMP, sampleStamp, sampleStamps } from "./sample";

export type GallerySection = { id: string; title: string; note: string; Component: () => ReactNode };

const input = (i: number) => {
  const s = sampleStamp(i);
  return { placeId: s.place.id, placeName: s.place.name, localityKey: localityKey(s.place), localityName: localityLabel(s.place) };
};

function useBook() {
  const { width, height } = useWindowDimensions();
  const book = bookSize(width, height);
  const page = Math.floor((width - screenPadding * 2) / 2);
  return { book, pageW: page, pageH: Math.floor(page * (book.pageHeight / book.pageWidth)), width };
}

const Specimen = ({ label, children }: { label: string; children: ReactNode }) => (
  <View style={styles.specimen}>
    <Text variant="typewriterSmall" color="dimBrass">{label.toUpperCase()}</Text>
    {children}
  </View>
);

function Palette() {
  const rows = Object.entries(palette);
  return (
    <>
      <View style={styles.swatches}>
        {rows.map(([name, value]) => (
          <View key={name} style={styles.swatch} accessible accessibilityLabel={`${name}, ${value}`}>
            <View style={[styles.chip, { backgroundColor: value }]} />
            <Text variant="typewriterSmall">{name}</Text>
            <Text variant="typewriterSmall" color="textTertiary">{value}</Text>
          </View>
        ))}
      </View>
      <Specimen label="Brass glow, hairline, scrim">
        <View style={styles.row}>
          {(["brassGlow", "brassGlowSoft", "hairline", "scrim", "foilHighlight"] as const).map((k) => (
            <View key={k} style={styles.swatch}>
              <View style={[styles.chip, { backgroundColor: colors[k] }]} />
              <Text variant="typewriterSmall">{k}</Text>
            </View>
          ))}
        </View>
      </Specimen>
    </>
  );
}

function Type() {
  return (
    <>
      {(Object.keys(typeScale) as (keyof typeof typeScale)[]).map((variant) => (
        <View key={variant} style={styles.typeRow}>
          <Text variant="typewriterSmall" color="dimBrass">{variant}</Text>
          <Text variant={variant}>Go somewhere. Get a stamp.</Text>
        </View>
      ))}
      <Text variant="typewriterSmall" color="textTertiary">Serif {fonts.serif}. Typewriter {fonts.mono}. System sans for the rest.</Text>
    </>
  );
}

function SpaceSection() {
  return (
    <>
      <Specimen label="Space">
        {Object.entries(space).map(([k, v]) => (
          <View key={k} style={styles.row}>
            <View style={[styles.bar, { width: v }]} />
            <Text variant="typewriterSmall">{k} {v}</Text>
          </View>
        ))}
      </Specimen>
      <Specimen label="Radius">
        <View style={styles.row}>
          {Object.entries(radius).map(([k, v]) => (
            <View key={k} style={[styles.box, { borderRadius: Math.min(v, size.avatarLarge / 2) }]} accessible accessibilityLabel={`${k} ${v}`} />
          ))}
        </View>
      </Specimen>
      <Specimen label="Shadow">
        <View style={styles.row}>
          {(Object.keys(shadows) as (keyof typeof shadows)[]).map((k) => (
            <View key={k} style={[styles.box, shadows[k]]} accessible accessibilityLabel={`${k} shadow`} />
          ))}
        </View>
      </Specimen>
      <Specimen label="Motion (springs)">
        <Text variant="typewriterSmall" color="textSecondary">
          {Object.entries(bookMotion).filter(([k]) => k !== "durations").map(([k, v]) => `${k}: damping ${(v as { damping: number }).damping}, stiffness ${(v as { stiffness: number }).stiffness}`).join("\n")}
        </Text>
      </Specimen>
    </>
  );
}

function Controls() {
  return (
    <>
      <Button title="Primary" />
      <Button title="Secondary" variant="secondary" />
      <Button title="Plain" variant="plain" />
      <Button title="Disabled" disabled />
      <Button title="Loading" loading />
      <ListGroup header="A list">
        <ListRow icon="lock.fill" iconColor="dimBrass" title="Customize, coming soon" chevron />
        <ListRow icon="person.crop.circle" title="Edit profile" subtitle="Ava Lee · @avaa" chevron />
      </ListGroup>
    </>
  );
}

function CoverSection() {
  const { book } = useBook();
  return <Cover width={book.width} height={book.height} counts={{ stamps: 24, places: 18 }} name={SAMPLE_USER.displayName} />;
}

function OpenSection() {
  const { book } = useBook();
  const [open, setOpen] = useState(false);
  const w = Math.round(book.width * 0.6);
  const h = Math.round(book.height * 0.6);
  return (
    <>
      <View style={{ height: h + space.xl, paddingLeft: w }}>
        <OpeningCover
          width={w}
          height={h}
          open={open}
          outside={<Cover width={w} height={h} counts={{ stamps: 0, places: 0 }} showCounts={false} />}
          page={<BearerPage width={w} height={h} bearer={SAMPLE_USER} avatarUrl={null} />}
        />
      </View>
      <Button title={open ? "Close the cover" : "Open the cover"} variant="secondary" onPress={() => setOpen((o) => !o)} />
    </>
  );
}

function BearerSection() {
  const { book } = useBook();
  const w = Math.round(book.width * 0.85);
  return <BearerPage width={w} height={Math.round(w * 1.42)} bearer={SAMPLE_USER} avatarUrl={null} />;
}

const STAMPS = sampleStamps(14);
const BY_PAGE = groupByPage(STAMPS);

function PagesSection() {
  const { pageW, pageH } = useBook();
  return (
    <Spread pageWidth={pageW} pageHeight={pageH} spreadIndex={1} spreadTotal={4}>
      <View style={styles.pair}>
        <PageView page={1} side="left" width={pageW} height={pageH} stamps={BY_PAGE.get(1) ?? []} />
        <PageView page={2} side="right" width={pageW} height={pageH} stamps={BY_PAGE.get(2) ?? []} />
      </View>
    </Spread>
  );
}

function FlipSection() {
  const { pageW, pageH } = useBook();
  const [spread, setSpread] = useState(0);
  const total = spreadCountFor(STAMPS.length);
  const face = (f: PageFace, side: "left" | "right") =>
    f.kind === "inside-cover" ? <InsideCover width={pageW} height={pageH} /> : f.kind === "bearer" ? <BearerPage width={pageW} height={pageH} bearer={SAMPLE_USER} avatarUrl={null} /> : <PageView page={f.page} side={side} width={pageW} height={pageH} stamps={BY_PAGE.get(f.page) ?? []} />;
  return (
    <>
      <FlipBook pageWidth={pageW} pageHeight={pageH} total={total} spread={spread} onSpreadChange={setSpread} renderFace={face} />
      <View style={styles.row}>
        <Button title="Back" variant="secondary" compact block={false} disabled={spread === 0} onPress={() => setSpread((s) => Math.max(0, s - 1))} />
        <Button title="Next" variant="secondary" compact block={false} disabled={spread >= total - 1} onPress={() => setSpread((s) => Math.min(total - 1, s + 1))} />
      </View>
      <Text variant="typewriterSmall" color="textSecondary">Drag from an outer edge, or tap it. Spread {spread + 1} of {total}.</Text>
    </>
  );
}

function StampsSection() {
  const base = input(0);
  return (
    <>
      <Specimen label="Eighteen places worldwide">
        <View style={styles.grid}>
          {Array.from({ length: 18 }, (_, i) => <StampMark key={i} input={input(i)} size={size.avatarLarge * 1.5} />)}
        </View>
      </Specimen>
      <Specimen label="Shapes">
        <View style={styles.grid}>
          {SHAPES.map((shape) => <StampMark key={shape} input={base} size={size.avatarLarge * 1.5} design={{ ...stampDesign(base), shape, layout: shape === "circle" ? "arc" : "banner" }} />)}
        </View>
      </Specimen>
      <Specimen label="Borders (one per locality seed)">
        <View style={styles.grid}>
          {BORDERS.map((border) => <StampMark key={border} input={base} size={size.avatarLarge * 1.5} design={{ ...stampDesign(base), shape: "circle", layout: "arc", border }} />)}
        </View>
      </Specimen>
      <Specimen label="Figures">
        <View style={styles.grid}>
          {MOTIFS.map((motif) => <StampMark key={motif} input={base} size={size.avatarLarge * 1.5} design={{ ...stampDesign(base), motif }} />)}
        </View>
      </Specimen>
      <Text variant="typewriterSmall" color="textSecondary">Ink is {stampStyle.ink === colors.brass ? "brass" : "brass"} on every stamp. Variety is shape and design only.</Text>
    </>
  );
}

function LandingSection() {
  const { pageW, pageH } = useBook();
  const [run, setRun] = useState(0);
  const stamp = useMemo(() => sampleStamp(7, { photos: SAMPLE_PHOTOS.slice(0, 3).map((url, position) => ({ id: `lp${position}`, url, position, x: null, y: null, rotation: null })) }), []);
  const w = Math.round(pageW * 1.1);
  return (
    <>
      <View style={{ height: Math.round(w * 1.42) + size.hitTarget * 4 }}>
        <LandingScene key={run} stamp={stamp} others={BY_PAGE.get(stamp.page ?? 1)?.filter((s) => s.id !== stamp.id) ?? []} pageWidth={w} pageHeight={Math.round(w * 1.42)} onDone={() => setRun((n) => n + 1)} />
      </View>
      <Button title="Replay the landing" variant="secondary" onPress={() => setRun((n) => n + 1)} />
      <Text variant="typewriterSmall" color="textSecondary">{pageH > 0 ? "Slam, ink, glow, shake and a haptic knock at impact. Done also replays." : ""}</Text>
    </>
  );
}

function VisaSection() {
  return <VisaSpread stamp={SAMPLE_VISA_STAMP} onSaveLayout={() => undefined} />;
}

function ViewerSection() {
  const [at, setAt] = useState<number | null>(null);
  const photos = SAMPLE_PHOTOS.map((url, position) => ({ id: `v${position}`, url, position, x: null, y: null, rotation: null }));
  return (
    <>
      <Button title="Open the photo viewer" variant="secondary" onPress={() => setAt(0)} />
      <PhotoViewer photos={photos} index={at} onClose={() => setAt(null)} />
    </>
  );
}

function MapSection() {
  const i = input(0);
  return (
    <>
      <View style={styles.row}>
        <PinMarker kind="lit" selected={false} input={i} />
        <PinMarker kind="lit" selected input={i} />
        <PinMarker kind="dim" selected={false} input={i} />
        <PinMarker kind="dim" selected input={i} />
      </View>
      <View style={styles.sheetBox}>
        <PlaceSheet model={{ title: "Katz's Delicatessen", subtitle: "Lower East Side · 205 E Houston St", status: "Stamped 3 times. Last on 03 OCT 2026.", distance: "40 m away", canStamp: true }} onClose={() => undefined} onStamp={() => undefined} onOpenPlace={() => undefined} />
      </View>
    </>
  );
}

function StubSection() {
  return (
    <>
      <TicketStub song={{ title: "Heroes", artist: "David Bowie", artUrl: null }} />
      <FirstRunHint onDismiss={() => undefined} />
      <Counts counts={{ stamps: 24, places: 18 }} />
    </>
  );
}

export const GALLERY_SECTIONS: GallerySection[] = [
  { id: "palette", title: "Palette", note: "Black, two near-blacks, brass, dim brass and three bone tones. Nothing else, not even for errors.", Component: Palette },
  { id: "type", title: "Type", note: "Serif for titles and stamps, typewriter for dates and captions, system sans for the rest.", Component: Type },
  { id: "space", title: "Space, radius, shadow, motion", note: "The tokens every screen is built from.", Component: SpaceSection },
  { id: "controls", title: "Buttons and rows", note: "The common controls in every state.", Component: Controls },
  { id: "cover", title: "Cover", note: "Leather, brass foil, emblem. Drag it, tilt the phone, or leave it to shimmer.", Component: CoverSection },
  { id: "open", title: "Opening the cover", note: "Swings on its left edge with live shading.", Component: OpenSection },
  { id: "bearer", title: "Bearer page", note: "Your details, a number made from your handle, and the machine lines.", Component: BearerSection },
  { id: "pages", title: "Pages and spread", note: "Fold, page edges, numbers, guilloche, three slots with jitter, a pinned ribbon.", Component: PagesSection },
  { id: "flip", title: "Page flip", note: "Drag from the outer edge, tap the edge, or use the buttons.", Component: FlipSection },
  { id: "stamps", title: "Stamps", note: "A stamp is a pure function of its place: same place, same stamp.", Component: StampsSection },
  { id: "landing", title: "Stamp landing", note: "Replay it as often as you like. Turn on Reduce Motion to see the fade.", Component: LandingSection },
  { id: "visa", title: "Visa spread", note: "Stamp left, photos right. Drag a photo, tap one for full screen, watch the caption type.", Component: VisaSection },
  { id: "viewer", title: "Photo viewer", note: "Pinch to zoom, drag, double tap.", Component: ViewerSection },
  { id: "map", title: "Map pins and sheet", note: "Lit pins are little stamps in a glowing ring; dim ones are dots.", Component: MapSection },
  { id: "stub", title: "Ticket stub and hints", note: "A song as a ticket stub, the first-run card, and the passport counts.", Component: StubSection },
];

const styles = StyleSheet.create({
  specimen: { gap: space.xs },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.md },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  swatch: { width: size.avatarLarge * 1.6, gap: space.xxs },
  chip: { height: size.avatarLarge, borderRadius: radius.chip, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline },
  typeRow: { gap: space.xxs },
  bar: { height: space.xs, backgroundColor: colors.brass },
  box: { width: size.avatarLarge, height: size.avatarLarge, backgroundColor: colors.elevated, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.dimBrass },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  pair: { flexDirection: "row" },
  center: { alignItems: "center" },
  sheetBox: { height: size.heroHeight + space.xxxl, overflow: "hidden", borderRadius: radius.card, backgroundColor: colors.background },
});
