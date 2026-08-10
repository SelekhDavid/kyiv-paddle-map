/** Respect Vite `base` (GitHub Pages: /kyiv-paddle-map/) */
export function dataUrl(file: string): string {
  const base = import.meta.env.BASE_URL || '/'
  return `${base}data/${file}`
}

export function absoluteDataUrl(file: string): string {
  if (typeof window === 'undefined') return dataUrl(file)
  const path = dataUrl(file)
  return new URL(path, window.location.origin).href
}
