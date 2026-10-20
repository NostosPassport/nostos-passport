"use client";
import React, { useId } from "react";
import type { CategoryStampArtwork } from "@/lib/category-stamp-artwork";
import { categoryStampDateLabel, safeStampPhotoUrl } from "@/lib/category-stamp-artwork";
import { MASK_ERASE, MASK_KEEP, type StampDesignInput, buildStampScene, designFromArtwork } from "@/lib/category-stamp-design";

/** Five small petals around a centre: the mark in the top corner of the rectangular templates. */
const PETALS = [0, 72, 144, 216, 288];

type Common = {
  visitedAt: string;
  photoUrl?: string | null;
  /** Keeps the torn photo edge and ink specks stable for a place. Defaults to the name. */
  seed?: string;
  /** Development preview only: a browser-local blob or a dev fixture path. Never set on public pages. */
  localPreviewPhotoUrl?: string | null;
};
type Props = Common & (
  | { artwork: CategoryStampArtwork; name: string; locality: string; timeZone?: string | null; design?: undefined }
  | { design: StampDesignInput; artwork?: undefined }
);

/**
 * Category stamp, web. Every position, size and string comes from buildStampScene (shared with Expo); this component only
 * turns that scene into SVG elements. The frame, photo window and interior stay transparent.
 */
export function CategoryStampSvg(props: Props) {
  const uid = "nst-" + useId().replace(/[^a-zA-Z0-9_-]/g, "_");
  const design = props.design ?? designFromArtwork(props.artwork, { name: props.name, locality: props.locality, timeZone: props.timeZone });
  const date = categoryStampDateLabel(props.visitedAt, design.timeZone);
  const scene = buildStampScene(design, { seed: props.seed ?? design.name, dateLabel: date });
  const ink = design.color;
  const local = props.localPreviewPhotoUrl;
  const dev = process.env.NODE_ENV === "development" && local && (local.startsWith("blob:") || local.startsWith("/dev/stamp-templates/photo/")) ? local : null;
  const photo = dev ?? safeStampPhotoUrl(props.photoUrl);
  const font = "var(--font-stamp-serif), 'Source Serif 4', Georgia, serif";
  const p = scene.photo, i = scene.icon;
  return <svg width="100%" height="100%" viewBox={`0 0 ${scene.width} ${scene.height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={scene.a11yLabel}>
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
    {scene.mark ? <g fill={ink}>{PETALS.map((a) => <circle key={a} cx={scene.mark!.cx + Math.sin((a * Math.PI) / 180) * scene.mark!.r * 0.62} cy={scene.mark!.cy - Math.cos((a * Math.PI) / 180) * scene.mark!.r * 0.62} r={scene.mark!.r * 0.42} />)}</g> : null}
  </svg>;
}
