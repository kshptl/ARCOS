import { Bar } from "@/components/charts/Bar";
import type { CountyDistributorRow } from "@/lib/data/loadCountyDistributors";

export function TopDistributors({ rows }: { rows: CountyDistributorRow[] }) {
  if (rows.length === 0) {
    return <p>No distributor-level data available for this county.</p>;
  }
  const top = rows[0];
  const data = rows.map((r) => ({
    label: r.distributor,
    value: r.pills,
  }));
  return (
    <Bar
      data={data}
      label="label"
      value="value"
      highlight={(row) => row.label === top?.distributor}
      ariaLabel="Top distributors into this county by pills shipped 2006–2014"
    />
  );
}
