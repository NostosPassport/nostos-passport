import Svg, { Circle, Defs, G, Path, Text as SvgText, TextPath } from "react-native-svg";

import { colors, fonts, stampStyle } from "@/theme";
import type { CategoryStampArtwork } from "@/api/contracts";
import { mediaUrl } from "@/api";
import { safeStampPhotoUrl } from "../../../../shared/category-stamp-artwork";
import { CategoryStampMark } from "./CategoryStampMark";
import { STAMP_BOX, type StampDesign, type StampInput, motifPath, ringsFor, shapePath, stampDesign } from "./stamp-design";

const MID = STAMP_BOX / 2;

/** A stamp inked on the page: brass, drawn from the place's design. The same place always looks the same. */
export function StampMark({ input, size, design, artwork, photoUrl, visitedAt, timeZone }: { input: StampInput; size: number; design?: StampDesign; artwork?: CategoryStampArtwork | null; photoUrl?: string | null; visitedAt?: string | null; timeZone?: string | null }) {
  if (artwork && !design) {
    const photo = safeStampPhotoUrl(photoUrl) ? mediaUrl(photoUrl!) : null;
    return <CategoryStampMark artwork={artwork} name={input.placeName} locality={input.localityName} visitedAt={visitedAt} timeZone={timeZone} photoUri={photo} size={size} seed={input.placeId} />;
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
