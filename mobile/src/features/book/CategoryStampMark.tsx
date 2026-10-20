import { useId } from "react";
import Svg, { Circle, ClipPath, Defs, G, Image as SvgImage, Path, Rect, Text as SvgText } from "react-native-svg";
import { fonts } from "@/theme";
import { type CategoryStampArtwork, CATEGORY_STAMP_GEOMETRY, CUISINE_PATHS, categoryStampDateLabel, categoryNameLineWidth, fitCategoryLocality, layoutCategoryName, needsUnicodeFont, photoClipPath, safeStampPhotoUrl } from "../../../../shared/category-stamp-artwork";
/** Pure SVG native counterpart of the shared-web ink stamp, with transparent background. */
export function CategoryStampMark({ artwork, name, locality, visitedAt, timeZone, photoUri, size }: {
  artwork: CategoryStampArtwork; name: string; locality: string; visitedAt?: string | null; timeZone?: string | null; photoUri?: string | null; size: number;
}) {
  const id="nst-"+useId().replace(/[^a-zA-Z0-9_-]/g,"_");
  const bar=artwork.kind==="bar", g=bar?CATEGORY_STAMP_GEOMETRY.bar:CATEGORY_STAMP_GEOMETRY.restaurant;
  const p=g.photo, clip=photoClipPath(p.x,p.y,p.s);
  const title=layoutCategoryName(name,artwork.kind);
  const photo=safeStampPhotoUrl(photoUri), ink=artwork.color, date=categoryStampDateLabel(visitedAt, timeZone ?? undefined);
  const serif=needsUnicodeFont(name)?undefined:fonts.serif;
  const fittedLocality=fitCategoryLocality(locality,artwork.kind);
  return <Svg width={size} height={size} viewBox={g.viewBox} preserveAspectRatio="xMidYMid meet"
    accessible accessibilityLabel={[name,artwork.label,locality,date].filter(Boolean).join(", ")}>
    <Defs><ClipPath id={id}><Path d={clip}/></ClipPath></Defs>
    {bar?<><Circle cx={80} cy={80} r={76} fill="none" stroke={ink} strokeWidth={2.8}/>
      <Circle cx={80} cy={80} r={71} fill="none" stroke={ink} strokeWidth={1.05}/></>:
      <><Rect x={3} y={3} width={254} height={148} rx={22} fill="none" stroke={ink} strokeWidth={2.8}/>
        <Rect x={9} y={9} width={242} height={136} rx={17} fill="none" stroke={ink} strokeWidth={1.05}/></>}
    {photo?<SvgImage href={{uri:photo}} x={p.x} y={p.y} width={p.s} height={p.s} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id})`}/>:
      <Path d={clip} fill="none" stroke={ink} strokeWidth={0.6} strokeDasharray="2 3" strokeOpacity={0.5}/>}
    {bar?<>{title.lines.map((line,i)=><SvgText key={i} x={80} y={title.lines.length===1?28:25+i*12}
      textAnchor="middle" fontFamily={serif} fontSize={title.fontSize} textLength={categoryNameLineWidth(line,"bar",title.fontSize,i,title.lines.length)} lengthAdjust="spacingAndGlyphs" fill={ink}>{line}</SvgText>)}
      <G transform={`translate(${g.iconX} ${g.iconY})`}><Path d={CUISINE_PATHS[artwork.icon]} fill="none" stroke={ink} strokeWidth={1.55} strokeLinecap="round" strokeLinejoin="round"/></G>
      <SvgText x={80} y={g.dateY} textAnchor="middle" fontFamily={fonts.serif} fontSize={9.8} fill={ink}>{date}</SvgText>
      <SvgText x={80} y={CATEGORY_STAMP_GEOMETRY.bar.categoryY} textAnchor="middle" fontFamily={fonts.serif} fontSize={8.8} letterSpacing={0.3} fill={ink}>{artwork.cuisine==="nightclub"?"NIGHTCLUB":"BAR / CLUB"}</SvgText>
      <SvgText x={80} y={g.localityY} textAnchor="middle" fontFamily={fonts.serif} fontSize={fittedLocality.fontSize} letterSpacing={0.1} textLength={fittedLocality.width||undefined} lengthAdjust="spacingAndGlyphs" fill={ink}>{fittedLocality.text}</SvgText>
    </>:<>{title.lines.map((line,i)=><SvgText key={i} x={CATEGORY_STAMP_GEOMETRY.restaurant.titleCenterX} y={title.lines.length===1?52:title.lines.length===2?[43,64][i]:[34,51,68][i]}
      textAnchor="middle" fontFamily={serif} fontSize={title.fontSize} textLength={categoryNameLineWidth(line,"restaurant",title.fontSize,i,title.lines.length)} lengthAdjust="spacingAndGlyphs" fill={ink}>{line}</SvgText>)}
      <G transform={`translate(${g.iconX} ${g.iconY})`}><Path d={CUISINE_PATHS[artwork.icon]} fill="none" stroke={ink} strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round"/></G>
      <SvgText x={CATEGORY_STAMP_GEOMETRY.restaurant.captionX} y={CATEGORY_STAMP_GEOMETRY.restaurant.cuisineY} textAnchor="middle" fontFamily={fonts.serif} fontSize={10.5} letterSpacing={0.65} fill={ink}>{artwork.label}</SvgText>
      <SvgText x={CATEGORY_STAMP_GEOMETRY.restaurant.captionX} y={g.localityY} textAnchor="middle" fontFamily={fonts.serif} fontSize={fittedLocality.fontSize} letterSpacing={0.1} textLength={fittedLocality.width||undefined} lengthAdjust="spacingAndGlyphs" fill={ink}>{fittedLocality.text}</SvgText>
      <SvgText x={CATEGORY_STAMP_GEOMETRY.restaurant.captionX} y={g.dateY} textAnchor="middle" fontFamily={fonts.serif} fontSize={10.6} letterSpacing={0.2} fill={ink}>{date}</SvgText>
    </>}
  </Svg>;
}
