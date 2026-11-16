import { afterEach, expect, it, vi } from "vitest";

import { resolveAdaHoldAction } from "./actionBinding.ts";
import { registerAdaActionRoot } from "./actionRegistry.ts";
import { createStorybook, type StoryPageView } from "./storybook.ts";

vi.mock("./storyArt.ts", async (original) => ({
  ...(await original<typeof import("./storyArt.ts")>()),
  loadStoryArt: () => new Promise(() => {}),
}));

class Element extends EventTarget {
  readonly children: Element[] = [];
  parentElement: Element | null = null;
  attached = false;
  className = "";
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly properties = new Map<string, string>();
  readonly style = Object.assign(
    {
      removeProperty: (key: string) => this.properties.delete(key),
      setProperty: (key: string, value: string) => this.properties.set(key, value),
    },
    {} as Record<string, string>,
  );
  hidden = false;
  inert = false;
  disabled = false;
  textContent = "";
  clientWidth = 720;
  clientHeight = 360;
  scrollHeight = 360;
  scrollWidth = 720;
  get ownerDocument() {
    return document;
  }
  get parentNode() {
    return this.parentElement;
  }
  get nextSibling(): Element | null {
    return this.parentElement?.children[this.parentElement.children.indexOf(this) + 1] ?? null;
  }
  get isConnected(): boolean {
    return this.parentElement?.isConnected ?? this.attached;
  }
  readonly classList = {
    add: (...names: string[]) => {
      this.className = [...new Set([...this.className.split(" "), ...names])]
        .filter(Boolean)
        .join(" ");
    },
    remove: (...names: string[]) => {
      this.className = this.className
        .split(" ")
        .filter((name) => !names.includes(name))
        .join(" ");
    },
    toggle: (name: string, value: boolean) => {
      if (value) {
        this.classList.add(name);
      } else {
        this.classList.remove(name);
      }
    },
  };
  contains(node: unknown): boolean {
    return node === this || this.children.some((child) => child.contains(node));
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  toggleAttribute(name: string, value: boolean) {
    if (value) {
      this.setAttribute(name, "");
    } else {
      this.removeAttribute(name);
    }
  }
  closest(selector: string): Element | null {
    if (
      (selector.includes("[hidden]") && this.hidden) ||
      (selector.includes("[inert]") && this.inert) ||
      (selector.includes(".ada-story-panel") &&
        this.className.split(" ").includes("ada-story-panel"))
    ) {
      return this;
    }
    return this.parentElement?.closest(selector) ?? null;
  }
  insertBefore(node: Element, before: Element | null) {
    if (node === before) {
      return;
    }
    node.remove();
    node.parentElement = this;
    this.children.splice(
      before === null ? this.children.length : this.children.indexOf(before),
      0,
      node,
    );
  }
  append(...nodes: Element[]) {
    for (const node of nodes) {
      this.insertBefore(node, null);
    }
  }
  prepend(...nodes: Element[]) {
    for (const node of nodes.reverse()) {
      this.insertBefore(node, this.children[0] ?? null);
    }
  }
  replaceChildren(...nodes: Element[]) {
    for (const child of [...this.children]) {
      child.remove();
    }
    this.append(...nodes);
  }
  remove() {
    if (this.parentElement) {
      this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
    }
    this.parentElement = null;
    this.attached = false;
  }
  getBoundingClientRect() {
    return { bottom: 360, height: 360, left: 0, top: 0, width: 720 };
  }
  focus() {
    Object.assign(document, { activeElement: this });
  }
  all(): Element[] {
    return this.children.flatMap((child) => [child, ...child.all()]);
  }
}
const page: StoryPageView = {
  background: "grandmaGarden",
  canGoBack: true,
  canSkip: true,
  next: true,
  text: "Existing page facts",
};
function setup() {
  const win = Object.assign(new EventTarget(), { HTMLElement: Element, Node: Element });
  const doc = Object.assign(new EventTarget(), {
    activeElement: null,
    createElement: () => new Element(),
    defaultView: win,
    fonts: { ready: new Promise(() => {}) },
  });
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", win);
  vi.stubGlobal("HTMLElement", Element);
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
  const host = new Element();
  host.attached = true;
  let allowed = true;
  const unregister = registerAdaActionRoot(
    { permits: () => allowed },
    host as unknown as HTMLElement,
  );
  const options = {
    labels: { next: "Next", previous: "Previous", skip: "Skip" },
    onChoose: vi.fn(),
    onNext: vi.fn(),
    onPrevious: vi.fn(),
    onSkip: vi.fn(),
    reducedMotion: () => true,
  };
  const story = createStorybook(host as unknown as HTMLElement, options);
  story.show(page);
  const button = (action: string) => host.all().find((node) => node.dataset.action === action)!;
  const resolve = (element: Element) =>
    resolveAdaHoldAction(host as unknown as HTMLElement, element as unknown as EventTarget);
  return {
    button,
    deny: () => {
      allowed = false;
    },
    host,
    options,
    resolve,
    story,
    unregister,
  };
}
afterEach(() => vi.unstubAllGlobals());
it("registers native navigation with default holds and current callbacks", () => {
  const f = setup();
  try {
    for (const [action, key] of [
      ["story-skip", "onSkip"],
      ["story-previous", "onPrevious"],
      ["story-next", "onNext"],
    ] as const) {
      const button = f.button(action),
        binding = f.resolve(button)!;
      expect(binding.available()).toBe(true);
      expect(binding.hold).toBeUndefined();
      const replacement = vi.fn();
      f.options[key] = replacement;
      binding.activate();
      expect(replacement).toHaveBeenCalledOnce();
      button.disabled = true;
      expect(binding.available()).toBe(false);
      binding.activate();
      expect(replacement).toHaveBeenCalledOnce();
      button.disabled = false;
    }
    f.story.show({ ...page, canGoBack: false, canSkip: false, next: false });
    expect(f.resolve(f.button("story-skip"))!.available()).toBe(false);
    expect(f.resolve(f.button("story-previous"))!.available()).toBe(false);
    expect(f.resolve(f.button("story-next"))!.available()).toBe(false);
  } finally {
    f.story.dispose();
    f.unregister();
  }
});
it("preserves live parent eligibility, native click dispatch and disposal without another root", () => {
  const f = setup();
  const button = f.button("story-next"),
    binding = f.resolve(button)!;
  button.dispatchEvent(new Event("click"));
  expect(f.options.onNext).toHaveBeenCalledOnce();
  f.deny();
  expect(binding.available()).toBe(false);
  button.dispatchEvent(new Event("click"));
  binding.activate();
  expect(f.options.onNext).toHaveBeenCalledOnce();
  f.story.dispose();
  expect(f.resolve(button)).toBeNull();
  button.dispatchEvent(new Event("click"));
  expect(f.options.onNext).toHaveBeenCalledOnce();
  f.unregister();
});
it("rebuilds choices with their original indexes, current callbacks and no stale detached binding", () => {
  const f = setup();
  try {
    f.story.show({ ...page, choices: [{ label: "First" }, { label: "Second" }], next: false });
    const choices = f.host.all().filter((node) => node.dataset.action === "story-choice");
    expect(choices.map((node) => node.textContent)).toEqual(["First", "Second"]);
    const old = f.resolve(choices[1]!)!;
    const replacement = vi.fn();
    f.options.onChoose = replacement;
    old.activate();
    expect(replacement).toHaveBeenCalledExactlyOnceWith(1);
    f.story.show({
      ...page,
      choices: [{ label: "Replacement" }],
      next: false,
      text: "Next actual page facts",
    });
    expect(f.resolve(choices[1]!)).toBeNull();
    old.activate();
    choices[1]!.dispatchEvent(new Event("click"));
    expect(replacement).toHaveBeenCalledOnce();
    const current = f.host.all().find((node) => node.dataset.action === "story-choice")!;
    f.resolve(current)!.activate();
    expect(replacement.mock.calls).toEqual([[1], [0]]);
  } finally {
    f.story.dispose();
    f.unregister();
  }
});
