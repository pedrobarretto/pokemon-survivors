import { formatTime } from '../engine/math'
import { areaAt, AREAS, areaStart, BIOMES, FORK, WEATHER_IDS, type BiomeId, type WeatherId } from '../data/biomes'
import { localPlayer } from '../game/players'
import type { Game } from '../game/types'
import { t } from '../i18n'
import { biomeIcon, ROUTE_COLORS, routeArrowIcon } from '../render/routes'
import { weatherIcon } from '../render/weather'
import { h, setStyle, setText } from './dom'
import { typeBadge } from './screens'

/** A biome's likeliest weathers, most likely first, clear skies left out (their icons in the fork card). */
const likelyWeather = (id: BiomeId) => {
  const odds: Partial<Record<WeatherId, number>> = BIOMES[id].weather
  return WEATHER_IDS.filter((w): w is Exclude<WeatherId, 'clear'> => w !== 'clear' && (odds[w] ?? 0) > 0)
    .sort((a, b) => odds[b]! - odds[a]!)
    .slice(0, 2)
}

/** One option of the fork card: an arrow toward its gate, the biome's emblem and name, the types that live there and its likely weather. */
const optionRow = (id: BiomeId) => {
  const dir = h('img', { class: 'route-dir', src: routeArrowIcon(id), alt: '' })
  const row = h(
    'div',
    { class: 'route-option', style: `--route:${ROUTE_COLORS[id]}` },
    dir,
    h('img', { class: 'route-emblem', src: biomeIcon(id), alt: '' }),
    h('b', {}, t().world.biomes[id]),
    h('span', { class: 'types' }, ...BIOMES[id].affinity.map(typeBadge)),
    ...likelyWeather(id).map((w) => h('img', { class: 'route-weather', src: weatherIcon(w), alt: t().world.weather[w], title: t().world.weather[w] })),
  )
  return { row, dir }
}

/**
 * The route on the HUD (`game/route.ts`): while a fork stands on the map, a
 * card under the timer with its two biomes (arrows pointing at their gates,
 * the types that live there, their likely weather) and the time left to
 * pick; once taken, where the run is headed; and under the clock, the strip
 * of the route so far (each area's emblem, `?` for the ones still ahead).
 * Labels are read at creation, like the rest of the HUD.
 */
export const createRouteHud = () => {
  const card = h('div', { class: 'route-card box hidden' })
  const strip = h('div', { class: 'route-strip', 'aria-label': t().world.route.path })
  let cardKey = ''
  let stripKey = ''
  let dirs: HTMLElement[] = []
  let clock: HTMLElement | null = null
  const angles: number[] = []

  const renderCard = (g: Game) => {
    const fork = g.route.fork
    dirs = []
    clock = null
    if (!fork) return card.replaceChildren()
    const m = t().world.route
    if (fork.chosen >= 0) {
      const id = fork.gates[fork.chosen]!.biome
      return card.replaceChildren(h('div', { class: 'route-head' }, h('img', { class: 'route-emblem', src: biomeIcon(id), alt: '' }), m.chosen(t().world.biomes[id])))
    }
    clock = h('span', { class: 'route-clock' })
    const rows = fork.gates.map((gate) => optionRow(gate.biome))
    dirs = rows.map((r) => r.dir)
    angles.length = 0
    card.replaceChildren(h('div', { class: 'route-head' }, h('b', {}, m.fork), clock), ...rows.map((r) => r.row), h('small', { class: 'route-hint' }, m.pick))
  }

  const renderStrip = (g: Game, here: number) => {
    const path = g.route.path
    // The five areas around the run: the whole regular route, then the endless mode's latest legs.
    const from = Math.max(0, here - (AREAS - 1))
    strip.replaceChildren(
      ...Array.from({ length: AREAS }, (_, i) => {
        const area = from + i
        const id = path[area]
        if (!id) return h('span', { class: 'route-dot unknown' }, '?')
        const cls = area === here ? ' here' : area > here ? ' ahead' : ''
        return h('img', { class: `route-dot${cls}`, src: biomeIcon(id), alt: t().world.biomes[id], title: t().world.biomes[id] })
      }),
    )
  }

  /** `stack`: how many pills already sit under the timer (the rift's, the field mission's). */
  const update = (g: Game, stack: number) => {
    const fork = g.route.fork
    const key = fork ? `${fork.area}:${fork.chosen}` : ''
    if (key !== cardKey) {
      cardKey = key
      renderCard(g)
    }
    card.classList.toggle('hidden', !fork)
    setStyle(card, '--stack', String(stack))
    if (fork && fork.chosen < 0) {
      if (clock) setText(clock, formatTime(Math.max(0, Math.ceil(areaStart(fork.area) - FORK.close - g.time))))
      const p = localPlayer(g)
      fork.gates.forEach((gate, i) => {
        const a = Math.round((Math.atan2(gate.y - p.y, gate.x - p.x) * 180) / Math.PI / 45) * 45
        if (angles[i] === a) return
        angles[i] = a
        const dir = dirs[i]
        if (dir) setStyle(dir, 'transform', `rotate(${a}deg)`)
      })
    }
    const here = areaAt(g.time, g.endless !== null)
    const skey = `${g.route.path.join()}|${here}`
    if (skey !== stripKey) {
      stripKey = skey
      renderStrip(g, here)
    }
  }

  return { card, strip, update }
}
