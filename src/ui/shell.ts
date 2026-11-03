import { formatPokeDollars, t } from '../i18n'
import { coinIcon, gearIcon, helpIcon } from '../render/art'
import { h } from './dom'

/**
 * The skeleton every screen before a run shares (title, starter select,
 * Pokédex, incubator, missions, mart, supporters, settings, Trainer Card):
 *
 *   ┌ topBar: left slot · title · right slot ┐
 *   │ body (scrolls on its own)              │
 *   └ actionBar (optional)                   ┘
 *
 * `shellScreen` lays them out as a full-screen column inside the safe-area
 * insets, so the bars never cover content: the action bar is a flex child,
 * never `position: fixed`. These helpers only build DOM; keys stay with the
 * screen (map Esc/Backspace to the same function as `backButton`).
 */

type Slot = Node | null | undefined | false

/**
 * Full-screen shell: `top` (a `topBar`), `body` (scrolls when it doesn't
 * fit, contents centered) and an optional `bottom` (an `actionBar`). `dim`
 * darkens the meadow behind it. Use the result as the screen's `el`.
 */
export const shellScreen = (opts: { top: HTMLElement; body: Node[]; bottom?: HTMLElement | null; class?: string; dim?: boolean }) =>
  h(
    'div',
    { class: ['screen shell', opts.dim ? 'dim' : '', opts.class ?? ''].join(' ').trim() },
    opts.top,
    shellBody(...opts.body),
    opts.bottom,
  )

/** The shell's middle: grows to fill, scrolls on its own when its content doesn't fit, and centers it when it does. */
export const shellBody = (...children: Slot[]) => h('div', { class: 'shell-body' }, ...children)

/**
 * Top bar: `left` (a `backButton` or the Trainer chip), an optional screen
 * `title` in the pixel font (screens other than the title show it instead of
 * the logo; keep it unaccented or mixed case, see `i18n/pt.ts`), and the
 * `right` slot (wallet, help, gear), right-aligned. Empty slots keep their
 * width balanced so the title stays centered.
 */
export const topBar = (opts: { left?: Slot; title?: string | Node | null; right?: readonly Slot[] }) =>
  h(
    'header',
    { class: 'shell-top' },
    h('div', { class: 'shell-slot left' }, opts.left),
    opts.title ? h('h2', { class: 'shell-title' }, opts.title) : h('span', { class: 'shell-spacer' }),
    h('div', { class: 'shell-slot right' }, ...(opts.right ?? [])),
  )

/** ◀ with an `ESC` key hint (hidden on touch screens). Doesn't listen to keys: the screen maps Esc/Backspace to `onBack` itself. */
export const backButton = (onBack: () => void) =>
  h(
    'button',
    { class: 'shell-btn shell-back box', type: 'button', 'aria-label': t().shell.back, title: t().shell.back, onclick: onBack },
    h('span', { class: 'back-arrow', 'aria-hidden': 'true' }, '◀'),
    h('span', { class: 'key-hint' }, 'ESC'),
  )

/**
 * Square 44 px button with a pixel icon (`gearIcon`, `newsIcon`…) and an optional key hint. `ink` marks a
 * one-color ink icon (the gear, the `?`), which the dark theme draws light.
 */
export const iconButton = (icon: string, label: string, onClick: () => void, key?: string, ink = false) =>
  h(
    'button',
    { class: 'shell-btn shell-icon box', type: 'button', 'aria-label': label, title: label, onclick: onClick },
    h('img', { src: icon, alt: '', class: ink ? 'ink-icon' : undefined }),
    key ? h('span', { class: 'key-hint' }, key) : null,
  )

/** The gear: opens Settings. */
export const gearButton = (onClick: () => void, key?: string) => iconButton(gearIcon(), t().shell.settings, onClick, key, true)

/** The `?`: opens how to play (or a screen's own help). */
export const helpButton = (onClick: () => void) => iconButton(helpIcon(), t().shell.help, onClick, undefined, true)

/**
 * The ₽ chip: the save's wallet. Display only, unless `open` makes it a
 * button (the partner select's way into the Poké Mart), with its `key` hint.
 */
export const walletChip = (wallet: number, open?: { label: string; onClick: () => void; key?: string }) =>
  open
    ? h(
        'button',
        { class: 'shell-chip shell-wallet shell-btn box', type: 'button', 'aria-label': open.label, title: open.label, onclick: open.onClick },
        h('img', { src: coinIcon(2), alt: '' }),
        h('b', {}, formatPokeDollars(wallet)),
        open.key ? h('span', { class: 'key-hint' }, open.key) : null,
      )
    : h(
        'span',
        { class: 'shell-chip shell-wallet box', role: 'img', 'aria-label': t().shell.wallet(formatPokeDollars(wallet)) },
        h('img', { src: coinIcon(2), alt: '' }),
        h('b', {}, formatPokeDollars(wallet)),
      )

/**
 * A tile on the lobby's side rails (phones held upright): `icon` over a short
 * `label`, an optional corner `badge`, and `aria` saying in full what the
 * wide screens' card shows. `kind` names it for its colors (`rail-<kind>`).
 */
export const railTile = (kind: string, icon: Node, label: string, aria: string, badge: Slot = null) =>
  h(
    'button',
    { class: `lobby-rail-tile box rail-${kind}`, type: 'button', 'aria-label': aria, title: aria },
    h('span', { class: 'rail-icon' }, icon),
    h('span', { class: 'rail-label' }, label),
    badge,
  )

/** Bottom action bar: the screen's main buttons, in thumb reach. A flex child of `shellScreen`, so content above it never hides under it. */
export const actionBar = (...children: Slot[]) => h('footer', { class: 'shell-actions' }, ...children)

/**
 * Pill tabs (Settings' Som / Jogo / Controles / Sobre). Labels in the pixel
 * font, so mixed case if accented. `onPick` runs on a tap; `set` moves the
 * highlight (for ← → while the strip has the keyboard focus).
 */
export const tabStrip = (labels: readonly string[], active: number, onPick: (i: number) => void) => {
  const tabs = labels.map((label, i) => h('button', { class: 'shell-tab', type: 'button', role: 'tab', onclick: (e: Event) => (e.stopPropagation(), onPick(i)) }, label))
  const el = h('div', { class: 'shell-tabs', role: 'tablist' }, ...tabs)
  const set = (i: number) => tabs.forEach((tab, j) => (tab.classList.toggle('on', j === i), tab.setAttribute('aria-selected', String(j === i))))
  set(active)
  return { el, set }
}

/**
 * Segmented control: one of a few options (PT / EN / ES). `onPick` runs on a
 * tap; `set` moves the highlight. Each option can carry its own `lang`.
 */
export const segmented = <T extends string>(options: readonly { id: T; label: string; lang?: string; title?: string }[], current: T | null, onPick: (id: T) => void) => {
  const buttons = options.map((o) =>
    h('button', { class: 'shell-seg-option', type: 'button', lang: o.lang, title: o.title, onclick: (e: Event) => (e.stopPropagation(), onPick(o.id)) }, o.label),
  )
  const el = h('div', { class: 'shell-seg', role: 'group' }, ...buttons)
  const set = (id: T | null) => options.forEach((o, i) => (buttons[i]!.classList.toggle('on', o.id === id), buttons[i]!.setAttribute('aria-pressed', String(o.id === id))))
  set(current)
  return { el, set }
}
