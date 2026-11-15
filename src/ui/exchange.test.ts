import { afterEach, describe, expect, it, vi } from "vitest";

import { EXCHANGE_RATES } from "../data/exchange.ts";
import { confirmExchange, quoteExchange } from "../model/exchange.ts";
import { createExchangeView } from "./exchange.ts";

const dom = vi.hoisted(() => {
  class Node extends EventTarget {
    nodeType = 1;
    get ownerDocument() {
      return document;
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
      this.children.push(...nodes);
      for (const node of nodes) {
        node.parentElement = this;
      }
    }
    replaceChildren(...nodes: Node[]) {
      this.children = nodes;
    }
    setAttribute(name: string, value: string) {
      this.attributes[name] = value;
    }
  }
  return { Node };
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
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function fixture() {
  vi.stubGlobal("document", { createElement: () => new dom.Node() });
  const root = new dom.Node();
  let balances = { ore: 20, stardust: 100 };
  const commit = vi.fn((quote: Parameters<typeof confirmExchange>[2]) => {
    const result = confirmExchange(EXCHANGE_RATES, balances, quote);
    if (result.kind === "quote") {
      balances = { ...result.after };
    }
    return result;
  });
  const onChange = vi.fn();
  const view = createExchangeView(
    root as unknown as HTMLElement,
    {
      confirm: commit,
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
  const amount = (value: string) => {
    action("exchange-amount").value = value;
    action("exchange-amount").dispatchEvent(new Event("input"));
  };
  const preview = () =>
    nodes()
      .find((node) => node.dataset.exchange === "preview")!
      .children.map((node) => node.textContent);
  return {
    action,
    amount,
    balances: () => balances,
    click,
    commit,
    onChange,
    preview,
    setBalances: (next: typeof balances) => {
      balances = next;
    },
    view,
  };
}

describe("Exchange preview and confirmation", () => {
  it("shows approved buy totals and both balances, cancelling without a transaction", () => {
    const f = fixture();
    f.amount("10");
    expect(f.preview()).toEqual([
      "Buy ore: 10",
      "Total price: 20 Stardust",
      "Ore after: 30",
      "Stardust after: 80",
    ]);
    f.click("exchange-preview");
    expect(f.view.isConfirming()).toBe(true);
    expect(f.action("exchange-confirm").focus).toHaveBeenCalledOnce();
    expect(f.balances()).toEqual({ ore: 20, stardust: 100 });
    f.click("exchange-cancel");
    expect(f.view.isConfirming()).toBe(false);
    expect(f.commit).not.toHaveBeenCalled();
    expect(f.action("exchange-preview").focus).toHaveBeenCalledOnce();
  });

  it("commits approved buy or sell exactly once despite repeated confirm events", () => {
    const f = fixture();
    f.amount("10");
    f.click("exchange-preview");
    f.click("exchange-confirm");
    f.click("exchange-confirm");
    expect(f.commit).toHaveBeenCalledOnce();
    expect(f.balances()).toEqual({ ore: 30, stardust: 80 });
    f.click("exchange-sell");
    f.amount("10");
    expect(f.preview()).toEqual([
      "Sell ore: 10",
      "Total price: 10 Stardust",
      "Ore after: 20",
      "Stardust after: 90",
    ]);
    f.click("exchange-preview");
    f.click("exchange-confirm");
    expect(f.balances()).toEqual({ ore: 20, stardust: 90 });
    expect(f.onChange).toHaveBeenCalledTimes(2);
  });

  it("rejects stale balance previews rather than applying local arithmetic", () => {
    const f = fixture();
    f.amount("10");
    f.click("exchange-preview");
    f.setBalances({ ore: 21, stardust: 100 });
    f.click("exchange-confirm");
    expect(f.balances()).toEqual({ ore: 21, stardust: 100 });
    expect(f.view.isConfirming()).toBe(false);
    expect(f.commit.mock.results[0]!.value).toEqual({ kind: "refused", reason: "stale" });
  });

  it("disables invalid or unaffordable amounts and preserves the back stack", () => {
    const f = fixture();
    for (const amount of ["0", "-1", "0.5", "51", ""]) {
      f.amount(amount);
      expect(f.action("exchange-preview").disabled).toBe(true);
      f.click("exchange-preview");
      expect(f.view.isConfirming()).toBe(false);
    }
    f.click("exchange-sell");
    f.amount("21");
    expect(f.action("exchange-preview").disabled).toBe(true);
    f.amount("20");
    f.click("exchange-preview");
    expect(f.view.back()).toBe(true);
    expect(f.view.back()).toBe(false);
    expect(f.commit).not.toHaveBeenCalled();
  });
});

it("does not execute disabled preview callbacks or hidden confirmation callbacks", () => {
  const f = fixture();
  f.amount("0");
  f.click("exchange-preview");
  f.click("exchange-confirm");
  expect(f.view.isConfirming()).toBe(false);
  expect(f.commit).not.toHaveBeenCalled();
  f.amount("1");
  f.click("exchange-preview");
  f.click("exchange-cancel");
  f.click("exchange-confirm");
  expect(f.commit).not.toHaveBeenCalled();
});

it("unregisters retained native callbacks and input rendering on disposal", () => {
  const f = fixture();
  f.click("exchange-preview");
  const retained = f.action("exchange-confirm");
  f.view.dispose();
  retained.dispatchEvent(new Event("click"));
  expect(f.commit).not.toHaveBeenCalled();
  expect(f.onChange).not.toHaveBeenCalled();
});

it("retains the exact native amount and control identities through editor, confirm, Back and refresh", () => {
  const f = fixture();
  const amount = f.action("exchange-amount"),
    buy = f.action("exchange-preview");
  f.amount("007");
  f.click("exchange-preview");
  expect(f.view.back()).toBe(true);
  f.view.render();
  expect(f.action("exchange-amount")).toBe(amount);
  expect(amount.value).toBe("007");
  expect(f.action("exchange-preview")).toBe(buy);
  expect(f.commit).not.toHaveBeenCalled();
});
