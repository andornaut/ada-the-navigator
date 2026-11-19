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
  for (const { compact, frames, key, small } of portraits) {
    const names = frames.map(([name]) => name);
    const compactFrames = (small ?? frames.map(([, frame]) => frame)).map((frame) =>
      crop(frame, compact),
    );
    for (const [sheet, size, list] of [
      [key, FULL, frames.map(([, frame]) => frame)],
      [`${key}-compact`, COMPACT, compactFrames],
    ] as const) {
      const tags: Tag[] = names.map((name, i) => [name, [list[i]!], MS]);
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
