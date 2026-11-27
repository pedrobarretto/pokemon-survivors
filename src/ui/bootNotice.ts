import { bootText } from '../i18n/boot'
import { h } from './dom'

/** How long the boot may take before the page says it's still loading and offers a reload: a phone on a slow network. */
export const BOOT_SLOW_MS = 10_000

/**
 * What the page shows instead of the bare dark background while the game can't boot: still loading (`slow`) or given up
 * (`failed`, a language chunk that never landed, the boot throwing), with a Reload button either way.
 */
export const showBootNotice = (root: HTMLElement, kind: 'slow' | 'failed') => {
  clearBootNotice(root)
  const text = bootText()
  root.append(
    h(
      'div',
      { class: `boot-notice ${kind}`, role: 'alert' },
      h('p', {}, text[kind]),
      h('button', { class: 'btn confirm', type: 'button', onclick: () => location.reload() }, text.reload),
    ),
  )
}

export const clearBootNotice = (root: HTMLElement) => root.querySelector('.boot-notice')?.remove()
