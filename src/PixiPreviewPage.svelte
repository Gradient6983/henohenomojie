<script lang="ts">
  import GlyphPlayer from "./GlyphPlayer.svelte";
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

  // 훈련 직후 전달된 autoPlaySongId가 있으면 자동으로 해당 곡을 재생한다.
  $effect(() => {
    if (!autoPlaySongId) return;
    const target = songSource.find((s) => s.id === autoPlaySongId);
    if (target) selectSong(target);
    onAutoPlayConsumed?.();
  });
</script>

{#if selected}
  <GlyphPlayer
    song={selected.song}
    jsonlRaw={selected.jsonlRaw}
    edgeUrl={selected.edgeUrl}
    onBack={back}
  />
{:else}
  <div class="select-root">
    <div class="select-inner">
      <header class="select-header">
        <h1>{t().songSelect.title}</h1>
        <p>{t().songSelect.description}</p>
      </header>

      <ul class="song-grid">
        <li>
          <button type="button" class="train-card" onclick={onTrain}>
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
    </div>
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
    background: #0b0b10;
  }

  .select-root {
    position: fixed;
    inset: 0;
    overflow: auto;
    background: radial-gradient(
      circle at 50% 0%,
      #1a1a26 0%,
      #0b0b10 60%
    );
    color: #fff;
  }

  .select-inner {
    max-width: 1100px;
    margin: 0 auto;
    padding: 48px 24px 64px;
  }

  .card-li {
    position: relative;
  }

  .revert-btn {
    position: absolute;
    top: 8px;
    left: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.25);
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    cursor: pointer;
    transition:
      background 0.12s ease,
      transform 0.12s ease;
  }

  .revert-btn:hover {
    background: rgba(120, 170, 255, 0.6);
    transform: scale(1.08);
  }

  .select-header h1 {
    margin: 0 0 8px;
    font-size: 1.8rem;
  }

  .select-header p {
    margin: 0 0 28px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.95rem;
  }

  .song-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
  }

  .song-card {
    display: flex;
    flex-direction: column;
    width: 100%;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.04);
    color: inherit;
    overflow: hidden;
    cursor: pointer;
    text-align: left;
    transition:
      transform 0.12s ease,
      border-color 0.12s ease,
      background 0.12s ease;
  }

  .song-card:hover:not(:disabled) {
    transform: translateY(-3px);
    border-color: rgba(120, 170, 255, 0.6);
    background: rgba(255, 255, 255, 0.08);
  }

  .song-card:disabled {
    cursor: not-allowed;
  }

  .song-card.unavailable {
    opacity: 0.55;
  }

  .thumb {
    position: relative;
    display: block;
    aspect-ratio: 16 / 9;
    background: #000;
  }

  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .badge {
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 3px 8px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.25);
    font-size: 0.75rem;
  }

  .meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 14px 14px;
  }

  .title {
    font-size: 0.95rem;
    font-weight: 600;
    line-height: 1.3;
  }

  .state {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.55);
  }

  .train-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    height: 100%;
    min-height: 180px;
    padding: 20px;
    border: 1px dashed rgba(120, 170, 255, 0.5);
    border-radius: 14px;
    background: rgba(120, 170, 255, 0.06);
    color: inherit;
    cursor: pointer;
    transition:
      transform 0.12s ease,
      border-color 0.12s ease,
      background 0.12s ease;
  }

  .train-card:hover {
    transform: translateY(-3px);
    border-color: rgba(120, 170, 255, 0.9);
    background: rgba(120, 170, 255, 0.12);
  }

  .train-icon {
    font-size: 2rem;
    line-height: 1;
    color: rgba(120, 170, 255, 0.9);
  }

  .train-label {
    font-size: 0.95rem;
    font-weight: 600;
    text-align: center;
  }
</style>
