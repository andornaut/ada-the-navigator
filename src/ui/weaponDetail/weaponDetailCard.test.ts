import { afterEach, expect, it, vi } from "vitest";

import { uiIconUrl } from "../../data/uiIconUrl.ts";
import { WEAPON_DETAIL_LABELS, weaponDetailLines } from "../../data/weaponDetails.ts";
import { resolveAdaHoldAction } from "../actions/actionBinding.ts";
import { registerAdaActionRoot } from "../actions/actionRegistry.ts";
import { fixtureActionRoot } from "../actions/actionRoot.fixture.ts";
import { enterPressView, rootPressGuard } from "../actions/pressScope.ts";
import { compactLevelName } from "../compactLevelName.ts";
import { createWeaponDetailCard } from "./weaponDetailCard.ts";

const fixture = vi.hoisted(() => {
  class Node extends EventTarget {
    tagName = "DIV";
    type = "";
    disabled = false;
    nodeType = 1;
    parentElement: Node | null = null;
    get isConnected(): boolean {
      return (
        this === (document.body as unknown as Node) || (this.parentElement?.isConnected ?? false)
      );
    }
    get ownerDocument() {
      const doc = document as unknown as {
        activeElement?: Node | null;
        addEventListener?: EventTarget["addEventListener"];
        removeEventListener?: EventTarget["removeEventListener"];
        defaultView?: object;
      };
      if (!doc.addEventListener) {
        const events = new EventTarget();
        doc.addEventListener = events.addEventListener.bind(events);
        doc.removeEventListener = events.removeEventListener.bind(events);
      }
      doc.activeElement ??= null;
      doc.defaultView ??= Object.assign(new EventTarget(), {
        Element: Node,
        HTMLElement: Node,
        MutationObserver: class {
          disconnect() {}
          observe() {}
          takeRecords() {
            return [];
          }
        },
        Node,
        getComputedStyle: () => ({}),
      });
      return document;
    }
    get parentNode() {
      return this.parentElement;
    }
    get nextSibling(): Node | null {
      return this.parentElement?.children[this.parentElement.children.indexOf(this) + 1] ?? null;
    }
    get firstChild() {
      const getText = () => this.textContent;
      const setText = (value: string) => {
        this.textContent = value;
      };
      return {
        nodeType: 3,
        get nodeValue() {
          return getText();
        },
        set nodeValue(value: string) {
          setText(value);
        },
      };
    }
    classList = {
      add: (name: string) => this.classList.toggle(name, true),
      remove: (name: string) => this.classList.toggle(name, false),
      toggle: (name: string, on: boolean) => {
        const names = new Set(this.className.split(" ").filter(Boolean));
        if (on) {
          names.add(name);
        } else {
          names.delete(name);
        }
        this.className = [...names].join(" ");
      },
    };
    contains(node: unknown): boolean {
      return node === this || this.children.some((child) => child.contains(node));
    }
    closest(): Node | null {
      return this.hidden || "inert" in this.attributes
        ? this
        : (this.parentElement?.closest() ?? null);
    }
    insertBefore(node: Node, before: Node | null) {
      node.remove();
      node.parentElement = this;
      this.children.splice(
        before === null ? this.children.length : this.children.indexOf(before),
        0,
        node,
      );
    }
    querySelector(selector: string): Node | null {
      return this.querySelectorAll(selector)[0] ?? null;
    }
    children: Node[] = [];
    className = "";
    dataset: Record<string, string> = {};
    hidden = false;
    private text = "";
    get textContent(): string {
      return this.text + this.children.map((child) => child.textContent).join("");
    }
    set textContent(value: string) {
      this.replaceChildren();
      this.text = value;
    }
    attributes: Record<string, string> = {};
    style = {
      display: "",
      getPropertyValue: () => "",
      removeProperty: vi.fn(),
      setProperty: vi.fn(),
    };
    tabIndex = 0;
    focus = vi.fn(() => {
      (document as unknown as { activeElement: Node | null }).activeElement = this;
    });
    hasAttribute(name: string) {
      return name === "hidden" ? this.hidden : name in this.attributes;
    }
    toggleAttribute(name: string, force?: boolean) {
      const enabled = force ?? (name === "hidden" ? !this.hidden : !(name in this.attributes));
      if (enabled) {
        this.setAttribute(name, "");
      } else {
        this.removeAttribute(name);
      }
      return enabled;
    }
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    }
    matches(selector: string): boolean {
      if (this.nodeType !== 1) {
        return false;
      }
      return selector.split(",").some((part) => {
        const value = part.trim();
        if (value === ":disabled") {
          return this.disabled;
        }
        if (value === "button" || value === "img") {
          return this.tagName === value.toUpperCase();
        }
        if (value.startsWith(".")) {
          return this.className.split(" ").includes(value.slice(1));
        }
        if (value === "[data-action]") {
          return this.dataset.action !== undefined || this.getAttribute("data-action") !== null;
        }
        const input = /^input\[type=["'](button|submit|reset)["']\]$/.exec(value);
        if (input) {
          return this.tagName === "INPUT" && (this.getAttribute("type") ?? this.type) === input[1];
        }
        const role = /^\[role=["']([^"']+)["']\]$/.exec(value);
        if (role) {
          return this.getAttribute("role") === role[1];
        }
        const action = /^\[data-action=["']([^"']+)["']\]$/.exec(value);
        return (
          action !== null && (this.dataset.action ?? this.getAttribute("data-action")) === action[1]
        );
      });
    }
    querySelectorAll(selector: string): Node[] {
      return this.children.flatMap((child) => [
        ...(child.matches(selector) ? [child] : []),
        ...child.querySelectorAll(selector),
      ]);
    }
    remove = vi.fn(() => {
      if (this.parentElement) {
        this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
      }
      this.parentElement = null;
    });
    append(...nodes: Node[]) {
      for (const node of nodes) {
        this.insertBefore(node, null);
      }
    }
    replaceChildren(...nodes: Node[]) {
      for (const child of [...this.children]) {
        child.remove();
      }
      this.text = "";
      this.append(...nodes);
    }
    removeAttribute(name: string) {
      delete this.attributes[name];
    }
    cloneNode(): Node {
      return Object.assign(new Node(), { className: this.className });
    }
    setAttribute(name: string, value: string) {
      this.attributes[name] = value;
    }
  }
  const card = {
    body: new Node(),
    card: new Node(),
    close: Object.assign(new Node(), { tagName: "BUTTON", type: "button" }),
    dispose: vi.fn(),
    fit: vi.fn(),
    frame: new Node(),
    title: new Node(),
  };
  return { Node, card };
});
vi.mock("../modal.ts", async (original) => ({
  ...(await original<typeof import("../modal.ts")>()),
  createActions: (actions: { button: InstanceType<typeof fixture.Node>; role: string }[]) => {
    const row = new fixture.Node();
    row.append(...actions.map(({ button }) => button));
    return row;
  },
  createButton: (label: string, role: string) => {
    const button = Object.assign(new fixture.Node(), { tagName: "BUTTON", type: "button" });
    button.textContent = label;
    button.dataset.role = role;
    return button;
  },
  createCard: ({ close }: { close: InstanceType<typeof fixture.Node> }) => {
    fixture.card.close = close;
    fixture.card.card.replaceChildren(fixture.card.title, fixture.card.body);
    fixture.card.frame.replaceChildren(fixture.card.card, fixture.card.close);
    return fixture.card;
  },
  isTap: () => true,
  setFooterAction: (action: string, row: { dataset: Record<string, string> }) => {
    row.dataset.footerAction = action;
  },
}));
vi.mock("../layoutDom/viewScaleBridge.ts", () => ({ readViewUnit: () => 1 }));
vi.mock("@andornaut/game-kit/runtime/web/ui/dom/focusModality", () => ({
  focusTarget: (node: { focus(): void }) => node.focus(),
}));
afterEach(() => {
  if (typeof document !== "undefined") {
    document.body?.replaceChildren();
  }
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  fixture.card.body.children = [];
  fixture.card.title.children = [];
});

function attach(root: InstanceType<typeof fixture.Node>) {
  if (!document.body) {
    Object.assign(document, { body: Object.assign(new fixture.Node(), { tagName: "BODY" }) });
  }
  document.body.append(root as unknown as HTMLElement);
  return root;
}
function detailParts() {
  return fixture.card.body.children[0]!.children;
}

function attachedActionRoot(root = new fixture.Node()) {
  attach(root);
  fixtureActionRoot(root);
  return root;
}

it("uses the shared card and reports exactly one pause/close transition, restoring origin focus", () => {
  vi.stubGlobal("document", {
    createElement: (tag: string) =>
      Object.assign(new fixture.Node(), { tagName: tag.toUpperCase() }),
  });
  const root = new fixture.Node();
  attachedActionRoot(root);
  const origin = new fixture.Node();
  const onOpenChange = vi.fn();
  const resource = createWeaponDetailCard(root as unknown as HTMLElement, {
    closeLabel: "Close",
    onOpenChange,
  });
  expect(resource.isOpen()).toBe(false);
  resource.open("Ore", ["Approved description"], origin as unknown as HTMLElement);
  expect(resource.isOpen()).toBe(true);
  expect(fixture.card.title.textContent).toBe("Ore");
  expect(detailParts()[0]!.children[0]!.textContent).toBe("Approved description");
  expect(onOpenChange).toHaveBeenLastCalledWith(true);
  expect(fixture.card.fit).toHaveBeenCalledOnce();
  detailParts()
    .at(-1)!
    .querySelector('[data-action="dismiss-weapon-detail"]')!
    .dispatchEvent(new Event("click"));
  resource.close();
  expect(resource.isOpen()).toBe(false);
  expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  expect(origin.focus).toHaveBeenCalledOnce();
  resource.dispose();
  expect(fixture.card.dispose).toHaveBeenCalledOnce();
});

it("reopens with current content and traps Tab on the close control", () => {
  vi.stubGlobal("document", {
    createElement: (tag: string) =>
      Object.assign(new fixture.Node(), { tagName: tag.toUpperCase() }),
  });
  const root = new fixture.Node();
  attachedActionRoot(root);
  const origin = new fixture.Node();
  const resource = createWeaponDetailCard(root as unknown as HTMLElement, {
    closeLabel: "Close",
    onOpenChange: vi.fn(),
  });
  resource.open("Ore", ["First"], origin as unknown as HTMLElement);
  resource.close();
  resource.open("Stardust", ["Second"], origin as unknown as HTMLElement);
  const target = document.activeElement;
  const event = Object.assign(new Event("keydown", { cancelable: true }), {
    composedPath: () => [target, document, document.defaultView],
    key: "Tab",
  });
  document.defaultView!.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(fixture.card.title.textContent).toBe("Stardust");
  expect(detailParts()[0]!.children[0]!.textContent).toBe("Second");
  resource.dispose();
});

it.each([1, 2, 3])(
  "shows canonical icon and level %s in the owned title instead of a description row",
  (level) => {
    vi.stubGlobal("document", {
      createElement: (tag: string) =>
        Object.assign(new fixture.Node(), { tagName: tag.toUpperCase() }),
    });
    const detail = createWeaponDetailCard(attachedActionRoot() as unknown as HTMLElement, {
      closeLabel: "Close",
      onOpenChange: vi.fn(),
    });
    detail.open(
      "Rapid Missile",
      weaponDetailLines("rapidMissile", level),
      new fixture.Node() as unknown as HTMLElement,
      { ammo: 0, ammoLabel: "Ammo", id: "rapidMissile", level },
    );
    const [icon, label] = fixture.card.title.children;
    expect(label!.textContent).toBe(compactLevelName(level, "Rapid Missile"));
    expect(icon!.dataset).toEqual({ level: String(level), state: "idle", weapon: "rapidMissile" });
    expect(icon!.children[0]!.style.setProperty).toHaveBeenCalledWith(
      "--glyph",
      `url('${uiIconUrl("weapon-rapidMissile")}')`,
    );
    expect(icon!.children[1]!.children).toHaveLength(level === 1 ? 0 : level);
    const lines = detailParts()[0]!.children.map((node) => node.textContent);
    expect(lines).not.toContain("Ammo: 0 left");
    const row = detailParts()[1]!;
    expect(row.hidden).toBe(false);
    expect(row.children[0]!.className).toBe("ada-detail-ammo-icon");
    expect(row.children[0]!.style.setProperty).toHaveBeenCalledWith(
      "--glyph",
      `url('${uiIconUrl("ammo-missile")}')`,
    );
    expect(row.children[1]!.textContent).toBe("0");
    expect(lines.some((line) => line.startsWith("Level "))).toBe(false);
    detail.dispose();
  },
);

it("keeps an unowned preview unnumbered without inventing owned level metadata", () => {
  vi.stubGlobal("document", {
    createElement: (tag: string) =>
      Object.assign(new fixture.Node(), { tagName: tag.toUpperCase() }),
  });
  const detail = createWeaponDetailCard(attachedActionRoot() as unknown as HTMLElement, {
    closeLabel: "Close",
    onOpenChange: vi.fn(),
  });
  detail.open(
    "Rapid Missile",
    [WEAPON_DETAIL_LABELS.detailIncludesAmmo],
    new fixture.Node() as unknown as HTMLElement,
    { id: "rapidMissile" },
  );
  const [icon, label] = fixture.card.title.children;
  expect(label!.textContent).toBe("Rapid Missile");
  expect(icon!.dataset).not.toHaveProperty("level");
  expect(icon!.children[1]!.children).toHaveLength(0);
  expect(detailParts()[0]!.children[0]!.textContent).toBe(WEAPON_DETAIL_LABELS.detailIncludesAmmo);
  detail.dispose();
});

it("renders basic Laser's existing glyph and Unlimited row without a level-one suffix or repeated ammo prose", () => {
  vi.stubGlobal("document", {
    createElement: (tag: string) =>
      Object.assign(new fixture.Node(), { tagName: tag.toUpperCase() }),
  });
  const detail = createWeaponDetailCard(attachedActionRoot() as unknown as HTMLElement, {
    closeLabel: "Close",
    onOpenChange: vi.fn(),
  });
  detail.open(
    "Laser",
    weaponDetailLines("laser", 1),
    new fixture.Node() as unknown as HTMLElement,
    { ammo: null, ammoLabel: "Ammo", id: "laser", level: 1 },
  );
  expect(fixture.card.title.children[1]!.textContent).toBe("Laser");
  const row = detailParts()[1]!;
  expect(row.children[0]!.className).toBe("ada-detail-unlimited-icon");
  expect(row.children[1]!.textContent).toBe("Unlimited");
  expect(detailParts()[0]!.children.map((node) => node.textContent)).toEqual(
    weaponDetailLines("laser", 1),
  );
  detail.close();
  detail.open(
    "Rapid Missile",
    [WEAPON_DETAIL_LABELS.detailIncludesAmmo],
    new fixture.Node() as unknown as HTMLElement,
    { id: "rapidMissile" },
  );
  expect(row.hidden).toBe(true);
  expect(row.children).toEqual([]);
  detail.dispose();
});

it("retains native content nodes and original close actions across current view, reopen and disposal", () => {
  vi.stubGlobal("document", {
    createElement: (tag: string) =>
      Object.assign(new fixture.Node(), { tagName: tag.toUpperCase() }),
  });
  const root = new fixture.Node(),
    origin = new fixture.Node();
  attachedActionRoot(root);
  const guard = rootPressGuard(root as unknown as HTMLElement);
  const beforeOpen = guard.gate.capture();
  const onOpenChange = vi.fn();
  const detail = createWeaponDetailCard(root as unknown as HTMLElement, {
    closeLabel: "Close",
    onOpenChange,
  });
  const [description, quantity, footer] = detailParts();
  detail.open(
    "Rapid Missile",
    weaponDetailLines("rapidMissile", 3),
    origin as unknown as HTMLElement,
    { ammo: 0, ammoLabel: "Ammo", id: "rapidMissile", level: 3 },
  );
  expect(beforeOpen()).toBe(false);
  const dismiss = footer!.querySelector('[data-action="dismiss-weapon-detail"]')!;
  expect(dismiss.matches(".ui-standard-button")).toBe(true);
  const headerAction = resolveAdaHoldAction(root as unknown as HTMLElement, fixture.card.close);
  const dismissAction = resolveAdaHoldAction(root as unknown as HTMLElement, dismiss);
  expect(headerAction?.available()).toBe(true);
  expect(dismissAction?.available()).toBe(true);
  const openCapture = guard.gate.capture();
  headerAction?.activate();
  expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  expect(origin.focus).toHaveBeenCalledOnce();
  expect(openCapture()).toBe(false);
  detail.open("Laser", weaponDetailLines("laser", 1), origin as unknown as HTMLElement, {
    ammo: null,
    ammoLabel: "Ammo",
    id: "laser",
    level: 1,
  });
  expect(detailParts()).toEqual([description, quantity, footer]);
  expect(footer!.querySelector('[data-action="dismiss-weapon-detail"]')).toBe(dismiss);
  expect(quantity!.children[1]!.textContent).toBe("Unlimited");
  const cover = new fixture.Node();
  root.append(cover);
  const leaveCover = enterPressView(
    root as unknown as HTMLElement,
    cover as unknown as HTMLElement,
  );
  expect(headerAction?.available()).toBe(false);
  expect(dismissAction?.available()).toBe(false);
  headerAction?.activate();
  dismissAction?.activate();
  expect(onOpenChange.mock.calls).toEqual([[true], [false], [true]]);
  leaveCover();
  expect(dismissAction?.available()).toBe(true);
  const beforeDispose = guard.gate.capture();
  detail.dispose();
  expect(beforeDispose()).toBe(false);
  expect(resolveAdaHoldAction(root as unknown as HTMLElement, fixture.card.close)).toBeNull();
  expect(resolveAdaHoldAction(root as unknown as HTMLElement, dismiss)).toBeNull();
  headerAction?.activate();
  dismissAction?.activate();
  dismiss.dispatchEvent(new Event("click"));
  fixture.card.close.dispatchEvent(new Event("click"));
  expect(onOpenChange.mock.calls).toEqual([[true], [false], [true]]);
  expect(fixture.card.dispose).toHaveBeenCalledOnce();
});

it("audits the completed dynamic tree before opening or focusing an unbound control", () => {
  vi.stubGlobal("document", {
    createElement: (tag: string) =>
      Object.assign(new fixture.Node(), { tagName: tag.toUpperCase() }),
  });
  const root = attachedActionRoot();
  const onOpenChange = vi.fn();
  const detail = createWeaponDetailCard(root as unknown as HTMLElement, {
    closeLabel: "Close",
    onOpenChange,
  });
  const modal = root.children[0]!;
  const rogue = Object.assign(new fixture.Node(), {
    disabled: true,
    hidden: true,
    tagName: "BUTTON",
    type: "button",
  });
  modal.append(rogue);
  try {
    expect(() =>
      detail.open("Laser", ["Approved description"], new fixture.Node() as unknown as HTMLElement),
    ).toThrow("no registered action binding");
    expect(modal.hidden).toBe(true);
    expect(fixture.card.fit).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  } finally {
    rogue.remove();
    detail.dispose();
  }
});

it("requires connected ownership at open without querying the root policy", () => {
  vi.stubGlobal("document", {
    createElement: (tag: string) =>
      Object.assign(new fixture.Node(), { tagName: tag.toUpperCase() }),
  });
  const root = attach(new fixture.Node());
  const onOpenChange = vi.fn();
  const detail = createWeaponDetailCard(root as unknown as HTMLElement, {
    closeLabel: "Close",
    onOpenChange,
  });
  const origin = new fixture.Node() as unknown as HTMLElement;
  const open = () => detail.open("Laser", ["Approved description"], origin);
  const permits = vi.fn(() => {
    throw new Error("Audit must not query eligibility");
  });
  let release = () => {};
  try {
    expect(() => open()).toThrow("no live action root");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(fixture.card.fit).not.toHaveBeenCalled();
    release = registerAdaActionRoot({ permits }, root as unknown as HTMLElement);
    expect(() => open()).not.toThrow();
    expect(permits).not.toHaveBeenCalled();
    detail.close();
    root.remove();
    expect(root.isConnected).toBe(false);
    expect(() => open()).toThrow("no live action root");
    expect(permits).not.toHaveBeenCalled();
  } finally {
    detail.dispose();
    release();
  }
});
