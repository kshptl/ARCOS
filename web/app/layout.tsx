import type { ReactNode } from "react";

export const metadata = {
  title: "openarcos",
  description: "Analysis of ARCOS prescription opioid distribution data.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
