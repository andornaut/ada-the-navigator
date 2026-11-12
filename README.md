# Ada the Navigator

[![Test](https://github.com/andornaut/ada-the-navigator/actions/workflows/test.yml/badge.svg)](https://github.com/andornaut/ada-the-navigator/actions/workflows/test.yml)

A browser-game prototype combining space exploration with interactive stories
at home. Built with [Phaser](https://phaser.io/), TypeScript and Vite using the
shared art-kit, game-kit and delivery-kit, and served as static files from
[Cloudflare Workers](https://developers.cloudflare.com/workers/static-assets/).

## Docs

The folder READMEs describe the current design and implementation:

- [art/](art/README.md): art rules, assets and pipeline
- [gameplay/](gameplay/README.md): the version one design, rules, player copy and tuning
- [src/](src/README.md): stack, architecture, save data and phone behaviour
- [docs/checks.md](docs/checks.md): check commands, the container profile, CI and evidence
- [docs/container-adoption.md](docs/container-adoption.md): container entry points and runner compatibility

## Playing

The [version one rules](gameplay/rules.md) define the scope and approved rules.
Balance values are provisional and tuned through playtesting.

Three story galaxies are designed:

- Cooperating outposts: connect growers, a workshop and salvagers, then help start
  a community garden at home.
- Mining hub: collect and deposit resources, support a miner facing intimidation,
  then help Ada and her friends include a child at school.
- Whale family: clear debris, locate the whale's family and relay coordinates,
  then help Ada understand her dog's need to explore.

A galaxy's space quest, its resolution at home and its recovered holodisk unlock
the next galaxy. Completed galaxies remain replayable. Galaxy four's conclusion is deferred and has no
playable story. See [dialogue and objectives](gameplay/player-copy.md).

Flight has independent movement and aim, a rechargeable shield and contextual
interactions; the status pill shows the shield and Ada's Stardust. Ada has six
weapons: Basic, always available, and five upgrades (Rapid Missile, Multi-Laser,
Heavy Missile, Scattershot and Phaser). Each has three levels and fires from the
ship's nose. Basic is unlimited; each upgrade has its own ammunition count, shown
under its icon, and Ada switches to Basic when the equipped one runs out. Enemies,
asteroids and discovery caches release Stardust, which station shops exchange for
weapons, weapon levels, ammunition packs, ship upgrades and paint schemes; enemies
also drop weapons rarely, and a dropped weapon Ada owns gives a pack of its
ammunition. Once a galaxy's chapter is
complete, its stations' Projects tab takes donations toward community projects:
each confirmed donation pays what the balance covers, and part payments persist.
A funded project with world art changes its outpost, fading in once the first
time the outpost is on screen.
The Paused card's Map shows
the galaxy's discovered destinations and stations and how much of it is mapped;
Travel here reaches a chosen one outside danger, and Return to Earth ends the
flight outside danger, towing or not. Its Quests card lists the story objective
and the held job; a line whose target is mapped selects that place. Space draws
authored sprites for Ada's ship, enemy ships, stations, galaxy one's outposts,
discovery caches, the holodisk and its beacon, Stardust, weapon pickups, missiles,
blasts, the Phaser beam and asteroids. Galaxy two's hub, miner and visitors,
galaxy three's whale and family, mining deposits, cargo, hazards and traveling
debris keep simple placeholders. See [economy](gameplay/economy.md).

Combat includes data-defined solo ships and packs, independent large-ship
hardpoints and straight-flying missiles. Required approach encounters stay outside
friendly safe zones. See the [enemy rule interface](gameplay/enemies.md).

### Controls

The game uses a 720 × 360 base view (2:1 landscape), matching Chibi. The canvas
expands to available space while the play view stays centered across the top.
Portrait touch screens turn the page frame to landscape; controls remain mapped
to the visible frame. The canvas renders in device pixels at up to twice its CSS
size, with pixel art sampled nearest-neighbor and vector art smoothly.

Prototype input mappings:

| Input                | Action                                                                         |
| -------------------- | ------------------------------------------------------------------------------ |
| WASD                 | Move                                                                           |
| Arrow keys           | Aim and fire while held                                                        |
| Space                | Use the available contextual action                                            |
| Esc                  | Close the open card; with none open, pause in flight or open Settings at start |
| Back                 | Close the open card; with none open, pause in flight                           |
| Weapon buttons       | Equip an owned weapon                                                          |
| Pause button (touch) | Pause in flight and on Ada's room page                                         |
| Left touch joystick  | Move                                                                           |
| Right touch joystick | Aim and fire while deflected                                                   |
| Use disc (touch)     | Talk, deliver, deposit or tow when available; its symbol names the action      |

In flight the Paused card offers Resume, Map, Ship, Settings and Back to title;
on Ada's room page it offers Settings and Back to title. Back to title opens the
start screen, where Continue resumes. The start screen's Achievements button
sits left of Settings.

Mobile uses independent twin joysticks. Centering the aim stick stops firing;
without aim input, the ship faces its movement direction.

## Developing

Use Node.js 24.22.2 from `.nvmrc` (or supported Node.js 26.12.0+). Install the
locked dependencies and start Vite:

```bash
npm ci && \
  npm run dev
```

Open the local URL printed by Vite for the website, then follow Play to `/play/`.
The website and game use the same origin and browser save key. Dependency
installation enables the Husky pre-commit hook, which formats staged files and
runs ESLint and markdownlint on them. The npm scripts call the project's check
recipes (`tests/container/check`) as Chibi's and Archie's do; every recipe but
`typecheck` and the Vite build runs only inside the check container, which Make
starts from the custom dependency image used by CI.

| Command                                | Does                                                                       |
| -------------------------------------- | -------------------------------------------------------------------------- |
| `make check`                           | Lint, test and build in the container profile, the default Make target     |
| `make lint`, `make test`, `make build` | One category each; CI runs `make lint` for `Lint` and `make test build`    |
| `make previews`                        | Rebuild, then recapture the galaxy selector previews in `public/previews/` |
| `npm run check`                        | The whole chain in the container: lint, the tests and the build            |
| `npm run typecheck`                    | TypeScript alone, anywhere, a plain Node container included                |
| `npm run lint`                         | ShellCheck 0.11.0, Prettier, ESLint and markdownlint, in the container     |
| `npm test`                             | Vitest with at most four workers, then the seeded worlds, in the container |
| `npm run test:game-kit`                | The game-owned game-kit consumer tests, with Vitest's runner config loader |
| `npm run build`                        | Vite build, writing `dist/`                                                |
| `npm run preview`                      | Build, then serve `dist/` with `wrangler dev`                              |
| `npm run format`                       | Prettier and ESLint fixes across the tree                                  |
| `npm run clean`                        | Remove `dist/` and `.wrangler/`                                            |

`AI attributions` is a separate required check. See [check commands and
evidence](docs/checks.md) and [container compatibility](docs/container-adoption.md).

## Deploying

`delivery-kit.json` schedules Ada departures hourly at :00 America/Toronto using
pinned delivery-kit 3.0.1. Only the existing bus deploys, after the isolated gate
and required CI pass for the exact commit; a push that changes only Markdown,
`art/` or `gameplay/` files does not deploy. The monitor schedule is unchanged.
Desired control remains paused; game-dev enables only Ada after READY review.

The bus uses pinned Wrangler with root `wrangler.jsonc`, which defines the
assets-only Worker `ada-the-navigator`, its custom domain
`navigator.adabekele.com` and the gated `dist/` as its assets. Deployment does
not rebuild. No application Worker entrypoint or deploy-time build command is
configured. The account, disabled workers.dev and preview URLs, logs and traces
are set there.

The isolated gate's build category validates Wrangler packaging with a dry run,
which does not deploy. See [isolated checks](docs/checks.md) for gate evidence.
Credentials are not part of this repository.
