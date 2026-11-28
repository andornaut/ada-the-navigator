import {
  ABOARD_HOLODISK_FRAMES,
  ABOARD_HOLODISK_ORIGIN,
  type CoreManifest,
} from "../../art/index.ts";
import type { ArtAsset } from "../../ui/story/storyArt.ts";

// The public directory holding every file the game loads at runtime: the core art manifest, each
// galaxy manifest it maps and what they name, the UI subset under ui/ and the files the DOM UI
// links from its styles and buttons.
export const ART_DIRECTORY = "art";

// App icons reach the precache through the page's links and the web app manifest; the icon
// contact sheet and vector master are review material the game never loads.
const NOT_PRECACHED: readonly string[] = ["app-icon/"];

// The URLs of the art the service worker precaches, given each file's path under ART_DIRECTORY
// with forward slashes. Every runtime art file is listed, so the core and galaxy manifests, the UI
// manifest and the DOM UI need no list of their own, and an added file is precached by the next
// build.
export function artUrls(files: readonly string[]): string[] {
  return files
    .filter((file) => !NOT_PRECACHED.some((prefix) => file.startsWith(prefix)))
    .map((file) => `/${ART_DIRECTORY}/${file}`)
    .sort();
}
const ABOARD_SHEET = "/art/aboard-holodisk-sheet.svg";
const ABOARD_LOOSE = [...ABOARD_HOLODISK_FRAMES].map((id) => `/art/${id}.svg`);

/** Keep the loose source files, but omit them from a verified selected build. */
export function aboardLooseOmissions(files: ReadonlyMap<string, Uint8Array>): readonly string[] {
  const sheet = files.get(ABOARD_SHEET);
  const manifest = files.get("/art/manifest.json");
  if (!sheet || !manifest) {
    return [];
  }
  const decode = new TextDecoder();
  const { assets = [] } = JSON.parse(decode.decode(manifest)) as CoreManifest<ArtAsset>;
  const selected = assets.filter(({ id }) => ABOARD_HOLODISK_FRAMES.has(id));
  if (
    selected.length !== ABOARD_HOLODISK_FRAMES.size ||
    new Set(selected.map(({ id }) => id)).size !== selected.length ||
    selected.some(
      ({ path, sourceRect, svgSheet }) =>
        path !== ABOARD_SHEET || sourceRect !== undefined || svgSheet !== true,
    ) ||
    assets.some(({ path }) => ABOARD_LOOSE.includes(path))
  ) {
    return [];
  }
  // The producer writes the loose roots in order, adding only id, x and y to each opening tag.
  const opening =
    /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="\d+" height="\d+" viewBox="0 0 \d+ \d+">/u;
  let rest = decode.decode(sheet).replace(opening, "");
  for (const [index, id] of [...ABOARD_HOLODISK_FRAMES].entries()) {
    const loose = decode.decode(files.get(ABOARD_LOOSE[index]!)).trimEnd();
    const placement = new RegExp(`^<svg id="${id}" x="\\d+" y="\\d+" `, "u").exec(rest);
    const { height, width } = selected.find((frame) => frame.id === id)!;
    const { x, y } = ABOARD_HOLODISK_ORIGIN;
    const header = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"`;
    if (
      !placement ||
      !loose.startsWith(`${header} viewBox="${x} ${y} ${width} ${height}">`) ||
      !rest.startsWith(loose.slice(5), placement[0].length)
    ) {
      return [];
    }
    rest = rest.slice(placement[0].length + loose.length - 5).trimStart();
  }
  return rest.trimEnd() === "</svg>" ? ABOARD_LOOSE : [];
}
