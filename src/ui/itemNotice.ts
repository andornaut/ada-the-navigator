import { ECONOMY, type UpgradeTrack } from "../data/economy.ts";
import { tierColour } from "../data/upgradeTiers.ts";
import { weaponGlyphPath, weaponShopSheet } from "../data/weaponGlyphs.ts";
import type { ItemGain } from "../model/itemGains.ts";
import { fill, weaponName } from "../model/shop.ts";
import { font, fromHudEdge, units } from "./layout/css.ts";
import { chipLeft, chipWidth, flyPoint, ITEM_NOTICE } from "./layout/itemNotice.ts";
import { SPACING, TYPE } from "./layout/tokens.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { STATUS_COLOURS } from "./statusPill.ts";

// Item notices (gameplay/rules.md, art/layout.md "Item notice", art/controls.md "Item notice"): a
// small ink chip under the status pill names a gain other than Stardust or ore, "+ {item}", then
// collapses to its icon and flies it to where the gain shows: the pill's cargo segment, the
// weapon's disc or the shield bar. A holodisk's, an Engine or Tractor beam level's and a paint
// scheme's fade in place. One shows at a time, in gain order.

/** The notices' timing in ms (art/layout.md "Item notice"). */
export const NOTICE_TIMING = {
  appearMs: 180,
  /** The landing's bump of the destination's art, scale 1 to bumpScale to 1. */
  bumpMs: 200,
  bumpScale: 1.12,
  /** The label fades out over the collapse's first 84. */
  collapseLabelMs: 84,
  collapseMs: 140,
  fadeMs: 300,
  flyMs: 300,
  /** The next notice appears this long after the previous one lands or fades. */
  gap: 120,
  holdMs: 1200,
  /** A hold while another notice waits. */
  holdWaitingMs: 600,
  /** Under reduced motion: fade in, hold, fade out, in place. */
  reducedFadeMs: 150,
} as const;

export type NoticeKind = "cargo" | "holodisk" | "shield" | "tow" | "upgrade" | "weapon";

/**
 * The fixed rim and "+" accents (art/controls.md "Item notice"); a level takes its upgrade tier's
 * colour and a paint scheme its own top colour (noticeAccent).
 */
export const NOTICE_ACCENTS = {
  cargo: "#feae34",
  holodisk: "#e868c8",
  tow: "#b8bfc9",
  // A new weapon or its ammunition: the weapon disc's gold.
  weapon: "#bfa06f",
} as const;

// A level's rim: its tier's colour, which a level 2 or 3 always has.
const levelAccent = (level: number) => tierColour(level) ?? NOTICE_ACCENTS.weapon;

const SPRITES = "/art/ui/sprites/";

/** Where a notice lands: the pill's cargo segment, a weapon's disc, the shield bar, or nowhere. */
export type NoticeTarget =
  | { readonly kind: "cargo" }
  | { readonly kind: "none" }
  | { readonly kind: "shield" }
  | { readonly kind: "weapon"; readonly weapon: string };

export interface Notice {
  /** The rim and "+" colour. */
  readonly accent: string;
  /** Identical gains share a key and merge. */
  readonly key: string;
  readonly kind: NoticeKind;
  /** The label without its count, such as "+ Rapid Missile ammo". */
  readonly label: string;
  /** A sprite under SPRITES (its first of `frames` frames across), or a weapon glyph in cream. */
  readonly icon: { readonly frames?: number; readonly sprite: string } | { readonly mask: string };
  readonly target: NoticeTarget;
}

type Labels = Readonly<Record<string, string>>;

/** Each upgrade track's shop icon and its level's item label. */
const TRACK_NOTICES: Readonly<Record<UpgradeTrack, { label: string; sprite: string }>> = {
  engine: { label: "itemEngineLevel", sprite: "icon-shop-engine-tuning" },
  shield: { label: "itemShieldLevel", sprite: "icon-shop-shield" },
  tractor: { label: "itemTractorLevel", sprite: "icon-shop-tractor-beam" },
};

/** A gain's notice: its label, icon, accent and landing place. */
export function gainNotice(labels: Labels, gain: ItemGain): Notice {
  const label = (item: string) => fill(labels.itemNotice ?? "", { item });
  if (gain.kind === "holodisk") {
    return {
      accent: NOTICE_ACCENTS.holodisk,
      icon: { sprite: "icon-holodisk-20" },
      key: "holodisk",
      kind: "holodisk",
      label: label(labels.itemHolodisk ?? ""),
      target: { kind: "none" },
    };
  }
  if (gain.kind === "aboard") {
    const towing = gain.aboard.kind === "towing";
    return {
      accent: towing ? NOTICE_ACCENTS.tow : NOTICE_ACCENTS.cargo,
      icon: { sprite: towing ? "icon-tow-20" : "icon-cargo-20" },
      key: `${gain.aboard.kind}:${gain.aboard.name}`,
      kind: towing ? "tow" : "cargo",
      // The model names what Ada carries by its display name (src/data/itemNames.ts).
      label: label(gain.aboard.name),
      target: { kind: "cargo" },
    };
  }
  if (gain.kind === "level") {
    const track = TRACK_NOTICES[gain.track];
    const shield = gain.track === "shield";
    return {
      accent: levelAccent(gain.level),
      icon: { frames: 2, sprite: track.sprite },
      key: `level:${gain.track}:${gain.level}`,
      kind: shield ? "shield" : "upgrade",
      label: label(fill(labels[track.label] ?? "", { n: gain.level })),
      target: { kind: shield ? "shield" : "none" },
    };
  }
  if (gain.kind === "paint") {
    const name = labels[ECONOMY.paints[gain.scheme]?.label ?? ""] ?? gain.scheme;
    return {
      accent: ECONOMY.paints[gain.scheme]?.top ?? NOTICE_ACCENTS.weapon,
      icon: { frames: 2, sprite: "icon-shop-ship-paint" },
      key: `paint:${gain.scheme}`,
      kind: "upgrade",
      label: label(fill(labels.itemPaint ?? "", { paint: name })),
      target: { kind: "none" },
    };
  }
  const name = weaponName(labels, gain.weapon);
  const item =
    gain.kind === "ammo"
      ? fill(labels.itemAmmo ?? "", { weapon: name })
      : gain.kind === "weaponLevel"
        ? fill(labels.itemWeaponLevel ?? "", { n: gain.level, weapon: name })
        : name;
  const level = gain.kind === "weaponLevel";
  return {
    // A weapon level shows the plain 20 px shop icon, its rim the level's tier.
    accent: level ? levelAccent(gain.level) : NOTICE_ACCENTS.weapon,
    icon: level
      ? { frames: 2, sprite: weaponShopSheet(gain.weapon) }
      : { mask: weaponGlyphPath(gain.weapon) },
    key:
      gain.kind === "weaponLevel"
        ? `level:${gain.weapon}:${gain.level}`
        : `${gain.kind}:${gain.weapon}`,
    kind: "weapon",
    label: label(item),
    target: { kind: "weapon", weapon: gain.weapon },
  };
}

/** A notice's label with its merged count: " ×{n}" after repeats. */
export function countedLabel(labels: Labels, label: string, count: number): string {
  return count > 1 ? fill(labels.itemMerged ?? "", { count, label }) : label;
}

export type NoticePhase = "appear" | "collapse" | "fade" | "fly" | "hold";

export interface NoticeFrame {
  readonly count: number;
  readonly notice: Notice;
  readonly phase: NoticePhase;
  /** The phase's progress, 0 to 1. */
  readonly progress: number;
}

interface Running {
  count: number;
  readonly notice: Notice;
  phase: NoticePhase;
  /** Play time spent in this phase. */
  elapsed: number;
  /** This hold's length, cut short while another notice waits. */
  hold: number;
}

/**
 * The notices' timeline, in play time: a modal card or storybook page pauses it (advance with
 * running false), and leaving flight clears it. One notice shows at a time; the rest wait in
 * gain order and merge with an identical waiting or holding one.
 */
export class NoticeQueue {
  private current: Running | null = null;
  private readonly waiting: { count: number; readonly notice: Notice }[] = [];
  /** Play time left before the next notice may appear. */
  private gapLeft = 0;
  private readonly reducedMotion: () => boolean;

  constructor(reducedMotion: () => boolean) {
    this.reducedMotion = reducedMotion;
  }

  clear(): void {
    this.current = null;
    this.waiting.length = 0;
    this.gapLeft = 0;
  }

  /** Queues a notice, or merges it into an identical waiting or holding one. */
  push(notice: Notice): void {
    const current = this.current;
    if (
      current &&
      current.notice.key === notice.key &&
      (current.phase === "appear" || current.phase === "hold")
    ) {
      current.count++;
      if (current.phase === "hold") {
        current.elapsed = 0;
        current.hold = this.waiting.length > 0 ? NOTICE_TIMING.holdWaitingMs : NOTICE_TIMING.holdMs;
      }
      return;
    }
    const waiting = this.waiting.find((entry) => entry.notice.key === notice.key);
    if (waiting) {
      waiting.count++;
      return;
    }
    this.waiting.push({ count: 1, notice });
    // A gain queued during a hold ends it at holdWaitingMs if that is still ahead, else at once.
    if (current?.phase === "hold") {
      current.hold = Math.min(current.hold, Math.max(current.elapsed, NOTICE_TIMING.holdWaitingMs));
    }
  }

  /** The phase lengths for a notice, by its kind and the motion setting. */
  private length(entry: Running, phase: NoticePhase): number {
    const reduced = this.reducedMotion();
    const lengths: Readonly<Record<NoticePhase, number>> = {
      appear: reduced ? NOTICE_TIMING.reducedFadeMs : NOTICE_TIMING.appearMs,
      collapse: NOTICE_TIMING.collapseMs,
      fade: reduced ? NOTICE_TIMING.reducedFadeMs : NOTICE_TIMING.fadeMs,
      fly: NOTICE_TIMING.flyMs,
      hold: entry.hold,
    };
    return lengths[phase];
  }

  private next(entry: Running): NoticePhase | null {
    const inPlace = this.reducedMotion() || entry.notice.target.kind === "none";
    const next: Readonly<Record<NoticePhase, NoticePhase | null>> = {
      appear: "hold",
      collapse: "fly",
      fade: null,
      fly: null,
      hold: inPlace ? "fade" : "collapse",
    };
    return next[entry.phase];
  }

  /** Notices that landed (ended a fly) since the last call, for the destination's bump. */
  readonly landed: Notice[] = [];

  /** Advances play time by ms (none while paused) and returns what shows now. */
  advance(ms: number, running: boolean): NoticeFrame | null {
    let left = running ? Math.max(0, ms) : 0;
    for (;;) {
      if (!this.current) {
        if (this.waiting.length === 0) {
          this.gapLeft = Math.max(0, this.gapLeft - left);
          return null;
        }
        const step = Math.min(left, this.gapLeft);
        this.gapLeft -= step;
        left -= step;
        if (this.gapLeft > 0) {
          return null;
        }
        const { count, notice } = this.waiting.shift()!;
        this.current = {
          count,
          elapsed: 0,
          hold: this.waiting.length > 0 ? NOTICE_TIMING.holdWaitingMs : NOTICE_TIMING.holdMs,
          notice,
          phase: "appear",
        };
      }
      const entry = this.current;
      const length = this.length(entry, entry.phase);
      const step = Math.min(left, length - entry.elapsed);
      entry.elapsed += step;
      left -= step;
      if (entry.elapsed < length) {
        return {
          count: entry.count,
          notice: entry.notice,
          phase: entry.phase,
          progress: length > 0 ? entry.elapsed / length : 1,
        };
      }
      const phase = this.next(entry);
      if (phase === null) {
        // Landed or faded: the next waits out the gap.
        if (entry.phase === "fly") {
          this.landed.push(entry.notice);
        }
        this.current = null;
        this.gapLeft = NOTICE_TIMING.gap;
        if (left <= 0 && this.waiting.length === 0) {
          return null;
        }
        continue;
      }
      if (phase === "hold" && this.waiting.length > 0) {
        entry.hold = Math.min(entry.hold, NOTICE_TIMING.holdWaitingMs);
      }
      entry.phase = phase;
      entry.elapsed = 0;
    }
  }
}

// Ease-out and ease-in-out as Art's cubic beziers, solved for y at x.
function bezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const at = (p1: number, p2: number, t: number) =>
    3 * (1 - t) * (1 - t) * t * p1 + 3 * (1 - t) * t * t * p2 + t * t * t;
  return (x) => {
    let low = 0;
    let high = 1;
    for (let index = 0; index < 32; index++) {
      const mid = (low + high) / 2;
      if (at(x1, x2, mid) < x) {
        low = mid;
      } else {
        high = mid;
      }
    }
    return at(y1, y2, (low + high) / 2);
  };
}
export const EASE_OUT = bezier(0.33, 1, 0.68, 1);
export const EASE_IN_OUT = bezier(0.65, 0, 0.35, 1);

export const ITEM_NOTICE_STYLE = `
.ada-controls .ada-item-notice{
  position:absolute;
  left:${fromHudEdge("left")};
  top:${fromHudEdge("top", ITEM_NOTICE.top)};
  height:${units(ITEM_NOTICE.height)};
  pointer-events:none;
  white-space:nowrap
}
.ada-controls .ada-item-notice[hidden]{
  display:none
}
.ada-controls .ada-item-notice-panel{
  position:absolute;
  top:0;
  height:100%;
  box-sizing:border-box;
  border:${units(ITEM_NOTICE.rim)} solid var(--notice-accent);
  border-radius:${units(ITEM_NOTICE.radius)};
  background:#181425
}
.ada-controls .ada-item-notice-icon{
  position:absolute;
  top:${units((ITEM_NOTICE.height - ITEM_NOTICE.icon) / 2)};
  width:${units(ITEM_NOTICE.icon)};
  height:${units(ITEM_NOTICE.icon)};
  image-rendering:pixelated
}
.ada-controls .ada-item-notice-label{
  position:absolute;
  top:${units((ITEM_NOTICE.height - TYPE.label.lineHeight) / 2)};
  left:${units(ITEM_NOTICE.padding + ITEM_NOTICE.icon + ITEM_NOTICE.markGap)};
  font:${font(TYPE.label)};
  line-height:${units(TYPE.label.lineHeight)};
  color:${STATUS_COLOURS.count}
}
.ada-controls .ada-item-notice-label[data-room=body]{
  font:${font(TYPE.body)};
  line-height:${units(TYPE.label.lineHeight)}
}
.ada-controls .ada-item-notice-plus{
  color:var(--notice-accent)
}
/* The announced label: present for assistive technology, clipped from view. */
.ada-controls .ada-item-notice-live{
  position:absolute;
  white-space:nowrap;
  clip-path:inset(50%)
}
`;

/** Where the chip and its destinations sit now, in HUD rect px. */
export interface NoticePlaces {
  /** The pill's left edge and width. */
  readonly pill: { readonly left: number; readonly width: number };
  /** The cargo segment's icon centre across, or null without one. */
  readonly cargo: number | null;
  /** Each weapon disc's centre across. */
  readonly weapons: ReadonlyMap<string, number>;
  /** The shield pill's icon centre. */
  readonly shield: { readonly x: number; readonly y: number };
  /** The leftmost weapon target's left edge, or null without weapons. */
  readonly leftmostTarget: number | null;
  /** The HUD row's centre line, where the fly lands. */
  readonly row: number;
  /** The right edge the chip may reach when no weapons show. */
  readonly right: number;
}

/** The chip's destination centre across for a target, the pill's centre without one. */
export function noticeDestination(places: NoticePlaces, target: NoticeTarget): number {
  const pillCentre = places.pill.left + places.pill.width / 2;
  if (target.kind === "cargo") {
    return places.cargo ?? places.pill.left + places.pill.width - 18;
  }
  if (target.kind === "weapon") {
    return places.weapons.get(target.weapon) ?? pillCentre;
  }
  if (target.kind === "shield") {
    return places.shield.x;
  }
  return pillCentre;
}

/** Where down the fly lands for a target: the shield pill's icon centre, or the HUD row's. */
export function noticeLanding(places: NoticePlaces, target: NoticeTarget): number {
  return target.kind === "shield" ? places.shield.y : places.row;
}

export function createItemNotices(
  parent: HTMLElement,
  options: {
    readonly labels: Labels;
    readonly reducedMotion: () => boolean;
    /** Bumps the art a notice lands on. */
    readonly onArrive: (target: NoticeTarget) => void;
  },
) {
  const root = document.createElement("div");
  root.className = "ada-item-notice";
  root.hidden = true;
  root.setAttribute("aria-hidden", "true");
  const panel = document.createElement("span");
  panel.className = "ada-item-notice-panel";
  const icon = document.createElement("span");
  icon.className = "ada-item-notice-icon";
  const label = document.createElement("span");
  label.className = "ada-item-notice-label";
  const plus = document.createElement("span");
  plus.className = "ada-item-notice-plus";
  const rest = document.createTextNode("");
  label.append(plus, rest);
  root.append(panel, icon, label);
  // Each notice's label, announced politely; the chip itself is hidden from assistive technology.
  const live = document.createElement("div");
  live.className = "ada-item-notice-live";
  live.setAttribute("aria-live", "polite");
  parent.prepend(root, live);
  const queue = new NoticeQueue(options.reducedMotion);
  let shown: { readonly notice: Notice; count: number; width: number } | null = null;
  let last: number | undefined;
  // The chip's left edge, fixed when its notice appears.
  let anchor: { readonly left: number; readonly notice: Notice } | null = null;

  const showNotice = (frame: NoticeFrame, room: number) => {
    const text = countedLabel(options.labels, frame.notice.label, frame.count);
    if (shown?.notice !== frame.notice) {
      shown = { count: 0, notice: frame.notice, width: 0 };
      root.style.setProperty("--notice-accent", frame.notice.accent);
      if ("sprite" in frame.notice.icon) {
        const across = 100 * (frame.notice.icon.frames ?? 1);
        icon.style.background = `url('${SPRITES}${frame.notice.icon.sprite}.png') 0 0 / ${across}% 100% no-repeat`;
        icon.style.removeProperty("mask");
        icon.style.removeProperty("-webkit-mask");
      } else {
        icon.style.background = STATUS_COLOURS.count;
        icon.style.setProperty(
          "-webkit-mask",
          `url('${frame.notice.icon.mask}') center / 100% 100% no-repeat`,
        );
        icon.style.setProperty(
          "mask",
          `url('${frame.notice.icon.mask}') center / 100% 100% no-repeat`,
        );
      }
    }
    if (shown.count !== frame.count) {
      shown.count = frame.count;
      plus.textContent = text.slice(0, 1);
      rest.data = text.slice(1);
      live.textContent = text;
      // A label wider than its room draws in the body role; it never wraps or truncates.
      const unit = readViewUnit(root);
      label.dataset.room = "label";
      if (label.offsetWidth / unit > room) {
        label.dataset.room = "body";
      }
      shown.width = label.offsetWidth / unit;
    }
    return shown.width;
  };

  return {
    clear(): void {
      queue.clear();
      shown = null;
      root.hidden = true;
    },
    dispose(): void {
      root.remove();
      live.remove();
    },
    push(gains: readonly ItemGain[]): void {
      for (const gain of gains) {
        queue.push(gainNotice(options.labels, gain));
      }
    },
    /** Steps the timeline to now and draws the chip; running false pauses it and hides it. */
    update(now: number, running: boolean, places: NoticePlaces): void {
      const ms = last === undefined ? 0 : now - last;
      last = now;
      const frame = queue.advance(ms, running);
      for (const notice of queue.landed.splice(0)) {
        options.onArrive(notice.target);
      }
      root.hidden = !running || frame === null;
      if (!frame || !running) {
        if (!frame) {
          shown = null;
        }
        return;
      }
      const right = (places.leftmostTarget ?? places.right) - SPACING.pageInset;
      const width = chipWidth(showNotice(frame, right - places.pill.left - chipWidth(0)));
      // The fly reads its destination every frame, as the pill's right edge moves with its counts;
      // the chip keeps the place it appeared at.
      const target = noticeDestination(places, frame.notice.target);
      if (anchor?.notice !== frame.notice) {
        anchor = { left: chipLeft(target, width, places.pill.left, right), notice: frame.notice };
      }
      const { left } = anchor;
      const iconLeft = ITEM_NOTICE.padding;
      icon.style.left = units(iconLeft);
      let opacity = 1;
      let panelOpacity = 1;
      let labelOpacity = 1;
      let shift = { x: 0, y: 0 };
      let panelLeft = 0;
      let panelWidth = width;
      const t = frame.progress;
      const reduced = options.reducedMotion();
      if (frame.phase === "appear") {
        opacity = reduced ? t : EASE_OUT(t);
        shift = { x: 0, y: reduced ? 0 : ITEM_NOTICE.appearDrop * (1 - EASE_OUT(t)) };
      } else if (frame.phase === "fade") {
        opacity = 1 - (reduced ? t : EASE_OUT(t));
        shift = { x: 0, y: reduced ? 0 : -ITEM_NOTICE.rise * EASE_OUT(t) };
      } else if (frame.phase === "collapse" || frame.phase === "fly") {
        const share = frame.phase === "collapse" ? EASE_IN_OUT(t) : 1;
        const labelShare = Math.min(
          1,
          (t * NOTICE_TIMING.collapseMs) / NOTICE_TIMING.collapseLabelMs,
        );
        labelOpacity = frame.phase === "collapse" ? 1 - labelShare : 0;
        const squareLeft = iconLeft - (ITEM_NOTICE.square - ITEM_NOTICE.icon) / 2;
        panelLeft = squareLeft * share;
        panelWidth = width + (ITEM_NOTICE.square - width) * share;
        if (frame.phase === "fly") {
          const from = {
            x: left + iconLeft + ITEM_NOTICE.icon / 2,
            y: ITEM_NOTICE.top + ITEM_NOTICE.height / 2,
          };
          const to = { x: target, y: noticeLanding(places, frame.notice.target) };
          const point = flyPoint(from, to, EASE_IN_OUT(t));
          shift = { x: point.x - from.x, y: point.y - from.y };
          panelOpacity = 1 - EASE_IN_OUT(t);
        }
      }
      root.style.left = fromHudEdge("left", left);
      root.style.width = units(width);
      root.style.opacity = String(opacity);
      root.style.translate = `${units(shift.x)} ${units(shift.y)}`;
      panel.style.left = units(panelLeft);
      panel.style.width = units(panelWidth);
      panel.style.opacity = String(panelOpacity);
      label.style.opacity = String(labelOpacity);
    },
  };
}
