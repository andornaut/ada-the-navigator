import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { expect, it, vi } from "vitest";

import { playDepth } from "../art/asteroidArt.ts";
import { ADA_LAYERS, adaDepth, boxWith, drawnBox } from "../art/drawOrder.ts";
import { jetsInFront } from "../art/index.ts";

it("places forward occluded plumes above the hull and the halo below every jet and hull layer", () => {
  const source = ts.createSourceFile(
    "scene.ts",
    readFileSync(new URL("./scene.ts", import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  let method: ts.MethodDeclaration | undefined;
  let eligibility: ts.Expression | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isMethodDeclaration(node) && node.name.getText(source) === "placeAda") {
      method = node;
    }
    if (ts.isCallExpression(node) && node.expression.getText(source) === "this.placeAda") {
      eligibility = node.arguments[1];
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!method || !eligibility) {
    throw new Error("Missing actual player jet depth adapter");
  }
  const evaluate = (text: string, context: object) =>
    runInContext(
      ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2023 } }).outputText,
      createContext(context),
    );
  const place = evaluate(
    `class Fixture { ${method.getText(source)} }; Fixture.prototype.placeAda`,
    { ADA_LAYERS, adaDepth, boxWith, drawnBox, playDepth },
  ) as (this: object, flames: object[], front?: boolean) => void;
  const region = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ];
  for (const occluded of [false, true]) {
    for (const travel of ["forward", "reverse", undefined]) {
      const activeJets = {
        headings: [[{ ...(occluded ? { occluders: [region] } : {}) }]],
      };
      const front = evaluate(eligibility.getText(source), {
        activeJets,
        jetsInFront,
        ship: { directionIndex: 0 },
        travel,
      }) as boolean;
      expect(front).toBe(occluded && travel === "forward");
      const fixture = {
        jetHalo: { setDepth: vi.fn() },
        jetKeyline: { setDepth: vi.fn() },
        jets: { setDepth: vi.fn() },
        passable: [],
        ship: {
          displayHeight: 42,
          displayWidth: 42,
          originX: 0.5,
          originY: 0.5,
          setDepth: vi.fn(),
          x: 200,
          y: 200,
        },
        towDepth: 0.1,
        towInk: { setDepth: vi.fn() },
      };
      place.call(fixture, [], front);
      const depth = fixture.ship.setDepth.mock.calls[0]![0] as number;
      const fill = fixture.jets.setDepth.mock.calls[0]![0] as number;
      const ink = fixture.jetKeyline.setDepth.mock.calls[0]![0] as number;
      const halo = fixture.jetHalo.setDepth.mock.calls[0]![0] as number;
      expect(ink).toBeLessThan(fill);
      // The under-hull layers sit below the hull, its keyline (drawKeylines' depth - 2e-6) and
      // every plume layer, front or behind, and above the tow line.
      expect(halo).toBe(depth + ADA_LAYERS.underHull);
      expect(halo).toBeLessThan(depth - 2e-6);
      expect(halo).toBeLessThan(Math.min(ink, fill));
      expect(halo).toBeGreaterThan(depth + ADA_LAYERS.towLine);
      if (front) {
        expect(ink).toBeGreaterThan(depth);
      } else {
        expect(fill).toBe(depth + ADA_LAYERS.jets);
        expect(ink).toBe(depth + ADA_LAYERS.jetKeyline);
      }
      expect(fixture.towInk.setDepth).toHaveBeenCalledWith(
        Math.min(depth, fixture.towDepth) - 1e-6,
      );
    }
  }
});
