"use client";

import Link from "next/link";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { Check, ImagePlus, Send, X } from "lucide-react";
import { useCommunity } from "@/components/community-provider";
import { useAuth } from "@/components/auth-provider";
import { PageHeading } from "@/components/ui/page-state";
import { PreviewNote } from "@/components/ui/preview-note";

type DraftResponse = { project?: { id: string; slug: string }; error?: string };
const maxImages = 5;
const maxImageBytes = 5 * 1024 * 1024;
const imageExtensions: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Unable to read selected image file."));
    reader.readAsDataURL(file);
  });
}

export function ProjectPublishForm() {
  const { publish } = useCommunity();
  const { user, configured } = useAuth();
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<File[]>([]);
  const [altTexts, setAltTexts] = useState<string[]>([]);
  const [savedSlug, setSavedSlug] = useState("");

  function selectMedia(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    if (files.length > maxImages) {
      setSelectedMedia([]);
      setAltTexts([]);
      setError(`Choose no more than ${maxImages} screenshots.`);
      event.currentTarget.value = "";
      return;
    }
    const invalid = files.find((file) => !imageExtensions[file.type] || file.size < 1 || file.size > maxImageBytes);
    if (invalid) {
      setSelectedMedia([]);
      setAltTexts([]);
      setError("Use PNG, JPEG, or WebP images no larger than 5 MB each.");
      event.currentTarget.value = "";
      return;
    }
    setSelectedMedia(files);
    setAltTexts(files.map(() => ""));
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: String(data.get("name") ?? "").trim(),
      tagline: String(data.get("tagline") ?? "").trim(),
      description: String(data.get("description") ?? "").trim(),
      repositoryUrl: String(data.get("repo") ?? "").trim(),
      demoUrl: String(data.get("demoUrl") ?? "").trim(),
      tags: String(data.get("tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 5),
    };
    if (selectedMedia.length !== altTexts.length || altTexts.some((text) => !text.trim())) {
      setError("Add clear alt text for every screenshot, or remove that image.");
      return;
    }

    setError("");
    setSavedSlug("");
    setStatus("saving");
    let draftSlug = "";
    let draftId = "";
    const uploadedPaths: string[] = [];

    try {
      if (!configured || !user) {
        if (selectedMedia.length) throw new Error("Screenshot uploads require a signed-in account.");
        publish({ ...payload, repo: payload.repositoryUrl });
      } else {
        const response = await fetch("/api/projects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const created = await response.json() as DraftResponse;
        if (!response.ok || !created.project?.id || !created.project.slug) {
          throw new Error(created.error ?? "Unable to create a private project draft.");
        }
        draftId = created.project.id;
        draftSlug = created.project.slug;

        const media: Array<{ storagePath: string; altText: string; position: number; data: string; contentType: string }> = [];
        for (const [position, file] of selectedMedia.entries()) {
          const extension = imageExtensions[file.type] ?? "png";
          const storagePath = `${draftId}/${user.id}/${crypto.randomUUID()}.${extension}`;
          const dataUrl = await readFileAsDataUrl(file);
          uploadedPaths.push(storagePath);
          media.push({
            storagePath,
            altText: altTexts[position]!.trim(),
            position,
            data: dataUrl,
            contentType: file.type,
          });
        }

        if (media.length) {
          const mediaResponse = await fetch(`/api/projects/${encodeURIComponent(draftSlug)}/media`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ media }),
          });
          const mediaBody = await mediaResponse.json() as { error?: string };
          if (!mediaResponse.ok) {
            throw new Error(mediaBody.error ?? "Unable to attach screenshots to this project.");
          }
        }

        const publishResponse = await fetch(`/api/projects/${encodeURIComponent(draftSlug)}/publish`, { method: "POST" });
        const publishBody = await publishResponse.json() as { error?: string };
        if (!publishResponse.ok) {
          throw new Error(publishBody.error ?? "Unable to publish this project.");
        }
        setSavedSlug(draftSlug);
      }

      form.reset();
      setSelectedMedia([]);
      setAltTexts([]);
      setStatus("saved");
    } catch (cause) {
      if (draftSlug) {
        await fetch(`/api/projects/${encodeURIComponent(draftSlug)}`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ storagePaths: uploadedPaths }),
        }).catch(() => undefined);
      }
      setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
      setStatus("idle");
    }
  }

  return <section className="form-page">
    <PageHeading eyebrow="BUILD IN PUBLIC" title="Share your project" description="Introduce the work, link the source, and add a few screenshots so people can see what you built." />
    {status === "saved" && <p className="success-banner" role="status"><Check size={17} /> {savedSlug ? <>Project published. <Link href={`/projects/${savedSlug}`}>View its page</Link></> : "Project added to this browser preview only."}</p>}
    {error && <p className="error-banner" role="alert">{error}</p>}
    <form className="publish-form" onSubmit={(event) => void submit(event)}>
      <label>Project name<input required name="name" maxLength={80} minLength={2} placeholder="Signal Garden" /></label>
      <label>One-line description<input required name="tagline" maxLength={140} minLength={8} placeholder="A calmer way to understand notifications." /></label>
      <label>What are you building?<textarea required name="description" maxLength={2000} minLength={20} placeholder="Share the problem, your approach, and what makes it useful." rows={6} /></label>
      <div className="two-up">
        <label>GitHub repository<input required name="repo" type="url" pattern="https://github\.com/.*" title="Use an HTTPS github.com repository URL" placeholder="https://github.com/you/project" /></label>
        <label>Topics<input required name="tags" placeholder="TypeScript, Next.js, Open source" /></label>
      </div>
      <label>Live demo URL <span className="text-muted">(optional)</span><input name="demoUrl" type="url" placeholder="https://your-project.example" /></label>
      <p className="form-hint">Add up to five comma-separated topics. Repository and demo links must use HTTPS.</p>
      <label className="media-picker-label"><ImagePlus size={16} /> Project screenshots <span className="text-muted">(optional, up to 5)</span>
        <input name="media" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={selectMedia} />
      </label>
      <p className="form-hint">PNG, JPEG, or WebP · 5 MB maximum per image. Alt text is required for accessibility.</p>
      {selectedMedia.length > 0 && <div className="publish-media-list" aria-label="Selected project screenshots">{selectedMedia.map((file, index) => <div className="publish-media-item" key={`${file.name}-${file.size}-${index}`}><span>{file.name}</span><label>Alt text<input required maxLength={180} value={altTexts[index] ?? ""} placeholder="What does this screenshot show?" onChange={(event) => setAltTexts((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} /></label><button type="button" className="icon-button subtle" aria-label={`Remove ${file.name}`} onClick={() => { setSelectedMedia((current) => current.filter((_, itemIndex) => itemIndex !== index)); setAltTexts((current) => current.filter((_, itemIndex) => itemIndex !== index)); }}><X size={16} /></button></div>)}</div>}
      <div className="form-actions"><Link className="button button-outline" href="/">Cancel</Link><button className="button button-primary" type="submit" disabled={status === "saving"}>{status === "saving" ? <span className="spinner" aria-hidden="true" /> : <Send size={16} />}{status === "saving" ? "Publishing…" : "Publish project"}</button></div>
    </form>
    <PreviewNote>{configured && user ? "Publishing requires a signed-in account. Uploaded screenshots are stored in MongoDB Atlas and verified before publishing." : "Sign in to publish your project live to MongoDB Atlas. Without an account, preview mode will run locally in this browser."}</PreviewNote>
  </section>;
}
