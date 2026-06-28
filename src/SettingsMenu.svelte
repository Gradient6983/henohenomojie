<script lang="ts">
  import { getLocale, setLocale, t, type Locale } from "./i18n";
  import * as settings from "./settingsStore.svelte";

  let {
    showDisplayEffects = false,
    edgeAvailable = false,
  }: {
    /** 윤곽선/별자리 등 플레이어 전용 표시 효과 그룹을 보일지 여부 */
    showDisplayEffects?: boolean;
    /** 현재 곡에 윤곽선 오버레이가 있는지 여부 (없으면 관련 설정 비활성화) */
    edgeAvailable?: boolean;
  } = $props();

  let open = $state(false);

  const locale = $derived(getLocale());
  const volume = $derived(settings.getVolume());
  const edgeOpacity = $derived(settings.getEdgeOpacity());
  const showEdges = $derived(settings.getShowEdges());
  const constellation = $derived(settings.getConstellation());

  const languages: { id: Locale; label: string }[] = [
    { id: "ko", label: "한국어" },
    { id: "en", label: "English" },
  ];

  function toggleOpen() {
    open = !open;
  }

  // 패널 바깥을 누르면 닫는다. (메뉴 래퍼 전체에 부착)
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
            <button
              class="switch"
              class:on={showEdges}
              disabled={!edgeAvailable}
              role="switch"
              aria-checked={showEdges}
              aria-label={t().settings.edges}
              onclick={() => settings.setShowEdges(!showEdges)}
            >
              <span class="knob"></span>
            </button>
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
            <button
              class="switch"
              class:on={constellation}
              role="switch"
              aria-checked={constellation}
              aria-label={t().settings.constellation}
              onclick={() => settings.setConstellation(!constellation)}
            >
              <span class="knob"></span>
            </button>
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
    color: #9ccaff;
    background: rgba(120, 180, 255, 0.18);
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
    background: rgba(20, 20, 28, 0.97);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 14px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
    color: #fff;
    text-align: left;
  }

  .group {
    padding: 8px 0;
  }

  .group + .group {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .group-title {
    margin: 6px 0 4px;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.5);
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
    color: rgba(255, 255, 255, 0.55);
  }

  .segmented {
    flex: none;
    display: inline-flex;
    padding: 2px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
  }

  .seg {
    padding: 5px 12px;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.82rem;
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease;
  }

  .seg.on {
    background: #fff;
    color: #111;
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
    accent-color: #5b9cff;
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
    color: rgba(255, 255, 255, 0.75);
  }

  .switch {
    flex: none;
    position: relative;
    width: 42px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.2);
    cursor: pointer;
    transition: background 0.18s ease;
  }

  .switch.on {
    background: #5b9cff;
  }

  .switch:disabled {
    cursor: default;
  }

  .knob {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.18s ease;
  }

  .switch.on .knob {
    transform: translateX(18px);
  }
</style>
