import js from "@eslint/js";
import { defineConfig } from "eslint/config";
// WORKAROUND: https://github.com/un-ts/eslint-plugin-import-x/issues/569
import { createNodeResolver } from "eslint-plugin-import-x/node-resolver";
import extensions from "eslint-plugin-import-x/rules/extensions";
import noCycle from "eslint-plugin-import-x/rules/no-cycle";
import noRestrictedPaths from "eslint-plugin-import-x/rules/no-restricted-paths";
import globals from "globals";
import ts from "typescript-eslint";

import { plugins, sourceRules, toolingRules } from "./eslint.config.base.mjs";
import { importLayerConfigs } from "./tools/eslint-import-layers.mjs";

const SOURCE_FILES = ["src/**/*.ts"];
// The modules that draw with Phaser, under src/: the scene and the modules it delegates to.
// src/input/controls.ts builds the touch chrome as Phaser objects beside its input handling.
const PHASER_MODULES = [
  "game/camera/index",
  "game/chrome/index",
  "game/index",
  "game/scene",
  "game/sceneAndromeda",
  "game/sceneAssets",
  "game/sceneBackdrop",
  "game/sceneEffects",
  "game/sceneEnemies",
  "game/sceneForwardJets",
  "game/sceneGuideLights",
  "game/sceneHud",
  "game/sceneJump",
  "game/sceneObjects",
  "game/scenePhantom",
  "game/scenePhantomJump",
  "game/scenePhantomSong",
  "game/sceneShared",
  "game/sceneSprites",
  "game/sceneUi",
  "game/sceneWorld",
  "input/controls",
];
const PHASER_MESSAGE =
  `Only src/entry/main.ts and the Phaser modules (${PHASER_MODULES.join(", ")}) may import ` +
  "Phaser, the kit's phaser/ modules or a Phaser module.";
const PHASER_FILES = [
  "src/entry/main.ts",
  ...PHASER_MODULES.flatMap((module) => [`src/${module}.ts`, `src/${module}.test.ts`]),
];
const TEST_FILES = ["src/**/*.test.ts", "src/testSetup.ts"];

// The import boundaries, one row each: the files outside `except` may not import what `forbid`
// names. The model, data, layout, DOM interface and the rest of src/game/ stay free of Phaser, so
// they run in unit tests without a renderer; phaserModuleConfig keeps them free of the Phaser
// modules.
const BOUNDARIES = [
  {
    except: PHASER_FILES,
    forbid: { group: ["phaser", "phaser/*", "**/phaser/*"], message: PHASER_MESSAGE },
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

// Production modules outside PHASER_FILES import no Phaser module, by resolved path, so a
// same-directory import is caught as well. Tests may import any module.
const phaserModuleConfig = {
  files: SOURCE_FILES,
  ignores: [...PHASER_FILES, ...TEST_FILES],
  rules: {
    "import-x/no-restricted-paths": [
      "error",
      {
        zones: [
          {
            from: PHASER_MODULES.map((module) => `./src/${module}.ts`),
            message: PHASER_MESSAGE,
            target: "./src",
          },
        ],
      },
    ],
  },
};

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
  {
    files: ["src/ui/layout/**/*.ts", "src/ui/map/layout/**/*.ts"],
    ignores: TEST_FILES,
    rules: {
      "no-restricted-globals": [
        "error",
        { checkGlobalObject: true, globals: ["document", "getComputedStyle", "window"] },
      ],
    },
  },
  {
    files: ["src/{data,model}/**/*.ts"],
    ignores: TEST_FILES,
    rules: {
      "no-restricted-globals": [
        "error",
        {
          checkGlobalObject: true,
          globals: [
            { message: "Pass time into model decisions.", name: "Date" },
            { message: "Pass entropy into model decisions.", name: "crypto" },
            { message: "Pass saved state into model decisions.", name: "localStorage" },
            { message: "Pass time into model decisions.", name: "performance" },
          ],
        },
      ],
      "no-restricted-properties": [
        "error",
        { message: "Use an injected or seeded stream.", object: "Math", property: "random" },
      ],
    },
  },
  {
    // Keep the Local Map's emitted module order when its shared UI dependencies are one level up.
    files: ["src/ui/map/mapScreen.ts"],
    rules: {
      "simple-import-sort/imports": [
        "error",
        {
          groups: [
            ["^\\u0000"],
            ["^node:"],
            ["^@?\\w"],
            ["^"],
            [
              "^\\.",
              "^\\./(?:layout/|mapChromeTree\\.ts$)",
              "^\\.\\./mapCloseAction\\.ts$",
              "^\\./",
              "^\\.\\./weapons\\.ts$",
            ],
          ],
        },
      ],
    },
  },
  ...boundaryConfigs(),
  phaserModuleConfig,
  ...importLayerConfigs(import.meta.dirname),
  { files: ["*.{ts,js,mjs}", "tools/**/*.{ts,js,mjs}"], plugins, rules: toolingRules },
  // No import cycles: a module in a cycle can run before what it imports has loaded. no-cycle
  // skips `import { type A }`, which verbatimModuleSyntax keeps as a module load, so that form is
  // written `import type { A }`, which loads nothing.
  {
    files: ["**/*.{ts,js,mjs}"],
    plugins: {
      "import-x": {
        rules: { extensions, "no-cycle": noCycle, "no-restricted-paths": noRestrictedPaths },
      },
    },
    settings: {
      "import-x/extensions": [".ts"],
      "import-x/resolver-next": [createNodeResolver({ extensions: [".ts", ".js"] })],
    },
    rules: {
      "@typescript-eslint/no-import-type-side-effects": "error",
      "import-x/no-cycle": "error",
      "import-x/extensions": ["error", "ignorePackages", { checkTypeImports: true }],
    },
  },
);
