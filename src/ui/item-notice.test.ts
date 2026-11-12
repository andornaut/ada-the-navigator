import { describe, expect, it } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import {
  countedLabel,
  EASE_IN_OUT,
  EASE_OUT,
  gainNotice,
  NOTICE_ACCENTS,
  noticeDestination,
  noticeName,
  NoticeQueue,
} from "./item-notice.ts";
import { chipLeft, chipWidth, flyPoint, ITEM_NOTICE } from "./layout/itemNotice.ts";

const LABELS = PROTOTYPE.labels;
const notice = (gain: Parameters<typeof gainNotice>[1]) => gainNotice(LABELS, gain);
const ammo = notice({ kind: "ammo", weapon: "rapidMissile" });
const holodisk = notice({ kind: "holodisk" });
const parts = notice({ aboard: { kind: "carrying", name: "spare parts" }, kind: "aboard" });

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
  it("reads every gain as + {item}, the article dropped and the first letter a capital", () => {
    expect(noticeName("a message")).toBe("Message");
    expect(noticeName("an ore pod")).toBe("Ore pod");
    expect(noticeName("spare parts")).toBe("Spare parts");
    expect(holodisk.label).toBe("+ Holodisk");
    expect(parts.label).toBe("+ Spare parts");
    expect(notice({ kind: "weapon", weapon: "phaser" }).label).toBe("+ Phaser");
    expect(ammo.label).toBe("+ Rapid Missile ammo");
    expect(
      notice({ aboard: { kind: "towing", name: "a scrap barge" }, kind: "aboard" }).label,
    ).toBe("+ Scrap barge");
  });

  it("adds ×{n} to a merged label", () => {
    expect(countedLabel(LABELS, ammo.label, 1)).toBe("+ Rapid Missile ammo");
    expect(countedLabel(LABELS, ammo.label, 2)).toBe("+ Rapid Missile ammo ×2");
  });

  it("gives each gain Art's icon, accent and landing place", () => {
    expect(NOTICE_ACCENTS).toEqual({
      cargo: "#feae34",
      holodisk: "#e868c8",
      tow: "#b8bfc9",
      weapon: "#bfa06f",
    });
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
    const tow = notice({ aboard: { kind: "towing", name: "a pod" }, kind: "aboard" });
    expect([tow.kind, tow.icon]).toEqual(["tow", { sprite: "icon-tow-20" }]);
    expect(ammo.kind).toBe("weapon");
    expect("mask" in ammo.icon && ammo.icon.mask).toContain("rapidMissile");
    expect(ammo.target).toEqual({ kind: "weapon", weapon: "rapidMissile" });
  });
});

describe("item notice timeline", () => {
  it("appears for 180, holds 1200, collapses for 140 and flies for 300: 1820 to landing", () => {
    const queue = new NoticeQueue(() => false);
    queue.push(parts);
    expect(timeline(queue, 2000)).toEqual([
      [parts.key, "appear", 0],
      [parts.key, "hold", 180],
      [parts.key, "collapse", 1380],
      [parts.key, "fly", 1520],
    ]);
    expect(queue.advance(0, true)).toBeNull();
    expect(queue.landed).toEqual([parts]);
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
      // Parts landed at 180 + 600 + 140 + 300 = 1220; the holodisk appears 120 later.
      [holodisk.key, "appear", 1340],
      [holodisk.key, "hold", 1520],
      // Faded at 1520 + 600 + 300 = 2420; ammo, alone, holds the full 1200.
      [ammo.key, "appear", 2540],
      [ammo.key, "hold", 2720],
    ]);
  });

  it("ends a hold at 600 when a gain queues during it, or at once past 600", () => {
    const early = new NoticeQueue(() => false);
    early.push(parts);
    early.advance(180 + 200, true);
    early.push(holodisk);
    expect(early.advance(399, true)?.phase).toBe("hold");
    expect(early.advance(1, true)?.phase).toBe("collapse");
    const late = new NoticeQueue(() => false);
    late.push(parts);
    late.advance(180 + 900, true);
    late.push(holodisk);
    expect(late.advance(0, true)?.phase).toBe("collapse");
  });

  it("merges an identical gain into a waiting or holding notice, restarting the hold", () => {
    const queue = new NoticeQueue(() => false);
    queue.push(ammo);
    queue.advance(180 + 1000, true);
    queue.push(notice({ kind: "ammo", weapon: "rapidMissile" }));
    const frame = queue.advance(0, true);
    expect([frame?.count, frame?.phase, frame?.progress]).toEqual([2, "hold", 0]);
    expect(queue.advance(1199, true)?.phase).toBe("hold");
    queue.push(holodisk);
    queue.push(holodisk);
    expect(queue.advance(1, true)?.phase).toBe("collapse");
    // Once the collapse starts an identical gain queues a new notice.
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

  it("lands on the cargo icon, a weapon's disc, or the pill's centre", () => {
    const places = {
      cargo: 200,
      leftmostTarget: 400,
      pill: { left: 50.75, width: 219.84 },
      right: 696,
      row: 16.5,
      weapons: new Map([["phaser", 520]]),
    };
    expect(noticeDestination(places, { kind: "cargo" })).toBe(200);
    expect(noticeDestination(places, { kind: "weapon", weapon: "phaser" })).toBe(520);
    expect(noticeDestination(places, { kind: "none" })).toBeCloseTo(50.75 + 219.84 / 2, 9);
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
