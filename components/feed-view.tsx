"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight, Bell, Bookmark, Compass, LogIn, MessageCircle, Plus, Search,
  Settings2, Users,
} from "lucide-react";
import { ProjectCard } from "@/components/project-card";
import { ProjectArtwork } from "@/components/project-artwork";
import { DashboardWelcome } from "@/components/dashboard-welcome";
import { useCommunity } from "@/components/community-provider";
import { useTheme } from "@/components/theme-provider";
import { PageHeading, EmptyState } from "@/components/ui/page-state";
import { PreviewNote } from "@/components/ui/preview-note";
import { projects as seedProjects } from "@/lib/demo-data";
import { getPreviewFeed, previewFeedModes, type PreviewFeedMode } from "@/lib/community-feed";
import { sortLiveFeed, type LiveFeedMode, type LiveProject } from "@/lib/live-feed";
import { safeGitHubRepositoryUrl, safeHttpsUrl } from "@/lib/urls";
import { useAuth } from "@/components/auth-provider";
import { AuthGateDialog } from "@/components/auth-gate-dialog";
import { ProjectPublishForm } from "@/components/project-publish-form";
import { ProjectLiveSections } from "@/components/project-live-sections";
import type { PublicProfile } from "@/lib/validation/profiles";

const emptyLiveProjects: LiveProject[] = [];

export function FeedView({ mode = "home", initialQuery = "", authConfirmed = false, welcome = false }: { mode?: "home" | "explore"; initialQuery?: string; authConfirmed?: boolean; welcome?: boolean }) {
  const { projects } = useCommunity();
  const [filter, setFilter] = useState<PreviewFeedMode>("For you");
  const [query, setQuery] = useState(initialQuery);
  const [liveResult, setLiveResult] = useState<{ key: string; projects: LiveProject[]; error: string }>({ key: "", projects: [], error: "" });
  const isDashboard = mode === "home";
  const requestKey = `${filter}\u0000${query}`;
  const liveLoading = isDashboard && liveResult.key !== requestKey;
  const liveError = liveResult.key === requestKey ? liveResult.error : "";
  const liveProjects = liveResult.key === requestKey ? liveResult.projects : emptyLiveProjects;
  const visible = useMemo(() => isDashboard ? sortLiveFeed(liveProjects, filter as LiveFeedMode, query) : getPreviewFeed(projects, filter, query), [filter, isDashboard, liveProjects, projects, query]);
  const title = mode === "explore" ? "Explore projects" : "The community garden";

  useEffect(() => {
    if (!isDashboard) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ mode: filter });
    if (query.trim()) params.set("q", query.trim());
    void fetch(`/api/feed?${params.toString()}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { projects?: LiveProject[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? "The live project feed could not be loaded.");
        setLiveResult({ key: requestKey, projects: body.projects ?? [], error: "" });
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setLiveResult({ key: requestKey, projects: [], error: cause instanceof Error ? cause.message : "The live project feed could not be loaded." });
      });
    return () => controller.abort();
  }, [filter, isDashboard, query, requestKey]);

  return <section className="feed-view">
    {mode === "home" && (welcome || authConfirmed) && <DashboardWelcome emailConfirmed={authConfirmed} />}
    <PageHeading eyebrow={mode === "explore" ? "DISCOVER WHAT'S GROWING" : "GOOD WORK, SHARED OPENLY"} title={title} description={mode === "explore" ? "Find the tools, experiments, and open-source work people are building." : "Published projects from the CodeBloom community, with live votes, saves, and conversation."} action={<Link href="/publish" className="button button-primary"><Plus size={16} /> Share a project</Link>} />
    <div className="feed-toolbar"><div className="tabs" role="group" aria-label={isDashboard ? "Sort the live project feed" : "Sort the preview feed"}>{previewFeedModes.map((item) => <button type="button" key={item} className={filter === item ? "tab-active" : ""} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</div>{mode === "explore" && <label className="inline-search"><Search size={15} aria-hidden="true" /><span className="sr-only">Search projects</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects" /></label>}</div>
    {isDashboard && liveLoading ? <div className="feed-status" role="status"><span className="spinner" aria-hidden="true" /> Loading live projects…</div> : null}
    {isDashboard && !liveLoading && liveError ? <div className="error-banner" role="alert">{liveError}</div> : null}
    {!isDashboard && filter === "Following" ? <EmptyState icon={<Users size={24} />} title="Your following feed starts here" description="Follow creators from a live project card to build this feed." action={<Link className="button button-outline" href="/explore"><Compass size={15} /> Explore projects</Link>} /> : null}
    {!liveLoading && !liveError && (isDashboard || filter !== "Following") && visible.length ? <div className="feed-list" aria-live="polite">{visible.map((project) => <ProjectCard key={project.slug} project={project} liveProject={isDashboard ? project as LiveProject : undefined} />)}</div> : null}
    {isDashboard && !liveLoading && !liveError && visible.length === 0 ? <EmptyState icon={<Compass size={24} />} title={filter === "Following" ? "Your following feed is ready to grow" : "No live projects yet"} description={filter === "Following" ? "Follow a creator from a project card and their published work will appear here." : "When members publish projects, they will appear here. You can be among the first to share one."} action={<Link className="button button-outline" href="/publish"><Plus size={15} /> Share a project</Link>} /> : null}
    {!isDashboard && filter !== "Following" && visible.length === 0 ? <EmptyState icon={<Search size={24} />} title="No projects found" description="Try another project name, developer, or technology." action={query ? <button className="button button-outline" type="button" onClick={() => setQuery("")}>Clear search</button> : undefined} /> : null}
    {isDashboard ? <p className="live-feed-note">Live feed · public published projects · private account actions</p> : <PreviewNote>Feed order and sample projects are local preview data, not the production ranking or a live community feed.</PreviewNote>}
  </section>;
}

export function PublishView() {
  return <ProjectPublishForm />;
}

export function ProjectDetail({ slug }: { slug: string }) {
  const { projects, bookmarked, toggleBookmark } = useCommunity();
  const { user } = useAuth();
  const previewProject = projects.find((item) => item.slug === slug);
  const [liveProject, setLiveProject] = useState<LiveProject | null>(null);
  const [liveLookupDone, setLiveLookupDone] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const pathname = usePathname() || `/projects/${slug}`;
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/projects/${encodeURIComponent(slug)}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        const body = await response.json() as { project?: LiveProject };
        return body.project ?? null;
      })
      .then((value) => setLiveProject(value))
      .catch(() => { /* Public preview detail remains available if live data is offline. */ })
      .finally(() => { if (!controller.signal.aborted) setLiveLookupDone(true); });
    return () => controller.abort();
  }, [slug]);

  if (!liveProject && !previewProject && !liveLookupDone) return <section className="detail-page"><div className="feed-status" role="status"><span className="spinner" aria-hidden="true" /> Loading project…</div></section>;
  const project = liveProject ?? previewProject;
  if (!project) return <EmptyState icon={<Compass size={24} />} title="Project not found" description="This project may have moved or is not included in the live feed or preview." action={<Link className="button button-primary" href="/explore">Explore projects</Link>} />;
  const repositoryUrl = safeGitHubRepositoryUrl(project.repo);
  const demoUrl = project.demo ? safeHttpsUrl(project.demo) : null;
  if (liveProject) return <section className="detail-page"><Link className="back-link" href="/dashboard"><ArrowUpRight size={14} /> Back to dashboard</Link><PageHeading eyebrow={liveProject.status === "Published" ? "LIVE COMMUNITY PROJECT" : "YOUR PROJECT DRAFT"} title={liveProject.name} description={liveProject.tagline} /><ProjectCard project={liveProject} liveProject={liveProject} /><article className="detail-card"><p className="detail-description">{liveProject.description}</p><dl><div><dt>Live score</dt><dd>{liveProject.score}</dd></div><div><dt>Comments</dt><dd>{liveProject.commentsCount}</dd></div><div><dt>Topics</dt><dd>{liveProject.tags.length}</dd></div></dl><div className="project-tags" aria-label="Project topics">{liveProject.tags.map((tag) => <Link className="tag-chip" href={`/explore?q=${encodeURIComponent(tag)}`} key={tag}>#{tag}</Link>)}</div><div className="detail-links">{repositoryUrl && <a className="button button-outline" href={repositoryUrl} target="_blank" rel="noopener noreferrer">View source <ArrowUpRight size={15} /></a>}{demoUrl && <a className="text-link" href={demoUrl} target="_blank" rel="noopener noreferrer">Live demo <ArrowUpRight size={14} /></a>}</div></article><ProjectLiveSections project={liveProject} /></section>;
  return <section className="detail-page"><Link className="back-link" href="/explore"><ArrowUpRight size={14} /> Back to explore</Link><PageHeading eyebrow={`${project.status.toUpperCase()} · PREVIEW PROJECT`} title={project.name} description={project.tagline} action={<button className="button button-outline" type="button" onClick={() => { if (!user) { setGateOpen(true); return; } toggleBookmark(project.slug); setNotice("Bookmark saved to this browser preview only."); }} aria-pressed={bookmarked.includes(project.slug)}><Bookmark size={16} fill={bookmarked.includes(project.slug) ? "currentColor" : "none"} /> {bookmarked.includes(project.slug) ? "Saved" : "Save project"}</button>} /><div className="detail-art"><ProjectArtwork project={project} /></div><article className="detail-card"><div className="detail-author"><span className={`avatar avatar-${project.avatarTone}`}>{project.initials}</span><span>Built by <Link href={`/u/${project.handle}`}>{project.author}</Link><small>@{project.handle} · {project.time}</small></span><span className={`status-pill status-${project.statusTone}`}><i />{project.status}</span></div><p className="detail-description">{project.description}</p><dl><div><dt>Preview appreciations</dt><dd>{project.votes}</dd></div><div><dt>Conversations</dt><dd>{project.comments}</dd></div><div><dt>Topics</dt><dd>{project.tags.length}</dd></div></dl><div className="project-tags" aria-label="Project topics">{project.tags.map((tag) => <Link className="tag-chip" href={`/communities/${encodeURIComponent(tag.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}`} key={tag}>#{tag}</Link>)}</div><div className="detail-links">{repositoryUrl && <a className="button button-outline" href={repositoryUrl} target="_blank" rel="noopener noreferrer">View source <ArrowUpRight size={15} /></a>}{demoUrl && <a className="text-link" href={demoUrl} target="_blank" rel="noopener noreferrer">Live demo <ArrowUpRight size={14} /></a>}</div></article>{notice && <p className="preview-feedback" role="status">{notice}</p>}<section className="discussion" id="discussion"><div className="section-title-row"><h2><MessageCircle size={19} /> Discussion</h2><span className="preview-tag">Preview</span></div><p>Project discussion will appear here when comments and server-side authorization are implemented. For now, explore the project and its source code.</p><Link className="button button-outline" href={`/login?next=${encodeURIComponent(`/projects/${slug}#discussion`)}`}><LogIn size={15} /> Sign in to join later</Link></section><PreviewNote>Project content, totals, and activity on this page are illustrative local data.</PreviewNote><AuthGateDialog open={gateOpen} onClose={() => setGateOpen(false)} action="save this project" returnTo={pathname} /></section>;
}

export function ProfileView({ handle, profile }: { handle: string; profile: PublicProfile | null }) {
  const { projects } = useCommunity();
  const { user } = useAuth();
  const pathname = usePathname() || `/u/${handle}`;
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [followNotice, setFollowNotice] = useState("");
  const [gateOpen, setGateOpen] = useState(false);
  useEffect(() => {
    if (!profile || !user) return;
    const controller = new AbortController();
    void fetch(`/api/social?creator=${encodeURIComponent(profile.username)}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ following: boolean }> : null)
      .then((result) => { if (result) setFollowing(result.following); })
      .catch(() => { /* Keep public profile browsing available when social data is unavailable. */ });
    return () => controller.abort();
  }, [profile, user]);
  const previewProjects = projects.filter((project) => project.handle.toLowerCase() === handle.toLowerCase());
  const preview = previewProjects[0];
  const displayName = profile?.displayName || preview?.author;
  if (!displayName) return <EmptyState icon={<Users size={24} />} title="Developer not found" description="No public CodeBloom profile was found for this username." action={<Link className="button button-primary" href="/explore">Explore projects</Link>} />;
  const initials = displayName.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const joined = profile ? new Intl.DateTimeFormat("en", { year: "numeric", month: "long", timeZone: "UTC" }).format(new Date(profile.createdAt)) : null;
  async function toggleFollow() {
    if (!user) { setGateOpen(true); return; }
    if (!profile) { setFollowNotice("Creator follows are available on live project profiles; this profile is preview data."); return; }
    if (followBusy) return;
    setFollowBusy(true);
    setFollowNotice("");
    try {
      const next = !following;
      const response = await fetch("/api/social", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "follow", creatorUsername: profile.username, following: next }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Unable to update follow status.");
      setFollowing(next);
      setFollowNotice(next ? `You are now following ${displayName}.` : `You unfollowed ${displayName}.`);
    } catch (cause) { setFollowNotice(cause instanceof Error ? cause.message : "Unable to update follow status."); }
    finally { setFollowBusy(false); }
  }
  return <section className="profile-page"><PageHeading eyebrow={profile ? "PUBLIC DEVELOPER PROFILE" : "DEVELOPER PROFILE · PREVIEW"} title={displayName} description={`@${profile?.username ?? preview?.handle} · ${profile?.bio || "Building in public on CodeBloom."}`} action={<button className="button button-outline" type="button" aria-pressed={following} disabled={followBusy} onClick={() => void toggleFollow()}>{followBusy ? "Saving…" : following ? "Following" : "Follow developer"}</button>} />{followNotice && <p className={followNotice.startsWith("Unable") ? "error-banner" : "preview-feedback"} role={followNotice.startsWith("Unable") ? "alert" : "status"}>{followNotice}</p>}<article className="detail-card profile-summary"><div className={`avatar avatar-large avatar-${profile ? "violet" : preview?.avatarTone ?? "violet"}`}>{initials}</div><div><h2>{displayName}</h2><p>{profile ? profile.bio || "This developer hasn't added a bio yet." : "Sharing thoughtful software, open-source experiments, and lessons learned along the way."}</p>{joined && <span className="profile-stat">Member since <strong>{joined}</strong></span>}{!profile && <span className="profile-stat"><strong>{previewProjects.length}</strong> shared {previewProjects.length === 1 ? "project" : "projects"}</span>}</div></article><h2 className="subheading">Projects by {displayName}</h2>{profile ? <EmptyState icon={<Compass size={24} />} title="No live projects linked yet" description="This public profile is live Supabase data. Project ownership is not yet connected to this public profile view." /> : <div className="feed-list">{previewProjects.map((item) => <ProjectCard key={item.slug} project={item} />)}</div>}<PreviewNote>{profile ? "Profile details and follow status are live account data. Public project ownership is not yet connected to this profile view." : "This developer profile and its projects are local preview data."}</PreviewNote><AuthGateDialog open={gateOpen} onClose={() => setGateOpen(false)} action="follow this creator" returnTo={pathname} /></section>;
}

const communityInfo: Record<string, { title: string; description: string; tags: string[] }> = {
  opensource: { title: "Open source", description: "Projects shared in the open, with room for people to learn, contribute, and build on what came before.", tags: ["open source"] },
  "open-source": { title: "Open source", description: "Projects shared in the open, with room for people to learn, contribute, and build on what came before.", tags: ["open source"] },
  "indie-makers": { title: "Indie makers", description: "Small teams and solo developers turning useful ideas into thoughtful software.", tags: ["community", "developer tools"] },
  "design-systems": { title: "Design systems", description: "The components, tokens, and tools that make interfaces feel consistent and considered.", tags: ["design systems", "css"] },
};

export function CommunityView({ slug }: { slug: string }) {
  const [notice, setNotice] = useState("");
  const [gateOpen, setGateOpen] = useState(false);
  const { user } = useAuth();
  const info = communityInfo[slug];
  const related = info ? seedProjects.filter((project) => project.tags.some((tag) => info.tags.includes(tag.toLowerCase()))) : [];
  return <section className="community-page"><PageHeading eyebrow="COMMUNITY · PREVIEW" title={info?.title ?? "Community"} description={info?.description ?? "A place to find related projects and builders."} action={<button className="button button-primary" type="button" onClick={() => user ? setNotice("Community membership is not available yet.") : setGateOpen(true)}><Users size={15} /> Join community</button>} />{notice && <p className="preview-feedback" role="status">{notice}</p>}<div className="feed-list">{related.map((project) => <ProjectCard key={project.slug} project={project} />)}</div><PreviewNote>Community membership remains a preview feature.</PreviewNote><AuthGateDialog open={gateOpen} onClose={() => setGateOpen(false)} action="join this community" returnTo={`/communities/${slug}`} /></section>;
}

export function SimplePage({ kind }: { kind: "bookmarks" | "notifications" | "messages" | "settings" | "communities" }) {
  const { theme, toggleTheme } = useTheme();
  const [bookmarkResult, setBookmarkResult] = useState<{ projects: LiveProject[]; error: string } | null>(null);
  useEffect(() => {
    if (kind !== "bookmarks") return;
    const controller = new AbortController();
    void fetch("/api/feed?mode=Bookmarks", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { projects?: LiveProject[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? "Unable to load saved projects.");
        setBookmarkResult({ projects: body.projects ?? [], error: "" });
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setBookmarkResult({ projects: [], error: cause instanceof Error ? cause.message : "Unable to load saved projects." });
      });
    return () => controller.abort();
  }, [kind]);
  const content = {
    bookmarks: { title: "Your bookmarks", text: "Projects you save will be easy to find here.", icon: <Bookmark size={24} /> },
    notifications: { title: "Notifications", text: "Meaningful project activity will appear here.", icon: <Bell size={24} /> },
    messages: { title: "Messages", text: "Private conversations are not available yet.", icon: <MessageCircle size={24} /> },
    settings: { title: "Settings", text: "Manage your account and profile preferences.", icon: <Settings2 size={24} /> },
    communities: { title: "Communities", text: "Find and join topic spaces around the work you care about.", icon: <Users size={24} /> },
  }[kind];
  return <section><PageHeading eyebrow="YOUR WORKSPACE" title={content.title} description={content.text} />{kind === "settings" && <div className="settings-card"><div className="settings-copy"><span className="settings-icon"><Settings2 size={16} /></span><div><strong>Appearance</strong><p>Choose a comfortable reading theme. Current: {theme}.</p></div></div><button type="button" className="button button-outline" onClick={toggleTheme}>Switch to {theme === "dark" ? "light" : "dark"}</button></div>}{kind === "bookmarks" ? bookmarkResult === null ? <div className="feed-status" role="status"><span className="spinner" aria-hidden="true" /> Loading saved projects…</div> : bookmarkResult.error ? <p className="error-banner" role="alert">{bookmarkResult.error}</p> : bookmarkResult.projects.length ? <div className="feed-list">{bookmarkResult.projects.map((project) => <ProjectCard key={project.slug} project={project} liveProject={project} />)}</div> : <EmptyState icon={content.icon} title="No saved projects yet" description="Use the bookmark control on a live project to keep it close. Saved projects will appear here across sessions." action={<Link className="button button-outline" href="/dashboard"><Compass size={15} /> Back to dashboard</Link>} /> : <EmptyState icon={content.icon} title="This space is growing" description="This workspace page will be connected to live data in a later step." />}</section>;
}
