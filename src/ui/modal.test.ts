import { readdirSync, readFileSync } from "node:fs";

import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/runtime/art/aseprite";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HUD_BUTTON } from "../data/layout.ts";
import { CARD_CLOSE } from "./layout/cardFrame.ts";
import { ADA_CONTROL_PRESENTATION_STYLE } from "./layout/controlPresentation.ts";
import { CONTROL_ROW, FOCUS_RING, TEXT_BUTTON } from "./layout/controls.ts";
import { font, slice, units } from "./layout/css.ts";
import { BUTTON_GAP, SPACING, STACK_BUTTON_GAP, TYPE } from "./layout/tokens.ts";
import { LOADING_LAYER, LOADING_STYLE } from "./loadingBar.ts";
import {
  actionOrder,
  BUTTON_SLICE,
  buttonTag,
  createActions,
  LEGACY_TEXT_BUTTON,
  MODAL_LAYER,
  MODAL_STYLE,
  reserveScrollbar,
  setFooterAction,
  SWITCH_ROW_PARTS,
  switchState,
  TEXT_TOKENS,
  UI_SCOPE,
} from "./modal.ts";
import { mapCloseStyle } from "./modalClose.ts";
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

  it("keeps the generic focus ring off switches, the close button and Storybook buttons", () => {
    const start = MODAL_STYLE.indexOf(
      `${UI_SCOPE} .ada-card .ada-button:focus-visible:not(:where(
  ${LEGACY_TEXT_BUTTON},.ada-story .ada-button,[data-dialog=conversation] .ui-standard-button
))`,
    );
    expect(start).toBeGreaterThanOrEqual(0);
    const focus = MODAL_STYLE.slice(start, MODAL_STYLE.indexOf("}", start));
    expect(focus).toContain(`${UI_SCOPE} .ada-row:not([role=switch]):focus-visible`);
    expect(focus).not.toContain(`${UI_SCOPE} .ada-close:focus-visible`);
    expect(focus).toContain(`outline:${units(FOCUS_RING.band)} solid #ead4aa`);
    expect(focus).toContain(`outline-offset:${units(FOCUS_RING.fringe)}`);
    expect(focus).toContain(`0 0 0 ${units(FOCUS_RING.outset)} #181425`);
  });
});

describe("modal buttons", () => {
  it("tints only the legacy face and keeps the normal and pressed border slices", () => {
    const focus = `${UI_SCOPE} ${LEGACY_TEXT_BUTTON}:focus-visible`;
    expect(rule(focus)).toContain("outline:none");
    expect(rule(focus)).toContain("box-shadow:none");
    const enabled = rule(`${focus}:where(
  :not(:disabled,.ada-unavailable,[aria-disabled=true])
)`);
    expect(enabled).toContain("background-clip:padding-box");
    const { bottom, left, right, top } = BUTTON_SLICE;
    expect(enabled).toContain(`border-image-slice:${top} ${right} ${bottom} ${left}`);
    expect(enabled).not.toMatch(/border-image-source|padding:|fill/u);
    expect(rule(`${focus}:where(.ada-unavailable,[aria-disabled=true])`)).toContain(
      "text-decoration:underline",
    );
    expect(MODAL_STYLE).toContain("--ada-text-focus-face:Highlight;");
    expect(MODAL_STYLE).toContain("--ada-text-focus-ink:HighlightText");
  });

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
    // The face insets exclude the whole-pixel borders and the lip.
    expect(button).toContain(`--ada-button-inset-y:${units(11)}`);
    expect(button).toContain(`font:${font(TEXT_BUTTON.label)}`);
    const inset = "var(--ada-button-inset-y)";
    const side = `calc(${units(16)} - ${slice(2)})`;
    expect(button).toContain(
      `padding:calc(${inset} + 0px - ${slice(4)}) ${side} calc(${inset} + ${units(4)} - ${slice(6)})`,
    );
    expect(rule(`${UI_SCOPE} .ada-button:active:not(:disabled)`)).toContain(
      `padding:calc(${inset} + ${units(2)} - ${slice(4)}) ${side} calc(${inset} + ${units(2)} - ${slice(6)})`,
    );
    expect(rule(`${UI_SCOPE} .ada-button:disabled`)).toContain(TEXT_TOKENS.disabledLabel);
    expect(rule(`${UI_SCOPE} .ada-actions`)).toContain(`gap:${units(BUTTON_GAP)}`);
    expect(rule(`${UI_SCOPE} .ada-actions.ada-stack`)).toContain(`gap:${units(STACK_BUTTON_GAP)}`);
    expect(rule(`${UI_SCOPE} .ada-actions`)).toContain("grid-auto-columns:minmax(0,max-content)");
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

  it("keeps top placement by default and explicit centered rows", () => {
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

  it("keeps Cheats in two columns and grants in equal side-by-side tracks", () => {
    for (const group of [".ada-cheat-items", ".ada-cheat-grants"]) {
      expect(rule(`${UI_SCOPE} ${group}`)).toContain(
        "grid-template-columns:repeat(2,minmax(0,1fr))",
      );
    }
    expect(rule(`${UI_SCOPE} .ada-cheats-card > .ada-card-body`)).toContain("overflow:visible");
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

  it("paints the shared close focus face and glyph without changing the pressed frame", () => {
    const close = `${UI_SCOPE} .ada-close`;
    const focus = rule(`${close}:focus-visible`);
    expect(focus).toContain("outline:none");
    expect(focus).toContain("box-shadow:none");
    expect(focus).toContain(`--ada-close-face:${TEXT_TOKENS.label}`);
    expect(focus).toContain(`--ada-close-ink:${TEXT_TOKENS.buttonLabel}`);
    const face = rule(`${close}::after`);
    expect(face).toContain(`width:var(--ada-close-face-size,${units(CARD_CLOSE.art.width)})`);
    expect(face).toContain(`height:var(--ada-close-face-size,${units(CARD_CLOSE.art.height)})`);
    expect(face).toContain("background:var(--ada-close-face,var(--ada-close-rest,transparent))");
    expect(rule(`${close}:focus-visible:not(:active)::before`)).toContain(
      "mask:url('/art/ui/sprites/ui-close.png')",
    );
    expect(rule(`${close}:active::before`)).toContain(
      `background-position:${units(-CARD_CLOSE.art.width)} 0`,
    );
    expect(MODAL_STYLE).toContain("--ada-close-face:Highlight");
    expect(MODAL_STYLE).toContain("--ada-close-ink:HighlightText");
    expect(mapCloseStyle(".map-close", "#262b44")).toContain("--ada-close-rest:#262b44");
    expect(mapCloseStyle(".map-close")).toContain("--ada-close-rest:transparent");
    expect(mapCloseStyle(".map-close")).toContain(
      `--ada-close-face-size:${units(HUD_BUTTON.disc)}`,
    );
    expect(mapCloseStyle(".map-close")).toContain("--ada-close-rest:ButtonFace");
    expect(mapCloseStyle(".map-close")).toContain("var(--ada-close-ink,ButtonText)");
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
    // The retained parent paints no dim of its own, so only the child's dim covers the view.
    expect(underlay).toContain("background:transparent");
    expect(rule(`${UI_SCOPE} .ada-modal`)).toContain("background:#101926b3");
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
