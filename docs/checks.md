# Isolated checks

Use Node.js 24.22.2 (or supported Node.js 26.12.0+) and Docker. Fetch `node:24.22.2` before
starting checks. The orchestrator runs on the host; dependency installation,
hook verification, lint, type checks, tests and builds run inside Docker.

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

The `lint` mode runs `npm run lint`. The `test` mode runs `npm run check`,
`npm test -- --maxWorkers=4` and `npm run build`. Both install locked dependencies
and exercise `prepare` plus the actual pre-commit hook with staged TypeScript
and Markdown fixtures in a disposable Git repository. `all` combines both modes.
Published kit API coverage belongs to the application tests.

Containers use UID/GID 19001, the checkout supplemental group, `HOME=/tmp`,
four CPUs and a four-worker test limit. The checkout mount
is read-only. The container layer is disposable writable scratch. An explicit source-file allowlist is copied to writable `/tmp`
scratch; Git metadata, nested worktrees, dependency directories, instruction
files and credential files are excluded. Host files receive no writable mount.
Logs and build outputs leave through `docker cp`. The Cloudflare Vite plugin
writes `.cloudflare/output/v0/`; the gate preserves that complete directory under
its evidence directory for a reviewed prebuilt deployment. It also copies the
Worker's client assets to evidence `dist/` for the browser harness.

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

`cloudflare.config.ts` defines an assets-only Worker named `ada-the-navigator`
with compatibility date `2026-11-10` and logs and traces enabled. The Cloudflare
Vite plugin supplies its assets; there is no `assets.directory` setting or
application Worker entrypoint. `npm run build` remains `vite build` and emits
`.cloudflare/output/v0/` in the isolated checkout.

Run deployment dry runs only in an isolated Node.js 24.22.2 checkout. The first
command builds and validates without uploading; the second validates an existing
production build without rebuilding:

```bash
npm run deploy:dry-run
```

```bash
npm run deploy:prebuilt:dry-run
```

The prebuilt script runs `cf deploy --prebuilt --mode production --dry-run`.
Vite records the production mode in Build Output, so the matching `--mode` is
required. Restore the complete reviewed `.cloudflare/output/v0/` directory from
gate evidence at that same relative path before using a prebuilt command.
Evidence `dist/` is a browser-test copy of the assets, not a deployable substitute
for the complete Build Output.

The manual `npm run deploy:prebuilt` script runs
`cf deploy --prebuilt --mode production`. It uploads and deploys, and requires
explicit deployment approval plus authorized account access. It is not a CI
publication step. Existing OAuth authentication supports account discovery and
deployment; `faramir run` does not require project enrollment. The shared account and custom domain are explicit in source; credentials are not. Delivery remains paused with `deploy.mode`
set to `none`.

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
