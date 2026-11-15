import type { PrecachePluginOptions } from "@andornaut/game-kit/build/precachePlugin";
import { expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({ options: undefined as PrecachePluginOptions | undefined }));
vi.mock("@andornaut/game-kit/build/precachePlugin", () => ({
  precachePlugin: (options: PrecachePluginOptions) => {
    captured.options = options;
    return { name: "public-precache-port" };
  },
}));
import { precachePlugin } from "./precachePlugin.ts";
it("forwards full build identity and complete post-emission discovery to the existing producer", () => {
  const full = "1".repeat(40);
  const groups = vi.fn((context: { readJson: (url: string) => unknown }, files: unknown) => {
    expect(context.readJson("/art/manifest.json")).toEqual({ value: 1 });
    expect(files).toBe(discovery);
    return { initial: ["sunflower", "whirlpool"], urls: {} };
  });
  const discovery = {
    sounds: { mp3: ["/assets/sound.mp3"], ogg: ["/assets/sound.ogg"] },
    urls: ["/assets/main.js", "/art/manifest.json"],
  };
  precachePlugin({
    buildId: full,
    groups,
    pageHtmlFile: "play/index.html",
    serviceWorkerSource: "/source/worker.ts",
  });
  const options = captured.options!;
  expect(options.buildId).toBe(full);
  options.hashedFiles!((url) =>
    url === "/art/manifest.json" ? new TextEncoder().encode('{"value":1}') : undefined,
  );
  expect(options.groups!(discovery)).toEqual({ initial: ["sunflower", "whirlpool"], urls: {} });
  expect(groups).toHaveBeenCalledOnce();
});
it("keeps development ungrouped only when its caller explicitly omits group configuration", () => {
  precachePlugin({ pageHtmlFile: "play/index.html", serviceWorkerSource: "/source/worker.ts" });
  expect(captured.options!.groups).toBeUndefined();
  expect(captured.options!.buildId).toBeUndefined();
});
it("preserves the public production rejection for missing clean Git identity", async () => {
  const actual = await vi.importActual<
    typeof import("@andornaut/game-kit/build/precachePlugin")
  >("@andornaut/game-kit/build/precachePlugin");
  const plugin = actual.precachePlugin({
    groups: () => ({ initial: [], urls: {} }),
    pageHtmlFile: "play/index.html",
    policy: { cacheNamePrefix: "test-", hashedAssetPrefix: "/assets/" },
    serviceWorkerSource: "/source/worker.ts",
  });
  const hook = plugin.configResolved as (config: { root: string }) => void;
  expect(() => hook({ root: "/tmp/no-release-git-identity" })).toThrow(
    "matching clean source and full buildId",
  );
});
