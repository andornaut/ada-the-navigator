import { writeFileSync } from "node:fs";

import { svgText } from "./svg-text.ts";

const output = new URL("../../public/art/ui/icons/", import.meta.url);
const ink = "#181425";

function stroked(path: string, colour: string, width: number): string {
  return `<path d="${path}" fill="none" stroke="${colour}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function writeIcon(key: string, shapes: string, size = 20): void {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 20 20" aria-hidden="true">${shapes}</svg>`;
  writeFileSync(new URL(`icon-${key}.svg`, output), svgText(svg));
}

const holodisk = `<circle cx="10" cy="10" r="8.3" fill="#d9dff0" stroke="${ink}" stroke-width="1.5"/><circle cx="10" cy="10" r="4.9" fill="#e868c8"/><circle cx="10" cy="10" r="2" fill="${ink}"/><path d="M4.1 9a6 6 0 0 1 5.4-5.2" fill="none" stroke="#fff" stroke-width="1.45" stroke-linecap="round"/>`;
const rimShade =
  '<path d="M16.8 10.8a6.9 6.9 0 0 1-5.5 5.9" fill="none" stroke="#a3aacb" stroke-width="1.65" stroke-linecap="round"/>';
// The reviewed Shop icon omits the secondary rim shade in its 16 px slot.
writeIcon("holodisk", holodisk, 16);
writeIcon("holodisk-20", holodisk + rimShade);

writeIcon(
  "cargo-20",
  `<rect x="2" y="5" width="16" height="10" rx="2" fill="#feae34" stroke="${ink}" stroke-width="1.5"/><path d="M7 6v8m6-8v8M3 10h14" stroke="#ead4aa" stroke-width="1.3"/>`,
);

const tow = "M13 7.2v6a3.5 3.5 0 0 1-7 0v-1l2 2m7-9a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z";
writeIcon("tow-20", stroked(tow, ink, 4) + stroked(tow, "#b8bfc9", 1.8));
