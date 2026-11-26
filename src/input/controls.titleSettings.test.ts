import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const source = ts.createSourceFile(
  "controls.ts",
  readFileSync(new URL("./controls.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
function statement(match: (node: ts.Node) => boolean): string {
  let found: ts.Node | undefined;
  const visit = (node: ts.Node): void => {
    if (match(node)) {
      found = node;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!found) {
    throw new Error("Missing production Exit placement");
  }
  return found.getText(source);
}
function evaluate(text: string, context: object): unknown {
  return runInContext(
    ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2023 } }).outputText,
    createContext(context),
  );
}

describe("top navigation controls adapter", () => {
  it("has no standalone Settings or Achievements launchers", () => {
    expect(source.text).not.toMatch(/ada-(settings|achievements)-open|settings\.openButton/u);
    expect(source.text).not.toMatch(/set(?:Settings|Achievements)Button/u);
    expect(source.text).toContain('settings.root.classList.add("ada-no-settings-button")');
  });

  it("puts optional Exit immediately after the Menu", () => {
    const children = ["menu"];
    const pauseButton = {
      after: (node: string) => children.splice(children.indexOf("menu") + 1, 0, node),
    };
    const placement = statement(
      (node) =>
        ts.isIfStatement(node) &&
        node.expression.getText(source) === "exitButton" &&
        node.thenStatement.getText(source).includes("pauseButton.after(exitButton)"),
    );
    evaluate(placement, { exitButton: undefined, pauseButton });
    expect(children).toEqual(["menu"]);
    evaluate(placement, { exitButton: "exit", pauseButton });
    expect(children).toEqual(["menu", "exit"]);
  });
});
