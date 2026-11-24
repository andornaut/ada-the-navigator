import { existsSync } from "node:fs";

import { createRequiredLoading } from "@andornaut/game-kit/runtime/load/loadingAttempts";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CAST, castPortrait } from "../data/cast.ts";
import { CONTENT } from "../data/content.ts";
import * as actionBinding from "./actionBinding.ts";
import { resolveAdaHoldAction } from "./actionBinding.ts";
import { registerAdaActionRoot } from "./actionRegistry.ts";
import { fixtureActionRoot } from "./actionRootFixture.ts";
import { createConversationBox, createInteractionCard } from "./conversation.ts";
import { createDialoguePanel, dialogueControlWidths } from "./dialoguePanel.ts";
import { bindAdaActionRoot } from "./holdActionsAdapter.ts";
import { currentView, enterPressView, rootPressGuard } from "./pressScope.ts";
import * as refusal from "./refusal.ts";
import { STORY_PORTRAITS, storyPortrait, storyPortraitFrame, storyTabColour } from "./storybook.ts";

it("applies the approved stack, measured split, and lone primary widths", () => {
  expect(dialogueControlWidths(228, [105, 101])).toEqual({ stacked: true, widths: [228, 228] });
  expect(dialogueControlWidths(232, [105, 101])).toEqual({ stacked: false, widths: [105, 101] });
  expect(dialogueControlWidths(240, [105, 101])).toEqual({ stacked: false, widths: [105, 101] });
  expect(dialogueControlWidths(228, [101])).toEqual({ stacked: false, widths: [101] });
});

class Element {
  getBoundingClientRect() {
    return { height: 0, width: 0 };
  }
  get isConnected(): boolean {
    return this === (document.body as unknown as Element) || (this.parent?.isConnected ?? false);
  }
  get parentElement() {
    return this.parent;
  }
  readonly attributes = new Map<string, string>();
  children: Element[] = [];
  parent: Element | null = null;
  get ownerDocument() {
    return document;
  }
  get parentNode() {
    return this.parent;
  }
  get nextSibling(): Element | null {
    return this.parent?.children[this.parent.children.indexOf(this) + 1] ?? null;
  }
  dispatchEvent(event: Event): boolean {
    for (const listener of this.listeners.get(event.type) ?? []) {
      listener(event as PointerEvent);
    }
    return !event.defaultPrevented;
  }
  contains(node: unknown): boolean {
    return node === this || this.children.some((child) => child.contains(node));
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
  className = "";
  readonly classList = {
    add: (...names: string[]) => {
      this.className += ` ${names.join(" ")}`;
    },
    remove: (...names: string[]) => {
      for (const name of names) {
        this.classList.toggle(name, false);
      }
    },
    toggle: (name: string, force = !this.className.split(" ").includes(name)) => {
      const names = new Set(this.className.split(" ").filter(Boolean));
      if (force) {
        names.add(name);
      } else {
        names.delete(name);
      }
      this.className = [...names].join(" ");
      return force;
    },
  };
  readonly dataset: Record<string, string> = {};
  hidden = false;
  disabled = false;
  tabIndex = 0;
  get inert() {
    return this.attributes.has("inert");
  }
  set inert(value: boolean) {
    this.toggleAttribute("inert", value);
  }
  hasAttribute(name: string) {
    return name === "hidden" ? this.hidden : this.attributes.has(name);
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  getAttributeNames() {
    return [...this.attributes.keys()];
  }
  closest(selector: string): Element | null {
    return (selector.includes("[hidden]") && this.hidden) ||
      (selector.includes("[inert]") && this.inert)
      ? this
      : (this.parent?.closest(selector) ?? null);
  }
  matches(selector: string): boolean {
    return selector.split(",").some((part) => {
      const rule = part.trim();
      return (
        rule === this.tag ||
        (rule === ":disabled" && this.disabled) ||
        (rule === "[data-action]" && "action" in this.dataset)
      );
    });
  }
  readonly listeners = new Map<string, ((event: Partial<PointerEvent>) => void)[]>();
  readonly style = Object.assign({} as Record<string, string>, {
    removeProperty: vi.fn(),
    setProperty: vi.fn(),
  });
  #text = "";
  get textContent(): string {
    return this.#text + this.children.map((child) => child.textContent).join("");
  }
  set textContent(value: string) {
    this.replaceChildren();
    this.#text = value;
  }
  addEventListener(type: string, callback: (event: Partial<PointerEvent>) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), callback]);
  }
  removeEventListener(type: string, callback: (event: Partial<PointerEvent>) => void) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((listener) => listener !== callback),
    );
  }
  append(...nodes: Element[]) {
    for (const node of nodes) {
      this.insertBefore(node, null);
    }
  }
  readonly setPointerCapture = vi.fn();
  dispatch(type: string, values: Partial<PointerEvent> = {}) {
    const event = {
      button: 0,
      clientX: 0,
      clientY: 0,
      detail: 1,
      isPrimary: false,
      pointerId: 7,
      pointerType: "touch",
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn(),
      stopPropagation: vi.fn(),
      ...values,
    };
    this.listeners.get(type)?.forEach((callback) => callback(event));
  }
  click() {
    this.dispatch("click", { detail: 0 });
  }
  focus() {
    (document as unknown as { activeElement: Element | null }).activeElement = this;
  }
  querySelectorAll(selector: string): Element[] {
    return this.all().filter((node) => node.matches(selector));
  }
  querySelector(selector: string): Element | null {
    return (
      this.all().find((node) =>
        selector === "button"
          ? node.tag === "button"
          : node.className.split(" ").includes(selector.slice(1)),
      ) ?? null
    );
  }
  readonly tag: string;
  constructor(tag: string) {
    this.tag = tag;
  }
  all(): Element[] {
    return this.children.flatMap((node) => [node, ...node.all()]);
  }
  remove() {
    if (this.parent) {
      this.parent.children.splice(this.parent.children.indexOf(this), 1);
    }
    this.parent = null;
  }
  replaceChildren(...nodes: Element[]) {
    for (const child of [...this.children]) {
      child.remove();
    }
    this.append(...nodes);
  }
  toggleAttribute(name: string, on: boolean) {
    if (on) {
      this.attributes.set(name, "");
    } else {
      this.attributes.delete(name);
    }
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
}
afterEach(() => {
  if (typeof document !== "undefined") {
    document.body?.replaceChildren();
  }
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const setup = (host?: Element) => {
  const body = new Element("body");
  if (host) {
    body.append(host);
  }
  vi.stubGlobal(
    "document",
    Object.assign(new EventTarget(), {
      activeElement: null,
      body,
      createElement: (tag: string) =>
        Object.assign(new Element(tag), {
          decode: () => Promise.reject(new Error("This fixture does not decode images")),
        }),
      defaultView: Object.assign(new EventTarget(), {
        HTMLElement: Element,
        MutationObserver: class {
          disconnect() {}
          observe() {}
          takeRecords() {
            return [];
          }
        },
        Node: Element,
        clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
        performance: { now: () => Date.now() },
        setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
      }),
      getElementById: () => host ?? null,
      hidden: false,
    }),
  );
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
};
const ambientLine = {
  elapsed: 0,
  key: "instance:0",
  mood: "neutral",
  name: "Penny",
  named: false,
  side: "left",
  speaker: "penny",
  text: "A line",
} as const;
function ambientFixture() {
  vi.useFakeTimers();
  const host = new Element("div");
  setup(host);
  let physical: Element | null = null;
  Object.assign(document, { elementFromPoint: () => physical });
  let status: "ready" | "loading" = "ready";
  const required = createRequiredLoading([{ retry() {}, status: () => status }]);
  const root = host as unknown as HTMLElement;
  const attachment = bindAdaActionRoot(
    {
      allowNonPrimaryTouch: true,
      guard: rootPressGuard(root),
      pointerRelease: { resolvePointer: () => undefined },
      requiredReady: () => required.state.kind === "ready",
      subscribeRequired: (invalidate) => required.subscribe(invalidate),
    },
    root,
  );
  const dismiss = vi.fn();
  const box = createConversationBox(dismiss);
  box.render(ambientLine, true, true);
  const button = host.children[0]!;
  physical = button;
  const event = (type: string, values: Record<string, unknown> = {}) => {
    const result = new Event(type, { cancelable: true });
    for (const [key, value] of Object.entries({
      button: 0,
      clientX: 0,
      clientY: 0,
      detail: type === "click" ? 1 : 0,
      isPrimary: false,
      pointerId: 7,
      pointerType: "touch",
      target: button,
      ...values,
    })) {
      Object.defineProperty(result, key, { value });
    }
    return result;
  };
  const down = (values = {}) => {
    const e = event("pointerdown", values);
    document.dispatchEvent(e);
    host.dispatchEvent(e);
  };
  const up = (values = {}) => document.dispatchEvent(event("pointerup", values));
  const click = (values = {}) => {
    const e = event("click", values);
    host.dispatchEvent(e);
    if (!e.defaultPrevented) {
      button.dispatchEvent(e);
    }
    return e;
  };
  return {
    box,
    button,
    click,
    dismiss,
    dispose: () => {
      box.dispose();
      attachment.dispose();
      required.dispose();
    },
    down,
    event,
    host,
    ready: (value: boolean) => {
      status = value ? "ready" : "loading";
      required.invalidate();
    },
    resolve: () => resolveAdaHoldAction(root, button as unknown as EventTarget),
    setPhysical: (element: Element | null) => {
      physical = element;
    },
    up,
  };
}

function connectedParent(): Element {
  const parent = new Element("div");
  document.body.append(parent as unknown as HTMLElement);
  return parent;
}

describe("shared Earth and space dialogue presentation", () => {
  it("resolves every authored cast member to their own existing sheet and tab", () => {
    for (const [key, member] of Object.entries(CAST)) {
      const portrait = storyPortrait(member.name)!;
      expect(portrait.speaker).toBe(key);
      expect(STORY_PORTRAITS[portrait.speaker]?.url).toBe(
        castPortrait(key as keyof typeof CAST, false).url,
      );
      expect(
        existsSync(
          new URL(`../../public${STORY_PORTRAITS[portrait.speaker]!.url}`, import.meta.url),
        ),
      ).toBe(true);
      expect(storyTabColour(member.name)).toBe(member.tab);
    }
  });
  it("uses Trista and Bin profiles for Mom and Dad without changing spoken family addresses", () => {
    setup();
    const panel = createDialoguePanel({
      close: document.createElement("button"),
      title: "Dialogue",
    });
    for (const [address, name, key, url] of [
      ["Mom", "Trista", "mom", "trista"],
      ["Dad", "Bin", "dad", "mr-b"],
    ] as const) {
      panel.showLine(address, `Hello, ${address}.`);
      expect(panel.body.querySelector(".ada-story-tab")?.textContent).toBe(name);
      expect(panel.body.querySelector(".ada-story-paragraph")?.textContent).toBe(
        `Hello, ${address}.`,
      );
      const portrait = storyPortrait(address)!;
      expect(portrait.speaker).toBe(key);
      expect(storyPortraitFrame(true, portrait, 0)).toBe(1);
      expect(STORY_PORTRAITS[key]?.url).toBe(`/art/portraits/${url}.png`);
      expect(existsSync(new URL(`../../public${STORY_PORTRAITS[key]!.url}`, import.meta.url))).toBe(
        true,
      );
    }
  });

  it.each([
    {
      first: { key: "dollop", name: "Dollop", rect: [0, 33, 32, 32] },
      home: "Phantom",
      second: { key: "blurb-settler", name: "Blurbs", rect: [0, 0, 32, 32] },
      url: "/art/phantom/portraits/phantom-full.png",
    },
    {
      first: { key: "cog", name: "Cog", rect: [0, 0, 32, 32] },
      home: "Andromeda",
      second: { key: "dial", name: "Dial", rect: [33, 0, 32, 32] },
      third: { key: "settler", name: "Wick", rect: [0, 66, 96, 32] },
      url: "/art/andromeda/portraits/andromeda-full.png",
    },
  ])(
    "shares the $home page and paints only the current speaker's whole strip",
    async ({ first, second, third, url }) => {
      setup();
      const panel = createDialoguePanel({
        close: document.createElement("button"),
        title: "Dialogue",
      });
      const face = panel.body.querySelector<HTMLElement>(".ada-story-portrait")!;
      const setProperty = vi.fn();
      Object.assign(face.style, { removeProperty: vi.fn(), setProperty });
      let finishPage = () => {};
      const loading = new Promise<void>((resolve) => {
        finishPage = resolve;
      });
      const decode = vi.fn(() => loading);
      const drawImage = vi.fn();
      const createElement = document.createElement.bind(document);
      const create = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        const node = createElement(tag);
        if (tag === "img") {
          Object.assign(node, { decode });
        } else if (tag === "canvas") {
          Object.assign(node, {
            getContext: () => ({ drawImage }),
            toDataURL: () => `data:image/png;base64,${drawImage.mock.lastCall![1]}`,
          });
        }
        return node;
      });
      panel.showLine(first.name, "First line");
      expect(face.dataset.speaker).toBe(first.key);
      panel.showLine(second.name, "Second line");
      expect(face.dataset.speaker).toBe(second.key);
      expect(panel.body.querySelector(".ada-story-tab")?.textContent).toBe(second.name);
      expect(decode).toHaveBeenCalledOnce();
      const imageIndex = create.mock.calls.findIndex(([tag]) => tag === "img");
      const image = create.mock.results[imageIndex]!.value as HTMLImageElement;
      expect(image.src).toBe(url);
      expect(setProperty).not.toHaveBeenCalled();
      finishPage();
      await vi.waitFor(() =>
        expect(setProperty).toHaveBeenCalledExactlyOnceWith(
          "--ada-portrait-crop-image",
          `url("data:image/png;base64,${second.rect[0]}")`,
        ),
      );
      const draw = ({ rect }: typeof first) => [image, ...rect, 0, 0, rect[2], rect[3]];
      expect(drawImage.mock.calls).toEqual([draw(first), draw(second)]);
      if (third) {
        panel.showLine(third.name, "Third line");
        expect(face.dataset.speaker).toBe(third.key);
        await vi.waitFor(() => expect(drawImage.mock.lastCall).toEqual(draw(third)));
      }
      panel.dispose();
    },
  );

  it("changes portrait and name with the actual line speaker and leaves narration unnamed", () => {
    setup();
    const panel = createDialoguePanel({
      close: document.createElement("button"),
      title: "Dialogue",
    });
    panel.showLine("Rivet", "A line");
    expect(panel.body.querySelector<HTMLElement>(".ada-story-portrait")?.dataset.speaker).toBe(
      "rivet",
    );
    expect(panel.body.querySelector(".ada-story-tab")?.textContent).toBe("Rivet");
    panel.showLine("Ada", "Her reply");
    expect(panel.body.querySelector<HTMLElement>(".ada-story-portrait")?.dataset.speaker).toBe(
      "ada",
    );
    expect(panel.body.querySelector(".ada-story-tab")?.textContent).toBe("Ada");
    panel.showLine(undefined, "Narration");
    expect((panel.body.querySelector(".ada-story-tab") as HTMLElement).hidden).toBe(true);
    expect((panel.body.querySelector(".ada-story-frame") as HTMLElement).hidden).toBe(true);
  });
  it("shows a station-specific name while using only the canonical keeper portrait and tab", () => {
    setup();
    const panel = createDialoguePanel({
      close: document.createElement("button"),
      title: "Station",
    });
    panel.showLine(
      { displayName: "Station-specific keeper", portraitName: "Slate" },
      "Current greeting",
    );
    expect(panel.body.querySelector(".ada-story-tab")?.textContent).toBe("Station-specific keeper");
    expect(panel.body.querySelector<HTMLElement>(".ada-story-tab")?.style.background).toBe(
      storyTabColour("Slate"),
    );
    expect(panel.body.querySelector<HTMLElement>(".ada-story-portrait")?.dataset.speaker).toBe(
      "slate",
    );
    expect(panel.body.querySelector<HTMLElement>(".ada-story-frame")?.hidden).toBe(false);
    expect(panel.body.querySelector(".ada-story-paragraph")?.textContent).toBe("Current greeting");
    panel.showLine("Ada", "Her reply");
    expect(panel.body.querySelector(".ada-story-tab")?.textContent).toBe("Ada");
    expect(panel.body.querySelector<HTMLElement>(".ada-story-portrait")?.dataset.speaker).toBe(
      "ada",
    );
  });

  it("separates neutral topics from navigation and keeps Skip in the shared Earth top slot", () => {
    setup();
    const parent = connectedParent();
    fixtureActionRoot(parent);
    const interaction = createInteractionCard(parent as unknown as HTMLElement, {
      choose: vi.fn(),
      close: vi.fn(),
      skip: vi.fn(),
    });
    interaction.show(1, {
      choices: [{ id: "continue", label: CONTENT.labels.continue! }],
      context: "deliveryComplete",
      text: "",
      title: "Rivet",
    });
    const navigation = parent
      .all()
      .find((node) => node.className.includes("ada-dialogue-controls"))!;
    const buttons = () => parent.all().filter((node) => node.tag === "button");
    expect(buttons().filter((node) => node.textContent === CONTENT.labels.skip)).toHaveLength(1);
    expect(buttons().filter((node) => node.textContent === "Close")).toHaveLength(0);
    expect(buttons().filter((node) => node.dataset.action === "conversation-close")).toHaveLength(
      1,
    );
    navigation.children.find((node) => node.textContent === "Ask more")!.click();
    const choices = parent.all().find((node) => node.className === "ada-story-choices")!;
    expect(choices.children.length).toBeGreaterThan(0);
    expect(choices.children.every((node) => !node.className.includes("ada-primary"))).toBe(true);
    expect(navigation.children.map((node) => node.textContent)).toEqual([CONTENT.labels.continue]);
    const skip = buttons().find((node) => node.textContent === CONTENT.labels.skip)!;
    expect(skip.className).toContain("ui-standard-button");
    expect(skip.className).toContain("ada-compact");
    expect(skip.className).toContain("ada-story-skip");
    expect(navigation.children).not.toContain(skip);
    expect(
      parent
        .all()
        .find((node) => node.className.includes("ada-dialogue-panel"))!
        .all(),
    ).not.toContain(skip);
    expect(skip.hidden).toBe(false);
    expect(
      buttons().filter((node) => node.className.includes("ada-primary")).length,
    ).toBeLessThanOrEqual(1);
    interaction.dispose();
  });
  it("puts the primary rightmost in the controls row and focuses it", () => {
    setup();
    const parent = connectedParent();
    fixtureActionRoot(parent);
    const interaction = createInteractionCard(parent as unknown as HTMLElement, {
      choose: vi.fn(),
      close: vi.fn(),
      skip: vi.fn(),
    });
    interaction.show(1, {
      choices: [{ id: "continue", label: CONTENT.labels.continue! }],
      context: "deliveryComplete",
      text: "",
      title: "Rivet",
    });
    const navigation = parent
      .all()
      .find((node) => node.className.includes("ada-dialogue-controls"))!;
    // Ask more, secondary, shares the row on the left; the primary is rightmost.
    expect(navigation.children.map((node) => node.textContent)).toEqual([
      "Ask more",
      CONTENT.labels.continue,
    ]);
    const primary = navigation.children.at(-1)!;
    expect(primary.className.split(" ")).toContain("ada-primary");
    expect(navigation.children[0]!.className.split(" ")).not.toContain("ada-primary");
    expect(document.activeElement).toBe(primary);
    interaction.dispose();
  });
  it("hides Skip at material decisions and cannot bypass or select an outcome", () => {
    setup();
    const parent = connectedParent();
    const choose = vi.fn(),
      skip = vi.fn();
    fixtureActionRoot(parent);
    const interaction = createInteractionCard(parent as unknown as HTMLElement, {
      choose,
      close: vi.fn(),
      skip,
    });
    interaction.show(1, {
      choices: [
        { id: "accept", label: "Accept" },
        { id: "decline", label: "Decline" },
      ],
      context: "test-decision",
      text: "Decision",
      title: "Rivet",
    });
    const skipButton = parent.all().find((node) => node.dataset.action === "dialogue-skip")!;
    expect(skipButton.hidden).toBe(true);
    skipButton.click();
    expect(skip).not.toHaveBeenCalled();
    expect(choose).not.toHaveBeenCalled();
    expect(
      parent
        .all()
        .filter((node) => node.tag === "button" && node.textContent === CONTENT.labels.continue),
    ).toHaveLength(0);
    parent
      .all()
      .find((node) => node.tag === "button" && node.textContent === "Accept")!
      .click();
    expect(choose).toHaveBeenCalledExactlyOnceWith("accept");
    interaction.dispose();
  });

  it("returns from a selected background answer to essential dialogue without reopening the menu", () => {
    setup();
    const parent = connectedParent();
    fixtureActionRoot(parent);
    const interaction = createInteractionCard(parent as unknown as HTMLElement, {
      choose: vi.fn(),
      close: vi.fn(),
      skip: vi.fn(),
    });
    interaction.show(1, {
      choices: [{ id: "continue", label: CONTENT.labels.continue! }],
      context: "deliveryComplete",
      text: "",
      title: "Rivet",
    });
    const paragraph = () =>
      parent.all().find((node) => node.className === "ada-story-paragraph")!.textContent;
    const initial = paragraph();
    parent
      .all()
      .find((node) => node.tag === "button" && node.textContent === "Ask more")!
      .click();
    const topics = parent.all().find((node) => node.className === "ada-story-choices")!;
    topics.children[0]!.click();
    expect(paragraph()).not.toBe(initial);
    parent
      .all()
      .find((node) => node.tag === "button" && node.textContent === CONTENT.labels.continue)!
      .click();
    expect(paragraph()).toBe(initial);
    expect(topics.children).toHaveLength(0);
    parent
      .all()
      .find((node) => node.tag === "button" && node.textContent === CONTENT.labels.continue)!
      .click();
    expect(paragraph()).not.toBe(initial);
    interaction.dispose();
  });

  it.each(["ada", "penny"] as const)(
    "dismisses %s on a secondary touch without relying on a synthesized click",
    (speaker) => {
      const f = ambientFixture();
      const { box, button, dismiss } = f;
      box.render(
        {
          elapsed: 0,
          key: speaker,
          mood: "neutral",
          name: speaker,
          named: false,
          side: speaker === "ada" ? "left" : "right",
          speaker,
          text: "A line",
        },
        true,
        true,
      );
      f.down();
      expect(f.resolve()?.element).toBe(button);
      expect(dismiss).not.toHaveBeenCalled();
      f.up();
      expect(dismiss).toHaveBeenCalledTimes(1);
      f.click();
      expect(dismiss).toHaveBeenCalledTimes(1);
      f.click({ detail: 0 });
      expect(dismiss).toHaveBeenCalledTimes(2);
      f.dispose();
    },
  );

  it.each(["pointercancel", "lostpointercapture"])("cancels a held message press on %s", (type) => {
    const f = ambientFixture();
    f.down();
    document.dispatchEvent(f.event(type));
    f.up();
    f.click();
    expect(f.dismiss).not.toHaveBeenCalled();
    f.down({ isPrimary: true });
    f.up({ isPrimary: true });
    expect(f.dismiss).toHaveBeenCalledTimes(1);
    f.click({ isPrimary: true });
    expect(f.dismiss).toHaveBeenCalledTimes(1);
    f.dispose();
  });

  it("has no separate ambient Skip button: a tap on the box is its one dismiss route", () => {
    const f = ambientFixture();
    const { box, dismiss, host } = f;
    box.render(
      {
        elapsed: 0,
        key: "ambient",
        mood: "neutral",
        name: "Penny",
        named: false,
        side: "left",
        speaker: "penny",
        text: "A line",
      },
      true,
      true,
    );
    expect(host.all().filter((node) => node.tag === "button")).toHaveLength(1);
    expect(host.all().find((node) => node.dataset.action === "conversation-skip")).toBeUndefined();
    host.children[0]!.click();
    expect(dismiss).toHaveBeenCalledTimes(1);
    f.dispose();
  });
});

it("uses the existing Use close callback only for a current backdrop tap", () => {
  setup();
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
  const parent = connectedParent(),
    close = vi.fn(),
    choose = vi.fn(),
    skip = vi.fn();
  let physical: Element | null = parent;
  const doc = Object.assign(new EventTarget(), document, {
    elementFromPoint: () => physical,
    hidden: false,
  });
  Object.assign(doc.defaultView!, {
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    performance: { now: () => performance.now() },
    setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
  });
  vi.stubGlobal("document", doc);
  const actionRoot = bindAdaActionRoot(
    {
      guard: rootPressGuard(parent as unknown as HTMLElement),
      pointerRelease: { pointerTarget: doc, resolvePointer: () => undefined },
      requiredReady: () => true,
      subscribeRequired: () => () => {},
    },
    parent as unknown as HTMLElement,
  );
  const interaction = createInteractionCard(parent as unknown as HTMLElement, {
    choose,
    close,
    skip,
  });
  interaction.show(1, {
    choices: [{ id: "continue", label: CONTENT.labels.continue! }],
    context: "deliveryComplete",
    text: "",
    title: "Rivet",
  });
  const modal = parent.children[0]!,
    card = modal.children[0]!;
  const event = (type: string, target = modal, clientX = 0) => {
    const value = new Event(type, { cancelable: true });
    Object.defineProperties(
      value,
      Object.fromEntries(
        Object.entries({
          button: 0,
          clientX,
          clientY: 0,
          detail: type === "click" ? 1 : 0,
          isPrimary: true,
          pointerId: 7,
          pointerType: "mouse",
          target,
        }).map(([key, property]) => [key, { value: property }]),
      ),
    );
    return value;
  };
  const down = (target = modal, clientX = 0) => {
    physical = target;
    doc.dispatchEvent(event("pointerdown", target, clientX));
    parent.dispatch("pointerdown", {
      clientX,
      isPrimary: true,
      pointerType: "mouse",
      target: target as unknown as EventTarget,
    });
  };
  const click = (clientX = 0) => {
    physical = modal.hidden ? parent : modal;
    doc.dispatchEvent(event("pointerup", modal, clientX));
    parent.dispatch("click", {
      clientX,
      detail: 1,
      target: modal as unknown as EventTarget,
    });
  };
  try {
    down(card);
    click();
    down();
    click(100);
    down();
    doc.dispatchEvent(event("pointercancel"));
    click();
    const cover = new Element("div");
    parent.append(cover);
    const leave = enterPressView(parent as unknown as HTMLElement, cover as unknown as HTMLElement);
    down();
    click();
    leave();
    expect(close).not.toHaveBeenCalled();
    down();
    click();
    expect(close).toHaveBeenCalledOnce();
    expect(choose).not.toHaveBeenCalled();
    expect(skip).not.toHaveBeenCalled();
    interaction.show(1, null);
    down();
    click();
    expect(close).toHaveBeenCalledOnce();
  } finally {
    interaction.dispose();
    actionRoot.dispose();
  }
});

it.each(["dialogue-skip", "conversation-close"])(
  "rejects missing compact Interaction metadata for %s before mount",
  (id) => {
    setup();
    const parent = fixtureActionRoot(connectedParent());
    const attach = vi.spyOn(parent, "insertBefore");
    const bind = actionBinding.bindAdaAction;
    vi.spyOn(actionBinding, "bindAdaAction").mockImplementation((action, button) =>
      (
        id === "dialogue-skip"
          ? action.nativeClickOwner === "factory" && button.textContent === CONTENT.labels.skip
          : button.dataset.action === id
      )
        ? { activate: () => false, dispose() {}, update() {} }
        : bind(action, button),
    );
    expect(() =>
      createInteractionCard(parent as unknown as HTMLElement, {
        choose: vi.fn(),
        close: vi.fn(),
        skip: vi.fn(),
      }),
    ).toThrow("no registered action binding");
    expect(attach).not.toHaveBeenCalled();
    expect(parent.children).toEqual([]);
  },
);

it.each(["open", "replace"])(
  "rejects an unbound material Interaction choice before attachment on %s",
  (phase) => {
    setup();
    const parent = fixtureActionRoot(connectedParent());
    const origin = new Element("button");
    parent.append(origin);
    origin.focus();
    const options = { choose: vi.fn(), close: vi.fn(), skip: vi.fn() };
    const interaction = createInteractionCard(parent as unknown as HTMLElement, options);
    const prior = {
      choices: [{ id: "start", label: "Working choice" }],
      context: "test-decision",
      text: "Existing",
      title: "Rivet",
    };
    if (phase === "replace") {
      interaction.show(1, prior);
    }
    const modal = parent.children[1]!;
    const row = modal.querySelector(".ada-story-choices")!;
    const old = row.children[0];
    const attach = vi.spyOn(row, "insertBefore");
    const focus = vi.spyOn(Element.prototype, "focus");
    const bind = actionBinding.bindAdaAction;
    const staged: HTMLElement[] = [];
    const disposals: (() => void)[] = [];
    const registrations = vi
      .spyOn(actionBinding, "bindAdaAction")
      .mockImplementation((action, button) => {
        staged.push(button);
        const binding =
          button.textContent === "Decline"
            ? { activate: () => false, dispose() {}, update() {} }
            : bind(action, button);
        const dispose = vi.fn(binding.dispose);
        disposals.push(dispose);
        return { ...binding, dispose };
      });
    const panel = {
      choices: [
        { id: "accept", label: "Accept" },
        { id: "decline", label: "Decline" },
      ],
      context: "test-decision",
      text: "Decision",
      title: "Rivet",
    };
    try {
      expect(() => interaction.show(1, panel)).toThrow("no registered action binding");
      expect(staged).toHaveLength(2);
      expect(attach).not.toHaveBeenCalled();
      expect(staged.every((button) => !button.isConnected && button.hidden)).toBe(true);
      expect(focus.mock.contexts.some((element) => staged.includes(element as HTMLElement))).toBe(
        false,
      );
      expect(interaction.isOpen()).toBe(false);
      expect(document.activeElement).toBe(origin);
      expect(row.children).toEqual([]);
      expect(currentView(parent as unknown as HTMLElement)).toBe(parent);
      old?.click();
      expect(options.choose).not.toHaveBeenCalled();
      expect(options.close).not.toHaveBeenCalled();
      expect(options.skip).not.toHaveBeenCalled();
      registrations.mockRestore();
      interaction.show(1, panel);
      expect(row.children.map((button) => button.textContent)).toEqual(["Accept", "Decline"]);
      expect(document.activeElement).toBe(row.children[0]);
    } finally {
      interaction.dispose();
    }
    for (const dispose of disposals) {
      expect(dispose).toHaveBeenCalledOnce();
    }
  },
);

it("registers native material choices with default hold dispatch, live callbacks and redraw cleanup", () => {
  setup();
  const parent = connectedParent(),
    options = { choose: vi.fn(), close: vi.fn(), skip: vi.fn() };
  const resolve = (node: Element) =>
    resolveAdaHoldAction(parent as unknown as HTMLElement, node as unknown as EventTarget);
  let permitted = true;
  const stopRoot = registerAdaActionRoot(
    { permits: () => permitted },
    parent as unknown as HTMLElement,
  );
  const interaction = createInteractionCard(parent as unknown as HTMLElement, options);
  try {
    interaction.show(1, {
      choices: [
        { id: "accept", label: "Accept" },
        { id: "decline", label: "Decline" },
      ],
      context: "test-decision",
      text: "Decision",
      title: "Rivet",
    });
    const choices = parent.all().find((node) => node.className === "ada-story-choices")!;
    const accept = choices.children[0]!,
      binding = resolve(accept)!;
    expect(choices.children.map((node) => node.textContent)).toEqual(["Accept", "Decline"]);
    expect(binding.hold).toBeUndefined();
    const current = vi.fn(() => expect(parent.contains(accept)).toBe(true));
    options.choose = current;
    permitted = false;
    binding.activate();
    expect(current).not.toHaveBeenCalled();
    permitted = true;
    binding.activate();
    expect(current).toHaveBeenCalledExactlyOnceWith("accept");
    expect(resolve(accept)).toBeNull();
    binding.activate();
    accept.click();
    expect(current).toHaveBeenCalledOnce();
    const skip = parent.all().find((node) => node.dataset.action === "dialogue-skip")!;
    expect(resolve(skip)!.available()).toBe(false);
    resolve(skip)!.activate();
    expect(options.skip).not.toHaveBeenCalled();
  } finally {
    interaction.dispose();
    stopRoot();
  }
});

it("keeps the original refusal callback then redraw and denies native disabled actions", () => {
  setup();
  const parent = connectedParent(),
    choose = vi.fn();
  fixtureActionRoot(parent);
  const cue = vi.spyOn(refusal, "refuse").mockReturnValue(() => {});
  const interaction = createInteractionCard(parent as unknown as HTMLElement, {
    choose,
    close: vi.fn(),
    skip: vi.fn(),
  });
  try {
    interaction.show(1, {
      choices: [
        { id: "accept", label: "Accept", refused: true },
        { id: "decline", label: "Decline" },
      ],
      context: "test-decision",
      text: "Decision",
      title: "Rivet",
    });
    const choices = parent.all().find((node) => node.className === "ada-story-choices")!,
      button = choices.children[0]!;
    const binding = resolveAdaHoldAction(
      parent as unknown as HTMLElement,
      button as unknown as EventTarget,
    )!;
    button.disabled = true;
    binding.activate();
    expect(cue).not.toHaveBeenCalled();
    button.disabled = false;
    button.click();
    expect(cue).toHaveBeenCalledExactlyOnceWith(choices, false);
    expect(choose).not.toHaveBeenCalled();
    expect(
      resolveAdaHoldAction(parent as unknown as HTMLElement, button as unknown as EventTarget),
    ).toBeNull();
    expect(choices.children.map((node) => node.textContent)).toEqual(["Accept", "Decline"]);
  } finally {
    interaction.dispose();
  }
});

it("binds native Skip and Close once with current callbacks and disposes their retained nodes", () => {
  setup();
  const parent = connectedParent(),
    options = { choose: vi.fn(), close: vi.fn(), skip: vi.fn() };
  fixtureActionRoot(parent);
  const interaction = createInteractionCard(parent as unknown as HTMLElement, options);
  const resolve = (node: Element) =>
    resolveAdaHoldAction(parent as unknown as HTMLElement, node as unknown as EventTarget);
  interaction.show(1, {
    choices: [{ id: "continue", label: CONTENT.labels.continue! }],
    context: "deliveryComplete",
    text: "",
    title: "Rivet",
  });
  const skip = parent.all().find((node) => node.dataset.action === "dialogue-skip")!,
    close = parent.all().find((node) => node.dataset.action === "conversation-close")!;
  const replacement = vi.fn();
  options.skip = replacement;
  expect(resolve(skip)!.hold).toBeUndefined();
  resolve(skip)!.activate();
  expect(replacement).toHaveBeenCalledOnce();
  expect(close.className.split(" ")).toContain("ui-standard-button");
  expect(close.getAttribute("aria-label")).toBe(CONTENT.labels.close);
  const closeCallback = vi.fn();
  options.close = closeCallback;
  const captured = resolve(close)!;
  interaction.show(1, null);
  expect(captured.available()).toBe(false);
  captured.activate();
  close.click();
  expect(closeCallback).not.toHaveBeenCalled();
  interaction.show(1, {
    choices: [{ id: "continue", label: CONTENT.labels.continue! }],
    context: "deliveryComplete",
    text: "",
    title: "Rivet",
  });
  captured.activate();
  expect(closeCallback).toHaveBeenCalledOnce();
  interaction.dispose();
  expect(resolve(skip)).toBeNull();
  expect(resolve(close)).toBeNull();
  skip.click();
  close.click();
  expect(closeCallback).toHaveBeenCalledOnce();
  expect(replacement).toHaveBeenCalledOnce();
});

it("requires a connected owning tree for native dialogue actions", () => {
  setup();
  const parent = new Element("div");
  const choose = vi.fn();
  const stopRoot = registerAdaActionRoot({ permits: () => true }, parent as unknown as HTMLElement);
  const interaction = createInteractionCard(parent as unknown as HTMLElement, {
    choose,
    close: vi.fn(),
    skip: vi.fn(),
  });
  try {
    const panel = {
      choices: [
        { id: "accept", label: "Accept" },
        { id: "decline", label: "Decline" },
      ],
      context: "test-decision",
      text: "Decision",
      title: "Rivet",
    };
    interaction.show(1, panel);
    const accept = parent
      .all()
      .find((node) => node.tag === "button" && node.textContent === "Accept")!;
    expect(parent.isConnected).toBe(false);
    expect(accept.isConnected).toBe(false);
    accept.click();
    expect(choose).not.toHaveBeenCalled();
    document.body.append(parent as unknown as HTMLElement);
    expect(accept.isConnected).toBe(true);
    parent.remove();
    expect(accept.isConnected).toBe(false);
    accept.click();
    expect(choose).not.toHaveBeenCalled();
    document.body.append(parent as unknown as HTMLElement);
    interaction.show(1, panel);
    accept.click();
    expect(choose).toHaveBeenCalledExactlyOnceWith("accept");
  } finally {
    interaction.dispose();
    stopRoot();
  }
});

describe("ambient App-root action generations", () => {
  it("fades a discovery in place with flight time, keeping its press identity until expiry", () => {
    const f = ambientFixture();
    try {
      const end = 3.3;
      const line = { ...ambientLine, discoveryFadeEnd: end };
      f.box.render({ ...line, elapsed: end - 0.31 }, true, false);
      expect(f.button.style.opacity).toBe("1");
      const binding = f.resolve()!;
      f.down();
      const fading = { ...line, elapsed: end - 0.075 };
      f.box.render(fading, true, false);
      expect(Number(f.button.style.opacity)).toBeCloseTo(0.25, 8);
      vi.advanceTimersByTime(100);
      f.box.render(fading, true, true);
      expect(Number(f.button.style.opacity)).toBeCloseTo(0.5, 8);
      expect(f.resolve()!.identity).toBe(binding.identity);
      f.box.render(null, true, true);
      expect(f.button.hidden).toBe(true);
      f.box.render({ ...ambientLine, elapsed: end - 0.075, key: "warning:0" }, true, true);
      expect(f.button.style.opacity).toBe("");
      f.up();
      f.click();
      expect(f.dismiss).not.toHaveBeenCalled();
      f.down();
      f.up();
      f.click();
      expect(f.dismiss).toHaveBeenCalledOnce();
    } finally {
      f.dispose();
    }
  });
  it("holds once, retains the same line identity across visual refresh and suppresses release click", () => {
    const f = ambientFixture();
    try {
      const first = f.resolve()!;
      f.down();
      f.box.render({ ...ambientLine, elapsed: 0.25, name: "Current name" }, true, true);
      expect(f.resolve()!.identity).toBe(first.identity);
      vi.advanceTimersByTime(500);
      expect(f.dismiss).toHaveBeenCalledOnce();
      f.up();
      f.click();
      expect(f.dismiss).toHaveBeenCalledOnce();
      expect([...f.button.listeners.keys()].filter((key) => key.startsWith("pointer"))).toEqual([]);
    } finally {
      f.dispose();
    }
  });
  it("does not dismiss a replacement line from an old captured press or its compatibility click", () => {
    const f = ambientFixture();
    try {
      const old = f.resolve()!;
      f.down();
      f.box.render({ ...ambientLine, key: "instance:1" }, true, true);
      expect(f.resolve()!.identity).not.toBe(old.identity);
      old.activate();
      f.up();
      f.click();
      expect(f.dismiss).not.toHaveBeenCalled();
      f.down();
      f.up();
      f.click();
      expect(f.dismiss).toHaveBeenCalledOnce();
    } finally {
      f.dispose();
    }
  });
  it("retains the hold witness when advancing synchronously renders the next line", () => {
    const f = ambientFixture();
    try {
      f.dismiss.mockImplementation(() =>
        f.box.render({ ...ambientLine, key: "instance:1" }, true, true),
      );
      f.down();
      vi.advanceTimersByTime(500);
      f.up();
      f.click();
      expect(f.dismiss).toHaveBeenCalledOnce();
      f.click({ detail: 0 });
      expect(f.dismiss).toHaveBeenCalledTimes(2);
    } finally {
      f.dispose();
    }
  });
  it.each(["required", "modal", "foreground"] as const)(
    "requires a fresh gesture after captured %s changes",
    (kind) => {
      const f = ambientFixture();
      try {
        f.down();
        if (kind === "required") {
          f.ready(false);
          f.ready(true);
        }
        if (kind === "modal") {
          const dialog = new Element("section");
          f.host.append(dialog);
          const leave = enterPressView(
            f.host as unknown as HTMLElement,
            dialog as unknown as HTMLElement,
          );
          leave();
          dialog.remove();
        }
        if (kind === "foreground") {
          Object.assign(document, { hidden: true });
          document.dispatchEvent(new Event("visibilitychange"));
          Object.assign(document, { hidden: false });
          document.dispatchEvent(new Event("visibilitychange"));
        }
        vi.advanceTimersByTime(500);
        f.up();
        f.click();
        expect(f.dismiss).not.toHaveBeenCalled();
        f.down();
        f.up();
        f.click();
        expect(f.dismiss).toHaveBeenCalledOnce();
      } finally {
        f.dispose();
      }
    },
  );
  it("uses the canonical scroll slop and current physical target without retargeting to a text field", () => {
    const f = ambientFixture();
    try {
      f.down();
      document.dispatchEvent(f.event("pointermove", { clientX: 9 }));
      f.up({ clientX: 9 });
      f.click({ clientX: 9 });
      expect(f.dismiss).not.toHaveBeenCalled();
      f.down();
      document.dispatchEvent(f.event("pointermove", { clientX: 8 }));
      f.up({ clientX: 8 });
      f.click({ clientX: 8 });
      expect(f.dismiss).toHaveBeenCalledOnce();
      f.dismiss.mockClear();
      const input = new Element("input");
      f.host.append(input);
      f.down();
      f.setPhysical(input);
      document.dispatchEvent(f.event("pointermove", { target: f.button }));
      f.up();
      f.click();
      expect(f.dismiss).not.toHaveBeenCalled();
    } finally {
      f.dispose();
    }
  });
  it("does not own a primary canvas press and permits the separate secondary touch on the bark", () => {
    const f = ambientFixture();
    try {
      const canvas = new Element("canvas");
      f.host.append(canvas);
      f.setPhysical(canvas);
      f.down({ isPrimary: true, pointerId: 1, target: canvas });
      expect(f.dismiss).not.toHaveBeenCalled();
      f.setPhysical(f.button);
      f.down();
      f.up();
      f.click();
      expect(f.dismiss).toHaveBeenCalledOnce();
      document.dispatchEvent(
        f.event("pointerup", { isPrimary: true, pointerId: 1, target: canvas }),
      );
      expect(f.dismiss).toHaveBeenCalledOnce();
    } finally {
      f.dispose();
    }
  });
  it("clears hidden generations and disposes the native binding without re-registering on later render", () => {
    const f = ambientFixture();
    try {
      const first = f.resolve()!;
      f.down();
      f.box.render(null, true, true);
      f.up();
      f.click();
      expect(f.dismiss).not.toHaveBeenCalled();
      expect(f.resolve()!.available()).toBe(false);
      f.box.render(ambientLine, true, true);
      expect(f.resolve()!.identity).not.toBe(first.identity);
      f.box.dispose();
      f.box.render({ ...ambientLine, key: "instance:2" }, true, true);
      expect(f.resolve()).toBeNull();
      expect(f.button.listeners.get("click")).toHaveLength(0);
      expect(f.host.children).not.toContain(f.button);
    } finally {
      f.dispose();
    }
  });
});

it("enters strict Interaction focus after drawing and restores its opener across hide and reopen", () => {
  setup();
  const parent = connectedParent(),
    origin = new Element("button");
  parent.append(origin);
  fixtureActionRoot(parent);
  origin.focus();
  const callbacks = { choose: vi.fn(), close: vi.fn(), skip: vi.fn() };
  const interaction = createInteractionCard(parent as unknown as HTMLElement, callbacks);
  const panel = {
    choices: [{ id: "continue", label: CONTENT.labels.continue! }],
    context: "deliveryComplete",
    text: "",
    title: "Rivet",
  };
  const guard = rootPressGuard(parent as unknown as HTMLElement),
    before = guard.gate.capture();
  try {
    interaction.show(1, panel);
    const modal = parent.children.find((node) => node.className.includes("ada-interaction-modal"))!,
      frame = modal.children[0]!;
    expect(before()).toBe(false);
    expect(currentView(parent as unknown as HTMLElement)).toBe(frame);
    expect(frame.getAttribute("aria-modal")).toBe("true");
    expect(frame.contains(document.activeElement)).toBe(true);
    const opened = guard.gate.capture();
    interaction.show(1, null);
    expect(opened()).toBe(false);
    expect(currentView(parent as unknown as HTMLElement)).toBe(parent);
    expect(document.activeElement).toBe(origin);
    interaction.show(1, panel);
    expect(opened()).toBe(false);
    expect(frame.contains(document.activeElement)).toBe(true);
    const beforeDispose = guard.gate.capture();
    interaction.dispose();
    expect(beforeDispose()).toBe(false);
    expect(currentView(parent as unknown as HTMLElement)).toBe(parent);
    interaction.show(1, panel);
    expect(parent.children).not.toContain(modal);
    expect(callbacks.choose).not.toHaveBeenCalled();
    expect(callbacks.close).not.toHaveBeenCalled();
    expect(callbacks.skip).not.toHaveBeenCalled();
  } finally {
    interaction.dispose();
  }
});

it("keeps a refused Interaction Close under the caller's policy without choosing an outcome", () => {
  setup();
  const parent = connectedParent(),
    callbacks = { choose: vi.fn(), close: vi.fn(), skip: vi.fn() };
  fixtureActionRoot(parent);
  const interaction = createInteractionCard(parent as unknown as HTMLElement, callbacks);
  try {
    interaction.show(1, {
      choices: [
        { id: "accept", label: "Accept" },
        { id: "decline", label: "Decline" },
      ],
      context: "test-decision",
      text: "Decision",
      title: "Rivet",
    });
    const frame = currentView(parent as unknown as HTMLElement);
    interaction.back();
    expect(callbacks.close).toHaveBeenCalledOnce();
    expect(callbacks.choose).not.toHaveBeenCalled();
    expect(callbacks.skip).not.toHaveBeenCalled();
    expect(interaction.isOpen()).toBe(true);
    expect(currentView(parent as unknown as HTMLElement)).toBe(frame);
    expect(frame.contains(document.activeElement)).toBe(true);
  } finally {
    interaction.dispose();
  }
});
