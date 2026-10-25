import { playCry, playSfx } from '../engine/audio'
import { BUFFS } from '../data/consumables'
import type { MapEventNotice } from '../game/mapEvents'
import { MEOWTH_DEX } from '../game/mapEventRules'
import { formatPokeDollars, t } from '../i18n'
import { coinIcon, pokeballIcon } from '../render/art'
import { fountainIcon } from '../render/mapEvents'
import { eggIcon, heartIcon } from '../render/fieldMissions'
import { TOGEPI_DEX, type FieldMissionKind } from '../game/fieldMissionRules'
import { consumableIcon } from '../render/props'
import { cryUrl, portraitUrl } from '../render/sprites'
import { h, rich } from './dom'
import { runToast } from './toasts'
import { tmDiscIcon } from './tmPick'

/** Toast with a small icon on the left, like the item pickups; `important` when it warns or asks for something (`runToast`). */
const iconToast = (root: HTMLElement, icon: string, text: string, ms = 2600, importance: 'important' | 'minor' = 'minor') =>
  runToast(root, importance, h('span', { class: 'item-toast' }, h('img', { src: icon, alt: '' }), rich(text)), ms)

/** A field mission's toast icon: the egg, a Poké Ball or Togepi. */
const missionIcon = (kind: FieldMissionKind) => (kind === 'defense' ? eggIcon() : kind === 'collect' ? pokeballIcon() : portraitUrl(TOGEPI_DEX))

/** Sounds and toasts for whatever just happened at a map event. */
export const mapEventFeedback = (root: HTMLElement, notice: MapEventNotice) => {
  const m = t().mapEvents
  switch (notice.kind) {
    case 'altar':
      playSfx('altar')
      return iconToast(root, consumableIcon(notice.buff), m.altar(BUFFS[notice.buff].name))
    case 'fountain':
      playSfx('heal')
      return iconToast(root, fountainIcon(), m.fountain)
    case 'sip':
      return playSfx('sip', 120)
    case 'chestAmbush':
      playSfx('ambush')
      return runToast(root, 'important', rich(m.chestAmbush), 2800)
    case 'chestTick':
      return playSfx('tick', 60)
    case 'chestOpen':
      playSfx('unlock')
      return iconToast(root, pokeballIcon(), m.chestOpen(formatPokeDollars(notice.coins)), 3000)
    case 'spikes':
      return playSfx('spikes', 150)
    case 'fuse':
      return playSfx('fuse', 300)
    case 'boom':
      return playSfx('explosion', 120)
    case 'meowth':
      playCry(cryUrl(MEOWTH_DEX), 0.4)
      return iconToast(root, portraitUrl(MEOWTH_DEX), m.meowth, 3000, 'important')
    case 'meowthHit':
      return playSfx('coin', 60)
    case 'payDay':
      playSfx('payDay')
      playCry(cryUrl(MEOWTH_DEX), 0.4)
      return iconToast(root, coinIcon(2), m.payDay(formatPokeDollars(notice.coins)), 3000)
    case 'meowthEscaped':
      playSfx('escaped')
      return iconToast(root, portraitUrl(MEOWTH_DEX), m.meowthEscaped, 2000)
    case 'tutor':
      playSfx('altar')
      return iconToast(root, tmDiscIcon('#78c0f8'), m.tutor, 3600, 'important')
    case 'tutorEmpty':
      return iconToast(root, tmDiscIcon('#78c0f8'), m.tutorEmpty, 2600)
    case 'tutorLeft':
      return iconToast(root, tmDiscIcon('#78c0f8'), m.tutorLeft, 2200)
    case 'mission': {
      const f = m.field
      playSfx('altar')
      if (notice.mission === 'escort') playCry(cryUrl(TOGEPI_DEX), 0.4)
      const text = notice.mission === 'defense' ? f.defense : notice.mission === 'collect' ? f.collect(notice.balls) : f.escort
      return iconToast(root, missionIcon(notice.mission), text, 4000, 'important')
    }
    case 'nestRaid':
      playSfx('ambush')
      return iconToast(root, eggIcon(), m.field.nestRaid, 3200, 'important')
    case 'ballFound':
      playSfx('pickup')
      return iconToast(root, pokeballIcon(), m.field.ballFound(notice.got, notice.of), 1400)
    case 'togepiJoin':
      playCry(cryUrl(TOGEPI_DEX), 0.4)
      return iconToast(root, heartIcon(), m.field.togepiJoin, 3000)
    case 'missionDone': {
      playSfx('payDay')
      const coins = formatPokeDollars(notice.coins)
      return iconToast(root, notice.egg ? eggIcon() : missionIcon(notice.mission), notice.egg ? m.field.doneEgg(coins) : m.field.done(coins), 3600)
    }
    case 'missionFailed':
      playSfx('escaped')
      return iconToast(root, missionIcon(notice.mission), m.field.failed[notice.mission], 2600)
  }
}
