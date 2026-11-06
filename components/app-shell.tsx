"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity, ArrowRight, Bell, Bookmark, ChevronDown, ChevronRight,
  CircleHelp, Compass, Hash, Home, Menu, MessageCircle, Moon,
  Plus, Search, Settings, Sun, UserRound, X,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/components/auth-provider";
import { CodeBloomLogo } from "@/components/code-bloom-logo";
import { tactile } from "@/components/tactile-haptics";
import { projects } from "@/lib/demo-data";

const discovery = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/communities", label: "Communities", icon: Hash },
];
const topics = [
  { href: "/communities/opensource", label: "Open source", count: "2.4k" },
  { href: "/communities/indie-makers", label: "Indie makers", count: "1.8k" },
  { href: "/communities/design-systems", label: "Design systems", count: "980" },
];

function Brand() {
  return <CodeBloomLogo className="app-shell-cb-logo" />;
}

function Avatar({ initials = "AC", tone = "plum" }: { initials?: string; tone?: string }) {
  return <span className={`avatar avatar-${tone}`} aria-hidden="true">{initials}</span>;
}

function NavItem({ href, label, icon: Icon, active, dot, onNavigate }: {
  href: string; label: string; icon: typeof Home; active: boolean; dot?: boolean; onNavigate?: () => void;
}) {
  return <Link href={href} className={`nav-item${active ? " nav-item-active" : ""}`} aria-current={active ? "page" : undefined} onClick={onNavigate}>
    <Icon size={18} strokeWidth={active ? 2.2 : 1.8} /><span>{label}</span>{dot && <i className="nav-dot" aria-label="Preview activity" />}
  </Link>;
}

function ContextRail() {
  return (
    <aside className="context-rail" aria-label="Community highlights">
      <section className="rail-card rail-intro">
        <div className="rail-intro-badge">
          <span className="rail-badge-icon" aria-hidden="true">🌱</span>
          <span>A COMMUNITY, NOT A DIRECTORY</span>
        </div>
        <h2>Good work gets better <span className="rail-together">together.</span></h2>
        <p>Share a build, trade thoughtful feedback, and find ideas you want to build upon.</p>
        <Link className="rail-share-button" href="/publish">
          <Plus size={16} strokeWidth={2.5} /> Share your project
        </Link>
      </section>

      <section className="rail-card rail-garden-card">
        <div className="rail-heading">
          <span className="eyebrow"><span className="flame-emoji" aria-hidden="true">🔥</span> IN THE GARDEN</span>
          <Link href="/explore" aria-label="Explore community projects" className="rail-chevron">
            <ChevronRight size={16} />
          </Link>
        </div>
        <div className="rail-garden-list">
          {projects.slice(0, 4).map((project, index) => (
            <Link className="trend-item" href={`/projects/${project.slug}`} key={project.slug}>
              <span className="trend-number">0{index + 1}</span>
              <div className="trend-content">
                <strong className="trend-title">{project.name}</strong>
                <div className="trend-meta">
                  <span className="trend-tag">{project.tags[0]}</span>
                  <span className="trend-dot">·</span>
                  <span className="trend-votes"><span className="sprout-icon" aria-hidden="true">🌱</span> {project.votes}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
        <Link href="/explore" className="rail-more">
          Explore all projects <ArrowRight size={14} />
        </Link>
      </section>

      <section className="rail-card">
        <div className="rail-heading">
          <span className="eyebrow"><Activity size={13} /> GROWING TOPICS</span>
        </div>
        {topics.map((topic, index) => (
          <Link className="rail-topic" href={topic.href} key={topic.href}>
            <span>
              <i className={`topic-mark topic-mark-${index}`}><Hash size={12} /></i> {topic.label}
            </span>
            <small>{topic.count} preview</small>
          </Link>
        ))}
        <Link href="/communities" className="rail-more">
          Browse communities <ArrowRight size={14} />
        </Link>
      </section>

      <blockquote className="rail-quote">
        <span aria-hidden="true">“</span>
        <p>The best software communities make it easier to share what you learned, not just what you shipped.</p>
        <cite>THE CODEBLOOM IDEA</cite>
      </blockquote>
    </aside>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const publicEntry = pathname === "/" || ["/login", "/signup", "/forgot-password", "/reset-password"].includes(pathname);
  const onFeed = pathname === "/dashboard" || pathname === "/explore";
  const currentSection = pathname === "/dashboard" ? "/dashboard"
    : pathname.startsWith("/explore") ? "/explore"
    : pathname.startsWith("/communities") ? "/communities"
    : pathname.startsWith("/bookmarks") ? "/bookmarks"
    : pathname.startsWith("/notifications") ? "/notifications"
    : pathname.startsWith("/messages") ? "/messages"
    : pathname.startsWith("/publish") ? "/publish"
    : pathname.startsWith("/settings") ? "/settings"
    : "";

  useEffect(() => {
    let active = true;
    fetch("/api/notifications", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.unreadCount !== undefined) {
          setUnreadCount(data.unreadCount);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user, pathname]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") { setMobileOpen(false); setProfileOpen(false); }
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, []);

  if (publicEntry) return <>{children}</>;

  const personalNav = [
    { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
    { href: "/notifications", label: "Activity", icon: Bell, dot: unreadCount > 0 },
    { href: "/messages", label: "Messages", icon: MessageCircle },
  ];

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    if (term) router.push(`/explore?q=${encodeURIComponent(term)}`);
  }

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    setProfileOpen(false);
    router.replace("/");
    router.refresh();
  }

  return <div className={`app-shell${mobileOpen ? " mobile-open" : ""}`}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-brand"><button className="icon-button mobile-menu-button" onClick={() => setMobileOpen((open) => !open)} aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileOpen} aria-controls="primary-sidebar">{mobileOpen ? <X size={20} /> : <Menu size={20} />}</button><Brand /></div>
        <form className="global-search" role="search" onSubmit={submitSearch}><Search size={16} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search projects, people, and topics" placeholder="Search projects, people, topics…" /><kbd aria-hidden="true">⌘ K</kbd><button type="submit" aria-label="Search"><ArrowRight size={15} /></button></form>
        <div className="topbar-actions"><span className="preview-indicator"><i /> {user ? "Signed in" : "Public preview"}</span><button className="icon-button theme-button" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} onClick={toggleTheme}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button><Link className="topbar-bell" href="/notifications" aria-label="Activity"><Bell size={18} />{unreadCount > 0 && <i />}</Link><button className="profile-trigger" aria-expanded={profileOpen} aria-haspopup="true" aria-label={user ? "Open account menu" : "Open sign-in menu"} onClick={() => setProfileOpen((open) => !open)}><Avatar initials={user?.email?.slice(0, 2).toUpperCase() ?? "CB"} /><ChevronDown size={13} /></button>
          {profileOpen && <div className="profile-popover" role="menu"><div className="popover-identity"><Avatar initials={user?.email?.slice(0, 2).toUpperCase() ?? "CB"} /><span><strong>{user?.email ?? "Welcome to CodeBloom"}</strong><small>{user ? "CodeBloom account" : "Browsing publicly"}</small></span></div>{user ? <><Link role="menuitem" href="/settings/profile" onClick={() => setProfileOpen(false)}>Developer profile</Link><Link role="menuitem" href="/settings" onClick={() => setProfileOpen(false)}>Account settings</Link><button className="profile-signout" type="button" role="menuitem" onClick={() => void signOut()}>Sign out</button></> : <><Link role="menuitem" href="/?auth=login" onClick={() => setProfileOpen(false)}>Sign in</Link><Link role="menuitem" href="/?auth=signup" onClick={() => setProfileOpen(false)}>Create account</Link></>}</div>}
        </div>
      </div>
    </header>
    {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <div className="app-grid">
      <aside className={`left-sidebar${mobileOpen ? " left-sidebar-open" : ""}`} id="primary-sidebar">
        <span className="sidebar-label">DISCOVER</span><nav aria-label="Primary navigation">{discovery.map((item) => <NavItem key={item.href} {...item} active={currentSection === item.href} onNavigate={() => setMobileOpen(false)} />)}</nav>
        <span className="sidebar-label sidebar-label-gap">YOUR SPACE</span><nav aria-label="Personal navigation">{personalNav.map((item) => <NavItem key={item.href} {...item} active={currentSection === item.href} dot={item.dot} onNavigate={() => setMobileOpen(false)} />)}</nav>
        <Link className="share-project-link" href="/publish" onClick={() => setMobileOpen(false)}><span><Plus size={16} /></span><b>Share a project</b><small>Preview</small></Link>
        <div className="sidebar-communities"><div className="sidebar-community-heading"><span className="sidebar-label">YOUR COMMUNITIES</span><Link href="/communities" aria-label="Browse communities"><Plus size={14} /></Link></div>{topics.map((topic, index) => <Link className="sidebar-topic" href={topic.href} key={topic.href} onClick={() => setMobileOpen(false)}><span className={`topic-mark topic-mark-${index}`}><Hash size={12} /></span><span>{topic.label}</span><small>{topic.count}</small></Link>)}<Link href="/communities" className="sidebar-browse">Browse all <ArrowRight size={13} /></Link></div>
        <div className="sidebar-bottom"><Link href="/settings/profile" onClick={() => setMobileOpen(false)}><UserRound size={16} /> Developer profile</Link><Link href="/settings"><Settings size={16} /> Settings</Link><Link href="/settings#help"><CircleHelp size={16} /> Help & feedback</Link><div className="sidebar-legal"><Link href="/settings#about">About</Link><span>·</span><Link href="/settings#guidelines">Guidelines</Link><span>·</span><Link href="/settings#privacy">Privacy</Link></div><small>© 2026 CodeBloom community</small></div>
      </aside>
      <main className={`main-column${onFeed ? " main-column-feed" : ""}`} id="main-content" tabIndex={-1}><div className="main-inner">{children}<div className="mobile-preview-note"><i /> Preview interactions are not synced</div></div></main>
      {onFeed && <ContextRail />}
    </div>
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      {[
        { href: "/dashboard", label: "Home", icon: Home },
        { href: "/explore", label: "Explore", icon: Compass },
        { href: "/publish", label: "Publish", icon: Plus },
        { href: "/notifications", label: "Activity", icon: Bell, hasDot: unreadCount > 0 },
        { href: "/messages", label: "Messages", icon: MessageCircle },
      ].map((item) => {
        const Icon = item.icon;
        const active = currentSection === item.href;
        return (
          <Link
            href={item.href}
            key={item.href}
            className={`mobile-nav-item ${active ? "mobile-nav-active" : ""}`}
            aria-current={active ? "page" : undefined}
            onClick={() => {
              tactile.tap();
              setMobileOpen(false);
            }}
          >
            <span className="mobile-nav-icon-wrap">
              <Icon size={19} strokeWidth={active ? 2.3 : 1.8} />
              {item.hasDot && <i className="mobile-nav-dot" aria-label="Unread activity" />}
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  </div>;
}
