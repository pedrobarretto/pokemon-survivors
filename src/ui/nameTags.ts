import type { Game } from '../game/types'
import { edgePoint, slotColor } from '../render/coop'
import { h, setStyle, setText } from './dom'

/**
 * Co-op name labels over the canvas: each teammate's name floats over their
 * head in their slot color, or sits by the edge arrow while they're out of
 * view (`edgePoint`). DOM text, crisp at any scale (the pixel font only has
 * digits). `update` runs every frame with the run as this player sees it.
 */
export const createNameTags = (root: HTMLElement, names: readonly string[]) => {
  const layer = h('div', { class: 'name-tags' })
  const tags = names.map((name, slot) => {
    const tag = h('span', { class: 'name-tag', style: `--slot:${slotColor(slot)}` }, name)
    layer.append(tag)
    return tag
  })
  root.prepend(layer)

  /** `scale` is CSS px per world px. */
  const update = (g: Game, scale: number) => {
    for (const p of g.players) {
      const tag = tags[p.slot]
      if (!tag) continue
      const hidden = p === g.player || p.gone
      tag.classList.toggle('hidden', hidden)
      if (hidden) continue
      const sx = p.x - g.camera.x
      const sy = p.y - g.camera.y
      const edge = edgePoint(g.view.w, g.view.h, sx, sy - 12)
      // Off screen: inside the arrow, pulled toward the middle.
      const x = edge ? edge.x - edge.dx * 18 : sx
      const y = edge ? edge.y - edge.dy * 18 : sy - 34
      setStyle(tag, 'transform', `translate(${Math.round(x * scale)}px, ${Math.round(y * scale)}px) translate(-50%, -100%)`)
      tag.classList.toggle('down', p.down !== null)
      setText(tag, names[p.slot] ?? `P${p.slot + 1}`)
    }
  }

  return { update, dispose: () => layer.remove() }
}

export type NameTags = ReturnType<typeof createNameTags>
