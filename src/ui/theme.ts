/**
 * The menus' and HUD's colors (Settings → Jogo): light, dark, or whatever the
 * system prefers. `applyTheme` sets `data-theme` on <html> to `light` or `dark`,
 * which style.css reads (the `--dk-*` roles). The world canvas never changes.
 */
export const THEMES = ['system', 'light', 'dark'] as const

export type Theme = (typeof THEMES)[number]

let chosen: Theme = 'system'
let systemDark: MediaQueryList | null = null

const paint = () => {
  document.documentElement.dataset.theme = chosen === 'system' ? (systemDark?.matches ? 'dark' : 'light') : chosen
}

/** Applies a theme now; `system` keeps following the OS as it switches (a phone's sunset schedule). */
export const applyTheme = (theme: Theme) => {
  chosen = theme
  if (!systemDark) {
    systemDark = matchMedia('(prefers-color-scheme: dark)')
    systemDark.addEventListener('change', paint)
  }
  paint()
}
