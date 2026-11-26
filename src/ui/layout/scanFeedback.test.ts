import { describe, expect, it } from "vitest";

import { shortNoticeWidth } from "./scanFeedback.ts";

const slot = { bottom: 310, center: 360, gap: 4, top: 180 };
const move = { height: 76, width: 76, x: 35, y: 240 };
const use = { height: 42, width: 52, x: 530.5, y: 202 };

describe("lower flight notice column", () => {
  it("centers the available width between actual lower controls", () => {
    expect(shortNoticeWidth([move], slot)).toBe(490);
    expect(shortNoticeWidth([move, use], slot)).toBe(333);
  });

  it("ignores hidden controls and the top HUD", () => {
    expect(
      shortNoticeWidth(
        [
          { ...move, y: 0 },
          { ...use, height: 0 },
        ],
        slot,
      ),
    ).toBe(720);
  });
});
