<script lang="ts">
  import GlyphPlayer from "./GlyphPlayer.svelte";
  import SettingsMenu from "./SettingsMenu.svelte";
  import SummerBackground from "./SummerBackground.svelte";
  import { t } from "./i18n";
  import type { SongCatalogItem } from "./webgpu/glyph/replayIO";
  import songSource from "./webgpu/glyph/songSource";
  import { clearTrainedResult, getTrainedResults } from "./trainedStore.svelte";

  // assets 폴더의 모든 jsonl을 원본 문자열로 불러온다.
  const rawModules = import.meta.glob("./assets/*.jsonl", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;

  // assets 폴더의 edges_*.png(윤곽선 이미지)를 URL로 불러와 곡별로 매핑한다.
  // 파일명은 `edges_<라벨>.png`이며, 라벨의 " / "가 파일시스템 제약상 " _ "로 치환돼 있다.
  const edgeModules = import.meta.glob("./assets/edges_*.png", {
    import: "default",
    eager: true,
  }) as Record<string, string>;

  const edgeUrlByName = new Map<string, string>();
  for (const [path, url] of Object.entries(edgeModules)) {
    const name = path
      .split("/")
      .pop()
      ?.replace(/^edges_/, "")
      .replace(/\.png$/, "");
    if (name) edgeUrlByName.set(name, url);
  }

  function edgeUrlForSong(song: SongCatalogItem): string | undefined {
    return edgeUrlByName.get(song.id.replaceAll(" / ", " _ "));
  }

  // 각 jsonl의 첫 song 레코드의 songId를 키로 매핑한다.
  const jsonlBySongId = new Map<string, string>();
  for (const raw of Object.values(rawModules)) {
    const firstLine = raw.split(/\r?\n/).find((line) => line.trim());
    if (!firstLine) continue;
    try {
      const record = JSON.parse(firstLine) as {
        type?: string;
        songId?: unknown;
      };
      if (record.type === "song" && typeof record.songId === "string") {
        jsonlBySongId.set(record.songId, raw);
      }
    } catch {
      // 파싱 실패한 파일은 무시
    }
  }

  let {
    onTrain,
    autoPlaySongId = null,
    onAutoPlayConsumed,
  }: {
    onTrain: () => void;
    /** 훈련 직후 자동으로 재생할 곡 id */
    autoPlaySongId?: string | null;
    onAutoPlayConsumed?: () => void;
  } = $props();

  // 메모리에 저장된 훈련 결과(반응형). 새 결과가 생기면 목록이 자동 갱신된다.
  const trained = $derived(getTrainedResults());

  // 번들 데이터 또는 메모리 훈련 결과가 있으면 재생 가능으로 표시한다.
  const songs = $derived(
    songSource.map((song) => ({
      // 훈련 결과가 있으면 업로드 이미지로 덮어쓴 song을 사용한다.
      song: trained[song.id]?.song ?? song,
      available: jsonlBySongId.has(song.id) || Boolean(trained[song.id]),
    })),
  );

  let selected = $state<{
    song: SongCatalogItem;
    jsonlRaw: string;
    edgeUrl?: string;
  } | null>(null);

  function selectSong(song: SongCatalogItem) {
    // 훈련 결과를 우선하고, 없으면 번들 jsonl을 사용한다.
    const trainedResult = trained[song.id];
    if (trainedResult) {
      selected = {
        song: trainedResult.song,
        jsonlRaw: trainedResult.jsonlRaw,
        edgeUrl: trainedResult.edgeUrl,
      };
      return;
    }
    const jsonlRaw = jsonlBySongId.get(song.id);
    if (!jsonlRaw) return;
    selected = { song, jsonlRaw, edgeUrl: edgeUrlForSong(song) };
  }

  function back() {
    selected = null;
  }

  // 훈련 결과를 지워 원래 이미지/데이터로 되돌린다.
  function revert(id: string) {
    clearTrainedResult(id);
  }

  // WebGPU 미지원 경고 모달 상태와 감지 중 플래그.
  let webgpuWarningOpen = $state(false);
  let checkingWebGPU = $state(false);

  // 현재 브라우저에서 WebGPU를 실제로 사용할 수 있는지 확인한다.
  async function detectWebGPU(): Promise<boolean> {
    if (typeof navigator === "undefined" || !("gpu" in navigator)) {
      return false;
    }
    try {
      const adapter = await navigator.gpu.requestAdapter();
      return Boolean(adapter);
    } catch {
      return false;
    }
  }

  // 직접 훈련 진입 전에 WebGPU 가능 여부를 확인하고, 불가능하면 경고를 띄운다.
  async function handleTrainClick() {
    if (checkingWebGPU) return;
    checkingWebGPU = true;
    const ok = await detectWebGPU();
    checkingWebGPU = false;
    if (ok) {
      onTrain();
    } else {
      webgpuWarningOpen = true;
    }
  }

  // 소개 영역에서 곡 선택 섹션으로 부드럽게 스크롤한다.
  function scrollToSongs() {
    const target = document.getElementById("song-section");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // 훈련 직후 전달된 autoPlaySongId가 있으면 자동으로 해당 곡을 재생한다.
  $effect(() => {
    if (!autoPlaySongId) return;
    const target = songSource.find((s) => s.id === autoPlaySongId);
    if (target) selectSong(target);
    onAutoPlayConsumed?.();
  });
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape" && webgpuWarningOpen) webgpuWarningOpen = false;
  }}
/>

{#if selected}
  <GlyphPlayer
    song={selected.song}
    jsonlRaw={selected.jsonlRaw}
    edgeUrl={selected.edgeUrl}
    onBack={back}
  />
{:else}
  <div class="select-root">
    <SummerBackground />

    <div class="select-topbar">
      <SettingsMenu />
    </div>

    <div class="select-inner">
      <!-- 1) 소개(히어로) 영역 -->
      <section class="hero">
        <p class="hero-sub">{t().home.siteNameSub}</p>
        <h1 class="hero-title">{t().home.siteName}</h1>
        <p class="hero-tagline">{t().home.tagline}</p>
        <p class="hero-body">{t().home.introBody}</p>

        <div class="howto-card">
          <h2 class="howto-title">{t().home.howToTitle}</h2>
          <ol class="howto-list">
            {#each t().home.howToSteps as step, i (i)}
              <li>
                <span class="howto-num">{i + 1}</span>
                <span class="howto-text">{step}</span>
              </li>
            {/each}
          </ol>
        </div>

        <button type="button" class="scroll-hint" onclick={scrollToSongs}>
          <span>{t().home.scrollHint}</span>
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </section>

      <!-- 2) 주의 사항 (WebGPU 미지원 브라우저 안내) -->
      <section class="notice" aria-label={t().home.noticeTitle}>
        <span class="notice-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </span>
        <div class="notice-body">
          <h2>{t().home.noticeTitle}</h2>
          <p>{t().home.noticeBody}</p>
        </div>
      </section>

      <!-- 3) 곡 선택 영역 -->
      <section id="song-section" class="song-section">
        <header class="select-header">
          <h2>{t().home.songSectionTitle}</h2>
          <p>{t().home.songSectionDesc}</p>
        </header>

        <ul class="song-grid">
          <li>
            <button
              type="button"
              class="train-card"
              disabled={checkingWebGPU}
              onclick={handleTrainClick}
            >
              <span class="train-icon">+</span>
              <span class="train-label">{t().songSelect.trainEntry}</span>
            </button>
          </li>
          {#each songs as item (item.song.id)}
            <li class="card-li">
              <button
                type="button"
                class="song-card"
                class:unavailable={!item.available}
                disabled={!item.available}
                onclick={() => selectSong(item.song)}
              >
                <span class="thumb">
                  <img src={item.song.imageUrl} alt={item.song.label} />
                  {#if !item.available}
                    <span class="badge">{t().songSelect.badgePreparing}</span>
                  {/if}
                </span>
                <span class="meta">
                  <span class="title">{item.song.label}</span>
                  <span class="state">
                    {item.available
                      ? t().songSelect.available
                      : t().songSelect.unavailable}
                  </span>
                </span>
              </button>

              {#if trained[item.song.id]}
                <button
                  type="button"
                  class="revert-btn"
                  title={t().songSelect.revert}
                  aria-label={t().songSelect.revert}
                  onclick={() => revert(item.song.id)}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                </button>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    </div>

    {#if webgpuWarningOpen}
      <div
        class="modal-backdrop"
        role="presentation"
        onclick={(e) => {
          if (e.target === e.currentTarget) webgpuWarningOpen = false;
        }}
      >
        <div
          class="modal"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="webgpu-warning-title"
          tabindex="-1"
        >
          <span class="modal-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="28"
              height="28"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
          <h2 id="webgpu-warning-title">{t().home.webgpuWarningTitle}</h2>
          <p>{t().home.webgpuWarningBody}</p>
          <button
            type="button"
            class="modal-close"
            onclick={() => (webgpuWarningOpen = false)}
          >
            {t().home.webgpuWarningClose}
          </button>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  :global(html),
  :global(body) {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
  }

  :global(body) {
    background: #cdeafa;
  }

  /* 여름 · 해바라기 · 흰 원피스 미쿠 무드: 맑은 하늘에서 따뜻한 크림빛으로 */
  .select-root {
    --teal: #2bb7ac;
    --teal-deep: #1d8d84;
    --sun: #f6b73c;
    --sun-deep: #e89a1c;
    --ink: #2f4f57;
    --ink-soft: #5b7a82;
    position: fixed;
    inset: 0;
    overflow: auto;
    background: linear-gradient(
      180deg,
      #bfe7fb 0%,
      #d8f1fb 26%,
      #eef9f3 56%,
      #fdf6e6 82%,
      #fff4dc 100%
    );
    color: var(--ink);
  }

  .select-topbar {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px;
    background: rgba(43, 183, 172, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.6);
    border-radius: 999px;
    backdrop-filter: blur(10px);
    box-shadow: 0 8px 22px rgba(29, 141, 132, 0.28);
  }

  .select-inner {
    position: relative;
    z-index: 1;
    max-width: 1100px;
    margin: 0 auto;
    padding: 64px 24px 72px;
  }

  /* ── 히어로(소개) ── */
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 40px 0 28px;
  }

  .hero-sub {
    margin: 0;
    font-size: 0.85rem;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--teal-deep);
    font-weight: 700;
  }

  .hero-title {
    margin: 10px 0 6px;
    font-size: clamp(2.6rem, 7vw, 4.4rem);
    font-weight: 800;
    line-height: 1.05;
    color: var(--ink);
    text-shadow: 0 2px 0 rgba(255, 255, 255, 0.7);
  }

  .hero-tagline {
    margin: 0 0 22px;
    font-size: clamp(1rem, 2.4vw, 1.3rem);
    font-weight: 600;
    color: var(--teal-deep);
  }

  .hero-body {
    max-width: 640px;
    margin: 0 0 30px;
    font-size: 1.02rem;
    line-height: 1.85;
    color: var(--ink-soft);
  }

  .howto-card {
    width: 100%;
    max-width: 720px;
    margin: 0 0 28px;
    padding: 24px 26px;
    text-align: left;
    background: rgba(255, 255, 255, 0.72);
    border: 1px solid rgba(255, 255, 255, 0.9);
    border-radius: 22px;
    box-shadow: 0 16px 40px rgba(91, 122, 130, 0.16);
    backdrop-filter: blur(6px);
  }

  .howto-title {
    margin: 0 0 16px;
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--ink);
  }

  .howto-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .howto-list li {
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }

  .howto-num {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--sun), var(--sun-deep));
    color: #fff;
    font-size: 0.9rem;
    font-weight: 700;
    box-shadow: 0 4px 10px rgba(232, 154, 28, 0.35);
  }

  .howto-text {
    font-size: 0.96rem;
    line-height: 1.6;
    color: var(--ink-soft);
    padding-top: 2px;
  }

  .scroll-hint {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border: none;
    border-radius: 999px;
    background: rgba(43, 183, 172, 0.16);
    color: var(--teal-deep);
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      background 0.15s ease,
      transform 0.15s ease;
  }

  .scroll-hint:hover {
    background: rgba(43, 183, 172, 0.28);
  }

  .scroll-hint svg {
    animation: bob 1.6s ease-in-out infinite;
  }

  @keyframes bob {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(4px);
    }
  }

  /* ── 주의 사항 ── */
  .notice {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    margin: 8px 0 48px;
    padding: 18px 22px;
    background: rgba(255, 246, 224, 0.92);
    border: 1px solid rgba(246, 183, 60, 0.55);
    border-radius: 18px;
    box-shadow: 0 10px 26px rgba(232, 154, 28, 0.14);
  }

  .notice-icon {
    flex: none;
    color: var(--sun-deep);
    margin-top: 1px;
  }

  .notice-body h2 {
    margin: 0 0 6px;
    font-size: 1rem;
    font-weight: 700;
    color: #9a6a10;
  }

  .notice-body p {
    margin: 0;
    font-size: 0.92rem;
    line-height: 1.65;
    color: #8a6a2f;
  }

  /* ── 곡 선택 ── */
  .song-section {
    scroll-margin-top: 24px;
  }

  .card-li {
    position: relative;
  }

  .revert-btn {
    position: absolute;
    top: 10px;
    left: 10px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.8);
    background: rgba(43, 183, 172, 0.92);
    color: #fff;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(29, 141, 132, 0.3);
    transition:
      background 0.12s ease,
      transform 0.12s ease;
  }

  .revert-btn:hover {
    background: var(--teal-deep);
    transform: scale(1.08);
  }

  .select-header h2 {
    margin: 0 0 8px;
    font-size: 1.7rem;
    font-weight: 800;
    color: var(--ink);
  }

  .select-header p {
    margin: 0 0 28px;
    color: var(--ink-soft);
    font-size: 0.98rem;
  }

  .song-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 22px;
  }

  .song-card {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.9);
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.78);
    color: inherit;
    overflow: hidden;
    cursor: pointer;
    text-align: left;
    box-shadow: 0 12px 30px rgba(91, 122, 130, 0.14);
    transition:
      transform 0.16s ease,
      border-color 0.16s ease,
      box-shadow 0.16s ease;
  }

  .song-card:hover:not(:disabled) {
    transform: translateY(-5px);
    border-color: rgba(43, 183, 172, 0.7);
    box-shadow: 0 20px 44px rgba(43, 183, 172, 0.24);
  }

  .song-card:disabled {
    cursor: not-allowed;
  }

  .song-card.unavailable {
    opacity: 0.6;
  }

  .thumb {
    position: relative;
    display: block;
    aspect-ratio: 4 / 3;
    background: linear-gradient(160deg, #eaf6f4, #fdf3dc);
  }

  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }

  .badge {
    position: absolute;
    top: 10px;
    right: 10px;
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(47, 79, 87, 0.82);
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.4);
    font-size: 0.75rem;
    font-weight: 600;
  }

  .meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px 16px 16px;
  }

  .title {
    font-size: 1rem;
    font-weight: 700;
    line-height: 1.3;
    color: var(--ink);
  }

  .state {
    font-size: 0.82rem;
    color: var(--ink-soft);
  }

  .train-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    width: 100%;
    height: 100%;
    min-height: 220px;
    padding: 22px;
    border: 2px dashed rgba(43, 183, 172, 0.55);
    border-radius: 20px;
    background: rgba(43, 183, 172, 0.08);
    color: var(--teal-deep);
    cursor: pointer;
    transition:
      transform 0.16s ease,
      border-color 0.16s ease,
      background 0.16s ease;
  }

  .train-card:hover:not(:disabled) {
    transform: translateY(-5px);
    border-color: rgba(43, 183, 172, 0.95);
    background: rgba(43, 183, 172, 0.16);
  }

  .train-card:disabled {
    cursor: progress;
    opacity: 0.7;
  }

  .train-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--sun), var(--sun-deep));
    color: #fff;
    font-size: 2rem;
    line-height: 1;
    box-shadow: 0 8px 18px rgba(232, 154, 28, 0.35);
  }

  .train-label {
    font-size: 0.98rem;
    font-weight: 700;
    text-align: center;
  }

  /* ── WebGPU 경고 모달 ── */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(47, 79, 87, 0.4);
    backdrop-filter: blur(4px);
  }

  .modal {
    width: min(440px, 100%);
    padding: 30px 28px 24px;
    text-align: center;
    background: #fff;
    border-radius: 22px;
    box-shadow: 0 24px 60px rgba(47, 79, 87, 0.3);
  }

  .modal-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 60px;
    height: 60px;
    margin-bottom: 14px;
    border-radius: 50%;
    background: rgba(246, 183, 60, 0.16);
    color: var(--sun-deep);
  }

  .modal h2 {
    margin: 0 0 10px;
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--ink);
  }

  .modal p {
    margin: 0 0 22px;
    font-size: 0.96rem;
    line-height: 1.7;
    color: var(--ink-soft);
  }

  .modal-close {
    padding: 11px 30px;
    border: none;
    border-radius: 999px;
    background: linear-gradient(135deg, var(--teal), var(--teal-deep));
    color: #fff;
    font-size: 0.98rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 8px 20px rgba(29, 141, 132, 0.3);
    transition: transform 0.12s ease;
  }

  .modal-close:hover {
    transform: translateY(-2px);
  }

  @media (prefers-reduced-motion: reduce) {
    .scroll-hint svg {
      animation: none;
    }
  }
</style>
