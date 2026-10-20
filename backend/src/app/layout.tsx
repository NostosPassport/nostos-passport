import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nostos | A passport for New York",
  description: "Turn the places you visit into a personal New York passport, with stamps, photos, songs, memories, and a map of the city you actually lived in.",
  applicationName: "Nostos",
  openGraph: {
    title: "Nostos | A passport for New York",
    description: "Go somewhere. Keep the story.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F7F4EE",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
