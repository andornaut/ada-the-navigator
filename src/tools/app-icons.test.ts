import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));
interface ManifestIcon {
  purpose: string;
  sizes: string;
  src: string;
  type: string;
}

it("uses one play-route app identity with correctly sized local any and maskable PNGs", () => {
  const manifest = JSON.parse(readFileSync(resolve(root, "public/manifest.webmanifest"), "utf8"));
  expect(manifest.id).toBe("/play/");
  expect(manifest.start_url).toBe("/play/");
  expect(manifest.scope).toBe("/");
  expect(
    new URL(manifest.start_url, "https://example.invalid").pathname.startsWith(manifest.scope),
  ).toBe(true);
  const icons = manifest.icons as ManifestIcon[];
  expect(icons.map(({ purpose, sizes }) => `${purpose}:${sizes}`).sort()).toEqual([
    "any:192x192",
    "any:512x512",
    "maskable:512x512",
  ]);
  for (const icon of icons) {
    expect(icon.src.startsWith("/art/app-icon/")).toBe(true);
    expect(icon.type).toBe("image/png");
    const file = readFileSync(resolve(root, "public", `.${icon.src}`));
    expect(file.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(file.subarray(12, 16).toString()).toBe("IHDR");
    expect(`${file.readUInt32BE(16)}x${file.readUInt32BE(20)}`).toBe(icon.sizes);
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
