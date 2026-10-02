import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-4xl">🌙</p>
      <h1 className="text-lg font-semibold">Nothing here</h1>
      <p className="text-sm text-muted">That page doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <Link href="/" className="rounded-full bg-accent px-4 py-2 font-semibold text-ink">Back to the map</Link>
    </main>
  );
}
