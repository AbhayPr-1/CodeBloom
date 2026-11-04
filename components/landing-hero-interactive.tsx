"use client";

import Link from "next/link";

export function LandingHeroInteractive() {
  return (
    <section className="cb-hero-interactive relative w-full min-h-[92vh] flex flex-col items-center justify-center text-center px-4 pt-24 pb-16 z-10">
      <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
        {/* Hero Title */}
        <h1 className="cb-hero-title text-5xl sm:text-7xl md:text-8xl font-black mb-6 tracking-tight leading-[1.05]">
          IDEAS GROW.<br />
          <span className="cb-hero-title-accent bg-clip-text text-transparent">
            BUILDERS BLOOM.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="cb-hero-sub mt-4 text-lg md:text-xl max-w-2xl mx-auto mb-10 font-normal leading-relaxed">
          Where developers nurture sparks into flourishing open-source projects, discover breakthrough ideas, and build extraordinary software together.
        </p>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/explore"
            className="cb-hero-btn-primary px-8 py-4 text-white rounded-full font-semibold transition-all hover:scale-105 active:scale-95"
          >
            Explore the Garden ↗
          </Link>
          <Link
            href="/signup"
            className="cb-hero-btn-secondary px-8 py-4 rounded-full font-semibold transition-all backdrop-blur-xl hover:scale-105 active:scale-95"
          >
            Share Your Work
          </Link>
        </div>

        {/* Scroll invitation */}
        <div className="cb-hero-scroll mt-16 flex flex-col items-center gap-2 text-xs uppercase tracking-widest animate-bounce">
          <span>Scroll to explore the stem &amp; branches</span>
          <svg className="w-4 h-4 text-[#f48ab0] drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </div>
    </section>
  );
}
