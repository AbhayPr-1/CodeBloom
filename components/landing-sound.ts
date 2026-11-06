// Web Audio API procedural sound engine for CodeBloom landing page
// Operates entirely locally with zero external audio files

class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private humOsc: OscillatorNode | null = null;
  private humGain: GainNode | null = null;

  constructor() {
    // Enabled by default; audio context unlocks on user gesture
  }

  public initAudio() {
    this.initContext();
  }

  private initContext() {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.initContext();
      this.playChirp(880, 0.08, "sine");
    } else {
      this.stopHum();
    }
    return this.enabled;
  }

  public setEnabled(val: boolean) {
    this.enabled = val;
    if (this.enabled) {
      this.initContext();
    } else {
      this.stopHum();
    }
  }

  public playClick() {
    if (!this.enabled) return;
    this.playChirp(1200, 0.03, "triangle", 0.08);
  }

  public playThemeSwitch(isDark: boolean) {
    if (!this.enabled) return;
    if (isDark) {
      // Gentle deep atmospheric tone for dark mode
      this.playChirp(659.25, 0.1, "sine", 0.07);
      setTimeout(() => {
        if (this.enabled) this.playChirp(440, 0.18, "sine", 0.06);
      }, 60);
    } else {
      // Radiant luminous tone for light mode
      this.playChirp(440, 0.1, "sine", 0.07);
      setTimeout(() => {
        if (this.enabled) this.playChirp(659.25, 0.18, "sine", 0.06);
      }, 60);
    }
  }

  public playStoryTransition(chapterIndex: number) {
    if (!this.enabled) return;

    const motifs: ReadonlyArray<ReadonlyArray<{ frequency: number; delay: number; waveform: OscillatorType }>> = [
      [
        { frequency: 587.33, delay: 0, waveform: "sine" },
        { frequency: 880, delay: 72, waveform: "sine" },
      ],
      [
        { frequency: 740, delay: 0, waveform: "triangle" },
        { frequency: 587.33, delay: 86, waveform: "sine" },
      ],
      [
        { frequency: 523.25, delay: 0, waveform: "sine" },
        { frequency: 659.25, delay: 64, waveform: "sine" },
        { frequency: 783.99, delay: 128, waveform: "sine" },
      ],
    ];
    const motif = motifs[chapterIndex];
    if (!motif) return;

    motif.forEach(({ frequency, delay, waveform }) => {
      setTimeout(() => {
        if (this.enabled) this.playChirp(frequency, 0.055, waveform, 0.045);
      }, delay);
    });
  }

  public playBlip(freq = 640) {
    if (!this.enabled) return;
    this.playChirp(freq, 0.05, "sine", 0.1);
  }

  public playConnect() {
    if (!this.enabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const chords = [440, 554.37, 659.25, 880]; // A major chord
    chords.forEach((freq, index) => {
      setTimeout(() => {
        this.playChirp(freq, 0.35, "sine", 0.12);
      }, index * 60);
    });
  }

  public playSuccess() {
    if (!this.enabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C major arpeggio
    notes.forEach((freq, index) => {
      setTimeout(() => {
        this.playChirp(freq, 0.28, "sine", 0.1);
      }, index * 70);
    });
  }

  public startHum() {
    if (!this.enabled) return;
    const ctx = this.initContext();
    if (!ctx || this.humOsc) return;

    try {
      this.humOsc = ctx.createOscillator();
      this.humGain = ctx.createGain();
      this.humOsc.type = "sine";
      this.humOsc.frequency.setValueAtTime(55, ctx.currentTime); // Low A hum
      this.humGain.gain.setValueAtTime(0.015, ctx.currentTime);
      this.humOsc.connect(this.humGain);
      this.humGain.connect(ctx.destination);
      this.humOsc.start();
    } catch {
      // Ignore audio error
    }
  }

  public stopHum() {
    if (this.humOsc) {
      try {
        this.humOsc.stop();
        this.humOsc.disconnect();
      } catch {
        // Ignore
      }
      this.humOsc = null;
      this.humGain = null;
    }
  }

  private playChirp(freq: number, duration: number, type: OscillatorType = "sine", maxGain = 0.15) {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(maxGain, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio autoplay policy or inactive context
    }
  }
}

export const sound = new SoundEngine();
