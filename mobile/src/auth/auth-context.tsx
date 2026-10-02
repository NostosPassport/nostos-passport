import { useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api } from "@/api";
import { qk } from "@/api/keys";
import type { TokenResponse } from "@/api/contracts";
import { tokenStore } from "./token-store";

/**
 * - signedOut: first launch or after sign-out; shows the welcome screen.
 * - guest: browsing the public map without an account (Guideline 5.1.1(v)); posting asks to sign in.
 * - signedIn: has a token.
 */
export type AuthStatus = "loading" | "signedOut" | "guest" | "signedIn";

type AuthContextValue = {
  status: AuthStatus;
  signIn: (res: TokenResponse) => Promise<void>;
  /** Forget the token locally at once, then revoke it on the server (best effort). */
  signOut: () => Promise<void>;
  /** Forget the token without calling the server (after account deletion). */
  forget: () => Promise<void>;
  browseAsGuest: () => void;
};

const GUEST_KEY = "nostos.guest";

// A one-time message for the welcome screen after the account is deleted.
let farewell: string | null = null;
export const farewellNotice = {
  set: (m: string) => {
    farewell = m;
  },
  /** Read once; later reads return null. */
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
  const [guest, setGuest] = useState(false);

  useEffect(() => {
    let alive = true;
    void Promise.all([tokenStore.load(), SecureStore.getItemAsync(GUEST_KEY).catch(() => null)]).then(([token, g]) => {
      if (!alive) return;
      setGuest(g === "1");
      setHasToken(!!token);
    });
    const unsubscribe = tokenStore.subscribe((token) => {
      setHasToken(!!token);
      // Never show one account's cached data to the next.
      if (!token) queryClient.clear();
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [queryClient]);

  const signIn = useCallback(
    async (res: TokenResponse) => {
      // Load the account first, so the app (and a venue sheet a guest signed in from) stays mounted
      // instead of passing through the account gate. If it fails, the gate handles it.
      const me = await api.me.get(res.token).catch(() => null);
      queryClient.clear();
      if (me) queryClient.setQueryData(qk.me, me);
      await tokenStore.set(res.token);
    },
    [queryClient],
  );

  const endGuest = useCallback(() => {
    setGuest(false);
    void SecureStore.deleteItemAsync(GUEST_KEY).catch(() => undefined);
  }, []);

  const forget = useCallback(async () => {
    endGuest();
    await tokenStore.clear();
  }, [endGuest]);

  const signOut = useCallback(async () => {
    endGuest();
    const previous = await tokenStore.clear();
    if (previous) void api.auth.logout(previous).catch(() => undefined);
  }, [endGuest]);

  const browseAsGuest = useCallback(() => {
    setGuest(true);
    void SecureStore.setItemAsync(GUEST_KEY, "1").catch(() => undefined);
  }, []);

  const status: AuthStatus = hasToken === null ? "loading" : hasToken ? "signedIn" : guest ? "guest" : "signedOut";
  const value = useMemo(() => ({ status, signIn, signOut, forget, browseAsGuest }), [status, signIn, signOut, forget, browseAsGuest]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
