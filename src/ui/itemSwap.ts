import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { evolutionOf } from '../data/evolutions'
import { ITEMS, type ItemId } from '../data/items'
import { DROP_REST } from '../game/itemDrop'
import { MOVES } from '../game/moves'
import { localPlayer } from '../game/players'
import type { Game } from '../game/types'
import { itemIcon, moveIcon } from '../render/art'
import { t } from '../i18n'
import { h } from './dom'
import { confirmDialog, hint, menu, type Screen } from './screens'

/**
 * Largar item's screens (`game/itemDrop.ts`): the swap picker a full build
 * opens on a new item's card (a level-up's or a Poké Ball's), and the pause
 * menu's confirm. The shell records the drop and the pick that follows.
 */

/** The owned move an item is the paired evolution item of, if any: dropping it closes that evolution. */
const pairedMove = (g: Game, item: ItemId) => localPlayer(g).moves.find((m) => evolutionOf(m.id)?.item === item)?.id

/** An owned item's row: icon, name, level, and the move it would evolve. */
const itemRow = (g: Game, id: ItemId, level: number) => {
  const m = t().itemDrop
  const pair = pairedMove(g, id)
  return [
    h('img', { class: 'swap-icon', src: itemIcon(id), alt: '' }),
    h(
      'span',
      { class: 'swap-body' },
      h('b', {}, ITEMS[id].name, h('span', { class: 'tag' }, level >= ITEMS[id].levels.length ? t().max : t().level(level))),
      pair && h('small', { class: 'swap-pair' }, h('img', { src: moveIcon(pair), alt: '' }), m.pairOf(MOVES[pair].name)),
    ),
  ]
}

/**
 * The swap picker: every slot is taken, so `incoming` asks which held item
 * goes. `onPick` gets the item's index, or null to go back to the cards.
 */
export const itemSwap = (root: HTMLElement, input: Input, g: Game, incoming: ItemId, onPick: (index: number | null) => void): Screen => {
  const m = t().itemDrop
  const items = localPlayer(g).items
  const rows = items.map((o) => h('button', { class: 'swap-row', type: 'button' }, ...itemRow(g, o.id, o.level)))
  const back = h('button', { class: 'btn swap-back', type: 'button' }, m.back)
  let done = false
  const nav = menu(input, [...rows, back], (i) => {
    if (done) return
    done = true
    playSfx(i < rows.length ? 'item' : 'select')
    onPick(i < rows.length ? i : null)
  })
  const offEsc = input.onKey((k) => {
    if ((k === 'Escape' || k === 'Backspace') && !done) {
      done = true
      onPick(null)
    }
  })
  const pair = pairedMove(g, incoming)
  const el = h(
    'div',
    { class: 'screen dim item-swap' },
    h(
      'div',
      { class: 'dialog box pop swap-box' },
      h('div', { class: 'dialog-title' }, m.swapTitle),
      h(
        'div',
        { class: 'swap-incoming' },
        h('img', { class: 'swap-icon', src: itemIcon(incoming), alt: '' }),
        h('span', { class: 'swap-body' }, h('b', {}, ITEMS[incoming].name), pair && h('small', { class: 'swap-pair ready' }, h('img', { src: moveIcon(pair), alt: '' }), m.pairOf(MOVES[pair].name))),
      ),
      h('p', { class: 'swap-prompt' }, m.prompt),
      h('div', { class: 'swap-list' }, ...rows),
      h('p', { class: 'swap-note' }, m.note(DROP_REST)),
      h('div', { class: 'buttons' }, back),
      hint(m.hintKeys, m.hintTouch),
    ),
  )
  root.append(el)
  return { el, dispose: () => (nav.off(), offEsc(), el.remove()) }
}

/** The pause menu's "Largar {item}?": no refund, and when it comes back. */
export const confirmDrop = (root: HTMLElement, input: Input, g: Game, index: number, onAnswer: (yes: boolean) => void): Screen | null => {
  const item = localPlayer(g).items[index]
  if (!item) return null
  const m = t().itemDrop
  const pair = pairedMove(g, item.id)
  const dialog = confirmDialog(root, input, m.confirm(ITEMS[item.id].name), onAnswer, { yes: m.yes, no: m.no, class: 'drop-confirm' })
  const box = dialog.el.querySelector('.dialog-title')
  box?.after(
    h('div', { class: 'swap-incoming' }, ...itemRow(g, item.id, item.level)),
    h('p', { class: 'swap-note' }, pair ? m.confirmPair(MOVES[pair].name, DROP_REST) : m.note(DROP_REST)),
  )
  return dialog
}
