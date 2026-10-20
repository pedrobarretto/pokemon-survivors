import { describe, expect, it } from 'vitest'
import type { ChangelogUpdate } from '../../src/site/changelog'
import { CREATOR_IDS, creatorUrl } from '../../src/data/creators'
import { greetMessage, hasWords, introDecision, liveMessage, patchMessage, patchPlan, podiumMessage } from './discordMessages'

const update = (date: string): ChangelogUpdate => {
  const text = { pt: date, en: date, es: date }
  return { date, title: text, highlights: [text], changes: [] }
}

describe('the introduction gate', () => {
  it('reads words, not mentions, emojis or links', () => {
    expect(hasWords('Olá 🙂')).toBe(true)
    expect(hasWords('<@123456789> <:pikachu:987654321> https://example.com/abc 🙂')).toBe(false)
  })

  it('welcomes anything written, however short, and nudges a lone emoji or link', () => {
    expect(introDecision({ bot: false, trainer: false, content: 'charizard is op :<' })).toBe('welcome')
    expect(introDecision({ bot: false, trainer: false, content: 'hi' })).toBe('welcome')
    expect(introDecision({ bot: false, trainer: false, content: '👋 https://example.com' })).toBe('empty')
  })

  it('pings only the newcomer it greets', () => {
    const m = greetMessage('42')
    expect(m.content).toContain('<@42>')
    expect(m.allowed_mentions).toEqual({ parse: [], users: ['42'] })
  })

  it('leaves bots and Trainers alone', () => {
    const intro = 'Hey! I’m Misty from Cerulean, I love Starmie'
    expect(introDecision({ bot: true, trainer: false, content: intro })).toBe('ignore')
    expect(introDecision({ bot: false, trainer: true, content: 'hi' })).toBe('ignore')
  })
})

describe('patch notes', () => {
  const log = [update('2026-10-19'), update('2026-10-17'), update('2026-10-15')]

  it('posts only the newest update the first time', () => {
    const plan = patchPlan(log, new Set())
    expect(plan.post.map((u) => u.date)).toEqual(['2026-10-19'])
    expect(plan.skip.map((u) => u.date)).toEqual(['2026-10-17', '2026-10-15'])
    expect(plan.refresh).toBeNull()
  })

  it('posts what came after the last posted update, oldest first, and refreshes that one', () => {
    const plan = patchPlan([update('2026-10-21'), update('2026-10-20'), ...log], new Set(['2026-10-15', '2026-10-17', '2026-10-19']))
    expect(plan.post.map((u) => u.date)).toEqual(['2026-10-20', '2026-10-21'])
    expect(plan.skip).toEqual([])
    expect(plan.refresh?.date).toBe('2026-10-19')
  })

  it('pings the role only when there is one', () => {
    expect(patchMessage(log[0]!, '42').allowed_mentions.roles).toEqual(['42'])
    expect(patchMessage(log[0]!, null).content).not.toContain('<@&')
  })
})

describe('the podium', () => {
  it('lists the places with their times, and nothing for a day nobody played', () => {
    const msg = podiumMessage('2026-10-18', [
      { rank: 1, handle: 'ash', name: 'Ash', survived: 754 },
      { rank: 2, handle: 'misty', name: '*Misty*', survived: 600.5 },
    ], 12, null)
    const text = msg?.embeds?.[0]?.description ?? ''
    expect(text).toContain('🥇 **Ash** (@ash) · 12:34')
    expect(text).toContain('🥈 **\\*Misty\\*** (@misty) · 10:00')
    expect(text).toContain('12 trainers took part')
    expect(podiumMessage('2026-10-18', [], 0, null)).toBeNull()
  })
})

describe('a creator going live', () => {
  it('links their live page without pinging anyone', () => {
    const id = CREATOR_IDS[0]!
    const m = liveMessage(id)
    expect(m.embeds?.[0]?.url).toBe(creatorUrl(id, true))
    expect(m.allowed_mentions).toEqual({ parse: [] })
  })
})
