// What vite.config.ts's plugins take from the repository's code, in one module so the kit's
// gameViteConfig loads it through a single Vite module runner, which resolves @andornaut/game-kit
// as the app does.
export { ICONS } from "../pwa/icons.ts";
export { precachePlugin } from "../pwa/precachePlugin.ts";
export { sitePages } from "./site-pages.ts";
export { hashedIconsPlugin } from "@andornaut/game-kit/web/pwa/vite/hashedIconsPlugin";
