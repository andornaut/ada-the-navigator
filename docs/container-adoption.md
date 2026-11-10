# Container check adoption

CLEANUP (added 2026-11-10): Remove this adoption hold after exact source verification and atomic review
of the old npm gate commands, direct inner gate steps and resident compatibility.

## Held proposal

This isolated candidate applies the steps-only gate proposal in its own
`delivery-kit.json`. Canonical main and the resident remain unchanged.
`tests/container/run` is copied byte-identically from the approved foundation,
SHA-256 `44f1255396a1422872b4920b5607111e4bd46ea0ddd4d8013b9a14ee67fc67b2`.
It is not modified to add local behavior. No Docker proxy is used. Non-writable
execution creates the `/work` tmpfs with the runtime UID and GID, so scratch Git
uses actual workspace ownership without a `safe.directory` override.

The approved launcher invokes executable `tests/container/admit` before image building and before
every category start. The callback rejects load at or above 20 and emits phase
and load evidence; the launcher gives it five seconds. This resolves the per-start
resource admission blocker without a Docker proxy or local launcher changes.

Local source verification through Make and the detached receipt adapter is
authorized. This does not adopt the proposal, change live runner control or
authorize a manual bus departure. Ready compatible CI packages may be integrated and published with exact-commit CI
verification. This migration requires atomic gate-step and resident compatibility
review before integration. Static inspection alone does not establish runtime
success.

## Runner compatibility

[The gate-step proposal](delivery-make-proposal.patch) changes only the gate
categories to direct `tests/container/check` calls. It is applied only in this isolated candidate; the patch remains the baseline
review artifact. The Node image pin, locked installation, schedule, deployment
route and live control remain unchanged.

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
