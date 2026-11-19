import { readdirSync, readFileSync } from "node:fs";

import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/runtime/art/aseprite";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CARD_CLOSE } from "./layout/cardFrame.ts";
import { ADA_CONTROL_PRESENTATION_STYLE } from "./layout/controlPresentation.ts";
import { CONTROL_ROW, FOCUS_RING, TEXT_BUTTON } from "./layout/controls.ts";
import { slice, units } from "./layout/css.ts";
import { BUTTON_GAP, SPACING, STACK_BUTTON_GAP, TYPE } from "./layout/tokens.ts";
import { LOADING_LAYER, LOADING_STYLE } from "./loadingBar.ts";
import {
  actionOrder,
  BUTTON_SLICE,
  buttonTag,
  createActions,
  MODAL_LAYER,
  MODAL_STYLE,
  reserveScrollbar,
  setFooterAction,
  SWITCH_ROW_PARTS,
  switchState,
  TEXT_TOKENS,
  UI_SCOPE,
} from "./modal.ts";
import { buttonProperty } from "./uiSkin.ts";

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
  it("hold icon, label and switch, left to right, in one control-row press target", () => {
    expect(SWITCH_ROW_PARTS).toEqual(["icon", "text", "switch"]);
    expect(rule(`${UI_SCOPE} .ada-row`)).toContain(`min-height:${units(CONTROL_ROW.height)}`);
    expect(rule(`${UI_SCOPE} .ada-row`)).toContain("cursor:pointer");
  });

  it.each([
    [true, "on", "true", "0 0"],
    [false, "off", "false", `${units(-CONTROL_ROW.switch.width)} 0`],
  ])("shows a setting %s with the switch's %s frame", (on, tag, ariaChecked, position) => {
    expect(switchState(on)).toEqual({ ariaChecked, tag });
    const sheet = json("sprites/ui-switch.json") as {
      frames: Record<string, { frame: { x: number } }>;
      meta: { frameTags: { from: number; name: string }[] };
    };
    const from = sheet.meta.frameTags.find((frameTag) => frameTag.name === tag)!.from;
    const x = Object.values(sheet.frames)[from]!.frame.x;
    expect(position).toBe(x === 0 ? "0 0" : `${units(-x)} 0`);
    if (tag === "off") {
      expect(rule(`${UI_SCOPE} .ada-switch[data-tag=off]`)).toContain(position);
    } else {
      expect(rule(`${UI_SCOPE} .ada-switch`)).toContain(
        `background:url('/art/ui/sprites/ui-switch.png') ${position}`,
      );
    }
  });

  it("draws the shared focus ring its outset outside a focused row, button or close X", () => {
    const start = MODAL_STYLE.indexOf(`${UI_SCOPE} .ada-card .ada-button:focus-visible`);
    const focus = MODAL_STYLE.slice(start, MODAL_STYLE.indexOf("}", start));
    expect(focus).toContain(`${UI_SCOPE} .ada-row:focus-visible`);
    expect(focus).toContain(`${UI_SCOPE} .ada-close:focus-visible`);
    expect(focus).toContain(`outline:${units(FOCUS_RING.band)} solid #ead4aa`);
    expect(focus).toContain(`outline-offset:${units(FOCUS_RING.fringe)}`);
    expect(focus).toContain(`0 0 0 ${units(FOCUS_RING.outset)} #181425`);
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
      const sheet = json(entry(key).json) as AsepriteSheet & {
        frames: Readonly<Record<string, { frame: { h: number; w: number; x: number; y: number } }>>;
      };
      const frames = Object.fromEntries(
        [...sheetTags(sheet)].map(([tag, frames]) => [tag, sheet.frames[frames[0]!.frame]!.frame]),
      );
      expect(Object.keys(frames).sort()).toEqual(["disabled", "normal", "pressed"]);
      expect(frames.normal).toEqual({ h: 28, w: 16, x: 0, y: 0 });
      expect(frames.pressed?.x).toBe(16);
      expect(frames.disabled?.x).toBe(32);
      expect(MODAL_STYLE).toContain(`var(${buttonProperty(key, "normal")})`);
      expect(MODAL_STYLE).toContain(`var(${buttonProperty(key, "pressed")})`);
      expect(MODAL_STYLE).toContain(`var(${buttonProperty(key, "disabled")})`);
    },
  );

  it("is an action high with its insets inside whole-pixel slices, sinking when pressed", () => {
    const button = rule(`${UI_SCOPE} .ada-button`);
    expect(button).toContain(`min-height:${units(TEXT_BUTTON.height)}`);
    expect(button).toContain(`border-width:${slice(4)} ${slice(2)} ${slice(6)} ${slice(2)}`);
    // 12 down to the label's line box, 16 across, inside the 4, 2 and 6 slices; the 4 lip below.
    expect(button).toContain(
      `padding:calc(${units(12)} - ${slice(4)}) calc(${units(16)} - ${slice(2)}) calc(${units(
        16,
      )} - ${slice(6)})`,
    );
    expect(rule(`${UI_SCOPE} .ada-button:active:not(:disabled)`)).toContain(
      `padding:calc(${units(14)} - ${slice(4)}) calc(${units(16)} - ${slice(2)}) calc(${units(
        14,
      )} - ${slice(6)})`,
    );
    expect(rule(`${UI_SCOPE} .ada-button:disabled`)).toContain(TEXT_TOKENS.disabledLabel);
    expect(rule(`${UI_SCOPE} .ada-actions`)).toContain(`gap:${units(BUTTON_GAP)}`);
    expect(rule(`${UI_SCOPE} .ada-actions.ada-stack`)).toContain(`gap:${units(STACK_BUTTON_GAP)}`);
    expect(rule(`${UI_SCOPE} .ada-actions`)).toContain("grid-auto-columns:1fr");
  });

  it("stacks groups a gap apart in the scrolling body, each at its own width and centred", () => {
    const body = rule(`${UI_SCOPE} .ada-card-body`);
    expect(body).toContain("flex-direction:column");
    expect(body).toContain("align-items:center");
    expect(body).toContain(`gap:${units(SPACING.gap)}`);
    expect(body).toContain("overflow-y:auto");
    expect(rule(`${UI_SCOPE} .ada-card`)).toContain("overflow:hidden");
    expect(rule(`${UI_SCOPE} .ada-actions`)).toContain("width:max-content");
    const rows = rule(`${UI_SCOPE} .ada-rows`);
    expect(rows).toContain("align-self:stretch");
    expect(rows).toContain(`gap:${units(SPACING.rowGap)}`);
  });

  it("reserves the close target's clearance on both sides of the title", () => {
    expect(rule(`${UI_SCOPE} .ada-card header`)).toContain(`padding:0 ${units(34)}`);
  });

  it("keeps compact geometry with top placement by default and explicit centered rows", () => {
    const compact = rule(`${UI_SCOPE} .ada-button.ada-compact`);
    expect(compact).toContain(`min-width:${units(TEXT_BUTTON.compactWidth)}`);
    expect(compact).toContain(`height:${units(TEXT_BUTTON.compactHeight)}`);
    // The 2 nine-slice edge plus the padding makes the 8 inset.
    expect(compact).toContain(`padding:0 calc(${units(8)} - ${slice(2)})`);
    expect(rule(`${UI_SCOPE} .ada-row`)).toContain("align-items:flex-start");
    expect(rule(`${UI_SCOPE} .ada-row[data-ui-placement="center"]`)).toContain(
      "align-items:center",
    );
    expect(rule(`${UI_SCOPE} .ada-button`)).toContain("align-items:center");
    expect(rule(`${UI_SCOPE} .ada-button`)).toContain("justify-content:center");
  });

  it("counts the frame in the end pad of a card with a scroll group, as in every card", () => {
    expect(MODAL_STYLE).not.toContain(`${UI_SCOPE} .ada-card-body.ada-has-scroll::after`);
    expect(rule(`${UI_SCOPE} .ada-card-body::after`)).toContain(
      `height:calc(${units(SPACING.panelPadding - 8)} - ${slice(2)})`,
    );
  });

  it("reserves 14 on a scrolling group's right in every browser, whatever its scrollbar takes", () => {
    const group = (scrollHeight: number, bar: number) => {
      const classes = new Set<string>(["ada-scroll"]);
      const style: { paddingRight: string; removeProperty(name: string): void } = {
        paddingRight: "stale",
        removeProperty(name: string) {
          if (name === "padding-right") {
            style.paddingRight = "";
          }
        },
      };
      return {
        classList: {
          add: (name: string) => classes.add(name),
          remove: (name: string) => classes.delete(name),
        },
        classes,
        clientHeight: 300,
        clientWidth: 368 - bar,
        offsetWidth: 368,
        scrollHeight,
        style,
      };
    };
    // The column's own 4 ring padding, at one CSS px per logical px.
    vi.stubGlobal("getComputedStyle", () => ({
      borderLeftWidth: "0px",
      borderRightWidth: "0px",
      getPropertyValue: () => "1",
      paddingRight: "4px",
    }));
    const hidden = group(500, 0);
    reserveScrollbar(hidden as unknown as HTMLElement);
    expect(hidden.classes.has("ada-scrolls")).toBe(true);
    expect(hidden.style.paddingRight).toBe(units(18));
    const drawn = group(500, 14);
    reserveScrollbar(drawn as unknown as HTMLElement);
    expect(drawn.style.paddingRight).toBe(units(4));
    const thin = group(500, 8);
    reserveScrollbar(thin as unknown as HTMLElement);
    expect(thin.style.paddingRight).toBe(units(10));
    const fits = group(300, 0);
    reserveScrollbar(fits as unknown as HTMLElement);
    expect(fits.classes.has("ada-scrolls")).toBe(false);
    expect(fits.style.paddingRight).toBe("");
    vi.unstubAllGlobals();
  });

  it("keeps a focused cheat row's ring inside the column and reserves the scrollbar while it scrolls", () => {
    expect(rule(`${UI_SCOPE} .ada-cheat-items`)).toContain(`padding:${units(FOCUS_RING.outset)}`);
    expect(rule(`${UI_SCOPE} .ada-cheat-items`)).toContain("box-sizing:border-box");
    // The drawn scrollbar is the 14 reserve (SCROLL.gap 6 + SCROLL.track 8), and reserveScrollbar
    // pads what a thin or hidden one leaves: 368 inner, 360 rows, 346 while the column scrolls.
    const scrollbar = `${UI_SCOPE} .ada-scroll::-webkit-scrollbar{\n  width:${units(14)}`;
    expect(MODAL_STYLE).toContain(scrollbar);
  });

  it("keeps the end pad below the last control when a card scrolls to its end", () => {
    // Chibi's 16 padding includes the 2 frame; the trailing spacer follows the last group's gap.
    expect(rule(`${UI_SCOPE} .ada-card`)).toContain(`padding:0 calc(${units(16)} - ${slice(2)})`);
    expect(rule(`${UI_SCOPE} .ada-card-body::after`)).toContain(
      `height:calc(${units(8)} - ${slice(2)})`,
    );
  });
});

describe("modal text", () => {
  it("keeps notes at the body size, never widening their rows, and lets rows grow", () => {
    expect(rule(`${UI_SCOPE} .ada-setting-note`)).toContain(`font-size:${units(TYPE.body.size)}`);
    expect(rule(`${UI_SCOPE} .ada-setting-note`)).toContain("contain:inline-size");
    expect(rule(`${UI_SCOPE} .ada-prose`)).toContain("contain:inline-size");
    expect(rule(`${UI_SCOPE} .ada-row`)).toContain(`min-height:${units(CONTROL_ROW.height)}`);
    expect(rule(`${UI_SCOPE} .ada-row`)).not.toMatch(/(^|;)\s*height:/);
  });

  it("uses the contract's text colours", () => {
    expect(TEXT_TOKENS).toEqual({
      buttonLabel: "#181425",
      disabledLabel: "#9a96ad",
      label: "#ead4aa",
      rowDisabled: "#a6a2b8",
      rowSupporting: "#c0bbd0",
      supporting: "#b8b3c9",
      title: "#ffffff",
    });
    expect(rule(`${UI_SCOPE} .ada-card h2`)).toContain(`font-size:${units(TYPE.heading.size)}`);
    expect(rule(`${UI_SCOPE} .ada-card h2`)).toContain("color:#ffffff");
  });

  it("keeps a page card's title in the padding, with no close X to clear", () => {
    expect(rule(`${UI_SCOPE} .ada-card.ada-page-card header`)).toContain("padding:0 0px");
    expect(UI_SCOPE).toBe(":is(.ada-controls,.ada-start)");
  });

  it("places the close X's 24 face 6 from the card's corner in its hitAround target", () => {
    const close = rule(`${UI_SCOPE} .ada-close`);
    expect(close).toContain(`top:${units(CARD_CLOSE.hit.y)}`);
    expect(close).toContain(`right:${units(-6)}`);
    expect(close).toContain(`width:${units(48)}`);
    expect(rule(`${UI_SCOPE} .ada-close::before`)).toContain(`width:${units(24)}`);
  });
});

describe("modal stacking", () => {
  it("keeps retained parent paint below an active modal regardless of sibling order", () => {
    const underlay = rule(`${UI_SCOPE} .ada-modal[data-ada-modal-underlay][hidden]`);
    expect(underlay).toContain(`z-index:${MODAL_LAYER - 1}`);
    expect(underlay).toContain("display:flex!important");
  });

  it("draws an open modal above every other control in its layer", () => {
    const modal = MODAL_STYLE.slice(MODAL_STYLE.indexOf(`${UI_SCOPE} .ada-modal{`));
    expect(modal.slice(0, modal.indexOf("}"))).toContain(`z-index:${MODAL_LAYER}`);
    // The page's own layers stack the controls layer itself, not the controls inside it. The
    // loading bar is the one layer above open modals.
    const pageLayers = [
      ".ada-controls{",
      ".ada-controls.ada-",
      "#game-status{",
      "#save-status{",
      ".ada-conversation{",
      ".ada-loading{",
    ];
    const ui = new URL("./", import.meta.url);
    const sources = readdirSync(ui)
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
      // Interpolations are blanked to the same length, so their braces never read as a rule's.
      .map((name) => {
        const source = readFileSync(new URL(name, ui), "utf8");
        return [name, source.replace(/\$\{[^{}]*\}/gu, (text) => "_".repeat(text.length))] as const;
      });
    let checked = 0;
    for (const [name, source] of sources) {
      for (const match of source.matchAll(/z-index:\s*(\d+)/gu)) {
        const before = source.slice(0, match.index);
        const selector = before.slice(before.lastIndexOf("}") + 1, before.lastIndexOf("{") + 1);
        if (pageLayers.some((layer) => selector.includes(layer))) {
          continue;
        }
        checked++;
        expect(Number(match[1]), `${name}: ${selector.trim()}`).toBeLessThan(MODAL_LAYER);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("draws the loading bar above every layer, open modals included", () => {
    const ui = new URL("./", import.meta.url);
    const layers = readdirSync(ui)
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
      .flatMap((name) => [
        ...readFileSync(new URL(name, ui), "utf8").matchAll(/z-index:\s*(\d+)/gu),
      ])
      .map((match) => Number(match[1]));
    expect(LOADING_STYLE).toContain(`.ada-loading{`);
    expect(LOADING_STYLE).toContain(`z-index:${LOADING_LAYER};`);
    expect(LOADING_LAYER).toBeGreaterThan(Math.max(MODAL_LAYER, ...layers));
  });
});

afterEach(() => vi.unstubAllGlobals());

it("keeps original action nodes and roles while marking the footer for one shared presentation", () => {
  const nodes: unknown[] = [];
  const attributes = new Map<string, string>();
  const root = {
    append: (...children: unknown[]) => nodes.push(...children),
    className: "",
    dataset: {} as Record<string, string>,
    setAttribute: (key: string, value: string) => attributes.set(key, value),
  };
  vi.stubGlobal("document", { createElement: () => root });
  const primary = { textContent: "A wrapped primary action" } as HTMLButtonElement;
  const secondary = { textContent: "Back" } as HTMLButtonElement;
  const group = createActions([
    { button: primary, role: "primary" },
    { button: secondary, role: "secondary" },
  ]);
  setFooterAction("back", group);
  expect(nodes).toEqual([secondary, primary]);
  expect(root.dataset.footerAction).toBe("back");
  expect(attributes.get("data-ui-placement")).toBe("footer");
  expect(primary.textContent).toBe("A wrapped primary action");
  expect(ADA_CONTROL_PRESENTATION_STYLE).toContain("grid-template-rows:subgrid");
  expect(ADA_CONTROL_PRESENTATION_STYLE).toContain(":not(.ada-stack):not(.ada-wrap)");
  expect(ADA_CONTROL_PRESENTATION_STYLE).toContain(".ada-button-reason:not([hidden])");
  expect(rule(`${UI_SCOPE} .ada-actions.ada-stack`)).toContain(
    "grid-template-columns:minmax(0,1fr)",
  );
});

it("centers one visible native or presented button without role or dismissal exceptions", () => {
  const button = ":is(button,.ada-button-presentation):not([hidden])";
  const selector = `${UI_SCOPE} :is(.ada-actions,[data-footer-action],.ada-ship-back):has(
  > ${button}
):not(:has(
  > ${button}
  ~ ${button}
))`;
  expect(rule(selector)).toContain("align-self:center;justify-content:center");
  expect(rule(selector)).toContain("width:max-content;max-width:100%");
  expect(selector).not.toContain("primary");
  expect(selector).not.toContain('footer-action="close"');
});
