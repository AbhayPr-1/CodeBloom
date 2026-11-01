import type { MetadataRoute } from "next";
import { getPublicSiteOrigin } from "@/lib/public-site";

export default function robots(): MetadataRoute.Robots {
  const origin = getPublicSiteOrigin();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/publish",
        "/bookmarks",
        "/notifications",
        "/messages",
        "/settings",
      ],
    },
    ...(origin ? { sitemap: new URL("/sitemap.xml", origin).toString() } : {}),
  };
}
