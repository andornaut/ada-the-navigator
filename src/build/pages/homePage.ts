import { readFile } from "node:fs/promises";

import type { Plugin } from "vite";

import {
  readShipMaterialPalettes,
  readShipMaterials,
  ShipMaterialSources,
} from "../../art/index.ts";
import { CONTROL_WORDS } from "../../data/controlWords.ts";
import { ECONOMY } from "../../data/economy.ts";
import { HOME_COPY } from "../../data/homeCopy.ts";
import { readQuantumJump } from "../../game/quantumJump.ts";
import { controlHelpMarkup, escaped } from "../../ui/controlHelp.ts";

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

const CLASSIC_SHIP = /%CLASSIC_SHIP_(26|40)%/gu;

export function prebootShipHtml(html: string, sources: ShipMaterialSources): string {
  return html.replace(CLASSIC_SHIP, (_, heading: string) => {
    const frame = sources.standaloneClassic(Number(heading));
    if (!frame) {
      throw new Error(`Required preboot ship heading ${heading} is missing`);
    }
    return frame.url;
  });
}

async function prebootShipSources(): Promise<ShipMaterialSources> {
  const art = new URL("../../../public/art/", import.meta.url);
  const json = async (path: string): Promise<unknown> =>
    JSON.parse(await readFile(new URL(path, art), "utf8"));
  const [payload, colors, jumpData] = await Promise.all([
    json("ship-materials.json"),
    json("ship-paint.json"),
    json("quantum-jump.json"),
  ]);
  const jump = readQuantumJump(jumpData);
  const geometry =
    jump &&
    readShipMaterials(
      { poses: jump.warp.poses.map(({ id }) => id), warpHeading: jump.warp.heading },
      payload,
    );
  const palettes = readShipMaterialPalettes(ECONOMY.paintOrder, colors);
  if (!geometry || !palettes) {
    throw new Error("Required preboot ship materials are invalid");
  }
  return new ShipMaterialSources(geometry, palettes);
}

// Resolve the two pre-script Classic images before Vite resolves HTML asset paths.
export function homePagePlugin(): Plugin {
  return {
    name: "ada-home-page-copy",
    transformIndexHtml: {
      async handler(html) {
        const resolved = homePageHtml(HOME_COPY, html);
        return resolved.includes("%CLASSIC_SHIP_")
          ? prebootShipHtml(resolved, await prebootShipSources())
          : resolved;
      },
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
