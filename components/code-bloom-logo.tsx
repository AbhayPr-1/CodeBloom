"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface CodeBloomLogoProps {
  className?: string;
  onClick?: () => void;
}

export function CodeBloomLogo({ className = "", onClick }: CodeBloomLogoProps) {
  const [bloomed, setBloomed] = useState(false);

  useEffect(() => {
    // Trigger botanical blooming entry sequence on mount
    const timer = setTimeout(() => {
      setBloomed(true);
    }, 80);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Link
      href="/"
      id="home"
      aria-label="CodeBloom home"
      onClick={onClick}
      className={`cb-logo ${bloomed ? "is-bloomed" : ""} ${className}`}
    >
      {/* Background botanical vine & leaf silhouettes (resembling Image 1) */}
      <span className="cb-logo-botanical" aria-hidden="true">
        <svg
          viewBox="0 0 160 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="cb-vine-svg"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="cb-vine-grad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8c1a48" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#a83060" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#e8a0bc" stopOpacity="0.25" />
            </linearGradient>
            <linearGradient id="cb-leaf-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e8a0bc" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#8c1a48" stopOpacity="0.15" />
            </linearGradient>
          </defs>

          {/* Central organic stem rising behind the underscore */}
          <path
            d="M 68 46 Q 74 26 78 4"
            className="cb-stem-path"
            stroke="url(#cb-vine-grad)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />

          {/* Left botanical leaf silhouette behind CODE */}
          <g className="cb-leaf cb-leaf-left">
            <path
              d="M 71 30 C 58 28 50 16 57 10 C 66 14 70 24 71 30 Z"
              fill="url(#cb-leaf-grad)"
              stroke="#a83060"
              strokeWidth="0.8"
              strokeOpacity="0.5"
            />
            {/* Leaf veins */}
            <path
              d="M 71 30 Q 64 21 57 10 M 67 24 Q 61 22 57 24 M 64 19 Q 60 16 58 18"
              stroke="#e8a0bc"
              strokeWidth="0.6"
              strokeOpacity="0.4"
              strokeLinecap="round"
            />
          </g>

          {/* Right botanical leaf silhouette behind BLOOM */}
          <g className="cb-leaf cb-leaf-right">
            <path
              d="M 75 22 C 88 18 96 8 89 3 C 80 6 76 16 75 22 Z"
              fill="url(#cb-leaf-grad)"
              stroke="#a83060"
              strokeWidth="0.8"
              strokeOpacity="0.5"
            />
            {/* Leaf veins */}
            <path
              d="M 75 22 Q 81 14 89 3 M 78 17 Q 84 15 88 16 M 81 12 Q 86 9 88 11"
              stroke="#e8a0bc"
              strokeWidth="0.6"
              strokeOpacity="0.4"
              strokeLinecap="round"
            />
          </g>
        </svg>
      </span>

      {/* Main CODE_BLOOM typography */}
      <span className="cb-logo-type">
        {/* "CODE" part (terminal / code styling) */}
        <span className="cb-part cb-part-code">
          <span className="cb-letter" style={{ "--i": 0 } as React.CSSProperties}>C</span>
          <span className="cb-letter" style={{ "--i": 1 } as React.CSSProperties}>O</span>
          <span className="cb-letter" style={{ "--i": 2 } as React.CSSProperties}>D</span>
          <span className="cb-letter" style={{ "--i": 3 } as React.CSSProperties}>E</span>
        </span>

        {/* Animated underscore cursor connecting Code & Bloom */}
        <span className="cb-cursor-wrap">
          <span className="cb-cursor" aria-hidden="true" />
        </span>

        {/* "BLOOM" part (blooming petal unfurl styling) */}
        <span className="cb-part cb-part-bloom">
          <span className="cb-letter" style={{ "--i": 4 } as React.CSSProperties}>B</span>
          <span className="cb-letter" style={{ "--i": 5 } as React.CSSProperties}>L</span>
          <span className="cb-letter" style={{ "--i": 6 } as React.CSSProperties}>O</span>
          <span className="cb-letter" style={{ "--i": 7 } as React.CSSProperties}>O</span>
          <span className="cb-letter" style={{ "--i": 8 } as React.CSSProperties}>M</span>
        </span>
      </span>

      {/* Tiny botanical spore sparkles floating from the blooming cursor */}
      <span className="cb-spores" aria-hidden="true">
        <i className="cb-spore cb-spore-1" />
        <i className="cb-spore cb-spore-2" />
        <i className="cb-spore cb-spore-3" />
      </span>
    </Link>
  );
}

