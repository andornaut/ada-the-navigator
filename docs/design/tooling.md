# Tooling

The npm scripts call the check recipes in `tests/container/check`; every recipe but `typecheck`
and `bundle` runs only inside the check container, which Make starts from the custom dependency
image CI also uses. Containers start only when the one-minute load is below 20 and are capped at
four CPUs and four test workers. The `Test` workflow runs lint and test-and-build jobs through
Make; `AI attributions` is a separate required check. The Vite build reads `pages/` and
`public/`, compacts emitted JSON and writes `dist/`, the only directory Wrangler deploys.
`docs/` is never served or packaged.

Reference: [checks](../checks.md), [container adoption](../container-adoption.md),
[download size](../download-size.md), [Developing](../../README.md#developing),
[Deploying](../../README.md#deploying).

## Work items

| ID       | Title                                                                     | Link                               |
| -------- | ------------------------------------------------------------------------- | ---------------------------------- |
| ada-0002 | Prune test runtime per the testing policy                                 | [ada-0002.md](../work/ada-0002.md) |
| ada-0005 | Run only lint and attribution checks for docs-only changes                | [ada-0005.md](../work/ada-0005.md) |
| ada-0006 | Adopt design and work files                                               | [ada-0006.md](../work/ada-0006.md) |
| ada-0018 | Set up the browser starter, kit smoke tests and isolated checks           | [ada-0018.md](../work/ada-0018.md) |
| ada-0020 | Build for Cloudflare assets-only deployment with hourly delivery          | [ada-0020.md](../work/ada-0020.md) |
| ada-0022 | Admit local checks on resource availability and run them through Make     | [ada-0022.md](../work/ada-0022.md) |
| ada-0024 | Align staged checks, CI and lint tooling with the canonical configuration | [ada-0024.md](../work/ada-0024.md) |
| ada-0034 | Precache for offline play with install and update offers                  | [ada-0034.md](../work/ada-0034.md) |
| ada-0042 | Adopt published game-kit and art-kit releases                             | [ada-0042.md](../work/ada-0042.md) |
| ada-0044 | Adopt published delivery-kit releases                                     | [ada-0044.md](../work/ada-0044.md) |
| ada-0046 | Add the headless Stardust pacing simulation                               | [ada-0046.md](../work/ada-0046.md) |
| ada-0051 | Harden the browser smoke harness                                          | [ada-0051.md](../work/ada-0051.md) |
| ada-0071 | Close the three-game tooling gaps and show the build version              | [ada-0071.md](../work/ada-0071.md) |
| ada-0075 | Allow the Web Analytics beacon in the CSP                                 | [ada-0075.md](../work/ada-0075.md) |
| ada-0118 | Compact production JSON and precache galaxies progressively               | [ada-0118.md](../work/ada-0118.md) |
| ada-0126 | Preserve committed source identity in isolated checks                     | [ada-0126.md](../work/ada-0126.md) |
| ada-0131 | Permit optional analytics only on the landing page                        | [ada-0131.md](../work/ada-0131.md) |
| ada-0203 | Cut over to coordination-kit 1 and delivery-kit 5                         | [ada-0203.md](../work/ada-0203.md) |
| ada-0276 | Pin delivery-kit 5.0.1 and coordination-kit 1.0.1                         | [ada-0276.md](../work/ada-0276.md) |
| ada-0288 | Pin game-kit 0.58.1 so Android Chrome installs complete                   | [ada-0288.md](../work/ada-0288.md) |
| ada-0293 | Pin game-kit 0.58.2, delivery-kit 5.0.2 and coordination-kit 1.0.2        | [ada-0293.md](../work/ada-0293.md) |
| ada-0294 | Pin delivery-kit 6.0.0 and coordination-kit 1.2.0                         | [ada-0294.md](../work/ada-0294.md) |
| ada-0299 | Track every user request as a work item and pin coordination-kit 1.3.0    | [ada-0299.md](../work/ada-0299.md) |
| ada-0312 | Pin delivery-kit 6.1.1 and coordination-kit 2.0.1                         | [ada-0312.md](../work/ada-0312.md) |
| ada-0324 | Adopt game-kit 0.59.1 and install the complete build under one loader     | [ada-0324.md](../work/ada-0324.md) |
| ada-0327 | Pin art-kit 0.32.0 for the decoded WebP checks                            | [ada-0327.md](../work/ada-0327.md) |
| ada-0328 | Pin delivery-kit 6.1.2 and coordination-kit 2.1.2                         | [ada-0328.md](../work/ada-0328.md) |
| ada-0331 | Pin delivery-kit 7.0.0 and coordination-kit 3.0.0                         | [ada-0331.md](../work/ada-0331.md) |
| ada-0332 | Retire generated Ada thrust and Classic idle SVGs                         | [ada-0332.md](../work/ada-0332.md) |
| ada-0344 | Use the workspace memory limit for browser and preview containers         | [ada-0344.md](../work/ada-0344.md) |
| ada-0348 | Discover deployed updates after reconnect and resume                      | [ada-0348.md](../work/ada-0348.md) |
| ada-0349 | Check for updates when returning to Start                                 | [ada-0349.md](../work/ada-0349.md) |
| ada-0351 | Reuse keyline textures across animation frames                            | [ada-0351.md](../work/ada-0351.md) |
| ada-0391 | Drop the routine alternate-world test run                                 | [ada-0391.md](../work/ada-0391.md) |
| ada-0393 | Restructure the source into named layers with one entry per area          | [ada-0393.md](../work/ada-0393.md) |
| ada-0403 | Track Docker updates for Ada's check container                            | [ada-0403.md](../work/ada-0403.md) |
| ada-0405 | Reduce redundant tests and suite runtime                                  | [ada-0405.md](../work/ada-0405.md) |
| ada-0408 | Adopt Delivery Kit 8.6.0 with the existing gate                           | [ada-0408.md](../work/ada-0408.md) |
| ada-0413 | Start version discovery earlier and show continuous update progress       | [ada-0413.md](../work/ada-0413.md) |
