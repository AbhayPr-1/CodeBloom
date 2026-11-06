"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { ArrowDown, ArrowUp, Bookmark, ExternalLink, MessageCircle, MoreHorizontal, Send, Sparkles, UserPlus, UserRoundCheck } from "lucide-react";
import { useCommunity } from "@/components/community-provider";
import { useAuth } from "@/components/auth-provider";
import { AuthGateDialog } from "@/components/auth-gate-dialog";
import { ProjectArtwork } from "@/components/project-artwork";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { useRealtime } from "@/components/use-realtime";
import type { Project } from "@/lib/demo-data";
import type { LiveProject, LiveComment } from "@/lib/live-feed";
import { safeHttpsUrl } from "@/lib/urls";

export function ProjectCard({ project, featured = false, liveProject }: { project: Project; featured?: boolean; liveProject?: LiveProject }) {
  const [vote, setVote] = useState<-1 | 0 | 1>(liveProject?.vote ?? 0);
  const [bookmarkedLive, setBookmarkedLive] = useState(liveProject?.bookmarked ?? false);
  const [followingLive, setFollowingLive] = useState(liveProject?.followingCreator ?? false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<LiveComment[]>(liveProject?.recentComments ?? []);
  const [commentCount, setCommentCount] = useState(liveProject?.commentsCount ?? project.comments);
  const [commentText, setCommentText] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [gateAction, setGateAction] = useState("");
  const { bookmarked, toggleBookmark } = useCommunity();
  const { user } = useAuth();
  const pathname = usePathname() || "/explore";
  const saved = liveProject ? bookmarkedLive : bookmarked.includes(project.slug);
  const score = liveProject ? liveProject.score + vote - liveProject.vote : project.votes + vote;
  const demoUrl = project.demo ? safeHttpsUrl(project.demo) : null;

  useRealtime(liveProject ? `project:${liveProject.id}` : null, (eventType, data: Record<string, unknown>) => {
    if (eventType === "comment" && data?.comment && typeof data.comment === "object") {
      const c = data.comment as Record<string, unknown>;
      const profiles = (c.profiles && typeof c.profiles === "object") ? (c.profiles as Record<string, unknown>) : null;
      const incoming: LiveComment = {
        id: String(c.id || ""),
        body: String(c.body || ""),
        createdAt: String(c.createdAt || c.created_at || new Date().toISOString()),
        authorName: String(c.authorName || profiles?.display_name || "Developer"),
        authorUsername: String(c.authorUsername || profiles?.username || "developer"),
      };
      setComments((prev) => {
        if (prev.some((item) => item.id === incoming.id)) return prev;
        return [incoming, ...prev].slice(0, 5);
      });
      setCommentCount((count) => count + 1);
    }
  });

  async function sendAction(payload: Record<string, unknown>, action: string) {
    setBusyAction(action);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/social", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string; comment?: { id: string; body: string; created_at: string; profiles?: { username?: string; display_name?: string } | null } };
      if (!response.ok) throw new Error(result.error ?? "That action could not be saved.");
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That action could not be saved. Try again.");
      return null;
    } finally {
      setBusyAction("");
    }
  }

  async function changeVote(next: 1 | -1) {
    if (!user) { setGateAction(next === 1 ? "upvote this project" : "downvote this project"); return; }
    if (liveProject) {
      const nextVote = vote === next ? 0 : next;
      if (!await sendAction({ action: "vote", projectId: liveProject.id, value: nextVote || null }, "vote")) return;
      setVote(nextVote);
      return;
    }
    setVote((current) => (current === next ? 0 : next));
    setNotice(vote === next ? "Preview vote removed. It has not been sent to a server." : "Preview vote applied in this browser only.");
  }

  async function toggleSaved() {
    if (!user) { setGateAction("bookmark this project"); return; }
    if (liveProject) {
      const nextSaved = !bookmarkedLive;
      if (!await sendAction({ action: "bookmark", projectId: liveProject.id, saved: nextSaved }, "bookmark")) return;
      setBookmarkedLive(nextSaved);
      setNotice(nextSaved ? "Saved to your CodeBloom account." : "Removed from your saved projects.");
      return;
    }
    toggleBookmark(project.slug);
    setNotice(saved ? "Removed from this browser preview." : "Saved to this browser preview. Account-synced bookmarks are not implemented yet.");
  }

  async function toggleFollow() {
    if (!liveProject || !user) { setGateAction("follow this creator"); return; }
    const nextFollowing = !followingLive;
    if (!await sendAction({ action: "follow", creatorUsername: project.handle, following: nextFollowing }, "follow")) return;
    setFollowingLive(nextFollowing);
    setNotice(nextFollowing ? `Following ${project.author}.` : `Unfollowed ${project.author}.`);
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!liveProject || !commentText.trim()) return;
    const result = await sendAction({ action: "comment", projectId: liveProject.id, body: commentText }, "comment");
    if (!result?.comment) return;
    const comment: LiveComment = {
      id: result.comment.id,
      body: result.comment.body,
      createdAt: result.comment.created_at,
      authorName: result.comment.profiles?.display_name ?? user?.email ?? "You",
      authorUsername: result.comment.profiles?.username ?? "you",
    };
    setComments((current) => [comment, ...current].slice(0, 3));
    setCommentCount((current) => current + 1);
    setCommentText("");
    setNotice("Your comment was posted.");
  }

  return <article className={`project-card${featured ? " project-card-featured" : ""}`}>
    <ProjectArtwork project={project} imageUrl={liveProject?.media?.[0]?.url} imageAlt={liveProject?.media?.[0]?.altText} />
    <div className="project-card-body">
      <div className="project-title-row"><div className={`avatar avatar-${project.avatarTone}`}>{project.initials}</div><div className="project-title-copy"><Link className="project-title" href={`/projects/${project.slug}`}>{project.name}</Link><span className="project-author">by <Link href={`/u/${project.handle}`}>{project.author}</Link> <span className="dot-separator">·</span> {project.time}</span></div>{liveProject && user?.id !== liveProject.ownerId && <button className="button button-quiet button-small follow-button" type="button" aria-pressed={followingLive} disabled={busyAction === "follow"} onClick={() => void toggleFollow()}>{followingLive ? <UserRoundCheck size={14} /> : <UserPlus size={14} />}{followingLive ? "Following" : "Follow"}</button>}<button className="icon-button subtle" type="button" aria-label={`More options for ${project.name}`} title="More options" onClick={() => setNotice("Additional project actions are planned; no content was changed.")}><MoreHorizontal size={19} /></button></div>
      <p className="project-tagline">{project.tagline}</p><p className="project-description">{project.description}</p>
      <div className="project-meta-line"><span className={`status-pill status-${project.statusTone}`}><i />{project.status}</span><span className="repo-label"><span className="repo-dot">◉</span>{project.repo}</span></div>
      <div className="project-tags" aria-label="Technologies">{project.tags.map((tag) => <span className="tag-chip" key={tag}>{tag}</span>)}</div>
      <div className="project-card-footer"><div className="engagement-actions"><div className="vote-control" aria-label={`Voting controls for ${project.name}`}><button type="button" aria-label={`Upvote ${project.name}`} aria-pressed={vote === 1} className={vote === 1 ? "vote-active" : ""} disabled={Boolean(busyAction)} onClick={() => void changeVote(1)}><ArrowUp size={15} /></button><span aria-live="polite">{score}</span><button type="button" aria-label={`Downvote ${project.name}`} aria-pressed={vote === -1} className={vote === -1 ? "vote-active vote-down-active" : ""} disabled={Boolean(busyAction)} onClick={() => void changeVote(-1)}><ArrowDown size={15} /></button></div>{liveProject ? <button className="engagement-link comment-toggle" type="button" aria-expanded={commentsOpen} onClick={() => setCommentsOpen((open) => !open)}><MessageCircle size={15} /><span>{commentCount}</span></button> : <Link className="engagement-link" href={`/projects/${project.slug}#discussion`} aria-label={`${project.comments} comments on ${project.name}`}><MessageCircle size={15} /><span>{project.comments}</span></Link>}</div><div className="card-links">{demoUrl && <a className="text-link" href={demoUrl} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${project.name} demo (opens in a new tab)`}>Live demo <ExternalLink size={13} /></a>}<button type="button" className={`icon-button bookmark-button${saved ? " is-saved" : ""}`} aria-label={saved ? `Remove ${project.name} from bookmarks` : `Bookmark ${project.name}`} aria-pressed={saved} disabled={busyAction === "bookmark"} onClick={() => void toggleSaved()}><Bookmark size={17} fill={saved ? "currentColor" : "none"} /></button></div></div>
      {commentsOpen && liveProject && <section className="live-comments" aria-label={`Comments on ${project.name}`}><h3>Project discussion <span>{commentCount}</span></h3>{comments.length ? <ul>{comments.map((comment) => <li key={comment.id}><MarkdownRenderer content={comment.body} className="comment-body-markdown" /><small><Link href={`/u/${comment.authorUsername}`}>{comment.authorName}</Link> · {new Date(comment.createdAt).toLocaleDateString()}</small></li>)}</ul> : <p className="live-comments-empty">No comments yet. Start the conversation.</p>}<form onSubmit={(event) => void addComment(event)}><label className="sr-only" htmlFor={`comment-${liveProject.id}`}>Add a comment to {project.name}</label><textarea id={`comment-${liveProject.id}`} value={commentText} maxLength={2000} rows={2} placeholder="Share a thoughtful question or observation…" onChange={(event) => setCommentText(event.target.value)} /><button className="button button-primary button-small" type="submit" disabled={!commentText.trim() || busyAction === "comment"}>{busyAction === "comment" ? "Posting…" : <><Send size={13} /> Comment</>}</button></form></section>}
      <span className="sr-only" aria-live="polite">{notice}</span>
      {error && <p className="social-action-error" role="alert">{error}</p>}
    </div>
    <AuthGateDialog open={Boolean(gateAction)} onClose={() => setGateAction("")} action={gateAction} returnTo={pathname} />
  </article>;
}

export function FeaturedProject({ project }: { project: Project }) {
  return <div className="featured-project"><div className="featured-copy"><span className="eyebrow"><Sparkles size={13} /> COMMUNITY PICK · PREVIEW</span><Link className="featured-title" href={`/projects/${project.slug}`}>{project.name}<span> ↗</span></Link><p>{project.tagline}</p><div className="featured-byline"><div className={`avatar avatar-${project.avatarTone}`}>{project.initials}</div><span>Built by <Link href={`/u/${project.handle}`}>{project.author}</Link></span></div><div className="featured-stats"><span><ArrowUp size={14} /> {project.votes} preview appreciations</span><span><MessageCircle size={14} /> {project.comments} discussions</span></div><Link className="button button-light" href={`/projects/${project.slug}`}>Explore project <ExternalLink size={14} /></Link></div><ProjectArtwork project={project} /></div>;
}
