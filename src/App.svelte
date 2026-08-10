<script lang="ts">
  import { onMount } from 'svelte'
  import WaterMap from './components/WaterMap.svelte'
  import SpotPanel from './components/SpotPanel.svelte'
  import type { Spot } from './lib/types'
  import { loadSpots } from './lib/loadSpots'
  import { fitsSearch, kindLabel } from './lib/labels'

  let spots = $state<Spot[]>([])
  let loading = $state(true)
  let error = $state<string | null>(null)
  let search = $state('')
  let selectedId = $state<string | null>(null)

  const visible = $derived(
    spots.filter((s) => {
      const hay = `${s.nameUk} ${s.nameEn} ${s.region} ${kindLabel(s.kind)}`
      return fitsSearch(hay, search)
    }),
  )

  onMount(() => {
    const ac = new AbortController()
    loadSpots(ac.signal)
      .then((list) => {
        spots = list
        loading = false
      })
      .catch((e) => {
        if (ac.signal.aborted) return
        error = e instanceof Error ? e.message : 'Помилка завантаження'
        loading = false
      })
    return () => ac.abort()
  })
</script>

<div class="shell">
  <WaterMap spots={visible} {selectedId} onSelect={(id) => (selectedId = id)} />

  <div class="chrome">
    <SpotPanel
      spots={visible}
      {selectedId}
      {search}
      onSearch={(q) => (search = q)}
      onSelect={(id) => (selectedId = id)}
    />
  </div>

  <p class="strip" role="note">
    Воєнний стан: мапа не дає дозволу виходити на воду. Перевірте офіційні джерела.
  </p>

  {#if loading}
    <div class="toast">Завантаження локацій…</div>
  {/if}
  {#if error}
    <div class="toast err">{error}</div>
  {/if}
</div>

<style>
  .shell {
    position: relative;
    width: 100%;
    height: 100dvh;
    overflow: hidden;
    background: #d7e4dc;
  }

  .chrome {
    position: absolute;
    z-index: 4;
    top: max(0.75rem, env(safe-area-inset-top));
    left: max(0.75rem, env(safe-area-inset-left));
  }

  .strip {
    position: absolute;
    z-index: 4;
    left: 50%;
    bottom: max(0.65rem, env(safe-area-inset-bottom));
    transform: translateX(-50%);
    margin: 0;
    max-width: min(92vw, 36rem);
    padding: 0.45rem 0.75rem;
    border-radius: 999px;
    background: rgba(74, 42, 24, 0.88);
    color: #f7efe6;
    font-size: 0.78rem;
    text-align: center;
    line-height: 1.35;
  }

  .toast {
    position: absolute;
    z-index: 6;
    top: max(0.75rem, env(safe-area-inset-top));
    right: max(0.75rem, env(safe-area-inset-right));
    padding: 0.5rem 0.75rem;
    border-radius: 10px;
    background: rgba(11, 110, 79, 0.92);
    color: #fff;
    font-size: 0.85rem;
  }

  .toast.err {
    background: rgba(122, 31, 22, 0.92);
  }

  @media (max-width: 640px) {
    .chrome {
      left: 50%;
      transform: translateX(-50%);
      width: calc(100% - 1.25rem);
    }

    .chrome :global(.panel) {
      width: 100%;
      max-height: 42vh;
    }

    .strip {
      border-radius: 12px;
      left: 0.65rem;
      right: 0.65rem;
      transform: none;
      max-width: none;
    }
  }
</style>
