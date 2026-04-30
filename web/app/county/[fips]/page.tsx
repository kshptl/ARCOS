interface CountyPageProps {
  params: Promise<{ fips: string }>;
}

export async function generateStaticParams() {
  // Bootstrap: emit a single stub so static export succeeds.
  // Plan 2 replaces this with the full 3,100-county set loaded from county-meta.json.
  return [{ fips: "00000" }];
}

export default async function CountyPage({ params }: CountyPageProps) {
  const { fips } = await params;
  return <main>County {fips} (stub).</main>;
}
