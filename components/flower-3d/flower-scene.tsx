/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { BotanicalWorld } from "./flower-botanical-system";
import { useTheme } from "@/components/theme-provider";

export function FlowerScene() {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<BotanicalWorld | null>(null);
  const [bloomProgress, setBloomProgress] = useState(0.0);
  const [isInteractiveManual, setIsInteractiveManual] = useState(false);

  // Derive current blooming stage name for HUD
  const getStageName = (p: number) => {
    if (p < 0.15) return "Stage 1: Closed Bud";
    if (p < 0.35) return "Stage 2: Stem Growth";
    if (p < 0.60) return "Stage 3: Budding Branches";
    if (p < 0.88) return "Stage 4: Main Petal Bloom";
    return "Stage 5: Full Radiant Bloom";
  };

  // Synchronize 3D botanical world lighting with the active theme
  useEffect(() => {
    worldRef.current?.setTheme(theme);
  }, [theme]);

  const handleReplay = useCallback(() => {
    if (worldRef.current) {
      setIsInteractiveManual(false);
      worldRef.current.replayBloom();
    }
  }, []);

  const handleManualBloomChange = useCallback((value: number) => {
    if (worldRef.current) {
      setIsInteractiveManual(true);
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
        powerPreference: "high-performance",
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

    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    // Initial camera position centered on main flower at Y = 3.2
    camera.position.set(0, 3.2, 5.8);

    // 3. Botanical World Setup
    const world = new BotanicalWorld();
    world.setTheme(theme);
    worldRef.current = world;
    scene.add(world.rootGroup);

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
    let scrollFraction = 0;
    const handleScroll = () => {
      const maxScroll = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight
      );
      scrollFraction = Math.max(0, Math.min(1, window.scrollY / maxScroll));
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    // 6. Window Resize
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      camera.aspect = width / height;
      // Adjust FOV for narrower mobile screens so flower remains centered and grand
      camera.fov = width < 768 ? 58 : 45;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", handleResize);
    handleResize();

    // 7. Animation Loop
    let animationFrameId: number;
    const timer = new THREE.Timer();
    timer.connect(document);
    let currentCamY = 3.2;
    let currentLookY = 3.2;
    let lastProgress = 0.0;

    const animate = () => {
      timer.update();
      const delta = Math.min(0.1, timer.getDelta());
      const elapsedTime = timer.getElapsed();

      // Smooth mouse lerping
      mouse.x += (mouse.targetX - mouse.x) * 0.06;
      mouse.y += (mouse.targetY - mouse.y) * 0.06;

      // Update botanical world kinematics and bloom
      world.update(delta, elapsedTime, scrollFraction);
      // Only trigger React state updates when bloom progress actually animates (eliminates 60fps re-render overhead)
      if (Math.abs(lastProgress - world.bloomProgress) > 0.04 || (world.bloomProgress < 0.99 && lastProgress !== world.bloomProgress)) {
        lastProgress = world.bloomProgress;
        setBloomProgress(world.bloomProgress);
      }

      // Camera Tracking along the vertical botanical tree
      // At scroll = 0: Camera at Y = 3.2 (Hero view on main flower)
      // At scroll = 1: Camera descends to Y = -11.5 (Footer view with roots & branches)
      const targetCamY = THREE.MathUtils.lerp(3.2, -11.0, scrollFraction);
      const targetLookY = THREE.MathUtils.lerp(3.2, -12.0, scrollFraction);

      currentCamY = THREE.MathUtils.lerp(currentCamY, targetCamY, 0.06);
      currentLookY = THREE.MathUtils.lerp(currentLookY, targetLookY, 0.06);

      // Subtle 3D parallax on camera
      const parallaxX = mouse.x * 0.45;
      const parallaxY = mouse.y * 0.35;

      camera.position.x = parallaxX;
      camera.position.y = currentCamY + parallaxY;
      // Slightly back away as we descend to view wider branch span
      camera.position.z = THREE.MathUtils.lerp(5.8, 7.2, scrollFraction);

      camera.lookAt(new THREE.Vector3(parallaxX * 0.3, currentLookY, 0));

      renderer.render(scene, camera);
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
      timer.dispose();
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
        }}
      />

      {/* Floating Botanical Experience HUD / Bloom Controller */}
      <div
        className="fixed bottom-6 right-6 z-40 flex items-center gap-3 px-4 py-2.5 rounded-full border border-[#7a4458]/45 bg-[#1e0c14]/92 backdrop-blur-xl shadow-[0_0_22px_rgba(0,0,0,0.32)] text-xs text-[#ded0d5] transition-all select-none hover:border-[#a06880]/60"
        role="region"
        aria-label="Interactive Botanical Bloom Controls"
      >
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#d84878] opacity-35"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#d84878]"></span>
          </span>
          <span className="font-mono tracking-wider font-semibold text-[#e8b0c8]">
            {getStageName(bloomProgress)}
          </span>
        </div>

        <div className="h-4 w-px bg-white/20 mx-1" />

        {/* Replay Bloom Button */}
        <button
          type="button"
          onClick={handleReplay}
          className="px-2.5 py-1 rounded-full bg-[#3a1020]/70 hover:bg-[#5a1830]/80 border border-[#a06080]/45 text-[#f1f2f4] font-medium transition-all text-[11px] flex items-center gap-1 active:scale-95 shadow-[0_0_12px_rgba(0,0,0,0.25)]"
          title="Replay closed-bud-to-full-bloom transformation"
        >
          <span>↺ Replay Bloom</span>
        </button>

        {/* Interactive Scrub Slider */}
        <div className="hidden sm:flex items-center gap-1.5 pl-1">
          <label htmlFor="bloom-scrubber" className="sr-only">Bloom Progress</label>
          <input
            id="bloom-scrubber"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={bloomProgress}
            onChange={(e) => handleManualBloomChange(parseFloat(e.target.value))}
            className="w-16 h-1.5 bg-[#3a1020] rounded-lg appearance-none cursor-pointer accent-[#d84878]"
            title="Drag to manually inspect any blooming phase"
          />
        </div>
      </div>
    </>
  );
}
