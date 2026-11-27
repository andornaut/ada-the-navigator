# Work items

Each tracked proposal or approved item has its own `docs/work/<id>.md` file for scope,
decisions and milestones. Find an item by ID here or by topic in the
[design index](../design/README.md). The coordination store records live ownership, blocks,
verification, delivery and acceptance separately.

| Front matter | Content                                                                                                                                                                                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`         | `ada-` and a zero-padded sequence (`ada-0001`), allocated in chronological order.                                                                                                                                                                                           |
| `title`      | A short imperative title.                                                                                                                                                                                                                                                   |
| `status`     | `proposed` until the user approves, `declined` when the user declines, then `approved`, `done`, `cancelled` or `superseded`.                                                                                                                                                |
| `approved`   | A short approval or decision reference, such as `user, 2026-11-18`; a proposed item names the request. A backfilled item whose date comes only from history ends `(inferred from handoff history)`; one with no recorded approval is `unrecorded (<role>-shipped, <date>)`. |
| `owner`      | The responsible role, when recorded.                                                                                                                                                                                                                                        |
| `design`     | The design area in `docs/design/`.                                                                                                                                                                                                                                          |
| `related`    | A list of related work IDs.                                                                                                                                                                                                                                                 |
| `supersedes` | The ID of the item this one replaces; omitted otherwise.                                                                                                                                                                                                                    |

The sections are Scope, Criteria, Decisions and Outcome. Decisions and Outcome state what was
decided or delivered, and why, in a line or two each.

- Only `main` edits design index tables and approved scope. Approval commits the work-file stub
  and its index row on `main`, and that commit allocates the ID.
- Workers edit only their own work file and the design prose that ships with their feature.
  Integration sets `status: done` with the landing commit. The delivery receipt records deployment
  when a release is required.
- A changed or reverted decision is a new work item with `supersedes`. A finished item's outcome
  is never rewritten.
- Work files are public: no session IDs, hostnames, local home-directory paths or quoted
  conversation, only short approval references.
- On an ordinary change confined to `docs/`, CI runs attribution and lint and skips the test and
  build job. See [isolated checks](../reference/checks.md#container-profile-and-ci) and
  [the docs-only check decision](ada-0005.md).
- The game never serves or deploys `docs/`: the build reads `pages/` and `public/`, and
  deployment uploads only `dist/`.
