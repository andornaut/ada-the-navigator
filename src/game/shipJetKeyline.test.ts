import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { expect, it } from "vitest";

import { LIGHT_FIELD } from "./lightField.ts";
import { normalJetsInFront } from "./shipJets.ts";

it("uses authored opaque normal and centered reverse layers as their own edge", () => {
  const source = ts.createSourceFile(
    "scene.ts",
    readFileSync(new URL("./scene.ts", import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  let expression: ts.Expression | undefined;
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(source) === "keyline" &&
      node.initializer?.getText(source).includes("LIGHT_FIELD.keylined")
    ) {
      expression = node.initializer;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  expect(expression).toBeDefined();
  const select = runInContext(
    ts.transpileModule(
      `(function(travel, activeJets) { const ship = { directionIndex: 0 }; return ${expression!.getText(source)}; })`,
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
    ).outputText,
    createContext({ LIGHT_FIELD, normalJetsInFront }),
  ) as (
    this: { light: boolean; shipRetroJets?: { reverseStyle?: "centered-main" } },
    travel: string,
    jets: object,
  ) => boolean;
  const mouth = { anchor: { x: 0, y: 0 }, axis: { x: 0, y: 1 }, half: { x: 1, y: 0 } };
  const legacy = { headings: [[mouth]] };
  const normal = { headings: [[{ ...mouth, normalAperture: { coreWidth: 0.4 } }]] };
  expect(select.call({ light: true }, "forward", normal)).toBe(false);
  expect(select.call({ light: true }, "reverse", normal)).toBe(true);
  expect(
    select.call(
      { light: true, shipRetroJets: { reverseStyle: "centered-main" } },
      "reverse",
      legacy,
    ),
  ).toBe(false);
  expect(
    select.call(
      { light: true, shipRetroJets: { reverseStyle: "centered-main" } },
      "forward",
      legacy,
    ),
  ).toBe(true);
  expect(select.call({ light: true }, "forward", legacy)).toBe(true);
  expect(select.call({ light: false }, "forward", legacy)).toBe(false);
});
