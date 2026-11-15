# Download size

The production build compacts emitted JSON assets before game-kit's precache hook
hashes their contents. Only insignificant JSON whitespace is removed. String
contents, escapes, numbers, member order and every asset URL are preserved. Source
art remains unchanged. The service worker stages and verifies the complete build
with the existing update policy.

Measure a production artifact inside the isolated check container:

```sh
node tools/download-size.mjs dist /tmp/download-size.json
```

The report includes file counts, raw bytes, per-file gzip level 9 and Brotli
quality 6 estimates, asset families, largest files and the complete offline
precache payload. Compression estimates exclude HTTP headers and are not observed
browser transfers. Repository storage, initial navigation, incremental updates and
browser cache reuse are separate measurements. Keep the build revision,
compression settings and source fingerprints with comparisons.

No precompressed sidecars are emitted. HTTP content encoding remains the serving
platform's responsibility. PNGs, SVGs, fonts, game code and offline coverage are
unchanged by JSON compaction.
