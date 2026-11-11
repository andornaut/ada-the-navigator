# Isolated checks

## Native commands and Make

Native npm scripts run directly in the invoking environment and never enter
Make. Choose the execution environment for the task. Preserve resource admission,
load below 20, four CPUs, four test workers and the configured memory ceilings.

| Command                                | Work                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------- |
| `npm run check`                        | Scratch hook proof, types, lint, tests, build and both packaging dry runs |
| `npm run lint`                         | ShellCheck 0.11.0, Prettier, ESLint and Markdown lint                     |
| `npm test`                             | Vitest, with at most four workers                                         |
| `npm run build`                        | Vite and retained assets                                                  |
| `make check`                           | Complete container profile, the default Make target                       |
| `make lint`, `make test`, `make build` | Optional aliases for this repository's categories                         |
| `make previews`                        | Rebuild, then recapture the galaxy selector previews in `public/previews` |

Hook verification creates its own scratch Git repository and preserves the
caller's working files and index. `--output <proof.json>` selects explicit hook
evidence; the default output remains in owned scratch. Normal staged-file
formatting and fixes are unchanged. `internal:*` scripts retain the direct
commands used by the delivery runner and inner dispatcher.

## Container profile and CI

The byte-identical canonical `tests/container/run` has SHA-256
`3e63f48cff28d8ebbb2738f942417c7f2ed7e68f6fe313d48765517f29f14e17`.
It builds the repository's custom dependency-cache image from the explicit
`tests/container/context` inputs. The Node.js 24.22.2 Dockerfile, dependency
cache, scratch ownership, writable Vite caches and inner categories are unchanged.

Make exports the category list, build/test output paths and resource admission
callback. The launcher calls `tests/container/admit` before every image and
category start, with a five-second limit. It preserves revision, source hash,
dirty inventory and `SOURCE_DATE_EPOCH` provenance, and rejects changed source.
`make check` exports no artifacts. Explicit `make build` exports `dist/` and
`.cloudflare/output/v0/`; explicit `make test` exports only configured
`TEST_OUTPUTS`, empty by default. Exports validate and replace ignored generated
paths, removing stale content.

CI uses Make with this custom Dockerfile: `Lint` runs `make lint`; `Test` runs
`make test build`. `tools/ci-evidence.mjs` records source fingerprints around
those commands and copies the actual exported build into `.check-results/ci-test/`.
It verifies that retained `dist/`, CF assets and the evidence copy match.
Receipts label these explicit Make commands separately from detached adapter
execution. Both matrix jobs preserve their logs and receipts as CI artifacts.
`AI attributions` remains unchanged.

See [container compatibility](container-adoption.md) for runner boundaries.

## Scheduled gate image

The scheduled gate uses the immutable local image ID in `delivery-kit.json`.
Prepare that image on the delivery host before approving config adoption:

```bash
mkdir -p .check-results
tar --create --file .check-results/gate-context.tar \
  --mode='u+rwX,go+rX' --files-from tests/container/context
tests/container/admit build-image
docker build --resource cpu-period=100000 --resource cpu-quota=400000 \
  --resource memory=4g --ulimit nofile=256:256 \
  --iidfile .check-results/gate-image.id \
  --file tests/container/Dockerfile - < .check-results/gate-context.tar
node --input-type=module -e \
  'import{readFileSync}from"node:fs";const c=JSON.parse(readFileSync("delivery-kit.json"));if(readFileSync(".check-results/gate-image.id","utf8").trim()!==c.gate.image)throw Error("Prepared image differs from the approved image ID")'
```

Image IDs are local and content addressed. A rebuild can produce a different ID;
review and verify that image before changing the pin. Keep the prepared image
available on the delivery host. Config changes require separate operational
approval and do not start or restart the runner.

The shared Dockerfile supplies Node 24.22.2, ShellCheck 0.11.0 and the locked
dependencies. Its empty entrypoint permits delivery-kit 2.1.1 to start
`sleep infinity`; Make selects `/bin/sh` explicitly and dispatches the same inner
checks. The kit copies the read-only checkout into `/tmp/work`, installs locked
dependencies as UID 19001, disconnects networking and runs the three configured
`tests/container/check` categories directly. Native and scheduled lint both use
`internal:lint`, including ShellCheck. No runtime download provisions ShellCheck.

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
acceptance/rejection, types, the full tests, build and both packaging dry runs.
All categories invoke `tests/container/check` directly, without Make or Docker
inside the container. `internal:*` scripts are the only category command source.
Published kit API coverage belongs to the application tests.

Containers use UID/GID 19001, the checkout supplemental group, `HOME=/tmp`,
four CPUs and a four-worker test limit. The checkout mount
is read-only. The container layer is disposable writable scratch. An explicit source-file allowlist is copied to writable `/tmp`
scratch; Git metadata, nested worktrees, dependency directories, instruction
files and credential files are excluded. Host files receive no writable mount.
Logs and build outputs leave through `docker cp`. The Cloudflare Vite plugin
writes `.cloudflare/output/v0/`; the gate preserves that complete directory under
its evidence directory for prebuilt validation. The build retains an identical
`dist/` for the bus and browser harness, verifying its SHA-256 asset fingerprint
against the generated assets. The gate copies that retained `dist/` into evidence.

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

`cloudflare.config.ts` defines the existing assets-only Worker `ada-the-navigator`
with compatibility date `2026-11-10`, its shared account and custom domain, and
logs and traces enabled. The Cloudflare Vite plugin emits `.cloudflare/output/v0/`.
The inner build refreshes `dist/` from the generated assets and verifies
matching asset fingerprints. No application Worker entrypoint is configured.

Use the native dry-run scripts in the chosen Node.js 24.22.2 environment. The CF
prebuilt check validates production Build Output without rebuilding:

```bash
npm run deploy:prebuilt:dry-run
```

This runs `cf deploy --prebuilt --mode production --dry-run`. Vite records the
production mode, so the matching `--mode` is required. CF prebuilt validation
requires the complete reviewed `.cloudflare/output/v0/` directory.

The bus-compatible Wrangler packaging check uses the retained assets:

```bash
npm run deploy:wrangler:dry-run
```

This runs pinned Wrangler with `deploy --config wrangler.jsonc --no-bundle --dry-run`.
Root `wrangler.jsonc` points `assets.directory` to `./dist` and defines no Worker
entrypoint or build command. This route needs the gated `dist/` and locked
`node_modules/`, without Cloudflare's hidden output or a deployment rebuild.
Both dry runs are included in the isolated `all` and `test` gates.

Only delivery-kit 2.1.1 deploys the admitted gated artifact after exact-commit CI
passes and the remote commit matches. `delivery-kit.json` schedules hourly :00
America/Toronto with `deploy.mode` set to `wrangler`. Desired control remains
paused; game-dev enables only Ada after READY review. The monitor schedule is
unchanged. Existing OAuth authentication remains in place; credentials are not
part of the repository. No manual deployment is part of this procedure.

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

Exit 75 means the browser is still running. Collection saves browser and preview
logs, browser evidence and `verification.json` in `.check-results/<browser-name>/`
before removing the browser and preview containers and their internal network.
Evidence includes `desktop.png`, `phone.png`, `events.json` and `result.json`.
Both the source fingerprint and built-artifact hash must remain unchanged.

The harness uses a local static preview and Playwright in isolated containers,
with UID/GID 19001, the checkout supplemental group, `HOME=/tmp`, at most four
CPUs per container and read-only source/artifact mounts. Fetch
`mcr.microsoft.com/playwright/mcp:v0.0.83` before starting. Browser starts obey the
same local load restriction as the source gates.

Browser smoke coverage supports prototype integration review; it does not
establish story completeness or gameplay balance. Review the collected results
for the exact source revision before claiming a behavior is verified.

WORKAROUND: Nested Markdown overrides address [GHSA-gg6h-894w-4m9c](https://github.com/advisories/GHSA-gg6h-894w-4m9c)
and [GHSA-238p-pmpm-9mq7](https://github.com/advisories/GHSA-238p-pmpm-9mq7). Remove them once upstream dependencies include the fixes.
