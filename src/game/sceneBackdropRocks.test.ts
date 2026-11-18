import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import { ASTEROID_ART } from "../data/asteroidCatalog.ts";
import { SCREEN } from "../data/screen.ts";
import { CORE_MANIFEST, publicJson } from "../testing/publicArt.ts";
import { backdropRock, backdropTint, hexNumber } from "./asteroidArt.ts";
import { readBackdropRules } from "./backdropLayers.ts";
import { BACKDROP_DEPTH, backdropRockDepth } from "./drawOrder.ts";

// drawBackdrop and its helpers run from the production source without Phaser.
const source = ts.createSourceFile(
  "sceneBackdrop.ts",
  readFileSync(new URL("./sceneBackdrop.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const functions = ["drawBackdrop", "rockWindow", "releaseRock", "releaseSprite"];
const constants = ["rockWindows", "ROCK_DEPTHS"];
const code = source.statements
  .filter(
    (node) =>
      (ts.isFunctionDeclaration(node) && functions.includes(node.name?.text ?? "")) ||
      (ts.isVariableStatement(node) &&
        node.declarationList.declarations.some(
          (declaration) =>
            ts.isIdentifier(declaration.name) && constants.includes(declaration.name.text),
        )),
  )
  .map((node) => node.getText(source).replace(/^export /u, ""))
  .join("\n");
const RULES = readBackdropRules(publicJson(CORE_MANIFEST.backdropLayers as string))!;
const FILL = 1;

interface Image {
  alpha: number;
  depth: number;
  destroyed: boolean;
  tint: number;
  tintMode: number;
  x: number;
  y: number;
}

function fixture() {
  const created: Image[] = [];
  const image = (): Image & Record<string, unknown> => {
    const made: Image & Record<string, unknown> = {
      alpha: 1,
      depth: 0,
      destroyed: false,
      tint: 0xffffff,
      tintMode: 0,
      x: 0,
      y: 0,
    };
    Object.assign(made, {
      destroy: () => (made.destroyed = true),
      setAlpha: (alpha: number) => Object.assign(made, { alpha }),
      setDepth: (depth: number) => Object.assign(made, { depth }),
      setDisplaySize: () => made,
      setOrigin: () => made,
      setPosition: (x: number, y: number) => Object.assign(made, { x, y }),
      setTint: (tint: number) => Object.assign(made, { tint }),
      setTintMode: (tintMode: number) => Object.assign(made, { tintMode }),
      setVisible: () => made,
    });
    created.push(made);
    return made;
  };
  const scene = {
    add: { image: vi.fn(image) },
    asteroidArt: ASTEROID_ART,
    backdropRules: RULES,
    backdropSprites: new Map<string, Image>(),
    galaxyBackdrops: new Map([[3, { background: "#B8CEC4" }]]),
  };
  const context = createContext({
    BACKDROP_DEPTH,
    Map,
    Math,
    SCREEN,
    Set,
    TintModes: { FILL },
    WeakMap,
    backdropRock,
    backdropRockDepth,
    backdropTint,
    hexNumber,
    rockTexture: () => true,
  });
  runInContext(ts.transpile(code), context);
  const draw = context.drawBackdrop as (scene: unknown, flight: unknown) => void;
  const flight = (x: number, y: number) => ({ galaxy: 3, player: { x, y }, seed: 9 });
  return { created, draw, flight, scene };
}

describe("backdrop rock drawing", () => {
  it("draws both depths as opaque muted pairs, each pair adjacent at one depth in its band", () => {
    const f = fixture();
    f.draw(f.scene, f.flight(500, -300));
    const lit = hexNumber(backdropTint(ASTEROID_ART, 3).backdropLit);
    const pairs = [...f.scene.backdropSprites.entries()].filter(([key]) => !key.endsWith(":fill"));
    expect(pairs.some(([key]) => key.startsWith("far:"))).toBe(true);
    expect(pairs.some(([key]) => key.startsWith("near:"))).toBe(true);
    for (const [key, top] of pairs) {
      const fill = f.scene.backdropSprites.get(`${key}:fill`)!;
      const near = key.startsWith("near:");
      expect(fill.tintMode, key).toBe(FILL);
      expect(fill.tint, key).toBe(0xb8cec4);
      expect(fill.alpha, key).toBe(1);
      expect(top.tint, key).toBe(lit);
      expect(top.alpha, key).toBe(near ? RULES.rocks.value : RULES.farRocks.value);
      expect(top.depth, key).toBe(fill.depth);
      expect([top.x, top.y]).toEqual([fill.x, fill.y]);
      // The silhouette is made first, so it stays under its rock at their shared depth.
      expect(f.created.indexOf(fill)).toBe(f.created.indexOf(top) - 1);
      const band = near ? BACKDROP_DEPTH.rocks : BACKDROP_DEPTH.farRocks;
      expect(Math.abs(top.depth - band), key).toBeLessThanOrEqual(0.2);
    }
    expect(BACKDROP_DEPTH.streaks + 0.2).toBeLessThan(BACKDROP_DEPTH.farRocks - 0.2);
    expect(BACKDROP_DEPTH.farRocks + 0.2).toBeLessThan(BACKDROP_DEPTH.rocks - 0.2);
  });

  it("moves the drawn rocks without making images while the camera stays in its cells", () => {
    const f = fixture();
    f.draw(f.scene, f.flight(500, -300));
    const count = f.scene.add.image.mock.calls.length;
    const before = new Map(
      [...f.scene.backdropSprites].map(([key, sprite]) => [key, [sprite.x, sprite.y]]),
    );
    f.draw(f.scene, f.flight(501, -300));
    expect(f.scene.add.image).toHaveBeenCalledTimes(count);
    const [key, at] = [...before].find(([name]) => name.startsWith("near:"))!;
    const moved = f.scene.backdropSprites.get(key)!;
    expect(moved.x).toBeCloseTo(at[0]! - RULES.rocks.parallax);
    expect(moved.y).toBeCloseTo(at[1]! - RULES.rocks.parallax / 2);
  });

  it("releases a rock's pair as it leaves the view, and every pair when the flight changes", () => {
    const f = fixture();
    f.draw(f.scene, f.flight(500, -300));
    const first = [...f.scene.backdropSprites.values()];
    f.draw(f.scene, f.flight(20000, 9000));
    expect(first.every(({ destroyed }) => destroyed)).toBe(true);
    const far = [...f.scene.backdropSprites.values()];
    f.draw(f.scene, { ...f.flight(20000, 9000), seed: 10 });
    expect(far.every(({ destroyed }) => destroyed)).toBe(true);
    expect(f.scene.backdropSprites.size).toBeGreaterThan(0);
    for (const sprite of f.scene.backdropSprites.values()) {
      expect(sprite.destroyed).toBe(false);
    }
  });

  it("draws nothing until the galaxy's backdrop is loaded", () => {
    const f = fixture();
    f.draw(f.scene, { ...f.flight(0, 0), galaxy: 4 });
    expect(f.scene.add.image).not.toHaveBeenCalled();
  });
});
