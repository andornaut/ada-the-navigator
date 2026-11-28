import { createActionGroup } from "@andornaut/game-kit/runtime/web/ui/dom/actionGroup";
import { createHudDisc } from "@andornaut/game-kit/runtime/web/ui/dom/hudDisc";

import { TASK_COLORS } from "../data/taskCategories.ts";
import type { Weapon } from "../data/types.ts";
import { UPGRADE_TIER_COLOURS } from "../data/upgradeTiers.ts";
import { WEAPON_LEVEL_COUNT } from "../data/weaponCatalog.ts";
import { weaponGlyphPath } from "../data/weaponGlyphs.ts";
import {
  ADA_ACTION_HOLD_MS,
  assertAdaActionBindings,
  assertAdaActionMetadata,
  bindAdaAction,
  resolveAdaHoldAction,
} from "./actionBinding.ts";
import { AmmoFeedbackQueue } from "./ammoFeedback.ts";
import { COLOURS } from "./layout/colours.ts";
import { SCROLL } from "./layout/contentCard.ts";
import { EXPANDED_VIEWPORT, font, fromHudEdge, units } from "./layout/css.ts";
import {
  EXPANDED_RAPID_DISC_INK_OFFSET,
  HUD_AMMO_COUNT,
  HUD_BUTTON,
  HUD_DISC_ICON_CENTER_OFFSET,
  HUD_ROW,
  HUD_WEAPON_LEVEL,
} from "./layout/playView.ts";
import { TYPE } from "./layout/tokens.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { invalidatePressScope } from "./pressScope.ts";
import { refuse } from "./refusal.ts";

export interface WeaponChoice {
  readonly id: Weapon;
  /** The weapon's level, 1 to 3, shown by pips at levels 2 and 3. */
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

// Shared HUD disc defaults and weapon state glyph colours
// (art/controls.md "Top-right HUD icon buttons"). Empty is an unselected weapon with no
// ammunition: its glyph is the idle lavender mixed toward the navy face.
export const HUD_DISC_STATES = {
  empty: { edge: HUD_BUTTON.edge, face: COLOURS.navy, glyph: COLOURS.emptyGlyph },
  idle: { edge: HUD_BUTTON.edge, face: COLOURS.navy, glyph: COLOURS.supporting },
  selected: { edge: HUD_BUTTON.annulus, face: COLOURS.navy, glyph: COLOURS.cream },
} as const satisfies Record<WeaponButtonState, unknown>;

/** Solid weapon faces use existing dark colours from Ada's fields and HUD palette. */
export const WEAPON_FILLS: Readonly<Record<Weapon, string>> = {
  heavyMissile: COLOURS.heavyMissileFace,
  laser: COLOURS.navy,
  multiLaser: COLOURS.multiLaserFace,
  phaser: COLOURS.ink,
  rapidMissile: COLOURS.baseField,
  scattershot: COLOURS.scattershotFace,
};

// The count follows selection: cream like the selected ring, otherwise grey, including zero.
// Refill labels stay cream and refusal tints only the glyph.
export const AMMO_COUNT_TEXT = { inactive: COLOURS.inactiveCount, normal: COLOURS.cream } as const;

const INK = COLOURS.ink;
const PRESSED_WEAPON =
  ".ada-controls .ada-weapon:is(:active,[data-weapon-pressed]):not(:disabled) .ada-disc";

// Permanent disc edges. The level details are transparent on discs without a level.
const { pip } = HUD_WEAPON_LEVEL;
const LEVEL_SHADOWS = `inset 0 0 0 ${units(HUD_BUTTON.edge)} var(--level-edge, transparent)`;
const LEVEL_HALO = `0 0 0 ${units(HUD_WEAPON_LEVEL.outline)} var(--level-outline, transparent),0 0 ${units(
  HUD_WEAPON_LEVEL.halo.blur,
)} ${units(HUD_WEAPON_LEVEL.halo.spread)} var(--level-halo, transparent)`;
const DISC_SHADOW = `${LEVEL_SHADOWS},inset 0 0 0 var(--disc-edge) ${INK},${LEVEL_HALO}`;

/** A weapon level's pip colour (art/controls.md "Weapon level"): lavender at 1, then the tier. */
export const LEVEL_PIPS = {
  1: COLOURS.supporting,
  2: UPGRADE_TIER_COLOURS[2],
  3: UPGRADE_TIER_COLOURS[3],
} as const;

// One HUD disc button's chrome: a target that is its press area, a smooth disc centred in it, and
// a glyph centred on the disc, drawn in CSS at logical units. Local Map tools and the
// decorative Weapon Details icon retain this style.
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
  font:inherit;
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
  box-shadow:${DISC_SHADOW};
  pointer-events:none
}
${button}:focus-visible{
  outline:none;
  box-shadow:none
}
${button}:focus-visible ${disc}{
  background:${HUD_DISC_STATES.selected.glyph};
  --disc-focus-glyph:${INK}
}
${button} ${disc}::before{
  content:"";
  width:${units(HUD_BUTTON.glyph)};
  height:${units(HUD_BUTTON.glyph)};
  background:var(--disc-focus-glyph,currentColor);
  -webkit-mask:var(--glyph) center / 100% 100% no-repeat;
  mask:var(--glyph) center / 100% 100% no-repeat
}
@media (forced-colors:active){
  ${button}:focus-visible ${disc}{
    forced-color-adjust:none;
    background:Highlight;
    --disc-focus-glyph:HighlightText
  }
  ${button} ${disc}::before{
    forced-color-adjust:none;
    background:var(--disc-focus-glyph,ButtonText)
  }
}
`;
}

// The top-right weapon buttons (art/controls.md "Top-right HUD icon buttons"), Chibi's skill
// buttons: HUD_BUTTON targets a gap apart in the HUD row, reaching HUD_ROW.reach past the HUD
// rect's top-right corner so the outermost disc's drawn edge and the discs' drawn tops sit on it. Each
// glyph is a mask over currentColor, so a state's colour, and the refusal cue's red text colour,
// tint it; selection, lock and refusal never resize the disc or glyph.
const rapidDiscInkOffset = units(EXPANDED_RAPID_DISC_INK_OFFSET);
const weaponDiscIconCenterOffset = units(HUD_DISC_ICON_CENTER_OFFSET);

// Kit's integer action-group ports use half units to preserve the symmetric 7.5-unit outsets.
const GROUP_SCALE = 2;
const weaponFace = { height: HUD_BUTTON.disc * GROUP_SCALE, width: HUD_BUTTON.disc * GROUP_SCALE };
const weaponPress = { margin: HUD_ROW.reach * GROUP_SCALE };
const weaponGap = (HUD_BUTTON.gap + 2 * HUD_ROW.reach) * GROUP_SCALE;
const weaponSizes = { weapon: { face: HUD_BUTTON.disc, icon: HUD_BUTTON.glyph } };

export const WEAPON_STYLE = `
.ada-controls .ada-weapon-selector{
  position:absolute;
  right:${fromHudEdge("right", -HUD_ROW.reach)};
  top:${fromHudEdge("top", -HUD_ROW.reach)};
  box-sizing:border-box;
  display:grid;
  height:${units(HUD_BUTTON.target)};
  padding:${units(HUD_ROW.reach)}
}
.ada-controls .ada-weapon-selector[hidden]{
  display:none
}
.ada-controls .ada-weapon-group{
  --ui-unit:calc(var(--ada-unit,1) / ${GROUP_SCALE})
}
${hudDiscStyle(".ada-controls span.ada-weapon", ".ada-disc")}
.ada-controls .ada-weapon{
  position:relative
}
.ada-controls .ada-weapon-group > .ada-weapon{
  --ui-action-length:inherit;
  --ui-unit:var(--ada-unit,1);
  position:absolute;
  color:${HUD_DISC_STATES.idle.glyph};
  overflow:visible
}
.ada-controls .ada-weapon-group > .ada-weapon .ada-disc{
  color:inherit;
  pointer-events:none
}
.ada-controls .ada-weapon-group > button.ada-weapon .ui-hud-disc-icon{
  /* Kit centres on a whole unit. Retain the original half-unit centring of the glyph. */
  translate:${weaponDiscIconCenterOffset} ${weaponDiscIconCenterOffset};
  color:var(--disc-focus-glyph,currentColor);
  opacity:1
}
.ada-controls .ada-weapon-glyph{
  background:currentColor;
  -webkit-mask:var(--glyph) center / 100% 100% no-repeat;
  mask:var(--glyph) center / 100% 100% no-repeat
}
.ada-controls .ada-weapon-group > .ada-weapon:focus-visible .ada-disc{
  background:${HUD_DISC_STATES.selected.glyph};
  --disc-focus-glyph:${INK}
}
/* The scaled mask's asymmetric ink bearings leave the darts left of the disc centre. */
@media ${EXPANDED_VIEWPORT}{
  .ada-controls .ada-weapon[data-weapon="rapidMissile"] .ada-weapon-glyph,
  .ada-controls span.ada-weapon[data-weapon="rapidMissile"] .ada-disc::before{
    translate:${rapidDiscInkOffset} 0
  }
}
.ada-controls .ada-weapon .ada-disc{
  background:var(--weapon-face, ${HUD_DISC_STATES.idle.face});
  box-shadow:none
}
.ada-controls span.ada-weapon .ada-disc{
  position:relative
}
/* Dark faces keep the same readable state glyph colours on every field. */
${(Object.keys(WEAPON_FILLS) as Weapon[])
  .map(
    (weapon) => `.ada-controls .ada-weapon[data-weapon="${weapon}"]{
  --weapon-face:${WEAPON_FILLS[weapon]}
}`,
  )
  .join("\n")}
.ada-controls .ada-ammo{
  position:absolute;
  left:50%;
  top:${units(HUD_AMMO_COUNT.top - HUD_ROW.reach)};
  transform:translateX(-50%);
  box-sizing:border-box;
  height:${units(HUD_AMMO_COUNT.height)};
  padding:0 ${units(HUD_AMMO_COUNT.padding)};
  border-radius:${units(HUD_AMMO_COUNT.radius)};
  background:${HUD_DISC_STATES.idle.face};
  box-shadow:inset 0 0 0 ${units(HUD_BUTTON.edge)} ${INK};
  font:${font(TYPE.count)};
  white-space:nowrap;
  color:${AMMO_COUNT_TEXT.inactive};
  pointer-events:none
}
.ada-controls .ada-ammo-gain{
  position:absolute;
  left:50%;
  top:${units(HUD_AMMO_COUNT.top - HUD_ROW.reach + HUD_AMMO_COUNT.height + 4)};
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
.ada-controls .ada-weapon[data-state=selected] .ada-ammo{
  color:${AMMO_COUNT_TEXT.normal}
}
.ada-controls .ada-weapon[data-state=selected]{
  color:${HUD_DISC_STATES.selected.glyph};
  --disc-edge:${units(HUD_DISC_STATES.selected.edge)}
}
.ada-controls .ada-weapon-group > button.ada-weapon[data-state=selected] .ada-disc{
  box-shadow:0 0 0 ${units(1)} ${TASK_COLORS.story}
}
.ada-controls .ada-weapon[data-state=selected]:not(:focus-visible) .ada-disc{
  background:${HUD_DISC_STATES.selected.face}
}
${PRESSED_WEAPON}{
  background:${COLOURS.pressedFace};
  --disc-focus-glyph:${COLOURS.white}
}
@media (forced-colors:active){
  ${PRESSED_WEAPON}{
    forced-color-adjust:none;
    background:ButtonText;
    --disc-focus-glyph:ButtonFace
  }
}
.ada-controls .ada-weapon[data-ui-refusal-red]:is(:focus-visible,:active,[data-weapon-pressed]) .ada-disc{
  --disc-focus-glyph:currentColor
}
/* A focused refusal keeps the existing focus text colour on the filled disc. */
.ada-controls .ada-weapon-group > .ada-weapon[data-ui-refusal-red]:focus-visible .ada-disc{
  --disc-focus-glyph:var(--ui-button-focus-text,HighlightText)
}
@media (forced-colors:active){
  .ada-controls .ada-weapon-group > button.ada-weapon[data-state=selected] .ada-disc{
    box-shadow:none;
    outline:${units(1)} solid ButtonText
  }
  .ada-controls .ada-weapon-group > .ada-weapon:focus-visible:not(:active,[data-weapon-pressed]) .ada-disc{
    forced-color-adjust:none;
    background:Highlight;
    --disc-focus-glyph:HighlightText
  }
  .ada-controls .ada-weapon-group > .ada-weapon:focus-visible:not(:active,[data-weapon-pressed]) .ada-disc::after{
    forced-color-adjust:none;
    border-color:HighlightText;
    box-shadow:none
  }
  .ada-controls .ada-weapon-glyph{
    forced-color-adjust:none;
    background:var(--disc-focus-glyph,ButtonText)
  }
}
/* Every weapon uses one annulus inside the canonical disc, with ink on both edges. */
.ada-controls .ada-weapon .ada-disc::after{
  content:"";
  forced-color-adjust:auto;
  position:absolute;
  inset:${units(HUD_BUTTON.edge)};
  box-sizing:border-box;
  border:${units(HUD_BUTTON.annulus - 2 * HUD_BUTTON.edge)} solid ${HUD_DISC_STATES.idle.glyph};
  border-radius:50%;
  background:transparent;
  box-shadow:0 0 0 ${units(HUD_BUTTON.edge)} ${INK},
    inset 0 0 0 ${units(HUD_BUTTON.edge)} ${INK};
  pointer-events:none
}
.ada-controls .ada-weapon[data-state=empty] .ada-disc::after{
  border-color:${HUD_DISC_STATES.empty.glyph}
}
.ada-controls .ada-weapon[data-state=selected] .ada-disc::after{
  border-color:${HUD_DISC_STATES.selected.glyph}
}
.ada-controls .ada-weapon:disabled{
  opacity:0.5;
  cursor:default
}
/* Levels 2 and 3 show two or three pips centred on the bottom ring stroke; level 1 has none. */
.ada-controls .ada-pips{
  position:absolute;
  left:50%;
  top:${units(HUD_BUTTON.target / 2 + HUD_WEAPON_LEVEL.below)};
  transform:translate(-50%,-50%);
  display:flex;
  gap:${units(pip.pitch - pip.size)};
  pointer-events:none
}
.ada-controls .ada-weapon-group .ada-pips{
  top:${units(HUD_BUTTON.disc / 2 + HUD_WEAPON_LEVEL.below)}
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
  const document = parent.ownerDocument;
  const root = document.createElement("div");
  root.className = "ada-weapon-selector";
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", options.labels.group);
  root.hidden = true;
  // The factory owns activation. Keep its successful native clicks inside the HUD.
  const stopWeaponClick = (event: MouseEvent) => {
    if (event.target !== root) {
      event.stopPropagation();
    }
  };
  root.addEventListener("click", stopWeaponClick);
  const group = createActionGroup(document, { className: "ada-weapon-group" });
  const row = group.element;
  root.append(row);
  parent.append(root);
  const buttons = new Map<Weapon, HTMLButtonElement>();
  let choices: readonly WeaponChoice[] = [];
  let enabled = false;
  let shown: boolean | undefined;
  let disposed = false;
  let pressed: HTMLElement | null = null;
  const buttonDisposers = new Map<Weapon, () => void>();
  const feedback = new AmmoFeedbackQueue();
  let lastFeedbackTime: number | undefined;

  const render = (): void => {
    root.hidden = !(shown ?? enabled) || choices.length === 0;
    const ids = new Set(choices.map((choice) => choice.id));
    let layoutChanged = false;
    for (const [id, entry] of buttons) {
      if (!ids.has(id)) {
        buttonDisposers.get(id)?.();
        buttonDisposers.delete(id);
        entry.remove();
        buttons.delete(id);
        layoutChanged = true;
      }
    }
    for (const choice of choices) {
      let entry = buttons.get(choice.id);
      if (!entry) {
        const current = () => choices.find((item) => item.id === choice.id);
        const glyph = document.createElement("span");
        glyph.className = "ada-weapon-glyph";
        const kit = createHudDisc(document, {
          className: "ada-weapon",
          getAction: (button) => {
            const action = resolveAdaHoldAction(parent, button);
            return action?.available() ? action : null;
          },
          getState: () => ({
            availability: enabled ? { kind: "available" } : { kind: "disabled" },
            toggled: current()?.selected ?? false,
          }),
          icon: glyph,
          name: weaponButtonLabel(options.labels, choice),
          rule: { holdMs: ADA_ACTION_HOLD_MS, slopPx: SCROLL.dragThreshold },
          size: "weapon",
          sizes: weaponSizes,
        });
        const button = kit.element;
        button.dataset.weapon = choice.id;
        kit.face.classList.add("ada-disc");
        kit.face.style.setProperty("--glyph", `url('${weaponGlyphPath(choice.id)}')`);
        kit.face.setAttribute("aria-hidden", "true");
        const pips = document.createElement("span");
        pips.className = "ada-pips";
        pips.setAttribute("aria-hidden", "true");
        button.append(pips);
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
        const availability = () =>
          enabled && !disposed && !button.disabled && current()
            ? { kind: "available" as const }
            : { kind: "omitted" as const };
        const stopPointerDown = (event: PointerEvent) => event.stopPropagation();
        const cancelOnKeyDown = () => invalidatePressScope(parent);
        button.addEventListener("pointerdown", stopPointerDown);
        button.addEventListener("keydown", cancelOnKeyDown);
        let cancelRefusal: (() => void) | undefined;
        const binding = bindAdaAction(
          {
            click: {
              availability,
              run: () => {
                if (enabled && !button.disabled && options.onSelect(choice.id)) {
                  cancelRefusal = refuse(button, options.reducedMotion());
                }
              },
            },
            current: () => !disposed,
            nativeClickOwner: "factory",
            ...(options.onHold
              ? {
                  hold: {
                    availability,
                    run: () => {
                      const latest = current();
                      if (enabled && !button.disabled && latest) {
                        options.onHold?.(latest, button);
                      }
                    },
                  },
                }
              : {}),
            slopPx: () => SCROLL.dragThreshold * readViewUnit(button),
          },
          button,
        );
        const disposeButton = () => {
          cancelRefusal?.();
          binding.dispose();
          kit.dispose();
          button.removeEventListener("pointerdown", stopPointerDown);
          button.removeEventListener("keydown", cancelOnKeyDown);
        };
        try {
          assertAdaActionMetadata(button);
          row.append(button);
          assertAdaActionBindings(button);
        } catch (error) {
          disposeButton();
          button.remove();
          throw error;
        }
        buttonDisposers.set(choice.id, disposeButton);
        entry = button;
        buttons.set(choice.id, entry);
        layoutChanged = true;
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
          ...Array.from({ length: Number(level) === 1 ? 0 : Number(level) }, () =>
            document.createElement("span"),
          ),
        );
      }
      entry.title = name;
      entry.disabled = !enabled;
    }
    if (layoutChanged) {
      group.arrange(
        {
          axis: "row",
          gap: { name: "weapon-hud", row: weaponGap, stack: weaponGap },
          press: weaponPress,
          width: buttons.size * weaponFace.width + Math.max(0, buttons.size - 1) * weaponGap,
        },
        [...buttons.values()].map((element) => ({ element, role: "secondary", size: weaponFace })),
      );
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
      disposed = true;
      for (const disposeButton of buttonDisposers.values()) {
        disposeButton();
      }
      buttonDisposers.clear();
      group.dispose();
      root.removeEventListener("click", stopWeaponClick);
      root.remove();
    },
    setEnabled(value: boolean): void {
      if (enabled && !value) {
        invalidatePressScope(parent);
      }
      enabled = value;
      render();
    },
    /** Whether the field under the HUD is light, which outlines a levelled disc in ink. */
    setLightField(light: boolean): void {
      const field = light ? "light" : "dark";
      if (root.dataset.field !== field) {
        root.dataset.field = field;
      }
    },
    /** Paint the action admitted by the existing pointer-release dispatcher. */
    setPressed(element: HTMLElement | null): void {
      pressed?.removeAttribute("data-weapon-pressed");
      pressed =
        element?.classList.contains("ada-weapon") && root.contains(element) ? element : null;
      pressed?.setAttribute("data-weapon-pressed", "");
    },
    /** Controls paint independently of the existing input gate. */
    setShown(value: boolean): void {
      shown = value;
      root.hidden = !value || choices.length === 0;
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
      const frames = feedback.advance(ms, running, options.reducedMotion());
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
