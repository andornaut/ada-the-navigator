# Ada the Navigator

Browser-game infrastructure using the shared art-kit, game-kit and delivery-kit.

Art, Gameplay and Tech coordinate through game-dev. Game design and production assets require an approved brief.

## Development

Use Node.js 24.21.0 or newer. Install the locked dependencies and start Vite:

```bash
npm ci && \
  npm run dev
```

The starter renders a neutral title and ready canvas. It defines no game rules
or production assets. Dependency installation enables the Husky pre-commit hook.

## Checks

Docker is required for verification. Start the complete isolated gate with:

```bash
node tools/checks.mjs start all
```

See [isolated checks](docs/checks.md) for collection, evidence, scheduling and
resource limits. CI requires `AI attributions`, `Lint` and `Test`.

## Delivery

Delivery is paused. `delivery-kit.json` proposes :30 America/Toronto and sets
`deploy.mode` to `none`. No runner or deployment is activated.

Future deployment requires a reviewed static build, an explicitly selected
deployment target and secret reference names, successful checks for the exact
source commit, and explicit runner activation. Credentials are not part of this
repository.
