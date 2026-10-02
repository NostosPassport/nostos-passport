export function PageSkeleton({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-2xl space-y-3 px-4 pt-16" aria-busy="true" aria-label={label}>
      <div className="h-7 w-1/2 animate-pulse rounded-lg bg-panel" />
      <div className="h-24 animate-pulse rounded-3xl bg-panel" />
      <div className="h-40 animate-pulse rounded-3xl bg-panel" />
      <div className="h-40 animate-pulse rounded-3xl bg-panel" />
    </div>
  );
}
