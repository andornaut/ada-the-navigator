# Ada the Navigator

A browser-game prototype combining space exploration with interactive Toronto
stories. Built with Phaser, TypeScript and Vite using the shared art-kit,
game-kit and delivery-kit.

## Prototype scope

The [prototype contract](gameplay/prototype.md) defines the scope and approved
rules. This is an untuned prototype for gameplay testing.

Three story sectors are designed:

- Cooperating outposts: connect growers, a workshop and salvagers, then help start
  a community garden in Toronto.
- Mining hub: collect and deposit resources, support a miner facing intimidation,
  then help Ada and her friends include a child at school.
- Whale family: clear debris, locate the whale's family and relay coordinates,
  then help Ada understand her dog's need to explore.

Space quests and their Toronto resolutions unlock sectors in order. Completed
sectors remain replayable. Sector four's conclusion is deferred and has no
playable story. See [dialogue and objectives](gameplay/prototype-copy.md).

The flight target includes independent movement and aim, a rechargeable shield,
basic fire and limited-ammo upgrades, contextual interactions and travel to
known destinations outside danger. Space uses monochrome placeholders apart
from Ada's compact white-and-blue ship.

## Controls

The game uses a 720 × 360 base view (2:1 landscape), matching Chibi. The canvas
expands to available space while the play view stays centered across the top.
Portrait touch screens turn the page frame to landscape; controls remain mapped
to the visible frame. Rendering uses nearest-neighbor scaling.

Prototype input mappings:

| Input                    | Action                                            |
| ------------------------ | ------------------------------------------------- |
| WASD                     | Move                                              |
| Arrow keys               | Aim and fire while held                           |
| Space                    | Use the available contextual action               |
| Esc                      | Open or close settings                            |
| Left touch joystick      | Move                                              |
| Right touch joystick     | Aim and fire while deflected                      |
| Contextual action button | Talk, deliver, deposit or continue when available |

Mobile uses independent twin joysticks. Centering the aim stick stops firing;
without aim input, the ship faces its movement direction.

## Saving

The persistence contract distinguishes an interrupted flight from leaving a sector:

- Closing and reopening should resume the exact flight, including layout seed,
  cargo, ammunition and shield state.
- Leaving and re-entering should generate a new layout seed and reset carried
  cargo and weapon pickups. Story progress, known destinations, deposited
  resources and activity counters persist.

Combat includes data-defined solo ships and packs, independent large-ship
hardpoints and straight-flying missiles. Required approach encounters stay outside
friendly safe zones. See the [enemy rule interface](gameplay/enemies.md).

Flight snapshots are stored locally in this browser. If browser storage is
unavailable, play continues with a nonblocking save warning. The warning clears
after a successful write; failed writes preserve the last persisted snapshot.

## Offline and install

The production build writes `/sw.js`, a service worker scoped to `/` that
precaches the game page at `/play/`, the build output it loads, the web app
manifest and its icons, and every file under `public/art/` except `app-icon/`.
The precache version is a hash of that content, so any change installs a new
worker. Hashed `/assets/` files are served cache-first; the page, art and
manifest are network-first, so an online load shows the latest deploy and an
offline load uses the cached copy. A first visit registers the worker once the
game has drawn. A new worker takes over on a later launch, after every page the
old one controls has closed. The landing page at `/` is not precached.

Both pages link `/manifest.webmanifest`, which installs the game at `/play/`.
`src/pwa/index.ts` exposes the install state, its change listener, the install
prompt and the browser whose own menu installs the game (iOS and Firefox for
Android). The dev server registers no service worker.

## Development

Use Node.js 24.22.2 (or supported Node.js 26.12.0+). Install the locked dependencies and start Vite:

```bash
npm ci && \
  npm run dev
```

Open the local URL printed by Vite for the website, then follow Play to `/play/`.
The website and game use the same origin and browser save key. The available
prototype behavior depends on the integrated source revision. Dependency
installation enables the Husky pre-commit hook. Native npm checks run directly in
the current environment; Make selects the container profile below.

## Checks

Native lint requires ShellCheck 0.11.0 on PATH; the container image supplies it.
Native npm scripts never invoke Make: `npm run lint` checks shell helpers, formatting and
source lint, `npm test` runs Vitest, and `npm run build` builds Vite output and
retains assets. `npm run check` combines scratch-owned hook verification,
TypeScript, lint, tests, build and both packaging dry runs.

`make check` enters the canonical container launcher. This repository also keeps
optional `make lint`, `make test` and `make build` aliases. Its custom Dockerfile
is required by CI, which runs `make lint` for `Lint` and `make test build` for
`Test`. `AI attributions` remains a separate required check.

See [check commands and evidence](docs/checks.md) and
[container compatibility](docs/container-adoption.md). The detached receipt
adapter and browser artifact proof remain available.

## Delivery

`delivery-kit.json` schedules Ada departures hourly at :00 America/Toronto using
pinned delivery-kit 2.1.1. Only the existing bus deploys, after the isolated gate
and required CI pass for the exact commit. The monitor schedule is unchanged.
Desired control remains paused; game-dev enables only Ada after READY review.

Cloudflare setup uses typed `cloudflare.config.ts` for the existing assets-only
Worker `ada-the-navigator` and custom domain `navigator.adabekele.com`. The
Cloudflare Vite plugin writes static assets and deployment metadata into
`.cloudflare/output/v0/`. The gate build also retains those assets as `dist/`.

The bus uses pinned Wrangler with root `wrangler.jsonc` and the retained gated
`dist/`. Deployment neither rebuilds nor depends on hidden Cloudflare output.
No application Worker entrypoint or deploy-time build command is configured.
The existing account, disabled workers.dev and preview URLs, logs and traces
are preserved in both configurations.

The isolated gate validates both CF prebuilt output and Wrangler packaging with
`npm run deploy:prebuilt:dry-run` and `npm run deploy:wrangler:dry-run`. These
commands do not deploy. See [isolated checks](docs/checks.md) for gate evidence.
Credentials are not part of this repository.
