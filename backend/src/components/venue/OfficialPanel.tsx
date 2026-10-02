import { formatCents } from "@/lib/money";
import { DAY_NAMES, fmtRange, hoursTonight } from "@/lib/hours";
import type { VenuePage } from "@/server/services/venues";

/** Venue-controlled facts. Visually distinct (blue) from the user-controlled live panel. */
export function OfficialPanel({ page }: { page: VenuePage }) {
  const o = page.official;
  const tonight = hoursTonight(o.hours, page.now);
  const acc = o.accuracy;
  return (
    <section className="overflow-hidden rounded-3xl border border-venue/40 bg-panel" aria-labelledby="official-h">
      <header className="flex items-center justify-between border-b border-venue/30 bg-venue/10 px-4 py-2.5">
        <h3 id="official-h" className="text-sm font-semibold uppercase tracking-wider text-venue">Official · from the venue</h3>
        <span className="text-[11px] text-muted">Set by the venue</span>
      </header>

      {o.officialPhotoUrl && (
        <figure className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element -- served from our own upload route */}
          <img src={o.officialPhotoUrl} alt={`${o.name}, official photo`} className="h-48 w-full object-cover" />
          <figcaption className="absolute left-2 top-2 rounded-full bg-venue px-2 py-0.5 text-[11px] font-semibold text-ink">From the venue</figcaption>
        </figure>
      )}

      <dl className="grid grid-cols-2 gap-px bg-line text-sm">
        <Fact label="Tonight">{o.hours.length === 0 ? "Hours not posted" : tonight ? fmtRange(tonight) : "Closed tonight"}</Fact>
        <Fact label="Official cover">{o.officialCoverCents === null ? "No official cover posted" : formatCents(o.officialCoverCents)}</Fact>
        <Fact label="Dress code">{o.dressCode ?? "None"}</Fact>
        <Fact label="Venue accuracy">
          {acc.status === "ok" ? (
            <span className={acc.scorePct >= 80 ? "text-chill" : acc.scorePct >= 50 ? "text-warn" : "text-packed"}>{acc.scorePct}%</span>
          ) : acc.status === "no_official_cover" ? (
            <span className="text-muted">No official cover posted</span>
          ) : (
            <span className="text-muted">Not enough data yet</span>
          )}
        </Fact>
      </dl>
      <p className="px-4 pt-2 text-[11px] leading-snug text-muted">
        {acc.status === "no_official_cover" ? (
          <>This venue hasn&apos;t posted an official cover, so there&apos;s nothing to check it against yet.</>
        ) : (
          <>
            Accuracy is computed from people&apos;s cover reports: the share of busy hours in the last 30 days where the
            official cover was within $2 of what people paid ({acc.matchingWindows}/{acc.qualifyingWindows} hours
            {acc.status === "insufficient" ? `; needs 5` : ""}). Venues can&apos;t edit or hide it.
          </>
        )}
      </p>

      {o.promos.length > 0 && (
        <div className="space-y-2 p-4">
          {o.promos.map((p) => (
            <article key={p.id} className={`rounded-2xl border p-3 ${p.isPaid ? "border-warn/50 bg-warn/5" : "border-line bg-panel-2"}`}>
              <div className="flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${p.isPaid ? "bg-warn text-ink" : "bg-venue/20 text-venue"}`}>
                  {p.isPaid ? "Promoted" : "Venue update"}
                </span>
                <h4 className="font-semibold">{p.title}</h4>
              </div>
              <p className="mt-1 text-sm text-muted">{p.body}</p>
            </article>
          ))}
        </div>
      )}

      {o.hours.length > 0 && (
      <details className="border-t border-line px-4 py-3 text-sm">
        <summary className="cursor-pointer text-muted">All hours</summary>
        <ul className="mt-2 grid grid-cols-2 gap-1 text-xs">
          {DAY_NAMES.map((d, i) => {
            const h = o.hours.find((x) => x.day === i);
            return (
              <li key={d} className="flex justify-between gap-2 pr-4">
                <span className="text-muted">{d}</span>
                <span>{h ? fmtRange(h) : "Closed"}</span>
              </li>
            );
          })}
        </ul>
      </details>
      )}
      {o.attribution && (
        <p className="border-t border-line px-4 py-2 text-[11px] text-muted">
          Venue data <a href={o.attribution.url} className="underline" target="_blank" rel="noreferrer">{o.attribution.text}</a>
        </p>
      )}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-panel px-4 py-3">
      <dt className="text-[11px] uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}
