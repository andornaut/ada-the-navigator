# Architecture and Development

## Platform

- **Stack:** Phaser 4, TypeScript and Vite.
- **Hosting:** Cloudflare Workers static assets, no Worker script (`wrangler.jsonc`).
- **Targets:** landscape phone browsers with twin touch joysticks, and desktop browsers with keyboard controls.
- **Tooling:** Node 24.22.2, Vitest, ESLint with the shared house rules, Prettier, markdownlint, Dependabot, and the Test and AI attributions workflows.

## Site

Vite builds the HTML inputs in [`pages/`](../pages/) and serves the landing page at
`/` and the game at `/play/`. [`vite.config.ts`](../vite.config.ts) uses game-kit's
`gameViteConfig` (`@andornaut/game-kit/build/gameConfig`) with the plugin
inputs in [`src/build/index.ts`](build/index.ts): the
dev server's `/play` redirect (`sitePages`), hashed icons and the service worker's
precache. See [development](../docs/development.md) for local build and delivery links.

## Architecture

Player-facing rules live in the [gameplay rules](../gameplay/rules.md); this section
describes their implementation.

### Source layout

- **Entry:** [`src/loading/bootstrap.ts`](loading/bootstrap.ts) starts phone launch
  and the loading UI before importing [`src/main.ts`](main.ts), which creates
  the Phaser game at the 720 × 360 base view in device pixels.
  [`src/lifecycle.ts`](lifecycle.ts) sleeps the game loop while the page is hidden.
- **Model:** [`src/model/`](model/) holds the Phaser-free game state (`GameModel`),
  flight, combat, economy and stories. It defines the save schema and restore
  port in [`saveSchema.ts`](model/saveSchema.ts).
- **Saving:** [`src/saving/index.ts`](saving/index.ts) exposes the save codec,
  integrity checks and browser store, and supplies the Model restore port.
- **Data:** [`src/data/`](data/) holds the authored content: galaxies, ships,
  weapons, enemies, story pages, conversations and the base view (`screen.ts`).
- **Game:** [`src/game/`](game/) holds the play scene (`scene.ts`), the
  `scene*.ts` modules it delegates to (assets, interface, backdrop, objects,
  enemies, world, HUD, effects, jump and sprites), its cameras and touch chrome.
- **Art adapters:** [`src/art/index.ts`](art/index.ts) exposes Phaser-free
  helpers for scenery, sprite keys, stations, weapons and other scene art.
  Some Phaser-free helpers remain in `src/game/`.
- **Input:** [`src/input/`](input/) holds keyboard and stick state (`state.ts`)
  and the controls that wire them to the scene and the interface (`controls.ts`).
- **UI:** [`src/ui/`](ui/) holds the HTML interface drawn over the canvas: the
  start screen, cards, storybook, station, map, settings, HUD and touch sticks.
  [`src/ui/layout/`](ui/layout/) computes every position, size and press area,
  with the spacing and type tokens in `tokens.ts`.
- **Page:** [`src/loading/`](loading/) drives the kit's DOM progress bar,
  [`src/pwa/`](pwa/) the service worker, install and update flows,
  [`src/view/`](view/) the frame turn, and [`src/landing/`](landing/) the landing
  page's Install button.
- **Build:** [`src/build/`](build/) holds the Node-only code the Vite build runs:
  the landing page and web manifest, the Phaser build, the stylesheet module, the
  icons, the precache and the security headers. No runtime module imports it.
- **Phaser boundary:** only `src/main.ts` and the Phaser modules
  (`PHASER_MODULES` in [`eslint.config.mjs`](../eslint.config.mjs)) import
  Phaser, the kit's `phaser/` modules or one another, enforced by ESLint's
  `no-restricted-imports` and, by resolved path, `import-x/no-restricted-paths`. The model, data, layout, interface and the rest
  of `src/game/` are Phaser-free, so they unit-test without a renderer.
- **Layers:** [ESLint](../eslint.config.mjs) places every
  module of `src/` and `tools/` in a layer of the shared source-structure bands,
  lowest first: lib and data, model, saving, art (`src/art/` and the Phaser-free
  `src/game/` modules), layout and input state, platform (loading, PWA, crash),
  ui, scene, entries, then support (build, tests, tools). Outside tests, imports point down only,
  including type-only imports. The repository lint reports runtime cycles, and
  erased type-only edges may close a cycle within a layer.
- **Test helpers:** [`src/testing/`](testing/) is importable only from tests and
  `src/testSetup.ts`: `launch.ts` pins launch seeds and drives a model through the
  opening and story pages, and `public-art.ts` reads Art's manifests from
  `public/art/`. [`src/tests/`](tests/) holds the repository-level tests (hooks,
  check startup, kit consumption, page lifecycle) and the tests of `tools/`.

Discrete UI actions use registered metadata and owning roots, with detached metadata
and attached binding checks at completed producer boundaries. The shared dispatcher
owns tap/hold gestures; factory callbacks retain native click ownership. See the
[current action contract and scoped coverage](../docs/ui-layout-tree.md#registered-actions-and-completed-producers).

### Assets and build

- **Shared kits:** game-kit, art-kit and delivery-kit are installed from their
  version-pinned GitHub release tarballs in `package.json`, with checksum integrity
  in `package-lock.json`.
- **Icons:** the build writes each icon in [`src/build/pages/icons.ts`](build/pages/icons.ts) again
  under a content-hashed name in `/assets/` and points the built pages and manifest
  there.
- **Build label:** `gameViteConfig` defines `__APP_VERSION__` and `__COMMIT__`;
  [`src/buildLabel.ts`](buildLabel.ts) formats them for the Settings card's last
  line. The checks pass the checked revision as the build's commit.

## Save data

The persistence contract distinguishes an interrupted flight from leaving a galaxy:

- Every launch opens on the start screen. After closing mid-flight, Continue
  resumes the saved flight, including its geography and encounter seeds,
  position, cargo, shield, equipped weapon, tow and danger.
- Leaving a galaxy ends its flight. Re-entering uses the saved geography seed
  and site policy for that galaxy. The new flight draws its own encounter seed. The chart, story progress, known destinations, discovered
  stations, deposited resources, activity counters, Stardust, owned weapons, levels,
  ship upgrades and paint schemes persist. Voluntary travel keeps undeposited ore
  aboard for the next flight.
- Shield depletion jumps Ada home and ends the flight. Its open-space enemies,
  pickups, undeposited ore and any tow are lost. The galaxy's saved geography,
  weapons, levels, Stardust and accepted quests persist. She lands at night,
  sleeps while Astra recharges overnight, and wakes in the morning.

Flight snapshots are stored locally in this browser. If browser storage is
unavailable, play continues with a nonblocking save warning. The warning clears
after a successful write; failed writes preserve the last persisted snapshot.

The Saving codec validates the flight snapshot. The store uses `localStorage`
with a primary save key and a separate repair backup key. Device settings (move
stick, aim stick, sound, FPS counter and reduced motion) are stored under their
own keys ([`src/ui/deviceSettings.ts`](ui/deviceSettings.ts)), outside the save.

## Phone

The production build writes `/sw.js`, the kit's router service worker scoped to
`/`, and the build's manifest and pointer under `/.game-kit/`. The manifest lists
every file with its SHA-256 and size: the game page at `/play/`, the build output
it loads, the web app manifest and its icons, every file under `public/art/`
except `app-icon/`.
Each update group ([`src/build/precache/precachePlugin.ts`](build/precache/precachePlugin.ts)) ships
as a gzip archive at `/.game-kit/group-<sha256>.bin`, served as emitted without
HTTP coding, and as a decoded copy at `/.game-kit/archive-<sha256>-0.bin` for
installed builds on GameKit 0.72.0 or earlier. `/.game-kit/build.json` is served
`no-store`, and each manifest and group archive as immutable
([`src/build/securityPolicy.ts`](build/securityPolicy.ts)).

The page's launch ([`src/pwa/index.ts`](pwa/index.ts)) runs from the boot shell
before the game module downloads. A production launch requires Service Worker,
Cache Storage and `DecompressionStream`; without one of them the page shows the
kit's unsupported error with no Retry. A first visit installs the complete build
under the one loading bar, verifying each file, then plays from the cache; a
failed download shows Loading failed, and Retry resumes from the files already
stored. Where the browser refuses the router or storage is full, the game plays
from the network instead, says so once in the save status slot at the first
flight, and the next launch tries the install again. The router downloads nothing: it serves each window its build from the
cache. Later launches play at once and check the pointer in the background, at
launch and on resume; an update fetches only the changed files and stages them
apart from the active build. A complete staged build activates silently at the
next launch, before game construction or save access. When staging completes
during a session, the Update now card shows on any screen and pauses play:
Update now saves, then switches with no download; Cancel continues play on the
active build. The landing page at `/` registers the router without installing,
so an app installed from it opens offline once the game has installed a build.
The page and router share one clean, full Git build identity; missing or dirty
identity rejects a production build.

The play page's lightweight HTML shell shows the existing ship and the kit's
pending loading bar before game modules download. The live bar shows the first
install's download and the boot reads as one value, and covers module and
save-read waits. Image
decoding keeps it pending until the prepared screen replaces the splash. A crash
during module download remains fenced when startup continues. Explicit Retry reloads
one document after a game-module import rejection or startup without a reclaimable
Phaser instance. Other required-file and first-install failures retry in place.
The reload preserves saved data and preferences and retains the normal launch/update
fences; it does not activate a build or modify asset URLs.

A loading bar along the view's top edge, above every other layer, shows the loads
the player waits for. The boot preload and a galaxy's art as its first flight
starts fill it left to right; it holds full for 250 ms and fades out over 150 ms,
then its element is removed. While an update stages in the background it fills
with the staging progress; Update now's switch and a forced update for a newer
save show a segment 30% of the width travelling across it until that work ends. Art loaded on demand
during play (scenery, rocks, ship parts, paint) shows nothing, and with nothing
waited for there is no bar. Its cream fill and ink track sit on a 1 px ink rule,
so it reads on every galaxy's field.

Both pages link `/manifest.webmanifest`, which installs the game at `/play/`.
The build writes each icon in `src/build/pages/icons.ts` again under a content-hashed
name in `/assets/` and points the built pages and manifest there, so a redrawn
icon reaches an installed app; the source pages and manifest keep plain URLs.
`src/pwa/index.ts` exposes the install state, its change listener, the install
prompt and the browser whose own menu installs the game (iOS and Firefox for
Android). The dev server registers no service worker. The landing page's
Install button runs on `src/landing/main.ts`, which loads only the kit's
install and launch modules: it shows while the browser can install the game, and
opens the browser's prompt or that browser's menu steps.

## Dev tools

- **Cheats:** the browser-tab cheats are defined in [gameplay/cheats.md](../gameplay/cheats.md)
  and implemented in [`src/ui/cheats.ts`](ui/cheats.ts) and
  [`src/model/cheats.ts`](model/cheats.ts).
- **Launch worlds:** `ADA_LAUNCH_SEED=<n> npm test` replays the suite in another
  launch-seed world on demand; the test category runs only the default world.
- **Pacing:** [`tools/pacing-sim.ts`](../tools/pacing-sim.ts) simulates Stardust
  pacing headlessly for Gameplay review.
- **Layout:** [`tools/layout-dump.ts`](../tools/layout-dump.ts) dumps every computed
  UI layout result as canonical JSON.
- **Browser smoke:** [`tools/browser-check.mjs`](../tools/browser-check.mjs) runs
  [`tools/browser-smoke.mjs`](../tools/browser-smoke.mjs) against a gated build; see
  [check commands and evidence](../docs/checks.md).

The shield's lighter outer pill contains one opaque dark rectangle behind both
bars. The main border has the same gap to the dark rectangle's top, left and
right as the gap from its bottom to the cream moving fill and from that fill's
bottom to the dark rectangle's bottom. The recharge fill spans the main border's
outer left and right edges at capacity. The main fill keeps its inner inset, and
each fill's current progress remains independent. The icon
retains its field-dependent outline. Shield timing and meter semantics are unchanged.
