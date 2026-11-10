import Phaser from "phaser";

import { PROTOTYPE } from "../data/prototype.ts";
import { createControls } from "../input/controls.ts";
import { GameModel } from "../model/game.ts";
import type { FlightInput, SpaceObject, Vec } from "../model/types.ts";
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
    this.ink = this.add.graphics();
    this.ship = this.add.image(0, 0, "ship").setDepth(10);
    const manifest = this.cache.json.get("art-manifest") as { assets: Asset[] } | undefined;
    const ship = manifest?.assets.find((asset) => asset.id === "ship");
    this.ship.setDisplaySize(ship?.displayWidth ?? 28, ship?.displayHeight ?? 42);
    this.ship.setOrigin(ship?.pivot.x ?? 0.5, ship?.pivot.y ?? 0.5);
    const apply = (action: () => void): void => {
      action();
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
      interact: () => apply(() => this.model.interact()),
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
        settings: PROTOTYPE.labels.settings ?? "",
      },
      onPauseChange: (paused) => {
        this.settingsOpen = paused;
        this.flush();
      },
    });
    const hide = (): void => {
      this.controls.reset();
      this.flush();
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", hide);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.flush();
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", hide);
      this.controls.dispose();
      this.shell.dispose();
      this.labels.clear();
    });
    this.refresh();
  }

  override update(time: number, milliseconds: number): void {
    if (!this.controls) {
      return;
    }
    const state = this.model.state;
    if (!this.settingsOpen && !document.hidden && state.mode === "space" && !state.dialogue) {
      const sampled = this.controls.sample();
      const input: FlightInput = {
        aim: screenToWorld(sampled.aim),
        move: screenToWorld(sampled.move),
        use: sampled.use,
      };
      this.model.step(Math.min(milliseconds / 1000, 0.05), input);
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

  private refresh(): void {
    const state = this.model.state;
    const enabled = state.mode === "space" && !state.dialogue;
    if (enabled !== this.enabled) {
      this.enabled = enabled;
      this.controls.setEnabled(enabled);
      this.controls.reset();
    }
    this.controls.setContext(enabled ? this.model.contextLabel : undefined);
    this.shell.render(state, {
      contextLabel: this.model.contextLabel,
      destinations: this.model.destinations(),
      inDanger: this.model.inDanger,
      objective: this.model.objective,
    });
  }

  private flush(): void {
    writeSave(this.model.save());
  }

  private project(point: Vec): Vec {
    const center = this.model.state.flight?.player ?? { x: 0, y: 0 };
    const x = point.x - center.x;
    const y = point.y - center.y;
    return { x: this.scale.width / 2 + x - y, y: this.scale.height / 2 + (x + y) / 2 };
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
    const span = Math.ceil(Math.max(this.scale.width, this.scale.height) / cell) + 2;
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
      this.ink.lineBetween(tail.x, tail.y, point.x, point.y);
    }
    this.ship.setPosition(this.scale.width / 2, this.scale.height / 2);
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

  private drawObject(object: SpaceObject): void {
    const point = this.project(object);
    const radius = object.radius;
    if (
      point.x < -radius - 60 ||
      point.y < -radius - 60 ||
      point.x > this.scale.width + radius + 60 ||
      point.y > this.scale.height + radius + 60
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
        this.ink.strokeTriangle(
          point.x,
          point.y + radius,
          point.x - radius,
          point.y - radius,
          point.x + radius,
          point.y - radius,
        );
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
