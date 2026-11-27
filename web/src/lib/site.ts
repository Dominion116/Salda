/** The public address of the site, for metadata, the sitemap and share images. Override with NEXT_PUBLIC_SITE_URL. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://salda-nu.vercel.app").replace(/\/+$/, "");
