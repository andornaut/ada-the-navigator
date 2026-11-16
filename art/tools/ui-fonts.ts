import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { encodeWoff2 } from "@andornaut/art-kit/build/woff2";

const source = fileURLToPath(new URL("../sources/fonts/liberation/", import.meta.url));
const output = process.argv[2]
  ? resolve(process.argv[2])
  : fileURLToPath(new URL("../../public/art/ui/fonts/liberation/", import.meta.url));
if (process.argv.length > 3) {
  throw new Error("Usage: node art/tools/ui-fonts.ts [output-directory]");
}

const fonts = await Promise.all(
  ["Regular", "Bold"].map(async (weight) => {
    const name = `LiberationSans-${weight}`;
    const bytes = await encodeWoff2(readFileSync(`${source}/${name}.ttf`));
    return { name, bytes };
  }),
);

mkdirSync(output, { recursive: true });
for (const { name, bytes } of fonts) {
  writeFileSync(`${output}/${name}.woff2`, bytes);
}
