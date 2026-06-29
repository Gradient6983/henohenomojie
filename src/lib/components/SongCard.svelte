<script lang="ts">
  import { t } from "../../i18n";
  import type { SongCatalogItem } from "../../types/song";

  let {
    song,
    available,
    isTrained,
    onSelect,
    onRevert,
  }: {
    /** The song this card represents */
    song: SongCatalogItem;
    /** Whether the song is available for playback */
    available: boolean;
    /** Whether this is a result the user trained themselves (shows the revert button) */
    isTrained: boolean;
    /** Called when the card is clicked */
    onSelect: () => void;
    /** Called when the revert button is clicked */
    onRevert: () => void;
  } = $props();
</script>

<li class="card-li">
  <button
    type="button"
    class="song-card"
    class:unavailable={!available}
    disabled={!available}
    onclick={onSelect}
  >
    <span class="thumb">
      <img src={song.imageUrl} alt={song.label} />
      {#if !available}
        <span class="badge">{t().songSelect.badgePreparing}</span>
      {/if}
    </span>
    <span class="meta">
      <span class="title">{song.label}</span>
      <span class="state">
        {available ? t().songSelect.available : t().songSelect.unavailable}
      </span>
    </span>
  </button>

  {#if isTrained}
    <button
      type="button"
      class="revert-btn"
      title={t().songSelect.revert}
      aria-label={t().songSelect.revert}
      onclick={onRevert}
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

<style>
  .card-li {
    position: relative;
  }

  .song-card {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 1px solid rgba(91, 122, 130, 0.2);
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.85);
    color: inherit;
    overflow: hidden;
    cursor: pointer;
    text-align: left;
    transition:
      transform 0.16s ease,
      border-color 0.16s ease;
  }

  .song-card:hover:not(:disabled) {
    transform: translateY(-3px);
    border-color: var(--teal);
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
    border-radius: 3px;
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
    transition:
      background 0.12s ease,
      transform 0.12s ease;
  }

  .revert-btn:hover {
    background: var(--teal-deep);
    transform: scale(1.08);
  }
</style>
