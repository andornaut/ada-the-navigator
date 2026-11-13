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

describe("title Settings controls adapter", () => {
  it("shows only on explicit title eligibility and hides again without removing the button", () => {
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
    expect(button.hidden).toBe(false);
    expect(classes.has("ada-no-settings-button")).toBe(false);
    show(false);
    expect(button.hidden).toBe(true);
    expect(classes.has("ada-no-settings-button")).toBe(true);
    expect(settings.openButton).toBe(button);
  });

  it("keeps the Settings node between Achievements and Exit in the native tab order", () => {
    const children = ["settings"];
    const settings = {
      openButton: {
        after: (node: string) => children.splice(children.indexOf("settings") + 1, 0, node),
        before: (node: string) => children.splice(children.indexOf("settings"), 0, node),
      },
    };
    for (const name of ["before", "after"]) {
      const call = statement(
        (node) =>
          ts.isCallExpression(node) &&
          node.expression.getText(source) === `settings.openButton.${name}`,
      );
      evaluate(call, { achievementsButton: "achievements", exitButton: "exit", settings });
    }
    expect(children).toEqual(["achievements", "settings", "exit"]);
  });
});
