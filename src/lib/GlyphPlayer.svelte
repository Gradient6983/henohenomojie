<script lang="ts">
  import * as PIXI from "pixi.js";
  // To use advanced blend modes such as 'exclusion', this extension module must be imported explicitly.
  import "pixi.js/advanced-blend-modes";
  import { onDestroy, onMount } from "svelte";
  import { SvelteMap } from "svelte/reactivity";
  import {
    Ease,
    Player,
    type IPlayerApp,
    type IVideo,
  } from "textalive-app-api";
  import { t } from "../i18n";
  import * as settings from "../stores/settingsStore.svelte";
  import { TEXT_ALIVE_TOKEN } from "../const/textAlive";
  import type {
    ParsedJsonlData,
    PhraseLine,
    PlayerCharRecord,
    PlayerPlacementRecord,
    PlayerSongRecord,
    SongCatalogItem,
    TimedPlacementRecord,
  } from "../types/song";
  import { createCharCanvasLayout } from "../util/textCanvas";
  import { formatTime } from "../util/time";
  import { FireworkSystem } from "../pixijs/fireworks";
  import { makeTint } from "../pixijs/tint";
  import { createCharTexture } from "../pixijs/textures";
  import SettingsMenu from "./components/SettingsMenu.svelte";

  let {
    song,
    jsonlRaw,
    edgeUrl,
    onBack,
  }: {
    song: SongCatalogItem;
    jsonlRaw: string;
    /** Sobel edge outline PNG URL from assets. If present, it can be faintly overlaid on top of the glyphs. */
    edgeUrl?: string;
    onBack: () => void;
  } = $props();

  // World coordinate system size. The x,y in the jsonl are normalized against the original
  // image size (= naturalSize * dpr), so after the image loads we match that size to replicate the source canvas 1:1.
  let baseWidth = $state(1920);
  let baseHeight = $state(1080);
  const minZoom = 0.1;
  const maxZoom = 8;
  // Glyph appearance animation length (ms). The appearance starts this much before startTime
  // so it reaches the target size exactly at startTime.
  const appearAnimMs = 100;

  let media = $state<HTMLDivElement | null>(null);
  let textAlivePlayer: Player | null = null;

  onMount(() => {
    if (!media) return;
    // Use the jsonl duration as a temporary length until the video info arrives.
    playbackDuration = songRecord?.duration ?? 0;
    // Match the world size (original image size × dpr) to the jsonl coordinate system.
    applyImageBaseSize(song.imageUrl);
    textAlivePlayer = new Player({
      app: {
        token: TEXT_ALIVE_TOKEN,
      },
      mediaElement: media,
      mediaBannerPosition: "bottom right",
    });
    textAlivePlayer.addListener({
      onAppReady(app: IPlayerApp) {
        if (!app.songUrl) {
          textAlivePlayer?.createFromSongUrl(song.songUrl, {
            video: song.video,
          });
        }
      },
      /* 楽曲情報が取れたら呼ばれる */
      onVideoReady(video: IVideo) {
        if (typeof video?.duration === "number" && video.duration > 0) {
          playbackDuration = video.duration;
        }
      },

      /* 再生コントロールができるようになったら呼ばれる */
      onTimerReady() {
        playerReady = true;
      },

      /* 再生位置の情報が更新されたら呼ばれる */
      onTimeUpdate(position: number) {
        playbackPosition = position;
        // Prevent glyphs from flickering due to the onTimeUpdate used for initial rendering before
        // playback, and due to stale position updates during seeking.
        if (isPlaying && !isSeeking) syncPlacementsToTime(position);
      },

      /* 楽曲の再生が始まったら呼ばれる */
      onPlay() {
        isPlaying = true;
      },

      /* 楽曲の再生が止まったら呼ばれる */
      onPause() {
        isPlaying = false;
      },

      /* 楽曲が停止したら呼ばれる */
      onStop() {
        isPlaying = false;
        playbackPosition = 0;
        syncPlacementsToTime(0);
      },

      /* Called when seeking starts (blocks stale position sync) */
      onSeek() {
        beginSeek();
      },

      /* Called when seeking completes (syncs to the final position only once) */
      onSeekComplete(position: number) {
        endSeek(position);
      },

      /* When the volume changes (e.g. from the banner or another external source), sync it to the global settings */
      onVolumeUpdate(level: number) {
        settings.setVolume(level);
      },
    });
  });

  onDestroy(() => {
    if (seekSettleTimer !== null) {
      clearTimeout(seekSettleTimer);
      seekSettleTimer = null;
    }
    if (userScrollTimer !== null) {
      clearTimeout(userScrollTimer);
      userScrollTimer = null;
    }
    textAlivePlayer?.dispose();
    textAlivePlayer = null;
  });

  function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  function parseJsonlData(raw: string): ParsedJsonlData {
    let song: PlayerSongRecord | null = null;
    const charsById = new SvelteMap<string, PlayerCharRecord>();
    const placements: PlayerPlacementRecord[] = [];
    const phrases: PhraseLine[] = [];
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      try {
        const record = JSON.parse(line) as unknown;
        if (!isObjectRecord(record)) continue;

        if (record.type === "song" && typeof record.songUrl === "string") {
          song = {
            type: "song",
            songUrl: record.songUrl,
            duration:
              typeof record.duration === "number" ? record.duration : undefined,
          };
          continue;
        }
        if (
          record.type === "phrase" &&
          typeof record.phraseId === "string" &&
          typeof record.text === "string" &&
          typeof record.startTime === "number" &&
          typeof record.endTime === "number"
        ) {
          phrases.push({
            phraseId: record.phraseId,
            text: record.text,
            startTime: record.startTime,
            endTime: record.endTime,
          });
          continue;
        }
        if (
          record.type === "char" &&
          typeof record.charId === "string" &&
          typeof record.startTime === "number" &&
          typeof record.phraseId === "string"
        ) {
          charsById.set(record.charId, {
            type: "char",
            charId: record.charId,
            startTime: record.startTime,
            phraseId: record.phraseId,
          });
          continue;
        }
        if (
          record.type === "placement" &&
          typeof record.charId === "string" &&
          typeof record.step === "number" &&
          typeof record.char === "string" &&
          isObjectRecord(record.pos) &&
          typeof record.pos.x === "number" &&
          typeof record.pos.y === "number" &&
          typeof record.pos.scale === "number" &&
          typeof record.pos.opacity === "number" &&
          typeof record.pos.rotation === "number" &&
          Array.isArray(record.color) &&
          record.color.length === 3 &&
          record.color.every((value) => typeof value === "number")
        ) {
          placements.push({
            type: "placement",
            charId: record.charId,
            step: record.step,
            char: record.char,
            pos: {
              x: record.pos.x,
              y: record.pos.y,
              scale: record.pos.scale,
              opacity: record.pos.opacity,
              rotation: record.pos.rotation,
            },
            color: [record.color[0], record.color[1], record.color[2]],
          });
        }
      } catch {
        // Ignore an error on a single JSONL line and keep parsing
      }
    }

    const timedPlacements = placements
      .map((placement) => {
        const char = charsById.get(placement.charId);
        if (!char) return null;
        return {
          ...placement,
          startTime: char.startTime,
          phraseId: char.phraseId,
        };
      })
      .filter((placement): placement is TimedPlacementRecord => !!placement)
      .sort((a, b) => a.startTime - b.startTime || a.step - b.step);

    phrases.sort((a, b) => a.startTime - b.startTime);

    return { song, timedPlacements, phrases };
  }

  const parsedJsonl = $derived(parseJsonlData(jsonlRaw));
  const songRecord = $derived(parsedJsonl.song);
  const timedPlacements = $derived(parsedJsonl.timedPlacements);
  const lyricPhrases = $derived(parsedJsonl.phrases);

  // Based on the current playback position, treat the "last lyric line that has already started" as the active line.
  // (That line rises to the center of the screen, and is pushed up once the next line starts)
  const activePhraseIndex = $derived.by(() => {
    const pos = playbackPosition;
    let index = -1;
    for (let i = 0; i < lyricPhrases.length; i += 1) {
      if (lyricPhrases[i].startTime <= pos) index = i;
      else break;
    }
    return index;
  });

  // Constellation/highlight mode, edge display, edge opacity, and volume are read from the global settings store.
  // (Changing values in the settings panel automatically updates these derived values)
  const highlightMode = $derived(settings.getConstellation());
  const showEdges = $derived(settings.getShowEdges());
  const edgeOpacity = $derived(settings.getEdgeOpacity());
  const volume = $derived(settings.getVolume());

  // When the mode is on, the highlighted line automatically follows the "currently playing line".
  // When moving to the next line, the previous line's glyphs dim and the current line's glyphs become sharp.
  const highlightPhraseId = $derived(
    highlightMode ? (lyricPhrases[activePhraseIndex]?.phraseId ?? null) : null,
  );

  // Lyrics panel auto-scroll / user-scroll handling
  let lyricLineEls: (HTMLElement | undefined)[] = [];
  // While the user is scrolling manually, pause auto-scroll briefly so they can view previous lyrics.
  let isUserScrollingLyrics = $state(false);
  let userScrollTimer: ReturnType<typeof setTimeout> | null = null;

  function markUserScrollingLyrics() {
    isUserScrollingLyrics = true;
    if (userScrollTimer !== null) clearTimeout(userScrollTimer);
    // After a period with no input, automatically return to the active line.
    userScrollTimer = setTimeout(() => {
      isUserScrollingLyrics = false;
    }, 2600);
  }

  // Detect manual scrolling (wheel/touch) on the lyrics panel and temporarily suspend auto-scroll.
  function lyricsScrollWatcher(node: HTMLElement) {
    const handler = () => markUserScrollingLyrics();
    node.addEventListener("wheel", handler, { passive: true });
    node.addEventListener("touchmove", handler, { passive: true });
    return () => {
      node.removeEventListener("wheel", handler);
      node.removeEventListener("touchmove", handler);
    };
  }

  // Register each lyric line's DOM by index, and move that line to the center during auto-scroll.
  function registerLyricLine(index: number) {
    return (node: HTMLElement) => {
      lyricLineEls[index] = node;
      return () => {
        if (lyricLineEls[index] === node) lyricLineEls[index] = undefined;
      };
    };
  }

  // When the active line changes (or user scrolling ends), smoothly scroll that line to the center.
  $effect(() => {
    const index = activePhraseIndex;
    if (isUserScrollingLyrics) return;
    if (index < 0) return;
    const el = lyricLineEls[index];
    if (!el) return;
    el.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  });

  // Pixi tint is multiplied with the source texture color, so the glyphs must be white for the color value to be preserved.
  const charLayout = createCharCanvasLayout({
    textColor: "rgb(255, 255, 255)",
  });

  let shownCount = $state(0);
  let zoom = $state(1);
  let playbackPosition = $state(0);
  let playbackDuration = $state(0);
  let isPlaying = $state(false);
  let playerReady = $state(false);
  let playerError = $state("");
  // While seeking is in progress, block onTimeUpdate's stale position sync to prevent flickering.
  let isSeeking = false;
  // In case onSeekComplete never fires, automatically clear the seeking state after a set time.
  let seekSettleTimer: ReturnType<typeof setTimeout> | null = null;

  let app: PIXI.Application | null = null;
  let camera: PIXI.Container | null = null;
  let glyphLayer: PIXI.Container | null = null;
  let glyphSprites: PIXI.Sprite[] = [];
  let textureCache = new SvelteMap<string, PIXI.Texture>();
  // Sobel edge overlay sprite. Kept as $state so that the visibility-sync $effect
  // re-runs even at creation time.
  let edgeSprite = $state<PIXI.Sprite | null>(null);

  // === Fireworks particles that scatter on appearance ===
  // So that a glyph's appearance is noticeable even when it is small or a similar color to the background,
  // small circular particles radiate outward from the center the moment a glyph appears.
  // The particle behavior/lifetime/size logic is encapsulated in FireworkSystem (src/pixijs/fireworks).
  // Particles fire only for glyphs added right after appearing (within this time window), to avoid them all bursting at once during seeking/rewinding.
  const fireworkFreshWindowMs = 400;
  let fireworks: FireworkSystem | null = null;

  // Graphics for the constellation connecting lines (drawn behind the glyph layer so glyphs appear on top of the lines)
  let constellationGfx: PIXI.Graphics | null = null;
  // Opacity multiplier for non-highlighted glyphs when dimming
  const highlightDimFactor = 0.12;

  let dragActive = false;
  let lastPointerX = 0;
  let lastPointerY = 0;

  function getCharTexture(char: string): PIXI.Texture | null {
    const cached = textureCache.get(char);
    if (cached) return cached;

    const texture = createCharTexture(char, charLayout);
    textureCache.set(char, texture);
    return texture;
  }

  // Update the firework particles every frame (the system handles spreading/fading/disposal internally).
  function updateFireworks(ticker: PIXI.Ticker) {
    fireworks?.update(ticker);
  }

  function addPlacementAtIndex(index: number, spawnFx = false) {
    if (!glyphLayer || index < 0 || index >= timedPlacements.length) return;
    const placement = timedPlacements[index];
    if (!placement) return;

    const texture = getCharTexture(placement.char);
    if (!texture) return;

    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5, 0.5);
    sprite.position.set(
      placement.pos.x * baseWidth,
      placement.pos.y * baseHeight,
    );
    // The initial size starts at 0; the actual size is set on every update in updateGlyphAnimations.
    sprite.scale.set(0, 0);
    sprite.alpha = placement.pos.opacity;
    sprite.rotation = (placement.pos.rotation * Math.PI) / 180;
    sprite.tint = makeTint(placement.color);

    glyphLayer.addChild(sprite);
    glyphSprites.push(sprite);
    shownCount += 1;

    if (spawnFx && fireworks) {
      const glyphWorldSize = charLayout.canvasPixelSize * placement.pos.scale;
      fireworks.spawn(
        placement.pos.x * baseWidth,
        placement.pos.y * baseHeight,
        glyphWorldSize,
        placement.color,
        baseWidth,
      );
    }
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

  // Update the appearance animation (size 0 → target size, quadOut) of the glyphs visible at the current position
  function updateGlyphAnimations(position: number) {
    for (let i = 0; i < shownCount; i += 1) {
      const sprite = glyphSprites[i];
      const placement = timedPlacements[i];
      if (!sprite || !placement) continue;

      const appearTime = placement.startTime - appearAnimMs;
      const rawProgress = (position - appearTime) / appearAnimMs;
      const clamped = Math.min(1, Math.max(0, rawProgress));
      const eased = Ease.quadOut(clamped);
      const scale = placement.pos.scale * eased;
      sprite.scale.set(scale, scale);
    }
  }

  // Highlight mode: only the selected line's glyphs keep their original opacity; the rest are dimmed.
  function applyGlyphHighlight(phraseId: string | null) {
    for (let i = 0; i < shownCount; i += 1) {
      const sprite = glyphSprites[i];
      const placement = timedPlacements[i];
      if (!sprite || !placement) continue;
      sprite.alpha =
        phraseId && placement.phraseId !== phraseId
          ? placement.pos.opacity * highlightDimFactor
          : placement.pos.opacity;
    }
  }

  // Redraw the constellation lines connecting the highlighted line's "currently visible" glyphs in appearance order.
  // The lines do not reach the glyph centers but end at a slightly offset point (gap).
  // (As glyphs appear one by one, the line segments grow progressively)
  function redrawConstellation(phraseId: string | null) {
    const gfx = constellationGfx;
    if (!gfx) return;
    gfx.clear();
    if (!phraseId) return;

    // Node: glyph position + a gap based on glyph size (the distance at which the line stops)
    const nodes: { x: number; y: number; gap: number }[] = [];
    for (let i = 0; i < shownCount; i += 1) {
      const sprite = glyphSprites[i];
      const placement = timedPlacements[i];
      if (!sprite || !placement) continue;
      if (placement.phraseId !== phraseId) continue;
      const glyphWorldSize = charLayout.canvasPixelSize * placement.pos.scale;
      nodes.push({
        x: sprite.position.x,
        y: sprite.position.y,
        gap: Math.max(baseWidth * 0.009, glyphWorldSize * 0.42),
      });
    }
    if (nodes.length < 2) return;

    const lineWidth = Math.max(1, baseWidth * 0.0016);

    // Collect line segments whose endpoints are offset from each glyph by the gap.
    const segments: { ax: number; ay: number; bx: number; by: number }[] = [];
    for (let i = 0; i < nodes.length - 1; i += 1) {
      const a = nodes[i];
      const b = nodes[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      // Skip cases where the two glyphs are so close that subtracting the gap would flip the line.
      if (len <= a.gap + b.gap) continue;
      const ux = dx / len;
      const uy = dy / len;
      segments.push({
        ax: a.x + ux * a.gap,
        ay: a.y + uy * a.gap,
        bx: b.x - ux * b.gap,
        by: b.y - uy * b.gap,
      });
    }
    if (segments.length === 0) return;

    const traceSegments = () => {
      for (const seg of segments) {
        gfx.moveTo(seg.ax, seg.ay);
        gfx.lineTo(seg.bx, seg.by);
      }
    };

    // Lines: dark outline first (so it's visible on any background), then the bright starlight core.
    traceSegments();
    gfx.stroke({
      width: lineWidth * 2.6,
      color: 0x05070d,
      alpha: 0.5,
      cap: "round",
    });
    traceSegments();
    gfx.stroke({
      width: lineWidth,
      color: 0xcfe6ff,
      alpha: 0.9,
      cap: "round",
    });
  }

  // When the highlighted line / visible glyphs / world size change, reapply the dimming and the constellation lines.
  $effect(() => {
    const phraseId = highlightPhraseId;
    // The shownCount, baseWidth, and timedPlacements dependencies are tracked via the reads inside the function calls below.
    applyGlyphHighlight(phraseId);
    redrawConstellation(phraseId);
  });

  // Reflect the edge overlay show/hide + opacity (global settings) onto the sprite.
  $effect(() => {
    if (!edgeSprite) return;
    edgeSprite.visible = showEdges;
    edgeSprite.alpha = edgeOpacity;
  });

  // Reflect the volume (global settings) onto the TextAlive player.
  // textAlivePlayer exists only after playerReady becomes true, so it is first applied at that point.
  $effect(() => {
    const level = volume;
    if (textAlivePlayer && playerReady) {
      textAlivePlayer.volume = level;
    }
  });

  function syncPlacementsToTime(position: number) {
    if (!glyphLayer) return;

    // Since timedPlacements is sorted by startTime, linearly count the number of placements
    // where (startTime - animation time) <= current position.
    // They must appear ahead by the animation time so they reach the target size at startTime.
    let targetCount = 0;
    for (const placement of timedPlacements) {
      if (placement.startTime - appearAnimMs <= position) targetCount += 1;
      else break;
    }

    // Add if too few, remove if too many (handles both seeking and rewinding)
    while (shownCount < targetCount) {
      const index = shownCount;
      const placement = timedPlacements[index];
      const appearTime = placement.startTime - appearAnimMs;
      // Fire particles only for glyphs that appeared "just now" during actual playback.
      // (Does not fire on the bulk additions of seeking/rewinding/initial render)
      const isFresh =
        isPlaying &&
        !isSeeking &&
        position - appearTime <= fireworkFreshWindowMs;
      addPlacementAtIndex(index, isFresh);
    }
    while (shownCount > targetCount) {
      removeLastPlacement();
    }

    // Update the size animation of the visible glyphs to match the current position
    updateGlyphAnimations(position);
  }

  function handlePlay() {
    if (!textAlivePlayer || !playerReady) return;
    textAlivePlayer.requestPlay();
  }

  function handlePause() {
    if (!textAlivePlayer || !playerReady) return;
    textAlivePlayer.requestPause();
  }

  function handleRestart() {
    if (!textAlivePlayer || !playerReady) return;
    textAlivePlayer.requestStop();
    playbackPosition = 0;
    syncPlacementsToTime(0);
  }

  // Start seeking: mark the seeking state and set an auto-clear timer in case the event never arrives.
  function beginSeek() {
    isSeeking = true;
    if (seekSettleTimer !== null) clearTimeout(seekSettleTimer);
    seekSettleTimer = setTimeout(() => endSeek(playbackPosition), 300);
  }

  // End seeking: clear the state and sync to the final position only once.
  function endSeek(position: number) {
    if (seekSettleTimer !== null) {
      clearTimeout(seekSettleTimer);
      seekSettleTimer = null;
    }
    isSeeking = false;
    playbackPosition = position;
    syncPlacementsToTime(position);
  }

  // During drag/click: immediately update only the display (the time indicator and glyphs).
  // Mark the seeking state so onTimeUpdate doesn't overwrite with a stale position while dragging during playback.
  function handleScrub(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const value = Number(input.value);
    beginSeek();
    playbackPosition = value;
    syncPlacementsToTime(value);
  }

  // Drag end / click confirm: move the actual audio playback position
  // (The seeking state is cleared by onSeekComplete or the auto-clear timer)
  function handleSeekCommit(event: Event) {
    if (!textAlivePlayer || !playerReady) return;
    const input = event.currentTarget as HTMLInputElement;
    beginSeek();
    textAlivePlayer.requestMediaSeek(Number(input.value));
  }

  // Read the actual size of the song image and match the world coordinate system (baseWidth/baseHeight) to the source.
  // Source: canvasWidth = image.naturalWidth * dpr, canvasHeight = image.naturalHeight * dpr
  function applyImageBaseSize(url: string) {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth <= 0 || img.naturalHeight <= 0) return;
      const dpr = charLayout.devicePixelRatio;
      baseWidth = img.naturalWidth * dpr;
      baseHeight = img.naturalHeight * dpr;
      // Re-fit the camera to the new world size, and reposition the glyphs based on the current position.
      resetView();
      repositionPlacements();
    };
    img.src = url;
  }

  // When baseWidth/baseHeight change, recalculate the coordinates/size of the already-added sprites.
  function repositionPlacements() {
    if (edgeSprite) {
      edgeSprite.width = baseWidth;
      edgeSprite.height = baseHeight;
    }
    for (let i = 0; i < shownCount; i += 1) {
      const sprite = glyphSprites[i];
      const placement = timedPlacements[i];
      if (!sprite || !placement) continue;
      sprite.position.set(
        placement.pos.x * baseWidth,
        placement.pos.y * baseHeight,
      );
    }
    updateGlyphAnimations(playbackPosition);
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

  // Load the edge PNG (black lines + alpha) and lay it faintly (30%) over the glyphs.
  // It is the last child added to the camera, so it sits at the very top.
  async function loadEdgeOverlay(url: string, isActive: () => boolean) {
    const texture = await PIXI.Assets.load<PIXI.Texture>(url);
    if (!isActive() || !camera) return;
    const sprite = new PIXI.Sprite(texture);
    sprite.width = baseWidth;
    sprite.height = baseHeight;
    sprite.alpha = settings.getEdgeOpacity();
    sprite.visible = settings.getShowEdges();
    // Keep the overlay from intercepting pointer events (drag/zoom).
    sprite.eventMode = "none";
    camera.addChild(sprite);
    edgeSprite = sprite;
  }

  async function setupPixi(canvas: HTMLCanvasElement, isActive: () => boolean) {
    app = new PIXI.Application();
    camera = new PIXI.Container();
    glyphLayer = new PIXI.Container();
    constellationGfx = new PIXI.Graphics();
    // Add the constellation lines first so they sit behind the glyphs (the particle layer is added above the glyphs after init).
    camera.addChild(constellationGfx);
    camera.addChild(glyphLayer);
    app.stage.addChild(camera);

    await app.init({
      canvas,
      backgroundAlpha: 1,
      backgroundColor: 0x000000,
      antialias: true,
      // A back buffer is required for advanced blend modes ('exclusion') to work in WebGL.
      useBackBuffer: true,
      width: window.innerWidth,
      height: window.innerHeight,
    });
    if (!isActive()) {
      app?.destroy(true);
      app = null;
      camera = null;
      glyphLayer = null;
      constellationGfx = null;
      return;
    }

    canvas.style.touchAction = "none";
    // Add the particle layer here so it sits above the glyphs (at the top, but below the edge overlay).
    fireworks = new FireworkSystem();
    camera.addChild(fireworks.layer);
    app.ticker.add(updateFireworks);
    resetView();

    // Edge overlay: placed above the glyphs (at the top) after the renderer/camera are ready.
    if (edgeUrl) void loadEdgeOverlay(edgeUrl, isActive);

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

    fireworks?.destroy();
    fireworks = null;

    constellationGfx?.destroy();
    constellationGfx = null;

    edgeSprite?.destroy();
    edgeSprite = null;

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
  <canvas class="canvas-host" {@attach attachCanvas}></canvas>

  {#if lyricPhrases.length > 0}
    <div class="lyrics-panel" {@attach lyricsScrollWatcher}>
      <div class="lyrics-list">
        {#each lyricPhrases as phrase, i (phrase.phraseId)}
          <p
            {@attach registerLyricLine(i)}
            class="lyric-line"
            class:active={i === activePhraseIndex}
            class:past={i < activePhraseIndex}
            class:selected={highlightMode && i === activePhraseIndex}
          >
            {phrase.text}
          </p>
        {/each}
      </div>
    </div>
  {/if}

  <div class="controls">
    <button
      class="icon-btn"
      onclick={onBack}
      title={t().player.backToSelect}
      aria-label={t().player.backToSelect}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
    </button>

    <span class="divider"></span>

    <button
      class="icon-btn"
      onclick={handleRestart}
      disabled={!playerReady}
      title={t().player.restart}
      aria-label={t().player.restart}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <polygon points="18 5 9 12 18 19" fill="currentColor" stroke="none" />
        <line x1="6" y1="5" x2="6" y2="19" />
      </svg>
    </button>

    <button
      class="icon-btn play-btn"
      onclick={isPlaying ? handlePause : handlePlay}
      disabled={!playerReady}
      title={isPlaying ? t().player.pause : t().player.play}
      aria-label={isPlaying ? t().player.pause : t().player.play}
    >
      {#if isPlaying}
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect
            x="6"
            y="5"
            width="4"
            height="14"
            fill="currentColor"
            stroke="none"
          />
          <rect
            x="14"
            y="5"
            width="4"
            height="14"
            fill="currentColor"
            stroke="none"
          />
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <polygon points="7 4 20 12 7 20" fill="currentColor" stroke="none" />
        </svg>
      {/if}
    </button>

    <div class="timeline">
      <span class="time">{formatTime(playbackPosition)}</span>
      <input
        type="range"
        min="0"
        max={playbackDuration || 0}
        step="100"
        value={playbackPosition}
        disabled={!playerReady || playbackDuration <= 0}
        oninput={handleScrub}
        onchange={handleSeekCommit}
      />
      <span class="time">{formatTime(playbackDuration)}</span>
    </div>

    <span class="divider"></span>

    <SettingsMenu showDisplayEffects edgeAvailable={!!edgeUrl} />
  </div>

  {#if playerError}
    <div class="error-toast">{playerError}</div>
  {/if}

  <div class="media" bind:this={media}></div>
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

  /* Lyrics panel floating at the bottom-center of the screen. Its height is limited so that
     only about three lines are visible at once, and the top/bottom edges fade out via a mask. */
  .lyrics-panel {
    position: fixed;
    left: 50%;
    bottom: 9%;
    transform: translateX(-50%);
    z-index: 9;
    width: min(90vw, 760px);
    height: clamp(6.5rem, 19vh, 8.5rem);
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: none;
    -webkit-mask-image: linear-gradient(
      to bottom,
      transparent 0%,
      #000 26%,
      #000 74%,
      transparent 100%
    );
    mask-image: linear-gradient(
      to bottom,
      transparent 0%,
      #000 26%,
      #000 74%,
      transparent 100%
    );
  }

  .lyrics-panel::-webkit-scrollbar {
    display: none;
  }

  /* Add top/bottom padding equal to half the panel height so the first/last lines can also rise to the center. */
  .lyrics-list {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: clamp(2.6rem, 8vh, 3.6rem) 24px;
  }

  .lyric-line {
    padding: 4px 8px;
    margin: 0;
    max-width: 100%;
    text-align: center;
    color: #fff;
    font-size: 1.05rem;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: 0.01em;
    /* Lyrics are display-only, so there is no click action. */
    cursor: default;
    user-select: none;
    opacity: 0.42;
    transform: scale(0.94);
    transform-origin: center center;
    /* Apply a strong outline shadow so the solid-color text stays visible even when it overlaps the background. */
    text-shadow:
      0 0 2px rgba(0, 0, 0, 0.95),
      0 1px 3px rgba(0, 0, 0, 0.9),
      0 0 10px rgba(0, 0, 0, 0.7);
    transition:
      opacity 0.45s cubic-bezier(0.22, 1, 0.36, 1),
      transform 0.45s cubic-bezier(0.22, 1, 0.36, 1),
      color 0.45s ease;
  }

  /* Lyrics that have already passed are dimmed further */
  .lyric-line.past {
    opacity: 0.28;
  }

  /* The currently sung lyric line: larger, sharper, with a slight accent color */
  .lyric-line.active {
    opacity: 1;
    transform: scale(1.12);
    color: #fff;
    text-shadow:
      0 0 2px rgba(0, 0, 0, 0.98),
      0 1px 4px rgba(0, 0, 0, 0.95),
      0 0 14px rgba(80, 140, 255, 0.55);
  }

  /* Line selected in constellation mode: shown in a starlight color */
  .lyric-line.selected {
    opacity: 1;
    color: #cfe6ff;
    text-shadow:
      0 0 2px rgba(0, 0, 0, 0.98),
      0 1px 4px rgba(0, 0, 0, 0.95),
      0 0 16px rgba(120, 180, 255, 0.85);
  }

  @media (prefers-reduced-motion: reduce) {
    .lyric-line {
      transition: none;
    }
  }

  /* Music player bar floating at the top-center. Groups the playback controls and the seek timeline in one row. */
  .controls {
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 6px;
    width: min(720px, calc(100% - 32px));
    padding: 8px 12px;
    background: rgba(14, 14, 20, 0.62);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 4px;
    color: #fff;
    backdrop-filter: blur(10px);
  }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 38px;
    height: 38px;
    padding: 0;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: #fff;
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease,
      transform 0.1s ease;
  }

  .icon-btn svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .icon-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.14);
  }

  .icon-btn:active:not(:disabled) {
    transform: scale(0.92);
  }

  .icon-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  /* The play/pause button is the main action, so it is emphasized as a white circle. */
  .play-btn {
    width: 44px;
    height: 44px;
    background: #fff;
    color: #111;
  }

  .play-btn svg {
    width: 22px;
    height: 22px;
  }

  .play-btn:hover:not(:disabled) {
    background: #fff;
    transform: scale(1.05);
  }

  .play-btn:disabled {
    background: rgba(255, 255, 255, 0.4);
  }

  .divider {
    flex: none;
    width: 1px;
    height: 22px;
    background: rgba(255, 255, 255, 0.16);
    margin: 0 2px;
  }

  .timeline {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
    padding: 0 6px;
  }

  .timeline input[type="range"] {
    flex: 1;
    width: auto;
    min-width: 0;
    height: 4px;
    cursor: pointer;
    accent-color: #fff;
  }

  .timeline input[type="range"]:disabled {
    cursor: default;
    opacity: 0.45;
  }

  .time {
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: rgba(255, 255, 255, 0.75);
  }

  .error-toast {
    position: fixed;
    top: 72px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 11;
    padding: 8px 14px;
    border-radius: 4px;
    background: rgba(40, 0, 0, 0.8);
    color: #ff8a8a;
    font-size: 0.85rem;
    white-space: nowrap;
  }
</style>
