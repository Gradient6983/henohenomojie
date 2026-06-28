<script lang="ts">
  import GlyphPlayer from "./GlyphPlayer.svelte";
  import { t } from "./i18n";
  import type { SongCatalogItem } from "./webgpu/glyph/replayIO";
  import songSource from "./webgpu/glyph/songSource";

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

  const songs = songSource.map((song) => ({
    song,
    available: jsonlBySongId.has(song.id),
  }));

  let selected = $state<{ song: SongCatalogItem; jsonlRaw: string } | null>(
    null,
  );

  function selectSong(song: SongCatalogItem) {
    const jsonlRaw = jsonlBySongId.get(song.id);
    if (!jsonlRaw) return;
    selected = { song, jsonlRaw };
  }

  function back() {
    selected = null;
  }
</script>

{#if selected}
  <GlyphPlayer
    song={selected.song}
    jsonlRaw={selected.jsonlRaw}
    edgeUrl={edgeUrlForSong(selected.song)}
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
        {#each songs as item (item.song.id)}
          <li>
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
</style>
