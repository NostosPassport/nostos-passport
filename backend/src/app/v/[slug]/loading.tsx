export default function VenueLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pt-16" aria-busy="true" aria-label="Loading venue">
      <div className="h-8 w-2/3 animate-pulse rounded-lg bg-panel" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-panel" />
      <div className="rounded-3xl border border-accent/30 bg-panel p-3">
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-panel-2" />)}
        </div>
        <div className="mt-3 h-48 animate-pulse rounded-2xl bg-panel-2" />
      </div>
      <div className="h-56 animate-pulse rounded-3xl border border-venue/30 bg-panel" />
    </div>
  );
}
