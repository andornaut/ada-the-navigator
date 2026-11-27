import { describe, expect, it, onTestFinished, vi } from "vitest";

import {
  bindDesktopInput,
  DESKTOP_FLIGHT_BINDINGS,
  DESKTOP_MENU_BINDINGS,
  DesktopControlState,
  indexDesktopBindings,
  isMenuExitKey,
} from "./desktop.ts";
import { ControlState } from "./state.ts";

const frame = { ship: { x: 310, y: 170 } };
const neutral = { aim: { x: 0, y: 0 }, fire: false, move: { x: 0, y: 0 }, turn: 0 };

function fresh() {
  return new DesktopControlState(() => true);
}

describe("desktop binding registration", () => {
  it("resolves keyboard and mouse aliases to the same Use declaration", () => {
    const { keys, mouseButtons } = indexDesktopBindings("flight", DESKTOP_FLIGHT_BINDINGS);
    for (const code of ["Enter", "KeyE", "KeyF"]) {
      expect(keys.get(code)).toBe(DESKTOP_FLIGHT_BINDINGS.use);
    }
    expect(mouseButtons.get(2)).toBe(DESKTOP_FLIGHT_BINDINGS.use);
    expect(mouseButtons.has(1)).toBe(false);
  });

  it("rejects overlapping physical keys and mouse buttons before binding listeners", () => {
    expect(() =>
      indexDesktopBindings("flight", {
        ...DESKTOP_FLIGHT_BINDINGS,
        other: { keys: ["ArrowUp"], trigger: "press" },
      }),
    ).toThrow("Duplicate flight key: ArrowUp");
    expect(() =>
      indexDesktopBindings("flight", {
        ...DESKTOP_FLIGHT_BINDINGS,
        other: { mouseButtons: [0], trigger: "press" },
      }),
    ).toThrow("Duplicate flight mouse button: 0");
  });

  it("keeps the physical menu Exit shortcut out of flight and rejects repeats and conflicts", () => {
    const flight = indexDesktopBindings("flight", DESKTOP_FLIGHT_BINDINGS);
    expect(flight.keys.has("KeyQ")).toBe(false);
    expect(isMenuExitKey({ code: "KeyQ", repeat: false })).toBe(true);
    expect(isMenuExitKey({ code: "KeyQ", repeat: true })).toBe(false);
    expect(isMenuExitKey({ code: "KeyE", repeat: false })).toBe(false);
    expect(() =>
      indexDesktopBindings("menu", {
        ...DESKTOP_MENU_BINDINGS,
        other: { keys: ["KeyQ"], trigger: "held" },
      }),
    ).toThrow("Duplicate menu key: KeyQ");
  });
});

describe("desktop flight controls", () => {
  it.each([
    ["KeyW", "ArrowUp", { x: 0, y: -1 }],
    ["KeyA", "ArrowLeft", { x: -1, y: 0 }],
    ["KeyS", "ArrowDown", { x: 0, y: 1 }],
    ["KeyD", "ArrowRight", { x: 1, y: 0 }],
  ])("makes %s and %s equivalent screen-relative movement without steering", (key, arrow, move) => {
    const state = fresh();
    state.keyDown(key);
    expect(state.sample(frame)).toEqual({ ...neutral, move });
    state.keyDown(arrow);
    state.keyUp(key);
    expect(state.sample(frame)).toEqual({ ...neutral, move });
    state.keyUp(arrow);
    expect(state.sample(frame)).toEqual(neutral);
  });

  it("keeps diagonals normalized and preserves the keyboard throttle modifier", () => {
    const state = fresh();
    state.keyDown("KeyW");
    state.keyDown("KeyD");
    const diagonal = state.sample(frame).move;
    expect(diagonal.x).toBeCloseTo(Math.SQRT1_2);
    expect(diagonal.y).toBeCloseTo(-Math.SQRT1_2);
    state.keyDown("ShiftLeft");
    expect(Math.hypot(...Object.values(state.sample(frame).move))).toBeCloseTo(0.2);
    state.keyDown("KeyA");
    expect(state.sample(frame).move).toEqual({ x: 0, y: -0.2 });
  });

  it("uses H/L for opposed hull turns without movement or fire", () => {
    const state = fresh();
    state.keyDown("KeyH");
    expect(state.sample(frame)).toEqual({ ...neutral, turn: -1 });
    state.keyDown("KeyL");
    expect(state.sample(frame)).toEqual(neutral);
    state.keyUp("KeyH");
    expect(state.sample(frame)).toEqual({ ...neutral, turn: 1 });
    state.keyUp("KeyL");
    expect(state.keyDown("KeyJ")).toBe(false);
    expect(state.keyDown("KeyK")).toBe(false);
    expect(state.sample(frame)).toEqual(neutral);
  });

  it("retains a complete left click for exactly one sample and tracks the held pointer", () => {
    const state = fresh();
    const east = { x: frame.ship.x + 15, y: frame.ship.y };
    state.down(0, 1, east);
    state.up(0, 1);
    expect(state.sample(frame)).toEqual({ ...neutral, aim: { x: 1, y: 0 }, fire: true });
    expect(state.sample(frame)).toEqual(neutral);

    state.down(0, 1, east);
    state.keyDown("KeyW");
    expect(state.sample(frame)).toEqual({
      ...neutral,
      aim: { x: 1, y: 0 },
      fire: true,
      move: { x: 0, y: -1 },
    });
    state.move(1, { x: frame.ship.x, y: frame.ship.y - 20 });
    expect(state.sample(frame)).toMatchObject({ aim: { x: 0, y: -1 }, fire: true });
    expect(state.sample(frame)).toMatchObject({ aim: { x: 0, y: -1 }, fire: true });
    state.up(0, 1);
    expect(state.sample(frame)).toEqual({ ...neutral, move: { x: 0, y: -1 } });
  });

  it("fires with Space on the nose and right presses never aim or fire", () => {
    const state = fresh();
    state.down(2, 1, { x: 400, y: 100 });
    expect(state.sample(frame)).toEqual(neutral);
    state.keyDown("Space");
    state.up(2, 1);
    expect(state.sample(frame)).toEqual({ ...neutral, fire: true });
    expect(state.sample(frame)).toEqual({ ...neutral, fire: true });
    state.keyUp("Space");
    expect(state.sample(frame)).toEqual(neutral);
    state.keyDown("Space");
    state.keyUp("Space");
    expect(state.sample(frame)).toEqual({ ...neutral, fire: true });
    expect(state.sample(frame)).toEqual(neutral);
  });

  it("rejects blocked input and requires fresh presses after modal, blur or mode reset", () => {
    let accepts = true;
    const state = new DesktopControlState(() => accepts);
    state.keyDown("KeyW");
    state.down(2, 1, { x: 500, y: 100 });
    accepts = false;
    state.reset();
    state.keyDown("Space");
    state.down(0, 2, { x: 500, y: 100 });
    expect(state.sample(frame)).toEqual({
      aim: { x: 0, y: 0 },
      fire: false,
      move: { x: 0, y: 0 },
      turn: 0,
    });
    accepts = true;
    state.move(1, { x: 700, y: 100 });
    state.keyDown("KeyW", true);
    expect(state.sample(frame)).toEqual(neutral);
    state.keyUp("KeyW");
    state.keyDown("KeyW");
    expect(state.sample(frame).move).toEqual({ x: 0, y: -1 });
  });
});

describe("desktop input listeners", () => {
  // EventTarget dispatches the real listeners. The fixture supplies the focused element ancestry
  // that a browser keyboard event would carry to Window.
  class FixtureElement {
    readonly tag: string;
    readonly editable: boolean;
    readonly parent: FixtureElement | undefined;
    constructor(tag: string, editable = false, parent?: FixtureElement) {
      this.tag = tag;
      this.editable = editable;
      this.parent = parent;
    }
    closest(selector: string): FixtureElement | null {
      const selectors = selector.split(",");
      if (
        selectors.includes(this.tag) ||
        (this.editable && selectors.includes("[contenteditable]:not([contenteditable=false])"))
      ) {
        return this;
      }
      return this.parent?.closest(selector) ?? null;
    }
  }

  function bind(acceptsPointer?: (event: MouseEvent) => boolean) {
    vi.stubGlobal("Element", FixtureElement);
    const host = new EventTarget();
    const document = Object.assign(new EventTarget(), { defaultView: host, hidden: false });
    const surface = Object.assign(new FixtureElement("canvas"), { ownerDocument: document });
    const controls = new ControlState();
    controls.setUseAvailable(true);
    const accepts = () => controls.accepts();
    const state = new DesktopControlState(accepts);
    const onUse = vi.fn(() => controls.requestUse());
    const binding = bindDesktopInput(
      {
        accepts,
        ...(acceptsPointer ? { acceptsPointer } : {}),
        onModeChange: () => controls.reset(),
        onUse,
        point: () => frame.ship,
        surface: surface as unknown as HTMLElement,
      },
      state,
    );
    onTestFinished(() => {
      binding.dispose();
      vi.unstubAllGlobals();
    });
    const key = (
      type: "keydown" | "keyup",
      code: string,
      target: FixtureElement = surface,
      repeat = false,
      consumed = false,
      flags: Pick<KeyboardEventInit, "altKey" | "ctrlKey" | "metaKey" | "isComposing"> = {},
    ) => {
      const event = new Event(type, { cancelable: true });
      Object.defineProperties(event, {
        code: { value: code },
        repeat: { value: repeat },
        target: { value: target },
      });
      Object.assign(event, flags);
      if (consumed) {
        event.preventDefault();
      }
      host.dispatchEvent(event);
      return event;
    };
    const mouse = (type: "mousedown" | "mouseup", button: number, target = surface) => {
      const event = new Event(type, { cancelable: true });
      Object.defineProperties(event, { button: { value: button }, target: { value: target } });
      host.dispatchEvent(event);
      return event;
    };
    return { binding, controls, document, host, key, mouse, onUse, state, surface };
  }

  it.each(["KeyE", "KeyF", "Enter"])("routes a fresh %s press through Use exactly once", (code) => {
    const { controls, key, onUse, state, surface } = bind();
    expect(key("keydown", code).defaultPrevented).toBe(true);
    expect(onUse).toHaveBeenCalledOnce();
    expect(controls.sample().use).toBe(true);
    expect(controls.sample().use).toBe(false);
    expect(state.sample(frame)).toEqual(neutral);

    key("keydown", code, surface, true);
    key("keydown", code);
    expect(onUse).toHaveBeenCalledOnce();
    expect(controls.sample().use).toBe(false);

    key("keyup", code);
    key("keydown", code, surface, true);
    expect(onUse).toHaveBeenCalledOnce();
    key("keydown", code);
    expect(onUse).toHaveBeenCalledTimes(2);
    expect(controls.sample().use).toBe(true);
  });

  it("leaves a canvas press claimed by Use out of desktop flight", () => {
    const { binding, host, state, surface } = bind((event) => event.clientX !== 50);
    const down = (clientX: number) => {
      const event = new Event("mousedown", { cancelable: true });
      Object.defineProperties(event, {
        button: { value: 0 },
        clientX: { value: clientX },
        target: { value: surface },
      });
      host.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(down(50)).toBe(false);
    expect(binding.active()).toBe(false);
    expect(state.sample(frame)).toEqual(neutral);
    expect(down(100)).toBe(true);
    expect(binding.active()).toBe(true);
    expect(state.sample(frame).fire).toBe(true);
  });

  it("requests Use on fresh right presses only, independent of a held left press", () => {
    const { controls, mouse, onUse, state } = bind();
    mouse("mousedown", 0);
    expect(mouse("mousedown", 2).defaultPrevented).toBe(true);
    expect(controls.sample().use).toBe(true);
    mouse("mousedown", 2);
    expect(onUse).toHaveBeenCalledOnce();
    expect(controls.sample().use).toBe(false);
    expect(state.sample(frame).fire).toBe(true);
    mouse("mouseup", 0);
    expect(state.sample(frame)).toEqual(neutral);
    mouse("mouseup", 2);
    mouse("mousedown", 2);
    expect(onUse).toHaveBeenCalledTimes(2);
    expect(controls.sample().use).toBe(true);
    expect(state.sample(frame)).toEqual(neutral);
  });

  it("does not reroute a foreground-owned key and drops a pending click on cancellation", () => {
    const { controls, host, key, mouse, onUse, state, surface } = bind();
    for (const code of ["Enter", "KeyE", "KeyF", "KeyH", "KeyL", "Space"]) {
      key("keydown", code, surface, false, true);
    }
    mouse("mousedown", 0);
    mouse("mouseup", 0);
    host.dispatchEvent(new Event("pointercancel"));
    expect(state.sample(frame)).toEqual(neutral);
    expect(controls.sample().use).toBe(false);
    expect(onUse).not.toHaveBeenCalled();
  });

  it("leaves focused native buttons and editable elements alone and rejects modal input", () => {
    const { binding, controls, key, onUse, state } = bind();
    const buttonContent = new FixtureElement("span", false, new FixtureElement("button"));
    const editor = new FixtureElement("div", true);
    for (const target of [buttonContent, editor]) {
      expect(key("keydown", "Enter", target).defaultPrevented).toBe(false);
      expect(key("keydown", "KeyE", target).defaultPrevented).toBe(false);
    }
    expect(binding.active()).toBe(false);
    expect(onUse).not.toHaveBeenCalled();

    controls.openModal();
    for (const code of ["Enter", "KeyW", "Space"]) {
      expect(key("keydown", code).defaultPrevented).toBe(false);
    }
    controls.closeModal();
    expect(state.sample(frame)).toEqual(neutral);
    expect(controls.sample().use).toBe(false);
    expect(onUse).not.toHaveBeenCalled();
    key("keydown", "Enter");
    expect(onUse).toHaveBeenCalledOnce();
    expect(controls.sample().use).toBe(true);
  });

  it("leaves modified shortcuts and composition native while still releasing held keys", () => {
    const { binding, key, onUse, state, surface } = bind();
    for (const flags of [
      { altKey: true },
      { ctrlKey: true },
      { metaKey: true },
      { isComposing: true },
    ]) {
      expect(key("keydown", "KeyF", surface, false, false, flags).defaultPrevented).toBe(false);
    }
    expect(binding.active()).toBe(false);
    expect(onUse).not.toHaveBeenCalled();

    key("keydown", "KeyW");
    expect(state.sample(frame).move).toEqual({ x: 0, y: -1 });
    key("keyup", "KeyW", new FixtureElement("input"), false, false, { ctrlKey: true });
    expect(state.sample(frame)).toEqual(neutral);
  });

  it("retains continuous keyboard flight through Use and clears held input on reset and disposal", () => {
    const { binding, controls, document, host, key, onUse, state, surface } = bind();
    const flying = { ...neutral, fire: true, move: { x: 0, y: -0.2 }, turn: -1 };
    for (const code of ["KeyW", "ShiftLeft", "KeyH", "Space"]) {
      expect(key("keydown", code).defaultPrevented).toBe(true);
    }
    expect(state.sample(frame)).toEqual(flying);
    expect(controls.sample().use).toBe(false);
    key("keydown", "KeyE");
    expect(controls.sample().use).toBe(true);
    expect(state.sample(frame)).toEqual(flying);

    document.dispatchEvent(new Event("visibilitychange"));
    expect(state.sample(frame)).toEqual(flying);
    document.hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(state.sample(frame)).toEqual(neutral);
    key("keydown", "KeyE", surface, true);
    expect(onUse).toHaveBeenCalledOnce();
    key("keydown", "KeyE");
    expect(onUse).toHaveBeenCalledTimes(2);
    expect(controls.sample().use).toBe(true);

    key("keydown", "Space");
    host.dispatchEvent(new Event("blur"));
    expect(state.sample(frame)).toEqual(neutral);
    key("keydown", "KeyW");
    key("keydown", "Space");
    expect(state.sample(frame)).toEqual({ ...neutral, fire: true, move: { x: 0, y: -1 } });
    binding.dispose();
    expect(state.sample(frame)).toEqual(neutral);
    for (const code of ["Enter", "KeyW", "Space"]) {
      expect(key("keydown", code).defaultPrevented).toBe(false);
    }
    expect(state.sample(frame)).toEqual(neutral);
    expect(onUse).toHaveBeenCalledTimes(2);
  });
});
