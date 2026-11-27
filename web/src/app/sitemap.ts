import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** The public pages. The app screens are per-wallet and stay out of search. */
export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, priority: number, changeFrequency: "weekly" | "monthly") => ({
    url: `${SITE_URL}${path}`,
    changeFrequency,
    priority,
  });
  return [
    page("", 1, "weekly"),
    page("/demo", 0.9, "weekly"),
    page("/docs", 0.8, "weekly"),
    page("/design", 0.4, "monthly"),
    page("/privacy", 0.3, "monthly"),
    page("/terms", 0.3, "monthly"),
  ];
}
