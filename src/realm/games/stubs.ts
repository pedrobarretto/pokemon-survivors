import { stubRules } from './stubRules'
import type { GameRun, SoloGame, TableUi } from './frame'

/**
 * Placeholders the contract ships so every game opens before its real one
 * lands: each game's module replaces its use of these (and this file goes
 * once none is left).
 */

export { stubRules }

/** A placeholder table screen for `stubRules`: three buttons. */
export const stubTableUi: TableUi = {
  size: { w: 240, h: 200 },
  start: ({ source }) => ({
    step: (_dt, input) => {
      if (!input.pointer.pressed || input.pointer.y < 140) return
      source.play(1 + Math.min(2, Math.floor(input.pointer.x / 80)))
    },
    draw: (g) => {
      const v = source.table()
      const s = v ? stubRules.parseView(v.view) : null
      g.fillStyle = '#203040'
      g.fillRect(0, 0, 240, 200)
      g.fillStyle = '#fff'
      g.font = '8px monospace'
      g.fillText(s ? `left ${s.left} · turn ${s.turn} · you ${source.seat()}` : '…', 8, 20)
      for (let i = 0; i < 3; i++) {
        g.fillStyle = '#4080c0'
        g.fillRect(i * 80 + 4, 144, 72, 48)
        g.fillStyle = '#fff'
        g.fillText(String(i + 1), i * 80 + 36, 172)
      }
    },
  }),
}

/** A placeholder solo game: tap the dot as often as you can in 30 s. */
export const stubSolo: SoloGame = {
  size: { w: 240, h: 200 },
  start: () => {
    let time = 0
    let score = 0
    let dot = { x: 120, y: 100 }
    const run: GameRun = {
      step: (dt, input) => {
        time += dt
        const p = input.pointer
        if (p.pressed && Math.abs(p.x - dot.x) < 12 && Math.abs(p.y - dot.y) < 12) {
          score += 10
          dot = { x: 20 + ((dot.x * 7 + 53) % 200), y: 20 + ((dot.y * 5 + 31) % 160) }
        }
      },
      draw: (g) => {
        g.fillStyle = '#183018'
        g.fillRect(0, 0, 240, 200)
        g.fillStyle = '#f8d030'
        g.fillRect(dot.x - 6, dot.y - 6, 12, 12)
        g.fillStyle = '#fff'
        g.font = '8px monospace'
        g.fillText(`${score} · ${Math.max(0, 30 - Math.floor(time))}s`, 8, 12)
      },
      over: () => (time >= 30 ? { score, feats: [] } : null),
    }
    return run
  },
}
