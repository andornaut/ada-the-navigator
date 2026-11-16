import { afterEach, describe, expect, it, vi } from "vitest";

import { EXCHANGE_RATES } from "../data/exchange.ts";
import {
  EXCHANGE_AMOUNTS,
  exchangeImmediately,
  type ImmediateExchangeOrder,
  quoteExchange,
} from "../model/exchange.ts";
import { resolveAdaHoldAction } from "./actionBinding.ts";
import { fixtureActionRoot } from "./actionRootFixture.ts";
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
    hidden = false;
    disabled = false;
    className = "";
    textContent = "";
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
      if (this.dataset.exchange === "result" && state.corruptResult) {
        const unbound = new Node("button");
        unbound.disabled = true;
        this.append(unbound);
      }
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
    setAttribute(name: string, value: string) {
      this.attributes[name] = value;
    }
  }
  const state = { corruptFactory: false, corruptResult: false };
  return { Node, mountedRoots, state };
});
vi.mock("./modal.ts", () => ({
  FOCUS_STYLE: "",
  createActions: (actions: { button: InstanceType<typeof dom.Node> }[]) => {
    const node = new dom.Node();
    node.append(...actions.map(({ button }) => button));
    if (dom.state.corruptFactory) {
      node.append(new dom.Node("button"));
    }
    return node;
  },
  createButton: (label: string) => {
    const node = new dom.Node("button");
    node.textContent = label;
    return node;
  },
}));
vi.mock("@andornaut/game-kit/runtime/web/ui/dom/focusModality", () => ({
  focusTarget: (node: { focus(): void }) => node.focus(),
}));
afterEach(() => {
  dom.mountedRoots.clear();
  dom.state.corruptFactory = false;
  dom.state.corruptResult = false;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function fixture(placement: "connected" | "detached" | "unowned" = "connected") {
  vi.stubGlobal("document", {
    createElement: (tag: string) => new dom.Node(tag),
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
  root.append(foreign);
  let balances = { ore: 20, stardust: 100 };
  const commit = vi.fn((order: ImmediateExchangeOrder) => {
    const result = exchangeImmediately(EXCHANGE_RATES, balances, order);
    if (result.kind === "exchanged") {
      balances = { ...result.after };
    }
    return result;
  });
  const onChange = vi.fn();
  const view = createExchangeView(
    root as unknown as HTMLElement,
    {
      exchangeImmediately: commit,
      preview: (order) => quoteExchange(EXCHANGE_RATES, balances, order),
    },
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
      (["buy", "sell"] as const).flatMap((direction) =>
        EXCHANGE_AMOUNTS.map((amount) => `exchange-${direction}-${amount}`),
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
    expect(f.view.back()).toBe(false);
    expect(f.view.isConfirming()).toBe(false);
    expect(f.commit).not.toHaveBeenCalled();
  });
  it("buys and sells immediately with canonical totals, one transaction and notification per activation", () => {
    const f = fixture();
    f.click("exchange-buy-10");
    expect(f.commit).toHaveBeenCalledExactlyOnceWith({ amount: 10, direction: "buy" });
    expect(f.balances()).toEqual({ ore: 30, stardust: 80 });
    expect(f.onChange).toHaveBeenCalledOnce();
    expect(f.action("exchange-buy-10").focus).toHaveBeenCalledOnce();
    f.click("exchange-sell-10");
    expect(f.balances()).toEqual({ ore: 20, stardust: 90 });
    expect(f.onChange).toHaveBeenCalledTimes(2);
  });
  it("keeps unaffordable fixed actions visible but refuses direct disabled activation", () => {
    const f = fixture();
    expect(f.action("exchange-buy-100").disabled).toBe(true);
    expect(f.action("exchange-buy-100").hidden).toBe(false);
    expect(f.action("exchange-sell-100").disabled).toBe(true);
    f.click("exchange-buy-100");
    f.click("exchange-sell-100");
    expect(f.commit).not.toHaveBeenCalled();
  });
  it("revalidates live balances at the model transaction rather than spending an old preview", () => {
    const f = fixture();
    f.setBalances({ ore: 20, stardust: 0 });
    f.click("exchange-buy-10");
    expect(f.commit.mock.results[0]!.value).toMatchObject({
      kind: "refused",
      reason: "cantAfford",
    });
    expect(f.balances()).toEqual({ ore: 20, stardust: 0 });
    expect(f.onChange).not.toHaveBeenCalled();
    expect(f.action("exchange-buy-10").disabled).toBe(true);
  });
  it("retains button identities and ignores hidden or disposed callbacks", () => {
    const f = fixture();
    const retained = f.action("exchange-buy-1");
    f.view.render();
    expect(f.action("exchange-buy-1")).toBe(retained);
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
  dom.state.corruptFactory = true;
  expect(() => fixture()).toThrow("no registered action binding");
  dom.state.corruptFactory = false;
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
    resolveAdaHoldAction(
      f.root as unknown as HTMLElement,
      f.action("exchange-buy-1") as unknown as HTMLElement,
    )!.activate();
  expect(activate).toThrow("no registered action binding");
  expect(f.commit).not.toHaveBeenCalled();
  expect(f.onChange).not.toHaveBeenCalled();
  expect(f.view.root.hidden).toBe(true);
  f.view.dispose();
});

it("audits newly reconciled Exchange result nodes without replaying the committed transaction", () => {
  const f = fixture();
  dom.state.corruptResult = true;
  const button = f.action("exchange-buy-1");
  const activate = () =>
    resolveAdaHoldAction(
      f.root as unknown as HTMLElement,
      button as unknown as HTMLElement,
    )!.activate();
  expect(activate).toThrow("no registered action binding");
  expect(f.commit).toHaveBeenCalledExactlyOnceWith({ amount: 1, direction: "buy" });
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
  expect(f.action("exchange-buy-1").disabled).toBe(true);
  expect(f.action("exchange-sell-1").disabled).toBe(true);
  f.view.dispose();
});
