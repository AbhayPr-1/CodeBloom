import { afterEach, describe, expect, it, vi } from "vitest";
import { sound } from "@/components/landing-sound";

afterEach(() => {
  sound.setEnabled(true);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("landing story sound motifs", () => {
  it("starts enabled by default", () => {
    expect(sound.isEnabled()).toBe(true);
  });
  it("does not schedule chapter audio while the sound toggle is off", () => {
    vi.useFakeTimers();
    const playChirp = vi.spyOn(
      sound as unknown as { playChirp: (frequency: number, duration: number, waveform: OscillatorType, gain: number) => void },
      "playChirp",
    );

    sound.setEnabled(false);
    sound.playStoryTransition(1);
    vi.runAllTimers();

    expect(playChirp).not.toHaveBeenCalled();
  });

  it("plays a short, distinct procedural motif for each chapter when enabled", () => {
    vi.useFakeTimers();
    const playChirp = vi.spyOn(
      sound as unknown as { playChirp: (frequency: number, duration: number, waveform: OscillatorType, gain: number) => void },
      "playChirp",
    );
    sound.setEnabled(true);

    const motifs = [
      [[587.33, 0.055, "sine", 0.045], [880, 0.055, "sine", 0.045]],
      [[740, 0.055, "triangle", 0.045], [587.33, 0.055, "sine", 0.045]],
      [[523.25, 0.055, "sine", 0.045], [659.25, 0.055, "sine", 0.045], [783.99, 0.055, "sine", 0.045]],
    ] as const;

    motifs.forEach((expected, chapterIndex) => {
      sound.playStoryTransition(chapterIndex);
      vi.runAllTimers();
      expect(playChirp.mock.calls).toEqual(expected);
      playChirp.mockClear();
    });
  });
});
