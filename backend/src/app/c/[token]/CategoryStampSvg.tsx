"use client";
import { useId } from "react";
import { type CategoryStampArtwork, CATEGORY_STAMP_GEOMETRY, CUISINE_PATHS, categoryStampDateLabel, inkTextWidth, layoutCategoryName, needsUnicodeFont, photoClipPath, safeStampPhotoUrl } from "@/lib/category-stamp-artwork";
function bounded(value: string, size: number, width: number) {
  const source = value.trim().toUpperCase(); let output = "";
  for (const ch of Array.from(source)) {
    if (inkTextWidth(output + ch, size) > width) return output.trimEnd() + "…";
    output += ch;
  }
  return output;
}
/** Native and web share dimensions, names, photo cutout, categories and ink positions. */
export function CategoryStampSvg({ artwork, name, locality, visitedAt, timeZone, photoUrl, localPreviewPhotoUrl }: {
  artwork: CategoryStampArtwork; name: string; locality: string; visitedAt: string; timeZone?: string | null; photoUrl?: string | null;
  /** Only for the dev preview's own locally selected File object URL. Never set on public collection pages. */
  localPreviewPhotoUrl?: string | null;
}) {
  const id = "nst-" + useId().replace(/[^a-zA-Z0-9_-]/g, "_");
  const bar = artwork.kind === "bar", g = bar ? CATEGORY_STAMP_GEOMETRY.bar : CATEGORY_STAMP_GEOMETRY.restaurant;
  const p = g.photo, clip = photoClipPath(p.x,p.y,p.s);
  const title = layoutCategoryName(name, artwork.kind);
  const ink = artwork.color, date = categoryStampDateLabel(visitedAt, timeZone ?? undefined);
  const photo = (process.env.NODE_ENV === "development" && localPreviewPhotoUrl?.startsWith("blob:") ? localPreviewPhotoUrl : null) ?? safeStampPhotoUrl(photoUrl);
  const serif = needsUnicodeFont(name) ? "system-ui, sans-serif" : "'Cormorant Garamond', Georgia, serif";
  const barLocal = bounded(locality,7.2,44);
  const restaurantLocal = bounded(locality,9.1,100);
  return <svg width="100%" height="100%" viewBox={g.viewBox} preserveAspectRatio="xMidYMid meet"
    role="img" aria-label={[name,artwork.label,locality,date].filter(Boolean).join(", ")}>
    <defs><clipPath id={id}><path d={clip}/></clipPath></defs>
    {bar ? <>
      <circle cx="80" cy="80" r="76" fill="none" stroke={ink} strokeWidth="2.8" />
      <circle cx="80" cy="80" r="71" fill="none" stroke={ink} strokeWidth="1.05" />
    </> : <>
      <rect x="3" y="3" width="254" height="148" rx="22" fill="none" stroke={ink} strokeWidth="2.8" />
      <rect x="9" y="9" width="242" height="136" rx="17" fill="none" stroke={ink} strokeWidth="1.05" />
    </>}
    {photo ? <image href={photo} x={p.x} y={p.y} width={p.s} height={p.s} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id})`}/> : <path d={clip} fill="none" stroke={ink} strokeWidth="0.6" strokeDasharray="2 3" strokeOpacity="0.5"/>}
    {bar ? <>
      {title.lines.map((line,i)=><text key={i} x="80" y={title.lines.length===1?32:23+i*15}
        textAnchor="middle" fontFamily={serif} fontSize={title.fontSize} fontWeight="600" fill={ink}>{line}</text>)}
      <path transform={`translate(${g.iconX} ${g.iconY})`} d={CUISINE_PATHS[artwork.icon]} fill="none" stroke={ink} strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="80" y={g.dateY} textAnchor="middle" fontFamily={serif} fontSize="9.4" fontWeight="600" fill={ink}>{date}</text>
      <text x="80" y={CATEGORY_STAMP_GEOMETRY.bar.categoryY} textAnchor="middle" fontFamily={serif} fontSize="8.7" letterSpacing="0.3" fill={ink}>{artwork.cuisine==="nightclub"?"NIGHTCLUB":"BAR / CLUB"}</text>
      <text x="80" y={g.localityY} textAnchor="middle" fontFamily={serif} fontSize="7.4" letterSpacing="0.1" fill={ink}>{barLocal}</text>
    </> : <>
      {title.lines.map((line,i)=><text key={i} x={CATEGORY_STAMP_GEOMETRY.restaurant.titleCenterX} y={title.lines.length===1?52:title.lines.length===2?[43,64][i]:[34,51,68][i]}
        textAnchor="middle" fontFamily={serif} fontSize={title.fontSize} fontWeight="600" fill={ink}>{line}</text>)}
      <path transform={`translate(${g.iconX} ${g.iconY})`} d={CUISINE_PATHS[artwork.icon]} fill="none" stroke={ink} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"/>
      <text x={CATEGORY_STAMP_GEOMETRY.restaurant.captionX} y={CATEGORY_STAMP_GEOMETRY.restaurant.cuisineY} textAnchor="middle" fontFamily={serif} fontSize="10" letterSpacing="0.8" fontWeight="600" fill={ink}>{artwork.label}</text>
      <text x={CATEGORY_STAMP_GEOMETRY.restaurant.captionX} y={g.localityY} textAnchor="middle" fontFamily={serif} fontSize="9.2" fill={ink}>{restaurantLocal}</text>
      <text x={CATEGORY_STAMP_GEOMETRY.restaurant.captionX} y={g.dateY} textAnchor="middle" fontFamily={serif} fontSize="9.2" letterSpacing="0.35" fill={ink}>{date}</text>
    </>}
  </svg>;
}
