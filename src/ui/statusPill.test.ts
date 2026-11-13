import { existsSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { fromHudEdge, pixels, units } from "./layout/css.ts";
import { countSlot, SHIELD_PILL, STATUS_PILL } from "./layout/playView.ts";
import { shieldRasterGeometry } from "./layout/shieldGeometry.ts";
import {
  blendHex,
  CARGO_ICONS,
  createStatusPill,
  pillCount,
  ShieldBar,
  shieldMarkColour,
  ShieldOreSpendCounter,
  stardustCount,
  STATUS_COLOURS,
  STATUS_PILL_STYLE,
  STATUS_TIMING,
  statusSegments,
} from "./statusPill.ts";

const full = {
  capacity: 100,
  level: 1,
  rechargeDelay: 30,
  recharging: false,
  shield: 100,
  sinceDamage: 30,
};

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
      [1, 156, 120],
      [2, 216, 180],
      [3, 276, 240],
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

  it("fills the recharge-delay strip while the delay runs, hidden when full or regenerating", () => {
    const fraction = (change: Partial<typeof full>) =>
      new ShieldBar().update({ ...full, ...change }, 0, false).recharge;
    // Damage empties it; it fills with the time since, full as recharge starts.
    expect(fraction({ shield: 60, sinceDamage: 0 })).toBe(0);
    expect(fraction({ shield: 60, sinceDamage: 12 })).toBeCloseTo(0.4, 9);
    expect(fraction({ shield: 60, sinceDamage: 30 })).toBe(1);
    expect(fraction({ shield: 0, sinceDamage: 15 })).toBeCloseTo(0.5, 9);
    // Hidden while the shield is full or regenerating, with or without reduced motion.
    expect(fraction({})).toBeNull();
    expect(fraction({ recharging: true, shield: 60, sinceDamage: 31 })).toBeNull();
    expect(
      new ShieldBar().update({ ...full, shield: 60, sinceDamage: 12 }, 0, true).recharge,
    ).toBeCloseTo(0.4, 9);
    expect(STATUS_COLOURS.recharge).toBe("#ead4aa");
  });

  it("resets the same recharge timer on damage without changing reduced-motion progress", () => {
    const bar = new ShieldBar();
    expect(bar.update({ ...full, shield: 60, sinceDamage: 15 }, 0, true).recharge).toBe(0.5);
    expect(bar.update({ ...full, shield: 50, sinceDamage: 0 }, 16, true).recharge).toBe(0);
    expect(bar.update({ ...full, shield: 50, sinceDamage: 30 }, 30_016, true).recharge).toBe(1);
    expect(
      bar.update({ ...full, recharging: true, shield: 51, sinceDamage: 31 }, 31_016, true).recharge,
    ).toBeNull();
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
      lowPanel: "#532e35",
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
    expect(bar).toContain(`0 0 0 ${units(SHIELD_PILL.bar.rim)} #181425`);
    expect(bar).toContain("var(--shield-rim)");
  });

  it("puts each +N tick under its count, centred across on it, ore's in light rust", () => {
    const rule = (selector: string) =>
      STATUS_PILL_STYLE.split("}").find((part) => part.includes(`${selector}{`));
    const tick = rule(".ada-status-tick");
    // 27 below the count's line box top: HUD rect top + 33.5.
    expect(tick).toContain("left:50%");
    expect(tick).toContain("transform:translateX(-50%)");
    expect(tick).toContain(`top:${units(27)}`);
    expect(rule(".ada-status-tick[data-kind=ore]")).toContain("color:#eaa676");
  });

  it("draws the shield pill as an ink PILL at the bottom centre, apart from the status pill", () => {
    const shield = STATUS_PILL_STYLE.split("}").find((part) => part.includes(".ada-shield{"));
    // Its width follows Shield level (the pill and bar vars), centred: 156 at level 1.
    expect(shield).toContain("width:var(--shield-pill)");
    expect(shield).toContain(`--shield-pill:${units(156)}`);
    expect(shield).toContain(`padding:0 ${units(8)} 0 ${units(5)}`);
    expect(shield).toContain(`height:${units(28)}`);
    expect(shield).toContain("margin-left:calc(var(--shield-pill) / -2)");
    expect(shield).toContain("background:transparent");
    expect(shield).toContain("pointer-events:none");
    expect(shield).toContain(`bottom:${fromHudEdge("top", STATUS_PILL.y)}`);
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
  class FakeNode extends EventTarget {
    readonly attributes = new Map<string, string>();
    children: FakeNode[] = [];
    className = "";
    readonly classList = { add: vi.fn() };
    data = "";
    readonly dataset: Record<string, string> = {};
    hidden = false;
    readonly style = { setProperty: vi.fn() } as Record<string, unknown>;
    textContent = "";
    parent?: FakeNode;
    readonly animations: { finish: () => void; frames: unknown; options: unknown }[] = [];
    getBoundingClientRect() {
      return { x: 0, y: 0 };
    }
    animate(frames?: unknown, options?: unknown): { cancel: () => void; finished: Promise<void> } {
      let finish!: () => void;
      const finished = new Promise<void>((resolve) => {
        finish = resolve;
      });
      this.animations.push({ finish, frames, options });
      return { cancel: vi.fn(), finished };
    }
    append(...nodes: FakeNode[]): void {
      for (const node of nodes) {
        node.parent = this;
      }
      this.children.push(...nodes);
    }
    remove(): void {
      if (this.parent) {
        this.parent.children = this.parent.children.filter((node) => node !== this);
      }
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
  const pill = (
    reducedMotion = true,
    onResource?: (kind: "ore" | "stardust" | "aboard", origin: HTMLElement) => void,
  ) => {
    vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
    vi.stubGlobal("document", {
      createElement: () => new FakeNode(),
      createElementNS: () => new FakeNode(),
      createTextNode: () => new FakeNode(),
    });
    const parent = new FakeNode();
    const status = createStatusPill(parent as unknown as HTMLElement, {
      ...(onResource ? { onResource } : {}),
      reducedMotion: () => reducedMotion,
      shieldLabel: "Shield",
    });
    const root = parent.children[0]!;
    const slot = (kind: string) =>
      root.children.find((node) => node.className.includes(`ada-status-${kind}-slot`))!;
    const count = (kind: string) => slot(kind).children[0]!;
    return { count, root, shield: parent.children[1]!, slot, status };
  };

  it("paints one complete pill in every shield state and keeps the empty track dark", () => {
    const { shield, status } = pill();
    const drawing = shield.children.at(-1)!;
    const part = (name: string) =>
      drawing.children.find((node) => node.getAttribute("data-part") === name)!;
    const view = {
      ...full,
      aboard: null,
      lightField: false,
      ore: 0,
      oreLabel: "Ore",
      sinceDamage: 15,
      stardust: 0,
      stardustLabel: "Stardust",
    };
    for (const [remaining, background] of [
      [60, STATUS_COLOURS.panel],
      [10, STATUS_COLOURS.lowPanel],
      [0, STATUS_COLOURS.lowPanel],
    ] as const) {
      status.setStatus({ ...view, shield: remaining }, 1000);
      expect(part("pill").getAttribute("fill")).toBe(background);
      expect(part("pill").getAttribute("height")).toBe("28");
      expect(part("pill").getAttribute("width")).toBe("156");
      expect(part("shared-background").getAttribute("fill")).toBe(STATUS_COLOURS.rechargeEdge);
      expect(part("shared-background").getAttribute("height")).toBe("16");
      expect(
        drawing.children.some(
          (node) =>
            node.getAttribute("data-part") === "main-track" ||
            node.getAttribute("data-part") === "timer-track",
        ),
      ).toBe(false);
      expect(drawing.children.filter((node) => node.getAttribute("width") === "156")).toEqual([
        part("pill"),
      ]);
      expect(part("timer-fill").getAttribute("fill")).toBe(STATUS_COLOURS.recharge);
    }
    status.setStatus({ ...view, shield: 60, sinceDamage: 0 }, 2000);
    expect(part("timer-fill").getAttribute("width")).toBe("0");
    expect(part("timer-border").getAttribute("d")).not.toBe("");
    status.setStatus({ ...view, shield: 60, sinceDamage: 30 }, 2500);
    expect(part("timer-fill").getAttribute("x")).toBe("28");
    expect(part("timer-fill").getAttribute("width")).toBe("120");
    expect(part("timer-fill").getAttribute("data-capacity-end")).toBe("148");
    expect(part("fill").getAttribute("data-capacity-start")).toBe("30");
    expect(part("fill").getAttribute("data-capacity-end")).toBe("146");
    status.setStatus({ ...view, shield: 100 }, 3000);
    expect(part("timer-border").getAttribute("d")).toBe("");
    status.setStatus({ ...view, recharging: true, shield: 61 }, 4000);
    expect(part("timer-border").getAttribute("d")).toBe("");
  });

  it.each([false, true])(
    "keeps the unfilled track clear after hits with reduced motion %s",
    (reduced) => {
      const { shield, status } = pill(reduced);
      const view = {
        ...full,
        aboard: null,
        lightField: false,
        ore: 0,
        oreLabel: "Ore",
        stardust: 0,
        stardustLabel: "0 Stardust",
      };
      status.setStatus(view, 0);
      for (const remaining of [60, 10, 0]) {
        status.setStatus({ ...view, shield: remaining }, 1000 + remaining);
        const meter = shield.children[1]!;
        const [fill, delay, flash] = meter.children;
        expect(fill!.style.width).toBe(units((116 * remaining) / view.capacity));
        expect(fill!.hidden).toBe(remaining === 0);
        expect(delay!.hidden).toBe(true);
        expect(flash!.hidden).toBe(true);
        expect(meter.getAttribute("aria-valuenow")).toBe(String(remaining));
      }
      status.setStatus({ ...view, recharging: true, shield: 11 }, 2000);
      const [fill, delay, flash, edge] = shield.children[1]!.children;
      expect(fill!.style.width).toBe(units((116 * 11) / view.capacity));
      expect(delay!.hidden).toBe(true);
      expect(flash!.hidden).toBe(true);
      expect(edge!.hidden).toBe(false);
    },
  );

  it.each([1, 2, 3])(
    "renders a separate level %i timer track, including an empty track after damage",
    (level) => {
      const { shield, status } = pill();
      const view = {
        ...full,
        aboard: null,
        level,
        lightField: false,
        ore: 0,
        oreLabel: "Ore",
        shield: 60,
        shieldOreSpent: 0,
        sinceDamage: 15,
        stardust: 0,
        stardustLabel: "Stardust",
      };
      const meter = shield.children[1]!;
      const track = shield.children.find((node) => node.className === "ada-status-recharge-track")!;
      expect(meter.children).not.toContain(track);
      const fill = track.children[0]!;
      status.setStatus(view, 0);
      expect(track.hidden).toBe(false);
      const g = shieldRasterGeometry(1, 1, { x: 0, y: 0 }, level);
      expect(track.style.top).toBe(pixels(g.timer.y - g.edge));
      expect(track.style.left).toBe(pixels(g.timer.x - g.edge));
      expect(track.style.width).toBe(pixels(g.timer.width + 2 * g.edge));
      expect(track.style.height).toBe(pixels(g.timer.height + 2 * g.edge));
      expect(fill.style.width).toBe(pixels(g.timer.width * 0.5));
      status.setStatus({ ...view, sinceDamage: 0 }, 16);
      expect(track.hidden).toBe(false);
      expect(fill.style.width).toBe(pixels(0));
      status.setStatus({ ...view, shield: 100 }, 32);
      expect(track.hidden).toBe(true);
      status.setStatus({ ...view, recharging: true }, 48);
      expect(track.hidden).toBe(true);
    },
  );

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
      rechargeDelay: 30,
      recharging: false,
      shield: 100,
      sinceDamage: 30,
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

  it.each([false, true])(
    "shows every paid batch and final remainder exactly once with reduced motion %s",
    async (reduced) => {
      for (const remainder of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
        for (const end of ["full", "exhausted", "interrupted"] as const) {
          const { slot, status } = pill(reduced);
          const view = {
            ...full,
            aboard: null,
            lightField: false,
            ore: 100,
            oreLabel: "Ore",
            recharging: true,
            shield: 50,
            shieldOreSpent: 0,
            stardust: 0,
            stardustLabel: "0 Stardust",
          };
          const tick = () =>
            slot("ore").children.find((node) => node.className === "ada-status-tick");
          status.setStatus(view, 0);
          for (const total of [10, 20, 30]) {
            status.setStatus({ ...view, ore: 100 - total, shieldOreSpent: total }, total);
          }
          const total = 30 + remainder;
          const ended = {
            ...view,
            ore: end === "exhausted" ? 0 : 100 - total,
            recharging: false,
            shield: end === "full" ? view.capacity : 50,
            shieldOreSpent: total,
            sinceDamage: end === "interrupted" ? 0 : view.sinceDamage,
          };
          status.setStatus(ended, 40);
          status.setStatus(ended, 41);
          const shown: string[] = [];
          for (let n = 0; tick() && n < 10; n++) {
            const node = tick()!;
            shown.push(node.textContent);
            node.animations[0]!.finish();
            // Each animation schedules the next queued debit in a microtask.
            // eslint-disable-next-line no-await-in-loop
            await Promise.resolve();
          }
          expect(shown).toEqual(["-10", "-10", "-10", `-${remainder}`]);
          expect(shown.reduce((sum, value) => sum - Number(value), 0)).toBe(total);
          expect(tick()).toBeUndefined();
          status.setStatus(ended, 42);
          expect(tick()).toBeUndefined();
          status.setStatus({ ...ended, recharging: true, shield: 50 }, 43);
          status.setStatus({ ...ended, recharging: false, shieldOreSpent: total + 3 }, 44);
          expect(tick()!.textContent).toBe("-3");
          status.resetShieldOreSpent(500);
          status.setStatus({ ...ended, shieldOreSpent: 500 }, 45);
          expect(tick()).toBeUndefined();
          status.dispose();
        }
      }
    },
  );

  it("clears queued paid batches when a different flight total is loaded", async () => {
    const { slot, status } = pill();
    const view = {
      ...full,
      aboard: null,
      lightField: false,
      ore: 100,
      oreLabel: "Ore",
      recharging: true,
      shield: 50,
      shieldOreSpent: 0,
      stardust: 0,
      stardustLabel: "Stardust",
    };
    const tick = () => slot("ore").children.find((node) => node.className === "ada-status-tick");
    status.setStatus(view, 0);
    status.setStatus({ ...view, ore: 63, recharging: false, shieldOreSpent: 37 }, 16);
    const first = tick()!;
    expect(first.textContent).toBe("-10");
    status.resetShieldOreSpent(503);
    status.setStatus({ ...view, ore: 63, shieldOreSpent: 503 }, 32);
    first.animations[0]!.finish();
    await Promise.resolve();
    expect(tick()).toBeUndefined();
    status.setStatus({ ...view, ore: 61, recharging: false, shieldOreSpent: 505 }, 48);
    expect(tick()!.textContent).toBe("-2");
    status.dispose();
  });

  it.each([false, true])(
    "ticks only explicit paid ore, including the last ore, with reduced motion %s",
    (reduced) => {
      const { count, shield, slot, status } = pill(reduced);
      const view = {
        ...full,
        aboard: null,
        lightField: false,
        ore: 20,
        oreLabel: "Ore",
        shieldOreSpent: 90,
        stardust: 0,
        stardustLabel: "0 Stardust",
      };
      const tick = () => slot("ore").children.find((node) => node.className === "ada-status-tick");
      status.setStatus(view, 0);
      expect(tick()).toBeUndefined();
      // Deposits and a depletion penalty lower cargo without a paid-recharge total change.
      status.setStatus({ ...view, ore: 10 }, 16);
      status.setStatus({ ...view, ore: 1, shield: 0 }, 32);
      expect(tick()).toBeUndefined();
      expect(shield.dataset.tone).toBe("empty");
      status.setStatus({ ...view, ore: 0, shieldOreSpent: 100 }, 48);
      expect(tick()!.textContent).toBe("-10");
      expect(slot("ore").hidden).toBe(false);
      expect(count("ore").children[0]!.data).toBe("0");
      expect(count("ore").animations).toHaveLength(0);
      const animation = tick()!.animations[0]!;
      const timing = reduced ? STATUS_TIMING.tickReduced : STATUS_TIMING.tick;
      expect(animation.options).toEqual({
        duration: timing.holdMs + timing.fadeMs,
        fill: "forwards",
      });
      expect(animation.frames).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            offset: 1,
            translate: reduced ? "0 0px" : `0 ${units(-STATUS_PILL.tick.rise)}`,
          }),
        ]),
      );
      // Loading another cumulative total is a baseline, not a debit animation.
      status.resetShieldOreSpent(500);
      status.setStatus({ ...view, ore: 0, shieldOreSpent: 500 }, 64);
      expect(tick()).toBeUndefined();
      expect(slot("ore").hidden).toBe(false);
    },
  );

  it.each([
    null,
    { kind: "carrying", label: "Carrying: Spare parts" },
    { kind: "towing", label: "Towing: Craft" },
  ] as const)(
    "keeps resource counters visible without pickup feedback while aboard is %j",
    (aboard) => {
      const { count, slot, status } = pill();
      for (const [time, amount] of [
        [0, 0],
        [16, 5],
        [10_000, 5],
        [20_000, 0],
      ] as const) {
        status.setStatus(
          {
            ...full,
            aboard,
            lightField: false,
            ore: amount,
            oreLabel: "Ore",
            shieldOreSpent: 0,
            stardust: amount,
            stardustLabel: "Stardust",
          },
          time,
        );
        for (const kind of ["ore", "stardust"]) {
          expect(slot(kind).hidden).toBe(false);
          expect(count(kind).children[0]!.data).toBe(String(amount));
        }
      }
    },
  );

  it("keeps zero ore visible after the final debit animation finishes", async () => {
    const { count, slot, status } = pill();
    const view = {
      ...full,
      aboard: null,
      lightField: false,
      ore: 10,
      oreLabel: "Ore",
      shieldOreSpent: 0,
      stardust: 0,
      stardustLabel: "Stardust",
    };
    status.setStatus(view, 0);
    status.setStatus({ ...view, ore: 0, shieldOreSpent: 10 }, 16);
    const tick = slot("ore").children.find((node) => node.className === "ada-status-tick")!;
    tick.animations[0]!.finish();
    await Promise.resolve();
    status.setStatus({ ...view, ore: 0, shieldOreSpent: 10 }, 10_000);
    expect(slot("ore").children).not.toContain(tick);
    expect(slot("ore").hidden).toBe(false);
    expect(count("ore").children[0]!.data).toBe("0");
  });

  it("activates each resource once and consumes HUD pointer/key events", () => {
    const onResource = vi.fn();
    const { count, root, slot } = pill(true, onResource);
    for (const kind of ["ore", "stardust", "aboard"] as const) {
      const action = kind === "aboard" ? root.children.at(-1)! : count(kind);
      const target = kind === "aboard" ? action : slot(kind);
      expect(action.getAttribute("role")).toBe("button");
      expect(action.getAttribute("tabindex")).toBe("0");
      const pointer = new Event("pointerdown", { bubbles: true });
      target.dispatchEvent(pointer);
      const click = new Event("click", { bubbles: true });
      target.dispatchEvent(click);
      expect(onResource).toHaveBeenLastCalledWith(kind, action);
      const key = new Event("keydown", { cancelable: true });
      Object.defineProperties(key, { key: { value: "Enter" }, repeat: { value: false } });
      action.dispatchEvent(key);
      expect(key.defaultPrevented).toBe(true);
    }
    expect(onResource).toHaveBeenCalledTimes(6);
  });

  it("pads the pill 6 at each end, sets each count 4 from its icon and each divider 6 apart", () => {
    const style = (selector: string) =>
      STATUS_PILL_STYLE.split("}").find((part) => part.includes(`${selector}{`));
    expect(style(".ada-controls .ada-status")).toContain(`padding:0 ${units(6)}`);
    expect(style(".ada-status-stardust")).toContain(`margin-right:${units(4)}`);
    expect(style(".ada-status-ore")).toContain(`margin-right:${units(4)}`);
    expect(style(".ada-status-divider")).toContain(`margin:0 ${units(6)}`);
  });

  it.each([
    [9999, "+9999"],
    [44_449, "+44.4k"],
    [100_000, "+100k"],
    [10_000_000, "+10m"],
  ] as const)("ticks a gain of %d as %s under each count", (gain, text) => {
    const { slot, status } = pill();
    const view = (amount: number) => ({
      aboard: null,
      capacity: 100,
      level: 1,
      lightField: false,
      ore: amount + 1,
      oreLabel: "Ore",
      rechargeDelay: 30,
      recharging: false,
      shield: 100,
      sinceDamage: 30,
      stardust: amount,
      stardustLabel: `${amount} Stardust`,
    });
    status.setStatus(view(0), 0);
    status.setStatus(view(gain), 16);
    for (const kind of ["stardust", "ore"]) {
      const tick = slot(kind).children.find((node) => node.className === "ada-status-tick");
      expect(tick?.textContent).toBe(text);
      expect(tick?.getAttribute("aria-hidden")).toBe("true");
    }
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
      rechargeDelay: 30,
      recharging: false,
      shield: 100,
      sinceDamage: 30,
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

  it("always shows ore, then what Ada carries or tows", () => {
    expect(statusSegments({ aboard: null, ore: 0 })).toEqual(["ore"]);
    expect(statusSegments({ aboard: null, ore: 3 })).toEqual(["ore"]);
    expect(statusSegments({ aboard: carrying, ore: 0 })).toEqual(["ore", "aboard"]);
    expect(statusSegments({ aboard: carrying, ore: 3 })).toEqual(["ore", "aboard"]);
  });

  it("draw Art's 20 px cargo, ore and tow sprites", () => {
    for (const url of Object.values(CARGO_ICONS)) {
      expect(url).toMatch(/^\/art\/ui\/sprites\/icon-(cargo|ore|tow)-20\.png$/);
      expect(existsSync(new URL(`../../public${url}`, import.meta.url))).toBe(true);
    }
  });
});

describe("paid shield ore batches", () => {
  it("starts from the loaded total, emits each crossed paid batch once, and resets a new total", () => {
    const counter = new ShieldOreSpendCounter();
    expect(counter.update(29)).toBe(0);
    expect(counter.update(30)).toBe(0);
    expect(counter.update(30)).toBe(0);
    expect(counter.update(39)).toBe(10);
    expect(counter.update(60)).toBe(20);
    expect(counter.update(0)).toBe(0);
    expect(counter.update(9)).toBe(0);
    expect(counter.update(10)).toBe(10);
    counter.reset(200);
    expect(counter.update(200)).toBe(0);
    expect(counter.update(210)).toBe(10);
    expect(counter.update()).toBe(0);
    expect(counter.update(900)).toBe(0);
  });

  it("flushes only new paid ore after reload, interruptions and resumed batches", () => {
    const counter = new ShieldOreSpendCounter();
    counter.reset(29);
    expect(counter.update(29, false)).toBe(0);
    expect(counter.update(30, true)).toBe(0);
    expect(counter.update(30, false)).toBe(1);
    expect(counter.update(30, false)).toBe(0);
    expect(counter.update(39, true)).toBe(0);
    expect(counter.update(40, true)).toBe(10);
    expect(counter.update(47, false)).toBe(7);
    expect(counter.update(47, false)).toBe(0);
    expect(counter.update(57, true)).toBe(10);
    expect(counter.update(57, false)).toBe(0);
    counter.reset(500);
    expect(counter.update(500, false)).toBe(0);
    expect(counter.update(507, false)).toBe(7);
    expect(counter.update(507, false)).toBe(0);
  });

  it("rejects non-finite, fractional, negative and unsafe totals as baselines", () => {
    const counter = new ShieldOreSpendCounter();
    for (const total of [NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(counter.update(total)).toBe(0);
      expect(counter.update(100)).toBe(0);
    }
  });
});
