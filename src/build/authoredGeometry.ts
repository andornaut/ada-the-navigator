import { normalizePath, type Plugin } from "vite";

// These authored JSON modules travel with the deferred game and often outlive source updates.
const AUTHORED_GEOMETRY = [
  "public/art/andromeda/enemies/hostileStationGarnet-hardpoints.json",
  "public/art/asteroids.json",
  "public/art/cartwheel/debris.json",
  "public/art/cartwheel/enemies/hostileStationClaim-hardpoints.json",
  "public/art/cartwheel/enemies/platformWheel-hardpoints.json",
  "public/art/cartwheel/ore-field.json",
  "public/art/enemies/archie-hardpoints.json",
  "public/art/enemies/fleetCapital-hardpoints.json",
  "public/art/enemies/fleetCapitalBroad-hardpoints.json",
  "public/art/enemies/fleetCapitalCrossbow-hardpoints.json",
  "public/art/enemies/fleetCapitalForked-hardpoints.json",
  "public/art/enemies/fleetCapitalManta-hardpoints.json",
  "public/art/enemies/fleetCapitalOutrigger-hardpoints.json",
  "public/art/enemies/fleetFighter-jets.json",
  "public/art/enemies/fleetFrigate-hardpoints.json",
  "public/art/enemies/fleetFrigateTwin-hardpoints.json",
  "public/art/enemies/fleetInterceptor-jets.json",
  "public/art/enemies/fleetRetaliator-hardpoints.json",
  "public/art/enemies/fleetRetaliator-jets.json",
  "public/art/enemies/fleetRetaliatorCargoHauler-hardpoints.json",
  "public/art/enemies/fleetRetaliatorCargoHauler-jets.json",
  "public/art/enemies/fleetRetaliatorMiningFreighter-hardpoints.json",
  "public/art/enemies/fleetRetaliatorMiningFreighter-jets.json",
  "public/art/enemies/fleetSwarm-jets.json",
  "public/art/enemies/hostileStationCoral-hardpoints.json",
  "public/art/enemy-weapons.json",
  "public/art/friendly-whales.json",
  "public/art/galaxies.json",
  "public/art/jobs.json",
  "public/art/needle/channels.json",
  "public/art/needle/eye.json",
  "public/art/needle/ring-gates.json",
  "public/art/ore-nugget.json",
  "public/art/pickups/pickups.json",
  "public/art/projects.json",
  "public/art/quantum-jump.json",
  "public/art/ship-nose.json",
  "public/art/stardust.json",
  "public/art/whirlpool/debris.json",
];

export function authoredGeometryChunk(repoPath: (path: string) => string): Plugin {
  const geometry = new Set(AUTHORED_GEOMETRY.map((path) => normalizePath(repoPath(path))));
  return {
    apply: "build",
    config(config) {
      const output = config.build?.rolldownOptions?.output;
      if (!output || Array.isArray(output) || typeof output.codeSplitting !== "object") {
        throw new Error("Expected Game Kit's chunk group configuration");
      }
      const { groups } = output.codeSplitting;
      if (!groups) {
        throw new Error("Expected Game Kit's existing chunk groups");
      }
      groups.push({
        name: "authored-geometry",
        test: (id) => geometry.has(normalizePath(id)),
      });
    },
    name: "ada-authored-geometry-chunk",
  };
}
