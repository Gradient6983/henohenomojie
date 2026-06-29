<script lang="ts">
  import GlyphPlayer from "./GlyphPlayer.svelte";
  import SettingsMenu from "./components/SettingsMenu.svelte";
  import SummerBackground from "./components/SummerBackground.svelte";
  import SongCard from "./components/SongCard.svelte";
  import Modal from "./components/Modal.svelte";
  import AlertTriangleIcon from "./components/AlertTriangleIcon.svelte";
  import { t } from "../i18n";
  import songSource from "../const/songCatalog";
  import type { SongCatalogItem } from "../types/song";
  import { clearTrainedResult, getTrainedResults } from "../stores/trainedStore.svelte";

  // Load all jsonl files in the assets folder as raw strings.
  const rawModules = import.meta.glob("../assets/*.jsonl", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;

  // Load the edges_*.png (edge images) in the assets folder as URLs and map them per song.
  // The filename is `edges_<label>.png`, and the " / " in the label has been replaced with " _ " due to filesystem constraints.
  const edgeModules = import.meta.glob("../assets/edges_*.png", {
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

  // Map each jsonl by the songId of its first song record as the key.
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
      // Ignore files that fail to parse
    }
  }

  let {
    onTrain,
    autoPlaySongId = null,
    onAutoPlayConsumed,
  }: {
    onTrain: () => void;
    /** Song id to auto-play right after training */
    autoPlaySongId?: string | null;
    onAutoPlayConsumed?: () => void;
  } = $props();

  // Training results stored in memory (reactive). When a new result is created, the list updates automatically.
  const trained = $derived(getTrainedResults());

  // Mark as playable if there is either bundled data or an in-memory training result.
  const songs = $derived(
    songSource.map((song) => ({
      // If a training result exists, use the song overwritten with the uploaded image.
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
    // Prefer the training result; if none, use the bundled jsonl.
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

  // Clear the training result to revert to the original image/data.
  function revert(id: string) {
    clearTrainedResult(id);
  }

  // State for the WebGPU-unsupported warning modal and the detecting flag.
  let webgpuWarningOpen = $state(false);
  let checkingWebGPU = $state(false);

  // Check whether WebGPU is actually usable in the current browser.
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

  // Before entering custom training, check WebGPU availability, and show a warning if it is unavailable.
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

  // Smoothly scroll from the intro area to the song selection section.
  function scrollToSongs() {
    const target = document.getElementById("song-section");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // If an autoPlaySongId was passed right after training, automatically play that song.
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
      <!-- 1) Intro (hero) area -->
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

      <!-- 2) Notice (guidance for browsers without WebGPU support) -->
      <section class="notice" aria-label={t().home.noticeTitle}>
        <span class="notice-icon" aria-hidden="true">
          <AlertTriangleIcon />
        </span>
        <div class="notice-body">
          <h2>{t().home.noticeTitle}</h2>
          <p>{t().home.noticeBody}</p>
        </div>
      </section>

      <!-- 3) Song selection area -->
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
            <SongCard
              song={item.song}
              available={item.available}
              isTrained={Boolean(trained[item.song.id])}
              onSelect={() => selectSong(item.song)}
              onRevert={() => revert(item.song.id)}
            />
          {/each}
        </ul>
      </section>
    </div>

    {#if webgpuWarningOpen}
      <Modal
        title={t().home.webgpuWarningTitle}
        body={t().home.webgpuWarningBody}
        closeLabel={t().home.webgpuWarningClose}
        onClose={() => (webgpuWarningOpen = false)}
      >
        {#snippet icon()}
          <AlertTriangleIcon size={28} />
        {/snippet}
      </Modal>
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

  /* Summer · sunflower · white-dress Miku mood: from a clear sky to a warm cream tone
     (the color palette tokens are shared globally via :root in app.css) */
  .select-root {
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
    background: var(--teal);
    border: 1px solid var(--teal-deep);
    border-radius: 4px;
  }

  .select-inner {
    position: relative;
    z-index: 1;
    max-width: 1100px;
    margin: 0 auto;
    padding: 64px 24px 72px;
  }

  /* ── Hero (intro) ── */
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
    background: rgba(255, 255, 255, 0.85);
    border: 1px solid rgba(91, 122, 130, 0.2);
    border-radius: 4px;
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
    border-radius: 4px;
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

  /* ── Notice ── */
  .notice {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    margin: 8px 0 48px;
    padding: 18px 22px;
    background: rgba(255, 246, 224, 0.92);
    border: 1px solid rgba(246, 183, 60, 0.55);
    border-radius: 4px;
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

  /* ── Song selection ── */
  .song-section {
    scroll-margin-top: 24px;
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
    border-radius: 4px;
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
  }

  .train-label {
    font-size: 0.98rem;
    font-weight: 700;
    text-align: center;
  }

  @media (prefers-reduced-motion: reduce) {
    .scroll-hint svg {
      animation: none;
    }
  }
</style>
