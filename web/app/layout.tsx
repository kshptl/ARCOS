import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "openarcos",
  description: "Analysis of ARCOS prescription opioid distribution data.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
