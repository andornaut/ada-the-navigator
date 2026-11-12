import { readFile } from "node:fs/promises";

import type { Plugin } from "vite";

import { CONTROL_WORDS } from "../data/control-words.ts";
import { HOME_COPY } from "../data/home-copy.ts";
import { controlHelpMarkup, escaped } from "../ui/control-help.ts";

interface HomeCopy {
  readonly description: string;
  readonly mobile: string;
}

// pages/index.html with each %HOME_<KEY>% token replaced by its escaped string, so the visible
// subline and its meta description come from one string. The Mobile controls line follows each
// named control with its icon, as the game's lessons do.
export function homePageHtml(copy: HomeCopy, html: string): string {
  const values: Readonly<Record<string, string>> = {
    DESCRIPTION: escaped(copy.description),
    MOBILE: controlHelpMarkup(CONTROL_WORDS, copy.mobile),
  };
  return html.replace(/%HOME_([A-Z_]+)%/gu, (_, key: string) => {
    const value = values[key];
    if (value === undefined) {
      throw new Error(`Unknown home page copy token ${key}`);
    }
    return value;
  });
}

// Renders the landing page's copy in dev and production, before HTML assets and headers are
// processed. The play page has no tokens and passes through.
export function homePagePlugin(): Plugin {
  return {
    name: "ada-home-page-copy",
    transformIndexHtml: {
      handler: (html) => homePageHtml(HOME_COPY, html),
      order: "pre",
    },
  };
}

const WEB_MANIFEST = "manifest.webmanifest";

// The web app manifest (public/manifest.webmanifest) with the landing page's description in
// place of its "%HOME_DESCRIPTION%" string.
export function webManifestJson(copy: HomeCopy, json: string): string {
  if (!json.includes('"%HOME_DESCRIPTION%"')) {
    throw new Error(`${WEB_MANIFEST} has no "%HOME_DESCRIPTION%" description`);
  }
  return json.replace('"%HOME_DESCRIPTION%"', JSON.stringify(copy.description));
}

// Renders the manifest's description in dev and in the build output. In a build it runs after the
// kit's hashedIconsPlugin writes the manifest and before precachePlugin reads it, so vite.config.ts
// lists it between them.
export function webManifestPlugin(): Plugin {
  return {
    configureServer(server) {
      server.middlewares.use(`/${WEB_MANIFEST}`, (_request, response, next) => {
        readFile(`${server.config.publicDir}/${WEB_MANIFEST}`, "utf8").then((json) => {
          response.setHeader("Content-Type", "application/manifest+json");
          response.end(webManifestJson(HOME_COPY, json));
        }, next);
      });
    },
    enforce: "post",
    generateBundle(_options, bundle) {
      const file = bundle[WEB_MANIFEST];
      if (file?.type !== "asset") {
        this.error(`${WEB_MANIFEST} is not in the build output`);
      }
      const { source } = file;
      file.source = webManifestJson(
        HOME_COPY,
        typeof source === "string" ? source : new TextDecoder().decode(source),
      );
    },
    name: "ada-web-manifest",
  };
}
