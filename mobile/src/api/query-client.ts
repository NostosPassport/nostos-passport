import NetInfo from "@react-native-community/netinfo";
import { focusManager, MutationCache, onlineManager, QueryCache, QueryClient } from "@tanstack/react-query";
import { AppState, type AppStateStatus } from "react-native";

import { configureNetwork, isOffline } from "@/lib/network";
import { reportError } from "@/lib/report-error";

import { ApiError } from "./client";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    // Unexpected failures (bugs, contract drift, 5xx) go to the error reporter, which is off unless the build enables it.
    queryCache: new QueryCache({ onError: (error, query) => reportError(error, { query: String(query.queryKey[0]) }) }),
    mutationCache: new MutationCache({ onError: (error) => reportError(error) }),
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        // 4xx answers are final (not found, forbidden); only retry transient failures.
        retry: (count, error) => !(error instanceof ApiError && error.isClientError) && count < 2,
      },
      mutations: { retry: false },
    },
  });
}

/** Refetch on app foreground and pause queries while offline. Call once at startup. */
export function wireReactQueryToApp(): () => void {
  configureNetwork();
  const unsubscribeNet = NetInfo.addEventListener((state) => {
    onlineManager.setOnline(!isOffline(state));
  });
  const sub = AppState.addEventListener("change", (s: AppStateStatus) => focusManager.setFocused(s === "active"));
  return () => {
    unsubscribeNet();
    sub.remove();
  };
}
