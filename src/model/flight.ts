import type { PrototypeContent, SectorId } from "../data/types.ts";
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
        if (kind === "enemy") {
          object.behavior =
            (["pursue", "shoot", "guard"] as const)[Math.floor(next() * 3)] ?? "guard";
          object.cooldown = next() * tuning.enemyFireInterval;
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
  flight.objects = flight.objects.filter(
    (o) => o.kind === "destination" || distance(o, object) > content.tuning.safeRadius,
  );
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
function enemies(content: PrototypeContent, dt: number, flight: FlightState): boolean {
  let threatening = false;
  const protectedPlayer = safe(content, flight.player, flight);
  for (const enemy of flight.objects.filter((o) => o.kind === "enemy")) {
    enemy.cooldown = Math.max(0, (enemy.cooldown ?? 0) - dt);
    if (
      protectedPlayer ||
      safe(content, enemy, flight) ||
      distance(enemy, flight.player) >
        content.tuning.chunkSize * content.tuning.flight.engagementChunks
    ) {
      continue;
    }
    threatening = true;
    const heading = direction({ x: flight.player.x - enemy.x, y: flight.player.y - enemy.y });
    if (enemy.behavior === "pursue") {
      const next = {
        x:
          enemy.x +
          heading.x * content.tuning.maxSpeed * content.tuning.flight.pursuitSpeedFactor * dt,
        y:
          enemy.y +
          heading.y * content.tuning.maxSpeed * content.tuning.flight.pursuitSpeedFactor * dt,
      };
      if (!safe(content, next, flight)) {
        enemy.x = next.x;
        enemy.y = next.y;
      }
      if (
        distance(enemy, flight.player) < enemy.radius + content.tuning.flight.shipRadius &&
        enemy.cooldown === 0
      ) {
        damage(content, flight);
        enemy.cooldown = content.tuning.flight.damageInterval;
      }
    } else if (enemy.behavior === "guard") {
      if (
        distance(enemy, flight.player) < enemy.radius + content.tuning.flight.shipRadius &&
        enemy.cooldown === 0
      ) {
        damage(content, flight);
        enemy.cooldown = content.tuning.flight.damageInterval;
      }
    } else if (enemy.cooldown === 0) {
      flight.shots.push({
        ...enemy,
        enemy: true,
        hitIds: [],
        id: `shot:${flight.nextId++}`,
        life: content.tuning.flight.enemyProjectileLifetime,
        piercing: false,
        velocity: {
          x: heading.x * content.tuning.enemyProjectileSpeed,
          y: heading.y * content.tuning.enemyProjectileSpeed,
        },
      });
      enemy.cooldown = content.tuning.flight.enemyFireInterval;
    }
  }
  return threatening;
}
function shots(
  content: PrototypeContent,
  dt: number,
  flight: FlightState,
  events: FlightEvent[],
): void {
  for (const shot of flight.shots) {
    shot.life -= dt;
    const steps = Math.max(1, Math.ceil((length(shot.velocity) * dt) / 5));
    for (let i = 0; i < steps && shot.life > 0; i++) {
      shot.x += (shot.velocity.x * dt) / steps;
      shot.y += (shot.velocity.y * dt) / steps;
      if (shot.enemy) {
        if (safe(content, shot, flight)) {
          shot.life = 0;
        } else if (distance(shot, flight.player) < content.tuning.flight.shipRadius + 3) {
          damage(content, flight);
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
        object.hp -= content.tuning.flight.playerShotDamage;
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
    move(content, slice, input, flight);
    const aiming = length(input.aim) > 0.01;
    if (aiming) {
      flight.facing = direction(input.aim);
    }
    flight.fireCooldown = Math.max(0, flight.fireCooldown - slice);
    if (aiming && flight.fireCooldown <= 0) {
      fire(content, flight.facing, flight);
    }
    const threat = enemies(content, slice, flight);
    shots(content, slice, flight, events);
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
      distance(object, flight.player) <= content.tuning.safeRadius
    ) {
      events.push({ id: object.id, type: "discovered" });
    }
  }
  return events;
}
