"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";

export function LogoutButton({ className = "text-xs text-muted hover:text-text" }: { className?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <button
      type="button"
      className={className}
      title={error ?? undefined}
      onClick={async () => {
        try {
          await api("/api/auth/logout", { method: "POST" });
          router.push("/");
          router.refresh();
        } catch (e) {
          setError((e as Error).message);
        }
      }}
    >
      {error ? "Retry sign out" : "Sign out"}
    </button>
  );
}
