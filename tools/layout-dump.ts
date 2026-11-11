/**
 * Deterministic dump of every computed UI layout result, as canonical JSON: every exported
 * constant of each src/ui/layout module, and every exported layout function over a fixed set
 * of viewports, safe-area insets and state variants. A layout refactor is behaviour-preserving
 * when the dump stays byte-identical to tools/layout-dump.json.
 *
 * Usage: node tools/layout-dump.ts > tools/layout-dump.json
 */
import { pathToFileURL } from "node:url";

import type { Rect } from "@andornaut/game-kit/rect";

import * as cardFrame from "../src/ui/layout/cardFrame.ts";
import * as contentCard from "../src/ui/layout/contentCard.ts";
import * as controls from "../src/ui/layout/controls.ts";
import * as css from "../src/ui/layout/css.ts";
import * as galaxySelectCard from "../src/ui/layout/galaxySelectCard.ts";
import * as hitAreas from "../src/ui/layout/hitAreas.ts";
import * as playView from "../src/ui/layout/playView.ts";
import * as shopCard from "../src/ui/layout/shopCard.ts";
import * as storyPage from "../src/ui/layout/storyPage.ts";
import * as tokens from "../src/ui/layout/tokens.ts";
import * as touchControls from "../src/ui/layout/touchControls.ts";
import * as viewScale from "../src/ui/layout/viewScale.ts";

/** Every src/ui/layout module by file name; the test checks this against the directory. */
export const LAYOUT_MODULES: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  "cardFrame.ts": cardFrame,
  "contentCard.ts": contentCard,
  "controls.ts": controls,
  "css.ts": css,
  "galaxySelectCard.ts": galaxySelectCard,
  "hitAreas.ts": hitAreas,
  "playView.ts": playView,
  "shopCard.ts": shopCard,
  "storyPage.ts": storyPage,
  "tokens.ts": tokens,
  "touchControls.ts": touchControls,
  "viewScale.ts": viewScale,
};

/**
 * Exported functions the dump does not call, by module, with the reason. Both need a live DOM;
 * the layout they apply is playLayout and viewProperties, which the dump covers.
 */
export const UNDUMPED_FUNCTIONS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "viewScale.ts": {
    createViewScaleBridge: "Measures and writes a live DOM host",
    readViewUnit: "Reads a live element's computed style",
  },
};

/** CSS display sizes: desktop, the base view, wide and narrow phones, portrait, fractional. */
export const VIEWPORTS: readonly playView.Size[] = [
  { height: 720, width: 1280 },
  { height: 360, width: 720 },
  { height: 400, width: 900 },
  { height: 390, width: 844 },
  { height: 844, width: 390 },
  { height: 375.25, width: 812.5 },
];

/** CSS px safe-area insets: none, and a notched phone held landscape and portrait. */
export const VIEWPORT_INSETS: Readonly<Record<string, playView.Insets>> = {
  none: playView.NO_INSETS,
  "phone landscape": { bottom: 21, left: 47, right: 47, top: 0 },
  "phone portrait": { bottom: 34, left: 0, right: 0, top: 47 },
};

const SIDES: readonly playView.Side[] = ["top", "right", "bottom", "left"];
const COUNTS = [0, 1, 2, 3, 4, 5] as const;

interface Case {
  readonly args: readonly unknown[];
  readonly result: unknown;
}
type Cases = Record<string, Record<string, Case[]>>;

/** Sorted keys at every depth; functions in constants become a marker, called separately. */
function canonical(value: unknown): unknown {
  if (typeof value === "function") {
    return "#function";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Non-finite layout value ${value}`);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (value && typeof value === "object") {
    const record = value as Readonly<Record<string, unknown>>;
    return Object.fromEntries(
      Object.keys(record)
        .filter((key) => record[key] !== undefined)
        .sort()
        .map((key) => [key, canonical(record[key])]),
    );
  }
  return value;
}

function recorder(cases: Cases) {
  return <A extends readonly unknown[], R>(
    module: string,
    name: string,
    fn: (...args: A) => R,
    ...args: A
  ): R => {
    const result = fn(...args);
    ((cases[module] ??= {})[name] ??= []).push({ args, result });
    return result;
  };
}

function viewportCases(call: ReturnType<typeof recorder>): void {
  for (const css of VIEWPORTS) {
    for (const insets of Object.values(VIEWPORT_INSETS)) {
      const s = call("playView.ts", "viewScale", playView.viewScale, css);
      const view = call("playView.ts", "logicalView", playView.logicalView, css);
      const logical = call("playView.ts", "safeInsets", playView.safeInsets, insets, s);
      const layout = call("viewScale.ts", "playLayout", viewScale.playLayout, css, insets);
      call("viewScale.ts", "viewProperties", viewScale.viewProperties, layout);
      for (const cleared of [playView.NO_INSETS, { ...playView.NO_INSETS, top: 20 }, insets]) {
        call("viewScale.ts", "uncoveredInsets", viewScale.uncoveredInsets, insets, cleared);
      }
      for (const margin of Object.values(playView.SAFE_MARGIN)) {
        call("playView.ts", "safeRect", playView.safeRect, logical, margin, view);
      }
      call("playView.ts", "playView", playView.playView, view);
      call("playView.ts", "hudRect", playView.hudRect, logical, view);
      call("touchControls.ts", "stickRestCentres", touchControls.stickRestCentres, view, logical);
      call("touchControls.ts", "stickTargets", touchControls.stickTargets, view, logical);
      // Cards and the shop fit the page safe rect's width.
      const available = playView.safeRect(logical, playView.SAFE_MARGIN.page, view).width;
      for (const groups of [[], [200], [400, 120], [900]]) {
        for (const title of [
          undefined,
          { close: true, width: 180 },
          { close: false, width: 300 },
        ]) {
          call("contentCard.ts", "cardWidth", contentCard.cardWidth, available, groups, title);
        }
      }
      for (const rowWidth of [180, 260, 320]) {
        call("shopCard.ts", "shopColumns", shopCard.shopColumns, available, rowWidth);
      }
    }
  }
}

function stateCases(call: ReturnType<typeof recorder>): void {
  // Count widths: none, "125", "12,500" and the widest the four-weapon clearance allows.
  for (const countWidth of [0, 26.7, 48.94, 162.25]) {
    call("playView.ts", "statusPillWidth", playView.statusPillWidth, countWidth);
  }
  for (const count of COUNTS) {
    call("playView.ts", "hudButtonTarget", playView.hudButtonTarget, count);
    call("playView.ts", "hudRowWidth", playView.hudRowWidth, count);
    for (const pill of [undefined, 0, 64]) {
      call("playView.ts", "noticeReserve", playView.noticeReserve, count, pill);
    }
  }
  const arts: readonly Rect[] = [
    { height: 8, width: 12, x: 0, y: 0 },
    { height: 24, width: 24, x: 6, y: 6 },
    { height: 33, width: 33, x: 0, y: 0 },
    { height: 35, width: 35, x: -1, y: -1 },
    { height: 20, width: 100, x: 10, y: 4 },
    { height: 80, width: 200, x: 0, y: 0 },
  ];
  for (const art of arts) {
    call("hitAreas.ts", "hitMargin", hitAreas.hitMargin, art);
    call("hitAreas.ts", "hitAround", hitAreas.hitAround, art);
  }
  const areas = [
    { art: arts[2]!, hit: hitAreas.hitAround(arts[2]!), key: "left" },
    { art: { ...arts[2]!, x: 40 }, hit: hitAreas.hitAround({ ...arts[2]!, x: 40 }), key: "right" },
  ];
  for (const point of [
    { x: 16, y: 16 },
    { x: 38, y: 16 },
    { x: 54, y: 16 },
    { x: 200, y: 200 },
  ]) {
    call("hitAreas.ts", "pressedArea", hitAreas.pressedArea, areas, point);
  }
  for (const close of [false, true]) {
    call("cardFrame.ts", "cardTitleReserve", cardFrame.cardTitleReserve, close);
    for (const firstInkTop of [undefined, 4, 6.5]) {
      for (const titleHeight of [undefined, 28, 56]) {
        call(
          "cardFrame.ts",
          "cardHeaderLayout",
          cardFrame.cardHeaderLayout,
          close,
          firstInkTop,
          titleHeight,
        );
      }
    }
  }
  for (const [inner, width] of [
    [300, 120],
    [400, 400],
    [512, 333],
  ] as const) {
    call("contentCard.ts", "groupX", contentCard.groupX, inner, width);
  }
  for (const label of [0, 40, 56, 120]) {
    call("contentCard.ts", "cardActionsSize", contentCard.cardActionsSize, label);
    for (const action of [32, 72]) {
      call("contentCard.ts", "rowWidth", contentCard.rowWidth, label, action);
    }
  }
  for (const axis of ["row", "stack"] as const) {
    for (const labels of [[], [40], [40, 90], [60, 60, 60]]) {
      call("contentCard.ts", "actionsWidth", contentCard.actionsWidth, axis, labels);
    }
  }
  for (const size of [...Object.values(shopCard.SHOP_ROW.glyph), 40, 48]) {
    call("shopCard.ts", "glyphOffset", shopCard.glyphOffset, size);
    call("shopCard.ts", "glyphOffset", shopCard.glyphOffset, size, shopCard.CONFIRM_ITEM.well);
  }
  for (const name of [40, 120]) {
    for (const slot of [48, 96]) {
      call("shopCard.ts", "shopRowWidth", shopCard.shopRowWidth, name, slot);
    }
  }
  for (const columns of [1, 2] as const) {
    for (const row of [180, 260]) {
      call("shopCard.ts", "shopListWidth", shopCard.shopListWidth, columns, row);
    }
  }
}

function cssCases(call: ReturnType<typeof recorder>): void {
  const lengths = [0, 1, 6.5, 8, 16, -12];
  for (const value of lengths) {
    call("css.ts", "units", css.units, value);
  }
  for (const side of SIDES) {
    call("css.ts", "viewProperty safe", css.VIEW_PROPERTIES.safe, side);
    for (const margin of Object.values(playView.SAFE_MARGIN)) {
      call("css.ts", "safeEdge", css.safeEdge, side, margin);
      for (const offset of [0, 12, -4]) {
        call("css.ts", "fromSafeEdge", css.fromSafeEdge, side, margin, offset);
      }
    }
  }
  for (const side of css.HUD_SIDES) {
    call("css.ts", "viewProperty hud", css.VIEW_PROPERTIES.hud, side);
    for (const offset of [undefined, 0, 8, -6]) {
      call("css.ts", "fromHudEdge", css.fromHudEdge, side, offset);
    }
  }
  for (const role of Object.values(tokens.TYPE)) {
    call("css.ts", "font", css.font, role);
  }
  for (const edge of controls.NINE_SLICE_EDGES) {
    call("css.ts", "slice", css.slice, edge);
    call("css.ts", "viewProperty slice", css.VIEW_PROPERTIES.slice, edge);
  }
  call("css.ts", "viewStyle", css.viewStyle, controls.NINE_SLICE_EDGES);
}

/** The dump: each module's constants, and every function case's arguments and result. */
export function layoutDump(): unknown {
  const cases: Cases = {};
  const call = recorder(cases);
  viewportCases(call);
  stateCases(call);
  cssCases(call);
  const constants = Object.fromEntries(
    Object.entries(LAYOUT_MODULES).map(([module, exports]) => [
      module,
      Object.fromEntries(
        Object.entries(exports).filter(([, value]) => typeof value !== "function"),
      ),
    ]),
  );
  return canonical({ constants, functions: cases, insets: VIEWPORT_INSETS, viewports: VIEWPORTS });
}

/** The dump as stable text: sorted keys, two-space indentation, a final newline. */
export function formatLayoutDump(): string {
  return `${JSON.stringify(layoutDump(), null, 2)}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(formatLayoutDump());
}
