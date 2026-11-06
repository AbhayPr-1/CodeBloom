"use client";

import React, { useEffect, useRef } from "react";
import { useTheme } from "@/components/theme-provider";

interface AuthAsciiRainProps {
  isPasswordActive?: boolean;
  className?: string;
}

const ASCII_GLYPHS = [
  "{", "}", "(", ")", "[", "]", "<", ">", "/", "\\", "+", "-", "*", "=",
  ":", ";", "_", "~", "|", "^", "%", "$", "#", "@", "!", "?",
  "0", "1", "C", "o", "d", "e", "B", "l", "o", "o", "m",
  "X", "8", "§", "✦", "❖",
];

interface StreamColumn {
  x: number;
  y: number;
  speedMultiplier: number;
  length: number;
  chars: string[];
  isCoral: boolean;
  mutationCooldown: number;
}

export const AuthAsciiRain = React.memo(function AuthAsciiRain({
  isPasswordActive = false,
  className = "",
}: AuthAsciiRainProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();

  // Dynamic prop references so the render loop never tears down or interrupts
  const isPasswordActiveRef = useRef(isPasswordActive);
  isPasswordActiveRef.current = isPasswordActive;

  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const fontSize = 14;

    const getRandomChar = () =>
      ASCII_GLYPHS[Math.floor(Math.random() * ASCII_GLYPHS.length)];

    const columns: StreamColumn[] = [];

    // Safely sync columns without resetting positions of active falling streams
    const syncColumns = (w: number, h: number) => {
      const targetCount = Math.max(1, Math.floor(w / fontSize));

      // Initial creation on first load
      if (columns.length === 0) {
        for (let i = 0; i < targetCount; i++) {
          const len = Math.floor(10 + Math.random() * 16);
          const chars: string[] = [];
          for (let j = 0; j < len; j++) chars.push(getRandomChar());
          columns.push({
            x: i * fontSize + 2,
            y: Math.random() * h * 1.5 - h * 0.25,
            speedMultiplier: 0.75 + Math.random() * 0.6,
            length: len,
            chars,
            isCoral: Math.random() < 0.2,
            mutationCooldown: Math.floor(Math.random() * 8),
          });
        }
        return;
      }

      // Add columns if widened
      while (columns.length < targetCount) {
        const i = columns.length;
        const len = Math.floor(10 + Math.random() * 16);
        const chars: string[] = [];
        for (let j = 0; j < len; j++) chars.push(getRandomChar());
        columns.push({
          x: i * fontSize + 2,
          y: Math.random() * h * 1.5 - h * 0.25,
          speedMultiplier: 0.75 + Math.random() * 0.6,
          length: len,
          chars,
          isCoral: Math.random() < 0.2,
          mutationCooldown: Math.floor(Math.random() * 8),
        });
      }

      // Trim if narrowed
      if (columns.length > targetCount) {
        columns.length = targetCount;
      }
    };

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      const newWidth = Math.floor(rect.width);
      const newHeight = Math.floor(rect.height);

      if (newWidth <= 0 || newHeight <= 0) return;

      // Only re-dimension canvas if size actually changed
      if (Math.abs(newWidth - width) > 1 || Math.abs(newHeight - height) > 1) {
        // Capture existing frame to preserve visual continuity across resizes
        let prevSnapshot: HTMLCanvasElement | null = null;
        if (width > 0 && height > 0 && canvas.width > 0 && canvas.height > 0) {
          try {
            prevSnapshot = document.createElement("canvas");
            prevSnapshot.width = canvas.width;
            prevSnapshot.height = canvas.height;
            const pCtx = prevSnapshot.getContext("2d");
            if (pCtx) {
              pCtx.drawImage(canvas, 0, 0);
            }
          } catch {
            // Ignore snapshot errors
          }
        }

        width = newWidth;
        height = newHeight;

        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);

        if (prevSnapshot) {
          ctx.drawImage(prevSnapshot, 0, 0, width, height);
        }

        syncColumns(width, height);
      }
    };

    handleResize();

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    // Velocity smoothing: positive = downwards, negative = upwards
    let currentSpeed = 1.8;

    const render = () => {
      if (width <= 0 || height <= 0) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      // Smoothly reverse direction when entering password
      const targetSpeed = isPasswordActiveRef.current ? -3.4 : 2.0;
      currentSpeed += (targetSpeed - currentSpeed) * 0.08;

      const isLight =
        themeRef.current === "light" ||
        (typeof document !== "undefined" &&
          document.documentElement.getAttribute("data-theme") === "light");

      // Transparent clearing with subtle trailing decay
      if (isLight) {
        ctx.fillStyle = "rgba(244, 244, 246, 0.26)";
      } else {
        ctx.fillStyle = "rgba(18, 18, 22, 0.22)";
      }
      ctx.fillRect(0, 0, width, height);

      ctx.font = `600 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
      ctx.textBaseline = "top";

      const isUpwards = currentSpeed < 0;

      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];

        // Randomly mutate characters for digital shimmers
        col.mutationCooldown++;
        if (col.mutationCooldown > 10) {
          const mutateIndex = Math.floor(Math.random() * col.chars.length);
          col.chars[mutateIndex] = getRandomChar();
          col.mutationCooldown = 0;
        }

        // Render glyphs along the column stream
        for (let j = 0; j < col.chars.length; j++) {
          const char = col.chars[j];

          let charY: number;
          if (isUpwards) {
            charY = col.y + j * fontSize;
          } else {
            charY = col.y + (col.chars.length - 1 - j) * fontSize;
          }

          if (charY < -fontSize || charY > height + fontSize) continue;

          const isHead = j === 0;
          const fade = 1 - j / col.chars.length;

          if (isLight) {
            if (isHead) {
              ctx.fillStyle = col.isCoral
                ? "rgba(255, 107, 91, 1)"
                : "rgba(37, 99, 235, 1)";
              ctx.shadowColor = col.isCoral
                ? "rgba(255, 107, 91, 0.6)"
                : "rgba(37, 99, 235, 0.6)";
              ctx.shadowBlur = 4;
            } else {
              ctx.fillStyle = col.isCoral
                ? `rgba(235, 90, 75, ${0.18 + fade * 0.72})`
                : `rgba(30, 64, 175, ${0.15 + fade * 0.75})`;
              ctx.shadowBlur = 0;
            }
          } else {
            if (isHead) {
              ctx.fillStyle = col.isCoral
                ? "rgba(255, 230, 220, 1)"
                : "rgba(240, 249, 255, 1)";
              ctx.shadowColor = col.isCoral
                ? "rgba(255, 107, 91, 0.9)"
                : "rgba(56, 189, 248, 0.85)";
              ctx.shadowBlur = 8;
            } else {
              ctx.fillStyle = col.isCoral
                ? `rgba(255, 107, 91, ${0.15 + fade * 0.75})`
                : `rgba(56, 189, 248, ${0.12 + fade * 0.78})`;
              ctx.shadowBlur = col.isCoral && fade > 0.6 ? 4 : 0;
            }
          }

          ctx.fillText(char, col.x, charY);
        }

        // Advance column stream
        col.y += currentSpeed * col.speedMultiplier;

        // Seamless wrap around
        if (currentSpeed >= 0) {
          if (col.y - col.length * fontSize > height) {
            col.y = -col.length * fontSize;
            col.speedMultiplier = 0.75 + Math.random() * 0.6;
            col.isCoral = Math.random() < 0.2;
          }
        } else {
          if (col.y + col.length * fontSize < -fontSize) {
            col.y = height + col.length * fontSize;
            col.speedMultiplier = 0.75 + Math.random() * 0.6;
            col.isCoral = Math.random() < 0.2;
          }
        }
      }

      ctx.shadowBlur = 0;
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, []); // Run effect once on mount so rain animation never stops on mode switch

  return (
    <div
      ref={containerRef}
      className={`auth-ascii-rain-window absolute inset-0 w-full h-full pointer-events-none select-none overflow-hidden ${className}`}
      role="img"
      aria-label="ASCII rain effect across authentication showcase window"
    >
      <canvas
        ref={canvasRef}
        className="block w-full h-full pointer-events-none"
      />
    </div>
  );
});
