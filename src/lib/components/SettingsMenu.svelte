<script lang="ts">
  import { getLocale, setLocale, t, type Locale } from "../../i18n";
  import * as settings from "../../stores/settingsStore.svelte";
  import ToggleSwitch from "./ToggleSwitch.svelte";

  let {
    showDisplayEffects = false,
    edgeAvailable = false,
  }: {
    /** Whether to show the player-only display-effects group (outline/constellation, etc.) */
    showDisplayEffects?: boolean;
    /** Whether the current song has an outline overlay (related settings are disabled if not) */
    edgeAvailable?: boolean;
  } = $props();

  let open = $state(false);

  const locale = $derived(getLocale());
  const volume = $derived(settings.getVolume());
  const edgeOpacity = $derived(settings.getEdgeOpacity());
  const showEdges = $derived(settings.getShowEdges());
  const constellation = $derived(settings.getConstellation());

  const languages: { id: Locale; label: string }[] = [
    { id: "ja", label: "日本語" },
    { id: "ko", label: "한국어" },
    { id: "en", label: "English" },
  ];

  function toggleOpen() {
    open = !open;
  }

  // Close the panel when clicking outside it. (Attached to the whole menu wrapper.)
  function dismissOnOutside(node: HTMLElement) {
    const handler = (event: PointerEvent) => {
      if (open && !node.contains(event.target as Node)) open = false;
    };
    window.addEventListener("pointerdown", handler);
    return () => window.removeEventListener("pointerdown", handler);
  }
</script>

<div class="settings-menu" {@attach dismissOnOutside}>
  <button
    class="gear"
    class:active={open}
    onclick={toggleOpen}
    title={t().settings.open}
    aria-label={t().settings.open}
    aria-expanded={open}
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
      />
    </svg>
  </button>

  {#if open}
    <div class="panel">
      <section class="group">
        <h2 class="group-title">{t().settings.generalGroup}</h2>
        <div class="row">
          <div class="info">
            <span class="label">{t().settings.language}</span>
          </div>
          <div class="segmented" role="group" aria-label={t().settings.language}>
            {#each languages as lang (lang.id)}
              <button
                class="seg"
                class:on={locale === lang.id}
                aria-pressed={locale === lang.id}
                onclick={() => setLocale(lang.id)}
              >
                {lang.label}
              </button>
            {/each}
          </div>
        </div>
      </section>

      <section class="group">
        <h2 class="group-title">{t().settings.soundGroup}</h2>
        <div class="row col">
          <div class="info">
            <span class="label">{t().settings.volume}</span>
            <span class="desc">{t().settings.volumeDesc}</span>
          </div>
          <div class="slider-row">
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={volume}
              aria-label={t().settings.volume}
              oninput={(event) =>
                settings.setVolume(Number(event.currentTarget.value))}
            />
            <span class="value">{volume}</span>
          </div>
        </div>
      </section>

      {#if showDisplayEffects}
        <section class="group">
          <h2 class="group-title">{t().settings.displayGroup}</h2>

          <div class="row" class:disabled={!edgeAvailable}>
            <div class="info">
              <span class="label">{t().settings.edges}</span>
              <span class="desc">{t().settings.edgesDesc}</span>
            </div>
            <ToggleSwitch
              checked={showEdges}
              disabled={!edgeAvailable}
              label={t().settings.edges}
              onToggle={(next) => settings.setShowEdges(next)}
            />
          </div>

          <div class="row col" class:disabled={!edgeAvailable || !showEdges}>
            <div class="info">
              <span class="label">{t().settings.edgeOpacity}</span>
              <span class="desc">{t().settings.edgeOpacityDesc}</span>
            </div>
            <div class="slider-row">
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={Math.round(edgeOpacity * 100)}
                disabled={!edgeAvailable || !showEdges}
                aria-label={t().settings.edgeOpacity}
                oninput={(event) =>
                  settings.setEdgeOpacity(
                    Number(event.currentTarget.value) / 100,
                  )}
              />
              <span class="value">{Math.round(edgeOpacity * 100)}%</span>
            </div>
          </div>

          <div class="row">
            <div class="info">
              <span class="label">{t().settings.constellation}</span>
              <span class="desc">{t().settings.constellationDesc}</span>
            </div>
            <ToggleSwitch
              checked={constellation}
              label={t().settings.constellation}
              onToggle={(next) => settings.setConstellation(next)}
            />
          </div>
        </section>
      {/if}
    </div>
  {/if}
</div>

<style>
  .settings-menu {
    position: relative;
    display: inline-flex;
  }

  .gear {
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

  .gear svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .gear:hover {
    background: rgba(255, 255, 255, 0.14);
  }

  .gear:active {
    transform: scale(0.92);
  }

  .gear.active {
    color: #fff;
    background: rgba(255, 255, 255, 0.22);
  }

  .panel {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    z-index: 50;
    width: min(360px, calc(100vw - 24px));
    max-height: min(70vh, 560px);
    overflow-y: auto;
    padding: 6px 16px 10px;
    background: #fff;
    border: 1px solid rgba(47, 79, 87, 0.25);
    border-radius: 4px;
    color: var(--ink);
    text-align: left;
  }

  .group {
    padding: 8px 0;
  }

  .group + .group {
    border-top: 1px solid rgba(47, 79, 87, 0.1);
  }

  .group-title {
    margin: 6px 0 4px;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(91, 122, 130, 0.75);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 8px 0;
  }

  .row.col {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .row.disabled {
    opacity: 0.45;
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .label {
    font-size: 0.92rem;
    font-weight: 600;
  }

  .desc {
    font-size: 0.78rem;
    line-height: 1.4;
    color: var(--ink-soft);
  }

  .segmented {
    flex: none;
    display: inline-flex;
    padding: 2px;
    border-radius: 4px;
    background: rgba(43, 183, 172, 0.12);
  }

  .seg {
    padding: 5px 12px;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: var(--ink-soft);
    font-size: 0.82rem;
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease;
  }

  .seg.on {
    background: var(--teal);
    color: #fff;
    font-weight: 600;
  }

  .slider-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .slider-row input[type="range"] {
    flex: 1;
    min-width: 0;
    height: 4px;
    cursor: pointer;
    accent-color: var(--teal);
  }

  .slider-row input[type="range"]:disabled {
    cursor: default;
  }

  .value {
    flex: none;
    width: 3ch;
    text-align: right;
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
    color: var(--ink-soft);
  }
</style>
