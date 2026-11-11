import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));

// A PNG's width x height from its IHDR chunk.
function pngSize(file: Buffer): string {
  expect(file.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(file.subarray(12, 16).toString()).toBe("IHDR");
  return `${file.readUInt32BE(16)}x${file.readUInt32BE(20)}`;
}

interface ManifestIcon {
  purpose: string;
  sizes: string;
  src: string;
  type: string;
}

it("uses one play-route app identity", () => {
  const manifest = JSON.parse(readFileSync(resolve(root, "public/manifest.webmanifest"), "utf8"));
  expect(manifest.id).toBe("/play/");
  expect(manifest.start_url).toBe("/play/");
  expect(manifest.scope).toBe("/");
  expect(
    new URL(manifest.start_url, "https://example.invalid").pathname.startsWith(manifest.scope),
  ).toBe(true);
});

it("gives both pages the manifest's theme colour, so the installed app's colour never changes", () => {
  const manifest = JSON.parse(readFileSync(resolve(root, "public/manifest.webmanifest"), "utf8"));
  expect(manifest.background_color).toBe(manifest.theme_color);
  for (const page of ["pages/index.html", "pages/play/index.html"]) {
    const html = readFileSync(resolve(root, page), "utf8");
    const colours = [...html.matchAll(/<meta\s+name="theme-color"\s+content="([^"]+)"/gu)];
    expect(
      colours.map((match) => match[1]),
      page,
    ).toEqual([manifest.theme_color]);
  }
});

it("names the installed app in full and describes it as the landing page does", () => {
  const manifest = JSON.parse(readFileSync(resolve(root, "public/manifest.webmanifest"), "utf8"));
  const landing = readFileSync(resolve(root, "pages/index.html"), "utf8");
  const description = /<meta\s+name="description"\s+content="([^"]+)"/u.exec(landing)?.[1];
  expect(manifest.name).toBe("Ada the Navigator");
  expect(manifest.short_name).toBe(manifest.name);
  expect(description).toBeDefined();
  expect(manifest.description).toBe(description);
});

it("declares correctly sized local any and maskable PNGs", () => {
  const manifest = JSON.parse(readFileSync(resolve(root, "public/manifest.webmanifest"), "utf8"));
  const icons = manifest.icons as ManifestIcon[];
  expect(icons.map(({ purpose, sizes }) => `${purpose}:${sizes}`).sort()).toEqual([
    "any:192x192",
    "any:512x512",
    "maskable:512x512",
  ]);
  for (const icon of icons) {
    expect(icon.src.startsWith("/art/app-icon/")).toBe(true);
    expect(icon.type).toBe("image/png");
    expect(pngSize(readFileSync(resolve(root, "public", `.${icon.src}`)))).toBe(icon.sizes);
  }
  const favicon = readFileSync(resolve(root, "public/art/app-icon/favicon.ico"));
  expect(favicon.readUInt16LE(0)).toBe(0);
  expect(favicon.readUInt16LE(2)).toBe(1);
  const sizes = Array.from({ length: favicon.readUInt16LE(4) }, (_, index) => {
    const start = 6 + index * 16;
    return `${favicon[start] || 256}x${favicon[start + 1] || 256}`;
  });
  expect(sizes.sort()).toEqual(["16x16", "32x32"]);
});

it.each(["pages/index.html", "pages/play/index.html"])(
  "links %s to the favicon and sized PNG icons that exist",
  (page) => {
    const html = readFileSync(resolve(root, page), "utf8");
    const links = Array.from(
      html.matchAll(/<link\s+rel="(icon|apple-touch-icon)"[^>]*>/gu),
      ([tag]) => ({
        href: /href="([^"]+)"/u.exec(tag)?.[1] ?? "",
        rel: /rel="([^"]+)"/u.exec(tag)?.[1] ?? "",
        sizes: /sizes="([^"]+)"/u.exec(tag)?.[1] ?? "",
      }),
    );
    expect(links.map(({ rel, sizes }) => `${rel}:${sizes}`)).toEqual([
      "icon:any",
      "icon:32x32",
      "icon:16x16",
      "apple-touch-icon:180x180",
    ]);
    for (const { href, sizes } of links) {
      expect(href.startsWith("/art/app-icon/")).toBe(true);
      const file = readFileSync(resolve(root, "public", `.${href}`));
      if (sizes !== "any") {
        expect(pngSize(file), href).toBe(sizes);
      }
    }
  },
);
