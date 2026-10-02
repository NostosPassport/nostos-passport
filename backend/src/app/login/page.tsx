import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div>
        <Link href="/" className="text-2xl font-bold text-accent">Nostos</Link>
        <p className="mt-1 text-muted">Sign in to report what it&apos;s really like.</p>
      </div>
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
      {process.env.NODE_ENV === "development" && (
        <Link href="/dev/login" className="text-center text-sm text-warn underline">Dev: pick a seeded account</Link>
      )}
    </main>
  );
}
