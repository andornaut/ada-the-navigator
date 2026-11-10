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
    assert.equal(
      await page.locator(".ada-use:visible").count(),
      expected,
      `${phase}: the dedicated control must be the only visible contextual action`,
    );
    assert.equal(
      await page.locator('[data-action="interact"]').count(),
      0,
      `${phase}: travel must not duplicate the contextual action`,
    );
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
  for (const field of ["seed", "cargo", "ammo", "shield", "player", "world", "visited"]) {
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
  const { CHEAT_COPY } = await import(new URL("../src/data/cheat-copy.ts", import.meta.url));
  await page.keyboard.down("d");
  try {
    await page.locator('[data-action="settings"]').click();
    await page.getByRole("button", { name: CHEAT_COPY.open, exact: true }).click();
    const cheatDialog = page.getByRole("dialog", { name: CHEAT_COPY.title, exact: true });
    await cheatDialog.waitFor({ state: "visible" });
    const paused = await position();
    const beforeGrant = await readSave();
    await page.waitForTimeout(250);
    assert.deepEqual(await position(), paused, "Cheat modal must pause held flight input");
    const behindModal = await page.locator("canvas").boundingBox();
    assert.ok(behindModal);
    await page.mouse.move(behindModal.x + 12, behindModal.y + behindModal.height - 20);
    await page.mouse.down();
    try {
      await page.mouse.move(behindModal.x + 32, behindModal.y + behindModal.height - 20);
      await page.waitForTimeout(100);
      assert.deepEqual(
        await position(),
        paused,
        "Pointer drag behind cheats must not reach flight controls",
      );
    } finally {
      await page.mouse.up();
    }
    await page.keyboard.press("Shift+Tab");
    assert.ok(
      await cheatDialog.evaluate((dialog) => dialog.contains(document.activeElement)),
      "Cheat modal must retain keyboard focus",
    );
    await page.getByRole("button", { name: CHEAT_COPY.grantAllWeapons, exact: true }).click();
    await page.waitForFunction((key) => {
      const owned = JSON.parse(localStorage.getItem(key)).flight.ownedWeapons ?? [];
      return ["missiles", "tripleLaser", "scattershot"].every((weapon) => owned.includes(weapon));
    }, storageKey);
    const granted = await readSave();
    assert.deepEqual(granted.progress, beforeGrant.progress);
    for (const field of ["weapon", "shield", "cargo", "fireCooldown"]) {
      assert.deepEqual(
        granted.flight[field],
        beforeGrant.flight[field],
        `Grant preserves ${field}`,
      );
    }
    await page.screenshot({ path: `${output}/cheats.png` });
    await cheatDialog.getByRole("button", { name: CHEAT_COPY.close, exact: true }).click();
  } finally {
    await page.keyboard.up("d");
  }
  await waitForRest(await position());
  await seedOnce(safeSerialized, "ada-browser.before-installed-guard.v1");
  await page.locator('[data-action="settings"]').click();
  await page.getByRole("button", { name: CHEAT_COPY.open, exact: true }).click();
  // Exercise the iOS installed-window signal without installing or launching a PWA.
  await page.evaluate(() => {
    Object.defineProperty(navigator, "standalone", { configurable: true, value: true });
    window.dispatchEvent(new PageTransitionEvent("pageshow"));
  });
  await page.waitForFunction(
    () => document.querySelector('[data-action="cheats"]')?.hidden === true,
  );
  assert.equal(
    await page.getByRole("dialog", { name: CHEAT_COPY.title, exact: true }).count(),
    0,
    "An installed-window signal must close the cheats modal",
  );
  await page.locator('[data-action="cheats"]').evaluate((button) => button.click());
  await page.locator('[data-cheat="grant-all-weapons"]').evaluate((button) => button.click());
  assert.deepEqual(
    (await readSave()).flight.ownedWeapons ?? [],
    [],
    "Direct hidden-button dispatch in the installed-window fixture must not grant saved ownership",
  );
  save("installed-window-proof.json", {
    scope:
      "Navigator standalone eligibility fixture and pageshow recheck, not an actual installed PWA",
    grantBlocked: (await readSave()).flight.ownedWeapons ?? [],
  });
  await page.evaluate(() => {
    Reflect.deleteProperty(navigator, "standalone");
    window.dispatchEvent(new PageTransitionEvent("pageshow"));
  });
  await page.waitForFunction(
    () => document.querySelector('[data-action="cheats"]')?.hidden === false,
  );
  await seedOnce(safeSerialized, "ada-browser.after-cheats.v1");
  events.checks.push(
    "Browser-only cheats pause input, retain focus and save only granted ownership; " +
      "an installed-window fixture closes and rejects direct dispatch",
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
    const warning = page
      .getByRole("status")
      .filter({ hasText: PROTOTYPE.labels.savingUnavailable });
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
    assert.equal(
      await warning.textContent(),
      PROTOTYPE.labels.savingUnavailable,
      "Dialogue rendering must not clear a failed-save warning",
    );
    await page.locator('[data-action="dialogue-choice"][data-choice="continue"]').click();
    await page.locator(".ada-use").waitFor({ state: "visible" });
    await contextControlProof(1, "resumed flight");
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press("Space");
    await page.locator('[data-action="dialogue-choice"]').first().waitFor({ state: "visible" });
    await contextControlProof(0, "keyboard interaction dialogue");
    await page.locator('[data-action="dialogue-choice"][data-choice="continue"]').click();
    assert.equal(await warning.textContent(), PROTOTYPE.labels.savingUnavailable);
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), storageKey),
      beforeStorageFailure,
      "Failed writes must preserve the last persisted state",
    );
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
    return (
      document.querySelector("#save-status")?.textContent === "" &&
      saved?.flight?.player.x === Number(status.dataset.x) &&
      saved?.flight?.player.y === Number(status.dataset.y)
    );
  }, storageKey);
  await page.locator('[data-action="close-settings"]').click();
  await contextControlProof(1, "recovered flight");
  events.checks.push(
    "Blocked browser storage preserves gameplay and last save; " +
      "status survives dialogue and clears after successful write",
  );
  events.checks.push(
    "One dedicated context control supports pointer and keyboard use, absent in home and dialogue",
  );

  const dangerInput = new GameModel(PROTOTYPE, safeSerialized);
  dangerInput.state.flight.dangerFor = 5;
  dangerInput.state.flight.player.x += PROTOTYPE.tuning.safeRadius * 3;
  dangerInput.state.flight.objects = [];
  dangerInput.state.flight.shots = [];
  await seedOnce(dangerInput.save(), "ada-browser.danger-context.v1");
  await page.locator('[data-action="return-home"]:disabled').waitFor({ state: "visible" });
  await contextControlProof(0, "danger outside a friendly destination");
  events.checks.push(
    "Danger blocks travel and exposes no inapplicable or duplicate contextual control",
  );
  await seedOnce(safeSerialized, "ada-browser.after-save-proof.v1");
  await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
  await page.setViewportSize({ width: 844, height: 390 });
  // Compare observable flight response, not the implementation's stick sampling formula.
  async function analogRun(distance, marker) {
    await seedOnce(safeSerialized, marker);
    const target = await page.locator('[data-control="move-joystick"]').boundingBox();
    assert.ok(target);
    const start = await position();
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2);
    await page.mouse.down();
    try {
      await page.mouse.move(target.x + target.width / 2 + distance, target.y + target.height / 2);
      await page.waitForTimeout(500);
    } finally {
      await page.mouse.up();
    }
    const end = await waitForRest(await position());
    return Math.hypot(end.x - start.x, end.y - start.y);
  }
  const deadTravel = await analogRun(1, "ada-browser.analog-dead.v1");
  const smallTravel = await analogRun(8, "ada-browser.analog-small.v1");
  const fullTravel = await analogRun(20, "ada-browser.analog-full.v1");
  assert.equal(deadTravel, 0, "Movement inside the CSS dead zone must remain idle");
  assert.ok(
    smallTravel > 0 && fullTravel > smallTravel * 1.5,
    "Full CSS travel must move materially farther than partial travel over the same interval",
  );
  save("analog-proof.json", { deadTravel, smallTravel, fullTravel });
  events.checks.push("CSS move-stick dead zone and partial/full throttle affect actual flight");
  await seedOnce(safeSerialized, "ada-browser.after-analog.v1");
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

  const equipment = new GameModel(PROTOTYPE, safeSerialized);
  equipment.state.flight.ownedWeapons = ["missiles", "tripleLaser"];
  equipment.state.flight.weapon = "basic";
  equipment.state.flight.ammo = 0;
  const equipmentSave = equipment.save();
  assert.deepEqual(new GameModel(PROTOTYPE, equipmentSave).state, equipment.state);
  save("equipment-fixture.json", {
    scope:
      "Canonical owned-upgrade fixture for UI selection and persistence, not pickup progression",
    state: JSON.parse(equipmentSave),
  });
  await seedOnce(equipmentSave, "ada-browser.equipment.v1");
  const missileButton = page.locator('button[data-weapon="missiles"]');
  await missileButton.waitFor({ state: "visible" });
  assert.equal(
    await page.locator('button[data-weapon="scattershot"]').count(),
    0,
    "An unowned upgrade must not be offered",
  );
  await missileButton.click();
  await page.waitForFunction(
    (key) => JSON.parse(localStorage.getItem(key)).flight.weapon === "missiles",
    storageKey,
  );
  assert.equal(await missileButton.getAttribute("aria-pressed"), "true");
  assert.equal(
    await page.locator(".flight-hud").count(),
    0,
    "The removed top-left information HUD must not be recreated",
  );
  const weaponImages = await page.locator(".ada-weapon-selector button img").evaluateAll((images) =>
    images.map((image) => ({
      loaded: image.complete && image.naturalWidth > 0,
      source: image.getAttribute("src"),
      decorative: image.getAttribute("aria-hidden") === "true" && image.getAttribute("alt") === "",
      weapon: image.parentElement.dataset.weapon,
    })),
  );
  assert.equal(weaponImages.length, 3, "Basic and both owned upgrades require real icon images");
  for (const icon of weaponImages) {
    assert.ok(
      icon.loaded && icon.decorative,
      "Weapon icons must load without duplicating button names",
    );
    assert.equal(icon.source, `/art/ui/icons/weapon-${icon.weapon}.svg`);
  }
  await page.reload();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-weapon="missiles"]')?.getAttribute("aria-pressed") === "true",
  );
  assert.deepEqual((await readSave()).flight.ownedWeapons, ["missiles", "tripleLaser"]);
  await page.locator('[data-action="settings"]').click();
  assert.ok(await missileButton.isDisabled(), "Settings must disable weapon selection");
  const pausedWeapon = (await readSave()).flight.weapon;
  await page.locator('[data-weapon="tripleLaser"]').evaluate((button) => button.click());
  assert.equal(
    (await readSave()).flight.weapon,
    pausedWeapon,
    "A disabled weapon must not change selection behind the modal",
  );
  await page.locator('[data-action="close-settings"]').click();
  await page.locator('[data-weapon="tripleLaser"]').click();
  await page.waitForFunction(
    (key) => JSON.parse(localStorage.getItem(key)).flight.weapon === "tripleLaser",
    storageKey,
  );
  await page.keyboard.down("ArrowRight");
  try {
    await page.waitForFunction(
      (key) => JSON.parse(localStorage.getItem(key)).flight.shots.some((shot) => !shot.enemy),
      storageKey,
    );
  } finally {
    await page.keyboard.up("ArrowRight");
  }
  assert.equal(
    (await readSave()).flight.weapon,
    "tripleLaser",
    "Zero legacy ammo must not consume an upgrade",
  );
  const meter = page.getByRole("meter", { name: PROTOTYPE.labels.shield, exact: true });
  assert.equal(Number(await meter.getAttribute("aria-valuenow")), PROTOTYPE.tuning.shieldMax);
  const bar = await meter.boundingBox();
  const gameFrame = await page.locator("#game-canvas").boundingBox();
  assert.ok(
    bar &&
      gameFrame &&
      Math.abs(bar.width - gameFrame.width) < 2 &&
      bar.height >= 2 &&
      bar.height <= 4,
    "Shield meter must span the bottom of the game frame at about three CSS pixels",
  );
  const gear = page.locator('[data-action="settings"]');
  assert.ok((await gear.getAttribute("aria-label"))?.length, "Gear requires an accessible name");
  const gearImage = await gear.evaluate(
    (node) => getComputedStyle(node, "::before").backgroundImage,
  );
  assert.ok(gearImage.includes("/art/ui/sprites/icon-settings-nav.png"));
  assert.equal(
    (
      await page.request.get("http://ada-preview:4173/art/ui/sprites/icon-settings-nav.png")
    ).status(),
    200,
    "The real settings icon resource must be served",
  );
  assert.equal(
    (await readSave()).flight.ammo,
    0,
    "Actual firing must retain zero legacy ammo without consuming the unlimited upgrade",
  );
  save("weapon-icons-proof.json", { weaponImages, gearImage });
  await page.screenshot({ path: `${output}/weapon-shield.png` });
  events.checks.push(
    "Owned unlimited weapons support accessible selection, reload, modal guards and a full-width shield meter",
  );

  const { stepFlight } = await import(new URL("../src/model/flight.ts", import.meta.url));
  const damaged = new GameModel(PROTOTYPE, equipmentSave);
  assert.ok(damaged.selectWeapon("missiles"));
  // Damage is meaningful only outside the friendly destination's protected region.
  damaged.state.flight.player.x += PROTOTYPE.tuning.safeRadius * 2;
  assert.ok(
    damaged.state.flight.objects
      .filter((object) => object.kind === "destination")
      .every(
        (destination) =>
          Math.hypot(
            destination.x - damaged.state.flight.player.x,
            destination.y - damaged.state.flight.player.y,
          ) > PROTOTYPE.tuning.safeRadius,
      ),
    "Projectile fixture must be outside every active protected destination",
  );
  damaged.state.flight.shield = PROTOTYPE.tuning.enemyDamage;
  damaged.state.flight.shots.push({
    ...damaged.state.flight.player,
    enemy: true,
    hitIds: [],
    id: "browser-shield-break",
    life: 1,
    piercing: false,
    velocity: { x: 0, y: 0 },
  });
  stepFlight(
    PROTOTYPE,
    0.01,
    { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false },
    damaged.state.flight,
  );
  assert.equal(
    damaged.state.flight.weapon,
    "basic",
    "Real projectile damage must remove the selected upgrade",
  );
  assert.deepEqual(damaged.state.flight.ownedWeapons, ["tripleLaser"]);
  assert.equal(damaged.state.flight.shield, PROTOTYPE.tuning.shieldMax);
  const damageSave = damaged.save();
  assert.deepEqual(new GameModel(PROTOTYPE, damageSave).state, damaged.state);
  save("shield-break-fixture.json", {
    scope: "Real-model projectile damage before restore, not a natural browser combat playthrough",
    state: JSON.parse(damageSave),
  });
  await seedOnce(damageSave, "ada-browser.shield-break.v1");
  await page.waitForFunction(
    () => document.querySelector('[data-weapon="basic"]')?.getAttribute("aria-pressed") === "true",
  );
  assert.equal(await page.locator('[data-weapon="missiles"]').count(), 0);
  assert.equal(
    await page.locator('[data-weapon="tripleLaser"]').getAttribute("aria-pressed"),
    "false",
  );
  assert.equal(Number(await meter.getAttribute("aria-valuenow")), PROTOTYPE.tuning.shieldMax);
  await page.locator('[data-weapon="tripleLaser"]').click();
  await page.waitForFunction(
    (key) => JSON.parse(localStorage.getItem(key)).flight.weapon === "tripleLaser",
    storageKey,
  );
  events.checks.push(
    "Canonical shield-break damage restores Basic and shield while retaining only other upgrades for manual selection",
  );

  const { SCREEN } = await import(new URL("../src/data/screen.ts", import.meta.url));
  const weaponModel = new GameModel(PROTOTYPE, safeSerialized);
  weaponModel.state.flight.ownedWeapons = ["missiles", "tripleLaser", "scattershot"];
  weaponModel.state.flight.weapon = "basic";
  weaponModel.state.flight.objects = [];
  weaponModel.state.flight.shots = [];
  const weaponSave = weaponModel.save();
  assert.deepEqual(new GameModel(PROTOTYPE, weaponSave).state, weaponModel.state);
  save("weapon-volley-fixture.json", {
    scope:
      "Canonical cleared-flight fixture for actual UI firing, not natural pickup or combat progression",
    state: JSON.parse(weaponSave),
  });
  async function heldVolley(weapon, projectile, minimum, faded = false) {
    await seedOnce(weaponSave, `ada-browser.volley-${weapon}.v1`);
    await page.locator(`button[data-weapon="${weapon}"]`).click();
    await page.keyboard.down("ArrowRight");
    try {
      await page.waitForFunction(
        ({ faded, key, minimum, projectile }) => {
          const shots =
            JSON.parse(localStorage.getItem(key))?.flight?.shots.filter(
              (shot) => !shot.enemy && shot.projectile === projectile,
            ) ?? [];
          return (
            shots.length >= minimum &&
            (!faded || shots.some((shot) => shot.fade && shot.life / shot.fade.initialLife < 0.35))
          );
        },
        { key: storageKey, projectile, minimum, faded },
      );
      const snapshot = await readSave();
      assert.deepEqual(
        new GameModel(PROTOTYPE, JSON.stringify(snapshot)).state,
        snapshot,
        "Actual fired projectiles and fade metadata must survive canonical save validation",
      );
      await page.screenshot({ path: `${output}/volley-${weapon}.png` });
      return snapshot;
    } finally {
      await page.keyboard.up("ArrowRight");
    }
  }
  const missiles = await heldVolley("missiles", "missile", 2);
  const missileShots = missiles.flight.shots.filter(
    (shot) => !shot.enemy && shot.projectile === "missile",
  );
  assert.ok(
    new Set(missileShots.map((shot) => shot.id)).size >= 2,
    "One held aim input must emit multiple automatic missiles",
  );
  const heading = Math.atan2(missileShots[0].velocity.y, missileShots[0].velocity.x);
  for (const shot of missileShots) {
    assert.ok(
      Math.abs(Math.atan2(shot.velocity.y, shot.velocity.x) - heading) < 0.000001,
      "Held-direction missiles must retain a straight shared heading",
    );
    assert.ok(shot.damage > PROTOTYPE.tuning.flight.playerShotDamage);
  }
  const triple = await heldVolley("tripleLaser", "bolt", 3);
  const bolts = triple.flight.shots.filter((shot) => !shot.enemy && shot.projectile === "bolt");
  const newest = Math.max(...bolts.map((shot) => shot.life));
  const angles = bolts
    .filter((shot) => Math.abs(shot.life - newest) < 0.000001)
    .map(
      (shot) =>
        (Math.atan2((shot.velocity.x + shot.velocity.y) / 2, shot.velocity.x - shot.velocity.y) *
          180) /
        Math.PI,
    )
    .sort((a, b) => a - b);
  assert.equal(angles.length, 3, "A real triple-laser volley must emit three simultaneous bolts");
  for (const [index, offset] of [-20, 0, 20].entries()) {
    assert.ok(
      Math.abs(angles[index] - angles[1] - offset) < 0.000001,
      "The visible projected triple-laser volley must retain its approved ±20 degree spread",
    );
  }
  const scatter = await heldVolley("scattershot", "dot", 7, true);
  const dots = scatter.flight.shots.filter((shot) => !shot.enemy && shot.projectile === "dot");
  const fading = dots.filter((shot) => shot.life / shot.fade.initialLife < 0.35);
  assert.ok(fading.length > 0, "Actual scatter particles must reach their fade segment");
  for (const shot of dots) {
    assert.equal(
      shot.fade.projectedRange,
      SCREEN.width * 0.5,
      "Range must use the fixed main camera's logical width at zoom one, not CSS width or DPR",
    );
    assert.equal(shot.fade.fadeStartFraction, 0.65);
    const dx = shot.x - scatter.flight.player.x;
    const dy = shot.y - scatter.flight.player.y;
    assert.ok(
      Math.hypot(dx - dy, (dx + dy) / 2) <= SCREEN.width * 0.5 + 0.001,
      "Actual scatter particles must remain inside the captured half-camera projected range",
    );
    assert.ok(shot.damage > 0 && shot.damage < PROTOTYPE.tuning.flight.playerShotDamage);
  }
  await page.waitForFunction(
    (key) =>
      !JSON.parse(localStorage.getItem(key)).flight.shots.some(
        (shot) => !shot.enemy && shot.projectile === "dot",
      ),
    storageKey,
  );
  save("weapon-volley-proof.json", {
    scope:
      "Actual UI input and canonical saved shot trajectories; screenshots require visual fade review",
    cameraWidth: SCREEN.width,
    missiles: missileShots,
    tripleProjectedAngles: angles,
    scatter: dots,
  });
  events.checks.push(
    "Actual held aim emits automatic straight missiles, triple ±20 degree bolts " +
      "and fading half-camera scatter particles",
  );

  const cargoModel = new GameModel(PROTOTYPE);
  cargoModel.state.unlocked = [1, 2];
  cargoModel.startSector(2);
  cargoModel.choose("0");
  Object.assign(cargoModel.state.progress[2], { introduced: true, stage: 1, known: ["hub"] });
  ensureDestination(PROTOTYPE, "hub", cargoModel.state.flight);
  cargoModel.teleport("hub");
  cargoModel.state.flight.cargo = 12345;
  const cargoSave = cargoModel.save();
  assert.deepEqual(new GameModel(PROTOTYPE, cargoSave).state, cargoModel.state);
  save("cargo-fixture.json", {
    scope: "Canonical wide-cargo deposit UI fixture, not natural mining progression",
    state: JSON.parse(cargoSave),
  });
  await seedOnce(cargoSave, "ada-browser.wide-cargo.v1");
  await page.waitForFunction((key) => {
    const state = JSON.parse(localStorage.getItem(key));
    return state.mode === "space" && state.flight?.sector === 2 && state.flight.cargo === 12345;
  }, storageKey);
  assert.equal(
    await page.locator(".flight-hud").count(),
    0,
    "Wide cargo must not restore the removed information HUD",
  );
  await page.getByRole("button", { name: PROTOTYPE.labels.deposit, exact: true }).click();
  await page.waitForFunction((key) => {
    const state = JSON.parse(localStorage.getItem(key));
    return state.flight.cargo === 0 && state.progress[2].deposited === 12345;
  }, storageKey);
  await page.reload();
  await page.waitForFunction(
    (key) => JSON.parse(localStorage.getItem(key)).progress[2].deposited === 12345,
    storageKey,
  );
  events.checks.push(
    "Canonical wide cargo survives restore and a real deposit persists after reload",
  );

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
  const paletteResponse = await page.request.get("http://ada-preview:4173/art/space-palette.json");
  assert.equal(paletteResponse.status(), 200, "Approved space palette must be served");
  const { colors: paletteColors } = await paletteResponse.json();
  const pixels = await page.evaluate(
    async ({ encoded, intrinsic, paletteColors }) => {
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
        capital: { x: 0, y: 90, width: 240, height: 195 },
        missile: { x: 510, y: 65, width: 65, height: 55 },
        disabled: { x: 615, y: 155, width: 50, height: 50 },
        background: { x: 280, y: 280, width: 160, height: 60 },
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
          const colors = Object.fromEntries(
            [
              "obstacle",
              "shipHardpoint",
              "weapon",
              "environment",
              "environmentDetail",
              "background",
            ].map((role) => {
              const hex = paletteColors[role];
              if (!/^#[0-9a-f]{6}$/i.test(hex)) {
                throw new Error(`Missing valid palette role: ${role}`);
              }
              return [
                role,
                [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)),
              ];
            }),
          );
          const counts = Object.fromEntries(Object.keys(colors).map((role) => [role, 0]));
          const outline = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
          for (let offset = 0; offset < image.data.length; offset += 4) {
            for (const [role, rgb] of Object.entries(colors)) {
              // Small channel tolerance permits raster rounding without accepting another palette class.
              if (
                rgb.every((channel, index) => Math.abs(image.data[offset + index] - channel) <= 3)
              ) {
                counts[role]++;
                if (role === "obstacle") {
                  const index = offset / 4;
                  const x = index % image.width;
                  const y = Math.floor(index / image.width);
                  outline.minX = Math.min(outline.minX, x);
                  outline.maxX = Math.max(outline.maxX, x);
                  outline.minY = Math.min(outline.minY, y);
                  outline.maxY = Math.max(outline.maxY, y);
                }
              }
            }
          }
          return [
            name,
            {
              logical: region,
              bitmap: bitmapRegion,
              counts,
              area: image.width * image.height,
              outlineSpan: {
                x: counts.obstacle ? (outline.maxX - outline.minX) / scaleX : 0,
                y: counts.obstacle ? (outline.maxY - outline.minY) / scaleY : 0,
              },
            },
          ];
        }),
      );
    },
    { encoded: combatImage.toString("base64"), intrinsic, paletteColors },
  );
  assert.ok(
    pixels.capital.counts.obstacle > 20 &&
      pixels.capital.outlineSpan.x > 50 &&
      pixels.capital.outlineSpan.y > 40,
    "Large enemy must have a spatially extended coral hull outline, not isolated projectile pixels",
  );
  assert.ok(
    pixels.capital.counts.environment > pixels.capital.area * 0.2,
    "Large enemy must contain the approved hull fill",
  );
  assert.ok(
    pixels.capital.counts.shipHardpoint > 20 && pixels.capital.counts.weapon > 20,
    "Large enemy must render both live blue ship and amber weapon hardpoints",
  );
  assert.ok(
    pixels.disabled.counts.environmentDetail > 20 &&
      pixels.disabled.counts.background > 20 &&
      pixels.disabled.counts.environment > 20,
    "Disabled oversized hardpoint must have a dark cutout and detail cross within the hull",
  );
  assert.ok(
    pixels.missile.counts.obstacle > 2 && pixels.missile.outlineSpan.y > 2,
    "Seeded missile must contain coral projectile geometry",
  );
  assert.ok(
    pixels.background.counts.background > pixels.background.area * 0.9,
    "Empty space must render the approved background rather than the monochrome fallback",
  );
  await page.screenshot({ path: `${output}/combat.png` });
  save("combat-proof.json", {
    scope: "Rendered canonical combat fixture; screenshot review required for visual correctness",
    state: combatSnapshot,
    canvas: await canvas.boundingBox(),
    oversizedSizeRatio: enemyCatalog.oversizedCapital.sizeRatio,
    pixels,
    paletteColors,
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
  const portraitWeapon = page.locator('button[data-weapon="basic"]');
  await portraitWeapon.waitFor({ state: "visible" });
  const turnedControls = await page.evaluate(() => {
    const weapon = document.querySelector('button[data-weapon="basic"]').getBoundingClientRect();
    const gear = document.querySelector('[data-action="settings"]').getBoundingClientRect();
    const canvas = document.querySelector("canvas").getBoundingClientRect();
    const inverse = new DOMMatrixReadOnly(getComputedStyle(document.body).transform).inverse();
    const relative = new DOMPoint(
      weapon.x + weapon.width / 2 - gear.x - gear.width / 2,
      weapon.y + weapon.height / 2 - gear.y - gear.height / 2,
      0,
      0,
    ).matrixTransform(inverse);
    return {
      leftOfGear: relative.x,
      rowOffset: relative.y,
      insideCanvas:
        weapon.left >= canvas.left - 1 &&
        weapon.right <= canvas.right + 1 &&
        weapon.top >= canvas.top - 1 &&
        weapon.bottom <= canvas.bottom + 1,
      accessibleName: document
        .querySelector('button[data-weapon="basic"]')
        .getAttribute("aria-label"),
    };
  });
  assert.ok(
    turnedControls.leftOfGear < 0 && Math.abs(turnedControls.rowOffset) < 16,
    "Turned weapon selector must remain left of the gear on the same landscape row",
  );
  assert.ok(
    turnedControls.insideCanvas,
    "Turned weapon button must remain inside the visible canvas",
  );
  assert.equal(turnedControls.accessibleName, PROTOTYPE.labels.weaponBasic);
  save("portrait-weapon-alignment.json", turnedControls);
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
