import type { Plugin } from "vite";

/**
 * The dev server's canonical game URL: /play redirects to /play/, keeping its query, as the
 * deployed site does. Vite's own fallback would serve the landing page there instead.
 */
export function sitePages(): Plugin {
  return {
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = request.url ? new URL(request.url, "http://localhost") : undefined;
        if (url?.pathname === "/play") {
          response.writeHead(308, { Location: `/play/${url.search}` });
          response.end();
          return;
        }
        next();
      });
    },
    name: "ada-site-pages",
  };
}
