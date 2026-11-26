// The import graph of src/ and tools/: no runtime import cycles, every module in a layer, and
// every module outside the tests importing only its own layer or a lower one, type-only imports
// included. Reads the sources with the TypeScript parser and follows relative specifiers: static
// imports, re-exports, dynamic import() and inline import("...") types.
// src/tests/importsCheck.test.ts runs it in the test category against KNOWN_VIOLATIONS.
// Usage: node tools/imports-check.ts, which prints every finding.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, posix, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

/** A layer of the shared source-structure bands, lowest first; finer layers order a band. */
export interface Layer {
  readonly band: string;
  readonly name: string;
  readonly holds: (path: string) => boolean;
}

// The Phaser scene and the src/game/ modules that serve it; the rest of src/game/ is art.
const SCENE_MODULES = new Set([
  "emergencyReturn",
  "persistence",
  "playCamera",
  "renderLoop",
  "routeArt",
  "shell",
  "shopView",
  "touchChrome",
]);
const INPUT_STATE = new Set([
  "src/input/coarsePointer.ts",
  "src/input/desktop.ts",
  "src/input/state.ts",
]);
const ENTRIES = new Set([
  "src/landing/main.ts",
  "src/lifecycle.ts",
  "src/loading/bootstrap.ts",
  "src/main.ts",
  "src/pwa/serviceWorker.ts",
]);
const SOURCE = /\.(?:mjs|mts|ts)$/u;
const TEST = /\.test\.ts$/u;

const sceneModule = (path: string) => {
  const name = /^src\/game\/([^/]+)\.ts$/u.exec(path)?.[1];
  return name !== undefined && (name.startsWith("scene") || SCENE_MODULES.has(name));
};

/** The layers, lowest first, each holding paths no other layer holds. */
export const LAYERS: readonly Layer[] = [
  {
    band: "Foundation",
    holds: (path) =>
      path.startsWith("public/") ||
      path === "package.json" ||
      path === "art/tools/svg-text.ts" ||
      (path.startsWith("src/") && path.endsWith(".css")),
    name: "assets",
  },
  {
    band: "Foundation",
    holds: (path) => path === "src/buildLabel.ts" || path.startsWith("src/view/"),
    name: "lib",
  },
  { band: "Foundation", holds: (path) => path.startsWith("src/data/"), name: "data" },
  { band: "Model", holds: (path) => path.startsWith("src/model/"), name: "model" },
  {
    band: "Presentation",
    holds: (path) => path.startsWith("src/game/") && !sceneModule(path),
    name: "art",
  },
  {
    band: "Presentation",
    holds: (path) => path.startsWith("src/ui/layout/") || INPUT_STATE.has(path),
    name: "layout and input state",
  },
  {
    band: "Platform",
    holds: (path) => /^src\/(?:crash|loading|pwa)\//u.test(path) && !ENTRIES.has(path),
    name: "platform",
  },
  {
    band: "Engine and views",
    holds: (path) => path.startsWith("src/ui/") && !path.startsWith("src/ui/layout/"),
    name: "ui",
  },
  {
    band: "Engine and views",
    holds: (path) => sceneModule(path) || path === "src/input/controls.ts",
    name: "scene",
  },
  { band: "Entries", holds: (path) => ENTRIES.has(path), name: "entry" },
  {
    band: "Support",
    holds: (path) =>
      path === "src/testSetup.ts" ||
      /^src\/(?:build|testing|tests)\//u.test(path) ||
      path.startsWith("tools/"),
    name: "support",
  },
];

/** The index in LAYERS of a repository path, or -1. Tests sit in the top layer, Support. */
export function layerOf(path: string): number {
  return TEST.test(path) ? LAYERS.length - 1 : LAYERS.findIndex((layer) => layer.holds(path));
}

/** A relative import: its target, and whether every import of it is type-only. */
export interface Import {
  readonly target: string;
  readonly typeOnly: boolean;
}

/** Each module's relative imports, keyed and targeted by repository path. */
export type Graph = ReadonlyMap<string, readonly Import[]>;

// Only `import type` and `export type` are erased: verbatimModuleSyntax keeps
// `import { type A }` and `export { type A } from` as module loads.
const typeOnlyImport = (node: ts.ImportDeclaration) =>
  node.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword;

/**
 * Every relative module specifier in a source: static imports and re-exports, dynamic import()
 * and inline import("...") types, each marked type-only when the module never loads at runtime.
 */
export function specifiers(source: string): { specifier: string; typeOnly: boolean }[] {
  const file = ts.createSourceFile("module.ts", source, ts.ScriptTarget.Latest, true);
  const found: { specifier: string; typeOnly: boolean }[] = [];
  const add = (node: ts.Node | undefined, typeOnly: boolean) => {
    if (node && ts.isStringLiteralLike(node) && node.text.startsWith(".")) {
      found.push({ specifier: node.text.replace(/\?.*$/u, ""), typeOnly });
    }
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      add(node.moduleSpecifier, typeOnlyImport(node));
    } else if (ts.isExportDeclaration(node)) {
      add(node.moduleSpecifier, node.isTypeOnly);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      add(node.arguments[0], false);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      add(node.argument.literal, true);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

function sources(root: string, dir: string): string[] {
  return (readdirSync(join(root, dir), { recursive: true }) as string[])
    .map((name) => posix.join(dir, name.split(sep).join("/")))
    .filter((path) => SOURCE.test(path) && !/\.d\.m?ts$/u.test(path))
    .sort();
}

/** The graph of every source under src/ and tools/. */
export function readGraph(root: string): Graph {
  const graph = new Map<string, Import[]>();
  for (const path of [...sources(root, "src"), ...sources(root, "tools")]) {
    const imports = new Map<string, boolean>();
    for (const { specifier, typeOnly } of specifiers(readFileSync(join(root, path), "utf8"))) {
      const target = posix.normalize(posix.join(posix.dirname(path), specifier));
      imports.set(target, (imports.get(target) ?? true) && typeOnly);
    }
    graph.set(
      path,
      [...imports]
        .map(([target, typeOnly]) => ({ target, typeOnly }))
        .sort((a, b) => a.target.localeCompare(b.target)),
    );
  }
  return graph;
}

/** The graph's runtime edges: every import that is not type-only. */
export function runtimeEdges(graph: Graph): Map<string, string[]> {
  return new Map(
    [...graph].map(([path, imports]) => [
      path,
      imports.filter(({ typeOnly }) => !typeOnly).map(({ target }) => target),
    ]),
  );
}

/** Each strongly connected component of more than one module, or a module importing itself. */
export function cycles(edges: ReadonlyMap<string, readonly string[]>): string[][] {
  let next = 0;
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const found: string[][] = [];
  const visit = (node: string): void => {
    index.set(node, next);
    low.set(node, next);
    next += 1;
    stack.push(node);
    for (const target of edges.get(node) ?? []) {
      if (!edges.has(target)) {
        continue;
      }
      if (!index.has(target)) {
        visit(target);
        low.set(node, Math.min(low.get(node)!, low.get(target)!));
      } else if (stack.includes(target)) {
        low.set(node, Math.min(low.get(node)!, index.get(target)!));
      }
    }
    if (low.get(node) !== index.get(node)) {
      return;
    }
    const component = stack.splice(stack.indexOf(node));
    if (component.length > 1 || edges.get(node)!.includes(node)) {
      found.push(component.sort());
    }
  };
  for (const node of [...edges.keys()].sort()) {
    if (!index.has(node)) {
      visit(node);
    }
  }
  return found;
}

/**
 * Each module in no layer, and each import of a higher or unplaced layer, type-only imports
 * included. Tests are exempt from the direction rule.
 */
export function layerFindings(graph: Graph): string[] {
  const findings: string[] = [];
  for (const [path, imports] of graph) {
    const layer = layerOf(path);
    if (layer < 0) {
      findings.push(`${path} is in no layer`);
      continue;
    }
    if (TEST.test(path)) {
      continue;
    }
    for (const { target } of imports) {
      const to = layerOf(target);
      if (to < 0) {
        findings.push(`${path} imports ${target}, which is in no layer`);
      } else if (to > layer) {
        findings.push(`${path} (${LAYERS[layer]!.name}) imports ${target} (${LAYERS[to]!.name})`);
      }
    }
  }
  return findings;
}

/**
 * One message per finding, sorted: each module in a runtime import cycle, then each layer
 * finding. Type-only imports may form cycles within a layer; across layers one of them points up.
 */
export function importFindings(graph: Graph): string[] {
  return [
    ...cycles(runtimeEdges(graph))
      .flat()
      .map((path) => `${path} is in a runtime import cycle`),
    ...layerFindings(graph),
  ].sort();
}

/**
 * CLEANUP (added 2026-11-25): today's findings, listed exactly so the check runs while the
 * restructure lands. An entry is removed when its violation is fixed, and the check fails on an
 * entry that no longer occurs, so the table only shrinks. Once it is empty this check is removed
 * and ESLint guards the layers.
 */
export const KNOWN_VIOLATIONS: readonly string[] = [
  "src/crash/crashScreen.ts (platform) imports src/ui/actionBinding.ts (ui)",
  "src/crash/crashScreen.ts (platform) imports src/ui/holdActionsAdapter.ts (ui)",
  "src/crash/crashScreen.ts (platform) imports src/ui/pressScope.ts (ui)",
  "src/data/asteroidCatalog.ts (data) imports src/model/types.ts (model)",
  "src/data/cheatCopy.ts (data) imports src/model/cheats.ts (model)",
  "src/data/storyShips.ts (data) imports src/model/types.ts (model)",
  "src/loading/progress.ts (platform) imports src/ui/loadingBar.ts (ui)",
  "src/loading/requiredFiles.ts (platform) imports src/ui/touchChrome.ts (ui)",
  "src/loading/startup.ts (platform) imports src/ui/actionBinding.ts (ui)",
  "src/loading/startup.ts (platform) imports src/ui/holdActionsAdapter.ts (ui)",
  "src/loading/startup.ts (platform) imports src/ui/loadingBar.ts (ui)",
  "src/loading/startup.ts (platform) imports src/ui/modal.ts (ui)",
  "src/loading/startup.ts (platform) imports src/ui/pressScope.ts (ui)",
  "src/ui/layout/controlPresentation.ts (layout and input state) imports src/ui/modal.ts (ui)",
  "src/ui/layout/fpsCounter.ts (layout and input state) imports src/ui/loadingBar.ts (ui)",
  "src/ui/layout/navigationButton.ts (layout and input state) imports src/ui/modal.ts (ui)",
  "src/ui/layout/navigationButton.ts (layout and input state) imports src/ui/pause.ts (ui)",
  "src/ui/layout/pauseCard.ts (layout and input state) imports src/ui/modal.ts (ui)",
  "src/ui/layout/questsScreen.ts (layout and input state) imports src/ui/modal.ts (ui)",
  "src/ui/layout/shipCard.ts (layout and input state) imports src/ui/modal.ts (ui)",
  "src/ui/layout/stationStyle.ts (layout and input state) imports src/ui/modal.ts (ui)",
  "src/ui/layout/stationStyle.ts (layout and input state) imports src/ui/uiSkin.ts (ui)",
];

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  for (const finding of importFindings(readGraph(root))) {
    console.log(finding);
  }
}
