import { describe, expect, it } from "vitest";

import { GALAXY_SELECT_STYLE } from "./galaxy-select.ts";
import { slice } from "./layout/css.ts";
import { GALAXY_CARD } from "./layout/galaxySelectCard.ts";

describe("galaxy selector preview", () => {
  it("draws the 180 by 90 preview in a 1 px frame of whole CSS px, outside the image", () => {
    const start = GALAXY_SELECT_STYLE.indexOf(".ada-controls .ada-galaxy-shot{");
    const rule = GALAXY_SELECT_STYLE.slice(start, GALAXY_SELECT_STYLE.indexOf("}", start));
    expect(GALAXY_CARD.screenshot).toEqual({
      frame: 1,
      frameColor: "#181425",
      height: 90,
      width: 180,
    });
    expect(rule).toContain(`border:${slice(1)} solid #181425;`);
    expect(slice(1)).toBe("var(--ada-slice-1)");
    expect(rule).toContain("box-sizing:content-box;");
    expect(rule).toContain("image-rendering:pixelated");
  });
});
