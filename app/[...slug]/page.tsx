import { redirect, notFound } from "next/navigation";
import { AuthPage } from "@/components/auth-page";
import { FeedView, ProfileView, ProjectDetail, PublishView, SimplePage } from "@/components/feed-view";
import { NotificationsView } from "@/components/notifications-view";
import { CommunitiesView } from "@/components/communities-view";
import { MessagesView } from "@/components/messages-view";
import { SettingsView } from "@/components/settings-view";
import { getAuthenticatedUser } from "@/lib/auth";
import { safeAuthDestination } from "@/lib/auth-destination";
import { getPublicProfileByUsername } from "@/lib/profiles";
import { createPublicPageMetadata } from "@/lib/seo";

type PageProps = {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function single(value: string | string[] | undefined) { return typeof value === "string" ? value : null; }

export async function generateMetadata({ params }: Pick<PageProps, "params">) {
  const { slug } = await params;
  if (slug.length === 1 && slug[0] === "explore") {
    return createPublicPageMetadata(
      "Explore open-source projects",
      "Browse project previews, developer tools, and open-source ideas on CodeBloom. Filter by topic and explore the stories behind each build.",
      "/explore",
    );
  }

  const routeTitles: Record<string, string> = {
    login: "Sign in",
    signup: "Create an account",
    "forgot-password": "Recover your account",
    "reset-password": "Reset your password",
    projects: "Project preview",
    u: "Developer profile preview",
    communities: "Community preview",
    dashboard: "Dashboard",
    publish: "Share a project",
    bookmarks: "Bookmarks",
    notifications: "Activity",
    messages: "Messages",
    settings: "Settings",
  };

  return {
    title: routeTitles[slug[0] ?? ""] ?? "Page preview",
    description: "This CodeBloom application or preview route is not currently included in public search results.",
    robots: { index: false, follow: false },
  };
}

export default async function CatchAllPage({ params, searchParams }: PageProps) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const [section, value] = slug;
  const next = safeAuthDestination(single(search.next));

  if (section === "login" && slug.length === 1) {
    if (await getAuthenticatedUser()) redirect(next);
    redirect(`/?auth=login${next !== "/dashboard" ? `&next=${encodeURIComponent(next)}` : ""}`);
  }
  if (section === "signup" && slug.length === 1) {
    if (await getAuthenticatedUser()) redirect(next);
    redirect(`/?auth=signup${next !== "/dashboard" ? `&next=${encodeURIComponent(next)}` : ""}`);
  }
  if (section === "forgot-password" && slug.length === 1) {
    redirect(`/?auth=forgot${next !== "/dashboard" ? `&next=${encodeURIComponent(next)}` : ""}`);
  }
  if (section === "reset-password" && slug.length === 1) return <AuthPage mode="reset" next={next} />;
  if (section === "explore") {
    const initialQuery = single(search.q) ?? "";
    return <FeedView key={`explore-${initialQuery}`} mode="explore" initialQuery={initialQuery} />;
  }
  if (section === "projects" && value && slug.length === 2) return <ProjectDetail slug={value} />;
  if (section === "u" && value && slug.length === 2) return <ProfileView handle={value} profile={await getPublicProfileByUsername(value)} />;
  if (section === "communities" && value && slug.length === 2) return <CommunitiesView slug={value} />;
  if (section === "communities" && slug.length === 1) return <CommunitiesView />;

  if (section === "settings" && value === "profile" && slug.length === 2) {
    if (!(await getAuthenticatedUser())) redirect(`/login?next=${encodeURIComponent("/settings/profile")}`);
    return <SettingsView initialTab="profile" />;
  }

  const appRoutes = new Set(["dashboard", "publish", "bookmarks", "notifications", "messages", "settings"]);
  if (slug.length === 1 && appRoutes.has(section)) {
    if (section === "dashboard") return <FeedView mode="home" welcome={single(search.welcome) === "1"} authConfirmed={single(search.auth_notice) === "confirmed"} />;
    if (section === "publish") return <PublishView />;
    if (section === "notifications") return <NotificationsView />;
    if (section === "messages") return <MessagesView />;
    if (section === "settings") return <SettingsView initialTab="profile" />;
    return <SimplePage kind={section as "bookmarks"} />;
  }

  notFound();
}
