<script lang="ts">
  import * as PIXI from "pixi.js";
  // 'exclusion' 등 고급 블렌드 모드를 쓰려면 이 확장 모듈을 명시적으로 import해야 한다.
  import "pixi.js/advanced-blend-modes";
  import { onDestroy, onMount } from "svelte";
  import { SvelteMap } from "svelte/reactivity";
  import {
    Ease,
    Player,
    type IPlayerApp,
    type IVideo,
  } from "textalive-app-api";
  import { t } from "./i18n";
  import type { SongCatalogItem } from "./webgpu/glyph/replayIO";
  import {
    createCharCanvasLayout,
    drawCenteredChar,
  } from "./webgpu/glyph/textCanvas";

  let {
    song,
    jsonlRaw,
    edgeUrl,
    onBack,
  }: {
    song: SongCatalogItem;
    jsonlRaw: string;
    /** assets의 윤곽선(Sobel edge) PNG URL. 있으면 글자 위에 옅게 오버레이할 수 있다. */
    edgeUrl?: string;
    onBack: () => void;
  } = $props();

  type SongRecord = {
    type: "song";
    songUrl: string;
    duration?: number;
  };

  type CharRecord = {
    type: "char";
    charId: string;
    startTime: number;
    phraseId: string;
  };

  type PlacementRecord = {
    type: "placement";
    charId: string;
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

  type TimedPlacementRecord = PlacementRecord & {
    startTime: number;
    phraseId: string;
  };

  type PhraseLine = {
    phraseId: string;
    text: string;
    startTime: number;
    endTime: number;
  };

  type ParsedJsonlData = {
    song: SongRecord | null;
    timedPlacements: TimedPlacementRecord[];
    phrases: PhraseLine[];
  };

  // 월드 좌표계 크기. jsonl의 x,y는 원본 이미지 크기(= naturalSize * dpr) 기준으로
  // 정규화되어 있으므로, 이미지 로드 후 그 크기로 맞춰 소스 캔버스를 1:1 복제한다.
  let baseWidth = $state(1920);
  let baseHeight = $state(1080);
  const minZoom = 0.1;
  const maxZoom = 8;
  const textAliveToken = "EP1gDDyqnNEHrnOD";
  // 글자 등장 애니메이션 길이(ms). 이 시간만큼 startTime 이전에 등장이 시작되어
  // 정확히 startTime에 목표 크기에 도달한다.
  const appearAnimMs = 100;

  let media = $state<HTMLDivElement | null>(null);
  let textAlivePlayer: Player | null = null;

  onMount(() => {
    if (!media) return;
    // 영상 정보가 오기 전까지의 임시 길이로 jsonl의 duration을 사용한다.
    playbackDuration = songRecord?.duration ?? 0;
    // jsonl 좌표계와 동일한 월드 크기(원본 이미지 크기 × dpr)로 맞춘다.
    applyImageBaseSize(song.imageUrl);
    textAlivePlayer = new Player({
      app: {
        token: textAliveToken,
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
        // 재생 전 초기 렌더링용 onTimeUpdate, 그리고 탐색 중 옛 위치 업데이트로
        // 글자가 깜빡이는 것을 방지한다.
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

      /* 탐색이 시작되면 호출 (옛 위치 동기화 차단) */
      onSeek() {
        beginSeek();
      },

      /* 탐색이 완료되면 호출 (최종 위치로 한 번만 동기화) */
      onSeekComplete(position: number) {
        endSeek(position);
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
    let song: SongRecord | null = null;
    const charsById = new SvelteMap<string, CharRecord>();
    const placements: PlacementRecord[] = [];
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
        // JSONL 한 줄 오류는 무시하고 계속 파싱
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

  function formatTime(ms: number): string {
    const clamped = Math.max(0, Math.floor(ms));
    const totalSec = Math.floor(clamped / 1000);
    const minute = Math.floor(totalSec / 60);
    const second = String(totalSec % 60).padStart(2, "0");
    return `${minute}:${second}`;
  }

  const parsedJsonl = $derived(parseJsonlData(jsonlRaw));
  const songRecord = $derived(parsedJsonl.song);
  const timedPlacements = $derived(parsedJsonl.timedPlacements);
  const lyricPhrases = $derived(parsedJsonl.phrases);

  // 현재 재생 위치 기준으로 "이미 시작된 마지막 가사 줄"을 활성 줄로 본다.
  // (해당 줄이 화면 중앙으로 올라오고, 다음 줄이 시작되면 위로 밀려난다)
  const activePhraseIndex = $derived.by(() => {
    const pos = playbackPosition;
    let index = -1;
    for (let i = 0; i < lyricPhrases.length; i += 1) {
      if (lyricPhrases[i].startTime <= pos) index = i;
      else break;
    }
    return index;
  });

  // 별자리/강조 모드 on/off. 컨트롤 바의 "별자리" 버튼으로 토글한다.
  let highlightMode = $state(false);
  // 윤곽선(Sobel edge) 오버레이 표시 여부. 컨트롤 바의 "윤곽선" 버튼으로 토글한다.
  let showEdges = $state(false);

  // 모드가 켜져 있으면 강조 줄은 "현재 재생 중인 줄"을 자동으로 따라간다.
  // 다음 줄로 넘어가면 이전 줄 글자는 흐려지고 현재 줄 글자가 또렷해진다.
  const highlightPhraseId = $derived(
    highlightMode ? (lyricPhrases[activePhraseIndex]?.phraseId ?? null) : null,
  );

  // 가사 패널 자동 스크롤 / 사용자 스크롤 처리
  let lyricLineEls: (HTMLElement | undefined)[] = [];
  // 사용자가 직접 스크롤하는 동안에는 자동 스크롤을 잠시 멈춰 이전 가사를 볼 수 있게 한다.
  let isUserScrollingLyrics = $state(false);
  let userScrollTimer: ReturnType<typeof setTimeout> | null = null;

  function markUserScrollingLyrics() {
    isUserScrollingLyrics = true;
    if (userScrollTimer !== null) clearTimeout(userScrollTimer);
    // 일정 시간 입력이 없으면 다시 활성 줄로 자동 복귀한다.
    userScrollTimer = setTimeout(() => {
      isUserScrollingLyrics = false;
    }, 2600);
  }

  // 가사 패널의 직접 스크롤(휠/터치)을 감지해 자동 스크롤을 일시 중단한다.
  function lyricsScrollWatcher(node: HTMLElement) {
    const handler = () => markUserScrollingLyrics();
    node.addEventListener("wheel", handler, { passive: true });
    node.addEventListener("touchmove", handler, { passive: true });
    return () => {
      node.removeEventListener("wheel", handler);
      node.removeEventListener("touchmove", handler);
    };
  }

  // 각 가사 줄 DOM을 인덱스로 등록해 두고, 자동 스크롤 시 해당 줄을 중앙으로 옮긴다.
  function registerLyricLine(index: number) {
    return (node: HTMLElement) => {
      lyricLineEls[index] = node;
      return () => {
        if (lyricLineEls[index] === node) lyricLineEls[index] = undefined;
      };
    };
  }

  // 활성 줄이 바뀌면(또는 사용자 스크롤이 끝나면) 해당 줄을 중앙으로 부드럽게 스크롤한다.
  $effect(() => {
    const index = activePhraseIndex;
    if (isUserScrollingLyrics) return;
    if (index < 0) return;
    const el = lyricLineEls[index];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  });

  // 별자리(강조) 모드 토글. 켜지면 현재 재생 중인 줄을 자동으로 따라가며 강조한다.
  function toggleHighlightMode() {
    highlightMode = !highlightMode;
  }

  // 윤곽선 오버레이 토글.
  function toggleEdges() {
    showEdges = !showEdges;
  }

  // Pixi tint는 원본 텍스처 색과 곱해지므로, 흰색 글자로 만들어야 color 값이 보존된다.
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
  // 탐색(seek) 진행 중에는 onTimeUpdate의 옛 위치 동기화를 막아 깜빡임을 방지한다.
  let isSeeking = false;
  // onSeekComplete가 발생하지 않는 경우를 대비해 일정 시간 후 자동으로 탐색 상태를 해제한다.
  let seekSettleTimer: ReturnType<typeof setTimeout> | null = null;

  let app: PIXI.Application | null = null;
  let camera: PIXI.Container | null = null;
  let glyphLayer: PIXI.Container | null = null;
  let glyphSprites: PIXI.Sprite[] = [];
  let textureCache = new SvelteMap<string, PIXI.Texture>();
  // 윤곽선(Sobel edge) 오버레이 스프라이트. $state로 두어 생성 시점에도
  // 가시성 동기화 $effect가 다시 실행되도록 한다.
  let edgeSprite = $state<PIXI.Sprite | null>(null);

  // === 등장 시 산개하는 불꽃놀이 파티클 ===
  // 글자가 작거나 배경과 비슷한 색이어도 등장을 알아챌 수 있도록,
  // 글자 등장 순간 중심에서 작은 원형 파티클이 방사형으로 퍼지게 한다.
  const fireworkCount = 10; // 글자당 파티클 개수
  const fireworkLifeMs = 650; // 파티클 수명(ms)
  // 등장 직후(이 시간 이내)에 추가된 글자에만 파티클을 터뜨려, 탐색/되감기 시 한꺼번에 터지는 것을 막는다.
  const fireworkFreshWindowMs = 400;
  // 퍼지는 반경은 글자 크기에 비례시키되(큰 글자일수록 시원하게 퍼짐),
  // 입자 자체 크기는 상한선을 둬서 너무 커지지 않게 한다.
  const fireworkSpreadFactor = 0.5; // 퍼짐 = 글자 크기 × 이 값
  const fireworkSpreadMinRatio = 0.02; // 퍼짐 최소값(월드 폭 대비)
  const fireworkRadiusFactor = 0.05; // 입자 반지름 = 글자 크기 × 이 값
  const fireworkRadiusMaxRatio = 0.0062; // 입자 반지름 상한(월드 폭 대비)
  const fireworkRadiusMinRatio = 0.0012; // 입자 반지름 하한(월드 폭 대비)

  type Spark = {
    sprite: PIXI.Sprite;
    vx: number; // 월드 좌표 기준 속도(단위/ms)
    vy: number;
    ageMs: number;
    lifeMs: number;
    baseScale: number;
  };

  let particleLayer: PIXI.Container | null = null;
  let sparkTexture: PIXI.Texture | null = null;
  let sparks: Spark[] = [];

  // 별자리 연결선용 그래픽스(글자 레이어 뒤에 그려 글자가 선 위에 보이게 한다)
  let constellationGfx: PIXI.Graphics | null = null;
  // dim 처리 시 비강조 글자의 투명도 배율
  const highlightDimFactor = 0.12;

  let dragActive = false;
  let lastPointerX = 0;
  let lastPointerY = 0;

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

  // 부드러운 원형(가운데가 밝고 가장자리가 투명한) 스파크 텍스처를 1회 생성해 모든 파티클이 공유한다.
  function createSparkTexture(): PIXI.Texture {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const gradient = ctx.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        size / 2,
      );
      gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
      gradient.addColorStop(0.35, "rgba(255, 255, 255, 0.9)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    }
    return PIXI.Texture.from(canvas);
  }

  function rgbToHsl(
    r: number,
    g: number,
    b: number,
  ): { h: number; s: number; l: number } {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const delta = max - min;
    let h = 0;
    let s = 0;
    if (delta > 1e-6) {
      s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
      if (max === r) h = ((g - b) / delta) % 6;
      else if (max === g) h = (b - r) / delta + 2;
      else h = (r - g) / delta + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h, s, l };
  }

  function hslToTint(h: number, s: number, l: number): number {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = h / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let r = 0;
    let g = 0;
    let b = 0;
    if (hp < 1) [r, g, b] = [c, x, 0];
    else if (hp < 2) [r, g, b] = [x, c, 0];
    else if (hp < 3) [r, g, b] = [0, c, x];
    else if (hp < 4) [r, g, b] = [0, x, c];
    else if (hp < 5) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    const m = l - c / 2;
    const ri = Math.round((r + m) * 255);
    const gi = Math.round((g + m) * 255);
    const bi = Math.round((b + m) * 255);
    return (ri << 16) | (gi << 8) | bi;
  }

  // 글자 색에서 출발해 채도를 높인 "스파크 색"을 만든다. exclusion 합성에서는
  // 색이 밝을수록 배경과의 차이(반전)가 강해지므로 명도를 다소 높게 잡는다.
  // 글자가 거의 무채색이면 황금빛(45°)으로 대체해 단조로운 흰빛이 되지 않게 한다.
  function makeSparkTint(rgb: [number, number, number]): number {
    const { h, s } = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    const baseHue = s < 0.2 ? 45 : h;
    const hue = (baseHue + (Math.random() - 0.5) * 30 + 360) % 360;
    const sat = Math.min(1, Math.max(0.9, s));
    const light = 0.6 + (Math.random() - 0.5) * 0.12;
    return hslToTint(hue, sat, light);
  }

  // 중심(cx, cy)에서 fireworkCount개의 파티클을 방사형으로 흩뿌린다.
  // 퍼지는 반경은 글자 크기에 비례하지만, 입자 자체 크기는 상한선 안에서만 커진다.
  function spawnFirework(
    cx: number,
    cy: number,
    glyphWorldSize: number,
    color: [number, number, number],
  ) {
    if (!particleLayer || !sparkTexture) return;

    const spread = Math.max(
      baseWidth * fireworkSpreadMinRatio,
      glyphWorldSize * fireworkSpreadFactor,
    );
    // 입자 반지름은 글자 크기에 따르되, 상·하한 사이로 제한해 과도하게 커지지 않게 한다.
    const radius = Math.min(
      baseWidth * fireworkRadiusMaxRatio,
      Math.max(
        baseWidth * fireworkRadiusMinRatio,
        glyphWorldSize * fireworkRadiusFactor,
      ),
    );

    for (let i = 0; i < fireworkCount; i += 1) {
      const angle =
        (i / fireworkCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      // 감속(댐핑)을 고려해 수명 절반 시점 적분이 대략 spread가 되도록 속도를 잡는다.
      const speed =
        ((spread * (1.1 + Math.random() * 0.8)) / fireworkLifeMs) * 2;

      const sprite = new PIXI.Sprite(sparkTexture);
      sprite.anchor.set(0.5);
      sprite.position.set(cx, cy);
      sprite.tint = makeSparkTint(color);
      // exclusion: 배경과 "차이"를 내는 합성이라 어떤 배경색 위에서도 또렷하게
      // 구분되며(검은 배경엔 색 그대로, 밝은 배경엔 반전), 입자 자체 색감도 어느 정도 유지된다.
      sprite.blendMode = "exclusion";

      const baseScale =
        ((radius * 2) / sparkTexture.width) * (0.7 + Math.random() * 0.6);
      sprite.scale.set(baseScale);

      particleLayer.addChild(sprite);
      sparks.push({
        sprite,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ageMs: 0,
        lifeMs: fireworkLifeMs * (0.8 + Math.random() * 0.4),
        baseScale,
      });
    }
  }

  // 매 프레임 파티클을 갱신: 바깥으로 퍼지며(점점 감속) 페이드아웃·축소된다.
  function updateSparks(ticker: PIXI.Ticker) {
    if (sparks.length === 0) return;
    const dt = ticker.deltaMS;
    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const spark = sparks[i];
      spark.ageMs += dt;
      const tNorm = spark.ageMs / spark.lifeMs;
      if (tNorm >= 1) {
        spark.sprite.destroy();
        sparks.splice(i, 1);
        continue;
      }
      const damp = 1 - tNorm; // 시간이 갈수록 속도를 줄인다.
      spark.sprite.position.x += spark.vx * dt * damp;
      spark.sprite.position.y += spark.vy * dt * damp;
      const fade = 1 - tNorm;
      spark.sprite.alpha = fade * fade;
      spark.sprite.scale.set(spark.baseScale * (0.6 + 0.4 * fade));
    }
  }

  function clearSparks() {
    for (const spark of sparks) {
      spark.sprite.destroy();
    }
    sparks = [];
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
    // 초기 크기는 0에서 시작하고, 실제 크기는 updateGlyphAnimations에서 매 갱신마다 설정한다.
    sprite.scale.set(0, 0);
    sprite.alpha = placement.pos.opacity;
    sprite.rotation = (placement.pos.rotation * Math.PI) / 180;
    sprite.tint = makeTint(placement.color);

    glyphLayer.addChild(sprite);
    glyphSprites.push(sprite);
    shownCount += 1;

    if (spawnFx) {
      const glyphWorldSize = charLayout.canvasPixelSize * placement.pos.scale;
      spawnFirework(
        placement.pos.x * baseWidth,
        placement.pos.y * baseHeight,
        glyphWorldSize,
        placement.color,
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

  // 현재 위치 기준으로 보이는 글자들의 등장 애니메이션(크기 0 → 목표 크기, quadOut) 갱신
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

  // 강조 모드: 선택 줄의 글자만 원래 투명도, 나머지는 흐리게.
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

  // 강조 줄의 "현재 보이는" 글자들을 등장 순서대로 잇는 별자리 선을 다시 그린다.
  // 선은 글자 중심까지 닿지 않고 살짝 떨어진 지점(gap)에서 끝난다.
  // (글자가 하나씩 생겨날수록 선분이 점진적으로 늘어난다)
  function redrawConstellation(phraseId: string | null) {
    const gfx = constellationGfx;
    if (!gfx) return;
    gfx.clear();
    if (!phraseId) return;

    // 노드: 글자 위치 + 글자 크기에 따른 gap(선이 멈출 거리)
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

    // 양 끝을 각 글자에서 gap만큼 떼어낸 선분들을 모은다.
    const segments: { ax: number; ay: number; bx: number; by: number }[] = [];
    for (let i = 0; i < nodes.length - 1; i += 1) {
      const a = nodes[i];
      const b = nodes[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      // 두 글자가 너무 가까워 gap을 빼면 선이 뒤집히는 경우는 건너뛴다.
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

    // 선: 어두운 외곽선(어떤 배경에서도 보이게) → 밝은 별빛 코어 순.
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

  // 강조 줄/표시 글자/월드 크기가 바뀌면 dim과 별자리 선을 다시 적용한다.
  $effect(() => {
    const phraseId = highlightPhraseId;
    // shownCount, baseWidth, timedPlacements 의존성은 아래 함수 호출 내부 읽기로 추적된다.
    applyGlyphHighlight(phraseId);
    redrawConstellation(phraseId);
  });

  // 윤곽선 오버레이 표시/숨김 토글을 스프라이트에 반영한다.
  $effect(() => {
    if (edgeSprite) edgeSprite.visible = showEdges;
  });

  function syncPlacementsToTime(position: number) {
    if (!glyphLayer) return;

    // timedPlacements는 startTime 기준 정렬되어 있으므로
    // (startTime - 애니메이션 시간) <= 현재 위치 인 placement 개수를 선형으로 센다.
    // 애니메이션 시간만큼 미리 등장시켜야 startTime에 목표 크기에 도달한다.
    let targetCount = 0;
    for (const placement of timedPlacements) {
      if (placement.startTime - appearAnimMs <= position) targetCount += 1;
      else break;
    }

    // 부족하면 추가, 많으면 제거 (seek/되감기 모두 대응)
    while (shownCount < targetCount) {
      const index = shownCount;
      const placement = timedPlacements[index];
      const appearTime = placement.startTime - appearAnimMs;
      // 실제 재생 중 "지금 막" 등장한 글자에만 파티클을 터뜨린다.
      // (탐색/되감기/초기 렌더의 대량 추가에서는 터지지 않음)
      const isFresh =
        isPlaying &&
        !isSeeking &&
        position - appearTime <= fireworkFreshWindowMs;
      addPlacementAtIndex(index, isFresh);
    }
    while (shownCount > targetCount) {
      removeLastPlacement();
    }

    // 보이는 글자들의 크기 애니메이션을 현재 위치에 맞게 갱신
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

  // 탐색 시작: 탐색 상태로 표시하고, 이벤트가 안 오는 경우를 대비한 자동 해제 타이머를 건다.
  function beginSeek() {
    isSeeking = true;
    if (seekSettleTimer !== null) clearTimeout(seekSettleTimer);
    seekSettleTimer = setTimeout(() => endSeek(playbackPosition), 300);
  }

  // 탐색 종료: 상태를 해제하고 최종 위치로 한 번만 동기화한다.
  function endSeek(position: number) {
    if (seekSettleTimer !== null) {
      clearTimeout(seekSettleTimer);
      seekSettleTimer = null;
    }
    isSeeking = false;
    playbackPosition = position;
    syncPlacementsToTime(position);
  }

  // 드래그/클릭 중: 화면(시간 표시와 글자)만 즉시 갱신.
  // 재생 중 드래그 시 onTimeUpdate가 옛 위치로 덮어쓰지 않도록 탐색 상태로 표시한다.
  function handleScrub(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const value = Number(input.value);
    beginSeek();
    playbackPosition = value;
    syncPlacementsToTime(value);
  }

  // 드래그 종료/클릭 확정: 실제 오디오 재생 위치 이동
  // (탐색 상태는 onSeekComplete 또는 자동 해제 타이머에서 해제된다)
  function handleSeekCommit(event: Event) {
    if (!textAlivePlayer || !playerReady) return;
    const input = event.currentTarget as HTMLInputElement;
    beginSeek();
    textAlivePlayer.requestMediaSeek(Number(input.value));
  }

  // 곡 이미지의 실제 크기를 읽어 월드 좌표계(baseWidth/baseHeight)를 소스와 동일하게 맞춘다.
  // 소스: canvasWidth = image.naturalWidth * dpr, canvasHeight = image.naturalHeight * dpr
  function applyImageBaseSize(url: string) {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth <= 0 || img.naturalHeight <= 0) return;
      const dpr = charLayout.devicePixelRatio;
      baseWidth = img.naturalWidth * dpr;
      baseHeight = img.naturalHeight * dpr;
      // 새 월드 크기에 맞춰 카메라를 다시 맞추고, 현재 위치 기준으로 글자 위치를 재배치한다.
      resetView();
      repositionPlacements();
    };
    img.src = url;
  }

  // baseWidth/baseHeight 변경 시 이미 추가된 스프라이트의 좌표/크기를 다시 계산한다.
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

  // 윤곽선 PNG(검은 선 + 알파)를 로드해 글자 위에 옅게(30%) 얹는다.
  // camera에 가장 마지막으로 addChild 되므로 최상단에 위치한다.
  async function loadEdgeOverlay(url: string, isActive: () => boolean) {
    const texture = await PIXI.Assets.load<PIXI.Texture>(url);
    if (!isActive() || !camera) return;
    const sprite = new PIXI.Sprite(texture);
    sprite.width = baseWidth;
    sprite.height = baseHeight;
    sprite.alpha = 0.3;
    sprite.visible = showEdges;
    // 오버레이는 포인터 이벤트(드래그/줌)를 가로채지 않도록 한다.
    sprite.eventMode = "none";
    camera.addChild(sprite);
    edgeSprite = sprite;
  }

  async function setupPixi(canvas: HTMLCanvasElement, isActive: () => boolean) {
    app = new PIXI.Application();
    camera = new PIXI.Container();
    glyphLayer = new PIXI.Container();
    particleLayer = new PIXI.Container();
    constellationGfx = new PIXI.Graphics();
    // 별자리 선은 글자 뒤에, 파티클은 글자 위에 오도록 순서대로 추가한다.
    camera.addChild(constellationGfx);
    camera.addChild(glyphLayer);
    camera.addChild(particleLayer);
    app.stage.addChild(camera);

    await app.init({
      canvas,
      backgroundAlpha: 1,
      backgroundColor: 0x000000,
      antialias: true,
      // 고급 블렌드 모드('exclusion')가 WebGL에서 동작하려면 백버퍼가 필요하다.
      useBackBuffer: true,
      width: window.innerWidth,
      height: window.innerHeight,
    });
    if (!isActive()) {
      app?.destroy(true);
      app = null;
      camera = null;
      glyphLayer = null;
      particleLayer = null;
      constellationGfx = null;
      return;
    }

    canvas.style.touchAction = "none";
    sparkTexture = createSparkTexture();
    app.ticker.add(updateSparks);
    resetView();

    // 윤곽선 오버레이: 렌더러/카메라가 준비된 뒤 글자 위(최상단)에 올린다.
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
    clearSparks();
    for (const texture of textureCache.values()) {
      texture.destroy(true);
    }
    textureCache.clear();
    sparkTexture?.destroy(true);
    sparkTexture = null;

    constellationGfx?.destroy();
    constellationGfx = null;

    edgeSprite?.destroy();
    edgeSprite = null;

    app?.destroy(true);
    app = null;
    camera = null;
    glyphLayer = null;
    particleLayer = null;
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
    <button class="back" onclick={onBack}> ← {t().player.backToSelect} </button>

    <button onclick={handlePlay} disabled={!playerReady || isPlaying}>
      ▶ {t().player.play}
    </button>
    <button onclick={handlePause} disabled={!playerReady || !isPlaying}>
      ⏸ {t().player.pause}
    </button>
    <button onclick={handleRestart} disabled={!playerReady}>
      ⏮ {t().player.restart}
    </button>

    <button
      class="toggle"
      class:active={showEdges}
      onclick={toggleEdges}
      disabled={!edgeUrl}
    >
      ✦ {t().player.edges}
    </button>
    <button
      class="toggle"
      class:active={highlightMode}
      onclick={toggleHighlightMode}
    >
      ☆ {t().player.constellation}
    </button>

    <span class="status">
      {song.label} — {formatTime(playbackPosition)} / {formatTime(
        playbackDuration,
      )}
      ({shownCount}{t().player.charCountSuffix})
    </span>

    {#if playerError}
      <span class="error">{playerError}</span>
    {/if}
  </div>

  <div class="seekbar">
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

  /* 오른쪽에 정렬된 가사 패널. 시야를 크게 가리지 않도록 폭을 제한하고,
     위/아래 가장자리는 마스크로 서서히 사라지게 한다. */
  .lyrics-panel {
    position: fixed;
    top: 64px;
    right: 0;
    bottom: 72px;
    z-index: 9;
    width: clamp(240px, 30vw, 420px);
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: none;
    -webkit-mask-image: linear-gradient(
      to bottom,
      transparent 0%,
      #000 16%,
      #000 84%,
      transparent 100%
    );
    mask-image: linear-gradient(
      to bottom,
      transparent 0%,
      #000 16%,
      #000 84%,
      transparent 100%
    );
  }

  .lyrics-panel::-webkit-scrollbar {
    display: none;
  }

  /* 첫/마지막 줄도 중앙까지 올라올 수 있도록 위아래로 큰 여백을 둔다.
     왼쪽 여백은 활성 줄이 scale 확대될 때(원점이 오른쪽이라 왼쪽으로 커짐)
     패널 경계에 잘리지 않도록 넉넉히 확보한다. */
  .lyrics-list {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    padding: 42vh 24px 42vh 56px;
  }

  .lyric-line {
    padding: 6px 4px;
    margin: 0;
    width: 100%;
    text-align: right;
    color: #fff;
    font-size: 1.05rem;
    font-weight: 600;
    line-height: 1.45;
    letter-spacing: 0.01em;
    /* 가사는 단순 표시용이라 클릭 동작이 없다. */
    cursor: default;
    user-select: none;
    opacity: 0.42;
    transform: scale(0.94);
    transform-origin: right center;
    /* 단색 글자가 배경과 겹쳐도 보이도록 진한 외곽 그림자를 준다. */
    text-shadow:
      0 0 2px rgba(0, 0, 0, 0.95),
      0 1px 3px rgba(0, 0, 0, 0.9),
      0 0 10px rgba(0, 0, 0, 0.7);
    transition:
      opacity 0.45s cubic-bezier(0.22, 1, 0.36, 1),
      transform 0.45s cubic-bezier(0.22, 1, 0.36, 1),
      color 0.45s ease;
  }

  .lyric-line:hover {
    opacity: 0.8;
  }

  /* 이미 지나간 가사는 더 흐리게 */
  .lyric-line.past {
    opacity: 0.28;
  }

  /* 현재 부르는 가사 줄: 크게, 또렷하게, 살짝 강조 색 */
  .lyric-line.active {
    opacity: 1;
    transform: scale(1.12);
    color: #fff;
    text-shadow:
      0 0 2px rgba(0, 0, 0, 0.98),
      0 1px 4px rgba(0, 0, 0, 0.95),
      0 0 14px rgba(80, 140, 255, 0.55);
  }

  /* 별자리 모드로 선택된 줄: 별빛 색으로 표시 */
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

  button.toggle.active {
    background: rgba(120, 180, 255, 0.38);
    border-color: rgba(160, 205, 255, 0.85);
    box-shadow: 0 0 10px rgba(120, 180, 255, 0.45);
  }

  .status {
    font-size: 0.9rem;
    white-space: nowrap;
  }

  .seekbar {
    position: fixed;
    left: 50%;
    bottom: 16px;
    transform: translateX(-50%);
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 12px;
    width: min(900px, calc(100% - 48px));
    padding: 10px 16px;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 10px;
    color: #fff;
    backdrop-filter: blur(6px);
  }

  .seekbar input[type="range"] {
    flex: 1;
    width: auto;
    cursor: pointer;
    accent-color: #fff;
  }

  .seekbar input[type="range"]:disabled {
    cursor: default;
    opacity: 0.45;
  }

  .time {
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .error {
    color: #ff8a8a;
    font-size: 0.85rem;
    white-space: nowrap;
  }
</style>
