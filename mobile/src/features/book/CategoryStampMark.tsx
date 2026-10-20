import { useId } from "react";
import Svg, { Circle, ClipPath, Defs, G, Image as SvgImage, Mask, Path, Rect, Text as SvgText, TextPath } from "react-native-svg";
import type { CategoryStampArtwork } from "../../../../shared/category-stamp-artwork";
import { categoryStampDateLabel } from "../../../../shared/category-stamp-artwork";
import { MASK_ERASE, MASK_KEEP, type PriceTier, type StampDesignInput, buildStampScene, designFromArtwork, hasFallbackGlyphs } from "../../../../shared/category-stamp-design";

export const STAMP_SERIF = "SourceSerif4_600SemiBold";
const PETALS = [0, 72, 144, 216, 288];

type Props = {
  visitedAt?: string | null; photoUri?: string | null; seed?: string;
  /** Width of the stamp in points; the height follows the template. */
  size: number;
} & (
  | { artwork: CategoryStampArtwork & { priceTier?: PriceTier | null }; name: string; locality: string; timeZone?: string | null; design?: undefined }
  | { design: StampDesignInput; artwork?: undefined }
);

/**
 * Category stamp, native. Pure counterpart of the web CategoryStampSvg: both draw the scene from buildStampScene, so layout,
 * fit and strings cannot differ. The frame, photo window and interior are transparent.
 */
export function CategoryStampMark(props: Props) {
  const uid = "nst-" + useId().replace(/[^a-zA-Z0-9_-]/g, "_");
  const design = props.design ?? designFromArtwork(props.artwork, { name: props.name, locality: props.locality, timeZone: props.timeZone, priceTier: props.artwork.priceTier ?? null });
  const date = categoryStampDateLabel(props.visitedAt, design.timeZone);
  const scene = buildStampScene(design, { seed: props.seed ?? design.name, dateLabel: date });
  const ink = design.color, p = scene.photo, i = scene.icon;
  const height = (props.size * scene.height) / scene.width;
  const face = (text: string) => (hasFallbackGlyphs(text) ? undefined : STAMP_SERIF);
  return (
    <Svg width={props.size} height={height} viewBox={`0 0 ${scene.width} ${scene.height}`} preserveAspectRatio="xMidYMid meet" accessible accessibilityLabel={scene.a11yLabel}>
      <Defs>
        <ClipPath id={`${uid}-photo`}><Path d={p.clipD} /></ClipPath>
        <Mask id={`${uid}-ink`} maskUnits="userSpaceOnUse" x={0} y={0} width={scene.width} height={scene.height}>
          <Rect x={0} y={0} width={scene.width} height={scene.height} fill={MASK_KEEP} />
          {scene.specks.map((s, k) => <Circle key={k} cx={s.cx} cy={s.cy} r={s.r} fill={MASK_ERASE} />)}
        </Mask>
        {scene.arcs.map((a) => <Path key={a.id} id={`${uid}-${a.id}`} d={a.d} />)}
      </Defs>
      <G mask={`url(#${uid}-ink)`} fill="none" stroke={ink} strokeLinejoin="round">
        {scene.borders.map((b, k) => <Path key={k} d={b.d} strokeWidth={b.width} />)}
      </G>
      {props.photoUri
        ? <SvgImage href={{ uri: props.photoUri }} x={p.x - 2} y={p.y - 2} width={p.s + 4} height={p.s + 4} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${uid}-photo)`} />
        : <Path d={p.clipD} fill="none" stroke={ink} strokeWidth={1} strokeDasharray="3 4" strokeOpacity={0.55} />}
      {scene.texts.map((t, k) => (
        <SvgText key={k} x={t.x} y={t.y} fill={ink} fontFamily={face(t.text)} fontSize={t.size} letterSpacing={t.tracking || undefined} textAnchor={t.anchor} textLength={t.textLength} lengthAdjust={t.textLength ? "spacingAndGlyphs" : undefined}>{t.text}</SvgText>
      ))}
      {scene.arcs.map((a) => (
        <SvgText key={a.id} fill={ink} fontFamily={face(a.text)} fontSize={a.size} letterSpacing={a.tracking}>
          <TextPath href={`#${uid}-${a.id}`} startOffset={a.startOffset}>{a.text}</TextPath>
        </SvgText>
      ))}
      <G transform={`translate(${i.x} ${i.y}) rotate(${i.rotate} ${i.size / 2} ${i.size / 2}) scale(${i.size / 24})`}
        fill={i.fill ? ink : "none"} stroke={ink} strokeWidth={i.fill ? 0.6 : i.strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        <Path d={i.d} />
      </G>
      {scene.mark ? <G fill={ink}>{PETALS.map((a) => <Circle key={a} cx={scene.mark!.cx + Math.sin((a * Math.PI) / 180) * scene.mark!.r * 0.62} cy={scene.mark!.cy - Math.cos((a * Math.PI) / 180) * scene.mark!.r * 0.62} r={scene.mark!.r * 0.42} />)}</G> : null}
    </Svg>
  );
}
