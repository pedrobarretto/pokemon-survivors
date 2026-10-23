import type { Palette } from '../engine/pixelart'
import { ABILITIES, type AbilityEffect, type AbilityId } from '../data/abilities'
import { TYPE_COLORS } from '../data/types'
import { STATUS_RULES } from '../game/status'
import { art, berryIcon, candyIcon, coinIcon, heartIcon, toIconUrl } from './art'
import { weatherIcon } from './weather'

/**
 * Ability icons: one small glyph per kind of effect (a flame for the pinch
 * abilities, a spark for contact, a shield for what wards hits off…), tinted
 * by what it's about (the move type, the status, the stat). Weather, healing
 * and drops reuse the icons the game already has for them.
 */

/** 1 outline, 2 body, 3 light, 4 shine. */
const GLYPHS = {
  flame: ['....1....', '...121...', '...1221..', '..12221..', '.122321..', '.1223321.', '12233321.', '123343321', '123444321', '.1233321.', '..11111..'],
  spark: ['....111.', '...1221.', '..1231..', '.1231...', '11232211', '.1123321', '...1231.', '..1231..', '.1221...', '.121....', '.11.....'],
  shield: ['.11111111.', '1222222221', '1233222221', '1232222221', '1222222221', '1222222221', '.12222221.', '.12222221.', '..122221..', '...1221...', '....11....'],
  eye: ['...11111...', '..1222221..', '.122333221.', '12234443221', '.122333221.', '..1222221..', '...11111...'],
  arrow: ['....1....', '...121...', '..12321..', '.1223221.', '111232111', '..12321..', '..12221..', '..12221..', '..12221..', '..11111..'],
  fist: ['..1111..', '.122221.', '12333311', '12333331', '12333321', '.1222221', '..11111.'],
  fang: ['.11111111.', '1222222221', '1233333321', '.13.13.131', '..1..1..1.'],
  blade: ['.........11', '........131', '.......1341', '......1341.', '.....1341..', '.1..1341...', '.112341....', '..1221.....', '.112111....', '11211......', '111........'],
  note: ['.....11..', '.....121.', '.....1221', '.....1.21', '.....1..1', '.....1...', '..1111...', '.123321..', '.122221..', '..1111...'],
  star: ['....1....', '...121...', '111232111', '.1233321.', '..12321..', '..12121..', '.121.121.', '.11...11.'],
  moon: ['...1111..', '..12221..', '.1231....', '1231.....', '1231.....', '1232.....', '12331....', '.123321..', '..12221..', '...1111..'],
} as const satisfies Record<string, readonly string[]>

type Glyph = keyof typeof GLYPHS

const hexToRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

/** `hex` mixed `k` of the way toward `to` (black or white). */
const mix = (hex: string, to: number, k: number) => `#${hexToRgb(hex).map((c) => Math.round(c + (to - c) * k).toString(16).padStart(2, '0')).join('')}`

const tint = (color: string): Palette => ({ 1: mix(color, 0, 0.6), 2: color, 3: mix(color, 255, 0.45), 4: '#ffffff' })

const COLORS = {
  offense: '#e85838',
  defense: '#8890b0',
  speed: '#48a8f0',
  status: '#a868d8',
  heal: '#58c060',
  guard: '#9878e8',
  gold: '#e8b830',
  presence: '#d84858',
  reach: '#f0a030',
} as const

/** Glyph and color of a stat block: what it mostly does. */
const statsLook = (s: Extract<AbilityEffect, { kind: 'stats' }>): readonly [Glyph, string] => {
  const d = s.stats
  if (d.typeDamage) return ['star', TYPE_COLORS[(Object.keys(d.typeDamage)[0] ?? 'normal') as keyof typeof TYPE_COLORS]]
  if (d.might) return ['arrow', COLORS.offense]
  if (d.armor || d.damageTaken) return ['shield', COLORS.defense]
  if (d.regen) return ['arrow', COLORS.heal]
  if (d.statusChance) return ['spark', COLORS.status]
  if (d.speed) return ['arrow', COLORS.speed]
  if (d.specialRecharge) return ['star', COLORS.gold]
  return ['star', COLORS.reach]
}

const TAG_GLYPHS = { punch: 'fist', bite: 'fang', slice: 'blade', sound: 'note', weak: 'star', status: 'spark' } as const satisfies Record<string, Glyph>

/** What an ability's first effect looks like: an icon the game has, or a tinted glyph. */
const look = (e: AbilityEffect | undefined): string | readonly [Glyph, string] => {
  if (!e) return ['shield', TYPE_COLORS.steel]
  switch (e.kind) {
    case 'pinch':
      return ['flame', TYPE_COLORS[e.type]]
    case 'weather':
    case 'summon':
      return e.weather === 'clear' ? ['star', COLORS.gold] : weatherIcon(e.weather)
    case 'contact':
      return e.status[0] ? ['spark', STATUS_RULES[e.status[0].kind].color] : ['spark', COLORS.defense]
    case 'aura':
    case 'bossHunter':
      return ['eye', COLORS.presence]
    case 'nightmare':
      return ['moon', STATUS_RULES.sleep.color]
    case 'resist':
      return e.types?.[0] ? ['shield', TYPE_COLORS[e.types[0]]] : ['eye', COLORS.presence]
    case 'immune':
      return ['shield', COLORS.guard]
    case 'guard':
      return ['shield', COLORS.guard]
    case 'sturdy':
      return ['shield', COLORS.gold]
    case 'tag':
      return [TAG_GLYPHS[e.tag], e.tag === 'status' ? COLORS.status : COLORS.offense]
    case 'ownType':
    case 'offType':
      return ['star', COLORS.reach]
    case 'onKill':
      return ['arrow', COLORS.offense]
    case 'timer':
    case 'unburden':
      return ['arrow', COLORS.speed]
    case 'onHurt':
      return ['arrow', COLORS.reach]
    case 'moody':
      return ['star', COLORS.status]
    case 'luck':
      return ['star', COLORS.gold]
    case 'lowHp':
    case 'fullHp':
      return e.stats.might ? ['arrow', COLORS.offense] : e.stats.speed ? ['arrow', COLORS.speed] : ['shield', COLORS.defense]
    case 'heal':
      return heartIcon()
    case 'drop':
      return e.drop === 'berry' ? berryIcon() : e.drop === 'xp' ? candyIcon(2) : coinIcon(0)
    case 'stats':
      return statsLook(e)
  }
}

/** An ability's icon as a data URL, cached. */
export const abilityIcon = (id: AbilityId) => {
  const effects: readonly AbilityEffect[] = ABILITIES[id].effects
  const l = look(effects[0])
  if (typeof l === 'string') return l
  const [glyph, color] = l
  return toIconUrl(`ability:${id}`, () => art(GLYPHS[glyph], tint(color), '#181818'))
}
