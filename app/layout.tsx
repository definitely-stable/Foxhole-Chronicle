import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Foxhole Chronicle — World Conquest 129 Overview",
  description:
    "A public analytics and historical archive for Foxhole World Conquest. What happened, how a war evolved, and how unusual it was.",
  applicationName: "Foxhole Chronicle",
};

export const viewport: Viewport = {
  themeColor: "#0b0d10",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
