import { currencyFor, equip, methodsFor, priceText, rarityOf, shopCatalog, unequip } from '../arena/gemShop'
import { COSMETIC_SLOTS, WEARABLE_SLOTS, cosmeticPrice, slotOf, type Look, type CosmeticId, type CosmeticSlot, type WearableSlot } from '../data/cosmetics'
import { GEM_PACK_IDS, GEM_PACKS, packGems, type GemCurrency, type GemMethod, type GemPackId } from '../data/gems'
import { effectIn } from '../data/arenaEffects'
import { VERSUS, VERSUS_PICKS, type VersusPick } from '../data/versus'
import { isWearableId } from '../data/wearables'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import type { Dir8 } from '../engine/math'
import { blitPacked, context2d, textSprite } from '../engine/pixelart'
import { brasiliaDay } from '../game/day'
import { awaitCheckout, buyCosmetic, fetchGems, fetchReceipts, gemsEnabled, gemsFaked, gemsSignedIn, knownGems, onGems, openCheckout, ownedSet, saveLook } from '../gems'
import type { GemLedgerEntry, GemsStatus } from '../game/gems'
import { formatNumber, locale, LOCALES, t } from '../i18n'
import { createFxPreview } from '../render/arenaFx'
import { drawPlateBar, drawPlateTag } from '../render/arenaPlates'
import { gemIconUrl, slotIconUrl } from '../render/gemArt'
import { drawPokemon, loadSpecies, portraitUrl, type Dex, type SpeciesSprites } from '../render/sprites'
import { versusTag } from '../render/team'
import { TEAM_COLORS, TEAM_LIGHT } from '../render/vale'
import { drawWearables, fitsWearer, loadWearables, wearableIcon } from '../render/wearables'
import { firstForm } from './arena'
import { titleChip } from './arenaTitle'
import { h, later } from './dom'
import { today } from './save'
import { confirmDialog, type Screen } from './screens'

/**
 * The gem shop's two pages, which Leavanny's Boutique on the plaza holds
 * (`ui/boutique.ts`) and the Arena hub's Visual tab shows too
 * (`ui/arenaHub.ts`): Loja (the balance, the gem packs in the buyer's
 * currency, the catalog by slot, a live preview of the `wearer` trying an
 * item on, buying with a confirm, the receipts) and Visual (the look by slot,
 * a big preview walking and turning through its 8 directions, any roster
 * Pokémon wearing it), plus the gem chip the Arena screen, the hub's title
 * and the Boutique's sheet show. A pack opens its checkout in a sheet (card,
 * and Pix in reais) and leaves for it; back on `?gems=`, the Loja opens on
 * the return sheet, which waits for the gems (`awaitCheckout`). Guests
 * browse and try things on; anything that needs the account leads to sign
 * in. The API lives in `gems.ts`, the rules in `arena/gemShop.ts`.
 */

/** A rarity's color: the item cards' background, the names' tint. */
const RARITY_COLORS = { common: '#6a7890', rare: '#3878d0', epic: '#9048c8', legendary: '#d89020' } as const

/** Seconds a preview faces each direction while it turns. */
const TURN = 0.9

/** The preview's turn: clockwise on screen, from facing the camera. */
const TURN_ORDER: readonly Dir8[] = [0, 7, 6, 5, 4, 3, 2, 1]

const isWearable = (slot: CosmeticSlot): slot is WearableSlot => (WEARABLE_SLOTS as readonly CosmeticSlot[]).includes(slot)

const tag = () => LOCALES[locale()].tag

/** Children with the absent ones (null) left out, for `append` and `replaceChildren`. */
const present = (...nodes: (Node | null)[]) => nodes.filter((n): n is Node => n !== null)

/** Who the previews dress: a species (by dex) and its name, for the plate and the misfit flags. */
export type Wearer = { dex: Dex; name: string }

/** A roster pick's first form as a wearer. */
export const pickWearer = (id: VersusPick): Wearer => ({ dex: firstForm(id).dex, name: firstForm(id).name })

/** Whether a wearable sits right on the species `dex` (`data/wearFits.ts`); the shop flags the ones that don't. Effects fit everyone. */
const fits = (id: CosmeticId, dex: Dex) => !isWearableId(id) || fitsWearer(dex, id)

/** Wearables' icons as image URLs, made once each from their models (`wearableIcon`) once the engine is in. */
const icons = new Map<CosmeticId, string>()

/** A card's art: the wearable itself, a follower's portrait, or its slot's icon (another effect, or a wearable while the engine loads). */
const iconUrl = (id: CosmeticId) => {
  const made = icons.get(id)
  if (made) return made
  const follower = effectIn('follower', id)
  if (follower) return portraitUrl(follower.dex)
  const icon = isWearableId(id) ? wearableIcon(id) : null
  if (!icon) return slotIconUrl(slotOf(id))
  const url = icon.toDataURL()
  icons.set(id, url)
  return url
}

const itemName = (id: CosmeticId) => {
  const names: Record<string, string> = { ...t().wearables, ...t().arenaEffects }
  return names[id] ?? id
}

/** "1.250" with the gem beside it. */
const gemAmount = (n: number, cls = '') => h('span', { class: `gem-amount ${cls}` }, h('img', { class: 'gem-icon', src: gemIconUrl(), alt: '' }), formatNumber(n))

/* ---------------- The preview ---------------- */

/** How the stage walks: px/s, how long it walks before an equipped emote plays (which lasts as in a match), and how often a spawn, KO or goal effect replays. */
const STAGE = { speed: 60, walk: 4.2, emote: VERSUS.emote.keep, burst: 2.4 } as const

/** A step of length 1 facing `dir` (`Dir8`: 0 south, 2 east), on screen. */
const heading = (dir: Dir8) => {
  const a = ((2 - dir) * Math.PI) / 4
  return { x: Math.cos(a), y: Math.sin(a) }
}

const BURST_SLOTS = ['spawn', 'ko', 'goal'] as const satisfies readonly CosmeticSlot[]

/**
 * A Pokémon on a little stage wearing `look()`, with its effects
 * (`createFxPreview`): it walks, turning through its 8 directions with the
 * camera on it, so a trail falls behind and a follower trots after; every few
 * seconds it plays its emote, and its spawn, KO and goal effects take turns.
 * A plate frames its name and HP bar, and a title shows under the stage.
 * `focus()` is the item being shown off: an emote plays on and on, a spawn,
 * KO or goal effect replays. Draws while it's on the page; `start` again
 * after it comes back (a tab switch), `dispose` with its screen.
 */
const lookStage = (wearer: () => Wearer, look: () => Look, focus: () => CosmeticId | null, cls = '') => {
  const canvas = h('canvas', { class: 'gem-stage-canvas', width: 96, height: 88 })
  const title = h('div', { class: 'gem-stage-title' })
  const el = h('div', { class: `gem-stage ${cls}` }, canvas, title)
  const fx = createFxPreview()
  let loaded: { dex: Dex; sprites: SpeciesSprites | null } | null = null
  let raf = 0
  let shownTitle: string | undefined
  const at = { x: 0, y: 0 }
  let last = -1
  let walked = 0
  let burstIn = 0.4
  let burstTurn = 0
  const species = () => {
    const dex = wearer().dex
    if (loaded?.dex !== dex) {
      const want: { dex: Dex; sprites: SpeciesSprites | null } = { dex, sprites: null }
      loaded = want
      void loadSpecies(dex).then((s) => (want.sprites = s), () => undefined)
    }
    return loaded.sprites
  }
  const frame = (ms: number) => {
    if (!canvas.isConnected) {
      raf = 0
      last = -1
      return
    }
    raf = requestAnimationFrame(frame)
    const seconds = ms / 1000
    const dt = last < 0 ? 0 : Math.min(0.1, seconds - last)
    last = seconds
    const worn = look()
    const shown = focus()
    const show = shown ? equip(worn, shown) : worn
    if (shownTitle !== show.title) {
      shownTitle = show.title
      title.replaceChildren(...present(titleChip(show.title)))
    }
    const ctx = context2d(canvas)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const s = species()
    if (!s) return
    const dex = wearer().dex
    // It walks, then plays its emote; one being shown off plays on and on, and showing off anything else it just walks.
    const showing = shown === null ? null : slotOf(shown)
    const cycle = walked % (STAGE.walk + STAGE.emote)
    const emoteFor = showing === 'emote' ? seconds : showing === null && show.emote !== undefined && cycle >= STAGE.walk ? cycle - STAGE.walk : null
    walked += dt
    const dir = TURN_ORDER[Math.floor(seconds / TURN) % TURN_ORDER.length]!
    if (emoteFor === null) {
      const step = heading(dir)
      at.x += step.x * STAGE.speed * dt
      at.y += step.y * STAGE.speed * dt
    }
    // Its spawn, KO and goal effects take turns (the one shown off, alone; none while showing off something else).
    const bursts = showing === null ? BURST_SLOTS.flatMap((slot) => show[slot] ?? []) : (BURST_SLOTS as readonly CosmeticSlot[]).includes(showing) && shown ? [shown] : []
    if (bursts.length > 0 && (burstIn -= dt) <= 0) {
      burstIn = STAGE.burst
      fx.burst(bursts[burstTurn++ % bursts.length], at.x, at.y)
    }
    fx.step(show, dex, at.x, at.y, emoteFor === null, emoteFor !== null, seconds)
    const emote = emoteFor !== null ? fx.emote(show, dex, emoteFor) : null
    // Small Pokémon get doubled (whole pixels), big ones stay 1:1; with effects around, they get the room.
    const busy = show.follower !== undefined || show.trail !== undefined || bursts.length > 0
    const scale = !busy && s.bodyH * 2 <= canvas.height - 28 ? 2 : 1
    const cx = canvas.width / 2
    const cy = busy ? Math.round(canvas.height * 0.68) : canvas.height - 12
    ctx.save()
    ctx.translate(cx - Math.round(at.x) * scale, cy - Math.round(at.y) * scale)
    ctx.scale(scale, scale)
    const x = Math.round(at.x)
    const y = Math.round(at.y)
    fx.drawGround(ctx, show, x, y, emoteFor)
    fx.drawFollower(ctx, seconds, y, false)
    // An emote's sheet plays bare: the wearables' anchors only cover Walk, Idle and Hurt (as in a match).
    if (emote) drawPokemon(ctx, s, 'Idle', 0, emote.seconds, x, y, { sheet: emote.sheet, loop: emote.loop })
    else {
      drawWearables(ctx, s, show, 'Walk', dir, seconds, x, y, 'behind')
      drawPokemon(ctx, s, 'Walk', dir, seconds, x, y)
      drawWearables(ctx, s, show, 'Walk', dir, seconds, x, y, 'front')
    }
    fx.drawFollower(ctx, seconds, y, true)
    fx.drawAir(ctx, seconds)
    ctx.restore()
    // A plate frames the name over its head and the HP bar under its feet, as in a match.
    const plate = effectIn('plate', show.plate)?.plate
    if (plate) {
      const tag = textSprite(versusTag('', wearer().name, 0), TEAM_LIGHT[0])
      const top = cy - s.bodyH * scale - 12
      blitPacked(ctx, tag, drawPlateTag(ctx, plate, cx, top, tag.w, seconds), top)
      const w = 22
      const bx = Math.round(cx - w / 2)
      drawPlateBar(ctx, plate, bx, cy + 4, w, seconds)
      ctx.fillStyle = TEAM_COLORS[0]
      ctx.fillRect(bx, cy + 4, w, 2)
    }
  }
  return {
    el,
    start: () => {
      if (raf === 0) raf = requestAnimationFrame(frame)
    },
    dispose: () => {
      cancelAnimationFrame(raf)
      raf = 0
      fx.dispose()
    },
  }
}

/* ---------------- The gem chip ---------------- */

/**
 * The balance as a chip (the gem and the number; a dash before the API
 * answers), following every change. `open` takes the player to the Loja.
 * Null in a build without the API.
 */
export const gemChip = (open: () => void) => {
  if (!gemsEnabled && !gemsFaked()) return null
  const count = h('span', { class: 'gem-chip-count' })
  const chip = h('button', { class: 'gem-chip', type: 'button', onclick: () => (playSfx('select'), later(open)) }, h('img', { class: 'gem-icon', src: gemIconUrl(), alt: '' }), count)
  const paint = (s: GemsStatus | null) => {
    const text = s ? formatNumber(s.balance) : '—'
    count.textContent = text
    chip.setAttribute('aria-label', t().gems.chip(text))
    chip.title = t().gems.chip(text)
  }
  paint(knownGems())
  // It follows the balance while it's on the page; once it leaves, it stops listening.
  let shown = false
  const off = onGems((s) => {
    shown ||= chip.isConnected
    if (shown && !chip.isConnected) off()
    else paint(s)
  })
  if (gemsSignedIn()) void fetchGems()
  return chip
}

/* ---------------- Sheets ---------------- */

/** A sheet over the hub (a pack's checkout, its return): Esc or the backdrop closes it when `closable` says so. */
const sheet = (root: HTMLElement, input: Input, cls: string, closable: () => boolean, onClose: () => void) => {
  const box = h('div', { class: `dialog box pop gem-sheet ${cls}`, role: 'dialog', 'aria-modal': 'true' })
  const el = h('div', { class: 'screen dim gem-sheet-screen' }, box)
  const close = () => {
    off()
    el.remove()
    onClose()
  }
  el.addEventListener('click', (e) => e.target === el && closable() && (playSfx('select'), close()))
  const off = input.onKey((key) => (key === 'Escape' || key === 'Backspace') && closable() && (playSfx('select'), close()))
  root.append(el)
  return { box, close }
}

/**
 * A pack's checkout sheet: what it gives and costs in `currency`, and a
 * button per way to pay; one opens the checkout and leaves for it. Faking
 * (`ps.gems('fake')`), the checkout comes back at once: `returned`, with its ref.
 */
const checkoutSheet = (root: HTMLElement, input: Input, pack: GemPackId, currency: GemCurrency, returned: (ref: string) => void, onClose: () => void) => {
  const m = t().gems
  const def = GEM_PACKS[pack]
  let busy = false
  const s = sheet(root, input, 'gem-checkout', () => !busy, onClose)
  const status = h('p', { class: 'gem-sheet-status', role: 'status' })
  const pay = (method: GemMethod) => {
    if (busy) return
    busy = true
    playSfx('select')
    status.textContent = m.checkout.opening
    status.classList.add('blink')
    buttons.forEach((b) => (b.disabled = true))
    void openCheckout(pack, method, currency).then((res) => {
      if (res.ok && res.staged !== null) {
        busy = false
        s.close()
        return returned(res.staged)
      }
      if (res.ok) return location.assign(res.url)
      busy = false
      playSfx('denied')
      status.classList.remove('blink')
      status.textContent = res.why === 'busy' ? m.shop.busy : res.why === 'banned' ? m.shop.banned : m.checkout.failed
      buttons.forEach((b) => (b.disabled = false))
    })
  }
  const buttons = methodsFor(currency).map((method) =>
    h('button', { class: `btn gem-pay ${method}`, type: 'button', onclick: () => pay(method) }, method === 'pix' ? m.checkout.pix : m.checkout.card),
  )
  s.box.append(
    ...present(
      h('div', { class: 'dialog-title gem-sheet-title' }, h('img', { class: 'gem-icon big', src: gemIconUrl(), alt: '' }), h('span', {}, m.packs[pack])),
      h('b', { class: 'gem-sheet-gems' }, m.gems(formatNumber(packGems(pack)))),
      def.bonus > 0 ? h('small', { class: 'gem-sheet-split' }, m.checkout.split(formatNumber(def.gems), formatNumber(def.bonus))) : null,
      h('b', { class: 'gem-sheet-price' }, priceText(def[currency], currency, tag())),
      h('span', { class: 'field-label' }, m.checkout.pay),
      h('div', { class: 'gem-pay-list' }, ...buttons),
      status,
      h('button', { class: 'btn small gem-sheet-cancel', type: 'button', onclick: () => !busy && (playSfx('select'), s.close()) }, m.checkout.cancel),
    ),
  )
  later(() => buttons[0]?.focus())
}

/** Back from the checkout of pack `ref`: waits for that pack (`awaitCheckout`), then celebrates its gems, or says they're on their way. */
const returnSheet = (root: HTMLElement, input: Input, ref: string, onClose: () => void) => {
  const m = t().gems.checkout
  let waiting = true
  const s = sheet(root, input, 'gem-return', () => !waiting, onClose)
  const ok = h('button', { class: 'btn confirm', type: 'button', onclick: () => (playSfx('select'), s.close()) }, m.ok)
  s.box.append(h('img', { class: 'gem-return-icon wobble', src: gemIconUrl(), alt: '' }), h('b', { class: 'gem-return-title blink' }, m.processing), h('p', {}, m.processingNote))
  void awaitCheckout(ref, () => s.box.isConnected).then((landed) => {
    if (!s.box.isConnected) return
    waiting = false
    if (landed.outcome === 'ok') {
      playSfx('levelUp')
      s.box.classList.add('landed')
      s.box.replaceChildren(
        h('span', { class: 'gem-return-burst', 'aria-hidden': 'true' }, ...Array.from({ length: 8 }, (_, i) => h('img', { class: `gem-spark s${i}`, src: gemIconUrl(), alt: '' }))),
        h('img', { class: 'gem-return-icon', src: gemIconUrl(), alt: '' }),
        h('b', { class: 'gem-return-title' }, m.done(formatNumber(landed.gems))),
        h('p', {}, m.doneNote(formatNumber(landed.balance))),
        ok,
      )
    } else s.box.replaceChildren(h('img', { class: 'gem-return-icon', src: gemIconUrl(), alt: '' }), h('b', { class: 'gem-return-title' }, m.timeout), h('p', {}, m.timeoutNote), ok)
    later(() => ok.focus())
  })
}

/* ---------------- The tabs ---------------- */

/**
 * What the gem tabs need from the screen holding them (the Boutique, the
 * Arena hub): where sheets go, the way to sign in (null: a build without
 * accounts), who wears the looks in the previews, the roster Pokémon Visual
 * shows picked (null: none, the wearer is someone else) and how a pick
 * changes it, and the way to the other tab.
 */
export type GemTabsContext = {
  root: HTMLElement
  input: Input
  signIn: (() => void) | null
  wearer: () => Wearer
  pick: () => VersusPick | null
  setPick: (id: VersusPick) => void
  goTab: (tab: GemTabId) => void
}

/** The gem shop's pages: Loja and Visual. */
export type GemTabId = 'shop' | 'locker'

/** A gem tab as its screen holds it: its page (kept across tab switches), `enter` when it shows, whether a sheet or a dialog has the keys, and `dispose` with the screen. */
export type GemTab = { el: HTMLElement; enter: () => void; busy: () => boolean; dispose: () => void }

const CURRENCY_KEY = 'ps:gemCurrency'

const savedCurrency = (): GemCurrency | null => {
  try {
    const v = localStorage.getItem(CURRENCY_KEY)
    return v === 'brl' || v === 'usd' ? v : null
  } catch {
    return null
  }
}

const keepCurrency = (c: GemCurrency) => {
  try {
    localStorage.setItem(CURRENCY_KEY, c)
  } catch {
    // Storage blocked: the switch lasts this page.
  }
}

const signInCard = (ctx: GemTabsContext) => {
  const m = t().gems.shop
  if (!ctx.signIn) return h('p', { class: 'arena-hub-note' }, m.unavailable)
  const signIn = ctx.signIn
  return h(
    'div',
    { class: 'arena-hub-card arena-hub-cta gem-cta' },
    h('img', { class: 'gem-icon big', src: gemIconUrl(), alt: '' }),
    h('div', {}, h('b', {}, m.signIn.title), h('p', {}, m.signIn.text)),
    h('button', { class: 'btn confirm', type: 'button', onclick: () => (playSfx('select'), later(signIn)) }, m.signIn.button),
  )
}

/** A receipt's moment, short. */
const when = (ms: number) => new Date(ms).toLocaleString(tag(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** The Loja. `checkout`: the ref the page came back from a checkout with (`?gems=<ref>`), so it opens on its return sheet; null otherwise. */
export const shopTab = (ctx: GemTabsContext, checkout: string | null): GemTab => {
  let status = knownGems()
  let currency: GemCurrency = savedCurrency() ?? currencyFor(tag(), Intl.DateTimeFormat().resolvedOptions().timeZone)
  let filter: CosmeticSlot | null = null
  let chosen: CosmeticId | null = null
  let note: { text: string; bad: boolean } | null = null
  let modal = false
  let dialog: Screen | null = null
  let buying = false
  let receipts: 'closed' | 'loading' | GemLedgerEntry[] | null = 'closed'
  let returning = checkout

  const worn = () => status?.look ?? {}
  const stage = lookStage(ctx.wearer, worn, () => chosen)
  const el = h('div', { class: 'gem-shop' })
  const packsEl = h('section', { class: 'gem-packs' })

  const signedIn = () => gemsSignedIn() && (gemsEnabled || gemsFaked())

  const say = (text: string, bad = false) => {
    note = { text, bad }
    paint()
  }

  const openPack = (pack: GemPackId) => {
    if (!signedIn()) return ctx.signIn?.()
    playSfx('select')
    modal = true
    checkoutSheet(ctx.root, ctx.input, pack, currency, openReturn, () => (modal = false))
  }

  const openReturn = (ref: string) => {
    modal = true
    returnSheet(ctx.root, ctx.input, ref, () => (modal = false))
  }

  const buy = (id: CosmeticId) => {
    const price = cosmeticPrice(id) ?? 0
    const m = t().gems.shop
    if ((status?.balance ?? 0) < price) {
      playSfx('denied')
      say(m.short(formatNumber(price - (status?.balance ?? 0))), true)
      packsEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      packsEl.classList.remove('nudge')
      void packsEl.offsetWidth
      packsEl.classList.add('nudge')
      return
    }
    playSfx('select')
    later(() => {
      dialog = confirmDialog(
        ctx.root,
        ctx.input,
        m.confirm(itemName(id), formatNumber(price)),
        (yes) => {
          dialog?.dispose()
          dialog = null
          if (!yes) return
          buying = true
          paint()
          void buyCosmetic(id).then(async (res) => {
            buying = false
            if (res.ok) {
              playSfx('buy')
              await saveLook(equip(res.status.look, id))
              return say(m.bought(itemName(id)))
            }
            playSfx('denied')
            if (res.why === 'gems') {
              void fetchGems()
              return say(m.short(formatNumber(Math.max(1, price - (status?.balance ?? 0)))), true)
            }
            say(res.why === 'owned' ? m.bought(itemName(id)) : { unsold: m.unsold, busy: m.busy, banned: m.banned, offline: m.offline }[res.why], res.why !== 'owned')
          })
        },
        { class: 'shop-confirm gem-confirm', yes: m.buy },
      )
    })
  }

  /** The chosen item's button: sign in, buy it, wear it or take it off. */
  const act = (id: CosmeticId) => {
    const m = t().gems.shop
    const owned = ownedSet(status).has(id)
    const price = cosmeticPrice(id)
    if (!signedIn()) {
      const signIn = ctx.signIn
      return signIn ? h('button', { class: 'btn confirm gem-act', type: 'button', onclick: () => (playSfx('select'), later(signIn)) }, t().gems.shop.signIn.button) : null
    }
    if (owned) {
      const on = worn()[slotOf(id)] === id
      return h(
        'button',
        { class: `btn gem-act${on ? '' : ' confirm'}`, type: 'button', onclick: () => (playSfx('select'), void saveLook(on ? unequip(worn(), slotOf(id)) : equip(worn(), id))) },
        on ? m.unequip : m.equip,
      )
    }
    if (price === null) return h('button', { class: 'btn gem-act', type: 'button', disabled: true }, m.unsold)
    return h('button', { class: 'btn confirm gem-act', type: 'button', disabled: buying, onclick: () => buy(id) }, m.buy, ' ', gemAmount(price))
  }

  const itemCard = (id: CosmeticId) => {
    const m = t().gems.shop
    const slot = slotOf(id)
    const owned = ownedSet(status).has(id)
    const on = worn()[slot] === id
    const price = cosmeticPrice(id)
    const misfit = !fits(id, ctx.wearer().dex)
    return h(
      'button',
      {
        class: `gem-item ${rarityOf(id)}${chosen === id ? ' chosen' : ''}${owned ? ' owned' : ''}`,
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
      h('span', { class: 'gem-item-art' }, h('img', { src: iconUrl(id), alt: '' })),
      h('b', { class: 'gem-item-name' }, itemName(id)),
      h('small', { class: 'gem-item-tag' }, on ? m.equipped : owned ? m.owned : price === null ? m.unsold : gemAmount(price)),
      misfit ? h('em', { class: 'gem-item-misfit', title: m.misfit(ctx.wearer().name) }, '!') : null,
    )
  }

  const info = () => {
    const m = t().gems
    if (!chosen) return h('p', { class: 'gem-info-hint' }, m.shop.pitch)
    const id = chosen
    const slot = slotOf(id)
    return h(
      'div',
      { class: 'gem-info', style: `--rarity:${RARITY_COLORS[rarityOf(id)]}` },
      h('b', { class: 'gem-info-name' }, itemName(id)),
      h('small', { class: 'gem-info-kind' }, `${m.rarities[rarityOf(id)]} · ${m.slots[slot]}`),
      isWearable(slot) ? (fits(id, ctx.wearer().dex) ? null : h('small', { class: 'gem-info-misfit' }, m.shop.misfit(ctx.wearer().name))) : h('small', {}, m.shop.effect),
      act(id),
    )
  }

  const receiptsEl = () => {
    const m = t().gems.shop
    const details = h('details', { class: 'gem-receipts' }, h('summary', {}, m.receipts))
    if (receipts !== 'closed') details.open = true
    details.addEventListener('toggle', () => {
      if (!details.open || receipts !== 'closed') return
      receipts = 'loading'
      void fetchReceipts().then((r) => ((receipts = r), paint()))
    })
    if (receipts === 'loading') details.append(h('p', { class: 'arena-hub-note blink' }, t().versus.hub.loading))
    else if (receipts === null) details.append(h('p', { class: 'arena-hub-note' }, m.offline))
    else if (receipts !== 'closed')
      details.append(
        receipts.length === 0
          ? h('p', { class: 'arena-hub-note' }, m.receiptsEmpty)
          : h(
              'ul',
              { class: 'gem-receipt-list' },
              ...receipts.map((r) =>
                h(
                  'li',
                  {},
                  h('span', {}, h('b', {}, m.reasons[r.reason]), h('small', {}, when(r.at))),
                  h('b', { class: r.amount >= 0 ? 'up' : 'down' }, `${r.amount >= 0 ? '+' : '−'}${formatNumber(Math.abs(r.amount))}`),
                ),
              ),
            ),
      )
    return details
  }

  const paint = () => {
    const m = t().gems
    const owned = ownedSet(status)
    const catalog = shopCatalog(brasiliaDay(today()), owned)
    const items = catalog.filter((g) => filter === null || g.slot === filter).flatMap((g) => g.items)
    const seg = (c: GemCurrency) =>
      h(
        'button',
        { class: `shell-seg-option${currency === c ? ' on' : ''}`, type: 'button', 'aria-pressed': String(currency === c), onclick: () => currency !== c && (playSfx('move'), (currency = c), keepCurrency(c), paint()) },
        c === 'brl' ? 'R$' : 'US$',
      )
    packsEl.replaceChildren(
      h('div', { class: 'gem-section-head' }, h('span', { class: 'field-label' }, m.shop.packs), h('div', { class: 'shell-seg gem-currency', role: 'group', 'aria-label': m.shop.currency }, seg('brl'), seg('usd'))),
      h(
        'div',
        { class: 'gem-pack-grid' },
        ...GEM_PACK_IDS.map((pack, i) =>
          h(
            'button',
            { class: `gem-pack tier${i}`, type: 'button', onclick: () => openPack(pack) },
            h('span', { class: 'gem-pack-art' }, ...Array.from({ length: Math.min(i + 1, 4) }, () => h('img', { src: gemIconUrl(), alt: '' }))),
            h('b', { class: 'gem-pack-gems' }, formatNumber(packGems(pack))),
            h('small', { class: 'gem-pack-name' }, m.packs[pack]),
            GEM_PACKS[pack].bonus > 0 ? h('em', { class: 'gem-pack-bonus' }, m.shop.bonus(formatNumber(GEM_PACKS[pack].bonus))) : null,
            h('span', { class: 'gem-pack-price' }, priceText(GEM_PACKS[pack][currency], currency, tag())),
          ),
        ),
      ),
    )
    const chip = (slot: CosmeticSlot | null) =>
      h(
        'button',
        { class: `gem-filter${filter === slot ? ' on' : ''}`, type: 'button', 'aria-pressed': String(filter === slot), onclick: () => filter !== slot && (playSfx('move'), (filter = slot), paint()) },
        slot ? h('img', { src: slotIconUrl(slot), alt: '' }) : null,
        slot ? m.slots[slot] : m.shop.all,
      )
    const scroll = el.parentElement?.scrollTop ?? 0
    el.replaceChildren(
      ...present(
        signedIn()
          ? h('div', { class: 'gem-balance' }, h('small', {}, m.shop.balance), gemAmount(status?.balance ?? 0, 'big'), h('small', { class: 'gem-balance-note' }, m.shop.onlyLooks))
          : signInCard(ctx),
        packsEl,
        h(
          'section',
          { class: 'gem-catalog' },
          h('span', { class: 'field-label' }, m.shop.catalog),
          h(
            'div',
            { class: 'gem-catalog-main' },
            h('div', { class: 'gem-try' }, stage.el, info(), note ? h('p', { class: `gem-note${note.bad ? ' bad' : ''}`, role: 'status' }, note.text) : null),
            h('div', { class: 'gem-browse' }, h('div', { class: 'gem-filters' }, chip(null), ...catalog.map((g) => chip(g.slot))), h('div', { class: 'gem-items' }, ...items.map(itemCard))),
          ),
      ),
      signedIn() ? receiptsEl() : null,
      ),
    )
    if (el.parentElement) el.parentElement.scrollTop = scroll
    stage.start()
  }

  const off = onGems((s) => {
    status = s
    if (el.isConnected) paint()
  })

  return {
    el,
    dispose: () => (off(), stage.dispose(), dialog?.dispose()),
    enter: () => {
      paint()
      // The cards draw the wearables themselves once their engine is in.
      if (icons.size === 0) void loadWearables().then(() => el.isConnected && paint(), () => undefined)
      if (signedIn()) void fetchGems()
      if (returning !== null) {
        openReturn(returning)
        returning = null
      }
    },
    busy: () => modal || dialog !== null,
  }
}

/**
 * The Visual tab: the look by slot (what the account owns, or nothing), a
 * big preview of any roster Pokémon wearing it, walking and turning, and
 * where the look is saved (the account, or this device until it's back).
 */
export const lockerTab = (ctx: GemTabsContext): GemTab => {
  let status = knownGems()
  let saving: 'idle' | 'saving' | 'saved' | 'local' = 'idle'
  const stage = lookStage(ctx.wearer, () => status?.look ?? {}, () => null, 'big')
  const el = h('div', { class: 'gem-locker' })

  const wear = (look: Look) => {
    playSfx('select')
    saving = 'saving'
    void saveLook(look).then((ok) => {
      saving = ok ? 'saved' : 'local'
      paint()
    })
  }

  const paint = () => {
    const m = t().gems
    if (!gemsSignedIn() || (!gemsEnabled && !gemsFaked())) {
      el.replaceChildren(signInCard(ctx))
      return
    }
    const owned = ownedSet(status)
    const look = status?.look ?? {}
    const picks = VERSUS_PICKS.map((id) =>
      h(
        'button',
        { class: `gem-pick${ctx.pick() === id ? ' on' : ''}`, type: 'button', 'aria-pressed': String(ctx.pick() === id), 'aria-label': firstForm(id).name, title: firstForm(id).name, onclick: () => ctx.pick() !== id && (playSfx('move'), ctx.setPick(id), paint()) },
        h('img', { src: portraitUrl(firstForm(id).dex), alt: '' }),
      ),
    )
    const rows = COSMETIC_SLOTS.map((slot) => {
      const mine = [...owned].filter((id) => slotOf(id) === slot)
      const chipFor = (id: CosmeticId | null) => {
        const on = (look[slot] ?? null) === id
        return h(
          'button',
          {
            class: `gem-wear${on ? ' on' : ''}${id ? ` ${rarityOf(id)}` : ''}`,
            type: 'button',
            style: id ? `--rarity:${RARITY_COLORS[rarityOf(id)]}` : '',
            'aria-pressed': String(on),
            onclick: () => !on && wear(id ? equip(look, id) : unequip(look, slot)),
          },
          id ? itemName(id) : m.locker.none,
          id && !fits(id, ctx.wearer().dex) ? h('em', { class: 'gem-item-misfit', title: m.shop.misfit(ctx.wearer().name) }, '!') : null,
        )
      }
      return h(
        'div',
        { class: 'gem-slot' },
        h('span', { class: 'gem-slot-head' }, h('img', { src: slotIconUrl(slot), alt: '' }), h('b', {}, m.slots[slot])),
        h('div', { class: 'gem-slot-items' }, ...(mine.length === 0 ? [h('small', { class: 'gem-slot-empty' }, m.locker.slotEmpty)] : [chipFor(null), ...mine.map(chipFor)])),
      )
    })
    const toShop = h('button', { class: 'btn small', type: 'button', onclick: () => (playSfx('select'), ctx.goTab('shop')) }, m.locker.toShop)
    const saved = saving === 'idle' ? m.locker.note : saving === 'saving' ? m.locker.saving : saving === 'saved' ? m.locker.saved : m.locker.local
    const scroll = el.parentElement?.scrollTop ?? 0
    el.replaceChildren(
      ...present(
        h(
          'div',
          { class: 'gem-locker-top' },
          h('div', { class: 'gem-locker-stage' }, stage.el, h('p', { class: `gem-save ${saving}`, role: 'status' }, saved)),
          h('div', { class: 'gem-locker-picks' }, h('span', { class: 'field-label' }, m.locker.pick), h('div', { class: 'gem-pick-list' }, ...picks)),
      ),
      owned.size === 0 ? h('div', { class: 'arena-hub-card gem-empty' }, h('p', {}, m.locker.empty), toShop) : null,
      h('div', { class: 'gem-slots' }, ...rows),
      owned.size > 0 ? toShop : null,
      ),
    )
    if (el.parentElement) el.parentElement.scrollTop = scroll
    stage.start()
  }

  const off = onGems((s) => {
    status = s
    if (el.isConnected) paint()
  })

  return {
    el,
    dispose: () => (off(), stage.dispose()),
    enter: () => {
      paint()
      if (gemsSignedIn()) void fetchGems()
    },
    busy: () => false,
  }
}
