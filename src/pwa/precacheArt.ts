// The public directory holding every file the game loads at runtime: the art manifest and what it
// names, the UI subset under ui/ and the files the DOM UI links from its styles and buttons.
export const ART_DIRECTORY = "art";

// App icons reach the precache through the page's links and the web app manifest; the icon
// contact sheet and vector master are review material the game never loads.
const NOT_PRECACHED: readonly string[] = ["app-icon/"];

// The URLs of the art the service worker precaches, given each file's path under ART_DIRECTORY
// with forward slashes. Every runtime art file is listed, so the art manifest, the UI manifest and
// the DOM UI need no list of their own, and an added file is precached by the next build.
export function artUrls(files: readonly string[]): string[] {
  return files
    .filter((file) => !NOT_PRECACHED.some((prefix) => file.startsWith(prefix)))
    .map((file) => `/${ART_DIRECTORY}/${file}`)
    .sort();
}

// The public directory of Tech's galaxy selector previews (tools/galaxy-previews.mjs), which the
// selector loads at runtime like the art.
export const PREVIEW_DIRECTORY = "previews";

// The URLs of the previews the service worker precaches, given each file's path under
// PREVIEW_DIRECTORY.
export function previewUrls(files: readonly string[]): string[] {
  return files.map((file) => `/${PREVIEW_DIRECTORY}/${file}`).sort();
}
