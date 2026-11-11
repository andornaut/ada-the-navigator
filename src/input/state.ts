import { createModalInputGate, type ModalInputScope } from "@andornaut/game-kit/input/modalInput";

import { TOUCH_STICK } from "../ui/layout/touchControls.ts";

export interface Vector {
  readonly x: number;
  readonly y: number;
}

export interface ControlSample {
  readonly aim: Vector;
  readonly move: Vector;
  readonly use: boolean;
}

export type StickSide = "aim" | "move";

interface Stick {
  readonly origin: Vector;
  readonly pointerId: number;
  readonly position: Vector;
}

export interface StickGeometry {
  readonly deadZone: number;
  readonly reach: number;
}

// Native 75px ring frame, with a radial dead zone and bounded thumb travel. Both sticks measure
// travel in logical px, so their reach scales with the view.
export const STICK_GEOMETRY: StickGeometry = { deadZone: 6, reach: 37 };
export const MOVE_STICK_GEOMETRY: StickGeometry = {
  deadZone: TOUCH_STICK.moveDeadZone,
  reach: TOUCH_STICK.moveReach,
};

function bounded(vector: Vector): Vector {
  const length = Math.hypot(vector.x, vector.y);
  const divisor = Math.max(1, length);
  return { x: vector.x / divisor, y: vector.y / divisor };
}

export function stickVector(geometry: StickGeometry, offset: Vector): Vector {
  const length = Math.hypot(offset.x, offset.y);
  if (length <= geometry.deadZone) {
    return { x: 0, y: 0 };
  }
  const strength = Math.min(1, (length - geometry.deadZone) / (geometry.reach - geometry.deadZone));
  return { x: (offset.x / length) * strength, y: (offset.y / length) * strength };
}

export class ControlState {
  private readonly gate = createModalInputGate();
  private readonly keys = new Set<string>();
  private readonly sticks = new Map<StickSide, Stick>();
  private readonly geometry: StickGeometry;
  private modal: ModalInputScope | undefined;
  private enabled = true;
  private useAvailable = false;
  private usePending = false;

  constructor(geometry: StickGeometry = STICK_GEOMETRY) {
    if (
      !Number.isFinite(geometry.reach) ||
      !Number.isFinite(geometry.deadZone) ||
      geometry.deadZone < 0 ||
      geometry.reach <= geometry.deadZone
    ) {
      throw new Error("Invalid stick geometry");
    }
    this.geometry = geometry;
  }

  accepts(): boolean {
    return this.enabled && this.gate.accepts();
  }

  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) {
      return;
    }
    this.enabled = enabled;
    this.reset();
  }

  setUseAvailable(available: boolean): void {
    this.useAvailable = available;
    if (!available) {
      this.usePending = false;
    }
  }

  requestUse(): void {
    if (this.accepts() && this.useAvailable) {
      this.usePending = true;
    }
  }

  keyDown(code: string, repeat = false): void {
    if (!this.accepts() || (repeat && !this.keys.has(code))) {
      return;
    }
    if (code === "Space" && !repeat && !this.keys.has(code)) {
      this.requestUse();
    }
    this.keys.add(code);
  }

  keyUp(code: string): void {
    this.keys.delete(code);
  }

  down(side: StickSide, pointerId: number, at: Vector): void {
    if (
      !this.accepts() ||
      this.sticks.has(side) ||
      [...this.sticks.values()].some((stick) => stick.pointerId === pointerId)
    ) {
      return;
    }
    this.sticks.set(side, { origin: at, pointerId, position: at });
  }

  move(pointerId: number, at: Vector): void {
    if (!this.accepts()) {
      return;
    }
    for (const [side, stick] of this.sticks) {
      if (stick.pointerId === pointerId) {
        this.sticks.set(side, { ...stick, position: at });
      }
    }
  }

  release(pointerId: number): void {
    for (const [side, stick] of this.sticks) {
      if (stick.pointerId === pointerId) {
        this.sticks.delete(side);
      }
    }
  }

  stick(side: StickSide): Readonly<Stick> | undefined {
    return this.sticks.get(side);
  }

  stickSample(side: StickSide): Vector {
    const stick = this.sticks.get(side);
    if (!stick) {
      return { x: 0, y: 0 };
    }
    const offset = {
      x: stick.position.x - stick.origin.x,
      y: stick.position.y - stick.origin.y,
    };
    return stickVector(side === "aim" ? this.geometry : MOVE_STICK_GEOMETRY, offset);
  }

  openModal(): void {
    this.modal ??= this.gate.open();
    this.reset();
  }

  closeModal(): void {
    this.modal?.close();
    this.modal = undefined;
    this.reset();
  }

  reset(): void {
    this.keys.clear();
    this.sticks.clear();
    this.usePending = false;
  }

  sample(): ControlSample {
    if (!this.accepts()) {
      return { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
    }
    const sample = {
      aim: this.vector("aim", ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]),
      move: this.vector("move", ["KeyA", "KeyD", "KeyW", "KeyS"]),
      use: this.usePending,
    };
    this.usePending = false;
    return sample;
  }

  private vector(side: StickSide, codes: readonly [string, string, string, string]): Vector {
    const [left, right, up, down] = codes;
    const keyboard = {
      x: Number(this.keys.has(right)) - Number(this.keys.has(left)),
      y: Number(this.keys.has(down)) - Number(this.keys.has(up)),
    };
    const touch = this.stickSample(side);
    return bounded({ x: keyboard.x + touch.x, y: keyboard.y + touch.y });
  }
}
