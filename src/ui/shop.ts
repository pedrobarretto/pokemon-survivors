import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { formatDay, formatNumber, formatPokeDollars, t } from '../i18n'
import { HATCHLINGS, PLAYABLE, type PlayableId } from '../data/hatchlings'
import { BRANCHES, branchesAt } from '../data/branches'
import type { EvolutionStage } from '../data/starters'
import { STYLE_SLOTS, styleIds, stylePrice, type StyleId, type StyleSlot } from '../data/style'
import { BOTTLE_CAPS, EVO_ITEM_IDS, EVO_ITEM_PRICE, EVO_ITEMS, INCUBATOR, MAX_CAPS, SHOP_LEVEL_IDS, SHOP_LEVELS, VITRINE, type BagItem, type EvoItemId, type ShopLevel, type VitrineEgg, type VitrineKey } from '../data/shop'
import { armBlock, armedItems, armItem, BAG_ITEM_IDS, BAG_ITEMS, bagCount } from '../game/bag'
import { addDays, brasiliaDay, dayNumber, msToNextDay, type DayKey } from '../game/day'
import { canPlay } from '../game/capture'
import { branchNeeds, buyCap, buyEvoItem, capBlock, capLevel, capPrice, evoBlock, evoItemSteps } from '../game/evoItems'
import { MOVES } from '../game/moves'
import { armedTms, armTm, buyTm, isRegularTm, nextTmDay, shelfOf, tmBlock, tmLimit, tmListing, tmPrice, type ShelfTm, type TmBlock } from '../game/tmShelf'
import { EGG_TIERS, EGGS, hatchOdds, incubatorSlots, MAX_SLOTS, type EggTier } from '../game/eggs'
import { buyQuick, buySlot, quickCount, slotBlock } from '../game/incubator'
import { buyUpgrade, refundAll, totalSpent, UPGRADE_IDS, UPGRADES, upgradePrice, type Save } from '../game/meta'
import {
  boughtToday,
  buyFromVitrine,
  buyKecleonEgg,
  buyStyle,
  claimGift,
  dayStyle,
  giftBlock,
  investBlock,
  investInShop,
  isDeal,
  kecleonEggBlock,
  kecleonEggPrice,
  nextAppearance,
  nextShopLevel,
  onPick,
  recordVisit,
  setWish,
  stockLeft,
  vitrineBlock,
  vitrineCards,
  vitrinePrice,
  vitrineStock,
  type StylePick,
  type Vitrine,
  type VitrineBlock,
} from '../game/shop'
import { playsShiny } from '../game/shinyPicks'
import { equipStyle, ownsStyle } from '../game/style'
import { festivalDay } from '../festival'
import { festivalAnnounced } from '../game/festival'
import { coinIcon, eggIcon, incubatorIcon } from '../render/art'
import { portraitUrl } from '../render/sprites'
import { styleThumb } from '../render/card'
import { frameIcon, wallpaperUrl } from '../render/cosmetics'
import { PLAZA_PROPS } from '../render/plaza'
import { CARAVAN, LOYALTY, STALLS, type StallGoodId } from '../data/visitors'
import { buyFromCaravan, caravanBlock, caravanPrice, caravanStock, goldCapFits, haggle, haggled, isoWeek, listPrice, type CaravanBlock, type CaravanKey } from '../game/caravan'
import { isGiftReward, milestoneState, nextMilestone, reachedNow, type Milestone } from '../game/loyalty'
import { buyFromStall, stallBlock, stallGood, stallGoods, type StallBlock } from '../game/stalls'
import { caravanDay, caravanOpen, meowthSpeaker, stallDay, stallSelling, stallSpeaker } from './visitors'
import { dialogue, type Dialogue, type DialogueLine } from './dialogue'
import { h, later, setText } from './dom'
import { festivalIcon } from './festival'
import { emptyCounter, kecleonSpeaker, levelUpLine, pickTrigger, thanks, visitLine, weekdayOf, type VisitContext } from './kecleon'
import { loadSave, today, vitrineToday, writeSave } from './save'
import { confirmDialog, hint, type Screen } from './screens'
import { capPips, shopIcon, tmPicture } from './shopIcons'
import { nearestInDirection, type Direction } from './spatial'

/**
 * The Kecleon Shop's panel, over the plaza in the lobby: a side panel on wide
 * screens (the plaza on the left), a bottom sheet on portrait phones (the
 * plaza above). Kecleon talks beside it in a passive dialogue box: what it
 * says on arrival follows who you are and what you did (`ui/kecleon.ts`),
 * and it thanks you after a purchase. The shelves are tabs, as data
 * (`SHELVES`); the description strip below them shows the chosen card with
 * its main button (and the wishlist's ♥). Keyboard: arrows move (tabs, cards
 * and buttons, by where they are), Q/E change shelf, Enter acts, F pins on
 * the wishlist, Esc goes back. Mouse: hover chooses, a click acts. Touch: a
 * tap chooses, a second tap (or the button) acts. Gamepad: the D-pad, A and B.
 */

/* ---------------- The plaza and its shopkeepers ---------------- */

/** Who tends a shelf: the green Kecleon, the purple brother (from the Tent: TMs and evolution items), Meowth at his weekend caravan or a seasonal stall's keeper. */
export type Keeper = 'green' | 'purple' | 'meowth' | 'stall'

/** The shelves a talk with a visitor opens on: Meowth's caravan or the seasonal stall's. */
export type VisitorShelf = 'caravan' | 'stall'

/** A shelf's keeper as the dialogue box's speaker. */
const speakerOf = (keeper: Keeper) =>
  keeper === 'meowth' ? meowthSpeaker() : keeper === 'stall' ? stallSpeaker(stallSelling() ?? 'halloween') : kecleonSpeaker(keeper === 'purple')

/** A thanks after a purchase from `keeper`, a different one each time (`n`: purchases so far this visit). */
const thanksFrom = (keeper: Keeper, n: number): DialogueLine => {
  if (keeper === 'green' || keeper === 'purple') return thanks(n, keeper === 'purple')
  const lines = keeper === 'meowth' ? t().plaza.meowth.thanks : t().plaza.duskull.thanks
  return { text: lines[n % lines.length]!, emotion: n % 2 ? 'Joyous' : 'Happy' }
}

/** The plaza behind the panel, as the shop drives it (the shell wires it to the lobby's meadow). */
export type ShopPlaza = {
  /** The green Kecleon is camouflaged (the 1-in-20 easter egg) until `reveal`. */
  hidden: () => boolean
  reveal: () => void
  /** The shop grew to `level`: the plaza swaps the building, with a celebration. */
  grew: (level: ShopLevel) => void
  /** The camera leans towards the shopkeeper of the shelf shown. */
  lookAt: (keeper: Keeper) => void
}

/* ---------------- Cards ---------------- */

/** What the description strip shows for the chosen card: a picture, a title, a text and the main button. */
type Desc = { icon: HTMLElement; title: string; text: string; action: string; disabled: boolean }

/**
 * One card of a shelf: its element, how it redraws, its description and what
 * its main button does (null: denied). `confirm`: the question to ask first,
 * for spending that can't be undone. `wish`: the Vitrine card the ♥ pins.
 * `said`: what the shelf's keeper says once `act` went through ('thanks' by default, null: nothing).
 */
type Card = {
  el: HTMLButtonElement
  refresh: (save: Save) => void
  describe: (save: Save) => Desc
  act: (save: Save) => Save | null
  confirm?: (save: Save) => string | null
  wish?: VitrineKey
  said?: (before: Save, after: Save) => DialogueLine | 'thanks' | null
}

const img = (src: string, cls = '') => h('img', { src, alt: '', class: cls, draggable: 'false' })

/** A card's frame: corner badges, picture, name, a line under it and the price (or status). */
const shell = (picture: HTMLElement, name: string) => {
  const badges = h('span', { class: 'shop-badges' })
  const sub = h('span', { class: 'shop-sub' })
  const price = h('span', { class: 'shop-price' })
  const el = h('button', { class: 'shop-card', type: 'button' }, badges, h('span', { class: 'shop-pic' }, picture), h('span', { class: 'shop-name' }, name), sub, price)
  return { el, badges, sub, price }
}

type BadgeKind = 'gift' | 'deal' | 'wish' | 'new' | 'armed' | 'level' | 'here' | 'exclusive' | 'found' | 'today' | 'owned'
const badge = (kind: BadgeKind, text: string) => h('b', { class: `shop-badge ${kind}` }, text)

/** Sets a card's badges, dropping the falsy ones. */
const setBadges = (el: HTMLElement, list: readonly (HTMLElement | false | null)[]) => el.replaceChildren(...list.filter((b): b is HTMLElement => b instanceof HTMLElement))

/** The day after `day` the Vitrine shows `key` to `level` from `from` on ("Volta no sábado"), as words; today's says so. */
const whenBack = (key: VitrineKey, from: string, level: ShopLevel) => {
  const w = t().shop.wish
  const day = nextAppearance(key, from, level)
  if (day === from) return w.today
  return day ? w.back(t().plaza.weekdays[weekdayOf(day)]!) : w.none
}

type Item = { name: string; picture: (big?: boolean) => HTMLElement; text: string }

/** Name, picture and text of a Vitrine card today; the style card shows the day's `style` for this save (null: it owns them all). */
const vitrineItem = (v: Vitrine, key: VitrineKey, style: StylePick | null): Item => {
  const sh = t().shop
  if (key === 'egg') {
    const odds = (Object.keys(VITRINE.eggs) as VitrineEgg[]).map((k) => VITRINE.eggs[k].weight)
    const total = odds.reduce((a, b) => a + b, 0)
    const [common, rare, ultra] = odds.map((w) => Math.round((w / total) * 100)) as [number, number, number]
    return { name: t().eggs.tiers[v.egg], picture: () => img(eggIcon(v.egg), 'shop-egg'), text: `${t().mart.eggDescription(formatNumber(EGG_TIERS[v.egg].steps))} ${sh.eggOdds(common, rare, ultra)}` }
  }
  if (key === 'style') {
    if (!style) return { name: sh.dayStyle, picture: () => img(frameIcon('classic'), 'shop-pixel'), text: sh.allStyles }
    const name = (t().mart.styles[style.slot] as Readonly<Record<string, string>>)[style.id] ?? style.id
    return { name, picture: (big) => onPick(style, (slot, id) => stylePicture(slot, id, big === true)), text: `${sh.dayStyle}. ${t().mart.styleDescriptions[style.slot]}` }
  }
  return { name: BAG_ITEMS[key].name, picture: () => shopIcon(key), text: t().bag.descriptions[key] }
}

/** The lowest shop level that shows the `i`-th card of the day. */
const levelShowing = (i: number) => SHOP_LEVEL_IDS.find((l) => i < 1 + SHOP_LEVELS[l].vitrineSlots) ?? SHOP_LEVEL_IDS[SHOP_LEVEL_IDS.length - 1]!

/** The free gift of the day: one consumable, taken once per day. */
const giftCard = (v: Vitrine): Card => {
  const sh = t().shop
  const name = BAG_ITEMS[v.gift].name
  const { el, badges, price } = shell(shopIcon(v.gift), name)
  el.classList.add('gift')
  return {
    el,
    refresh: (save) => {
      const taken = giftBlock(save, v) !== null
      setBadges(badges, [badge('gift', sh.badges.gift)])
      setText(price, taken ? sh.claimed : sh.free)
      el.classList.toggle('sold', taken)
    },
    describe: (save) => {
      const taken = giftBlock(save, v) !== null
      return { icon: shopIcon(v.gift), title: sh.gift(name), text: `${sh.giftDescription(t().bag.descriptions[v.gift])} ${sh.have(bagCount(save.bag, v.gift))}`, action: taken ? sh.claimed : sh.claim, disabled: taken }
    },
    act: (save) => claimGift(save, v),
  }
}

/** What a blocked Vitrine card says instead of its price. */
const blockText = (block: VitrineBlock | null) => (block === null || block === 'poor' ? null : t().shop.blocks[block])

/**
 * The Kecleon Egg's fixed card: beside the day's cards (never one of them),
 * several a day at any level, each double the last (`kecleonEggPrice`): the
 * card shows how many today, this one's price and the next one's, and the
 * odds of each of its four families for this save. Kecleon has a word for
 * whoever takes one.
 */
const kecleonEggCard = (v: Vitrine): Card => {
  const sh = t().shop
  const k = sh.kecleonEgg
  const max = vitrineStock('kecleonEgg')
  const name = t().eggs.tiers.kecleon
  const { el, badges, sub, price } = shell(shopIcon('kecleonEgg'), name)
  const next = h('span', { class: 'shop-next' })
  el.append(next)
  el.classList.add('kecleon-egg')
  const bought = (save: Save) => boughtToday(save.shop, v, 'kecleonEgg')
  const blocked = (save: Save) => {
    const block = kecleonEggBlock(save, v)
    return block === null || block === 'poor' ? null : sh.blocks[block]
  }
  /** The line under the price: the egg after this one, or that this is the day's last; nothing while blocked. */
  const nextLine = (save: Save) => {
    if (blocked(save)) return ''
    const after = kecleonEggPrice(bought(save) + 1)
    // A no-break space keeps ₽ beside its number when the line wraps on a narrow card.
    return after === null ? k.last : k.next(formatPokeDollars(after).replace(/ /g, ' '))
  }
  return {
    el,
    refresh: (save) => {
      const block = kecleonEggBlock(save, v)
      setBadges(badges, [badge('exclusive', sh.badges.exclusive)])
      setText(sub, k.today(bought(save), max))
      setText(price, blocked(save) ?? formatPokeDollars(kecleonEggPrice(bought(save)) ?? 0))
      setText(next, nextLine(save))
      el.classList.toggle('sold', block === 'soldOut' || block === 'full')
      el.classList.toggle('poor', block === 'poor')
    },
    describe: (save) => ({
      icon: shopIcon('kecleonEgg'),
      title: name,
      // The odds first (a full incubator's hint before them): on a phone the strip shows a few lines before it scrolls.
      text: [
        kecleonEggBlock(save, v) === 'full' && k.full,
        eggOdds('kecleon', save),
        k.text(formatNumber(EGG_TIERS.kecleon.steps)),
        k.ladder(max, VITRINE.kecleonEgg.prices.map(formatPokeDollars).join(', ')),
        t().shop.stall.duplicate(formatPokeDollars(EGG_TIERS.kecleon.refund)),
        sh.stock(stockLeft(save.shop, v, 'kecleonEgg'), max),
      ]
        .filter((l): l is string => typeof l === 'string')
        .join(' '),
      action: blocked(save) ?? t().mart.buy(formatPokeDollars(kecleonEggPrice(bought(save)) ?? 0)),
      disabled: kecleonEggBlock(save, v) !== null,
    }),
    confirm: (save) => {
      const cost = kecleonEggPrice(bought(save))
      return cost !== null && cost >= VITRINE.kecleonEgg.confirmFrom && kecleonEggBlock(save, v) === null ? k.confirm(formatPokeDollars(cost)) : null
    },
    act: (save) => buyKecleonEgg(save, v),
    said: (before, after) => (after.wallet < before.wallet ? { text: t().plaza.lines.kecleonEgg, emotion: 'Inspired' } : null),
  }
}

/** One card of the day's Vitrine: the deal first, the ones above the shop's level locked (a peek at what growing brings). */
const vitrineCard = (v: Vitrine, key: VitrineKey, i: number, style: StylePick | null): Card => {
  const sh = t().shop
  const item = vitrineItem(v, key, style)
  const { el, badges, price } = shell(item.picture(), item.name)
  const deal = isDeal(v, key)
  const shows = levelShowing(i)
  const priceOf = (save: Save) => vitrinePrice(v, key, save.style) ?? 0
  const fullPrice = (save: Save) => Math.round(priceOf(save) / (1 - VITRINE.deal) / 10) * 10
  /** Never owned: a consumable never in the Bag (eggs and styles are new things anyway). */
  const fresh = (save: Save) => key !== 'egg' && key !== 'style' && save.bag[key].got === 0
  const lines = (save: Save) => {
    const have = key === 'egg' || key === 'style' ? null : sh.have(bagCount(save.bag, key))
    const wished = save.shop.wishlist === key ? whenBack(key, v.day, save.shop.level) : null
    return [item.text, deal && sh.deal(VITRINE.deal * 100), sh.stock(stockLeft(save.shop, v, key), vitrineStock(key)), have, wished].filter((l): l is string => typeof l === 'string' && l !== '').join(' ')
  }
  return {
    el,
    wish: key,
    refresh: (save) => {
      const block = vitrineBlock(save, v, key)
      const locked = block === 'locked'
      setBadges(badges, [
        locked && badge('level', sh.badges.level(shows)),
        !locked && deal && badge('deal', `−${VITRINE.deal * 100}%`),
        save.shop.wishlist === key && badge('wish', sh.badges.wish),
        !locked && fresh(save) && badge('new', sh.badges.new),
      ])
      const blocked = blockText(block)
      price.replaceChildren(...(deal && !blocked ? [h('s', {}, formatPokeDollars(fullPrice(save))), ' '] : []), locked ? '' : (blocked ?? formatPokeDollars(priceOf(save))))
      el.classList.toggle('locked', locked)
      el.classList.toggle('sold', block === 'soldOut' || block === 'owned' || block === 'full')
      el.classList.toggle('poor', block === 'poor')
      el.classList.toggle('deal', deal)
    },
    describe: (save) => {
      const block = vitrineBlock(save, v, key)
      return {
        icon: item.picture(true),
        title: item.name,
        text: block === 'locked' ? `${item.text} ${sh.lockedAt(sh.levels[shows], shows)}` : lines(save),
        action: blockText(block) ?? t().mart.buy(formatPokeDollars(priceOf(save))),
        disabled: block !== null,
      }
    },
    act: (save) => buyFromVitrine(save, v, key),
  }
}

/* ---------------- Mochila ---------------- */

/** The armed-items limit of the save's shop level. */
const bagLimit = (save: Save) => SHOP_LEVELS[save.shop.level].bagSlots

/** A consumable in the Bag: how many, what it does, packed for the next run or not (the same state the partner select arms). */
const bagCard = (id: BagItem): Card => {
  const sh = t().shop
  const { el, badges, sub, price } = shell(shopIcon(id), BAG_ITEMS[id].name)
  return {
    el,
    wish: id,
    refresh: (save) => {
      const n = bagCount(save.bag, id)
      setBadges(badges, [save.bag.armed[id] && badge('armed', sh.badges.armed), save.shop.wishlist === id && badge('wish', sh.badges.wish)])
      setText(sub, `×${n}`)
      setText(price, n === 0 ? '—' : save.bag.armed[id] ? sh.bag.disarm : sh.bag.arm)
      el.classList.toggle('armed', save.bag.armed[id])
      el.classList.toggle('sold', n === 0)
    },
    describe: (save) => {
      const n = bagCount(save.bag, id)
      const armed = save.bag.armed[id]
      const block = armed ? null : armBlock(save.bag, id, bagLimit(save))
      const next = nextShopLevel(save.shop.level)
      const why = block === 'empty' ? sh.bag.empty : block === 'full' ? `${t().bag.full(bagLimit(save))}${next ? ` ${sh.bag.more(sh.levels[next], next, SHOP_LEVELS[next].bagSlots)}` : ''}` : null
      const when = whenBack(id, brasiliaDay(today()), save.shop.level)
      return {
        icon: shopIcon(id),
        title: `${BAG_ITEMS[id].name} ×${n}`,
        text: [t().bag.descriptions[id], why ?? sh.have(n), when].join(' '),
        action: armed ? sh.bag.disarm : sh.bag.arm,
        disabled: block !== null,
      }
    },
    act: (save) => {
      const on = !save.bag.armed[id]
      if (on && armBlock(save.bag, id, bagLimit(save))) return null
      return { ...save, bag: armItem(save.bag, id, on, bagLimit(save)) }
    },
    said: () => null,
  }
}

/* ---------------- TMs (the purple brother) ---------------- */

/** What a blocked TM card says instead of its price. */
const tmBlockText = (block: TmBlock | null) => (block === null || block === 'poor' ? null : t().shop.tms.blocks[block])

/** "Volta à prateleira no sábado" for a regular TM after `day` (empty for an exclusive, always there). */
const tmBack = (id: ShelfTm, day: DayKey) => {
  if (!isRegularTm(id)) return ''
  const back = nextTmDay(id, addDays(day, 1))
  return back ? t().shop.tms.back(t().plaza.weekdays[weekdayOf(back)]!) : ''
}

/**
 * A TM on the shelf: bought for good, then armed or not for the next runs
 * (up to the level's `armedTms`; arming past it swaps the oldest out).
 */
const tmCard = (id: ShelfTm, day: DayKey): Card => {
  const sh = t().shop
  const name = MOVES[id].name
  const { el, badges, sub, price } = shell(tmPicture(id), name)
  const owned = (save: Save) => save.tms.owned.includes(id)
  const armed = (save: Save) => armedTms(save.tms, tmLimit(save.shop.level)).includes(id)
  return {
    el,
    refresh: (save) => {
      const listing = tmListing(save.tms, id, day)
      setBadges(badges, [
        armed(save) && badge('armed', sh.tms.armed.toLocaleUpperCase()),
        !owned(save) && listing === 'exclusive' && badge('exclusive', sh.badges.exclusive),
        !owned(save) && listing === 'learned' && badge('found', sh.badges.found),
        !owned(save) && listing === 'today' && badge('today', sh.badges.today),
        owned(save) && !armed(save) && badge('owned', sh.badges.owned),
      ])
      setText(sub, t().types[MOVES[id].type])
      const block = owned(save) ? null : tmBlock(save, id, day)
      setText(price, owned(save) ? (armed(save) ? sh.tms.disarm : sh.tms.arm) : (tmBlockText(block) ?? formatPokeDollars(tmPrice(id))))
      el.classList.toggle('armed', armed(save))
      el.classList.toggle('poor', block === 'poor')
    },
    describe: (save) => {
      const listing = tmListing(save.tms, id, day)
      const limit = tmLimit(save.shop.level)
      const block = owned(save) ? null : tmBlock(save, id, day)
      const next = nextShopLevel(save.shop.level)
      const why = owned(save) ? '' : listing === 'exclusive' ? sh.tms.exclusive : listing === 'learned' ? sh.tms.found : listing === 'today' ? sh.tms.today(tmBack(id, day)) : tmBack(id, day)
      const more = next && SHOP_LEVELS[next].armedTms > limit ? ` ${sh.tms.more(sh.levels[next], next)}` : ''
      const full = owned(save) && !armed(save) && armedTms(save.tms, limit).length >= limit ? `${sh.tms.swap(limit)}${more}` : ''
      return {
        icon: tmPicture(id),
        title: `TM · ${name}`,
        text: [t().moves[id].description, why, owned(save) ? '' : sh.tms.text, full].filter((l) => l !== '').join(' '),
        action: owned(save) ? (armed(save) ? sh.tms.disarm : sh.tms.arm) : (tmBlockText(block) ?? t().mart.buy(formatPokeDollars(tmPrice(id)))),
        disabled: !owned(save) && block !== null,
      }
    },
    act: (save) => (owned(save) ? { ...save, tms: armTm(save.tms, id, !armed(save), tmLimit(save.shop.level)) } : buyTm(save, id, day)),
    said: (before, after) => (after.wallet < before.wallet ? 'thanks' : null),
  }
}

/** The TM shelf: the case first (to arm), then the exclusives, the TMs found in runs and today's rotation. */
const tmStock = (save: Save): (Card | string)[] => {
  const g = t().shop.tms.groups
  const day = vitrineToday().day
  const shelf = shelfOf(save.tms, day)
  const forSale = (kind: 'exclusive' | 'learned' | 'today') => shelf.filter((id) => !save.tms.owned.includes(id) && tmListing(save.tms, id, day) === kind)
  const group = (title: string, ids: readonly ShelfTm[]) => (ids.length > 0 ? [title, ...ids.map((id) => tmCard(id, day))] : [])
  return [
    ...group(g.owned, shelf.filter((id) => save.tms.owned.includes(id))),
    ...group(g.exclusive, forSale('exclusive')),
    ...group(g.found, forSale('learned')),
    ...group(g.today, forSale('today')),
  ]
}

/* ---------------- Evolução (the purple brother) ---------------- */

/** An evolution item: owned for good, it unlocks its branches (or adds Eevee's free ones to the choice). */
const evoCard = (id: EvoItemId): Card => {
  const sh = t().shop
  const def = EVO_ITEMS[id]
  // The line steps it evolves (Porygon2, Exeggutor), each with the form it leaves.
  const steps = evoItemSteps(id).map(({ family, stage }) => {
    const line: readonly EvolutionStage[] = PLAYABLE[family].line
    return { form: line[stage]!.name, from: line[stage - 1]!.name }
  })
  const forms = [...def.branches.map((b) => BRANCHES[b].name), ...steps.map((s) => s.form)].join(' · ')
  const { el, badges, sub, price } = shell(shopIcon(id), def.name)
  const owned = (save: Save) => save.evo.includes(id)
  const families = [...new Set(def.branches.map((b) => BRANCHES[b].line))]
  return {
    el,
    refresh: (save) => {
      setBadges(badges, [owned(save) && badge('owned', sh.badges.owned)])
      setText(sub, forms)
      const block = evoBlock(save, id)
      setText(price, owned(save) ? sh.evolution.owned : block === 'locked' ? sh.blocks.locked : formatPokeDollars(EVO_ITEM_PRICE))
      el.classList.toggle('done', owned(save))
      el.classList.toggle('poor', block === 'poor')
    },
    describe: (save) => {
      const block = evoBlock(save, id)
      const lines = families.flatMap((line) => {
        const mine = def.branches.filter((b) => BRANCHES[b].line === line)
        const forms = mine.map((b) => BRANCHES[b].name).join(' / ')
        const family = PLAYABLE[line].line[0].name
        if (mine.every((b) => branchNeeds(b) === null)) return [sh.evolution.adds(forms, family)]
        // A family with no free branch at that evolution stays in its form without any item.
        const stays = branchesAt(line, BRANCHES[mine[0]!].stage).every((b) => branchNeeds(b) !== null)
        return [sh.evolution.unlocks(forms, family), ...(stays ? [sh.evolution.stays(family)] : [])]
      })
      // A line step has no other way on: without the item, the form before it stays. "Yours for good" once (a branch's line says it).
      const evolves = steps.flatMap((s) => [sh.evolution.evolves(s.from, s.form, lines.length === 0), sh.evolution.stays(s.from)])
      const drops = steps.length > 0 || def.branches.some((b) => branchNeeds(b) === id)
      return {
        icon: shopIcon(id),
        title: def.name,
        text: [...lines, ...evolves, ...(drops ? [sh.evolution.drops] : [])].join(' '),
        action: owned(save) ? sh.evolution.owned : block === 'locked' ? sh.blocks.locked : t().mart.buy(formatPokeDollars(EVO_ITEM_PRICE)),
        disabled: block !== null,
      }
    },
    act: (save) => buyEvoItem(save, id),
  }
}

/* ---------------- Tampinhas (Treino) ---------------- */

/** The next Bottle Cap for `id`: its price, its level as pips, what it adds. */
const capCard = (id: PlayableId): Card => {
  const sh = t().shop
  const name = PLAYABLE[id].line[0].name
  const { el, sub, price } = shell(shopIcon('bottleCap'), name)
  sub.classList.add('pips')
  return {
    el,
    refresh: (save) => {
      const level = capLevel(save.caps, id)
      sub.replaceChildren(...Array.from({ length: MAX_CAPS }, (_, i) => h('span', { class: i < level ? 'pip on' : 'pip' })))
      const next = capPrice(level)
      const block = capBlock(save, id)
      setText(price, block === 'locked' ? sh.blocks.locked : next === null ? sh.caps.max : formatPokeDollars(next))
      el.classList.toggle('done', next === null)
      el.classList.toggle('locked', block === 'locked')
      el.classList.toggle('poor', block === 'poor')
    },
    describe: (save) => {
      const level = capLevel(save.caps, id)
      const next = capPrice(level)
      const block = capBlock(save, id)
      return {
        icon: shopIcon('bottleCap'),
        title: `${sh.caps.title(level, MAX_CAPS)} · ${name}`,
        text: [sh.caps.text(name), level > 0 ? sh.caps.now(Math.round(level * BOTTLE_CAPS.boost * 100)) : '', block === 'locked' ? sh.caps.lockedAt(sh.levels[3]) : '']
          .filter((l) => l !== '')
          .join(' '),
        action: block === 'locked' ? sh.blocks.locked : next === null ? sh.caps.max : t().mart.buy(formatPokeDollars(next)),
        disabled: block !== null,
      }
    },
    act: (save) => buyCap(save, id),
  }
}

/** The card that opens the picker of whose Bottle Caps the Treino shows. */
const capPickCard = (id: PlayableId, pick: () => void): Card => {
  const sh = t().shop
  const portrait = () => img(portraitUrl(PLAYABLE[id].line[0].dex), 'shop-portrait')
  const { el, price } = shell(portrait(), sh.caps.pick)
  return {
    el,
    refresh: () => setText(price, '▸'),
    describe: () => ({ icon: portrait(), title: sh.caps.pick, text: sh.caps.pickText, action: sh.caps.pick, disabled: false }),
    act: () => {
      pick()
      return null
    },
    said: () => null,
  }
}

/**
 * The picker of whose Bottle Caps the Treino shows: every Pokémon the save
 * can play, with its caps as pips. Arrows move, Enter (a tap) picks, Esc closes.
 */
const capsPicker = (
  root: HTMLElement,
  input: Input,
  save: Save,
  current: PlayableId,
  onPick: (id: PlayableId | null) => void,
  opts: { title: string; fits: (id: PlayableId) => boolean } = { title: t().shop.caps.pickTitle, fits: (id) => canPlay(save, id) },
): Screen => {
  const ids = (Object.keys(PLAYABLE) as PlayableId[]).filter(opts.fits)
  const buttons = ids.map((id) =>
    h(
      'button',
      { class: id === current ? 'caps-pick-cell on' : 'caps-pick-cell', type: 'button', title: PLAYABLE[id].line[0].name, onclick: () => onPick(id) },
      img(portraitUrl(PLAYABLE[id].line[0].dex)),
      capPips(capLevel(save.caps, id)),
    ),
  )
  let at = Math.max(0, ids.indexOf(current))
  const mark = () => buttons.forEach((b, i) => b.classList.toggle('selected', i === at))
  const off = input.onKey((key) => {
    const dir = DIRECTIONS[key]
    if (dir) {
      at = nearestInDirection(buttons.map((b) => b.getBoundingClientRect()), at, dir)
      buttons[at]?.scrollIntoView({ block: 'nearest' })
      mark()
      playSfx('move')
    } else if (key === 'Enter' || key === 'Space') onPick(ids[at] ?? null)
    else if (key === 'Escape' || key === 'Backspace') onPick(null)
  })
  const el: HTMLElement = h(
    'div',
    { class: 'screen dim shop-confirm' },
    h('div', { class: 'dialog box pop caps-picker' }, h('div', { class: 'dialog-title' }, opts.title), h('div', { class: 'caps-pick-grid' }, ...buttons)),
  )
  // A tap outside the box closes it.
  el.addEventListener('click', (e) => e.target === el && onPick(null))
  root.append(el)
  mark()
  later(() => buttons[at]?.scrollIntoView({ block: 'nearest' }))
  return { el, dispose: () => (off(), el.remove()) }
}

/* ---------------- Treino ---------------- */

/** The permanent upgrades (the vitamins and the Shiny Charm), with their ranks as pips. */
const upgradeCard = (id: (typeof UPGRADE_IDS)[number]): Card => {
  const def = UPGRADES[id]
  const { el, sub, price } = shell(shopIcon(id), def.name)
  sub.classList.add('pips')
  return {
    el,
    refresh: (save) => {
      const rank = save.ranks[id]
      sub.replaceChildren(...Array.from({ length: def.maxRank }, (_, i) => h('span', { class: i < rank ? 'pip on' : 'pip' })))
      const maxed = rank >= def.maxRank
      setText(price, maxed ? t().max : formatPokeDollars(upgradePrice(id, rank)))
      el.classList.toggle('done', maxed)
      el.classList.toggle('poor', !maxed && upgradePrice(id, rank) > save.wallet)
    },
    describe: (save) => {
      const rank = save.ranks[id]
      const maxed = rank >= def.maxRank
      return {
        icon: shopIcon(id),
        title: t().mart.rank(def.name, rank, def.maxRank),
        text: t().upgrades[id],
        action: maxed ? t().max : t().mart.buy(formatPokeDollars(upgradePrice(id, rank))),
        disabled: maxed || upgradePrice(id, rank) > save.wallet,
      }
    },
    act: (save) => buyUpgrade(save, id),
  }
}

/* ---------------- Estilo ---------------- */

/** A style's picture: the frame's ball (or the card with it), a corner of the sky, the wallpaper's tile. */
const stylePicture = <S extends StyleSlot>(slot: S, id: StyleId<S>, big: boolean) => {
  if (slot === 'wallpaper') return h('span', { class: big ? 'shop-tile big' : 'shop-tile', style: `--wallpaper:url(${wallpaperUrl(id as StyleId<'wallpaper'>)})` })
  if (!big && slot === 'frame') return img(frameIcon(id as StyleId<'frame'>), 'shop-pixel')
  const equipped = loadSave().style.equipped
  const canvas = big
    ? slot === 'frame'
      ? styleThumb(id as StyleId<'frame'>, equipped.background)
      : styleThumb(equipped.frame, id as StyleId<'background'>)
    : styleThumb(null, id as StyleId<'background'>, 14, 14)
  canvas.classList.add(big ? 'shop-preview' : 'shop-pixel')
  return canvas
}

/** A frame, background or wallpaper: the owned ones to wear, the rest to buy (and wear). Gift-only styles show once owned. */
const styleCards = (slot: StyleSlot): Card[] =>
  styleIds(slot).flatMap((id) => {
    const listed = stylePrice(slot, id)
    if (listed === null && !ownsStyle(loadSave().style, slot, id)) return []
    const cost = listed ?? 0
    const name = (t().mart.styles[slot] as Readonly<Record<string, string>>)[id] ?? id
    const { el, sub, price } = shell(stylePicture(slot, id, false), name)
    const status = (save: Save) => (save.style.equipped[slot] === id ? t().mart.equipped : ownsStyle(save.style, slot, id) ? t().mart.owned : formatPokeDollars(cost))
    return [
      {
        el,
        refresh: (save) => {
          setText(price, status(save))
          setText(sub, '')
          el.classList.toggle('done', save.style.equipped[slot] === id)
          el.classList.toggle('poor', !ownsStyle(save.style, slot, id) && cost > save.wallet)
        },
        describe: (save) => {
          const owned = ownsStyle(save.style, slot, id)
          const worn = save.style.equipped[slot] === id
          return {
            icon: stylePicture(slot, id, true),
            title: name,
            text: t().mart.styleDescriptions[slot],
            action: worn ? t().mart.equipped : owned ? t().mart.equip : t().mart.buy(formatPokeDollars(cost)),
            disabled: worn || (!owned && cost > save.wallet),
          }
        },
        // Buying wears it right away; an owned one is just worn.
        act: (save) => {
          if (save.style.equipped[slot] === id) return null
          const bought = ownsStyle(save.style, slot, id) ? save : buyStyle(save, slot, id)
          return bought && { ...bought, style: equipStyle(bought.style, slot, id) }
        },
        said: (before, after) => (after.wallet < before.wallet ? 'thanks' : null),
      },
    ]
  })

/* ---------------- Expansão ---------------- */

/** What reaching `level` brings, line by line, from the level's data (the props the plaza draws so far). */
const unlocks = (level: ShopLevel): string[] => {
  const e = t().shop.expansion
  const def = SHOP_LEVELS[level]
  const before = SHOP_LEVEL_IDS.find((l) => l === level - 1)
  const was = before ? SHOP_LEVELS[before] : null
  return [
    was !== null && e.building(t().shop.levels[level]),
    (!was || def.vitrineSlots > was.vitrineSlots) && e.vitrine(def.vitrineSlots + 1),
    (!was || def.bagSlots > was.bagSlots) && e.bag(def.bagSlots),
    def.wishlist && !was?.wishlist && e.wishlist,
    def.brother && !was?.brother && e.brother,
    def.caravan && !was?.caravan && e.caravan,
    def.tycoon && !was?.tycoon && e.tycoon,
    ...def.props.filter((p) => PLAZA_PROPS.includes(p)).map((p) => e.props[p]),
  ].filter((l): l is string => typeof l === 'string')
}

/** A rung of the shop's ladder: owned, the next one (to invest in, for good, so it asks first), or further up. */
const levelCard = (level: ShopLevel): Card => {
  const sh = t().shop
  const def = SHOP_LEVELS[level]
  const { el, badges, sub, price } = shell(shopIcon('expansion'), sh.level(sh.levels[level], level))
  const isNext = (save: Save) => nextShopLevel(save.shop.level) === level
  return {
    el,
    refresh: (save) => {
      const owned = save.shop.level >= level
      setBadges(badges, [save.shop.level === level && badge('here', sh.expansion.current), isNext(save) && badge('deal', sh.expansion.next)])
      setText(sub, unlocks(level).slice(level > 1 ? 1 : 0, 3).join(' '))
      setText(price, owned ? '✓' : formatPokeDollars(def.cost))
      el.classList.toggle('done', owned)
      el.classList.toggle('locked', !owned && !isNext(save))
      el.classList.toggle('poor', isNext(save) && investBlock(save) === 'poor')
    },
    describe: (save) => {
      const owned = save.shop.level >= level
      return {
        icon: shopIcon('expansion'),
        title: sh.level(sh.levels[level], level),
        text: unlocks(level).join(' '),
        action: owned ? sh.expansion.owned : isNext(save) ? sh.expansion.invest(formatPokeDollars(def.cost)) : formatPokeDollars(def.cost),
        disabled: owned || !isNext(save) || investBlock(save) !== null,
      }
    },
    act: (save) => (isNext(save) ? investInShop(save) : null),
    confirm: (save) => (isNext(save) && !investBlock(save) ? sh.investConfirm(sh.levels[level], formatPokeDollars(def.cost)) : null),
    said: (_, after) => (SHOP_LEVELS[after.shop.level].tycoon ? { text: t().plaza.lines.tycoon, emotion: 'Joyous' } : levelUpLine(sh.levels[after.shop.level])),
  }
}

/* ---------------- Incubadora ---------------- */

/** An extra incubator slot (`INCUBATOR.slots[i]`): owned, the next one (for good, so it asks first), or waiting on the slot before it or the shop's level. */
const slotCard = (i: number): Card => {
  const m = t().shop.incubator
  const def = INCUBATOR.slots[i]!
  const n = EGGS.slots + i + 1
  const level = t().shop.level(t().shop.levels[def.minLevel], def.minLevel)
  const { el, badges, sub, price } = shell(img(incubatorIcon(), 'shop-egg'), m.slot(n))
  const owned = (save: Save) => save.incubator.slots > i
  const isNext = (save: Save) => save.incubator.slots === i
  /** Why it waits, when it isn't the next one or the shop is too small for it. */
  const waits = (save: Save) => (owned(save) ? null : !isNext(save) ? m.before : slotBlock(save) === 'level' ? m.needs(level) : null)
  return {
    el,
    refresh: (save) => {
      setBadges(badges, [owned(save) && badge('owned', t().shop.badges.owned), !owned(save) && badge('level', t().shop.badges.level(def.minLevel))])
      setText(sub, waits(save) ?? m.slotText)
      setText(price, owned(save) ? '✓' : formatPokeDollars(def.price))
      el.classList.toggle('done', owned(save))
      el.classList.toggle('locked', waits(save) !== null)
      el.classList.toggle('poor', isNext(save) && slotBlock(save) === 'poor')
    },
    describe: (save) => ({
      icon: img(incubatorIcon(), 'shop-egg'),
      title: m.slot(n),
      text: [m.slotText, owned(save) ? m.owned : (waits(save) ?? m.needs(level))].join(' '),
      action: owned(save) ? m.owned : m.buy(formatPokeDollars(def.price)),
      disabled: owned(save) || !isNext(save) || slotBlock(save) !== null,
    }),
    act: (save) => (isNext(save) ? buySlot(save) : null),
    confirm: (save) => (isNext(save) && !slotBlock(save) ? m.confirm(n, formatPokeDollars(def.price)) : null),
  }
}

/** The Quick Incubator: bought here (no daily stock), put on an egg from the incubator screen. */
const quickCard = (): Card => {
  const m = t().shop.incubator
  const { price: cost, speed } = INCUBATOR.quick
  const { el, badges, sub, price } = shell(img(incubatorIcon(true), 'shop-egg'), m.quick)
  return {
    el,
    refresh: (save) => {
      setBadges(badges, [])
      setText(sub, `×${quickCount(save.incubator)}`)
      setText(price, formatPokeDollars(cost))
      el.classList.toggle('poor', save.wallet < cost)
    },
    describe: (save) => ({
      icon: img(incubatorIcon(true), 'shop-egg'),
      title: `${m.quick} ×${quickCount(save.incubator)}`,
      text: [m.quickText(speed), t().shop.have(quickCount(save.incubator))].join(' '),
      action: save.wallet < cost ? t().shop.blocks.poor : t().mart.buy(formatPokeDollars(cost)),
      disabled: save.wallet < cost,
    }),
    act: buyQuick,
  }
}

/* ---------------- Caravana (Meowth, weekends) ---------------- */

/** What a caravan card shows: its name, picture and what it is. */
const caravanItem = (key: CaravanKey): Item => {
  const c = t().shop.caravan
  if (key === 'egg') return { name: t().eggs.tiers[CARAVAN.egg.tier], picture: () => img(eggIcon(CARAVAN.egg.tier), 'shop-egg'), text: `${t().mart.eggDescription(formatNumber(EGG_TIERS[CARAVAN.egg.tier].steps))} ${c.egg}` }
  if (key === 'goldCap') return { name: CARAVAN.goldCap.name, picture: () => shopIcon('goldBottleCap'), text: c.goldCap.text }
  if (key === 'frame') return { name: t().mart.styles.frame[CARAVAN.frame.id], picture: (big) => stylePicture('frame', CARAVAN.frame.id, big === true), text: c.frame }
  return { name: MOVES[key].name, picture: () => tmPicture(key), text: `${t().moves[key].description} ${c.tm}` }
}

/** What a blocked caravan card says instead of its price. */
const caravanBlockText = (block: CaravanBlock | null) => (block === null || block === 'poor' ? null : t().shop.caravan.blocks[block])

/** Whether a caravan key is one of its TMs. */
const isCaravanTm = (key: CaravanKey): key is Exclude<CaravanKey, 'egg' | 'goldCap' | 'frame'> => key !== 'egg' && key !== 'goldCap' && key !== 'frame'

/**
 * One of Meowth's wares: one of each per weekend, at his prices (less the
 * haggle). The Gold Bottle Cap asks for its Pokémon first (`pickGoldCap`).
 */
const caravanCard = (key: CaravanKey, ctx: ShelfContext): Card => {
  const c = t().shop.caravan
  const item = caravanItem(key)
  const { el, badges, sub, price } = shell(item.picture(), item.name)
  const day = caravanDay()
  const priceText = (save: Save) => {
    const now = caravanPrice(save, key, day)
    return now < listPrice(key) ? [h('s', {}, formatPokeDollars(listPrice(key))), ' ', formatPokeDollars(now)] : [formatPokeDollars(now)]
  }
  /** No Pokémon left for the Gold Bottle Cap: every one the save plays is at the top. */
  const noTarget = (save: Save) => key === 'goldCap' && !(Object.keys(PLAYABLE) as PlayableId[]).some((id) => goldCapFits(save, id))
  return {
    el,
    refresh: (save) => {
      const block = caravanBlock(save, key, day)
      setBadges(badges, [isCaravanTm(key) && badge('exclusive', t().shop.badges.exclusive), haggled(save, day) && block === null && badge('deal', `−${Math.round(CARAVAN.haggle.off * 100)}%`)])
      setText(sub, isCaravanTm(key) ? t().types[MOVES[key].type] : '')
      const blocked = caravanBlockText(block)
      price.replaceChildren(...(blocked ? [blocked] : priceText(save)))
      el.classList.toggle('sold', block === 'soldOut' || block === 'owned' || block === 'full' || noTarget(save))
      el.classList.toggle('poor', block === 'poor')
    },
    describe: (save) => {
      const block = caravanBlock(save, key, day)
      return {
        icon: item.picture(true),
        title: item.name,
        text: [item.text, c.stock, noTarget(save) ? c.goldCap.none : ''].filter((l) => l !== '').join(' '),
        action: caravanBlockText(block) ?? t().mart.buy(formatPokeDollars(caravanPrice(save, key, day))),
        disabled: block !== null || noTarget(save),
      }
    },
    act: (save) => {
      if (key !== 'goldCap') return buyFromCaravan(save, key, day)
      if (caravanBlock(save, key, day) || noTarget(save)) return null
      // The Gold Bottle Cap: pick the Pokémon first; the purchase happens with the pick.
      ctx.pickGoldCap((id) => buyFromCaravan(loadSave(), key, day, id))
      return null
    },
    said: (before, after) => (after.wallet < before.wallet ? 'thanks' : null),
  }
}

/** The haggle: with enough loyalty stamps Meowth takes 20% off the weekend; without, he refuses (with a line, nothing random). */
const haggleCard = (): Card => {
  const c = t().shop.caravan.haggle
  const off = Math.round(CARAVAN.haggle.off * 100)
  const day = caravanDay()
  const { el, badges, sub, price } = shell(shopIcon('stamp'), c.title)
  return {
    el,
    refresh: (save) => {
      const done = haggled(save, day)
      setBadges(badges, [])
      setText(sub, `${Math.min(save.shop.stamps, CARAVAN.haggle.stamps)}/${CARAVAN.haggle.stamps}`)
      setText(price, done ? c.doneAction : `−${off}%`)
      el.classList.toggle('done', done)
    },
    describe: (save) => ({
      icon: shopIcon('stamp'),
      title: c.title,
      text: haggled(save, day) ? c.done(off) : c.text(CARAVAN.haggle.stamps, off),
      action: haggled(save, day) ? c.doneAction : c.action,
      disabled: false,
    }),
    // Haggling again, or without the stamps, keeps the save as it was: Meowth answers either way.
    act: (save) => (haggled(save, day) ? save : haggle(save, day).save),
    said: (before, after) => {
      const m = t().plaza.meowth
      if (haggled(before, day)) return { text: m.haggleAgain, emotion: 'Sigh' }
      return haggled(after, day) ? { text: m.haggleYes(off), emotion: 'Joyous' } : { text: m.haggleNo(CARAVAN.haggle.stamps), emotion: 'Angry' }
    },
  }
}

/* ---------------- Barraca (a seasonal stall: Duskull's Haunted Egg) ---------------- */

/**
 * The odds of an egg only one shelf sells (the Haunted Egg, the Kecleon Egg),
 * for this save, as `hatchEgg` draws them: each family (✓ once hatched) with
 * its share, or the one share when all are alike, then the shiny odds.
 */
const eggOdds = (egg: EggTier, save: Save) => {
  const s = t().shop.stall
  const shares = hatchOdds(egg, save.hatched)
  const family = ([id]: (typeof shares)[number]) => `${HATCHLINGS[id].name}${save.hatched[id] ? ' ✓' : ''}`
  const list = shares.every(([, share]) => share === shares[0]?.[1])
    ? s.even(shares.map(family).join(', '), Math.round((shares[0]?.[1] ?? 0) * 100))
    : shares.map((entry) => `${family(entry)} ${Math.round(entry[1] * 100)}%`).join(', ')
  return s.odds(list, Math.round(1 / EGGS.shinyOdds))
}

/** What a blocked stall card says instead of its price. */
const stallBlockText = (block: StallBlock | null) => (block === null || block === 'poor' ? null : t().shop.stall.blocks[block])

/**
 * One of a stall's goods: an egg only it sells, `perDay` per day, with the
 * odds of each family that can come out (for this save, as `hatchEgg` draws them).
 */
const stallCard = (good: StallGoodId): Card => {
  const s = t().shop.stall
  const { egg, price: cost } = stallGood(good)
  const name = t().eggs.tiers[egg]
  const picture = () => img(eggIcon(egg), 'shop-egg')
  const { el, badges, sub, price } = shell(picture(), name)
  const day = stallDay()
  const odds = (save: Save) => hatchOdds(egg, save.hatched)
  return {
    el,
    refresh: (save) => {
      const block = stallBlock(save, good, day)
      setBadges(badges, [badge('exclusive', t().shop.badges.exclusive)])
      setText(sub, `${odds(save).filter(([id]) => save.hatched[id]).length}/${odds(save).length}`)
      setText(price, stallBlockText(block) ?? formatPokeDollars(cost))
      el.classList.toggle('sold', block === 'soldOut' || block === 'full')
      el.classList.toggle('poor', block === 'poor')
    },
    describe: (save) => {
      return {
        icon: picture(),
        title: name,
        // The odds first: on a phone the strip shows a few lines before it scrolls.
        text: [eggOdds(egg, save), s.egg(formatNumber(EGG_TIERS[egg].steps)), s.duplicate(formatPokeDollars(EGG_TIERS[egg].refund)), s.stock].join(' '),
        action: stallBlockText(stallBlock(save, good, day)) ?? t().mart.buy(formatPokeDollars(cost)),
        disabled: stallBlock(save, good, day) !== null,
      }
    },
    act: (save) => buyFromStall(save, good, day),
    said: (before, after) => (after.wallet < before.wallet ? 'thanks' : null),
  }
}

/** The stall keeper's hello on its shelf: one of Duskull's lines, by the day (the same all day long). */
const stallHello = (): DialogueLine => {
  const lines = t().plaza.duskull.hello
  return { text: lines[dayNumber(stallDay()) % lines.length]!, emotion: 'Happy' }
}

/* ---------------- Fidelidade (the loyalty card) ---------------- */

/** The card itself: the stamps in rows of `LOYALTY.perRow`, up to the next milestone's row (the milestones marked with their number). */
const stampGrid = (save: Save) => {
  const n = save.shop.stamps
  const next = nextMilestone(n)
  const shown = Math.max(LOYALTY.perRow, Math.ceil(Math.max(n, next?.stamps ?? n) / LOYALTY.perRow) * LOYALTY.perRow)
  const marks = new Set<number>(LOYALTY.milestones.map((m) => m.stamps))
  return h(
    'span',
    { class: 'loyalty-grid' },
    ...Array.from({ length: shown }, (_, i) =>
      h('span', { class: `loyalty-cell${i < n ? ' on' : ''}${marks.has(i + 1) ? ' mark' : ''}` }, i < n ? shopIcon('stamp') : marks.has(i + 1) ? String(i + 1) : ''),
    ),
  )
}

/** A milestone's reward as words. */
const rewardName = (m: Milestone) => t().shop.loyalty.rewards[rewardKey(m)]

/** Which kind of reward a milestone brings, for its texts. */
const rewardKey = (m: Milestone) =>
  m.reward === 'statue' ? m.reward : m.reward.kind === 'egg' ? (m.reward.tier === 'kecleonShiny' ? 'kecleonEgg' : 'egg') : m.reward.kind === 'style' ? 'frame' : 'title'

/** The loyalty card as a wide card: the grid of stamps, how many, and what the next milestone brings. */
const loyaltyCard = (): Card => {
  const l = t().shop.loyalty
  const grid = h('span', { class: 'loyalty-card' })
  const { el, sub, price } = shell(grid, l.card)
  el.classList.add('loyalty')
  const nextLine = (save: Save) => {
    const next = nextMilestone(save.shop.stamps)
    return next ? l.next(next.stamps - save.shop.stamps, rewardName(next)) : ''
  }
  return {
    el,
    refresh: (save) => {
      grid.replaceChildren(stampGrid(save))
      setText(sub, nextLine(save))
      setText(price, l.milestone(save.shop.stamps))
    },
    describe: (save) => ({ icon: shopIcon('stamp'), title: l.card, text: [l.cardText(save.shop.stamps), nextLine(save)].filter((x) => x !== '').join(' '), action: l.milestone(save.shop.stamps), disabled: true }),
    act: () => null,
    said: () => null,
  }
}

/** A milestone's picture: its gift's look, or the golden statue. */
const milestonePicture = (m: Milestone): HTMLElement => {
  if (m.reward === 'statue') return shopIcon('expansion')
  if (m.reward.kind === 'egg') return img(eggIcon(m.reward.tier), 'shop-egg')
  if (m.reward.kind === 'style') return img(frameIcon(m.reward.style.id), 'shop-pixel')
  return shopIcon('stamp')
}

/** One milestone of the card: what it brings and where it stands (yours, waiting in the gift box, on the plaza, or ahead). */
const milestoneCard = (m: Milestone): Card => {
  const l = t().shop.loyalty
  const { el, badges, sub, price } = shell(milestonePicture(m), rewardName(m))
  const status = (save: Save) => {
    const state = milestoneState(save, m)
    return state === 'ahead' ? l.states.ahead(m.stamps - save.shop.stamps) : l.states[state]
  }
  return {
    el,
    refresh: (save) => {
      const state = milestoneState(save, m)
      setBadges(badges, [badge(state === 'ahead' ? 'level' : 'owned', l.milestone(m.stamps).toLocaleUpperCase())])
      setText(sub, '')
      setText(price, status(save))
      el.classList.toggle('done', state !== 'ahead')
    },
    describe: (save) => ({
      icon: milestonePicture(m),
      title: `${l.milestone(m.stamps)} · ${rewardName(m)}`,
      text: [l.texts[rewardKey(m)], milestoneState(save, m) === 'waiting' ? l.waiting : ''].filter((x) => x !== '').join(' '),
      action: status(save),
      disabled: true,
    }),
    act: () => null,
    said: () => null,
  }
}

/* ---------------- Shelves ---------------- */

/** "06:41:12": time left until the Vitrine turns over (midnight in Brasília). */
const countdown = () => {
  const s = Math.max(0, Math.ceil(msToNextDay(today()) / 1000))
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, '0')).join(':')
}

/**
 * A shelf: a tab of the panel, tended by a `keeper`, open from some shop
 * level, laid out as a `grid` of cards or a `list` of rows. `stock` fills it
 * (a string is a group heading; `ShelfContext` gives it the panel's state);
 * `intro` is the line over it. The purple brother's shelves (TMs, Evolução)
 * have `keeper: 'purple'`: the camera leans to him and `hello` is what he
 * says when the tab opens. A new shelf is one more entry in `SHELVES`, with
 * its tab's name in `t().shop.tabs`.
 */
type Shelf = {
  id: keyof ReturnType<typeof t>['shop']['tabs']
  keeper: Keeper
  /** Whether its tab shows for the save now (the level's shelves; the caravan only on its weekends). */
  open: (save: Save) => boolean
  layout: 'grid' | 'list'
  stock: (save: Save, ctx: ShelfContext) => readonly (Card | string)[]
  intro: (save: Save) => string
  /** The Vitrine's turnover countdown beside the intro. */
  countdown?: boolean
  /** The Treino's Refund button. */
  refund?: boolean
  hello?: () => DialogueLine
}

/** What a shelf's stock can read and do beyond the save: whose Bottle Caps the Treino shows, opening their picker, and picking the Gold Bottle Cap's Pokémon. */
type ShelfContext = { capsFor: PlayableId; pickCaps: () => void; pickGoldCap: (buy: (id: PlayableId) => Save | null) => void }

/** The Treino: the Bottle Caps of one Pokémon (from the Shop, Lv 3; a locked peek before) and the card to pick another, then the vitamins. */
const trainingStock = (save: Save, ctx: ShelfContext): (Card | string)[] => [
  t().shop.caps.group(PLAYABLE[ctx.capsFor].line[0].name),
  capCard(ctx.capsFor),
  ...(SHOP_LEVELS[save.shop.level].shelves.caps ? [capPickCard(ctx.capsFor, ctx.pickCaps)] : []),
  t().shop.trainingGroup,
  ...UPGRADE_IDS.map(upgradeCard),
]

/** The purple brother's hello on one of his shelves. */
const purpleHello = (text: string): DialogueLine => ({ text, emotion: 'Happy' })

const SHELVES: readonly Shelf[] = [
  {
    id: 'vitrine',
    keeper: 'green',
    open: () => true,
    layout: 'grid',
    stock: (save) => {
      const v = vitrineToday()
      const style = dayStyle(v, save.style)
      return [giftCard(v), kecleonEggCard(v), ...v.cards.map((key, i) => vitrineCard(v, key, i, style))]
    },
    intro: (save) => t().shop.vitrineOf(t().plaza.dayNames[weekdayOf(vitrineToday().day)]!, t().shop.level(t().shop.levels[save.shop.level], save.shop.level)),
    countdown: true,
  },
  {
    id: 'caravan',
    keeper: 'meowth',
    open: caravanOpen,
    layout: 'grid',
    stock: (_, ctx) => [haggleCard(), ...caravanStock(isoWeek(caravanDay())).map((key) => caravanCard(key, ctx))],
    intro: (save) => t().shop.caravan.intro(haggled(save, caravanDay()) ? Math.round(CARAVAN.haggle.off * 100) : null),
    hello: () => meowthHello(),
  },
  {
    id: 'stall',
    keeper: 'stall',
    open: () => stallSelling() !== null,
    layout: 'grid',
    stock: () => {
      const id = stallSelling()
      return id ? stallGoods(id).map(stallCard) : []
    },
    intro: () => t().shop.stall.intro(formatDay(STALLS[stallSelling() ?? 'halloween'].to)),
    hello: () => stallHello(),
  },
  {
    id: 'bag',
    keeper: 'green',
    open: () => true,
    layout: 'grid',
    stock: () => BAG_ITEM_IDS.map(bagCard),
    intro: (save) => t().shop.bag.intro(armedItems(save.bag).length, bagLimit(save)),
  },
  {
    id: 'tms',
    keeper: 'purple',
    open: (save) => SHOP_LEVELS[save.shop.level].shelves.tms,
    layout: 'grid',
    stock: (save) => tmStock(save),
    intro: (save) => t().shop.tms.intro(armedTms(save.tms, tmLimit(save.shop.level)).length, tmLimit(save.shop.level)),
    hello: () => purpleHello(t().plaza.lines.purpleTms),
  },
  {
    id: 'evolution',
    keeper: 'purple',
    open: (save) => SHOP_LEVELS[save.shop.level].shelves.evolution,
    layout: 'grid',
    stock: () => EVO_ITEM_IDS.map(evoCard),
    intro: () => t().shop.evolution.intro,
    hello: () => purpleHello(t().plaza.lines.purpleEvolution),
  },
  { id: 'training', keeper: 'green', open: () => true, layout: 'list', stock: trainingStock, intro: () => t().shop.trainingIntro, refund: true },
  {
    id: 'style',
    keeper: 'green',
    open: () => true,
    layout: 'list',
    stock: () => STYLE_SLOTS.flatMap((slot) => [t().mart.styleSlots[slot], ...styleCards(slot)]),
    intro: () => t().shop.styleIntro,
  },
  {
    id: 'loyalty',
    keeper: 'green',
    open: () => true,
    layout: 'list',
    stock: () => [loyaltyCard(), ...LOYALTY.milestones.map(milestoneCard)],
    intro: (save) => t().shop.loyalty.intro(save.shop.stamps),
  },
  {
    id: 'incubator',
    keeper: 'green',
    open: () => true,
    layout: 'list',
    stock: () => [quickCard(), ...INCUBATOR.slots.map((_, i) => slotCard(i))],
    intro: (save) => t().shop.incubator.intro(incubatorSlots(save), MAX_SLOTS),
  },
  { id: 'expansion', keeper: 'green', open: () => true, layout: 'list', stock: () => SHOP_LEVEL_IDS.map(levelCard), intro: () => t().shop.expansion.intro },
]

/** Meowth's hello at his caravan: one of his lines, by the day (the same all day long). */
const meowthHello = (): DialogueLine => {
  const lines = t().plaza.meowth.hello
  return { text: lines[dayNumber(caravanDay()) % lines.length]!, emotion: 'Happy' }
}

/* ---------------- Arrival ---------------- */

/** The cheapest Vitrine card a save could still buy today (only the wallet in the way), or null. */
const cheapestToday = (save: Save, v: Vitrine) => {
  const prices = vitrineCards(v, save.shop.level).flatMap((key) => {
    const block = vitrineBlock(save, v, key)
    return block === null || block === 'poor' ? [vitrinePrice(v, key, save.style) ?? 0] : []
  })
  return prices.length > 0 ? Math.min(...prices) : null
}

/** What Kecleon knows as the partner walks up: `before` is the save as it was, before this visit counted. */
const visitContext = (before: Save, save: Save, wonLastRun: boolean): VisitContext => {
  const v = vitrineToday()
  const level = save.shop.level
  const next = nextShopLevel(level)
  const wish = save.shop.wishlist
  const form = PLAYABLE[save.partner].line[0]
  return {
    firstEver: before.shop.visit.day === '',
    firstToday: before.shop.visit.day !== save.shop.visit.day,
    streak: save.shop.visit.streak,
    wonLastRun,
    wallet: save.wallet,
    nextLevel: next && SHOP_LEVELS[next].cost,
    cheapest: cheapestToday(save, v),
    giftWaiting: giftBlock(save, v) === null,
    wish: wish && {
      name: vitrineItem(v, wish, dayStyle(v, save.style)).name,
      today: vitrineCards(v, level).includes(wish),
      back: nextAppearance(wish, addDays(v.day, 1), level),
    },
    partner: { name: form.name, shiny: playsShiny(save, save.partner), type: form.types[0] ?? 'normal' },
    roll: Math.random(),
  }
}

/**
 * What Kecleon says first on a visit that stamped the card: a milestone just
 * reached (a gift in the lobby, or the statue), else today's stamp on the first
 * visits; null leaves it to the usual triggers (`pickTrigger`).
 */
const stampLine = (before: Save, save: Save): DialogueLine | null => {
  const reached = reachedNow(before.shop.stamps, save.shop.stamps)
  const l = t().plaza.lines
  const top = reached[reached.length - 1]
  if (top) return top.reward === 'statue' ? { text: l.statue, emotion: 'Joyous' } : isGiftReward(top.reward) ? { text: l.milestone(top.stamps), emotion: 'Joyous' } : null
  // The stamp gets a word while the card is new; past the first milestone, only the milestones do.
  return save.shop.stamps > before.shop.stamps && save.shop.stamps < LOYALTY.milestones[0].stamps ? { text: l.stamp(save.shop.stamps), emotion: 'Happy' } : null
}

/* ---------------- The panel ---------------- */

const isTouch = (e: Event) => e instanceof PointerEvent && e.pointerType !== '' && e.pointerType !== 'mouse'

const DIRECTIONS: Readonly<Record<string, Direction>> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
}

/**
 * Opens the shop over the plaza. Kecleon says its line for this visit (or,
 * camouflaged, waits to be talked to and pops out first); the visit counts
 * toward the regulars' streak. `close` goes back (the lobby pans home).
 * `festival`: while a Festival da Praça runs or is about to
 * (`festivalAnnounced`), a Festival button after the tabs calls it (the
 * lobby swaps the shop for the festival's sheet).
 */
export const shop = (root: HTMLElement, input: Input, opts: { close: () => void; plaza: ShopPlaza; wonLastRun: boolean; shelf?: VisitorShelf; festival?: () => void }): Screen => {
  const sh = t().shop
  const before = loadSave()
  let save: Save = { ...before, shop: recordVisit(before.shop, brasiliaDay(today())) }
  writeSave(save)
  const context = visitContext(before, save, opts.wonLastRun)
  // A talk with Meowth or a stall's keeper opens on its shelf (while it's here), with its hello.
  const first = SHELVES.find((s) => s.id === opts.shelf && s.open(save)) ?? SHELVES[0]!
  const visitor = first.keeper === 'meowth' || first.keeper === 'stall'
  const arrival = (visitor && first.hello?.()) || (stampLine(before, save) ?? visitLine(pickTrigger(context), context))

  const el = h('div', { class: 'shop-layer' })
  root.append(el)
  let talk: Dialogue | null = null
  let panel: ReturnType<typeof openPanel> | null = null
  let closed = false

  const close = () => {
    if (closed) return
    closed = true
    later(opts.close)
  }

  /** The panel and Kecleon's passive box beside it. */
  const start = (line: DialogueLine) => {
    talk?.dispose()
    talk = dialogue(root, input, { speaker: speakerOf(first.keeper), lines: [line], onDone: () => {}, className: 'shop-talk', passive: true })
    panel = openPanel()
  }

  // The camouflage easter egg: an empty counter until it's talked to, then "Surpresa!", then the shop.
  if (visitor) opts.plaza.lookAt(first.keeper)
  if (opts.plaza.hidden() && !visitor) {
    let phase: 'empty' | 'surprise' = 'empty'
    talk = dialogue(root, input, {
      speaker: emptyCounter(),
      lines: [{ text: t().plaza.lines.empty }],
      className: 'shop-talk',
      onDone: () =>
        later(() => {
          if (closed) return
          if (phase === 'surprise') return start(arrival)
          phase = 'surprise'
          opts.plaza.reveal()
          talk?.say([{ text: t().plaza.lines.surprise, emotion: 'Joyous' }], kecleonSpeaker())
        }),
    })
  } else start(arrival)

  function openPanel() {
    let shelf: Shelf = first
    let cards: Card[] = []
    /** The card the strip describes, and the element the arrows are on (a tab, a card or a button). */
    let chosen = 0
    let focused: HTMLElement | null = null
    let confirm: Screen | null = null
    let purchases = 0
    /** Whose Bottle Caps the Treino shows: the partner, until another is picked. */
    let capsFor: PlayableId = save.partner

    const wallet = h('span')
    const tabs = SHELVES.map((s) => h('button', { class: 'shop-tab', type: 'button', role: 'tab' }, sh.tabs[s.id]))
    const announced = opts.festival ? festivalAnnounced(festivalDay()) : null
    const festivalTab = h('button', { class: 'shop-tab festival-tab', type: 'button' }, img(festivalIcon(announced?.id ?? 'lanternas')), t().festival.shopButton)
    festivalTab.hidden = !announced
    const intro = h('span', { class: 'shop-intro' })
    const clock = h('span', { class: 'shop-clock' })
    const items = h('div', { class: 'shop-items', role: 'list' })
    const descIcon = h('div', { class: 'shop-desc-icon' })
    const descTitle = h('div', { class: 'shop-desc-title' })
    const descText = h('p', { class: 'shop-desc-text' })
    const buy = h('button', { class: 'btn shop-buy', type: 'button' })
    const wishLabel = h('span', {})
    const wishBtn = h('button', { class: 'btn shop-wish', type: 'button' }, shopIcon('wishlist'), wishLabel)
    const back = h('button', { class: 'btn shop-back', type: 'button', 'aria-label': t().mart.back }, '◀', h('span', { class: 'shop-back-label' }, ` ${t().mart.back}`))
    const refund = h('button', { class: 'btn shop-refund', type: 'button' }, t().mart.refund)

    const sheet = h(
      'section',
      { class: 'shop-sheet box', 'aria-label': sh.title },
      h('header', { class: 'shop-head' }, back, h('h2', { class: 'shop-title' }, sh.title), h('span', { class: 'shop-wallet' }, img(coinIcon(0)), wallet)),
      h('nav', { class: 'shop-tabs', role: 'tablist' }, ...tabs, festivalTab),
      h('div', { class: 'shop-intro-row' }, intro, clock),
      items,
      h('div', { class: 'shop-desc' }, descIcon, h('div', { class: 'shop-desc-body' }, descTitle, descText), h('div', { class: 'shop-desc-buttons' }, wishBtn, buy)),
      h('footer', { class: 'shop-foot' }, refund, hint(sh.hint, sh.hintTouch)),
    )
    el.append(sheet)

    const openShelves = () => SHELVES.filter((s) => s.open(save))
    const wishable = (card: Card | undefined) => card?.wish !== undefined && SHOP_LEVELS[save.shop.level].wishlist
    /** Everything the arrows reach, in the layout's order. */
    const navs = () => [...tabs.filter((tab) => !tab.hidden), ...(festivalTab.hidden ? [] : [festivalTab]), ...cards.map((c) => c.el), ...(wishable(cards[chosen]) ? [wishBtn] : []), buy, back, ...(shelf.refund ? [refund] : [])]

    const refresh = () => {
      setText(wallet, formatPokeDollars(save.wallet))
      setText(intro, shelf.intro(save))
      setText(clock, shelf.countdown ? sh.turnsIn(countdown()) : '')
      for (const c of cards) c.refresh(save)
      cards.forEach((c, i) => c.el.classList.toggle('chosen', i === chosen))
      for (const n of [...tabs, festivalTab, ...cards.map((c) => c.el), wishBtn, buy, back, refund]) n.classList.toggle('selected', n === focused)
      const card = cards[chosen]
      if (card) {
        const d = card.describe(save)
        descIcon.replaceChildren(d.icon)
        descIcon.classList.toggle('wide', d.icon instanceof HTMLCanvasElement)
        setText(descTitle, d.title)
        setText(descText, d.text)
        setText(buy, d.action)
        buy.toggleAttribute('disabled', d.disabled)
      }
      wishBtn.classList.toggle('hidden', !wishable(card))
      if (card?.wish !== undefined) {
        const pinned = save.shop.wishlist === card.wish
        wishBtn.classList.toggle('on', pinned)
        setText(wishLabel, pinned ? sh.wish.unpin : sh.wish.pin)
      }
      refund.classList.toggle('hidden', !shelf.refund)
    }

    /** Fills the shelf: its cards (and headings), wired for the pointer. */
    const build = () => {
      tabs.forEach((tab, i) => {
        const s = SHELVES[i]!
        tab.hidden = !s.open(save)
        tab.classList.toggle('on', s === shelf)
        tab.setAttribute('aria-selected', String(s === shelf))
      })
      items.className = `shop-items ${shelf.layout}`
      const stock = shelf.stock(save, { capsFor, pickCaps, pickGoldCap })
      cards = stock.filter((c): c is Card => typeof c !== 'string')
      items.replaceChildren(...stock.map((c) => (typeof c === 'string' ? h('div', { class: 'shop-group' }, c) : c.el)))
      cards.forEach((c, i) => wire(c.el, i))
      chosen = Math.min(chosen, Math.max(0, cards.length - 1))
      items.scrollTop = 0
    }

    const switchShelf = (next: Shelf, sound = true) => {
      if (next === shelf) return
      const from = shelf.keeper
      shelf = next
      chosen = 0
      if (sound) playSfx('move')
      build()
      focused = cards[0]?.el ?? null
      opts.plaza.lookAt(shelf.keeper)
      // Each of the purple brother's shelves gets its own hello, even coming from the other one; the green one takes the counter back.
      const back: DialogueLine | null = from !== 'green' && shelf.keeper === 'green' ? { text: t().plaza.lines.greenBack, emotion: 'Happy' } : null
      const hello = shelf.hello?.() ?? back
      if (hello) talk?.say([hello], speakerOf(shelf.keeper))
      refresh()
    }

    /**
     * The Gold Bottle Cap's picker: the Pokémon the save plays below the top
     * level. A pick buys it (`buy` from the stored save) and Meowth thanks you.
     */
    function pickGoldCap(buy: (id: PlayableId) => Save | null) {
      if (confirm) return
      later(() => {
        const at = loadSave()
        confirm = capsPicker(
          root,
          input,
          at,
          goldCapFits(at, save.partner) ? save.partner : ((Object.keys(PLAYABLE) as PlayableId[]).find((id) => goldCapFits(at, id)) ?? save.partner),
          (id) => {
            confirm?.dispose()
            confirm = null
            const next = id && buy(id)
            if (next) {
              save = next
              writeSave(save)
              playSfx('buy')
              talk?.say([thanksFrom(shelf.keeper, purchases++)], speakerOf(shelf.keeper))
            }
            refresh()
          },
          { title: t().shop.caravan.goldCap.pickTitle, fits: (id) => goldCapFits(at, id) },
        )
      })
    }

    /** Opens the Bottle Caps' picker; a pick rebuilds the Treino on that Pokémon. */
    function pickCaps() {
      if (confirm) return
      later(() => {
        confirm = capsPicker(root, input, save, capsFor, (id) => {
          confirm?.dispose()
          confirm = null
          if (id) {
            capsFor = id
            playSfx('select')
            build()
            // The Bottle Cap card comes first.
            chosen = 0
            focused = cards[chosen]?.el ?? null
          }
          refresh()
        })
      })
    }

    const stepShelf = (by: number) => {
      const open = openShelves()
      switchShelf(open[(open.indexOf(shelf) + by + open.length) % open.length]!)
    }

    const focus = (node: HTMLElement, sound = true) => {
      if (node === focused) return
      focused = node
      const i = cards.findIndex((c) => c.el === node)
      if (i >= 0) chosen = i
      if (sound) playSfx('move')
      refresh()
      node.scrollIntoView({ block: 'nearest' })
    }

    const move = (dir: Direction) => {
      const list = navs()
      const at = list.findIndex((n) => n === focused)
      const next = list[nearestInDirection(list.map((n) => n.getBoundingClientRect()), Math.max(0, at), dir)]
      if (next) focus(next)
    }

    /** Acts on the chosen card. Purchases start from the stored save: an account sync may have changed it while the shop was open. */
    const act = () => {
      const card = cards[chosen]
      if (!card || confirm) return
      const question = card.confirm?.(loadSave())
      if (question) {
        later(() => {
          confirm = confirmDialog(
            root,
            input,
            question,
            (yes) => {
              confirm?.dispose()
              confirm = null
              if (yes) commit(card)
            },
            { class: 'shop-confirm' },
          )
        })
        return
      }
      commit(card)
    }

    const commit = (card: Card) => {
      const was = loadSave()
      const next = card.act(was)
      if (!next) return playSfx('denied')
      save = next
      writeSave(save)
      const said = card.said ? card.said(was, next) : 'thanks'
      const line = said === 'thanks' ? thanksFrom(shelf.keeper, purchases++) : said
      if (next.shop.level !== was.shop.level) {
        playSfx('evolve')
        opts.plaza.grew(next.shop.level)
        // A bigger shop shows more of the Vitrine and packs more: every shelf redraws.
        build()
      } else playSfx(line ? 'buy' : 'select')
      if (line) talk?.say([line], speakerOf(shelf.keeper))
      refresh()
    }

    /** The Festival button: the lobby swaps the shop for the festival's sheet. */
    function openFestival() {
      if (closed || !opts.festival) return
      closed = true
      playSfx('select')
      later(opts.festival)
    }

    const toggleWish = () => {
      const card = cards[chosen]
      if (!wishable(card) || card?.wish === undefined) return playSfx('denied')
      const next = setWish(loadSave(), save.shop.wishlist === card.wish ? null : card.wish)
      if (!next) return playSfx('denied')
      save = next
      writeSave(save)
      playSfx(next.shop.wishlist ? 'shiny' : 'move')
      const key = next.shop.wishlist
      const name = key === null ? '' : key === 'egg' || key === 'style' ? (card?.describe(save).title ?? '') : BAG_ITEMS[key].name
      if (key) talk?.say([{ text: t().plaza.lines.pinned(name, whenBack(key, vitrineToday().day, save.shop.level)), emotion: 'Happy' }], kecleonSpeaker())
      refresh()
    }

    const askRefund = () => {
      if (totalSpent(save.ranks) === 0 || confirm) return playSfx('denied')
      later(() => {
        confirm = confirmDialog(
          root,
          input,
          t().mart.refundConfirm(formatPokeDollars(totalSpent(save.ranks))),
          (yes) => {
            confirm?.dispose()
            confirm = null
            if (!yes) return
            save = refundAll(loadSave())
            writeSave(save)
            playSfx('buy')
            refresh()
          },
          { class: 'shop-confirm' },
        )
      })
    }

    /** Enter (A on a pad) on whatever the arrows are on. */
    const press = () => {
      if (!focused) return act()
      const tab = tabs.findIndex((b) => b === focused)
      if (tab >= 0) return switchShelf(SHELVES[tab]!)
      if (focused === back) return close()
      if (focused === festivalTab) return openFestival()
      if (focused === refund) return askRefund()
      if (focused === wishBtn) return toggleWish()
      act()
    }

    /** Hover chooses; a click acts, but on touch the first tap only chooses, so browsing never spends by accident. */
    function wire(node: HTMLElement, i: number) {
      node.addEventListener('pointerenter', (e) => !isTouch(e) && focus(node, true))
      node.addEventListener('click', (e) => {
        if (confirm) return
        if (isTouch(e) && i !== chosen) return focus(node)
        focus(node, false)
        act()
      })
    }
    tabs.forEach((tab, i) => tab.addEventListener('click', () => !confirm && switchShelf(SHELVES[i]!)))
    festivalTab.addEventListener('click', () => !confirm && openFestival())
    festivalTab.addEventListener('pointerenter', (e) => !isTouch(e) && focus(festivalTab, false))
    buy.addEventListener('click', () => !confirm && act())
    wishBtn.addEventListener('click', () => !confirm && toggleWish())
    back.addEventListener('click', () => !confirm && close())
    refund.addEventListener('click', () => askRefund())

    const off = input.onKey((key) => {
      if (confirm || closed) return
      const dir = DIRECTIONS[key]
      if (dir) move(dir)
      else if (key === 'KeyQ' || key === 'PageUp') stepShelf(-1)
      else if (key === 'KeyE' || key === 'PageDown') stepShelf(1)
      else if (key === 'KeyF') toggleWish()
      else if (key === 'Enter' || key === 'Space') press()
      else if (key === 'Escape' || key === 'Backspace') close()
    })

    build()
    focused = cards[0]?.el ?? null
    refresh()

    let shownSecond = -1
    let day = vitrineToday().day
    return {
      // The Vitrine's countdown, and a fresh Vitrine once the day turns over.
      tick: () => {
        const second = Math.floor(Date.now() / 1000)
        if (second === shownSecond) return
        shownSecond = second
        if (vitrineToday().day !== day) {
          day = vitrineToday().day
          build()
          refresh()
        } else if (shelf.countdown) setText(clock, sh.turnsIn(countdown()))
      },
      dispose: () => (off(), confirm?.dispose()),
    }
  }

  return {
    el,
    tick: (time) => {
      talk?.tick?.(time)
      panel?.tick()
    },
    dispose: () => {
      closed = true
      panel?.dispose()
      talk?.dispose()
      el.remove()
    },
  }
}
