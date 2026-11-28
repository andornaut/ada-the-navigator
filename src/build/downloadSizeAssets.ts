import type { Plugin } from "vite";

// Remove JSON whitespace without parsing and reserializing numbers or object members.
// String contents, escapes, numeric precision and member order remain byte-for-byte intact.
function compactJson(source: string): string {
  JSON.parse(source);
  return source.replace(/"(?:[^"\\]|\\[\s\S])*"|[\t\n\r ]+/g, (token) =>
    token.startsWith('"') ? token : "",
  );
}

// Art's emitted assets are available in generateBundle. Run before the kit's post-order
// precache hook so its content hashes and complete-build fingerprint cover the shipped bytes.
export function downloadSizeAssetsPlugin(): Plugin {
  return {
    apply: "build",
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== "asset" || !file.fileName.endsWith(".json")) {
          continue;
        }
        const source =
          typeof file.source === "string" ? file.source : new TextDecoder().decode(file.source);
        file.source = compactJson(source);
      }
    },
    name: "ada-download-size-assets",
  };
}
