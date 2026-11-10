import { createHash } from "node:crypto";
import { cpSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

function fingerprint(directory) {
  const files = [];
  function visit(relative) {
    for (const entry of readdirSync(join(directory, relative), { withFileTypes: true })) {
      const name = join(relative, entry.name);
      if (entry.isDirectory()) {
        visit(name);
      } else if (entry.isFile()) {
        files.push(name);
      } else {
        throw new Error(`Unexpected asset file type: ${name}`);
      }
    }
  }
  visit("");
  const hash = createHash("sha256");
  for (const name of files.sort()) {
    hash.update(name);
    hash.update("\0");
    hash.update(createHash("sha256").update(readFileSync(join(directory, name))).digest());
  }
  return hash.digest("hex");
}

const source = fileURLToPath(
  new URL("../.cloudflare/output/v0/workers/default/assets/", import.meta.url),
);
const target = fileURLToPath(new URL("../dist/", import.meta.url));
if (!statSync(join(source, "index.html")).isFile()) {
  throw new Error("Cloudflare build must produce the assets entrypoint");
}
const expected = fingerprint(source);
// delivery-kit retains dist and node_modules for deployment after exact-commit CI.
rmSync(target, { force: true, recursive: true });
cpSync(source, target, { recursive: true });
if (fingerprint(target) !== expected) {
  throw new Error("Retained dist differs from Cloudflare build assets");
}
console.log(`Retained assets SHA-256: ${expected}`);
