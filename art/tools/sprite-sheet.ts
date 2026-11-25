import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

import { decodePng } from "@andornaut/art-kit/build/png";
import type { Tag } from "@andornaut/art-kit/build/raster";
import { spriteSheet, type SpriteSheetOptions } from "@andornaut/art-kit/build/spriteSheet";
import { format, resolveConfig } from "prettier";

// Rewrites a written file through the project's Prettier settings, so generated JSON matches the
// lint gate.
export async function prettify(path: string): Promise<void> {
  const options = await resolveConfig(path);
  writeFileSync(path, await format(readFileSync(path, "utf8"), { ...options, filepath: path }));
}

// Writes a PNG unless the file already holds the same pixels, so a rerun keeps the committed
// bytes whichever encoder release wrote them.
export function writePng(path: string, bytes: Uint8Array): void {
  if (existsSync(path)) {
    const [was, now] = [decodePng(readFileSync(path)), decodePng(bytes)];
    if (
      was.width === now.width &&
      was.height === now.height &&
      Buffer.from(was.data).equals(Buffer.from(now.data))
    ) {
      return;
    }
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
}

// art-kit's sprite sheet, its PNG written by writePng and its JSON data file formatted by
// Prettier.
export async function writeSprites(
  paths: { sheet: string; data: string },
  options: Omit<SpriteSheetOptions, "image">,
  tags: readonly Tag[],
): Promise<void> {
  if (resolve(paths.sheet) === resolve(paths.data)) {
    throw new RangeError("Sprite sheet PNG and JSON must resolve to different paths");
  }
  const { data, sheet } = spriteSheet({ ...options, image: basename(paths.sheet) }, tags);
  writePng(paths.sheet, sheet);
  mkdirSync(dirname(paths.data), { recursive: true });
  writeFileSync(paths.data, data, "utf8");
  await prettify(paths.data);
}

// art-kit's sprite sheet PNG alone, for a sheet the manifest describes in full (frame size, names
// and loops), so no runtime reads its Aseprite data.
export function writeSheet(
  path: string,
  options: Omit<SpriteSheetOptions, "image">,
  tags: readonly Tag[],
): void {
  writePng(path, spriteSheet({ ...options, image: basename(path) }, tags).sheet);
}
