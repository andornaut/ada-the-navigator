import { afterEach, describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { tierColour, UPGRADE_TIER_COLOURS } from "../data/upgradeTiers.ts";
import {
  centredNoticeLeft,
  countedLabel,
  createItemNotices,
  EASE_IN_OUT,
  EASE_OUT,
  gainNotice,
  NOTICE_ACCENTS,
  noticeDestination,
  noticeLanding,
  NoticeQueue,
} from "./itemNotice.ts";
import { chipLeft, chipWidth, flyPoint, ITEM_NOTICE } from "./layout/itemNotice.ts";

const LABELS = CONTENT.labels;
const notice = (gain: Parameters<typeof gainNotice>[1]) => gainNotice(LABELS, gain);
const ammo = notice({ added: 1, kind: "ammo", weapon: "rapidMissile" });
const holodisk = notice({ kind: "holodisk" });
const parts = notice({ aboard: { kind: "carrying", name: "Spare parts" }, kind: "aboard" });

// Steps a queue in 10 ms frames and records each phase's first frame time.
function timeline(queue: NoticeQueue, until: number) {
  const starts: [string, string, number][] = [];
  let key = "";
  for (let at = 0; at <= until; at += 10) {
    const frame = queue.advance(at === 0 ? 0 : 10, true);
    const now = frame ? `${frame.notice.key}:${frame.phase}` : "";
    if (now !== key) {
      key = now;
      if (frame) {
        starts.push([frame.notice.key, frame.phase, at]);
      }
    }
  }
  return starts;
}

describe("item notice wording", () => {
  it("reads every gain as + {item}, the item by its display name", () => {
    expect(holodisk.label).toBe("+ Holodisk");
    expect(parts.label).toBe("+ Spare parts");
    expect(notice({ kind: "weapon", weapon: "phaser" }).label).toBe("+ Phaser");
    expect(ammo.label).toBe("+ Rapid Missile ammo");
    expect(notice({ aboard: { kind: "towing", name: "Scrap barge" }, kind: "aboard" }).label).toBe(
      "+ Scrap barge",
    );
  });

  it("names an upgrade drop's level or paint scheme as + {item}", () => {
    expect(notice({ kind: "weaponLevel", level: 2, weapon: "laser" }).label).toBe(
      "+ Laser level 2",
    );
    expect(notice({ kind: "level", level: 3, track: "shield" }).label).toBe("+ Shield level 3");
    expect(notice({ kind: "level", level: 2, track: "engine" }).label).toBe("+ Engine level 2");
    expect(notice({ kind: "level", level: 2, track: "tractor" }).label).toBe(
      "+ Tractor beam level 2",
    );
    expect(notice({ kind: "paint", scheme: "cobalt" }).label).toBe("+ Cobalt paint");
  });

  it("flies a weapon level to its disc and a Shield level to the shield icon; the rest fade in place", () => {
    const level = notice({ kind: "weaponLevel", level: 2, weapon: "phaser" });
    expect([level.kind, level.icon, level.target]).toEqual([
      "weapon",
      { frames: 2, sprite: "icon-shop-weapon-phaser" },
      { kind: "weapon", weapon: "phaser" },
    ]);
    // Laser's plain shop icon is the shipped icon-shop-weapon-laser sheet.
    expect(notice({ kind: "weaponLevel", level: 3, weapon: "laser" }).icon).toEqual({
      frames: 2,
      sprite: "icon-shop-weapon-laser",
    });
    const shield = notice({ kind: "level", level: 2, track: "shield" });
    expect([shield.kind, shield.icon, shield.target]).toEqual([
      "shield",
      { frames: 2, sprite: "icon-shop-shield" },
      { kind: "shield" },
    ]);
    for (const [gain, sprite] of [
      [{ kind: "level", level: 2, track: "engine" }, "icon-shop-engine-tuning"],
      [{ kind: "level", level: 2, track: "tractor" }, "icon-shop-tractor-beam"],
      [{ kind: "paint", scheme: "cobalt" }, "icon-shop-ship-paint"],
    ] as const) {
      const upgrade = notice(gain);
      expect([upgrade.kind, upgrade.icon, upgrade.target]).toEqual([
        "upgrade",
        { frames: 2, sprite },
        { kind: "none" },
      ]);
    }
  });

  it("adds ×{n} to a merged label", () => {
    expect(countedLabel(LABELS, ammo.label, 1)).toBe("+ Rapid Missile ammo");
    expect(countedLabel(LABELS, ammo.label, 2)).toBe("+ Rapid Missile ammo ×2");
  });

  it("rims a level in its upgrade tier's colour, orange at 2 and purple at 3, on every track", () => {
    expect(UPGRADE_TIER_COLOURS).toEqual({ 2: "#ff8f1f", 3: "#a66bff" });
    expect([1, 2, 3, 4].map(tierColour)).toEqual([null, "#ff8f1f", "#a66bff", "#a66bff"]);
    for (const level of [2, 3] as const) {
      const tier = UPGRADE_TIER_COLOURS[level];
      expect(notice({ kind: "weaponLevel", level, weapon: "laser" }).accent).toBe(tier);
      for (const track of ["engine", "shield", "tractor"] as const) {
        expect(notice({ kind: "level", level, track }).accent).toBe(tier);
      }
    }
  });

  it("rims a paint scheme in its own top colour from ship-paint.json", () => {
    expect(
      Object.fromEntries(Object.entries(ECONOMY.paints).map(([id, { top }]) => [id, top])),
    ).toEqual({
      classic: "#ffffff",
      cobalt: "#6f9ff0",
      graphite: "#aab2c4",
      iris: "#d9ccff",
      seafoam: "#d4f6ea",
    });
    for (const [scheme, { top }] of Object.entries(ECONOMY.paints)) {
      expect(notice({ kind: "paint", scheme: scheme as "cobalt" }).accent).toBe(top);
    }
  });

  it("gives each gain Art's icon, accent and landing place", () => {
    expect(NOTICE_ACCENTS).toEqual({
      cargo: "#feae34",
      holodisk: "#e868c8",
      tow: "#b8bfc9",
      weapon: "#bfa06f",
    });
    expect([holodisk.accent, parts.accent, ammo.accent]).toEqual(["#e868c8", "#feae34", "#bfa06f"]);
    expect(notice({ kind: "weapon", weapon: "phaser" }).accent).toBe("#bfa06f");
    expect([holodisk.kind, holodisk.icon, holodisk.target]).toEqual([
      "holodisk",
      { sprite: "icon-holodisk-20" },
      { kind: "none" },
    ]);
    expect([parts.kind, parts.icon, parts.target]).toEqual([
      "cargo",
      { sprite: "icon-cargo-20" },
      { kind: "cargo" },
    ]);
    const tow = notice({ aboard: { kind: "towing", name: "Pod" }, kind: "aboard" });
    expect([tow.kind, tow.icon, tow.accent]).toEqual(["tow", { sprite: "icon-tow-20" }, "#b8bfc9"]);
    expect(ammo.kind).toBe("weapon");
    expect("mask" in ammo.icon && ammo.icon.mask).toContain("rapidMissile");
    expect(ammo.target).toEqual({ kind: "weapon", weapon: "rapidMissile" });
  });
});

describe("item notice timeline", () => {
  it("appears for 180, holds 1200 and fades in place for 300", () => {
    const queue = new NoticeQueue(() => false);
    queue.push(parts);
    expect(timeline(queue, 2000)).toEqual([
      [parts.key, "appear", 0],
      [parts.key, "hold", 180],
      [parts.key, "fade", 1380],
    ]);
    expect(queue.advance(0, true)).toBeNull();
    expect(queue.landed).toEqual([]);
  });

  it("fades a holodisk's in place over 300 after its hold: 1680 in all, landing nowhere", () => {
    const queue = new NoticeQueue(() => false);
    queue.push(holodisk);
    expect(timeline(queue, 1800)).toEqual([
      [holodisk.key, "appear", 0],
      [holodisk.key, "hold", 180],
      [holodisk.key, "fade", 1380],
    ]);
    expect(queue.landed).toEqual([]);
  });

  it("fades every notice in and out over 150 in place under reduced motion", () => {
    const queue = new NoticeQueue(() => true);
    queue.push(parts);
    expect(timeline(queue, 1600)).toEqual([
      [parts.key, "appear", 0],
      [parts.key, "hold", 150],
      [parts.key, "fade", 1350],
    ]);
    expect(queue.landed).toEqual([]);
  });

  it("queues gains one at a time, the next 120 after one lands, each holding 600 while others wait", () => {
    const queue = new NoticeQueue(() => false);
    queue.push(parts);
    queue.push(holodisk);
    queue.push(ammo);
    const starts = timeline(queue, 5000).filter(
      ([, phase]) => phase === "appear" || phase === "hold",
    );
    expect(starts).toEqual([
      [parts.key, "appear", 0],
      [parts.key, "hold", 180],
      // Every notice fades in place before the next starts.
      [holodisk.key, "appear", 1200],
      [holodisk.key, "hold", 1380],
      // The last notice holds the full 1200.
      [ammo.key, "appear", 2400],
      [ammo.key, "hold", 2580],
    ]);
  });

  it("ends a hold at 600 when a gain queues during it, or at once past 600", () => {
    const early = new NoticeQueue(() => false);
    early.push(parts);
    early.advance(180 + 200, true);
    early.push(holodisk);
    expect(early.advance(399, true)?.phase).toBe("hold");
    expect(early.advance(1, true)?.phase).toBe("fade");
    const late = new NoticeQueue(() => false);
    late.push(parts);
    late.advance(180 + 900, true);
    late.push(holodisk);
    expect(late.advance(0, true)?.phase).toBe("fade");
  });

  it("merges an identical gain into a waiting or holding notice, restarting the hold", () => {
    const queue = new NoticeQueue(() => false);
    queue.push(ammo);
    queue.advance(180 + 1000, true);
    queue.push(notice({ added: 1, kind: "ammo", weapon: "rapidMissile" }));
    const frame = queue.advance(0, true);
    expect([frame?.count, frame?.phase, frame?.progress]).toEqual([2, "hold", 0]);
    expect(queue.advance(1199, true)?.phase).toBe("hold");
    queue.push(holodisk);
    queue.push(holodisk);
    expect(queue.advance(1, true)?.phase).toBe("fade");
    // Once the fade starts an identical gain queues a new notice.
    queue.push(ammo);
    const after = timeline(queue, 3000).filter(([, phase]) => phase === "appear");
    expect(after.map(([key]) => key)).toEqual([holodisk.key, ammo.key]);
  });

  it("pauses while play is covered and clears on leaving flight", () => {
    const queue = new NoticeQueue(() => false);
    queue.push(parts);
    queue.advance(100, true);
    expect(queue.advance(5000, false)).toMatchObject({ phase: "appear" });
    expect(queue.advance(0, true)?.progress).toBeCloseTo(100 / 180, 9);
    queue.clear();
    expect(queue.advance(1000, true)).toBeNull();
  });
});

describe("item notice geometry", () => {
  it("makes the chip 24 high at HUD rect top + 34.5, 42 plus its label wide", () => {
    expect(ITEM_NOTICE).toMatchObject({ height: 24, top: 34.5 });
    expect(chipWidth(0)).toBe(42);
    expect(chipWidth(100)).toBe(142);
  });

  it("centres the chip on its destination, clamped to the pill's left and the weapons' inset", () => {
    expect(chipLeft(300, 100, 50.75, 600)).toBe(250);
    expect(chipLeft(60, 100, 50.75, 600)).toBe(50.75);
    expect(chipLeft(600, 100, 50.75, 500)).toBe(400);
  });

  it("lands on the cargo icon, a weapon's disc, the shield icon, or the pill's centre", () => {
    const places = {
      cargo: 200,
      leftmostTarget: 400,
      pill: { left: 50.75, width: 219.84 },
      right: 696,
      row: 16.5,
      shield: { x: 297, y: 306 },
      weapons: new Map([["phaser", 520]]),
    };
    expect(noticeDestination(places, { kind: "cargo" })).toBe(200);
    expect(noticeDestination(places, { kind: "weapon", weapon: "phaser" })).toBe(520);
    expect(noticeDestination(places, { kind: "none" })).toBeCloseTo(50.75 + 219.84 / 2, 9);
    expect(noticeDestination(places, { kind: "shield" })).toBe(297);
    expect(noticeLanding(places, { kind: "shield" })).toBe(306);
    expect(noticeLanding(places, { kind: "weapon", weapon: "phaser" })).toBe(16.5);
  });

  it("flies on a quadratic curve through the destination's x, 6 below the start", () => {
    const from = { x: 100, y: 46.5 };
    const to = { x: 300, y: 16.5 };
    expect(flyPoint(from, to, 0)).toEqual(from);
    expect(flyPoint(from, to, 1)).toEqual(to);
    // Halfway: a quarter start, half control (300, 52.5), a quarter end.
    expect(flyPoint(from, to, 0.5)).toEqual({ x: 250, y: 42 });
  });

  it("eases with Art's curves, from 0 to 1", () => {
    for (const ease of [EASE_OUT, EASE_IN_OUT]) {
      expect(ease(0)).toBeCloseTo(0, 6);
      expect(ease(1)).toBeCloseTo(1, 6);
    }
    expect(EASE_OUT(0.5)).toBeGreaterThan(0.5);
    expect(EASE_IN_OUT(0.5)).toBeCloseTo(0.5, 6);
  });
});

describe("top-centre item notice routing", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("centres across the HUD independently of the currency pill or weapon selected", () => {
    expect(centredNoticeLeft(700, 140)).toBe(280);
    expect(centredNoticeLeft(320, 140)).toBe(90);
    expect(centredNoticeLeft(100, 140)).toBe(0);
  });

  it("queues no central notice for an ammo refill", () => {
    const nodes: { hidden: boolean }[] = [];
    vi.stubGlobal("document", {
      createElement: () => {
        const node = { append: vi.fn(), className: "", hidden: false, setAttribute: vi.fn() };
        nodes.push(node);
        return node;
      },
      createTextNode: () => ({ data: "" }),
    });
    const notices = createItemNotices({ prepend: vi.fn() } as unknown as HTMLElement, {
      labels: LABELS,
      onArrive: vi.fn(),
      reducedMotion: () => false,
    });
    notices.push([{ added: 5, kind: "ammo", weapon: "rapidMissile" }]);
    notices.update(0, true, {
      cargo: null,
      leftmostTarget: 400,
      pill: { left: 50, width: 200 },
      right: 700,
      row: 16,
      shield: { x: 300, y: 300 },
      weapons: new Map(),
    });
    expect(nodes[0]!.hidden).toBe(true);
  });
});
