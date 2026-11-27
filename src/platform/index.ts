import type { FeedbackKind } from "../art/index.ts";

const tones: Record<FeedbackKind, [number, number]> = {
  damage: [110, 70],
  deposit: [440, 660],
  disabled: [180, 80],
  hit: [230, 160],
  pickup: [520, 780],
  teleport: [160, 640],
};

/** The audio context is created only from a browser user gesture. */
export class FeedbackSound {
  enabled = true;
  private context: AudioContext | undefined;
  private lastSound = -Infinity;
  private disposed = false;

  unlock = (): void => {
    if (this.disposed || !this.enabled || typeof AudioContext === "undefined") {
      return;
    }
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => undefined);
    } catch {
      // Visual feedback remains available when the browser cannot open audio.
      this.context = undefined;
    }
  };

  play(kinds: readonly FeedbackKind[]): void {
    const context = this.context;
    if (
      !this.enabled ||
      !context ||
      context.state !== "running" ||
      context.currentTime - this.lastSound < 0.12
    ) {
      return;
    }
    const kind = kinds.find((kind) => kind === "damage") ?? kinds[0];
    if (!kind) {
      return;
    }
    this.lastSound = context.currentTime;
    const [start, end] = tones[kind];
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(start, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(end, context.currentTime + 0.09);
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(0.025, context.currentTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.12);
    oscillator.connect(gain).connect(context.destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start();
    oscillator.stop(context.currentTime + 0.13);
  }

  dispose(): void {
    this.disposed = true;
    void this.context?.close().catch(() => undefined);
  }
}
