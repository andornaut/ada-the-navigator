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
  await page.locator('#game-status[data-mode="home"]').waitFor({ state: "attached" });
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
  await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
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

  await page.waitForFunction((key) => {
    const status = document.querySelector("#game-status");
    const saved = JSON.parse(localStorage.getItem(key));
    return (
      saved?.flight?.player?.x === Number(status.dataset.x) &&
      saved?.flight?.player?.y === Number(status.dataset.y)
    );
  }, storageKey);
  const persisted = await readSave();
  assert.equal(persisted.version, 1);
  await page.reload();
  await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
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

  const [{ GameModel }, { PROTOTYPE }, { ensureDestination }] = await Promise.all([
    import(new URL("../src/model/game.ts", import.meta.url)),
    import(new URL("../src/data/prototype.ts", import.meta.url)),
    import(new URL("../src/model/flight.ts", import.meta.url)),
  ]);
  async function seedOnce(value, marker) {
    // The old app's pagehide save runs before this one-shot seed on the new document.
    await page.addInitScript(
      ({ key, once, serialized }) => {
        if (!sessionStorage.getItem(once)) {
          localStorage.setItem(key, serialized);
          sessionStorage.setItem(once, "1");
        }
      },
      { key: storageKey, serialized: value, once: marker },
    );
    await page.reload();
  }
  const safeInput = new GameModel(PROTOTYPE);
  safeInput.startSector(1);
  safeInput.choose("0");
  Object.assign(safeInput.state.progress[1], {
    introduced: true,
    stage: 1,
    questItem: "food",
    known: ["growers"],
    discoveries: 1,
  });
  assert.ok(safeInput.state.flight, "Safe input fixture requires a real flight");
  const friendly = ensureDestination(PROTOTYPE, "growers", safeInput.state.flight);
  safeInput.teleport("growers");
  assert.deepEqual(safeInput.state.flight.player, { x: friendly.x, y: friendly.y });
  assert.equal(safeInput.state.flight.freshChunk, null);
  const safeSerialized = safeInput.save();
  assert.deepEqual(new GameModel(PROTOTYPE, safeSerialized).state, safeInput.state);
  save("input-fixture.json", {
    scope:
      "Friendly-destination safe-zone precondition for control checks only; no quest completion proof",
    state: JSON.parse(safeSerialized),
  });
  await seedOnce(safeSerialized, "ada-browser.input-fixture.v1");
  await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
  assert.deepEqual(await position(), safeInput.state.flight.player);
  events.checks.push(
    "Model-generated friendly-destination fixture supplies the input-check precondition",
  );
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
  const moveBounds = await page.locator('[data-control="move-joystick"]').boundingBox();
  const aimBounds = await page.locator('[data-control="aim-joystick"]').boundingBox();
  assert.ok(moveBounds && aimBounds, "Both real joystick targets must be present");
  const touchBefore = await position();
  const touch = await context.newCDPSession(page);
  const origins = [moveBounds, aimBounds].map((box, index) => ({
    id: index + 1,
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
    radiusX: 8,
    radiusY: 8,
    force: 1,
  }));
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: origins });
  try {
    const deflected = origins.map((point, index) => ({
      ...point,
      x: point.x + (index === 0 ? 25 : 0),
      y: point.y - (index === 1 ? 25 : 0),
    }));
    await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: deflected });
    await page.waitForFunction(
      ({ before, key }) => {
        const flight = JSON.parse(localStorage.getItem(key))?.flight;
        return (
          flight &&
          (flight.player.x !== before.x || flight.player.y !== before.y) &&
          flight.shots.some((shot) => !shot.enemy)
        );
      },
      { key: storageKey, before: touchBefore },
    );
    const held = (await readSave()).flight;
    save("touch-proof.json", {
      before: touchBefore,
      whileHeld: { player: held.player, shots: held.shots },
    });
    await page.screenshot({ path: `${output}/phone.png` });
  } finally {
    await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await touch.detach();
  }
  events.checks.push(
    "Simultaneous native move and aim touch changes saved position and emits player shots",
  );
  const touchReleased = await waitForRest(await position());
  await page.waitForFunction((key) => {
    const flight = JSON.parse(localStorage.getItem(key))?.flight;
    return flight && !flight.shots.some((shot) => !shot.enemy);
  }, storageKey);
  await page.waitForTimeout(1250);
  assert.deepEqual(
    await position(),
    touchReleased,
    "Released native touches must not resume movement",
  );
  assert.ok(
    !(await readSave()).flight.shots.some((shot) => !shot.enemy),
    "Released native aim must not resume firing",
  );
  events.checks.push("Native touch release clears movement and firing without resurrection");

  // This fixture proves only the saved-state UI boundary, not completion of the quest in a browser.
  const fixture = new GameModel(PROTOTYPE);
  fixture.startSector(1);
  fixture.choose("0");
  assert.ok(fixture.state.flight, "The real model must create a valid flight");
  Object.assign(fixture.state.progress[1], {
    stage: 4,
    introduced: true,
    questComplete: true,
    resolved: false,
    questItem: null,
    known: ["growers", "workshop", "salvagers"],
    discoveries: 3,
  });
  fixture.returnHome();
  assert.equal(fixture.state.dialogue.context, "resolution");
  const serialized = fixture.save();
  assert.deepEqual(new GameModel(PROTOTYPE, serialized).state, fixture.state);
  save("resolution-fixture.json", {
    scope: "Completed-quest save fixture for Toronto resolution UI boundary only",
    state: JSON.parse(serialized),
  });
  await seedOnce(serialized, "ada-browser.resolution-fixture.v1");
  await page.locator('#game-status[data-mode="home"]').waitFor({ state: "attached" });
  const choices = page.locator('[data-action="dialogue-choice"]');
  await page.getByText(PROTOTYPE.chapters[1].resolution, { exact: true }).waitFor();
  assert.equal(await choices.count(), 2, "Toronto resolution must offer both real choices");
  await page.screenshot({ path: `${output}/resolution.png` });
  await choices.nth(1).click();
  await page.getByText(PROTOTYPE.chapters[1].closing, { exact: true }).waitFor();
  assert.equal(await choices.count(), 1, "Resolution must lead to the closing continuation");
  assert.equal((await choices.first().textContent()).trim(), PROTOTYPE.labels.continue);
  await choices.first().click();
  const nextSector = page.locator('[data-action="start-sector"][data-sector="2"]');
  await nextSector.waitFor({ state: "visible" });
  assert.ok(await nextSector.isEnabled(), "Toronto resolution must unlock sector two");
  await page.waitForFunction((key) => {
    const state = JSON.parse(localStorage.getItem(key));
    return state?.progress[1].resolved && state.unlocked.includes(2);
  }, storageKey);
  events.checks.push("Fixture-based Toronto resolution and closing unlock the next sector UI");
  // Canonical save fixtures exercise rendering and restore boundaries, not natural combat progression.
  const [{ enemyCatalog }, { createEnemy, damageEnemy }, { restoreSave }] = await Promise.all([
    import(new URL("../src/data/enemy-catalog.ts", import.meta.url)),
    import(new URL("../src/model/enemy-ai.ts", import.meta.url)),
    import(new URL("../src/model/save.ts", import.meta.url)),
  ]);
  const combat = new GameModel(PROTOTYPE);
  combat.startSector(1);
  combat.choose("0");
  assert.ok(combat.state.flight, "Combat fixture requires a canonical flight");
  const flight = combat.state.flight;
  combat.state.progress[1].introduced = true;
  combat.state.dialogue = null;
  flight.objects = [];
  flight.shots = [];
  const origin = { ...flight.player };
  for (const [archetype, offset] of [
    ["capital", { x: -140, y: 140 }],
    ["oversizedCapital", { x: 350, y: -350 }],
  ]) {
    const definition = enemyCatalog[archetype];
    assert.ok(definition.hardpoints.length > 1, "Large enemies require distinct hardpoints");
    const at = { x: origin.x + offset.x, y: origin.y + offset.y };
    let enemy = createEnemy(
      definition,
      { archetype, id: `browser-combat:${archetype}`, packId: null, phase: 0 },
      at,
    );
    const engine = definition.hardpoints.find((part) => part.kind === "engine");
    assert.ok(engine, "Fixture requires a destructible engine");
    enemy = damageEnemy(definition, { amount: engine.hp, hardpointId: engine.id }, enemy);
    assert.ok(enemy.hardpoints.some((part) => part.hp === 0));
    assert.ok(enemy.hardpoints.some((part) => part.hp > 0));
    flight.objects.push({
      ...at,
      enemy,
      hp: definition.hp,
      id: enemy.id,
      kind: "enemy",
      radius: PROTOTYPE.tuning.flight.shipRadius * definition.sizeRatio,
    });
  }
  flight.shots.push({
    enemy: true,
    hitIds: [],
    id: "browser-combat:missile",
    life: PROTOTYPE.tuning.flight.enemyProjectileLifetime,
    piercing: false,
    projectile: "missile",
    velocity: { x: 12, y: 12 },
    x: origin.x,
    y: origin.y - 180,
  });
  const combatSerialized = combat.save();
  assert.deepEqual(restoreSave(combatSerialized), combat.state, "Canonical restore accepts combat");
  assert.deepEqual(new GameModel(PROTOTYPE, combatSerialized).state, combat.state);
  save("combat-fixture.json", {
    scope:
      "Real-model canonical save fixture with damaged hardpoints and a seeded missile; render/restore proof only, not natural encounter or combat completion",
    state: JSON.parse(combatSerialized),
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await seedOnce(combatSerialized, "ada-browser.combat-fixture.v1");
  await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
  await page.waitForFunction((key) => {
    const current = JSON.parse(localStorage.getItem(key))?.flight;
    return (
      current?.objects.some((object) => object.enemy?.archetype === "oversizedCapital") &&
      current.objects.some(
        (object) =>
          object.enemy?.archetype === "capital" &&
          object.enemy.hardpoints.some((part) => part.hp === 0) &&
          object.enemy.hardpoints.some((part) => part.hp > 0),
      ) &&
      current.shots.some((shot) => shot.enemy && shot.projectile === "missile")
    );
  }, storageKey);
  const combatSnapshot = await readSave();
  const canvas = page.locator("canvas");
  await canvas.waitFor({ state: "visible" });
  const combatImage = await canvas.screenshot({ path: `${output}/combat-canvas.png` });
  const pixels = await page.evaluate(async (encoded) => {
    const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const sample = document.createElement("canvas");
    sample.width = bitmap.width;
    sample.height = bitmap.height;
    const drawing = sample.getContext("2d");
    drawing.drawImage(bitmap, 0, 0);
    bitmap.close();
    // The ship is centered. These regions exclude it, the HUD and dim background markers.
    const regions = {
      capital: { x: 200, y: 200, width: 300, height: 300 },
      missile: { x: 780, y: 235, width: 90, height: 70 },
    };
    return Object.fromEntries(
      Object.entries(regions).map(([name, region]) => {
        const image = drawing.getImageData(region.x, region.y, region.width, region.height);
        let bright = 0;
        for (let offset = 0; offset < image.data.length; offset += 4) {
          if (Math.min(...image.data.slice(offset, offset + 3)) > 140) {
            bright++;
          }
        }
        return [name, { ...region, bright }];
      }),
    );
  }, combatImage.toString("base64"));
  assert.ok(pixels.capital.bright > 20, "Large-enemy region must contain rendered geometry");
  assert.ok(pixels.missile.bright > 2, "Seeded missile region must contain rendered geometry");
  await page.screenshot({ path: `${output}/combat.png` });
  save("combat-proof.json", {
    scope: "Rendered canonical combat fixture; screenshot review required for visual correctness",
    state: combatSnapshot,
    canvas: await canvas.boundingBox(),
    oversizedSizeRatio: enemyCatalog.oversizedCapital.sizeRatio,
    pixels,
  });
  events.checks.push(
    "Canonical combat save restores large and oversized enemies, partial hardpoint damage and missile with renderer screenshots",
  );

  await page.locator('[data-action="settings"]').click();
  const toggles = [];
  for (const key of ["sound", "screenShake"]) {
    const label = PROTOTYPE.labels[key];
    assert.equal(typeof label, "string", `Canonical ${key} settings label must exist`);
    const checkbox = page.getByRole("checkbox", { name: label, exact: true });
    await checkbox.waitFor({ state: "visible" });
    const initial = await checkbox.isChecked();
    await checkbox.setChecked(!initial);
    assert.equal(await checkbox.isChecked(), !initial, `${key} must toggle`);
    toggles.push({ key, initial, toggled: !initial });
  }
  await page.screenshot({ path: `${output}/combat-settings.png` });
  await page.locator('[data-action="close-settings"]').click();
  await page.locator('[data-action="settings"]').click();
  for (const { key, initial, toggled } of toggles) {
    const checkbox = page.getByRole("checkbox", { name: PROTOTYPE.labels[key], exact: true });
    assert.equal(await checkbox.isChecked(), toggled, `${key} survives dialog reopening`);
    await checkbox.setChecked(initial);
  }
  await page.locator('[data-action="close-settings"]').click();
  save("combat-settings-proof.json", {
    scope:
      "Checkbox interaction and dialog-state proof only; audio output and shake intensity unmeasured",
    toggles,
  });
  events.checks.push("Canonical sound and screen-shake controls toggle and retain dialog state");
  assert.deepEqual(events.errors, [], "No browser runtime or console errors");
  assert.deepEqual(events.failedRequests, [], "No failed asset requests");
  assert.deepEqual(events.badResponses, [], "No failed HTTP responses");
  save("result.json", { passed: true, checks: events.checks });
} catch (error) {
  save("result.json", { passed: false, error: error.stack });
  process.exitCode = 1;
  if (page) {
    try {
      const diagnostics = await page.evaluate(
        (key) => ({
          mode: document.querySelector("#game-status")?.dataset.mode ?? null,
          gameState: JSON.parse(localStorage.getItem(key) ?? "null"),
          targets: [...document.querySelectorAll("[data-control]")].map((target) => {
            const bounds = target.getBoundingClientRect();
            return {
              control: target.getAttribute("data-control"),
              x: bounds.x,
              y: bounds.y,
              width: bounds.width,
              height: bounds.height,
            };
          }),
        }),
        storageKey,
      );
      save("failure-diagnostics.json", diagnostics);
    } catch (diagnosticError) {
      save("failure-diagnostics-error.json", { error: diagnosticError.message });
    }
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
