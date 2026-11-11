import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { SPEAKERS } from "../data/conversations.ts";
import {
  COMPACT_PORTRAITS,
  CONVERSATION_STYLE,
  portraitFrame,
  SPEAKING_FRAME_MS,
  TAB_COLOURS,
} from "./conversation.ts";
import { units } from "./layout/css.ts";
import { BOX_OCCUPANT, boxOccupant, NOTICE_STYLE } from "./notice.ts";

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
    for (const sheet of Object.values(COMPACT_PORTRAITS)) {
      const asset = MANIFEST.assets.find(({ path }) => path === sheet.url);
      expect(asset, sheet.url).toBeDefined();
      expect(asset!.width / (asset!.frameWidth ?? 1)).toBe(sheet.frames);
    }
  });
});

const MANIFEST = JSON.parse(
  readFileSync(new URL("../../public/art/manifest.json", import.meta.url), "utf8"),
) as {
  assets: {
    frameWidth?: number;
    frames?: Record<string, number>;
    id: string;
    path: string;
    width: number;
  }[];
};

// A compact sheet's named frames, from the manifest.
function frames(id: string): Record<string, number> {
  return MANIFEST.assets.find((asset) => asset.id === `${id}-portrait-compact`)?.frames ?? {};
}

const speaking = (prefix: string): number[] =>
  [1, 2, 3, 4].map((n) => frames(prefix === "" ? "astra" : "gadget")[`${prefix}speaking-${n}`]!);

describe("conversation portraits", () => {
  const line = { elapsed: 0, mood: "neutral", named: false } as const;

  it("name the manifest's frames: Ada's and Penny's moods, Astra's and the General's loops", () => {
    expect(COMPACT_PORTRAITS.ada.moods).toEqual({
      happy: frames("ada").happy,
      neutral: frames("ada").neutral,
    });
    expect(COMPACT_PORTRAITS.penny.moods).toEqual({
      happy: frames("penny").happy,
      neutral: frames("penny").neutral,
      upset: frames("penny").upset,
    });
    expect(COMPACT_PORTRAITS.astra.speaking).toEqual(speaking(""));
    expect(COMPACT_PORTRAITS.general.speaking).toEqual({
      named: speaking("named-"),
      unknown: speaking("unknown-"),
    });
  });

  it("loop Astra's speaking frames at 120 ms each for as long as her line shows", () => {
    const at = (elapsed: number) => portraitFrame(false, { ...line, elapsed, speaker: "astra" });
    expect(SPEAKING_FRAME_MS).toBe(120);
    expect([0, 0.12, 0.24, 0.36, 0.48, 4.99].map(at)).toEqual([1, 2, 3, 4, 1, 2]);
    expect(
      [0, 0.12, 0.36].map((elapsed) => portraitFrame(true, { ...line, elapsed, speaker: "astra" })),
    ).toEqual([1, 1, 1]);
  });

  it("loop the General's unknown frames, then his named ones once his tab reads his name", () => {
    const general = { ...line, elapsed: 0.25, speaker: "general" } as const;
    expect(portraitFrame(false, general)).toBe(frames("gadget")["unknown-speaking-3"]);
    expect(portraitFrame(false, { ...general, named: true })).toBe(
      frames("gadget")["named-speaking-3"],
    );
    expect(portraitFrame(true, { ...general, named: true })).toBe(
      frames("gadget")["named-speaking-1"],
    );
  });

  it("show Ada's and Penny's mood without a loop, neutral where the sheet has none", () => {
    for (const elapsed of [0, 0.12, 3]) {
      expect(portraitFrame(false, { ...line, elapsed, mood: "happy", speaker: "ada" })).toBe(0);
      expect(portraitFrame(false, { ...line, elapsed, speaker: "ada" })).toBe(1);
      expect(portraitFrame(false, { ...line, elapsed, mood: "happy", speaker: "penny" })).toBe(0);
      expect(portraitFrame(false, { ...line, elapsed, mood: "upset", speaker: "penny" })).toBe(2);
    }
    // Ada's sheet has no upset frame.
    expect(portraitFrame(false, { ...line, mood: "upset", speaker: "ada" })).toBe(1);
  });

  it("never show an idle frame in the box", () => {
    const idle = [
      frames("astra").idle,
      frames("gadget")["unknown-idle"],
      frames("gadget")["named-idle"],
    ];
    for (let ms = 0; ms < 1000; ms += 10) {
      for (const speaker of ["astra", "general"] as const) {
        for (const named of [false, true]) {
          const frame = portraitFrame(false, { ...line, elapsed: ms / 1000, named, speaker });
          expect(idle).not.toContain(frame);
        }
      }
    }
  });
});

describe("box slot", () => {
  it("shows a line, else the game notice, else the save status", () => {
    const shows = (line: boolean, notice: boolean, saveStatus: boolean) =>
      boxOccupant({ line, notice, saveStatus });
    expect(shows(true, true, true)).toBe("line");
    expect(shows(true, false, false)).toBe("line");
    expect(shows(false, true, true)).toBe("notice");
    expect(shows(false, false, true)).toBe("save");
    expect(shows(false, false, false)).toBeNull();
  });
});

describe("notice style", () => {
  const css = rules(NOTICE_STYLE);

  it("keep one box: the save status yields the slot, and a warning line covers the notice", () => {
    expect(css.get(`[${BOX_OCCUPANT}]:not([${BOX_OCCUPANT}="save"]) #save-status`)).toBe(
      "display:none",
    );
    expect(css.get(`[${BOX_OCCUPANT}="line"] #game-status`)).toBe("visibility:hidden");
    // No second slot: no rule of the save status's own moves it below the box.
    const own = [...css].filter(
      ([selector]) => selector.includes("#save-status") && !selector.includes("#game-status,"),
    );
    expect(own.length).toBeGreaterThan(0);
    for (const [, body] of own) {
      expect(body).not.toContain("top:");
    }
  });

  it("lets a tap on the game notice dismiss it, and passes presses through the save status", () => {
    expect(css.get("#game-status")).toContain("pointer-events:auto");
    const shared = [...css].find(([selector]) => /^#game-status,\s*#save-status$/u.test(selector));
    expect(shared?.[1]).toContain("pointer-events:none");
    expect(shared?.[1]).toContain(`padding:0${squash(units(8))}`);
    expect(shared?.[1]).toContain(`height:${squash(units(60))}`);
  });
});
