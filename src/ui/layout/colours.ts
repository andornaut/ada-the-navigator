import { COLOURS } from "../../data/uiColours.ts";

export { COLOURS, UNLISTED_COLOURS } from "../../data/uiColours.ts";

const inkChannels = [1, 3, 5]
  .map((index) => Number.parseInt(COLOURS.ink.slice(index, index + 2), 16))
  .join(" ");

export function translucentInk(alpha: number): string {
  return `rgb(${inkChannels} / ${alpha})`;
}
