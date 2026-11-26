import { describe, expect, it } from "vitest";

import { scanFeedbackTop } from "./scanFeedback.ts";

const center = 360;
const gap = 4;
const top = 8;
const notice = { height: 32, width: 144 };
const disc = { height: 33, width: 33, x: 392, y: 16 };
const ammo = { height: 14, width: 48, x: 384.5, y: 50.5 };

describe("top-centre flight notice slot", () => {
  it("uses the high slot when the full label fits between the actual HUD faces", () => {
    expect(scanFeedbackTop([disc, ammo], gap, center, { ...notice, width: 48 }, top)).toBe(top);
  });

  it("passes below the ammo pill even where its wider face is the only overlap", () => {
    expect(scanFeedbackTop([disc, ammo], gap, center, { ...notice, width: 40 }, 24)).toBe(24);
    expect(scanFeedbackTop([disc, ammo], gap, center, { ...notice, width: 50 }, 24)).toBe(69);
  });

  it("keeps moving below overlapping controls while honoring the minimum set by the boss or scan", () => {
    expect(scanFeedbackTop([disc, ammo], gap, center, notice, top)).toBe(69);
    expect(scanFeedbackTop([disc, ammo], gap, center, notice, 97)).toBe(97);
  });
});
