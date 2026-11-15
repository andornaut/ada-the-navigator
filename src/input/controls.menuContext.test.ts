import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const source = ts.createSourceFile(
  "sceneUi.ts",
  readFileSync(new URL("../game/sceneUi.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
function mapBackEligibility(): string {
  let result: ts.Expression | undefined;
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(source) === "scene.controls.registerBack" &&
      node.arguments[0]?.getText(source).includes("back: closeGalaxyMap")
    ) {
      const options = node.arguments[0] as ts.ObjectLiteralExpression;
      const member = options.properties.find(
        (property) => property.name?.getText(source) === "isOpen",
      ) as ts.PropertyAssignment;
      result = member.initializer;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!result) {
    throw new Error("Missing actual map back registration");
  }
  return ts.transpileModule(`(${result.getText(source)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2023 },
  }).outputText;
}

describe("Menu ancestry on the actual galaxy-map caller", () => {
  it.each([false, true])(
    "blocks the parent back handler while an inner Menu/card is open (%s)",
    (covered) => {
      const scene = {
        controls: { navigationCovered: () => covered },
        galaxies: { isOpen: () => true },
        model: { galaxyMapShownInFlight: true },
        settingsOpen: true,
      };
      const read = runInContext(mapBackEligibility(), createContext({ scene })) as () => boolean;
      expect(read()).toBe(!covered);
      expect(scene.model.galaxyMapShownInFlight).toBe(true);
    },
  );
});
