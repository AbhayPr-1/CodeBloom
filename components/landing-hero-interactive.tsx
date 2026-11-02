/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

export function LandingHeroInteractive() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let scrollY = 0;
    const handleScroll = () => { scrollY = window.scrollY; };
    window.addEventListener("scroll", handleScroll);
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener("resize", handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left - width / 2;
      const y = e.clientY - rect.top - height / 2;
      mouseRef.current.targetX = x / (width / 2);
      mouseRef.current.targetY = y / (height / 2);
    };
    window.addEventListener("mousemove", handleMouseMove);

    let time = 0;

    const render = () => {
      time += 0.008;
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.02;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.02;

      ctx.fillStyle = "#050408";
      ctx.fillRect(0, 0, width, height);

      // Flower Position: Centered at the top of the viewport
      const centerX = width / 2 + mouseRef.current.x * 20;
      const centerY = 450 - scrollY * 0.4 + mouseRef.current.y * 20;

      // 1. DRAW VERTICAL DIVINE BRANCH DESCENDING INTO THE NEXT SECTION
      ctx.save();
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      
      // Main descending vine with organic curves reaching deep into the page
      ctx.bezierCurveTo(centerX + 150, centerY + 300, centerX - 250, centerY + 600, centerX, centerY + 900);
      ctx.bezierCurveTo(centerX + 100, centerY + 1100, centerX - 100, centerY + 1300, centerX, height);
      
      ctx.strokeStyle = "#40106a";
      ctx.lineWidth = 16;
      ctx.stroke();

      // Glowing core of the descending branch
      ctx.strokeStyle = "#8B35FF";
      ctx.lineWidth = 5;
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#E63ACB";
      ctx.stroke();
      ctx.restore();

      // Lateral offshoots with mini-flowers
      const lateralOffshoots = [
        { sx: centerX + 50, sy: centerY + 250, ex: centerX + 280, ey: centerY + 150, size: 20 },
        { sx: centerX - 60, sy: centerY + 450, ex: centerX - 320, ey: centerY + 550, size: 22 },
        { sx: centerX + 40, sy: centerY + 750, ex: centerX + 350, ey: centerY + 850, size: 24 },
        { sx: centerX - 30, sy: centerY + 1000, ex: centerX - 250, ey: centerY + 950, size: 18 },
      ];

      lateralOffshoots.forEach((b, idx) => {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(b.sx, b.sy);
        ctx.quadraticCurveTo((b.sx + b.ex)/2 + 50, (b.sy + b.ey)/2, b.ex, b.ey);
        ctx.strokeStyle = "#40106a";
        ctx.lineWidth = 8;
        ctx.stroke();
        
        ctx.strokeStyle = "#B857FF";
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#FF7BE5";
        ctx.stroke();

        // Mini-flowers at tips
        ctx.translate(b.ex, b.ey);
        const bPulse = Math.sin(time * 2 + idx) * 3;
        for(let p = 0; p < 8; p++) {
          ctx.rotate((Math.PI * 2) / 8);
          ctx.beginPath();
          ctx.ellipse(b.size + bPulse, 0, (b.size + bPulse) * 0.8, b.size * 0.4, 0, 0, Math.PI * 2);
          ctx.fillStyle = "#E63ACB";
          ctx.fill();
        }
        ctx.restore();
      });

      // 2. MAIN MAGNIFICENT BLOOMING FLOWER (same layered logic)
      const layers = [
        { count: 18, radius: 440, baseWidth: 190, colorStart: "#1a062d", colorEnd: "#5d15a5", rot: 0.004 },
        { count: 16, radius: 350, baseWidth: 150, colorStart: "#350e5b", colorEnd: "#8B35FF", rot: -0.006 },
        { count: 14, radius: 260, baseWidth: 110, colorStart: "#581b8d", colorEnd: "#B857FF", rot: 0.009 },
        { count: 12, radius: 180, baseWidth: 80, colorStart: "#8927a3", colorEnd: "#E63ACB", rot: -0.012 },
        { count: 10, radius: 110, baseWidth: 50, colorStart: "#b3359d", colorEnd: "#FF7BE5", rot: 0.018 },
        { count: 8, radius: 55, baseWidth: 26, colorStart: "#ffc2f5", colorEnd: "#FFFFFF", rot: -0.025 },
      ];

      const bloom = Math.pow(Math.sin(time * 0.5) * 0.5 + 0.5, 0.8) * 0.25 + 0.88;

      layers.forEach((layer, layerIdx) => {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(time * layer.rot + mouseRef.current.x * 0.02);
        ctx.scale(bloom, bloom);
        for (let i = 0; i < layer.count; i++) {
          const angle = (i / layer.count) * Math.PI * 2;
          ctx.save();
          ctx.rotate(angle);
          const rx = layer.radius + Math.sin(time * 1.5 + i * 0.4) * 14;
          const ry = layer.baseWidth;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.bezierCurveTo(rx * 0.4, -ry * 0.7, rx * 0.85, -ry * 0.3, rx, 0);
          ctx.bezierCurveTo(rx * 0.85, ry * 0.3, rx * 0.4, ry * 0.7, 0, 0);
          const pGrad = ctx.createLinearGradient(0, -ry, 0, ry);
          pGrad.addColorStop(0, layer.colorEnd);
          pGrad.addColorStop(0.5, layer.colorStart);
          pGrad.addColorStop(1, layer.colorEnd);
          ctx.fillStyle = pGrad;
          ctx.shadowBlur = 20;
          ctx.shadowColor = layer.colorEnd;
          ctx.fill();
          ctx.strokeStyle = "rgba(255, 255, 255, " + (0.3 + Math.sin(time * 2 + i) * 0.15) + ")";
          ctx.lineWidth = 1.4;
          ctx.stroke();
          ctx.restore();
        }
        ctx.restore();
      });

      // Bright core
      const corePulse = Math.sin(time * 3) * 5 + 28;
      const coreGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, corePulse);
      coreGrad.addColorStop(0, "#FFFFFF");
      coreGrad.addColorStop(0.4, "#D1A1FF");
      coreGrad.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(centerX, centerY, corePulse, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="relative w-full h-screen min-h-[700px] overflow-hidden bg-[#050408] flex flex-col items-center justify-center text-center px-4">
      <canvas ref={canvasRef} className="fixed inset-0 z-0 w-full h-full pointer-events-none" />
      <div className="relative z-10 max-w-4xl mx-auto mt-16">
        <span className="inline-block px-4 py-1.5 mb-6 rounded-full bg-[#8B35FF]/15 border border-[#8B35FF]/40 text-[#E63ACB] text-xs font-semibold tracking-widest uppercase backdrop-blur-md shadow-[0_0_30px_rgba(139,53,255,0.35)]">
          ✦ CODEBLOOM IMMERSIVE UNIVERSE
        </span>
        <h1 className="text-6xl md:text-8xl font-black text-[#F5F2FA] mb-6 tracking-tight leading-none drop-shadow-[0_15px_35px_rgba(0,0,0,0.9)]">
          IDEAS GROW.<br />
          BUILDERS BLOOM.
        </h1>
        <p className="text-lg md:text-xl text-[#A6A0B2] max-w-2xl mx-auto mb-10 font-light drop-shadow">
          A creative universe for developers to discover projects, share ideas and build extraordinary things together.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/explore"
            className="px-8 py-4 bg-[#8B35FF] hover:bg-[#6524D9] text-white rounded-full font-medium transition-all shadow-[0_0_35px_rgba(139,53,255,0.6)] hover:scale-105"
          >
            Explore the Garden ↗
          </Link>
          <Link
            href="/signup"
            className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/20 text-[#F5F2FA] rounded-full font-medium transition-all backdrop-blur-sm"
          >
            Share Your Work
          </Link>
        </div>
      </div>
    </div>
  );
}
