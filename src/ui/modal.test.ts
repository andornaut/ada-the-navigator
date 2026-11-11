import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  actionOrder,
  BUTTON_SLICE,
  buttonTag,
  MODAL_STYLE,
  SWITCH_ROW_PARTS,
  switchState,
  TEXT_TOKENS,
} from "./modal.ts";
import { buttonFrames, buttonProperty } from "./ui-skin.ts";

const json = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../public/art/ui/${path}`, import.meta.url), "utf8"));
const manifest = json("manifest.json") as {
  sprites: { json: string; key: string; slice?: Record<string, number> }[];
};
const entry = (key: string) => manifest.sprites.find((sprite) => sprite.key === key)!;
// The CSS rule for a selector in the modal styles.
const rule = (selector: string) => {
  const start = MODAL_STYLE.indexOf(`${selector}{`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  return MODAL_STYLE.slice(start, MODAL_STYLE.indexOf("}", start));
};

describe("Settings control rows", () => {
  it("hold icon, label and switch, left to right, in one 48px press target", () => {
    expect(SWITCH_ROW_PARTS).toEqual(["icon", "text", "switch"]);
    expect(rule(".ada-controls .ada-row")).toContain("min-height:48px");
    expect(rule(".ada-controls .ada-row")).toContain("cursor:pointer");
  });

  it.each([
    [true, "on", "true", "0 0"],
    [false, "off", "false", "-32px 0"],
  ])("shows a setting %s with the switch's %s frame", (on, tag, ariaChecked, position) => {
    expect(switchState(on)).toEqual({ ariaChecked, tag });
    const sheet = json("sprites/ui-switch.json") as {
      frames: Record<string, { frame: { x: number } }>;
      meta: { frameTags: { from: number; name: string }[] };
    };
    const from = sheet.meta.frameTags.find((frameTag) => frameTag.name === tag)!.from;
    const x = Object.values(sheet.frames)[from]!.frame.x;
    expect(position).toBe(x === 0 ? "0 0" : `-${x}px 0`);
    if (tag === "off") {
      expect(rule(".ada-controls .ada-switch[data-tag=off]")).toContain(position);
    } else {
      expect(rule(".ada-controls .ada-switch")).toContain(
        `background:url('/art/ui/sprites/ui-switch.png') ${position}`,
      );
    }
  });

  it("draws the shared focus ring 4px outside a focused row, button or close X", () => {
    const start = MODAL_STYLE.indexOf(".ada-controls .ada-card .ada-button:focus-visible");
    const focus = MODAL_STYLE.slice(start, MODAL_STYLE.indexOf("}", start));
    expect(focus).toContain(".ada-controls .ada-row:focus-visible");
    expect(focus).toContain(".ada-controls .ada-close:focus-visible");
    expect(focus).toContain("outline:2px solid #ead4aa");
    expect(focus).toContain("outline-offset:1px");
    expect(focus).toContain("0 0 0 4px #181425");
  });
});

describe("modal buttons", () => {
  it("put secondary actions left of primary ones", () => {
    const order = actionOrder([
      { name: "Update now", role: "primary" as const },
      { name: "Cancel", role: "secondary" as const },
    ]);
    expect(order.map(({ name }) => name)).toEqual(["Cancel", "Update now"]);
  });

  it.each([
    [false, false, "normal"],
    [false, true, "pressed"],
    [true, false, "disabled"],
    [true, true, "disabled"],
  ] as const)("disabled %s, pressed %s shows %s", (disabled, pressed, tag) => {
    expect(buttonTag(disabled, pressed)).toBe(tag);
  });

  it.each(["ui-button", "ui-button-primary"] as const)(
    "cuts %s's normal, pressed and disabled frames with its manifest slice",
    (key) => {
      expect(entry(key).slice).toEqual(BUTTON_SLICE);
      const frames = buttonFrames(json(entry(key).json) as Parameters<typeof buttonFrames>[0]);
      expect(Object.keys(frames).sort()).toEqual(["disabled", "normal", "pressed"]);
      expect(frames.normal).toEqual({ h: 28, w: 16, x: 0, y: 0 });
      expect(frames.pressed?.x).toBe(16);
      expect(frames.disabled?.x).toBe(32);
      expect(MODAL_STYLE).toContain(`var(${buttonProperty(key, "normal")})`);
      expect(MODAL_STYLE).toContain(`var(${buttonProperty(key, "pressed")})`);
      expect(MODAL_STYLE).toContain(`var(${buttonProperty(key, "disabled")})`);
    },
  );

  it("is 48px high with 16px insets, drops 2px when pressed and stays flat when disabled", () => {
    const button = rule(".ada-controls .ada-button");
    expect(button).toContain("height:48px");
    expect(button).toContain("border-width:4px 2px 6px 2px");
    expect(button).toContain("padding:0 14px 2px");
    expect(rule(".ada-controls .ada-button:active:not(:disabled)")).toContain("padding:2px 14px 0");
    expect(rule(".ada-controls .ada-button:disabled")).toContain(TEXT_TOKENS.disabledLabel);
    expect(rule(".ada-controls .ada-actions")).toContain("gap:8px");
    expect(rule(".ada-controls .ada-actions")).toContain("grid-auto-columns:1fr");
  });
});

describe("modal text", () => {
  it("uses the contract's text colours", () => {
    expect(TEXT_TOKENS).toEqual({
      buttonLabel: "#181425",
      disabledLabel: "#9a96ad",
      label: "#ead4aa",
      supporting: "#b8b3c9",
      title: "#ffffff",
    });
    expect(rule(".ada-controls .ada-card h2")).toContain("font-size:24px");
    expect(rule(".ada-controls .ada-card h2")).toContain("color:#ffffff");
  });

  it("places the close X's 24px face 6px from the card's corner in a 48px target", () => {
    const close = rule(".ada-controls .ada-close");
    expect(close).toContain("top:-6px");
    expect(close).toContain("right:-6px");
    expect(close).toContain("width:48px");
    expect(rule(".ada-controls .ada-close::before")).toContain("width:24px");
  });
});
