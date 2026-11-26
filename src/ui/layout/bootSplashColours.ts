import { COLOURS, UNLISTED_COLOURS } from "./colours.ts";

const inkChannels = [1, 3, 5]
  .map((index) => Number.parseInt(COLOURS.ink.slice(index, index + 2), 16))
  .join(" ");

// Substituted into the render-blocking splash stylesheet by the build.
export const BOOT_SPLASH_COLOURS = {
  background: UNLISTED_COLOURS.pageBackground,
  field: COLOURS.baseField,
  fill: COLOURS.cream,
  rule: COLOURS.ink,
  track: `rgb(${inkChannels} / 0.6)`,
} as const;
