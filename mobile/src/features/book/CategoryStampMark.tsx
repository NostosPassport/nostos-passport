import { useId } from "react";
import Svg, { Circle, ClipPath, Defs, G, Image as SvgImage, Path, Rect, Text as SvgText } from "react-native-svg";

import { type CategoryStampArtwork, CUISINE_PATHS, layoutCategoryName, photoClipPath, safeStampPhotoUrl } from "../../../../shared/category-stamp-artwork";

function dateLabel(value: string | null | undefined) {
  if (!value || Number.isNaN(Date.parse(value))) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" }).format(new Date(value)).toUpperCase();
}

/** Same view-boxes, frame paths, name layout and icon paths as the public web SVG renderer. */
export function CategoryStampMark({ artwork, name, locality, visitedAt, photoUri, size }: {
  artwork: CategoryStampArtwork; name: string; locality: string; visitedAt?: string | null; photoUri?: string | null; size: number;
}) {
  const id = "nst-" + useId().replace(/[^a-zA-Z0-9_-]/g, "_");
  const circle = artwork.kind === "bar";
  const photo = circle ? { x: 43, y: 54, s: 74 } : { x: 18, y: 28, s: 98 };
  const title = layoutCategoryName(name, artwork.kind);
  const url = safeStampPhotoUrl(photoUri);
  const ink = artwork.color;
  const date = dateLabel(visitedAt);
  const clip = photoClipPath(photo.x, photo.y, photo.s);
  return (
    <Svg width={size} height={size} viewBox={circle ? "0 0 160 160" : "0 0 260 154"} preserveAspectRatio="xMidYMid meet" accessible accessibilityLabel={`${name}, ${artwork.label}, ${locality}, ${date}`}>
      <Defs><ClipPath id={id}><Path d={clip} /></ClipPath></Defs>
      {circle ? <>
        <Circle cx={80} cy={80} r={76} fill="#FFFFFF" stroke={ink} strokeWidth={2.8} />
        <Circle cx={80} cy={80} r={70} fill="none" stroke={ink} strokeWidth={0.9} />
      </> : <>
        <Rect x={3} y={3} width={254} height={148} rx={23} fill="#FFFFFF" stroke={ink} strokeWidth={2.8} />
        <Rect x={9} y={9} width={242} height={136} rx={17} fill="none" stroke={ink} strokeWidth={0.9} />
      </>}
      <Path d={clip} fill="#F3F4F2" stroke={ink} strokeOpacity={0.5} strokeWidth={0.7} />
      {url ? <SvgImage href={{ uri: url }} x={photo.x} y={photo.y} width={photo.s} height={photo.s} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id})`} /> : null}
      {circle ? <>
        {title.lines.map((line, i) => <SvgText key={i} x={80} y={title.lines.length === 1 ? 40 : 26 + i * 14} textAnchor="middle" fill={ink} fontSize={title.fontSize} fontWeight="700">{line}</SvgText>)}
        <G transform="translate(122 43)"><Path d={CUISINE_PATHS[artwork.icon]} fill="none" stroke={ink} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></G>
        <SvgText x={80} y={138} textAnchor="middle" fontSize={9} fill={ink} fontWeight="700">{locality.slice(0, 27)}</SvgText>
        <SvgText x={80} y={148} textAnchor="middle" fontSize={7.8} fill={ink}>{date}</SvgText>
      </> : <>
        {title.lines.map((line,i) => <SvgText key={i} x={128} y={41 + i * 19} fill={ink} fontWeight="700" fontSize={title.fontSize}>{line}</SvgText>)}
        <G transform="translate(128 90)"><Path d={CUISINE_PATHS[artwork.icon]} fill="none" stroke={ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></G>
        <SvgText x={158} y={107} fontWeight="700" fill={ink} fontSize={10}>{artwork.label.slice(0, 17)}</SvgText>
        <SvgText x={128} y={126} fill={ink} fontSize={9}>{locality.slice(0, 23)}</SvgText>
        <SvgText x={128} y={139} fill={ink} fontSize={8}>{date}</SvgText>
      </>}
    </Svg>
  );
}
