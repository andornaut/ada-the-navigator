// Rebuilds the reviewed regional pages directly from authored portraits in scratch.
// Usage: node art/tools/cast-portrait-authored.ts --single-frame|--multi-frame
import { mkdirSync, writeFileSync } from "node:fs";

import { decodePng } from "@andornaut/art-kit/build/png";
import { spriteSheet } from "@andornaut/art-kit/build/spriteSheet";

import { CAST, type CastKey } from "../../src/data/cast.ts";
import { andromedaPortraits } from "./andromeda-portraits.ts";
import { type Portrait, portraitSheets } from "./bust-sheets.ts";
import { cartwheelPortraits } from "./cartwheel-portraits.ts";
import { packCastStrips } from "./cast-portrait-pages.ts";
import { needlePortraits } from "./needle-portraits.ts";
import { sunflowerPortraits } from "./sunflower-portraits.ts";
import { whirlpoolPortraits } from "./whirlpool-portraits.ts";

const sources = {
  andromeda: andromedaPortraits,
  cartwheel: cartwheelPortraits,
  needle: needlePortraits,
  sunflower: sunflowerPortraits,
  whirlpool: whirlpoolPortraits,
} satisfies Record<string, readonly Portrait[]>;

const flag = process.argv[2];
if (process.argv.length !== 3 || (flag !== "--single-frame" && flag !== "--multi-frame"))
  throw new Error("Usage: node art/tools/cast-portrait-authored.ts --single-frame|--multi-frame");

const homes =
  flag === "--single-frame"
    ? (["cartwheel", "sunflower", "whirlpool"] as const)
    : (["andromeda", "needle"] as const);
const output = new URL("../../.check-results/ada-0281-remaining-cast-authored/", import.meta.url);
mkdirSync(output, { recursive: true });
for (const home of homes) {
  const keys = (Object.keys(CAST) as CastKey[]).filter((key) => CAST[key].home === home).sort();
  const authored = keys.map((key) => {
    const portrait = sources[home].find((portrait) => portrait.key === key);
    if (!portrait) throw new Error(`Missing authored portrait: ${home}/${key}`);
    return portraitSheets(portrait);
  });
  for (const [index, size] of ["full", "compact"].entries()) {
    const strips = authored.map((sheets) => {
      const { sheet, tags } = sheets[index]!;
      const { sheet: png } = spriteSheet({ image: `${sheet}.png`, key: sheet }, tags);
      return { image: decodePng(png), strip: { id: sheet } };
    });
    const { bytes } = packCastStrips(strips);
    writeFileSync(new URL(`${home}-${size}.png`, output), bytes);
  }
}
