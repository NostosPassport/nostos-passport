export default function MapLoading() {
  return (
    <div className="fixed inset-0 bg-ink" aria-busy="true" aria-label="Loading the map">
      <div className="absolute inset-0 animate-pulse bg-panel" />
      <div className="absolute inset-x-0 bottom-0 h-[38dvh] space-y-3 rounded-t-3xl border-t border-line bg-panel p-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-full bg-panel-2" />
            <div className="h-4 flex-1 animate-pulse rounded bg-panel-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
