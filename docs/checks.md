# Isolated checks

## Native commands and Make

The npm scripts call the check recipes in `tests/container/check` directly and
never enter Make; every recipe but `typecheck` and `bundle` refuses outside the
check container. Choose the execution environment for the task. Preserve resource admission,
load below 20, four CPUs, four test workers and the configured memory ceilings.

| Command                                | Work                                                                   |
| -------------------------------------- | ---------------------------------------------------------------------- |
| `npm run check`                        | `check`: `lint`, `test` and `build`, in `CHECK_TASKS` order            |
| `npm run typecheck`                    | `typecheck`: TypeScript alone, runnable in a plain Node container      |
| `npm run lint`                         | `lint-only`: ShellCheck 0.11.0, Prettier, ESLint and Markdown lint     |
| `npm test`                             | `test`: Vitest once with at most four workers, then the art tool tests |
| `npm run test:game-kit`                | The game-owned game-kit consumer tests, run directly by Vitest         |
| `npm run build`                        | `bundle`: Vite, writing `dist/`                                        |
| `make check`                           | Complete container profile, the default Make target                    |
| `make lint`, `make test`, `make build` | Optional aliases for this repository's categories                      |

Hook verification creates its own scratch Git repository and preserves the
caller's working files and index. `--output <proof.json>` selects explicit hook
evidence; the default output remains in owned scratch. Normal staged-file
formatting and fixes are unchanged. The container's `lint` category is
`typecheck`, the hook proof and `lint-only`; its `build` category is `bundle` and
the Wrangler packaging dry run. The recipes hold the direct commands the delivery
runner, the container and the npm scripts use.

The test category runs the suite once, with every test case on a pinned
launch-seed sequence (`src/testSetup.ts`), and runs no routine alternate-world
pass. Contract and property tests and the fixed acceptance batch pin
seed-dependent behaviour. Use `ADA_LAUNCH_SEED=<n> npm test` to replay a
specific world on demand.

The test category also checks the UI font subsets: `src/tests/uiStrings.test.ts` reads
every string the game page can set in AdaUI (the export `node tools/ui-strings.ts` writes
for the font producer) and fails on a character the shipped WOFF2 files do not map.

## Container profile and CI

The project launcher `tests/container/run` has SHA-256
`6284cfd5252877bcc863fabcb8d2f68f7b5375e26f27717c7ed134a751b63968`.
It builds the repository's custom dependency-cache image from the explicit
`tests/container/context` inputs. The Node.js 24.22.2 Dockerfile, dependency
cache, scratch ownership, writable Vite caches and inner categories are unchanged.
Read-only Make categories extract into `/work/source` on the existing `/work`
tmpfs. Its writable parent permits atomic source-identity restoration without
writing to the read-only container root. Writable exec retains `/work`.

Make exports the category list, build/test output paths and resource admission
callback. The launcher calls `tests/container/admit` before every image and
category start, with a five-second limit. It preserves revision, source hash,
dirty inventory and `SOURCE_DATE_EPOCH` provenance, and rejects changed source.
`make check` exports no artifacts. Explicit `make build` exports `dist/`;
explicit `make test` exports only configured
`TEST_OUTPUTS`, empty by default. Exports validate and replace ignored generated
paths, removing stale content.

The `Test` workflow (`.github/workflows/test.yml`) runs on every pushed branch
and on pull requests to `main`, with two jobs that use Make and this custom
Dockerfile: `Lint` runs `make lint`; `Test` runs `make test build`. `Lint` runs
for every change. A `Changes` job compares a push with its previous commit, or a
pull request with its base, and `Test` reports as skipped when every changed
path is under `docs/`. A forced push, a new branch, a manual run, a base that
is not an ancestor or a failed `Changes` job runs `Test`. Both Make jobs set
up Node.js from `.nvmrc` for the evidence script and pinned Docker and Buildx
versions. `tools/ci-evidence.mjs` records source fingerprints around those
commands and copies the actual exported build into `.check-results/ci-test/`. It
verifies that the exported `dist/` and its evidence copy match. Receipts label
these explicit Make commands separately from detached adapter execution. Both
jobs preserve their logs and receipts as CI artifacts. `AI attributions` is a
separate workflow.

See [container compatibility](container-adoption.md) for runner boundaries.

## Scheduled gate image

The scheduled gate uses the immutable local image ID in `delivery-kit.json`: the
Dockerfile's `toolchain` stage, which holds Node, ShellCheck and the non-root
check user but no project dependencies. The gate runs its own `npm ci`, so a
dependency change never changes the gate image or `delivery-kit.json`. Prepare
that image on the delivery host before approving config adoption:

```bash
mkdir -p .check-results
tar --create --file .check-results/gate-context.tar \
  --mode='u+rwX,go+rX' --files-from tests/container/context
tests/container/admit build-image
docker build --resource cpu-period=100000 --resource cpu-quota=400000 \
  --resource memory=4g --ulimit nofile=256:256 --target toolchain \
  --iidfile .check-results/gate-image.id \
  --file tests/container/Dockerfile - < .check-results/gate-context.tar
node --input-type=module -e \
  'import{readFileSync}from"node:fs";const c=JSON.parse(readFileSync("delivery-kit.json"));if(readFileSync(".check-results/gate-image.id","utf8").trim()!==c.gate.image)throw Error("Prepared image differs from the approved image ID")'
```

Image IDs are local and content addressed. A rebuild can produce a different ID;
review and verify that image before changing the pin. Keep the prepared image
available on the delivery host. Config changes require separate operational
approval and do not start or restart the runner.

The `toolchain` stage pins `node:24.22.2` and ShellCheck 0.11.0 by digest. Its
empty entrypoint permits delivery-kit 4.0.0 to start `sleep infinity`. The
default `check` stage adds the locked dependencies (`npm ci --ignore-scripts`)
and the inner dispatcher; Make and `tools/checks.mjs` build it on demand, and
`delivery-kit.json` never names it. Make selects `/bin/sh` explicitly and
dispatches the same inner checks. The kit copies the read-only checkout into `/tmp/work`, installs locked
dependencies as UID 19001, disconnects networking and runs the three configured
`tests/container/check` categories directly. Native and scheduled lint both use
`lint-only`, including ShellCheck. No runtime download provisions ShellCheck.

## Source identity in isolated checks

The published DeliveryKit source-identity API supplies the exact commit, shallow
HEAD and index for independently copied working files. The producer uses the
public module from the prepared locked image in temporary scratch, so resident
host dependencies and Git configuration remain untouched. Complete safety-approved
tracked inventory is required before capture. Copied edits, deletions and
untracked source remain dirty; restoration does not repair them.

Both detached checks and the native Make profile pass pinned commit, tree and
artifact digest to the inner copy boundary. Make opts in with
`CHECK_SOURCE_IDENTITY`. The check restores identity before the lint placeholder
repository can be initialized and verifies its identity between categories.
GameKit independently withholds a full build ID for dirty source or a CI mismatch.

The DeliveryKit stock gate is a separate source consumer. Publishing the API or
pinning its package does not adopt that runner's producer or runtime binding.

## Detached receipt compatibility

Use Node.js 24.22.2 (or supported Node.js 26.12.0+) and Docker. The orchestrator
runs on the host; hook verification, lint, type checks, tests and builds run
inside Docker.

```bash
node tools/checks.mjs start all
```

This starts a detached container and prints its name. Collect it after completion:

```bash
node tools/checks.mjs collect ada-check-UUID
```

Replace `ada-check-UUID` with the printed name. Exit 75 means it is still running;
collect again at the next review boundary. Other nonzero exits mean failure.
Evidence is copied into `.check-results/<name>/` before the completed container
is removed. Logs, exit status and source fingerprints remain there for review.
A changed fingerprint invalidates the result.

Startup failures record the container name, confirmed ID and recovery instructions
in `.check-results/<name>/startup.json`. Only an owned container confirmed never
started is removed automatically. Running or uncertain containers are retained;
follow the recorded collection instructions before retrying.

`start` first builds the Make profile's check image from `tests/container/context`
and `tests/container/Dockerfile`, after `tests/container/admit build-image`, with
the same build limits and per-checkout `local-check` tag as the launcher, so Docker
reuses Make's layers. The image supplies ShellCheck and the locked dependencies;
the container runs without a network and copies source into writable `/tmp/work`
scratch. `startup.json` records the image ID. The `lint` mode dispatches inner `lint`;
`test` and `all` dispatch inner `lint`, `test` and `build`. This includes hook
acceptance/rejection, types, the full tests, build and the Wrangler packaging dry run.
All categories invoke `tests/container/check` directly, without Make or Docker
inside the container. Its recipes are the only category command source.
Published kit API coverage belongs to the application tests.

Containers use UID/GID 19001, the checkout supplemental group, `HOME=/tmp`,
four CPUs and a four-worker test limit. The checkout mount
is read-only. The container layer is disposable writable scratch. An explicit source-file allowlist is copied to writable `/tmp`
scratch; Git metadata, nested worktrees, dependency directories, instruction
files and credential files are excluded. Host files receive no writable mount.
Logs and build outputs leave through `docker cp`. The gate copies the built
`dist/` into evidence for the bus and the browser harness. It passes the checked
revision as `CHECK_REVISION`; the inner checks build with it as
`WORKERS_CI_COMMIT_SHA` unless a deploy gate sets that itself, so the build
names its commit without Git metadata.

Local starts are refused when one-minute load is at least 20. `--ci` skips only
this local resource check and requires `GITHUB_ACTIONS=true` plus
`RUNNER_ENVIRONMENT=github-hosted`. Hosted CI uses the same Docker isolation and
emits the required `Lint` and `Test` checks.
The separate `AI attributions` workflow uses the canonical attribution action.

Do not change source between start and collect. Fingerprints include allowed
source content and Git's dirty-file inventory before and after the run.
Unsupported source paths cause a refusal and must be reviewed before being added
to the allowlist.

## Cloudflare build and deployment checks

`wrangler.jsonc` defines the existing assets-only Worker `ada-the-navigator`
with compatibility date `2026-11-10`, its shared account and custom domain, and
logs and traces enabled. No application Worker entrypoint is configured.

The bus-compatible Wrangler packaging check uses the built assets, as the last
step of the container's `build` category, after `bundle`. It runs pinned Wrangler
with `deploy --config wrangler.jsonc --no-bundle --dry-run`.
Root `wrangler.jsonc` points `assets.directory` to `./dist` and defines no Worker
entrypoint or build command. This route needs the gated `dist/` and locked
`node_modules/`, without a deployment rebuild. The dry run is part of the
isolated `all` gate's build category.

The existing Delivery Kit runner uses the same gate and push path for the exact
local `main` commit on scheduled and user-authorized ad hoc departures. It
deploys the admitted artifact after required exact-commit CI passes and the
remote commit matches.
The game coordinator submits approved ad hoc departures with
`delivery-kit request --game ada-the-navigator --id SAFE_ID`. Persisted desired
control governs admission to both kinds of departure.

`delivery-kit.json` schedules hourly departures at :00 America/Toronto with
`deploy.mode` set to `wrangler`. A pushed range that changes only Markdown, `art/`
or `gameplay/` files (`deploy.skipPattern`) does not deploy. When all changed paths
are under `docs/` and no deployment is pending, the runner pushes the exact
commit and starts CI without a local gate or deployment. Reports route to
`game-coordinator`. The monitor schedule and existing OAuth authentication remain
in place. Credentials are not part of the repository. No manual deployment is
part of this procedure.

## Browser smoke checks

After collecting a successful `all` or `test` gate, use its evidence directory
containing the built `dist` artifact:

```bash
node tools/browser-check.mjs start .check-results/ada-check-UUID
```

Replace `ada-check-UUID` with the collected gate name. The browser harness
requires successful gate evidence with a stable fingerprint matching the current
source. It prints an `ada-browser-UUID` name; collect that run with:

```bash
node tools/browser-check.mjs collect ada-browser-UUID
```

Exit 75 means the browser is still running. A run fails after 900 seconds
(`tools/smoke-limit.mjs`), and its preview server stops 30 seconds later.
Collection saves browser and preview
logs, browser evidence and `verification.json` in `.check-results/<browser-name>/`
before removing the browser and preview containers and their internal network.
Evidence includes `desktop.png`, `phone.png`, `events.json` and `result.json`.
Both the source fingerprint and built-artifact hash must remain unchanged.

The harness uses a local static preview and Playwright in isolated containers,
with UID/GID 19001, the checkout supplemental group, `HOME=/tmp`, at most four
CPUs per container and read-only source/artifact mounts. Fetch
`mcr.microsoft.com/playwright/mcp:v0.0.83` before starting. Browser starts obey the
same local load restriction as the source gates.

The production launch requires a service worker, so Chromium treats the plain
HTTP preview origin as secure (`launchBrowser` in `tools/browser-support.mjs`).
A run fails on every failed request except an update group archive
(`/.game-kit/group-<sha256>.bin`) aborted by a page closing mid-download.

The smoke has a 900 second limit.

### Art review captures

Art's review screenshots run separately from the gating smoke, against the same
gate evidence and in the same containers:

```bash
node tools/browser-check.mjs start --captures .check-results/ada-check-UUID [set ...]
node tools/browser-check.mjs collect ada-captures-UUID
```

The run (`tools/browser-captures.mjs`) has its own 120 second limit, so name a
few capture sets per run. With no set named it runs `heavies`, `rocks`,
`keylines` and `hub`: the heavies by mount tier, the disabled and salvaged
heavies, the enemy weapons at full and reduced motion, the upgrade pickup's
climb, galaxy one's rock spin and footprint overlay, and the light-field
keylines. The visible-art sets (`tools/browser-captures-batch.mjs`) are `fleet`,
`fleet-tops`, `fleet-craft`, `hostile`, `stations-sunflower-cartwheel`,
`stations-whirlpool-needle`, `stations-andromeda-phantom`, `pickups`,
`landmarks`, `needle`, `craft`, `backdrops`, `ship`, `weapons`, `weapons-flat`,
`effects` and `controls`. `enemy-facing` releases a fighter crossing past Ada, a
fighter pulling out of a burst, a fighter strafing in its band, a frigate
turning away while its turrets fire astern and a retaliator holding its band
with its nose on Ada while its launcher fires. `keep-moving` releases an idle
pack of three retaliators sharing one home, a fighter returning home and a
Mining Freighter beside a large rock, six frames 300 ms apart. `resources` captures the Stardust and ore pickups on a
dark and a light field and every UI view that draws their icons. `markers`
takes the edge markers of an identified enemy, heavy, route guard and hostile
station and an unidentified contact on Cartwheel's light field and Phantom's dark
field, with Phantom's flagship as the story's target there. `crystal-rocks`
lays plain rocks beside small-crystal variants of the same shapes at game scale
in each galaxy outside Cartwheel, every variant in one of them, and Cartwheel's
first ore field, each rock full of crystals. The nose sets
(`nose-laser`, `nose-scattershot`, `nose-multi-laser`, `nose-rapid-missile`,
`nose-heavy-missile` and `nose-phaser`) fire one weapon into open space at
headings 0 to 56 of 64 in steps of 8: Ada's idle hull, then the first four
frames after the trigger. Each fixture is a canonical save. The flight is held still
until every enemy and rock in view draws Art's frames (`data-enemies` and
`data-asteroids` on `#game-status`). Frames are then taken at stepped times on a
paused page clock. A capture run fails only on a page error, a failed request or
a fixture that never draws Art's frames; Art reviews the images.

The ship-fix sets run at 2 device px per CSS px, each view with a close-up of
Ada's canopy, tail and plume roots. `ship-fixes` takes the start screen and the
warp's settle-24, settle-16 and settle-10 poses. `ship-fixes-l`, `ship-fixes-m`
and `ship-fixes-s` take her plumes at 1, 0.6 and 0.25 of her top speed, forward
and in reverse, at headings 0, 16, 32 and 48 of 64: eight fixtures per set.

`placements` takes the salvage beacons, Whirlpool's nursery beacon and
Andromeda's spare beacon after their reveal, and `hostile-tops` each family's
hostile station still and with a pod and the dome firing, and the Claim
platform still and with both guns firing, all at 2 device px per CSS px with a
close-up of each. `holodisk-icon` lays the served holodisk
item icons at their own size and at 8 times on the ink chip and on cream.

Browser smoke coverage supports prototype integration review; it does not
establish story completeness or gameplay balance. Review the collected results
for the exact source revision before claiming a behavior is verified.

WORKAROUND: Nested Markdown overrides address [GHSA-gg6h-894w-4m9c](https://github.com/advisories/GHSA-gg6h-894w-4m9c)
and [GHSA-238p-pmpm-9mq7](https://github.com/advisories/GHSA-238p-pmpm-9mq7). Remove them once upstream dependencies include the fixes.
