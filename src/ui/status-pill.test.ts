import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { units } from "./layout/css.ts";
import {
  blendHex,
  CARGO_ICONS,
  ShieldBar,
  shieldMarkColour,
  stardustCount,
  STATUS_COLOURS,
  STATUS_PILL_STYLE,
  STATUS_TIMING,
  statusSegments,
} from "./status-pill.ts";

const full = { capacity: 100, recharging: false, shield: 100 };

describe("status pill shield bar", () => {
  it("maps the current capacity to the 156 fill area, so a full bar has one length at every level", () => {
    expect(new ShieldBar().update(full, 0, false).fill).toBe(156);
    expect(new ShieldBar().update({ ...full, capacity: 140, shield: 140 }, 0, false).fill).toBe(
      156,
    );
    expect(new ShieldBar().update({ ...full, shield: 50 }, 0, false).fill).toBe(78);
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
    expect(hit.flash).toEqual({ from: 124.8, to: 156 });
    expect(hit.delay).toEqual({ from: 124.8, to: 156 });
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
    expect(soon.delay?.from).toBeCloseTo(93.6, 9);
    expect(soon.delay?.to).toBe(156);
    const later = bar.update({ ...full, shield: 50 }, 1000 + STATUS_TIMING.flashEveryMs, false);
    expect(later.flash?.from).toBe(78);
    expect(later.flash?.to).toBeCloseTo(93.6, 9);
    expect(later.delay?.to).toBe(156);
  });

  it("joins a hit to the delay part at once under reduced motion", () => {
    const bar = new ShieldBar();
    bar.update(full, 0, true);
    const hit = bar.update({ ...full, shield: 80 }, 1000, true);
    expect(hit.flash).toBeNull();
    expect(hit.delay).toEqual({ from: 124.8, to: 156 });
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
      fill: 156,
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
      oreTick: "#eaa676",
      rim: "#9a96ad",
      shield: "#70ace8",
      shieldDelay: "#4f7aa6",
      tick: "#f4d98a",
    });
    expect(blendHex("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it("draws the panel and the shield track as ink at 0.65, the track over the panel", () => {
    expect(STATUS_COLOURS.panel).toBe("rgb(24 20 37 / 0.65)");
    expect(STATUS_COLOURS.track).toBe("rgb(24 20 37 / 0.65)");
  });

  it("outlines the shield icon and bar in ink on a light field only", () => {
    const light = STATUS_PILL_STYLE.split("}").filter((rule) =>
      rule.includes("[data-field=light]"),
    );
    expect(light).toHaveLength(2);
    const [icon, bar] = light;
    expect(icon).toContain(".ada-shield[data-field=light] .ada-status-mark{");
    // Four chained 1 px shadows grow the icon mask by a square kernel.
    expect(icon!.match(/drop-shadow\(/g)).toHaveLength(4);
    expect(icon).toContain("#181425");
    expect(bar).toContain(".ada-shield[data-field=light] .ada-status-bar{");
    expect(bar).toMatch(/box-shadow:0 0 0 .+ #181425/);
  });

  it("puts each +N tick under its count, centred across on it, ore's in light rust", () => {
    const rule = (selector: string) =>
      STATUS_PILL_STYLE.split("}").find((part) => part.includes(`${selector}{`));
    const tick = rule(".ada-status-tick");
    // 30 below the count's line box top: HUD rect top + 36.5.
    expect(tick).toContain("left:50%");
    expect(tick).toContain("transform:translateX(-50%)");
    expect(tick).toContain(`top:${units(30)}`);
    expect(rule(".ada-status-tick[data-kind=ore]")).toContain("color:#eaa676");
  });

  it("draws the shield pill as an ink PILL at the bottom centre, apart from the status pill", () => {
    const shield = STATUS_PILL_STYLE.split("}").find((part) => part.includes(".ada-shield{"));
    expect(shield).toContain(`width:${units(202)}`);
    expect(shield).toContain(`height:${units(28)}`);
    expect(shield).toContain(`margin-left:${units(-101)}`);
    expect(shield).toContain(`background:${STATUS_COLOURS.panel}`);
    expect(shield).toContain("pointer-events:none");
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

describe("status pill cargo segments", () => {
  const carrying = { kind: "carrying", label: "Carrying: Spare parts" } as const;

  it("show ore while Ada holds some, then what she carries or tows, ore first", () => {
    expect(statusSegments({ aboard: null, ore: 0 })).toEqual([]);
    expect(statusSegments({ aboard: null, ore: 3 })).toEqual(["ore"]);
    expect(statusSegments({ aboard: carrying, ore: 0 })).toEqual(["aboard"]);
    expect(statusSegments({ aboard: carrying, ore: 3 })).toEqual(["ore", "aboard"]);
  });

  it("draw Art's 20 px cargo, ore and tow sprites", () => {
    for (const url of Object.values(CARGO_ICONS)) {
      expect(url).toMatch(/^\/art\/ui\/sprites\/icon-(cargo|ore|tow)-20\.png$/);
      expect(existsSync(new URL(`../../public${url}`, import.meta.url))).toBe(true);
    }
  });
});
