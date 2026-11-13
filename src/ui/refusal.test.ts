import {
  REFUSAL_ATTRIBUTES,
  REFUSAL_SHAKE,
  REFUSAL_SHAKE_MS,
} from "@andornaut/game-kit/web/ui/dom/refusalCue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { REFUSAL, refuse } from "./refusal.ts";

function target() {
  const attributes = new Map<string, string>();
  const values = new Map<string, string>();
  const element = {
    removeAttribute: (name: string) => attributes.delete(name),
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    style: {
      removeProperty: (name: string) => values.delete(name),
      setProperty: (name: string, value: string) => values.set(name, value),
    },
    toggleAttribute: (name: string, force: boolean) => {
      if (force) {
        attributes.set(name, "");
      } else {
        attributes.delete(name);
      }
    },
  } as unknown as HTMLElement;
  return { attributes, element, values };
}

function expectRest(value: ReturnType<typeof target>) {
  expect(value.attributes.size).toBe(0);
  expect(value.values.has(REFUSAL_SHAKE)).toBe(false);
  expect(value.values.has(REFUSAL_SHAKE_MS)).toBe(false);
  expect(value.values.has("color")).toBe(false);
  expect(value.values.has("transform")).toBe(false);
}

describe("published refusal cue adapter", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("keeps four 80ms alternate strokes, red steps and 3 logical pixels through 320ms", () => {
    const value = target();
    refuse(value.element, false);
    expect(value.values.get("--ui-unit")).toBe("var(--ada-unit)");
    expect(value.values.get("--ui-refusal-colour")).toBe("#e4574e");
    expect(value.values.get(REFUSAL_SHAKE)).toBe("3");
    expect(value.values.get(REFUSAL_SHAKE_MS)).toBe("80");
    for (const [index, stroke] of ["left", "right", "left", "right"].entries()) {
      expect(value.attributes.has(REFUSAL_ATTRIBUTES.red)).toBe(index % 2 === 0);
      expect(value.attributes.get(REFUSAL_ATTRIBUTES.shake)).toBe(stroke);
      vi.advanceTimersByTime(REFUSAL.stepMs);
    }
    expectRest(value);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("holds red without any shake for the complete reduced-motion duration", () => {
    const value = target();
    refuse(value.element, true);
    vi.advanceTimersByTime(319);
    expect(value.attributes.has(REFUSAL_ATTRIBUTES.red)).toBe(true);
    expect(value.attributes.has(REFUSAL_ATTRIBUTES.shake)).toBe(false);
    expect(value.values.has(REFUSAL_SHAKE)).toBe(false);
    vi.advanceTimersByTime(1);
    expectRest(value);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("restarts a running cue without old timers clearing its replacement", () => {
    const value = target();
    refuse(value.element, false);
    vi.advanceTimersByTime(250);
    refuse(value.element, true);
    vi.advanceTimersByTime(319);
    expect(value.attributes.has(REFUSAL_ATTRIBUTES.red)).toBe(true);
    expect(value.attributes.has(REFUSAL_ATTRIBUTES.shake)).toBe(false);
    vi.advanceTimersByTime(1);
    expectRest(value);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels a disposed control without stopping a different control", () => {
    const first = target();
    const second = target();
    const cancel = refuse(first.element, false);
    refuse(second.element, true);
    vi.advanceTimersByTime(40);
    cancel();
    expectRest(first);
    expect(second.attributes.has(REFUSAL_ATTRIBUTES.red)).toBe(true);
    vi.advanceTimersByTime(280);
    expectRest(second);
    expect(vi.getTimerCount()).toBe(0);
  });
});
