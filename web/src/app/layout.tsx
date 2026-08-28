import type { Metadata, Viewport } from "next";
import { Geist, Patrick_Hand, Space_Grotesk } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const displaySans = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const chalkHand = Patrick_Hand({
  variable: "--font-chalk",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "ClassGame",
  description: "A mobile-first 3D learning game powered by an adaptive tutor agent.",
};

export const viewport: Viewport = {
  themeColor: "#05070d",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${displaySans.variable} ${chalkHand.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
