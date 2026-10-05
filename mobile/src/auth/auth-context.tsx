import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api } from "@/api";
import { qk } from "@/api/keys";
import type { TokenResponse } from "@/api/contracts";
import { tokenStore } from "./token-store";

export type AuthStatus = "loading" | "signedOut" | "signedIn";

type AuthContextValue = {
  status: AuthStatus;
  signIn: (res: TokenResponse) => Promise<void>;
  signOut: () => Promise<void>;
  forget: () => Promise<void>;
};

let farewell: string | null = null;
export const farewellNotice = {
  set: (m: string) => {
    farewell = m;
  },
  take: (): string | null => {
    const m = farewell;
    farewell = null;
    return m;
  },
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [hasToken, setHasToken] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    void tokenStore.load().then((token) => {
      if (alive) setHasToken(!!token);
    });
    const unsubscribe = tokenStore.subscribe((token) => {
      setHasToken(!!token);
      if (!token) queryClient.clear();
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [queryClient]);

  const signIn = useCallback(
    async (res: TokenResponse) => {
      const me = await api.me.get(res.token).catch(() => null);
      queryClient.clear();
      if (me) queryClient.setQueryData(qk.me, me);
      await tokenStore.set(res.token);
    },
    [queryClient],
  );

  const forget = useCallback(async () => {
    await tokenStore.clear();
  }, []);

  const signOut = useCallback(async () => {
    const previous = await tokenStore.clear();
    if (previous) void api.auth.logout(previous).catch(() => undefined);
  }, []);

  const status: AuthStatus = hasToken === null ? "loading" : hasToken ? "signedIn" : "signedOut";
  const value = useMemo(() => ({ status, signIn, signOut, forget }), [status, signIn, signOut, forget]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
