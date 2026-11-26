import { type Plugin, runnerImport } from "vite";

type StylesheetModule = typeof import("../ui/stylesheet.ts");

// The CSS module the game imports for the HTML interface's stylesheet.
// Ends in .css, so Vite's CSS pipeline takes it: a build bundles it into the importing chunk's CSS
// file, which the page links from its own origin as the CSP's style-src 'self' allows.

interface UiStylePluginOptions {
  readonly kind?: "crash" | "ui";
  // The module whose UI_STYLESHEET is the stylesheet's text (src/ui/stylesheet.ts), as an
  // absolute path.
  source: string;
}

// Serves the source module's UI_STYLESHEET, evaluated afresh on each load in a
// runner of its own, which keeps every module it evaluates. On the dev server, an edit to a file
// that load read (any style module or the layout tokens) reloads the stylesheet.
export function uiStylePlugin({ kind = "ui", source }: UiStylePluginOptions): Plugin {
  const resolvedId = `\0virtual:ada-${kind}.css`;
  const idFilter = new RegExp(`^virtual:ada-${kind}\\.css$`, "u");
  const resolvedIdFilter = new RegExp(`^\0virtual:ada-${kind}\\.css$`, "u");
  let sources = new Set<string>();
  return {
    configureServer(server) {
      server.watcher.on("all", (_event, file) => {
        if (!sources.has(file)) {
          return;
        }
        for (const environment of Object.values(server.environments)) {
          const module = environment.moduleGraph.getModuleById(resolvedId);
          if (module !== undefined) {
            void environment.reloadModule(module);
          }
        }
      });
    },
    load: {
      filter: { id: resolvedIdFilter },
      async handler() {
        const { dependencies, module } = await runnerImport<StylesheetModule>(source, {
          configFile: false,
        });
        sources = new Set(dependencies);
        // Watched, on the dev server and in a watching build.
        for (const file of dependencies) {
          this.addWatchFile(file);
        }
        return module.UI_STYLESHEET;
      },
    },
    name: `ada-the-navigator-${kind}-style`,
    resolveId: {
      filter: { id: idFilter },
      handler: () => resolvedId,
    },
  };
}
