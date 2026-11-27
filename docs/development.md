# Development

Ada uses [Phaser](https://phaser.io/), TypeScript and Vite. The
[package manifest](../package.json) and [lockfile](../package-lock.json) pin art-kit, game-kit and
delivery-kit. The [source architecture](../src/README.md) describes how the game uses them.

## Run locally

Use Node.js 24.22.2 from [`.nvmrc`](../.nvmrc). The package also supports Node.js 26 starting
at 26.12.0.

```bash
npm ci && \
  npm run dev
```

Open the URL printed by Vite, then follow Play to `/play/`. The website and game share an
origin, and the game keeps its [save data](../src/README.md#save-data) in that browser.
Dependency installation enables the [Husky pre-commit hook](../.husky/pre-commit), which formats
and checks staged files.

## Checks and builds

Use `make check` to run the full isolated profile, or `make lint`, `make test` and `make build`
for individual categories. See [isolated checks](checks.md) for the npm equivalents, Docker
requirements, CI, and build evidence.

| Command           | Result                                                       |
| ----------------- | ------------------------------------------------------------ |
| `npm run build`   | Build the website and game into `dist/`.                     |
| `npm run preview` | Build, then serve the output locally through `wrangler dev`. |
| `npm run format`  | Apply Prettier and ESLint fixes across the tree.             |
| `npm run clean`   | Remove generated `dist/` and `.wrangler/`.                   |

## Delivery

[Wrangler's configuration](../wrangler.jsonc) serves the checked `dist/` as
[Cloudflare Workers static assets](https://developers.cloudflare.com/workers/static-assets/).
The [deployment checks](checks.md#cloudflare-build-and-deployment-checks) describe the existing
Delivery Kit runner, its schedule, required CI and the packaging dry run.
