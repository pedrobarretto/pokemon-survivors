import { playerDex } from '../game/game'
import type { Game, Player } from '../game/types'
import { t } from '../i18n'
import { slotColor } from '../render/coop'
import { portraitUrl } from '../render/sprites'
import { h, setStyle, setText } from './dom'

/**
 * Co-op HUD: one compact row per teammate (their Pokémon's portrait in their
 * slot color, name and HP, or that they fainted, stepped away or left), stacked
 * over the status box. `update` runs every frame and only touches what changed.
 */
export const createTeamHud = (root: HTMLElement, names: readonly string[], mine: number) => {
  const rows = new Map<number, { el: HTMLElement; portrait: HTMLImageElement; fill: HTMLElement; state: HTMLElement; key: string }>()
  const el = h('div', { class: 'team-hud' })

  const rowFor = (p: Player) => {
    const known = rows.get(p.slot)
    if (known) return known
    const portrait = h('img', { class: 'team-portrait', alt: '' })
    const fill = h('div', { class: 'team-fill' })
    const state = h('span', { class: 'team-state' })
    const row = h('div', { class: 'team-row box', style: `--slot:${slotColor(p.slot)}` }, portrait, h('div', { class: 'team-body' }, h('b', { class: 'team-name' }, names[p.slot] ?? `P${p.slot + 1}`), h('div', { class: 'team-bar' }, fill)), state)
    const made = { el: row, portrait, fill, state, key: '' }
    rows.set(p.slot, made)
    el.append(row)
    return made
  }

  const update = (g: Game) => {
    for (const p of g.players) {
      if (p.slot === mine) continue
      const row = rowFor(p)
      const dex = playerDex(g, p)
      const key = `${dex}${p.shiny}`
      if (key !== row.key) {
        row.key = key
        row.portrait.src = portraitUrl(dex, p.shiny)
      }
      setStyle(row.fill, 'width', `${((Math.max(0, p.hp) / p.stats.maxHp) * 100).toFixed(1)}%`)
      const m = t().coop
      setText(row.state, p.gone ? '✕' : p.down ? m.down : p.away ? m.away : '')
      row.el.classList.toggle('down', p.down !== null)
      row.el.classList.toggle('gone', p.gone)
    }
  }

  root.append(el)
  return { update, dispose: () => el.remove() }
}

export type TeamHud = ReturnType<typeof createTeamHud>
