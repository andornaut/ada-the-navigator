import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const output = "/tmp/evidence";
const storageKey = "ada-the-navigator.prototype.v1";
const events = { errors: [], failedRequests: [], badResponses: [], checks: [] };
mkdirSync(output, { recursive: true });

function save(name, value) {
  writeFileSync(`${output}/${name}`, `${JSON.stringify(value, null, 2)}\n`);
}

const watchdog = setTimeout(() => {
  save("events.json", events);
  save("result.json", { passed: false, error: "Browser smoke exceeded 120 seconds" });
  process.exit(124);
}, 120000);

let browser;
let page;
try {
  const require = createRequire("/app/package.json");
  const { chromium } = require("playwright");
  browser = await chromium.launch({ channel: "chromium", headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    hasTouch: true,
  });
  page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(15000);
  page.on("pageerror", (error) => events.errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      events.errors.push(message.text());
    }
  });
  page.on("requestfailed", (request) =>
    events.failedRequests.push({
      url: request.url(),
      error: request.failure()?.errorText,
    }),
  );
  page.on("response", (response) => {
    if (response.status() >= 400) {
      events.badResponses.push({ url: response.url(), status: response.status() });
    }
  });
  // No outside requests are needed to render the built prototype.
  await context.route("**/*", (route) => {
    if (new URL(route.request().url()).origin === "http://ada-preview:4173") {
      return route.continue();
    }
    return route.abort("blockedbyclient");
  });
  const response = await page.goto("http://ada-preview:4173/");
  assert.equal(response.status(), 200);
  await page.locator('#game-status[data-mode="home"]').waitFor();
  await page.locator("canvas").waitFor({ state: "visible" });
  assert.ok(
    await page.locator("canvas").evaluate((canvas) => canvas.width > 0 && canvas.height > 0),
  );
  events.checks.push("Real renderer and accessible home status");

  await page.locator('[data-action="start-sector"][data-sector="1"]').click();
  async function enterFlight(remaining) {
    await page.waitForFunction(
      () =>
        document.querySelector("#game-status")?.dataset.mode === "space" ||
        document.querySelector('[data-action="dialogue-choice"]'),
    );
    if (await page.locator('#game-status[data-mode="space"]').count()) {
      return;
    }
    assert.ok(remaining > 0, "Sector launch must reach space within the opening dialogue");
    await page.locator('[data-action="dialogue-choice"]').first().click();
    await enterFlight(remaining - 1);
  }
  await enterFlight(4);
  await page.locator('#game-status[data-mode="space"]').waitFor();
  const position = () =>
    page.locator("#game-status").evaluate((element) => ({
      x: Number(element.dataset.x),
      y: Number(element.dataset.y),
    }));
  const readSave = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
  async function waitForRest(previous, remaining = 20) {
    await page.waitForTimeout(250);
    const current = await position();
    if (current.x === previous.x && current.y === previous.y) {
      return current;
    }
    assert.ok(remaining > 0, "Released movement must settle");
    return waitForRest(current, remaining - 1);
  }
  const before = await position();
  assert.ok(Number.isFinite(before.x) && Number.isFinite(before.y));
  await page.keyboard.down("d");
  try {
    await page.waitForFunction(({ x, y }) => {
      const status = document.querySelector("#game-status");
      return Number(status.dataset.x) !== x || Number(status.dataset.y) !== y;
    }, before);
  } finally {
    await page.keyboard.up("d");
  }
  events.checks.push("Keyboard input changes actual flight coordinates");
  await waitForRest(await position());
  await page.screenshot({ path: `${output}/desktop.png` });

  await page.keyboard.down("d");
  try {
    await page.locator('[data-action="settings"]').click();
    await page.locator('[data-action="close-settings"]').waitFor({ state: "visible" });
    const paused = await position();
    await page.waitForTimeout(250);
    assert.deepEqual(await position(), paused, "Settings must pause movement");
    await page.locator('[data-action="close-settings"]').click();
    await waitForRest(await position());
  } finally {
    await page.keyboard.up("d");
  }
  events.checks.push("Settings pause movement and clear held input on resume");

  const persisted = await readSave();
  assert.equal(persisted.version, 1);
  await page.reload();
  await page.locator('#game-status[data-mode="space"]').waitFor();
  const resumed = await readSave();
  for (const field of ["seed", "cargo", "ammo", "shield", "player"]) {
    assert.deepEqual(
      resumed.flight[field],
      persisted.flight[field],
      `Reload must retain flight ${field}`,
    );
  }
  assert.deepEqual(resumed.progress, persisted.progress);
  events.checks.push("Reload resumes the persisted flight without regeneration");

  await page.setViewportSize({ width: 844, height: 390 });
  const joystick = page.locator('[data-control="move-joystick"]');
  await joystick.waitFor({ state: "visible" });
  const bounds = await joystick.boundingBox();
  assert.ok(bounds && bounds.width > 0 && bounds.height > 0);
  const pointerStart = await position();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  try {
    await page.mouse.move(bounds.x + bounds.width * 0.85, bounds.y + bounds.height / 2, {
      steps: 5,
    });
    await page.waitForFunction(({ x, y }) => {
      const status = document.querySelector("#game-status");
      return Number(status.dataset.x) !== x || Number(status.dataset.y) !== y;
    }, pointerStart);
  } finally {
    await page.mouse.up();
  }
  events.checks.push("Pointer joystick changes actual flight coordinates");
  const released = await waitForRest(await position());
  await page.waitForTimeout(250);
  assert.deepEqual(await position(), released, "Pointer release must cancel held movement");
  events.checks.push("Pointer release cancels movement");
  await page.screenshot({ path: `${output}/phone.png` });
  assert.deepEqual(events.errors, [], "No browser runtime or console errors");
  assert.deepEqual(events.failedRequests, [], "No failed asset requests");
  assert.deepEqual(events.badResponses, [], "No failed HTTP responses");
  save("result.json", { passed: true, checks: events.checks });
} catch (error) {
  save("result.json", { passed: false, error: error.stack });
  process.exitCode = 1;
  if (page) {
    try {
      await page.screenshot({ path: `${output}/failure.png`, timeout: 3000 });
    } catch {
      /* The result and Docker logs remain available if rendering failed. */
    }
  }
} finally {
  save("events.json", events);
  if (browser) {
    await browser.close();
  }
  clearTimeout(watchdog);
}
