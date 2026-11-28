import type { Vector } from "./state.ts";

export const DESKTOP_SHIFT_THROTTLE = 0.2;

/** Desktop directions are measured in logical screen coordinates, before world projection. */
export interface DesktopFrame {
  readonly ship: Vector;
}

export interface DesktopSample {
  readonly aim: Vector;
  readonly fire: boolean;
  readonly move: Vector;
  readonly turn: -1 | 0 | 1;
}

type DesktopTrigger = "held" | "held-and-press" | "press";
type DesktopContext = "flight" | "menu";

interface DesktopBindingDescriptor {
  readonly keys?: readonly string[];
  readonly mouseButtons?: readonly number[];
  readonly trigger: DesktopTrigger;
}

/** Physical inputs in the flight context. Foreground menu aliases belong to their own router. */
export const DESKTOP_FLIGHT_BINDINGS = {
  aimFire: { mouseButtons: [0], trigger: "held-and-press" },
  moveEast: { keys: ["KeyD", "ArrowRight"], trigger: "held" },
  moveNorth: { keys: ["KeyW", "ArrowUp"], trigger: "held" },
  moveSouth: { keys: ["KeyS", "ArrowDown"], trigger: "held" },
  moveWest: { keys: ["KeyA", "ArrowLeft"], trigger: "held" },
  noseFire: { keys: ["Space"], trigger: "held-and-press" },
  slow: { keys: ["ShiftLeft", "ShiftRight"], trigger: "held" },
  turnLeft: { keys: ["KeyH"], trigger: "held" },
  turnRight: { keys: ["KeyL"], trigger: "held" },
  use: { keys: ["Enter", "KeyE", "KeyF"], mouseButtons: [2], trigger: "press" },
} as const satisfies Readonly<Record<string, DesktopBindingDescriptor>>;

/** Ada's physical menu shortcuts. Game Kit supplies the common foreground aliases. */
export const DESKTOP_MENU_BINDINGS = {
  exit: { keys: ["KeyQ"], trigger: "press" },
} as const satisfies Readonly<Record<string, DesktopBindingDescriptor>>;

function register<Input extends string | number>(
  index: Map<Input, DesktopBindingDescriptor>,
  context: DesktopContext,
  inputs: readonly Input[] | undefined,
  binding: DesktopBindingDescriptor,
  source: "key" | "mouse button",
): void {
  for (const input of inputs ?? []) {
    if (index.has(input)) {
      throw new Error(`Duplicate ${context} ${source}: ${input}`);
    }
    index.set(input, binding);
  }
}

export function indexDesktopBindings(
  context: DesktopContext,
  bindings: Readonly<Record<string, DesktopBindingDescriptor>>,
): {
  readonly keys: ReadonlyMap<string, DesktopBindingDescriptor>;
  readonly mouseButtons: ReadonlyMap<number, DesktopBindingDescriptor>;
} {
  const keys = new Map<string, DesktopBindingDescriptor>();
  const mouseButtons = new Map<number, DesktopBindingDescriptor>();
  for (const binding of Object.values(bindings)) {
    register(keys, context, binding.keys, binding, "key");
    register(mouseButtons, context, binding.mouseButtons, binding, "mouse button");
  }
  return { keys, mouseButtons };
}

export const flightBindings = indexDesktopBindings("flight", DESKTOP_FLIGHT_BINDINGS);
const menuBindings = indexDesktopBindings("menu", DESKTOP_MENU_BINDINGS);

export function isMenuExitKey(event: Pick<KeyboardEvent, "code" | "repeat">): boolean {
  return !event.repeat && menuBindings.keys.get(event.code) === DESKTOP_MENU_BINDINGS.exit;
}

export function acceptsDesktopKeyDown(
  event: Pick<KeyboardEvent, "altKey" | "ctrlKey" | "defaultPrevented" | "isComposing" | "metaKey">,
): boolean {
  return !(
    event.defaultPrevented ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.isComposing
  );
}

const zero = (): Vector => ({ x: 0, y: 0 });
const unit = (vector: Vector): Vector => {
  const length = Math.hypot(vector.x, vector.y);
  return length ? { x: vector.x / length, y: vector.y / length } : zero();
};

/** The existing modal gate controls admission; callers reset on focus, mode and modal changes. */
export class DesktopControlState {
  private readonly accepts: () => boolean;
  private readonly keys = new Set<string>();
  private readonly buttons = new Set<number>();
  private pointer: { readonly id: number; readonly position: Vector } | undefined;
  private pendingAim: Vector | undefined;
  private pendingNoseFire = false;

  constructor(accepts: () => boolean) {
    this.accepts = accepts;
  }

  keyDown(code: string, repeat = false): boolean {
    const binding = flightBindings.keys.get(code);
    if (!this.accepts() || binding === undefined || this.keys.has(code) || repeat) {
      return false;
    }
    this.keys.add(code);
    if (binding.trigger === "held-and-press") {
      this.pendingNoseFire = true;
    }
    return true;
  }

  keyUp(code: string): void {
    this.keys.delete(code);
  }

  down(button: number, pointerId: number, point: Vector): boolean {
    const binding = flightBindings.mouseButtons.get(button);
    if (
      !this.accepts() ||
      binding === undefined ||
      this.buttons.has(button) ||
      (this.pointer && this.pointer.id !== pointerId)
    ) {
      return false;
    }
    const position = { ...point };
    this.pointer = { id: pointerId, position };
    this.buttons.add(button);
    if (binding.trigger === "held-and-press") {
      this.pendingAim = position;
    }
    return true;
  }

  move(pointerId: number, point: Vector): void {
    if (this.accepts() && this.pointer?.id === pointerId) {
      this.pointer = { id: pointerId, position: { ...point } };
    }
  }

  up(button: number, pointerId: number): void {
    if (this.pointer?.id !== pointerId) {
      return;
    }
    this.buttons.delete(button);
    if (!this.buttons.size) {
      this.pointer = undefined;
    }
  }

  reset(): void {
    this.keys.clear();
    this.buttons.clear();
    this.pointer = undefined;
    this.pendingAim = undefined;
    this.pendingNoseFire = false;
  }

  private held(binding: { readonly keys: readonly string[] }): boolean {
    return binding.keys.some((code) => this.keys.has(code));
  }

  sample(frame: DesktopFrame): DesktopSample {
    if (!this.accepts()) {
      return { aim: zero(), fire: false, move: zero(), turn: 0 };
    }
    // A press released before sampling retains its target for one update. Held fire follows
    // the latest pointer and uses the same equipped-weapon cadence as a short press.
    const aimHeld = DESKTOP_FLIGHT_BINDINGS.aimFire.mouseButtons.some((button) =>
      this.buttons.has(button),
    );
    const pointer = aimHeld ? this.pointer?.position : this.pendingAim;
    const fire =
      pointer !== undefined || this.held(DESKTOP_FLIGHT_BINDINGS.noseFire) || this.pendingNoseFire;
    this.pendingAim = undefined;
    this.pendingNoseFire = false;
    const offset = pointer ? { x: pointer.x - frame.ship.x, y: pointer.y - frame.ship.y } : zero();
    const slow = this.held(DESKTOP_FLIGHT_BINDINGS.slow);
    const speed = slow ? DESKTOP_SHIFT_THROTTLE : 1;
    const west = this.held(DESKTOP_FLIGHT_BINDINGS.moveWest);
    const east = this.held(DESKTOP_FLIGHT_BINDINGS.moveEast);
    const north = this.held(DESKTOP_FLIGHT_BINDINGS.moveNorth);
    const south = this.held(DESKTOP_FLIGHT_BINDINGS.moveSouth);
    const move = unit({ x: Number(east) - Number(west), y: Number(south) - Number(north) });
    const left = this.held(DESKTOP_FLIGHT_BINDINGS.turnLeft);
    const right = this.held(DESKTOP_FLIGHT_BINDINGS.turnRight);
    const turn = left === right ? 0 : right ? 1 : -1;
    return {
      aim: unit(offset),
      fire,
      move: { x: move.x * speed, y: move.y * speed },
      turn,
    };
  }
}
