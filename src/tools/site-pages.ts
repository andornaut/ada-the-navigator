import { resolve } from "node:path";

import type { Plugin } from "vite";

const pages = {
  main: { output: "index.html", route: "/", source: "pages/index.html" },
  play: { output: "play/index.html", route: "/play/", source: "pages/play/index.html" },
} as const;

export function sitePageInputs(root: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(pages).map(([name, page]) => [name, resolve(root, page.source)]),
  );
}

/** Keep Cloudflare's config root while exposing the pages directory as public routes. */
export function sitePages(): Plugin {
  return {
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url) {
          const url = new URL(request.url, "http://localhost");
          if (url.pathname === "/play") {
            response.writeHead(308, { Location: `/play/${url.search}` });
            response.end();
            return;
          }
          const page = Object.values(pages).find((entry) => entry.route === url.pathname);
          if (page) {
            request.url = `/${page.source}${url.search}`;
          } else if (url.pathname.startsWith("/play/")) {
            request.url = `/pages${url.pathname}${url.search}`;
          }
        }
        next();
      });
    },
    enforce: "post",
    generateBundle: {
      handler(_options, bundle) {
        if (!Object.values(pages).some((page) => page.source in bundle)) {
          return;
        }
        for (const page of Object.values(pages)) {
          const asset = bundle[page.source];
          if (!asset || asset.type !== "asset") {
            this.error(`Missing built page: ${page.source}`);
          }
          delete bundle[page.source];
          asset.fileName = page.output;
          bundle[page.output] = asset;
        }
      },
      order: "post",
    },
    name: "ada-site-pages",
  };
}
