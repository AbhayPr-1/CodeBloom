"use client";

import Link from "next/link";

export function LandingHeroInteractive() {
  return (
    <section className="relative w-full min-h-[92vh] flex flex-col items-center justify-center text-center px-4 pt-24 pb-16 z-10">
      <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
        {/* Luminous pill badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full bg-purple-900/30 border border-purple-400/40 text-fuchsia-300 text-xs font-semibold tracking-widest uppercase backdrop-blur-xl shadow-[0_0_25px_rgba(217,70,239,0.3)] animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400" />
          <span>Interactive 3D Botanical Universe</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-5xl sm:text-7xl md:text-8xl font-black text-white mb-6 tracking-tight leading-[1.05] drop-shadow-[0_10px_35px_rgba(0,0,0,0.85)]">
          IDEAS GROW.<br />
          <span className="bg-gradient-to-r from-fuchsia-300 via-pink-400 to-purple-400 bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(232,121,249,0.4)]">
            BUILDERS BLOOM.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-purple-100/80 max-w-2xl mx-auto mb-10 font-light drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] leading-relaxed">
          Where developers nurture sparks into flourishing open-source projects, discover breakthrough ideas, and build extraordinary software together.
        </p>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/explore"
            className="px-8 py-4 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:via-fuchsia-500 hover:to-pink-500 text-white rounded-full font-medium transition-all shadow-[0_0_35px_rgba(192,38,211,0.5)] hover:shadow-[0_0_50px_rgba(192,38,211,0.7)] hover:scale-105 active:scale-95"
          >
            Explore the Garden ↗
          </Link>
          <Link
            href="/signup"
            className="px-8 py-4 bg-purple-950/40 hover:bg-purple-900/50 border border-purple-400/30 hover:border-purple-300/60 text-purple-100 rounded-full font-medium transition-all backdrop-blur-xl shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:scale-105 active:scale-95"
          >
            Share Your Work
          </Link>
        </div>

        {/* Scroll invitation */}
        <div className="mt-16 flex flex-col items-center gap-2 text-purple-300/60 text-xs uppercase tracking-widest animate-bounce">
          <span>Scroll to explore the stem & branches</span>
          <svg className="w-4 h-4 text-fuchsia-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </div>
    </section>
  );
}
