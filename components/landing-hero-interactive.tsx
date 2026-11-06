"use client";

import Link from "next/link";

export function LandingHeroInteractive() {
  const handleScrollDown = () => {
    const nextSection = document.querySelector(".story-hero-stage");
    if (nextSection) {
      nextSection.scrollIntoView({ behavior: "smooth" });
    } else {
      window.scrollTo({ top: window.innerHeight, behavior: "smooth" });
    }
  };

  return (
    <section className="cb-hero-interactive relative w-full min-h-[90vh] sm:min-h-screen flex flex-col items-center justify-center text-center px-4 pt-20 sm:pt-24 pb-16 sm:pb-20 z-10 pointer-events-none">
      <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center pointer-events-none">
        {/* Hero Title */}
        <h1 className="cb-hero-title text-4xl sm:text-7xl md:text-8xl font-black mb-6 sm:mb-8 tracking-tight leading-[1.08] pointer-events-auto">
          IDEAS GROW.<br />
          <span className="cb-hero-title-accent">
            BUILDERS BLOOM.
          </span>
        </h1>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 pointer-events-auto">
          <Link
            href="/explore"
            className="cb-hero-btn-primary px-6 sm:px-8 py-3.5 sm:py-4 text-white rounded-full font-semibold transition-all hover:scale-105 active:scale-95 text-sm sm:text-base"
          >
            Explore the Garden ↗
          </Link>
          <Link
            href="/signup"
            className="cb-hero-btn-secondary px-6 sm:px-8 py-3.5 sm:py-4 rounded-full font-semibold transition-all backdrop-blur-xl hover:scale-105 active:scale-95 text-sm sm:text-base"
          >
            Share Your Work
          </Link>
        </div>
      </div>

      {/* Scroll invitation */}
      <button
        type="button"
        onClick={handleScrollDown}
        className="hint pointer-events-auto cursor-pointer focus:outline-none"
        aria-label="Scroll to look around"
      >
        <span>Scroll to look around</span>{" "}
        <svg className="ico" aria-hidden="true">
          <use href="#i-down" />
        </svg>
      </button>
    </section>
  );
}
