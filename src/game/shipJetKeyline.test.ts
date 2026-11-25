import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { expect, it } from "vitest";

import { joinsJets, LIGHT_FIELD } from "./lightField.ts";

it("draws no keyline round Ada's plumes unless the light field joins her jets", () => {
  const source = ts.createSourceFile(
    "scene.ts",
    readFileSync(new URL("./scene.ts", import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  let expression: ts.Expression | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "keyline") {
      expression = node.initializer;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  expect(expression).toBeDefined();
  const select = (rule: typeof LIGHT_FIELD, light: boolean) =>
    runInContext(
      ts.transpileModule(`(function() { return ${expression!.getText(source)}; })`, {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
      }).outputText,
      createContext({ LIGHT_FIELD: rule, joinsJets }),
    ).call({ light }) as boolean;
  // Art exempts the ship: her plumes take no keyline on a light field.
  expect(LIGHT_FIELD.jetKeyline.exempt).toContain("ship");
  expect(select(LIGHT_FIELD, true)).toBe(false);
  const joined = { ...LIGHT_FIELD, jetKeyline: { ...LIGHT_FIELD.jetKeyline, exempt: [] } };
  expect(select(joined, true)).toBe(true);
  expect(select(joined, false)).toBe(false);
});
