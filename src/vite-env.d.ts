/// <reference types="svelte" />
/// <reference types="vite/client" />

declare module '@mapbox/polylabel' {
  export default function polylabel(
    polygon: number[][][],
    precision?: number,
  ): [number, number, number?]
}
