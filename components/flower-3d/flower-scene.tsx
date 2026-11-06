"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { BotanicalWorld } from "./flower-botanical-system";
import { AsciiPostProcessor } from "./flower-ascii-pass";
import { useTheme } from "@/components/theme-provider";

export function FlowerScene() {
  const { theme } = useTheme();
  const themeRef = useRef(theme);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<BotanicalWorld | null>(null);
  const asciiPassRef = useRef<AsciiPostProcessor | null>(null);
  const [bloomProgress, setBloomProgress] = useState(0.0);
  const [renderMode, setRenderMode] = useState<"ascii" | "silk">("ascii");
  const renderModeRef = useRef<"ascii" | "silk">("ascii");

  // Keep renderModeRef and themeRef in sync
  useEffect(() => {
    renderModeRef.current = renderMode;
  }, [renderMode]);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  // Derive current blooming stage name for HUD
  const getStageName = (p: number) => {
    if (p < 0.15) return "Stage 1: Bud";
    if (p < 0.35) return "Stage 2: Stem";
    if (p < 0.60) return "Stage 3: Branches";
    if (p < 0.88) return "Stage 4: Petals";
    return "Stage 5: Bloom";
  };

  // Synchronize 3D botanical world and ASCII shader with the active theme
  useEffect(() => {
    worldRef.current?.setTheme(theme);
    asciiPassRef.current?.setTheme(theme);
  }, [theme]);

  const handleReplay = useCallback(() => {
    if (worldRef.current) {
      worldRef.current.replayBloom();
    }
  }, []);

  const handleManualBloomChange = useCallback((value: number) => {
    if (worldRef.current) {
      worldRef.current.bloomProgress = value;
      worldRef.current.targetBloomProgress = value;
      setBloomProgress(value);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "default",
        failIfMajorPerformanceCaveat: false,
      });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.92;
    } catch (e) {
      // Graceful fallback for environments without WebGL support (e.g. headless jsdom or disabled GPU)
      console.warn("WebGL not supported in current environment", e);
      return;
    }

    // 2. Scene & Camera Setup
    const scene = new THREE.Scene();

    const isMobileInitial = window.innerWidth < 768;
    const camera = new THREE.PerspectiveCamera(
      isMobileInitial ? 52 : 45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    // Initial camera position centered on main flower
    camera.position.set(0, isMobileInitial ? 2.6 : 3.2, isMobileInitial ? 5.2 : 5.8);

    // 3. Botanical World Setup
    const world = new BotanicalWorld();
    world.setTheme(themeRef.current);
    worldRef.current = world;
    scene.add(world.rootGroup);

    // ASCII Post-Processor for matrix/code character flower rendering
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const asciiPass = new AsciiPostProcessor(
      renderer,
      window.innerWidth,
      window.innerHeight,
      dpr,
      themeRef.current
    );
    asciiPassRef.current = asciiPass;

    // Autoplay the existing closed-bud-to-full-bloom animation on first load.
    world.replayBloom();

    // 4. Mouse & Touch State
    const mouse = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      ndcX: 0,
      ndcY: 0,
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.targetX = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.targetY = -(e.clientY / window.innerHeight) * 2 + 1;
      mouse.ndcX = mouse.targetX;
      mouse.ndcY = mouse.targetY;
      world.setMousePosition(mouse.ndcX, mouse.ndcY, camera);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        mouse.targetX = (touch.clientX / window.innerWidth) * 2 - 1;
        mouse.targetY = -(touch.clientY / window.innerHeight) * 2 + 1;
        mouse.ndcX = mouse.targetX;
        mouse.ndcY = mouse.targetY;
        world.setMousePosition(mouse.ndcX, mouse.ndcY, camera);
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchstart", handleTouchMove, { passive: true });

    // 5. Scroll State Tracking across the entire landing page
    let targetScrollFraction = 0;
    let currentScrollFraction = 0;
    const handleScroll = () => {
      const maxScroll = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight
      );
      targetScrollFraction = Math.max(0, Math.min(1, window.scrollY / maxScroll));
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    currentScrollFraction = targetScrollFraction;

    // 6. Window Resize
    let isMobile = isMobileInitial;
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const currentDpr = Math.min(window.devicePixelRatio || 1, 2);
      isMobile = width < 768;
      camera.aspect = width / height;
      camera.fov = isMobile ? 52 : 45;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      asciiPass.setSize(width, height, currentDpr);
    };
    window.addEventListener("resize", handleResize);
    handleResize();

    // 7. Animation Loop with bulletproof performance.now() timing
    let animationFrameId: number;
    let lastTime = performance.now();
    const startTime = performance.now();
    let currentCamY = isMobile ? 2.6 : 3.2;
    let currentLookY = isMobile ? 2.6 : 3.2;
    let currentCamZ = isMobile ? 5.2 : 5.8;
    let lastProgress = 0.0;

    const animate = () => {
      const now = performance.now();
      const delta = Math.min(0.1, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      const elapsedTime = (now - startTime) / 1000;

      // Smooth mouse lerping
      mouse.x += (mouse.targetX - mouse.x) * 0.06;
      mouse.y += (mouse.targetY - mouse.y) * 0.06;

      // Frame-rate independent exponential smoothing for fluent, butter-smooth scroll momentum
      const scrollSmooth = 1 - Math.exp(-delta * 7.5);
      currentScrollFraction = THREE.MathUtils.lerp(currentScrollFraction, targetScrollFraction, scrollSmooth);

      // Update botanical world kinematics and bloom with smoothly interpolated scroll
      world.update(delta, elapsedTime, currentScrollFraction);
      // Only trigger React state updates when bloom progress actually animates (eliminates 60fps re-render overhead)
      if (Math.abs(lastProgress - world.bloomProgress) > 0.04 || (world.bloomProgress < 0.99 && lastProgress !== world.bloomProgress)) {
        lastProgress = world.bloomProgress;
        setBloomProgress(world.bloomProgress);
      }

      // Camera Tracking along the vertical botanical tree
      // At scroll = 0: Camera at Y = 3.2 (Hero view on main flower)
      // At scroll = 1: Camera descends to Y = -11.0 (Footer view with roots & branches)
      const baseStartCamY = isMobile ? 2.6 : 3.2;
      const baseStartCamZ = isMobile ? 5.2 : 5.8;
      const targetCamY = THREE.MathUtils.lerp(baseStartCamY, -11.0, currentScrollFraction);
      const targetLookY = THREE.MathUtils.lerp(baseStartCamY, -12.0, currentScrollFraction);
      const targetCamZ = THREE.MathUtils.lerp(baseStartCamZ, 7.2, currentScrollFraction);

      currentCamY = THREE.MathUtils.lerp(currentCamY, targetCamY, scrollSmooth);
      currentLookY = THREE.MathUtils.lerp(currentLookY, targetLookY, scrollSmooth);
      currentCamZ = THREE.MathUtils.lerp(currentCamZ, targetCamZ, scrollSmooth);

      // Subtle 3D parallax on camera
      const parallaxX = mouse.x * 0.45;
      const parallaxY = mouse.y * 0.35;

      camera.position.x = parallaxX;
      camera.position.y = currentCamY + parallaxY;
      camera.position.z = currentCamZ;

      camera.lookAt(new THREE.Vector3(parallaxX * 0.3, currentLookY, 0));

      if (renderModeRef.current === "ascii") {
        if (world.particlesMesh) world.particlesMesh.visible = false;
        asciiPass.render(scene, camera, elapsedTime);
      } else {
        if (world.particlesMesh) world.particlesMesh.visible = true;
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    // Cleanup
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchstart", handleTouchMove);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      asciiPass.dispose();
      asciiPassRef.current = null;
      world.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <>
      {/* Dynamic hardware backdrop layer — decoupled from WebGL canvas */}
      <div
        className="cb-canvas-backdrop fixed inset-0 -z-10 pointer-events-none"
        aria-hidden="true"
      />

      {/* 3D WebGL Canvas with guaranteed transparency */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="fixed inset-0 z-0 w-full h-full pointer-events-none"
        style={{
          background: "transparent",
          willChange: "transform",
          transform: "translateZ(0)",
        }}
      />

      {/* Floating Botanical Experience HUD / Bloom Controller */}
      <div
        className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-40 flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full border border-white/20 bg-black/85 backdrop-blur-xl shadow-[0_0_20px_rgba(255,255,255,0.05)] text-[10px] sm:text-[11px] text-zinc-200 transition-all select-none hover:border-white/40"
        role="region"
        aria-label="Interactive Botanical Bloom Controls"
      >
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#38bdf8] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-[#2aa8ff] shadow-[0_0_6px_#2aa8ff]"></span>
          </span>
          <span className="font-mono tracking-wide font-medium text-white whitespace-nowrap">
            {getStageName(bloomProgress)}
          </span>
        </div>

        <div className="h-3 w-px bg-white/20 mx-0.5" />

        {/* Replay Bloom Button */}
        <button
          type="button"
          onClick={handleReplay}
          className="px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/25 text-white font-medium transition-all text-[9px] sm:text-[10px] flex items-center gap-1 active:scale-95 shadow-[0_0_8px_rgba(0,0,0,0.4)] cursor-pointer whitespace-nowrap"
          title="Replay closed-bud-to-full-bloom transformation"
        >
          <span>↺ Replay</span>
        </button>

        {/* ASCII / Silk Mode Toggle */}
        <button
          type="button"
          onClick={() => {
            const nextMode = renderMode === "ascii" ? "silk" : "ascii";
            renderModeRef.current = nextMode;
            setRenderMode(nextMode);
          }}
          className="px-2 py-0.5 rounded-full bg-[#1d4ed8]/40 hover:bg-[#1d4ed8]/70 border border-[#38bdf8]/40 text-[#93c5fd] hover:text-white font-mono font-medium transition-all text-[9px] sm:text-[10px] flex items-center gap-1 active:scale-95 shadow-[0_0_8px_rgba(37,99,235,0.25)] cursor-pointer whitespace-nowrap"
          title={renderMode === "ascii" ? "Switch to Silk 3D mode" : "Switch to ASCII Code Bloom mode"}
        >
          <span>{renderMode === "ascii" ? "❖ ASCII" : "✦ Silk"}</span>
        </button>

        {/* Interactive Scrub Slider */}
        <div className="hidden xl:flex items-center gap-1 pl-0.5">
          <label htmlFor="bloom-scrubber" className="sr-only">Bloom Progress</label>
          <input
            id="bloom-scrubber"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={bloomProgress}
            onChange={(e) => handleManualBloomChange(parseFloat(e.target.value))}
            className="w-10 sm:w-12 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#2aa8ff]"
            title="Drag to manually inspect any blooming phase"
          />
        </div>
      </div>
    </>
  );
}
