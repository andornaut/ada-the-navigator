import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCheats } from "./cheats.ts";

let installed = false;
vi.mock("@andornaut/game-kit/web/pwa/appWindow", () => ({
  runsInAppWindow: () => installed,
}));

class Element {
  readonly children: Element[] = [];
  className = "";
  readonly dataset: Record<string, string> = {};
  hidden = false;
  parent: Element | undefined;
  textContent = "";
  addEventListener() {}
  append(...nodes: Element[]) {
    for (const node of nodes) {
      node.parent = this;
      this.children.push(node);
    }
  }
  prepend(node: Element) {
    node.parent = this;
    this.children.unshift(node);
  }
  remove() {
    this.parent?.children.splice(this.parent.children.indexOf(this), 1);
  }
  setAttribute() {}
}

vi.mock("./modal.ts", () => ({
  createButton: (label: string) => Object.assign(new Element(), { textContent: label }),
  createCard: () => ({
    body: new Element(),
    card: new Element(),
    close: new Element(),
    dispose: vi.fn(),
    fit: vi.fn(),
    frame: new Element(),
  }),
}));

beforeEach(() => {
  installed = false;
  vi.stubGlobal("document", {
    addEventListener: vi.fn(),
    createElement: () => new Element(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    matchMedia: () => ({ addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    removeEventListener: vi.fn(),
  });
});
afterEach(() => vi.unstubAllGlobals());

function setup() {
  const root = new Element();
  const actions = new Element();
  const close = Object.assign(new Element(), { className: "ada-primary", textContent: "Close" });
  actions.append(close);
  const run = {};
  const cheats = createCheats(root as unknown as HTMLElement, actions as unknown as HTMLElement, {
    actions: [],
    beforeOpen: vi.fn(),
    canExecute: () => true,
    labels: {
      close: "Close",
      open: "Open cheats",
      runGroup: "Run",
      runPersistence: "Run only",
      saveGroup: "Save",
      savePersistence: "Saved",
      title: "Cheats",
    },
    onOpenChange: vi.fn(),
    onSave: vi.fn(),
    restoreFocus: vi.fn(),
    run: () => run,
  });
  return { actions, cheats, close };
}

describe("Settings cheat launcher", () => {
  it("places the secondary launcher before the existing primary Close", () => {
    const { actions, cheats, close } = setup();
    expect(actions.children.map((node) => node.textContent)).toEqual(["Open cheats", "Close"]);
    expect(actions.children[0]!.className).not.toContain("ada-primary");
    expect(actions.children[1]).toBe(close);
    cheats.dispose();
  });

  it("hides only the launcher in the installed app, keeping Close available", () => {
    const { actions, cheats, close } = setup();
    installed = true;
    cheats.refresh();
    expect(actions.children[0]!.hidden).toBe(true);
    expect(actions.hidden).toBe(false);
    expect(close.hidden).toBe(false);
    cheats.dispose();
  });

  it("removes only its launcher when disposed", () => {
    const { actions, cheats, close } = setup();
    cheats.dispose();
    expect(actions.children).toEqual([close]);
  });
});
