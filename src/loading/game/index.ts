/** Required asset admission for the dynamically imported game. */
export { requiredSceneFile, requireSceneFiles } from "./requiredFiles.ts";

// Keep the file-key registry's original initialization order relative to core validation.
export { requireBootJets, validateBootCore } from "./requiredCore.ts";
