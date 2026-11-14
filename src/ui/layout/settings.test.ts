import { describe, expect, it } from "vitest";

import { CARD_WIDTH_CAPS } from "./contentCard.ts";
import { settingsColumns } from "./settings.ts";

const context = { actionsWidth: 0, availableWidth: 608, landscape: true, overflowing: true };

describe("Settings compact width", () => {
  it("widens an overflowing landscape card only enough for both control columns", () => {
    const fitted = settingsColumns(context, [220, 230]);
    expect(fitted.columns).toBe(2);
    expect(fitted.minimumWidth).toBe(509);
    expect(fitted.minimumWidth).toBeLessThan(CARD_WIDTH_CAPS.medium);
  });

  it("reserves the shared footer pair inside the right column", () => {
    expect(settingsColumns({ ...context, actionsWidth: 270 }, [230])).toEqual({
      columns: 2,
      minimumWidth: 589,
    });
  });

  it("retains a fitted single column when its controls already fit", () => {
    expect(settingsColumns({ ...context, overflowing: false }, [230])).toEqual({
      columns: 1,
      minimumWidth: 0,
    });
  });

  it.each([
    [{ ...context, availableWidth: 499 }, 230],
    [{ ...context, availableWidth: 900 }, 310],
    [{ ...context, landscape: false }, 230],
  ] as const)(
    "retains scrolling when the controls cannot pair inside the available cap: %o",
    (view, rowWidth) => {
      expect(settingsColumns(view, [rowWidth])).toEqual({ columns: 1, minimumWidth: 0 });
    },
  );
});
