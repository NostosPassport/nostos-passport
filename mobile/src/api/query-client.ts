import NetInfo from "@react-native-community/netinfo";
import { focusManager, onlineManager, QueryClient } from "@tanstack/react-query";
import { AppState, type AppStateStatus } from "react-native";

import { configureNetwork, isOffline } from "@/lib/network";

import { ApiError } from "./client";

export function createQueryClient(): QueryClient {
  return new QueryClient({
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
