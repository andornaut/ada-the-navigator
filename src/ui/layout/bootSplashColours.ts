import { COLOURS, translucentInk, UNLISTED_COLOURS } from "./colours.ts";

// Substituted into the render-blocking splash stylesheet by the build.
export const BOOT_SPLASH_COLOURS = {
  background: UNLISTED_COLOURS.pageBackground,
  field: COLOURS.baseField,
  fill: COLOURS.cream,
  rule: COLOURS.ink,
  track: translucentInk(0.6),
} as const;
