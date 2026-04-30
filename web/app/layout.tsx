import type { ReactNode } from "react";
import { bodyFont, displayFont } from "@/lib/fonts";

export const metadata = {
  title: "openarcos",
  description: "Analysis of ARCOS prescription opioid distribution data.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
