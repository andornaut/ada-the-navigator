import type { PrecachePluginOptions } from "@andornaut/game-kit/build/precachePlugin";
import { expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({ options: undefined as PrecachePluginOptions | undefined }));
vi.mock("@andornaut/game-kit/build/precachePlugin", () => ({
  precachePlugin: (options: PrecachePluginOptions) => {
    captured.options = options;
    return { name: "public-precache-port" };
  },
}));
import { bootUrls, precachePlugin } from "./precachePlugin.ts";

it("forwards the build identity, boot files and decoded pack limit to the kit's producer", () => {
  const full = "1".repeat(40);
  const discovery = {
    sounds: {},
    urls: ["/art/a.svg", "/art/manifest.json", "/art/z.svg", "/assets/main.js", "/play/"],
  };
  precachePlugin({
    buildId: full,
    pageHtmlFile: "play/index.html",
    serviceWorkerSource: "/source/worker.ts",
  });
  const options = captured.options!;
  expect(options.buildId).toBe(full);
  expect(options.packs).toEqual({ maxBytes: 1536 * 1024 });
  expect(options).not.toHaveProperty("groups");
  expect(options.verifiedJsonBodies).toBeUndefined();
  options.hashedFiles!((url) =>
    url === "/art/manifest.json"
      ? new TextEncoder().encode('{"assets":[{"path":"/art/a.svg"},{"path":"/art/gone.svg"}]}')
      : undefined,
  );
  expect(options.boot!(discovery)).toEqual(["/art/a.svg", "/art/manifest.json", "/assets/main.js"]);
});

it("weights boot by the build output, the core art manifest and the files core names", () => {
  const read = vi.fn(() => ({ assets: [{ path: "/art/b.svg" }, { path: 3 }, {}] }));
  expect(
    bootUrls(read, { sounds: {}, urls: ["/art/b.svg", "/art/c.svg", "/assets/x.css"] }),
  ).toEqual(["/art/b.svg", "/art/manifest.json", "/assets/x.css"]);
  expect(read).toHaveBeenCalledWith("/art/manifest.json");
});

it("preserves the public production rejection for missing clean Git identity", async () => {
  const actual = await vi.importActual<typeof import("@andornaut/game-kit/build/precachePlugin")>(
    "@andornaut/game-kit/build/precachePlugin",
  );
  const plugin = actual.precachePlugin({
    buildId: "2".repeat(40),
    pageHtmlFile: "play/index.html",
    policy: { cacheNamePrefix: "test-", hashedAssetPrefix: "/assets/" },
    serviceWorkerSource: "/source/worker.ts",
  });
  const hook = plugin.configResolved as (config: { root: string; define: object }) => void;
  expect(() => hook({ define: {}, root: "/tmp/no-release-git-identity" })).toThrow(
    "matching clean source and full buildId",
  );
});
