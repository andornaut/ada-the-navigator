// Needle's edge-on band: a thin line of silver stars across the sky, fixed to the screen like the
// backdrop haze and drawn at runtime from band.json, since its 1.2 px core and 1 to 2 px stars
// need full resolution. Contract: art/needle.md (Space look).
// Usage: node art/tools/needle-sky.ts
import { writeFileSync } from "node:fs";

import { linkData } from "./manifest.ts";
import { contrast, FIELD, MARKER, OUT, over, PUBLIC } from "./needle-common.ts";
import { json, round } from "./projection.ts";

// The line stays within the backdrop rocks' 1.8:1 cap at its peak.
const CAP = 1.8;
const PROFILE = [
  { name: "haze", alpha: 0.06, sigma: 30 },
  { name: "glow", alpha: 0.1, sigma: 7 },
  { name: "core", alpha: 0.08, sigma: 1.2 },
];
const peak = PROFILE.reduce((sum, { alpha }) => sum + alpha, 0);
const peakContrast = contrast(over(MARKER, peak, FIELD), FIELD);
if (peakContrast > CAP) {
  throw new Error(`band peak ${peakContrast.toFixed(2)}:1 is over the ${CAP}:1 cap`);
}

writeFileSync(
  `${OUT}band.json`,
  json({
    version: 1,
    color: MARKER,
    layer: "backdrop",
    anchor: "view",
    through: [0.5, 0.4],
    angle: -6,
    parallax: 0,
    profile: PROFILE,
    specks: { spacing: 2.2, sigma: 12, alpha: [0.25, 0.8], size: 1 },
    stars: { color: "#F1ECE6", spacing: 240, sigma: 7.2, size: 2 },
  }),
);
linkData("needle", { needleBand: `${PUBLIC}band.json` });
console.log(`band peak alpha ${round(peak)}, ${peakContrast.toFixed(2)}:1`);
