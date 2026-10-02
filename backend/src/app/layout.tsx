import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { LocationProvider } from "@/components/location/LocationProvider";

export const metadata: Metadata = {
  title: "Nostos",
  description: "Live nightlife map: venues own the facts, people own the reality.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0b12",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <LocationProvider>{children}</LocationProvider>
      </body>
    </html>
  );
}
