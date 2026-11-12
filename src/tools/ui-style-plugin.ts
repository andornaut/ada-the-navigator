import { type Plugin, runnerImport } from "vite";

type StylesheetModule = typeof import("../ui/stylesheet.ts");

// The CSS module the game imports for the HTML interface's stylesheet.
export const UI_STYLESHEET_ID = "virtual:ada-ui.css";
// Ends in .css, so Vite's CSS pipeline takes it: a build bundles it into the importing chunk's CSS
// file, which the page links from its own origin as the CSP's style-src 'self' allows.
const RESOLVED_ID = `\0${UI_STYLESHEET_ID}`;
// The hooks' filters, matching those ids alone, so the bundler calls them for no other module.
const ID_FILTER = /^virtual:ada-ui\.css$/;
const RESOLVED_ID_FILTER = /^\0virtual:ada-ui\.css$/;

interface UiStylePluginOptions {
  // The module whose UI_STYLESHEET is the stylesheet's text (src/ui/stylesheet.ts), as an
  // absolute path.
  source: string;
}

// Serves UI_STYLESHEET_ID: the source module's UI_STYLESHEET, evaluated afresh on each load in a
// runner of its own, which keeps every module it evaluates. On the dev server, an edit to a file
// that load read (any style module or the layout tokens) reloads the stylesheet.
export function uiStylePlugin({ source }: UiStylePluginOptions): Plugin {
  let sources = new Set<string>();
  return {
    configureServer(server) {
      server.watcher.on("all", (_event, file) => {
        if (!sources.has(file)) {
          return;
        }
        for (const environment of Object.values(server.environments)) {
          const module = environment.moduleGraph.getModuleById(RESOLVED_ID);
          if (module !== undefined) {
            void environment.reloadModule(module);
          }
        }
      });
    },
    load: {
      filter: { id: RESOLVED_ID_FILTER },
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
    name: "ada-the-navigator-ui-style",
    resolveId: {
      filter: { id: ID_FILTER },
      handler: () => RESOLVED_ID,
    },
  };
}
