import type { MetadataRoute } from "next";
import { loadAllFips } from "@/lib/data/loadCountyMeta";

const STATIC_ROUTES: Array<{
  path: string;
  priority: number;
  changeFreq: "daily" | "weekly" | "monthly";
}> = [
  { path: "/", priority: 1.0, changeFreq: "weekly" },
  { path: "/explorer", priority: 0.9, changeFreq: "weekly" },
  { path: "/rankings", priority: 0.8, changeFreq: "weekly" },
  { path: "/methodology", priority: 0.5, changeFreq: "monthly" },
  { path: "/about", priority: 0.3, changeFreq: "monthly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://openarcos.org";
  const lastModified = new Date();
  const staticEntries = STATIC_ROUTES.map((r) => ({
    url: `${base}${r.path}`,
    lastModified,
    changeFrequency: r.changeFreq,
    priority: r.priority,
  }));
  const fips = await loadAllFips();
  const countyEntries = fips.map((f) => ({
    url: `${base}/county/${f}`,
    lastModified,
    changeFrequency: "monthly" as const,
    priority: 0.4,
  }));
  return [...staticEntries, ...countyEntries];
}
