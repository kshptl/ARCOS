import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Plausible } from "@/lib/analytics/Plausible";
import { SentryBootstrap } from "@/lib/analytics/SentryBootstrap";
import { bodyFont, displayFont } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "openarcos — prescription opioid distribution in the US",
    template: "%s — openarcos",
  },
  description:
    "An investigative map of prescription opioid shipments across US counties, 2006–2014. Built on DEA ARCOS, DEA Diversion Control, and CDC WONDER.",
  openGraph: {
    siteName: "openarcos",
    type: "website",
  },
  metadataBase: new URL("https://openarcos.org"),
};

const BUILD_DATE = new Date().toISOString().slice(0, 10);

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>
        <SentryBootstrap />
        <Plausible />
        <Header />
        <main>{children}</main>
        <Footer buildDate={BUILD_DATE} />
      </body>
    </html>
  );
}
