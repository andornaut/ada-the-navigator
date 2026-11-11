import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { hashedIconUrl } from "@andornaut/game-kit/web/pwa/hashedIcons";
import { webManifestIconUrls } from "@andornaut/game-kit/web/pwa/precacheList";
import { describe, expect, it } from "vitest";

import { CACHE_POLICY } from "./cachePolicy.ts";
import { ICONS } from "./icons.ts";

const REPO = join(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(join(REPO, path), "utf8");

// The icons a page links: its rel="icon" and rel="apple-touch-icon" hrefs.
function pageIcons(html: string): string[] {
  const links = html.match(/<link\b[^>]*>/g) ?? [];
  return links
    .filter((link) => /\srel="(icon|apple-touch-icon)"/.test(link))
    .map((link) => /\shref="([^"]+)"/.exec(link)?.[1] ?? "");
}

describe("ICONS", () => {
  it.each(["pages/index.html", "pages/play/index.html"])("lists every icon %s links", (page) => {
    const icons = pageIcons(read(page));
    expect(icons.length).toBeGreaterThan(0);
    expect(icons.filter((url) => !ICONS.includes(url))).toEqual([]);
  });

  it("lists every icon the web app manifest names", () => {
    const icons = webManifestIconUrls(JSON.parse(read("public/manifest.webmanifest")));
    expect(icons.length).toBeGreaterThan(0);
    expect(icons.filter((url) => !ICONS.includes(url))).toEqual([]);
  });

  it.each(ICONS)("has %s under public/", (url) => {
    expect(existsSync(join(REPO, "public", url))).toBe(true);
  });

  it("renames each icon to a URL the worker serves cache-first", () => {
    const hashed = ICONS.map((url) => hashedIconUrl("assets", url, "Ab12Cd34"));
    expect(hashed.filter((url) => !url.startsWith(CACHE_POLICY.hashedAssetPrefix))).toEqual([]);
  });
});
