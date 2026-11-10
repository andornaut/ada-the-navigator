# Container check adoption

CLEANUP (added 2026-11-10): Remove this adoption hold after the canonical admission
contract is approved, the exact source passes isolated verification, and the
existing runner adopts the reviewed gate-step change.

## Held proposal

The prepared Make surface is separate from the active source and resident.
`tests/container/run` is copied byte-identically from the approved foundation,
SHA-256 `3e2d24919f32292713f8e612ca13a350ade76589f6fef20f27af297b81940196`.
It is not modified to add local behavior. No Docker proxy is used.

The repository wrapper rejects initial load at or above 20. The approved launcher
also invokes executable `tests/container/admit` before image building and before
every category start. The callback rejects load at or above 20 and emits phase
and load evidence; the launcher gives it five seconds. This resolves the per-start
resource admission blocker without a Docker proxy or local launcher changes.

Local source verification through Make and the detached receipt adapter is
authorized. This does not adopt the proposal, change live runner control or
authorize a manual bus departure. Source publication and resident/configuration
adoption remain held for owner review. Static inspection alone does not establish
runtime success.

## Runner compatibility

[The gate-step proposal](delivery-make-proposal.patch) changes only the gate
categories to direct `tests/container/check` calls. It is a proposal, not an
applied configuration. Root `delivery-kit.json`, the Node image pin, locked
installation, schedule, deployment route and live control remain unchanged.

The existing kit and receipt adapter install dependencies in `/tmp/work` and call
the same inner entry there. The generic image uses `/work` and cached dependencies
from `/opt/check`. Both paths require UID 19001 inside Docker. The inner dispatcher
never invokes Make or Docker. Hook and type checks belong to `lint`; tests use at
most four workers; build includes both packaging dry runs and retained assets.

The public npm aliases now enter Make. The existing runner's old npm gate commands
must not adopt these aliases independently of the reviewed gate-step proposal.
Runner admission, publication and activation remain the existing owners' duties.
No image or kit-pin adoption is included in the proposal.

## Required verification before adoption

- Confirm Docker's capped-build flags on each execution environment, including CI.
- Validate the cached image's native dependencies and writable Vite cache directories
  under UID 19001, read-only root, scratch limits and nofile 256.
- Run all three categories and installed hook acceptance/rejection without recursion.
- Check exported `dist/` matches the CF assets and both dry runs pass.
- Verify source hashes and dirty inventory stay stable across all categories.
- Verify the unchanged receipt format still feeds browser proof from its exact artifact.

The generic launcher's source-tar hash and the receipt adapter's source fingerprint
are distinct formats. No generic result is relabeled as a browser receipt.
CI retains the detached receipt adapter and its artifact upload, with category
commands supplied by the shared inner dispatcher.
