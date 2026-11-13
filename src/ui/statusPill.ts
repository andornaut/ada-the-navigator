import { LIGHT_FIELD } from "../game/lightField.ts";
import { controlsLine, font, fromHudEdge, hudCentreX, units } from "./layout/css.ts";
import {
  countSlot,
  SHIELD_PILL,
  shieldBarWidth,
  shieldDelayStrip,
  shieldFillWidth,
  shieldPillWidth,
  STATUS_PILL,
  STICK_AREA_MARGIN,
} from "./layout/playView.ts";
import { TYPE } from "./layout/tokens.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { FOCUS_STYLE } from "./modal.ts";

// The HUD status pill (art/layout.md "Status pill", art/controls.md "Status pill"): one ink pill
// beside pause holding the Stardust and ore counts, then any carried job or story item or
// towed craft (gameplay/rules.md), each after its own divider; Stardust and ore
// gains tick "+N" under their counts. The shield sits apart in its own pill at the bottom centre
// (SHIELD_PILL). The bar draws in CSS at logical units with fractional widths; the shield's states
// are a pure function of what the model shows each frame, so they are tested without a browser.
// On a light field the shield icon and bar each draw inside an ink outline (art/galaxies.md
// "Light fields").

export const STATUS_COLOURS = {
  count: "#ead4aa",
  divider: "#57536e",
  flash: "#ffffff",
  low: "#e4574e",
  lowPanel: "#532e35",
  lowPeak: "#ff8a80",
  // The ore +N tick: ore's light rust (art/controls.md "Status pill").
  oreTick: "#eaa676",
  panel: "rgb(24 20 37 / 0.65)",
  // The separate recharge timer fill and its ink track (art/controls.md "Status pill").
  recharge: "#ead4aa",
  rechargeEdge: "#181425",
  rim: "#9a96ad",
  shield: "#70ace8",
  shieldDelay: "#4f7aa6",
  tick: "#f4d98a",
  // Its own ink layer at 0.65 over the panel, not a hole in it.
  track: "rgb(24 20 37 / 0.65)",
} as const;

// The light-field outline around the shield icon and bar (`lightField.hudOutline`), in ink.
const LIGHT_OUTLINE = {
  ink: `#${LIGHT_FIELD.ink.toString(16).padStart(6, "0")}`,
  width: LIGHT_FIELD.hudOutline,
} as const;

export const STATUS_TIMING = {
  // The Stardust count's bump, at most once per bumpMs.
  bumpMs: 200,
  bumpScale: 1.12,
  // One hit flash, at most one start per flashEveryMs.
  flashEveryMs: 334,
  flashMs: 100,
  // The low pulse's cycle.
  pulseMs: 1000,
  // The +N tick: hold, then rise and fade; reduced motion holds longer and only fades.
  tick: { fadeMs: 300, holdMs: 300 },
  tickReduced: { fadeMs: 150, holdMs: 450 },
} as const;

export interface ShieldInput {
  readonly capacity: number;
  /** Shield level, 1 to 3, which sets the bar's length. */
  readonly level: number;
  // Whether the shield is regenerating: the recharge delay has passed and it is below capacity.
  readonly recharging: boolean;
  // Seconds from the last damage until recharge starts.
  readonly rechargeDelay: number;
  readonly shield: number;
  // Seconds since Ada was last damaged.
  readonly sinceDamage: number;
}

export type ShieldTone = "empty" | "low" | "normal";

// The bar as drawn: each part's start and end in the level's fill area, the tone and the pulse
// (0 at the low colour, 1 at the peak).
export interface ShieldBarView {
  readonly delay: { readonly from: number; readonly to: number } | null;
  readonly edge: boolean;
  readonly fill: number;
  readonly flash: { readonly from: number; readonly to: number } | null;
  readonly pulse: number;
  // The recharge-delay strip's fill from 0 to 1 while the delay runs; null while the shield is
  // full or regenerating, when it is hidden.
  readonly recharge: number | null;
  readonly tone: ShieldTone;
}

// Follows the shield from frame to frame: a drop flashes its lost part once (at most once per
// flashEveryMs) and keeps the delay part from the fill end to the shield value just before the
// first hit since the delay part was last clear; regeneration clears the delay part at once; a
// rise without regeneration (the depletion refill) draws full at once with no flash.
export class ShieldBar {
  private delayMark: number | null = null;
  private flash: { from: number; to: number; until: number } | null = null;
  private lastFlash = -Infinity;
  private previous: number | undefined;

  update(input: ShieldInput, nowMs: number, reducedMotion: boolean): ShieldBarView {
    const capacity = input.capacity > 0 && Number.isFinite(input.capacity) ? input.capacity : 1;
    const shield = Number.isFinite(input.shield)
      ? Math.max(0, Math.min(capacity, input.shield))
      : 0;
    const previous = this.previous;
    if (previous !== undefined && shield < previous) {
      this.delayMark ??= previous;
      if (!reducedMotion && nowMs - this.lastFlash >= STATUS_TIMING.flashEveryMs) {
        this.flash = { from: shield, to: previous, until: nowMs + STATUS_TIMING.flashMs };
        this.lastFlash = nowMs;
      }
    } else if (previous !== undefined && shield > previous && !input.recharging) {
      this.delayMark = null;
      this.flash = null;
    }
    if (input.recharging || shield <= 0) {
      this.delayMark = null;
      this.flash = null;
    }
    if (this.flash && nowMs >= this.flash.until) {
      this.flash = null;
    }
    this.previous = shield;
    const area = shieldFillWidth(input.level);
    const at = (value: number) => (area * value) / capacity;
    const tone: ShieldTone =
      shield <= 0 ? "empty" : shield < SHIELD_PILL.low * capacity ? "low" : "normal";
    const delay =
      this.delayMark !== null && this.delayMark > shield
        ? { from: at(shield), to: at(this.delayMark) }
        : null;
    const flash = this.flash ? { from: at(this.flash.from), to: at(this.flash.to) } : null;
    const recharge =
      shield >= capacity || input.recharging
        ? null
        : input.rechargeDelay > 0
          ? Math.max(0, Math.min(1, input.sinceDamage / input.rechargeDelay))
          : 1;
    return {
      delay,
      edge: input.recharging && shield > 0 && shield < capacity,
      fill: at(shield),
      flash,
      pulse:
        tone === "low" && !reducedMotion
          ? (1 - Math.cos((2 * Math.PI * nowMs) / STATUS_TIMING.pulseMs)) / 2
          : 0,
      recharge,
      tone,
    };
  }
}

// A #rrggbb colour blended from `from` toward `to` by amount.
export function blendHex(from: string, to: string, amount: number): string {
  const a = Number.parseInt(from.slice(1), 16);
  const b = Number.parseInt(to.slice(1), 16);
  const channel = (shift: number) => {
    const x = (a >> shift) & 255;
    const y = (b >> shift) & 255;
    return Math.round(x + (y - x) * amount);
  };
  return `#${[16, 8, 0].map((shift) => channel(shift).toString(16).padStart(2, "0")).join("")}`;
}

// The icon and rim colour for a tone and pulse.
export function shieldMarkColour(tone: ShieldTone, pulse: number): string {
  if (tone === "normal") {
    return STATUS_COLOURS.shield;
  }
  return tone === "low"
    ? blendHex(STATUS_COLOURS.low, STATUS_COLOURS.lowPeak, pulse)
    : STATUS_COLOURS.low;
}

/** Paid ore since the loaded baseline, batched during recharge and flushed when it stops. */
export class ShieldOreSpendCounter {
  private previous: number | undefined;
  private pending = 0;

  reset(total?: number): void {
    this.previous = Number.isSafeInteger(total) && total! >= 0 ? total : undefined;
    this.pending = 0;
  }

  update(total?: number, recharging = true): number {
    const previous = this.previous;
    if (!Number.isSafeInteger(total) || total! < 0 || previous === undefined || total! < previous) {
      this.reset(total);
      return 0;
    }
    this.previous = total;
    this.pending += total! - previous;
    const batch = STATUS_PILL.ore.oreSpendBatch;
    const paid = recharging ? Math.floor(this.pending / batch) * batch : this.pending;
    this.pending -= paid;
    return paid;
  }
}

// An exact count, en-US grouped: the counts' accessible labels and the Ship card
// (gameplay/economy.md). The pill draws its counts and +N ticks with pillCount.
const COUNT_FORMAT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export function stardustCount(amount: number): string {
  return COUNT_FORMAT.format(Math.max(0, Math.floor(amount)));
}

/**
 * A pill count in at most five characters (gameplay/economy.md "Player strings"): the integer
 * below 10,000; thousands to the nearest tenth to 99,999 ("44.4k"), a value that rounds to 100.0k
 * showing "100k"; whole thousands, rounded, to "9999k"; then whole millions, rounded, at most
 * "9999m".
 */
export function pillCount(amount: number): string {
  const whole = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  if (whole < 10_000) {
    return String(whole);
  }
  const tenths = Math.round(whole / 100);
  if (tenths < 1000) {
    return `${Math.floor(tenths / 10)}.${tenths % 10}k`;
  }
  const thousands = Math.round(whole / 1000);
  if (thousands < 10_000) {
    return `${thousands}k`;
  }
  return `${Math.min(9999, Math.round(whole / 1_000_000))}m`;
}

const { bar } = SHIELD_PILL;
// The tick's ink outline: its text offset by the outline width each way.
const OUTLINE = units(STATUS_PILL.tick.outline);
const OUTLINE_SHADOW = [
  `calc(-1 * ${OUTLINE}) 0`,
  `${OUTLINE} 0`,
  `0 calc(-1 * ${OUTLINE})`,
  `0 ${OUTLINE}`,
]
  .map((offset) => `${offset} 0 ${LIGHT_OUTLINE.ink}`)
  .join(",");
// The icon mask grown by the outline in all eight directions: chained shadows compound into a
// square kernel.
const ICON_OUTLINE = [
  `${units(LIGHT_OUTLINE.width)} 0`,
  `${units(-LIGHT_OUTLINE.width)} 0`,
  `0 ${units(LIGHT_OUTLINE.width)}`,
  `0 ${units(-LIGHT_OUTLINE.width)}`,
]
  .map((offset) => `drop-shadow(${offset} 0 ${LIGHT_OUTLINE.ink})`)
  .join(" ");

/** The pill's cargo segment icons (art/controls.md "Cargo icons"), 20 px sprites. */
export const CARGO_ICONS = {
  carrying: "/art/ui/sprites/icon-cargo-20.png",
  ore: "/art/ui/sprites/icon-ore-20.png",
  towing: "/art/ui/sprites/icon-tow-20.png",
} as const;

const cargoIcon = (url: string) => `background:url('${url}') 0 0 / 100% 100% no-repeat;
  image-rendering:pixelated`;

/** The pill's segments after the Stardust count, in order: ore, then what Ada carries or tows. */
export function statusSegments(view: Pick<StatusView, "aboard" | "ore">): ("aboard" | "ore")[] {
  return ["ore", ...(view.aboard ? (["aboard"] as const) : [])];
}

// Cut the bar out of the low panel so its two original ink layers still composite over the field.
const TRACK_LEFT = SHIELD_PILL.padding.left + SHIELD_PILL.icon + SHIELD_PILL.iconGap;
const TRACK_TOP = (SHIELD_PILL.pill.height - SHIELD_PILL.bar.height) / 2;
const TRACK_RIGHT = `calc(${units(TRACK_LEFT)} + var(--shield-bar))`;
const TRACK_BOTTOM = units(TRACK_TOP + SHIELD_PILL.bar.height);

export const STATUS_PILL_STYLE = `
.ada-controls .ada-status{
  position:absolute;
  left:${fromHudEdge("left", STATUS_PILL.x)};
  top:${fromHudEdge("top", STATUS_PILL.y)};
  box-sizing:border-box;
  height:${units(STATUS_PILL.pill.height)};
  padding:0 ${units(STATUS_PILL.padding)};
  display:flex;
  align-items:center;
  border-radius:${units(STATUS_PILL.pill.radius)};
  background:${STATUS_COLOURS.panel};
  font:${font(TYPE.label)};
  color:${STATUS_COLOURS.count};
  white-space:nowrap;
  pointer-events:none
}
.ada-controls .ada-status .ada-resource-target{pointer-events:auto;cursor:pointer}
.ada-controls .ada-status [role=button]:focus-visible{${FOCUS_STYLE}}
/* With the pause button hidden the pill is the leftmost art, on the HUD rect's left edge. */
.ada-controls .ada-pause[hidden] ~ .ada-status{
  left:${fromHudEdge("left", STATUS_PILL.xAlone)}
}
/* The shield pill at the bottom centre: centred across the HUD rect, its bottom level with the
   sticks' drawn bottom (shieldPillRect). */
.ada-controls .ada-shield{
  position:absolute;
  left:${hudCentreX()};
  bottom:${controlsLine(SHIELD_PILL.bottom, STICK_AREA_MARGIN)};
  margin-left:calc(var(--shield-pill) / -2);
  box-sizing:border-box;
  width:var(--shield-pill);
  height:${units(SHIELD_PILL.pill.height)};
  padding:0 ${units(SHIELD_PILL.padding.right)} 0 ${units(SHIELD_PILL.padding.left)};
  display:flex;
  align-items:center;
  border-radius:${units(SHIELD_PILL.pill.radius)};
  background:${STATUS_COLOURS.panel};
  pointer-events:none;
  --shield-mark:${STATUS_COLOURS.shield};
  --shield-rim:${STATUS_COLOURS.rim};
  --shield-pill:${units(shieldPillWidth(1))};
  --shield-bar:${units(shieldBarWidth(1))}
}
.ada-controls .ada-shield[data-tone=low],
.ada-controls .ada-shield[data-tone=empty]{
  background:transparent;
  isolation:isolate
}
.ada-controls .ada-shield[data-tone=low]::before,
.ada-controls .ada-shield[data-tone=empty]::before{
  content:"";
  position:absolute;
  inset:0;
  z-index:-1;
  border-radius:inherit;
  background:${STATUS_COLOURS.lowPanel};
  clip-path:polygon(evenodd,0 0,100% 0,100% 100%,0 100%,0 0,
    ${units(TRACK_LEFT)} ${units(TRACK_TOP)},
    ${units(TRACK_LEFT)} ${TRACK_BOTTOM},
    ${TRACK_RIGHT} ${TRACK_BOTTOM},
    ${TRACK_RIGHT} ${units(TRACK_TOP)},
    ${units(TRACK_LEFT)} ${units(TRACK_TOP)})
}
.ada-controls .ada-shield[data-tone=low] .ada-status-bar,
.ada-controls .ada-shield[data-tone=empty] .ada-status-bar{
  background:linear-gradient(${STATUS_COLOURS.track},${STATUS_COLOURS.track}),${STATUS_COLOURS.panel}
}
${SHIELD_PILL.bars
  .map(
    (_, index) => `.ada-controls .ada-shield[data-level="${index + 1}"]{
  --shield-pill:${units(shieldPillWidth(index + 1))};
  --shield-bar:${units(shieldBarWidth(index + 1))}
}`,
  )
  .join("\n")}
.ada-controls .ada-status-mark{
  flex:none;
  display:flex;
  margin-right:${units(SHIELD_PILL.iconGap)}
}
.ada-controls .ada-shield[data-field=light] .ada-status-mark{
  filter:${ICON_OUTLINE}
}
.ada-controls .ada-status-shield{
  width:${units(SHIELD_PILL.icon)};
  height:${units(SHIELD_PILL.icon)};
  background:var(--shield-mark);
  -webkit-mask:url('/art/ui/icons/shield.svg') center / 100% 100% no-repeat;
  mask:url('/art/ui/icons/shield.svg') center / 100% 100% no-repeat
}
.ada-controls .ada-status-bar{
  position:relative;
  flex:none;
  box-sizing:border-box;
  width:var(--shield-bar);
  height:${units(bar.height)};
  border:0;
  box-shadow:inset 0 0 0 ${units(bar.rim)} var(--shield-rim);
  background:${STATUS_COLOURS.track}
}
.ada-controls .ada-shield[data-field=light] .ada-status-bar{
  box-shadow:inset 0 0 0 ${units(bar.rim)} var(--shield-rim),
    0 0 0 ${units(LIGHT_OUTLINE.width)} ${LIGHT_OUTLINE.ink}
}
.ada-controls .ada-status-bar > span{
  position:absolute;
  top:${units(bar.inset)};
  height:${units(bar.height - 2 * bar.inset)};
  left:${units(bar.inset)};
  width:0
}
.ada-controls .ada-status-fill{
  background:${STATUS_COLOURS.shield}
}
.ada-controls .ada-shield[data-tone=low] .ada-status-fill{
  background:${STATUS_COLOURS.low}
}
.ada-controls .ada-status-delay{
  background:${STATUS_COLOURS.shieldDelay}
}
.ada-controls .ada-status-flash,
.ada-controls .ada-status-edge{
  background:${STATUS_COLOURS.flash}
}
/* A separate timer track below the main shield, with its own contained fill. */
.ada-controls .ada-shield > .ada-status-recharge-track{
  position:absolute;
  box-sizing:border-box;
  border:0;
  box-shadow:inset 0 0 0 ${units(SHIELD_PILL.delayStrip.edge)} ${STATUS_COLOURS.rechargeEdge};
  background:${STATUS_COLOURS.track}
}
.ada-controls .ada-status-recharge-track > .ada-status-recharge{
  position:absolute;
  left:${units(SHIELD_PILL.delayStrip.edge)};
  top:${units(SHIELD_PILL.delayStrip.edge)};
  height:${units(SHIELD_PILL.delayStrip.height)};
  background:${STATUS_COLOURS.recharge}
}
.ada-controls .ada-status-divider{
  flex:none;
  width:${units(STATUS_PILL.divider.width)};
  height:${units(STATUS_PILL.divider.height)};
  margin:0 ${units(STATUS_PILL.dividerGap)};
  background:${STATUS_COLOURS.divider}
}
.ada-controls .ada-status-stardust{
  flex:none;
  width:${units(STATUS_PILL.stardustIcon)};
  height:${units(STATUS_PILL.stardustIcon)};
  margin-right:${units(STATUS_PILL.iconGap)};
  background:url('/art/ui/sprites/icon-stardust-20.png') 0 0 / 100% 100% no-repeat;
  image-rendering:pixelated
}
.ada-controls .ada-status-cargo{
  flex:none;
  width:${units(STATUS_PILL.cargoIcon)};
  height:${units(STATUS_PILL.cargoIcon)}
}
.ada-controls .ada-status-ore{
  margin-right:${units(STATUS_PILL.iconGap)};
  ${cargoIcon(CARGO_ICONS.ore)}
}
.ada-controls .ada-status-cargo[data-kind=carrying]{
  ${cargoIcon(CARGO_ICONS.carrying)}
}
.ada-controls .ada-status-cargo[data-kind=towing]{
  ${cargoIcon(CARGO_ICONS.towing)}
}
/* A count's slot, as wide as the count (countSlot, set with the count): the tick hangs from its
   centre, and the pill's right edge follows it in the same frame, with no transition. */
.ada-controls .ada-status-slot{
  position:relative;
  flex:none;
  display:inline-block;
  width:${units(STATUS_PILL.minCount)}
}
.ada-controls .ada-status-slot[hidden]{
  display:none
}
.ada-controls .ada-status-count{
  display:inline-block;
  line-height:${units(TYPE.label.lineHeight)};
  font-variant-numeric:tabular-nums;
  transform-origin:left center
}
/* The +N tick under its count, centred across on it, its line box on the item notice's row. */
.ada-controls .ada-status-tick{
  position:absolute;
  left:50%;
  transform:translateX(-50%);
  top:${units(STATUS_PILL.tick.top)};
  line-height:${units(TYPE.label.lineHeight)};
  color:${STATUS_COLOURS.tick};
  text-shadow:${OUTLINE_SHADOW}
}
.ada-controls .ada-status-tick[data-kind=ore]{
  color:${STATUS_COLOURS.oreTick}
}
`;

export interface StatusView {
  /** What Ada carries or tows and its spoken label, such as "Carrying: a crate", or null. */
  readonly aboard: { readonly kind: "carrying" | "towing"; readonly label: string } | null;
  readonly capacity: number;
  /** Shield level, 1 to 3, which sets the shield bar's length. */
  readonly level: number;
  // Whether the field under the HUD is light, which outlines the shield icon and bar.
  readonly lightField: boolean;
  /** Ore carried this flight, and its icon's spoken label, "Ore". */
  readonly ore: number;
  readonly oreLabel: string;
  /** Cumulative ore explicitly paid for shield recharge, never inferred from cargo changes. */
  readonly shieldOreSpent?: number;
  readonly recharging: boolean;
  // Seconds from the last damage until recharge starts.
  readonly rechargeDelay: number;
  readonly shield: number;
  // Seconds since Ada was last damaged.
  readonly sinceDamage: number;
  readonly stardust: number;
  // The count's spoken label, such as "260 Stardust".
  readonly stardustLabel: string;
}

// A count that ticks "+N" just below itself on a gain, merging gains while a tick shows; bump
// scales the count, at most once per STATUS_TIMING.bumpMs.
function createCounter(
  kind: "ore" | "stardust",
  reducedMotion: () => boolean,
): {
  readonly count: HTMLSpanElement;
  readonly clearSpend: () => void;
  readonly spending: () => boolean;
  readonly spend: (amount: number, nowMs: number) => void;
  readonly slot: HTMLSpanElement;
  // The count, its exact accessible label (null: the exact count alone) and the time.
  readonly set: (value: number, label: string | null, nowMs: number) => void;
} {
  const slot = document.createElement("span");
  slot.className = `ada-status-slot ada-status-${kind}-slot`;
  const count = document.createElement("span");
  count.className = `ada-status-count ada-status-${kind}-count`;
  const text = document.createTextNode("");
  count.append(text);
  slot.append(count);
  let shown: number | undefined;
  let tick: { amount: number; node: HTMLSpanElement; animation: Animation } | null = null;
  let lastBump = -Infinity;
  const spendQueue: { amount: number; nowMs: number }[] = [];
  const nextSpend = (): void => {
    const next = spendQueue[0];
    if (next) {
      const amount = Math.min(STATUS_PILL.ore.oreSpendBatch, next.amount);
      next.amount -= amount;
      if (next.amount === 0) {
        spendQueue.shift();
      }
      gain(-amount, next.nowMs);
    }
  };
  const gain = (amount: number, now: number) => {
    const reduced = reducedMotion();
    if (amount > 0 && !reduced && now - lastBump >= STATUS_TIMING.bumpMs) {
      lastBump = now;
      count.animate(
        [
          { transform: "scale(1)" },
          { transform: `scale(${STATUS_TIMING.bumpScale})` },
          { transform: "scale(1)" },
        ],
        { duration: STATUS_TIMING.bumpMs, easing: "ease-out" },
      );
    }
    const total = (tick && Math.sign(tick.amount) === Math.sign(amount) ? tick.amount : 0) + amount;
    tick?.animation.cancel();
    tick?.node.remove();
    const node = document.createElement("span");
    node.className = "ada-status-tick";
    node.dataset.kind = kind;
    node.setAttribute("aria-hidden", "true");
    node.textContent = `${total < 0 ? "-" : "+"}${pillCount(Math.abs(total))}`;
    slot.append(node);
    const timing = reduced ? STATUS_TIMING.tickReduced : STATUS_TIMING.tick;
    const duration = timing.holdMs + timing.fadeMs;
    const hold = timing.holdMs / duration;
    const rise = reduced ? "0px" : units(-STATUS_PILL.tick.rise);
    const animation = node.animate(
      [
        { offset: 0, opacity: 1, translate: "0 0" },
        { offset: hold, opacity: 1, translate: "0 0" },
        { easing: "ease-out", offset: hold, opacity: 1, translate: "0 0" },
        { offset: 1, opacity: 0, translate: `0 ${rise}` },
      ],
      { duration, fill: "forwards" },
    );
    const current = { amount: total, animation, node };
    tick = current;
    void animation.finished
      .then(() => {
        if (tick === current) {
          node.remove();
          tick = null;
          nextSpend();
        }
      })
      .catch(() => undefined);
  };
  return {
    clearSpend() {
      spendQueue.length = 0;
      if (tick && tick.amount < 0) {
        tick.animation.cancel();
        tick.node.remove();
        tick = null;
      }
    },
    count,
    set(value, label, nowMs) {
      const next = pillCount(value);
      if (text.data !== next) {
        text.data = next;
        slot.style.width = units(countSlot(next));
      }
      const spoken = label ?? stardustCount(value);
      if (count.getAttribute("aria-label") !== spoken) {
        count.setAttribute("aria-label", spoken);
      }
      if (shown !== undefined && value > shown) {
        gain(value - shown, nowMs);
      }
      shown = value;
    },
    slot,
    spend: (amount, nowMs) => {
      if (amount > 0) {
        spendQueue.push({ amount, nowMs });
        if (!tick || tick.amount > 0) {
          nextSpend();
        }
      }
    },
    spending: () => (tick?.amount ?? 0) < 0,
  };
}

/** An item notice's landing bump: the art scales 1 to bumpScale to 1. */
function bump(element: HTMLElement): void {
  element.animate(
    [
      { transform: "scale(1)" },
      { transform: `scale(${STATUS_TIMING.bumpScale})` },
      { transform: "scale(1)" },
    ],
    { duration: STATUS_TIMING.bumpMs, easing: "ease-out" },
  );
}

export function createStatusPill(
  parent: HTMLElement,
  options: {
    readonly onResource?: (kind: "ore" | "stardust" | "aboard", origin: HTMLElement) => void;
    readonly reducedMotion: () => boolean;
    readonly shieldLabel: string;
  },
) {
  const root = document.createElement("div");
  root.className = "ada-status";
  root.hidden = true;
  const shieldRoot = document.createElement("div");
  shieldRoot.className = "ada-shield";
  shieldRoot.hidden = true;
  // The icon's outline is a filter on a wrapper: the icon's own mask would clip it.
  const shieldMark = document.createElement("span");
  shieldMark.className = "ada-status-mark";
  shieldMark.setAttribute("aria-hidden", "true");
  const icon = document.createElement("span");
  icon.className = "ada-status-shield";
  shieldMark.append(icon);
  const meter = document.createElement("span");
  meter.className = "ada-status-bar";
  meter.setAttribute("role", "meter");
  meter.setAttribute("aria-label", options.shieldLabel);
  meter.setAttribute("aria-valuemin", "0");
  const [fill, delay, flash, edge] = ["fill", "delay", "flash", "edge"].map((part) => {
    const node = document.createElement("span");
    node.className = `ada-status-${part}`;
    node.setAttribute("aria-hidden", "true");
    meter.append(node);
    return node;
  }) as [HTMLSpanElement, HTMLSpanElement, HTMLSpanElement, HTMLSpanElement];
  const rechargeTrack = document.createElement("span");
  rechargeTrack.className = "ada-status-recharge-track";
  rechargeTrack.setAttribute("aria-hidden", "true");
  const recharge = document.createElement("span");
  recharge.className = "ada-status-recharge";
  rechargeTrack.append(recharge);
  shieldRoot.append(shieldMark, meter, rechargeTrack);
  const sparkle = document.createElement("span");
  sparkle.className = "ada-status-stardust";
  sparkle.setAttribute("aria-hidden", "true");
  const stardust = createCounter("stardust", options.reducedMotion);
  stardust.count.setAttribute("role", "status");
  const part = (className: string) => {
    const node = document.createElement("span");
    node.className = className;
    node.setAttribute("aria-hidden", "true");
    node.hidden = true;
    return node;
  };
  const oreDivider = part("ada-status-divider");
  const oreIcon = part("ada-status-cargo ada-status-ore");
  oreIcon.removeAttribute("aria-hidden");
  oreIcon.setAttribute("role", "img");
  const ore = createCounter("ore", options.reducedMotion);
  ore.slot.hidden = true;
  const aboardDivider = part("ada-status-divider");
  const aboardIcon = part("ada-status-cargo ada-status-aboard");
  aboardIcon.removeAttribute("aria-hidden");
  aboardIcon.setAttribute("role", "img");
  root.append(sparkle, stardust.slot, oreDivider, oreIcon, ore.slot, aboardDivider, aboardIcon);
  if (options.onResource) {
    for (const [kind, nodes, action] of [
      ["stardust", [sparkle, stardust.slot], stardust.count],
      ["ore", [oreIcon, ore.slot], ore.count],
      ["aboard", [aboardIcon], aboardIcon],
    ] as const) {
      action.setAttribute("role", "button");
      action.setAttribute("tabindex", "0");
      action.setAttribute("aria-haspopup", "dialog");
      action.dataset.action = `resource-${kind}`;
      const activate = () => options.onResource?.(kind, action);
      for (const node of nodes) {
        node.classList.add("ada-resource-target");
        node.addEventListener("pointerdown", (event) => event.stopPropagation());
        node.addEventListener("click", (event) => {
          event.stopPropagation();
          activate();
        });
      }
      action.addEventListener("keydown", (event) => {
        if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
          event.preventDefault();
          event.stopPropagation();
          activate();
        }
      });
    }
  }

  parent.append(root, shieldRoot);

  const shieldBar = new ShieldBar();
  const shieldOre = new ShieldOreSpendCounter();

  const place = (node: HTMLElement, from: number, to: number) => {
    const offset = SHIELD_PILL.bar.inset;
    node.hidden = to <= from;
    node.style.left = units(offset + from);
    node.style.width = units(Math.max(0, to - from));
  };

  // Transient overlays never colour the unfilled track.
  const paintInsideFill = (fillWidth: number, range: ShieldBarView["delay"], node: HTMLElement) =>
    place(node, Math.min(fillWidth, range?.from ?? 0), Math.min(fillWidth, range?.to ?? 0));

  return {
    /** An item notice landed on the cargo segment: its icon bumps, as the count does. */
    bumpCargo(): void {
      bump(aboardIcon);
    },
    /** An item notice landed on the shield bar: the shield icon bumps. */
    bumpShield(): void {
      bump(icon);
    },
    dispose: () => {
      ore.clearSpend();
      root.remove();
      shieldRoot.remove();
    },
    /** Set the loaded/new flight total before its first status update. */
    resetShieldOreSpent(total?: number): void {
      shieldOre.reset(total);
      ore.clearSpend();
    },
    setShown(shown: boolean): void {
      root.hidden = !shown;
      shieldRoot.hidden = !shown;
    },
    setStatus(view: StatusView, nowMs: number): void {
      const bar = shieldBar.update(view, nowMs, options.reducedMotion());
      const level = String(Math.min(SHIELD_PILL.bars.length, Math.max(1, Math.round(view.level))));
      if (shieldRoot.dataset.level !== level) {
        shieldRoot.dataset.level = level;
      }
      if (shieldRoot.dataset.tone !== bar.tone) {
        shieldRoot.dataset.tone = bar.tone;
      }
      const field = view.lightField ? "light" : "dark";
      if (shieldRoot.dataset.field !== field) {
        shieldRoot.dataset.field = field;
      }
      const mark = shieldMarkColour(bar.tone, bar.pulse);
      shieldRoot.style.setProperty("--shield-mark", mark);
      shieldRoot.style.setProperty(
        "--shield-rim",
        bar.tone === "normal" ? STATUS_COLOURS.rim : mark,
      );
      place(fill, 0, bar.fill);
      paintInsideFill(bar.fill, bar.delay, delay);
      paintInsideFill(bar.fill, bar.flash, flash);
      place(edge, Math.max(0, bar.fill - SHIELD_PILL.edge), bar.edge ? bar.fill : 0);
      rechargeTrack.hidden = bar.recharge === null;
      if (bar.recharge !== null) {
        const { strip, track } = shieldDelayStrip(Number(level), bar.recharge);
        rechargeTrack.style.left = units(
          SHIELD_PILL.padding.left + SHIELD_PILL.icon + SHIELD_PILL.iconGap + track.x,
        );
        rechargeTrack.style.top = units(
          (SHIELD_PILL.pill.height - SHIELD_PILL.bar.height) / 2 + track.y,
        );
        rechargeTrack.style.width = units(track.width);
        rechargeTrack.style.height = units(track.height);
        recharge.style.width = units(strip.width);
      }
      meter.setAttribute("aria-valuemax", String(view.capacity));
      meter.setAttribute("aria-valuenow", String(Math.max(0, Math.round(view.shield))));
      stardust.set(view.stardust, view.stardustLabel, nowMs);
      ore.set(view.ore, null, nowMs);
      ore.spend(shieldOre.update(view.shieldOreSpent, view.recharging), nowMs);
      const segments = statusSegments(view);
      const hasOre = segments.includes("ore") || ore.spending();
      oreDivider.hidden = !hasOre;
      oreIcon.hidden = !hasOre;
      ore.slot.hidden = !hasOre;
      if (oreIcon.getAttribute("aria-label") !== view.oreLabel) {
        oreIcon.setAttribute("aria-label", view.oreLabel);
      }
      const aboard = view.aboard;
      aboardDivider.hidden = !aboard;
      aboardIcon.hidden = !aboard;
      if (aboard) {
        if (aboardIcon.dataset.kind !== aboard.kind) {
          aboardIcon.dataset.kind = aboard.kind;
        }
        if (aboardIcon.getAttribute("aria-label") !== aboard.label) {
          aboardIcon.setAttribute("aria-label", aboard.label);
        }
      }
    },
    /** The pill's drawn width in logical px, 0 while hidden. */
    width(): number {
      if (root.hidden) {
        return 0;
      }
      return parseFloat(getComputedStyle(root).width) / readViewUnit(root);
    },
  };
}
