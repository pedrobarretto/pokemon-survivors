import { PLAYABLE } from '../data/hatchlings'
import { MEGA } from '../data/megas'
import { AWAKEN_AT } from '../data/legends'
import { PATH_FORMS } from '../data/legendPaths'
import { atMegaBase, heldMega, megaBaseName, megaPhase } from '../game/mega'
import type { Game } from '../game/types'
import { t } from '../i18n'
import { megaIcon } from '../render/megaFx'
import { boundLabel, setGlyphText } from './inputLabels'
import { h, setStyle, setText } from './dom'
import { localPlayer } from '../game/players'

/**
 * Mega Evolution controls, shown once the run holds its Mega Stone: a HUD badge
 * next to the special's (desktop, key E) and a round touch button above the
 * special button (coarse pointers). Locked (greyed, with the level the final
 * stage comes at) until the final stage, a recharge fill, a rainbow pulse when
 * ready and the form's time draining while it lasts.
 */
export const createMegaControls = (onPress: () => void) => {
  const badgeTag = h('span', { class: 'special-tag mega-tag hidden' })
  const keyLabel = h('span', { class: 'special-key' })
  const buttonTag = h('span', { class: 'special-tag mega-tag hidden' })
  const badge = h('div', { class: 'special mega special-badge hidden' }, h('img', { src: megaIcon(), alt: '' }), keyLabel, badgeTag)
  const button = h(
    'button',
    { class: 'special mega mega-button hidden', type: 'button', 'aria-label': t().mega.section },
    h('img', { src: megaIcon(), alt: '' }),
    buttonTag,
  )
  // Claim the touch so the floating joystick (pointerdown anywhere) never sees it.
  button.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    onPress()
  })
  button.addEventListener('contextmenu', (e) => e.preventDefault())

  const update = (g: Game) => {
    // A stone of the branch the run didn't take (Glalitite on a Froslass) leaves the button off.
    const held = heldMega(g)
    const phase = held ? megaPhase(localPlayer(g).mega, atMegaBase(localPlayer(g))) : 'none'
    const line = PLAYABLE[localPlayer(g).starter].line
    const before = line[line.length - 2]
    // A Mega from a path form (Zygarde Complete) waits for the awakening that brings the form.
    const at = held?.from ? AWAKEN_AT[PATH_FORMS[held.from].at - 1] : before && 'evolveAt' in before ? before.evolveAt : undefined
    const tag = phase === 'locked' && at !== undefined ? t().levelShort(at) : phase === 'ready' ? t().mega.button : ''
    const fill = phase === 'active' ? localPlayer(g).mega.active / MEGA.duration : phase === 'charging' ? 1 - localPlayer(g).mega.charge / MEGA.recharge : 1
    for (const el of [badge, button]) {
      el.classList.toggle('hidden', phase === 'none')
      el.classList.toggle('ready', phase === 'ready')
      el.classList.toggle('locked', phase === 'locked')
      el.classList.toggle('active', phase === 'active')
      setStyle(el, '--fill', fill.toFixed(3))
    }
    setGlyphText(keyLabel, boundLabel('mega'))
    for (const el of [badgeTag, buttonTag]) {
      setText(el, tag)
      el.classList.toggle('hidden', tag === '')
    }
    badge.title = phase === 'locked' ? t().mega.locked(megaBaseName(g)) : t().mega.title
  }

  return { badge, button, update }
}
