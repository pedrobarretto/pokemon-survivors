import { TYPE_COLORS } from '../data/types'
import { gameSpecial, specialReady } from '../game/special'
import { STANCES } from '../game/stance'
import type { Game } from '../game/types'
import { t } from '../i18n'
import { specialIcon, stanceIcon } from '../render/specialFx'
import { h, setStyle, setText } from './dom'

/**
 * Special attack controls: a HUD badge next to the move slots (desktop) and a
 * round touch button in the bottom-right corner (coarse pointers). Both show the
 * move icon, the cooldown fill and a "ready" pulse; CSS picks which one shows.
 * A chain dash's open window pulses faster and shows the jumps left; Aegislash
 * shows its current forme (icon, color and name) instead of the move.
 */
export const createSpecialControls = (onPress: () => void) => {
  const badgeIcon = h('img', { alt: '' })
  const buttonIcon = h('img', { alt: '' })
  const badgeTag = h('span', { class: 'special-tag hidden' })
  const buttonTag = h('span', { class: 'special-tag hidden' })
  const badge = h('div', { class: 'special special-badge' }, badgeIcon, h('span', { class: 'special-key' }, t().spaceKey), badgeTag)
  const button = h('button', { class: 'special special-button', type: 'button', 'aria-label': t().hud.specialAttack }, buttonIcon, buttonTag)

  // Claim the touch so the floating joystick (pointerdown anywhere) never sees it.
  button.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    onPress()
  })
  button.addEventListener('contextmenu', (e) => e.preventDefault())

  let key = ''

  const update = (g: Game) => {
    const r = gameSpecial(g)
    const s = g.player.special
    const look = `${r.tier.name}|${s.stance}`
    if (key !== look) {
      key = look
      const src = s.stance ? stanceIcon(s.stance) : specialIcon(r.id)
      badgeIcon.setAttribute('src', src)
      buttonIcon.setAttribute('src', src)
      badge.title = t().hud.specialTitle(r.tier.name)
      const color = s.stance ? STANCES[s.stance].color : TYPE_COLORS[r.def.type]
      for (const el of [badge, button]) setStyle(el, '--type', color)
    }
    const tag = s.stance ? t().hud.stances[s.stance] : s.window > 0 ? t().hud.jumps(s.jumps) : ''
    for (const el of [badgeTag, buttonTag]) {
      setText(el, tag)
      el.classList.toggle('hidden', tag === '')
    }
    const fill = (s.total > 0 ? 1 - s.cooldown / s.total : 1).toFixed(3)
    const ready = specialReady(s)
    for (const el of [badge, button]) {
      setStyle(el, '--fill', fill)
      el.classList.toggle('ready', ready)
      el.classList.toggle('chain', s.window > 0)
    }
  }

  return { badge, button, update }
}
