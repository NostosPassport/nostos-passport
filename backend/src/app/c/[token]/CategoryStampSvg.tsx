"use client";
import React, { useId } from "react";
import type { CategoryStampArtwork } from "@/lib/category-stamp-artwork";
import { categoryStampDateLabel, safeStampPhotoUrl } from "@/lib/category-stamp-artwork";
import { MASK_ERASE, MASK_KEEP, type PriceTier, type StampDesignInput, buildStampScene, designFromArtwork } from "@/lib/category-stamp-design";
import { michelinMarkCenters, michelinStarPath, michelinStarStrokeWidth, type MichelinStars } from "@/lib/michelin-stamp";

type Common = {
  visitedAt: string;
  photoUrl?: string | null;
  seed?: string;
  localPreviewPhotoUrl?: string | null;
};
type Props = Common & (
  | { artwork: CategoryStampArtwork & { priceTier?: PriceTier | null; michelinStars?: number | null }; name: string; locality: string; timeZone?: string | null; design?: undefined }
  | { design: StampDesignInput; artwork?: undefined }
);

function validMichelinStars(value: number | null | undefined): MichelinStars | null {
  return value === 1 || value === 2 || value === 3 ? value : null;
}

export function CategoryStampSvg(props: Props) {
  const uid = "nst-" + useId().replace(/[^a-zA-Z0-9_-]/g, "_");
  const design = props.design ?? designFromArtwork(props.artwork, { name: props.name, locality: props.locality, timeZone: props.timeZone, priceTier: props.artwork.priceTier ?? null });
  const date = categoryStampDateLabel(props.visitedAt, design.timeZone);
  const scene = buildStampScene(design, { seed: props.seed ?? design.name, dateLabel: date });
  const ink = design.color;
  const local = props.localPreviewPhotoUrl;
  const dev = process.env.NODE_ENV === "development" && local && (local.startsWith("blob:") || local.startsWith("/dev/stamp-templates/photo/")) ? local : null;
  const photo = dev ?? safeStampPhotoUrl(props.photoUrl);
  const font = "var(--font-stamp-serif), 'Source Serif 4', Georgia, serif";
  const p = scene.photo, i = scene.icon;
  const michelinStars = validMichelinStars(props.artwork?.michelinStars);
  const michelinMarks = scene.mark && michelinStars ? michelinMarkCenters(scene.mark, michelinStars) : [];
  const accessibilityLabel = michelinStars ? `${scene.a11yLabel}, ${michelinStars} Michelin star${michelinStars === 1 ? "" : "s"}` : scene.a11yLabel;
  return <svg width="100%" height="100%" viewBox={`0 0 ${scene.width} ${scene.height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={accessibilityLabel}>
    <defs>
      <clipPath id={`${uid}-photo`}><path d={p.clipD} /></clipPath>
      <mask id={`${uid}-ink`} maskUnits="userSpaceOnUse" x="0" y="0" width={scene.width} height={scene.height}>
        <rect x="0" y="0" width={scene.width} height={scene.height} fill={MASK_KEEP} />
        {scene.specks.map((s, k) => <circle key={k} cx={s.cx} cy={s.cy} r={s.r} fill={MASK_ERASE} />)}
      </mask>
      {scene.arcs.map((a) => <path key={a.id} id={`${uid}-${a.id}`} d={a.d} />)}
    </defs>
    <g mask={`url(#${uid}-ink)`} fill="none" stroke={ink} strokeLinejoin="round">
      {scene.borders.map((b, k) => <path key={k} d={b.d} strokeWidth={b.width} />)}
    </g>
    {photo
      ? <image href={photo} x={p.x - 2} y={p.y - 2} width={p.s + 4} height={p.s + 4} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${uid}-photo)`} />
      : <path d={p.clipD} fill="none" stroke={ink} strokeWidth="1" strokeDasharray="3 4" strokeOpacity="0.55" />}
    <g fill={ink} fontFamily={font} fontWeight="600">
      {scene.texts.map((t, k) => <text key={k} x={t.x} y={t.y} textAnchor={t.anchor} fontSize={t.size} letterSpacing={t.tracking || undefined} textLength={t.textLength} lengthAdjust={t.textLength ? "spacingAndGlyphs" : undefined}>{t.text}</text>)}
      {scene.arcs.map((a) => <text key={a.id} fontSize={a.size} letterSpacing={a.tracking} textLength={a.textLength} lengthAdjust={a.textLength ? "spacingAndGlyphs" : undefined}><textPath href={`#${uid}-${a.id}`} startOffset={a.startOffset}>{a.text}</textPath></text>)}
    </g>
    <g transform={`translate(${i.x} ${i.y}) rotate(${i.rotate} ${i.size / 2} ${i.size / 2}) scale(${i.size / 24})`}
      fill={i.fill ? ink : "none"} stroke={ink} strokeWidth={i.fill ? 0.6 : i.strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d={i.d} />
    </g>
    {michelinMarks.map((mark, index) => <path key={index} d={michelinStarPath(mark)} fill="none" stroke={ink} strokeWidth={michelinStarStrokeWidth(mark)} strokeLinecap="round" strokeLinejoin="round" />)}
  </svg>;
}
