// Writes bust portraits in the conversation format (art/conversation.md): a 32 px storybook
// sheet and a 22 px compact sheet per speaker, each frame 1000 ms, and their manifest entries.
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Frame } from "@andornaut/art-kit/build/grid";
import type { Tag } from "@andornaut/art-kit/build/raster";

import { COMPACT, crop, FULL, type Point } from "./bust.ts";
import { type ManifestFile, replaceEntries } from "./manifest.ts";
import { writeSheet } from "./sprite-sheet.ts";

const MS = 1000;

export type Portrait = {
  /** The sheet file stem; the manifest ids are `{key}-portrait` and `{key}-portrait-compact`. */
  key: string;
  /** Frames in sheet order, by name. */
  frames: readonly (readonly [string, Frame])[];
  /** The compact window's origin in the 32 frame. */
  compact: Point;
  /** Compact frames drawn natively at a compact size, cropped at `compact` in place of `frames`. */
  small?: readonly Frame[];
};

/** The authored full and compact strips, in the same order as the ordinary emitter. */
export function portraitSheets({ compact, frames, key, small }: Portrait) {
  const names = frames.map(([name]) => name);
  const full = frames.map(([, frame]) => frame);
  const compactFrames = (small ?? full).map((frame) => crop(frame, compact));
  return (
    [
      [key, FULL, full],
      [`${key}-compact`, COMPACT, compactFrames],
    ] as const
  ).map(([sheet, size, list]) => ({
    sheet,
    size,
    names,
    tags: names.map((name, index): Tag => [name, [list[index]!], MS]),
  }));
}

/**
 * Writes every portrait's sheets to `public/art/{folder}/` and replaces the entries whose ids
 * `owns` selects in `manifest`, full sheets then compact sheets, each sorted by id.
 */
export async function writePortraits(
  manifest: ManifestFile,
  folder: string,
  portraits: readonly Portrait[],
  owns: (id: string) => boolean,
): Promise<string[]> {
  const output = fileURLToPath(new URL(`../../public/art/${folder}/`, import.meta.url));
  mkdirSync(output, { recursive: true });
  const entries = [];
  for (const portrait of portraits) {
    const { key } = portrait;
    for (const { names, sheet, size, tags } of portraitSheets(portrait)) {
      writeSheet(`${output}${sheet}.png`, { key: sheet }, tags);
      entries.push({
        id: size === FULL ? `${key}-portrait` : `${key}-portrait-compact`,
        path: `/art/${folder}/${sheet}.png`,
        width: size * names.length,
        height: size,
        ...(size === COMPACT ? { displayWidth: size * 2, displayHeight: size * 2 } : {}),
        facing: "front",
        pivot: { x: 0.5, y: 0.5 },
        frameWidth: size,
        frameHeight: size,
        frames: Object.fromEntries(names.map((name, i) => [name, i])),
      });
    }
  }
  const ordered = entries.toSorted(
    (p, q) =>
      Number(p.id.endsWith("-compact")) - Number(q.id.endsWith("-compact")) ||
      p.id.localeCompare(q.id),
  );
  replaceEntries(manifest, owns, ordered);
  return ordered.map(({ id }) => id);
}
