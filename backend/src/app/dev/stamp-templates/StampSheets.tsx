"use client";
import { CategoryStampSvg } from "@/app/c/[token]/CategoryStampSvg";
import type { StampTemplate } from "@/lib/category-stamp-design";
import { stampSheetCases, type SheetCase } from "@/lib/category-stamp-sheets";

const PAPER = "#F7F4EE";
const photoUrl = (name: string | null) => (name ? `/dev/stamp-templates/photo/${name}` : null);
const BOX: Record<StampTemplate, { w: number; h: number }> = { restaurant: { w: 560, h: 322 }, airport: { w: 560, h: 322 }, hotel: { w: 520, h: 355 }, bar: { w: 420, h: 420 } };

function Cell({ c, scale = 1 }: { c: SheetCase; scale?: number }) {
  const b = BOX[c.design.template];
  return <figure style={{ margin: 0, textAlign: "center" }}>
    <div style={{ width: b.w * scale, height: b.h * scale, margin: "0 auto" }}>
      <CategoryStampSvg design={c.design} visitedAt={c.visitedAt} localPreviewPhotoUrl={photoUrl(c.photo)} seed={c.seed} />
    </div>
    {c.caption ? <figcaption style={{ font: "12px system-ui", color: "#555", marginTop: 6 }}>{c.caption}</figcaption> : null}
  </figure>;
}

/** Screenshot sheets for docs/reference/renders. `?sheet=reference|edge|phone|ink`. */
export function StampSheets({ sheet, bg }: { sheet: string; bg: string }) {
  const cases = stampSheetCases(sheet);
  const cols = sheet === "reference" ? 2 : sheet === "phone" ? 2 : 4;
  const scale = sheet === "phone" ? 0.62 : sheet === "long" || sheet === "photos" ? 0.4 : 1;
  return <main style={{ minHeight: "100vh", padding: sheet === "reference" ? "36px 40px" : 24, background: bg || PAPER }}>
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, auto)`, gap: sheet === "reference" ? "34px 40px" : "22px 28px", justifyContent: "center", alignItems: "center" }}>
      {cases.map((c, k) => <Cell key={k} c={c} scale={scale} />)}
    </div>
  </main>;
}

