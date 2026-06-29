<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    title,
    body,
    closeLabel,
    onClose,
    icon,
  }: {
    /** Modal title */
    title: string;
    /** Modal body */
    body: string;
    /** Close button label */
    closeLabel: string;
    /** Called when a close is requested */
    onClose: () => void;
    /** Icon to display above the title (optional) */
    icon?: Snippet;
  } = $props();
</script>

<div
  class="modal-backdrop"
  role="presentation"
  onclick={(e) => {
    if (e.target === e.currentTarget) onClose();
  }}
>
  <div
    class="modal"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    tabindex="-1"
  >
    {#if icon}
      <span class="modal-icon" aria-hidden="true">{@render icon()}</span>
    {/if}
    <h2 id="modal-title">{title}</h2>
    <p>{body}</p>
    <button type="button" class="modal-close" onclick={onClose}>
      {closeLabel}
    </button>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(47, 79, 87, 0.4);
  }

  .modal {
    width: min(440px, 100%);
    padding: 30px 28px 24px;
    text-align: center;
    background: #fff;
    border: 1px solid rgba(47, 79, 87, 0.25);
    border-radius: 4px;
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
    border-radius: 4px;
    background: linear-gradient(135deg, var(--teal), var(--teal-deep));
    color: #fff;
    font-size: 0.98rem;
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.12s ease;
  }

  .modal-close:hover {
    transform: translateY(-2px);
  }
</style>
