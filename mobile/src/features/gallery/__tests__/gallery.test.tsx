import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import DesignGallery from "@/app/design/index";
import DesignSection from "@/app/design/[section]";
import { testQueryClient } from "@/test/query-client";
import { DesignGuard } from "../DesignGuard";
import { GALLERY_SECTIONS } from "../sections";
import { SAMPLE_PHOTOS } from "../sample-photos";
import { SAMPLE_PLACES, SAMPLE_VISA_STAMP, sampleStamps } from "../sample";

let mockSection = "palette";
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  router: { push: (...a: unknown[]) => mockPush(...a) },
  Stack: { Screen: () => null },
  Redirect: ({ href }: { href: string }) => {
    const { Text: T } = jest.requireActual("react-native");
    return <T>{`redirect:${href}`}</T>;
  },
  useLocalSearchParams: () => ({ section: mockSection }),
}));
jest.mock("@/api", () => {
  const client = jest.requireActual("@/api/client");
  return { api: {}, mediaUrl: (u: string) => u, errorText: client.errorText };
});

declare const global: { __DEV__: boolean };
const withDev = (value: boolean, run: () => Promise<void>) => async () => {
  const before = global.__DEV__;
  global.__DEV__ = value;
  try {
    await run();
  } finally {
    global.__DEV__ = before;
  }
};

describe("the Design gallery", () => {
  beforeEach(() => mockPush.mockClear());

  it("has a unique id, a title and a note for every section, and covers every current piece of the book", () => {
    const ids = GALLERY_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of GALLERY_SECTIONS) {
      expect(s.title.length).toBeGreaterThan(2);
      expect(s.note.length).toBeGreaterThan(10);
    }
    for (const needed of ["palette", "type", "cover", "open", "bearer", "pages", "flip", "stamps", "landing", "visa", "viewer", "map"]) expect(ids).toContain(needed);
    expect(ids).not.toContain("completion");
  });

  it.each(GALLERY_SECTIONS.map((s) => [s.id, s.title] as const))("renders the %s section (%s) on made-up data without a server", async (id) => {
    mockSection = id;
    await render(
      <QueryClientProvider client={testQueryClient()}>
        <DesignSection />
      </QueryClientProvider>,
    );
    expect(screen.toJSON()).not.toBeNull();
  });

  it("lists every section and opens one", async () => {
    await render(<DesignGallery />);
    for (const s of GALLERY_SECTIONS) expect(screen.getAllByText(s.title).length).toBeGreaterThan(0);
    expect(screen.getByText(/made-up data/)).toBeTruthy();
  });

  it("says so for a section that doesn't exist", async () => {
    mockSection = "nope";
    await render(<DesignSection />);
    expect(screen.getByText("There is no section called nope.")).toBeTruthy();
  });

  it(
    "is development only: with __DEV__ off it shows nothing and sends you home",
    withDev(false, async () => {
      const a = await render(<DesignGuard><Text>inside the gallery</Text></DesignGuard>);
      expect(screen.queryByText("inside the gallery")).toBeNull();
      expect(screen.getByText("redirect:/")).toBeTruthy();
      await a.unmount();
      const b = await render(<DesignGallery />);
      expect(screen.queryByText("Palette")).toBeNull();
      await b.unmount();
    }),
  );
  it("shows its children in development", async () => {
    await render(<DesignGuard><Text>inside the gallery</Text></DesignGuard>);
    expect(screen.getByText("inside the gallery")).toBeTruthy();
  });

  it("has made-up worldwide data that is deterministic and fills pages from the app's own layout", () => {
    expect(sampleStamps(7)).toEqual(sampleStamps(7));
    expect(sampleStamps(7).map((s) => `${s.page}.${s.slot}`)).toEqual(["1.1", "1.2", "1.3", "2.1", "2.2", "2.3", "3.1"]);
    expect(SAMPLE_PLACES.length).toBeGreaterThanOrEqual(12);
    expect(SAMPLE_PLACES.some((place) => place.countryCode && place.countryCode !== "US")).toBe(true);
    expect(SAMPLE_VISA_STAMP.photos).toHaveLength(4);
  });
  it("uses placeholder photos that are embedded, so it needs no network", () => {
    expect(SAMPLE_PHOTOS).toHaveLength(6);
    for (const p of SAMPLE_PHOTOS) expect(p.startsWith("data:image/png;base64,")).toBe(true);
  });
});
