import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveAdaHoldAction } from "./actionBinding.ts";
import { registerAdaActionRoot } from "./actionRegistry.ts";
import { createStartScreen } from "./startScreen.ts";
import type { TitleScreenArt } from "./titleScreen.ts";

vi.mock("./uiSkin.ts", () => ({ applyButtonSkin: vi.fn().mockResolvedValue(undefined) }));

class Element {
  readonly tag: string;
  constructor(tag = "div") {
    this.tag = tag;
  }
  prepend(...nodes: Element[]) {
    for (const node of [...nodes].reverse()) {
      this.insertBefore(node, this.firstChild);
    }
  }
  readonly attributes = new Map<string, string>();
  readonly children: Element[] = [];
  get parentElement(): Element | null {
    return this.parent ?? null;
  }
  readonly nodeType = 1;
  readonly isConnected = true;
  get parentNode(): Element | null {
    return this.parent ?? null;
  }
  get nextSibling(): Element | null {
    return this.parent?.children[this.parent.children.indexOf(this) + 1] ?? null;
  }
  get firstElementChild(): Element | null {
    return this.children[0] ?? null;
  }
  get firstChild(): Element | null {
    return this.firstElementChild;
  }
  get ownerDocument() {
    return document;
  }
  contains(node: unknown): boolean {
    return (
      node === this ||
      (node instanceof Element && Boolean(node.parent) && this.contains(node.parent))
    );
  }
  className = "";
  readonly classList = {
    add: vi.fn((...names: string[]) => {
      this.className = [...new Set([...this.className.split(" "), ...names])]
        .filter(Boolean)
        .join(" ");
    }),
    remove: vi.fn((name: string) => {
      this.className = this.className
        .split(" ")
        .filter((item) => item !== name)
        .join(" ");
    }),
  };
  readonly dataset: Record<string, string> = {};
  hidden = false;
  disabled = false;
  parent: Element | undefined;
  readonly listeners = new Map<string, (() => void)[]>();
  readonly properties = new Map<string, string>();
  readonly style = {
    getPropertyValue: (name: string) => this.properties.get(name) ?? "",
    removeProperty: (name: string) => {
      const value = this.properties.get(name) ?? "";
      this.properties.delete(name);
      return value;
    },
    setProperty: vi.fn((name: string, value: string) => this.properties.set(name, value)),
  };
  textContent = "";
  addEventListener(type: string, listener: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  removeEventListener(type: string, listener: () => void) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((item) => item !== listener),
    );
  }
  append(...nodes: Element[]) {
    for (const node of nodes) {
      node.parent?.children.splice(node.parent.children.indexOf(node), 1);
      node.parent = this;
      this.children.push(node);
    }
  }
  click() {
    this.listeners.get("click")?.forEach((listener) => listener());
  }
  closest(): Element | null {
    return this.hidden ? this : (this.parent?.closest() ?? null);
  }
  get lastElementChild() {
    return this.children.at(-1);
  }
  insertBefore(node: Element, before: Element | null) {
    if (node === before) {
      return;
    }
    node.remove();
    node.parent = this;
    this.children.splice(
      before === null ? this.children.length : this.children.indexOf(before),
      0,
      node,
    );
  }
  querySelectorAll() {
    return [];
  }
  remove() {
    if (this.parent) {
      this.parent.children.splice(this.parent.children.indexOf(this), 1);
    }
    this.parent = undefined;
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
}

const triangle = {
  alpha: 1,
  color: 0xffffff,
  points: [
    { x: -160, y: 0 },
    { x: -180, y: 20 },
    { x: -160, y: 40 },
  ] as const,
};
const occluders = [
  [
    { x: -150, y: 5 },
    { x: -130, y: 5 },
    { x: -130, y: 30 },
  ],
];
function render(masked: boolean): Element {
  vi.stubGlobal("document", {
    createElement: (tag: string) => new Element(tag),
    createElementNS: (_: string, tag: string) => new Element(tag),
    defaultView: { HTMLElement: Element, Node: Element },
  });
  const art: TitleScreenArt = {
    background: "#292734",
    field: { at: { x: -120, y: 0 }, height: 540, url: "/field.png", width: 960 },
    jets: [
      triangle,
      ...(masked
        ? [
            { ...triangle, occluders },
            { ...triangle, occluders },
          ]
        : []),
    ],
    pivot: { x: 0.5, y: 0.5 },
    ships: new Map([[null, "/ship.png"]]),
    wordmark: { height: 102, url: "/wordmark.svg", width: 270 },
  };
  return createStartScreen(new Element("main") as unknown as HTMLElement, art, {
    actions: [],
    paint: null,
    title: "Ada",
  }).root as unknown as Element;
}
afterEach(() => vi.unstubAllGlobals());

describe("title plume draw layers", () => {
  it("keeps old-data plumes behind the complete ship without an unmasked foreground layer", () => {
    const root = render(false);
    expect(root.children.map(({ tag }) => tag)).toEqual(["div", "svg", "img", "h1", "div"]);
    expect(root.children[1]!.children).toHaveLength(1);
    expect(root.children[1]!.children[0]!.attributes.has("mask")).toBe(false);
  });

  it("reveals only authored depth-masked mouths above the sprite, without duplicating legacy jets", () => {
    const root = render(true);
    const [, behind, ship, front] = root.children;
    expect(ship!.tag).toBe("img");
    expect(behind!.children).toHaveLength(1);
    expect(front!.className).toContain("ada-start-jets-front");
    expect(front!.children.map(({ tag }) => tag)).toEqual(["defs", "polygon", "polygon"]);
    const mask = front!.children[0]!.children[0]!;
    expect(mask.attributes.get("maskUnits")).toBe("userSpaceOnUse");
    expect(Number(mask.attributes.get("x"))).toBeLessThan(0);
    expect(mask.children.map((node) => node.attributes.get("fill"))).toEqual(["white", "black"]);
    expect(mask.children[1]!.attributes.get("points")).toBe("-10,145 10,145 10,170");
    const reference = `url(#${mask.attributes.get("id")})`;
    expect(front!.children.slice(1).map((node) => node.attributes.get("mask"))).toEqual([
      reference,
      reference,
    ]);
    const other = render(true).children[3]!.children[0]!.children[0]!;
    expect(other.attributes.get("id")).not.toBe(mask.attributes.get("id"));
  });
});

it("retains supplied action order, labels, roles and callbacks with the status note after the row", () => {
  vi.stubGlobal("document", {
    createElement: (tag: string) => new Element(tag),
    defaultView: { HTMLElement: Element, Node: Element },
  });
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
  const restart = vi.fn();
  const proceed = vi.fn();
  const host = new Element("main");
  let allowed = true;
  const release = registerAdaActionRoot({ permits: () => allowed }, host as unknown as HTMLElement);
  const existing = new Element("nav");
  host.append(existing);
  const view = createStartScreen(host as unknown as HTMLElement, null, {
    actions: [
      { action: "restart", label: "New", role: "secondary", run: restart },
      { action: "continue", label: "Continue", role: "primary", run: proceed },
    ],
    note: "Saved progress",
    paint: null,
    title: "Ada",
  });
  const root = view.root as unknown as Element;
  expect(host.children).toEqual([root, existing]);
  expect(root.children.map(({ tag }) => tag)).toEqual(["h1", "div", "p"]);
  expect(root.children[2]!.textContent).toBe("Saved progress");
  expect(root.children[2]!.attributes.get("role")).toBe("status");
  const buttons = view.buttons as unknown as Element[];
  expect(root.children[1]!.children).toEqual(buttons);
  expect(
    buttons.map(({ className, dataset, textContent }) => [dataset.action, textContent, className]),
  ).toEqual([
    ["restart", "New", "ada-button"],
    ["continue", "Continue", "ada-button ada-primary"],
  ]);
  buttons[0]!.click();
  buttons[1]!.click();
  expect(restart).toHaveBeenCalledTimes(1);
  expect(proceed).toHaveBeenCalledTimes(1);
  const held = resolveAdaHoldAction(
    host as unknown as HTMLElement,
    buttons[1] as unknown as EventTarget,
  )!;
  expect(held.rule.holdMs).toBe(500);
  expect(held.available()).toBe(true);
  held.activate();
  expect(proceed).toHaveBeenCalledTimes(2);
  allowed = false;
  held.activate();
  buttons[1]!.click();
  expect(proceed).toHaveBeenCalledTimes(2);
  allowed = true;
  buttons[1]!.disabled = true;
  expect(held.available()).toBe(false);
  buttons[1]!.click();
  expect(proceed).toHaveBeenCalledTimes(2);
  buttons[1]!.disabled = false;
  view.dispose();
  view.dispose();
  held.activate();
  expect(
    resolveAdaHoldAction(host as unknown as HTMLElement, buttons[1] as unknown as EventTarget),
  ).toBeNull();
  release();
  buttons[1]!.click();
  expect(proceed).toHaveBeenCalledTimes(2);
  expect(host.children).toEqual([existing]);
});
