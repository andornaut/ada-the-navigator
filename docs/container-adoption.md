# Container compatibility

## Check entry points

`make check` is the standard container entry. The optional `lint`, `test` and
`build` aliases support this repository's CI split. Native npm commands execute
directly in the calling environment, without Make. CI uses the Make profile
because the repository has a custom Dockerfile with its required dependency
cache and inner dispatcher.

`tests/container/run` matches the canonical source byte-for-byte, SHA-256
`3e63f48cff28d8ebbb2738f942417c7f2ed7e68f6fe313d48765517f29f14e17`.
The image build, dependency installation, literal command handling, exports,
network profile, resource admission callback and provenance rules are unchanged.
There is no separate native-command container interface.

## Runner and hook compatibility

The delivery runner and detached receipt adapter keep their direct
`tests/container/check` categories and `internal:*` commands. Hook and type
checks belong to `lint`; tests use at most four workers; build retains assets
and performs both packaging dry runs. The custom Node.js 24.22.2 Dockerfile
and published kit pins are unchanged.

Hook proof uses an owned scratch Git repository and explicit container evidence
output, preserving dirty caller files, hooks and staged changes. Default native
hook evidence stays in owned scratch. Ordinary lint-staged fixes remain enabled.

This source package does not change delivery configuration, schedules, live
control or the loaded resident. Publication and resident actions remain with
their existing owners and approval requirements.

## Evidence

CI executes Make directly and records stable source fingerprints, logs and the
exact exported build. The generic source-tar hash and the detached adapter's
source fingerprint remain distinct formats. Never relabel a result from one
execution path as another. Browser proof requires matching source receipts and
the actual reviewed `dist/` copy.
