import type { ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { bodyFont, displayFont } from "@/lib/fonts";
import "./globals.css";

export const metadata = {
  title: { default: "openarcos", template: "%s — openarcos" },
  description: "Analysis of ARCOS prescription opioid distribution data.",
};

const BUILD_DATE = new Date().toISOString().slice(0, 10);

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>
        <Header />
        <main>{children}</main>
        <Footer buildDate={BUILD_DATE} />
      </body>
    </html>
  );
}
