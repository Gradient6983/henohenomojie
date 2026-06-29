<script lang="ts">
  import { onDestroy } from "svelte";
  import { t } from "../i18n";
  import songSource from "../const/songCatalog";
  import type { SongCatalogItem } from "../types/song";
  import type { TrainPhase } from "../types/train";
  import sample1 from "../assets/sample_1.png";
  import sample2 from "../assets/sample_2.png";
  import GlyphTrainer from "./GlyphTrainer.svelte";

  let {
    onBack,
    onPlay,
  }: {
    onBack: () => void;
    /** Move to the playback screen after training completes (passes songId) */
    onPlay: (songId: string) => void;
  } = $props();

  type SampleImage = {
    url: string;
    label: string;
    credit: { source: string; href: string };
  };

  // List of selectable sample images
  const sampleImages: SampleImage[] = [
    {
      url: sample1,
      label: "sample 1",
      credit: {
        source: "Unsplash",
        href: "https://unsplash.com/ko/%EC%82%AC%EC%A7%84/%EB%85%B8%EB%9E%80-%EA%BD%83%EC%9E%8E%EC%9D%B4-%EB%8B%AC%EB%A6%B0-%EA%BD%83%EC%9D%98-%EC%84%A0%ED%83%9D%EC%A0%81-%EC%B4%88%EC%A0%90-%EC%82%AC%EC%A7%84-A_D10XO24FE",
      },
    },
    {
      url: sample2,
      label: "sample 2",
      credit: {
        source: "円G (piapro)",
        href: "https://piapro.jp/t/kvvL",
      },
    },
  ];

  let imageUrl = $state<string | null>(null);
  let fileName = $state("");
  let selectedSongId = $state(songSource[0].id);

  // Track and clean up (revoke) only the object URL created from an upload.
  // Sample images are bundled asset URLs, so they are not subject to revoke.
  let objectUrl: string | null = null;

  // The image/song fixed at the moment training starts. App is mounted with these values.
  let activeImageUrl = $state<string | null>(null);
  let activeSong = $state<SongCatalogItem | null>(null);

  // The training phase / cancellation signal are owned by the parent (this component).
  let trainingPhase = $state<TrainPhase | null>(null);
  let abortController = $state<AbortController | null>(null);

  const selectedSong = $derived(
    songSource.find((song) => song.id === selectedSongId) ?? songSource[0],
  );

  const isRunning = $derived(
    trainingPhase === "preparing" ||
      trainingPhase === "extracting" ||
      trainingPhase === "training" ||
      trainingPhase === "finalizing",
  );

  // Key used to remount App when "Start training" is pressed again with a changed image/song
  const appKey = $derived(
    activeImageUrl ? `${activeImageUrl}::${activeSong?.id ?? ""}` : "",
  );

  function revokeObjectUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function handleFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    revokeObjectUrl();
    objectUrl = URL.createObjectURL(file);
    imageUrl = objectUrl;
    fileName = file.name;
  }

  function selectSample(sample: SampleImage) {
    revokeObjectUrl();
    imageUrl = sample.url;
    fileName = sample.label;
  }

  function handleStart() {
    if (!imageUrl || isRunning) return;
    abortController = new AbortController();
    trainingPhase = "preparing";
    activeImageUrl = imageUrl;
    activeSong = selectedSong;
  }

  function handleCancel() {
    abortController?.abort();
    abortController = null;
    activeImageUrl = null;
    activeSong = null;
    trainingPhase = null;
  }

  function handlePlay() {
    if (activeSong) onPlay(activeSong.id);
  }

  onDestroy(() => {
    abortController?.abort();
    revokeObjectUrl();
  });
</script>

<div class="upload-root">
  <div class="workspace">
    <aside class="controls-panel">
      <header class="upload-header">
        <button type="button" class="back" onclick={onBack}>
          ← {t().songSelect.title}
        </button>
        <h1>{t().upload.title}</h1>
        <p>{t().upload.description}</p>
      </header>

      <section class="step">
        <h2>{t().upload.imageStep}</h2>
        <label class="file-field">
          <input type="file" accept="image/*" onchange={handleFile} />
          <span>{t().upload.pickImage}</span>
        </label>

        <p class="sample-hint">{t().upload.sampleHint}</p>
        <ul class="sample-grid">
          {#each sampleImages as sample (sample.url)}
            <li>
              <button
                type="button"
                class="sample-card"
                class:selected={imageUrl === sample.url}
                onclick={() => selectSample(sample)}
              >
                <img src={sample.url} alt={sample.label} />
              </button>
              <small class="sample-credit">
                {t().upload.sampleCredit}:
                <a
                  href={sample.credit.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {sample.credit.source}
                </a>
              </small>
            </li>
          {/each}
        </ul>

        {#if imageUrl}
          <figure class="preview">
            <img src={imageUrl} alt={fileName} />
            <figcaption>{fileName}</figcaption>
          </figure>
        {/if}
      </section>

      <section class="step">
        <h2>{t().upload.songStep}</h2>
        <select bind:value={selectedSongId}>
          {#each songSource as song (song.id)}
            <option value={song.id}>{song.label}</option>
          {/each}
        </select>
      </section>

      <div class="action-row">
        <button
          type="button"
          class="start"
          disabled={!imageUrl || isRunning}
          onclick={handleStart}
        >
          {t().upload.start}
        </button>
        <button
          type="button"
          class="cancel"
          disabled={!isRunning}
          onclick={handleCancel}
        >
          {t().train.cancel}
        </button>
      </div>

      {#if trainingPhase === "done"}
        <div class="play-section">
          <button type="button" class="play" onclick={handlePlay}>
            {t().train.play}
          </button>
        </div>
      {/if}
    </aside>

    <main class="app-panel">
      {#if activeImageUrl && activeSong}
        {#key appKey}
          <GlyphTrainer
            imageUrl={activeImageUrl}
            song={activeSong}
            signal={abortController?.signal}
            onPhaseChange={(phase) => (trainingPhase = phase)}
          />
        {/key}
      {:else}
        <div class="app-placeholder">
          <p>{t().upload.placeholder}</p>
        </div>
      {/if}
    </main>
  </div>
</div>

<style>
  .upload-root {
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

  .workspace {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 24px;
    max-width: 1280px;
    margin: 0 auto;
    padding: 40px 24px 64px;
  }

  .controls-panel {
    flex: 1 1 320px;
    min-width: 300px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .app-panel {
    flex: 2 1 480px;
    min-width: 320px;
  }

  .app-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 320px;
    padding: 24px;
    border: 1px dashed rgba(43, 183, 172, 0.4);
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.5);
    color: var(--ink-soft);
    text-align: center;
  }

  .upload-header h1 {
    margin: 12px 0 8px;
    font-size: 1.8rem;
    color: var(--ink);
  }

  .upload-header p {
    margin: 0;
    color: var(--ink-soft);
    font-size: 0.95rem;
  }

  .back {
    border: 1px solid rgba(43, 183, 172, 0.5);
    background: rgba(255, 255, 255, 0.6);
    color: var(--teal-deep);
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .back:hover {
    background: rgba(43, 183, 172, 0.12);
  }

  .step {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .step h2 {
    margin: 0;
    font-size: 1.05rem;
    color: var(--ink);
  }

  .file-field {
    display: inline-flex;
    flex-direction: column;
    gap: 8px;
  }

  .file-field span {
    font-size: 0.8rem;
    color: var(--ink-soft);
  }

  .sample-hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--ink-soft);
  }

  .sample-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
  }

  .sample-card {
    width: 100%;
    padding: 0;
    border: 2px solid rgba(91, 122, 130, 0.2);
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.85);
    overflow: hidden;
    cursor: pointer;
    transition:
      transform 0.12s ease,
      border-color 0.12s ease;
  }

  .sample-card:hover {
    transform: translateY(-2px);
    border-color: rgba(43, 183, 172, 0.7);
  }

  .sample-card.selected {
    border-color: var(--teal);
  }

  .sample-card img {
    width: 100%;
    aspect-ratio: 1 / 1;
    object-fit: cover;
    display: block;
  }

  .sample-credit {
    display: block;
    margin-top: 4px;
    font-size: 0.7rem;
    line-height: 1.3;
    color: var(--ink-soft);
  }

  .sample-credit a {
    color: var(--teal);
  }

  .preview {
    margin: 0;
  }

  .preview img {
    max-width: 100%;
    max-height: 320px;
    border-radius: 4px;
    border: 1px solid rgba(47, 79, 87, 0.12);
    display: block;
  }

  .preview figcaption {
    margin-top: 8px;
    font-size: 0.8rem;
    color: var(--ink-soft);
  }

  select {
    padding: 8px 10px;
    border-radius: 4px;
    background: #fff;
    color: var(--ink);
    border: 1px solid rgba(47, 79, 87, 0.2);
    max-width: 360px;
  }

  /* Make the dropdown's expanded list (option) use a light background / dark text too, to ensure readability. */
  select option {
    background: #fff;
    color: var(--ink);
  }

  .action-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .start,
  .cancel,
  .play {
    padding: 10px 22px;
    border-radius: 4px;
    border: 1px solid transparent;
    color: #fff;
    font-size: 0.95rem;
    cursor: pointer;
    transition:
      background 0.12s ease,
      transform 0.12s ease;
  }

  .start {
    border-color: transparent;
    background: linear-gradient(135deg, var(--teal), var(--teal-deep));
  }

  .start:hover:not(:disabled),
  .play:hover:not(:disabled) {
    transform: translateY(-2px);
  }

  .cancel {
    border-color: rgba(214, 90, 90, 0.5);
    background: rgba(214, 90, 90, 0.12);
    color: #c0392b;
  }

  .cancel:hover:not(:disabled) {
    background: rgba(214, 90, 90, 0.22);
    transform: translateY(-2px);
  }

  .start:disabled,
  .cancel:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .play-section {
    margin-top: 4px;
  }

  .play {
    border-color: transparent;
    background: linear-gradient(135deg, var(--teal), var(--teal-deep));
    font-weight: 600;
  }
</style>
