import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { uiIconUrl } from "../../data/uiIconUrl.ts";
import {
  EXCHANGE_AMOUNTS,
  type ImmediateExchangeOrder,
  previewImmediateExchange,
} from "../../model/exchange.ts";
import * as actionBinding from "../actions/actionBinding.ts";
import { fixtureActionRoot } from "../actions/actionRootFixture.ts";
import { REFUSAL } from "../refusal.ts";
import { createExchangeView } from "./exchange.ts";

const dom = vi.hoisted(() => {
  const mountedRoots = new Set<Node>();
  class Node extends EventTarget {
    readonly tagName: string;
    type = "";
    constructor(tag = "div") {
      super();
      this.tagName = tag.toUpperCase();
      if (tag === "button") {
        this.type = "button";
      }
    }
    nodeType = 1;
    get ownerDocument() {
      return document;
    }
    get isConnected(): boolean {
      return this.parentElement?.isConnected ?? mountedRoots.has(this);
    }
    get parentNode(): Node | null {
      return this.parentElement;
    }
    get nextSibling(): Node | null {
      return this.parentElement?.children[this.parentElement.children.indexOf(this) + 1] ?? null;
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
    children: Node[] = [];
    parentElement: Node | null = null;
    closest(selector: string): Node | null {
      const matches = selector
        .split(",")
        .some((part) =>
          part.trim() === "[hidden]"
            ? this.hidden
            : part.trim() === "[inert]"
              ? this.attributes.inert !== undefined
              : this.matches(part.trim()),
        );
      return matches ? this : (this.parentElement?.closest(selector) ?? null);
    }
    contains(node: Node): boolean {
      return node === this || this.children.some((child) => child.contains(node));
    }
    dataset: Record<string, string> = {};
    attributes: Record<string, string> = {};
    readonly style = {
      getPropertyValue: () => "",
      removeProperty: vi.fn(),
      setProperty: vi.fn(),
    };
    hidden = false;
    disabled = false;
    className = "";
    readonly classList = {
      add: (name: string) => {
        this.className = [...new Set([...this.className.split(" "), name])]
          .filter(Boolean)
          .join(" ");
      },
    };
    private text = "";
    get textContent(): string {
      return this.text + this.children.map((child) => child.textContent).join("");
    }
    set textContent(value: string) {
      this.replaceChildren();
      this.text = value;
    }
    value = "";
    focus = vi.fn();
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
      this.append(...nodes);
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
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    }
    hasAttribute(name: string) {
      return this.getAttribute(name) !== null;
    }
    setAttribute(name: string, value: string) {
      this.attributes[name] = value;
    }
    removeAttribute(name: string) {
      delete this.attributes[name];
    }
    toggleAttribute(name: string, on: boolean) {
      if (on) {
        this.setAttribute(name, "");
      } else {
        this.removeAttribute(name);
      }
    }
  }
  return { Node, mountedRoots };
});
vi.mock("@andornaut/game-kit/runtime/web/ui/dom/focusModality", () => ({
  focusTarget: (node: { focus(): void }) => node.focus(),
}));
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  dom.mountedRoots.clear();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function fixture(
  placement: "connected" | "detached" | "unowned" = "connected",
  reducedMotion = false,
) {
  vi.stubGlobal("document", {
    createElement: (tag: string) => new dom.Node(tag),
    createElementNS: (_namespace: string, tag: string) => new dom.Node(tag),
    defaultView: { HTMLElement: dom.Node, Node: dom.Node },
  });
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
  const root = new dom.Node();
  if (placement === "connected") {
    fixtureActionRoot(root);
  }
  if (placement !== "detached") {
    dom.mountedRoots.add(root);
  }
  const foreign = new dom.Node("button");
  const body = new dom.Node("section");
  root.append(foreign, body);
  let balances = { ore: 20, stardust: 100 };
  const commit = vi.fn((order: ImmediateExchangeOrder) => {
    const result = previewImmediateExchange(balances, order);
    if (result.kind === "refused") {
      return result;
    }
    balances = result.after;
    return { ...result, kind: "exchanged" as const };
  });
  const onChange = vi.fn();
  const view = createExchangeView(
    root as unknown as HTMLElement,
    body as unknown as HTMLElement,
    {
      exchangeImmediately: commit,
      preview: (order) => previewImmediateExchange(balances, order),
    },
    () => reducedMotion,
    onChange,
  );
  const nodes = (node = root): InstanceType<typeof dom.Node>[] => [
    node,
    ...node.children.flatMap((child) => nodes(child)),
  ];
  const action = (id: string) => nodes().find((node) => node.dataset.action === id)!;
  const click = (id: string) => action(id).dispatchEvent(new Event("click"));
  return {
    action,
    balances: () => balances,
    click,
    commit,
    nodes,
    onChange,
    root,
    setBalances: (next: typeof balances) => {
      balances = next;
    },
    view,
  };
}

describe("immediate fixed Exchange actions", () => {
  it("offers only model-exported quantities in both directions with no input or confirmation", () => {
    const f = fixture();
    expect(
      f
        .nodes()
        .filter((node) => node.dataset.action)
        .map((node) => node.dataset.action),
    ).toEqual(
      (["stardust", "ore"] as const).flatMap((resource) =>
        EXCHANGE_AMOUNTS.map((amount) => `exchange-${resource}-${amount}`),
      ),
    );
    expect(
      f
        .nodes()
        .some((node) =>
          ["exchange-amount", "exchange-confirm", "exchange-cancel"].includes(
            node.dataset.action ?? "",
          ),
        ),
    ).toBe(false);
    const rows = f.nodes().filter((node) => node.className === "ada-exchange-row");
    expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual(["Buy Stardust", "Buy ore"]);
    for (const [index, [payment, received, heading, phrase]] of [
      ["ore", "stardust", "Buy Stardust", "1 Stardust costs 2 ore"],
      ["stardust", "ore", "Buy ore", "1 ore costs 2 Stardust"],
    ].entries()) {
      const row = rows[index]!;
      const labels = row.children[0]!;
      expect(labels.children.map((part) => part.tagName)).toEqual(["H3", "P"]);
      expect(labels.children[0]!.textContent).toBe(heading);
      const rate = labels.children[1]!;
      expect(rate.children.map((part) => part.className)).toEqual([
        "ada-exchange-rate-visual",
        "ada-exchange-rate-spoken",
      ]);
      const [visual, spoken] = rate.children;
      expect(visual!.getAttribute("aria-hidden")).toBe("true");
      expect(spoken!.getAttribute("aria-hidden")).toBeNull();
      expect(spoken!.textContent).toBe(phrase);
      expect(visual!.children.map((part) => part.tagName)).toEqual(["SPAN", "IMG", "SPAN", "IMG"]);
      expect(
        visual!.children.filter((part) => part.tagName === "SPAN").map((part) => part.textContent),
      ).toEqual(["1", "costs 2"]);
      const rateIcons = visual!.children.filter((part) => part.tagName === "IMG");
      expect(rateIcons.map((part) => (part as unknown as HTMLImageElement).src)).toEqual([
        uiIconUrl(`icon-${received}-20`),
        uiIconUrl(`icon-${payment}-20`),
      ]);
      expect(rateIcons.map((part) => (part as unknown as HTMLImageElement).alt)).toEqual(["", ""]);
      expect(row.children.map((part) => part.tagName)).toEqual(["DIV", "DIV"]);
      expect(row.children[1]!.className).toBe("ui-layout-columns");
      expect(row.children[1]!.getAttribute("data-ui-layout-sizing")).toBe("intrinsic");
      expect(row.children[1]!.children.map((part) => part.tagName)).toEqual([
        "BUTTON",
        "BUTTON",
        "BUTTON",
      ]);
    }
    expect(f.action("exchange-stardust-10").getAttribute("aria-label")).toBe(
      "Spend 20 ore to get 10 Stardust",
    );
    for (const resource of ["stardust", "ore"] as const) {
      for (const amount of EXCHANGE_AMOUNTS) {
        const action = f.action(`exchange-${resource}-${amount}`);
        expect(action.textContent).toBe(String(amount));
        expect(action.getAttribute("aria-label")).toBe(
          resource === "ore"
            ? `Spend ${amount * 2} Stardust to get ${amount} ore`
            : `Spend ${amount * 2} ore to get ${amount} Stardust`,
        );
        expect(action.matches(".ui-standard-button")).toBe(true);
        expect(action.children.map((child) => child.tagName)).toEqual(["SPAN", "IMG"]);
        expect(action.children[0]!.textContent).toBe(String(amount));
        const receivedIcon = action.children[1] as unknown as HTMLImageElement;
        expect(receivedIcon.src).toBe(uiIconUrl(`icon-${resource}-20`));
        expect(receivedIcon.alt).toBe("");
      }
    }
    expect(f.view.back()).toBe(false);
    expect(f.view.isConfirming()).toBe(false);
    expect(f.commit).not.toHaveBeenCalled();
  });
  it("buys either resource immediately with canonical totals, one transaction and notification per activation", () => {
    const f = fixture();
    f.click("exchange-ore-10");
    expect(f.commit).toHaveBeenCalledExactlyOnceWith({ amount: 10, resource: "ore" });
    expect(f.balances()).toEqual({ ore: 30, stardust: 80 });
    expect(f.onChange).toHaveBeenCalledOnce();
    expect(f.action("exchange-ore-10").focus).toHaveBeenCalledOnce();
    f.click("exchange-stardust-10");
    expect(f.commit).toHaveBeenLastCalledWith({ amount: 10, resource: "stardust" });
    expect(f.balances()).toEqual({ ore: 10, stardust: 90 });
    expect(f.onChange).toHaveBeenCalledTimes(2);
    expect(f.nodes().some((node) => node.dataset.exchange === "result")).toBe(false);
    expect(f.nodes().find((node) => node.getAttribute("role") === "status")?.textContent).toBe("");
  });
  it("gives refusal feedback through the registered native action for either low balance", () => {
    const f = fixture();
    const balances = f.balances();
    const status = f.nodes().find((node) => node.getAttribute("role") === "status")!;
    for (const [resource, reason] of [
      ["stardust", "Not enough ore"],
      ["ore", "Not enough Stardust"],
    ] as const) {
      const id = `exchange-${resource}-100`;
      expect(f.action(id).disabled).toBe(false);
      expect(f.action(id).hidden).toBe(false);
      expect(f.action(id).getAttribute("aria-disabled")).toBe("true");
      f.click(id);
      expect(status.textContent).toBe(reason);
      expect(status.hasAttribute("data-exchange-affordability")).toBe(true);
      expect(f.action(id).hasAttribute("data-ui-refusal-red")).toBe(true);
      expect(f.action(id).hasAttribute("data-ui-refusal-shake")).toBe(true);
      vi.advanceTimersByTime(200);
      f.click(id);
      vi.advanceTimersByTime(REFUSAL.durationMs - 200);
      expect(f.action(id).hasAttribute("data-ui-refusal-red")).toBe(false);
      expect(f.action(id).hasAttribute("data-ui-refusal-shake")).toBe(false);
    }
    expect(f.commit).not.toHaveBeenCalled();
    expect(f.onChange).not.toHaveBeenCalled();
    expect(f.balances()).toEqual(balances);
  });
  it("holds just the red cue under reduced motion", () => {
    const f = fixture("connected", true);
    const id = "exchange-stardust-100";
    f.click(id);
    const button = f.action(id);
    vi.advanceTimersByTime(REFUSAL.durationMs - 1);
    expect(button.hasAttribute("data-ui-refusal-red")).toBe(true);
    expect(button.hasAttribute("data-ui-refusal-shake")).toBe(false);
    vi.advanceTimersByTime(1);
    expect(button.hasAttribute("data-ui-refusal-red")).toBe(false);
    expect(f.commit).not.toHaveBeenCalled();
  });
  it("keeps a transaction error visible after an affordability announcement", () => {
    const f = fixture();
    f.click("exchange-ore-100");
    f.commit.mockReturnValue({ kind: "refused", reason: "stale" });
    f.click("exchange-ore-1");
    const status = f.nodes().find((node) => node.getAttribute("role") === "status")!;
    expect(status.textContent).toBe("Balances changed. Review the exchange again.");
    expect(status.hasAttribute("data-exchange-affordability")).toBe(false);
    expect(f.action("exchange-ore-1").hasAttribute("data-ui-refusal-red")).toBe(false);
    expect(f.commit).toHaveBeenCalledExactlyOnceWith({ amount: 1, resource: "ore" });
    expect(f.onChange).not.toHaveBeenCalled();
    expect(f.balances()).toEqual({ ore: 20, stardust: 100 });
  });
  it("revalidates live balances rather than spending an old preview", () => {
    const f = fixture();
    const button = f.action("exchange-ore-10");
    expect(button.getAttribute("aria-disabled")).toBeNull();
    f.setBalances({ ore: 20, stardust: 0 });
    f.click("exchange-ore-10");
    expect(f.commit).not.toHaveBeenCalled();
    expect(f.balances()).toEqual({ ore: 20, stardust: 0 });
    expect(f.onChange).not.toHaveBeenCalled();
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });
  it("preserves the action on focus when its purchase spends the last affordable balance", () => {
    const f = fixture();
    const key = "exchange-stardust-10";
    f.click(key);
    expect(f.action(key).getAttribute("aria-disabled")).toBe("true");
    expect(f.action(key).disabled).toBe(false);
    expect(f.action(key).focus).toHaveBeenCalledOnce();
    expect(f.balances()).toEqual({ ore: 0, stardust: 110 });
  });
  it("retains button identities and ignores hidden or disposed callbacks", () => {
    const f = fixture();
    const retained = f.action("exchange-ore-1");
    f.view.render();
    expect(f.action("exchange-ore-1")).toBe(retained);
    f.view.root.hidden = true;
    retained.dispatchEvent(new Event("click"));
    expect(f.commit).not.toHaveBeenCalled();
    f.view.root.hidden = false;
    f.view.dispose();
    retained.dispatchEvent(new Event("click"));
    expect(f.commit).not.toHaveBeenCalled();
    expect(f.onChange).not.toHaveBeenCalled();
  });
});

it("rejects incomplete Exchange action construction without auditing other Shop controls", () => {
  const bind = vi.spyOn(actionBinding, "bindAdaAction").mockImplementationOnce(() => ({
    activate: () => false,
    dispose() {},
    update() {},
  }));
  try {
    expect(() => fixture()).toThrow("no registered action binding");
  } finally {
    bind.mockRestore();
  }
  const f = fixture();
  expect(f.root.children[0]!.tagName).toBe("BUTTON");
  expect(f.commit).not.toHaveBeenCalled();
  f.view.dispose();
});

it("audits detached Exchange metadata but rejects a connected section without ownership", () => {
  expect(() => fixture("unowned")).toThrow("no live action root");
  const f = fixture("detached");
  expect(f.view.root.isConnected).toBe(false);
  expect(f.commit).not.toHaveBeenCalled();
  f.view.dispose();
});

it("rejects late unregistered Exchange controls before a transaction", () => {
  const f = fixture();
  const unbound = new dom.Node("button");
  unbound.hidden = true;
  unbound.disabled = true;
  (f.view.root as unknown as InstanceType<typeof dom.Node>).append(unbound);
  const activate = () =>
    actionBinding
      .resolveAdaHoldAction(
        f.root as unknown as HTMLElement,
        f.action("exchange-ore-1") as unknown as HTMLElement,
      )!
      .activate();
  expect(activate).toThrow("no registered action binding");
  expect(f.commit).not.toHaveBeenCalled();
  expect(f.onChange).not.toHaveBeenCalled();
  expect(f.view.root.hidden).toBe(true);
  f.view.dispose();
});

it("audits Exchange after the balance update without replaying the committed transaction", () => {
  const f = fixture();
  f.onChange.mockImplementation(() => {
    const unbound = new dom.Node("button");
    unbound.disabled = true;
    (f.view.root as unknown as InstanceType<typeof dom.Node>).append(unbound);
  });
  const button = f.action("exchange-ore-1");
  const activate = () =>
    actionBinding
      .resolveAdaHoldAction(f.root as unknown as HTMLElement, button as unknown as HTMLElement)!
      .activate();
  expect(activate).toThrow("no registered action binding");
  expect(f.commit).toHaveBeenCalledExactlyOnceWith({ amount: 1, resource: "ore" });
  expect(f.onChange).toHaveBeenCalledOnce();
  expect(f.balances()).toEqual({ ore: 21, stardust: 98 });
  expect(button.focus).not.toHaveBeenCalled();
  expect(f.view.root.hidden).toBe(true);
  f.view.dispose();
});

it("does not rescan unchanged Exchange node graphs during balance refresh", () => {
  const f = fixture();
  const queries = vi.spyOn(
    f.view.root as unknown as InstanceType<typeof dom.Node>,
    "querySelectorAll",
  );
  f.view.render();
  f.setBalances({ ore: 0, stardust: 0 });
  f.view.render();
  expect(queries).not.toHaveBeenCalled();
  expect(f.action("exchange-ore-1").getAttribute("aria-disabled")).toBe("true");
  expect(f.action("exchange-stardust-1").getAttribute("aria-disabled")).toBe("true");
  f.view.dispose();
});
