import { TERA } from '../data/tera'
import { teraPhase, teraPlays } from '../game/tera'
import type { Game } from '../game/types'
import { t } from '../i18n'
import { crownIcon, TERA_RAMPS } from '../render/teraArt'
import { boundLabel, setGlyphText } from './inputLabels'
import { h, setStyle, setText } from './dom'
import { localPlayer } from '../game/players'
import { teraName } from './teraText'

/**
 * Terastal's controls, shown once the run has a Tera type (`game/tera.ts`): a
 * HUD badge beside the special's and the Mega's (desktop, key R) and a round
 * touch button up and left of the special (coarse pointers), both wearing the
 * type's crown. The Tera Orb fills round the rim; full, the rim flashes in the
 * type's crystal and says TERA; while Terastallized the time left drains.
 */
export const createTeraControls = (onPress: () => void) => {
  const badgeTag = h('span', { class: 'special-tag tera-tag hidden' })
  const keyLabel = h('span', { class: 'special-key' })
  const buttonTag = h('span', { class: 'special-tag tera-tag hidden' })
  const badgeImg = h('img', { alt: '' })
  const buttonImg = h('img', { alt: '' })
  const badge = h('div', { class: 'special tera special-badge hidden' }, badgeImg, keyLabel, badgeTag)
  const button = h('button', { class: 'special tera tera-button hidden', type: 'button', 'aria-label': t().tera.section }, buttonImg, buttonTag)
  // Claim the touch so the floating joystick (pointerdown anywhere) never sees it.
  button.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    onPress()
  })
  button.addEventListener('contextmenu', (e) => e.preventDefault())

  let shown = ''
  const update = (g: Game) => {
    const p = localPlayer(g)
    const s = p.tera
    const phase = teraPlays(g) ? teraPhase(s) : 'none'
    const type = (phase === 'active' ? s.form : s.type) ?? 'normal'
    if (shown !== type) {
      shown = type
      const url = crownIcon(type)
      badgeImg.setAttribute('src', url)
      buttonImg.setAttribute('src', url)
      const r = TERA_RAMPS[type]
      for (const el of [badge, button]) {
        setStyle(el, '--type', r[2])
        setStyle(el, '--tera-light', r[4])
        setStyle(el, '--tera-dark', r[1])
      }
    }
    const tag = phase === 'ready' ? t().tera.button : ''
    const fill = phase === 'active' ? s.active / TERA.duration : phase === 'charging' ? s.orb : 1
    for (const el of [badge, button]) {
      el.classList.toggle('hidden', phase === 'none')
      el.classList.toggle('ready', phase === 'ready')
      el.classList.toggle('active', phase === 'active')
      setStyle(el, '--fill', fill.toFixed(3))
    }
    setGlyphText(keyLabel, boundLabel('tera'))
    for (const el of [badgeTag, buttonTag]) {
      setText(el, tag)
      el.classList.toggle('hidden', tag === '')
    }
    badge.title = phase === 'ready' ? t().tera.ready(teraName(type)) : t().tera.title(teraName(type))
  }

  return { badge, button, update }
}
