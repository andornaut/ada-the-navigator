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
  readonly style = { setProperty: vi.fn() };
  textContent = "";
  addEventListener(type: string, callback: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), callback]);
  }
  append(...nodes: Element[]) {
    for (const node of nodes) {
      node.parent = this;
      this.children.push(node);
    }
  }
  click() {
    this.listeners.get("click")?.forEach((callback) => callback());
  }
  remove() {
    this.parent?.children.splice(this.parent.children.indexOf(this), 1);
  }
  replaceChildren(...nodes: Element[]) {
    this.children.splice(0);
    this.append(...nodes);
  }
  setAttribute(key: string, value: string) {
    this.attributes.set(key, value);
  }
}

vi.mock("@andornaut/game-kit/web/ui/dom/focusModality", () => ({
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
  const pager = body.children[1]!;
  const [previous, count, next] = pager.children;
  return {
    card,
    close: frame.children[1]!,
    count: count!,
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
  });
});
