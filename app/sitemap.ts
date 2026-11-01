import type { MetadataRoute } from "next";
import { getPublicSiteOrigin } from "@/lib/public-site";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getPublicSiteOrigin();
  if (!origin) return [];

  return [
    {
      url: new URL("/", origin).toString(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: new URL("/explore", origin).toString(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}
