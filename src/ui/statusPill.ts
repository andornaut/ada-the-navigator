import { LIGHT_FIELD } from "../game/lightField.ts";
import { controlsLine, font, fromHudEdge, hudCentreX, units } from "./layout/css.ts";
import {
  countSlot,
  SHIELD_PILL,
  shieldBarWidth,
  shieldFillWidth,
  shieldPillWidth,
  STATUS_PILL,
  STICK_AREA_MARGIN,
} from "./layout/playView.ts";
import { TYPE } from "./layout/tokens.ts";
import { readViewUnit } from "./layout/viewScale.ts";

// The HUD status pill (art/layout.md "Status pill", art/controls.md "Status pill"): one ink pill
// beside pause holding the Stardust count, then, while Ada carries them, her ore count and the job
// or story item or towed craft (gameplay/rules.md), each after its own divider; Stardust and ore
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
  lowPeak: "#ff8a80",
  // The ore +N tick: ore's light rust (art/controls.md "Status pill").
  oreTick: "#eaa676",
  panel: "rgb(24 20 37 / 0.65)",
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
  readonly shield: number;
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
    return {
      delay,
      edge: input.recharging && shield > 0 && shield < capacity,
      fill: at(shield),
      flash,
      pulse:
        tone === "low" && !reducedMotion
          ? (1 - Math.cos((2 * Math.PI * nowMs) / STATUS_TIMING.pulseMs)) / 2
          : 0,
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

// An exact count, en-US grouped: the counts' accessible labels, the +N ticks and the Ship card
// (gameplay/economy.md). The pill draws its counts with pillCount.
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
  return [
    ...(view.ore > 0 ? (["ore"] as const) : []),
    ...(view.aboard ? (["aboard"] as const) : []),
  ];
}

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
  padding:0 ${units(SHIELD_PILL.pill.padding)};
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
  margin-right:${units(SHIELD_PILL.markGap)}
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
  border:${units(bar.rim)} solid var(--shield-rim);
  background:${STATUS_COLOURS.track}
}
.ada-controls .ada-shield[data-field=light] .ada-status-bar{
  box-shadow:0 0 0 ${units(LIGHT_OUTLINE.width)} ${LIGHT_OUTLINE.ink}
}
.ada-controls .ada-status-bar > span{
  position:absolute;
  top:${units(bar.inset - bar.rim)};
  height:${units(bar.height - 2 * bar.inset)};
  left:${units(bar.inset - bar.rim)};
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
  readonly recharging: boolean;
  readonly shield: number;
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
  const gain = (amount: number, now: number) => {
    const reduced = reducedMotion();
    if (!reduced && now - lastBump >= STATUS_TIMING.bumpMs) {
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
    const total = (tick?.amount ?? 0) + amount;
    tick?.animation.cancel();
    tick?.node.remove();
    const node = document.createElement("span");
    node.className = "ada-status-tick";
    node.dataset.kind = kind;
    node.setAttribute("aria-hidden", "true");
    node.textContent = `+${stardustCount(total)}`;
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
        }
      })
      .catch(() => undefined);
  };
  return {
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
  options: { readonly reducedMotion: () => boolean; readonly shieldLabel: string },
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
  shieldRoot.append(shieldMark, meter);
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
  parent.append(root, shieldRoot);

  const shieldBar = new ShieldBar();

  const place = (node: HTMLElement, from: number, to: number) => {
    const offset = SHIELD_PILL.bar.inset - SHIELD_PILL.bar.rim;
    node.hidden = to <= from;
    node.style.left = units(offset + from);
    node.style.width = units(Math.max(0, to - from));
  };

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
      root.remove();
      shieldRoot.remove();
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
      place(delay, bar.delay?.from ?? 0, bar.delay?.to ?? 0);
      place(flash, bar.flash?.from ?? 0, bar.flash?.to ?? 0);
      place(edge, Math.max(0, bar.fill - SHIELD_PILL.edge), bar.edge ? bar.fill : 0);
      meter.setAttribute("aria-valuemax", String(view.capacity));
      meter.setAttribute("aria-valuenow", String(Math.max(0, Math.round(view.shield))));
      stardust.set(view.stardust, view.stardustLabel, nowMs);
      const segments = statusSegments(view);
      const hasOre = segments.includes("ore");
      oreDivider.hidden = !hasOre;
      oreIcon.hidden = !hasOre;
      ore.slot.hidden = !hasOre;
      ore.set(view.ore, null, nowMs);
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
