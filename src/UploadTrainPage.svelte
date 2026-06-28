<script lang="ts">
  import { onDestroy } from "svelte";
  import { t } from "./i18n";
  import type { SongCatalogItem } from "./webgpu/glyph/replayIO";
  import songSource from "./webgpu/glyph/songSource";
  import sample1 from "./assets/sample_1.png";
  import sample2 from "./assets/sample_2.png";
  import App from "./App.svelte";

  let {
    onBack,
    onPlay,
  }: {
    onBack: () => void;
    /** 훈련 완료 후 재생 화면으로 이동 (songId 전달) */
    onPlay: (songId: string) => void;
  } = $props();

  // 선택 가능한 예시 이미지 목록
  const sampleImages = [
    { url: sample1, label: "sample 1" },
    { url: sample2, label: "sample 2" },
  ];

  type TrainPhase =
    | "preparing"
    | "extracting"
    | "training"
    | "finalizing"
    | "done"
    | "cancelled"
    | "error";

  let imageUrl = $state<string | null>(null);
  let fileName = $state("");
  let selectedSongId = $state(songSource[0].id);

  // 업로드로 생성한 object URL만 따로 추적해 정리(revoke)한다.
  // 예시 이미지는 번들 에셋 URL이라 revoke 대상이 아니다.
  let objectUrl: string | null = null;

  // 훈련 시작 시점에 확정된 이미지/곡. App은 이 값으로 마운트된다.
  let activeImageUrl = $state<string | null>(null);
  let activeSong = $state<SongCatalogItem | null>(null);

  // 훈련 진행 단계 / 취소 신호는 부모(이 컴포넌트)가 소유한다.
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

  // 이미지/곡이 바뀐 채로 다시 "훈련 시작"을 누르면 App을 새로 마운트하기 위한 키
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

  function selectSample(sample: { url: string; label: string }) {
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
          <App
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
    background: radial-gradient(circle at 50% 0%, #1a1a26 0%, #0b0b10 60%);
    color: #fff;
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
    border: 1px dashed rgba(255, 255, 255, 0.15);
    border-radius: 14px;
    color: rgba(255, 255, 255, 0.45);
    text-align: center;
  }

  .upload-header h1 {
    margin: 12px 0 8px;
    font-size: 1.8rem;
  }

  .upload-header p {
    margin: 0;
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.95rem;
  }

  .back {
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.04);
    color: inherit;
    padding: 6px 12px;
    border-radius: 999px;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .back:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .step {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .step h2 {
    margin: 0;
    font-size: 1.05rem;
    color: rgba(255, 255, 255, 0.85);
  }

  .file-field {
    display: inline-flex;
    flex-direction: column;
    gap: 8px;
  }

  .file-field span {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .sample-hint {
    margin: 0;
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.6);
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
    border: 2px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    overflow: hidden;
    cursor: pointer;
    transition:
      transform 0.12s ease,
      border-color 0.12s ease;
  }

  .sample-card:hover {
    transform: translateY(-2px);
    border-color: rgba(120, 170, 255, 0.6);
  }

  .sample-card.selected {
    border-color: rgba(120, 170, 255, 0.95);
  }

  .sample-card img {
    width: 100%;
    aspect-ratio: 1 / 1;
    object-fit: cover;
    display: block;
  }

  .preview {
    margin: 0;
  }

  .preview img {
    max-width: 100%;
    max-height: 320px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    display: block;
  }

  .preview figcaption {
    margin-top: 8px;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.55);
  }

  select {
    padding: 8px 10px;
    border-radius: 8px;
    background: #15151f;
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.18);
    max-width: 360px;
  }

  /* 드롭다운 펼침 목록(option)도 다크 배경/밝은 글자로 맞춰 가독성을 확보한다. */
  select option {
    background: #15151f;
    color: #fff;
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
    border-radius: 10px;
    border: 1px solid transparent;
    color: #fff;
    font-size: 0.95rem;
    cursor: pointer;
    transition:
      background 0.12s ease,
      transform 0.12s ease;
  }

  .start {
    border-color: rgba(120, 170, 255, 0.6);
    background: rgba(120, 170, 255, 0.18);
  }

  .start:hover:not(:disabled),
  .play:hover:not(:disabled) {
    background: rgba(120, 170, 255, 0.32);
    transform: translateY(-2px);
  }

  .cancel {
    border-color: rgba(255, 120, 120, 0.5);
    background: rgba(255, 120, 120, 0.14);
    color: #ffd2d2;
  }

  .cancel:hover:not(:disabled) {
    background: rgba(255, 120, 120, 0.28);
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
    border-color: rgba(120, 170, 255, 0.7);
    background: rgba(120, 170, 255, 0.28);
    font-weight: 600;
  }
</style>
