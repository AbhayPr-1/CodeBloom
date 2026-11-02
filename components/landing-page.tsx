"use client";

import Link from "next/link";
import { useState, useEffect, useSyncExternalStore, useCallback, useRef } from "react";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/components/auth-provider";
import { AuthGateDialog } from "@/components/auth-gate-dialog";
import { ProjectArtwork } from "@/components/project-artwork";
import { LandingDiscovery } from "@/components/landing-discovery";
import { LandingScrollStory } from "@/components/landing-scroll-story";
import { projects as demoProjects, type Project } from "@/lib/demo-data";
import { sound } from "@/components/landing-sound";

const previewTopics = [...new Set(demoProjects.flatMap((project) => project.tags))];
const subscribeToHapticSupport = () => () => {};
const getHapticSupport = () => typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
const getServerHapticSupport = () => false;
const storyHapticPatterns: VibratePattern[] = [[12], [9, 34, 9], [7, 22, 12, 22, 18]];

export function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  // Sensory feedback is controllable and never starts audio automatically.
  const [soundEnabled, setSoundEnabled] = useState(false);
  const hapticsAvailable = useSyncExternalStore(subscribeToHapticSupport, getHapticSupport, getServerHapticSupport);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const hapticsEnabledRef = useRef(hapticsEnabled);

  // Auth gate dialog state
  const [gateOpen, setGateOpen] = useState(false);
  const [gateAction, setGateAction] = useState("participate in this project");
  const [gateReturnTo, setGateReturnTo] = useState("/dashboard");

  // Contact form state
  const [formName, setFormName] = useState("");
  const [formContact, setFormContact] = useState("");
  const [formTask, setFormTask] = useState("");
  const [formSubmitted, setFormSubmitted] = useState(false);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".hw-root");
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (!root || reduceMotion || !("IntersectionObserver" in window)) return;

    const revealTargets = root.querySelectorAll<HTMLElement>(
      ".scroll-story, .sw-numbers, .works, .discovery, .sw-foot, .works-card, .num",
    );
    if (revealTargets.length === 0) return;

    root.classList.add("has-reveals");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -5% 0px" });

    revealTargets.forEach((target) => observer.observe(target));
    return () => {
      observer.disconnect();
      root.classList.remove("has-reveals");
      revealTargets.forEach((target) => target.classList.remove("is-visible"));
    };
  }, []);

  function toggleAudio() {
    const next = sound.toggle();
    setSoundEnabled(next);
  }

  function toggleHaptics() {
    const next = !hapticsEnabled;
    hapticsEnabledRef.current = next;
    setHapticsEnabled(next);
  }

  const handleStoryChapterChange = useCallback((chapterIndex: number) => {
    sound.playStoryTransition(chapterIndex);
    const pattern = storyHapticPatterns[chapterIndex];
    if (!pattern || !hapticsEnabledRef.current || typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;

    try {
      navigator.vibrate(pattern);
    } catch {
      // Vibration can be blocked by browser policy; the chapter transition remains visual.
    }
  }, []);

  function handleProtectedAction(actionName: string, destination: string) {
    if (user) {
      window.location.href = destination;
    } else {
      setGateAction(actionName);
      setGateReturnTo(destination);
      setGateOpen(true);
    }
  }

  function handleTactileClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest<HTMLElement>(
      'a[href], button, input[type="button"], input[type="submit"], summary, [role="button"]',
    );
    if (!control || control.matches(":disabled, [aria-disabled='true']")) return;

    sound.playClick();
    if (hapticsEnabled && event.detail > 0 && typeof navigator.vibrate === "function") {
      try {
        navigator.vibrate(8);
      } catch {
        // Haptic APIs can be blocked by browser policy; visual/audio feedback remains available.
      }
    }
  }

  function handleSubmitBrief(e: React.FormEvent) {
    e.preventDefault();
    sound.playSuccess();
    setFormSubmitted(true);
  }

  return (
    <div className="hw-root" onClickCapture={handleTactileClick}>
      <a className="skip-link" href="#content">Skip to content</a>
      {/* SVG Icon Symbols matching helloworlddsgn.com */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <symbol id="i-ne" viewBox="0 0 24 24">
          <path d="M7 17 17 7M8 7h9v9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </symbol>
        <symbol id="i-right" viewBox="0 0 24 24">
          <path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </symbol>
        <symbol id="i-down" viewBox="0 0 24 24">
          <path d="M12 4v15M6 13l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </symbol>
      </svg>

      {/* ============================================================ */}
      {/* 2. TOP CHROME NAVIGATION                                     */}
      {/* ============================================================ */}
      <header className="top">
        <Link className="brand" href="/" id="home" aria-label="CodeBloom home">
          <span className="brand-icon-quad" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </Link>
        <div className="who">
          <b>CodeBloom</b>
          <span>developer community</span>
        </div>

        <div className="top-actions">
          {/* Sound toggle */}
          <button
            className="snd"
            id="snd"
            type="button"
            aria-pressed={soundEnabled}
            aria-label={soundEnabled ? "Turn landing and story sounds off" : "Turn landing and story sounds on"}
            onClick={toggleAudio}
          >
            <span className="snd-bars" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span className="snd-t">sound</span>
          </button>

          {hapticsAvailable && (
            <button
              className="snd haptic-toggle"
              type="button"
              aria-pressed={hapticsEnabled}
              aria-label={hapticsEnabled ? "Turn haptic feedback off" : "Turn haptic feedback on"}
              onClick={toggleHaptics}
            >
              <span aria-hidden="true">⌁</span>
              <span className="snd-t">haptics</span>
            </button>
          )}

          {/* Theme toggle */}
          <button
            className="snd"
            type="button"
            onClick={() => {
              toggleTheme();
            }}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? "LIGHT" : "DARK"}
          </button>

          {/* Authentication Links */}
          <Link href="#trails" className="top-auth-btn btn-text top-explore-link">
            Explore
          </Link>
          <Link href="/login" className="top-auth-btn btn-text">
            Sign in
          </Link>
          <Link href="/signup" className="top-auth-btn btn-solid">
            Create account
          </Link>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 3. RETRO INTRO / STORY MONITOR STAGE                         */}
      {/* ============================================================ */}
      <div className="story-hero-stage">
        <div className="screen-card">
          <p className="screen-prompt">{"// INITIALIZE CODEBLOOM PROTOCOL"}</p>
          <h1 className="screen-title">
            Every great project starts with an idea.<span className="caret">_</span>
          </h1>
          <p className="screen-sub">
            Welcome to <strong>CodeBloom</strong> — where developers turn ideas into something bigger, together.
          </p>

          <div className="screen-actions">
            <Link href="/signup" className="btn">
              <span>Create your account</span>
              <svg className="ico" aria-hidden="true">
                <use href="#i-right" />
              </svg>
            </Link>

            <Link href="/explore" className="btn btn-outline">
              <span>Explore as a guest</span>
            </Link>
          </div>
        </div>

        <p className="hint" id="hint">
          <span>Scroll to look around</span>{" "}
          <svg className="ico" aria-hidden="true">
            <use href="#i-down" />
          </svg>
        </p>
      </div>

      {/* ============================================================ */}
      {/* 4. SWISS EDITORIAL SHEET (.content)                          */}
      {/*    ONE 12-column grid (.sw-grid) with consistent alignment  */}
      {/* ============================================================ */}
      <div className="content" id="content">
        {/* ========================================================== */}
        {/* SECTION (01) ABOUT CODEBLOOM                               */}
        {/* ========================================================== */}
        <LandingScrollStory onChapterChange={handleStoryChapterChange} />

        {/* ========================================================== */}
        {/* SECTION (02) HONEST PREVIEW INVENTORY                      */}
        {/* ========================================================== */}
        <section className="sw-numbers" id="numbers" aria-labelledby="nums-title">
          <div className="nums-stage">
            <div className="nums-track">
              <div className="nums-intro">
                <p className="sw-label">
                  <span>(02)</span> Inside this preview
                </p>
                <h2 className="nums-title" id="nums-title">
                  Start<br />exploring.
                </h2>
                <p className="nums-disclosure">Illustrative sample content, not live community totals.</p>
              </div>

              <div className="num">
                <span className="num-i">01</span>
                <b>{demoProjects.length}</b>
                <span className="num-l">sample projects</span>
              </div>
              <div className="num">
                <span className="num-i">02</span>
                <b>{previewTopics.length}</b>
                <span className="num-l">preview topics</span>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================== */}
        {/* SECTION (03) WORKS TUNNEL / EXPLORE PROJECTS               */}
        {/* ========================================================== */}
        <section className="works" id="work" aria-labelledby="work-title">
          <div className="works-stage">
            <header className="works-header">
              <p className="works-note">
                <span>(03)</span> Explore Projects
              </p>
              <h2 className="works-title" id="work-title">
                Ideas worth building.
              </h2>
              <p className="works-sub">Illustrative project stories · sample data, not a live feed</p>
              <Link className="btn works-btn" href="/explore">
                <span>Explore all projects</span>
                <svg className="ico" aria-hidden="true">
                  <use href="#i-right" />
                </svg>
              </Link>
            </header>

            {/* Showcase Cards Grid */}
            <div className="works-grid">
              {demoProjects.slice(0, 6).map((project: Project) => (
                <article key={project.slug} className="works-card">
                  <Link
                    href={`/projects/${project.slug}`}
                    className="works-card-art"
                    aria-label={`Explore ${project.name}`}
                  >
                    <ProjectArtwork project={project} />
                  </Link>

                  <div className="works-card-body">
                    <div className="works-card-meta">
                      <span>{project.status}</span>
                      <span>by {project.author}</span>
                    </div>

                    <h3 className="works-card-title">
                      <Link href={`/projects/${project.slug}`}>
                        {project.name}
                      </Link>
                    </h3>

                    <p className="works-card-desc">{project.description}</p>

                    <div className="works-card-tags">
                      {project.tags.map((tag) => (
                        <span key={tag} className="works-card-tag">
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <div className="works-card-actions">
                      <span style={{ fontSize: "12px", opacity: 0.8 }}>
                        {project.votes} preview appreciations
                      </span>

                      <button
                        type="button"
                        className="works-card-btn"
                        onClick={() =>
                          handleProtectedAction(`contribute to ${project.name}`, `/projects/${project.slug}`)
                        }
                      >
                        <span>Contribute</span>
                        <svg className="ico" aria-hidden="true">
                          <use href="#i-right" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <LandingDiscovery />

        {/* ========================================================== */}
        {/* SECTION (05) JOIN THE COMMUNITY / CONTACT                  */}
        {/* ========================================================== */}
        <footer className="sw sw-foot" id="contact" aria-labelledby="cta-title">
          <header className="sw-head sw-grid">
            <p className="sw-label">
              <span>(05)</span> Join the Community
            </p>
            <p className="sw-label sw-r">open to developers and collaborators</p>
          </header>

          <h2 className="sw-big sw-grid" id="cta-title">
            <span className="ln c1">Let’s build</span>
            <span className="ln c4">something together?</span>
          </h2>

          {/* Swiss Links List */}
          <ul className="sw-links">
            <li>
              <a className="sw-grid" href="mailto:contact@codebloom.dev">
                <span className="sw-label">01</span>
                <b>Email</b>
                <span className="sw-note">contact@codebloom.dev</span>
                <svg className="ico" aria-hidden="true">
                  <use href="#i-ne" />
                </svg>
              </a>
            </li>
            <li>
              <a
                className="sw-grid"
                href="https://github.com/Abhayrajput29/CodeBloom"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="sw-label">02</span>
                <b>GitHub</b>
                <span className="sw-note">CodeBloom on GitHub</span>
                <svg className="ico" aria-hidden="true">
                  <use href="#i-ne" />
                </svg>
              </a>
            </li>
            <li>
              <Link className="sw-grid" href="/explore">
                <span className="sw-label">03</span>
                <b>Explore</b>
                <span className="sw-note">sample project previews</span>
                <svg className="ico" aria-hidden="true">
                  <use href="#i-ne" />
                </svg>
              </Link>
            </li>
            <li>
              <Link className="sw-grid" href="/signup">
                <span className="sw-label">04</span>
                <b>Create account</b>
                <span className="sw-note">join the garden</span>
                <svg className="ico" aria-hidden="true">
                  <use href="#i-ne" />
                </svg>
              </Link>
            </li>
          </ul>

          {/* Contact / Project Brief Form Card */}
          <div className="sw-formwrap">
            <form className="sw-formcard" id="brief" onSubmit={handleSubmitBrief} aria-labelledby="form-title">
              <p className="f-sub">Open to developers, maintainers &amp; tinkerers</p>
              <h3 id="form-title">
                <span className="ln">
                  Tell us about <span className="w2">your project</span>
                </span>
              </h3>

              {formSubmitted ? (
                <div style={{ textAlign: "center", padding: "30px 0" }}>
                  <h4 style={{ fontSize: "28px", margin: "0 0 10px" }}>Preview complete</h4>
                  <p style={{ opacity: 0.9 }}>
                    Thanks for trying the form, <strong>{formName || "builder"}</strong>. This demo did not send or save your details.
                  </p>
                </div>
              ) : (
                <div className="sw-fields">
                  <p className="form-preview-note" role="note">Local preview only — nothing you enter here is sent or saved.</p>
                  <label>
                    <span>Name *</span>
                    <input
                      type="text"
                      name="name"
                      autoComplete="name"
                      required
                      placeholder="Your Name *"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                    />
                  </label>
                  <label>
                    <span>Telegram / GitHub / Email *</span>
                    <input
                      type="text"
                      name="contact"
                      required
                      placeholder="Telegram / GitHub / Email *"
                      value={formContact}
                      onChange={(e) => setFormContact(e.target.value)}
                    />
                  </label>
                  <label className="f-wide">
                    <span>Task or Project Idea</span>
                    <textarea
                      name="task"
                      rows={3}
                      placeholder="What are you building? Looking for collaborators or open-source contributors?"
                      value={formTask}
                      onChange={(e) => setFormTask(e.target.value)}
                    />
                  </label>
                  <button className="btn btn-ink" type="submit">
                    <span>Preview the form</span>
                    <svg className="ico" aria-hidden="true">
                      <use href="#i-right" />
                    </svg>
                  </button>
                </div>
              )}
            </form>
          </div>

          <div className="sw-end sw-grid">
            <p className="sw-label">© 2026 CodeBloom</p>
            <button className="sw-replay" id="back-to-top" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              <span>Back to top ↑</span>
            </button>
          </div>

          <p className="sw-word" aria-hidden="true">
            code_bloom
          </p>
        </footer>
      </div>

      {/* Auth Gate Dialog for Protected Actions */}
      <AuthGateDialog
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        action={gateAction}
        returnTo={gateReturnTo}
      />
    </div>
  );
}
