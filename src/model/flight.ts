import { type EnemyArchetype, enemyCatalog, enemyEncounterTuning } from "../data/enemy-catalog.ts";
import type { PrototypeContent, SectorId } from "../data/types.ts";
import { createEnemy, damageEnemy, enemyEffects, stepDebris, stepEnemy } from "./enemy-ai.ts";
import type {
  FlightEvent,
  FlightInput,
  FlightState,
  SectorProgress,
  SpaceObject,
  Vec,
} from "./types.ts";

const length = (v: Vec) => Math.hypot(v.x, v.y);
const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
function direction(v: Vec): Vec {
  const size = length(v);
  return size ? { x: v.x / size, y: v.y / size } : { x: 0, y: 0 };
}
function hash(seed: number, x: number, y: number): number {
  let n = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}
function random(seed: number): () => number {
  let n = seed;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
function chunk(content: PrototypeContent, point: Vec): string {
  return `${Math.floor(point.x / content.tuning.chunkSize)},${Math.floor(point.y / content.tuning.chunkSize)}`;
}
function safe(content: PrototypeContent, point: Vec, flight: FlightState): boolean {
  return flight.objects.some(
    (o) => o.kind === "destination" && distance(point, o) <= content.tuning.safeRadius,
  );
}
function generate(content: PrototypeContent, point: Vec, flight: FlightState): void {
  const size = content.tuning.chunkSize;
  const tuning = content.tuning.flight;
  const weights = tuning.spawnWeights;
  const totalWeight = weights.resource + weights.rock + weights.enemy + weights.pickup;
  const cx = Math.floor(point.x / size);
  const cy = Math.floor(point.y / size);
  for (let x = cx - 2; x <= cx + 2; x++) {
    for (let y = cy - 2; y <= cy + 2; y++) {
      const key = `${x},${y}`;
      if (flight.chunks.includes(key)) {
        continue;
      }
      flight.chunks.push(key);
      const next = random(hash(flight.seed, x, y));
      generateRegion(content, x, y, flight);
      for (let i = 0; i < tuning.objectsPerChunk; i++) {
        const choice = next() * totalWeight;
        const kind =
          choice < weights.resource
            ? "resource"
            : choice < weights.resource + weights.rock
              ? "rock"
              : choice < weights.resource + weights.rock + weights.enemy
                ? "enemy"
                : "pickup";
        const object: SpaceObject = {
          hp: kind === "resource" || kind === "rock" ? tuning.rockHp : tuning.enemyHp,
          id: `chunk:${key}:${i}`,
          kind,
          radius: kind === "enemy" ? tuning.enemyRadius : tuning.rockRadius,
          x: (x + 0.1 + next() * 0.8) * size,
          y: (y + 0.1 + next() * 0.8) * size,
        };
        // Combat uses sparse seeded encounter regions rather than per-object rolls.
        if (kind === "enemy") {
          continue;
        }
        if (kind === "resource" || kind === "pickup") {
          object.role = "discovery";
        }
        if (kind === "pickup") {
          object.weapon =
            (["rapid", "spread", "pierce"] as const)[Math.floor(next() * 3)] ?? "rapid";
          object.radius = tuning.pickupRadius;
        }
        if (
          distance(object, flight.player) > content.tuning.safeRadius &&
          !safe(content, object, flight)
        ) {
          flight.objects.push(object);
        }
      }
    }
  }
}

function combat(flight: FlightState) {
  return (flight.combat ??= { initialPackSizes: {}, routeEncounters: [] });
}

function spawnEnemy(
  content: PrototypeContent,
  archetype: EnemyArchetype,
  id: string,
  point: Vec,
  packId: string | null = null,
  phase = 0,
): SpaceObject {
  const definition = enemyCatalog[archetype];
  return {
    ...point,
    enemy: createEnemy(definition, { archetype, id, packId, phase }, point),
    hp: definition.hp,
    id,
    kind: "enemy",
    radius: content.tuning.flight.shipRadius * definition.sizeRatio,
  };
}

function generateRegion(
  content: PrototypeContent,
  x: number,
  y: number,
  flight: FlightState,
): void {
  const size = content.tuning.chunkSize;
  // One encounter cell per quiet-distance grid; adjacent chunk traversal cannot duplicate it.
  const span = Math.max(3, Math.ceil(enemyEncounterTuning.quietDistance / size));
  if (x % span !== 0 || y % span !== 0) {
    return;
  }
  const next = random(hash(flight.seed ^ 9173, x, y));
  const center = { x: (x + 0.5) * size, y: (y + 0.5) * size };
  if (
    distance(center, flight.player) < content.tuning.safeRadius * 2 ||
    safe(content, center, flight)
  ) {
    return;
  }
  const region = Math.floor(next() * 4);
  if (region === 3) {
    const [low, high] = enemyEncounterTuning.debris.count;
    const count = low + Math.floor(next() * (high - low + 1));
    const angle = next() * Math.PI * 2;
    const [slow, fast] = enemyEncounterTuning.debris.speedRatio;
    const speed = content.tuning.maxSpeed * (slow + next() * (fast - slow));
    for (let i = 0; i < count; i++) {
      const point = { x: center.x + (next() - 0.5) * size, y: center.y + (next() - 0.5) * size };
      if (!safe(content, point, flight)) {
        flight.objects.push({
          ...point,
          hp: content.tuning.flight.rockHp,
          id: `ballistic:${x},${y}:${i}`,
          kind: "debris",
          radius: content.tuning.flight.rockRadius,
          velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        });
      }
    }
    return;
  }
  const packId = `pack:${x},${y}`;
  const [low, high] = enemyEncounterTuning.groupSize;
  const count = low + Math.floor(next() * (high - low + 1));
  const choices: EnemyArchetype[] = ["fighter", "swarm", "interceptor", "retaliator"];
  const archetype = choices[Math.floor(next() * choices.length)] ?? "fighter";
  let admitted = 0;
  for (let i = 0; i < count; i++) {
    const object = spawnEnemy(
      content,
      archetype,
      `${packId}:${i}`,
      {
        x: center.x + i * 85,
        y: center.y,
      },
      packId,
      next() * Math.PI * 2,
    );
    if (!safe(content, object, flight)) {
      flight.objects.push(object);
      admitted++;
    }
  }
  combat(flight).initialPackSizes[packId] = admitted;
  // Open, clustered and paired-wall regions share the same deterministic grid.
  if (region === 0) {
    return;
  }
  for (let i = 0; i < 8; i++) {
    const point =
      region === 1
        ? { x: center.x + (next() - 0.5) * size, y: center.y + (next() - 0.5) * size }
        : { x: center.x + (i - 4) * 75, y: center.y + (i % 2 ? 130 : -130) };
    if (!safe(content, point, flight)) {
      flight.objects.push({
        ...point,
        hp: content.tuning.flight.rockHp,
        id: `terrain:${x},${y}:${i}`,
        kind: "rock",
        radius: content.tuning.flight.rockRadius,
      });
    }
  }
}

/** Layout clearance changes the roster without recording a combat casualty. */
function clearLayoutObjects(keep: (object: SpaceObject) => boolean, flight: FlightState): void {
  flight.objects = flight.objects.filter((object) => {
    const liveEnemy =
      object.kind === "enemy" &&
      object.hp > 0 &&
      (!object.enemy || !enemyEffects(enemyCatalog[object.enemy.archetype], object.enemy).defeated);
    if (keep(object) || (liveEnemy && object.routeId)) {
      return true;
    }
    const packId = object.enemy?.packId;
    if (liveEnemy && packId) {
      const sizes = combat(flight).initialPackSizes;
      if (sizes[packId] !== undefined) {
        sizes[packId] = Math.max(0, sizes[packId] - 1);
      }
    }
    return false;
  });
}

/** Plan all guard positions before applying layout changes to their persistent state. */
function relocateRouteGuards(content: PrototypeContent, flight: FlightState): void {
  const guards = flight.objects.filter(
    (object) =>
      object.kind === "enemy" &&
      object.routeId &&
      object.hp > 0 &&
      (!object.enemy || !enemyEffects(enemyCatalog[object.enemy.archetype], object.enemy).defeated),
  );
  const destinations = flight.objects.filter((object) => object.kind === "destination");
  const positions = new Map<SpaceObject, Vec>();
  const maxRadius = flight.objects.reduce(
    (radius, object) => Math.max(radius, object.radius),
    content.tuning.safeRadius,
  );
  for (const guard of guards) {
    const point = { x: guard.x, y: guard.y };
    const stride = 2 * (guard.radius + maxRadius + 120);
    // Each obstacle excludes less than one stride, so finitely many obstacles cannot trap this search.
    while (
      destinations.some(
        (object) => distance(object, point) < content.tuning.safeRadius + guard.radius + 120,
      ) ||
      flight.objects.some(
        (object) =>
          object !== guard &&
          ["enemy", "rock", "resource", "debris"].includes(object.kind) &&
          object.hp > 0 &&
          distance(positions.get(object) ?? object, point) < object.radius + guard.radius + 20,
      )
    ) {
      point.x += stride;
    }
    positions.set(guard, point);
  }
  for (const [guard, point] of positions) {
    if (guard.x === point.x && guard.y === point.y) {
      continue;
    }
    guard.x = point.x;
    guard.y = point.y;
    if (guard.enemy) {
      guard.enemy.home = { ...point };
      guard.enemy.position = { ...point };
      guard.enemy.velocity = { x: 0, y: 0 };
    }
  }
}

export function routeBlocked(id: string, flight: FlightState): boolean {
  return flight.objects.some(
    (object) => object.kind === "enemy" && object.routeId === id && object.hp > 0,
  );
}

export function ensureRouteEncounter(
  content: PrototypeContent,
  id: string,
  flight: FlightState,
): SpaceObject | null {
  const existing = flight.objects.find(
    (object) => object.kind === "enemy" && object.routeId === id,
  );
  if (existing) {
    return existing;
  }
  if (combat(flight).routeEncounters.includes(id)) {
    return null;
  }
  const destination = flight.objects.find(
    (object) => object.kind === "destination" && object.id === id,
  );
  if (!destination) {
    return null;
  }
  const archetype =
    flight.sector === 1 ? "frigate" : flight.sector === 2 ? "capital" : "oversizedCapital";
  const radius = enemyCatalog[archetype].sizeRatio * content.tuning.flight.shipRadius;
  const heading = direction({
    x: flight.player.x - destination.x,
    y: flight.player.y - destination.y,
  });
  const approach = length(heading) ? heading : { x: 0, y: 1 };
  const offset = content.tuning.safeRadius + radius + 120;
  const point = { x: destination.x + approach.x * offset, y: destination.y + approach.y * offset };
  const object = spawnEnemy(content, archetype, `route:${id}`, point);
  object.routeId = id;
  // Clear the guard footprint and leave the protected destination untouched.
  clearLayoutObjects(
    (other) => other.kind === "destination" || distance(other, point) > other.radius + radius + 20,
    flight,
  );
  flight.objects.push(object);
  relocateRouteGuards(content, flight);
  combat(flight).routeEncounters.push(id);
  return object;
}

export function ensureDestination(
  content: PrototypeContent,
  id: string,
  flight: FlightState,
): SpaceObject {
  const existing = flight.objects.find((o) => o.id === id && o.kind === "destination");
  if (existing) {
    return existing;
  }
  const heading = direction(length(flight.velocity) ? flight.velocity : flight.facing);
  const span = content.tuning.chunkSize * 2;
  const index = flight.objects.filter((o) => o.kind === "destination").length;
  const offset = Math.ceil(index / 2) * (index % 2 ? 1 : -1) * content.tuning.safeRadius * 2.5;
  const target = {
    x: flight.player.x + heading.x * span - heading.y * offset,
    y: flight.player.y + heading.y * span + heading.x * offset,
  };
  while (
    flight.objects.some(
      (o) => o.kind === "destination" && distance(o, target) < content.tuning.safeRadius * 2,
    )
  ) {
    target.x -= heading.y * content.tuning.safeRadius * 2.5;
    target.y += heading.x * content.tuning.safeRadius * 2.5;
  }
  generate(content, target, flight);
  const object: SpaceObject = { ...target, hp: 1, id, kind: "destination", radius: 30, role: id };
  flight.objects.push(object);
  clearLayoutObjects(
    (o) => o.kind === "destination" || distance(o, object) > content.tuning.safeRadius,
    flight,
  );
  relocateRouteGuards(content, flight);
  flight.shots = flight.shots.filter(
    (s) => !s.enemy || distance(s, object) > content.tuning.safeRadius,
  );
  return object;
}

/** Reposition an undiscovered encounter only while its old location is outside the generated near field. */
export function placeDestinationAhead(
  content: PrototypeContent,
  id: string,
  flight: FlightState,
): SpaceObject {
  const existing = flight.objects.find((o) => o.id === id && o.kind === "destination");
  if (!existing || distance(existing, flight.player) > content.tuning.chunkSize * 2.5) {
    flight.objects = flight.objects.filter((o) => o !== existing);
    return ensureDestination(content, id, flight);
  }
  return existing;
}

export function createFlight(
  content: PrototypeContent,
  sector: SectorId,
  seed: number,
  progress: SectorProgress,
): FlightState {
  const flight: FlightState = {
    ammo: 0,
    cargo: 0,
    chunks: [],
    dangerFor: 0,
    exploredChunks: ["0,0"],
    facing: { x: 0, y: -1 },
    fireCooldown: 0,
    freshChunk: "0,0",
    freshDistance: 0,
    nextId: 0,
    objects: [],
    player: { x: 0, y: 0 },
    sector,
    seed,
    shield: content.tuning.shieldMax,
    shots: [],
    sinceDamage: content.tuning.shieldRechargeDelay,
    time: 0,
    velocity: { x: 0, y: 0 },
    weapon: "basic",
  };
  generate(content, flight.player, flight);
  for (const id of progress.known) {
    ensureDestination(content, id, flight);
  }
  return flight;
}

export function teleport(content: PrototypeContent, id: string, flight: FlightState): boolean {
  if (flight.dangerFor > 0) {
    return false;
  }
  const object = flight.objects.find((o) => o.kind === "destination" && o.id === id);
  if (!object) {
    return false;
  }
  generate(content, object, flight);
  flight.player = { x: object.x, y: object.y };
  flight.velocity = { x: 0, y: 0 };
  flight.freshChunk = null;
  const key = chunk(content, object);
  if (!flight.exploredChunks.includes(key)) {
    flight.exploredChunks.push(key);
  }
  flight.shots = flight.shots.filter(
    (s) => !s.enemy || distance(s, object) > content.tuning.safeRadius,
  );
  return true;
}

function fire(content: PrototypeContent, aim: Vec, flight: FlightState): void {
  if (flight.weapon !== "basic" && flight.ammo <= 0) {
    flight.weapon = "basic";
  }
  const weapon = flight.weapon;
  const angles =
    weapon === "spread"
      ? [-content.tuning.flight.spreadAngle, 0, content.tuning.flight.spreadAngle]
      : [0];
  for (const angle of angles) {
    const heading = {
      x: aim.x * Math.cos(angle) - aim.y * Math.sin(angle),
      y: aim.x * Math.sin(angle) + aim.y * Math.cos(angle),
    };
    flight.shots.push({
      ...flight.player,
      enemy: false,
      hitIds: [],
      id: `shot:${flight.nextId++}`,
      life: content.tuning.flight.projectileLifetime,
      piercing: weapon === "pierce",
      projectile: "bolt",
      velocity: {
        x: heading.x * content.tuning.maxSpeed * content.tuning.flight.projectileSpeedFactor,
        y: heading.y * content.tuning.maxSpeed * content.tuning.flight.projectileSpeedFactor,
      },
    });
  }
  flight.fireCooldown += content.tuning.fireInterval[weapon];
  if (weapon !== "basic") {
    flight.ammo--;
    if (flight.ammo <= 0) {
      flight.weapon = "basic";
    }
  }
}
function damage(content: PrototypeContent, flight: FlightState): void {
  if (safe(content, flight.player, flight)) {
    return;
  }
  flight.shield = Math.max(0, flight.shield - content.tuning.enemyDamage);
  flight.sinceDamage = 0;
  flight.dangerFor = content.tuning.dangerReleaseSeconds;
}
function move(
  content: PrototypeContent,
  dt: number,
  input: FlightInput,
  flight: FlightState,
): void {
  const magnitude = Math.min(1, length(input.move));
  const heading = direction(input.move);
  const response = magnitude ? content.tuning.accelerationSeconds : content.tuning.brakingSeconds;
  const blend = 1 - Math.exp(-dt / Math.max(0.001, response));
  flight.velocity.x +=
    (heading.x * magnitude * content.tuning.maxSpeed - flight.velocity.x) * blend;
  flight.velocity.y +=
    (heading.y * magnitude * content.tuning.maxSpeed - flight.velocity.y) * blend;
  // Stop subpixel drift so released controls stop advancing exploration.
  if (!magnitude && length(flight.velocity) < 0.01) {
    flight.velocity = { x: 0, y: 0 };
  }
  const start = { ...flight.player };
  const steps = Math.max(1, Math.ceil((length(flight.velocity) * dt) / 4));
  for (let i = 0; i < steps; i++) {
    const before = { ...flight.player };
    const key = chunk(content, before);
    for (const axis of ["x", "y"] as const) {
      flight.player[axis] += (flight.velocity[axis] * dt) / steps;
      if (
        flight.objects.some(
          (o) =>
            ["rock", "resource", "debris"].includes(o.kind) &&
            o.hp > 0 &&
            distance(o, flight.player) < o.radius + content.tuning.flight.shipRadius,
        )
      ) {
        flight.player[axis] = before[axis];
        flight.velocity[axis] = 0;
      }
    }
    const afterKey = chunk(content, flight.player);
    if (flight.freshChunk === key) {
      flight.freshDistance += distance(before, flight.player);
    }
    if (afterKey !== key) {
      flight.freshChunk = flight.exploredChunks.includes(afterKey) ? null : afterKey;
      if (!flight.exploredChunks.includes(afterKey)) {
        flight.exploredChunks.push(afterKey);
      }
    }
  }
  if (!length(input.aim) && distance(start, flight.player) > 0.001) {
    flight.facing = heading;
  }
}
function enemies(
  content: PrototypeContent,
  dt: number,
  flight: FlightState,
  events: FlightEvent[],
  shotDelays: Map<string, number>,
): boolean {
  let threatening = false;
  const objects = flight.objects.filter((object) => object.kind === "enemy" && object.hp > 0);
  for (const object of objects) {
    // Legacy saved ships gain canonical state without resetting their damage or identity.
    if (!object.enemy) {
      object.enemy = createEnemy(
        enemyCatalog.fighter,
        { archetype: "fighter", id: object.id, packId: null, phase: 0 },
        object,
      );
      object.enemy.hp = object.hp;
    }
  }
  const peers = objects.flatMap((object) => (object.enemy ? [object.enemy] : []));
  for (const object of objects) {
    const state = object.enemy!;
    const definition = enemyCatalog[state.archetype];
    const targetable = !safe(content, flight.player, flight) && !safe(content, object, flight);
    const visible = !flight.objects.some(
      (obstacle) =>
        ["rock", "resource", "debris"].includes(obstacle.kind) &&
        segmentDistance(obstacle, object, flight.player) < obstacle.radius,
    );
    const intent = stepEnemy(
      definition,
      {
        adaSpeed: content.tuning.maxSpeed,
        adaWidth: content.tuning.flight.shipRadius * 2,
        dt,
        initialPackSizes: combat(flight).initialPackSizes,
        peers,
        player: flight.player,
        speedCapRatio: enemyEncounterTuning.speedCapRatio,
        targetable,
        visibility: visible ? "visible" : "occluded",
      },
      { ...state, position: { x: object.x, y: object.y } },
    );
    object.enemy = intent.state;
    if (intent.effects.defeated) {
      object.hp = 0;
      events.push({ type: "enemyDisabled" });
      continue;
    }
    const steps = Math.max(1, Math.ceil((length(intent.velocity) * dt) / 4));
    for (let i = 0; i < steps; i++) {
      for (const axis of ["x", "y"] as const) {
        const point = { x: object.x, y: object.y };
        point[axis] += (intent.velocity[axis] * dt) / steps;
        const blocked = flight.objects.some(
          (other) =>
            other !== object &&
            (other.kind === "destination"
              ? distance(other, point) < content.tuning.safeRadius + object.radius
              : ["rock", "resource", "debris", "enemy"].includes(other.kind) &&
                other.hp > 0 &&
                distance(other, point) < other.radius + object.radius),
        );
        if (!blocked) {
          object[axis] = point[axis];
        } else {
          object.enemy.velocity[axis] = 0;
        }
      }
    }
    object.enemy.position = { x: object.x, y: object.y };
    threatening ||=
      targetable &&
      intent.state.engaged &&
      !intent.state.returning &&
      !intent.state.fleeing &&
      distance(object, flight.player) <= definition.perception;
    for (const fire of intent.fire) {
      const id = `shot:${flight.nextId++}`;
      shotDelays.set(id, fire.delay);
      flight.shots.push({
        ...fire.origin,
        enemy: true,
        hitIds: [],
        id,
        life: content.tuning.flight.enemyProjectileLifetime,
        piercing: false,
        projectile: fire.projectile,
        velocity: { x: fire.aim.x * fire.speed, y: fire.aim.y * fire.speed },
      });
    }
    object.cooldown = Math.max(0, (object.cooldown ?? 0) - dt);
    if (
      targetable &&
      distance(object, flight.player) < object.radius + content.tuning.flight.shipRadius &&
      !object.cooldown
    ) {
      damage(content, flight);
      object.cooldown = content.tuning.flight.damageInterval;
    }
  }
  return threatening;
}

function segmentDistance(point: Vec, start: Vec, end: Vec): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const square = dx * dx + dy * dy;
  const t = square
    ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / square))
    : 0;
  return distance(point, { x: start.x + dx * t, y: start.y + dy * t });
}

function moveDebris(content: PrototypeContent, dt: number, flight: FlightState): void {
  for (const object of flight.objects) {
    if (object.kind !== "debris" || !object.velocity) {
      continue;
    }
    object.cooldown = Math.max(0, (object.cooldown ?? 0) - dt);
    const next = stepDebris(dt, { id: object.id, position: object, velocity: object.velocity });
    // Protected regions absorb traveling debris without changing its ballistic heading.
    if (
      flight.objects.some(
        (destination) =>
          destination.kind === "destination" &&
          segmentDistance(destination, object, next.position) <
            content.tuning.safeRadius + object.radius,
      )
    ) {
      object.hp = 0;
      continue;
    }
    if (
      segmentDistance(flight.player, object, next.position) <
      object.radius + content.tuning.flight.shipRadius
    ) {
      if (!object.cooldown) {
        damage(content, flight);
        object.cooldown = content.tuning.flight.damageInterval;
      }
    }
    object.x = next.position.x;
    object.y = next.position.y;
  }
}

function shots(
  content: PrototypeContent,
  dt: number,
  flight: FlightState,
  events: FlightEvent[],
  shotDelays: ReadonlyMap<string, number>,
): void {
  for (const shot of flight.shots) {
    const elapsed = Math.max(0, dt - (shotDelays.get(shot.id) ?? 0));
    if (elapsed === 0) {
      continue;
    }
    shot.life -= elapsed;
    const steps = Math.max(1, Math.ceil((length(shot.velocity) * elapsed) / 5));
    for (let i = 0; i < steps && shot.life > 0; i++) {
      shot.x += (shot.velocity.x * elapsed) / steps;
      shot.y += (shot.velocity.y * elapsed) / steps;
      if (shot.enemy) {
        if (safe(content, shot, flight)) {
          shot.life = 0;
        } else if (distance(shot, flight.player) < content.tuning.flight.shipRadius + 3) {
          damage(content, flight);
          shot.life = 0;
        }
        if (
          flight.objects.some(
            (object) =>
              ["rock", "resource", "debris"].includes(object.kind) &&
              object.hp > 0 &&
              distance(shot, object) <= object.radius + 3,
          )
        ) {
          shot.life = 0;
        }
        continue;
      }
      for (const object of flight.objects) {
        if (
          !["enemy", "rock", "resource", "debris"].includes(object.kind) ||
          object.hp <= 0 ||
          shot.hitIds.includes(object.id) ||
          distance(shot, object) > object.radius + 3
        ) {
          continue;
        }
        shot.hitIds.push(object.id);
        if (object.kind === "enemy" && object.enemy) {
          const definition = enemyCatalog[object.enemy.archetype];
          const width = definition.sizeRatio * content.tuning.flight.shipRadius * 2;
          const part = definition.hardpoints.find(
            (part) =>
              object.enemy!.hardpoints.some((value) => value.id === part.id && value.hp > 0) &&
              distance(shot, {
                x: object.x + part.offset.x * width,
                y: object.y + part.offset.y * width,
              }) <=
                content.tuning.flight.shipRadius + 6,
          );
          // Large hulls only consume a shot at a live hardpoint; this keeps interior parts reachable.
          if (definition.hardpoints.length && !part) {
            shot.hitIds.pop();
            continue;
          }
          object.enemy = damageEnemy(
            definition,
            { amount: content.tuning.flight.playerShotDamage, hardpointId: part?.id ?? null },
            object.enemy,
          );
          object.hp = enemyEffects(definition, object.enemy).defeated
            ? 0
            : Math.max(1, object.enemy.hp);
        } else {
          object.hp -= content.tuning.flight.playerShotDamage;
        }
        if (!shot.piercing) {
          shot.life = 0;
        }
        if (object.hp <= 0) {
          if (object.kind === "enemy") {
            events.push({ type: "enemyDisabled" });
          }
          if (object.kind === "debris") {
            events.push({ id: object.id, type: "debrisCleared" });
          }
          if (object.kind === "resource") {
            for (let p = 0; p < content.tuning.flight.piecesPerRock; p++) {
              flight.objects.push({
                hp: 1,
                id: `piece:${flight.nextId++}`,
                kind: "pickup",
                radius: content.tuning.flight.pieceRadius,
                role: "cargo",
                x: object.x + (p - 1) * 12,
                y: object.y,
              });
            }
          }
        }
        if (shot.life <= 0) {
          break;
        }
      }
    }
  }
  flight.shots = flight.shots.filter((s) => s.life > 0);
  flight.objects = flight.objects.filter((o) => o.hp > 0);
}

export function stepFlight(
  content: PrototypeContent,
  dt: number,
  input: FlightInput,
  flight: FlightState,
): FlightEvent[] {
  const events: FlightEvent[] = [];
  if (!Number.isFinite(dt) || dt <= 0 || flight.shield <= 0) {
    return events;
  }
  let remaining = dt;
  while (remaining > 1e-9 && flight.shield > 0) {
    const slice = Math.min(remaining, 1 / 60);
    remaining -= slice;
    flight.time += slice;
    flight.sinceDamage += slice;
    generate(content, flight.player, flight);
    moveDebris(content, slice, flight);
    move(content, slice, input, flight);
    const aiming = length(input.aim) > 0.01;
    if (aiming) {
      flight.facing = direction(input.aim);
    }
    flight.fireCooldown = Math.max(0, flight.fireCooldown - slice);
    if (aiming && flight.fireCooldown <= 0) {
      fire(content, flight.facing, flight);
    }
    const shotDelays = new Map<string, number>();
    const threat = enemies(content, slice, flight, events, shotDelays);
    shots(content, slice, flight, events, shotDelays);
    for (const object of flight.objects) {
      if (
        object.kind === "hazard" &&
        distance(object, flight.player) < object.radius + content.tuning.flight.shipRadius
      ) {
        object.cooldown = Math.max(0, (object.cooldown ?? 0) - slice);
        if (!object.cooldown) {
          damage(content, flight);
          object.cooldown = content.tuning.flight.damageInterval;
        }
      }
      if (
        object.kind !== "pickup" ||
        distance(object, flight.player) > object.radius + content.tuning.flight.pickupReach
      ) {
        continue;
      }
      if (object.role === "cargo") {
        if (flight.cargo < content.tuning.cargoCapacity) {
          flight.cargo++;
          object.hp = 0;
        }
      } else if (object.weapon) {
        const ammo = content.tuning.weaponAmmo[object.weapon];
        flight.ammo =
          flight.weapon === object.weapon ? Math.min(ammo * 2, flight.ammo + ammo) : ammo;
        flight.weapon = object.weapon;
        object.hp = 0;
      }
    }
    flight.objects = flight.objects.filter((o) => o.hp > 0);
    const underFire = flight.shots.some(
      (s) => s.enemy && distance(s, flight.player) < content.tuning.safeRadius,
    );
    flight.dangerFor = safe(content, flight.player, flight)
      ? 0
      : threat || underFire
        ? content.tuning.dangerReleaseSeconds
        : Math.max(0, flight.dangerFor - slice);
    if (flight.sinceDamage >= content.tuning.shieldRechargeDelay) {
      flight.shield = Math.min(
        content.tuning.shieldMax,
        flight.shield + content.tuning.shieldRechargeRate * slice,
      );
    }
    if (flight.shield <= 0) {
      events.push({ type: "depleted" });
    }
  }
  for (const object of flight.objects) {
    if (
      object.kind === "destination" &&
      !routeBlocked(object.id, flight) &&
      distance(object, flight.player) <= content.tuning.safeRadius
    ) {
      events.push({ id: object.id, type: "discovered" });
    }
  }
  return events;
}
