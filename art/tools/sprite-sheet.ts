import { readFileSync, writeFileSync } from "node:fs";

import type { Tag } from "@andornaut/art-kit/raster";
import { type SpriteSheetOptions, writeSpriteSheet } from "@andornaut/art-kit/spriteSheet";
import { format, resolveConfig } from "prettier";

// Rewrites a written file through the project's Prettier settings, so generated JSON matches the
// lint gate.
export async function prettify(path: string): Promise<void> {
  const options = await resolveConfig(path);
  writeFileSync(path, await format(readFileSync(path, "utf8"), { ...options, filepath: path }));
}

// art-kit's sprite sheet writer, with its JSON data file formatted by Prettier.
export async function writeSprites(
  paths: { sheet: string; data: string },
  options: Omit<SpriteSheetOptions, "image">,
  tags: readonly Tag[],
): Promise<void> {
  await writeSpriteSheet(paths, options, tags);
  await prettify(paths.data);
}
