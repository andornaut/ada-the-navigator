import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import { refusalPose } from "../ui/refusal.ts";
import { touchControlsActive, useDiscShown } from "./coarsePointer.ts";

const source = ts.createSourceFile(
  "controls.ts",
  readFileSync(new URL("./controls.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
function actual(name: string): ts.ArrowFunction {
  let found: ts.ArrowFunction | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) {
      found = node.initializer as ts.ArrowFunction;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!found) {
    throw new Error(`Missing actual presentation ${name}`);
  }
  return found;
}
function render(
  enabled: boolean,
  covered: boolean,
  coarse = true,
  map = false,
  foreground = true,
  {
    desktop = false,
    maxTouchPoints = 0,
    now = 0,
    reduced = false,
    refusedAt = undefined as number | undefined,
  } = {},
) {
  const target = { hidden: false, inert: false };
  const button = Object.assign({ hidden: false, inert: false }, { matches: () => false });
  const navigation = { setMode: vi.fn() };
  const status = { setShown: vi.fn() };
  const notices = { update: vi.fn() };
  const weapons = { setShown: vi.fn(), updateFeedback: vi.fn() };
  const useDisc = { setFrame: vi.fn(), setPosition: vi.fn(), setVisible: vi.fn() };
  const pauseButton = { hidden: true, inert: false };
  const context = createContext({
    USE_PRESS_MS: 100,
    cheats: { refresh: vi.fn() },
    context: { action: "dock" },
    desktopBinding: { active: () => desktop, touchActive: () => false },
    enabled,
    // The start screen's Exit disc exists only where Exit shows.
    exitButton: undefined,
    inCurrentView: () => foreground,
    modalOpen: () => covered,
    navigation,
    noticePlaces: () => ({ x: 0, y: 0 }),
    notices,
    now: () => now,
    pausable: !map,
    pause: { mapOpen: () => map },
    pauseButton,
    reducedMotion: reduced,
    refusalPose,
    settings: { joystickTargets: [target] },
    status,
    touchControlsActive,
    useButton: button,
    useDisc,
    useDiscFrame: (action: string, pose: string) => `${action}-${pose}`,
    useDiscShown,
    useLayout: { frame: { x: 40, y: 300 } },
    usePress: undefined,
    useRefused: refusedAt,
    useShown: false,
    weapons,
    window: { matchMedia: () => ({ matches: coarse }), navigator: { maxTouchPoints } },
  });
  const statements = [...(actual("draw").body as ts.Block).statements];
  const end = statements.findIndex((node) => node.getText(source).startsWith("const size ="));
  if (end < 0) {
    throw new Error("Missing touch geometry boundary");
  }
  const code = `const syncNavigationEntry = ${actual("syncNavigationEntry").getText(source)};\n${statements
    .slice(0, end)
    .map((node) => node.getText(source))
    .join("\n")}`;
  runInContext(
    ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2023 } }).outputText,
    context,
  );
  return { button, navigation, notices, pauseButton, status, target, useDisc, weapons };
}

describe("actual controls paint under modal covers", () => {
  it.each([false, true])("retains navigation and HUD paint while covered=%s", (covered) => {
    const view = render(true, covered);
    expect(view.pauseButton.hidden).toBe(false);
    expect(view.pauseButton.inert).toBe(covered);
    expect(view.navigation.setMode).toHaveBeenCalledWith("pause");
    expect(view.status.setShown).toHaveBeenCalledWith(true);
    expect(view.notices.update).toHaveBeenCalledWith(0, true, { x: 0, y: 0 });
    expect(view.weapons.setShown).toHaveBeenCalledWith(true);
    expect(view.target).toEqual({ hidden: false, inert: covered });
    expect(view.button).toMatchObject({ hidden: false, inert: covered });
    expect(view.useDisc.setVisible).toHaveBeenCalledWith(true);
  });
  it("does not reveal scene-ineligible flight controls behind a story modal", () => {
    const view = render(false, true);
    expect(view.status.setShown).toHaveBeenCalledWith(false);
    expect(view.weapons.setShown).toHaveBeenCalledWith(false);
    expect(view.target.hidden).toBe(true);
    expect(view.button.hidden).toBe(true);
    expect(view.useDisc.setVisible).toHaveBeenCalledWith(false);
  });
  it("keeps desktop touch chrome absent while retaining its HUD", () => {
    const view = render(true, true, false);
    expect(view.status.setShown).toHaveBeenCalledWith(true);
    expect(view.target.hidden).toBe(true);
    expect(view.button.hidden).toBe(true);
  });
  it("keeps Use visible when a touchscreen with a mouse or keyboard is in desktop input mode", () => {
    const view = render(true, false, false, false, true, { desktop: true, maxTouchPoints: 1 });
    expect(view.target.hidden).toBe(true);
    expect(view.button).toMatchObject({ hidden: false, inert: false });
    expect(view.useDisc.setVisible).toHaveBeenCalledWith(true);
  });
  it("retains the Menu pose behind the full-screen Map and blocks its action", () => {
    const view = render(true, true, true, true);
    expect(view.navigation.setMode).toHaveBeenCalledWith("menu");
    expect(view.pauseButton).toEqual({ hidden: false, inert: true });
    expect(view.status.setShown).toHaveBeenCalledWith(false);
    expect(view.weapons.setShown).toHaveBeenCalledWith(false);
    expect(view.target.hidden).toBe(true);
    expect(view.button.hidden).toBe(true);
  });
});

it("does not exempt Map navigation when an actual child foreground covers it", () => {
  const view = render(true, true, true, true, false);
  expect(view.navigation.setMode).toHaveBeenCalledWith("menu");
  expect(view.pauseButton).toEqual({ hidden: false, inert: true });
});

it("keeps navigation inactive behind direct modal scopes outside the controls modal flag", () => {
  const view = render(false, false, false, false, false);
  expect(view.pauseButton).toEqual({ hidden: false, inert: true });
});

describe("the Use disc's refusal cue", () => {
  it.each([
    [40, "dock-refused", 43],
    [100, "dock-rest", 40 + 3 * (20 / 40)],
    [200, "dock-refused", 40 + 3 * (40 / 40)],
    [260, "dock-rest", 40 + 3 * (20 / 40)],
    [320, "dock-rest", 40],
  ])("at %i ms shows %s with the disc at x %d", (elapsed, frame, x) => {
    const view = render(true, false, true, false, true, { now: 1000 + elapsed, refusedAt: 1000 });
    expect(view.useDisc.setFrame).toHaveBeenLastCalledWith(frame);
    expect(view.useDisc.setPosition.mock.lastCall![0]).toBeCloseTo(x);
    expect(view.useDisc.setPosition.mock.lastCall![1]).toBe(300);
  });

  it("holds the tint without a shake under reduced motion", () => {
    for (const elapsed of [0, 40, 200, 319]) {
      const view = render(true, false, true, false, true, {
        now: 1000 + elapsed,
        reduced: true,
        refusedAt: 1000,
      });
      expect(view.useDisc.setFrame).toHaveBeenLastCalledWith("dock-refused");
      expect(view.useDisc.setPosition).toHaveBeenLastCalledWith(40, 300);
    }
  });

  it("rests at its place with no cue played", () => {
    const view = render(true, false);
    expect(view.useDisc.setFrame).toHaveBeenLastCalledWith("dock-rest");
    expect(view.useDisc.setPosition).toHaveBeenLastCalledWith(40, 300);
  });
});
