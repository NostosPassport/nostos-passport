"use client";
import { useId } from "react";
import { type CategoryStampArtwork, CATEGORY_STAMP_GEOMETRY, CUISINE_PATHS, categoryStampDateLabel, layoutCategoryName, photoClipPath, safeStampPhotoUrl } from "@/lib/category-stamp-artwork";

/** Production web path: all geometry and category logic come from the same shared module as native. */
export function CategoryStampSvg({ artwork, name, locality, visitedAt, photoUrl }: {
  artwork:CategoryStampArtwork; name:string; locality:string; visitedAt:string; photoUrl?:string|null;
}) {
  const id="nst-"+useId().replace(/[^a-zA-Z0-9_-]/g,"_");
  const circle=artwork.kind==="bar";
  const g=circle?CATEGORY_STAMP_GEOMETRY.bar:CATEGORY_STAMP_GEOMETRY.restaurant;
  const p=g.photo;
  const arcId=id+"-title-arc";
  const clip=photoClipPath(p.x,p.y,p.s);
  const title=layoutCategoryName(name,artwork.kind);
  const ink=artwork.color;
  const photo=safeStampPhotoUrl(photoUrl);
  const date=categoryStampDateLabel(visitedAt);
  const local=locality.trim().toUpperCase();
  const arcName=circle&&title.lines.length===1&&Array.from(title.lines[0]??"").length<=19;
  return <svg width="100%" height="100%" viewBox={g.viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={[name,artwork.label,locality,date].filter(Boolean).join(", ")}>
    <defs><clipPath id={id}><path d={clip}/></clipPath>{circle?<path id={arcId} d={CATEGORY_STAMP_GEOMETRY.bar.titleArc}/>:null}</defs>
    {circle?<><circle cx="80" cy="80" r="76" stroke={ink} strokeWidth="2.8" fill="#fff"/><circle cx="80" cy="80" r="71" fill="none" stroke={ink} strokeWidth="1.05"/></>:<><rect x="3" y="3" width="254" height="148" rx="22" fill="#fff" stroke={ink} strokeWidth="2.8"/><rect x="9" y="9" width="242" height="136" rx="17" fill="none" stroke={ink} strokeWidth="0.9"/></>}
    <path d={clip} fill="#F3F4F2" stroke={ink} strokeOpacity="0.2" strokeWidth="0.55"/>
    {photo?<image href={photo} x={p.x} y={p.y} width={p.s} height={p.s} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id})`}/>:null}
    {circle?<>
      {arcName?<text fill={ink} fontFamily="Georgia, serif" fontSize={CATEGORY_STAMP_GEOMETRY.bar.titleArcSize} fontWeight="700" letterSpacing="1.1"><textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">{title.lines[0]}</textPath></text>:title.lines.map((line,i)=><text key={i} x="80" y={title.lines.length===1?32:23+i*17} textAnchor="middle" fontFamily="Georgia, serif" fontSize={Math.min(12,title.fontSize)} fontWeight="700" fill={ink}>{line}</text>)}
      <path transform={`translate(${CATEGORY_STAMP_GEOMETRY.bar.iconX} ${CATEGORY_STAMP_GEOMETRY.bar.iconY})`} d={CUISINE_PATHS[artwork.icon]} fill="none" stroke={ink} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="80" y={CATEGORY_STAMP_GEOMETRY.bar.localityY} textAnchor="middle" fontFamily="Georgia, serif" fontSize="9" fontWeight="700" fill={ink}>{`${artwork.cuisine==="nightclub"?"NIGHTCLUB":"BAR / CLUB"} · ${local}`.slice(0,30)}</text>
      <text x="80" y={CATEGORY_STAMP_GEOMETRY.bar.dateY} textAnchor="middle" fontSize="7.8" fill={ink}>{date}</text>
    </>:<>
      {title.lines.map((line,i)=><text key={i} x={CATEGORY_STAMP_GEOMETRY.restaurant.titleCenterX} y={title.lines.length===1?56:title.lines.length===2?CATEGORY_STAMP_GEOMETRY.restaurant.titleBaselines.two[i]:CATEGORY_STAMP_GEOMETRY.restaurant.titleBaselines.three[i]} fill={ink} textAnchor="middle" fontFamily="Georgia, serif" fontSize={title.fontSize+1} fontWeight="700">{line}</text>)}
      <path transform={`translate(${CATEGORY_STAMP_GEOMETRY.restaurant.iconX} ${CATEGORY_STAMP_GEOMETRY.restaurant.iconY})`} d={CUISINE_PATHS[artwork.icon]} fill="none" stroke={ink} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <text x={CATEGORY_STAMP_GEOMETRY.restaurant.captionX} y={CATEGORY_STAMP_GEOMETRY.restaurant.cuisineY} textAnchor="middle" fill={ink} fontFamily="Georgia, serif" fontSize="10" fontWeight="700">{artwork.label.slice(0,17)}</text>
      <text x={CATEGORY_STAMP_GEOMETRY.restaurant.captionX} y={CATEGORY_STAMP_GEOMETRY.restaurant.localityY} textAnchor="middle" fill={ink} fontSize="9">{local.slice(0,22)}</text>
      <text x={CATEGORY_STAMP_GEOMETRY.restaurant.captionX} y={CATEGORY_STAMP_GEOMETRY.restaurant.dateY} textAnchor="middle" fill={ink} fontSize="8">{date}</text>
    </>}
  </svg>;
}
