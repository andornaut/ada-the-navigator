import { describe, expect, it, onTestFinished, vi } from "vitest";

import { bindDesktopInput, DesktopControlState } from "./desktop.ts";
import { ControlState, MOVE_STICK_GEOMETRY } from "./state.ts";

const frame = { facing: { x: 0, y: -1 }, ship: { x: 310, y: 170 } };
const neutral = { aim: { x: 0, y: 0 }, fire: false, move: { x: 0, y: -0 }, turn: 0 };

function fresh() {
  return new DesktopControlState(() => true);
}

describe("desktop flight controls", () => {
  it("measures mouse throttle from the current projected ship, using the canonical stick curve", () => {
    const state = fresh();
    const { deadZone, reach } = MOVE_STICK_GEOMETRY;
    state.down(0, 1, { x: frame.ship.x + deadZone, y: frame.ship.y });
    expect(state.sample(frame).move).toEqual({ x: 0, y: 0 });
    state.move(1, { x: frame.ship.x + (deadZone + reach) / 2, y: frame.ship.y });
    expect(state.sample(frame).move.x).toBeCloseTo(0.5);
    expect(state.sample(frame).move.y).toBe(0);
    expect(
      state.sample({
        ...frame,
        ship: { x: frame.ship.x + (deadZone + reach) / 2, y: frame.ship.y },
      }).move,
    ).toEqual({ x: 0, y: 0 });
    state.move(1, { x: frame.ship.x + reach * 3, y: frame.ship.y });
    expect(state.sample(frame).move).toEqual({ x: 1, y: 0 });
    expect(state.sample(frame).fire).toBe(false);
    state.up(0, 1);
    expect(state.sample(frame).move).toEqual(neutral.move);
  });

  it("thrusts along the actual facing, with Shift limiting keyboard thrust to twenty percent only", () => {
    const state = fresh();
    state.keyDown("KeyW");
    expect(state.sample(frame).move).toEqual({ x: 0, y: -1 });
    state.keyDown("ShiftLeft");
    expect(state.sample(frame).move).toEqual({ x: 0, y: -0.2 });
    expect(state.sample({ ...frame, facing: { x: 1, y: 0 } }).move).toEqual({ x: 0.2, y: 0 });
    state.down(0, 1, { x: frame.ship.x + MOVE_STICK_GEOMETRY.reach, y: frame.ship.y });
    expect(state.sample(frame).move).toEqual({ x: 1, y: 0 });
    state.up(0, 1);
    expect(state.sample(frame).move).toEqual({ x: 0, y: -0.2 });
  });

  it("maps A/D and Left/Right to turning, keeps S/Down unbound and never fires from steering", () => {
    const state = fresh();
    state.keyDown("KeyA");
    expect(state.sample(frame)).toEqual({ ...neutral, turn: -1 });
    state.keyDown("ArrowRight");
    expect(state.sample(frame).turn).toBe(0);
    state.keyUp("KeyA");
    expect(state.sample(frame).turn).toBe(1);
    state.keyUp("ArrowRight");
    state.keyDown("KeyS");
    state.keyDown("ArrowDown");
    expect(state.sample(frame)).toEqual(neutral);
    state.keyDown("ArrowUp");
    expect(state.sample(frame).move).toEqual({ x: 0, y: -1 });
  });

  it("fires from either Space or RMB and releases each held mouse button independently", () => {
    const state = fresh();
    state.down(0, 1, { x: frame.ship.x + MOVE_STICK_GEOMETRY.reach, y: frame.ship.y });
    state.down(2, 1, { x: frame.ship.x + MOVE_STICK_GEOMETRY.reach, y: frame.ship.y });
    expect(state.sample(frame)).toMatchObject({
      aim: { x: 1, y: 0 },
      fire: true,
      move: { x: 1, y: 0 },
    });
    state.up(0, 1);
    expect(state.sample(frame)).toMatchObject({ fire: true, move: neutral.move });
    state.keyDown("Space");
    state.up(2, 1);
    expect(state.sample(frame).fire).toBe(true);
    state.keyUp("Space");
    expect(state.sample(frame).fire).toBe(false);
  });

  it("admits each E and Enter press once without turning either Use key into firing", () => {
    const state = fresh();
    expect(state.keyDown("KeyE")).toBe(true);
    expect(state.keyDown("KeyE", true)).toBe(false);
    expect(state.keyDown("KeyE")).toBe(false);
    expect(state.sample(frame)).toEqual(neutral);
    state.keyUp("KeyE");
    expect(state.keyDown("KeyE")).toBe(true);
    expect(state.keyDown("Enter")).toBe(true);
    expect(state.keyDown("Enter", true)).toBe(false);
    expect(state.sample(frame).fire).toBe(false);
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
    ) => {
      const event = new Event(type, { cancelable: true });
      Object.defineProperties(event, {
        code: { value: code },
        repeat: { value: repeat },
        target: { value: target },
      });
      host.dispatchEvent(event);
      return event;
    };
    return { binding, controls, document, host, key, onUse, state, surface };
  }

  it.each(["KeyE", "Enter"])("routes a fresh %s press through Use exactly once", (code) => {
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
        button: { value: 2 },
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

  it("retains continuous keyboard flight through Use and clears held input on reset and disposal", () => {
    const { binding, controls, document, host, key, onUse, state, surface } = bind();
    const flying = { ...neutral, fire: true, move: { x: 0, y: -0.2 }, turn: -1 };
    for (const code of ["KeyW", "ShiftLeft", "KeyA", "Space"]) {
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
