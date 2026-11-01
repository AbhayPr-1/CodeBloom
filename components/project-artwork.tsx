import type { Project } from "@/lib/demo-data";

const artDetails: Record<Project["art"], { label: string; mark: string }> = {
  garden: { label: "signal garden / inbox", mark: "◌" },
  ledger: { label: "ledger leaf / overview", mark: "↗" },
  terminal: { label: "patchwork / release notes", mark: "~/" },
  atlas: { label: "little atlas / saved places", mark: "⌖" },
  orbit: { label: "orbit notes / graph view", mark: "◎" },
  studio: { label: "tiny studio / components", mark: "▦" },
};

/* eslint-disable @next/next/no-img-element -- Supabase signed media URLs are rendered directly without an image optimization proxy. */

export function ProjectArtwork({ project, imageUrl, imageAlt }: { project: Project; imageUrl?: string; imageAlt?: string }) {
  const details = artDetails[project.art];

  return (
    <div className={`project-art art-${project.art}${imageUrl ? " project-art-has-image" : ""}`} aria-label={imageUrl ? imageAlt || `${project.name} screenshot` : `${project.name} illustrative preview`} role="img">
      {imageUrl ? <img className="project-art-photo" src={imageUrl} alt="" aria-hidden="true" loading="lazy" /> : <>
        <div className="art-window">
          <div className="art-window-top">
            <span /><span /><span /><small>{details.label}</small>
          </div>
          <div className="art-window-content">
            <span className="art-mark">{details.mark}</span>
            <div className="art-lines"><i /><i /><i /></div>
            <div className="art-mini-grid"><b /><b /><b /><b /></div>
          </div>
        </div>
        <span className="art-index">CB / {project.art.slice(0, 3).toUpperCase()}</span>
      </>}
    </div>
  );
}
