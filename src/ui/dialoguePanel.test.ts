import { existsSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { CAST, castSheet } from "../data/cast.ts";
import { CONTENT } from "../data/content.ts";
import { createInteractionCard } from "./conversation.ts";
import { createDialoguePanel } from "./dialoguePanel.ts";
import { STORY_PORTRAITS, storyPortrait, storyPortraitFrame, storyTabColour } from "./storybook.ts";

class Element {
  readonly attributes = new Map<string, string>();
  children: Element[] = [];
  className = "";
  readonly classList = {
    add: (...names: string[]) => {
      this.className += ` ${names.join(" ")}`;
    },
    toggle: vi.fn(),
  };
  readonly dataset: Record<string, string> = {};
  hidden = false;
  readonly listeners = new Map<string, (() => void)[]>();
  readonly style: Record<string, string> = {};
  textContent = "";
  addEventListener(type: string, callback: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), callback]);
  }
  append(...nodes: Element[]) {
    this.children.push(...nodes);
  }
  click() {
    this.listeners.get("click")?.forEach((callback) => callback());
  }
  focus() {}
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
  remove() {}
  replaceChildren(...nodes: Element[]) {
    this.children = nodes;
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
}
afterEach(() => vi.unstubAllGlobals());
const setup = () => vi.stubGlobal("document", { createElement: (tag: string) => new Element(tag) });

describe("shared Earth and space dialogue presentation", () => {
  it("resolves every authored cast member to their own existing sheet and tab", () => {
    for (const [key, member] of Object.entries(CAST)) {
      const portrait = storyPortrait(member.name)!;
      expect(portrait.speaker).toBe(key);
      expect(STORY_PORTRAITS[portrait.speaker]?.url).toBe(
        castSheet(key as keyof typeof CAST, false),
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
      closeAction: "close",
      closeLabel: "Close",
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

  it("changes portrait and name with the actual line speaker and leaves narration unnamed", () => {
    setup();
    const panel = createDialoguePanel({
      closeAction: "close",
      closeLabel: "Close",
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
  it("separates gold topic choices from navigation, uses canonical Skip and has only the close X", () => {
    setup();
    const parent = new Element("div");
    const interaction = createInteractionCard(parent as unknown as HTMLElement, {
      choose: vi.fn(),
      close: vi.fn(),
      skip: vi.fn(),
    });
    interaction.show(1, {
      choices: [{ id: "continue", label: CONTENT.labels.next! }],
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
    expect(choices.children.every((node) => node.className.includes("ada-primary"))).toBe(true);
    expect(navigation.children.every((node) => !node.className.includes("ada-primary"))).toBe(true);
    interaction.dispose();
  });
});
