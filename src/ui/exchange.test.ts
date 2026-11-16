import { afterEach, describe, expect, it, vi } from "vitest";

import { EXCHANGE_RATES } from "../data/exchange.ts";
import {
  EXCHANGE_AMOUNTS,
  exchangeImmediately,
  type ImmediateExchangeOrder,
  quoteExchange,
} from "../model/exchange.ts";
import { fixtureActionRoot } from "./actionRootFixture.ts";
import { createExchangeView } from "./exchange.ts";

const dom = vi.hoisted(() => {
  const mountedRoots = new Set<Node>();
  class Node extends EventTarget {
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
    }
    setAttribute(name: string, value: string) {
      this.attributes[name] = value;
    }
  }
  return { Node, mountedRoots };
});
vi.mock("./modal.ts", () => ({
  FOCUS_STYLE: "",
  createActions: (actions: { button: InstanceType<typeof dom.Node> }[]) => {
    const node = new dom.Node();
    node.append(...actions.map(({ button }) => button));
    return node;
  },
  createButton: (label: string) => {
    const node = new dom.Node();
    node.textContent = label;
    return node;
  },
}));
vi.mock("@andornaut/game-kit/runtime/web/ui/dom/focusModality", () => ({
  focusTarget: (node: { focus(): void }) => node.focus(),
}));
afterEach(() => {
  dom.mountedRoots.clear();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function fixture() {
  vi.stubGlobal("document", { createElement: () => new dom.Node() });
  const root = fixtureActionRoot(new dom.Node());
  dom.mountedRoots.add(root);
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
