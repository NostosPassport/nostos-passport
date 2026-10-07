import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div>
        <Link href="/" className="text-2xl font-bold text-accent">Nostos</Link>
      </div>
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </main>
  );
}
