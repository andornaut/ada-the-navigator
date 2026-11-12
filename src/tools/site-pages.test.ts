import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createServer } from "vite";
import { expect, it } from "vitest";

import { sitePages } from "./site-pages.ts";

it("redirects /play to /play/ with its query and serves both pages from pages/", async () => {
  const root = mkdtempSync(join(tmpdir(), "ada-site-"));
  mkdirSync(join(root, "pages/play"), { recursive: true });
  writeFileSync(join(root, "pages/index.html"), '<title>Site</title><a href="/play/">Play</a>');
  writeFileSync(join(root, "pages/play/index.html"), "<title>Game</title>");
  const server = await createServer({
    configFile: false,
    logLevel: "silent",
    plugins: [sitePages()],
    root: join(root, "pages"),
    server: { hmr: false, host: "127.0.0.1", port: 0 },
  });
  try {
    await server.listen();
    const address = server.resolvedUrls!.local[0]!;
    expect(await (await fetch(`${address}?from=bookmark`)).text()).toContain("<title>Site</title>");
    expect(await (await fetch(`${address}play/?from=site`)).text()).toContain(
      "<title>Game</title>",
    );
    const canonical = await fetch(`${address}play?from=bookmark`, { redirect: "manual" });
    expect(canonical.status).toBe(308);
    expect(canonical.headers.get("location")).toBe("/play/?from=bookmark");
  } finally {
    await server.close();
  }
});
