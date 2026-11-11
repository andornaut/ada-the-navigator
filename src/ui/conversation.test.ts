import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { SPEAKERS } from "../data/conversations.ts";
import { COMPACT_PORTRAITS, CONVERSATION_STYLE, TAB_COLOURS } from "./conversation.ts";
import { units } from "./layout/css.ts";
import { NOTICE_STYLE } from "./notice.ts";

// The box's rules, by selector, from its stylesheet.
function rules(css: string): Map<string, string> {
  return new Map(
    Array.from(
      css.replace(/\/\*[\s\S]*?\*\//gu, "").matchAll(/([^{}]+)\{([^{}]*)\}/gu),
      ([, selector = "", body = ""]) => [selector.trim(), body.replace(/\s+/gu, "")],
    ),
  );
}

const squash = (value: string): string => value.replace(/\s+/gu, "");

describe("conversation box style", () => {
  const css = rules(CONVERSATION_STYLE);

  it("swaps the portrait's end and the tab's end for a right-side speaker, never the text's alignment", () => {
    const sided = [...css].filter(([selector]) => selector.includes('[data-side="right"]'));
    expect(sided.map(([selector]) => selector)).toEqual([
      '.ada-conversation[data-side="right"]',
      '.ada-conversation[data-side="right"] .ada-conversation-text',
      '.ada-conversation[data-side="right"] .ada-conversation-name',
    ]);
    expect(css.get(".ada-conversation")).toContain("text-align:left");
    expect(CONVERSATION_STYLE).not.toMatch(/text-align:\s*right|flex-end/u);
  });

  it("is one 60 high press area with 4 padding and the tab inside the button", () => {
    const box = css.get(".ada-conversation") ?? "";
    expect(box).toContain(`height:${squash(units(60))}`);
    expect(box).toContain(`padding:${squash(units(4))}`);
    expect(box).toContain("pointer-events:auto");
    expect(box).toContain("overflow:visible");
  });

  it("frames the 44 portrait in a 2 ink edge around the navy 48 slot", () => {
    const frame = css.get(".ada-conversation-frame") ?? "";
    expect(frame).toContain(`width:${squash(units(52))}`);
    expect(frame).toContain(`border:${squash(units(2))}solid#181425`);
    expect(frame).toContain("background:#262b44");
    expect(css.get(".ada-conversation-portrait")).toContain(`width:${squash(units(44))}`);
  });

  it("wraps a line to at most two body lines centred on the panel", () => {
    const line = css.get(".ada-conversation-line") ?? "";
    expect(line).toContain("white-space:normal");
    expect(line).toContain("-webkit-line-clamp:2");
    expect(line).toContain(`max-height:${squash(units(40))}`);
    expect(css.get(".ada-conversation-text")).toContain("justify-content:center");
  });

  it("overhangs the 20 high tab 10 above the panel, 8 in from its end", () => {
    const name = css.get(".ada-conversation-name") ?? "";
    expect(name).toContain(`top:${squash(units(-10))}`);
    expect(name).toContain(`right:${squash(units(8))}`);
    expect(name).toContain(`height:${squash(units(20))}`);
    expect(name).toContain(`border:${squash(units(1))}solid#181425`);
    expect(name).toContain(`border-radius:${squash(units(2))}`);
    // A 1 edge and 5 padding put the label 6 from the tab's left; the width is the label plus 12.
    expect(name).toContain(`padding:0${squash(units(5))}`);
  });

  it("gives every speaker a tab colour and a compact portrait sheet that exists", () => {
    for (const speaker of Object.keys(SPEAKERS)) {
      expect(TAB_COLOURS).toHaveProperty(speaker);
      expect(css.get(`.ada-conversation[data-speaker="${speaker}"] .ada-conversation-name`)).toBe(
        `background:${TAB_COLOURS[speaker as keyof typeof TAB_COLOURS]}`,
      );
      expect(COMPACT_PORTRAITS).toHaveProperty(speaker);
    }
    const manifest = JSON.parse(
      readFileSync(new URL("../../public/art/manifest.json", import.meta.url), "utf8"),
    ) as { assets: { frameWidth?: number; id: string; path: string; width: number }[] };
    for (const sheet of Object.values(COMPACT_PORTRAITS)) {
      const asset = manifest.assets.find(({ path }) => path === sheet.url);
      expect(asset, sheet.url).toBeDefined();
      expect(asset!.width / (asset!.frameWidth ?? 1)).toBe(sheet.frames);
      expect(sheet.frame).toBeLessThan(sheet.frames);
    }
  });
});

describe("notice style", () => {
  const css = rules(NOTICE_STYLE);

  it("lets a tap on the game notice dismiss it, and passes presses through the save status", () => {
    expect(css.get("#game-status")).toContain("pointer-events:auto");
    const shared = [...css].find(([selector]) => /^#game-status,\s*#save-status$/u.test(selector));
    expect(shared?.[1]).toContain("pointer-events:none");
    expect(shared?.[1]).toContain(`padding:0${squash(units(8))}`);
    expect(shared?.[1]).toContain(`height:${squash(units(60))}`);
  });
});
