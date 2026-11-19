"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { BotanicalWorld } from "./flower-botanical-system";
import { AsciiPostProcessor } from "./flower-ascii-pass";
import { useTheme } from "@/components/theme-provider";

interface Waypoint {
  p: number;
  posX: number;
  posY: number;
  posZ: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  scale: number;
  camY: number;
  camZ: number;
  lookX: number;
  lookY: number;
}

const WAYPOINTS: Waypoint[] = [
  // 0. Hero (scrollY: 0px, p = 0.000): Majestic, centered, bloom autoplays
  {
    p: 0.000,
    posX: 0.0,
    posY: -1.8,
    posZ: 0.0,
    rotX: 1.44,
    rotY: 0.0,
    rotZ: 0.0,
    scale: 1.0,
    camY: 3.2,
    camZ: 5.8,
    lookX: 0.0,
    lookY: 3.2,
  },
  // 1. Terminal Intro (scrollY: 900px, p = 0.084): Glides smoothly to right to cradle the glass terminal
  {
    p: 0.084,
    posX: 1.45,
    posY: -1.95,
    posZ: -0.45,
    rotX: 1.38,
    rotY: -0.34,
    rotZ: 0.07,
    scale: 0.96,
    camY: 3.05,
    camZ: 5.9,
    lookX: 0.4,
    lookY: 3.05,
  },
  // 2. Story Chapter 1 - Discover (scrollY: 1800px, p = 0.168): Frames right side stage window
  {
    p: 0.168,
    posX: 1.7,
    posY: -1.55,
    posZ: 0.15,
    rotX: 1.50,
    rotY: -0.48,
    rotZ: 0.12,
    scale: 1.08,
    camY: 3.3,
    camZ: 5.5,
    lookX: 0.5,
    lookY: 3.3,
  },
  // 3. Story Chapter 2 - Explore (scrollY: 2800px, p = 0.260): Glides left, zooms in for macro detail!
  {
    p: 0.260,
    posX: -1.45,
    posY: -1.45,
    posZ: 0.65,
    rotX: 1.58,
    rotY: 0.38,
    rotZ: -0.08,
    scale: 1.15,
    camY: 3.4,
    camZ: 5.1,
    lookX: -0.4,
    lookY: 3.4,
  },
  // 4. Story Chapter 3 - Grow (scrollY: 3700px, p = 0.350): Elevates upward, expansive blooming posture
  {
    p: 0.350,
    posX: 1.15,
    posY: -1.25,
    posZ: -0.2,
    rotX: 1.42,
    rotY: -0.22,
    rotZ: 0.04,
    scale: 1.08,
    camY: 3.5,
    camZ: 5.7,
    lookX: 0.3,
    lookY: 3.4,
  },
  // 5. Inside this preview - Numbers (scrollY: 4500px, p = 0.420): Moves to left, shows full stem and leaves
  {
    p: 0.420,
    posX: -1.35,
    posY: -2.1,
    posZ: -0.4,
    rotX: 1.36,
    rotY: 0.28,
    rotZ: -0.05,
    scale: 0.96,
    camY: 2.85,
    camZ: 6.0,
    lookX: -0.35,
    lookY: 2.85,
  },
  // 6. Showcase Works (scrollY: 5800px, p = 0.550): Project cards in view, glides center-right
  {
    p: 0.550,
    posX: 0.8,
    posY: -2.3,
    posZ: -0.6,
    rotX: 1.34,
    rotY: -0.16,
    rotZ: 0.03,
    scale: 0.94,
    camY: 2.7,
    camZ: 6.1,
    lookX: 0.2,
    lookY: 2.7,
  },
  // 7. Footer / Contact Brief (scrollY: 8200px - 10740px, p = 0.760 - 1.000): Grounded broad glowing canopy
  {
    p: 0.760,
    posX: 0.0,
    posY: -2.45,
    posZ: -0.85,
    rotX: 1.30,
    rotY: 0.0,
    rotZ: 0.0,
    scale: 0.90,
    camY: 2.5,
    camZ: 6.2,
    lookX: 0.0,
    lookY: 2.5,
  },
  {
    p: 1.000,
    posX: 0.0,
    posY: -2.55,
    posZ: -0.95,
    rotX: 1.28,
    rotY: 0.0,
    rotZ: 0.0,
    scale: 0.88,
    camY: 2.4,
    camZ: 6.3,
    lookX: 0.0,
    lookY: 2.4,
  },
];

function sampleWaypointTrajectory(progress: number, width: number) {
  const p = Math.max(0, Math.min(1, progress));

  let i = 0;
  while (i < WAYPOINTS.length - 2 && WAYPOINTS[i + 1].p < p) {
    i++;
  }
  const w0 = WAYPOINTS[i];
  const w1 = WAYPOINTS[i + 1];

  const span = Math.max(0.0001, w1.p - w0.p);
  const t = Math.max(0, Math.min(1, (p - w0.p) / span));
  // Smoothstep S-curve for C1 continuity
  const s = t * t * (3 - 2 * t);

  // Responsive factors: gracefully scale down X translation on narrower mobile displays
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const xFactor = isMobile ? 0.28 : isTablet ? 0.65 : 1.0;
  const mobileYOffset = isMobile ? -0.45 : 0;
  const mobileZOffset = isMobile ? -0.35 : 0;
  const mobileScale = isMobile ? 0.78 : 1.0;

  const posX = THREE.MathUtils.lerp(w0.posX, w1.posX, s) * xFactor;
  const posY = THREE.MathUtils.lerp(w0.posY, w1.posY, s) + mobileYOffset;
  const posZ = THREE.MathUtils.lerp(w0.posZ, w1.posZ, s) + mobileZOffset;

  const rotX = THREE.MathUtils.lerp(w0.rotX, w1.rotX, s);
  const rotY = THREE.MathUtils.lerp(w0.rotY, w1.rotY, s) * xFactor;
  const rotZ = THREE.MathUtils.lerp(w0.rotZ, w1.rotZ, s) * xFactor;

  const scale = THREE.MathUtils.lerp(w0.scale, w1.scale, s) * mobileScale;

  const camY = THREE.MathUtils.lerp(w0.camY, w1.camY, s) + mobileYOffset * 0.8;
  const camZ = THREE.MathUtils.lerp(w0.camZ, w1.camZ, s) + (isMobile ? -0.4 : 0);
  const lookX = THREE.MathUtils.lerp(w0.lookX, w1.lookX, s) * xFactor * 0.6;
  const lookY = THREE.MathUtils.lerp(w0.lookY, w1.lookY, s) + mobileYOffset * 0.8;

  return { posX, posY, posZ, rotX, rotY, rotZ, scale, camY, camZ, lookX, lookY };
}

export function FlowerScene() {
  const { theme } = useTheme();
  const themeRef = useRef(theme);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<BotanicalWorld | null>(null);
  const asciiPassRef = useRef<AsciiPostProcessor | null>(null);
  const [bloomProgress, setBloomProgress] = useState(0.0);
  const lastStageRef = useRef<string>("Stage 1: Bud");
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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
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
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
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
      const currentDpr = Math.min(window.devicePixelRatio || 1, 1.5);
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

    // Smoothed state variables
    let currPosX = 0;
    let currPosY = isMobileInitial ? -2.25 : -1.8;
    let currPosZ = 0;
    let currRotX = 1.44;
    let currRotY = 0;
    let currRotZ = 0;
    let currScale = isMobileInitial ? 0.78 : 1.0;
    let currCamY = isMobileInitial ? 2.7 : 3.2;
    let currCamZ = isMobileInitial ? 5.4 : 5.8;
    let currLookX = 0;
    let currLookY = isMobileInitial ? 2.7 : 3.2;

    const flowerWorldPos = new THREE.Vector3();

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

      // Sample waypoint targets for current scroll
      const wp = sampleWaypointTrajectory(currentScrollFraction, window.innerWidth);

      // Exponentially damp all position and rotation transforms
      currPosX = THREE.MathUtils.lerp(currPosX, wp.posX, scrollSmooth);
      currPosY = THREE.MathUtils.lerp(currPosY, wp.posY, scrollSmooth);
      currPosZ = THREE.MathUtils.lerp(currPosZ, wp.posZ, scrollSmooth);
      currRotX = THREE.MathUtils.lerp(currRotX, wp.rotX, scrollSmooth);
      currRotY = THREE.MathUtils.lerp(currRotY, wp.rotY, scrollSmooth);
      currRotZ = THREE.MathUtils.lerp(currRotZ, wp.rotZ, scrollSmooth);
      currScale = THREE.MathUtils.lerp(currScale, wp.scale, scrollSmooth);
      currCamY = THREE.MathUtils.lerp(currCamY, wp.camY, scrollSmooth);
      currCamZ = THREE.MathUtils.lerp(currCamZ, wp.camZ, scrollSmooth);
      currLookX = THREE.MathUtils.lerp(currLookX, wp.lookX, scrollSmooth);
      currLookY = THREE.MathUtils.lerp(currLookY, wp.lookY, scrollSmooth);

      // Apply to world root group (translating and rotating the entire botanical system organically)
      world.rootGroup.position.set(currPosX, currPosY, currPosZ);
      world.rootGroup.rotation.set(currRotX - 1.44, currRotY, currRotZ);
      world.rootGroup.scale.set(currScale, currScale, currScale);

      // Update botanical world kinematics and bloom with smoothly interpolated scroll
      world.update(delta, elapsedTime, currentScrollFraction);

      // Update HUD stage text only when the stage changes (prevents 60fps React re-renders)
      const stage = getStageName(world.bloomProgress);
      if (stage !== lastStageRef.current) {
        lastStageRef.current = stage;
        setBloomProgress(world.bloomProgress);
      }

      // Subtle 3D parallax on camera
      const parallaxX = mouse.x * 0.35;
      const parallaxY = mouse.y * 0.25;

      camera.position.x = parallaxX;
      camera.position.y = currCamY + parallaxY;
      camera.position.z = currCamZ;

      camera.lookAt(new THREE.Vector3(currLookX + parallaxX * 0.2, currLookY + parallaxY * 0.2, 0));

      if (renderModeRef.current === "ascii") {
        if (world.particlesMesh) world.particlesMesh.visible = false;
        // Project flower center into screen coordinates to anchor ASCII core lighting & highlights
        world.mainFlowerGroup.getWorldPosition(flowerWorldPos);
        flowerWorldPos.project(camera);
        const screenX = flowerWorldPos.x * 0.5 + 0.5;
        const screenY = flowerWorldPos.y * 0.5 + 0.5;
        asciiPass.setFlowerScreenPosition(screenX, screenY);
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
