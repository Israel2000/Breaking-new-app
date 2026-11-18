import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pulsewire - Live Event Stream",
  description: "A real-time feed for verified events across weather, earthquakes, markets, sports, and breaking news."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
