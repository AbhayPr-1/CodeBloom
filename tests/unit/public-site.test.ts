import { afterEach, describe, expect, it, vi } from "vitest";
import { getPublicSiteOrigin } from "@/lib/public-site";
import { createPublicPageMetadata } from "@/lib/seo";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getPublicSiteOrigin", () => {
  it("normalizes an explicitly configured HTTPS origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://codebloom.example/");
    expect(getPublicSiteOrigin()?.toString()).toBe("https://codebloom.example/");
  });

  it("lists only public home and explore URLs when the origin is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://codebloom.example");
    expect(sitemap().map((entry) => entry.url)).toEqual([
      "https://codebloom.example/",
      "https://codebloom.example/explore",
    ]);
    expect(robots().sitemap).toBe("https://codebloom.example/sitemap.xml");
  });

  it("omits absolute sitemap references when no production origin is set", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(sitemap()).toEqual([]);
    expect(robots().sitemap).toBeUndefined();
  });

  it("omits canonical and image URLs until a public origin is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const metadata = createPublicPageMetadata("Explore", "Explore projects.", "/explore");
    expect(metadata.alternates).toBeUndefined();
    expect(JSON.stringify(metadata.openGraph)).not.toContain("/og-image");
    expect(JSON.stringify(metadata.twitter)).toContain("summary");
  });

  it("enables canonicals and large-image cards for a configured public origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://codebloom.example");
    const metadata = createPublicPageMetadata("Explore", "Explore projects.", "/explore");
    expect(metadata.alternates?.canonical).toBe("/explore");
    expect(JSON.stringify(metadata.openGraph)).toContain("/og-image");
    expect(JSON.stringify(metadata.twitter)).toContain("summary_large_image");
  });

  it.each([
    "",
    "http://localhost:3000",
    "https://user:password@example.com",
    "https://example.com/app",
    "not-a-url",
  ])("omits an unsafe or incomplete public origin: %s", (value) => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", value);
    expect(getPublicSiteOrigin()).toBeNull();
  });
});
