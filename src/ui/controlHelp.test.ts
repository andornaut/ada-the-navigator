import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CONTROL_WORDS } from "../data/controlWords.ts";
import { CONVERSATIONS } from "../data/conversations.ts";
import { HOME_COPY } from "../data/homeCopy.ts";
import {
  CONTROL_ICONS,
  controlHelpMarkup,
  controlHelpParts,
  controlHelpText,
  createControlHelp,
} from "./controlHelp.ts";
import { INLINE_CONTROL } from "./layout/controls.ts";
import { TYPE } from "./layout/tokens.ts";

// A stand-in for the few DOM members the renderer uses.
class FakeNode {
  readonly attributes = new Map<string, string>();
  alt?: string;
  children: FakeNode[] = [];
  className = "";
  readonly dataset: Record<string, string> = {};
  readonly data: string;
  src?: string;
  readonly tag: string;
  constructor(tag: string, data = "") {
    this.tag = tag;
    this.data = data;
  }
  get textContent(): string {
    return this.data + this.children.map((child) => child.textContent).join("");
  }
  append(...nodes: FakeNode[]): void {
    this.children.push(...nodes);
  }
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
}
const fakeDocument = {
  createElement: (tag: string) => new FakeNode(tag),
  createTextNode: (text: string) => new FakeNode("#text", text),
} as unknown as Document;

const LESSON_MOVE = CONVERSATIONS.find(({ id }) => id === "lesson:move")!.lines[0]!;
const LESSON_AIM = CONVERSATIONS.find(({ id }) => id === "lesson:aim")!.lines[0]!;
const SPRITES = new URL("../../public/art/ui/sprites/", import.meta.url);

describe("control help tokens", () => {
  it("splits copy into text and control tokens, and refuses an unknown token", () => {
    expect(controlHelpParts("Use the {move} to fly.")).toEqual([
      { kind: "text", text: "Use the " },
      { control: "move", kind: "control" },
      { kind: "text", text: " to fly." },
    ]);
    expect(controlHelpParts("{use}")).toEqual([{ control: "use", kind: "control" }]);
    expect(() => controlHelpParts("Press {jump}.")).toThrow(/jump/u);
  });

  it("names the controls in the lessons and the landing page, keyboard wording as words", () => {
    expect(controlHelpText(CONTROL_WORDS, LESSON_MOVE.text)).toBe("Fly with the left stick.");
    expect(controlHelpText(CONTROL_WORDS, LESSON_AIM.text)).toBe(
      "Aim and fire with the right stick.",
    );
    expect(LESSON_MOVE.desktop).toBe("Fly with WASD.");
    expect(controlHelpParts(LESSON_MOVE.desktop!)).toEqual([
      { kind: "text", text: "Fly with WASD." },
    ]);
    expect(controlHelpText(CONTROL_WORDS, HOME_COPY.mobile)).toBe(
      "Move with the left stick. Aim and fire with the right stick. Tap Use to interact.",
    );
  });
});

describe("control icons", () => {
  it("are Art's single-frame 16 by 16 sheets, 4 after the name and centred on the line", () => {
    for (const key of Object.values(CONTROL_ICONS)) {
      const sheet = JSON.parse(readFileSync(new URL(`${key}.json`, SPRITES), "utf8")) as {
        frames: Record<string, { frame: { h: number; w: number; x: number; y: number } }>;
      };
      expect(Object.values(sheet.frames).map(({ frame }) => frame)).toEqual([
        { h: 16, w: 16, x: 0, y: 0 },
      ]);
    }
    expect(INLINE_CONTROL).toEqual({ gap: 4, icon: 16, inset: 2 });
    expect(TYPE.label.lineHeight).toBe(TYPE.body.lineHeight);
    expect(2 * INLINE_CONTROL.inset + INLINE_CONTROL.icon).toBe(TYPE.body.lineHeight);
  });

  it("follow each control's name with its icon, hidden from screen readers", () => {
    const nodes = createControlHelp(
      fakeDocument,
      CONTROL_WORDS,
      LESSON_MOVE.text,
    ) as unknown as FakeNode[];
    expect(nodes.map((node) => node.textContent).join("")).toBe("Fly with the left stick.");
    const unit = nodes[1]!;
    expect(unit.className).toBe("ada-control-help");
    const [name, icon] = unit.children as [FakeNode, FakeNode];
    expect(name.textContent).toBe("left stick");
    expect(icon).toMatchObject({
      alt: "",
      className: "ada-control-icon",
      dataset: { control: "move" },
      src: "/art/ui/sprites/icon-move-controls.png",
      tag: "img",
    });
    expect(icon.getAttribute("aria-hidden")).toBe("true");
  });

  it("write the same icons into the landing page's markup, escaped and aria-hidden", () => {
    const html = controlHelpMarkup(CONTROL_WORDS, HOME_COPY.mobile);
    expect(html).not.toMatch(/\{(?:move|aim|use)\}/u);
    expect([...html.matchAll(/<img [^>]+>/gu)].map(([tag]) => tag)).toEqual(
      (["move", "aim", "use"] as const).map(
        (control) =>
          `<img class="ada-control-icon" data-control="${control}" ` +
          `src="/art/ui/sprites/${CONTROL_ICONS[control]}.png" alt="" aria-hidden="true" ` +
          'width="16" height="16">',
      ),
    );
    expect(html.replace(/<[^>]+>/gu, "")).toBe(
      "Move with the left stick. Aim and fire with the right stick. Tap Use to interact.",
    );
    expect(controlHelpMarkup(CONTROL_WORDS, "A < B & {use}")).toMatch(/^A &lt; B &amp; <span/u);
  });
});
