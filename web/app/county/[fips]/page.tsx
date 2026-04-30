import { notFound } from "next/navigation";
import { loadAllFips, loadCountyMetaByFips } from "@/lib/data/loadCountyMeta";

export const dynamic = "error";
export const dynamicParams = false;

export async function generateStaticParams() {
  const fips = await loadAllFips();
  return fips.map((f) => ({ fips: f }));
}

export default async function CountyPage({ params }: { params: Promise<{ fips: string }> }) {
  const { fips } = await params;
  const meta = await loadCountyMetaByFips(fips);
  if (!meta) notFound();
  return (
    <main>
      <h1>{meta.name}</h1>
      <p>{meta.state}</p>
    </main>
  );
}
