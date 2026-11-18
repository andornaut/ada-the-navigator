import { describe, expect, it } from "vitest";

import { CARD_WIDTH_CAPS } from "./contentCard.ts";
import { settingsColumns, settingsTitleInkTop } from "./settings.ts";

const context = { availableWidth: 688 };

describe("Settings compact width", () => {
  it("aligns visible icon ink to the title using its loaded font metrics", () => {
    expect(settingsTitleInkTop({ ascent: 15, descent: 5, inkAscent: 11, lineHeight: 20 })).toBe(8);
    expect(settingsTitleInkTop({ ascent: 18, descent: 6, inkAscent: 12, lineHeight: 24 })).toBe(10);
  });
  it("uses two columns without waiting for a single column to overflow", () => {
    expect(settingsColumns(context, [190, 200])).toEqual({ columns: 2, minimumWidth: 497 });
    expect(settingsColumns(context, [290])).toEqual({ columns: 2, minimumWidth: 677 });
    expect(settingsColumns(context, [290]).minimumWidth).toBeLessThan(CARD_WIDTH_CAPS.large);
  });
  it("keeps a single readable column when labels cannot fit inside the actual available width", () => {
    expect(settingsColumns({ availableWidth: 450 }, [200])).toEqual({
      columns: 1,
      minimumWidth: 0,
    });
    expect(settingsColumns({ availableWidth: 900 }, [310])).toEqual({
      columns: 1,
      minimumWidth: 0,
    });
    expect(settingsColumns(context, [])).toEqual({ columns: 1, minimumWidth: 0 });
  });
});
