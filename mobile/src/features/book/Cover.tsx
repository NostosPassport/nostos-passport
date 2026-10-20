import { CormorantGaramond_600SemiBold } from "@expo-google-fonts/cormorant-garamond";
import { CourierPrime_400Regular } from "@expo-google-fonts/courier-prime";
import { Canvas, Group, LinearGradient, Path, RadialGradient, RoundedRect, Shader, Skia, Text as SkiaText, useFont, vec } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import { useDerivedValue } from "react-native-reanimated";

import { Text } from "@/components/ui/text";
import { bookStyle, colors, shadows, space } from "@/theme";
import { emblem } from "./emblem";
import { trackedOffsets } from "./foil";
import { useFoilSweep } from "./use-foil-sweep";

export type CoverCounts = { stamps: number; places: number; neighborhoods?: number };

const LEATHER = Skia.RuntimeEffect.Make(`
uniform half4 dark;
uniform half4 light;
float h(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }
half4 main(float2 xy) {
  float2 c = floor(xy / 2.2);
  float n = h(c) * 0.6 + h(floor(xy / 5.0)) * 0.4;
  float cell = smoothstep(0.30, 0.78, n);
  float t = cell * 0.8 + h(c + 7.0) * 0.2;
  return mix(dark, light, half(t));
}`);

const WORDMARK = "NOSTOS";
const SUBTITLE = "PASSPORT";

export function Cover({ width, height, counts, onOpen, name, showCounts = true }: { width: number; height: number; counts: CoverCounts; onOpen?: () => void; name?: string; showCounts?: boolean }) {
  const { sweep, gesture } = useFoilSweep(width);
  const titleFont = useFont(CormorantGaramond_600SemiBold, Math.round(width * 0.135));
  const subFont = useFont(CourierPrime_400Regular, Math.round(width * 0.036));
  const start = useDerivedValue(() => vec(width * (sweep.value - 0.45), height * 0.15));
  const end = useDerivedValue(() => vec(width * (sweep.value + 0.45), height * 0.55));

  const e = useMemo(() => emblem(), []);
  const paths = useMemo(
    () => ({ rings: e.rings.map((d) => Skia.Path.MakeFromSVGString(d)), ticks: Skia.Path.MakeFromSVGString(e.ticks), star: Skia.Path.MakeFromSVGString(e.star), door: Skia.Path.MakeFromSVGString(e.door) }),
    [e],
  );
  const cx = width / 2;
  const emblemR = width * 0.25;
  const emblemY = height * 0.4;
  const inset = width * 0.05;
  const coverRadius = width * 0.065;

  const letters = useMemo(() => {
    if (!titleFont) return null;
    const widths = WORDMARK.split("").map((ch) => titleFont.measureText(ch).width);
    const { xs, total } = trackedOffsets(widths, width * 0.022);
    return { xs, total };
  }, [titleFont, width]);
  const sub = useMemo(() => {
    if (!subFont) return null;
    const widths = SUBTITLE.split("").map((ch) => subFont.measureText(ch).width);
    return trackedOffsets(widths, width * 0.03);
  }, [subFont, width]);

  const label = `Open your passport${name ? `, ${name}` : ""}. ${counts.stamps} stamps, ${counts.places} places.`;

  return (
    <View style={styles.wrap}>
      <GestureDetector gesture={gesture}>
        <View style={[styles.shadowShell, { width, height, borderRadius: coverRadius }]}>
          <Pressable
            onPress={onOpen}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityHint="Opens the book"
            style={[styles.bookClip, { width, height, borderRadius: coverRadius }]}
          >
            <Canvas style={{ width, height }}>
              <RoundedRect x={0} y={0} width={width} height={height} r={coverRadius}>
                {LEATHER ? <Shader source={LEATHER} uniforms={{ dark: Skia.Color(colors.elevated), light: Skia.Color(colors.background) }} /> : null}
              </RoundedRect>
              <RoundedRect x={0} y={0} width={width} height={height} r={coverRadius}>
                <LinearGradient start={vec(0, 0)} end={vec(width, height)} colors={[colors.leatherSheen, colors.transparent, colors.bookShade]} />
              </RoundedRect>
              <RoundedRect x={0} y={0} width={width} height={height} r={coverRadius}>
                <RadialGradient c={vec(cx, height * 0.45)} r={height * 0.85} colors={[colors.transparent, colors.bookShade]} />
              </RoundedRect>
              <RoundedRect x={inset} y={inset} width={width - inset * 2} height={height - inset * 2} r={width * 0.038} style="stroke" strokeWidth={bookStyle.borderThick}>
                <FoilGradient start={start} end={end} width={width} />
              </RoundedRect>
              <RoundedRect x={inset * 1.5} y={inset * 1.5} width={width - inset * 3} height={height - inset * 3} r={width * 0.03} style="stroke" strokeWidth={bookStyle.borderHair} color={colors.dimBrass} />
              <Group transform={[{ translateX: cx }, { translateY: emblemY }, { scale: emblemR }]}>
                {paths.rings.map((p, i) => (p ? <Path key={i} path={p} style="stroke" strokeWidth={i === 0 ? bookStyle.emblemRing : bookStyle.emblemInner}><FoilGradient start={start} end={end} width={width} /></Path> : null))}
                {paths.ticks ? <Path path={paths.ticks} style="stroke" strokeWidth={bookStyle.emblemTick}><FoilGradient start={start} end={end} width={width} /></Path> : null}
                {paths.star ? <Path path={paths.star} style="fill"><FoilGradient start={start} end={end} width={width} /></Path> : null}
                {paths.door ? <Path path={paths.door} style="fill" color={colors.background} /> : null}
              </Group>
              {titleFont && letters
                ? WORDMARK.split("").map((ch, i) => (
                    <SkiaText key={i} x={cx - letters.total / 2 + letters.xs[i]!} y={height * 0.74} text={ch} font={titleFont}>
                      <FoilGradient start={start} end={end} width={width} />
                    </SkiaText>
                  ))
                : null}
              {subFont && sub
                ? SUBTITLE.split("").map((ch, i) => (
                    <SkiaText key={i} x={cx - sub.total / 2 + sub.xs[i]!} y={height * 0.81} text={ch} font={subFont} color={colors.dimBrass} />
                  ))
                : null}
            </Canvas>
          </Pressable>
        </View>
      </GestureDetector>
      {showCounts ? <Counts counts={counts} /> : null}
    </View>
  );
}

function FoilGradient({ start, end }: { start: ReturnType<typeof useDerivedValue<ReturnType<typeof vec>>>; end: ReturnType<typeof useDerivedValue<ReturnType<typeof vec>>>; width: number }) {
  return <LinearGradient start={start} end={end} colors={[colors.dimBrass, colors.bookAccentSoft, colors.bookAccent, colors.bookAccentSoft, colors.dimBrass]} positions={[0, 0.28, 0.5, 0.72, 1]} />;
}

export function Counts({ counts }: { counts: CoverCounts }) {
  const items: [string, number][] = [["STAMPS", counts.stamps], ["PLACES", counts.places]];
  return (
    <View style={styles.counts} accessible accessibilityLabel={`${counts.stamps} stamps, ${counts.places} places`}>
      {items.map(([label, n]) => (
        <View key={label} testID={`passport-count-${label}`} style={styles.count}>
          <Text variant="title" color="bookAccent" tabular accessibilityElementsHidden>
            {n}
          </Text>
          <Text variant="typewriterSmall" color="dimBrass" align="center" numberOfLines={1} adjustsFontSizeToFit style={styles.countLabel} accessibilityElementsHidden>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: space.xl },
  shadowShell: { backgroundColor: colors.surface, ...shadows.book },
  bookClip: { overflow: "hidden", backgroundColor: colors.surface },
  counts: { alignSelf: "stretch", flexDirection: "row", justifyContent: "center", gap: space.sm, paddingHorizontal: space.xs },
  countLabel: { alignSelf: "stretch" },
  count: { flex: 1, minWidth: 0, alignItems: "center", gap: space.xxs },
});