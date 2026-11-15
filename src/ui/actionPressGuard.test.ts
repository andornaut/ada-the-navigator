import { createModalInputGate } from "@andornaut/game-kit/input/modalInput";
import { expect, it } from "vitest";

import { type AdaUiPressScope, createAdaUiPressGuard } from "./actionPressGuard.ts";

it("accepts the current UI modal while gameplay is blocked and invalidates prior view captures", () => {
  const gameplay = createModalInputGate();
  const menu = gameplay.open();
  let scope: AdaUiPressScope | null = { guard: { gate: menu }, token: {} };
  const guard = createAdaUiPressGuard(() => scope);
  expect(gameplay.accepts()).toBe(false);
  expect(guard.gate.accepts()).toBe(true);
  const old = guard.gate.capture();
  expect(old()).toBe(true);
  // The same visible modal can be re-entered with new caller state.
  scope = { guard: scope.guard, token: {} };
  expect(old()).toBe(false);
  const next = guard.gate.capture();
  expect(next()).toBe(true);
  menu.close();
  expect(next()).toBe(false);
  scope = null;
  expect(guard.gate.accepts()).toBe(false);
  expect(guard.gate.capture()()).toBe(false);
});

it("forwards the current view tap guard and refuses a swapped guard even with a reused token", () => {
  const gate = createModalInputGate(),
    token = {};
  let drawn = 125;
  let scope: AdaUiPressScope = {
    guard: { gate, tapGuard: { drawnMs: () => drawn, guardMs: 200 } },
    token,
  };
  const guard = createAdaUiPressGuard(() => scope),
    captured = guard.gate.capture();
  expect(guard.tapGuard?.drawnMs()).toBe(125);
  drawn = 250;
  expect(guard.tapGuard?.drawnMs()).toBe(250);
  scope = { guard: { gate, tapGuard: { drawnMs: () => null, guardMs: 300 } }, token };
  expect(captured()).toBe(false);
  expect(guard.tapGuard?.guardMs).toBe(300);
  expect(guard.tapGuard?.drawnMs()).toBeNull();
});
