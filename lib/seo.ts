import type { Metadata } from "next";
import { getPublicSiteOrigin } from "@/lib/public-site";

const keywords = [
  "developer community",
  "open-source projects",
  "project discovery",
  "developer tools",
  "build in public",
];
const shareImageAlt = "CodeBloom — discover developer projects and build together";

export function createPublicPageMetadata(title: string, description: string, canonicalPath: string): Metadata {
  const origin = getPublicSiteOrigin();
  const shareTitle = `${title} | CodeBloom`;

  return {
    title,
    description,
    keywords,
    robots: { index: true, follow: true },
    ...(origin ? { alternates: { canonical: canonicalPath } } : {}),
    openGraph: {
      type: "website",
      siteName: "CodeBloom",
      title: shareTitle,
      description,
      ...(origin
        ? {
            url: canonicalPath,
            images: [{ url: "/og-image", width: 1200, height: 630, alt: shareImageAlt }],
          }
        : {}),
    },
    twitter: {
      card: origin ? "summary_large_image" : "summary",
      title: shareTitle,
      description,
      ...(origin ? { images: ["/og-image"] } : {}),
    },
  };
}
