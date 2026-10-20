import Svg, { Circle, Defs, G, LinearGradient, Path, Stop, Text as SvgText, TextPath } from "react-native-svg";

import { colors, fonts, stampStyle } from "@/theme";
import type { CategoryStampArtwork } from "@/api/contracts";
import { mediaUrl } from "@/api";
import { safeStampPhotoUrl } from "../../../../shared/category-stamp-artwork";
import { CategoryStampMark } from "./CategoryStampMark";
import { STAMP_BOX, type StampDesign, type StampInput, completionDesign, motifPath, rayPath, ringsFor, shapePath, stampDesign } from "./stamp-design";

const MID = STAMP_BOX / 2;

/** A stamp inked on the page: brass, drawn from the place's design. The same place always looks the same. */
export function StampMark({ input, size, design, artwork, photoUrl, visitedAt }: { input: StampInput; size: number; design?: StampDesign; artwork?: CategoryStampArtwork | null; photoUrl?: string | null; visitedAt?: string | null }) {
  if (artwork && !design) {
    const photo = safeStampPhotoUrl(photoUrl) ? mediaUrl(photoUrl!) : null;
    return <CategoryStampMark artwork={artwork} name={input.placeName} locality={input.neighborhoodName} visitedAt={visitedAt} photoUri={photo} size={size} />;
  }
  const d = design ?? stampDesign(input);
  const arcId = `arc-${input.placeId}`;
  const rings = ringsFor(d.border, stampStyle.strokes);
  const textSize = stampStyle.text.name * d.nameScale;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${STAMP_BOX} ${STAMP_BOX}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <Path id={arcId} d={`M ${MID - 38} ${MID} A 38 38 0 0 1 ${MID + 38} ${MID}`} />
      </Defs>
      <G opacity={d.ink}>
        {rings.map((r, i) => (
          <Path
            key={i}
            d={shapePath(d.shape, r.inset)}
            fill="none"
            stroke={stampStyle.ink}
            strokeWidth={r.width}
            strokeDasharray={r.dash ?? undefined}
            strokeLinecap={r.round ? "round" : "butt"}
          />
        ))}
        <G transform={`translate(${MID} ${d.layout === "arc" ? MID + 4 : MID - 14})`}>
          <Path d={motifPath(d.motif, d.layout === "arc" ? 15 : 12)} fill={stampStyle.ink} />
        </G>
        {d.layout === "arc" ? (
          <SvgText fill={stampStyle.ink} fontFamily={fonts.serif} fontSize={textSize} letterSpacing={stampStyle.text.arcTrack}>
            <TextPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
              {d.arcText}
            </TextPath>
          </SvgText>
        ) : (
          d.lines.map((line, i) => (
            <SvgText key={i} x={MID} y={MID + 12 + i * (textSize + 3)} fill={stampStyle.ink} fontFamily={fonts.serif} fontSize={textSize} textAnchor="middle" letterSpacing={stampStyle.text.bannerTrack}>
              {line}
            </SvgText>
          ))
        )}
        <SvgText x={MID} y={d.layout === "arc" ? MID + 40 : MID + 12 + d.lines.length * (textSize + 3) + 3} fill={stampStyle.inkDim} fontFamily={fonts.mono} fontSize={stampStyle.text.area} textAnchor="middle">
          {d.area}
        </SvgText>
      </G>
      {d.speckles.map((s, i) => (
        <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={colors.surface} opacity={0.9} />
      ))}
    </Svg>
  );
}

/** The foil stamp for a finished neighborhood: a ring of rays around its name, in the cover's foil. */
export function CompletionStamp({ neighborhoodId, name, size }: { neighborhoodId: string; name: string; size: number }) {
  const d = completionDesign(neighborhoodId, name);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${STAMP_BOX} ${STAMP_BOX}`} accessible accessibilityLabel={`${name} complete`}>
      <Defs>
        <LinearGradient id={`foil-${neighborhoodId}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.dimBrass} />
          <Stop offset="0.35" stopColor={colors.brass} />
          <Stop offset="0.5" stopColor={colors.bone} />
          <Stop offset="0.65" stopColor={colors.brass} />
          <Stop offset="1" stopColor={colors.dimBrass} />
        </LinearGradient>
      </Defs>
      <G transform={`translate(${MID} ${MID})`}>
        <Path d={rayPath(d.rays, 47, 56)} stroke={`url(#foil-${neighborhoodId})`} strokeWidth={stampStyle.strokes.text} />
        <Circle r={44} fill="none" stroke={`url(#foil-${neighborhoodId})`} strokeWidth={stampStyle.strokes.ring} />
        <Circle r={38} fill="none" stroke={`url(#foil-${neighborhoodId})`} strokeWidth={stampStyle.strokes.hair} />
        <Path d={motifPath("star", 11)} transform="translate(0 -14)" fill={`url(#foil-${neighborhoodId})`} />
      </G>
      <SvgText x={MID} y={MID + 12} fill={`url(#foil-${neighborhoodId})`} fontFamily={fonts.serif} fontSize={stampStyle.text.completeWord} textAnchor="middle" letterSpacing={stampStyle.text.completeTrack}>
        {d.label}
      </SvgText>
      <SvgText x={MID} y={MID + 27} fill={colors.brass} fontFamily={fonts.mono} fontSize={stampStyle.text.completeArea} textAnchor="middle">
        {d.area}
      </SvgText>
    </Svg>
  );
}
