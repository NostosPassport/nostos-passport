"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-4xl">🫗</p>
      <h1 className="text-lg font-semibold">Something spilled</h1>
      <p className="text-sm text-muted">We couldn&apos;t load this page. It&apos;s probably temporary.</p>
      {error.digest && <p className="text-[11px] text-muted">Ref: {error.digest}</p>}
      <div className="flex gap-2">
        <button
          onClick={() =>
            // Re-fetch server components, then reset the boundary (reset alone re-renders the same failed payload).
            startTransition(() => {
              router.refresh();
              reset();
            })
          }
          className="rounded-full bg-accent px-4 py-2 font-semibold text-ink">Try again</button>
        <Link href="/" className="rounded-full border border-line px-4 py-2">Map</Link>
      </div>
    </main>
  );
}
