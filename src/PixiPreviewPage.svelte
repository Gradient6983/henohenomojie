<script lang="ts">
  import * as PIXI from "pixi.js";
  import { SvelteMap } from "svelte/reactivity";
  import jsonlRaw from "./assets/jsonl_こたえて _ imie.jsonl?raw";
  import {
    createCharCanvasLayout,
    drawCenteredChar,
  } from "./webgpu/glyph/textCanvas";

  type PlacementRecord = {
    type: "placement";
    step: number;
    char: string;
    pos: {
      x: number;
      y: number;
      scale: number;
      opacity: number;
      rotation: number;
    };
    color: [number, number, number];
  };

  const baseWidth = 1920;
  const baseHeight = 1080;
  const minZoom = 0.1;
  const maxZoom = 8;

  function parsePlacements(raw: string): PlacementRecord[] {
    const parsed: PlacementRecord[] = [];
    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

    for (const line of lines) {
      try {
        const record = JSON.parse(line) as PlacementRecord;
        if (record?.type === "placement") parsed.push(record);
      } catch {
        // JSONL 한 줄 오류는 무시하고 계속 파싱
      }
    }

    return parsed.sort((a, b) => a.step - b.step);
  }

  const placements = parsePlacements(jsonlRaw);
  // Pixi tint는 원본 텍스처 색과 곱해지므로, 흰색 글자로 만들어야 color 값이 보존된다.
  const charLayout = createCharCanvasLayout({
    textColor: "rgb(255, 255, 255)",
  });

  let shownCount = $state(0);
  let zoom = $state(1);

  let app: PIXI.Application | null = null;
  let camera: PIXI.Container | null = null;
  let glyphLayer: PIXI.Container | null = null;
  let glyphSprites: PIXI.Sprite[] = [];
  let textureCache = new SvelteMap<string, PIXI.Texture>();

  let dragActive = false;
  let lastPointerX = 0;
  let lastPointerY = 0;

  const currentStepLabel = $derived(
    shownCount > 0 ? String(placements[shownCount - 1]?.step ?? "-") : "-",
  );

  function makeTint(rgb: [number, number, number]): number {
    const r = Math.min(255, Math.max(0, Math.round(rgb[0] * 255)));
    const g = Math.min(255, Math.max(0, Math.round(rgb[1] * 255)));
    const b = Math.min(255, Math.max(0, Math.round(rgb[2] * 255)));
    return (r << 16) | (g << 8) | b;
  }

  function getCharTexture(char: string): PIXI.Texture | null {
    const cached = textureCache.get(char);
    if (cached) return cached;

    const canvas = document.createElement("canvas");
    canvas.width = charLayout.canvasPixelSize;
    canvas.height = charLayout.canvasPixelSize;
    drawCenteredChar(canvas, char, charLayout);

    const texture = PIXI.Texture.from(canvas);
    textureCache.set(char, texture);
    return texture;
  }

  function addNextPlacement() {
    if (!glyphLayer || shownCount >= placements.length) return;
    const placement = placements[shownCount];
    if (!placement) return;

    const texture = getCharTexture(placement.char);
    if (!texture) return;

    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5, 0.5);
    sprite.position.set(placement.pos.x * baseWidth, placement.pos.y * baseHeight);
    sprite.scale.set(placement.pos.scale, placement.pos.scale);
    sprite.alpha = placement.pos.opacity;
    sprite.rotation = (placement.pos.rotation * Math.PI) / 180;
    sprite.tint = makeTint(placement.color);

    glyphLayer.addChild(sprite);
    glyphSprites.push(sprite);
    shownCount += 1;
  }

  function removeLastPlacement() {
    if (shownCount <= 0) return;
    const sprite = glyphSprites.pop();
    if (sprite) {
      sprite.destroy();
    }
    shownCount -= 1;
  }

  function clearPlacements() {
    for (const sprite of glyphSprites) {
      sprite.destroy();
    }
    glyphSprites = [];
    shownCount = 0;
  }

  function resetView() {
    if (!app || !camera) return;
    const screenW = app.renderer.width;
    const screenH = app.renderer.height;
    const fitScale = Math.min(screenW / baseWidth, screenH / baseHeight);

    zoom = fitScale;
    camera.scale.set(fitScale, fitScale);
    camera.position.set(
      (screenW - baseWidth * fitScale) * 0.5,
      (screenH - baseHeight * fitScale) * 0.5,
    );
  }

  function resetAll() {
    clearPlacements();
    resetView();
  }

  function clampZoom(value: number): number {
    return Math.min(maxZoom, Math.max(minZoom, value));
  }

  function onPointerDown(event: PointerEvent) {
    dragActive = true;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
  }

  function onPointerMove(event: PointerEvent) {
    if (!dragActive || !camera) return;
    const dx = event.clientX - lastPointerX;
    const dy = event.clientY - lastPointerY;
    camera.position.x += dx;
    camera.position.y += dy;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
  }

  function onPointerUp() {
    dragActive = false;
  }

  function onWheel(event: WheelEvent) {
    if (!camera || !app) return;
    event.preventDefault();

    const rect = app.canvas.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;

    const oldZoom = zoom;
    const nextZoom = clampZoom(oldZoom * Math.exp(-event.deltaY * 0.001));
    if (nextZoom === oldZoom) return;

    const wx = (sx - camera.position.x) / oldZoom;
    const wy = (sy - camera.position.y) / oldZoom;

    zoom = nextZoom;
    camera.scale.set(nextZoom, nextZoom);
    camera.position.x = sx - wx * nextZoom;
    camera.position.y = sy - wy * nextZoom;
  }

  function onResize() {
    if (!app) return;
    app.renderer.resize(window.innerWidth, window.innerHeight);
    if (shownCount === 0) {
      resetView();
    }
  }

  async function setupPixi(canvas: HTMLCanvasElement, isActive: () => boolean) {
    app = new PIXI.Application();
    camera = new PIXI.Container();
    glyphLayer = new PIXI.Container();
    camera.addChild(glyphLayer);
    app.stage.addChild(camera);

    await app.init({
      canvas,
      backgroundAlpha: 1,
      backgroundColor: 0x000000,
      antialias: true,
      width: window.innerWidth,
      height: window.innerHeight,
    });
    if (!isActive()) {
      app?.destroy(true);
      app = null;
      camera = null;
      glyphLayer = null;
      return;
    }

    canvas.style.touchAction = "none";
    resetView();

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", onResize);
  }

  function teardownPixi(canvas: HTMLCanvasElement) {
    dragActive = false;

    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    canvas.removeEventListener("pointerleave", onPointerUp);
    canvas.removeEventListener("wheel", onWheel);
    window.removeEventListener("resize", onResize);

    clearPlacements();
    for (const texture of textureCache.values()) {
      texture.destroy(true);
    }
    textureCache.clear();

    app?.destroy(true);
    app = null;
    camera = null;
    glyphLayer = null;
  }

  function attachCanvas(node: HTMLCanvasElement) {
    let active = true;
    void setupPixi(node, () => active);

    return () => {
      if (!active) return;
      active = false;
      teardownPixi(node);
    };
  }
</script>

<div class="page-root">
  <div class="controls">
    <button onclick={removeLastPlacement} disabled={shownCount <= 0}>이전</button>
    <button onclick={addNextPlacement} disabled={shownCount >= placements.length}>다음</button>
    <button onclick={resetAll}>리셋</button>
    <span class="status">step: {currentStepLabel} / total: {placements.length}</span>
  </div>
  <canvas class="canvas-host" {@attach attachCanvas}></canvas>
</div>

<style>
  :global(html),
  :global(body) {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  :global(body) {
    background: #000;
  }

  .page-root {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: #000;
  }

  .canvas-host {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .controls {
    position: fixed;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 10px;
    color: #fff;
    backdrop-filter: blur(6px);
  }

  button {
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
    padding: 6px 10px;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .status {
    font-size: 0.9rem;
    white-space: nowrap;
  }
</style>
