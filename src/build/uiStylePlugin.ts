import { type Plugin, runnerImport } from "vite";

type StylesheetModule = typeof import("../ui/stylesheet.ts");
type BootColoursModule = typeof import("../ui/layout/bootSplashColours.ts");

// The CSS module the game imports for the HTML interface's stylesheet.
// Ends in .css, so Vite's CSS pipeline takes it: a build bundles it into the importing chunk's CSS
// file, which the page links from its own origin as the CSP's style-src 'self' allows.

type UiStylePluginOptions = {
  // Absolute path to the module that provides the stylesheet or the boot colours.
  readonly source: string;
} & ({ readonly kind?: "crash" | "ui" } | { readonly kind: "boot"; readonly stylesheet: string });

// Evaluate the layout tokens in the build rather than the browser. The boot stylesheet keeps
// its HTML link so it can paint before any application code executes.
export function uiStylePlugin(options: UiStylePluginOptions): Plugin {
  const { kind = "ui", source } = options;
  const resolvedId = `\0virtual:ada-${kind}.css`;
  const idFilter = new RegExp(`^virtual:ada-${kind}\\.css$`, "u");
  const resolvedIdFilter = new RegExp(`^\0virtual:ada-${kind}\\.css$`, "u");
  const stylesheetIds = new Set(kind === "boot" ? [] : [resolvedId]);
  let sources = new Set<string>();
  async function readSource<T>(watch: (file: string) => void): Promise<T> {
    const { dependencies, module } = await runnerImport<T>(source, { configFile: false });
    sources = new Set(dependencies);
    for (const file of dependencies) {
      watch(file);
    }
    return module;
  }
  return {
    configureServer(server) {
      server.watcher.on("all", (_event, file) => {
        if (!sources.has(file)) {
          return;
        }
        for (const environment of Object.values(server.environments)) {
          for (const id of stylesheetIds) {
            const module = environment.moduleGraph.getModuleById(id);
            if (module !== undefined) {
              void environment.reloadModule(module);
            }
          }
        }
      });
    },
    name: `ada-the-navigator-${kind}-style`,
    ...(options.kind === "boot"
      ? {
          transform: {
            filter: { id: /\/bootSplash\.css(?:\?|$)/u },
            async handler(code, id) {
              if (id.split("?", 1)[0] !== options.stylesheet) {
                return null;
              }
              const { BOOT_SPLASH_COLOURS } = await readSource<BootColoursModule>((file) =>
                this.addWatchFile(file),
              );
              stylesheetIds.add(id);
              let css = code;
              for (const [name, colour] of Object.entries(BOOT_SPLASH_COLOURS)) {
                css = css.replaceAll(`var(--ada-boot-${name})`, colour);
              }
              return css;
            },
            order: "pre",
          },
        }
      : {
          load: {
            filter: { id: resolvedIdFilter },
            async handler() {
              const module = await readSource<StylesheetModule>((file) => this.addWatchFile(file));
              return module.UI_STYLESHEET;
            },
          },
          resolveId: {
            filter: { id: idFilter },
            handler: () => resolvedId,
          },
        }),
  };
}
