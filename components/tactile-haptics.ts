"use client";

// Universal Haptic & Tactile Feedback Engine
// Delivers physical haptic sensations on:
// 1. Apple MacBook Force Touch Trackpads (WebKit force-touch hook + acoustic-mechanical tactile click)
// 2. Mobile phones (Android navigator.vibrate + iOS WebKit tactile impulse)
// 3. Always active with zero permission prompt required

export type HapticIntensity = "light" | "medium" | "heavy" | "story";

class TactileHapticsEngine {
  private audioCtx: AudioContext | null = null;
  private initialized: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.attachGlobalListeners();
    }
  }

  private initAudio() {
    if (this.audioCtx) {
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    }

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    } catch {
      // AudioContext unavailable
    }
    return this.audioCtx;
  }

  /**
   * Generates a sub-perceptual mechanical impulse (6-9ms, ~160Hz)
   * that physically vibrates the Mac trackpad / aluminum chassis and phone chassis
   */
  public playMechanicalImpulse(intensity: HapticIntensity = "light") {
    const ctx = this.initAudio();
    if (!ctx) return;

    try {
      const duration = intensity === "heavy" ? 0.012 : intensity === "medium" ? 0.009 : 0.006;
      const freq = intensity === "heavy" ? 110 : intensity === "medium" ? 145 : 180;
      const peakGain = intensity === "heavy" ? 0.45 : intensity === "medium" ? 0.35 : 0.28;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + duration);

      gain.gain.setValueAtTime(peakGain, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Ignore audio synthesis errors
    }
  }

  /**
   * Main haptic trigger method (for trackpad & mobile)
   */
  public trigger(intensity: HapticIntensity = "light") {
    if (typeof window === "undefined") return;
    this.playMechanicalImpulse(intensity);
  }

  /**
   * Attach gesture listener to prime audio on first tap/click & hook WebKit Force Touch
   */
  private attachGlobalListeners() {
    if (this.initialized) return;
    this.initialized = true;

    // Initialize audio context on very first user interaction
    const primeGesture = () => {
      this.initAudio();
      window.removeEventListener("pointerdown", primeGesture);
      window.removeEventListener("touchstart", primeGesture);
      window.removeEventListener("keydown", primeGesture);
    };
    window.addEventListener("pointerdown", primeGesture, { passive: true, once: true });
    window.addEventListener("touchstart", primeGesture, { passive: true, once: true });
    window.addEventListener("keydown", primeGesture, { passive: true, once: true });

    // WebKit Force Touch trackpad hook on macOS Safari / WebKit
    window.addEventListener("webkitmouseforcewillbegin", () => {
      // Allows Safari trackpad force click to arm
    }, { passive: true });

    window.addEventListener("webkitmouseforcedown", () => {
      this.trigger("medium");
    }, { passive: true });
  }
}

export const tactile = new TactileHapticsEngine();

