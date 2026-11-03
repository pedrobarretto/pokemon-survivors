import { describe, expect, it } from 'vitest'
import { BOARD_IDS, boardSpot, judgeSpot, stadiumTalk } from './stadium'

const at = { x: 1000, y: 2000 }

describe('stadiumTalk', () => {
  it('talks to Ninjask from the spot a trip leaves the partner on', () => {
    expect(stadiumTalk(at, judgeSpot(at))?.who).toBe('judge')
  })

  it('reads the board the partner stands just below, its bubble over the board', () => {
    for (const id of BOARD_IDS) {
      const b = boardSpot(at, id)
      const spot = stadiumTalk(at, { x: b.x, y: b.y + 9 })
      expect(spot?.who).toBe(id)
      expect(spot!.y).toBeLessThan(b.y - 20)
    }
  })

  it('says nothing out on the open forecourt, below the court', () => {
    expect(stadiumTalk(at, { x: at.x, y: judgeSpot(at).y + 50 })).toBeNull()
  })
})
