import Link from "next/link";

/** Plain, readable layout for public policy pages (linked from the App Store listing and the iOS app). */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-[15px] leading-relaxed text-text">
      <Link href="/" className="text-sm font-bold text-accent">Nostos</Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted">Last updated {updated}</p>
      <div className="legal mt-8 space-y-4 [&_a]:text-accent [&_a]:underline [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
      <nav className="mt-12 flex flex-wrap gap-4 border-t border-line pt-6 text-sm text-muted">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/support">Support</Link>
        <Link href="/delete-account">Delete your account</Link>
      </nav>
    </main>
  );
}

export const SUPPORT_EMAIL = "support@nostospassport.com";
export const POLICY_UPDATED = "October 7, 2026";
