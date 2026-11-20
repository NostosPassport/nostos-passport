import { router } from "expo-router";

import { nav } from "../nav";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() } }));

beforeEach(() => jest.clearAllMocks());

test("ignores an identical push fired twice in quick succession", () => {
  nav.push("/gallery");
  nav.push("/gallery");
  expect(router.push).toHaveBeenCalledTimes(1);
});

test("never blocks a different destination", () => {
  nav.push("/gallery");
  nav.push("/settings");
  expect(router.push).toHaveBeenCalledTimes(2);
});

test("ignores a double back", () => {
  nav.back();
  nav.back();
  expect(router.back).toHaveBeenCalledTimes(1);
});
