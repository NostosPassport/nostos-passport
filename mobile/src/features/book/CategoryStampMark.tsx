import { useId } from "react";
import { fonts } from "@/theme";
import Svg, { Circle, ClipPath, Defs, G, Image as SvgImage, Path, Rect, Text as SvgText, TextPath } from "react-native-svg";

import { type CategoryStampArtwork, CATEGORY_STAMP_GEOMETRY, CUISINE_PATHS, categoryStampDateLabel, layoutCategoryName, photoClipPath, safeStampPhotoUrl } from "../../../../shared/category-stamp-artwork";

/** Same view-boxes, frame paths, name layout and icon paths as the public web SVG renderer. */
export function CategoryStampMark({ artwork, name, locality, visitedAt, photoUri, size }: {
  artwork: CategoryStampArtwork; name: string; locality: string; visitedAt?: string | null; photoUri?: string | null; size: number;
}) {
  const id = "nst-" + useId().replace(/[^a-zA-Z0-9_-]/g, "_");
  const circle = artwork.kind === "bar";
  const g = circle ? CATEGORY_STAMP_GEOMETRY.bar : CATEGORY_STAMP_GEOMETRY.restaurant;
  const photo = g.photo;
  const arcId = id + "-title-arc";
  const title = layoutCategoryName(name, artwork.kind);
  const url = safeStampPhotoUrl(photoUri);
  const ink = artwork.color;
  const date = categoryStampDateLabel(visitedAt);
  const local = locality.trim().toUpperCase();
  const arcName = circle && title.lines.length === 1 && Array.from(title.lines[0] ?? "").length <= 19;
  const clip = photoClipPath(photo.x, photo.y, photo.s);
  return (
    <Svg width={size} height={size} viewBox={g.viewBox} preserveAspectRatio="xMidYMid meet" accessible accessibilityLabel={`${name}, ${artwork.label}, ${locality}, ${date}`}>
      <Defs><ClipPath id={id}><Path d={clip} /></ClipPath>{circle ? <Path id={arcId} d={CATEGORY_STAMP_GEOMETRY.bar.titleArc} /> : null}</Defs>
      {circle ? <>
        <Circle cx={80} cy={80} r={76} fill="#FFFFFF" stroke={ink} strokeWidth={2.8} />
        <Circle cx={80} cy={80} r={71} fill="none" stroke={ink} strokeWidth={1.05} />
      </> : <>
        <Rect x={3} y={3} width={254} height={148} rx={22} fill="#FFFFFF" stroke={ink} strokeWidth={2.8} />
        <Rect x={9} y={9} width={242} height={136} rx={17} fill="none" stroke={ink} strokeWidth={0.9} />
      </>}
      <Path d={clip} fill="#F7F7F5" stroke={ink} strokeOpacity={0.2} strokeWidth={0.55} />
      {url ? <SvgImage href={{ uri: url }} x={photo.x} y={photo.y} width={photo.s} height={photo.s} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id})`} /> : null}
      {circle ? <>
        {arcName ? <SvgText fill={ink} fontFamily={fonts.serif} fontSize={CATEGORY_STAMP_GEOMETRY.bar.titleArcSize} letterSpacing={1.1}><TextPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">{title.lines[0]}</TextPath></SvgText> : title.lines.map((line, i) => <SvgText key={i} x={80} y={title.lines.length === 1 ? 32 : 23 + i * 17} textAnchor="middle" fill={ink} fontFamily={fonts.serif} fontSize={Math.min(12, title.fontSize)}>{line}</SvgText>)}
        <G transform={`translate(${CATEGORY_STAMP_GEOMETRY.bar.iconX} ${CATEGORY_STAMP_GEOMETRY.bar.iconY})`}><Path d={CUISINE_PATHS[artwork.icon]} fill="none" stroke={ink} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></G>
        <SvgText x={80} y={CATEGORY_STAMP_GEOMETRY.bar.localityY} textAnchor="middle" fontSize={9} fill={ink} fontWeight="700">{`${artwork.cuisine === "nightclub" ? "NIGHTCLUB" : "BAR / CLUB"} · ${local}`.slice(0, 30)}</SvgText>
        <SvgText x={80} y={CATEGORY_STAMP_GEOMETRY.bar.dateY} textAnchor="middle" fontSize={7.8} fill={ink}>{date}</SvgText>
      </> : <>
        {title.lines.map((line,i) => <SvgText key={i} x={CATEGORY_STAMP_GEOMETRY.restaurant.titleCenterX} y={title.lines.length === 1 ? 56 : title.lines.length === 2 ? CATEGORY_STAMP_GEOMETRY.restaurant.titleBaselines.two[i] : CATEGORY_STAMP_GEOMETRY.restaurant.titleBaselines.three[i]} textAnchor="middle" fill={ink} fontFamily={fonts.serif} fontSize={title.fontSize + 1}>{line}</SvgText>)}
        <G transform={`translate(${CATEGORY_STAMP_GEOMETRY.restaurant.iconX} ${CATEGORY_STAMP_GEOMETRY.restaurant.iconY})`}><Path d={CUISINE_PATHS[artwork.icon]} fill="none" stroke={ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></G>
        <SvgText x={CATEGORY_STAMP_GEOMETRY.restaurant.captionX} y={CATEGORY_STAMP_GEOMETRY.restaurant.cuisineY} textAnchor="middle" fontWeight="700" fill={ink} fontSize={10}>{artwork.label.slice(0, 17)}</SvgText>
        <SvgText x={CATEGORY_STAMP_GEOMETRY.restaurant.captionX} y={CATEGORY_STAMP_GEOMETRY.restaurant.localityY} textAnchor="middle" fill={ink} fontSize={9}>{local.slice(0, 22)}</SvgText>
        <SvgText x={CATEGORY_STAMP_GEOMETRY.restaurant.captionX} y={CATEGORY_STAMP_GEOMETRY.restaurant.dateY} textAnchor="middle" fill={ink} fontSize={8}>{date}</SvgText>
      </>}
    </Svg>
  );
}
