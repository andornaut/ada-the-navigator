import { expect, it, vi } from "vitest";

import { setRendering } from "./renderLoop.ts";

function game() {
  const calls: string[] = [];
  type Step = (time: number, delta: number) => void;
  const step = vi.fn<Step>(() => calls.push("render"));
  const subject = {
    headlessStep: vi.fn<Step>(() => calls.push("headless")),
    loop: { callback: step },
    step,
  };
  return { calls, subject };
}

it("runs headless frames while rendering is off and full frames once it is back on", () => {
  const { calls, subject } = game();
  setRendering(subject, false);
  subject.loop.callback(0, 16);
  subject.loop.callback(16, 16);
  setRendering(subject, true);
  subject.loop.callback(32, 16);
  expect(calls).toEqual(["headless", "headless", "render"]);
  expect(subject.headlessStep).toHaveBeenLastCalledWith(16, 16);
  expect(subject.step).toHaveBeenLastCalledWith(32, 16);
});

it("keeps the same loop callback while the setting is unchanged", () => {
  const { subject } = game();
  setRendering(subject, false);
  const headless = subject.loop.callback;
  setRendering(subject, false);
  expect(subject.loop.callback).toBe(headless);
  setRendering(subject, true);
  const render = subject.loop.callback;
  setRendering(subject, true);
  expect(subject.loop.callback).toBe(render);
  expect(render).not.toBe(headless);
});
