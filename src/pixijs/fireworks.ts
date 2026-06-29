// Firework particle system that radiates outward from the center when a character appears.
// Makes the appearance noticeable even when the character is small or close in color to the background.
// It encapsulates its own PIXI.Container (layer) and particle state, so the component only needs to
// add the layer to the stage and call spawn/update/clear/destroy.

import * as PIXI from "pixi.js";
import type { Color } from "../types/geometry";
import { makeSparkTint } from "./tint";
import { createSparkTexture } from "./textures";

const FIREWORK_COUNT = 10; // Number of particles per character
const FIREWORK_LIFE_MS = 650; // Particle lifetime (ms)
// The spread radius scales with the character size (larger characters spread out more freely),
// but the particle size itself has an upper bound so it doesn't grow too large.
const SPREAD_FACTOR = 0.5; // spread = character size × this value
const SPREAD_MIN_RATIO = 0.02; // Minimum spread (relative to world width)
const RADIUS_FACTOR = 0.05; // particle radius = character size × this value
const RADIUS_MAX_RATIO = 0.0402; // Upper bound for particle radius (relative to world width)
const RADIUS_MIN_RATIO = 0.0012; // Lower bound for particle radius (relative to world width)

interface Spark {
  sprite: PIXI.Sprite;
  vx: number; // Velocity in world coordinates (units/ms)
  vy: number;
  ageMs: number;
  lifeMs: number;
  baseScale: number;
}

export class FireworkSystem {
  /** Container the particles are added to. addChild it directly to the camera (stage). */
  readonly layer = new PIXI.Container();
  private readonly texture: PIXI.Texture;
  private sparks: Spark[] = [];

  constructor() {
    this.texture = createSparkTexture();
  }

  /**
   * Scatters particles radially from the center (cx, cy).
   * @param worldWidth World width. Used to compute the upper/lower bounds of spread and particle size.
   */
  spawn(
    cx: number,
    cy: number,
    glyphWorldSize: number,
    color: Color,
    worldWidth: number,
  ) {
    const spread = Math.max(
      worldWidth * SPREAD_MIN_RATIO,
      glyphWorldSize * SPREAD_FACTOR,
    );
    // The particle radius follows the character size but is clamped between the upper/lower bounds so it doesn't grow excessively.
    const radius = Math.min(
      worldWidth * RADIUS_MAX_RATIO,
      Math.max(worldWidth * RADIUS_MIN_RATIO, glyphWorldSize * RADIUS_FACTOR),
    );

    for (let i = 0; i < FIREWORK_COUNT; i += 1) {
      const angle =
        (i / FIREWORK_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      // Accounting for damping, the speed is set so that integrating up to the half-life point roughly equals `spread`.
      const speed =
        ((spread * (1.1 + Math.random() * 0.8)) / FIREWORK_LIFE_MS) * 2;

      const sprite = new PIXI.Sprite(this.texture);
      sprite.anchor.set(0.5);
      sprite.position.set(cx, cy);
      sprite.tint = makeSparkTint(color);
      // exclusion: a blend mode that produces a "difference" from the background, so it stands out
      // clearly on any background color (color as-is on black, inverted on light backgrounds), while the particle's own hue is largely preserved.
      sprite.blendMode = "exclusion";

      const baseScale =
        ((radius * 2) / this.texture.width) * (0.7 + Math.random() * 0.6);
      sprite.scale.set(baseScale);

      this.layer.addChild(sprite);
      this.sparks.push({
        sprite,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ageMs: 0,
        lifeMs: FIREWORK_LIFE_MS * (0.8 + Math.random() * 0.4),
        baseScale,
      });
    }
  }

  /** Updates particles each frame: they spread outward (gradually decelerating) while fading out and shrinking. */
  update(ticker: PIXI.Ticker) {
    if (this.sparks.length === 0) return;
    const dt = ticker.deltaMS;
    for (let i = this.sparks.length - 1; i >= 0; i -= 1) {
      const spark = this.sparks[i];
      spark.ageMs += dt;
      const tNorm = spark.ageMs / spark.lifeMs;
      if (tNorm >= 1) {
        spark.sprite.destroy();
        this.sparks.splice(i, 1);
        continue;
      }
      const damp = 1 - tNorm; // Reduce the speed as time passes.
      spark.sprite.position.x += spark.vx * dt * damp;
      spark.sprite.position.y += spark.vy * dt * damp;
      const fade = 1 - tNorm;
      spark.sprite.alpha = fade * fade;
      spark.sprite.scale.set(spark.baseScale * (0.6 + 0.4 * fade));
    }
  }

  /** Removes all particles immediately. */
  clear() {
    for (const spark of this.sparks) {
      spark.sprite.destroy();
    }
    this.sparks = [];
  }

  /** Releases all particles, textures, and the layer. */
  destroy() {
    this.clear();
    this.texture.destroy(true);
    this.layer.destroy();
  }
}
