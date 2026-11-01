export function getPublicSiteOrigin(): URL | null {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configuredOrigin) return null;

  try {
    const origin = new URL(configuredOrigin);
    if (
      origin.protocol !== "https:" ||
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash
    ) {
      return null;
    }

    return new URL(origin.origin);
  } catch {
    return null;
  }
}
