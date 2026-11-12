import js from "@eslint/js";
import { defineConfig } from "eslint/config";
// WORKAROUND: https://github.com/un-ts/eslint-plugin-import-x/issues/569
import { createNodeResolver } from "eslint-plugin-import-x/node-resolver";
import extensions from "eslint-plugin-import-x/rules/extensions";
import noCycle from "eslint-plugin-import-x/rules/no-cycle";
import globals from "globals";
import ts from "typescript-eslint";

import { plugins, sourceRules, toolingRules } from "./eslint.config.base.mjs";

const SOURCE_FILES = ["src/**/*.ts"];
// The modules that draw with Phaser, under src/: the scene and the modules it delegates to.
// src/input/controls.ts builds the touch chrome as Phaser objects beside its input handling.
const PHASER_MODULES = [
  "game/playCamera",
  "game/scene",
  "game/sceneAssets",
  "game/sceneBackdrop",
  "game/sceneEffects",
  "game/sceneEnemies",
  "game/sceneHud",
  "game/sceneJump",
  "game/sceneObjects",
  "game/sceneShared",
  "game/sceneSprites",
  "game/sceneUi",
  "game/sceneWorld",
  "game/touchChrome",
  "input/controls",
];
const PHASER_FILES = [
  "src/main.ts",
  ...PHASER_MODULES.flatMap((module) => [`src/${module}.ts`, `src/${module}.test.ts`]),
];
const TEST_FILES = ["src/**/*.test.ts", "src/testSetup.ts"];

// The import boundaries, one row each: the files outside `except` may not import what `forbid`
// names. The model, data, layout, DOM interface and the rest of src/game/ stay free of Phaser and
// the Phaser modules, so they run in unit tests without a renderer.
const BOUNDARIES = [
  {
    except: PHASER_FILES,
    forbid: {
      group: [
        "phaser",
        "phaser/*",
        "**/phaser/*",
        ...PHASER_MODULES.map((module) => `**/${module}.ts`),
      ],
      message:
        `Only src/main.ts and the Phaser modules (${PHASER_MODULES.join(", ")}) may import ` +
        "Phaser, the kit's phaser/ modules or a Phaser module.",
    },
  },
  {
    except: TEST_FILES,
    forbid: {
      group: ["**/testing", "**/testing/*"],
      message: "Only tests may import src/testing/.",
    },
  },
];

// Every way to pick some of the items, the empty pick included.
function subsets(items) {
  return items.reduce((picks, item) => [...picks, ...picks.map((pick) => [...pick, item])], [[]]);
}

// A files entry that matches only what matches one glob from each list: within a list the globs
// are alternatives, and a nested files array requires all of its globs.
function allOf(globLists) {
  return globLists
    .reduce(
      (combos, globs) => combos.flatMap((combo) => globs.map((glob) => [...combo, glob])),
      [[]],
    )
    .map((combo) => (combo.length === 1 ? combo[0] : combo));
}

// A later no-restricted-imports replaces an earlier one rather than adding to it, so the configs
// partition the files: one config per set of boundaries that binds a file, listing the patterns
// of every boundary in the set.
function boundaryConfigs() {
  return subsets(BOUNDARIES)
    .filter((binding) => binding.length > 0)
    .map((binding) => {
      const exempt = BOUNDARIES.filter((boundary) => !binding.includes(boundary));
      return {
        files: allOf([SOURCE_FILES, ...exempt.map(({ except }) => except)]),
        ignores: binding.flatMap(({ except }) => except),
        rules: {
          "no-restricted-imports": ["error", { patterns: binding.map(({ forbid }) => forbid) }],
        },
      };
    });
}

export default defineConfig(
  {
    // .claude/ and .worktrees/ hold agent and role worktrees: full copies of the repo that CI
    // never checks out.
    ignores: [
      ".claude/",
      ".cloudflare/",
      ".check-results/",
      ".worktrees/",
      ".wrangler/",
      "dist/",
      "node_modules/",
      "var/",
    ],
  },
  js.configs.recommended,
  ts.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  { files: SOURCE_FILES, plugins, rules: sourceRules },
  ...boundaryConfigs(),
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
