/** With the social layer removed the bar is exactly Passport, Stamp and Map. */
import { render } from "@testing-library/react-native";
import type { ReactElement } from "react";

import TabsLayout, { unstable_settings } from "@/app/(app)/(tabs)/_layout";

type ScreenProps = { name: string; options?: { href?: null; title?: string } };
const mockScreens: ScreenProps[] = [];

jest.mock("@/auth/auth-context", () => ({ useAuth: () => ({ status: "signedIn" }) }));
jest.mock("expo-router", () => {
  const Tabs = function MockTabs({ children }: { children: ReactElement[] }) {
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
  });

  it("renders exactly Passport, Stamp and Map, with Passport as home", async () => {
    await render(<TabsLayout />);
    expect(visible()).toEqual(["passport", "stamp", "map"]);
    // SDK 58: the home tab is the layout's `unstable_settings.anchor`, not a `<Tabs initialRouteName>` prop.
    expect(unstable_settings.anchor).toBe("passport");
    expect(visible()).not.toContain("index");
    expect(visible()).not.toContain("activity");
  });
});
