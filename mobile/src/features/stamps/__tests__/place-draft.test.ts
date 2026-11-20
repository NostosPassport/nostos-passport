import type { Place } from "@/api/contracts";
import { placeDraft } from "../place-draft";

const place = { id: "p1", name: "Lilia" } as unknown as Place;

test("hands the preselected place over exactly once", () => {
  placeDraft.set(place);
  expect(placeDraft.take()).toBe(place);
  expect(placeDraft.take()).toBeNull();
});

test("clear forgets a pending place", () => {
  placeDraft.set(place);
  placeDraft.clear();
  expect(placeDraft.take()).toBeNull();
});
