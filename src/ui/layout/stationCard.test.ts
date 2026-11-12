import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CAST, castSheet } from "../../data/cast.ts";
import { GALAXY_ID } from "../../data/galaxies.ts";
import { KEEPERS } from "../../data/keepers.ts";
import { PROTOTYPE } from "../../data/prototype.ts";
import type { SectorId } from "../../data/types.ts";
import { lineCount, measure } from "../../testing/text-metrics.ts";
import { CONVERSATION_BOX } from "./conversationBox.ts";
import { type Insets, NO_INSETS, SAFE_MARGIN, safeRect, type Size } from "./playView.ts";
import { KEEPER_BLOCK, keeperPips, stationCardHeight, stationCardRect } from "./stationCard.ts";
import { TYPE } from "./tokens.ts";

// art/layout.md "Station card" and art/station.md "Keepers", value for value.
const STATION = readFileSync(new URL("../../../art/station.md", import.meta.url), "utf8");
const PHONE: Insets = { bottom: 19, left: 43, right: 43, top: 0 };

const VIEWS: readonly {
  readonly available: string;
  readonly insets: Insets;
  readonly name: string;
  readonly top: number;
  readonly view: Size;
}[] = [
  {
    available: "688x328",
    insets: NO_INSETS,
    name: "720x360",
    top: 66,
    view: { height: 360, width: 720 },
  },
  {
    available: "634x325",
    insets: PHONE,
    name: "720x360, phone insets",
    top: 64.5,
    view: { height: 360, width: 720 },
  },
  {
    available: "693.08x325",
    insets: PHONE,
    name: "844x390, insets 43",
    top: 64.5,
    view: { height: 360, width: (844 * 360) / 390 },
  },
  {
    available: "688x373",
    insets: NO_INSETS,
    name: "1280x720 (720x405)",
    top: 88.5,
    view: { height: 405, width: 720 },
  },
];

// Every line a keeper shows: each galaxy's greetings and Cartwheel's hub's.
const GREETINGS = Object.values(KEEPERS).flatMap(({ greetings, hub }) =>
  hub ? [greetings, hub] : [greetings],
);
const fits = (line: string, width: number) =>
  lineCount(line, TYPE.body.size, "regular", () => width) <= CONVERSATION_BOX.lines;

describe("station card", () => {
  it("stacks the header, balance, keeper block and action row 228 high", () => {
    expect(stationCardHeight()).toBe(58 + 20 + 8 + 10 + 60 + 8 + 48 + 16);
    expect(stationCardHeight()).toBe(228);
  });

  it("is 512 by 228 at every view, centred in the page rect at Art's tops, never scrolling", () => {
    for (const { available, insets, name, top, view } of VIEWS) {
      const page = safeRect(insets, SAFE_MARGIN.page, view);
      expect(`${Math.round(page.width * 100) / 100}x${page.height}`, name).toBe(available);
      const card = stationCardRect(insets, view);
      expect([card.width, card.height, card.y], name).toEqual([512, 228, top]);
      expect(card.height, name).toBeLessThanOrEqual(page.height);
    }
  });
});

describe("keeper block", () => {
  it("is the conversation box's panel, its text column 408, or 374 beside the pips", () => {
    expect([KEEPER_BLOCK.width, KEEPER_BLOCK.height]).toEqual([480, 60]);
    expect(KEEPER_BLOCK.text).toMatchObject({ width: 408, x: 8, y: 4 });
    expect(KEEPER_BLOCK.textWithPips).toBe(374);
    expect(KEEPER_BLOCK.pips).toMatchObject({ count: 3, disc: 6, gap: 4, offset: 8, width: 26 });
  });

  it("sets the pips a gap after the text column, centred on its last line", () => {
    // One line sits centred on the panel, two from 10.
    expect(keeperPips(1)).toEqual({ x: 390, y: 27 });
    expect(keeperPips(2)).toEqual({ x: 390, y: 37 });
    expect(keeperPips(1).x + KEEPER_BLOCK.pips.width).toBe(
      KEEPER_BLOCK.text.x + KEEPER_BLOCK.text.width,
    );
  });

  it("fits all eighteen first-docking lines in two lines at 374, later ones at 408", () => {
    const first = GREETINGS.flatMap(({ first }) => first);
    expect(first).toHaveLength(18);
    for (const line of first) {
      expect(fits(line, KEEPER_BLOCK.textWithPips), line).toBe(true);
    }
    for (const line of GREETINGS.flatMap(({ later }) => later)) {
      expect(fits(line, KEEPER_BLOCK.text.width), line).toBe(true);
    }
    // Art's widest, which wraps to two.
    const widest = "We Avi stand still a long time before we move. It is how we see clearly.";
    expect(measure(widest, TYPE.body.size, "regular")).toBeGreaterThan(KEEPER_BLOCK.textWithPips);
    expect(lineCount(widest, TYPE.body.size, "regular", () => KEEPER_BLOCK.textWithPips)).toBe(2);
    // Phantom's generic welcome, a gap inside each side.
    const generic = KEEPER_BLOCK.width - 2 * KEEPER_BLOCK.genericInset;
    expect(fits(PROTOTYPE.labels.stationWelcome ?? "", generic)).toBe(true);
  });

  it("shows each keeper's compact portrait and tab colour as Art keys them", () => {
    const rows = [
      ...STATION.matchAll(/^\| (\w+) +\| (\w+) +\| `([a-z]+)` +\| `(#[0-9a-f]{6})` +\|/gmu),
    ];
    expect(rows).toHaveLength(15);
    for (const [sector, { keepers }] of Object.entries(KEEPERS)) {
      const galaxy = GALAXY_ID[Number(sector) as SectorId];
      const own = rows.filter(([, name]) => name!.toLowerCase() === galaxy);
      expect(own.map(([, , , key]) => key)).toEqual(keepers);
      for (const [, , name, key, tab] of own) {
        const member = CAST[key as (typeof keepers)[number]];
        expect(member).toMatchObject({ name, tab });
        expect(castSheet(key as (typeof keepers)[number], true)).toBe(
          `/art/${galaxy}/portraits/${key}-compact.png`,
        );
      }
    }
    expect(KEEPERS[6]).toBeUndefined();
  });
});
