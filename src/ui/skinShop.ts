import { equip, rarityOf, shownOn, skinsOf, stageName, takeOff, wearing } from '../arena/gemShop'
import { cosmeticPrice, type Look } from '../data/cosmetics'
import { bundleOf, lineOf, SKIN_BUNDLE_IDS, SKIN_LAUNCH, SKIN_LINES, SKINS, type SkinBundleId, type SkinId, type SkinLine } from '../data/skinCatalog'
import { playSfx } from '../engine/audio'
import { context2d } from '../engine/pixelart'
import { brasiliaDay, type DayKey } from '../game/day'
import { bundleLastDay, bundleMissing, bundleOnSale, bundlePrice } from '../game/gems'
import { buyBundle, buyCosmetic, fetchGems, gemsEnabled, gemsFaked, gemsSignedIn, knownGems, onGems, ownedSet, saveLook } from '../gems'
import { formatNumber, t } from '../i18n'
import { drawPokemon, fitSprites, portraitUrl, skinSprites } from '../render/sprites'
import { h, later } from './dom'
import { gemAmount, itemName, lookStage, present, RARITY_COLORS, signInCard, tag, type GemTab, type GemTabsContext, type Wearer } from './gemShop'
import { today } from './save'
import { confirmDialog, type Screen } from './screens'

/**
 * The Boutique's Skins page (`ui/boutique.ts`): the skins (`data/skinCatalog.ts`)
 * by line, picked from a row of the lines' portraits (the one the previews'
 * wearer belongs to first). Each card walks the skin on every stage it
 * covers; choosing one dresses the big stage (`lookStage`, the Loja's: the
 * wearer when the skin covers it, else the line's last stage, in the look
 * worn), where it's bought or worn. A Normal/Shiny switch colors both. A
 * seasonal line shows its Coleção das Estações beside its seasons, and while
 * they last the seasons' launch offers lead the page, each at what it costs
 * this account now (`bundlePrice`). Before `SKIN_LAUNCH` everything shows,
 * tagged with the day it goes on sale.
 */

/** The cards' preview: px, drawn at 2× by CSS. */
const CARD = { w: 120, h: 56 } as const

/** A day as the buyer's language writes it, short (`19/11`). */
const dayText = (day: DayKey) => new Date(`${day}T12:00:00Z`).toLocaleDateString(tag(), { day: '2-digit', month: '2-digit', timeZone: 'UTC' })

/** What a skin dresses, as the card says it: its stages' names. */
const coversText = (id: SkinId) => {
  const names = SKINS[id].dexes.map((dex) => stageName(lineOf(id), dex))
  return t().gems.skinShop.covers(new Intl.ListFormat(tag(), { type: 'conjunction' }).format(names))
}

const bundleName = (id: SkinBundleId) => {
  const m = t().gems.skinShop
  const b = bundleOf(id)
  if (b.line) return m.bundle(stageName(b.line, SKINS[b.items[0]!].dexes[0]!))
  return m.offer(b.season ? m.seasons[b.season] : id)
}

/** The line's bundle (its Coleção das Estações), if it has one. */
const lineBundle = (line: SkinLine) => SKIN_BUNDLE_IDS.find((id) => bundleOf(id).line === line) ?? null

/** Draws a card's skin walking on each stage it covers, side by side, each shrunk to its cell. */
const drawCard = (canvas: HTMLCanvasElement, id: SkinId, seconds: number, shiny: boolean) => {
  const ctx = context2d(canvas)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const dexes = SKINS[id].dexes
  const cell = CARD.w / dexes.length
  dexes.forEach((dex, i) => {
    const s = skinSprites(id, dex, shiny)
    if (!s) return
    const fit = fitSprites(s, Math.min(cell - 4, (s.bodyW * (CARD.h - 10)) / s.bodyH))
    drawPokemon(ctx, fit, 'Walk', 0, seconds + i * 0.21, Math.round(cell * (i + 0.5)), CARD.h - 5)
  })
}

export const skinsTab = (ctx: GemTabsContext): GemTab => {
  let status = knownGems()
  let shiny = false
  let chosen: SkinId | null = null
  let note: { text: string; bad: boolean } | null = null
  let dialog: Screen | null = null
  let buying = false
  // The line the previews' wearer belongs to, else the first.
  let line: SkinLine = SKIN_LINES.find((l) => skinsOf(l).some((id) => (SKINS[id].dexes as readonly number[]).includes(ctx.wearer().dex))) ?? SKIN_LINES[0]!
  const cards = new Map<HTMLCanvasElement, SkinId>()
  let raf = 0

  const day = () => brasiliaDay(today())
  const owned = () => ownedSet(status)
  const worn = (): Look => status?.look ?? {}
  const signedIn = () => gemsSignedIn() && (gemsEnabled || gemsFaked())
  const onSaleNow = (id: SkinId) => shownOn(id, day(), new Set()) && cosmeticPrice(id) !== null

  /** Who the stage dresses: the wearer when the chosen skin covers it, else the skin's last stage. */
  const stageWearer = (): Wearer => {
    const base = ctx.wearer()
    if (!chosen || (SKINS[chosen].dexes as readonly number[]).includes(base.dex)) return base
    const dex = SKINS[chosen].dexes[SKINS[chosen].dexes.length - 1]!
    return { dex, name: stageName(lineOf(chosen), dex) }
  }
  const stage = lookStage(stageWearer, worn, () => chosen, '', () => shiny)
  const el = h('div', { class: 'gem-shop gem-skins' })

  const say = (text: string, bad = false) => {
    note = { text, bad }
    paint()
  }

  const short = (price: number) => {
    playSfx('denied')
    say(t().gems.shop.short(formatNumber(price - (status?.balance ?? 0))), true)
  }

  /** Asks before spending, then `buy`s; its answer as the Loja says it. */
  const confirm = (text: string, price: number, buy: () => Promise<void>) => {
    if ((status?.balance ?? 0) < price) return short(price)
    playSfx('select')
    later(() => {
      dialog = confirmDialog(
        ctx.root,
        ctx.input,
        text,
        (yes) => {
          dialog?.dispose()
          dialog = null
          if (!yes) return
          buying = true
          paint()
          void buy().finally(() => {
            buying = false
            paint()
          })
        },
        { class: 'shop-confirm gem-confirm', yes: t().gems.shop.buy },
      )
    })
  }

  const failed = (why: 'gems' | 'owned' | 'unsold' | 'busy' | 'banned' | 'offline', price: number, done: string) => {
    const m = t().gems.shop
    playSfx('denied')
    if (why === 'gems') {
      void fetchGems()
      return say(m.short(formatNumber(Math.max(1, price - (status?.balance ?? 0)))), true)
    }
    say(why === 'owned' ? done : { unsold: m.unsold, busy: m.busy, banned: m.banned, offline: m.offline }[why], why !== 'owned')
  }

  const buySkin = (id: SkinId) => {
    const price = cosmeticPrice(id) ?? 0
    const m = t().gems.shop
    confirm(m.confirm(itemName(id), formatNumber(price)), price, async () => {
      const res = await buyCosmetic(id)
      if (!res.ok) return failed(res.why, price, m.bought(itemName(id)))
      playSfx('buy')
      await saveLook(equip(res.status.look, id))
      say(m.bought(itemName(id)))
    })
  }

  const buyPack = (id: SkinBundleId) => {
    const m = t().gems.skinShop
    const price = bundlePrice(id, owned())
    const missing = bundleMissing(id, owned())
    if (price === null) return
    confirm(m.confirmBundle(bundleName(id), missing.length, formatNumber(price)), price, async () => {
      const res = await buyBundle(id)
      if (!res.ok) return failed(res.why, price, m.boughtBundle(bundleName(id)))
      playSfx('buy')
      // A line's collection puts its first new season on, when the line wore none.
      const first = missing[0]
      const b = bundleOf(id)
      if (b.line && first && !res.status.look.skins?.some((s) => lineOf(s) === b.line)) await saveLook(equip(res.status.look, first))
      say(m.boughtBundle(bundleName(id)))
    })
  }

  /** The chosen skin's button: sign in, buy it, wear it or take it off (or, before launch, the day it goes on sale). */
  const act = (id: SkinId) => {
    const m = t().gems.shop
    if (!signedIn()) {
      const signIn = ctx.signIn
      return signIn ? h('button', { class: 'btn confirm gem-act', type: 'button', onclick: () => (playSfx('select'), later(signIn)) }, m.signIn.button) : null
    }
    if (owned().has(id)) {
      const on = wearing(worn(), id)
      return h(
        'button',
        { class: `btn gem-act${on ? '' : ' confirm'}`, type: 'button', onclick: () => (playSfx('select'), void saveLook(on ? takeOff(worn(), id) : equip(worn(), id))) },
        on ? m.unequip : m.equip,
      )
    }
    const price = cosmeticPrice(id)
    if (!onSaleNow(id) || price === null) return h('button', { class: 'btn gem-act', type: 'button', disabled: true }, day() < SKIN_LAUNCH ? t().gems.skinShop.soon(dayText(SKIN_LAUNCH)) : m.unsold)
    return h('button', { class: 'btn confirm gem-act', type: 'button', disabled: buying, onclick: () => buySkin(id) }, m.buy, ' ', gemAmount(price))
  }

  const info = () => {
    const m = t().gems
    if (!chosen) return h('p', { class: 'gem-info-hint' }, m.skinShop.pitch)
    const id = chosen
    return h(
      'div',
      { class: 'gem-info', style: `--rarity:${RARITY_COLORS[rarityOf(id)]}` },
      h('b', { class: 'gem-info-name' }, itemName(id)),
      h('small', { class: 'gem-info-kind' }, `${m.rarities[rarityOf(id)]} · ${m.slots.skin}`),
      h('small', {}, coversText(id)),
      h('small', {}, m.skinShop.forms),
      act(id),
    )
  }

  const card = (id: SkinId) => {
    const m = t().gems.shop
    const mine = owned().has(id)
    const on = wearing(worn(), id)
    const price = cosmeticPrice(id)
    const canvas = h('canvas', { class: 'gem-skin-canvas', width: CARD.w, height: CARD.h })
    cards.set(canvas, id)
    const tagText = on ? m.equipped : mine ? m.owned : !onSaleNow(id) ? t().gems.skinShop.soon(dayText(SKIN_LAUNCH)) : price === null ? m.unsold : gemAmount(price)
    return h(
      'button',
      {
        class: `gem-item gem-skin ${rarityOf(id)}${chosen === id ? ' chosen' : ''}${mine ? ' owned' : ''}`,
        type: 'button',
        style: `--rarity:${RARITY_COLORS[rarityOf(id)]}`,
        'aria-pressed': String(chosen === id),
        onclick: () => {
          playSfx('move')
          chosen = chosen === id ? null : id
          note = null
          paint()
        },
      },
      h('span', { class: 'gem-skin-art' }, canvas),
      h('b', { class: 'gem-item-name' }, itemName(id)),
      h('small', { class: 'gem-skin-covers' }, coversText(id)),
      h('small', { class: 'gem-item-tag' }, tagText),
    )
  }

  /** A bundle: what it brings, its price now (the full one struck when owned skins take some off), and its buy button. */
  const bundleCard = (id: SkinBundleId) => {
    const m = t().gems.skinShop
    const b = bundleOf(id)
    const price = bundlePrice(id, owned())
    const missing = bundleMissing(id, owned())
    const singles = missing.reduce((n, i) => n + (cosmeticPrice(i) ?? 0), 0)
    const last = bundleLastDay(id)
    const noteText = last ? m.offerNote(b.items.length, dayText(last)) : m.bundleNote(b.items.length)
    const button = () => {
      if (price === null) return h('span', { class: 'gem-bundle-done' }, m.complete)
      if (!signedIn()) {
        const signIn = ctx.signIn
        return signIn ? h('button', { class: 'btn confirm small', type: 'button', onclick: () => (playSfx('select'), later(signIn)) }, t().gems.shop.signIn.button) : null
      }
      if (!bundleOnSale(id, day())) return h('button', { class: 'btn small', type: 'button', disabled: true }, m.soon(dayText(SKIN_LAUNCH)))
      return h('button', { class: 'btn confirm small', type: 'button', disabled: buying, onclick: () => buyPack(id) }, t().gems.shop.buy)
    }
    return h(
      'div',
      { class: `gem-bundle${price === null ? ' done' : ''}${last ? ' offer' : ''}` },
      h('span', { class: 'gem-bundle-art' }, ...b.items.slice(0, 3).map((i) => h('img', { src: portraitUrl(SKINS[i].dexes[0]!), alt: '' }))),
      h(
        'div',
        { class: 'gem-bundle-text' },
        h('b', {}, bundleName(id)),
        h('small', {}, noteText),
        ...(price !== null
          ? [
              h('span', { class: 'gem-bundle-price' }, price < b.price ? h('s', {}, formatNumber(b.price)) : null, gemAmount(price)),
              h('small', { class: 'gem-bundle-save' }, price < b.price ? m.less(formatNumber(b.price - price)) : m.saves(formatNumber(singles - price))),
            ]
          : []),
      ),
      button(),
    )
  }

  const draw = (ms: number) => {
    raf = el.isConnected ? requestAnimationFrame(draw) : 0
    for (const [canvas, id] of cards) if (canvas.isConnected) drawCard(canvas, id, ms / 1000, shiny)
  }

  const paint = () => {
    const m = t().gems
    const now = day()
    cards.clear()
    const lineSkins = skinsOf(line).filter((id) => shownOn(id, now, owned()) || now < SKIN_LAUNCH)
    const offers = SKIN_BUNDLE_IDS.filter((id) => bundleOf(id).days !== undefined && bundleOnSale(id, now) && bundlePrice(id, owned()) !== null)
    const bundle = lineBundle(line)
    const seg = (value: boolean) =>
      h(
        'button',
        { class: `shell-seg-option${shiny === value ? ' on' : ''}`, type: 'button', 'aria-pressed': String(shiny === value), onclick: () => shiny !== value && (playSfx('move'), (shiny = value), paint()) },
        value ? m.skinShop.shiny : m.skinShop.normal,
      )
    const lineChip = (l: SkinLine) => {
      const first = skinsOf(l)[0]!
      const dex = SKINS[first].dexes[0]!
      return h(
        'button',
        { class: `gem-filter gem-line${line === l ? ' on' : ''}`, type: 'button', 'aria-pressed': String(line === l), onclick: () => line !== l && (playSfx('move'), (line = l), (chosen = null), (note = null), paint()) },
        h('img', { class: 'gem-line-face', src: portraitUrl(dex), alt: '' }),
        stageName(l, dex),
        skinsOf(l).some((id) => wearing(worn(), id)) ? h('em', { class: 'gem-line-on', 'aria-hidden': 'true' }, '●') : null,
      )
    }
    const scroll = el.parentElement?.scrollTop ?? 0
    el.replaceChildren(
      ...present(
        signedIn() ? null : signInCard(ctx),
        offers.length > 0 ? h('section', { class: 'gem-offers' }, h('span', { class: 'field-label' }, m.skinShop.offers), h('div', { class: 'gem-bundles' }, ...offers.map(bundleCard))) : null,
        h(
          'section',
          { class: 'gem-catalog' },
          h('div', { class: 'gem-section-head' }, h('span', { class: 'field-label' }, m.skinShop.lines), h('div', { class: 'shell-seg gem-currency', role: 'group' }, seg(false), seg(true))),
          h(
            'div',
            { class: 'gem-catalog-main' },
            h('div', { class: 'gem-try' }, stage.el, info(), note ? h('p', { class: `gem-note${note.bad ? ' bad' : ''}`, role: 'status' }, note.text) : null),
            h(
              'div',
              { class: 'gem-browse' },
              h('div', { class: 'gem-filters gem-lines' }, ...SKIN_LINES.map(lineChip)),
              h('div', { class: 'gem-items gem-skin-grid' }, ...lineSkins.map(card)),
              bundle ? h('div', { class: 'gem-bundles' }, bundleCard(bundle)) : null,
            ),
          ),
        ),
      ),
    )
    if (el.parentElement) el.parentElement.scrollTop = scroll
    stage.start()
    if (raf === 0) raf = requestAnimationFrame(draw)
  }

  const off = onGems((s) => {
    status = s
    if (el.isConnected) paint()
  })

  return {
    el,
    dispose: () => (off(), stage.dispose(), cancelAnimationFrame(raf), dialog?.dispose()),
    enter: () => {
      paint()
      if (signedIn()) void fetchGems()
    },
    busy: () => dialog !== null,
  }
}
