import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

import { SMOKE_LIMIT_SECONDS } from "./smoke-limit.mjs";

const output = "/tmp/evidence";
const storageKey = "ada-the-navigator.prototype.v1";
const events = { errors: [], failedRequests: [], badResponses: [], checks: [] };
mkdirSync(output, { recursive: true });

function save(name, value) {
  writeFileSync(`${output}/${name}`, `${JSON.stringify(value, null, 2)}\n`);
}

// A canvas's size in logical px: its CSS size over the fit of the 720x360 base view. Its backing
// is in device pixels.
function logicalSize(canvas) {
  const fit = Math.min(canvas.offsetWidth / 720, canvas.offsetHeight / 360);
  return { width: canvas.offsetWidth / fit, height: canvas.offsetHeight / fit };
}

const watchdog = setTimeout(() => {
  save("events.json", events);
  save("result.json", {
    passed: false,
    error: `Browser smoke exceeded ${SMOKE_LIMIT_SECONDS} seconds`,
  });
  process.exit(124);
}, SMOKE_LIMIT_SECONDS * 1000);

// Hides the HTML that draws over the canvas while its pixels are sampled, and returns the call
// that shows it again. Each element's own style is set through CSSOM, which the page's CSP allows
// where an injected <style> is blocked.
async function hideOverCanvas(target) {
  const selector = ".ada-conversation,.ada-shield,.ada-item-notice,#game-status,#save-status";
  await target.evaluate((list) => {
    for (const node of document.querySelectorAll(list)) {
      node.style.setProperty("visibility", "hidden", "important");
    }
  }, selector);
  return () =>
    target.evaluate((list) => {
      for (const node of document.querySelectorAll(list)) {
        node.style.removeProperty("visibility");
      }
    }, selector);
}

// A CSP violation in any page logs a console error, which the run's error check fails on.
function reportViolations() {
  document.addEventListener("securitypolicyviolation", (event) => {
    console.error(
      `CSP violation: ${event.effectiveDirective} blocked ${event.blockedURI || "inline"}`,
    );
  });
}

// The screen wake lock as the game asks for it: held counts the sentinels not yet released.
function fakeWakeLock() {
  const lock = { held: 0, requests: 0 };
  window.adaWakeLock = lock;
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    value: {
      request: async () => {
        lock.requests += 1;
        lock.held += 1;
        const sentinel = new EventTarget();
        let released = false;
        sentinel.release = async () => {
          if (!released) {
            released = true;
            lock.held -= 1;
            sentinel.dispatchEvent(new Event("release"));
          }
        };
        return sentinel;
      },
    },
  });
}

let browser;
let page;
// An inline control icon's placement in its line, in CSS px: the image loaded, its size, its
// gap after the name's last glyph and its inset in its line box, with its decorative markers.
async function measureInlineIcons(root) {
  const icons = [...root.querySelectorAll(".ada-control-icon")];
  await Promise.all(icons.map((icon) => icon.decode()));
  const lineHeight = parseFloat(getComputedStyle(root).lineHeight);
  const top = root.getBoundingClientRect().top;
  return icons.map((icon) => {
    const box = icon.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(icon.previousSibling);
    const name = range.getBoundingClientRect();
    const style = getComputedStyle(icon);
    return {
      alt: icon.getAttribute("alt"),
      ariaHidden: icon.getAttribute("aria-hidden"),
      control: icon.dataset.control,
      gap: box.left - name.right,
      height: box.height,
      inset: (box.top - top) % lineHeight,
      lineHeight,
      natural: [icon.naturalWidth, icon.naturalHeight],
      opacity: style.opacity,
      rendering: style.imageRendering,
      sameLine: Math.abs(box.top + box.height / 2 - (name.top + name.height / 2)) < 1,
      width: box.width,
      wrap: getComputedStyle(icon.parentElement).whiteSpace,
    };
  });
}

// Each icon as Art places it at scale (CSS px per logical px), on a line of lineHeight logical px.
function assertInlineIcons(icons, controls, scale, lineHeight, where) {
  assert.deepEqual(
    icons.map(({ control }) => control),
    controls,
    `${where}: each named control has its icon`,
  );
  for (const icon of icons) {
    const detail = `${where}: ${JSON.stringify(icon)}`;
    assert.equal(icon.alt, "", `The icon has an empty alt: ${detail}`);
    assert.equal(icon.ariaHidden, "true", `The icon is hidden from screen readers: ${detail}`);
    assert.deepEqual(icon.natural, [16, 16], `The icon loads its 16 by 16 frame: ${detail}`);
    assert.equal(icon.opacity, "1", `The icon is at full opacity: ${detail}`);
    assert.equal(icon.rendering, "pixelated", `The icon scales nearest-neighbour: ${detail}`);
    assert.equal(icon.wrap, "nowrap", `The name and icon wrap as one: ${detail}`);
    assert.ok(icon.sameLine, `The icon is on its name's line: ${detail}`);
    assert.ok(Math.abs(icon.lineHeight - lineHeight * scale) < 0.1, `Line box: ${detail}`);
    assert.ok(Math.abs(icon.width - 16 * scale) < 0.1, `The icon is 16 wide: ${detail}`);
    assert.ok(Math.abs(icon.height - 16 * scale) < 0.1, `The icon is 16 high: ${detail}`);
    assert.ok(Math.abs(icon.gap - 4 * scale) < 0.6, `The icon starts 4 after its name: ${detail}`);
    assert.ok(
      Math.abs(icon.inset - ((lineHeight - 16) / 2) * scale) < 0.1,
      `The icon centres on its line box: ${detail}`,
    );
  }
}

try {
  const require = createRequire("/app/package.json");
  const { chromium } = require("playwright");
  browser = await chromium.launch({ channel: "chromium", headless: true, args: ["--no-sandbox"] });
  let context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    hasTouch: true,
  });
  await context.addInitScript(reportViolations);
  await context.addInitScript(fakeWakeLock);
  page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(15000);
  // Settings: its own button on the start screen; in play it opens from the Paused card, which
  // the pause button (a touch control) or Escape opens.
  async function openPause() {
    const button = page.locator('[data-action="pause"]');
    // A reloaded game shows the pause button once its controls exist; a fine pointer never does.
    const shown = await button.waitFor({ state: "visible", timeout: 5000 }).then(
      () => true,
      () => false,
    );
    if (shown) {
      await button.click();
    } else {
      await page.keyboard.press("Escape");
    }
    await page.locator('[data-dialog="pause"]').waitFor({ state: "visible" });
  }
  async function openSettings() {
    const own = page.locator('[data-action="settings"]');
    if (await own.isVisible()) {
      await own.click();
    } else {
      await openPause();
      await page.locator('[data-action="pause-settings"]').click();
    }
    await page.locator('[data-action="close-settings"]').waitFor({ state: "visible" });
  }
  // Settings opened in play closes back to the Paused card; Resume returns to play.
  async function resumeIfPaused() {
    const resume = page.locator('[data-action="pause-resume"]');
    if (await resume.isVisible()) {
      await resume.click();
    }
  }
  async function closeSettings() {
    await page.locator('[data-action="close-settings"]').click();
    await resumeIfPaused();
  }
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
  function previewOnly(route) {
    if (new URL(route.request().url()).origin === "http://ada-preview:4173") {
      return route.continue();
    }
    return route.abort("blockedbyclient");
  }
  await context.route("**/*", previewOnly);
  async function iconLinks() {
    assert.equal(
      await page.locator('link[rel="manifest"]').getAttribute("href"),
      "/manifest.webmanifest",
    );
    const links = await page
      .locator('link[rel="icon"],link[rel="apple-touch-icon"]')
      .evaluateAll((nodes) =>
        nodes.map((node) => ({
          href: node.getAttribute("href"),
          rel: node.getAttribute("rel"),
          sizes: node.getAttribute("sizes"),
        })),
      );
    assert.equal(links.length, 4, "Each entry must declare both PNG favicons, ICO and Apple icon");
    await Promise.all(
      links.map(async (link) => {
        const response = await page.request.get(`http://ada-preview:4173${link.href}`);
        assert.equal(response.status(), 200, `Icon must be served: ${link.href}`);
        assert.ok(response.headers()["content-type"].startsWith("image/"));
        if (link.href.endsWith(".png")) {
          const dimensions = await page.evaluate(async (href) => {
            const image = await createImageBitmap(await (await fetch(href)).blob());
            const size = `${image.width}x${image.height}`;
            image.close();
            return size;
          }, link.href);
          assert.equal(
            dimensions,
            link.sizes,
            "Decoded favicon/Apple icon dimensions must match HTML metadata",
          );
        }
      }),
    );
    return links;
  }
  const response = await page.goto("http://ada-preview:4173/");
  assert.equal(response.status(), 200);
  // The preview serves dist/_headers as Cloudflare does: each page's CSP, styles from its own
  // origin only, scripts and connections from it and Cloudflare's injected analytics beacon alone,
  // and the wake lock allowed.
  const pageHeaders = await Promise.all(
    ["/", "/play/"].map(async (pagePath) => [
      pagePath,
      (await page.request.get(`http://ada-preview:4173${pagePath}`)).headers(),
    ]),
  );
  for (const [pagePath, headers] of pageHeaders) {
    const policy = headers["content-security-policy"] ?? "";
    const directives = Object.fromEntries(
      policy.split("; ").map((directive) => {
        const [name, ...sources] = directive.split(" ");
        return [name, sources];
      }),
    );
    assert.deepEqual(directives["style-src"], ["'self'"], `${pagePath} styles from its origin`);
    assert.deepEqual(
      directives["script-src"],
      ["'self'", "https://static.cloudflareinsights.com"],
      `${pagePath} scripts from its origin and the analytics beacon`,
    );
    assert.deepEqual(
      directives["connect-src"],
      ["'self'", "https://cloudflareinsights.com"],
      `${pagePath} connects to its origin and the analytics endpoint`,
    );
    // No other origin anywhere in the policy.
    assert.deepEqual(
      Object.values(directives)
        .flat()
        .filter((source) => /^https?:/.test(source))
        .sort(),
      ["https://cloudflareinsights.com", "https://static.cloudflareinsights.com"],
      `${pagePath} allows only Cloudflare's analytics beyond its own origin`,
    );
    assert.doesNotMatch(policy, /unsafe-inline/, `${pagePath} allows no inline code`);
    assert.match(headers["permissions-policy"] ?? "", /screen-wake-lock=\(self\)/);
    assert.equal(headers["x-content-type-options"], "nosniff");
  }
  events.checks.push("Both pages carry the build's CSP and permissions policy");
  assert.equal(await page.locator("#game-canvas").count(), 0, "Landing must not bootstrap Phaser");
  const landingIcons = await iconLinks();
  const manifestResponse = await page.request.get("http://ada-preview:4173/manifest.webmanifest");
  assert.equal(manifestResponse.status(), 200);
  assert.ok(manifestResponse.headers()["content-type"].startsWith("application/manifest+json"));
  const manifest = await manifestResponse.json();
  assert.equal(
    manifest.description,
    await page.locator('meta[name="description"]').getAttribute("content"),
    "The manifest describes the game as the landing page does",
  );
  assert.doesNotMatch(JSON.stringify(manifest), /%HOME_/);
  assert.equal(manifest.id, "/play/");
  assert.equal(manifest.start_url, "/play/");
  assert.equal(manifest.scope, "/");
  const decodedIcons = await page.evaluate(async (icons) => {
    return Promise.all(
      icons.map(async (icon) => {
        const response = await fetch(icon.src);
        if (!response.ok) {
          throw new Error(`Missing app icon: ${icon.src}`);
        }
        const bitmap = await createImageBitmap(await response.blob());
        const result = {
          src: icon.src,
          sizes: `${bitmap.width}x${bitmap.height}`,
          purpose: icon.purpose,
        };
        bitmap.close();
        return result;
      }),
    );
  }, manifest.icons);
  for (const icon of decodedIcons) {
    assert.equal(icon.sizes, manifest.icons.find((entry) => entry.src === icon.src).sizes);
  }
  const playLink = page.locator('a[href="/play/"]').first();
  await playLink.waitFor({ state: "visible" });
  await page.screenshot({ path: `${output}/site-desktop.png` });
  await Promise.all([page.waitForURL("**/play/"), playLink.click()]);
  const playIcons = await iconLinks();
  assert.deepEqual(
    playIcons,
    landingIcons,
    "Landing and play must share the same app icon identity",
  );
  save("app-icon-proof.json", {
    scope: "Served app metadata and decoded icons only, not installation or offline support",
    manifest,
    decodedIcons,
    landingIcons,
    playIcons,
  });
  events.checks.push(
    "Landing and play share a play-start manifest and actual decoded app/favicons",
  );
  events.checks.push(
    "Root website links to the real game at /play/ without starting Phaser on the landing page",
  );
  await page.locator('#game-status[data-mode="home"]').waitFor({ state: "attached" });
  await page.locator("#game-canvas > canvas").waitFor({ state: "visible" });
  assert.ok(
    await page
      .locator("#game-canvas > canvas")
      .evaluate((canvas) => canvas.width > 0 && canvas.height > 0),
  );
  events.checks.push("Real renderer and accessible home status");
  // Use is Chibi's touch disc, drawn on the canvas: its accessible button takes no pointer input,
  // so a thumb taps the canvas at the disc's centre, where the press circle takes it.
  async function tapUse(name) {
    const use = page.getByRole("button", { name, exact: true });
    await use.waitFor({ state: "visible" });
    const box = await use.boundingBox();
    assert.ok(box, `${name}: the Use disc has a frame`);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  }
  async function contextControlProof(expected, phase) {
    // The disc shows or hides on the scene's next frame, as the sticks do.
    await page
      .waitForFunction(
        (count) =>
          [...document.querySelectorAll(".ada-use")].filter((use) => !use.hidden).length === count,
        expected,
        { timeout: 5000 },
      )
      .catch(() => undefined);
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
    const frame = await page.locator("#game-canvas > canvas").evaluate((canvas) => {
      const bounds = canvas.getBoundingClientRect();
      const style = getComputedStyle(document.body);
      const matrix = new DOMMatrixReadOnly(
        style.transform === "none" ? undefined : style.transform,
      );
      return {
        intrinsic: { width: canvas.width, height: canvas.height },
        layout: { width: canvas.offsetWidth, height: canvas.offsetHeight },
        renderScale: Math.min(devicePixelRatio, 2),
        bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
        body: { width: document.body.clientWidth, height: document.body.clientHeight },
        rotation: { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d },
        imageRendering: getComputedStyle(canvas).imageRendering,
        viewport: { width: innerWidth, height: innerHeight },
      };
    });
    assert.ok(
      Math.abs(frame.intrinsic.width - Math.round(frame.layout.width * frame.renderScale)) <= 1 &&
        Math.abs(frame.intrinsic.height - Math.round(frame.layout.height * frame.renderScale)) <= 1,
      "The canvas backing must be its CSS size times min(devicePixelRatio, 2)",
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
  events.checks.push("Desktop canvas backs its CSS size at min(devicePixelRatio, 2), pixelated");

  const [
    { GameModel },
    { PROTOTYPE },
    { ensureDestination },
    { playOpening, relaunch },
    { restoreSave: restoreCalm },
    { ACHIEVEMENTS },
  ] = await Promise.all([
    import(new URL("../src/model/game.ts", import.meta.url)),
    import(new URL("../src/data/prototype.ts", import.meta.url)),
    import(new URL("../src/model/flight.ts", import.meta.url)),
    import(new URL("../src/testing/launch.ts", import.meta.url)),
    import(new URL("../src/model/save.ts", import.meta.url)),
    import(new URL("../src/data/achievements.ts", import.meta.url)),
  ]);
  // Reads storybook pages (the default choice, else Next or its named action) until galaxy
  // selection opens or flight begins, and returns each page's background, its image and text,
  // and, just after its press, the transition frame fading in and whether the panel hid.
  const storyShots = new Set();
  async function readStory(remaining = 60, pages = []) {
    await page.waitForFunction(
      () =>
        document.querySelector("#game-status")?.dataset.mode === "space" ||
        document.querySelector('.ada-story-panel:not([hidden]) [data-action="story-next"]') ||
        document.querySelector('.ada-route[data-dialog="galaxies"]:not([hidden])'),
    );
    const panel = page.locator(".ada-story-panel:not([hidden])");
    if (!(await panel.count())) {
      return pages;
    }
    assert.ok(remaining > 0, "Storybook pages must reach galaxy selection");
    // The art loads once, after the manifest.
    await page.waitForFunction(
      () => document.querySelector(".ada-story-art")?.style.backgroundImage,
    );
    pages.push({
      art: await page
        .locator(".ada-story-art")
        .first()
        .evaluate((art) => art.style.backgroundImage),
      background: await page.locator(".ada-story-background").getAttribute("data-background"),
      speaker: await panel.evaluate(
        (node) => node.querySelector(".ada-story-tab:not([hidden])")?.textContent ?? "",
      ),
      text: (await panel.locator(".ada-story-paragraph").textContent()) ?? "",
      // The spread: its top and the canvas top in logical px, and whether the text column scrolls.
      spread: await panel.evaluate((node) => {
        const unit = Number(
          getComputedStyle(document.querySelector("#app")).getPropertyValue("--ada-unit"),
        );
        const view = document.querySelector(".ada-story-background").getBoundingClientRect();
        const round = (value) => Math.round((value / unit) * 100) / 100;
        return {
          artTop: round(
            document.querySelector(".ada-story-art").getBoundingClientRect().top - view.top,
          ),
          heading: node.querySelector(".ada-story-heading:not([hidden])")?.textContent ?? "",
          scrolls: node.querySelector(".ada-story-copy").classList.contains("ada-story-scrolls"),
          choicesScroll: node
            .querySelector(".ada-story-choices")
            .classList.contains("ada-story-scrolls"),
          // The choice column never overflows its panel: every choice and page control shows.
          clipped: [...node.querySelector(".ada-story-choice-column").querySelectorAll("button")]
            .filter((button) => button.offsetParent !== null)
            .some(
              (button) =>
                button.getBoundingClientRect().bottom > node.getBoundingClientRect().bottom + 0.5,
            ),
          top: round(node.getBoundingClientRect().top - view.top),
        };
      }),
      portrait: await panel.evaluate((node) => {
        const frame = node.querySelector(".ada-story-frame");
        if (!frame || frame.hidden) {
          return null;
        }
        const unit = Number(
          getComputedStyle(document.querySelector("#app")).getPropertyValue("--ada-unit"),
        );
        const box = frame.getBoundingClientRect();
        const card = node.querySelector(".ada-story-copy").getBoundingClientRect();
        const round = (value) => Math.round((value / unit) * 10) / 10;
        const face = frame.querySelector(".ada-story-portrait");
        return {
          frame: Number(face.dataset.frame),
          image: getComputedStyle(face).backgroundImage,
          left: round(box.left - card.left),
          right: round(card.right - box.right),
          side: node.querySelector(".ada-story-text").dataset.side,
          size: round(box.width),
          speaker: face.dataset.speaker,
        };
      }),
    });
    // The cockpit's first Astra page standing and seated, and her loop on the standing one.
    const current = pages.at(-1);
    const shot =
      current.speaker === "Astra" && current.background.startsWith("cockpit")
        ? `story-astra-${current.background === "cockpit" ? "standing" : "seated"}`
        : null;
    if (shot && !storyShots.has(shot)) {
      storyShots.add(shot);
      await page.screenshot({ path: `${output}/${shot}.png` });
      await page.waitForFunction(
        (frame) =>
          Number(
            document.querySelector(".ada-story-panel:not([hidden]) .ada-story-portrait")?.dataset
              .frame,
          ) !== frame,
        current.portrait?.frame,
      );
      current.looped = true;
    }
    const choice = panel.locator('[data-action="story-choice"]');
    const press = (await choice.count())
      ? choice.first()
      : panel.locator('[data-action="story-next"]');
    await press.waitFor({ state: "visible" });
    pages.at(-1).after = await press.evaluate((button) => {
      button.click();
      return {
        incoming: document.querySelectorAll(".ada-story-art")[1]?.style.backgroundImage ?? "",
        panelHidden: document.querySelector(".ada-story-panel")?.hidden ?? false,
      };
    });
    return readStory(remaining - 1, pages);
  }
  // Resolved on the current page, which each fixture replaces.
  const selector = () => page.locator('[data-dialog="galaxies"]');
  // The start screen's Achievements opens the card on page one, every entry locked in a new game,
  // and closing it returns to the start screen.
  async function achievementsPage() {
    const card = page.locator('[data-dialog="achievements"]');
    await card.waitFor({ state: "visible" });
    return {
      count: (await card.locator(".ada-achievement-pager > p").textContent())?.trim(),
      entries: await card
        .locator(".ada-achievement")
        .evaluateAll((nodes) =>
          nodes.map((node) => [
            node.querySelector(".ada-achievement-name")?.textContent,
            node.getAttribute("data-unlocked"),
          ]),
        ),
    };
  }
  assert.deepEqual(
    await page
      .locator(".ada-start button")
      .evaluateAll((buttons) => buttons.map((button) => button.dataset.action)),
    ["start"],
    "The start screen holds only Start before the first flight",
  );
  await assertNoTapFlash(
    [
      '[data-action="achievements"]',
      '[data-action="achievements"] .ada-disc',
      '[data-action="settings"]',
      '.ada-start-actions > [data-action="start"]',
    ],
    "The start screen",
  );
  const [achievementsBox, settingsBox] = await Promise.all(
    ['[data-action="achievements"]', '[data-action="settings"]'].map((selector) =>
      page.locator(selector).boundingBox(),
    ),
  );
  // hudButtonTarget(1): one pitch, HUD_BUTTON.target + HUD_BUTTON.gap, left of Settings.
  const startUnit = await page
    .locator("#app")
    .evaluate((app) => Number(getComputedStyle(app).getPropertyValue("--ada-unit")));
  assert.ok(
    achievementsBox &&
      settingsBox &&
      Math.abs(achievementsBox.y - settingsBox.y) < 1 &&
      Math.abs(achievementsBox.width - settingsBox.width) < 1 &&
      Math.abs((settingsBox.x - achievementsBox.x) / startUnit - 57) < 0.1,
    "The start screen's Achievements sits one pitch left of Settings in the same form",
  );
  const achievementsButton = page.locator('[data-action="achievements"]');
  // A url() as written in the stylesheet, its optional quotes dropped: the built CSS writes none.
  const glyphUrl = (value) => value.replace(/^url\((["']?)(.*)\1\)$/u, "url($2)");
  assert.deepEqual(
    [
      await achievementsButton.getAttribute("aria-label"),
      await achievementsButton.locator(".ada-disc").getAttribute("aria-hidden"),
      glyphUrl(
        await achievementsButton.evaluate((button) =>
          getComputedStyle(button).getPropertyValue("--glyph").trim(),
        ),
      ),
    ],
    [PROTOTYPE.labels.achievements, "true", "url(/art/ui/icons/achievements.svg)"],
    "Achievements is labelled from Gameplay's string with Art's trophy, the glyph hidden",
  );
  assert.equal(
    glyphUrl(
      await page
        .locator('[data-action="settings"]')
        .evaluate((button) => getComputedStyle(button).getPropertyValue("--glyph").trim()),
    ),
    "url(/art/ui/icons/settings.svg)",
    "Settings draws Art's vector gear, the same mask mechanism as Achievements",
  );
  await page.locator('[data-action="achievements"]').click();
  const firstAchievements = await achievementsPage();
  assert.equal(firstAchievements.count, "1/3", "The 14 achievements page six at a time");
  assert.deepEqual(
    firstAchievements.entries.map(([name]) => name),
    ACHIEVEMENTS.slice(0, 6).map(({ name }) => name),
    "Achievements list in Gameplay's order",
  );
  assert.ok(
    firstAchievements.entries.every(([, unlocked]) => unlocked === "false"),
    "A new game has no achievement unlocked",
  );
  await page.screenshot({ path: `${output}/achievements-start.png` });
  // An open modal draws above the top-row buttons: the topmost element at each button's centre
  // belongs to the modal.
  async function modalCovers(inside, boxes) {
    return page.evaluate(
      ({ centres, inside }) => {
        const modal = document.querySelector(inside)?.closest(".ada-modal");
        return centres.map(([x, y]) => Boolean(modal?.contains(document.elementFromPoint(x, y))));
      },
      {
        centres: boxes.map((box) => [box.x + box.width / 2, box.y + box.height / 2]),
        inside,
      },
    );
  }
  assert.deepEqual(
    await modalCovers('[data-dialog="achievements"]', [achievementsBox, settingsBox]),
    [true, true],
    "The open Achievements modal draws above the Achievements and Settings buttons",
  );
  await page.locator('[data-action="achievements-next"]').click();
  assert.equal((await achievementsPage()).count, "2/3");
  await page.locator('[data-action="close-achievements"]').click();
  await page.locator('[data-dialog="achievements"]').waitFor({ state: "hidden" });
  await page.locator('[data-action="settings"]').click();
  await page.locator('[data-action="close-settings"]').waitFor({ state: "visible" });
  assert.deepEqual(
    await modalCovers('[data-action="close-settings"]', [achievementsBox]),
    [true],
    "The open Settings modal draws above the Achievements button",
  );
  // The build line: the card's last text, after the rows, naming package.json's version and the
  // gated revision, read with the card and never focused.
  const { version } = JSON.parse(readFileSync("/source/package.json", "utf8"));
  const commit = process.env.CHECK_REVISION?.slice(0, 8) ?? "dev";
  const buildLine = await page.locator(".ada-build").evaluate((line) => ({
    afterRows: line.previousElementSibling?.classList.contains("ada-rows") ?? false,
    color: getComputedStyle(line).color,
    hidden: line.closest("[aria-hidden='true']") !== null,
    inCard: line.closest(".ada-card") !== null,
    tag: line.tagName,
    tabIndex: line.tabIndex,
    text: line.textContent,
    visible: line.getBoundingClientRect().height > 0,
  }));
  assert.deepEqual(
    buildLine,
    {
      afterRows: true,
      color: "rgb(184, 179, 201)",
      hidden: false,
      inCard: true,
      tag: "P",
      tabIndex: -1,
      text: `v${version} · ${commit}`,
      visible: true,
    },
    "Settings shows this build's version and commit after its rows",
  );
  events.checks.push(`Settings shows the build label v${version} · ${commit}`);
  await page.locator('[data-action="close-settings"]').click();
  await page.locator('[data-action="close-settings"]').waitFor({ state: "hidden" });
  await page.locator('[data-action="start"]').waitFor({ state: "visible" });
  // A first launch: Start, galaxy one's opening, the prologue in Ada's room and the cockpit, then
  // galaxy selection on galaxy one.
  assert.equal(
    await page.evaluate(() => window.adaWakeLock.held),
    0,
    "The start screen lets the screen sleep",
  );
  await page.locator('[data-action="start"]').click();
  await page.locator(".ada-story-panel:not([hidden])").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.adaWakeLock.held === 1);
  await page.screenshot({ path: `${output}/story-opening.png` });
  const launchPages = await readStory();
  const { gardenArrival, gardenFarewell, prologue: prologueSteps } = PROTOTYPE.premise;
  // Grandma's garden frames chapter one's opening on the first launch.
  const openingAt = gardenArrival.length;
  assert.deepEqual(
    launchPages.slice(0, openingAt + 3).map(({ background, text }) => [background, text]),
    [
      ...gardenArrival.map(({ text }) => text),
      PROTOTYPE.chapters[1].opening,
      PROTOTYPE.chapters[1].openingBranches[0],
      gardenFarewell.text,
    ].map((text) => ["grandmaGarden", text]),
    "Start opens in Grandma's garden, then chapter one's opening, its branch and her farewell",
  );
  // The prologue begins in the park, then Ada polishes the rock and it glows in her room.
  const prologueAt = openingAt + 3;
  const earthSteps = prologueSteps.filter(
    ({ background }) => background && !background.startsWith("cockpit"),
  );
  assert.deepEqual(
    launchPages
      .slice(prologueAt, prologueAt + earthSteps.length)
      .map(({ background, text }) => [background, text]),
    earthSteps.map(({ background, text }) => [background, text]),
    "The prologue's Earth pages: the park, the unpolished room, the glowing room",
  );
  // The rest plays in the cockpit: empty while Ada and Penny stand, seated once Ada sits.
  const cockpitAt = prologueAt + earthSteps.length;
  const seatedText = prologueSteps.find(({ background }) => background === "cockpitSeated")?.text;
  const seatedAt = launchPages.findIndex(({ text }) => text === seatedText);
  assert.ok(seatedAt > cockpitAt, "Ada sits after the cockpit's first pages");
  assert.deepEqual(
    launchPages.slice(cockpitAt).map(({ background }) => background),
    launchPages
      .slice(cockpitAt)
      .map((_, index) => (index + cockpitAt < seatedAt ? "cockpit" : "cockpitSeated")),
    "The prologue's cockpit is empty until Ada sits, then seated",
  );
  // Every page shows its location's image from Art's manifest; only the glowing room's press into
  // the cockpit plays the rock glow, hiding the panel as its first frame fades in.
  const { BACKGROUND_ART } = await import(new URL("../src/data/storybook.ts", import.meta.url));
  const artManifest = await (
    await page.request.get("http://ada-preview:4173/art/manifest.json")
  ).json();
  const artUrl = (id) => `url("${artManifest.assets.find((entry) => entry.id === id)?.path}")`;
  for (const { art, background } of launchPages) {
    assert.equal(art, artUrl(BACKGROUND_ART[background]), `${background} shows its art`);
  }
  const glow = launchPages.findIndex(
    ({ background }, index) =>
      background === "adaRoom" && launchPages[index + 1]?.background === "cockpit",
  );
  assert.ok(glow >= 0, "The prologue leaves Ada's room for the cockpit");
  assert.deepEqual(launchPages[glow].after, {
    incoming: artUrl("story-ada-room-glow-1"),
    panelHidden: true,
  });
  assert.deepEqual(
    launchPages.filter((_, index) => index !== glow).map(({ after }) => after.incoming),
    launchPages.slice(1).map(() => ""),
    "Every other page change cuts",
  );
  assert.ok(
    launchPages.some(
      ({ background, speaker }) => speaker === "Astra" && background.startsWith("cockpit"),
    ),
    "Astra speaks in the prologue's cockpit",
  );
  // Each dialogue page shows its speaker's 32 portrait in the 68 frame: Ada at the inner left,
  // Astra and Grandma at the inner right; narration and a speaker Art has not drawn show none.
  const sheets = { Ada: "ada", Astra: "astra", Grandma: "grandma" };
  for (const { background, portrait, speaker, text } of launchPages) {
    const sheet = sheets[speaker];
    if (!sheet) {
      assert.equal(portrait, null, `No portrait on "${text}"`);
      continue;
    }
    assert.equal(portrait?.speaker, sheet, `${speaker}'s portrait on "${text}"`);
    assert.equal(portrait.size, 68, `${speaker}'s 68 frame on ${background}`);
    assert.match(portrait.image, new RegExp(`/art/portraits/${sheet}\\.png`, "u"));
    assert.equal(portrait.side, sheet === "ada" ? "left" : "right", `${speaker}'s side`);
  }
  assert.ok(
    launchPages.some(({ portrait }) => portrait?.speaker === "grandma"),
    "Grandma speaks with her portrait in her garden",
  );
  const adaPage = launchPages.find(({ portrait }) => portrait?.speaker === "ada");
  const astraPages = launchPages.filter(({ portrait }) => portrait?.speaker === "astra");
  assert.ok(adaPage && astraPages.length, "Ada and Astra both speak with portraits");
  assert.ok(
    Math.abs(adaPage.portrait.left) < 0.2 &&
      astraPages.every(({ portrait }) => Math.abs(portrait.right) < 0.2),
    "Ada's frame sits on the text column's left edge and Astra's on its right",
  );
  assert.deepEqual(
    [...storyShots].sort(),
    ["story-astra-seated", "story-astra-standing"],
    "Astra speaks standing and seated in the cockpit",
  );
  assert.ok(
    launchPages.filter(({ looped }) => looped).length === 2,
    "Astra's speaking loop runs on the cockpit pages",
  );
  // The light spread: no page scrolls or rises past the top cap, opening, resolution and closing
  // pages carry the chapter heading, and each background keeps one placement through the run.
  for (const { spread, text } of launchPages) {
    assert.ok(
      !spread.scrolls && !spread.choicesScroll && !spread.clipped && spread.top >= 60.5 - 0.01,
      `"${text}" fits: ${JSON.stringify(spread)}`,
    );
  }
  assert.deepEqual(
    launchPages.filter(({ spread }) => spread.heading).map(({ text }) => text),
    [PROTOTYPE.chapters[1].opening],
    "Only the first launch's chapter opening carries the panel title",
  );
  for (const background of new Set(launchPages.map(({ background }) => background))) {
    const tops = new Set(
      launchPages
        .filter((entry) => entry.background === background)
        .map(({ spread }) => spread.artTop),
    );
    assert.equal(tops.size, 1, `${background} keeps one placement through the run: ${[...tops]}`);
  }
  events.checks.push(
    "Story pages lay out as the light spread: every launch page fits under the top cap without " +
      "scrolling, the opening carries the chapter heading, and each background keeps one " +
      "placement through the run",
  );
  events.checks.push(
    "Story pages show the speaker's 32 portrait in the 68 frame, Ada left and Astra right, " +
      "Astra's speaking loop running standing and seated in the cockpit",
  );
  events.checks.push(
    "Storybook pages show Art's backgrounds and the glowing room plays the rock glow into the " +
      "cockpit",
  );
  // Each optional question's answer returns to the list until Continue.
  for (const { answer } of PROTOTYPE.premise.prologue.find(({ questions }) => questions)
    .questions) {
    assert.ok(
      launchPages.some(({ text }) => text === answer),
      `The prologue answers "${answer}"`,
    );
  }
  await selector().waitFor({ state: "visible" });
  // The route map draws over the route sky, Ada and Penny watching it from the ground.
  assert.equal(
    await selector()
      .locator(".ada-route-sky")
      .evaluate((sky) => sky.style.backgroundImage),
    'url("/art/route-sky.png")',
    "Galaxy selection is the route map over the route sky",
  );
  assert.equal(await selector().locator(".ada-route-figure").count(), 2);
  assert.equal(await selector().locator(".ada-route-marker").count(), 6);
  // Galaxy one is unlocked, so its preview is the tinted capture; it must be served.
  const preview = await selector()
    .locator(".ada-galaxy-shot")
    .evaluate((shot) => shot.style.backgroundImage);
  assert.equal(preview, 'url("/previews/galaxy-sunflower.png")');
  const previewResponse = await page.request.get(
    "http://ada-preview:4173/previews/galaxy-sunflower.png",
  );
  assert.equal(previewResponse.status(), 200, "Galaxy previews must be served");
  assert.equal(
    (await selector().locator("h2").textContent())?.trim(),
    PROTOTYPE.labels.galaxyNumber.replace("{number}", "1"),
  );
  await page.screenshot({ path: `${output}/galaxy-select.png` });
  await page.locator('[data-action="galaxy-jump"]').click();
  events.checks.push(
    "Start plays galaxy one's opening and the prologue as storybook pages, then galaxy " +
      "selection's Jump begins the flight",
  );
  await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
  // The first flight opens on Astra's move lesson in the conversation box: her compact sheet on
  // the right, its speaking loop running, and her teal tab.
  const astraBox = page.locator('.ada-conversation[data-speaker="astra"]:not([hidden])');
  await astraBox.waitFor({ state: "visible" });
  const astraFace = astraBox.locator(".ada-conversation-portrait");
  const firstFrame = await astraFace.getAttribute("data-frame");
  await page.waitForFunction(
    (frame) =>
      document.querySelector('.ada-conversation[data-speaker="astra"] .ada-conversation-portrait')
        ?.dataset.frame !== frame,
    firstFrame,
  );
  const astraLine = await astraBox.evaluate((box) => ({
    image: getComputedStyle(box.querySelector(".ada-conversation-portrait")).backgroundImage,
    side: box.dataset.side,
    tab: getComputedStyle(box.querySelector(".ada-conversation-name")).backgroundColor,
  }));
  await page.screenshot({ path: `${output}/conversation-astra.png` });
  // On touch the move lesson names the left stick, then shows its icon inline, hidden from screen
  // readers, which read the words alone.
  const lessonLine = astraBox.locator(".ada-conversation-line");
  assert.equal(await lessonLine.textContent(), "Use the left stick to fly.", "Lesson words");
  const lessonScale = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.getElementById("app")).getPropertyValue("--ada-unit")),
  );
  assertInlineIcons(
    await lessonLine.evaluate(measureInlineIcons),
    ["move"],
    lessonScale,
    20,
    "The move lesson",
  );
  await astraBox.screenshot({ path: `${output}/lesson-move-icon.png` });
  events.checks.push("The touch move lesson shows the left stick's icon 4 after its name");
  assert.match(astraLine.image, /\/art\/portraits\/astra-compact\.png/u, "Astra's compact sheet");
  assert.equal(astraLine.side, "right", "Astra's portrait sits at the box's right");
  assert.equal(astraLine.tab, "rgb(143, 224, 242)", "Astra's tab is teal #8fe0f2");
  events.checks.push(
    "Astra's in-flight line shows her compact portrait at the right, looping, with her teal tab",
  );
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
    await openSettings();
    await page.locator('[data-action="close-settings"]').waitFor({ state: "visible" });
    const paused = await position();
    await page.waitForTimeout(250);
    assert.deepEqual(await position(), paused, "Settings must pause movement");
    await closeSettings();
    await waitForRest(await position());
  } finally {
    await page.keyboard.up("d");
  }
  events.checks.push("Settings pause movement and clear held input on resume");
  // The first flight after a real prologue has New Navigator unlocked, and only it.
  const prologueSaved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    storageKey,
  );
  assert.deepEqual(
    prologueSaved.achievements.unlocked,
    [ACHIEVEMENTS[0].id],
    "Only New Navigator is unlocked after the prologue",
  );
  // Achievements is on the start screen only: the Paused card has none.
  await openPause();
  assert.equal(
    await page.locator('[data-dialog="pause"] [data-action="pause-achievements"]').count(),
    0,
    "The Paused card has no Achievements",
  );
  await page.waitForFunction(() => window.adaWakeLock.held === 0);
  await page.locator('[data-action="pause-resume"]').click();
  await page.waitForFunction(() => window.adaWakeLock.held === 1);
  events.checks.push("Play holds the screen wake lock; the start screen and Paused card let it go");

  // No touch flash: every interactive element's tap highlight is transparent, inherited from the
  // page root, so a press shows only the element's own pressed state.
  async function assertNoTapFlash(selectors, where) {
    const colours = await page.evaluate(
      (list) =>
        list.map((selector) => {
          const node = document.querySelector(selector);
          return node
            ? getComputedStyle(node).getPropertyValue("-webkit-tap-highlight-color")
            : null;
        }),
      selectors,
    );
    selectors.forEach((selector, index) =>
      assert.equal(colours[index], "rgba(0, 0, 0, 0)", `${where}: ${selector} draws no tap flash`),
    );
  }
  // Every launch opens on the start screen; Continue resumes a mid-flight save in flight.
  async function continueFlight() {
    await page.locator('#game-status[data-mode="home"]').waitFor({ state: "attached" });
    await page.locator('.ada-start-actions > [data-action="continue"]').click();
    await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
  }
  // A flight control's box once the flight layout has settled: the mode flips to space before
  // the controls lay out after Continue, so this waits, bounded, for a non-zero box first.
  async function settledBox(selector, timeout = 10000) {
    try {
      await page.waitForFunction(
        (target) => {
          const rect = document.querySelector(target)?.getBoundingClientRect();
          return rect !== undefined && rect.width > 0 && rect.height > 0;
        },
        selector,
        { timeout },
      );
    } catch {
      assert.fail(`${selector} has no laid-out box ${timeout} ms after Continue`);
    }
    return page.locator(selector).boundingBox();
  }
  // The touch HUD's bottom controls, in logical px from the game area's edges: each joystick
  // ring's drawn outer side and bottom, 40 in (the rings draw 1 inside their 75 frame targets),
  // and the shield pill's bottom level with them. The rings mirror, so the aim ring's side is
  // measured from the left gap in from the view's whole-pixel right edge. Saves the proof and
  // captures the HUD as name.
  async function touchHudProof(name) {
    await settledBox('[data-control="aim-joystick"]');
    await page.locator(".ada-shield").waitFor({ state: "visible" });
    const hud = await page.evaluate(() => {
      const app = document.getElementById("app");
      const unit = Number(getComputedStyle(app).getPropertyValue("--ada-unit"));
      const origin = app.getBoundingClientRect();
      const box = (selector) => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return {
          bottom: (rect.bottom - origin.top) / unit,
          left: (rect.left - origin.left) / unit,
          right: (rect.right - origin.left) / unit,
        };
      };
      // The 720x360 game area, from the view properties the play area is laid out by.
      const property = (name) => parseFloat(getComputedStyle(app).getPropertyValue(name)) / unit;
      const left = property("--ada-area-left");
      const bottom = origin.height / unit - property("--ada-area-bottom");
      return {
        aim: box('[data-control="aim-joystick"]'),
        area: { bottom, left, right: left + 720 },
        dpr: devicePixelRatio,
        move: box('[data-control="move-joystick"]'),
        shield: box(".ada-shield"),
        unit,
        view: { height: origin.height / unit, width: origin.width / unit },
      };
    });
    const { area } = hud;
    const areaBottom = area.bottom;
    const proof = {
      ...hud,
      aimSide: Math.floor(hud.view.width) - area.left - (hud.aim.right - 1),
      moveSide: hud.move.left + 1 - area.left,
      ringBottoms: [areaBottom - (hud.move.bottom - 1), areaBottom - (hud.aim.bottom - 1)],
      shieldBottom: areaBottom - hud.shield.bottom,
    };
    save(`touch-hud-${name}.json`, proof);
    const detail = `${name}: ${JSON.stringify(proof)}`;
    // Whole-pixel ring centres put a drawn edge within a logical px of its place.
    for (const inset of [proof.moveSide, proof.aimSide, ...proof.ringBottoms]) {
      assert.ok(Math.abs(inset - 40) < 1, `Each ring's drawn edge sits 40 in: ${detail}`);
    }
    assert.ok(Math.abs(proof.shieldBottom - 40) < 0.01, `The shield pill sits 40 up: ${detail}`);
    await page.screenshot({ path: `${output}/touch-hud-${name}.png` });
    return proof;
  }
  // Each fixture loads in a fresh context at the same URL and viewport, carrying the stored
  // settings over: a reloaded tab keeps every earlier load's images alive until the context
  // closes, which the container's memory ceiling cannot hold across the run. A mid-flight
  // fixture continues into its flight unless resume is false.
  async function seedOnce(value, marker, { resume = true } = {}) {
    const fixture = await openFixture(await leaveFixture(), value, marker);
    context = fixture.context;
    page = fixture.page;
    await page.goto(fixture.url);
    if (resume && JSON.parse(value).mode === "space") {
      await continueFlight();
    }
  }
  // The current page's URL, viewport and stored entries, then its context closed.
  async function leaveFixture() {
    const url = page.url();
    const viewport = page.viewportSize();
    const { origins } = await context.storageState();
    const stored =
      origins
        .find(({ origin }) => origin === "http://ada-preview:4173")
        ?.localStorage.map(({ name, value: entry }) => [name, entry]) ?? [];
    await context.close();
    return { stored, url, viewport };
  }
  async function openFixture({ stored, url, viewport }, value, marker) {
    const opened = await browser.newContext({ viewport, hasTouch: true });
    await opened.addInitScript(reportViolations);
    await opened.route("**/*", previewOnly);
    // One-shot per tab, so a later reload in the fixture resumes the game's own save.
    await opened.addInitScript(
      ({ entries, key, once, serialized }) => {
        if (!sessionStorage.getItem(once)) {
          for (const [name, entry] of entries) {
            localStorage.setItem(name, entry);
          }
          localStorage.setItem(key, serialized);
          sessionStorage.setItem(once, "1");
        }
      },
      { entries: stored, key: storageKey, once: marker, serialized: value },
    );
    const fresh = await opened.newPage();
    fresh.setDefaultTimeout(10000);
    fresh.setDefaultNavigationTimeout(15000);
    observe(fresh);
    return { context: opened, page: fresh, url };
  }
  // The launched world comes from a random seed, so an encounter can open fire during a reload.
  // Persistence checks use that same world with its hostiles removed: shield then changes only
  // through recharge, which a full shield never shows.
  const launched = await readSave();
  const calm = structuredClone(launched);
  calm.flight.objects = calm.flight.objects.filter(
    (object) => !["enemy", "debris", "hazard"].includes(object.kind),
  );
  calm.flight.shots = [];
  for (const [id, object] of Object.entries(calm.flight.world.notables)) {
    if (object?.kind === "enemy") {
      delete calm.flight.world.notables[id];
    }
  }
  if (calm.flight.combat) {
    calm.flight.combat.initialPackSizes = {};
    delete calm.flight.combat.unloadedPackMembers;
  }
  calm.flight.shield = PROTOTYPE.tuning.shieldMax;
  calm.flight.dangerFor = 0;
  assert.ok(restoreCalm(calm), "The calm launched world must remain a canonical save");
  // A launch from a mid-flight save opens on the start screen with Continue focused, the flight
  // held as saved; Continue resumes it where the save left off.
  await seedOnce(JSON.stringify(calm), "ada-browser.calm-launch.v1", { resume: false });
  const midFlightContinue = page.locator('.ada-start-actions > [data-action="continue"]');
  await midFlightContinue.waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelector(".ada-start-ship")?.complete);
  assert.equal(
    await page.locator("#game-status").getAttribute("data-mode"),
    "home",
    "A mid-flight save launches to the start screen",
  );
  assert.equal(
    await page.evaluate(() => document.activeElement?.dataset.action ?? null),
    "continue",
    "Continue is focused on a mid-flight launch",
  );
  assert.equal(
    await page.locator("#game-status").textContent(),
    "",
    "The flight's notice waits with the flight, off the start screen",
  );
  await page.waitForTimeout(500);
  assert.deepEqual(
    (await readSave()).flight.player,
    calm.flight.player,
    "The start screen holds the saved flight unchanged",
  );
  await page.screenshot({ path: `${output}/launch-mid-flight.png` });
  await midFlightContinue.click();
  await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
  assert.deepEqual(
    await page
      .locator("#game-status")
      .evaluate((status) => [Number(status.dataset.x), Number(status.dataset.y)]),
    [calm.flight.player.x, calm.flight.player.y],
    "Continue resumes the flight at its saved position",
  );
  events.checks.push(
    "A mid-flight save launches to the start screen with Continue focused, and Continue " +
      "resumes the flight at its saved position",
  );

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
  await continueFlight();
  const resumed = await readSave();
  for (const field of ["seed", "cargo", "shield", "player", "world", "visited"]) {
    assert.deepEqual(
      resumed.flight[field],
      persisted.flight[field],
      `Reload must retain flight ${field}`,
    );
  }
  assert.deepEqual(resumed.progress, persisted.progress);
  await page.goto("http://ada-preview:4173/");
  const onLanding = await readSave();
  assert.equal(await page.locator("#game-canvas").count(), 0);
  await Promise.all([
    page.waitForURL("**/play/"),
    page.locator('a[href="/play/"]').first().click(),
  ]);
  await continueFlight();
  const returned = await readSave();
  for (const field of [
    "seed",
    "cargo",
    "shield",
    "weapon",
    "ownedWeapons",
    "world",
    "visited",
    "player",
  ]) {
    assert.deepEqual(
      returned.flight[field],
      onLanding.flight[field],
      `Website round trip preserves flight ${field}`,
    );
  }
  assert.deepEqual(returned.progress, onLanding.progress);
  events.checks.push("Reload resumes the persisted flight without regeneration");

  const safeInput = new GameModel(PROTOTYPE);
  safeInput.startSector(1);
  playOpening(safeInput);
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
  assert.deepEqual(relaunch(PROTOTYPE, safeSerialized).state, safeInput.state);
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
    await openSettings();
    await page.getByRole("button", { name: CHEAT_COPY.open, exact: true }).click();
    const cheatDialog = page.getByRole("dialog", { name: CHEAT_COPY.title, exact: true });
    await cheatDialog.waitFor({ state: "visible" });
    const paused = await position();
    const beforeGrant = await readSave();
    await page.waitForTimeout(250);
    assert.deepEqual(await position(), paused, "Cheat modal must pause held flight input");
    const behindModal = await page.locator("#game-canvas > canvas").boundingBox();
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
      return ["rapidMissile", "multiLaser", "heavyMissile", "scattershot", "phaser"].every(
        (weapon) => owned.includes(weapon),
      );
    }, storageKey);
    const granted = await readSave();
    assert.deepEqual(granted.progress, beforeGrant.progress);
    assert.deepEqual(
      granted.economy,
      beforeGrant.economy,
      "Run-only granted weapons must not enter saved ownership, levels or Stardust",
    );
    for (const field of ["weapon", "shield", "cargo", "fireCooldown"]) {
      assert.deepEqual(
        granted.flight[field],
        beforeGrant.flight[field],
        `Grant preserves ${field}`,
      );
    }
    await page.screenshot({ path: `${output}/cheats.png` });
    await cheatDialog.getByRole("button", { name: CHEAT_COPY.close, exact: true }).click();
    await resumeIfPaused();
    // Each new weapon queues an item notice: the chip shows under the pill once play resumes,
    // hidden from assistive technology, and its label is announced politely.
    const chip = page.locator(".ada-item-notice");
    await chip.waitFor({ state: "visible" });
    assert.equal(await chip.getAttribute("aria-hidden"), "true");
    const weaponNames = ["RapidMissile", "MultiLaser", "HeavyMissile", "Scattershot", "Phaser"].map(
      (id) => `+ ${PROTOTYPE.labels[`weapon${id}`]}`,
    );
    const announced = page.locator(".ada-item-notice-live");
    assert.equal(await announced.getAttribute("aria-live"), "polite");
    assert.ok(
      weaponNames.includes((await announced.textContent()) ?? ""),
      `A granted weapon's notice reads + {weapon}: ${await announced.textContent()}`,
    );
  } finally {
    await page.keyboard.up("d");
  }
  await waitForRest(await position());
  await seedOnce(safeSerialized, "ada-browser.before-installed-guard.v1");
  await openSettings();
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
    "Direct hidden-button dispatch in the installed-window fixture must not grant weapons",
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
    "Browser-only cheats pause input, retain focus and grant run-only weapons to the flight; " +
      "an installed-window fixture closes and rejects direct dispatch",
  );
  await page.locator(".ada-use").waitFor({ state: "visible" });
  await contextControlProof(1, "friendly flight");
  // The disc shows the action's symbol, no text; its accessible name is the action's.
  assert.equal(await page.locator(".ada-use").getAttribute("aria-label"), PROTOTYPE.labels.talk);
  assert.equal(await page.locator(".ada-use").getAttribute("data-use"), "talk");
  assert.equal((await page.locator(".ada-use").textContent()).trim(), "", "Use shows no text");
  const beforeStorageFailure = await page.evaluate((key) => {
    const saved = localStorage.getItem(key);
    window.__adaOriginalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
    return saved;
  }, storageKey);
  try {
    await openSettings();
    const warning = page
      .getByRole("status")
      .filter({ hasText: PROTOTYPE.labels.savingUnavailable });
    await warning.waitFor({ state: "visible" });
    assert.equal(await warning.count(), 1, "Save failure must have one accessible status");
    assert.equal(await warning.getAttribute("id"), "save-status");
    await closeSettings();
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
    await tapUse(PROTOTYPE.labels.talk);
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
  await openSettings();
  await page.waitForFunction((key) => {
    const saved = JSON.parse(localStorage.getItem(key));
    const status = document.querySelector("#game-status");
    return (
      document.querySelector("#save-status")?.textContent === "" &&
      saved?.flight?.player.x === Number(status.dataset.x) &&
      saved?.flight?.player.y === Number(status.dataset.y)
    );
  }, storageKey);
  await closeSettings();
  await contextControlProof(1, "recovered flight");
  events.checks.push(
    "Blocked browser storage preserves gameplay and last save; " +
      "status survives dialogue and clears after successful write",
  );
  events.checks.push(
    "One dedicated context control supports pointer and keyboard use, absent in home and dialogue",
  );

  const dangerInput = relaunch(PROTOTYPE, safeSerialized);
  dangerInput.state.flight.dangerFor = 5;
  dangerInput.state.flight.player.x += PROTOTYPE.tuning.safeRadius * 3;
  dangerInput.state.flight.objects = [];
  dangerInput.state.flight.shots = [];
  await seedOnce(dangerInput.save(), "ada-browser.danger-context.v1");
  await openPause();
  // In flight the card shows Resume over Map, Ship, Settings and Back to title, every one
  // available in danger.
  const pauseActions = () => page.locator('[data-dialog="pause"] .ada-stack button:not([hidden])');
  assert.deepEqual(
    await pauseActions().evaluateAll((buttons) =>
      buttons.map((button) => [
        button.dataset.action,
        button.textContent,
        button.getAttribute("aria-disabled"),
      ]),
    ),
    [
      ["pause-resume", PROTOTYPE.labels.resume, null],
      ["pause-map", PROTOTYPE.labels.map, null],
      ["pause-ship", PROTOTYPE.labels.ship, null],
      ["pause-settings", PROTOTYPE.labels.settings, null],
      ["pause-backToTitle", PROTOTYPE.labels.backToTitle, null],
    ],
    "The in-flight Paused card shows Resume, Map, Ship, Settings and Back to title, all " +
      "available in danger",
  );
  await page.screenshot({ path: `${output}/pause-flight-danger.png` });
  // Ship opens its card in the Paused card's place, focus on its X; Escape and the X return to
  // the Paused card on its Ship button.
  const shipCard = page.locator('[data-dialog="ship"]');
  const focusedAction = () =>
    page.evaluate(() => document.activeElement?.getAttribute("data-action"));
  const openAndCloseShip = async (close) => {
    await page.locator('[data-action="pause-ship"]').click();
    await shipCard.waitFor({ state: "visible" });
    assert.equal(
      await page.locator('[data-dialog="pause"]').isVisible(),
      false,
      "The Ship card hides the Paused card",
    );
    assert.equal(
      await shipCard.locator("h2").textContent(),
      PROTOTYPE.labels.ship,
      "The Ship card is titled Ship",
    );
    assert.deepEqual(
      await shipCard
        .locator(".ada-ship-section h3")
        .evaluateAll((headings) => headings.map((heading) => heading.textContent)),
      [PROTOTYPE.labels.cargo, PROTOTYPE.labels.equipment],
      "The Ship card shows Cargo, then Equipment",
    );
    assert.equal(await focusedAction(), "close-ship", "Focus starts on the Ship card's X");
    if (close === "Escape") {
      await page.screenshot({ path: `${output}/pause-ship.png` });
      await page.keyboard.press("Escape");
    } else {
      await page.locator('[data-action="close-ship"]').click();
    }
    await page.locator('[data-dialog="pause"]').waitFor({ state: "visible" });
    assert.equal(await shipCard.isVisible(), false, `${close} closes the Ship card`);
    assert.equal(await focusedAction(), "pause-ship", `${close} returns to the Ship button`);
  };
  await openAndCloseShip("Escape");
  await openAndCloseShip("x");
  // Map opens in danger as a full-screen map in the Paused card's place, with the galaxy's
  // name and how much is mapped in its header; nothing undiscovered appears.
  await page.locator('[data-action="pause-map"]').click();
  const mapScreen = page.locator('[data-dialog="map"]');
  await mapScreen.waitFor({ state: "visible" });
  assert.equal(
    await page.locator('[data-dialog="pause"]').isVisible(),
    false,
    "The map hides the Paused card",
  );
  const mapBox = await mapScreen.boundingBox();
  const viewport = page.viewportSize();
  assert.ok(
    mapBox &&
      viewport &&
      Math.abs(mapBox.width - viewport.width) <= 1 &&
      Math.abs(mapBox.height - viewport.height) <= 1,
    "The map fills the view",
  );
  assert.match(
    (await mapScreen.locator(".ada-map-percent").textContent()) ?? "",
    /^\d+% mapped$/u,
    "Map shows the percent mapped",
  );
  assert.equal(
    (await mapScreen.locator(".ada-map-galaxy").textContent()) ?? "",
    "Sunflower",
    "Map names the galaxy",
  );
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute("data-tool")),
    "close",
    "Focus starts on the map's close tool",
  );
  assert.deepEqual(
    await mapScreen
      .locator(".ada-map-tool")
      .evaluateAll((tools) => tools.map((tool) => tool.dataset.tool)),
    ["close", "zoomIn", "zoomOut", "recentre"],
    "The map's tools are close, zoom in, zoom out and recentre",
  );
  assert.deepEqual(
    await mapScreen
      .locator(".ada-map-tool")
      .evaluateAll((tools) => tools.map((tool) => tool.getAttribute("aria-label"))),
    ["close", "mapZoomIn", "mapZoomOut", "mapCenterOnAda"].map((key) => PROTOTYPE.labels[key]),
    "The map's tools carry Gameplay's accessible labels",
  );
  // Galaxies on the HUD row: Quests and Galaxies one 98 width, Galaxies' right edge 16 left of
  // the tool column, the header capped SPACING.gap short of Quests, 18 pips included. In danger
  // it refuses, and the reason-only panel shows the danger line with nothing selected.
  const mapEarth = mapScreen.locator('[data-action="map-galaxies"]');
  assert.equal(
    await mapEarth.textContent(),
    PROTOTYPE.labels.galaxies,
    "The local map offers Galaxies",
  );
  await assertNoTapFlash(
    ['[data-action="map-galaxies"]', '[data-action="map-quests"]', ".ada-map-tools [data-action]"],
    "The Map",
  );
  const hudRow = await mapScreen.evaluate((screen) => {
    const unit = Number(
      getComputedStyle(document.querySelector("#app")).getPropertyValue("--ada-unit"),
    );
    const box = (selector) => screen.querySelector(selector).getBoundingClientRect();
    const header = screen.querySelector(".ada-map-header");
    const pips = screen.querySelector(".ada-map-pips");
    while (pips.children.length < 18) {
      pips.append(pips.firstElementChild.cloneNode(true));
    }
    const result = {
      earth: box('[data-action="map-galaxies"]'),
      quests: box('[data-action="map-quests"]'),
      fits: header.scrollWidth <= header.clientWidth,
      header: box(".ada-map-header"),
      tools: box(".ada-map-tools"),
      unit,
    };
    while (pips.children.length > 12) {
      pips.lastElementChild.remove();
    }
    return result;
  });
  const logical = (px) => Math.round((px / hudRow.unit) * 10) / 10;
  // The close tool's disc is small: its drawn left edge is 7.5 inside its target, and Galaxies
  // ends SMALL_BUTTON_GAP (24) left of it.
  assert.ok(
    logical(hudRow.earth.width) === 98 &&
      logical(hudRow.earth.height) === 48 &&
      Math.abs(logical(hudRow.tools.left - hudRow.earth.right) + 7.5 - 24) <= 0.1 &&
      Math.abs(hudRow.earth.top - hudRow.tools.top) <= 0.5,
    `Galaxies is 98 by 48 on the HUD row, 24 left of the close disc: ${JSON.stringify(hudRow)}`,
  );
  assert.ok(
    // Device-pixel snapping puts the 98 width within 0.1 either side.
    Math.abs(hudRow.quests.width / hudRow.unit - 98) <= 0.1 &&
      logical(hudRow.quests.height) === 48 &&
      Math.abs(logical(hudRow.earth.left - hudRow.quests.right) - 16) <= 0.1 &&
      Math.abs(hudRow.quests.top - hudRow.earth.top) <= 0.5,
    `Quests is 98 by 48, BUTTON_GAP (16) left of Galaxies: ${JSON.stringify(hudRow)}`,
  );
  assert.ok(
    hudRow.fits && hudRow.header.right <= hudRow.quests.left - 8 * hudRow.unit + 0.5,
    `The header holds 18 pips within its cap: ${JSON.stringify(hudRow)}`,
  );
  assert.equal(await mapEarth.getAttribute("aria-disabled"), "true", "It is disabled in danger");
  const reasonOnly = await mapScreen.evaluate((screen) => {
    const panel = screen.querySelector(".ada-map-panel");
    const unit = Number(
      getComputedStyle(document.querySelector("#app")).getPropertyValue("--ada-unit"),
    );
    const box = panel.getBoundingClientRect();
    return {
      height: Math.round((box.height / unit) * 10) / 10,
      hidden: panel.hidden,
      reason: [...panel.querySelectorAll(".ada-map-reason [data-shown]")].map(
        (line) => line.textContent,
      ),
      row: panel.querySelector(".ada-map-row").hidden,
      width: Math.round((box.width / unit) * 10) / 10,
    };
  });
  // With nothing mapped the reason follows the empty note: 80 high, else 52.
  const emptyMap = (await mapScreen.locator(".ada-map-places .ada-map-place").count()) === 0;
  assert.deepEqual(
    reasonOnly,
    {
      height: emptyMap ? 80 : 52,
      hidden: false,
      reason: [PROTOTYPE.labels.travelUnavailable],
      row: true,
      width: 360,
    },
    "In danger with nothing selected the reason-only panel is 360 by 52, or 80 with the empty note",
  );
  await page.screenshot({ path: `${output}/map-earth-danger.png` });
  // Tab order: the tools, Quests, Galaxies, the places, then Travel here.
  await mapScreen.locator('[data-tool="close"]').focus();
  // Each press in turn, then what it focused.
  const tabThrough = async (presses, seen = []) => {
    if (presses === 0) {
      return seen;
    }
    await page.keyboard.press("Tab");
    const at = await page.evaluate(
      () => document.activeElement?.dataset.tool ?? document.activeElement?.dataset.action ?? "",
    );
    return tabThrough(presses - 1, [...seen, at]);
  };
  const tabbed = await tabThrough(5);
  assert.deepEqual(
    tabbed.slice(0, 5),
    ["zoomIn", "zoomOut", "recentre", "map-quests", "map-galaxies"],
    `Tab moves through the tools, then Quests and Galaxies: ${tabbed}`,
  );
  // Quests: the card under a dim over the whole map, focus on its first line button or its X;
  // Escape closes it back to the map, and a mapped line selects its chip.
  const questsCard = page.locator('[data-dialog="quests"]');
  const openQuests = async () => {
    await mapScreen.locator('[data-action="map-quests"]').click();
    await questsCard.waitFor({ state: "visible" });
  };
  await openQuests();
  const questLines = await questsCard.evaluate((card) => ({
    buttons: [...card.querySelectorAll(".ada-map-quest")].map((button) => button.dataset.target),
    focused: document.activeElement?.dataset.action ?? document.activeElement?.className ?? "",
    lines: [...card.querySelectorAll(".ada-map-quest-lines > *")].map((line) => line.textContent),
  }));
  assert.ok(
    questLines.lines.length > 0 &&
      (questLines.buttons.length > 0
        ? questLines.focused.includes("ada-map-quest")
        : questLines.focused === "close-quests"),
    `Quests lists its lines with focus on the first line button or the X: ${JSON.stringify(questLines)}`,
  );
  await page.screenshot({ path: `${output}/map-quests.png` });
  await page.keyboard.press("Escape");
  await questsCard.waitFor({ state: "hidden" });
  assert.ok(await mapScreen.isVisible(), "Escape closes Quests back to the map");
  if (questLines.buttons.length > 0) {
    await openQuests();
    await questsCard.locator(".ada-map-quest").first().click();
    await questsCard.waitFor({ state: "hidden" });
    assert.equal(
      await mapScreen
        .locator(`.ada-map-places [data-place="${questLines.buttons[0]}"]`)
        .getAttribute("aria-pressed"),
      "true",
      "A mapped Quests line closes the modal and selects its chip",
    );
  }
  await mapScreen.locator('[data-tool="close"]').focus();
  // A refused action stays pressable (aria-disabled), which Playwright treats as disabled.
  await mapEarth.click({ force: true });
  assert.ok(
    (await mapScreen.isVisible()) &&
      (await page.locator('#game-status[data-mode="space"]').count()) === 1,
    "A refused Galaxies keeps the local map and the flight",
  );
  const known = dangerInput.state.progress[dangerInput.state.flight.sector];
  const chips = mapScreen.locator(".ada-map-places .ada-map-place");
  assert.ok(
    (await chips.count()) <= known.known.length + known.stations.length,
    "Map shows only discovered places",
  );
  if ((await chips.count()) > 0) {
    // A selected place's panel names its type and distance from Ada, and in danger the danger
    // line, whatever the place offers.
    await chips.first().dispatchEvent("click");
    assert.deepEqual(
      await mapScreen
        .locator(".ada-map-reason [data-shown]")
        .evaluateAll((lines) => lines.map((line) => line.textContent)),
      [PROTOTYPE.labels.travelUnavailable],
      "In danger the danger line shows with a selection",
    );
    await page.screenshot({ path: `${output}/map-earth-danger-selected.png` });
    const kinds = Object.entries(PROTOTYPE.labels)
      .filter(([key]) => key.startsWith("mapKind"))
      .map(([, value]) => value);
    const typeLine = (await mapScreen.locator(".ada-map-detail").first().textContent()) ?? "";
    const [kind, distance] = typeLine.split(" · ");
    assert.ok(
      kinds.includes(kind) && /^(?:\d[\d,]*(?:\.\d)? light-years|1 light-year)$/u.test(distance),
      `The place panel's type line names a kind and a distance: ${typeLine}`,
    );
  }
  await page.keyboard.press("Escape");
  await page.locator('[data-dialog="pause"]').waitFor({ state: "visible" });
  assert.equal(await mapScreen.isVisible(), false, "Back and Escape close Map to the Paused card");
  await page.locator('[data-action="pause-map"]').click();
  await mapScreen.waitFor({ state: "visible" });
  await page.locator('[data-action="map-close"]').click();
  await page.locator('[data-dialog="pause"]').waitFor({ state: "visible" });
  assert.equal(await mapScreen.isVisible(), false, "The close tool returns to the Paused card");
  await page.locator('[data-action="pause-resume"]').click();
  await contextControlProof(0, "danger outside a friendly destination");
  events.checks.push(
    "Danger refuses the local map's Galaxies with its reason; the full-screen local map opens " +
      "with its galaxy, percent and tools, focus on close, and closes on Escape and its close " +
      "tool, and " +
      "no inapplicable or duplicate contextual control shows",
  );
  events.checks.push(
    "Achievements open from the start screen's button left of Settings in Gameplay's order, " +
      "paging six at a time; the start screen and the Paused card hold no Achievements",
  );
  // A held job's long Job line wraps inside the place panel, which stays clear of the tool
  // column, and selecting its target pans the chip clear of the panel's rendered height.
  const { ECONOMY } = await import(new URL("../src/data/economy.ts", import.meta.url));
  const { stationsNear } = await import(new URL("../src/model/stations.ts", import.meta.url));
  const jobInput = relaunch(PROTOTYPE, safeSerialized);
  const issuer = stationsNear(ECONOMY, 1, 25000, { x: 0, y: 0 })[0];
  const growersAt = jobInput.state.flight.objects.find(
    (o) => o.kind === "destination" && o.id === "growers",
  );
  jobInput.state.progress[1].stations = [issuer.id];
  jobInput.state.tasks = {
    1: {
      carrying: true,
      id: "job:smoke",
      item: "a crate of seedling trays for the far greenhouse ring",
      kind: "job",
      reward: 20,
      station: issuer.id,
      target: { id: "growers", x: growersAt.x, y: growersAt.y },
      type: "delivery",
    },
  };
  await seedOnce(jobInput.save(), "ada-browser.map-job-line.v1");
  await openPause();
  await page.locator('[data-action="pause-map"]').click();
  // The fixture opened a new page, so the map is found afresh.
  const jobMap = page.locator('[data-dialog="map"]');
  await jobMap.waitFor({ state: "visible" });
  await jobMap.locator('.ada-map-places [data-place="growers"]').dispatchEvent("click");
  const jobPanel = await jobMap.evaluate((screen) => {
    const box = (node) => node.getBoundingClientRect();
    const lines = [...screen.querySelectorAll(".ada-map-detail:not([hidden])")];
    const jobLine = lines.at(-1);
    const target = screen.querySelector('.ada-map-places [data-place="growers"]');
    return {
      chip: box(target),
      face: getComputedStyle(target).backgroundColor,
      jobHeight: jobLine ? box(jobLine).height : 0,
      jobText: jobLine?.textContent ?? "",
      lineHeight: jobLine ? parseFloat(getComputedStyle(jobLine).lineHeight) : 0,
      panel: box(screen.querySelector(".ada-map-panel")),
      tools: box(screen.querySelector(".ada-map-tools")),
    };
  });
  assert.match(jobPanel.jobText, /^Job: Deliver /u, "The job's target shows its Job line");
  assert.equal(
    jobPanel.face,
    "rgb(254, 174, 52)",
    "A held job's target chip has main's orange face",
  );
  assert.ok(
    jobPanel.jobHeight > 1.5 * jobPanel.lineHeight,
    `A long Job line wraps inside the panel: ${JSON.stringify(jobPanel)}`,
  );
  assert.ok(
    jobPanel.panel.right < jobPanel.tools.left,
    `The panel stays left of the tool column: ${JSON.stringify(jobPanel)}`,
  );
  assert.ok(
    jobPanel.chip.bottom < jobPanel.panel.top,
    `Selecting pans the chip clear of the wrapped panel: ${JSON.stringify(jobPanel)}`,
  );
  events.checks.push(
    "A held job's target chip has main's orange face; its long Job line wraps in the place " +
      "panel, left of the tool column, and the selected target pans clear of the panel's " +
      "rendered height",
  );
  // Back to title from a flight in danger: the start screen, the flight ended and saved at home
  // with no sleep scene; Continue resumes in the cockpit.
  await seedOnce(dangerInput.save(), "ada-browser.danger-title.v1");
  await openPause();
  await page.locator('[data-action="pause-backToTitle"]').click();
  await page.locator('[data-action="continue"]').waitFor({ state: "visible" });
  await page.locator('#game-status[data-mode="home"]').waitFor({ state: "attached" });
  const titled = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
  assert.ok(
    titled.mode === "home" &&
      titled.flight === null &&
      titled.economy.stardust === dangerInput.state.economy.stardust,
    "Back to title ends the flight with progress saved",
  );
  assert.equal(
    await page.locator(".ada-story-panel:not([hidden])").count(),
    0,
    "Back to title shows the start screen, not the jump-home page or the sleep scene",
  );
  // Achievements opens from the title's own button.
  await page.locator('[data-action="achievements"]').click();
  assert.equal((await achievementsPage()).count, "1/3", "Achievements opens from the title");
  await page.screenshot({ path: `${output}/achievements-title.png` });
  await page.locator('[data-action="close-achievements"]').click();
  await page.locator('[data-dialog="achievements"]').waitFor({ state: "hidden" });
  assert.deepEqual(
    await page
      .locator(".ada-start button")
      .evaluateAll((buttons) => buttons.map((button) => button.dataset.action)),
    ["continue", "restart"],
    "The start screen holds only Continue and Restart",
  );
  await page.locator('[data-action="continue"]').click();
  await page.locator(".ada-story-panel:not([hidden])").waitFor({ state: "visible" });
  assert.equal(
    await page.locator('[data-action="continue"]').isVisible(),
    false,
    "Continue resumes from the title",
  );
  // The local map's Galaxies opens the galaxy map over the paused flight: its ship on the galaxy
  // Ada is flying in, whose default action reads Stay here, and its close X on the HUD rect's
  // corner. Stay here closes both maps on the same flight; the close X returns to the local map;
  // Earth lands on Ada's room page, where the Paused card holds only Settings and Back to title,
  // and closes on Escape and its X. With the opening and prologue seen, Earth lands on the room
  // page itself.
  const roomInput = relaunch(PROTOTYPE, safeSerialized);
  roomInput.state.progress[1].opened = true;
  roomInput.state.prologueSeen = true;
  await seedOnce(roomInput.save(), "ada-browser.room-pause.v1");
  await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
  await openPause();
  await page.locator('[data-action="pause-map"]').click();
  await page.screenshot({ path: `${output}/map-earth.png` });
  const galaxyMap = page.locator('.ada-route[data-dialog="galaxies"]');
  const localMap = page.locator('[data-dialog="map"]');
  const flightSaved = () =>
    page.evaluate((key) => JSON.parse(localStorage.getItem(key))?.flight ?? null, storageKey);
  const flightBefore = await flightSaved();
  await localMap.locator('[data-action="map-galaxies"]').click();
  await galaxyMap.waitFor({ state: "visible" });
  assert.equal(
    (await galaxyMap.locator('[data-action="galaxy-jump"]').textContent())?.trim(),
    PROTOTYPE.labels.stayHere,
    "The galaxy map opened in flight offers Stay here on the galaxy Ada is flying in",
  );
  assert.equal(
    (await galaxyMap.locator("h2").textContent())?.trim(),
    PROTOTYPE.labels.galaxyNumber.replace("{number}", "1"),
    "The galaxy map opens on Sunflower, where Ada is flying",
  );
  const galaxyClose = galaxyMap.locator('[data-action="close-galaxies"]');
  assert.equal(await galaxyClose.count(), 1, "The galaxy map has its close X");
  // The galaxy map with its X at 844x390, without and with phone insets.
  const viewportBefore = page.viewportSize();
  await page.setViewportSize({ height: 390, width: 844 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${output}/galaxy-map-844.png` });
  const setInsets = (logical) =>
    page.evaluate((insets) => {
      const unit = Number(
        getComputedStyle(document.querySelector("#app")).getPropertyValue("--ada-unit"),
      );
      for (const [side, value] of Object.entries(insets)) {
        if (value === null) {
          document.documentElement.style.removeProperty(`--inset-${side}`);
        } else {
          document.documentElement.style.setProperty(`--inset-${side}`, `${value * unit}px`);
        }
      }
    }, logical);
  await setInsets({ bottom: 19, left: 43, right: 43, top: 0 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${output}/galaxy-map-844-insets.png` });
  const closeShown = await galaxyClose.evaluate((close) => {
    const box = close.getBoundingClientRect();
    return box.width > 0 && box.right <= window.innerWidth && box.top >= 0;
  });
  assert.ok(closeShown, "The galaxy map's close X shows on the HUD rect's corner with insets");
  await setInsets({ bottom: null, left: null, right: null, top: null });
  if (viewportBefore) {
    await page.setViewportSize(viewportBefore);
  }
  // Stay here: both maps close and the same flight resumes, with no jump and no new layout.
  await galaxyMap.locator('[data-action="galaxy-jump"]').click();
  await galaxyMap.waitFor({ state: "hidden" });
  await localMap.waitFor({ state: "hidden" });
  await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
  await page.waitForTimeout(1200);
  const flightAfter = await flightSaved();
  assert.ok(
    flightBefore &&
      flightAfter &&
      flightAfter.seed === flightBefore.seed &&
      flightAfter.sector === flightBefore.sector &&
      (await page.locator('[data-dialog="pause"]').isVisible()) === false,
    `Stay here resumes the same flight: ${JSON.stringify([flightBefore?.seed, flightAfter?.seed])}`,
  );
  // The close X returns to the local map it opened from.
  await openPause();
  await page.locator('[data-action="pause-map"]').click();
  await localMap.locator('[data-action="map-galaxies"]').click();
  await galaxyMap.waitFor({ state: "visible" });
  await galaxyClose.click();
  await galaxyMap.waitFor({ state: "hidden" });
  assert.ok(await localMap.isVisible(), "The galaxy map's close X returns to the local map");
  // Earth: the flight ends with the jump home.
  await localMap.locator('[data-action="map-galaxies"]').click();
  await galaxyMap.waitFor({ state: "visible" });
  await galaxyMap.locator('[data-action="galaxy-home"]').click();
  await page
    .locator(".ada-story-panel:not([hidden])")
    .getByText(PROTOTYPE.labels.pickUpRock, { exact: true })
    .waitFor({ state: "visible" });
  const roomSaved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
  assert.ok(
    roomSaved.mode === "home" && roomSaved.flight === null,
    "The galaxy map's Earth ends the flight, saved",
  );
  events.checks.push(
    "The local map's Galaxies opens the galaxy map on the galaxy Ada is flying in, with Stay here " +
      "and its close X; Stay here resumes the same flight, the X returns to the local map, and " +
      "Earth ends the flight home",
  );
  const roomPause = page.locator('[data-action="pause"]');
  if (await roomPause.isVisible()) {
    const box = await roomPause.boundingBox();
    const game = await page.locator("canvas").first().boundingBox();
    assert.ok(
      box && game && box.x - game.x < game.width / 4 && box.y - game.y < game.height / 4,
      "Ada's room page shows the pause button at the game area's top left",
    );
  }
  await openPause();
  assert.deepEqual(
    await pauseActions().evaluateAll((buttons) => buttons.map((button) => button.dataset.action)),
    ["pause-settings", "pause-backToTitle"],
    "Ada's room page's Paused card holds Settings and Back to title",
  );
  await page.screenshot({ path: `${output}/pause-room.png` });
  await page.keyboard.press("Escape");
  await page.locator('[data-dialog="pause"]').waitFor({ state: "hidden" });
  await openPause();
  await page.locator('[data-action="close-pause"]').click();
  await page.locator('[data-dialog="pause"]').waitFor({ state: "hidden" });
  await openPause();
  await page.locator('[data-action="pause-backToTitle"]').click();
  await page.locator('[data-action="continue"]').waitFor({ state: "visible" });
  events.checks.push(
    "Back to title ends a flight in danger with progress saved and no sleep scene, and " +
      "Continue resumes; the Map's Return to Earth lands on Ada's room page, which pauses to " +
      "Settings and Back to title, closing on Escape and its X",
  );
  // Towing never refuses the Map's Return to Earth; the held rescue stays held, its craft back
  // where it was stranded.
  const { ensureStation } = await import(new URL("../src/model/flight.ts", import.meta.url));
  const towInput = relaunch(PROTOTYPE, roomInput.save());
  const towFlight = towInput.state.flight;
  // The nearest station whose board offers a rescue.
  let rescue;
  for (const site of stationsNear(ECONOMY, 1, 40000, { x: 0, y: 0 }).sort(
    (a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y),
  )) {
    ensureStation(PROTOTYPE, site.id, towFlight);
    towFlight.player = { x: site.x, y: site.y };
    towInput.state.docked = site.id;
    rescue = towInput.jobBoard().find((row) => row.type === "rescue");
    if (rescue) {
      break;
    }
  }
  assert.ok(rescue, "A station near the origin offers a rescue");
  assert.equal(towInput.acceptJob(rescue.id), "accepted", "A rescue is accepted for the tow");
  towInput.undock();
  const still = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
  const towTarget = towInput.state.tasks[1].target;
  towFlight.objects = towFlight.objects.filter(({ kind }) => kind !== "enemy");
  towFlight.player = { x: towTarget.x + 100, y: towTarget.y };
  towFlight.velocity = { x: 0, y: 0 };
  towFlight.dangerFor = 0;
  towInput.state.dialogue = null;
  towInput.step(0.05, { ...still, use: true });
  assert.ok(towInput.towing, "The fixture is towing");
  // Clear of the stranded site's hostiles, the tow line still attached. One step generates the
  // space around the new spot, then its drones, hazards, drifting debris and shots go and danger
  // resets, so no generated world can put Ada in danger before the Map opens.
  for (const at of [towFlight.player, towFlight.tow]) {
    at.x -= 2500;
  }
  towFlight.velocity = { x: 0, y: 0 };
  towInput.step(0.05, still);
  towFlight.objects = towFlight.objects.filter(
    ({ kind }) => kind !== "enemy" && kind !== "hazard" && kind !== "debris",
  );
  towFlight.shots = towFlight.shots.filter((shot) => !shot.enemy);
  towFlight.dangerFor = 0;
  towInput.state.dialogue = null;
  assert.ok(towInput.towing, "The fixture still tows after its calm step");
  await seedOnce(towInput.save(), "ada-browser.tow-earth.v1");
  await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
  await openPause();
  await page.locator('[data-action="pause-map"]').click();
  const towEarth = page.locator('[data-dialog="map"] [data-action="map-returnHome"]');
  assert.equal(await towEarth.getAttribute("aria-disabled"), null, "Towing keeps it available");
  await towEarth.click();
  await page
    .locator(".ada-story-panel:not([hidden])")
    .getByText(PROTOTYPE.labels.pickUpRock, { exact: true })
    .waitFor({ state: "visible" });
  const towed = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
  assert.ok(
    towed.flight === null && towed.tasks["1"]?.id === rescue.id,
    "Return to Earth while towing ends the flight and keeps the rescue held",
  );
  events.checks.push("The Map's Return to Earth stays available while towing and ends the flight");
  await seedOnce(safeSerialized, "ada-browser.after-save-proof.v1");
  await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
  await page.setViewportSize({ width: 844, height: 390 });
  await touchHudProof("844x390");
  events.checks.push("At 844x390 the sticks' rings sit 40 in from the game area, the pill level");
  // Compare observable flight response, not the implementation's stick sampling formula. Travel is
  // in logical px, --ada-unit CSS px each.
  const stickUnit = await page
    .locator("#app")
    .evaluate((app) => Number(getComputedStyle(app).getPropertyValue("--ada-unit")));
  async function analogRun(logical, marker) {
    const distance = logical * stickUnit;
    await seedOnce(safeSerialized, marker);
    const target = await settledBox('[data-control="move-joystick"]');
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
  const fullTravel = await analogRun(40, "ada-browser.analog-full.v1");
  assert.equal(deadTravel, 0, "Movement inside the logical dead zone must remain idle");
  assert.ok(
    smallTravel > 0 && fullTravel > smallTravel * 1.5,
    "Full logical travel must move materially farther than partial travel over the same interval",
  );
  save("analog-proof.json", { deadTravel, smallTravel, fullTravel });
  events.checks.push("Logical move-stick dead zone and partial/full throttle affect actual flight");
  await seedOnce(safeSerialized, "ada-browser.after-analog.v1");
  const bounds = await settledBox('[data-control="move-joystick"]');
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
  const moveBounds = await settledBox('[data-control="move-joystick"]');
  const aimBounds = await settledBox('[data-control="aim-joystick"]');
  assert.ok(moveBounds && aimBounds, "Both real joystick targets must be present");
  await assertNoTapFlash(
    [
      '[data-control="move-joystick"]',
      '[data-control="aim-joystick"]',
      ".ada-pause",
      ".ada-weapon",
      ".ada-weapon .ada-disc",
    ],
    "Flight",
  );
  events.checks.push(
    "The start screen's discs and Start, the sticks, pause and weapon discs, and the Map's " +
      "controls draw no tap flash",
  );
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

  const equipment = relaunch(PROTOTYPE, safeSerialized);
  equipment.state.flight.ownedWeapons = ["rapidMissile", "multiLaser"];
  // Each with a new weapon's three packs.
  Object.assign(equipment.state.flight.ammo, { multiLaser: 600, rapidMissile: 600 });
  equipment.state.flight.weapon = "basic";
  const equipmentSave = equipment.save();
  assert.deepEqual(relaunch(PROTOTYPE, equipmentSave).state, equipment.state);
  save("equipment-fixture.json", {
    scope:
      "Canonical owned-upgrade fixture for UI selection and persistence, not pickup progression",
    state: JSON.parse(equipmentSave),
  });
  await seedOnce(equipmentSave, "ada-browser.equipment.v1");
  const missileButton = page.locator('button[data-weapon="rapidMissile"]');
  await missileButton.waitFor({ state: "visible" });
  assert.equal(
    await page.locator('button[data-weapon="scattershot"]').count(),
    0,
    "An unowned upgrade must not be offered",
  );
  await missileButton.click();
  // The next switch waits after this one: an immediate second switch plays the refusal cue.
  await page.locator('[data-weapon="multiLaser"]').click();
  await page.waitForFunction(
    () => document.querySelector('[data-weapon="multiLaser"]')?.style.color !== "",
    null,
    { timeout: 2000 },
  );
  await page.waitForFunction(
    (key) => JSON.parse(localStorage.getItem(key)).flight.weapon === "rapidMissile",
    storageKey,
  );
  assert.equal(await missileButton.getAttribute("aria-pressed"), "true");
  assert.equal(
    await page.locator('[data-weapon="multiLaser"]').getAttribute("aria-pressed"),
    "false",
    "A switch during the wait after the last one must be refused",
  );
  assert.equal(
    await page.locator(".flight-hud").count(),
    0,
    "The removed top-left information HUD must not be recreated",
  );
  // Each weapon masks its own 20px glyph.
  const { weaponGlyphPath } = await import(
    new URL("../src/data/weapon-glyphs.ts", import.meta.url)
  );
  const weaponImages = await page.locator(".ada-weapon-selector .ada-disc").evaluateAll((glyphs) =>
    glyphs.map((glyph) => ({
      decorative: glyph.getAttribute("aria-hidden") === "true",
      mask:
        getComputedStyle(glyph, "::before").maskImage ||
        getComputedStyle(glyph, "::before").webkitMaskImage,
      state: glyph.closest(".ada-weapon").dataset.state,
      weapon: glyph.closest(".ada-weapon").dataset.weapon,
    })),
  );
  assert.equal(weaponImages.length, 3, "Basic and both owned upgrades require weapon glyphs");
  for (const icon of weaponImages) {
    assert.ok(icon.decorative, "Weapon glyphs must not duplicate button names");
    assert.ok(
      icon.mask.includes(weaponGlyphPath(icon.weapon)),
      `Weapon glyphs must mask Art's 20px icon: ${icon.mask}`,
    );
  }
  const glyphStatuses = await Promise.all(
    weaponImages.map(async (icon) =>
      (await page.request.get(`http://ada-preview:4173${weaponGlyphPath(icon.weapon)}`)).status(),
    ),
  );
  assert.deepEqual(
    glyphStatuses,
    weaponImages.map(() => 200),
    "The 20px weapon glyphs must be served",
  );
  assert.equal(
    weaponImages.find((icon) => icon.weapon === "rapidMissile")?.state,
    "selected",
    "The selected weapon must draw the selected state",
  );
  await page.reload();
  await continueFlight();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-weapon="rapidMissile"]')?.getAttribute("aria-pressed") ===
      "true",
  );
  assert.deepEqual((await readSave()).flight.ownedWeapons, ["rapidMissile", "multiLaser"]);
  await openSettings();
  assert.ok(await missileButton.isDisabled(), "Settings must disable weapon selection");
  const pausedWeapon = (await readSave()).flight.weapon;
  await page.locator('[data-weapon="multiLaser"]').evaluate((button) => button.click());
  assert.equal(
    (await readSave()).flight.weapon,
    pausedWeapon,
    "A disabled weapon must not change selection behind the modal",
  );
  await closeSettings();
  // The saved switch wait from the Rapid Missile switch runs out in play first.
  await page.waitForTimeout(1200);
  await page.locator('[data-weapon="multiLaser"]').click();
  await page.waitForFunction(
    (key) => JSON.parse(localStorage.getItem(key)).flight.weapon === "multiLaser",
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
    "multiLaser",
    "Firing must not consume an upgrade",
  );
  const meter = page.getByRole("meter", { name: PROTOTYPE.labels.shield, exact: true });
  assert.equal(Number(await meter.getAttribute("aria-valuenow")), PROTOTYPE.tuning.shieldMax);
  const pill = await settledBox(".ada-status");
  const pauseBox = await settledBox('[data-action="pause"]');
  const bar = await meter.boundingBox();
  // The DOM UI is sized in logical px: --ada-unit CSS px each.
  const unit = await page
    .locator("#app")
    .evaluate((app) => Number(getComputedStyle(app).getPropertyValue("--ada-unit")));
  // The shield sits apart in its 202x28 pill at the bottom centre, its bar 160x12, centred
  // across the canvas.
  const canvasBox = await settledBox("#game-canvas > canvas");
  const shieldPill = await settledBox(".ada-shield");
  assert.ok(
    bar &&
      pill &&
      canvasBox &&
      shieldPill &&
      Math.abs(shieldPill.width - 202 * unit) <= 1 &&
      Math.abs(shieldPill.height - 28 * unit) <= 1 &&
      bar.x > shieldPill.x &&
      bar.x + bar.width < shieldPill.x + shieldPill.width &&
      Math.abs(shieldPill.x + shieldPill.width / 2 - (canvasBox.x + canvasBox.width / 2)) <= 1 &&
      Math.abs(bar.width - 160 * unit) <= 1 &&
      Math.abs(bar.height - 12 * unit) <= 1 &&
      Math.abs(pill.height - 28 * unit) <= 1 &&
      bar.y > canvasBox.y + canvasBox.height / 2,
    "The shield meter must be the shield pill's 160x12 bar at the bottom centre",
  );
  if (pauseBox && (await page.locator('[data-action="pause"]').isVisible())) {
    assert.ok(
      Math.abs(pill.x - (pauseBox.x + pauseBox.width + 8 * unit)) <= 1,
      "The status pill must sit a gap right of the pause press area",
    );
  }
  const pauseButton = page.locator('[data-action="pause"]');
  assert.equal(await pauseButton.getAttribute("aria-label"), PROTOTYPE.labels.pause);
  const pauseImage = await pauseButton.evaluate(
    (node) => getComputedStyle(node, "::before").backgroundImage,
  );
  assert.ok(
    pauseImage.includes("/art/ui/icons/pause.svg"),
    `Pause must draw its vector art: ${pauseImage}`,
  );
  assert.equal(
    (await page.request.get("http://ada-preview:4173/art/ui/icons/pause.svg")).status(),
    200,
    "The real pause button resource must be served",
  );
  assert.equal(
    await page.locator('[data-action="settings"]').isVisible(),
    false,
    "Play shows no settings button; Settings opens from the Paused card",
  );
  const savedAmmo = (await readSave()).flight.ammo;
  assert.ok(
    savedAmmo.rapidMissile === 600 && savedAmmo.multiLaser < 600,
    `Saves carry each upgrade's ammunition, one shot spent per volley: ${JSON.stringify(savedAmmo)}`,
  );
  save("weapon-icons-proof.json", { pauseImage, weaponImages });
  await page.screenshot({ path: `${output}/weapon-shield.png` });
  events.checks.push(
    "Owned upgrade weapons support accessible selection, the switch wait's refusal, saved " +
      "ammunition, reload, modal guards and the bottom-centre shield meter",
  );

  const damaged = relaunch(PROTOTYPE, equipmentSave);
  assert.ok(damaged.selectWeapon("rapidMissile"));
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
  damaged.state.economy.stardust = 30;
  // The flight a step before the shield breaks, for the browser's own jump home below.
  const breakingSave = damaged.save();
  damaged.step(0.01, { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false });
  assert.equal(damaged.state.mode, "home", "Shield depletion must jump Ada home");
  assert.equal(damaged.state.flight, null, "The jump home must lose only the flight");
  assert.deepEqual(damaged.state.economy.ownedWeapons, ["rapidMissile", "multiLaser"]);
  assert.equal(damaged.state.economy.weapon, "rapidMissile", "The equipped weapon must stay");
  assert.equal(damaged.state.economy.stardust, 30, "The jump home must cost no Stardust");
  const damageSave = damaged.save();
  assert.deepEqual(relaunch(PROTOTYPE, damageSave).state, damaged.state);
  save("shield-break-fixture.json", {
    scope: "Real-model projectile damage before restore, not a natural browser combat playthrough",
    state: JSON.parse(damageSave),
  });
  await seedOnce(damageSave, "ada-browser.shield-break.v1");
  await page.locator('#game-status[data-mode="home"]').waitFor({ state: "attached" });
  const jumpNotice = await page.locator("#game-status").textContent();
  assert.ok(
    jumpNotice.includes(PROTOTYPE.labels.jumpHome) &&
      !jumpNotice.includes("lost") &&
      !jumpNotice.includes("cost"),
    `The jump home notice must name no loss or fee: ${jumpNotice}`,
  );
  events.checks.push(
    "Canonical shield depletion jumps Ada home, costing only the flight and keeping weapons and Stardust",
  );

  // Art's overnight room (art/storybook.md "Sequence"): the shield breaks in the browser, the jump
  // lands at night, the sleep page plays the figures, the rock's breath and the cross-fade, with
  // Ada's waking sprite fading in with the morning, and morning follows.
  await seedOnce(breakingSave, "ada-browser.overnight.v1");
  const storyNext = () => page.locator('.ada-story-panel:not([hidden]) [data-action="story-next"]');
  const roomShows = (background) =>
    page
      .locator(`.ada-story-background[data-background="${background}"]`)
      .waitFor({ state: "attached", timeout: 30000 });
  await roomShows("adaRoomNight");
  await storyNext().waitFor({ state: "visible", timeout: 30000 });
  // The emergency jump's overlay ends before the night room is captured.
  await page.waitForFunction(() => !document.querySelector(".ada-jump"), null, { timeout: 30000 });
  await page.waitForFunction(() =>
    document.querySelector(".ada-story-art")?.style.backgroundImage.includes("ada-room-night"),
  );
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${output}/overnight-night.png` });
  await storyNext().click();
  const sleepStart = Date.now();
  await roomShows("adaRoomSleep");
  await page
    .locator('.ada-story-overlay[data-overlay="story-ada-room-sleep-figures"]')
    .waitFor({ state: "visible" });
  // Midway through the breath: the figures in and the glow near its peak (400 + 750 ms).
  await page.waitForTimeout(Math.max(0, 1150 - (Date.now() - sleepStart)));
  const sleepState = await page.evaluate(() => {
    const opacity = (id) =>
      Number(getComputedStyle(document.querySelector(`[data-overlay="${id}"]`)).opacity);
    return {
      figures: opacity("story-ada-room-sleep-figures"),
      glow: opacity("story-ada-room-sleep-glow"),
      panelHidden: document.querySelector(".ada-story-panel").hidden,
    };
  });
  await page.screenshot({ path: `${output}/overnight-sleep.png` });
  // Midway through the cross-fade to morning: the waking sprite rides in the incoming image, so it
  // fades with the room instead of appearing after it.
  const fadeState = await (
    await page.waitForFunction(
      () => {
        const incoming = document.querySelectorAll(".ada-story-art")[1];
        const opacity = incoming ? Number(getComputedStyle(incoming).opacity) : 0;
        return (
          incoming?.style.backgroundImage.includes("ada-room-morning") &&
          opacity > 0.2 &&
          opacity < 0.8 && {
            incoming: incoming.style.backgroundImage,
            opacity,
            overlays: [...incoming.querySelectorAll(".ada-story-overlay")].map(
              (node) => node.dataset.overlay,
            ),
          }
        );
      },
      null,
      { polling: "raf" },
    )
  ).jsonValue();
  await page.screenshot({ path: `${output}/overnight-waking-fade.png` });
  await roomShows("adaRoomMorningCats");
  const sleptMs = Date.now() - sleepStart;
  await storyNext().waitFor({ state: "visible" });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${output}/overnight-morning.png` });
  const morning = {
    art: await page
      .locator(".ada-story-art")
      .first()
      .evaluate((art) => art.style.backgroundImage),
    overlays: await page
      .locator(".ada-story-overlay:not([hidden])")
      .evaluateAll((nodes) => nodes.map((node) => node.dataset.overlay)),
    // Ada's sprite samples nearest at the device-pixel backing, like the canvas behind it.
    sampling: await page
      .locator('.ada-story-overlay[data-overlay="story-ada-waking"]:not([hidden])')
      .evaluate((node) => ({
        overlay: getComputedStyle(node).imageRendering,
        ratio: window.devicePixelRatio,
      })),
  };
  save("overnight-proof.json", {
    fadeState,
    morning,
    scope: "The browser's own shield break and jump home, then Art's overnight sequence",
    sleepState,
    sleptMs,
  });
  assert.equal(sleepState.figures, 1, "The sleeping figures must be in by the breath");
  assert.ok(sleepState.glow > 0.5, `The rock's breath must near its peak: ${sleepState.glow}`);
  assert.ok(sleepState.panelHidden, "The sleep page shows no panel");
  assert.ok(
    sleptMs >= 2300 && sleptMs < 4500,
    `The sleep page must last Art's 2.5 s sequence: ${sleptMs} ms`,
  );
  assert.ok(
    morning.art.includes("ada-room-morning"),
    `Morning must draw Art's room: ${morning.art}`,
  );
  assert.ok(
    fadeState.incoming.includes("ada-room-morning") &&
      fadeState.opacity > 0 &&
      fadeState.opacity < 1,
    `The capture falls inside the cross-fade to morning: ${JSON.stringify(fadeState)}`,
  );
  // Ada waking and the cats curled at her feet fade in with the morning.
  const morningFigures = ["story-ada-waking", "story-archie-curled", "story-kiwi-curled"];
  assert.deepEqual(
    fadeState.overlays,
    morningFigures,
    "Ada's waking sprite and the cats fade in with the morning",
  );
  assert.equal(
    morning.sampling.overlay,
    "pixelated",
    `Ada's waking sprite samples nearest: ${JSON.stringify(morning.sampling)}`,
  );
  assert.deepEqual(
    morning.overlays,
    morningFigures,
    "The cross-fade to morning ends the night's overlays and leaves Ada waking with the cats",
  );
  events.checks.push(
    "The browser's jump home lands in Art's night room, plays the overnight sequence and wakes " +
      "in the morning room, Ada's waking sprite fading in with it",
  );

  // A story run (gameplay/rules.md "Earth scenes"): from Start, Previous on the prologue's first
  // page returns across Grandma's garden into chapter one's opening, Skip from a mid-cockpit page
  // passes the rest of the run to galaxy selection, and Home's run is Ada's room page alone, with
  // Skip hidden.
  await seedOnce(new GameModel(PROTOTYPE).save(), "ada-browser.story-run.v1");
  await page.locator('[data-action="start"]').click();
  const storyPanel = page.locator(".ada-story-panel:not([hidden])");
  const storyButton = (action) => storyPanel.locator(`[data-action="story-${action}"]`);
  const storyPage = async () => ({
    background: await page.locator(".ada-story-background").getAttribute("data-background"),
    previousDisabled: await storyButton("previous").isDisabled(),
    skipShown: await page.locator('[data-action="story-skip"]').isVisible(),
    text: ((await storyPanel.locator(".ada-story-paragraph").textContent()) ?? "").trim(),
  });
  const showsText = (text) =>
    storyPanel.locator(".ada-story-paragraph", { hasText: text }).waitFor();
  await showsText(PROTOTYPE.premise.gardenArrival[0].text);
  const opening = await storyPage();
  // Next through each page in turn, each shown before the next press.
  async function nextThrough(texts) {
    if (texts.length === 0) {
      return;
    }
    await storyButton("next").click();
    await showsText(texts[0]);
    await nextThrough(texts.slice(1));
  }
  // Next until the page with this text shows.
  async function nextTo(text, remaining = 30) {
    if ((await storyPage()).text === text) {
      return;
    }
    assert.ok(remaining > 0, `The story run must reach "${text}"`);
    await storyButton("next").click();
    await page.waitForTimeout(50);
    await nextTo(text, remaining - 1);
  }
  await nextThrough(PROTOTYPE.premise.gardenArrival.slice(1).map(({ text }) => text));
  await storyButton("next").click();
  await storyButton("choice").first().click();
  await showsText(PROTOTYPE.chapters[1].openingBranches[0]);
  await storyButton("next").click();
  await showsText(PROTOTYPE.premise.gardenFarewell.text);
  await storyButton("next").click();
  await showsText(PROTOTYPE.premise.prologue[0].text);
  const prologue = await storyPage();
  // Previous across Grandma's garden into chapter one's opening.
  await storyButton("previous").click();
  await showsText(PROTOTYPE.premise.gardenFarewell.text);
  const garden = await storyPage();
  await storyButton("previous").click();
  await showsText(PROTOTYPE.chapters[1].openingBranches[0]);
  const back = await storyPage();
  // On to a mid-cockpit page, Astra asking Ada's name, then Skip.
  const named = PROTOTYPE.premise.prologue.find(
    ({ text }) => text === "What is your name, explorer?",
  );
  assert.ok(named, "The prologue's cockpit has Astra ask Ada's name");
  await nextTo(named.text);
  const cockpit = await storyPage();
  await page.locator('[data-action="story-skip"]').click();
  await selector().waitFor({ state: "visible" });
  await page.locator('[data-action="galaxy-home"]').click();
  await storyButton("next").waitFor({ state: "visible" });
  const room = await storyPage();
  const roomAction = ((await storyButton("next").textContent()) ?? "").trim();
  await page.screenshot({ path: `${output}/story-run-room.png` });
  save("story-run-proof.json", { back, cockpit, garden, opening, prologue, room, roomAction });
  assert.ok(opening.previousDisabled, "Previous is disabled on the run's first page");
  assert.equal(opening.background, "grandmaGarden", "The run opens in Grandma's garden");
  assert.ok(opening.skipShown, "Skip shows inside the run");
  assert.ok(!prologue.previousDisabled, "Previous crosses back from the prologue");
  assert.equal(garden.background, "grandmaGarden", "Previous returns to Grandma's farewell");
  assert.equal(back.text, PROTOTYPE.chapters[1].openingBranches[0]);
  assert.ok(!back.previousDisabled, "Previous goes on within chapter one's opening");
  assert.equal(cockpit.background, "cockpit", "Skip is pressed on a standing cockpit page");
  assert.equal(room.background, "adaRoom", "Home from galaxy selection shows Ada's room");
  assert.equal(roomAction, PROTOTYPE.labels.pickUpRock);
  assert.ok(!room.skipShown, "Skip is hidden on the run's end, Ada's room page");
  assert.ok(room.previousDisabled, "Ada's room page from galaxy selection starts its run");
  events.checks.push(
    "A story run's Previous crosses from the prologue across Grandma's garden into chapter one, " +
      "Skip from the cockpit passes the run to galaxy selection, and Ada's room page ends a run " +
      "with Skip hidden",
  );

  // The start screen (art/layout.md "Start screen"): every part in play-view px from the game
  // area's left edge, at 720x360 and on an 844x390 phone, without and with insets (left and right
  // 43, bottom 19 logical), first run and with a save. START_SCREEN comes from the layout dump,
  // which its test keeps equal to the source, since the source imports the kit by package name.
  const { START_SCREEN } = JSON.parse(
    readFileSync(new URL("layout-dump.json", import.meta.url), "utf8"),
  ).constants["startScreen.ts"];
  const startScreenAt = async (name, size, insets) => {
    await page.setViewportSize(size);
    await page.evaluate((logical) => {
      const unit = Number(
        getComputedStyle(document.querySelector("#app")).getPropertyValue("--ada-unit"),
      );
      for (const [side, value] of Object.entries(logical)) {
        document.documentElement.style.setProperty(`--inset-${side}`, `${value * unit}px`);
      }
    }, insets);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${output}/start-screen-${name}.png` });
    return page.evaluate(() => {
      const app = document.querySelector("#app");
      const unit = Number(getComputedStyle(app).getPropertyValue("--ada-unit"));
      const x0 = parseFloat(getComputedStyle(app).getPropertyValue("--ada-area-left")) / unit;
      const origin = app.getBoundingClientRect();
      const box = (selector) => {
        const rect = document.querySelector(selector)?.getBoundingClientRect();
        return rect
          ? [
              (rect.x - origin.x) / unit - x0,
              (rect.y - origin.y) / unit,
              rect.width / unit,
              rect.height / unit,
            ].map((value) => Math.round(value * 10) / 10)
          : null;
      };
      return {
        actions: [...document.querySelectorAll(".ada-start-actions > button")].map((button) => [
          button.dataset.action,
          box(`.ada-start-actions > [data-action="${button.dataset.action}"]`),
          button.classList.contains("ada-primary") ? "primary" : "secondary",
        ]),
        achievements: box('[data-action="achievements"]'),
        exit: box('[data-action="exit"]'),
        focused: document.activeElement?.dataset.action ?? null,
        note: document.querySelectorAll(".ada-start-note").length,
        settings: box('[data-action="settings"]'),
        ship: box(".ada-start-ship"),
        shipSrc: document.querySelector(".ada-start-ship")?.getAttribute("src"),
        title: document.querySelector(".ada-start-title img")?.getAttribute("alt"),
        unit,
        wordmark: box(".ada-start-title"),
        x0,
      };
    });
  };
  const sizes = [
    ["720", { height: 360, width: 720 }, {}],
    ["720-insets", { height: 360, width: 720 }, { bottom: 19, left: 43, right: 43, top: 0 }],
    ["844", { height: 390, width: 844 }, {}],
    ["844-insets", { height: 390, width: 844 }, { bottom: 19, left: 43, right: 43, top: 0 }],
  ];
  const fresh = new GameModel(PROTOTYPE);
  const saved = new GameModel(PROTOTYPE);
  saved.state.started = true;
  const startScreens = {};
  // One at a time, in order: each seeds or resizes the one page.
  const inTurn = (items, run) =>
    items.reduce((prior, item) => prior.then(() => run(item)), Promise.resolve());
  await inTurn(
    [
      ["new", fresh],
      ["saved", saved],
    ],
    async ([kind, model]) => {
      await seedOnce(model.save(), `ada-browser.start-screen-${kind}.v1`);
      await page.locator(".ada-start-actions > button").first().waitFor({ state: "visible" });
      await page.waitForFunction(() => document.querySelector(".ada-start-ship")?.complete);
      // Once loading ends the kit's one loading bar hides: an idle start screen shows none.
      const idle = await page
        .waitForFunction(
          () => {
            // Idle, or complete with its hold and fade over (the kit's complete state ends hidden).
            const bars = document.querySelectorAll(".progress-bar");
            return (
              bars.length === 1 &&
              (bars[0].hidden || getComputedStyle(bars[0]).visibility === "hidden")
            );
          },
          null,
          { timeout: 10000 },
        )
        .then(
          () => true,
          () => false,
        );
      assert.ok(idle, `The ${kind} start screen hides its one loading bar once loading ends`);
      await inTurn(sizes, async ([name, size, insets]) => {
        startScreens[`${kind}-${name}`] = await startScreenAt(`${kind}-${name}`, size, insets);
      });
    },
  );
  await page.setViewportSize({ height: 720, width: 1280 });
  save("start-screen-proof.json", startScreens);
  const { actions, ship, wordmark } = START_SCREEN;
  for (const [name, shot] of Object.entries(startScreens)) {
    assert.deepEqual(
      shot.wordmark,
      [wordmark.left, wordmark.top, wordmark.width, wordmark.height],
      `${name}: the wordmark sits at its play-view place`,
    );
    assert.deepEqual(
      shot.ship,
      [ship.centre.x - ship.size / 2, ship.centre.y - ship.size / 2, ship.size, ship.size],
      `${name}: the ship frame is 280 square on its centre`,
    );
    assert.equal(shot.note, 0, `${name}: the start screen has no note`);
    assert.equal(shot.title, PROTOTYPE.labels.home, `${name}: the wordmark is named by home`);
    assert.equal(shot.shipSrc, "/art/ship-26.svg", `${name}: Classic's ship-26 before a paint`);
    for (const [action, box, role] of shot.actions) {
      assert.deepEqual(
        box,
        [actions.left[action], actions.top, actions.width, actions.height],
        `${name}: ${action} sits at its play-view place`,
      );
      assert.equal(
        role,
        action === "restart" ? "secondary" : "primary",
        `${name}: ${action}'s role`,
      );
    }
    // The HUD row's nav discs, a browser tab's Exit rightmost, Settings one pitch left of it and
    // Achievements one more, inside the game area.
    assert.ok(Math.abs(shot.settings[0] - shot.achievements[0] - 57) < 0.1, `${name}: nav pitch`);
    assert.ok(Math.abs(shot.exit[0] - shot.settings[0] - 57) < 0.1, `${name}: Exit's pitch`);
    assert.ok(shot.exit[0] + shot.exit[2] <= 720 + 0.1, `${name}: Exit in the game area`);
  }
  assert.deepEqual(
    startScreens["new-720"].actions.map(([action]) => action),
    ["start"],
    "A first run offers Start alone",
  );
  assert.deepEqual(
    startScreens["saved-720"].actions.map(([action]) => action),
    ["continue", "restart"],
    "A save offers Continue, then Restart, in tab order",
  );
  assert.equal(startScreens["new-720"].focused, "start", "Start is the default");
  assert.equal(startScreens["saved-720"].focused, "continue", "Continue is the default");
  assert.equal(startScreens["new-844"].x0, 29, "The 844x390 phone's game area starts at 29");
  // Insets move the nav discs, never the start screen's parts (Art's table).
  // The HUD rect's right is 720 - 43 = 677; Exit's target reaches HUD_ROW.reach (7.5) past it, at
  // 677 + 7.5 - 48, and Settings and Achievements sit one and two pitches (57) left of it.
  const insetDiscs = startScreens["saved-720-insets"];
  assert.deepEqual(
    [insetDiscs.exit[0], insetDiscs.settings[0], insetDiscs.achievements[0]].map(
      (x) => Math.round((x + insetDiscs.x0) * 10) / 10,
    ),
    [636.5, 579.5, 522.5],
    "Exit, Settings and Achievements clear the right inset",
  );
  // Tab order: Continue, Restart, Achievements, Settings, Exit.
  const order = [];
  await page.setViewportSize({ height: 360, width: 720 });
  await seedOnce(saved.save(), "ada-browser.start-screen-tabs.v1");
  await page.locator('.ada-start-actions > [data-action="continue"]').waitFor({ state: "visible" });
  await inTurn([0, 1, 2, 3], async () => {
    await page.keyboard.press("Tab");
    order.push(await page.evaluate(() => document.activeElement?.dataset.action ?? null));
  });
  await page.setViewportSize({ height: 720, width: 1280 });
  assert.deepEqual(
    order,
    ["restart", "achievements", "settings", "exit"],
    "Tab follows Continue's lead",
  );
  // An open modal is the topmost layer: over Achievements' own disc, Achievements' card shows.
  await page.locator('[data-action="achievements"]').click();
  await page.locator('[data-dialog="achievements"]').waitFor({ state: "visible" });
  const topmost = await page.evaluate(() => {
    const disc = document.querySelector('[data-action="achievements"]').getBoundingClientRect();
    const hit = document.elementFromPoint(disc.x + disc.width / 2, disc.y + disc.height / 2);
    return {
      button: Boolean(hit?.closest('[data-action="achievements"]')),
      modal: Boolean(hit?.closest(".ada-modal")),
      start: Boolean(hit?.closest(".ada-start")),
    };
  });
  await page.locator('[data-action="close-achievements"]').click();
  await page.locator('[data-dialog="achievements"]').waitFor({ state: "hidden" });
  assert.deepEqual(
    topmost,
    { button: false, modal: true, start: false },
    "An open modal draws over the start screen and its nav discs",
  );
  events.checks.push(
    "The start screen draws the field, ship, wordmark and actions at their play-view places " +
      "at 720x360 and 844x390, with and without insets, defaults to Start or Continue and tabs " +
      "Continue, Restart, Achievements, Settings",
  );

  const { SCREEN } = await import(new URL("../src/data/screen.ts", import.meta.url));
  const weaponModel = relaunch(PROTOTYPE, safeSerialized);
  weaponModel.state.flight.ownedWeapons = ["rapidMissile", "multiLaser", "scattershot"];
  Object.assign(weaponModel.state.flight.ammo, {
    multiLaser: 600,
    rapidMissile: 600,
    scattershot: 390,
  });
  weaponModel.state.flight.weapon = "basic";
  weaponModel.state.flight.objects = [];
  weaponModel.state.flight.shots = [];
  const weaponSave = weaponModel.save();
  assert.deepEqual(relaunch(PROTOTYPE, weaponSave).state, weaponModel.state);
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
        relaunch(PROTOTYPE, JSON.stringify(snapshot)).state,
        snapshot,
        "Actual fired projectiles and fade metadata must survive canonical save validation",
      );
      await page.screenshot({ path: `${output}/volley-${weapon}.png` });
      return snapshot;
    } finally {
      await page.keyboard.up("ArrowRight");
    }
  }
  const missiles = await heldVolley("rapidMissile", "missile", 3);
  // Remaining life counts down, so ascending life is firing order (oldest first).
  const missileShots = missiles.flight.shots
    .filter((shot) => !shot.enemy && shot.projectile === "missile")
    .sort((a, b) => a.life - b.life);
  assert.ok(
    new Set(missileShots.map((shot) => shot.id)).size >= 3,
    "One held aim input must emit multiple automatic missiles",
  );
  // Shots follow the damped aim facing: the immediate first shot may leave mid-turn, and once
  // the facing settles on the held screen-right aim (world angle -45 degrees) every later
  // missile shares that straight heading.
  const headingOf = (shot) => Math.atan2(shot.velocity.y, shot.velocity.x);
  const settledAim = -Math.PI / 4;
  const firstSettled = missileShots.findIndex(
    (shot) => Math.abs(headingOf(shot) - settledAim) < 0.000001,
  );
  assert.ok(
    firstSettled >= 0 && missileShots.length - firstSettled >= 2,
    "Held-direction missiles must share the settled aim heading",
  );
  for (const shot of missileShots.slice(firstSettled)) {
    assert.ok(
      Math.abs(headingOf(shot) - settledAim) < 0.000001,
      "Held-direction missiles must retain a straight shared heading once aim settles",
    );
  }
  for (const shot of missileShots) {
    assert.ok(shot.damage > PROTOTYPE.tuning.flight.playerShotDamage);
  }
  const triple = await heldVolley("multiLaser", "bolt", 3);
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
  assert.equal(
    angles.length,
    3,
    "A real level 1 Multi-Laser volley must emit three simultaneous bolts",
  );
  for (const [index, offset] of [-20, 0, 20].entries()) {
    assert.ok(
      Math.abs(angles[index] - angles[1] - offset) < 0.000001,
      "The visible projected level 1 Multi-Laser volley must retain its approved ±20 degree spread",
    );
  }
  const scatter = await heldVolley("scattershot", "dot", 7, true);
  const dots = scatter.flight.shots.filter((shot) => !shot.enemy && shot.projectile === "dot");
  const fading = dots.filter((shot) => shot.life / shot.fade.initialLife < 0.35);
  // Pellets leave the nose of the heading they fired at, so from Ada's centre each lies within
  // the range plus the farthest nose offset of the 16 headings.
  const { noseScreenOffset } = await import(new URL("../src/model/nose.ts", import.meta.url));
  const noseReach = Math.max(
    ...Array.from({ length: 16 }, (_, heading) => {
      const { x, y } = noseScreenOffset(heading);
      return Math.hypot(x, y);
    }),
  );
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
      Math.hypot(dx - dy, (dx + dy) / 2) <= SCREEN.width * 0.5 + noseReach + 0.001,
      "Actual scatter particles must remain inside the half-camera projected range from the nose",
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
  playOpening(cargoModel);
  Object.assign(cargoModel.state.progress[2], { introduced: true, stage: 1, known: ["hub"] });
  ensureDestination(PROTOTYPE, "hub", cargoModel.state.flight);
  cargoModel.teleport("hub");
  cargoModel.state.flight.cargo = 12345;
  const cargoSave = cargoModel.save();
  assert.deepEqual(relaunch(PROTOTYPE, cargoSave).state, cargoModel.state);
  save("cargo-fixture.json", {
    scope: "Canonical wide-cargo deposit UI fixture, not natural mining progression",
    state: JSON.parse(cargoSave),
  });
  await seedOnce(cargoSave, "ada-browser.wide-cargo.v1");
  // Deposit is actionable once the resumed flight is live: the galaxy art its first flight waits
  // on has loaded (the kit's one loading bar is hidden, idle or complete) and the flight has
  // stepped past the seeded save, which the scene writes back each second, with the cargo still
  // aboard. The seeded save alone already reads as this flight before it resumes.
  await page.waitForFunction(
    () => {
      const bar = document.querySelector(".progress-bar");
      return bar !== null && (bar.hidden || getComputedStyle(bar).visibility === "hidden");
    },
    null,
    { timeout: 30000 },
  );
  await page.waitForFunction(
    ({ from, key }) => {
      const state = JSON.parse(localStorage.getItem(key));
      return (
        state.mode === "space" &&
        state.flight?.sector === 2 &&
        state.flight.cargo === 12345 &&
        state.flight.time > from
      );
    },
    { from: cargoModel.state.flight.time, key: storageKey },
    { timeout: 30000 },
  );
  assert.equal(
    await page.locator(".flight-hud").count(),
    0,
    "Wide cargo must not restore the removed information HUD",
  );
  assert.equal(await page.locator(".ada-use").getAttribute("data-use"), "deposit");
  await tapUse(PROTOTYPE.labels.deposit);
  await page.waitForFunction((key) => {
    const state = JSON.parse(localStorage.getItem(key));
    return state.flight.cargo === 0 && state.progress[2].deposited === 12345;
  }, storageKey);
  await page.reload();
  await continueFlight();
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
  playOpening(fixture);
  assert.ok(fixture.state.flight, "The real model must create a valid flight");
  Object.assign(fixture.state.progress[1], {
    stage: 4,
    introduced: true,
    questComplete: true,
    resolved: false,
    questItem: null,
    known: ["growers", "workshop", "salvagers"],
    discoveries: 3,
    holodisk: true,
    opened: true,
  });
  fixture.returnHome();
  assert.equal(fixture.storyView?.page.id, "resolution");
  const serialized = fixture.save();
  save("resolution-fixture.json", {
    scope: "Completed-quest save fixture for home resolution UI boundary only",
    state: JSON.parse(serialized),
  });
  await seedOnce(serialized, "ada-browser.resolution-fixture.v1");
  await page.locator('#game-status[data-mode="home"]').waitFor({ state: "attached" });
  // A launch at home shows the start screen; Continue plays the waiting resolution first.
  await page.locator('[data-action="continue"]').click();
  await contextControlProof(0, "home resolution");
  const choices = page.locator('[data-action="story-choice"]');
  await page.getByText(PROTOTYPE.chapters[1].resolution, { exact: true }).waitFor();
  assert.equal(await choices.count(), 2, "home resolution must offer both real choices");
  await page.screenshot({ path: `${output}/resolution.png` });
  await choices.nth(1).click();
  await page.getByText(PROTOTYPE.chapters[1].resolutionBranches[1], { exact: true }).waitFor();
  await page.locator('.ada-story-panel:not([hidden]) [data-action="story-next"]').click();
  await page.getByText(PROTOTYPE.chapters[1].closing, { exact: true }).waitFor();
  assert.equal(await choices.count(), 0, "The closing is an ordinary page");
  const homePages = await readStory();
  assert.equal(homePages[0]?.text, PROTOTYPE.chapters[1].closing);
  assert.equal(
    homePages[1]?.text,
    PROTOTYPE.chapters[3].opening,
    "Whirlpool's opening follows, second on the route",
  );
  await selector().waitFor({ state: "visible" });
  // The first boarding after the unlock flies the ship from Sunflower to Whirlpool.
  assert.equal(
    (await selector().locator("h2").textContent())?.trim(),
    PROTOTYPE.labels.galaxyNumber.replace("{number}", "1"),
    "The unlock flight starts on Sunflower",
  );
  await page.locator('.ada-route[data-dialog="galaxies"]:not([data-flight])').waitFor();
  assert.equal(
    (await selector().locator("h2").textContent())?.trim(),
    PROTOTYPE.labels.galaxyNumber.replace("{number}", "2"),
    "Galaxy selection opens on the farthest unlocked galaxy, Whirlpool at route position 2",
  );
  assert.equal(
    (await page.locator('[data-action="galaxy-home"]').textContent())?.trim(),
    PROTOTYPE.labels.homeButton,
    "Galaxy selection's Earth button reads Earth",
  );
  await page.screenshot({ path: `${output}/selector-earth.png` });
  assert.equal(
    await page.locator('[data-action="galaxy-jump"]').getAttribute("aria-disabled"),
    null,
    "home resolution must unlock Whirlpool",
  );
  await page.waitForFunction((key) => {
    const state = JSON.parse(localStorage.getItem(key));
    return state?.progress[1].resolved && state.unlocked.includes(3);
  }, storageKey);
  events.checks.push(
    "Fixture-based home resolution, closing and the next opening lead to galaxy selection on " +
      "the newly unlocked galaxy",
  );
  // The route runs left to right along one arc, so Left and Right follow screen order and skip
  // locked galaxies; the galaxy map's close X comes last in Tab order, and Escape returns Ada to
  // her room, as its X and Earth do at boarding.
  const routeMarkers = selector().locator(".ada-route-marker");
  const markerLefts = await routeMarkers.evaluateAll((markers) =>
    markers.map((marker) => marker.getBoundingClientRect().left),
  );
  assert.deepEqual(
    markerLefts,
    [...markerLefts].sort((a, b) => a - b),
    "The markers run left to right in route order",
  );
  assert.equal(
    await selector().locator('[data-action="close-galaxies"]').count(),
    1,
    "The galaxy map has its close X",
  );
  await page.locator('[data-action="galaxy-jump"]').focus();
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement?.dataset.action ?? ""),
    "close-galaxies",
    "The close X follows Jump, last in Tab order",
  );
  await page.screenshot({ path: `${output}/route-map.png` });
  const panelNumber = (number) => PROTOTYPE.labels.galaxyNumber.replace("{number}", number);
  const selectedMarker = () =>
    routeMarkers.evaluateAll((markers) =>
      markers.findIndex((marker) => marker.hasAttribute("data-selected")),
    );
  // The panel switches at the input; the selected ring returns once the ship's move ends.
  const shipRestsOn = (number, message) =>
    page
      .waitForFunction(
        ({ index, label }) => {
          const route = document.querySelector('.ada-route[data-dialog="galaxies"]');
          const markers = [...(route?.querySelectorAll(".ada-route-marker") ?? [])];
          return (
            route?.querySelector("h2")?.textContent?.trim() === label &&
            markers.findIndex((marker) => marker.hasAttribute("data-selected")) === index
          );
        },
        { index: Number(number) - 1, label: panelNumber(number) },
        { timeout: 5000 },
      )
      .then(
        () => true,
        () => false,
      )
      .then((rests) => assert.ok(rests, message));
  // The arrows walk the route wherever focus is on the map; focus starts on Jump.
  await page.locator('[data-action="galaxy-jump"]').focus();
  await page.keyboard.press("ArrowLeft");
  await shipRestsOn("1", "Left moves the ship left on screen, to Sunflower");
  await page.keyboard.press("ArrowRight");
  await shipRestsOn("2", "Right moves the ship right on screen, to Whirlpool");
  // Every galaxy right of Whirlpool is locked, so Right skips them all and the ship stays.
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(500);
  assert.equal(
    (await selector().locator("h2").textContent())?.trim(),
    panelNumber("2"),
    "Right skips locked galaxies",
  );
  assert.equal(await selectedMarker(), 1);
  await page.keyboard.press("Escape");
  await selector().waitFor({ state: "hidden" });
  const escapedRoom = await page
    .locator('.ada-story-background[data-background="adaRoom"]')
    .waitFor({ state: "attached", timeout: 10000 })
    .then(
      () => true,
      () => false,
    );
  assert.ok(escapedRoom, "Escape from galaxy selection shows Ada's room");
  events.checks.push(
    "The galaxy map lays the markers left to right on one arc with its close X last in Tab " +
      "order; Left and Right follow screen order and skip locked galaxies, and Escape returns " +
      "Ada to her room",
  );
  // Canonical save fixtures exercise rendering and restore boundaries, not natural combat progression.
  const [{ enemyCatalog }, { createEnemy, damageEnemy }, { restoreSave }] = await Promise.all([
    import(new URL("../src/data/enemy-catalog.ts", import.meta.url)),
    import(new URL("../src/model/enemy-ai.ts", import.meta.url)),
    import(new URL("../src/model/save.ts", import.meta.url)),
  ]);
  // A claim platform beside Ada in Cartwheel: its hull is in Cartwheel's manifest and its turret
  // and port frames load when it first draws, after that manifest has loaded.
  const claimModel = new GameModel(PROTOTYPE);
  claimModel.state.unlocked = [1, 2];
  claimModel.state.prologueSeen = true;
  claimModel.startSector(2);
  playOpening(claimModel);
  if (claimModel.state.mode !== "space") {
    claimModel.jump();
  }
  {
    const flight = claimModel.state.flight;
    flight.objects = [];
    flight.shots = [];
    const definition = enemyCatalog.platform;
    const at = { x: flight.player.x - 60, y: flight.player.y + 170 };
    const enemy = createEnemy(
      definition,
      { archetype: "platform", id: "browser-claim:platform", packId: null, phase: 0 },
      at,
    );
    flight.objects.push({
      ...at,
      enemy,
      hp: definition.hp,
      id: enemy.id,
      kind: "enemy",
      radius: PROTOTYPE.tuning.flight.shipRadius * definition.sizeRatio,
    });
  }
  await seedOnce(claimModel.save(), "ada-browser.claim-platform.v1");
  // The resource timing buffer holds 250 entries by default, fewer than a flight's art requests;
  // a reload with a larger buffer keeps every request this check reads.
  await page.addInitScript(() => performance.setResourceTimingBufferSize(10000));
  await page.reload();
  await continueFlight();
  await page.waitForFunction(
    () =>
      [
        "/art/cartwheel/enemies/platform.svg",
        "/art/cartwheel/enemies/platform-port-intact-0.svg",
      ].every((path) =>
        performance.getEntriesByType("resource").some(({ name }) => name.endsWith(path)),
      ),
    null,
    { timeout: 30000 },
  );
  events.checks.push(
    "A Cartwheel flight loads the claim platform's hull and, once Cartwheel's manifest has loaded, " +
      "its part frames",
  );
  const [
    { ASTEROID_ART, readAsteroidCatalog },
    asteroidArt,
    { orbitMotion },
    { DEVICE_STORAGE_KEYS },
  ] = await Promise.all([
    import(new URL("../src/data/asteroid-catalog.ts", import.meta.url)),
    import(new URL("../src/game/asteroid-art.ts", import.meta.url)),
    import(new URL("../src/model/asteroids.ts", import.meta.url)),
    import(new URL("../src/ui/device-settings.ts", import.meta.url)),
  ]);
  const asteroidResponse = await page.request.get("http://ada-preview:4173/art/asteroids.json");
  assert.equal(asteroidResponse.status(), 200, "Art's asteroid catalog must be served");
  const rockArt = readAsteroidCatalog(await asteroidResponse.json());
  assert.ok(rockArt, "Art's asteroid catalog must read as version 1");
  const toScreen = (world) => ({ x: 360 + world.x - world.y, y: 180 + (world.x + world.y) / 2 });
  // The first flight seed whose backdrop field shows a rock in the asteroid fixture's open
  // top-centre area, clear of its play rocks (shown), or none in view at all. Backdrop rocks lie
  // in their layer, about the camera's world position times the rocks' parallax (art/backdrop.md).
  const rockParallax = (
    await (await page.request.get("http://ada-preview:4173/art/backdrop.json")).json()
  ).debris.rocks.parallax;
  function backdropSeed(shown, player) {
    const { cell } = asteroidArt.BACKDROP_FIELD;
    const camera = { x: player.x * rockParallax, y: player.y * rockParallax };
    const cx = Math.floor(camera.x / cell);
    const cy = Math.floor(camera.y / cell);
    for (let seed = 1; seed < 2000; seed++) {
      let near = false;
      let visible = false;
      for (let x = cx - 4; x <= cx + 4; x++) {
        for (let y = cy - 4; y <= cy + 4; y++) {
          const rock = asteroidArt.backdropRock(rockArt, seed, x, y);
          if (rock) {
            const at = toScreen({ x: rock.x - camera.x, y: rock.y - camera.y });
            near ||= at.x > 250 && at.x < 340 && at.y > 70 && at.y < 140;
            visible ||= at.x > -120 && at.x < 840 && at.y > -80 && at.y < 440;
          }
        }
      }
      if (shown ? near : !visible) {
        return seed;
      }
    }
    throw new Error(`No backdrop seed ${shown ? "shows" : "hides"} a rock near Ada`);
  }
  // Live capitals keep a viewport-sized gap, so each large enemy renders from its own canonical
  // save at the offset its sampled screen region expects.
  function combatFixture(archetype, offset, missile) {
    const combat = new GameModel(PROTOTYPE);
    combat.startSector(1);
    playOpening(combat);
    assert.ok(combat.state.flight, "Combat fixture requires a canonical flight");
    const flight = combat.state.flight;
    combat.state.progress[1].introduced = true;
    combat.state.dialogue = null;
    flight.objects = [];
    flight.shots = [];
    // No backdrop rock in view, so the sampled regions see only the combat and empty space.
    flight.seed = backdropSeed(false, flight.player);
    const origin = { ...flight.player };
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
    if (missile) {
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
    }
    const serialized = combat.save();
    assert.deepEqual(restoreSave(serialized), combat.state, "Canonical restore accepts combat");
    assert.deepEqual(relaunch(PROTOTYPE, serialized).state, combat.state);
    return serialized;
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  const paletteResponse = await page.request.get("http://ada-preview:4173/art/space-palette.json");
  assert.equal(paletteResponse.status(), 200, "Approved space palette must be served");
  const { colors: approvedColors } = await paletteResponse.json();
  // In flight, space takes the galaxy's field colours; the combat fixtures fly in galaxy one.
  const galaxiesResponse = await page.request.get("http://ada-preview:4173/art/galaxies.json");
  assert.equal(galaxiesResponse.status(), 200, "Approved galaxy fields must be served");
  const { galaxies: galaxyFields } = await galaxiesResponse.json();
  const paletteColors = {
    ...approvedColors,
    ...galaxyFields.sunflower.colors,
  };
  // Empty space shows galaxy one's backdrop layers (art/backdrop.md): each channel within its sky
  // ends and plate steps, give or take a darker plate over the darker sky.
  const backdropResponse = await page.request.get(
    "http://ada-preview:4173/art/sunflower/backdrop.json",
  );
  assert.equal(backdropResponse.status(), 200, "Galaxy one's backdrop must be served");
  const sunflowerBackdrop = await backdropResponse.json();
  const backdropTones = [
    sunflowerBackdrop.sky.from,
    sunflowerBackdrop.sky.to,
    ...sunflowerBackdrop.plates.steps.map((step) => step.color),
  ].map((hex) => [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)));
  const backdropBox = [0, 1, 2].map((channel) => [
    Math.min(...backdropTones.map((tone) => tone[channel])) - 12,
    Math.max(...backdropTones.map((tone) => tone[channel])) + 12,
  ]);
  const combatSnapshots = {};
  const pixels = {};
  const heavyColors = {
    hull: "#d68b72",
    scorch: "#5c3a31",
    turretTop: "#c27a62",
  };
  // A new hull faces up, heading 12; its disabled engine's base centres on that heading's anchor.
  const capitalLayout = await (
    await page.request.get("http://ada-preview:4173/art/enemies/capital-hardpoints.json")
  ).json();
  const disabledAnchor = capitalLayout.headings[12].hardpoints.find(
    (part) => part.id === "engine-left",
  ).anchor;
  const capitalScale = 210 / capitalLayout.frame;
  async function renderCombatView(view) {
    const serialized = combatFixture(view.archetype, view.offset, view.missile);
    const seeded = view.missile ? " and a seeded missile" : "";
    save(`combat-fixture-${view.archetype}.json`, {
      scope: [
        `Real-model save fixture with damaged hardpoints${seeded}`,
        "render/restore proof only, not natural encounter or combat completion",
      ].join("; "),
      state: JSON.parse(serialized),
    });
    await seedOnce(serialized, `ada-browser.combat-fixture-${view.archetype}.v1`);
    await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
    await page.waitForFunction(
      ({ archetype, key, missile }) => {
        const current = JSON.parse(localStorage.getItem(key))?.flight;
        return (
          current?.objects.some(
            (object) =>
              object.enemy?.archetype === archetype &&
              object.enemy.hardpoints.some((part) => part.hp === 0) &&
              object.enemy.hardpoints.some((part) => part.hp > 0),
          ) &&
          (!missile || current.shots.some((shot) => shot.enemy && shot.projectile === "missile"))
        );
      },
      { archetype: view.archetype, key: storageKey, missile: view.missile },
    );
    combatSnapshots[view.archetype] = await readSave();
    const canvas = page.locator("#game-canvas > canvas");
    await canvas.waitFor({ state: "visible" });
    // The pixel regions sample the canvas alone; the conversation box and notices draw over it.
    const showOverCanvas = await hideOverCanvas(page);
    const intrinsic = await canvas.evaluate(logicalSize);
    // A heavy's part frames load once it is in flight, so sample until its turret tops show.
    async function sampleUntilComposed(remaining) {
      const sampled = await sampleCombatView(view, canvas, intrinsic);
      Object.assign(pixels, sampled);
      if (view.composed && sampled.capital.counts.turretTop <= 20 && remaining > 0) {
        await page.waitForTimeout(250);
        await sampleUntilComposed(remaining - 1);
      }
    }
    await sampleUntilComposed(20);
    await showOverCanvas();
  }
  async function sampleCombatView(view, canvas, intrinsic) {
    const combatImage = await canvas.screenshot({
      path: `${output}/combat-canvas-${view.archetype}.png`,
    });
    return page.evaluate(
      async ({ backdropBox, disabled, encoded, heavyColors, intrinsic, names, paletteColors }) => {
        const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
        const sample = document.createElement("canvas");
        sample.width = bitmap.width;
        sample.height = bitmap.height;
        const drawing = sample.getContext("2d");
        drawing.drawImage(bitmap, 0, 0);
        bitmap.close();
        // Projection is anchored to logical SCREEN center (360,180), even when the view is taller.
        const regions = {
          // The 5-width capital centres at (180, 180); its disabled left engine at its anchor.
          capital: { x: 90, y: 130, width: 180, height: 100 },
          missile: { x: 510, y: 65, width: 65, height: 55 },
          disabled: { x: disabled.x - 15, y: disabled.y - 15, width: 30, height: 30 },
          background: { x: 280, y: 280, width: 160, height: 60 },
        };
        return Object.fromEntries(
          names
            .map((name) => [name, regions[name]])
            .map(([name, region]) => {
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
                  ...Object.keys(heavyColors),
                ].map((role) => {
                  const hex = paletteColors[role] ?? heavyColors[role];
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
              counts.backdrop = 0;
              const outline = {
                minX: Infinity,
                maxX: -Infinity,
                minY: Infinity,
                maxY: -Infinity,
              };
              for (let offset = 0; offset < image.data.length; offset += 4) {
                if (
                  backdropBox.every(
                    ([low, high], index) =>
                      image.data[offset + index] >= low && image.data[offset + index] <= high,
                  )
                ) {
                  counts.backdrop++;
                }
                for (const [role, rgb] of Object.entries(colors)) {
                  // Small channel tolerance permits raster rounding without accepting another palette class.
                  if (
                    rgb.every(
                      (channel, index) => Math.abs(image.data[offset + index] - channel) <= 3,
                    )
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
      {
        backdropBox,
        disabled: {
          x: 180 + (disabledAnchor[0] - capitalLayout.frame / 2) * capitalScale,
          y: 180 + (disabledAnchor[1] - capitalLayout.frame / 2) * capitalScale,
        },
        encoded: combatImage.toString("base64"),
        heavyColors,
        intrinsic,
        names: view.names,
        paletteColors,
      },
    );
  }
  await renderCombatView({
    archetype: "capital",
    composed: true,
    missile: true,
    names: ["capital", "missile", "background", "disabled"],
    offset: { x: -90, y: 90 },
  });
  assert.ok(
    pixels.capital.counts.hull > pixels.capital.area * 0.15,
    "Large enemy must draw Art's coral hull",
  );
  assert.ok(
    pixels.capital.counts.turretTop > 20,
    "Large enemy must draw Art's aimed turret tops on its live turrets",
  );
  assert.ok(
    pixels.disabled.counts.scorch > 100,
    "Disabled capital engine must draw Art's scorched wreck",
  );
  assert.ok(
    pixels.missile.counts.obstacle > 2 && pixels.missile.outlineSpan.y > 2,
    "Seeded missile must contain coral projectile geometry",
  );
  assert.ok(
    pixels.background.counts.backdrop > pixels.background.area * 0.9,
    "Empty space must render galaxy one's backdrop tones rather than the monochrome fallback",
  );
  await page.screenshot({ path: `${output}/combat.png` });
  save("combat-proof.json", {
    scope: "Rendered canonical combat fixture; screenshot review required for visual correctness",
    states: combatSnapshots,
    canvas: await page.locator("#game-canvas > canvas").boundingBox(),
    capitalSizeRatio: enemyCatalog.capital.sizeRatio,
    pixels,
    paletteColors,
  });
  events.checks.push(
    "Canonical combat save restores a capital, partial hardpoint damage " +
      "and missile with Art's composed frames in renderer screenshots",
  );

  // Art review captures (art/asteroids.md): one rock of each size and a drifting rock around
  // Ada in each galaxy, with a backdrop rock in view, and galaxy one's spin over four seconds.
  // Pivots sit at rock bases, so each rock rises above its point; the top centre stays open.
  const ROCK_SCREEN = {
    small: { x: -280, y: -110 },
    medium: { x: -230, y: 120 },
    large: { x: -40, y: 165 },
    huge: { x: 235, y: 150 },
  };
  const toWorld = (screen) => ({ x: screen.x / 2 + screen.y, y: screen.y - screen.x / 2 });
  function asteroidFixture(sector, drifting = true) {
    const model = new GameModel(PROTOTYPE);
    model.state.unlocked = [1, 2, 3];
    model.startSector(sector);
    playOpening(model);
    assert.ok(model.state.flight, `Asteroid fixture requires galaxy ${sector}'s flight`);
    const flight = model.state.flight;
    model.state.progress[sector].introduced = true;
    model.state.dialogue = null;
    flight.objects = [];
    flight.shots = [];
    flight.seed = backdropSeed(true, flight.player);
    const origin = { ...flight.player };
    for (const [size, screen] of Object.entries(ROCK_SCREEN)) {
      const art = ASTEROID_ART.asteroids.find((entry) => entry.size === size);
      const offset = toWorld(screen);
      flight.objects.push({
        asteroid: art.id,
        hp: 99,
        id: `browser-rock:${size}`,
        kind: "rock",
        radius: art.footprintRadius,
        x: origin.x + offset.x,
        y: origin.y + offset.y,
      });
    }
    const small = ASTEROID_ART.asteroids.find((entry) => entry.size === "small");
    const centre = toWorld({ x: -200, y: -130 });
    // Adding 0 turns -0 into 0, which a save's JSON round-trip would otherwise change.
    const orbit = {
      phase: 0 - 0.3 * flight.time,
      radius: 30,
      rate: 0.3,
      x: origin.x + centre.x,
      y: origin.y + centre.y,
    };
    const motion = orbitMotion(flight.time, orbit);
    if (drifting) {
      flight.objects.push({
        asteroid: small.id,
        hp: 99,
        id: "browser-rock:drifting",
        kind: "rock",
        orbit,
        radius: small.footprintRadius,
        velocity: { x: motion.velocity.x + 0, y: motion.velocity.y + 0 },
        x: motion.position.x + 0,
        y: motion.position.y + 0,
      });
    }
    const serialized = model.save();
    assert.deepEqual(restoreSave(serialized), model.state, "Canonical restore accepts rocks");
    return serialized;
  }
  async function stonePixels(image, ramps) {
    return page.evaluate(
      async ({ encoded, ramps }) => {
        const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
        const sample = document.createElement("canvas");
        sample.width = bitmap.width;
        sample.height = bitmap.height;
        const drawing = sample.getContext("2d");
        drawing.drawImage(bitmap, 0, 0);
        bitmap.close();
        const data = drawing.getImageData(0, 0, sample.width, sample.height).data;
        const rgb = (hex) =>
          [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
        return Object.fromEntries(
          Object.entries(ramps).map(([name, colors]) => {
            const targets = colors.map(rgb);
            let count = 0;
            for (let offset = 0; offset < data.length; offset += 4) {
              if (
                targets.some((target) =>
                  target.every((channel, index) => Math.abs(data[offset + index] - channel) <= 3),
                )
              ) {
                count++;
              }
            }
            return [name, count];
          }),
        );
      },
      { encoded: image.toString("base64"), ramps },
    );
  }
  const asteroidCaptures = {};
  async function captureRocks(sector, name) {
    const tint = asteroidArt.backdropTint(rockArt, sector);
    // The ramps sample the canvas alone; the conversation box and notices draw over it.
    const showOverCanvas = await hideOverCanvas(page);
    const image = await page
      .locator("#game-canvas > canvas")
      .screenshot({ path: `${output}/${name}` });
    await showOverCanvas();
    const ramps = { backdrop: [tint.backdropLit, tint.backdropSide], stone: rockArt.stone };
    const pixels = await stonePixels(image, ramps);
    asteroidCaptures[sector].push({ name, pixels });
    return pixels;
  }
  async function captureGalaxy(sector) {
    const serialized = asteroidFixture(sector);
    save(`asteroid-fixture-${sector}.json`, {
      scope: "Canonical rock layout for Art review of sprites, drift chips and the backdrop field",
      state: JSON.parse(serialized),
    });
    await seedOnce(serialized, `ada-browser.asteroid-fixture-${sector}.v1`);
    await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
    // Rock frames load after the scene starts; placeholders draw until they all arrive.
    await page
      .locator('#game-status[data-asteroids="art"]')
      .waitFor({ state: "attached", timeout: 30000 });
    await page.waitForFunction(
      (key) =>
        JSON.parse(localStorage.getItem(key))?.flight?.objects.some((object) =>
          object.id.startsWith("browser-rock:"),
        ),
      storageKey,
    );
    await page.locator("#game-canvas > canvas").waitFor({ state: "visible" });
    asteroidCaptures[sector] = [];
    const first = await captureRocks(sector, `asteroids-galaxy-${sector}.png`);
    assert.ok(first.stone > 2000, `Galaxy ${sector} must draw Art's stone rocks`);
    assert.ok(first.backdrop > 20, `Galaxy ${sector} must draw its tinted backdrop rocks`);
  }
  await captureGalaxy(1);
  // Small and medium rocks turn 4 to 18 degrees a second: 15 degree frames change within seconds.
  await page.waitForTimeout(2000);
  await captureRocks(1, "asteroids-spin-1.png");
  await page.waitForTimeout(2000);
  await captureRocks(1, "asteroids-spin-2.png");
  await captureGalaxy(2);
  await captureGalaxy(3);
  // Art's footprint overlay: still rocks under reduced motion, so each draws and collides with
  // frame 0; each rock's footprint is outlined over the sprite, with its pivot marked.
  const reducedKey = DEVICE_STORAGE_KEYS.reducedMotion;
  await page.evaluate((key) => localStorage.setItem(key, "on"), reducedKey);
  const overlayFixture = asteroidFixture(1, false);
  await seedOnce(overlayFixture, "ada-browser.asteroid-overlay.v1");
  await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
  await page
    .locator('#game-status[data-asteroids="art"]')
    .waitFor({ state: "attached", timeout: 30000 });
  const overlayCanvas = page.locator("#game-canvas > canvas");
  await overlayCanvas.waitFor({ state: "visible" });
  const overlayImage = await overlayCanvas.screenshot();
  const overlayState = await readSave();
  const outlines = overlayState.flight.objects
    .filter((object) => object.id.startsWith("browser-rock:"))
    .map((object) => {
      const at = toScreen({
        x: object.x - overlayState.flight.player.x,
        y: object.y - overlayState.flight.player.y,
      });
      const outline = asteroidArt.footprintOutline(asteroidArt.rockArt(object.asteroid), 0);
      return {
        at,
        edges: outline.edges.map(([start, end]) => [
          { x: at.x + start.x, y: at.y + start.y },
          { x: at.x + end.x, y: at.y + end.y },
        ]),
        id: object.asteroid,
      };
    });
  const overlayIntrinsic = await overlayCanvas.evaluate(logicalSize);
  const overlayPng = await page.evaluate(
    async ({ encoded, intrinsic, outlines }) => {
      const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const sample = document.createElement("canvas");
      sample.width = bitmap.width;
      sample.height = bitmap.height;
      const drawing = sample.getContext("2d");
      drawing.drawImage(bitmap, 0, 0);
      bitmap.close();
      const scale = sample.width / intrinsic.width;
      const left = Math.max(0, (intrinsic.width - 720) / 2);
      const map = (point) => [(point.x + left) * scale, point.y * scale];
      drawing.lineWidth = 2;
      drawing.strokeStyle = "#ff00ff";
      drawing.fillStyle = "#ff00ff";
      for (const outline of outlines) {
        drawing.beginPath();
        for (const [start, end] of outline.edges) {
          drawing.moveTo(...map(start));
          drawing.lineTo(...map(end));
        }
        drawing.stroke();
        const [x, y] = map(outline.at);
        drawing.fillRect(x - 3, y - 3, 6, 6);
      }
      return sample.toDataURL("image/png").split(",")[1];
    },
    { encoded: overlayImage.toString("base64"), intrinsic: overlayIntrinsic, outlines },
  );
  writeFileSync(`${output}/asteroids-footprints.png`, Buffer.from(overlayPng, "base64"));
  await page.evaluate((key) => localStorage.removeItem(key), reducedKey);
  save("asteroid-art-proof.json", {
    scope: "Rendered canonical rock fixtures; screenshot review by Art required",
    captures: asteroidCaptures,
    footprints: {
      image: "asteroids-footprints.png",
      rocks: outlines.map(({ at, id }) => ({ id, pivot: at })),
      scope: "Frame 0 footprints in magenta over the sprites, under reduced motion",
    },
  });
  events.checks.push(
    "Art's rocks draw in neutral stone in every galaxy over a tinted backdrop field, with spin " +
      "captures for review",
  );

  // At 844x390 the Settings card fits the view with every row's note: the Move and Aim controls
  // rows carry the same note element as Sound's.
  const settingsViewport = page.viewportSize();
  await page.setViewportSize({ width: 844, height: 390 });
  await openSettings();
  const notes = await page
    .locator(".ada-row[data-setting]")
    .evaluateAll((rows) =>
      rows.map((row) => [row.dataset.setting, row.querySelector(".ada-setting-note")?.textContent]),
    );
  for (const setting of ["move", "aim"]) {
    assert.deepEqual(
      notes.find(([key]) => key === setting),
      [setting, PROTOTYPE.labels.controlsNote],
      `${setting} controls row notes that touch still works when hidden`,
    );
  }
  assert.deepEqual(
    notes.find(([key]) => key === "sound"),
    ["sound", PROTOTYPE.labels.soundNote],
    "Sound keeps its note in the same element",
  );
  // The Move and Aim controls rows show Art's control icons, nearest-neighbour.
  const stickIcons = await page.locator(".ada-row[data-setting]").evaluateAll((rows) =>
    rows
      .filter((row) => ["move", "aim"].includes(row.dataset.setting))
      .map((row) => {
        const icon = row.querySelector(".ada-icon");
        const style = getComputedStyle(icon);
        return [
          row.dataset.setting,
          icon.dataset.icon,
          /\/art\/ui\/sprites\/icon-(?:move|aim)-controls\.png/u.test(style.backgroundImage),
          style.imageRendering,
        ];
      }),
  );
  assert.deepEqual(stickIcons, [
    ["move", "icon-move-controls", true, "pixelated"],
    ["aim", "icon-aim-controls", true, "pixelated"],
  ]);
  await page
    .locator('.ada-row[data-setting="move"]')
    .screenshot({ path: `${output}/settings-move-row.png` });
  await page
    .locator('.ada-row[data-setting="aim"]')
    .screenshot({ path: `${output}/settings-aim-row.png` });
  const settingsFit = await page.locator('[data-action="close-settings"]').evaluate((close) => {
    const card = close.closest(".ada-card-frame") ?? close.parentElement;
    const box = card.getBoundingClientRect();
    const body = card.querySelector(".ada-card-body");
    return {
      inside:
        box.top >= -0.5 &&
        box.left >= -0.5 &&
        box.bottom <= window.innerHeight + 0.5 &&
        box.right <= window.innerWidth + 0.5,
      overflow: body ? body.scrollHeight - body.clientHeight : 0,
    };
  });
  assert.ok(
    settingsFit.inside && settingsFit.overflow <= 1,
    `The Settings card fits 844x390 with the controls notes: ${JSON.stringify(settingsFit)}`,
  );
  await closeSettings();
  if (settingsViewport) {
    await page.setViewportSize(settingsViewport);
  }
  await openSettings();
  const toggles = [];
  async function toggleSetting(key) {
    const label = PROTOTYPE.labels[key];
    assert.equal(typeof label, "string", `Canonical ${key} settings label must exist`);
    const checkbox = page.getByRole("switch", { name: label, exact: true });
    await checkbox.waitFor({ state: "visible" });
    const initial = await checkbox.isChecked();
    await checkbox.setChecked(!initial);
    assert.equal(await checkbox.isChecked(), !initial, `${key} must toggle`);
    toggles.push({ key, initial, toggled: !initial });
  }
  await toggleSetting("moveControls");
  await toggleSetting("aimControls");
  await toggleSetting("sound");
  await toggleSetting("reducedMotion");
  await page.screenshot({ path: `${output}/combat-settings.png` });
  await closeSettings();
  await openSettings();
  async function restoreSetting({ initial, key, toggled }) {
    const checkbox = page.getByRole("switch", { name: PROTOTYPE.labels[key], exact: true });
    assert.equal(await checkbox.isChecked(), toggled, `${key} survives dialog reopening`);
    await checkbox.setChecked(initial);
  }
  await restoreSetting(toggles[0]);
  await restoreSetting(toggles[1]);
  await restoreSetting(toggles[2]);
  await restoreSetting(toggles[3]);
  await closeSettings();
  save("combat-settings-proof.json", {
    scope:
      "Checkbox interaction and dialog-state proof only; audio output and shake intensity unmeasured",
    toggles,
  });
  events.checks.push(
    "Canonical joystick, sound and reduced-motion controls toggle and retain dialog state",
  );
  // One renderer at a time keeps the run inside the container's memory ceiling.
  await context.close();
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
  await portraitContext.addInitScript(reportViolations);
  await portraitContext.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: storageKey,
    value: safeSerialized,
  });
  page = await portraitContext.newPage();
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(15000);
  observe(page);
  assert.equal((await page.goto("http://ada-preview:4173/")).status(), 200);
  await page.locator("body.site").waitFor({ state: "visible" });
  assert.equal(await page.locator("#game-canvas").count(), 0);
  assert.equal(
    await page.locator("body").evaluate((body) => getComputedStyle(body).transform),
    "none",
    "The mobile website must remain upright before entering the landscape game",
  );
  await page.screenshot({ path: `${output}/site-mobile.png` });
  // The landing page's Mobile line names each control and follows it with the game's icon.
  const mobileLine = page.locator(".site-controls li p").first();
  assert.equal(
    await mobileLine.textContent(),
    "Move with the left stick. Aim and fire with the right stick. Tap Use to interact.",
  );
  assertInlineIcons(
    await mobileLine.evaluate(measureInlineIcons),
    ["move", "aim", "use"],
    1,
    22.4,
    "The landing page's Mobile line",
  );
  await page.locator(".site-controls").screenshot({ path: `${output}/site-controls.png` });
  events.checks.push("The landing page's Mobile line shows each named control's icon");
  await Promise.all([
    page.waitForURL("**/play/"),
    page.locator('a[href="/play/"]').first().click(),
  ]);
  events.checks.push("Mobile website stays upright and its Play link enters the rotated game");
  await continueFlight();
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
    const pause = document.querySelector('[data-action="pause"]').getBoundingClientRect();
    const canvas = document.querySelector("#game-canvas > canvas").getBoundingClientRect();
    const inverse = new DOMMatrixReadOnly(getComputedStyle(document.body).transform).inverse();
    const relative = new DOMPoint(
      weapon.x + weapon.width / 2 - pause.x - pause.width / 2,
      weapon.y + weapon.height / 2 - pause.y - pause.height / 2,
      0,
      0,
    ).matrixTransform(inverse);
    return {
      rightOfPause: relative.x,
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
    turnedControls.rightOfPause > 0 && Math.abs(turnedControls.rowOffset) < 16,
    "Turned weapon selector must sit right of the pause button on the same landscape row",
  );
  assert.ok(
    turnedControls.insideCanvas,
    "Turned weapon button must remain inside the visible canvas",
  );
  assert.equal(turnedControls.accessibleName, PROTOTYPE.labels.weaponBasic);
  save("portrait-weapon-alignment.json", turnedControls);
  const portraitBefore = await position();
  const portraitBounds = await Promise.all(
    ["move", "aim"].map((side) => settledBox(`[data-control="${side}-joystick"]`)),
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
  await openSettings();
  await page
    .getByRole("switch", { name: PROTOTYPE.labels.sound, exact: true })
    .waitFor({ state: "visible" });
  await page
    .getByRole("switch", { name: PROTOTYPE.labels.reducedMotion, exact: true })
    .waitFor({ state: "visible" });
  await page.screenshot({ path: `${output}/portrait-settings.png` });
  await closeSettings();
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
  // A save from a newer version: the start screen offers no action, the save stays as it was
  // through the page hiding, and the update is required, the loading bar travelling while it
  // downloads or the update-required message while it cannot. The kit's own update attempts and
  // reloads are the point here, so only this page's CSP violations count as errors.
  await portraitContext.close();
  const newerSaved = JSON.stringify({ marker: "from a newer build", mode: "home", version: 2 });
  const newerContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await newerContext.addInitScript(reportViolations);
  await newerContext.addInitScript(
    ({ key, value }) => {
      if (!sessionStorage.getItem("ada-smoke.newer-seeded")) {
        sessionStorage.setItem("ada-smoke.newer-seeded", "1");
        localStorage.setItem(key, value);
      }
    },
    { key: storageKey, value: newerSaved },
  );
  await newerContext.route("**/*", previewOnly);
  page = await newerContext.newPage();
  page.on("console", (message) => {
    if (message.text().startsWith("CSP violation")) {
      events.errors.push(message.text());
    }
  });
  await page.goto("http://ada-preview:4173/play/");
  await page.locator(".ada-start").waitFor({ state: "visible" });
  await page.waitForFunction(
    (label) =>
      document.querySelector(".ada-start-note")?.textContent === label ||
      document.querySelector(".progress-bar:not([hidden])") !== null,
    PROTOTYPE.labels.updateRequired,
    { timeout: 15000 },
  );
  const newerStart = await page.evaluate(() => ({
    actions: document.querySelectorAll(".ada-start-actions > button").length,
    note: document.querySelector(".ada-start-note")?.textContent ?? null,
  }));
  assert.equal(newerStart.actions, 0, "A newer save keeps Start closed");
  assert.ok(
    newerStart.note === null || newerStart.note === PROTOTYPE.labels.updateRequired,
    "A newer save shows only Gameplay's update-required message",
  );
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pagehide"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  assert.equal(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
    newerSaved,
    "A newer save is never overwritten",
  );
  await page.screenshot({ path: `${output}/newer-save.png` });
  events.checks.push("A newer save keeps Start closed and its save, and requires the update");
  await newerContext.close();
  // A 2404x1080 phone at device pixel ratio 2.5, in whole CSS px (962x432 is 2405x1080), on touch.
  const phoneContext = await browser.newContext({
    deviceScaleFactor: 2.5,
    hasTouch: true,
    isMobile: true,
    viewport: { height: 432, width: 962 },
  });
  await phoneContext.addInitScript(reportViolations);
  await phoneContext.route("**/*", previewOnly);
  await phoneContext.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: storageKey,
    value: safeSerialized,
  });
  page = await phoneContext.newPage();
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(15000);
  observe(page);
  assert.equal((await page.goto("http://ada-preview:4173/play/")).status(), 200);
  await continueFlight();
  const phoneHud = await touchHudProof("2404x1080");
  assert.equal(phoneHud.dpr, 2.5, "The phone context renders at device pixel ratio 2.5");
  events.checks.push("At 2404x1080 dpr 2.5 the sticks' rings sit 40 in, the pill level");
  await phoneContext.close();
  // A crash: the kit's crash screen over the game, in the game's words, with the build label in
  // the dev details, and the last save kept through the page hiding. The thrown error is the point
  // here, so only this page's CSP violations count as errors.
  const crashContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await crashContext.addInitScript(reportViolations);
  await crashContext.route("**/*", previewOnly);
  page = await crashContext.newPage();
  page.on("console", (message) => {
    if (message.text().startsWith("CSP violation")) {
      events.errors.push(message.text());
    }
  });
  // Exit: a browser tab offers it, at the far top right of the start screen after Achievements
  // and Settings, a small button's gap from Settings; Q leaves for the site's home page.
  await page.goto("http://ada-preview:4173/play/");
  await page.locator('[data-action="exit"]').waitFor({ state: "visible" });
  const navDiscs = await page.evaluate(() =>
    ["achievements", "settings", "exit"].map((action) => {
      const button = document.querySelector(`[data-action="${action}"]`);
      const disc = button?.querySelector(".ada-disc")?.getBoundingClientRect();
      return {
        label: button?.getAttribute("aria-label"),
        left: disc?.left ?? 0,
        right: disc?.right ?? 0,
        tab: [...document.querySelectorAll("button")].indexOf(button),
      };
    }),
  );
  const navUnit = await page
    .locator("#app")
    .evaluate((app) => Number(getComputedStyle(app).getPropertyValue("--ada-unit")));
  assert.equal(navDiscs[2].label, PROTOTYPE.labels.exit, "Exit is named from Gameplay's string");
  assert.equal(
    glyphUrl(
      await page
        .locator('[data-action="exit"]')
        .evaluate((button) => getComputedStyle(button).getPropertyValue("--glyph").trim()),
    ),
    "url(/art/ui/icons/exit.svg)",
    "Exit draws Art's vector door, the same mask mechanism as Settings",
  );
  assert.ok(
    navDiscs[0].tab < navDiscs[1].tab && navDiscs[1].tab < navDiscs[2].tab,
    "The start screen tabs Achievements, Settings, then Exit",
  );
  for (const [left, right] of [
    [navDiscs[0], navDiscs[1]],
    [navDiscs[1], navDiscs[2]],
  ]) {
    assert.ok(
      Math.abs((right.left - left.right) / navUnit - 24) < 0.1,
      "The start screen's discs sit a small button's gap apart, Exit rightmost",
    );
  }
  await page.keyboard.press("KeyQ");
  await page.waitForURL("http://ada-preview:4173/");
  events.checks.push("A Chromium tab shows Exit at the start screen's far top right; Q goes home");
  await page.goto("http://ada-preview:4173/play/?dev=1");
  await page.locator('[data-action="start"]').waitFor({ state: "visible" });
  const savedBeforeCrash = await page.evaluate((key) => localStorage.getItem(key), storageKey);
  assert.ok(savedBeforeCrash, "The game has saved before the crash");
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error("Smoke crash");
    });
  });
  await page.locator(".crash").waitFor({ state: "visible" });
  const { CRASH_COPY } = await import(new URL("../src/data/crash-copy.ts", import.meta.url));
  const crashScreen = await page.locator(".crash").evaluate((screen) => ({
    body: screen.querySelector(".crash-body")?.textContent,
    details: screen.querySelector(".crash-stack")?.textContent ?? "",
    focused: document.activeElement?.textContent,
    role: screen.getAttribute("role"),
    title: screen.querySelector(".crash-title")?.textContent,
  }));
  const { version: crashVersion } = JSON.parse(readFileSync("/source/package.json", "utf8"));
  const crashCommit = process.env.CHECK_REVISION?.slice(0, 8) ?? "dev";
  assert.deepEqual(
    {
      ...crashScreen,
      details: crashScreen.details.split("\n").slice(0, 2),
    },
    {
      body: CRASH_COPY.body,
      details: [`v${crashVersion} · ${crashCommit}`, "Error: Smoke crash"],
      focused: CRASH_COPY.reload,
      role: "alertdialog",
      title: CRASH_COPY.title,
    },
    "A crash shows the crash screen with the build label and the error",
  );
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pagehide"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  assert.equal(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
    savedBeforeCrash,
    "A crash keeps the last save as the page hides",
  );
  await page.screenshot({ path: `${output}/crash-screen.png` });
  events.checks.push("A crash shows the kit's crash screen and keeps the last save");
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
