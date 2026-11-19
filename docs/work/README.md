# Work items

Each user request is one file, `docs/work/<id>.md`, whether or not it is approved. It records
scope and milestones; live progress (claims, blocks, receipts and acceptance) stays in the work
protocol state root. The [design index](../design/README.md) lists the work items of each area.

| Front matter | Content                                                                                                                                                                                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`         | `ada-` and a zero-padded sequence (`ada-0001`), allocated in chronological order.                                                                                                                                                                                           |
| `title`      | A short imperative title.                                                                                                                                                                                                                                                   |
| `status`     | `proposed` until the user approves, `declined` when the user declines, then `approved`, `done`, `cancelled` or `superseded`.                                                                                                                                                |
| `approved`   | A short approval or decision reference, such as `user, 2026-11-18`; a proposed item names the request. A backfilled item whose date comes only from history ends `(inferred from handoff history)`; one with no recorded approval is `unrecorded (<role>-shipped, <date>)`. |
| `design`     | The design area in `docs/design/`.                                                                                                                                                                                                                                          |
| `related`    | A list of related work IDs.                                                                                                                                                                                                                                                 |
| `supersedes` | The ID of the item this one replaces; omitted otherwise.                                                                                                                                                                                                                    |

The sections are Scope, Criteria, Decisions and Outcome. Decisions and Outcome state what was
decided or delivered, and why, in a line or two each.

- Only `main` edits design index tables and approved scope. Approval commits the work-file stub
  and its index row on `main`, and that commit allocates the ID.
- Workers edit only their own work file and the design prose that ships with their feature.
  Integration sets `status: done` in the landing merge commit itself, which is what proves landing
  and deployment.
- A changed or reverted decision is a new work item with `supersedes`. A finished item's outcome
  is never rewritten.
- Work files are public: no session IDs, hostnames, local home-directory paths or quoted
  conversation, only short approval references.
- Docs-only changes run only the attribution and lint checks ([ada-0005](ada-0005.md)).
- The game never serves or deploys `docs/`: the build reads `pages/` and `public/`, and
  deployment uploads only `dist/`.
