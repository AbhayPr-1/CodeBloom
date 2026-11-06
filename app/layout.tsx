import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthProvider } from "@/components/auth-provider";
import { CommunityProvider } from "@/components/community-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { AnnouncerProvider } from "@/components/live-announcer";
import { getPublicSiteOrigin } from "@/lib/public-site";
import "./globals.css";

const publicOrigin = getPublicSiteOrigin();

export const metadata: Metadata = {
  ...(publicOrigin ? { metadataBase: publicOrigin } : {}),
  title: { default: "CodeBloom — Discover. Discuss. Build upon.", template: "%s · CodeBloom" },
  description: "A project-centered developer community for discovering, discussing, and building upon software projects.",
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <CommunityProvider>
              <AnnouncerProvider>
                <AppShell>{children}</AppShell>
              </AnnouncerProvider>
            </CommunityProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
