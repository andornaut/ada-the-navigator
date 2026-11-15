import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import { EMERGENCY_RETURN } from "../data/emergencyReturn.ts";
import { LIGHT_FIELD } from "./lightField.ts";

const source = ts.createSourceFile(
  "sceneHud.ts",
  readFileSync(new URL("./sceneHud.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
function production(name: string) {
  const node = source.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === name,
  )!;
  return ts.transpileModule(`(${node.getText(source).replace(/^export /u, "")})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2023 },
  }).outputText;
}
function fixture(light: boolean, reducedMotion = false) {
  const overlay = {
    arc: vi.fn(),
    beginPath: vi.fn(),
    lineBetween: vi.fn(),
    lineStyle: vi.fn(),
    strokeCircle: vi.fn(),
    strokePath: vi.fn(),
  };
  const scene = {
    light,
    overlay,
    palette: { obstacle: 0x123456 },
    project: () => ({ x: 100, y: 150 }),
    quantum: null,
    reducedMotion,
  };
  const context = createContext({ EMERGENCY_RETURN, LIGHT_FIELD });
  context.drawPulse = runInContext(production("drawPulse"), context);
  const draw = runInContext(production("drawCompromisedShield"), context) as (
    scene: unknown,
    elapsed: number,
  ) => void;
  return {
    draw,
    overlay,
    pulse: context.drawPulse as (scene: unknown, grow: number, pulse: unknown) => void,
    scene,
  };
}

describe("compromised shield presentation", () => {
  it.each([
    { light: false, reducedMotion: false },
    { light: true, reducedMotion: false },
    { light: false, reducedMotion: true },
    { light: true, reducedMotion: true },
  ])("animates the damage outline except with reduced motion (%j)", ({ light, reducedMotion }) => {
    const { draw, overlay, scene } = fixture(light, reducedMotion);
    draw(scene, 0);
    expect(overlay.strokeCircle).toHaveBeenLastCalledWith(100, 150, 23);
    expect(overlay.lineStyle).toHaveBeenCalledWith(3, 0xe43b44, 1);
    expect(overlay.lineStyle).toHaveBeenLastCalledWith(3, 0x300c14, 1);
    expect(overlay.arc).toHaveBeenCalledWith(100, 150, 23, (-3 * Math.PI) / 4, -Math.PI / 4);
    expect(overlay.strokePath).toHaveBeenCalledOnce();
    expect(overlay.lineBetween).toHaveBeenCalledTimes(light ? 4 : 2);
    if (light) {
      expect(overlay.lineStyle).toHaveBeenCalledWith(
        3 + 2 * LIGHT_FIELD.keyline,
        LIGHT_FIELD.ink,
        1,
      );
    }
    draw(scene, 1);
    const radius = reducedMotion ? 23 : 78;
    expect(overlay.strokeCircle).toHaveBeenLastCalledWith(100, 150, radius);
    expect(overlay.arc).toHaveBeenLastCalledWith(
      100,
      150,
      radius,
      (-3 * Math.PI) / 4,
      -Math.PI / 4,
    );
  });

  it("retains normal damage's fading feedback instead of applying the held shield style globally", () => {
    const { overlay, pulse, scene } = fixture(false);
    pulse(scene, 0, { age: 1, kind: "damage", x: 0, y: 0 });
    expect(overlay.lineStyle).toHaveBeenCalledWith(3, scene.palette.obstacle, 0);
    expect(overlay.arc).not.toHaveBeenCalled();
  });
});
