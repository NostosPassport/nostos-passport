/**
 * Moving stamps in and out of books. Every stamp always lives in the gallery; the main passport and each collection
 * are books that hold some of them. Taking a stamp out of a book never deletes it.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { api } from "@/api";
import { qk } from "@/api/keys";

/** The main passport's book id; any other book id is a collection id. */
export const PASSPORT_BOOK = "passport";

/** The new member list for a collection after adding or taking out some stamps; null when nothing changes. */
export function nextMembers(current: readonly string[], stampIds: readonly string[], add: boolean): string[] | null {
  if (add) {
    const missing = stampIds.filter((id, i) => !current.includes(id) && stampIds.indexOf(id) === i);
    return missing.length ? [...current, ...missing] : null;
  }
  const next = current.filter((id) => !stampIds.includes(id));
  return next.length === current.length ? null : next;
}

export function useBookActions() {
  const queryClient = useQueryClient();

  const refresh = useCallback((stampIds: readonly string[]) => {
    void queryClient.invalidateQueries({ queryKey: ["user"] });
    void queryClient.invalidateQueries({ queryKey: qk.collections });
    void queryClient.invalidateQueries({ queryKey: ["layouts"] });
    for (const id of stampIds) void queryClient.invalidateQueries({ queryKey: qk.stamp(id) });
  }, [queryClient]);

  /** Puts stamps into, or takes them out of, one book. */
  const setIn = useCallback(async (book: string, stampIds: readonly string[], add: boolean) => {
    try {
      if (book === PASSPORT_BOOK) {
        for (const id of stampIds) await api.books.setInPassport(id, add);
        return;
      }
      const current = await queryClient.fetchQuery({ queryKey: qk.collection(book), queryFn: () => api.collections.get(book), staleTime: 0 });
      const next = nextMembers(current.collection.stamps.map((s) => s.id), stampIds, add);
      if (next) queryClient.setQueryData(qk.collection(book), await api.collections.update(book, { stampIds: next }));
    } finally {
      refresh(stampIds);
    }
  }, [queryClient, refresh]);

  return { setIn };
}
