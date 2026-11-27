import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Crawl the public pages; skip the per-wallet app screens and the API. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/app", "/api"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
