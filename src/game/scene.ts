import Phaser from "phaser";

import { enemyCatalog } from "../data/enemy-catalog.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { SCREEN } from "../data/screen.ts";
import { createControls } from "../input/controls.ts";
import { GameModel } from "../model/game.ts";
import type { FlightInput, SpaceObject, Vec } from "../model/types.ts";
import { FeedbackSound, ModelFeedback } from "./feedback.ts";
import { readSave, writeSave } from "./persistence.ts";
import { StoryShell } from "./shell.ts";

interface Asset {
  id: string;
  path: string;
  width: number;
  height: number;
  displayWidth?: number;
  displayHeight?: number;
  frameWidth?: number;
  frameHeight?: number;
  pivot: Vec;
}

/** World axes project diagonally; controls continue to follow screen directions. */
function screenToWorld(vector: Vec): Vec {
  const x = vector.x / 2 + vector.y;
  const y = vector.y - vector.x / 2;
  const magnitude = Math.hypot(x, y);
  const strength = Math.min(1, Math.hypot(vector.x, vector.y));
  return magnitude === 0
    ? { x: 0, y: 0 }
    : { x: (x / magnitude) * strength, y: (y / magnitude) * strength };
}

export class PrototypeScene extends Phaser.Scene {
  private model = new GameModel(PROTOTYPE, readSave());
  private shell!: StoryShell;
  private controls!: ReturnType<typeof createControls>;
  private ink!: Phaser.GameObjects.Graphics;
  private ship!: Phaser.GameObjects.Image;
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private settingsOpen = false;
  private enabled: boolean | undefined;
  private durable = "";
  private savedAt = 0;
  private feedback = new ModelFeedback();
  private feedbackSound = new FeedbackSound();
  private screenShake = true;

  constructor() {
    super("prototype");
  }

  preload(): void {
    this.load.once("filecomplete-json-art-manifest", () => {
      const manifest = this.cache.json.get("art-manifest") as { assets: Asset[] };
      for (const asset of manifest.assets) {
        if (asset.path.endsWith(".svg")) {
          this.load.svg(asset.id, asset.path);
        } else if (asset.frameWidth && asset.frameHeight) {
          this.load.spritesheet(asset.id, asset.path, {
            frameHeight: asset.frameHeight,
            frameWidth: asset.frameWidth,
          });
        }
      }
    });
    this.load.json("art-manifest", "/art/manifest.json");
  }

  create(): void {
    const fit = (): void => {
      this.cameras.main.setViewport(
        Math.floor((this.scale.gameSize.width - SCREEN.width) / 2),
        0,
        SCREEN.width,
        SCREEN.height,
      );
    };
    fit();
    this.scale.on(Phaser.Scale.Events.RESIZE, fit);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off(Phaser.Scale.Events.RESIZE, fit),
    );
    this.ink = this.add.graphics();
    this.ship = this.add.image(0, 0, "ship").setDepth(10);
    const manifest = this.cache.json.get("art-manifest") as { assets: Asset[] } | undefined;
    const ship = manifest?.assets.find((asset) => asset.id === "ship");
    this.ship.setDisplaySize(ship?.displayWidth ?? 28, ship?.displayHeight ?? 42);
    this.ship.setOrigin(ship?.pivot.x ?? 0.5, ship?.pivot.y ?? 0.5);
    const apply = (action: () => void): void => {
      action();
      this.observeFeedback();
      this.controls.reset();
      this.flush();
      this.refresh();
    };
    this.shell = new StoryShell({
      choose: (id) => apply(() => this.model.choose(id)),
      home: () => {
        if (!this.model.inDanger) {
          apply(() => this.model.returnHome());
        }
      },
      start: (sector) => apply(() => this.model.startSector(sector)),
      teleport: (id) => {
        if (!this.model.inDanger) {
          apply(() => this.model.teleport(id));
        }
      },
    });
    this.controls = createControls(this, {
      labels: {
        aimControls: PROTOTYPE.labels.aimControls ?? "",
        close: PROTOTYPE.labels.close ?? "",
        moveControls: PROTOTYPE.labels.moveControls ?? "",
        screenShake: PROTOTYPE.labels.screenShake ?? "",
        settings: PROTOTYPE.labels.settings ?? "",
        sound: PROTOTYPE.labels.sound ?? "",
      },
      onFeedbackChange: (settings) => {
        this.feedbackSound.enabled = settings.sound;
        this.screenShake = settings.screenShake;
        if (!settings.screenShake) {
          this.cameras.main.shakeEffect.reset();
        }
      },
      onPauseChange: (paused) => {
        this.settingsOpen = paused;
        this.flush();
      },
      onWeaponSelect: (weapon) => {
        if (!this.settingsOpen && this.model.state.mode === "space" && !this.model.state.dialogue) {
          apply(() => this.model.selectWeapon(weapon));
        }
      },
      weaponLabels: {
        ammo: PROTOTYPE.labels.ammo ?? "",
        group: PROTOTYPE.labels.weapon ?? "",
        names: {
          basic: PROTOTYPE.labels.weaponBasic ?? "",
          pierce: PROTOTYPE.labels.weaponPierce ?? "",
          rapid: PROTOTYPE.labels.weaponRapid ?? "",
          spread: PROTOTYPE.labels.weaponSpread ?? "",
        },
      },
    });
    const hide = (): void => {
      this.controls.reset();
      this.flush();
    };
    window.addEventListener("pointerdown", this.feedbackSound.unlock);
    window.addEventListener("keydown", this.feedbackSound.unlock);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", hide);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.flush();
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pointerdown", this.feedbackSound.unlock);
      window.removeEventListener("keydown", this.feedbackSound.unlock);
      this.feedbackSound.dispose();
      this.controls.dispose();
      this.shell.dispose();
      this.labels.clear();
    });
    this.observeFeedback();
    this.refresh();
  }

  override update(time: number, milliseconds: number): void {
    if (!this.controls) {
      return;
    }
    const state = this.model.state;
    this.feedback.advance(Math.min(milliseconds / 1000, 0.05));
    if (!this.settingsOpen && !document.hidden && state.mode === "space" && !state.dialogue) {
      const sampled = this.controls.sample();
      const input: FlightInput = {
        aim: screenToWorld(sampled.aim),
        move: screenToWorld(sampled.move),
        use: sampled.use,
      };
      this.model.step(Math.min(milliseconds / 1000, 0.05), input);
      this.observeFeedback();
    }
    this.refresh();
    this.draw();
    const durable = JSON.stringify([
      state.mode,
      state.selectedSector,
      state.progress,
      state.unlocked,
      state.dialogue,
    ]);
    if (durable !== this.durable || time - this.savedAt >= 1000) {
      this.flush();
      this.durable = durable;
      this.savedAt = time;
    }
  }

  private observeFeedback(): void {
    const kinds = this.feedback.observe(PROTOTYPE.tuning.maxSpeed * 0.1, this.model.state);
    this.feedbackSound.play(kinds);
    if (this.screenShake && kinds.includes("damage")) {
      this.cameras.main.shake(100, 0.002);
    }
  }

  private refresh(): void {
    const state = this.model.state;
    const enabled = state.mode === "space" && !state.dialogue;
    if (enabled !== this.enabled) {
      this.enabled = enabled;
      this.controls.setEnabled(enabled);
      this.controls.reset();
    }
    this.controls.setContext(enabled ? this.model.contextLabel : undefined);
    this.controls.setWeapons(this.model.weapons());
    this.shell.render(state, {
      destinations: this.model.destinations(),
      inDanger: this.model.inDanger,
      objective: this.model.objective,
    });
  }

  private flush(): void {
    this.shell.setSavingAvailable(writeSave(this.model.save()));
  }

  private project(point: Vec): Vec {
    const center = this.model.state.flight?.player ?? { x: 0, y: 0 };
    const x = point.x - center.x;
    const y = point.y - center.y;
    return { x: SCREEN.width / 2 + x - y, y: SCREEN.height / 2 + (x + y) / 2 };
  }

  private draw(): void {
    const flight = this.model.state.flight;
    this.ink.clear();
    this.ship.setVisible(Boolean(flight) && this.model.state.mode === "space");
    for (const label of this.labels.values()) {
      label.setVisible(false);
    }
    if (!flight || this.model.state.mode !== "space") {
      return;
    }
    // Stationary world markers provide motion cues without a navigation map.
    const cell = 160;
    const span = Math.ceil(Math.max(SCREEN.width, SCREEN.height) / cell) + 2;
    const gx = Math.floor(flight.player.x / cell);
    const gy = Math.floor(flight.player.y / cell);
    this.ink.fillStyle(0x525252, 0.6);
    for (let x = gx - span; x <= gx + span; x++) {
      for (let y = gy - span; y <= gy + span; y++) {
        const point = this.project({
          x: x * cell + ((y * 37) % 83),
          y: y * cell + ((x * 53) % 79),
        });
        this.ink.fillCircle(point.x, point.y, 1);
      }
    }
    for (const object of flight.objects) {
      this.drawObject(object);
    }
    this.ink.lineStyle(2, 0xffffff);
    for (const shot of flight.shots) {
      const point = this.project(shot);
      const tail = this.project({
        x: shot.x - shot.velocity.x * 0.035,
        y: shot.y - shot.velocity.y * 0.035,
      });
      if (shot.projectile === "missile") {
        const angle = Math.atan2(point.y - tail.y, point.x - tail.x);
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        this.ink.lineStyle(3, 0xffffff);
        this.ink.lineBetween(point.x - dx * 9, point.y - dy * 9, point.x, point.y);
        this.ink.lineStyle(1, 0x999999);
        this.ink.lineBetween(
          point.x - dx * 17,
          point.y - dy * 17,
          point.x - dx * 11,
          point.y - dy * 11,
        );
        this.ink.lineBetween(
          point.x - dx * 7 - dy * 4,
          point.y - dy * 7 + dx * 4,
          point.x,
          point.y,
        );
        this.ink.lineBetween(
          point.x - dx * 7 + dy * 4,
          point.y - dy * 7 - dx * 4,
          point.x,
          point.y,
        );
      } else {
        this.ink.lineStyle(2, 0xffffff);
        this.ink.lineBetween(tail.x, tail.y, point.x, point.y);
      }
    }
    this.drawDiscovery();
    this.drawFeedback();
    this.ship.setPosition(SCREEN.width / 2, SCREEN.height / 2);
    const thrust = Math.hypot(flight.velocity.x, flight.velocity.y) > 1;
    this.ship.setTexture(thrust ? "ship-thrust" : "ship");
    const dx = flight.facing.x - flight.facing.y;
    const dy = (flight.facing.x + flight.facing.y) / 2;
    if (dx || dy) {
      this.ship.setRotation(Math.atan2(dy, dx) + Math.PI / 2);
    }
    const activeIds = new Set(flight.objects.map((object) => object.id));
    for (const [id, label] of this.labels) {
      if (!activeIds.has(id)) {
        label.destroy();
        this.labels.delete(id);
      }
    }
  }

  private drawEnemy(point: Vec, object: SpaceObject): void {
    const enemy = object.enemy;
    if (!enemy) {
      this.ink.strokeTriangle(
        point.x,
        point.y + object.radius,
        point.x - object.radius,
        point.y - object.radius,
        point.x + object.radius,
        point.y - object.radius,
      );
      return;
    }
    const definition = enemyCatalog[enemy.archetype];
    const width = definition.sizeRatio * PROTOTYPE.tuning.flight.shipRadius * 2;
    // Hull and hardpoints share the runtime's fixed world axes.
    const local = (x: number, y: number): Vec =>
      this.project({ x: object.x + x * width, y: object.y + y * width });
    const large = enemy.archetype === "capital" || enemy.archetype === "oversizedCapital";
    const frigate = enemy.archetype === "frigate";
    const pack = enemy.packId !== null;
    const hull: [number, number][] = large
      ? [
          [-0.28, -0.5],
          [0.28, -0.5],
          [0.5, -0.25],
          [0.5, 0.4],
          [0.25, 0.5],
          [-0.25, 0.5],
          [-0.5, 0.4],
          [-0.5, -0.25],
        ]
      : frigate
        ? [
            [0, -0.6],
            [0.42, -0.25],
            [0.42, 0.4],
            [0, 0.55],
            [-0.42, 0.4],
            [-0.42, -0.25],
          ]
        : pack
          ? [
              [0, -0.6],
              [0.5, 0],
              [0.32, 0.4],
              [0, 0.2],
              [-0.32, 0.4],
              [-0.5, 0],
            ]
          : [
              [0, -0.6],
              [0.5, 0.45],
              [0, 0.2],
              [-0.5, 0.45],
            ];
    const polygon = hull.map(([x, y]) => {
      const point = local(x, y);
      return new Phaser.Math.Vector2(point.x, point.y);
    });
    this.ink.fillStyle(0x171717);
    this.ink.fillPoints(polygon, true);
    this.ink.lineStyle(1.5, 0xd4d4d4);
    this.ink.strokePoints(polygon, true);
    if (large) {
      const a = local(-0.16, -0.5);
      const b = local(-0.16, 0.5);
      const c = local(0.16, -0.5);
      const d = local(0.16, 0.5);
      this.ink.lineStyle(1, 0x777777);
      this.ink.lineBetween(a.x, a.y, b.x, b.y);
      this.ink.lineBetween(c.x, c.y, d.x, d.y);
    }
    if (pack) {
      this.ink.lineStyle(1, 0xffffff);
      this.ink.strokeCircle(point.x, point.y, 3);
    }
    for (const part of definition.hardpoints) {
      const at = local(part.offset.x, part.offset.y);
      const hp = enemy.hardpoints.find((value) => value.id === part.id)?.hp ?? 0;
      const size = Math.max(7, Math.min(18, width * 0.065));
      this.ink.fillStyle(hp > 0 ? 0x454545 : 0x101010);
      this.ink.lineStyle(2, hp > 0 ? 0xffffff : 0x777777);
      if (part.kind === "command") {
        this.ink.fillTriangle(
          at.x,
          at.y - size,
          at.x - size,
          at.y + size,
          at.x + size,
          at.y + size,
        );
        this.ink.strokeTriangle(
          at.x,
          at.y - size,
          at.x - size,
          at.y + size,
          at.x + size,
          at.y + size,
        );
      } else if (part.kind === "engine") {
        this.ink.fillRect(at.x - size, at.y - size * 0.6, size * 2, size * 1.2);
        this.ink.strokeRect(at.x - size, at.y - size * 0.6, size * 2, size * 1.2);
        if (hp > 0) {
          this.ink.lineBetween(at.x - size / 2, at.y + size, at.x - size / 2, at.y + size * 1.5);
          this.ink.lineBetween(at.x + size / 2, at.y + size, at.x + size / 2, at.y + size * 1.5);
        }
      } else {
        this.ink.fillCircle(at.x, at.y, size);
        this.ink.strokeCircle(at.x, at.y, size);
        this.ink.lineBetween(at.x, at.y, at.x, at.y - size * 1.5);
      }
      if (hp <= 0) {
        this.ink.lineBetween(at.x - size, at.y - size, at.x + size, at.y + size);
        this.ink.lineBetween(at.x + size, at.y - size, at.x - size, at.y + size);
      }
      this.ink.lineStyle(3, 0x555555);
      this.ink.lineBetween(at.x - size, at.y + size + 5, at.x + size, at.y + size + 5);
      if (hp > 0) {
        this.ink.lineStyle(3, 0xffffff);
        this.ink.lineBetween(
          at.x - size,
          at.y + size + 5,
          at.x - size + size * 2 * Math.min(1, hp / part.hp),
          at.y + size + 5,
        );
      }
    }
  }

  private drawDiscovery(): void {
    const flight = this.model.state.flight;
    if (!flight) {
      return;
    }
    const cx = SCREEN.width / 2;
    const cy = SCREEN.height / 2;
    const candidates = flight.objects
      .filter(
        (object) =>
          object.role === "discovery" && (object.kind === "pickup" || object.kind === "resource"),
      )
      .map((object) => this.project(object))
      .filter(
        (point) => point.x < 0 || point.y < 0 || point.x > SCREEN.width || point.y > SCREEN.height,
      )
      .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
    const target = candidates[0];
    // Provisional nearby range scales with the viewport, without revealing distant targets.
    if (
      !target ||
      Math.hypot(target.x - cx, target.y - cy) > Math.max(SCREEN.width, SCREEN.height) * 1.5
    ) {
      return;
    }
    const dx = target.x - cx;
    const dy = target.y - cy;
    const length = Math.hypot(dx, dy);
    const ux = dx / length;
    const uy = dy / length;
    const scale = Math.min((cx - 44) / Math.abs(dx), (cy - 100) / Math.abs(dy));
    const x = cx + dx * Math.max(0, scale);
    const y = cy + dy * Math.max(0, scale);
    this.ink.lineStyle(2, 0xffffff, 0.8);
    this.ink.strokeTriangle(
      x + ux * 8,
      y + uy * 8,
      x - ux * 5 - uy * 5,
      y - uy * 5 + ux * 5,
      x - ux * 5 + uy * 5,
      y - uy * 5 - ux * 5,
    );
    this.ink.strokeCircle(x - ux * 13, y - uy * 13, 3);
  }

  private drawFeedback(): void {
    for (const pulse of this.feedback.pulses) {
      const at = this.project(pulse);
      const radius = 12 + pulse.age * (pulse.kind === "teleport" ? 140 : 55);
      this.ink.lineStyle(
        pulse.kind === "damage" ? 3 : 1.5,
        0xffffff,
        Math.max(0, 1 - pulse.age / 0.65),
      );
      if (pulse.kind === "hit" || pulse.kind === "disabled") {
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          this.ink.lineBetween(
            at.x + Math.cos(angle) * radius,
            at.y + Math.sin(angle) * radius,
            at.x + Math.cos(angle) * (radius + 7),
            at.y + Math.sin(angle) * (radius + 7),
          );
        }
        if (pulse.kind === "disabled") {
          this.ink.strokeRect(at.x - radius, at.y - radius, radius * 2, radius * 2);
        }
      } else if (pulse.kind === "pickup" || pulse.kind === "deposit") {
        this.ink.strokePoints(
          [
            new Phaser.Math.Vector2(at.x, at.y - radius),
            new Phaser.Math.Vector2(at.x + radius, at.y),
            new Phaser.Math.Vector2(at.x, at.y + radius),
            new Phaser.Math.Vector2(at.x - radius, at.y),
          ],
          true,
        );
        if (pulse.kind === "deposit") {
          this.ink.strokeCircle(at.x, at.y, radius * 0.65);
        }
      } else {
        this.ink.strokeCircle(at.x, at.y, radius);
        if (pulse.kind === "damage") {
          this.ink.lineBetween(
            at.x - radius,
            at.y - radius,
            at.x - radius * 0.65,
            at.y - radius * 0.65,
          );
          this.ink.lineBetween(
            at.x + radius,
            at.y + radius,
            at.x + radius * 0.65,
            at.y + radius * 0.65,
          );
        }
        if (pulse.kind === "teleport") {
          this.ink.strokeCircle(at.x, at.y, radius * 0.6);
        }
      }
    }
  }

  private drawObject(object: SpaceObject): void {
    const point = this.project(object);
    const definition = object.enemy ? enemyCatalog[object.enemy.archetype] : undefined;
    const radius = definition
      ? Math.max(object.radius, definition.sizeRatio * PROTOTYPE.tuning.flight.shipRadius * 2)
      : object.radius;
    if (
      point.x < -radius - 60 ||
      point.y < -radius - 60 ||
      point.x > SCREEN.width + radius + 60 ||
      point.y > SCREEN.height + radius + 60
    ) {
      return;
    }
    this.ink.lineStyle(1.5, 0xd4d4d4);
    this.ink.fillStyle(0x222222);
    switch (object.kind) {
      case "destination": {
        this.ink.fillEllipse(point.x, point.y, radius * 2, radius);
        this.ink.strokeEllipse(point.x, point.y, radius * 2, radius);
        this.ink.strokeEllipse(point.x, point.y - 7, radius, radius * 0.6);
        const destination = this.model.destinations().find((entry) => entry.id === object.id);
        if (destination) {
          let label = this.labels.get(object.id);
          if (!label) {
            label = this.add
              .text(0, 0, destination.label, {
                backgroundColor: "#101010",
                color: "#ededed",
                fontFamily: '"Liberation Sans", sans-serif',
                fontSize: "14px",
              })
              .setOrigin(0.5, 0)
              .setDepth(5);
            this.labels.set(object.id, label);
          }
          label.setPosition(point.x, point.y + radius + 8).setVisible(true);
        }
        break;
      }
      case "hazard":
        this.ink.strokeCircle(point.x, point.y, radius);
        this.ink.lineBetween(
          point.x - radius / 2,
          point.y - radius / 2,
          point.x + radius / 2,
          point.y + radius / 2,
        );
        this.ink.lineBetween(
          point.x + radius / 2,
          point.y - radius / 2,
          point.x - radius / 2,
          point.y + radius / 2,
        );
        break;
      case "enemy":
        this.drawEnemy(point, object);
        break;
      case "pickup":
        this.ink.strokeRect(point.x - radius, point.y - radius, radius * 2, radius * 2);
        if (object.role === "cargo") {
          this.ink.fillStyle(0xffffff);
          this.ink.fillCircle(point.x, point.y, radius / 3);
        } else if (object.weapon === "rapid") {
          for (const offset of [-0.5, 0, 0.5]) {
            this.ink.lineBetween(
              point.x - radius / 2,
              point.y + radius * offset,
              point.x + radius / 2,
              point.y + radius * offset,
            );
          }
        } else if (object.weapon === "spread") {
          for (const offset of [-0.6, 0, 0.6]) {
            this.ink.lineBetween(
              point.x - radius / 2,
              point.y,
              point.x + radius / 2,
              point.y + radius * offset,
            );
          }
        } else if (object.weapon === "pierce") {
          this.ink.lineBetween(point.x - radius * 0.7, point.y, point.x + radius * 0.7, point.y);
          this.ink.lineBetween(point.x, point.y - radius / 2, point.x + radius * 0.7, point.y);
          this.ink.lineBetween(point.x, point.y + radius / 2, point.x + radius * 0.7, point.y);
        }
        break;
      case "resource":
        this.ink.fillStyle(0xffffff);
        this.ink.fillCircle(point.x, point.y, radius);
        break;
      case "rock":
      case "debris":
        this.ink.fillEllipse(point.x, point.y, radius * 2, radius * 1.4);
        this.ink.strokeEllipse(point.x, point.y, radius * 2, radius * 1.4);
        break;
    }
  }
}
