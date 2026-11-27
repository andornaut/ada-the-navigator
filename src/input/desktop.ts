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

type FlightTrigger = "held" | "held-and-press" | "press";

interface FlightBinding {
  readonly keys?: readonly string[];
  readonly mouseButtons?: readonly number[];
  readonly trigger: FlightTrigger;
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
} as const satisfies Readonly<Record<string, FlightBinding>>;

function register<Input extends string | number>(
  index: Map<Input, FlightBinding>,
  inputs: readonly Input[] | undefined,
  binding: FlightBinding,
  source: "key" | "mouse button",
): void {
  for (const input of inputs ?? []) {
    if (index.has(input)) {
      throw new Error(`Duplicate flight ${source}: ${input}`);
    }
    index.set(input, binding);
  }
}

export function indexFlightBindings(bindings: Readonly<Record<string, FlightBinding>>): {
  readonly keys: ReadonlyMap<string, FlightBinding>;
  readonly mouseButtons: ReadonlyMap<number, FlightBinding>;
} {
  const keys = new Map<string, FlightBinding>();
  const mouseButtons = new Map<number, FlightBinding>();
  for (const binding of Object.values(bindings)) {
    register(keys, binding.keys, binding, "key");
    register(mouseButtons, binding.mouseButtons, binding, "mouse button");
  }
  return { keys, mouseButtons };
}

const flightBindings = indexFlightBindings(DESKTOP_FLIGHT_BINDINGS);

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

export interface DesktopBindingOptions {
  readonly accepts: () => boolean;
  readonly acceptsPointer?: (event: MouseEvent) => boolean;
  readonly onModeChange?: (desktop: boolean) => void;
  readonly onUse?: () => void;
  readonly point: (event: MouseEvent) => Vector;
  readonly surface: HTMLElement;
}

export interface DesktopBinding {
  readonly active: () => boolean;
  readonly dispose: () => void;
  readonly touchActive: () => boolean;
}

/** Mouse gestures start on the game surface; page controls and native touch keep their inputs. */
export function bindDesktopInput(
  options: DesktopBindingOptions,
  state: DesktopControlState,
): DesktopBinding {
  const { surface } = options;
  const host = surface.ownerDocument.defaultView;
  if (!host) {
    throw new Error("Desktop controls require a mounted surface");
  }
  const document = surface.ownerDocument;
  let desktop = false;
  let pointerType = "mouse";
  let touched = false;
  const mode = (active: boolean) => {
    if (active) {
      touched = false;
    }
    if (desktop !== active) {
      desktop = active;
      state.reset();
      options.onModeChange?.(active);
    }
  };
  const onSurface = (event: Event) => event.target === surface;
  const onControl = (target: EventTarget | null) =>
    target instanceof Element &&
    Boolean(
      target.closest(
        "button,a,input,textarea,select,[role=button],[contenteditable]:not([contenteditable=false])",
      ),
    );
  const pointerDown = (event: PointerEvent) => {
    pointerType = event.pointerType;
    if (event.pointerType !== "mouse" && onSurface(event) && options.accepts()) {
      mode(false);
      touched = true;
    }
  };
  const down = (event: MouseEvent) => {
    // Phaser prevents the canvas mousedown default before it reaches the window.
    const binding = flightBindings.mouseButtons.get(event.button);
    if (
      pointerType !== "mouse" ||
      !onSurface(event) ||
      !options.accepts() ||
      binding === undefined ||
      options.acceptsPointer?.(event) === false
    ) {
      return;
    }
    event.preventDefault();
    mode(true);
    if (
      state.down(event.button, 0, options.point(event)) &&
      binding === DESKTOP_FLIGHT_BINDINGS.use
    ) {
      options.onUse?.();
    }
  };
  const move = (event: MouseEvent) => {
    if (desktop && options.accepts()) {
      state.move(0, options.point(event));
    }
  };
  const up = (event: MouseEvent) => state.up(event.button, 0);
  const keyDown = (event: KeyboardEvent) => {
    const binding = flightBindings.keys.get(event.code);
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.isComposing ||
      !options.accepts() ||
      binding === undefined ||
      onControl(event.target)
    ) {
      return;
    }
    event.preventDefault();
    mode(true);
    const fresh = state.keyDown(event.code, event.repeat);
    if (fresh && binding === DESKTOP_FLIGHT_BINDINGS.use) {
      options.onUse?.();
    }
  };
  const keyUp = (event: KeyboardEvent) => state.keyUp(event.code);
  const contextMenu = (event: MouseEvent) => {
    if (onSurface(event) && options.accepts()) {
      event.preventDefault();
    }
  };
  const reset = () => state.reset();
  const visibility = () => {
    if (document.hidden) {
      reset();
    }
  };
  host.addEventListener("pointerdown", pointerDown);
  host.addEventListener("pointercancel", reset);
  host.addEventListener("mousedown", down);
  host.addEventListener("mousemove", move);
  host.addEventListener("mouseup", up);
  host.addEventListener("keydown", keyDown);
  host.addEventListener("keyup", keyUp);
  host.addEventListener("contextmenu", contextMenu);
  host.addEventListener("blur", reset);
  host.addEventListener("pagehide", reset);
  document.addEventListener("visibilitychange", visibility);
  return {
    active: () => desktop,
    dispose() {
      reset();
      host.removeEventListener("pointerdown", pointerDown);
      host.removeEventListener("pointercancel", reset);
      host.removeEventListener("mousedown", down);
      host.removeEventListener("mousemove", move);
      host.removeEventListener("mouseup", up);
      host.removeEventListener("keydown", keyDown);
      host.removeEventListener("keyup", keyUp);
      host.removeEventListener("contextmenu", contextMenu);
      host.removeEventListener("blur", reset);
      host.removeEventListener("pagehide", reset);
      document.removeEventListener("visibilitychange", visibility);
    },
    touchActive: () => touched && !desktop,
  };
}
