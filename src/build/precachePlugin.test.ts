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

it("forwards the build identity, boot files and grouped first install to the kit's producer", () => {
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
  expect(options.packs).toBeUndefined();
  expect(options.wholeBuild).toBeUndefined();
  expect(options.emitUpdateGroupRecipes).toBeUndefined();
  const archiveOnly = options.groupedFirstInstall!.archiveOnly;
  expect(archiveOnly("/art/manifest.json")).toBe(true);
  expect(archiveOnly("/previews/sunflower.png")).toBe(true);
  for (const direct of [
    "/play/",
    "/sw.js",
    "/site.css",
    "/art/portraits/ada.png",
    "/art/ui/fonts/adaui/AdaUI-Bold.woff2",
    "/art/ui/fonts/adaui/AdaUI-Regular.woff2",
    "/art/ui/icons/icons-16x16.svg",
  ]) {
    expect(archiveOnly(direct)).toBe(false);
  }
  const updateGroup = options.updateGroup!;
  expect(updateGroup("/assets/main-Abc012_-.js")).toBe(updateGroup("/assets/main-wxy98745.js"));
  expect(updateGroup("/assets/launch-Abc012_-.js")).not.toBe(
    updateGroup("/assets/main-Abc012_-.js"),
  );
  expect(updateGroup("/assets/art/app-icon/mask-Abc012_-.svg")).toBe("app-icons");
  expect(updateGroup("/previews/sunflower.png")).toBe("preview");
  expect(updateGroup("/art/manifest.json")).toMatch(/^art:core:[0-2]$/u);
  expect(updateGroup("/art/whales/whale-0.svg")).toMatch(/^art:whales:[0-3]$/u);
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
