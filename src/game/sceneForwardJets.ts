import { type GameObjects, Renderer, type Scene, type Textures } from "phaser";

import {
  forwardFlightPlumes,
  forwardFlightPoint,
  type ForwardHeading,
  type ForwardPlume,
} from "./forwardFlightJets.ts";
import type { JetDisplay, ShipJets } from "./shipJets.ts";

// Fit the 42 px hull, both plumes and the exterior ink in one reusable target.
const SIDE = 96;
const MIDDLE = SIDE / 2;
const GROW = 0.25;
const MASK_FRAME = 96;

// Render targets are premultiplied. The mask atlas holds paint-independent tail and rear paths
// from the same heading package as the actual ship texture.
const COMPOSE = `
precision highp float;
varying vec2 outTexCoord;
uniform sampler2D hull;
uniform sampler2D farPlume;
uniform sampler2D nearPlume;
uniform sampler2D material;
uniform vec2 displaySize;
uniform vec2 pivot;
uniform vec4 tailEdge;
uniform float split;
uniform float edge;
uniform float rearRestore;
uniform float plumeInk;
uniform float texel;

vec2 logicalPoint(vec2 uv) {
  return vec2(uv.x - 0.5, 0.5 - uv.y) * ${SIDE}.0;
}
vec4 over(vec4 front, vec4 back) {
  return front + back * (1.0 - front.a);
}
vec2 materialCoverage(vec2 point) {
  vec2 uv = point / displaySize + pivot;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThanEqual(uv, vec2(1.0)))) {
    return vec2(0.0);
  }
  return vec2(
    texture2D(material, vec2(uv.x * 0.5, uv.y)).a,
    texture2D(material, vec2(0.5 + uv.x * 0.5, uv.y)).a
  );
}
float lineCoverage(vec2 point) {
  vec2 axis = tailEdge.zw - tailEdge.xy;
  vec2 fromStart = point - tailEdge.xy;
  float along = dot(fromStart, axis);
  if (along < 0.0 || along > dot(axis, axis)) return 0.0;
  return step(abs(axis.x * fromStart.y - axis.y * fromStart.x), ${GROW} * length(axis));
}
vec4 compose(vec2 uv) {
  vec2 point = logicalPoint(uv);
  vec4 body = texture2D(hull, uv);
  vec4 far = texture2D(farPlume, uv);
  vec2 masks = materialCoverage(point);
  vec4 composed = over(far, body);
  if (split < 0.5) {
    return over(body * max(masks.y, rearRestore), composed);
  }
  composed = over(body * masks.x, composed);
  if (edge > 0.5) {
    float coverage = lineCoverage(point) * far.a * (1.0 - body.a);
    composed.rgb = mix(composed.rgb, vec3(24.0, 20.0, 37.0) / 255.0 * composed.a, coverage);
  }
  composed = over(texture2D(nearPlume, uv), composed);
  return over(body * (1.0 - masks.x), composed);
}
float plumeAlpha(vec2 uv) {
  float far = texture2D(farPlume, uv).a;
  return split < 0.5 ? far : max(far, texture2D(nearPlume, uv).a);
}
float plumeBorder(vec2 uv) {
  // A quarter logical pixel may fall inside one texel. Sample adjacent texels and paint only
  // the fraction of their edges or corners that the logical-width ink would cover.
  float grow = min(1.0, ${GROW} / (${SIDE}.0 * texel));
  float coverage = 0.0;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      if (x == 0 && y == 0) continue;
      float weight = x == 0 || y == 0 ? grow : grow * grow;
      coverage = max(coverage, weight * step(0.5, plumeAlpha(uv + texel * vec2(float(x), float(y)))));
    }
  }
  return coverage;
}
void main() {
  vec4 fill = compose(outTexCoord);
  if (plumeInk > 0.5) {
    vec4 ink = vec4(vec3(24.0, 20.0, 37.0) / 255.0, 1.0) * plumeBorder(outTexCoord);
    fill = over(fill, ink);
  }
  gl_FragColor = fill;
}
`;

interface MaterialPaths {
  readonly rear: readonly string[];
  readonly tail: readonly string[];
}

function sameDisplay(a: JetDisplay, b: JetDisplay): boolean {
  return (
    a.displayHeight === b.displayHeight &&
    a.displayWidth === b.displayWidth &&
    a.pivot.x === b.pivot.x &&
    a.pivot.y === b.pivot.y
  );
}

export class ForwardJetComposition {
  private readonly body: GameObjects.RenderTexture;
  private readonly far: GameObjects.RenderTexture;
  private readonly near: GameObjects.RenderTexture;
  private readonly ink: GameObjects.Graphics;
  private readonly shader: GameObjects.Shader;
  private readonly output: GameObjects.RenderTexture;
  private readonly scene: Scene;
  private mask: Textures.CanvasTexture | undefined;
  private maskHeading: number | undefined;
  private maskPaths: MaterialPaths | undefined;
  private rasterSize = 0;
  private drawnPlumes: readonly ForwardPlume[] | undefined;
  private drawnHeading: ForwardHeading | undefined;
  private drawnRestore: number | undefined;
  private drawnPlumeInk: boolean | undefined;
  private hull:
    | {
        frame: Textures.Frame;
        source: unknown;
        alpha: number;
        display: JetDisplay;
      }
    | undefined;
  private plumeSelection:
    | {
        display: JetDisplay;
        heading: ForwardHeading;
        index: number;
        jets: ShipJets;
        speed: number;
        plumes: readonly ForwardPlume[] | undefined;
      }
    | undefined;

  constructor(scene: Scene) {
    this.scene = scene;
    const target = () => scene.add.renderTexture(0, 0, SIDE, SIDE).removeFromDisplayList();
    this.body = target();
    this.far = target();
    this.near = target();
    this.ink = scene.make.graphics({ x: 0, y: 0 }, false);
    this.shader = scene.add
      .shader(
        {
          fragmentSource: COMPOSE,
          name: "ForwardJetComposition",
          setupUniforms(setUniform: (name: string, value: number) => void) {
            setUniform("hull", 0);
            setUniform("farPlume", 1);
            setUniform("nearPlume", 2);
            setUniform("material", 3);
          },
        },
        0,
        0,
        SIDE,
        SIDE,
      )
      .removeFromDisplayList();
    this.output = scene.add.renderTexture(0, 0, SIDE, SIDE).setVisible(false);
    scene.game.renderer.on(Renderer.Events.RESTORE_WEBGL, this.invalidateTargets, this);
  }

  hide(): void {
    this.output.setVisible(false);
  }

  destroy(): void {
    this.scene.game.renderer.off(Renderer.Events.RESTORE_WEBGL, this.invalidateTargets, this);
    this.output.destroy();
    this.shader.destroy();
    this.ink.destroy();
    this.body.destroy();
    this.far.destroy();
    this.near.destroy();
    if (this.mask) {
      this.scene.textures.remove(this.mask);
    }
  }

  private invalidateTargets(): void {
    // Phaser restores the render targets empty. Draw their contents on the next flight draw.
    this.hull = undefined;
    this.drawnPlumes = undefined;
  }

  select(
    jets: ShipJets,
    heading: ForwardHeading,
    index: number,
    display: JetDisplay,
    speed: number,
  ): readonly ForwardPlume[] | undefined {
    const previous = this.plumeSelection;
    if (
      previous &&
      previous.heading === heading &&
      previous.index === index &&
      previous.speed === speed &&
      sameDisplay(previous.display, display) &&
      previous.jets.headings === jets.headings &&
      previous.jets.profile === jets.profile &&
      previous.jets.length === jets.length &&
      previous.jets.frame === jets.frame &&
      previous.jets.layers.length === jets.layers.length &&
      jets.layers.every((layer, index) => {
        const old = previous.jets.layers[index]!;
        return (
          old.alpha === layer.alpha &&
          old.colors === layer.colors &&
          old.length === layer.length &&
          old.maxDisplay === layer.maxDisplay &&
          old.underHull === layer.underHull &&
          old.width === layer.width
        );
      })
    ) {
      return previous.plumes;
    }
    const plumes = forwardFlightPlumes(jets, heading, index, display, speed);
    this.plumeSelection = { display, heading, index, jets, plumes, speed };
    return plumes;
  }

  private materialMask(index: number, paths: MaterialPaths): Textures.CanvasTexture | undefined {
    const mask =
      this.mask ??
      this.scene.textures.createCanvas("ada-forward-jet-masks", 2 * MASK_FRAME, MASK_FRAME);
    if (!mask) {
      return undefined;
    }
    if (this.maskHeading === index && this.maskPaths === paths) {
      return mask;
    }
    const context = mask.getContext();
    context.clearRect(0, 0, 2 * MASK_FRAME, MASK_FRAME);
    context.fillStyle = "#fff";
    for (const [tile, group] of [paths.tail, paths.rear].entries()) {
      context.setTransform(1, 0, 0, 1, tile * MASK_FRAME, 0);
      for (const path of group) {
        context.fill(new Path2D(path));
      }
    }
    context.resetTransform();
    mask.refresh();
    this.mask = mask;
    this.maskHeading = index;
    this.maskPaths = paths;
    return mask;
  }

  draw(
    ship: GameObjects.Image,
    display: JetDisplay,
    heading: ForwardHeading,
    index: number,
    paths: MaterialPaths,
    plumes: readonly ForwardPlume[],
    scale: number,
    rearRestore: number,
    plumeInk: boolean,
  ): boolean {
    if (
      !ship.visible ||
      ship.isTinted ||
      plumes.length === 0 ||
      plumes.some(({ points }) =>
        points.some(({ x, y }) => !(Math.abs(x) < MIDDLE - 1 && Math.abs(y) < MIDDLE - 1)),
      )
    ) {
      return false;
    }
    const maskChanged = this.maskHeading !== index || this.maskPaths !== paths;
    const mask = this.materialMask(index, paths);
    if (!mask) {
      return false;
    }
    const size = Math.ceil(SIDE * scale);
    const resized = size !== this.rasterSize;
    if (resized) {
      for (const surface of [this.body, this.far, this.near, this.output]) {
        surface.resize(size, size, false);
      }
      this.shader.setSize(size, size).updateDisplayOrigin();
      this.shader.setTextures([this.body.texture, this.far.texture, this.near.texture, mask]);
      this.output.setDisplaySize(SIDE, SIDE);
      this.rasterSize = size;
    }
    const previousHull = this.hull;
    const hullChanged =
      resized ||
      !previousHull ||
      previousHull.frame !== ship.frame ||
      previousHull.source !== ship.frame.source.image ||
      previousHull.alpha !== ship.alpha ||
      !sameDisplay(previousHull.display, display);
    const plumeChanged = resized || this.drawnPlumes !== plumes || this.drawnHeading !== heading;
    if (
      hullChanged ||
      plumeChanged ||
      maskChanged ||
      this.drawnRestore !== rearRestore ||
      this.drawnPlumeInk !== plumeInk
    ) {
      this.compose(
        ship,
        display,
        heading,
        plumes,
        size,
        rearRestore,
        plumeInk,
        hullChanged,
        plumeChanged,
      );
    }
    this.output.setPosition(ship.x, ship.y).setVisible(true);
    return true;
  }

  private compose(
    ship: GameObjects.Image,
    display: JetDisplay,
    heading: ForwardHeading,
    plumes: readonly ForwardPlume[],
    size: number,
    rearRestore: number,
    plumeInk: boolean,
    hullChanged: boolean,
    plumeChanged: boolean,
  ): void {
    const raster = size / SIDE;
    const center = size / 2;
    if (hullChanged) {
      this.hull = {
        alpha: ship.alpha,
        display,
        frame: ship.frame,
        source: ship.frame.source.image,
      };
      this.body.clear();
      this.body.stamp(ship.texture.key, ship.frame.name, center, center, {
        alpha: ship.alpha,
        originX: display.pivot.x,
        originY: display.pivot.y,
        scaleX: (raster * display.displayWidth) / ship.frame.width,
        scaleY: (raster * display.displayHeight) / ship.frame.height,
      });
      this.body.render();
    }
    if (plumeChanged) {
      this.drawnPlumes = plumes;
      this.drawnHeading = heading;
      this.ink.setScale(raster);
      for (const [pass, surface] of [this.far, this.near].entries()) {
        this.ink.clear();
        for (const plume of plumes) {
          const near = heading.farMouth !== undefined && plume.mouth !== heading.farMouth;
          if (near === (pass === 1)) {
            const points = plume.points;
            this.ink.fillStyle(plume.color, plume.alpha).beginPath();
            this.ink.moveTo(points[0]!.x, points[0]!.y);
            for (let index = 1; index < points.length; index++) {
              const { x, y } = points[index]!;
              this.ink.lineTo(x, y);
            }
            this.ink.closePath().fillPath();
          }
        }
        surface.clear().draw(this.ink, center, center).render();
      }
    }
    this.drawnRestore = rearRestore;
    this.drawnPlumeInk = plumeInk;
    this.shader
      .setUniform("split", Number(heading.farMouth !== undefined))
      .setUniform("edge", Number(heading.tailEdge !== undefined))
      .setUniform("rearRestore", rearRestore)
      .setUniform("plumeInk", Number(plumeInk))
      .setUniform("texel", 1 / size)
      .setUniform("displaySize", [display.displayWidth, display.displayHeight])
      .setUniform("pivot", [display.pivot.x, display.pivot.y]);
    if (heading.tailEdge) {
      const [a, b] = heading.tailEdge.map((point) => forwardFlightPoint(display, point));
      this.shader.setUniform("tailEdge", [a!.x, a!.y, b!.x, b!.y]);
    }
    this.output.clear().draw(this.shader, center, center).render();
  }

  place(depth: number): void {
    this.output.setDepth(depth);
  }
}
