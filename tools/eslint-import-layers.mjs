import { relative, sep } from "node:path";

import { layerFindings, readGraph, readImports, runtimeCycleFindings } from "./imports-check.ts";

export function importLayerConfigs(root) {
  const plugin = {
    rules: {
      direction: {
        create(context) {
          return {
            Program(node) {
              const path = relative(root, context.physicalFilename).split(sep).join("/");
              const imports = readImports(path, context.sourceCode.text);
              for (const message of layerFindings(new Map([[path, imports]]))) {
                context.report({ message, node });
              }
            },
          };
        },
      },
      "runtime-cycles": {
        create(context) {
          return {
            Program(node) {
              for (const message of runtimeCycleFindings(readGraph(root))) {
                context.report({ message, node });
              }
            },
          };
        },
      },
    },
  };

  return [
    {
      files: ["{src,tools}/**/*.{mjs,mts,ts}"],
      ignores: ["**/*.d.{mts,ts}"],
      plugins: { "ada-imports": plugin },
      rules: { "ada-imports/direction": "error" },
    },
    {
      // The full lint includes this file. Read a fresh graph here once, even in a long-lived
      // ESLint process. File lint uses the edited text for direction and import-x for cycles.
      files: ["eslint.config.mjs"],
      plugins: { "ada-imports": plugin },
      rules: { "ada-imports/runtime-cycles": "error" },
    },
  ];
}
