"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bot,
  Check,
  Compass,
  Cpu,
  Flame,
  Globe,
  Palette,
  Plus,
  Sparkles,
  Terminal,
  Users,
} from "lucide-react";
import { PageHeading, EmptyState } from "@/components/ui/page-state";
import { ProjectCard } from "@/components/project-card";
import { useCommunity } from "@/components/community-provider";
import { useAuth } from "@/components/auth-provider";
import { AuthGateDialog } from "@/components/auth-gate-dialog";
import type { CommunityItem } from "@/lib/communities";

function getCommunityIcon(iconName: CommunityItem["iconName"]) {
  switch (iconName) {
    case "Globe":
      return <Globe size={18} />;
    case "Sparkles":
      return <Sparkles size={18} />;
    case "Palette":
      return <Palette size={18} />;
    case "Cpu":
      return <Cpu size={18} />;
    case "Bot":
      return <Bot size={18} />;
    case "Terminal":
      return <Terminal size={18} />;
    default:
      return <Flame size={18} />;
  }
}

export function CommunitiesView({ slug }: { slug?: string }) {
  const { user } = useAuth();
  const { projects } = useCommunity();
  const [communities, setCommunities] = useState<CommunityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [gateOpen, setGateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const url = slug ? `/api/communities?slug=${encodeURIComponent(slug)}` : "/api/communities";
    void fetch(url, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load communities");
        return (await res.json()) as { communities?: CommunityItem[]; community?: CommunityItem };
      })
      .then((data) => {
        if (active) {
          if (data.community) {
            setCommunities([data.community]);
          } else if (data.communities) {
            setCommunities(data.communities);
          }
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  async function handleToggleMembership(communitySlug: string, currentlyJoined: boolean) {
    if (!user) {
      setGateOpen(true);
      return;
    }
    if (activeSlug === communitySlug) return;
    setActiveSlug(communitySlug);

    const next = !currentlyJoined;
    // Optimistic UI update
    setCommunities((prev) =>
      prev.map((c) =>
        c.slug === communitySlug
          ? {
              ...c,
              joined: next,
              memberCount: c.memberCount + (next ? 1 : -1),
            }
          : c
      )
    );

    try {
      await fetch("/api/communities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: communitySlug, action: next ? "join" : "leave" }),
      });
    } catch {
      // rollback on error
      setCommunities((prev) =>
        prev.map((c) =>
          c.slug === communitySlug
            ? {
                ...c,
                joined: currentlyJoined,
                memberCount: c.memberCount + (currentlyJoined ? 1 : -1),
              }
            : c
        )
      );
    } finally {
      setActiveSlug(null);
    }
  }

  // If a single slug was requested:
  if (slug) {
    const community = communities.find(
      (c) => c.slug === slug.toLowerCase() || c.slug.replace("-", "") === slug.toLowerCase().replace("-", "")
    );

    if (loading) {
      return (
        <section className="community-page">
          <div className="feed-status" role="status">
            <span className="spinner" aria-hidden="true" /> Loading community space…
          </div>
        </section>
      );
    }

    if (!community) {
      return (
        <section className="community-page">
          <EmptyState
            icon={<Users size={28} />}
            title="Community space not found"
            description="We couldn't locate this developer community. Check the address or explore our topic spaces."
            action={
              <Link href="/communities" className="button button-primary">
                Browse all communities
              </Link>
            }
          />
        </section>
      );
    }

    const matchedProjects = projects.filter((p) =>
      p.tags.some((tag) => community.tags.includes(tag.toLowerCase()))
    );

    return (
      <section className="community-page">
        <div className="community-crumb">
          <Link href="/communities" className="rail-more">
            ← All community hubs
          </Link>
        </div>

        <PageHeading
          eyebrow="COMMUNITY SPACE"
          title={community.name}
          description={community.description}
          action={
            <button
              type="button"
              className={`button ${community.joined ? "button-outline" : "button-primary"}`}
              onClick={() => void handleToggleMembership(community.slug, community.joined)}
              disabled={activeSlug === community.slug}
            >
              {community.joined ? (
                <>
                  <Check size={14} /> Member
                </>
              ) : (
                <>
                  <Plus size={14} /> Join community
                </>
              )}
            </button>
          }
        />

        <div className="community-meta-banner">
          <span className="comm-meta-stat">
            <Users size={14} /> <strong>{community.memberCount.toLocaleString()}</strong> members
          </span>
          <span className="comm-meta-stat">
            <Compass size={14} /> <strong>{matchedProjects.length}</strong> active builds
          </span>
          <div className="comm-tag-pills">
            {community.tags.map((tag) => (
              <span key={tag} className="comm-tag">#{tag}</span>
            ))}
          </div>
        </div>

        <h2 className="subheading">Shared builds in {community.name}</h2>

        {matchedProjects.length > 0 ? (
          <div className="feed-list">
            {matchedProjects.map((project) => (
              <ProjectCard key={project.slug} project={project} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Compass size={26} />}
            title="No projects in this community yet"
            description="Be the first to share an open build or experiment with this space."
            action={
              <Link href="/publish" className="button button-primary">
                <Plus size={15} /> Share your project
              </Link>
            }
          />
        )}

        <AuthGateDialog
          open={gateOpen}
          onClose={() => setGateOpen(false)}
          action={`join ${community.name}`}
          returnTo={`/communities/${slug}`}
        />
      </section>
    );
  }

  // Index View (All Communities)
  const filtered = communities.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase()) ||
      c.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <section className="communities-index-page">
      <PageHeading
        eyebrow="DISCOVERY & TOPICS"
        title="Community Hubs"
        description="Find and join topic spaces around the engineering craft, open source ideas, and tools you care about."
      />

      <div className="feed-filter-bar comm-search-bar">
        <input
          type="search"
          placeholder="Filter communities by topic, language, or ethos…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="comm-search-input"
        />
      </div>

      {loading ? (
        <div className="feed-status" role="status">
          <span className="spinner" aria-hidden="true" /> Loading topic spaces…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={26} />}
          title="No matching communities"
          description={`No topic space matches "${search}". Try searching for open source, rust, or devtools.`}
          action={
            <button type="button" className="button button-outline" onClick={() => setSearch("")}>
              Clear filter
            </button>
          }
        />
      ) : (
        <div className="communities-grid">
          {filtered.map((comm) => (
            <article key={comm.slug} className="community-grid-card">
              <div className="comm-card-top">
                <div className="comm-card-icon-wrap">
                  {getCommunityIcon(comm.iconName)}
                </div>
                <button
                  type="button"
                  className={`button ${comm.joined ? "button-outline" : "button-primary"} comm-join-btn`}
                  onClick={() => void handleToggleMembership(comm.slug, comm.joined)}
                  disabled={activeSlug === comm.slug}
                  aria-label={`${comm.joined ? "Leave" : "Join"} ${comm.name}`}
                >
                  {comm.joined ? (
                    <>
                      <Check size={13} /> Joined
                    </>
                  ) : (
                    <>
                      <Plus size={13} /> Join
                    </>
                  )}
                </button>
              </div>

              <Link href={`/communities/${comm.slug}`} className="comm-title-link">
                <h3>{comm.name}</h3>
              </Link>
              <p className="comm-tagline">{comm.tagline}</p>
              <p className="comm-desc">{comm.description}</p>

              <div className="comm-card-footer">
                <div className="comm-stats">
                  <span>
                    <Users size={12} /> {comm.memberCount.toLocaleString()}
                  </span>
                  <span>
                    <Compass size={12} /> {comm.projectCount} builds
                  </span>
                </div>
                <Link href={`/communities/${comm.slug}`} className="comm-enter-link">
                  Enter space →
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      <AuthGateDialog
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        action="join communities"
        returnTo="/communities"
      />
    </section>
  );
}

