import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Source_Serif_4 } from "next/font/google";

// Stamps use Source Serif 4 SemiBold (OFL), self-hosted by Next at build time: the same face Expo bundles (@expo-google-fonts/source-serif-4).
const stampSerif = Source_Serif_4({ subsets: ["latin", "latin-ext", "cyrillic", "greek"], weight: "600", display: "swap", variable: "--font-stamp-serif" });

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
    <html lang="en" className={stampSerif.variable}>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}