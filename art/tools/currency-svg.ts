import { ORE_PALETTE } from "./ore.ts";
import { INK } from "./palette.ts";
import { STARDUST_PALETTE } from "./resource-glyphs.ts";
import { svgText } from "./svg-text.ts";
import { writeUiIcon } from "./ui-icon-sources.ts";

const size = 20;

// Trace the four tips and the concave shoulders of the shared idle Stardust star.
const stardustOutline =
  "M10 1C10.6 6.5 13.8 9 19 10C13.8 11 10.6 13.5 10 19C9.4 13.5 6.2 11 1 10C6.2 9 9.4 6.5 10 1Z";
const stardust = `
  <path fill="#${STARDUST_PALETTE.D}" d="M10 1H19V19H1V10L7 10.8 10 9Z"/>
  <path fill="#${STARDUST_PALETTE.L}" d="M10 4.5Q10.6 8.8 15.5 10Q10.6 11.2 10 15.5Q9.4 11.2 4.5 10Q9.4 8.8 10 4.5Z"/>
  <path fill="#${STARDUST_PALETTE.W}" d="M10 7.4 11.2 8.8 13 10 11.2 11.2 10 12.6 8.8 11.2 7 10 8.8 8.8Z"/>
`;

// The shared nugget has a raised left shoulder, a stepped right edge and a low belly.
const oreOutline =
  "M5.6 1.4Q7.2 .9 8.9 1.4L10.7 3.1H12.6Q13.5 3.1 14.4 4.4L16.7 7.1Q17.1 8.5 18.8 9.7L18.7 13.9Q18.4 14.8 16.9 15.2L15.4 17 13.1 17.1 12 18.5Q10.8 18.7 9.5 18.5L8 17 6.3 17Q5 16.7 4.3 15.2L2.5 14.3Q1.4 13.8 1.3 12.2L3 10.6 1.2 8.7 1.2 6.3Q1.7 5 3.5 4.7L4.7 2.6Z";
const ore = `
  <path fill="#${ORE_PALETTE.r}" d="M1 17 7 15.1Q13.7 15 17.1 10.4L20 9V20H1Z"/>
  <path fill="#${ORE_PALETTE.M}" d="M5.8 3.1 8.5 2.8 10.5 4.6 12.7 4.5 15.2 7.5 15.8 9.1 17 10.5 16.7 13.5 14.9 15.4 12.6 15.5 11.1 17.2 9.6 16 7.4 15.5 5.7 15 4.6 13.5 3.2 12.3 4.7 10.3 2.9 8.3 3 6.6 4.9 5.4Z"/>
  <path fill="#${ORE_PALETTE.L}" d="M5.8 3.1 8.5 2.8 10.5 4.6 8.9 5.5 7.2 5.2 6 7.6 3.8 8.7 2.9 8.3 3 6.6 4.9 5.4Z"/>
  <path fill="#${ORE_PALETTE.S}" d="M12.7 4.5 15.2 7.5 15.8 9.1 17 10.5 16.7 13.5 14.9 15.4 12.6 15.5 11.1 17.2 9.6 16 7.4 15.5 9.6 13.1 12.1 12.6 11.5 10.1 13.7 8.9 12.2 7.1Z"/>
  <path fill="#${ORE_PALETTE.D}" d="M17 10.5 16.7 13.5 14.9 15.4 12.6 15.5 13.5 13.4 15.3 12.9 15.4 11.5Z"/>
`;

function emit(key: string, outline: string, colour: string, facets: string): void {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <defs><clipPath id="body"><path d="${outline}"/></clipPath></defs>
    <path d="${outline}" fill="#${colour}" stroke="#${INK}" stroke-width="2" stroke-linejoin="round" paint-order="stroke"/>
    <g clip-path="url(#body)">${facets}</g>
  </svg>`;
  writeUiIcon(`icon-${key}-20`, svgText(svg));
}

emit("stardust", stardustOutline, STARDUST_PALETTE.M, stardust);
emit("ore", oreOutline, ORE_PALETTE.R!, ore);
