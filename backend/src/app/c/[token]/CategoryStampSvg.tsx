"use client";
import { useId } from "react";
import { type CategoryStampArtwork, CUISINE_PATHS, layoutCategoryName, photoClipPath, safeStampPhotoUrl } from "@/lib/category-stamp-artwork";

function dateLabel(value:string) {
  if (!value || Number.isNaN(Date.parse(value))) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone:"America/New_York", month:"short", day:"numeric", year:"numeric" }).format(new Date(value)).toUpperCase();
}
/** Production web path: all geometry and category logic come from the same shared module as native. */
export function CategoryStampSvg({ artwork, name, locality, visitedAt, photoUrl }: {
  artwork:CategoryStampArtwork; name:string; locality:string; visitedAt:string; photoUrl?:string|null;
}) {
  const id="nst-"+useId().replace(/[^a-zA-Z0-9_-]/g,"_");
  const circle=artwork.kind==="bar";
  const p=circle?{x:43,y:54,s:74}:{x:18,y:28,s:98};
  const clip=photoClipPath(p.x,p.y,p.s);
  const title=layoutCategoryName(name,artwork.kind);
  const ink=artwork.color;
  const photo=safeStampPhotoUrl(photoUrl);
  const date=dateLabel(visitedAt);
  return <svg width="100%" height="100%" viewBox={circle?"0 0 160 160":"0 0 260 154"} preserveAspectRatio="xMidYMid meet" role="img" aria-label={[name,artwork.label,locality,date].filter(Boolean).join(", ")}>
    <defs><clipPath id={id}><path d={clip}/></clipPath></defs>
    {circle?<><circle cx="80" cy="80" r="76" stroke={ink} strokeWidth="2.8" fill="#fff"/><circle cx="80" cy="80" r="70" fill="none" stroke={ink} strokeWidth="0.9"/></>:<><rect x="3" y="3" width="254" height="148" rx="23" fill="#fff" stroke={ink} strokeWidth="2.8"/><rect x="9" y="9" width="242" height="136" rx="17" fill="none" stroke={ink} strokeWidth="0.9"/></>}
    <path d={clip} fill="#F3F4F2" stroke={ink} strokeOpacity="0.5" strokeWidth="0.7"/>
    {photo?<image href={photo} x={p.x} y={p.y} width={p.s} height={p.s} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id})`}/>:null}
    {circle?<>
      {title.lines.map((line,i)=><text key={i} x="80" y={title.lines.length===1?40:26+i*14} textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize={title.fontSize} fontWeight="700" fill={ink}>{line}</text>)}
      <path transform="translate(122 43)" d={CUISINE_PATHS[artwork.icon]} fill="none" stroke={ink} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="80" y="138" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="9" fontWeight="700" fill={ink}>{locality.slice(0,27)}</text>
      <text x="80" y="148" textAnchor="middle" fontSize="7.8" fill={ink}>{date}</text>
    </>:<>
      {title.lines.map((line,i)=><text key={i} x="128" y={41+i*19} fill={ink} fontFamily="system-ui, sans-serif" fontSize={title.fontSize} fontWeight="700">{line}</text>)}
      <path transform="translate(128 90)" d={CUISINE_PATHS[artwork.icon]} fill="none" stroke={ink} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="158" y="107" fill={ink} fontFamily="system-ui, sans-serif" fontSize="10" fontWeight="700">{artwork.label.slice(0,17)}</text>
      <text x="128" y="126" fill={ink} fontSize="9">{locality.slice(0,23)}</text>
      <text x="128" y="139" fill={ink} fontSize="8">{date}</text>
    </>}
  </svg>;
}
