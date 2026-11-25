import { svgText } from "./svg-text.ts";
import { writeUiIcon } from "./ui-icon-sources.ts";

const ink = "#181425";

function stroked(path: string, colour: string, width: number): string {
  return `<path d="${path}" fill="none" stroke="${colour}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function writeIcon(key: string, shapes: string, size = 20): void {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 20 20" aria-hidden="true">${shapes}</svg>`;
  writeUiIcon(`icon-${key}`, svgText(svg));
}

// A black disc with a pink rim, so its shape reads on the item notice's ink chip, the pink
// hologram ring and the dark hub.
const holodisk = `<circle cx="10" cy="10" r="8.3" fill="#2a2536" stroke="#e868c8" stroke-width="1.5"/><circle cx="10" cy="10" r="4.9" fill="#e868c8"/><circle cx="10" cy="10" r="2" fill="${ink}"/><path d="M4.1 9a6 6 0 0 1 5.4-5.2" fill="none" stroke="#4a4358" stroke-width="1.45" stroke-linecap="round"/>`;
const rimShade = `<path d="M16.8 10.8a6.9 6.9 0 0 1-5.5 5.9" fill="none" stroke="${ink}" stroke-width="1.65" stroke-linecap="round"/>`;
// The reviewed Shop icon omits the secondary rim shade in its 16 px slot.
writeIcon("holodisk", holodisk, 16);
writeIcon("holodisk-20", holodisk + rimShade);

// The disabled counterparts keep each icon's ink edge and take the disabled mark colour, with
// the crate's straps in the disabled face colour.
const disabledMark = "#9a96ad";
const disabledFace = "#2f2d3d";
const cargo = (crate: string, straps: string) =>
  `<rect x="2" y="5" width="16" height="10" rx="2" fill="${crate}" stroke="${ink}" stroke-width="1.5"/><path d="M7 6v8m6-8v8M3 10h14" stroke="${straps}" stroke-width="1.3"/>`;
writeIcon("cargo-20", cargo("#feae34", "#ead4aa"));
writeIcon("cargo-20-disabled", cargo(disabledMark, disabledFace));

const tow = "M13 7.2v6a3.5 3.5 0 0 1-7 0v-1l2 2m7-9a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z";
writeIcon("tow-20", stroked(tow, ink, 4) + stroked(tow, "#b8bfc9", 1.8));
writeIcon("tow-20-disabled", stroked(tow, ink, 4) + stroked(tow, disabledMark, 1.8));
