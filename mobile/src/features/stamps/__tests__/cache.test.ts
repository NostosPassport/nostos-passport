import { QueryClient, type InfiniteData } from "@tanstack/react-query";

import type { StampView, UserStampsResponse } from "@/api/contracts";
import { qk } from "@/api/keys";
import { dropStamp } from "@/features/stamps/cache";

const stamp = (id: string, page: number, slot: number) => ({ id, page, slot }) as StampView;

describe("stamp cache", () => {
  it("removes a deleted stamp and immediately compacts every later passport slot", () => {
    const client = new QueryClient();
    const key = qk.userStamps("vinny");
    const data: InfiniteData<UserStampsResponse> = {
      pages: [
        { stamps: [stamp("a", 1, 1), stamp("b", 1, 2), stamp("c", 1, 3)], nextAfter: "cursor-1" },
        { stamps: [stamp("d", 2, 1), stamp("e", 2, 2)], nextAfter: null },
      ],
      pageParams: [null, "cursor-1"],
    };
    client.setQueryData(key, data);

    dropStamp(client, "b");

    const next = client.getQueryData<InfiniteData<UserStampsResponse>>(key)!;
    expect(next.pages.flatMap((page) => page.stamps).map(({ id, page, slot }) => ({ id, page, slot }))).toEqual([
      { id: "a", page: 1, slot: 1 },
      { id: "c", page: 1, slot: 2 },
      { id: "d", page: 1, slot: 3 },
      { id: "e", page: 2, slot: 1 },
    ]);
    client.clear();
  });
});
