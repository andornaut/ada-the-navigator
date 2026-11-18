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
    throw new Error("Missing production title Settings adapter");
  }
  return found.getText(source);
}
function evaluate(text: string, context: object): unknown {
  return runInContext(
    ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2023 } }).outputText,
    createContext(context),
  );
}

describe("nested Settings controls adapter", () => {
  it("keeps the standalone button hidden even on title eligibility", () => {
    const classes = new Set(["ada-no-settings-button"]);
    const button = { hidden: true };
    const settings = {
      openButton: button,
      root: {
        classList: {
          toggle: (name: string, shown: boolean) =>
            shown ? classes.add(name) : classes.delete(name),
        },
      },
    };
    const method = statement(
      (node) => ts.isMethodDeclaration(node) && node.name.getText(source) === "setSettingsButton",
    );
    const show = evaluate(`({${method}}).setSettingsButton`, { settings }) as (
      shown: boolean,
    ) => void;
    show(true);
    expect(button.hidden).toBe(true);
    expect(classes.has("ada-no-settings-button")).toBe(true);
    show(false);
    expect(button.hidden).toBe(true);
    expect(classes.has("ada-no-settings-button")).toBe(true);
    expect(settings.openButton).toBe(button);
  });

  it("keeps Achievements before the hidden Settings node and Exit right after the Menu", () => {
    const children = ["settings", "menu"];
    const insert = (anchor: string, offset: number) => (node: string) =>
      children.splice(children.indexOf(anchor) + offset, 0, node);
    const settings = {
      openButton: { after: insert("settings", 1), before: insert("settings", 0) },
    };
    const pauseButton = { after: insert("menu", 1), before: insert("menu", 0) };
    const context = {
      achievementsButton: "achievements",
      exitButton: "exit",
      pauseButton,
      settings,
    };
    evaluate(
      statement(
        (node) =>
          ts.isCallExpression(node) &&
          node.expression.getText(source) === "settings.openButton.before",
      ),
      context,
    );
    evaluate(
      statement(
        (node) =>
          ts.isIfStatement(node) &&
          node.expression.getText(source) === "exitButton" &&
          node.thenStatement.getText(source).includes("pauseButton.after(exitButton)"),
      ),
      context,
    );
    expect(children).toEqual(["achievements", "settings", "menu", "exit"]);
    expect(source.text).not.toContain("settings.openButton.after(");
  });
});
