import { LIGHT_FIELD } from "../game/light-field.ts";
import { font, fromHudEdge, units } from "./layout/css.ts";
import { STATUS_PILL } from "./layout/playView.ts";
import { TYPE } from "./layout/tokens.ts";
import { readViewUnit } from "./layout/viewScale.ts";

// The HUD status pill (art/layout.md "Status pill", art/controls.md "Status pill"): one ink pill
// beside pause holding the shield bar and the Stardust count. The bar draws in CSS at logical
// units with fractional widths; the shield's states are a pure function of what the model shows
// each frame, so they are tested without a browser. On a light field the shield icon and bar
// each draw inside an ink outline (art/galaxies.md "Light fields").

export const STATUS_COLOURS = {
  count: "#ead4aa",
  divider: "#57536e",
  flash: "#ffffff",
  low: "#e4574e",
  lowPeak: "#ff8a80",
  panel: "rgb(24 20 37 / 0.65)",
  rim: "#9a96ad",
  shield: "#70ace8",
  shieldDelay: "#4f7aa6",
  tick: "#8ee8a8",
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
  // Whether the shield is regenerating: the recharge delay has passed and it is below capacity.
  readonly recharging: boolean;
  readonly shield: number;
}

export type ShieldTone = "empty" | "low" | "normal";

// The bar as drawn: each part's start and end in the 92 fill area, the tone and the pulse (0 at
// the low colour, 1 at the peak).
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
    const area = STATUS_PILL.bar.fill.width;
    const at = (value: number) => (area * value) / capacity;
    const tone: ShieldTone =
      shield <= 0 ? "empty" : shield < STATUS_PILL.low * capacity ? "low" : "normal";
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

// The count as Gameplay shows it: a whole number with thousands separators.
const COUNT_FORMAT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export function stardustCount(amount: number): string {
  return COUNT_FORMAT.format(Math.max(0, Math.floor(amount)));
}

const { bar } = STATUS_PILL;
// The count's line box top inside the pill, and so the +N tick's top below the count.
const COUNT_TOP = (STATUS_PILL.pill.height - TYPE.label.lineHeight) / 2;
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

export const STATUS_PILL_STYLE = `
.ada-controls .ada-status{
  position:absolute;
  left:${fromHudEdge("left", STATUS_PILL.x)};
  top:${fromHudEdge("top", STATUS_PILL.y)};
  box-sizing:border-box;
  height:${units(STATUS_PILL.pill.height)};
  padding:0 ${units(STATUS_PILL.pill.padding)};
  display:flex;
  align-items:center;
  border-radius:${units(STATUS_PILL.pill.radius)};
  background:${STATUS_COLOURS.panel};
  font:${font(TYPE.label)};
  color:${STATUS_COLOURS.count};
  white-space:nowrap;
  pointer-events:none;
  --shield-mark:${STATUS_COLOURS.shield};
  --shield-rim:${STATUS_COLOURS.rim}
}
.ada-controls .ada-status-mark{
  flex:none;
  display:flex;
  margin-right:${units(STATUS_PILL.markGap)}
}
.ada-controls .ada-status[data-field=light] .ada-status-mark{
  filter:${ICON_OUTLINE}
}
.ada-controls .ada-status-shield{
  width:${units(STATUS_PILL.icon)};
  height:${units(STATUS_PILL.icon)};
  background:var(--shield-mark);
  -webkit-mask:url('/art/ui/icons/shield.svg') center / 100% 100% no-repeat;
  mask:url('/art/ui/icons/shield.svg') center / 100% 100% no-repeat
}
.ada-controls .ada-status-bar{
  position:relative;
  flex:none;
  box-sizing:border-box;
  width:${units(bar.width)};
  height:${units(bar.height)};
  border:${units(bar.rim)} solid var(--shield-rim);
  background:${STATUS_COLOURS.track}
}
.ada-controls .ada-status[data-field=light] .ada-status-bar{
  box-shadow:0 0 0 ${units(LIGHT_OUTLINE.width)} ${LIGHT_OUTLINE.ink}
}
.ada-controls .ada-status-bar > span{
  position:absolute;
  top:${units(bar.inset - bar.rim)};
  height:${units(bar.fill.height)};
  left:${units(bar.inset - bar.rim)};
  width:0
}
.ada-controls .ada-status-fill{
  background:${STATUS_COLOURS.shield}
}
.ada-controls .ada-status[data-tone=low] .ada-status-fill{
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
  margin-right:${units(STATUS_PILL.markGap)};
  background:url('/art/ui/sprites/icon-stardust-20.png') 0 0 / 100% 100% no-repeat;
  image-rendering:pixelated
}
.ada-controls .ada-status-count{
  position:relative;
  display:inline-block;
  line-height:${units(TYPE.label.lineHeight)};
  transform-origin:left center
}
.ada-controls .ada-status-tick{
  position:absolute;
  left:50%;
  top:${units(STATUS_PILL.tick.top - COUNT_TOP)};
  transform:translateX(-50%);
  color:${STATUS_COLOURS.tick};
  text-shadow:${OUTLINE_SHADOW}
}
`;

export interface StatusView {
  readonly capacity: number;
  // Whether the field under the HUD is light, which outlines the shield icon and bar.
  readonly lightField: boolean;
  readonly recharging: boolean;
  readonly shield: number;
  readonly stardust: number;
  // The count's spoken label, such as "260 Stardust".
  readonly stardustLabel: string;
}

export function createStatusPill(
  parent: HTMLElement,
  options: { readonly reducedMotion: () => boolean; readonly shieldLabel: string },
) {
  const root = document.createElement("div");
  root.className = "ada-status";
  root.hidden = true;
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
  const divider = document.createElement("span");
  divider.className = "ada-status-divider";
  divider.setAttribute("aria-hidden", "true");
  const sparkle = document.createElement("span");
  sparkle.className = "ada-status-stardust";
  sparkle.setAttribute("aria-hidden", "true");
  const count = document.createElement("span");
  count.className = "ada-status-count";
  count.setAttribute("role", "status");
  const countText = document.createTextNode("");
  count.append(countText);
  root.append(shieldMark, meter, divider, sparkle, count);
  parent.append(root);

  const shieldBar = new ShieldBar();
  let stardust: number | undefined;
  let tick: { amount: number; node: HTMLSpanElement; animation: Animation } | null = null;
  let lastBump = -Infinity;

  const place = (node: HTMLElement, from: number, to: number) => {
    const offset = STATUS_PILL.bar.inset - STATUS_PILL.bar.rim;
    node.hidden = to <= from;
    node.style.left = units(offset + from);
    node.style.width = units(Math.max(0, to - from));
  };

  const pickup = (gain: number, now: number) => {
    const reduced = options.reducedMotion();
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
    const amount = (tick?.amount ?? 0) + gain;
    tick?.animation.cancel();
    tick?.node.remove();
    const node = document.createElement("span");
    node.className = "ada-status-tick";
    node.setAttribute("aria-hidden", "true");
    node.textContent = `+${stardustCount(amount)}`;
    count.append(node);
    const timing = reduced ? STATUS_TIMING.tickReduced : STATUS_TIMING.tick;
    const total = timing.holdMs + timing.fadeMs;
    const hold = timing.holdMs / total;
    const rise = reduced ? "0px" : units(-STATUS_PILL.tick.rise);
    const animation = node.animate(
      [
        { offset: 0, opacity: 1, translate: "0 0" },
        { offset: hold, opacity: 1, translate: "0 0" },
        { easing: "ease-out", offset: hold, opacity: 1, translate: "0 0" },
        { offset: 1, opacity: 0, translate: `0 ${rise}` },
      ],
      { duration: total, fill: "forwards" },
    );
    const current = { amount, animation, node };
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
    dispose: () => root.remove(),
    setShown(shown: boolean): void {
      root.hidden = !shown;
    },
    setStatus(view: StatusView, nowMs: number): void {
      const bar = shieldBar.update(view, nowMs, options.reducedMotion());
      if (root.dataset.tone !== bar.tone) {
        root.dataset.tone = bar.tone;
      }
      const field = view.lightField ? "light" : "dark";
      if (root.dataset.field !== field) {
        root.dataset.field = field;
      }
      const mark = shieldMarkColour(bar.tone, bar.pulse);
      root.style.setProperty("--shield-mark", mark);
      root.style.setProperty("--shield-rim", bar.tone === "normal" ? STATUS_COLOURS.rim : mark);
      place(fill, 0, bar.fill);
      place(delay, bar.delay?.from ?? 0, bar.delay?.to ?? 0);
      place(flash, bar.flash?.from ?? 0, bar.flash?.to ?? 0);
      place(edge, Math.max(0, bar.fill - STATUS_PILL.edge), bar.edge ? bar.fill : 0);
      meter.setAttribute("aria-valuemax", String(view.capacity));
      meter.setAttribute("aria-valuenow", String(Math.max(0, Math.round(view.shield))));
      const text = stardustCount(view.stardust);
      if (countText.data !== text) {
        countText.data = text;
      }
      if (count.getAttribute("aria-label") !== view.stardustLabel) {
        count.setAttribute("aria-label", view.stardustLabel);
      }
      if (stardust !== undefined && view.stardust > stardust) {
        pickup(view.stardust - stardust, nowMs);
      }
      stardust = view.stardust;
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
