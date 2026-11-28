// The import graph of src/ and tools/: no runtime import cycles, every module in a layer, and
// every module outside the tests importing only its own layer or a lower one and using the
// public entry of an encapsulated area, type-only imports included. Reads the sources with the
// TypeScript parser and follows relative specifiers: static
// imports, re-exports, dynamic import() and inline import("...") types.
// ESLint checks each file's imports and checks the whole runtime graph once per repository lint.
import { readdirSync, readFileSync } from "node:fs";
import { join, posix, sep } from "node:path";

import ts from "typescript";

/** A layer of the shared source-structure bands, lowest first; finer layers order a band. */
export interface Layer {
  readonly band: string;
  readonly name: string;
  readonly holds: (path: string) => boolean;
}

const INPUT_STATE = new Set([
  "src/input/coarsePointer.ts",
  "src/input/desktop.ts",
  "src/input/index.ts",
  "src/input/state.ts",
]);
const SOURCE = /\.(?:mjs|mts|ts)$/u;
const TEST = /\.test\.ts$/u;

const uiLayout = (path: string) => /^src\/ui\/(?:map\/)?layout\//u.test(path);

const ENCAPSULATED_AREAS = [
  "src/art/",
  "src/model/ai/worldNavigation/",
  "src/model/ai/",
  "src/model/phantom/allies/",
  "src/model/phantom/authored/",
  "src/model/phantom/pending/",
  "src/model/phantom/placement/",
  "src/model/phantom/reservations/",
  "src/model/phantom/state/",
  "src/model/phantom/",
  "src/model/stations/commerce/",
  "src/model/stations/formation/",
  "src/model/stations/primary/",
  "src/model/stations/",
  "src/model/world/",
  "src/saving/",
  "src/ui/achievements/",
  "src/ui/cheats/",
  "src/ui/conversation/",
  "src/ui/exchange/",
  "src/ui/flightFeedback/",
  "src/ui/galaxy/",
  "src/ui/menu/",
  "src/ui/pause/",
  "src/ui/quests/",
  "src/ui/resource/",
  "src/ui/restart/",
  "src/ui/settings/",
  "src/ui/ship/",
  "src/ui/start/",
  "src/ui/station/",
  "src/ui/weaponDetail/",
];

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
    holds: (path) => path === "src/buildLabel.ts",
    name: "lib",
  },
  { band: "Foundation", holds: (path) => path.startsWith("src/data/"), name: "data" },
  { band: "Model", holds: (path) => path.startsWith("src/model/"), name: "model" },
  { band: "Saving", holds: (path) => path.startsWith("src/saving/"), name: "saving" },
  {
    band: "Presentation",
    holds: (path) => path.startsWith("src/art/"),
    name: "art",
  },
  {
    band: "Presentation",
    holds: (path) => uiLayout(path) || INPUT_STATE.has(path),
    name: "layout and input state",
  },
  {
    band: "Platform",
    holds: (path) => /^src\/(?:loading|platform|pwa)\//u.test(path),
    name: "platform",
  },
  {
    band: "Engine and views",
    holds: (path) => path.startsWith("src/ui/") && !uiLayout(path),
    name: "ui",
  },
  {
    band: "Engine and views",
    holds: (path) =>
      path.startsWith("src/game/") ||
      path === "src/input/controls.ts" ||
      path === "src/input/desktopDom.ts",
    name: "scene",
  },
  { band: "Entries", holds: (path) => path.startsWith("src/entry/"), name: "entry" },
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

/** Normalize and coalesce the relative imports from one source. */
export function readImports(path: string, source: string): Import[] {
  const imports = new Map<string, boolean>();
  for (const { specifier, typeOnly } of specifiers(source)) {
    const target = posix.normalize(posix.join(posix.dirname(path), specifier));
    imports.set(target, (imports.get(target) ?? true) && typeOnly);
  }
  return [...imports]
    .map(([target, typeOnly]) => ({ target, typeOnly }))
    .sort((a, b) => a.target.localeCompare(b.target));
}

/** The graph of every source under src/ and tools/. */
export function readGraph(root: string): Graph {
  const graph = new Map<string, Import[]>();
  for (const path of [...sources(root, "src"), ...sources(root, "tools")]) {
    graph.set(path, readImports(path, readFileSync(join(root, path), "utf8")));
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
 * Reports unplaced modules, imports of higher or unplaced layers, and imports that bypass an
 * area's entry. Tests can inspect private modules directly.
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
      } else {
        const area = ENCAPSULATED_AREAS.find((prefix) => target.startsWith(prefix));
        if (area && !path.startsWith(area) && target !== `${area}index.ts`) {
          findings.push(`${path} imports ${target} directly. Use ${area}index.ts`);
        }
      }
    }
  }
  return findings;
}

/** Each module that belongs to a runtime import cycle. */
export function runtimeCycleFindings(graph: Graph): string[] {
  return cycles(runtimeEdges(graph))
    .flat()
    .map((path) => `${path} is in a runtime import cycle`);
}
