import { SHIELD_PILL, shieldBarWidth, shieldPillWidth } from "./playView.ts";

/** Approved shield geometry in physical pixels: five equal gaps around one dark background. */
export function shieldRasterGeometry(
  unit: number,
  density: number,
  origin: { readonly x: number; readonly y: number },
  level: number,
) {
  const length = (logical: number) => Math.max(1, Math.round(logical * unit * density));
  const edge = length(SHIELD_PILL.delayStrip.edge);
  const gap = length(SHIELD_PILL.delayStrip.gap);
  const rim = length(SHIELD_PILL.bar.rim);
  const inset = (SHIELD_PILL.bar.inset / SHIELD_PILL.bar.rim) * rim;
  const width = length(shieldPillWidth(level));
  const height = length(SHIELD_PILL.pill.height);
  const mainWidth = length(shieldBarWidth(level));
  const fillHeight = length(SHIELD_PILL.bar.height - 2 * SHIELD_PILL.bar.inset);
  const mainHeight = fillHeight + 2 * inset;
  const timerHeight = length(SHIELD_PILL.delayStrip.height);
  const backgroundHeight = mainHeight + timerHeight + 3 * gap;
  const mainX = length(SHIELD_PILL.padding.left + SHIELD_PILL.icon + SHIELD_PILL.iconGap);
  const background = {
    height: backgroundHeight,
    width: mainWidth + 2 * gap,
    x: mainX - gap,
    y: Math.round((height - backgroundHeight) / 2),
  };
  const main = { height: mainHeight, width: mainWidth, x: mainX, y: background.y + gap };
  const capacityWidth = mainWidth - 2 * inset;
  const fill = { height: fillHeight, x: main.x + inset, y: main.y + inset };
  const timer = {
    height: timerHeight,
    width: main.width,
    x: main.x,
    y: main.y + main.height + gap,
  };
  return {
    background,
    capacityWidth,
    density,
    edge,
    fill,
    gap,
    height,
    inset,
    main,
    radius: length(SHIELD_PILL.pill.radius),
    rim,
    timer,
    width,
    x: Math.round(origin.x * density) / density - origin.x,
    y: Math.round(origin.y * density) / density - origin.y,
  };
}
