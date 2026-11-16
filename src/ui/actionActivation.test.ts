import { expect, it, vi } from "vitest";

import { activateAdaAction, type AdaActionBinding } from "./actionActivation.ts";

it("routes click and ordinary hold to the same caller action without changing its binding", () => {
  const run = vi.fn();
  const binding: AdaActionBinding = Object.freeze({
    click: Object.freeze({ availability: () => ({ kind: "available" as const }), run }),
  });
  expect(activateAdaAction(binding, "click")).toBe(true);
  expect(run).toHaveBeenCalledTimes(1);
  expect(activateAdaAction(binding, "hold")).toBe(true);
  expect(run).toHaveBeenCalledTimes(2);
});

it("uses an explicit hold override and never falls back when that action is unavailable", () => {
  const click = vi.fn(),
    hold = vi.fn();
  let enabled = false;
  const binding: AdaActionBinding = {
    click: { availability: () => ({ kind: "available" }), run: click },
    hold: {
      availability: () =>
        enabled ? { kind: "available" } : { kind: "unavailable", reason: "Needs a weapon" },
      run: hold,
    },
  };
  expect(activateAdaAction(binding, "hold")).toBe(false);
  expect(click).not.toHaveBeenCalled();
  expect(hold).not.toHaveBeenCalled();
  enabled = true;
  expect(activateAdaAction(binding, "hold")).toBe(true);
  expect(hold).toHaveBeenCalledOnce();
  expect(click).not.toHaveBeenCalled();
  activateAdaAction(binding, "click");
  expect(click).toHaveBeenCalledOnce();
});

it("rechecks current availability for either trigger and refuses omitted and unmet actions", () => {
  const run = vi.fn();
  let state: "available" | "unavailable" | "omitted" = "available";
  const binding: AdaActionBinding = {
    click: {
      availability: () =>
        state === "unavailable" ? { kind: state, reason: "Needs 20 Stardust" } : { kind: state },
      run,
    },
  };
  for (const unavailable of ["unavailable", "omitted"] as const) {
    state = unavailable;
    expect(activateAdaAction(binding, "click")).toBe(false);
    expect(activateAdaAction(binding, "hold")).toBe(false);
  }
  expect(run).not.toHaveBeenCalled();
  state = "available";
  expect(activateAdaAction(binding, "hold")).toBe(true);
  expect(run).toHaveBeenCalledOnce();
});

it("dispatches explicit refusal feedback without mutation and preserves omitted/override policy", () => {
  const run = vi.fn(),
    refuse = vi.fn(),
    other = vi.fn();
  const binding: AdaActionBinding = {
    click: { availability: () => ({ kind: "unavailable", reason: "Need fuel" }), refuse, run },
    hold: {
      availability: () => ({ kind: "unavailable", reason: "Need tool" }),
      refuse: other,
      run,
    },
  };
  expect(activateAdaAction(binding, "click")).toBe(false);
  expect(refuse).toHaveBeenCalledExactlyOnceWith("Need fuel");
  expect(activateAdaAction(binding, "hold")).toBe(false);
  expect(other).toHaveBeenCalledExactlyOnceWith("Need tool");
  expect(run).not.toHaveBeenCalled();
  const omitted: AdaActionBinding = {
    click: { availability: () => ({ kind: "omitted" }), refuse, run },
  };
  activateAdaAction(omitted, "click");
  expect(refuse).toHaveBeenCalledTimes(1);
  expect(run).not.toHaveBeenCalled();
});
