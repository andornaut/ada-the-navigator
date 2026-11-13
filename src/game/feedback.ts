import { wreckId } from "../model/flight.ts";
import { archivedObjectIds } from "../model/geography.ts";
import type { GameState, Vec } from "../model/types.ts";

/** A frame-to-frame jump of Ada's ship farther than this, in world units, reads as a teleport. */
export const TELEPORT_DISTANCE = 20;

export type FeedbackKind = "hit" | "disabled" | "damage" | "pickup" | "deposit" | "teleport";
export interface FeedbackPulse extends Vec {
  /** A static presentation cue after the model has committed an emergency return. */
  compromised?: true;
  kind: FeedbackKind;
  age: number;
}
interface Snapshot {
  seed: number;
  galaxy: number;
  player: Vec;
  shield: number;
  cargo: number;
  weapon: string;
  stardust: number;
  deposited: number;
  destroyedEnemies: number;
  impacts: Set<string>;
  objects: Map<string, { enemy: boolean; hp: number; parts: Map<string, number>; point: Vec }>;
}

/** Snapshots copy mutable model values so a later frame can compare actual changes. */
export class ModelFeedback {
  readonly pulses: FeedbackPulse[] = [];
  private previous: Snapshot | undefined;

  advance(seconds: number): void {
    for (const pulse of this.pulses) {
      pulse.age += seconds;
    }
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      if (this.pulses[i]!.age > 0.65) {
        this.pulses.splice(i, 1);
      }
    }
  }

  /** A confirmed inventory transaction starts a new baseline without a flight pickup pulse. */
  baseline(state: GameState): void {
    this.previous = undefined;
    this.observe(TELEPORT_DISTANCE, state);
  }

  observe(teleportDistance: number, state: GameState): FeedbackKind[] {
    const flight = state.flight;
    const previous = this.previous;
    if (!flight || state.mode !== "space") {
      this.previous = undefined;
      this.pulses.length = 0;
      return [];
    }
    const next: Snapshot = {
      cargo: flight.cargo,
      deposited: state.progress[flight.galaxy].deposited,
      destroyedEnemies: state.progress[flight.galaxy].destroyedEnemies,
      galaxy: flight.galaxy,
      impacts: new Set(flight.shots.flatMap((shot) => shot.hitIds.map((id) => `${shot.id}:${id}`))),
      objects: new Map(
        flight.objects.map((object) => [
          object.id,
          {
            enemy: object.kind === "enemy",
            hp: object.hp,
            parts: new Map(object.enemy?.hardpoints.map((part) => [part.id, part.hp]) ?? []),
            point: { x: object.x, y: object.y },
          },
        ]),
      ),
      player: { ...flight.player },
      seed: flight.seed,
      shield: flight.shield,
      stardust: state.economy.stardust,
      weapon: flight.weapon,
    };
    this.previous = next;
    if (!previous || previous.seed !== next.seed || previous.galaxy !== next.galaxy) {
      this.pulses.length = 0;
      return [];
    }
    const events = new Set<FeedbackKind>();
    const emit = (kind: FeedbackKind, point: Vec) => {
      events.add(kind);
      this.pulses.push({ ...point, age: 0, kind });
    };
    // A destroyed enemy's destruction art replaces its markers: the cue sounds, no bracket.
    const destroyed = (id: string, kind: FeedbackKind, point: Vec) => {
      if (kind === "disabled" && next.objects.has(wreckId(id))) {
        events.add(kind);
        return;
      }
      emit(kind, point);
    };
    // Shield recharge shows only on the shield bar.
    if (next.shield < previous.shield) {
      emit("damage", next.player);
    }
    if (
      next.cargo > previous.cargo ||
      next.stardust > previous.stardust ||
      (next.weapon !== "laser" && next.weapon !== previous.weapon)
    ) {
      emit("pickup", next.player);
    }
    if (next.deposited > previous.deposited) {
      emit("deposit", next.player);
    }
    if (
      Math.hypot(next.player.x - previous.player.x, next.player.y - previous.player.y) >
      teleportDistance
    ) {
      emit("teleport", next.player);
    }
    for (const [id, object] of next.objects) {
      const before = previous.objects.get(id);
      if (!before) {
        continue;
      }
      let hit = object.hp < before.hp;
      let disabled = false;
      for (const [part, hp] of object.parts) {
        const oldHp = before.parts.get(part);
        hit ||= oldHp !== undefined && hp < oldHp;
        disabled ||= oldHp !== undefined && oldHp > 0 && hp <= 0;
      }
      if (hit) {
        destroyed(id, disabled || object.hp <= 0 ? "disabled" : "hit", object.point);
      }
    }
    let removedDestroyed = Math.max(0, next.destroyedEnemies - previous.destroyedEnemies);
    const archived = archivedObjectIds(flight);
    for (const [id, before] of previous.objects) {
      if (next.objects.has(id) || archived.has(id)) {
        continue;
      }
      if (before.enemy && removedDestroyed > 0) {
        destroyed(id, "disabled", before.point);
        removedDestroyed--;
      } else if (
        flight.shots.some(
          (shot) => shot.hitIds.includes(id) && !previous.impacts.has(`${shot.id}:${id}`),
        )
      ) {
        emit("hit", before.point);
      }
    }
    // Bound effects even when many objects take damage in one frame.
    this.pulses.splice(0, Math.max(0, this.pulses.length - 48));
    return [...events];
  }
}

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
