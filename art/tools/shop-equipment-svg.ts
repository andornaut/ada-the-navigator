import { writeFileSync } from "node:fs";

import { svgText } from "./svg-text.ts";

const output = new URL("../../public/art/ui/icons/", import.meta.url);
const equipment = {
  "icon-shop-engine-tuning": "M4 14a7 7 0 1 1 12 0Zm6-2 3-4M2 17h16",
  "icon-shop-shield": "M10 2l7 3v5c0 4-3 6.5-7 8.5C6 16.5 3 14 3 10V5Z",
  "icon-shop-ship-paint": "M2 3h13v5H2Zm13 2h3v6l-8 2v5",
  "icon-shop-tractor-beam": "M2 4h16m-15 4 5 7m9-7-5 7m-4 2h4",
};
const states = [
  ["", "#ead4aa"],
  ["-disabled", "#9a96ad"],
] as const;

for (const [key, path] of Object.entries(equipment)) {
  for (const [suffix, colour] of states) {
    const outline = `<path d="${path}" fill="none" stroke="${colour}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
    const shapes =
      key === "icon-shop-shield"
        ? `<g transform="translate(0 -.5)">${outline}<path fill="${colour}" d="M10 2v16.5C6 16.5 3 14 3 10V5Z"/></g>`
        : key === "icon-shop-tractor-beam"
          ? `${outline}<circle cx="10" cy="14" r="1.7" fill="${colour}"/>`
          : outline;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">${shapes}</svg>`;
    writeFileSync(new URL(`${key}${suffix}.svg`, output), svgText(svg));
  }
}
