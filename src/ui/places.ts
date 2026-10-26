import { playCry, playSfx } from '../engine/audio'
import { ENEMIES } from '../data/enemies'
import { CAVE, GRAVEYARD, HIDDEN, isHiddenPlace, WINGS, type PlaceId } from '../data/places'
import { wingAmount, type PlaceNotice } from '../game/place'
import { formatPokeDollars, t } from '../i18n'
import { pokeballIcon } from '../render/art'
import { placeIcon } from '../render/places'
import { cryUrl, portraitUrl } from '../render/sprites'
import { h, rich } from './dom'
import { flashScreen } from './screens'
import { banner, runToast } from './toasts'

const SPIRITOMB_DEX = ENEMIES[GRAVEYARD.boss].dex

/** Sounds, toasts and banners for whatever just happened at a place (the dungeon's floor card is the HUD's, `ui/placeCard.ts`). */
export const placeFeedback = (root: HTMLElement, place: PlaceId, notice: PlaceNotice) => {
  const m = t().places
  switch (notice.kind) {
    case 'open':
      playSfx('shiny')
      return runToast(root, 'important', h('span', { class: 'item-toast' }, h('img', { src: placeIcon(place), alt: '' }), rich(m.open[place])), 3400, 'place')
    case 'sealed':
      return runToast(root, 'minor', m.sealed[place], 2200, 'place')
    case 'blocked':
      playSfx('denied')
      return runToast(root, 'important', rich(m.blocked), 2600, 'place')
    case 'found':
      playSfx('shiny')
      return runToast(root, 'important', h('span', { class: 'item-toast' }, h('img', { src: placeIcon(place), alt: '' }), rich(m.open[place])), 3400, 'place')
    case 'enter': {
      playSfx(place === 'sky' ? 'evolve' : 'item')
      if (place === 'sky') flashScreen(root)
      const show = () => banner(root, h('span', { class: 'biome-banner' }, h('small', {}, rich(m.goal[place])), h('b', {}, m.names[place])), 3200)
      // The dungeon's (and a hidden zone's) title card already names it: its goal waits for the card to go.
      const card = place === 'cave' ? CAVE.card : isHiddenPlace(place) ? HIDDEN.card : 0
      return card > 0 ? void setTimeout(show, card * 1000) : show()
    }
    case 'rustle':
      return playSfx('tick', 50)
    case 'lucky':
      return playCry(cryUrl(ENEMIES[notice.enemy].dex), 0.45)
    case 'dweller': {
      playSfx('legendary')
      playCry(cryUrl(ENEMIES[notice.enemy].dex), 0.8)
      flashScreen(root)
      const name = ENEMIES[notice.enemy].name
      const line = notice.shiny ? m.dwellerShiny(name) : isHiddenPlace(place) ? m.dweller[place](name) : ''
      return banner(root, h('span', { class: 'item-toast' }, h('img', { src: portraitUrl(ENEMIES[notice.enemy].dex, notice.shiny), alt: '' }), rich(line)), 3600)
    }
    case 'dwellerFled':
      playSfx('denied')
      return runToast(root, 'minor', m.dwellerFled(ENEMIES[notice.enemy].name), 2600, 'place')
    case 'dwellerDown':
      playSfx('evolve')
      return runToast(root, 'minor', h('span', { class: 'item-toast' }, h('img', { src: portraitUrl(ENEMIES[notice.enemy].dex, notice.shiny), alt: '' }), rich(m.dwellerDown(ENEMIES[notice.enemy].name))), 3500)
    case 'digTick':
      return playSfx('tick', 70)
    case 'dug':
      playSfx(notice.find === 'fossil' || notice.find === 'stone' ? 'unlock' : 'item')
      return runToast(root, 'minor', h('span', { class: 'item-toast' }, h('img', { src: placeIcon('underground'), alt: '' }), rich(m.finds[notice.find])), 2600, 'dig')
    case 'floor':
      return playSfx('select')
    case 'wind':
      playSfx(notice.level >= 3 ? 'quake' : 'tick')
      return runToast(root, 'important', m.wind[notice.level - 1] ?? '', 2800, 'wind')
    case 'monsterHouse':
      playSfx('ambush')
      return runToast(root, 'important', rich(m.monsterHouse), 2800)
    case 'chestTick':
      return playSfx('tick', 60)
    case 'treasure':
      playSfx('unlock')
      return runToast(root, 'minor', h('span', { class: 'item-toast' }, h('img', { src: pokeballIcon(), alt: '' }), rich(m.treasure(formatPokeDollars(notice.coins)))), 3200)
    case 'spirit':
      return playSfx('sip', 90)
    case 'keystone':
      playSfx('legendary')
      playCry(cryUrl(SPIRITOMB_DEX), 0.7)
      flashScreen(root)
      return banner(root, rich(notice.shiny ? m.keystoneShiny : m.keystone))
    case 'spiritomb':
      playSfx('evolve')
      return runToast(root, 'minor', h('span', { class: 'item-toast' }, h('img', { src: portraitUrl(SPIRITOMB_DEX, notice.shiny), alt: '' }), rich(m.spiritomb)), 3500)
    case 'warn':
      return runToast(root, 'important', place === 'graveyard' ? m.dawnSoon : place === 'grotto' ? m.grottoSoon : place === 'underground' ? m.wallSoon : m.calmSoon, 2600, 'place')
    case 'wing':
      playSfx('item')
      return runToast(root, 'minor', h('span', { class: 'item-toast' }, h('b', {}, WINGS[notice.wing].name), m.wings[notice.wing](wingAmount(notice.wing))), 2200, notice.wing)
    case 'flock':
      return
    case 'landed':
      return runToast(root, 'minor', h('span', { class: 'item-toast' }, h('img', { src: placeIcon('sky'), alt: '' }), m.landed(notice.wings)), 3000, 'place')
    case 'fall':
      playSfx('riftFall')
      return runToast(root, 'important', rich(m.fall), 2600, 'place')
    case 'exit':
      if (notice.outcome === 'fallen') {
        flashScreen(root)
        return runToast(root, 'important', rich(m.rescued), 3200, 'place')
      }
      if (place === 'grotto' && notice.outcome === 'done') return runToast(root, 'minor', m.grottoOut, 3000, 'place')
      if (notice.outcome !== 'timeout') return
      if (place === 'underground') {
        playSfx('quake')
        return runToast(root, 'important', m.collapse, 3000, 'place')
      }
      if (place === 'cave') {
        playSfx('quake')
        return runToast(root, 'important', m.blownOut, 3000, 'place')
      }
      if (place === 'graveyard') return runToast(root, 'important', m.dawn, 3000, 'place')
      return
  }
}
