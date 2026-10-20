import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nostos | A passport for the places you go",
  description: "Turn the places you visit into a personal passport, with stamps, photos, songs, memories, and a map of where you've been.",
  applicationName: "Nostos",
  openGraph: {
    title: "Nostos | A passport for the places you go",
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