import { QueryClient } from "@tanstack/react-query";

/** No retries, and no garbage-collection timers that would keep Jest running after the tests finish. */
export function testQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
}
