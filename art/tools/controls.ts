import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { Frame } from "@andornaut/art-kit/grid";
import { decodePng } from "@andornaut/art-kit/png";
import type { Tag } from "@andornaut/art-kit/raster";
import type { Margins } from "@andornaut/art-kit/spriteSheet";
import { writeSprites } from "./sprite-sheet.ts";

type Colours = Readonly<Record<string, string>>;

// Recolours Chibi's control sheets to Ada's dark lavender palette. Only the listed colours change;
// every other pixel, alpha, frame, tag and slice is copied from the source sheet.
// Usage: node art/tools/controls.ts <chibis-way-home checkout>/public/art/sprites
const RECOLOURS: Readonly<Record<string, Colours>> = {
  "icon-browser-menu": { "3a4466": "ead4aa" },
  "icon-install": { "3a4466": "ead4aa" },
  "icon-ios-share": { "3a4466": "ead4aa" },
  "ui-button": { "5a6988": "5f5980", "8b9bb4": "9690b4" },
  "ui-button-primary": {
    "262b44": "8a7148",
    "3a4466": "bfa06f",
    "5a6988": "d2b886",
    c0cbdc: "2f2d3d",
  },
  // Shop item rows: a darker face over the card, with the lip and highlight in the card shade.
  "ui-button-tile": { "5a6988": "2f2d3d", "8b9bb4": "46425e", c0cbdc: "2f2d3d" },
  "ui-close": { "181425": "ead4aa", "3a4466": "403d55" },
  "ui-focus": { fee761: "ead4aa" },
  "ui-settings-card": { "8b9bb4": "2f2d3d", c0cbdc: "3b3850", ffffff: "6b6685" },
  "ui-switch": {
    "265c42": "1f5a55",
    "3a4466": "403d55",
    "3e8948": "2f7d76",
    "5a6988": "57536e",
    c0cbdc: "c9c4d8",
  },
};

// Per-tag colours, applied over RECOLOURS. Chibi's secondary button uses one colour for the
// enabled top highlight and the disabled face.
const TAG_RECOLOURS: Readonly<Record<string, Readonly<Record<string, Colours>>>> = {
  "ui-button": {
    disabled: { c0cbdc: "2f2d3d" },
    normal: { c0cbdc: "aaa4c6" },
    pressed: { c0cbdc: "aaa4c6" },
  },
};

// Sheets drawn from a differently named source sheet.
const SOURCES: Readonly<Record<string, string>> = { "ui-button-tile": "ui-button" };

interface AsepriteData {
  frames: Record<
    string,
    { duration: number; frame: { h: number; w: number; x: number; y: number } }
  >;
  meta: {
    frameTags: { from: number; name: string; to: number }[];
    slices?: { keys: { center: { h: number; w: number; x: number; y: number } }[] }[];
  };
}

const output = fileURLToPath(new URL("../../public/art/ui/sprites/", import.meta.url));

function hex(byte: number): string {
  return byte.toString(16).padStart(2, "0");
}

async function recolour(
  source: string,
  colours: Colours,
  byTag: Readonly<Record<string, Colours>>,
  key: string,
): Promise<void> {
  const from = SOURCES[key] ?? key;
  const image = decodePng(await readFile(`${source}/${from}.png`));
  const data = JSON.parse(await readFile(`${source}/${from}.json`, "utf8")) as AsepriteData;
  const frameColours = Object.keys(data.frames).map((_, index) => {
    const tag = data.meta.frameTags.find(({ from, to }) => from <= index && index <= to);
    return { ...colours, ...(tag ? byTag[tag.name] : {}) };
  });
  const unused = new Set([colours, ...Object.values(byTag)].flatMap((map) => Object.keys(map)));
  const frames: Frame[] = Object.values(data.frames).map(({ frame: { h, w, x, y } }, index) =>
    Array.from({ length: h }, (_, row) =>
      Array.from({ length: w }, (_, column) => {
        const at = ((y + row) * image.width + x + column) * 4;
        const [r = 0, g = 0, b = 0, a = 0] = image.data.subarray(at, at + 4);
        if (a !== 0 && a !== 255) {
          throw new RangeError(`${key} has partial alpha at ${x + column},${y + row}`);
        }
        if (a === 0) {
          return null;
        }
        const colour = hex(r) + hex(g) + hex(b);
        unused.delete(colour);
        return frameColours[index]?.[colour] ?? colour;
      }),
    ),
  );
  if (unused.size > 0) {
    throw new RangeError(`${key} lacks source colours ${[...unused].join(", ")}`);
  }
  const durations = Object.values(data.frames).map((frame) => frame.duration);
  const tags: Tag[] = data.meta.frameTags.map(({ from, name, to }) => [
    name,
    frames.slice(from, to + 1),
    durations.slice(from, to + 1),
  ]);
  const centre = data.meta.slices?.[0]?.keys[0]?.center;
  const [first] = frames;
  const options: { key: string; margins?: Margins } = { key };
  if (centre && first?.[0]) {
    options.margins = [
      centre.x,
      centre.y,
      first[0].length - centre.x - centre.w,
      first.length - centre.y - centre.h,
    ];
  }
  await writeSprites({ data: `${output}${key}.json`, sheet: `${output}${key}.png` }, options, tags);
}

const [source] = process.argv.slice(2);
if (!source) {
  throw new Error("Usage: node art/tools/controls.ts <chibi>/public/art/sprites");
}
for (const [key, colours] of Object.entries(RECOLOURS)) {
  await recolour(source, colours, TAG_RECOLOURS[key] ?? {}, key);
}
