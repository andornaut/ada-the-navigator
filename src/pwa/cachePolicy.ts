import type { CachePolicy } from "@andornaut/game-kit/web/pwa/cachePolicy";

// The game's caching rules (the kit's pwa/cachePolicy), which the service worker and the precache
// build share. Content-hashed build output is under /assets/ and is served cache-first. The page
// and every other precached file, the art under /art/ and the web app manifest among them, are
// served network-first with the cached copy answering offline, so a deploy shows on the next load.
export const CACHE_POLICY: CachePolicy = {
  cacheNamePrefix: "ada-the-navigator-",
  hashedAssetPrefix: "/assets/",
};
