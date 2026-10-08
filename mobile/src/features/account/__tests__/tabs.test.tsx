/** With the social layer removed the bar is exactly Passport, Stamp and Map. */
import { render } from "@testing-library/react-native";
import type { ReactElement } from "react";

import TabsLayout from "@/app/(app)/(tabs)/_layout";

type ScreenProps = { name: string; options?: { href?: null; title?: string } };
const mockScreens: ScreenProps[] = [];
let mockInitial = "";

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
  beforeEach(() => {
    mockScreens.length = 0;
    mockInitial = "";
  });

  it("renders exactly Passport, Stamp and Map, with Passport as home", async () => {
    await render(<TabsLayout />);
    expect(visible()).toEqual(["passport", "stamp", "map"]);
    expect(mockInitial).toBe("passport");
    expect(visible()).not.toContain("index");
    expect(visible()).not.toContain("activity");
  });
});
