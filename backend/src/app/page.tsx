import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6 py-10">
      <h1 className="text-4xl font-bold tracking-tight text-accent">Nostos</h1>
      <p className="text-lg">A passport for New York. Go somewhere, get a stamp.</p>
      <p className="text-sm text-muted">Nostos is an iPhone app. This site holds the legal pages and the moderation tools.</p>
      <nav className="flex flex-wrap gap-4 text-sm">
        <Link href="/privacy" className="underline">Privacy</Link>
        <Link href="/terms" className="underline">Terms</Link>
        <Link href="/support" className="underline">Support</Link>
        <Link href="/delete-account" className="underline">Delete account</Link>
      </nav>
    </main>
  );
}
