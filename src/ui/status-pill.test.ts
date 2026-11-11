import { describe, expect, it } from "vitest";

import {
  blendHex,
  ShieldBar,
  shieldMarkColour,
  stardustCount,
  STATUS_COLOURS,
  STATUS_TIMING,
} from "./status-pill.ts";

const full = { capacity: 100, recharging: false, shield: 100 };

describe("status pill shield bar", () => {
  it("maps the current capacity to the 92 fill area, so a full bar has one length at every level", () => {
    expect(new ShieldBar().update(full, 0, false).fill).toBe(92);
    expect(new ShieldBar().update({ ...full, capacity: 140, shield: 140 }, 0, false).fill).toBe(92);
    expect(new ShieldBar().update({ ...full, shield: 50 }, 0, false).fill).toBe(46);
  });

  it("is normal at 25% or more, low above 0 and below 25%, and empty at 0", () => {
    expect(new ShieldBar().update({ ...full, shield: 25 }, 0, false).tone).toBe("normal");
    expect(new ShieldBar().update({ ...full, shield: 24.9 }, 0, false).tone).toBe("low");
    expect(new ShieldBar().update({ ...full, shield: 0 }, 0, false).tone).toBe("empty");
  });

  it("flashes a hit's lost part for 100 ms, then keeps it as the delay part", () => {
    const bar = new ShieldBar();
    bar.update(full, 0, false);
    const hit = bar.update({ ...full, shield: 80 }, 1000, false);
    expect(hit.flash).toEqual({ from: 73.6, to: 92 });
    expect(hit.delay).toEqual({ from: 73.6, to: 92 });
    expect(
      bar.update({ ...full, shield: 80 }, 1000 + STATUS_TIMING.flashMs, false).flash,
    ).toBeNull();
  });

  it("flashes at most once per 334 ms and keeps the delay mark at the value before the first hit", () => {
    const bar = new ShieldBar();
    bar.update(full, 0, false);
    bar.update({ ...full, shield: 80 }, 1000, false);
    const soon = bar.update({ ...full, shield: 60 }, 1200, false);
    expect(soon.flash).toBeNull();
    expect(soon.delay).toEqual({ from: 55.2, to: 92 });
    const later = bar.update({ ...full, shield: 50 }, 1000 + STATUS_TIMING.flashEveryMs, false);
    expect(later.flash).toEqual({ from: 46, to: 55.2 });
    expect(later.delay?.to).toBe(92);
  });

  it("joins a hit to the delay part at once under reduced motion", () => {
    const bar = new ShieldBar();
    bar.update(full, 0, true);
    const hit = bar.update({ ...full, shield: 80 }, 1000, true);
    expect(hit.flash).toBeNull();
    expect(hit.delay).toEqual({ from: 73.6, to: 92 });
  });

  it("clears the delay part when regeneration starts and draws the leading edge until capacity", () => {
    const bar = new ShieldBar();
    bar.update(full, 0, false);
    bar.update({ ...full, shield: 80 }, 1000, false);
    const regen = bar.update({ ...full, recharging: true, shield: 81 }, 4000, false);
    expect(regen.delay).toBeNull();
    expect(regen.edge).toBe(true);
    expect(bar.update(full, 6000, false).edge).toBe(false);
  });

  it("pulses icon and rim while low, holding the low colour under reduced motion", () => {
    const low = { ...full, shield: 10 };
    expect(new ShieldBar().update(low, 0, false).pulse).toBe(0);
    expect(new ShieldBar().update(low, STATUS_TIMING.pulseMs / 2, false).pulse).toBeCloseTo(1, 12);
    expect(new ShieldBar().update(low, STATUS_TIMING.pulseMs / 2, true).pulse).toBe(0);
    expect(shieldMarkColour("low", 0)).toBe(STATUS_COLOURS.low);
    expect(shieldMarkColour("low", 1)).toBe(STATUS_COLOURS.lowPeak);
    expect(shieldMarkColour("normal", 1)).toBe(STATUS_COLOURS.shield);
  });

  it("draws an empty track with the icon and rim low and no pulse, then refills at once", () => {
    const bar = new ShieldBar();
    bar.update({ ...full, shield: 10 }, 0, false);
    const empty = bar.update({ ...full, shield: 0 }, 500, false);
    expect(empty).toMatchObject({ delay: null, edge: false, fill: 0, flash: null, pulse: 0 });
    expect(shieldMarkColour(empty.tone, empty.pulse)).toBe(STATUS_COLOURS.low);
    const refill = bar.update(full, 600, false);
    expect(refill).toMatchObject({
      delay: null,
      edge: false,
      fill: 92,
      flash: null,
      tone: "normal",
    });
  });

  it("uses Art's status colours", () => {
    expect(STATUS_COLOURS).toMatchObject({
      count: "#ead4aa",
      divider: "#57536e",
      flash: "#ffffff",
      low: "#e4574e",
      lowPeak: "#ff8a80",
      rim: "#9a96ad",
      shield: "#70ace8",
      shieldDelay: "#4f7aa6",
      tick: "#8ee8a8",
      track: "#181425",
    });
    expect(blendHex("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});

describe("status pill count", () => {
  it("shows the count with thousands separators", () => {
    expect(stardustCount(0)).toBe("0");
    expect(stardustCount(125)).toBe("125");
    expect(stardustCount(12500)).toBe("12,500");
    expect(stardustCount(1234567)).toBe("1,234,567");
  });
});
