import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import { fixtureActionRoot } from "../ui/actionRootFixture.ts";
import { createNavigationButton } from "../ui/navigationButton.ts";
import { createHudNavigationButton } from "../ui/pauseButton.ts";
import { EXIT_SHOWN_ATTRIBUTE } from "../ui/settings.ts";

const source = ts.createSourceFile(
  "controls.ts",
  readFileSync(new URL("./controls.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
function statement(match: (node: ts.Node) => boolean): ts.Node {
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
  return found;
}
function evaluate(text: string, context: object): unknown {
  return runInContext(
    ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2023 } }).outputText,
    createContext(context),
  );
}

function declaration(name: string): ts.Node {
  return statement(
    (node) =>
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.some(
        ({ name: local }) => ts.isIdentifier(local) && local.text === name,
      ),
  );
}

const document = { createElement: (tag: string): Element => new Element(tag) };
class Element extends EventTarget {
  readonly ownerDocument = document;
  readonly children: Element[] = [];
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly classList = { add() {}, remove() {} };
  parentElement: Element | null = null;
  hidden = false;
  disabled = false;

  readonly tag: string;

  constructor(tag: string) {
    super();
    this.tag = tag;
  }

  get isConnected(): boolean {
    return this.tag === "root" || this.parentElement?.isConnected === true;
  }
  append(child: Element) {
    child.remove();
    this.children.push(child);
    child.parentElement = this;
  }
  remove() {
    if (this.parentElement) {
      const siblings = this.parentElement.children;
      siblings.splice(siblings.indexOf(this), 1);
      this.parentElement = null;
    }
  }
  replaceChildren() {
    for (const child of [...this.children]) {
      child.remove();
    }
  }
  contains(target: Element): boolean {
    return target === this || this.children.some((child) => child.contains(target));
  }
  matches(selector: string): boolean {
    return selector.split(",").some((part) => part.trim() === this.tag);
  }
  querySelectorAll(selector: string): Element[] {
    return this.children.flatMap((child) => [
      ...(child.matches(selector) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  toggleAttribute(name: string, enabled: boolean) {
    if (enabled) {
      this.setAttribute(name, "");
    } else {
      this.removeAttribute(name);
    }
  }
}

describe("top navigation controls adapter", () => {
  it("has no standalone Settings or Achievements launchers", () => {
    expect(source.text).not.toMatch(/ada-(settings|achievements)-open|settings\.openButton/u);
    expect(source.text).not.toMatch(/set(?:Settings|Achievements)Button/u);
    expect(source.text).toContain('settings.root.classList.add("ada-no-settings-button")');
  });

  it("puts optional Exit immediately after the Menu", () => {
    const mount = source.text.slice(
      declaration("openNavigation").getStart(source),
      declaration("navigationCovered").getStart(source),
    );
    const visibility = statement(
      (node) => ts.isMethodDeclaration(node) && node.name.getText(source) === "setExitButton",
    ).getText(source);

    const mountTitle = (eligible: boolean) => {
      const root = fixtureActionRoot(document.createElement("root"));
      const mounted = evaluate(
        `${mount}
        ({ navigation, exit, exitButton, ${visibility} });`,
        {
          EXIT_SHOWN_ATTRIBUTE,
          createHudNavigationButton,
          createNavigationButton,
          navigationPresentation: {},
          options: {
            exit: eligible ? { label: "Exit", onExit() {} } : undefined,
            pause: { buttonLabel: "Pause", menuLabel: "Menu" },
          },
          settings: { root },
        },
      ) as {
        navigation: ReturnType<typeof createNavigationButton>;
        exit: ReturnType<typeof createHudNavigationButton> | undefined;
        exitButton: HTMLButtonElement | undefined;
        setExitButton(shown: boolean): void;
      };
      mounted.navigation.setMode("menu");
      return { ...mounted, root };
    };

    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    try {
      const ineligible = mountTitle(false);
      try {
        ineligible.setExitButton(true);
        expect(ineligible.exitButton).toBeUndefined();
        expect(ineligible.root.children).toEqual([ineligible.navigation.button]);
        expect(ineligible.root.getAttribute(EXIT_SHOWN_ATTRIBUTE)).toBeNull();
      } finally {
        ineligible.navigation.dispose();
      }

      const eligible = mountTitle(true);
      try {
        const menu = eligible.navigation.button;
        const exit = eligible.exitButton!;
        expect(eligible.root.children).toEqual([menu, exit]);
        expect(menu.dataset.action).toBe("menu");
        expect(exit.dataset.action).toBe("exit");
        expect(exit.hidden).toBe(true);
        eligible.setExitButton(true);
        expect(exit.hidden).toBe(false);
        expect(eligible.root.getAttribute(EXIT_SHOWN_ATTRIBUTE)).toBe("");
        eligible.setExitButton(false);
        expect(exit.hidden).toBe(true);
        expect(eligible.root.getAttribute(EXIT_SHOWN_ATTRIBUTE)).toBeNull();
        expect(eligible.root.children).toEqual([menu, exit]);
      } finally {
        eligible.exit?.dispose();
        eligible.navigation.dispose();
      }
    } finally {
      fetch.mockRestore();
    }
  });
});
