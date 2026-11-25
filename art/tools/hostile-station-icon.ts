// The hostile station's Map glyph, in the 24 px box: a bold hexagonal ring round a solid
// hexagonal core, with a square gun pod at each of its four corners. One ink mask.
// Usage: node art/tools/hostile-station-icon.ts
import { svgText } from "./svg-text.ts";
import { writeUiIcon } from "./ui-icon-sources.ts";

const INK = "#181425";
const RING_WIDTH = 2.6;
const POD = 4;

export function hostileStationIcon(): string {
  const pods = [
    [1, 5],
    [19, 5],
    [1, 15],
    [19, 15],
  ].map(([x, y]) => `<rect x="${x}" y="${y}" width="${POD}" height="${POD}" fill="${INK}"/>`);
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">',
    `<path fill="none" stroke="${INK}" stroke-width="${RING_WIDTH}" stroke-linejoin="round" d="M12 3.2L19.6 7.6V16.4L12 20.8L4.4 16.4V7.6Z"/>`,
    `<path fill="${INK}" d="M12 8.6L15 10.3V13.7L12 15.4L9 13.7V10.3Z"/>`,
    ...pods,
    "</svg>",
    "",
  ].join("");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeUiIcon("map-hostile-station", svgText(hostileStationIcon()));
}
