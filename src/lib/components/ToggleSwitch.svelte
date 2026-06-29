<script lang="ts">
  let {
    checked = false,
    disabled = false,
    label,
    onToggle,
  }: {
    /** Current on/off state */
    checked?: boolean;
    /** Whether the switch is disabled */
    disabled?: boolean;
    /** Label for screen readers */
    label: string;
    /** Called when toggled (passes the next state) */
    onToggle: (next: boolean) => void;
  } = $props();
</script>

<button
  class="switch"
  class:on={checked}
  {disabled}
  role="switch"
  aria-checked={checked}
  aria-label={label}
  onclick={() => onToggle(!checked)}
>
  <span class="knob"></span>
</button>

<style>
  .switch {
    flex: none;
    position: relative;
    width: 42px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 999px;
    background: rgba(47, 79, 87, 0.22);
    cursor: pointer;
    transition: background 0.18s ease;
  }

  .switch.on {
    background: var(--teal);
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
