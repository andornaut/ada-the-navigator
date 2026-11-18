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

| ID       | Title                                                      | Link                               |
| -------- | ---------------------------------------------------------- | ---------------------------------- |
| ada-0002 | Prune test runtime per the testing policy                  | [ada-0002.md](../work/ada-0002.md) |
| ada-0005 | Run only lint and attribution checks for docs-only changes | [ada-0005.md](../work/ada-0005.md) |
| ada-0006 | Adopt design and work files                                | [ada-0006.md](../work/ada-0006.md) |
