import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { build, createServer } from "vite";
import { expect, it } from "vitest";

import { sitePageInputs, sitePages } from "./site-pages.ts";

it("serves landing and play independently and builds both public URLs with working game imports", async () => {
  const root = mkdtempSync(join(tmpdir(), "ada-site-"));
  mkdirSync(join(root, "pages/play"), { recursive: true });
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "pages/index.html"), '<title>Site</title><a href="/play/">Play</a>');
  writeFileSync(
    join(root, "pages/play/index.html"),
    '<title>Game</title><script type="module" src="/src/main.ts"></script>' +
      '<script type="module" src="./entry.ts"></script>',
  );
  writeFileSync(join(root, "src/main.ts"), 'document.body.dataset.booted = "game";');
  writeFileSync(
    join(root, "pages/play/entry.ts"),
    'import "./part.ts";document.body.dataset.relative = "page";',
  );
  writeFileSync(join(root, "pages/play/part.ts"), 'document.body.dataset.part = "relative";');
  const server = await createServer({
    configFile: false,
    logLevel: "silent",
    plugins: [sitePages()],
    root,
    server: { hmr: false, host: "127.0.0.1", port: 0 },
  });
  try {
    await server.listen();
    const address = server.resolvedUrls!.local[0]!;
    expect(await (await fetch(`${address}?from=bookmark`)).text()).toContain("<title>Site</title>");
    expect(await (await fetch(`${address}play/?from=site`)).text()).toContain(
      "<title>Game</title>",
    );
    expect(await (await fetch(`${address}src/main.ts`)).text()).toContain(
      'dataset.booted = "game"',
    );
    expect(await (await fetch(`${address}play/entry.ts`)).text()).toContain("dataset.relative");
    const canonical = await fetch(`${address}play?from=bookmark`, { redirect: "manual" });
    expect(canonical.status).toBe(308);
    expect(canonical.headers.get("location")).toBe("/play/?from=bookmark");
  } finally {
    await server.close();
  }
  await build({
    build: { outDir: "dist", rolldownOptions: { input: sitePageInputs(root) } },
    configFile: false,
    logLevel: "silent",
    plugins: [sitePages()],
    root,
  });
  const landing = readFileSync(join(root, "dist/index.html"), "utf8");
  const play = readFileSync(join(root, "dist/play/index.html"), "utf8");
  expect(landing).toContain('href="/play/"');
  expect(landing).not.toContain('type="module"');
  const gameModule = play.match(/src="(\/assets\/[^"]+\.js)"/);
  expect(gameModule).not.toBeNull();
  const gameCode = readFileSync(join(root, "dist", gameModule![1]!), "utf8");
  expect(gameCode).toContain("booted");
  expect(gameCode).toContain("relative");
});
