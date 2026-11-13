import type { Weapon } from "../data/types.ts";
import { UPGRADE_TIER_COLOURS } from "../data/upgradeTiers.ts";
import { WEAPON_LEVEL_COUNT } from "../data/weaponCatalog.ts";
import { weaponGlyphPath } from "../data/weaponGlyphs.ts";
import { AmmoFeedbackQueue } from "./ammoFeedback.ts";
import { FOCUS_RING } from "./layout/controls.ts";
import { font, fromHudEdge, units } from "./layout/css.ts";
import { HUD_AMMO_COUNT, HUD_BUTTON, HUD_ROW, HUD_WEAPON_LEVEL } from "./layout/playView.ts";
import { TYPE } from "./layout/tokens.ts";
import { refuse } from "./refusal.ts";

export interface WeaponChoice {
  readonly id: Weapon;
  /** The weapon's level, 1 to 3, shown by its disc's edge colour and pips. */
  readonly level: number;
  readonly selected: boolean;
  /** Shots left; null for Laser, which shows no count. */
  readonly ammo: number | null;
}

export interface WeaponLabels {
  /** A non-Laser weapon button's accessible label, `weaponAmmoLabel`: "{weapon}, {count} left". */
  readonly ammo: string;
  readonly group: string;
  readonly names: Readonly<Record<Weapon, string>>;
}

const SHOTS_FORMAT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/**
 * A weapon button's accessible label: Laser's name, or the weapon and its exact count, en-US
 * grouped ("Rapid Missile, 1,200 left"), not the pill's four-character form.
 */
export function weaponButtonLabel(labels: WeaponLabels, choice: WeaponChoice): string {
  const name = labels.names[choice.id];
  if (choice.ammo === null) {
    return name;
  }
  const values: Readonly<Record<string, string>> = {
    count: SHOTS_FORMAT.format(choice.ammo),
    weapon: name,
  };
  return labels.ammo.replace(/\{(\w+)\}/gu, (match, key: string) => values[key] ?? match);
}

interface WeaponSelectorOptions {
  readonly labels: WeaponLabels;
  readonly onHold?: (choice: WeaponChoice, origin: HTMLElement) => void;
  /** Returns whether the switch was refused, so the pressed icon plays the refusal cue. */
  readonly onSelect: (weapon: Weapon) => boolean;
  readonly reducedMotion: () => boolean;
}

export type WeaponButtonState = "empty" | "idle" | "selected";

/**
 * Art's HUD button states: the selected weapon, an unselected weapon with no ammunition left,
 * and every other owned weapon idle.
 */
export function weaponButtonState(choice: WeaponChoice): WeaponButtonState {
  if (choice.selected) {
    return "selected";
  }
  return choice.ammo === 0 ? "empty" : "idle";
}

/**
 * A weapon's ammunition count in at most four characters: the exact number to 9999, then
 * whole thousands from 10k to 999k, then whole millions from 1m to 999m.
 */
export function ammoCount(shots: number): string {
  const whole = Math.max(0, Math.floor(shots));
  if (whole <= 9999) {
    return String(whole);
  }
  if (whole < 1_000_000) {
    return `${Math.floor(whole / 1000)}k`;
  }
  return `${Math.min(999, Math.floor(whole / 1_000_000))}m`;
}

// Shared HUD disc defaults and the selected weapon's transparent face, ink edge and glyph colour
// (art/controls.md "Top-right HUD icon buttons"). Empty is an unselected weapon with no
// ammunition: its glyph is the idle lavender mixed toward the navy face.
export const HUD_DISC_STATES = {
  empty: { edge: HUD_BUTTON.edge, face: "#262b44", glyph: "#75748c" },
  idle: { edge: HUD_BUTTON.edge, face: "#262b44", glyph: "#b8b3c9" },
  selected: { edge: HUD_BUTTON.annulus, face: "transparent", glyph: "#ead4aa" },
} as const satisfies Record<WeaponButtonState, unknown>;

// The count pill's text (art/controls.md "Ammunition count"): cream in every state, the empty
// state's "0" red; the refusal cue tints only the glyph.
export const AMMO_COUNT_TEXT = { empty: "#e4574e", normal: "#ead4aa" } as const;

const INK = "#181425";

// A disc's ink edge, its level's tier edge, halo and light-field outline (transparent at level 1
// and on discs without a level), and with focus the shared focus ring outside it, round with the
// disc.
const { pip } = HUD_WEAPON_LEVEL;
const LEVEL_SHADOWS = `inset 0 0 0 ${units(HUD_BUTTON.edge)} var(--level-edge, transparent)`;
const LEVEL_HALO = `0 0 0 ${units(HUD_WEAPON_LEVEL.outline)} var(--level-outline, transparent),0 0 ${units(
  HUD_WEAPON_LEVEL.halo.blur,
)} ${units(HUD_WEAPON_LEVEL.halo.spread)} var(--level-halo, transparent)`;
const discShadow = (focused: boolean) =>
  focused
    ? `${LEVEL_SHADOWS},inset 0 0 0 var(--disc-edge) ${INK},0 0 0 ${units(FOCUS_RING.fringe)} ${INK},0 0 0 ${units(
        FOCUS_RING.outset,
      )} ${INK},${LEVEL_HALO}`
    : `${LEVEL_SHADOWS},inset 0 0 0 var(--disc-edge) ${INK},${LEVEL_HALO}`;

/** A weapon level's pip colour (art/controls.md "Weapon level"): lavender at 1, then the tier. */
export const LEVEL_PIPS = {
  1: "#b8b3c9",
  2: UPGRADE_TIER_COLOURS[2],
  3: UPGRADE_TIER_COLOURS[3],
} as const;

// One HUD disc button's chrome: a target that is its press area, a smooth disc centred in it, and
// a glyph centred on the disc, drawn in CSS at logical units so it stays sharp at any scale. The
// start screen's Settings shares it.
export function hudDiscStyle(button: string, disc: string): string {
  return `
${button}{
  box-sizing:border-box;
  width:${units(HUD_BUTTON.target)};
  height:${units(HUD_BUTTON.target)};
  min-width:0;
  min-height:0;
  margin:0;
  padding:0;
  display:grid;
  place-items:center;
  border:0;
  border-radius:0;
  background:transparent;
  color:${HUD_DISC_STATES.idle.glyph};
  cursor:pointer;
  pointer-events:auto;
  touch-action:manipulation;
  --disc-edge:${units(HUD_DISC_STATES.idle.edge)}
}
${button} ${disc}{
  box-sizing:border-box;
  width:${units(HUD_BUTTON.disc)};
  height:${units(HUD_BUTTON.disc)};
  display:grid;
  place-items:center;
  border-radius:50%;
  background:${HUD_DISC_STATES.idle.face};
  box-shadow:${discShadow(false)};
  pointer-events:none
}
${button}:focus-visible{
  outline:none;
  box-shadow:none
}
${button}:focus-visible ${disc}{
  outline:${units(FOCUS_RING.band)} solid #ead4aa;
  outline-offset:${units(FOCUS_RING.fringe)};
  box-shadow:${discShadow(true)}
}
${button} ${disc}::before{
  content:"";
  width:${units(HUD_BUTTON.glyph)};
  height:${units(HUD_BUTTON.glyph)};
  background:currentColor;
  -webkit-mask:var(--glyph) center / 100% 100% no-repeat;
  mask:var(--glyph) center / 100% 100% no-repeat
}
`;
}

// The top-right weapon buttons (art/controls.md "Top-right HUD icon buttons"), Chibi's skill
// buttons: HUD_BUTTON targets a gap apart in the HUD row, reaching HUD_ROW.reach past the HUD
// rect's top-right corner so the outermost disc's drawn edge and the discs' drawn tops sit on it. Each
// glyph is a mask over currentColor, so a state's colour, and the refusal cue's red text colour,
// tint it; selection, lock and refusal never resize the disc or glyph.
export const WEAPON_STYLE = `
.ada-controls .ada-weapon-selector{
  position:absolute;
  right:${fromHudEdge("right", -HUD_ROW.reach)};
  top:${fromHudEdge("top", -HUD_ROW.reach)};
  display:flex;
  gap:${units(HUD_BUTTON.gap)}
}
${hudDiscStyle(".ada-controls .ada-weapon", ".ada-disc")}
.ada-controls .ada-weapon{
  position:relative
}
.ada-controls .ada-weapon .ada-disc{
  position:relative;
  background:transparent;
  box-shadow:none
}
.ada-controls .ada-weapon[data-state=idle] .ada-disc::before{
  opacity:0.55
}
.ada-controls .ada-weapon[data-state=empty] .ada-disc::before{
  opacity:0.35
}
.ada-controls .ada-weapon[data-state=selected] .ada-disc::before{
  opacity:1
}
/* The shared refusal attribute keeps the red glyph at full strength. */
.ada-controls .ada-weapon[data-ui-refusal-red] .ada-disc::before{
  opacity:1
}
/* Weapon glyphs stay readable on the light field; selection keeps its cream ring. */
.ada-controls .ada-weapon-selector[data-field=light] .ada-weapon{
  color:${INK}
}
.ada-controls .ada-ammo{
  position:absolute;
  left:50%;
  top:${units(HUD_AMMO_COUNT.top)};
  transform:translateX(-50%);
  box-sizing:border-box;
  height:${units(HUD_AMMO_COUNT.height)};
  padding:0 ${units(HUD_AMMO_COUNT.padding)};
  border-radius:${units(HUD_AMMO_COUNT.radius)};
  background:${HUD_DISC_STATES.idle.face};
  box-shadow:inset 0 0 0 ${units(HUD_BUTTON.edge)} ${INK};
  font:${font(TYPE.count)};
  white-space:nowrap;
  color:${AMMO_COUNT_TEXT.normal};
  pointer-events:none
}
.ada-controls .ada-ammo-gain{
  position:absolute;
  left:50%;
  top:${units(HUD_AMMO_COUNT.top + HUD_AMMO_COUNT.height + 4)};
  transform:translateX(-50%);
  padding:0 ${units(HUD_AMMO_COUNT.padding)};
  border-radius:${units(HUD_AMMO_COUNT.radius)};
  background:${INK};
  font:${font(TYPE.count)};
  white-space:nowrap;
  color:${AMMO_COUNT_TEXT.normal};
  pointer-events:none
}
.ada-controls .ada-ammo-gain[hidden]{
  display:none
}
.ada-controls .ada-weapon[data-state=empty]{
  color:${HUD_DISC_STATES.empty.glyph}
}
.ada-controls .ada-weapon[data-state=empty] .ada-ammo{
  color:${AMMO_COUNT_TEXT.empty}
}
.ada-controls .ada-weapon[data-state=selected]{
  color:${HUD_DISC_STATES.selected.glyph};
  --disc-edge:${units(HUD_DISC_STATES.selected.edge)}
}
.ada-controls .ada-weapon[data-state=selected] .ada-disc{
  background:${HUD_DISC_STATES.selected.face}
}
/* Every weapon uses one annulus inside the canonical disc, with ink on both edges. */
.ada-controls .ada-weapon .ada-disc::after{
  content:"";
  position:absolute;
  inset:${units(HUD_BUTTON.edge)};
  box-sizing:border-box;
  border:${units(HUD_BUTTON.annulus - 2 * HUD_BUTTON.edge)} solid var(--weapon-ring, ${HUD_DISC_STATES.empty.glyph});
  border-radius:50%;
  background:transparent;
  box-shadow:0 0 0 ${units(HUD_BUTTON.edge)} ${INK},
    inset 0 0 0 ${units(HUD_BUTTON.edge)} ${INK};
  pointer-events:none
}
.ada-controls .ada-weapon[data-state=selected] .ada-disc::after{
  border-color:${HUD_DISC_STATES.selected.glyph}
}
.ada-controls .ada-weapon:disabled{
  cursor:default
}
${([2, 3] as const)
  .map(
    (level) => `.ada-controls .ada-weapon[data-level="${level}"] .ada-disc{
  --weapon-ring:${UPGRADE_TIER_COLOURS[level]}
}`,
  )
  .join("\n")}
/* The level's pips: one to three 4 discs in an ink outline, 7 apart, centred 12 below the disc's
   centre, the same in every state. */
.ada-controls .ada-pips{
  position:absolute;
  left:50%;
  top:${units(HUD_BUTTON.target / 2 + HUD_WEAPON_LEVEL.below)};
  transform:translate(-50%,-50%);
  display:flex;
  gap:${units(pip.pitch - pip.size)};
  pointer-events:none
}
.ada-controls .ada-pips > span{
  width:${units(pip.size)};
  height:${units(pip.size)};
  border-radius:50%;
  box-shadow:0 0 0 ${units(pip.outline)} ${INK}
}
${([1, 2, 3] as const)
  .map(
    (level) => `.ada-controls .ada-weapon[data-level="${level}"] .ada-pips > span{
  background:${LEVEL_PIPS[level]}
}`,
  )
  .join("\n")}
`;

export function createWeaponSelector(parent: HTMLElement, options: WeaponSelectorOptions) {
  const root = document.createElement("div");
  root.className = "ada-weapon-selector";
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", options.labels.group);
  root.hidden = true;
  parent.append(root);
  const buttons = new Map<Weapon, HTMLButtonElement>();
  let choices: readonly WeaponChoice[] = [];
  let enabled = false;
  const cancelHolds = new Set<() => void>();
  const feedback = new AmmoFeedbackQueue();
  let lastFeedbackTime: number | undefined;

  const render = (): void => {
    root.hidden = !enabled || choices.length === 0;
    const ids = new Set(choices.map((choice) => choice.id));
    for (const [id, entry] of buttons) {
      if (!ids.has(id)) {
        entry.remove();
        buttons.delete(id);
      }
    }
    for (const choice of choices) {
      let entry = buttons.get(choice.id);
      if (!entry) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ada-weapon";
        button.dataset.weapon = choice.id;
        const disc = document.createElement("span");
        disc.className = "ada-disc";
        disc.style.setProperty("--glyph", `url('${weaponGlyphPath(choice.id)}')`);
        disc.setAttribute("aria-hidden", "true");
        const pips = document.createElement("span");
        pips.className = "ada-pips";
        pips.setAttribute("aria-hidden", "true");
        button.append(disc, pips);
        if (choice.ammo !== null) {
          const count = document.createElement("span");
          count.className = "ada-ammo";
          count.setAttribute("aria-hidden", "true");
          button.append(count);
        }
        const gain = document.createElement("span");
        gain.className = "ada-ammo-gain";
        gain.hidden = true;
        gain.setAttribute("aria-live", "polite");
        gain.setAttribute("aria-atomic", "true");
        button.append(gain);
        let timer: ReturnType<typeof setTimeout> | undefined;
        let held = false;
        const cancelHold = () => {
          if (timer !== undefined) {
            clearTimeout(timer);
          }
          timer = undefined;
        };
        cancelHolds.add(cancelHold);
        button.addEventListener("pointerdown", (event) => {
          event.stopPropagation();
          cancelHold();
          held = false;
          if (!enabled || button.disabled || event.button !== 0 || !options.onHold) {
            return;
          }
          timer = setTimeout(() => {
            timer = undefined;
            const current = choices.find((item) => item.id === choice.id);
            if (!enabled || button.disabled || !current) {
              return;
            }
            held = true;
            options.onHold?.(current, button);
          }, 500);
        });
        button.addEventListener("pointerup", (event) => {
          event.stopPropagation();
          cancelHold();
          if (held) {
            event.preventDefault();
          }
        });
        button.addEventListener("pointercancel", cancelHold);
        button.addEventListener("pointerleave", cancelHold);
        button.addEventListener("keydown", () => {
          held = false;
          cancelHold();
        });
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          if (held) {
            held = false;
            event.preventDefault();
            return;
          }
          // A switch during the wait after the last one is refused with the shared cue.
          if (enabled && !button.disabled && options.onSelect(choice.id)) {
            refuse(button, options.reducedMotion());
          }
        });
        root.append(button);
        entry = button;
        buttons.set(choice.id, entry);
      }
      const name = options.labels.names[choice.id];
      const count = entry.querySelector(".ada-ammo");
      if (count && choice.ammo !== null) {
        count.textContent = ammoCount(choice.ammo);
      }
      entry.setAttribute("aria-label", weaponButtonLabel(options.labels, choice));
      entry.setAttribute("aria-pressed", String(choice.selected));
      entry.dataset.state = weaponButtonState(choice);
      const level = String(Math.min(WEAPON_LEVEL_COUNT, Math.max(1, Math.round(choice.level))));
      if (entry.dataset.level !== level) {
        entry.dataset.level = level;
        const pips = entry.querySelector(".ada-pips")!;
        pips.replaceChildren(
          ...Array.from({ length: Number(level) }, () => document.createElement("span")),
        );
      }
      entry.title = name;
      entry.disabled = !enabled;
    }
  };
  return {
    /** An item notice landed on a weapon's disc: its glyph bumps, scale 1 to 1.12 to 1. */
    bump(weapon: string): void {
      buttons
        .get(weapon as Weapon)
        ?.querySelector(".ada-disc")
        ?.animate(
          [{ transform: "scale(1)" }, { transform: "scale(1.12)" }, { transform: "scale(1)" }],
          { duration: 200, easing: "ease-out" },
        );
    },
    clearFeedback(): void {
      feedback.clear();
      lastFeedbackTime = undefined;
      for (const button of buttons.values()) {
        const gain = button.querySelector<HTMLElement>(".ada-ammo-gain");
        if (gain) {
          gain.hidden = true;
          gain.textContent = "";
        }
      }
    },
    dispose(): void {
      feedback.clear();
      for (const cancel of cancelHolds) {
        cancel();
      }
      cancelHolds.clear();
      root.remove();
    },
    setEnabled(value: boolean): void {
      enabled = value;
      if (!value) {
        for (const cancel of cancelHolds) {
          cancel();
        }
      }
      render();
    },
    /** Whether the field under the HUD is light, which outlines a levelled disc in ink. */
    setLightField(light: boolean): void {
      const field = light ? "light" : "dark";
      if (root.dataset.field !== field) {
        root.dataset.field = field;
      }
    },
    setWeapons(value: readonly WeaponChoice[]): void {
      choices = value;
      render();
    },
    /** Receives the amount actually added at the grant operation, after outcome handling. */
    showAmmoGain(weapon: Weapon, added: number): void {
      feedback.push(weapon, added);
    },
    /** The caller advances this beside item notices, pausing and hiding it under cards. */
    updateFeedback(now: number, running: boolean): void {
      const ms = lastFeedbackTime === undefined ? 0 : now - lastFeedbackTime;
      lastFeedbackTime = now;
      const frames = feedback.advance(ms, running);
      for (const [weapon, button] of buttons) {
        const gain = button.querySelector<HTMLElement>(".ada-ammo-gain");
        if (!gain) {
          continue;
        }
        const frame = frames.get(weapon);
        gain.hidden = !running || frame === undefined;
        if (frame) {
          const text = `+${SHOTS_FORMAT.format(frame.added)}`;
          if (gain.textContent !== text) {
            gain.setAttribute("aria-label", `${options.labels.names[weapon]} ${text}`);
            gain.textContent = text;
          }
          gain.style.opacity = String(frame.opacity);
        } else {
          gain.textContent = "";
        }
      }
    },
  };
}
