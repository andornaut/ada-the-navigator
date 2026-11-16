import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type AchievementEntry, createAchievementsCard } from "./achievementsCard.ts";

let active: Element | null = null;
class Element {
  readonly attributes = new Map<string, string>();
  readonly children: Element[] = [];
  className = "";
  clientHeight = 360;
  clientWidth = 720;
  readonly dataset: Record<string, string> = {};
  hidden = false;
  readonly listeners = new Map<string, (() => void)[]>();
  parent: Element | undefined;
  readonly style = { getPropertyValue: () => "", removeProperty: vi.fn(), setProperty: vi.fn() };
  textContent = "";
  addEventListener(type: string, callback: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), callback]);
  }
  removeEventListener(type: string, callback: () => void) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((item) => item !== callback),
    );
  }
  get ownerDocument() {
    return document;
  }
  get parentNode(): Element | null {
    return this.parent ?? null;
  }
  get nextSibling(): Element | null {
    return this.parent?.children[this.parent.children.indexOf(this) + 1] ?? null;
  }
  contains(node: unknown): boolean {
    return node === this || this.children.some((child) => child.contains(node));
  }
  insertBefore(node: Element, before: Element | null): Element {
    if (node === before) {
      return node;
    }
    node.remove();
    node.parent = this;
    this.children.splice(before ? this.children.indexOf(before) : this.children.length, 0, node);
    return node;
  }
  append(...nodes: Element[]) {
    for (const node of nodes) {
      this.insertBefore(node, null);
    }
  }
  click() {
    this.listeners.get("click")?.forEach((callback) => callback());
  }
  remove() {
    this.parent?.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = undefined;
  }
  replaceChildren(...nodes: Element[]) {
    for (const child of [...this.children]) {
      child.remove();
    }
    this.append(...nodes);
  }
  removeAttribute(key: string) {
    this.attributes.delete(key);
  }
  setAttribute(key: string, value: string) {
    this.attributes.set(key, value);
  }
}

vi.mock("@andornaut/game-kit/runtime/web/ui/dom/focusModality", () => ({
  focusTarget: (node: Element) => {
    active = node;
  },
}));
vi.mock("./layout/viewScale.ts", () => ({ VIEW_SCALE_EVENT: "scale", readViewUnit: () => 1 }));
vi.mock("./modal.ts", async (original) => ({
  ...(await original<typeof import("./modal.ts")>()),
  createButton: (label: string) => Object.assign(new Element(), { textContent: label }),
  createCard: (options: { closeAction: string }) => {
    const frame = new Element();
    const card = new Element();
    const body = new Element();
    const close = new Element();
    close.dataset.action = options.closeAction;
    card.append(body);
    frame.append(card, close);
    return { body, card, close, dispose: vi.fn(), fit: vi.fn(), frame };
  },
}));

beforeEach(() => {
  active = null;
  vi.stubGlobal("document", {
    get activeElement() {
      return active;
    },
    createElement: () => new Element(),
  });
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("getComputedStyle", () => ({
    paddingBottom: "16",
    paddingLeft: "16",
    paddingRight: "16",
    paddingTop: "16",
  }));
});
afterEach(() => vi.unstubAllGlobals());

const entries = (count: number): AchievementEntry[] =>
  Array.from({ length: count }, (_, index) => ({
    condition: `condition:${index}`,
    name: `entry:${index}`,
    unlocked: false,
  }));
function setup() {
  const root = new Element();
  const onOpenChange = vi.fn();
  const card = createAchievementsCard(root as unknown as HTMLElement, {
    labels: {
      close: "Close",
      next: "Next",
      page: "{page}/{pages}",
      previous: "Previous",
      progress: "{have}/{need}",
      title: "Achievements",
    },
    onOpenChange,
  });
  card.setEntries(entries(7));
  card.open();
  const modal = root.children[0]!;
  const frame = modal.children[0]!;
  const body = frame.children[0]!.children[0]!;
  const pager = body.children[1]!.children[0]!;
  const [previous, count, next] = pager.children;
  return {
    card,
    close: frame.children[1]!,
    count: count!,
    dismiss: body.children[1]!.children[1]!.children[0]!,
    next: next!,
    onOpenChange,
    pager,
    previous: previous!,
  };
}

describe("Achievements page actions", () => {
  it("hides Previous on the first page and ignores its unavailable action", () => {
    const { card, count, next, previous } = setup();
    expect(count.textContent).toBe("1/2");
    expect(previous.hidden).toBe(true);
    expect(next.hidden).toBe(false);
    previous.click();
    expect(count.textContent).toBe("1/2");
    card.dispose();
  });

  it("shows Previous only when it can go back and hides Next at the end", () => {
    const { card, count, next, previous } = setup();
    active = next;
    next.click();
    expect(count.textContent).toBe("2/2");
    expect(previous.hidden).toBe(false);
    expect(next.hidden).toBe(true);
    expect(active).toBe(previous);
    next.click();
    expect(count.textContent).toBe("2/2");
    previous.click();
    expect(count.textContent).toBe("1/2");
    expect(previous.hidden).toBe(true);
    expect(next.hidden).toBe(false);
    expect(active).toBe(next);
    card.dispose();
  });

  it("keeps Close available when entries shrink to one page and resets on reopening", () => {
    const { card, close, count, next, onOpenChange, pager, previous } = setup();
    active = next;
    next.click();
    card.setEntries(entries(1));
    expect(count.textContent).toBe("1/1");
    expect(pager.hidden).toBe(true);
    expect(previous.hidden).toBe(true);
    expect(next.hidden).toBe(true);
    expect(active).toBe(close);
    close.click();
    expect(card.isOpen()).toBe(false);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    card.setEntries(entries(7));
    card.open();
    expect(count.textContent).toBe("1/2");
    expect(previous.hidden).toBe(true);
    expect(next.hidden).toBe(false);
    expect(active).toBe(close);
    card.dispose();
    for (const control of [previous, next, close]) {
      expect(control.listeners.get("click")).toEqual([]);
    }
  });
  it("keeps the footer Close on every page and uses the same close lifecycle once", () => {
    const { card, close, dismiss, next, onOpenChange } = setup();
    expect(dismiss.textContent).toBe("Close");
    expect(dismiss.hidden).toBe(false);
    next.click();
    expect(dismiss.hidden).toBe(false);
    dismiss.click();
    dismiss.click();
    expect(card.isOpen()).toBe(false);
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    card.open();
    close.click();
    expect(onOpenChange.mock.calls).toEqual([[true], [false], [true], [false]]);
    card.dispose();
    expect(dismiss.listeners.get("click")).toEqual([]);
    dismiss.click();
    expect(onOpenChange).toHaveBeenCalledTimes(4);
  });
  it("centers the single Close row and retains the right action beside visible pager buttons", () => {
    const { card, dismiss, pager } = setup();
    const actions = dismiss.parent!;
    expect(pager.hidden).toBe(false);
    expect(actions.style).toMatchObject({ gridColumn: "3", justifySelf: "end" });
    card.setEntries(entries(1));
    expect(pager.hidden).toBe(true);
    expect(actions.style).toMatchObject({ gridColumn: "1 / -1", justifySelf: "center" });
    card.setEntries(entries(7));
    expect(pager.hidden).toBe(false);
    expect(actions.style).toMatchObject({ gridColumn: "3", justifySelf: "end" });
    card.dispose();
  });
  it("labels an actual parent return Back while root opening remains Close and X stays equivalent", () => {
    const { card, close, dismiss, onOpenChange } = setup();
    expect(dismiss.textContent).toBe("Close");
    card.close();
    card.open({ intent: "back", label: "Back" });
    expect(dismiss.textContent).toBe("Back");
    expect(dismiss.parent!.dataset.footerAction).toBe("back");
    card.open();
    expect(dismiss.textContent).toBe("Back");
    dismiss.click();
    expect(card.isOpen()).toBe(false);
    card.open({ intent: "back", label: "Back" });
    close.click();
    expect(card.isOpen()).toBe(false);
    expect(onOpenChange.mock.calls).toEqual([[true], [false], [true], [false], [true], [false]]);
    card.open();
    expect(dismiss.textContent).toBe("Close");
    expect(dismiss.parent!.dataset.footerAction).toBe("close");
    card.dispose();
  });
});
