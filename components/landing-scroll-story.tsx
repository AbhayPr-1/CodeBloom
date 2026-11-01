"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const chapters = [
  {
    number: "01",
    eyebrow: "DISCOVER / FIND YOUR NEXT SPARK",
    title: "Find the spark.",
    copy: "Browse project previews and follow the ideas that make you curious. Every build starts somewhere.",
    action: "Explore the project preview",
    href: "/explore",
    sceneLabel: "CHAPTER 01 / DISCOVER",
    sceneTitle: "Start with a question.",
    sceneCopy: "A small idea can grow when it has room to be found.",
    cardTitle: "The first bright idea",
    cardNote: "A sample project story",
  },
  {
    number: "02",
    eyebrow: "EXPLORE / FOLLOW THE THINKING",
    title: "See the work in progress.",
    copy: "Open a project to learn what it does, which tools it uses, and where the idea could go next.",
    action: "See the project stories",
    href: "/explore?q=Developer%20tools",
    sceneLabel: "CHAPTER 02 / EXPLORE",
    sceneTitle: "Look a little closer.",
    sceneCopy: "The details behind a build are part of the story, too.",
    cardTitle: "A closer look",
    cardNote: "Tools, purpose, and direction",
  },
  {
    number: "03",
    eyebrow: "PARTICIPATE / GROW IT TOGETHER",
    title: "Help it grow.",
    copy: "When you are ready to take part, create an account to share work and explore participation features.",
    action: "Create your account",
    href: "/signup",
    sceneLabel: "CHAPTER 03 / GROW",
    sceneTitle: "Make room for the next step.",
    sceneCopy: "A thoughtful question can be a great place to begin.",
    cardTitle: "Your next contribution",
    cardNote: "Start with curiosity",
  },
] as const;

export function LandingScrollStory({ onChapterChange }: { onChapterChange?: (chapterIndex: number) => void } = {}) {
  const storyRef = useRef<HTMLElement>(null);
  const [activeChapter, setActiveChapter] = useState(0);
  const activeChapterRef = useRef(0);

  useEffect(() => {
    const story = storyRef.current;
    const steps = story?.querySelectorAll<HTMLElement>("[data-story-step]");
    if (!story || !steps?.length || !("IntersectionObserver" in window)) return;
    let hasInitializedChapter = false;
    const visibleSteps = new Map<Element, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visibleSteps.set(entry.target, entry.intersectionRatio);
          else visibleSteps.delete(entry.target);
        });

        const current = [...visibleSteps.entries()]
          .sort(([, firstRatio], [, secondRatio]) => secondRatio - firstRatio)[0]?.[0] as HTMLElement | undefined;
        if (!current) return;

        const stepIndex = Number(current.dataset.storyStep);
        if (Number.isInteger(stepIndex) && stepIndex >= 0 && stepIndex < chapters.length) {
          if (!hasInitializedChapter) {
            hasInitializedChapter = true;
            activeChapterRef.current = stepIndex;
            setActiveChapter(stepIndex);
            return;
          }
          if (activeChapterRef.current === stepIndex) return;

          activeChapterRef.current = stepIndex;
          setActiveChapter(stepIndex);
          onChapterChange?.(stepIndex);
        }
      },
      { rootMargin: "-30% 0px -30% 0px", threshold: [0.05, 0.2, 0.5, 0.8] },
    );

    steps.forEach((step) => observer.observe(step));
    return () => observer.disconnect();
  }, [onChapterChange]);

  const scene = chapters[activeChapter];

  return (
    <section
      className="scroll-story"
      id="about"
      aria-labelledby="scroll-story-title"
      ref={storyRef}
    >
      <div className="scroll-story-inner">
        <header className="scroll-story-header">
          <p className="scroll-story-kicker"><span>01 / A STORY IN MOTION</span><i aria-hidden="true" /></p>
          <h2 id="scroll-story-title">From first spark to shared momentum.</h2>
          <p>Scroll through the way an idea can find its people, its shape, and its next step.</p>
        </header>

        <div className="scroll-story-layout" data-active-chapter={activeChapter}>
          <div className="scroll-story-chapters">
            {chapters.map((chapter, index) => (
              <article
                className={`scroll-story-step${activeChapter === index ? " is-active" : ""}`}
                data-story-step={index}
                key={chapter.number}
              >
                <div className="scroll-story-step-index" aria-hidden="true">
                  <span>{chapter.number}</span>
                  <i />
                </div>
                <div className="scroll-story-step-copy">
                  <p className="scroll-story-eyebrow">{chapter.eyebrow}</p>
                  <div className="scroll-story-mobile-preview" aria-hidden="true">
                    <div className="scroll-story-mobile-preview-top">
                      <span>{chapter.sceneLabel}</span>
                      <span className="scroll-story-mobile-preview-status"><i /> PREVIEW</span>
                    </div>
                    <strong className="scroll-story-mobile-preview-title">{chapter.sceneTitle}</strong>
                    <div className="scroll-story-mobile-preview-card">
                      <span className="scroll-story-mobile-preview-art">CB</span>
                      <span className="scroll-story-mobile-preview-card-copy">
                        <b>{chapter.cardTitle}</b>
                        <small>{chapter.cardNote}</small>
                      </span>
                      <span className="scroll-story-mobile-preview-arrow">↗</span>
                    </div>
                  </div>
                  <h3>{chapter.title}</h3>
                  <p className="scroll-story-copy">{chapter.copy}</p>
                  <Link className="scroll-story-link" href={chapter.href}>
                    <span>{chapter.action}</span>
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                      <path d="M4 12h15M13 6l6 6-6 6" />
                    </svg>
                  </Link>
                </div>
              </article>
            ))}
          </div>

          <div className="scroll-story-stage" aria-hidden="true">
            <div className={`scroll-story-scene scene-${activeChapter + 1}`}>
              <div className="scroll-story-orbit orbit-one" />
              <div className="scroll-story-orbit orbit-two" />
              <div className="scroll-story-float float-top"><span>✳</span> IDEAS, IN BLOOM</div>
              <div className="scroll-story-float float-bottom"><span>01—03</span> A COMMUNITY FOR BUILDERS</div>

              <div className="scroll-story-window">
                <div className="scroll-story-window-top">
                  <span className="scroll-story-mark"><i /><i /><i /><i /></span>
                  <span className="scroll-story-window-brand">CODEBLOOM <small>/ FIELD NOTES</small></span>
                  <span className="scroll-story-window-status"><i /> PREVIEW</span>
                </div>

                <div className="scroll-story-window-body">
                  <nav className="scroll-story-rail" aria-hidden="true">
                    {chapters.map((chapter, index) => (
                      <span className={activeChapter === index ? "is-current" : ""} key={chapter.number}>
                        {chapter.number}
                      </span>
                    ))}
                  </nav>

                  <div className="scroll-story-window-content" key={activeChapter}>
                    <p className="scroll-story-scene-label">{scene.sceneLabel}</p>
                    <div className="scroll-story-scene-heading">
                      <span className="scroll-story-spark">✳</span>
                      <h3>{scene.sceneTitle}</h3>
                    </div>
                    <p className="scroll-story-scene-copy">{scene.sceneCopy}</p>

                    <div className="scroll-story-project-card">
                      <div className="scroll-story-project-art">
                        <span className="art-ring ring-a" />
                        <span className="art-ring ring-b" />
                        <span className="art-core">CB</span>
                      </div>
                      <div className="scroll-story-project-text">
                        <span>ILLUSTRATIVE PREVIEW</span>
                        <strong>{scene.cardTitle}</strong>
                        <small>{scene.cardNote}</small>
                      </div>
                      <span className="scroll-story-card-arrow">↗</span>
                    </div>

                    <div className="scroll-story-progress-label">
                      <span>THE GROWTH LOOP</span>
                      <span>0{activeChapter + 1} / 03</span>
                    </div>
                    <div className="scroll-story-progress">
                      {chapters.map((chapter, index) => (
                        <i className={index <= activeChapter ? "is-filled" : ""} key={chapter.number} />
                      ))}
                    </div>
                    <div className="scroll-story-tags">
                      <span>curiosity</span><span>craft</span><span>community</span>
                    </div>
                  </div>
                </div>

                <div className="scroll-story-window-footer">
                  <span>SCROLL TO SHIFT THE STORY</span><span>CODEBLOOM / 2026</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
