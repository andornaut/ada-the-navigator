import js from "@eslint/js";
import { defineConfig } from "eslint/config";
// WORKAROUND: https://github.com/un-ts/eslint-plugin-import-x/issues/569
import { createNodeResolver } from "eslint-plugin-import-x/node-resolver";
import extensions from "eslint-plugin-import-x/rules/extensions";
import noCycle from "eslint-plugin-import-x/rules/no-cycle";
import globals from "globals";
import ts from "typescript-eslint";

import { plugins, sourceRules, toolingRules } from "./eslint.config.base.mjs";

export default defineConfig(
  { ignores: [".worktrees/", ".wrangler/", "dist/", "node_modules/"] },
  js.configs.recommended,
  ts.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  { files: ["src/**/*.ts"], plugins, rules: sourceRules },
  { files: ["*.{ts,js,mjs}", "tools/**/*.{ts,js,mjs}"], plugins, rules: toolingRules },
  {
    files: ["**/*.{ts,js,mjs}"],
    plugins: { "import-x": { rules: { extensions, "no-cycle": noCycle } } },
    settings: {
      "import-x/extensions": [".ts"],
      "import-x/resolver-next": [createNodeResolver({ extensions: [".ts", ".js"] })],
    },
    rules: {
      "import-x/no-cycle": "error",
      "import-x/extensions": ["error", "ignorePackages", { checkTypeImports: true }],
    },
  },
);
