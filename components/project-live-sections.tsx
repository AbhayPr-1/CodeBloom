"use client";

import { useState, type FormEvent } from "react";
import { Check, ImagePlus, Send } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import type { LiveProject, LiveProjectUpdate } from "@/lib/live-feed";

/* eslint-disable @next/next/no-img-element -- Signed private Storage URLs are rendered directly rather than sent through an image proxy. */

export function ProjectLiveSections({ project }: { project: LiveProject }) {
  const { user } = useAuth();
  const [updates, setUpdates] = useState(project.updates ?? []);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const isOwner = user?.id === project.ownerId;

  async function submitUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(project.slug)}/updates`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      const result = await response.json() as { update?: LiveProjectUpdate; error?: string };
      if (!response.ok || !result.update) throw new Error(result.error ?? "Unable to save this update.");
      setUpdates((current) => [result.update!, ...current]);
      setTitle("");
      setBody("");
      setNotice("Project update published.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save this update.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    {project.media?.length ? <section className="project-media-section" aria-label="Project screenshots">
      <div className="section-title-row"><h2><ImagePlus size={18} /> Screenshots</h2><span className="text-muted">{project.media.length}</span></div>
      <div className="project-media-gallery">{project.media.map((item) => <figure key={item.id}><img src={item.url} alt={item.altText} loading="lazy" /><figcaption>{item.altText}</figcaption></figure>)}</div>
    </section> : null}
    <section className="project-updates-section" aria-labelledby="project-updates-heading">
      <div className="section-title-row"><h2 id="project-updates-heading">Project updates</h2><span className="text-muted">{updates.length}</span></div>
      {isOwner && <form className="project-update-form" onSubmit={(event) => void submitUpdate(event)}>
        <label>Update title<input required minLength={3} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What changed?" /></label>
        <label>Update details<textarea required maxLength={4000} value={body} onChange={(event) => setBody(event.target.value)} rows={4} placeholder="Share progress, decisions, or what you learned." /></label>
        {error && <p className="error-banner" role="alert">{error}</p>}
        {notice && <p className="success-banner" role="status"><Check size={15} />{notice}</p>}
        <button className="button button-primary button-small" type="submit" disabled={busy || title.trim().length < 3 || !body.trim()}>{busy ? <span className="spinner" aria-hidden="true" /> : <Send size={14} />}{busy ? "Posting…" : "Post update"}</button>
      </form>}
      {updates.length ? <ol className="project-updates-list">{updates.map((update) => <li key={update.id}><article><header><h3>{update.title}</h3><time dateTime={update.createdAt}>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(update.createdAt))}</time></header><MarkdownRenderer content={update.body} className="update-body-markdown" /><small>By <span>{update.authorName}</span></small></article></li>)}</ol> : <p className="project-updates-empty">{isOwner ? "Share the first milestone or development note for this project." : "The project owner has not posted updates yet."}</p>}
    </section>
  </>;
}
