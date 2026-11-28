import { describe, expect, it, vi } from "vitest";

import {
  ANDROMEDA_REDACT,
  CARTWHEEL_CLAIM,
  NEEDLE_CADENCE,
  SUNFLOWER_CAPITAL_BOSS,
  WHIRLPOOL_CAPITAL_BOSS,
} from "../data/capitalBosses.ts";
import { PHANTOM_FLAGSHIP } from "../data/phantom.ts";
import { drawCompactHullHud, hasCompactHullHud } from "./enemyHullHud.ts";

const engaged = {
  archetype: "capital",
  disabled: false,
  engaged: true,
  fleeing: false,
  hp: 16,
  returning: false,
  salvaged: false,
} as const;

describe("compact hull HUD", () => {
  it("admits only the four engaged ordinary hull classes", () => {
    for (const archetype of ["platform", "frigate", "capital", "hostileStation"] as const) {
      expect(hasCompactHullHud("ordinary", { ...engaged, archetype })).toBe(true);
    }
    for (const change of [
      { archetype: "fighter" } as const,
      { disabled: true },
      { engaged: false },
      { fleeing: true },
      { hp: 0 },
      { returning: true },
      { salvaged: true },
    ]) {
      expect(hasCompactHullHud("ordinary", { ...engaged, ...change })).toBe(false);
    }
  });

  it("reserves every named boss for the large HUD regardless of engagement", () => {
    for (const id of [
      ANDROMEDA_REDACT.id,
      CARTWHEEL_CLAIM.id,
      NEEDLE_CADENCE.id,
      PHANTOM_FLAGSHIP,
      SUNFLOWER_CAPITAL_BOSS.id,
      WHIRLPOOL_CAPITAL_BOSS.id,
    ]) {
      expect(hasCompactHullHud(id, engaged)).toBe(false);
    }
  });

  it("draws one bar at the hull bounds with fill proportional to hull HP", () => {
    const ink = { fillRect: vi.fn(), fillStyle: vi.fn() };
    drawCompactHullHud(ink, { bottom: 230, left: 250, right: 350, top: 150 }, 16, 64);
    expect(ink.fillRect.mock.calls).toEqual([
      [284, 143, 32, 4],
      [285, 144, 7.5, 2],
    ]);
  });

  it("keeps a partially visible hull's bar in the camera and omits wholly clipped hulls", () => {
    const ink = { fillRect: vi.fn(), fillStyle: vi.fn() };
    const left = { bottom: 20, left: -25, right: 5, top: -10 };
    drawCompactHullHud(ink, { ...left, right: 0 }, 16, 16);
    drawCompactHullHud(ink, { ...left, bottom: 0 }, 16, 16);
    drawCompactHullHud(ink, left, 16, 16);
    expect(ink.fillRect.mock.calls).toEqual([
      [0, 0, 32, 4],
      [1, 1, 30, 2],
    ]);
  });
});
