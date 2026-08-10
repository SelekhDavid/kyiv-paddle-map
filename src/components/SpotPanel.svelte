<script lang="ts">
  import type { Spot } from '../lib/types'
  import { kindLabel, RESTRICTION_COLORS, RESTRICTION_LABELS } from '../lib/labels'

  interface Props {
    spots: Spot[]
    selectedId: string | null
    search: string
    onSearch: (q: string) => void
    onSelect: (id: string) => void
  }

  let { spots, selectedId, search, onSearch, onSelect }: Props = $props()
</script>

<aside class="panel">
  <header class="panel-head">
    <p class="brand">Київщина</p>
    <h1>Мапа водойм</h1>
    <p class="status">SUP і плавання · клік по заливці / річці</p>
  </header>

  <label class="search">
    <span class="sr">Пошук</span>
    <input
      type="search"
      placeholder="Тельбін, Десна, карʼєр…"
      value={search}
      oninput={(e) => onSearch(e.currentTarget.value)}
    />
  </label>

  <p class="meta">У списку: {spots.length}</p>

  <ul class="list">
    {#each spots as s (s.id)}
      <li>
        <button
          type="button"
          class:active={s.id === selectedId}
          onclick={() => onSelect(s.id)}
        >
          <span
            class="dot"
            style:background={RESTRICTION_COLORS[s.restriction?.level ?? 'check_local']}
            aria-hidden="true"
          ></span>
          <span class="body">
            <strong>{s.nameUk}</strong>
            <small
              >{kindLabel(s.kind)} · {RESTRICTION_LABELS[s.restriction?.level ?? 'check_local']}</small
            >
          </span>
        </button>
      </li>
    {:else}
      <li class="empty">Нічого не знайдено</li>
    {/each}
  </ul>
</aside>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    width: min(340px, calc(100vw - 1.5rem));
    max-height: min(72vh, 640px);
    padding: 0.85rem 0.9rem;
    border-radius: 16px;
    background: rgba(255, 252, 247, 0.92);
    border: 1px solid rgba(26, 36, 33, 0.12);
    backdrop-filter: blur(10px);
    box-shadow: 0 16px 40px rgba(26, 36, 33, 0.12);
  }

  .panel-head h1 {
    font-family: Literata, Georgia, serif;
    font-size: 1.35rem;
    margin: 0;
    letter-spacing: -0.02em;
  }

  .brand {
    margin: 0;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #5a6b64;
  }

  .status {
    margin: 0.2rem 0 0;
    font-size: 0.82rem;
    color: #5a6b64;
  }

  .search input {
    width: 100%;
    border: 1px solid rgba(26, 36, 33, 0.14);
    border-radius: 10px;
    padding: 0.5rem 0.7rem;
    background: #fff;
    font: inherit;
  }

  .meta {
    margin: 0;
    font-size: 0.78rem;
    color: #5a6b64;
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow: auto;
    display: grid;
    gap: 0.3rem;
    min-height: 0;
  }

  button {
    width: 100%;
    text-align: left;
    display: flex;
    gap: 0.55rem;
    align-items: flex-start;
    border: 1px solid transparent;
    background: rgba(255, 255, 255, 0.5);
    border-radius: 10px;
    padding: 0.5rem 0.55rem;
    cursor: pointer;
    font: inherit;
    color: inherit;
  }

  button:hover,
  button.active {
    border-color: rgba(11, 110, 79, 0.4);
    background: rgba(11, 110, 79, 0.08);
  }

  .dot {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 50%;
    margin-top: 0.35rem;
    flex-shrink: 0;
  }

  .body {
    display: grid;
    gap: 0.1rem;
  }

  .body small {
    color: #5a6b64;
    font-size: 0.78rem;
  }

  .empty {
    color: #5a6b64;
    font-size: 0.9rem;
    padding: 0.5rem;
  }

  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
</style>
