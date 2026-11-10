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
  function observe(observed) {
    observed.on("pageerror", (error) => events.errors.push(error.message));
    observed.on("console", (message) => {
      if (message.type() === "error") {
        events.errors.push(message.text());
      }
    });
    observed.on("requestfailed", (request) =>
      events.failedRequests.push({
        url: request.url(),
        error: request.failure()?.errorText,
      }),
    );
    observed.on("response", (response) => {
      if (response.status() >= 400) {
        events.badResponses.push({ url: response.url(), status: response.status() });
      }
    });
  }
  observe(page);
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
  async function contextControlProof(expected, phase) {
    assert.equal(await page.locator(".ada-use:visible").count(), expected,
      `${phase}: the dedicated control must be the only visible contextual action`);
    assert.equal(await page.locator('[data-action="interact"]').count(), 0,
      `${phase}: travel must not duplicate the contextual action`);
  }
  await contextControlProof(0, "home");
  async function frameProof(portrait = false) {
    const frame = await page.locator("canvas").evaluate((canvas) => {
      const bounds = canvas.getBoundingClientRect();
      const style = getComputedStyle(document.body);
      const matrix = new DOMMatrixReadOnly(
        style.transform === "none" ? undefined : style.transform,
      );
      return {
        intrinsic: { width: canvas.width, height: canvas.height },
        bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
        body: { width: document.body.clientWidth, height: document.body.clientHeight },
        rotation: { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d },
        imageRendering: getComputedStyle(canvas).imageRendering,
        viewport: { width: innerWidth, height: innerHeight },
      };
    });
    assert.ok(frame.intrinsic.width >= 720 && frame.intrinsic.height >= 360);
    assert.ok(
      Math.abs(frame.intrinsic.width - 720) <= 1 || Math.abs(frame.intrinsic.height - 360) <= 1,
      "EXPAND must preserve one logical base dimension of 720x360",
    );
    const displayRatio = portrait
      ? frame.bounds.height / frame.bounds.width
      : frame.bounds.width / frame.bounds.height;
    assert.ok(
      Math.abs(frame.intrinsic.width / frame.intrinsic.height - displayRatio) < 0.02,
      "Canvas base dimensions and CSS display must scale uniformly",
    );
    assert.ok(["pixelated", "crisp-edges"].includes(frame.imageRendering));
    if (portrait) {
      assert.ok(Math.abs(frame.rotation.a) < 0.001 && Math.abs(frame.rotation.d) < 0.001);
      assert.ok(Math.abs(Math.abs(frame.rotation.b) - 1) < 0.001);
      assert.ok(Math.abs(frame.rotation.b + frame.rotation.c) < 0.001);
      assert.ok(
        frame.body.width > frame.body.height,
        "Portrait body must retain a landscape frame",
      );
      assert.ok(
        frame.bounds.height > frame.bounds.width,
        "Landscape canvas must turn into portrait",
      );
      assert.ok(Math.abs(frame.bounds.x) < 3 && Math.abs(frame.bounds.y) < 3);
      assert.ok(Math.abs(frame.bounds.width - frame.viewport.width) < 3);
      assert.ok(Math.abs(frame.bounds.height - frame.viewport.height) < 3);
    } else {
      assert.ok(Math.abs(frame.rotation.a - 1) < 0.001 && Math.abs(frame.rotation.b) < 0.001);
      assert.ok(frame.bounds.width > frame.bounds.height);
    }
    return frame;
  }
  save("desktop-frame.json", await frameProof());
  events.checks.push("Desktop canvas preserves the 720x360 EXPAND base and pixel-art scaling");

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
  await page.locator(".ada-use").waitFor({ state: "visible" });
  await contextControlProof(1, "friendly flight");
  assert.equal((await page.locator(".ada-use").textContent()).trim(), PROTOTYPE.labels.talk);
  const beforeStorageFailure = await page.evaluate((key) => {
    const saved = localStorage.getItem(key);
    window.__adaOriginalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
    return saved;
  }, storageKey);
  try {
    await page.locator('[data-action="settings"]').click();
    const warning = page.getByRole("status").filter({ hasText: PROTOTYPE.labels.savingUnavailable });
    await warning.waitFor({ state: "visible" });
    assert.equal(await warning.count(), 1, "Save failure must have one accessible status");
    assert.equal(await warning.getAttribute("id"), "save-status");
    await page.locator('[data-action="close-settings"]').click();
    const blockedPosition = await position();
    await page.keyboard.down("d");
    try {
      await page.waitForFunction(({ x, y }) => {
        const status = document.querySelector("#game-status");
        return Number(status.dataset.x) !== x || Number(status.dataset.y) !== y;
      }, blockedPosition);
    } finally {
      await page.keyboard.up("d");
    }
    await waitForRest(await position());
    assert.equal(await warning.textContent(), PROTOTYPE.labels.savingUnavailable);
    await page.locator(".ada-use").click();
    await page.locator('[data-action="dialogue-choice"]').first().waitFor({ state: "visible" });
    await contextControlProof(0, "dialogue during save failure");
    assert.equal(await warning.textContent(), PROTOTYPE.labels.savingUnavailable,
      "Dialogue rendering must not clear a failed-save warning");
    await page.locator('[data-action="dialogue-choice"][data-choice="continue"]').click();
    await page.locator(".ada-use").waitFor({ state: "visible" });
    await contextControlProof(1, "resumed flight");
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press("Space");
    await page.locator('[data-action="dialogue-choice"]').first().waitFor({ state: "visible" });
    await contextControlProof(0, "keyboard interaction dialogue");
    await page.locator('[data-action="dialogue-choice"][data-choice="continue"]').click();
    assert.equal(await warning.textContent(), PROTOTYPE.labels.savingUnavailable);
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), storageKey), beforeStorageFailure,
      "Failed writes must preserve the last persisted state");
    await page.screenshot({ path: `${output}/save-unavailable.png` });
  } finally {
    await page.evaluate(() => {
      Storage.prototype.setItem = window.__adaOriginalSetItem;
      delete window.__adaOriginalSetItem;
    });
  }
  await page.locator('[data-action="settings"]').click();
  await page.waitForFunction((key) => {
    const saved = JSON.parse(localStorage.getItem(key));
    const status = document.querySelector("#game-status");
    return document.querySelector("#save-status")?.textContent === "" &&
      saved?.flight?.player.x === Number(status.dataset.x) &&
      saved?.flight?.player.y === Number(status.dataset.y);
  }, storageKey);
  await page.locator('[data-action="close-settings"]').click();
  await contextControlProof(1, "recovered flight");
  events.checks.push("Blocked browser storage preserves gameplay and last save; status survives dialogue and clears after successful write");
  events.checks.push("One dedicated context control supports pointer and keyboard use, absent in home and dialogue");

  const dangerInput = new GameModel(PROTOTYPE, safeSerialized);
  dangerInput.state.flight.dangerFor = 5;
  dangerInput.state.flight.player.x += PROTOTYPE.tuning.safeRadius * 3;
  dangerInput.state.flight.objects = [];
  dangerInput.state.flight.shots = [];
  await seedOnce(dangerInput.save(), "ada-browser.danger-context.v1");
  await page.locator('[data-action="return-home"]:disabled').waitFor({ state: "visible" });
  await contextControlProof(0, "danger outside a friendly destination");
  events.checks.push("Danger blocks travel and exposes no inapplicable or duplicate contextual control");
  await seedOnce(safeSerialized, "ada-browser.after-save-proof.v1");
  await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
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
  await contextControlProof(0, "home resolution");
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
      "Real-model save fixture with damaged hardpoints and a seeded missile; " +
      "render/restore proof only, not natural encounter or combat completion",
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
  const intrinsic = await canvas.evaluate((element) => ({
    width: element.width,
    height: element.height,
  }));
  const pixels = await page.evaluate(
    async ({ encoded, intrinsic }) => {
      const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const sample = document.createElement("canvas");
      sample.width = bitmap.width;
      sample.height = bitmap.height;
      const drawing = sample.getContext("2d");
      drawing.drawImage(bitmap, 0, 0);
      bitmap.close();
      // Projection is anchored to logical SCREEN center (360,180), even when EXPAND adds height.
      const regions = {
        capital: { x: 10, y: 130, width: 140, height: 125 },
        missile: { x: 510, y: 65, width: 65, height: 55 },
      };
      return Object.fromEntries(
        Object.entries(regions).map(([name, region]) => {
          const scaleX = sample.width / intrinsic.width;
          const scaleY = sample.height / intrinsic.height;
          const bitmapRegion = {
            x: Math.floor((region.x + Math.max(0, (intrinsic.width - 720) / 2)) * scaleX),
            y: Math.floor(region.y * scaleY),
            width: Math.max(1, Math.floor(region.width * scaleX)),
            height: Math.max(1, Math.floor(region.height * scaleY)),
          };
          const image = drawing.getImageData(
            bitmapRegion.x,
            bitmapRegion.y,
            bitmapRegion.width,
            bitmapRegion.height,
          );
          let bright = 0;
          for (let offset = 0; offset < image.data.length; offset += 4) {
            if (Math.min(...image.data.slice(offset, offset + 3)) > 140) {
              bright++;
            }
          }
          return [name, { logical: region, bitmap: bitmapRegion, bright }];
        }),
      );
    },
    { encoded: combatImage.toString("base64"), intrinsic },
  );
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
    "Canonical combat save restores large and oversized enemies, partial hardpoint damage " +
      "and missile with renderer screenshots",
  );

  await page.locator('[data-action="settings"]').click();
  const toggles = [];
  async function toggleSetting(key) {
    const label = PROTOTYPE.labels[key];
    assert.equal(typeof label, "string", `Canonical ${key} settings label must exist`);
    const checkbox = page.getByRole("checkbox", { name: label, exact: true });
    await checkbox.waitFor({ state: "visible" });
    const initial = await checkbox.isChecked();
    await checkbox.setChecked(!initial);
    assert.equal(await checkbox.isChecked(), !initial, `${key} must toggle`);
    toggles.push({ key, initial, toggled: !initial });
  }
  await toggleSetting("sound");
  await toggleSetting("screenShake");
  await page.screenshot({ path: `${output}/combat-settings.png` });
  await page.locator('[data-action="close-settings"]').click();
  await page.locator('[data-action="settings"]').click();
  async function restoreSetting({ initial, key, toggled }) {
    const checkbox = page.getByRole("checkbox", { name: PROTOTYPE.labels[key], exact: true });
    assert.equal(await checkbox.isChecked(), toggled, `${key} survives dialog reopening`);
    await checkbox.setChecked(initial);
  }
  await restoreSetting(toggles[0]);
  await restoreSetting(toggles[1]);
  await page.locator('[data-action="close-settings"]').click();
  save("combat-settings-proof.json", {
    scope:
      "Checkbox interaction and dialog-state proof only; audio output and shake intensity unmeasured",
    toggles,
  });
  events.checks.push("Canonical sound and screen-shake controls toggle and retain dialog state");
  const portraitContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  await portraitContext.route("**/*", (route) =>
    new URL(route.request().url()).origin === "http://ada-preview:4173"
      ? route.continue()
      : route.abort("blockedbyclient"),
  );
  await portraitContext.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: storageKey,
    value: safeSerialized,
  });
  page = await portraitContext.newPage();
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(15000);
  observe(page);
  assert.equal((await page.goto("http://ada-preview:4173/")).status(), 200);
  await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
  await page.locator('[data-control="aim-joystick"]').waitFor({ state: "visible" });
  // Wait for the kit/Phaser viewport synchronization after its first painted frame.
  await page.waitForFunction(() => {
    const transform = getComputedStyle(document.body).transform;
    return transform !== "none" && Math.abs(new DOMMatrixReadOnly(transform).b) > 0.99;
  });
  const portraitFrame = await frameProof(true);
  await page
    .locator("#game-canvas")
    .getByRole("button", { name: PROTOTYPE.labels.talk, exact: true })
    .waitFor({ state: "visible" });
  const portraitBefore = await position();
  const portraitBounds = await Promise.all(
    ["move", "aim"].map((side) => page.locator(`[data-control="${side}-joystick"]`).boundingBox()),
  );
  assert.ok(portraitBounds.every((box) => box && box.width > 0 && box.height > 0));
  const portraitOrigins = portraitBounds.map((box, index) => ({
    id: index + 11,
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
    radiusX: 8,
    radiusY: 8,
    force: 1,
  }));
  const portraitTouch = await portraitContext.newCDPSession(page);
  await portraitTouch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: portraitOrigins,
  });
  let portraitHeld;
  try {
    const { a, b, c, d } = portraitFrame.rotation;
    const deflected = portraitOrigins.map((point, index) => ({
      ...point,
      x: point.x + (index === 0 ? a * 25 : -c * 25),
      y: point.y + (index === 0 ? b * 25 : -d * 25),
    }));
    await portraitTouch.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: deflected,
    });
    await page.waitForFunction(
      ({ before, key }) => {
        const flight = JSON.parse(localStorage.getItem(key))?.flight;
        return (
          flight &&
          flight.player.x > before.x &&
          flight.player.y < before.y &&
          flight.shots.some((shot) => !shot.enemy && shot.velocity.x < 0 && shot.velocity.y < 0)
        );
      },
      { before: portraitBefore, key: storageKey },
    );
    portraitHeld = (await readSave()).flight;
    await page.screenshot({ path: `${output}/portrait-touch.png` });
  } finally {
    await portraitTouch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await portraitTouch.detach();
  }
  const portraitRest = await waitForRest(await position());
  await page.waitForFunction(
    (key) => !JSON.parse(localStorage.getItem(key)).flight.shots.some((shot) => !shot.enemy),
    storageKey,
  );
  await page.waitForTimeout(300);
  assert.deepEqual(
    await position(),
    portraitRest,
    "Portrait touch release cancels mapped movement",
  );
  await page.locator('[data-action="settings"]').click();
  await page
    .getByRole("checkbox", { name: PROTOTYPE.labels.sound, exact: true })
    .waitFor({ state: "visible" });
  await page
    .getByRole("checkbox", { name: PROTOTYPE.labels.screenShake, exact: true })
    .waitFor({ state: "visible" });
  await page.screenshot({ path: `${output}/portrait-settings.png` });
  await page.locator('[data-action="close-settings"]').click();
  save("portrait-proof.json", {
    scope:
      "Real mobile context, landscape frame rotation and mapped twin-touch input " +
      "using the canonical safe-destination fixture",
    frame: portraitFrame,
    before: portraitBefore,
    held: portraitHeld,
    released: portraitRest,
  });
  events.checks.push(
    "Portrait mobile context rotates the landscape frame and maps native twin-touch movement/aim/release",
  );
  events.checks.push(
    "Portrait settings and contextual action remain accessible in the turned frame",
  );
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
