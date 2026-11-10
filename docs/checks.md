# Isolated checks

Use Node.js 24.21.0 or newer and Docker. Fetch `node:24.21.0` before
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
Logs and built `dist` outputs leave through `docker cp`.

Local starts are refused from :50 through :14 America/Toronto, or when one-minute
load is at least 20. `--ci` skips only those local scheduling checks and requires
`GITHUB_ACTIONS=true` plus `RUNNER_ENVIRONMENT=github-hosted`. Hosted CI uses the
same Docker isolation and emits the required `Lint` and `Test` checks.
The separate `AI attributions` workflow uses the canonical attribution action.

Do not change source between start and collect. Fingerprints include allowed
source content and Git's dirty-file inventory before and after the run.
Unsupported source paths cause a refusal and must be reviewed before being added
to the allowlist.
