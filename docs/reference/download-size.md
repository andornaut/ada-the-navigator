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

## Install and update archives

Game Kit serves gzip group archives independently of HTTP content encoding.
Count the archive requests the browser makes, the encoded body bytes, and the
complete deployable file inventory separately. The deployable inventory also
includes decoded copies used by older installed clients.

The deferred game loads Phaser and the authored geometry in separate groups.
Both groups are reusable across updates if their contents stay the same.
In a matched update where the geometry was unchanged, separating it reduced
the changed compressed group bodies from 1,077,979 to 481,405 bytes.
The split introduces one additional archive request on a fresh install.
