import { afterEach, describe, expect, it, vi } from "vitest";

import { fixtureActionRoot } from "./actions/actionRootFixture.ts";
import {
  applyAdaControlTheme,
  createAdaPageDivider,
  PAGE_DIVIDER_STYLE,
} from "./buttonPresentation.ts";
import { BUTTON_METRICS } from "./layout/controls.ts";
import { createAdaLayoutPorts } from "./layoutTree.ts";

class TextNode {
  nodeType = 3;
  nodeValue: string | null;
  parentElement: Element | null = null;
  constructor(value: string) {
    this.nodeValue = value;
  }
}

class Element extends EventTarget {
  readonly nodeType = 1;
  attributes = new Map<string, string>();
  children: (Element | TextNode)[] = [];
  className = "";
  dataset: Record<string, string> = {};
  disabled = false;
  hidden = false;
  parentElement: Element | null = null;
  removed = false;
  connected = false;
  get isConnected(): boolean {
    return !this.removed && (this.connected || this.parentElement?.isConnected === true);
  }
  readonly ownerDocument: FixtureDocument;
  readonly tagName: string;
  readonly properties = new Map<string, string>();
  style = {
    getPropertyValue: (key: string) => this.properties.get(key) ?? "",
    setProperty: (key: string, value: string) => this.properties.set(key, value),
  };
  classList = {
    add: (...names: string[]) => {
      for (const name of names) {
        this.toggleClass(name, true);
      }
    },
    contains: (name: string) => this.className.split(" ").includes(name),
    toggle: (name: string, on: boolean) => this.toggleClass(name, on),
  };
  constructor(document: FixtureDocument, tag: string) {
    super();
    this.ownerDocument = document;
    this.tagName = tag;
  }
  private toggleClass(name: string, on: boolean) {
    const names = new Set(this.className.split(" ").filter(Boolean));
    if (on) {
      names.add(name);
    } else {
      names.delete(name);
    }
    this.className = [...names].join(" ");
    return on;
  }
  contains(node: unknown): boolean {
    return (
      node === this ||
      this.children.some(
        (child) => child === node || (child instanceof Element && child.contains(node)),
      )
    );
  }
  closest(selector: string): Element | null {
    return this.matches(selector) ? this : (this.parentElement?.closest(selector) ?? null);
  }
  append(...nodes: (Element | TextNode)[]) {
    for (const node of nodes) {
      if (node.parentElement) {
        node.parentElement.children = node.parentElement.children.filter((child) => child !== node);
      }
      node.parentElement = this;
      this.children.push(node);
    }
  }
  appendChild(node: Element | TextNode) {
    this.append(node);
    return node;
  }
  get firstChild(): Element | TextNode | null {
    return this.children[0] ?? null;
  }
  get textContent(): string {
    return this.children
      .map((child) => (child instanceof TextNode ? (child.nodeValue ?? "") : child.textContent))
      .join("");
  }
  set textContent(value: string) {
    for (const child of this.children) {
      child.parentElement = null;
    }
    this.children = [];
    if (value !== "") {
      this.append(new TextNode(value));
    }
  }
  getAttribute(key: string) {
    return this.attributes.get(key) ?? null;
  }
  setAttribute(key: string, value: string) {
    this.attributes.set(key, value);
  }
  toggleAttribute(key: string, force: boolean) {
    if (force) {
      this.setAttribute(key, "");
    } else {
      this.removeAttribute(key);
    }
    return force;
  }
  removeAttribute(key: string) {
    this.attributes.delete(key);
  }
  remove() {
    this.removed = true;
  }
  matches(selector: string): boolean {
    return selector.split(",").some((part) => {
      const value = part.trim();
      if (value === ":disabled") {
        return this.disabled;
      }
      if (value === "[hidden]") {
        return this.hidden;
      }
      if (value === "[data-action]") {
        return this.dataset.action !== undefined || this.attributes.has("data-action");
      }
      if (value.startsWith(".")) {
        return this.className.split(" ").includes(value.slice(1));
      }
      const input = /^input\[type=["'](button|submit|reset)["']\]$/.exec(value);
      if (input) {
        return this.tagName === "input" && this.attributes.get("type") === input[1];
      }
      const role = /^\[role=["']([^"']+)["']\]$/.exec(value);
      if (role) {
        return this.attributes.get("role") === role[1];
      }
      return this.tagName === value;
    });
  }
  querySelectorAll(selector: string): Element[] {
    return this.children.flatMap((child) =>
      child instanceof Element
        ? [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]
        : [],
    );
  }
  click() {
    this.dispatchEvent(new Event("click", { cancelable: true }));
  }
}

class FixtureDocument {
  defaultView = {
    HTMLElement: Element,
    Node: Element,
    getComputedStyle: () => ({
      borderBottomWidth: "6px",
      borderLeftWidth: "2px",
      borderRightWidth: "2px",
      borderTopWidth: "4px",
    }),
  };
  createElement(tag: string) {
    return new Element(this, tag);
  }
  createElementNS(_namespace: string, tag: string) {
    return this.createElement(tag);
  }
}

afterEach(() => vi.unstubAllGlobals());

describe("actual typed-layout button presentation", () => {
  it("retains button, label, reason and root across guarded presentation updates", () => {
    const document = new FixtureDocument();
    vi.stubGlobal("document", document);
    vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
    let unavailable = false;
    const action = vi.fn();
    const host = fixtureActionRoot(document.createElement("div"));
    host.connected = true;
    const ports = createAdaLayoutPorts({
      actionRoot: host as unknown as HTMLElement,
      actions: new Map([["buy", action]]),
      availability: () =>
        unavailable ? { kind: "unavailable", reason: "Needs 20 Stardust" } : { kind: "available" },
    });
    const initial = { actionId: "buy", label: "Buy equipment", role: "secondary" as const };
    const part = ports.components.button.create(initial);
    const root = part.element as unknown as Element;
    host.append(root);
    const button = root.children[0] as Element;
    const labelFace = button.children[0] as Element;
    const label = labelFace.children[0] as TextNode;
    const reason = root.children[1] as Element;
    expect(label.nodeType).toBe(3);
    expect(labelFace.classList.contains("ui-control-label")).toBe(true);
    expect(button.getAttribute("data-ui-size")).toBe("ordinary");
    expect(root.getAttribute("data-ui-placement")).toBe("top");
    button.click();
    expect(action).toHaveBeenCalledOnce();
    unavailable = true;
    part.update({
      ...initial,
      align: "center",
      label: "Requires a matching weapon",
      role: "primary",
      size: "compact",
    });
    expect(part.element).toBe(root);
    expect(root.children).toEqual([button, reason]);
    expect(button.children[0]).toBe(labelFace);
    expect(labelFace.children[0]?.nodeType).toBe(3);
    expect(labelFace.textContent).toBe("Requires a matching weapon");
    expect(button.getAttribute("data-ui-size")).toBe("compact");
    expect(button.properties.get("--ui-button-min-width")).toBe(
      String(BUTTON_METRICS.compact.minWidth),
    );
    expect(button.classList.contains("ada-primary")).toBe(true);
    expect(button.classList.contains("ada-compact")).toBe(true);
    expect(root.getAttribute("data-ui-placement")).toBe("center");
    expect(reason.textContent).toBe("Needs 20 Stardust");
    expect(reason.hidden).toBe(false);
    button.click();
    expect(action).toHaveBeenCalledOnce();
    expect(button.getAttribute("aria-disabled")).toBe("true");
    unavailable = false;
    part.update(initial);
    expect(reason.hidden).toBe(true);
    expect(button.classList.contains("ada-compact")).toBe(false);
    expect(root.getAttribute("data-ui-placement")).toBe("top");
    part.dispose();
    button.click();
    expect(action).toHaveBeenCalledOnce();
    expect(root.removed).toBe(true);
  });

  it("uses the published page divider with one inherited token", () => {
    const document = new FixtureDocument();
    const root = document.createElement("div");
    applyAdaControlTheme(root as unknown as HTMLElement);
    const divider = createAdaPageDivider(document as unknown as Document) as unknown as Element;
    expect(divider.classList.contains("ui-page-divider")).toBe(true);
    expect(divider.getAttribute("aria-orientation")).toBe("vertical");
    expect(divider.properties.size).toBe(0);
    expect(root.properties.get("--ui-page-divider-thickness")).toBe(
      String(PAGE_DIVIDER_STYLE.thickness),
    );
    expect(root.properties.get("--ui-page-divider-colour")).toBe(
      `#${PAGE_DIVIDER_STYLE.colour.toString(16)}`,
    );
  });
});
