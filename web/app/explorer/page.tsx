import type { Metadata } from "next";
import { ExplorerErrorBoundary } from "@/components/errors/ExplorerErrorBoundary";
import { Explorer } from "@/components/explorer/Explorer";
import { loadCountyMeta } from "@/lib/data/loadCountyMeta";

export const metadata: Metadata = {
  title: "Explorer",
  description: "Interactive choropleth of US county-level opioid shipments 2006–2014.",
};

export default async function ExplorerPage() {
  const counties = await loadCountyMeta();
  return (
    <ExplorerErrorBoundary>
      <Explorer counties={counties} />
    </ExplorerErrorBoundary>
  );
}
