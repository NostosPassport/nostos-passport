/** With the social layer off the bar is exactly Passport, Stamp and Map. No feed, no bell. */
import { render } from "@testing-library/react-native";
import type { ReactElement } from "react";

import TabsLayout from "@/app/(app)/(tabs)/_layout";

type ScreenProps = { name: string; options?: { href?: null; title?: string } };
const mockScreens: ScreenProps[] = [];
let mockInitial = "";
let mockFlag = false;

jest.mock("@/config", () => ({ get SOCIAL_ENABLED() { return mockFlag; } }));
jest.mock("@/auth/auth-context", () => ({ useAuth: () => ({ status: "signedIn" }) }));
jest.mock("expo-router", () => {
  const Tabs = function MockTabs({ children, initialRouteName }: { children: ReactElement[]; initialRouteName: string }) {
    mockInitial = initialRouteName;
    return <>{children}</>;
  };
  Tabs.Screen = function MockScreen(props: ScreenProps) {
    mockScreens.push(props);
    return null;
  };
  return { Tabs, router: { push: jest.fn() } };
});

const visible = () => mockScreens.filter((s) => s.options?.href !== null).map((s) => s.name);

describe("tabs", () => {
  beforeEach(() => (mockScreens.length = 0));

  it("social off: exactly Passport, Stamp and Map, with Passport as home", async () => {
    mockFlag = false;
    await render(<TabsLayout />);
    expect(visible()).toEqual(["passport", "stamp", "map"]);
    expect(mockInitial).toBe("passport");
    expect(visible()).not.toContain("index");
    expect(visible()).not.toContain("activity");
  });

  it("social on: the feed and the bell come back", async () => {
    mockFlag = true;
    await render(<TabsLayout />);
    expect(visible()).toEqual(["index", "passport", "stamp", "map", "activity"]);
  });
});
