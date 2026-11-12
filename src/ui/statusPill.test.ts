import { existsSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { units } from "./layout/css.ts";
import { countSlot, STATUS_PILL } from "./layout/playView.ts";
import {
  blendHex,
  CARGO_ICONS,
  createStatusPill,
  pillCount,
  ShieldBar,
  shieldMarkColour,
  stardustCount,
  STATUS_COLOURS,
  STATUS_PILL_STYLE,
  STATUS_TIMING,
  statusSegments,
} from "./statusPill.ts";

const full = { capacity: 100, level: 1, recharging: false, shield: 100 };

describe("status pill shield bar", () => {
  it("maps the current capacity to the Shield level's fill area: 116, 176 or 236", () => {
    expect(new ShieldBar().update({ ...full, level: 1 }, 0, false).fill).toBe(116);
    expect(
      new ShieldBar().update({ ...full, capacity: 140, level: 2, shield: 140 }, 0, false).fill,
    ).toBe(176);
    expect(
      new ShieldBar().update({ ...full, capacity: 180, level: 3, shield: 180 }, 0, false).fill,
    ).toBe(236);
    expect(new ShieldBar().update({ ...full, shield: 50 }, 0, false).fill).toBe(58);
  });

  it("lengthens the pill and bar by Shield level through its data-level", () => {
    const style = (selector: string) =>
      STATUS_PILL_STYLE.split("}").find((part) => part.includes(`${selector}{`));
    for (const [level, pill, bar] of [
      [1, 162, 120],
      [2, 222, 180],
      [3, 282, 240],
    ] as const) {
      const rule = style(`.ada-shield[data-level="${level}"]`);
      expect(rule).toContain(`--shield-pill:${units(pill)}`);
      expect(rule).toContain(`--shield-bar:${units(bar)}`);
    }
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
    expect(hit.flash).toEqual({ from: 92.8, to: 116 });
    expect(hit.delay).toEqual({ from: 92.8, to: 116 });
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
    expect(soon.delay?.from).toBeCloseTo(69.6, 9);
    expect(soon.delay?.to).toBe(116);
    const later = bar.update({ ...full, shield: 50 }, 1000 + STATUS_TIMING.flashEveryMs, false);
    expect(later.flash?.from).toBe(58);
    expect(later.flash?.to).toBeCloseTo(69.6, 9);
    expect(later.delay?.to).toBe(116);
  });

  it("joins a hit to the delay part at once under reduced motion", () => {
    const bar = new ShieldBar();
    bar.update(full, 0, true);
    const hit = bar.update({ ...full, shield: 80 }, 1000, true);
    expect(hit.flash).toBeNull();
    expect(hit.delay).toEqual({ from: 92.8, to: 116 });
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
      fill: 116,
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
    // Its width follows Shield level (the pill and bar vars), centred: 162 at level 1.
    expect(shield).toContain("width:var(--shield-pill)");
    expect(shield).toContain(`--shield-pill:${units(162)}`);
    expect(shield).toContain(`height:${units(28)}`);
    expect(shield).toContain("margin-left:calc(var(--shield-pill) / -2)");
    expect(shield).toContain(`background:${STATUS_COLOURS.panel}`);
    expect(shield).toContain("pointer-events:none");
  });
});

describe("status pill count", () => {
  it("gives exact counts en-US grouped for labels, ticks and the Ship card", () => {
    expect(stardustCount(0)).toBe("0");
    expect(stardustCount(125)).toBe("125");
    expect(stardustCount(12500)).toBe("12,500");
    expect(stardustCount(1234567)).toBe("1,234,567");
  });

  it.each([
    [0, "0"],
    [9999, "9999"],
    [10_000, "10.0k"],
    [44_449, "44.4k"],
    [44_450, "44.5k"],
    [99_949, "99.9k"],
    [99_950, "100k"],
    [100_000, "100k"],
    [999_999, "1000k"],
    [9_999_499, "9999k"],
    [9_999_500, "10m"],
    [10_000_000, "10m"],
    [9_999_499_999, "9999m"],
    [1e12, "9999m"],
  ])("draws a pill count of %d as %s, in at most five characters", (amount, text) => {
    expect(pillCount(amount)).toBe(text);
    expect(text.length).toBeLessThanOrEqual(5);
  });

  it("draws a fractional count by its whole part and a negative or non-finite one as 0", () => {
    expect(pillCount(9999.9)).toBe("9999");
    expect(pillCount(-5)).toBe("0");
    expect(pillCount(Number.NaN)).toBe("0");
  });

  // A stand-in for the DOM members the pill uses.
  class FakeNode {
    readonly attributes = new Map<string, string>();
    children: FakeNode[] = [];
    className = "";
    data = "";
    readonly dataset: Record<string, string> = {};
    hidden = false;
    readonly style = { setProperty: vi.fn() } as Record<string, unknown>;
    textContent = "";
    append(...nodes: FakeNode[]): void {
      this.children.push(...nodes);
    }
    getAttribute(name: string): string | null {
      return this.attributes.get(name) ?? null;
    }
    removeAttribute(name: string): void {
      this.attributes.delete(name);
    }
    setAttribute(name: string, value: string): void {
      this.attributes.set(name, value);
    }
  }
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  const pill = () => {
    vi.stubGlobal("document", {
      createElement: () => new FakeNode(),
      createTextNode: () => new FakeNode(),
    });
    const parent = new FakeNode();
    const status = createStatusPill(parent as unknown as HTMLElement, {
      reducedMotion: () => true,
      shieldLabel: "Shield",
    });
    const root = parent.children[0]!;
    const slot = (kind: string) =>
      root.children.find((node) => node.className.includes(`ada-status-${kind}-slot`))!;
    const count = (kind: string) => slot(kind).children[0]!;
    return { count, slot, status };
  };

  it.each([
    [9999, "9999", "9,999"],
    [44_449, "44.4k", "44,449"],
    [999_999, "1000k", "999,999"],
    [10_000_000, "10m", "10,000,000"],
    [1_234_567_890, "1235m", "1,234,567,890"],
  ] as const)("draws %d as %s in five characters, its label exact", (amount, shown, exact) => {
    const { count, status } = pill();
    const view = {
      aboard: null,
      capacity: 100,
      level: 1,
      lightField: false,
      ore: amount,
      oreLabel: "Ore",
      recharging: false,
      shield: 100,
      stardust: amount,
      stardustLabel: `${exact} Stardust`,
    };
    status.setStatus(view, 0);
    for (const kind of ["stardust", "ore"]) {
      expect(count(kind).children[0]!.data).toBe(shown);
      expect(shown.length).toBeLessThanOrEqual(5);
    }
    expect(count("stardust").getAttribute("aria-label")).toBe(`${exact} Stardust`);
    expect(count("ore").getAttribute("aria-label")).toBe(exact);
  });

  it("pads the pill 6 at each end, sets each count 4 from its icon and each divider 6 apart", () => {
    const style = (selector: string) =>
      STATUS_PILL_STYLE.split("}").find((part) => part.includes(`${selector}{`));
    expect(style(".ada-controls .ada-status")).toContain(`padding:0 ${units(6)}`);
    expect(style(".ada-status-stardust")).toContain(`margin-right:${units(4)}`);
    expect(style(".ada-status-ore")).toContain(`margin-right:${units(4)}`);
    expect(style(".ada-status-divider")).toContain(`margin:0 ${units(6)}`);
  });

  it("sizes each count's slot to the count, at least one digit, in tabular figures", () => {
    const style = (selector: string) =>
      STATUS_PILL_STYLE.split("}").find((part) => part.includes(`${selector}{`));
    expect(style(".ada-status-slot")).toContain(`width:${units(STATUS_PILL.minCount)}`);
    expect(style(".ada-status-slot")).not.toContain("transition:");
    expect(style(".ada-status-count")).toContain("font-variant-numeric:tabular-nums");
    const view = (stardust: number) => ({
      aboard: null,
      capacity: 100,
      level: 1,
      lightField: false,
      ore: 0,
      oreLabel: "Ore",
      recharging: false,
      shield: 100,
      stardust,
      stardustLabel: `${stardust} Stardust`,
    });
    for (const [stardust, shown] of [
      [0, "0"],
      [42, "42"],
      [44_449, "44.4k"],
      [9_999_499, "9999k"],
    ] as const) {
      // A fresh pill each time, so no gain animates.
      const { slot, status } = pill();
      status.setStatus(view(stardust), 0);
      // The right edge snaps with the count: the slot's width changes in the same update.
      expect(slot("stardust").style.width).toBe(units(countSlot(shown)));
    }
    // A falling count narrows its slot at once, with no gain to animate.
    const { slot, status } = pill();
    status.setStatus(view(999_999_999), 0);
    status.setStatus(view(7), 16);
    expect(slot("stardust").style.width).toBe(units(countSlot("7")));
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
