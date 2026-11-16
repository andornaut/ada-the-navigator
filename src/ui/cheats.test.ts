import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveAdaHoldAction } from "./actionBinding.ts";
import { fixtureActionRoot } from "./actionRootFixture.ts";
import { createCheats } from "./cheats.ts";

let installed = false;
vi.mock("@andornaut/game-kit/runtime/web/pwa/appWindow", () => ({
  runsInAppWindow: () => installed,
}));

class Element extends EventTarget {
  nodeType = 1;
  disabled = false;
  isConnected = true;
  get ownerDocument() {
    return { ...document, defaultView: { HTMLElement: Element, Node: Element } };
  }
  get parentElement(): Element | null {
    return this.parent ?? null;
  }
  get parentNode(): Element | null {
    return this.parent ?? null;
  }
  get nextSibling(): Element | null {
    return this.parent?.children[this.parent.children.indexOf(this) + 1] ?? null;
  }
  get firstChild(): Element | null {
    return this.children[0] ?? null;
  }
  getClientRects() {
    return [1];
  }
  closest(): Element | null {
    return this.hidden ? this : (this.parent?.closest() ?? null);
  }
  focus() {}
  contains(node: unknown): boolean {
    return node === this || this.children.some((child) => child.contains(node));
  }
  insertBefore(node: Element, before: Element | null) {
    node.remove();
    node.parent = this;
    this.children.splice(
      before === null ? this.children.length : this.children.indexOf(before),
      0,
      node,
    );
  }
  readonly children: Element[] = [];
  className = "";
  readonly dataset: Record<string, string> = {};
  hidden = false;
  parent: Element | undefined;
  textContent = "";
  append(...nodes: Element[]) {
    for (const node of nodes) {
      this.insertBefore(node, null);
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

vi.mock("./modalLayer.ts", () => ({
  createModalLayer: () => ({ dispose: vi.fn(), open: () => vi.fn() }),
}));
vi.mock("@andornaut/game-kit/runtime/web/ui/dom/focusModality", () => ({
  focusTarget: (node: Element) => node.focus(),
}));

vi.mock("./layout/viewScale.ts", () => ({ readViewUnit: () => 1 }));
vi.mock("./modal.ts", () => ({
  createActions: (items: { button: Element }[]) => {
    const row = new Element();
    row.append(...items.map((item) => item.button));
    return row;
  },
  createButton: (label: string) => Object.assign(new Element(), { textContent: label }),
  createCard: () => {
    const body = new Element(),
      card = new Element(),
      close = new Element(),
      frame = new Element();
    card.append(body);
    frame.append(card, close);
    return { body, card, close, dispose: vi.fn(), fit: vi.fn(), frame };
  },
  setFooterAction: (action: string, row: Element) => {
    row.dataset.footerAction = action;
  },
}));

beforeEach(() => {
  installed = false;
  vi.stubGlobal("HTMLElement", Element);
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

function setup(footer?: { readonly intent: "back" | "close"; readonly label: string }) {
  const root = new Element();
  fixtureActionRoot(root);
  const actions = new Element();
  const close = Object.assign(new Element(), { className: "ada-primary", textContent: "Close" });
  actions.append(close);
  const run = {};
  const changed = vi.fn();
  const cheats = createCheats(root as unknown as HTMLElement, actions as unknown as HTMLElement, {
    actions: [],
    beforeOpen: vi.fn(),
    canExecute: () => true,
    ...(footer ? { footer } : {}),
    labels: {
      close: "Close",
      open: "Open cheats",
      runGroup: "Run",
      runPersistence: "Run only",
      saveGroup: "Save",
      savePersistence: "Saved",
      title: "Cheats",
    },
    onOpenChange: changed,
    onSave: vi.fn(),
    restoreFocus: vi.fn(),
    run: () => run,
  });
  return { actions, changed, cheats, close, root };
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

function descendants(root: Element): Element[] {
  return [root, ...root.children.flatMap(descendants)];
}
it("keeps group order, executes actions once and unregisters on disposal", async () => {
  const root = new Element(),
    launcher = new Element();
  fixtureActionRoot(root);
  const save = vi.fn(),
    runEffect = vi.fn(),
    onSave = vi.fn();
  const run = {};
  const cheats = createCheats(root as unknown as HTMLElement, launcher as unknown as HTMLElement, {
    actions: [
      {
        description: "Run description",
        execute: ({ commit }) => {
          commit(runEffect);
        },
        id: "run",
        label: "Run action",
        scope: "run",
      },
      {
        description: "Save description",
        execute: ({ commit }) => {
          commit(save);
        },
        id: "save",
        label: "Save action",
        scope: "save",
      },
    ],
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
    onSave,
    restoreFocus: vi.fn(),
    run: () => run,
  });
  const nodes = descendants(root);
  expect(
    nodes.filter((n) => n.className === "ada-cheat-section").map((n) => n.children[0]!.textContent),
  ).toEqual(["Save", "Run"]);
  expect(nodes.filter((n) => n.className === "ada-prose").map((n) => n.textContent)).toEqual([
    "Saved",
    "Save description",
    "Run only",
    "Run description",
  ]);
  const buttons = nodes.filter((n) => n.dataset.cheat);
  launcher.children[0]!.dispatchEvent(new Event("click"));
  buttons[0]!.dispatchEvent(new Event("click"));
  buttons[0]!.dispatchEvent(new Event("click"));
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect(save).toHaveBeenCalledOnce();
  expect(onSave).toHaveBeenCalledOnce();
  expect(runEffect).not.toHaveBeenCalled();
  cheats.refresh();
  buttons[1]!.dispatchEvent(new Event("click"));
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect(runEffect).toHaveBeenCalledOnce();
  expect(onSave).toHaveBeenCalledOnce();
  cheats.dispose();
  buttons[0]!.dispatchEvent(new Event("click"));
  expect(save).toHaveBeenCalledOnce();
});

it("gives header and footer one registered close path with foreground and disposal guards", () => {
  const f = setup();
  const footer = descendants(f.root).find((node) => node.dataset.footerAction === "close")!;
  const dismiss = footer.children[0]!;
  expect(dismiss.textContent).toBe("Close");
  expect(dismiss.dataset.action).toBe("dismiss-cheats");
  expect(resolveAdaHoldAction(f.root as unknown as HTMLElement, dismiss)?.available()).toBe(false);
  f.actions.children[0]!.dispatchEvent(new Event("click"));
  const held = resolveAdaHoldAction(f.root as unknown as HTMLElement, dismiss)!;
  expect(held.available()).toBe(true);
  held.activate();
  dismiss.dispatchEvent(new Event("click"));
  expect(f.changed.mock.calls).toEqual([[true], [false]]);
  f.actions.children[0]!.dispatchEvent(new Event("click"));
  f.cheats.dispose();
  held.activate();
  dismiss.dispatchEvent(new Event("click"));
  expect(f.changed.mock.calls).toEqual([[true], [false], [true], [false]]);
});

it("uses a supplied parent Back only for the footer and preserves one dismissal path", () => {
  const f = setup({ intent: "back", label: "Back" });
  const footer = descendants(f.root).find((node) => node.dataset.footerAction === "back")!;
  const dismiss = footer.children[0]!;
  expect(dismiss.textContent).toBe("Back");
  f.actions.children[0]!.dispatchEvent(new Event("click"));
  dismiss.dispatchEvent(new Event("click"));
  dismiss.dispatchEvent(new Event("click"));
  expect(f.changed.mock.calls).toEqual([[true], [false]]);
  f.cheats.dispose();
  expect(resolveAdaHoldAction(f.root as unknown as HTMLElement, dismiss)?.available()).not.toBe(
    true,
  );
});
