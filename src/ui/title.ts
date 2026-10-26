import { accountState, accountsEnabled, giftInbox, onAccountChange, onInbox, onSaveSynced, type AccountState } from '../account'
import { lobbyPress } from '../analytics'
import { playSfx } from '../engine/audio'
import { ACTIONS } from '../engine/bindings'
import { joystick, type Input, type Stick } from '../engine/input'
import { formatTime, type Vec } from '../engine/math'
import { blitPacked, context2d, ellipse } from '../engine/pixelart'
import { ENEMIES } from '../data/enemies'
import { HATCHLINGS, PLAYABLE } from '../data/hatchlings'
import { isReady } from '../game/eggs'
import { DISCORD_GIFT } from '../game/gifts'
import { nextMilestone } from '../game/referral'
import { dayKey, missionStatus } from '../game/missions'
import { pendingPicks, playsShiny } from '../game/shinyPicks'
import { pollToVote, supporterCount, tierRank, type WallEntry } from '../game/supporters'
import { formatNumber, locale, t } from '../i18n'
import { bulbIcon, coinIcon, coopIcon, discordIcon, eggIcon, giftIcon, heartIcon, itemIcon, medalIcon, newsIcon, pawIcon, pokeballIcon, ribbonIcon, socialIcon, sparkleIcon, supporterIcon, surveyIcon } from '../render/art'
import { logoScale, titleLogo } from '../render/logo'
import { drawPokemon, loadedSprites, loadSpecies, type Dex } from '../render/sprites'
import type { LobbyNpc, Place } from '../render/titleScene'
import { stallGoods } from '../game/stalls'
import type { VisitorShelf } from './shop'
import { dialogue, type Dialogue, type Speaker } from './dialogue'
import { lanturnSpeaker, senseiSpeaker, stallSpeaker, stallToday } from './visitors'
import { inviterName } from '../ranking'
import { ROUTES, SOCIAL_IDS, SOCIALS, type SocialId } from '../site/routes'
import { fetchWall, knownStatus } from '../supporters'
import { h, later, rich } from './dom'
import { boundKey } from './inputLabels'
import { challengeToday, halloweenToday, loadAttempt, loadSave, outbreakToday, today } from './save'
import { festivalCard, festivalCardShows, festivalTile, type FestivalTab } from './festival'
import { fillHalloweenCard, halloweenCard, halloweenCardShows, halloweenTile } from './halloween'
import { contentLine } from './gifts'
import { countedFriends, loadInvites } from './invites'
import { isUnread, latestUpdate } from './news'
import { hallFace, hallPortrait, type HallOpen } from './supporters'
import { surveyWaiting, takeSurveyOffer } from './survey'
import type { Screen } from './screens'
import { gearButton, helpButton, iconButton, railTile, shellBody, topBar, walletChip } from './shell'
import { nearestInDirection, type Direction } from './spatial'
import { toast } from './toasts'
import { trainerChip } from './trainer'
import { uiDpr, uiViewport, uiZoom } from './uiScale'

/** What the lobby can highlight. A screen opened over it gets the one it came from, to come back to it. */
export type LobbyFocus =
  | 'trainer'
  | 'news'
  | 'survey'
  | 'discord'
  | 'help'
  | 'settings'
  | 'halloween'
  | 'festival'
  | 'outbreak'
  | 'challenge'
  | 'missions'
  | 'hall'
  | 'gifts'
  | 'invite'
  | 'friends'
  | 'pokedex'
  | 'eggs'
  | 'mart'
  | 'dojo'
  | 'ranking'
  | 'ideas'
  | 'coop'
  | 'play'
  | 'explore'
  | SocialId

/**
 * The meadow behind the lobby (`render/titleScene.ts`), where the partner
 * takes its walks and the Kecleon plaza stands. Points are CSS px; the shell
 * maps them into the world.
 */
export type Meadow = {
  /**
   * Puts the partner on its stage. Returns how this lobby lets it go: a no-op
   * once a newer lobby met it (the next title is built before this one goes).
   */
  meet: (partner: { dex: Dex; shiny: boolean }) => () => void
  /** This frame's keys or stick, a tapped spot, and where the stage holds the partner's feet. */
  steer: (move: Vec, tap: Vec | null, home: Vec) => void
  /** Whether the partner is out in the meadow (else the stage draws it). */
  out: () => boolean
  /** The drag joystick to draw over the meadow, or null. */
  stick: (stick: Stick | null) => void
  /** Starts the camera's trip to the Kecleon plaza or back home, the partner hopping along (`instant`: lands at once). */
  visit: (to: Place, instant?: boolean) => void
  /** Where the meadow rests, or `moving` during a trip. */
  at: () => Place | 'moving'
  /** Passear on or off: on, the partner hops into the meadow and stays out, the camera following it; off, it heads back to its stage. */
  explore: (on: boolean) => void
  /** Above whoever at the plaza the strolling partner stands close enough to talk to (and who), or null. */
  talkSpot: () => (Vec & { who: LobbyNpc }) | null
  /** Who a tap is for: the shop (its shopkeepers, building or the edge marker pointing to it), Meowth, a stall (or its edge marker), the festival's fountain or plaque; null for none. */
  tapsShop: (at: Vec) => LobbyNpc | null
  /** On a phone with the lobby's cards up, the partner's stage (CSS px): the shop's edge marker keeps to it, since the cards cover the view's edges; null otherwise. */
  stageBox: (box: DOMRect | null) => void
}

export type TitleActions = {
  /** JOGAR, and a tap on the partner: the Pokémon select, the saved partner picked. */
  play: () => void
  /** Opens the Desafio do dia. */
  challenge: () => void
  missions: () => void
  /** Opens the egg incubator. */
  incubator: () => void
  /** Opens the waiting Mystery Gifts (the gift box on the partner's stage). */
  gifts: () => void
  /** The lobby is up: after the "press start" gesture, so the browser lets audio play. */
  ready: () => void
  /**
   * Opens Settings over the title (the gear). Closing them must rebuild the
   * title (the language may have changed), highlighting `focus`.
   */
  settings: (focus: LobbyFocus) => Screen
  /** Opens the Noite das Bruxas screen (its Hoje card) over the title, like `settings`. */
  halloween: (focus: LobbyFocus) => Screen
  /** Opens Novidades (the newest update's highlights) over the title, like `settings`. */
  news: (focus: LobbyFocus) => Screen
  /** Opens the difficulty survey over the title, like `settings`; the lobby also opens it by itself once (`takeSurveyOffer`). */
  survey: (focus: LobbyFocus) => Screen
  /** Opens the Discord screen (the community server, linking a Discord account) over the title, like `settings`. */
  discord: (focus: LobbyFocus) => Screen
  /** Opens the in-game Pokédex over the title; closing it rebuilds the title on `focus`, like `settings`. */
  pokedex: (focus: LobbyFocus) => Screen
  /**
   * Opens the shop over the Kecleon plaza once the camera got there (Kecleon
   * talks beside it, `ui/shop.ts`); its Back must call `close`, which pans
   * back home and brings the lobby back in. `shelf`: open on Meowth's caravan or a seasonal stall's shelf (a talk with its keeper).
   */
  mart: (close: () => void, shelf?: VisitorShelf, festival?: () => void) => Screen
  /**
   * Opens the Festival da Praça's sheet over the Kecleon plaza once the camera
   * got there (`openFestival` in `ui/festival.ts`), on `tab`; `close` goes on
   * from it (home, or back to the shop it was opened from).
   */
  festival: (close: () => void, tab?: FestivalTab) => Screen
  /** Opens the Trainer Card over the title (the Trainer chip, `C`, the invite banner), like `settings`. */
  trainer: (focus: LobbyFocus) => Screen
  /** Opens the boards over the title, like `settings`. No action (no API), no tile. */
  ranking?: (focus: LobbyFocus) => Screen
  /** Opens Ideias (the idea board) over the title, like `settings`. No action (no API), no tile. */
  ideas?: (focus: LobbyFocus) => Screen
  /** Opens Apoiadores over the title (the Hall da Fama card), like `settings`; `open` goes straight to the shiny picker or a poll. */
  supporters: (focus: LobbyFocus, open: HallOpen | null) => Screen
  /** Opens Convide amigos over the title (its card under the Hall), like `settings`. */
  invites: (focus: LobbyFocus) => Screen
  /** Jogar junto (co-op): the hub. No action (no relay in this build), no tile. */
  coop?: () => void
  /** The Dojo, once Machoke said hello: who trains (the partner select in its Dojo guise, `game/training.ts`). */
  dojo: () => void
  meadow: Meadow
}

/**
 * The lobby's three layouts, in sync with the media queries of the lobby's
 * section in `style.css`: phones in landscape (two columns), narrow screens
 * (rails of tiles either side of the partner, over a tab bar) and the rest
 * (rails of cards either side of the partner).
 */
const LANDSCAPE = '(max-height: 500px) and (orientation: landscape)'
const NARROW = '(max-width: 759px) and (min-height: 501px), (max-width: 759px) and (orientation: portrait)'
const layout = () => (matchMedia(LANDSCAPE).matches ? 'landscape' : matchMedia(NARROW).matches ? 'narrow' : 'wide')

/** Sizes a pixel-art canvas in `#ui` to `k` device px per art px (UI size included), so its pixels stay square. Touches the style only when it changes. */
const pixelSize = (canvas: HTMLCanvasElement, k: number) => {
  const dpr = uiDpr()
  const width = `${(canvas.width * k) / dpr}px`
  const height = `${(canvas.height * k) / dpr}px`
  if (canvas.style.width === width && canvas.style.height === height) return
  canvas.style.width = width
  canvas.style.height = height
}

/** Fits the logo to the viewport in whole device pixels per logo pixel: big for the intro, smaller in the lobby. */
const fitLogo = (canvas: HTMLCanvasElement, intro: boolean) => {
  const { w: vw, h: vh } = uiViewport()
  const mode = layout()
  // The top bar takes about 60 px off the height.
  const [maxW, maxH] = intro
    ? [Math.min(vw * 0.9, 640), (vh - 60) * 0.4]
    : mode === 'landscape'
      ? [vw * 0.42, (vh - 60) * 0.24]
      : mode === 'narrow'
        ? [Math.min(vw * 0.8, 420), (vh - 60) * 0.11]
        : [Math.min(vw - 620, 460), (vh - 60) * 0.17]
  pixelSize(canvas, logoScale(canvas.width, canvas.height, Math.max(maxW, 120), maxH, uiDpr()))
}


/* ---------------- Hoje: the day's cards ---------------- */

/** A Hoje card: a colored label (with an optional badge and key hint) over one line of live state. */
const todayCard = (key: LobbyFocus, label: string, badge: Node | null, hotkey: string | null, ...row: Node[]) =>
  h(
    'button',
    { class: `lobby-card box ${key}`, type: 'button' },
    h('small', { class: 'lobby-card-label' }, h('span', {}, label), badge, hotkey && h('span', { class: 'key-hint' }, hotkey)),
    h('span', { class: 'lobby-card-row' }, ...row),
  )

/** A red count, or a green ✓ when nothing's left. */
const badge = (n: number) => (n > 0 ? h('em', { class: 'lobby-badge' }, formatNumber(n)) : h('em', { class: 'lobby-badge done' }, '✓'))

/** The day's outbreak species walking on canvases (`shiny`: its shiny form beside it), which `tick` animates. */
const outbreakWalkers = (shiny: boolean) => {
  const def = ENEMIES[outbreakToday()]
  const sprite = (form: boolean) => h('canvas', { class: form ? 'lobby-walker shiny' : 'lobby-walker', width: 30, height: 32, 'aria-hidden': 'true' })
  const walkers = shiny ? [sprite(false), sprite(true)] : [sprite(false)]
  void Promise.allSettled([loadSpecies(def.dex), ...(shiny ? [loadSpecies(def.dex, true)] : [])])
  const tick = (time: number) => {
    const k = Math.max(1, Math.round(uiDpr() * (layout() === 'wide' ? 1.5 : 1)))
    walkers.forEach((canvas, i) => {
      pixelSize(canvas, k)
      const ctx = context2d(canvas)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const s = loadedSprites(def.dex, i === 1)
      if (s) drawPokemon(ctx, s, 'Walk', 0, time + i * 0.3, canvas.width / 2, canvas.height - 2)
    })
  }
  return { def, walkers, tick }
}

/** Surto do dia: the day's species walking, normal and shiny. `tick` animates them. */
const outbreakCard = () => {
  const { def, walkers, tick } = outbreakWalkers(true)
  const el = todayCard('outbreak', t().home.outbreak, null, null, ...walkers, h('b', {}, def.name), h('img', { class: 'lobby-sparkle', src: sparkleIcon(), alt: '' }))
  return { el, tick }
}

/** Surto do dia as a rail tile: the species walking, a sparkle on its corner for the shiny it may bring. */
const outbreakTile = () => {
  const m = t().home
  const { def, walkers, tick } = outbreakWalkers(false)
  const el = railTile('outbreak', walkers[0]!, m.rail.outbreak, `${m.outbreak}: ${def.name}`, h('img', { class: 'rail-sparkle', src: sparkleIcon(), alt: '' }))
  return { el, tick }
}

/** Today's Desafio do dia, and this device's official attempt at it once made. */
const challengeState = () => {
  const c = challengeToday()
  const attempt = loadAttempt()
  return { c, done: attempt?.day === c.day ? attempt : null }
}

/** Desafio do dia: today's attempt time once made (with the ribbon it plays for), else the day's Pokémon and a "!". */
const challengeCard = () => {
  const m = t().home
  const { c, done } = challengeState()
  const el = todayCard(
    'challenge',
    m.challenge,
    done ? null : h('em', { class: 'lobby-badge' }, '!'),
    null,
    h('img', { class: 'lobby-icon', src: ribbonIcon('gold'), alt: '' }),
    h('b', {}, done ? m.challengeDone(formatTime(done.time)) : PLAYABLE[c.starter].line[0].name),
  )
  el.setAttribute('aria-label', `${m.challenge}: ${done ? m.challengeDone(formatTime(done.time)) : m.challengeOpen}`)
  return el
}

/** Desafio do dia as a rail tile: the ribbon, with a "!" until today's attempt is made (a ✓ after). */
const challengeTile = () => {
  const m = t().home
  const { done } = challengeState()
  return railTile(
    'challenge',
    h('img', { class: 'lobby-icon', src: ribbonIcon('gold'), alt: '' }),
    m.rail.challenge,
    `${m.challenge}: ${done ? m.challengeDone(formatTime(done.time)) : m.challengeOpen}`,
    done ? badge(0) : h('em', { class: 'lobby-badge' }, '!'),
  )
}

/** Today's daily missions: how many are done, out of how many. */
const dailyMissions = () => {
  const daily = missionStatus(loadSave().missions, today()).filter((s) => s.period === 'daily')
  const done = daily.filter((s) => s.done).length
  return { done, total: daily.length, left: daily.length - done }
}

/** Missões: today's missions done out of all, with a badge of those left. */
const missionsCard = () => {
  const m = t().home
  const { done, total, left } = dailyMissions()
  const el = todayCard(
    'missions',
    m.missions,
    badge(left),
    'M',
    h('span', { class: 'lobby-progress' }, h('span', { style: `width:${total ? Math.round((done / total) * 100) : 0}%` })),
    h('b', {}, `${done}/${total}`),
  )
  el.setAttribute('aria-label', `${m.missions}: ${m.missionsLeft(left)}`)
  return el
}

/** Missões as a rail tile: done out of all over the label, with a badge of those left. */
const missionsTile = () => {
  const m = t().home
  const { done, total, left } = dailyMissions()
  return railTile('missions', h('b', { class: 'rail-count' }, `${done}/${total}`), m.rail.missions, `${m.missions}: ${m.missionsLeft(left)}`, badge(left))
}

/* ---------------- Novidades ---------------- */

/** Novidades in the top bar: a page of patch notes that wiggles under a red "!" while the newest update is unread. */
const newsButton = (onClick: () => void) => {
  const m = t().news
  const el = iconButton(newsIcon(), m.open, onClick, 'N')
  el.classList.add('lobby-news')
  // A chunk that didn't load (a deploy renamed it, the network dropped) just leaves the badge off.
  void latestUpdate().then(
    (update) => {
      if (!isUnread(update)) return
      el.classList.add('unread')
      el.setAttribute('aria-label', m.unread)
      el.title = m.unread
      el.append(h('em', { class: 'lobby-badge' }, '!'))
    },
    () => {},
  )
  return el
}

/** The survey in the top bar while it waits for an answer (`surveyWaiting`): a clipboard that hops under a red "!", like unread Novidades. */
const surveyButton = (onClick: () => void) => {
  const el = iconButton(surveyIcon(), t().survey.open, onClick)
  el.classList.add('lobby-survey')
  el.append(h('em', { class: 'lobby-badge' }, '!'))
  return el
}

/** Calls `paint` now and on every account change while `el` is on the page: a link that lands with the lobby up (back from Discord, the sync finishing) shows at once. */
const followAccount = (el: HTMLElement, paint: (s: AccountState) => void) => {
  paint(accountState())
  const off = onAccountChange((s) => (el.isConnected ? paint(s) : off()))
}

/** Discord in the top bar (landscape phones, whose side column is full), with a green ✓ once the player linked their Discord. */
const discordButton = (onClick: () => void) => {
  const el = iconButton(discordIcon(), t().discord.open, onClick)
  el.classList.add('lobby-discord')
  const badge = h('em', { class: 'lobby-badge done' }, '✓')
  followAccount(el, (s) => (s.kind === 'signedIn' && s.discord ? el.append(badge) : badge.remove()))
  return el
}

/**
 * Discord under Convide amigos (wide screens and portrait phones): the linked
 * @username, or, while linking can bring it, the gift it brings (`DISCORD_GIFT`,
 * bobbing like the invites' prize); joining when this build has no accounts.
 */
const discordCard = () => {
  const m = t().discord
  const row = h('span', { class: 'lobby-invites-row' })
  const prize = h('img', { class: 'lobby-invites-prize', src: contentLine({ content: DISCORD_GIFT }).src, alt: '' })
  const el = h(
    'button',
    { class: 'lobby-invites lobby-discord-card box', type: 'button' },
    h('img', { class: 'lobby-discord-icon', src: discordIcon(), alt: '' }),
    h('span', { class: 'lobby-invites-text' }, h('b', {}, m.title), row),
  )
  followAccount(el, (s) => {
    const linked = s.kind === 'signedIn' && s.discord
    const text = linked ? `✓ @${s.discord}` : accountsEnabled ? m.cardGift(HATCHLINGS[DISCORD_GIFT.family].name) : m.join
    row.textContent = text
    if (!linked && accountsEnabled) el.append(prize)
    else prize.remove()
    el.setAttribute('aria-label', `${m.title}: ${text}`)
  })
  return el
}

/** Discord as a rail tile: a green ✓ once linked, or, while linking can bring it, the gift it brings bobbing on its corner. */
const discordTile = () => {
  const m = t().discord
  const done = h('em', { class: 'lobby-badge done' }, '✓')
  const prize = h('img', { class: 'lobby-invites-prize rail-prize', src: contentLine({ content: DISCORD_GIFT }).src, alt: '' })
  const el = railTile('discord', h('img', { class: 'lobby-discord-icon', src: discordIcon(), alt: '' }), t().home.rail.discord, m.title)
  followAccount(el, (s) => {
    const linked = s.kind === 'signedIn' && s.discord
    done.remove()
    prize.remove()
    if (linked) el.append(done)
    else if (accountsEnabled) el.append(prize)
    el.setAttribute('aria-label', `${m.title}: ${linked ? `✓ @${s.discord}` : accountsEnabled ? m.cardGift(HATCHLINGS[DISCORD_GIFT.family].name) : m.join}`)
  })
  return el
}

/** An official profile (`SOCIALS`) in the top bar, beside Discord (landscape phones). */
const socialButton = (id: SocialId, onClick: () => void) => iconButton(socialIcon(id), t().socials.follow(SOCIALS[id].name), onClick)

/** An official profile under Discord (wide screens) with its name and handle, or just its icon beside Discord (portrait phones). */
const socialCard = (id: SocialId) => {
  const s = SOCIALS[id]
  return h(
    'button',
    { class: `lobby-invites lobby-social ${id} box`, type: 'button', 'aria-label': t().socials.follow(s.name), title: t().socials.follow(s.name) },
    h('img', { class: 'lobby-social-icon', src: socialIcon(id), alt: '' }),
    h('span', { class: 'lobby-invites-text' }, h('b', {}, s.name), h('span', { class: 'lobby-invites-row' }, s.handle)),
  )
}

/** Opens an official profile in a new tab (or its app). */
const openSocial = (id: SocialId) => window.open(SOCIALS[id].url, '_blank', 'noopener')

/**
 * Presente!: a wrapped box on the partner's stage, hopping and sparkling,
 * with how many Mystery Gifts wait. Hidden while none does; it follows the
 * inbox, so a gift a sync lists shows up with the lobby already open.
 */
const giftButton = () => {
  const m = t().gifts
  const count = h('em', { class: 'lobby-badge' })
  const el = h(
    'button',
    { class: 'lobby-gift box', type: 'button' },
    h('img', { class: 'lobby-gift-box', src: giftIcon(), alt: '' }),
    h('img', { class: 'lobby-gift-sparkle', src: sparkleIcon(), alt: '' }),
    h('b', {}, m.button),
    count,
    h('span', { class: 'key-hint' }, 'G'),
  )
  const paint = (n: number) => {
    el.hidden = n === 0
    count.textContent = String(n)
    el.setAttribute('aria-label', m.buttonLabel(n))
  }
  paint(giftInbox().length)
  const off = onInbox((gifts) => (el.isConnected ? paint(gifts.length) : off()))
  return el
}

/** Passear, on the partner's stage across from the gift box: a paw print over its label. */
const exploreButton = () => {
  const m = t().home
  return h(
    'button',
    { class: 'lobby-explore box', type: 'button', 'aria-label': m.exploreLabel, title: m.exploreLabel },
    h('img', { src: pawIcon(), alt: '' }),
    h('b', {}, m.explore),
  )
}

/* ---------------- Hall da Fama ---------------- */

/** Who the Hall card shows first: Diamond, then Gold, then supporters, then who came first. */
const byStanding = (a: WallEntry, b: WallEntry) => tierRank(b.tier) - tierRank(a.tier) || a.since.localeCompare(b.since)

/**
 * A supporter's round face, ringed in their tier's color: the portrait of
 * the Pokémon they stand with on the Hall (shiny if so), or their name's
 * initial from an API from before the Hall.
 */
const wallFace = (e: WallEntry) => {
  const face = hallFace(e.pokemon)
  return h(
    'span',
    { class: `hall-face ${e.tier}${face ? ' portrait' : ''}`, title: e.name, 'aria-hidden': 'true' },
    face ? hallPortrait(face) : ([...e.name.trim()][0]?.toUpperCase() ?? '♥'),
  )
}

/**
 * What the Hall da Fama calls the player to, opening straight onto it: a
 * waiting shiny ticket's pick, else a poll they may vote in and haven't (as
 * the device last heard from the API). Null for nothing, and without accounts.
 */
const hallCall = (): HallOpen | null => {
  if (!accountsEnabled) return null
  if (pendingPicks(loadSave()).length > 0) return 'pick'
  const poll = pollToVote(knownStatus())
  return poll ? { poll } : null
}

/** The Hall's label, with what it calls the player to. */
const hallLabel = (call: HallOpen | null) => {
  const m = t().supporters
  return call === null ? t().home.hall : `${t().home.hall} · ${call === 'pick' ? m.banner : m.voteWaiting}`
}

/**
 * The Hall da Fama card: gold, slowly turning rays, the first supporters'
 * faces and "+N", and a ticker with the newest one (the wall's last entry).
 * Before the wall comes back, offline or with nobody on it, it just asks for
 * support. It sparkles while it calls the player to something (`hallCall`);
 * for a poll, the ticker says so instead. Without accounts it's a link to the
 * support page.
 */
const hallCard = (open: () => void) => {
  const m = t().home
  const call = hallCall()
  const voting = call !== null && call !== 'pick'
  const stack = h('span', { class: 'hall-stack' })
  const ticker = h('span', { class: 'hall-ticker' }, ...(voting ? [h('img', { src: giftIcon(), alt: '' }), h('span', {}, t().supporters.voteWaiting)] : [h('img', { src: heartIcon(), alt: '' }), h('span', {}, m.support)]))
  const label = hallLabel(call)
  const kids = [
    h('span', { class: 'hall-rays', 'aria-hidden': 'true' }),
    h('span', { class: 'hall-top' }, h('img', { src: supporterIcon('gold'), alt: '' }), h('b', {}, m.hall), h('img', { class: 'hall-sparkle', src: sparkleIcon(), alt: '' })),
    stack,
    ticker,
    h('span', { class: 'key-hint' }, 'H'),
  ]
  const attrs = { class: call ? 'lobby-hall waiting' : 'lobby-hall', 'aria-label': label, title: label }
  const el = accountsEnabled
    ? h('button', { ...attrs, type: 'button', onclick: open }, ...kids)
    : h('a', { ...attrs, href: ROUTES.support[locale()], target: '_blank', rel: 'noopener', onclick: () => playSfx('select') }, ...kids)
  void fetchWall().then((wall) => {
    const newest = wall?.entries.at(-1)
    if (!wall || !newest) return
    const shown = [...wall.entries].sort(byStanding).slice(0, 4)
    // Supporters off the wall count too, so the number never drops when one hides.
    const more = supporterCount(wall) - shown.length
    stack.replaceChildren(...shown.map(wallFace), ...(more > 0 ? [h('em', {}, `+${formatNumber(more)}`)] : []))
    if (!voting) ticker.replaceChildren(h('img', { src: heartIcon(), alt: '' }), h('span', {}, m.hallJoined(newest.handle, dayKey(new Date(newest.since)) === dayKey(today()))))
    el.classList.add('filled')
  })
  return el
}

/** The Hall da Fama as a rail tile: gold, its rays turning, sparkling while it calls the player to something (`hallCall`). Without accounts it opens the support page. */
const hallTile = (open: () => void) => {
  const m = t().home
  const call = hallCall()
  const el = railTile('hall', h('img', { src: supporterIcon('gold'), alt: '' }), m.rail.hall, hallLabel(call))
  el.prepend(h('span', { class: 'hall-rays', 'aria-hidden': 'true' }))
  if (call) el.append(h('img', { class: 'rail-sparkle', src: sparkleIcon(), alt: '' }))
  el.classList.toggle('waiting', call !== null)
  el.addEventListener('click', accountsEnabled ? open : () => (playSfx('select'), window.open(ROUTES.support[locale()], '_blank', 'noopener')))
  return el
}

/**
 * "<Name> te convidou!": a guest who came by a friend's link sees who and
 * what signing up brings (a Friendship Egg each). It shows once the
 * inviter's name comes back, and never offline; tapping it opens the account.
 */
const inviteBanner = (slot: HTMLElement, open: () => void, ready: (el: HTMLElement) => void) => {
  if (!accountsEnabled || accountState().kind === 'signedIn') return
  void inviterName().then((name) => {
    if (!name || !slot.isConnected || accountState().kind === 'signedIn') return
    const m = t().invite
    const el = h(
      'button',
      { class: 'invite-banner box pop', type: 'button', onclick: open },
      h('img', { src: eggIcon('friend'), alt: '' }),
      h('span', { class: 'invite-text' }, rich(m.banner(name), { class: 'invite-head' }), h('span', { class: 'invite-blurb' }, m.blurb)),
    )
    slot.append(el)
    ready(el)
  })
}

/**
 * Convide amigos, under the Hall: the Friendship Egg the first friend brings,
 * then how many friends counted toward the next milestone and what it pays.
 */
const invitesCard = () => {
  const m = t().invites
  const row = h('span', { class: 'lobby-invites-row' }, m.cardFirst)
  const prize = h('img', { class: 'lobby-invites-prize', src: eggIcon('friend'), alt: '' })
  const el = h(
    'button',
    { class: 'lobby-invites box', type: 'button', 'aria-label': `${m.title}: ${m.cardFirst}` },
    h('img', { class: 'lobby-invites-icon', src: eggIcon('friend'), alt: '' }),
    h('span', { class: 'lobby-invites-text' }, h('b', {}, m.title), row),
    prize,
  )
  void loadInvites().then((list) => {
    const friends = countedFriends(list)
    if (friends === 0) return
    const next = nextMilestone(friends)
    const text = next ? m.cardNext(friends, next.friends) : m.cardAll(friends)
    row.textContent = text
    el.setAttribute('aria-label', `${m.title}: ${text}`)
    if (next) prize.src = contentLine({ content: next.gifts[0] }).src
    else prize.remove()
  })
  return el
}

/** Convide amigos as a rail tile: the Friendship Egg, and in full for screen readers how far the next milestone is. */
const invitesTile = () => {
  const m = t().invites
  const el = railTile('invites', h('img', { class: 'lobby-invites-icon', src: eggIcon('friend'), alt: '' }), t().home.rail.invites, `${m.title}: ${m.cardFirst}`)
  void loadInvites().then((list) => {
    const friends = countedFriends(list)
    if (friends === 0) return
    const next = nextMilestone(friends)
    el.setAttribute('aria-label', `${m.title}: ${next ? m.cardNext(friends, next.friends) : m.cardAll(friends)}`)
  })
  return el
}

/* ---------------- The partner on stage ---------------- */

/** Art px of the stage canvas, and where the partner's feet stand in it. */
const STAGE = { w: 80, h: 64, feet: 58 } as const

/** Set once the partner first took a walk on this device: the stroll hint stops showing. */
const STROLLED = 'ps:strolled'
const hasStrolled = () => {
  try {
    return localStorage.getItem(STROLLED) !== null
  } catch {
    return true
  }
}

/** "WASD passear" (the bound keys) over the partner's head, or "tap the grass" on touch, until its first walk. */
const strollHint = () => {
  const m = t().home
  const keys = (['up', 'left', 'down', 'right'] as const).map((a) => h('span', { class: 'key-hint' }, boundKey(a)))
  return h('span', { class: 'lobby-stroll-hint', 'aria-hidden': 'true' }, h('span', { class: 'keys-only' }, ...keys, h('b', {}, m.stroll)), h('span', { class: 'touch-only' }, m.strollTouch))
}

/**
 * The saved partner (`save.partner`, its first stage, shiny if played so)
 * standing on the meadow, as big as the stage allows in whole pixels, over a
 * name plate. A tap on it (its body, `hit`, or the plate) does what JOGAR
 * does; the stage's empty corners are grass to walk on. Once it hops off to
 * take a walk (`setOut`), the meadow draws it instead and its spot waits
 * empty; `feet` is where it stands, in CSS px.
 */
const partnerStage = (onPlay: () => void) => {
  const save = loadSave()
  const form = PLAYABLE[save.partner].line[0]
  const shiny = playsShiny(save, save.partner)
  void loadSpecies(form.dex, shiny).catch(() => {})
  const canvas = h('canvas', { class: 'lobby-partner-sprite', width: STAGE.w, height: STAGE.h, 'aria-hidden': 'true' })
  const plate = h('span', { class: 'lobby-plate' }, h('b', {}, form.name), h('small', {}, `${t().home.change} ▸`))
  const hit = h('span', { class: 'lobby-partner-hit' })
  let out = false
  const hint = hasStrolled() ? null : strollHint()
  const partner = h('button', { class: 'lobby-partner', type: 'button', 'aria-label': `${form.name} · ${t().home.change}`, onclick: onPlay }, hint, canvas, hit, plate)
  const el = h('div', { class: 'lobby-stage' }, partner)
  const tick = (time: number) => {
    const dpr = uiDpr()
    const s = loadedSprites(form.dex, shiny)
    // A big legend (Lugia's wings) gets a wider stage, so it shows whole at a smaller scale instead of cropped and huge.
    const sw = Math.max(STAGE.w, (s?.bodyW ?? 0) + 16)
    const sh = Math.max(STAGE.h, (s?.bodyH ?? 0) + 14)
    const feet = sh - (STAGE.h - STAGE.feet)
    if (canvas.width !== sw || canvas.height !== sh) Object.assign(canvas, { width: sw, height: sh })
    const room = el.clientHeight - plate.offsetHeight - 8
    const k = Math.min(Math.round(4 * dpr), logoScale(sw, sh, el.clientWidth, Math.max(room, 1), dpr))
    pixelSize(canvas, k)
    const ctx = context2d(canvas)
    ctx.clearRect(0, 0, sw, sh)
    blitPacked(ctx, ellipse(13, 3, 'rgba(16, 24, 16, 0.3)'), sw / 2, feet)
    if (!s) return
    drawPokemon(ctx, s, 'Idle', 0, time, sw / 2, feet)
    // The tappable body: the sprite's, a few art px wider, over the canvas.
    const css = k / dpr
    const w = (s.bodyW + 8) * css
    const top = canvas.offsetTop + (feet - s.bodyH - 4) * css
    hit.style.cssText = `left:${canvas.offsetLeft + (canvas.offsetWidth - w) / 2}px;top:${top}px;width:${w}px;height:${(s.bodyH + 6) * css}px`
  }
  const setOut = (next: boolean) => {
    if (next === out) return
    out = next
    partner.classList.toggle('out', out)
    // Back from its walk, it hops onto the stage.
    partner.classList.toggle('landed', !out)
    if (out && hint) {
      hint.remove()
      try {
        localStorage.setItem(STROLLED, '1')
      } catch {
        // Private modes may refuse: the hint just shows again next time.
      }
    }
  }
  const feet = (): Vec => {
    const r = canvas.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + (r.height * STAGE.feet) / STAGE.h }
  }
  return { el, tick, setOut, feet, partner: { dex: form.dex, shiny } }
}

/* ---------------- Collection dock ---------------- */

/** A dock tile: icon, label, an optional badge and its key hint. */
const dockTile = (key: LobbyFocus, icon: string, label: string, hotkey: string, count = 0, aria = label) =>
  h(
    'button',
    { class: `lobby-tile box ${key}`, type: 'button', 'aria-label': aria },
    h('img', { src: icon, alt: '' }),
    h('span', {}, label),
    count > 0 && h('em', { class: 'lobby-badge' }, formatNumber(count)),
    h('span', { class: 'key-hint' }, hotkey),
  )

/** Set once the player opens Co-op on this device: the tile's NOVO tag goes for good. */
const COOP_SEEN = 'ps:coopSeen'

const coopSeen = () => {
  try {
    return localStorage.getItem(COOP_SEEN) !== null
  } catch {
    return true
  }
}

const markCoopSeen = () => {
  try {
    localStorage.setItem(COOP_SEEN, '1')
  } catch {
    // Private modes may refuse: the tag just shows again next time.
  }
}

/** Jogar junto's tile, tagged NOVO until the player first opens it. */
const coopTile = () => {
  const el = dockTile('coop', coopIcon(), t().coop.entry, 'J')
  if (!coopSeen()) el.append(h('em', { class: 'lobby-new' }, t().coop.fresh))
  return el
}

/** Set once the player first trains at the Dojo on this device: the tile's NOVO tag and Machoke's long hello go for good. */
const DOJO_SEEN = 'ps:dojoSeen'

const dojoSeen = () => {
  try {
    return localStorage.getItem(DOJO_SEEN) !== null
  } catch {
    return true
  }
}

const markDojoSeen = () => {
  try {
    localStorage.setItem(DOJO_SEEN, '1')
  } catch {
    // Private modes may refuse: the tag and the long hello just show again next time.
  }
}

/** The Dojo's tile (a Black Belt for an icon), tagged NOVO until the player first trains; a rail tile on phones held upright. */
const dojoTile = (rails: boolean) => {
  const icon = itemIcon('blackBelt')
  const el = rails ? railTile('dojo', h('img', { src: icon, alt: '' }), t().home.dojo, t().home.dojoLabel) : dockTile('dojo', icon, t().home.dojo, 'T', 0, t().home.dojoLabel)
  if (!dojoSeen()) el.append(h('em', { class: 'lobby-new' }, t().coop.fresh))
  return el
}

/* ---------------- Keyboard and gamepad ---------------- */

/** The arrows (and the pad) move between the lobby's buttons; the movement keys (WASD) walk the partner instead. */
const DIRECTIONS: Readonly<Record<string, Direction>> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }

/** A press that travels less than this (CSS px) is a tap: the partner walks there. Past it, it's a joystick. */
const TAP_SLOP = 12

/** Whether a press on `target` lands on the meadow rather than on a button, a card or a link. */
const onMeadow = (target: EventTarget | null) => target instanceof Element && !target.closest('button, a, input, select, .box')

/** The arrow that walks the same way as each movement key, during Passear (where the arrows have no buttons to move between). */
const ARROWS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' } as const

/** The movement keys held (WASD, or as rebound; the arrows too with `arrows`), normalized. */
const heldMove = (input: Input, arrows: boolean): Vec => {
  const held = (a: keyof typeof ARROWS) => (input.isHeld(ACTIONS[a].key) || (arrows && input.isHeld(ARROWS[a])) ? 1 : 0)
  const x = held('right') - held('left')
  const y = held('down') - held('up')
  const len = Math.hypot(x, y)
  return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 }
}

/** Shortcuts, shown as key hints on what they press (`C` belongs to the Trainer chip; P, E and Space are taken by the run's controls, and E talks to a shopkeeper the partner stands by). */
const HOTKEYS: Readonly<Record<string, LobbyFocus>> = { KeyF: 'festival', KeyJ: 'coop', KeyG: 'gifts', KeyN: 'news', KeyX: 'pokedex', KeyO: 'eggs', KeyL: 'mart', KeyT: 'dojo', KeyR: 'ranking', KeyI: 'ideas', KeyM: 'missions', KeyH: 'hall' }

/** The "Falar · E" bubble over a shopkeeper while the strolling partner stands close (a tap on it talks too). */
const talkPrompt = (onTalk: () => void) =>
  h(
    'button',
    { class: 'plaza-talk box hidden', type: 'button', onclick: onTalk },
    h('b', {}, t().plaza.talk),
    h('span', { class: 'key-hint' }, 'E'),
  )

/**
 * How the lobby goes to the Kecleon's shop: `shop` (the dock's Loja, a talk,
 * `?loja`) greets and opens the shop, `festival` (the festival's Hoje card,
 * `ps.festival('open')`, a talk at the fountain) opens the Festival da Praça's
 * sheet there (`plaque`, a talk at the donors' plaque, on its plaque tab),
 * `look` (dev, `ps.plaza()`) only goes there, for a look; Esc or Enter brings it back.
 */
export type ShopTrip = 'shop' | 'festival' | 'plaque' | 'look' | 'dojo'

/**
 * Title screen over the live meadow: the pixel logo and a blinking "press
 * start", then the lobby. The top bar holds the Trainer chip, the wallet,
 * the survey while it waits for an answer (it opens by itself once), Novidades, `?` (how to play) and the gear. Hoje has the day's cards (Surto, Desafio,
 * Missões), the Hall da Fama card sits beside them (Convide amigos, Discord and the official profiles
 * under it; on landscape phones Discord and the profiles move to the top bar; on phones held upright
 * every card shrinks to a tile on the side rails, the gift box and Passear join them and the profiles
 * move to the Discord screen), the saved partner stands
 * in the middle, and JOGAR goes with the collection dock (Pokédex, Ovos,
 * Loja, Ranking, Ideias, and Co-op where the build has it). Arrows move between all of them by where they are on
 * screen; Enter presses the highlighted one, JOGAR at first. The movement
 * keys, a tap on the grass or a drag (a joystick) send the partner off its
 * stage for a walk in the meadow (`Meadow`), where it greets the wild Pokémon.
 * Loja (or a talk with Kecleon on a walk) is a trip to the Kecleon plaza east
 * of home (`visitShop`), and `shop` starts on one once the lobby is up
 * (`instant`: already there; `back`: leaving the shop calls it instead of
 * walking home).
 * Passear (the paw beside the partner) puts the cards away and leaves the
 * meadow to walk in, with a back button: talks there open their sheets and
 * come back to it.
 * `intro: false` opens straight on the lobby (coming back from another
 * screen, or after a language switch), highlighting `focus`.
 */
export const titleScreen = (
  root: HTMLElement,
  input: Input,
  actions: TitleActions,
  opts: { intro?: boolean; focus?: LobbyFocus; shop?: ShopTrip; shelf?: VisitorShelf; instant?: boolean; back?: () => void },
): Screen => {
  const m = t().home
  const lang = locale()

  const logo = h('canvas', { class: 'title-logo', width: 1, height: 1, 'aria-hidden': 'true' })
  void titleLogo(halloweenToday()).then((sprite) => {
    logo.width = sprite.width
    logo.height = sprite.height
    context2d(logo).drawImage(sprite, 0, 0)
    fitLogo(logo, lobby === null)
    logo.classList.add('shown')
  })

  const prompt = h('p', { class: 'press-start blink' }, h('span', { class: 'keys-only' }, m.pressKeys), h('span', { class: 'touch-only' }, m.pressTouch))
  // The top bar waits for the lobby: the intro is just the logo and "press start".
  let bar: HTMLElement = h('span', { class: 'hidden' })
  const intro = shellBody(h('h1', { class: 'sr-only' }, 'Pokémon Survivors'), logo, prompt)
  // The Noite das Bruxas dresses the lobby in orange and purple (`style.css`).
  const el = h('div', { class: halloweenToday() ? 'screen shell title-home haunted' : 'screen shell title-home' }, bar, intro)

  let lobby: HTMLElement | null = null
  let tickers: ((time: number) => void)[] = []
  let stage: ReturnType<typeof partnerStage> | null = null
  /** A press on the meadow: a tap until it travels `TAP_SLOP`, then a joystick. */
  let drag: { id: number; origin: Vec; stick: Stick | null } | null = null
  /** A tap on the meadow, for the next frame to send the partner to. */
  let tap: Vec | null = null
  let current: LobbyFocus = opts.focus ?? 'play'
  let offKeys: (() => void) | null = null
  let closeChip: (() => void) | null = null
  let offIntro: (() => void) | null = null
  /** Settings, the Pokédex, the Trainer Card… open over the meadow. */
  let overScreen: Screen | null = null
  /** How this lobby lets the partner go (see `Meadow.meet`). */
  let leave: (() => void) | null = null
  /** A trip to the Kecleon's shop under way: going there, the shop open, or coming back. */
  let visit: { mode: ShopTrip; phase: 'going' | 'here' | 'shop' | 'back'; shelf?: VisitorShelf } | null = null
  /** Who the talk prompt is over: a shopkeeper, Meowth, a stall's keeper, the festival's fountain or plaque. */
  let talkWho: LobbyNpc = 'keeper'
  /** A seasonal stall's keeper talking, over the plaza (the lobby's keys wait). */
  let chat: Dialogue | null = null
  /** A sync landed during a trip: the lobby is rebuilt once back home (`refresh`). */
  let stale = false
  /** The top bar's wallet, refreshed when the shop closes. */
  let wallet: HTMLElement | null = null
  /** The Noite das Bruxas card (not the rail's tile), refreshed when the shop closes: the stall spends candies. */
  let candyCard: HTMLElement | null = null
  const talkButton = talkPrompt(() => talkTo(talkWho))
  /** Passear: the lobby's cards are away and the partner walks the meadow and the plaza; only the back button, the hint and the talk prompt stay. */
  let exploring = false
  const exploreHint = h(
    'p',
    { class: 'explore-hint', 'aria-hidden': 'true' },
    h('span', { class: 'keys-only' }, ...(['up', 'left', 'down', 'right'] as const).map((a) => h('span', { class: 'key-hint' }, boundKey(a))), h('b', {}, m.exploreKeys)),
    h('span', { class: 'touch-only' }, m.exploreTouch),
  )
  const exploreHud = h(
    'div',
    { class: 'explore-hud' },
    h(
      'button',
      { class: 'shell-btn shell-chip box explore-back', type: 'button', onclick: () => leaveExplore() },
      h('span', { class: 'back-arrow', 'aria-hidden': 'true' }, '◀'),
      h('b', {}, t().shell.back),
      h('span', { class: 'key-hint' }, 'ESC'),
    ),
    exploreHint,
  )

  /** Everything the arrows reach, wherever the layout puts it. */
  let navs: { el: HTMLElement; key: LobbyFocus }[] = []
  /** The element of `key`, while it shows (the gift box hides with nothing to open). */
  const itemOf = (key: LobbyFocus) => navs.find((n) => n.key === key && !n.el.hidden)?.el

  const select = (key: LobbyFocus, sound = true) => {
    if (key !== current && sound) playSfx('move')
    current = key
    for (const n of navs) n.el.classList.toggle('selected', n.key === key)
  }

  /** Makes `node` part of the arrows' tour as `key`; a mouse over it highlights it too. */
  const navigable = <T extends HTMLElement>(node: T, key: LobbyFocus) => {
    navs.push({ el: node, key })
    node.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && select(key, false))
    return node
  }

  const move = (dir: Direction) => {
    const shown = navs.filter((n) => !n.el.hidden)
    const next = shown[nearestInDirection(shown.map((n) => n.el.getBoundingClientRect()), shown.findIndex((n) => n.key === current), dir)]
    if (next) select(next.key)
  }

  /**
   * The lobby's cards are away (a trip to the shop, or Passear): out of reach
   * of taps and screen readers until they're back. They only slide off and
   * fade, still on the page, so without this a tap on the plaza would land on
   * the invisible buttons under it (the social links, the Hall…).
   */
  const setAway = () => {
    const away = exploring || (visit !== null && visit.phase !== 'back')
    for (const node of [bar, lobby]) {
      if (!node) continue
      node.inert = away
      if (away) node.setAttribute('aria-hidden', 'true')
      else node.removeAttribute('aria-hidden')
    }
  }

  /** The keys of whatever the lobby is doing when nothing else holds them: Passear's, or the lobby's own. */
  const restKeys = () => input.onKey(exploring ? exploreKey : lobbyKey)

  /** Another screen replaces the title (only the meadow stays): its keys stay off until that one closes and the title is rebuilt. */
  const openOver = (open: (focus: LobbyFocus) => Screen) => {
    offKeys?.()
    closeChip?.()
    offKeys = closeChip = null
    el.classList.add('hidden')
    leaveMeadow()
    // One screen over the title at a time: one left open under the new one would outlive the title (nothing would close it).
    overScreen?.dispose()
    overScreen = open(current)
  }

  const { ranking, ideas, coop } = actions
  const runs: Record<Exclude<LobbyFocus, 'trainer' | 'hall'>, () => void> = {
    help: () => location.assign(ROUTES.guide[lang]),
    settings: () => openOver(actions.settings),
    news: () => openOver(actions.news),
    survey: () => openOver(actions.survey),
    halloween: () => openOver(actions.halloween),
    festival: () => visitShop('festival'),
    discord: () => openOver(actions.discord),
    outbreak: () => toast(root, rich(`*${ENEMIES[outbreakToday()].name}*: ${t().outbreak.blurb}`), 3600, 'outbreak'),
    challenge: actions.challenge,
    missions: actions.missions,
    gifts: actions.gifts,
    invite: () => openOver(actions.trainer),
    friends: () => openOver(actions.invites),
    pokedex: () => openOver(actions.pokedex),
    eggs: actions.incubator,
    mart: () => visitShop('shop'),
    dojo: () => visitShop('dojo'),
    ranking: () => ranking && openOver(ranking),
    ideas: () => ideas && openOver(ideas),
    coop: () => (markCoopSeen(), coop?.()),
    play: actions.play,
    explore: () => enterExplore(),
    tiktok: () => openSocial('tiktok'),
    youtube: () => openSocial('youtube'),
    instagram: () => openSocial('instagram'),
  }
  /**
   * A press on `key`: the select sound, then its action after this dispatch (or the next screen would get the same press).
   * One per dispatch: Enter clicks the selected item and, when another lobby button holds the page's focus, the browser
   * clicks that one too; both opened a screen, and the first stayed behind the title for good (its Back did nothing).
   */
  // JOGAR isn't counted: the run's `run_end` already says it, and it's a third of the lobby's presses.
  let pressing = false
  const press = (key: keyof typeof runs) => () => {
    if (pressing) return
    pressing = true
    select(key, false)
    playSfx('select')
    if (key !== 'play') lobbyPress(key)
    later(() => {
      pressing = false
      runs[key]()
    })
  }
  const pressable = <T extends HTMLElement>(node: T, key: keyof typeof runs) => (node.addEventListener('click', press(key)), navigable(node, key))

  const buildLobby = () => {
    const save = loadSave()
    const landscape = layout() === 'landscape'
    navs = []
    const chip = trainerChip(input, { onOpen: () => (lobbyPress('trainer'), openOver(actions.trainer)) })
    closeChip = chip.dispose
    navigable(chip.el, 'trainer')
    const nextBar = topBar({
      left: chip.el,
      right: [
        (wallet = walletChip(save.wallet)),
        ...(landscape ? [navigable(discordButton(press('discord')), 'discord'), ...SOCIAL_IDS.map((id) => navigable(socialButton(id, press(id)), id))] : []),
        ...(surveyWaiting() ? [navigable(surveyButton(press('survey')), 'survey')] : []),
        navigable(newsButton(press('news')), 'news'),
        navigable(helpButton(press('help')), 'help'),
        navigable(gearButton(press('settings')), 'settings'),
      ],
    })
    bar.replaceWith(nextBar)
    bar = nextBar

    // Phones held upright get rails: each card shrinks to a tile at the edges, so the partner keeps the middle.
    const rails = layout() === 'narrow'
    const outbreak = rails ? outbreakTile() : outbreakCard()
    const was = stage?.partner
    stage = partnerStage(press('play'))
    const explore = pressable(exploreButton(), 'explore')
    const gift = pressable(giftButton(), 'gifts')
    if (!rails) stage.el.append(explore, gift)
    // Rebuilt with the same partner (`refresh`), a walk it's taking goes on and this lobby keeps its `leave`.
    if (!leave || was?.dex !== stage.partner.dex || was.shiny !== stage.partner.shiny) leave = actions.meadow.meet(stage.partner)
    tickers = [outbreak.tick, stage.tick]
    const openHall = () => (select('hall', false), playSfx('select'), lobbyPress('hall'), later(() => openOver((focus) => actions.supporters(focus, hallCall()))))
    const hall = navigable(rails ? hallTile(openHall) : hallCard(openHall), 'hall')
    const invites = accountsEnabled ? [pressable(rails ? invitesTile() : invitesCard(), 'friends')] : []
    // On the rails the profiles leave the lobby for the Discord screen (and Ajustes → Sobre); landscape phones hold them in the top bar.
    const community = rails
      ? [pressable(discordTile(), 'discord')]
      : landscape
        ? []
        : [h('div', { class: 'lobby-community' }, pressable(discordCard(), 'discord'), ...SOCIAL_IDS.map((id) => pressable(socialCard(id), id)))]
    const dojo = rails ? [pressable(dojoTile(true), 'dojo')] : []
    const side = h('div', { class: 'lobby-side' }, ...(rails ? [gift] : []), hall, ...invites, ...dojo, ...community, ...(rails ? [explore] : []))
    // A friend's invite needs the room of a banner: under the partner on the rails, under the Hall elsewhere.
    const notice = rails ? h('div', { class: 'lobby-notice' }) : side
    inviteBanner(notice, press('invite'), (banner) => navigable(banner, 'invite'))

    const ready = save.eggs.filter(isReady).length
    const tiles = [
      pressable(dockTile('pokedex', pokeballIcon(), m.pokedex, 'X'), 'pokedex'),
      pressable(dockTile('eggs', eggIcon('rare'), m.eggs, 'O', ready, ready > 0 ? `${m.eggs}: ${m.eggsReady(ready)}` : m.eggs), 'eggs'),
      pressable(dockTile('mart', coinIcon(2), m.mart, 'L'), 'mart'),
      // Phones held upright have it on the rail: their tab bar is full.
      ...(rails ? [] : [pressable(dojoTile(false), 'dojo')]),
      ...(ranking ? [pressable(dockTile('ranking', medalIcon('gold'), m.ranking, 'R'), 'ranking')] : []),
      ...(ideas ? [pressable(dockTile('ideas', bulbIcon(), m.ideas, 'I'), 'ideas')] : []),
    ]
    // Co-op sits right of JOGAR on wide screens (the right half's first tile), last on phones (`style.css`).
    if (coop) tiles.splice(Math.ceil((tiles.length + 1) / 2), 0, pressable(coopTile(), 'coop'))
    const play = pressable(h('button', { class: 'lobby-play', type: 'button' }, h('span', {}, m.play), h('span', { class: 'key-hint' }, 'ENTER')), 'play')
    // JOGAR sits in the middle of the dock on wide screens, between the two halves (centered however many tiles each has); the CSS moves it above the tab bar on phones.
    const half = Math.ceil(tiles.length / 2)
    const bottom = h(
      'div',
      { class: 'lobby-bottom', style: `--tiles:${tiles.length}` },
      h('div', { class: 'lobby-dock left' }, ...tiles.slice(0, half)),
      play,
      h('div', { class: 'lobby-dock right' }, ...tiles.slice(half)),
    )

    const todayEl = h(
      'section',
      { class: 'lobby-today', 'aria-label': m.today },
      h('h2', { class: 'lobby-rail-label' }, m.today),
      ...(halloweenCardShows() ? [pressable(rails ? halloweenTile() : (candyCard = halloweenCard()), 'halloween')] : []),
      ...(festivalCardShows() ? [pressable(rails ? festivalTile() : festivalCard(), 'festival')] : []),
      pressable(outbreak.el, 'outbreak'),
      pressable(rails ? challengeTile() : challengeCard(), 'challenge'),
      pressable(rails ? missionsTile() : missionsCard(), 'missions'),
    )
    const kind = ['lobby', rails ? 'rails' : '', tiles.length > 6 ? 'dock7' : tiles.length > 5 ? 'dock6' : ''].join(' ').trim()
    const next = h(
      'div',
      { class: kind },
      h('h1', { class: 'sr-only' }, 'Pokémon Survivors'),
      h('div', { class: 'lobby-logo' }, logo),
      todayEl,
      side,
      stage.el,
      rails && notice,
      bottom,
    )
    ;(lobby ?? intro).replaceWith(next)
    lobby = next
    if (logo.width > 1) fitLogo(logo, false)

    select(itemOf(current) ? current : 'play', false)
    offKeys = restKeys()
    setAway()
  }

  function lobbyKey(key: string) {
    const dir = DIRECTIONS[key]
    if (dir) return move(dir)
    if (key === 'Enter' || key === 'Space') return void itemOf(current)?.click()
    // Standing by a shopkeeper, E talks.
    if (key === 'KeyE' && !talkButton.classList.contains('hidden')) return void talkButton.click()
    const hot = HOTKEYS[key]
    const target = hot && itemOf(hot)
    if (hot && target) target.click()
  }

  /* ---------------- The trip to the Kecleon's shop ---------------- */

  /**
   * Goes to the shop: the lobby's cards slide off the edges, the camera pans
   * to the plaza and the partner hops along (`instant`: lands there at once).
   * There Kecleon hops, cries and says hello, then the shop opens over the
   * plaza (`TitleActions.mart`); closing it comes back (`goHome`).
   */
  function visitShop(mode: ShopTrip, instant = false, shelf?: VisitorShelf) {
    if (visit || !stage) return
    visit = { mode, phase: 'going', shelf }
    offKeys?.()
    offKeys = input.onKey(visitKey)
    el.classList.add('visiting')
    setAway()
    talkButton.classList.add('hidden')
    drag = null
    tap = null
    actions.meadow.stick(null)
    actions.meadow.steer({ x: 0, y: 0 }, null, stage.feet())
    actions.meadow.visit(visit.mode === 'dojo' ? 'dojo' : 'plaza', instant)
  }

  /** A talk at the plaza: the shop with a shopkeeper, the caravan's shelf with Meowth, a few words with a stall's keeper or Lanturn, the festival's sheet at the fountain (its plaque tab at the plaque). */
  function talkTo(who: LobbyNpc) {
    if (who === 'sensei') return visitShop('dojo')
    if (who === 'stall') return talkToStall()
    if (who === 'lanturn') return chatThen(lanturnSpeaker(), t().plaza.lanturn, () => visitShop('festival'))
    if (who === 'fountain') return visitShop('festival')
    if (who === 'plaque') return visitShop('plaque')
    visitShop('shop', false, who === 'meowth' ? 'caravan' : undefined)
  }

  /** The seasonal stall's keeper has a few words; its shelf in the shop follows when it sells something (Duskull's Haunted Egg). */
  function talkToStall() {
    const id = stallToday()
    if (id) chatThen(stallSpeaker(id), t().plaza.stalls[id], () => (stallGoods(id).length > 0 ? visitShop('shop', false, 'stall') : undefined))
  }

  /**
   * A visitor says its `lines` over the plaza while the lobby's keys wait,
   * then `next` runs (a trip that takes the keys); without one, the lobby's keys come back.
   */
  function chatThen(speaker: Speaker, lines: readonly string[], next: () => void) {
    if (chat || visit || !stage) return
    offKeys?.()
    offKeys = null
    talkButton.classList.add('hidden')
    playSfx('select')
    chat = dialogue(root, input, {
      speaker,
      lines: lines.map((text, i) => ({ text, emotion: i === 0 ? 'Happy' : 'Joyous' })),
      onDone: () =>
        later(() => {
          chat?.dispose()
          chat = null
          next()
          if (!visit) offKeys = restKeys()
        }),
    })
  }

  /** Keys during a trip: Esc or Backspace turns back on the way; for a look, Enter or Space too once there. */
  function visitKey(key: string) {
    if (!visit) return
    const back = key === 'Escape' || key === 'Backspace'
    if ((visit.phase === 'going' && back) || (visit.phase === 'here' && (back || key === 'Enter' || key === 'Space'))) goHome()
  }

  /** At the plaza: the shop opens, Kecleon talking beside it (a look just waits). At the Dojo, Machoke says hello and the Dojo opens. */
  const arrived = () => {
    if (!visit) return
    if (visit.mode === 'look') {
      visit.phase = 'here'
      return
    }
    visit.phase = 'shop'
    if (visit.mode === 'dojo') return greetAtDojo()
    if (visit.mode === 'festival' || visit.mode === 'plaque') overScreen = actions.festival(goHome, visit.mode === 'plaque' ? 'plaque' : 'fountain')
    else openShop(visit.shelf)
  }

  /** Machoke's hello at the Dojo (the long one the first time), then who trains; Esc during it turns back home. */
  function greetAtDojo() {
    const m = t().training
    const first = !dojoSeen()
    const lines = first ? m.first : [m.hello[Math.floor(Math.random() * m.hello.length)]!]
    chat = dialogue(root, input, {
      speaker: senseiSpeaker(),
      lines: lines.map((text, i) => ({ text, emotion: i === 0 ? 'Happy' : 'Joyous' })),
      onDone: () =>
        later(() => {
          chat?.dispose()
          chat = null
          markDojoSeen()
          actions.dojo()
        }),
    })
  }

  /** The shop over the plaza; its Festival button swaps it for the festival's sheet, whose Back brings the shop again. */
  function openShop(shelf?: VisitorShelf) {
    overScreen?.dispose()
    overScreen = actions.mart(goHome, shelf, () => {
      overScreen?.dispose()
      overScreen = actions.festival(() => openShop())
    })
  }

  /** Back from the shop: the camera pans home, the partner hops back to its stage and the lobby slides in (from Passear, the walk goes on at the plaza instead). */
  function goHome() {
    if (!visit || visit.phase === 'back') return
    overScreen?.dispose()
    overScreen = null
    // Opened from elsewhere (the partner select's wallet): back there instead of home.
    if (opts.back) return later(opts.back)
    el.classList.remove('visiting')
    const fresh = walletChip(loadSave().wallet)
    wallet?.replaceWith(fresh)
    wallet = fresh
    if (candyCard) fillHalloweenCard(candyCard)
    if (exploring) {
      actions.meadow.explore(true)
      return landed()
    }
    visit.phase = 'back'
    setAway()
    actions.meadow.visit('home')
  }

  const landed = () => {
    visit = null
    offKeys?.()
    offKeys = restKeys()
    setAway()
    if (stale) {
      stale = false
      refresh()
    }
  }

  /** Every frame of a trip: the stage keeps the partner's home in sync, and the trip moves on when the meadow gets there. */
  const travel = () => {
    if (!visit || !stage) return
    const { meadow } = actions
    meadow.steer({ x: 0, y: 0 }, null, stage.feet())
    stage.setOut(meadow.out())
    const at = meadow.at()
    if (visit.phase === 'going' && at === (visit.mode === 'dojo' ? 'dojo' : 'plaza')) arrived()
    else if (visit.phase === 'back' && at === 'home') landed()
  }

  /* ---------------- Passear ---------------- */

  /** Passear: the lobby's cards slide away and the partner hops into the meadow, the camera following it to the plaza and back; the back button (or Esc) brings them back. */
  function enterExplore() {
    if (exploring || visit || chat || !stage) return
    exploring = true
    el.classList.add('exploring')
    exploreHint.classList.remove('hidden')
    actions.meadow.explore(true)
    offKeys?.()
    offKeys = restKeys()
    setAway()
  }

  /** Leaves Passear (a stall keeper's talk under way ends with it): the cards come back and the partner heads for its stage. */
  function leaveExplore() {
    if (!exploring) return
    exploring = false
    chat?.dispose()
    chat = null
    el.classList.remove('exploring')
    talkButton.classList.add('hidden')
    actions.meadow.explore(false)
    offKeys?.()
    offKeys = restKeys()
    setAway()
  }

  /** Keys during Passear: Esc or Backspace comes back, E (or Enter) talks to whoever the partner stands by; the movement keys and the arrows walk (`stroll`). */
  function exploreKey(key: string) {
    if (key === 'Escape' || key === 'Backspace') return leaveExplore()
    if ((key === 'KeyE' || key === 'Enter' || key === 'Space') && !talkButton.classList.contains('hidden')) talkButton.click()
  }

  /** The lobby goes away (another screen over it, or for good): so does the partner, and any press on the meadow. */
  const leaveMeadow = () => {
    leave?.()
    leave = null
    actions.meadow.stick(null)
    actions.meadow.stageBox(null)
    stage = null
    drag = null
    tap = null
  }

  const onDown = (e: PointerEvent) => {
    if (!stage || drag || visit || (e.pointerType === 'mouse' && e.button !== 0)) return
    if (!onMeadow(e.target)) return
    drag = { id: e.pointerId, origin: { x: e.clientX, y: e.clientY }, stick: null }
  }
  const onMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    const at = { x: e.clientX, y: e.clientY }
    if (drag.stick || Math.hypot(at.x - drag.origin.x, at.y - drag.origin.y) >= TAP_SLOP) drag.stick = joystick(drag.stick?.origin ?? drag.origin, at)
  }
  const onUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    if (!drag.stick && e.type === 'pointerup') tap = drag.origin
    drag = null
  }
  el.addEventListener('pointerdown', onDown)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
  const offPointers = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
  }

  /** Every frame on the lobby: the keys, the stick or a tap steer the partner, and the stage shows it while it's home. */
  const stroll = () => {
    if (!stage) return
    const { meadow } = actions
    // A tap on a shopkeeper, the shop or the marker pointing to it goes shopping (Meowth's caravan, or a stall's keeper talks).
    const tapped = tap && meadow.tapsShop(tap)
    if (tapped) {
      tap = null
      return talkTo(tapped)
    }
    const move = drag?.stick?.vec ?? heldMove(input, exploring)
    // Passear's hint goes once the partner gets its first order.
    if (exploring && (tap || move.x !== 0 || move.y !== 0)) exploreHint.classList.add('hidden')
    meadow.steer(move, tap, stage.feet())
    meadow.stageBox(!exploring && layout() !== 'wide' ? stage.el.getBoundingClientRect() : null)
    meadow.stick(drag?.stick ?? null)
    tap = null
    stage.setOut(meadow.out())
    // By a shopkeeper, the talk prompt floats over its head.
    const spot = meadow.talkSpot()
    talkButton.classList.toggle('hidden', !spot)
    if (spot) talkWho = spot.who
    if (spot) talkButton.style.cssText = `left:${Math.round(spot.x / uiZoom())}px;top:${Math.round(spot.y / uiZoom())}px`
  }

  const enterLobby = () => {
    buildLobby()
    actions.ready()
    // `?loja` (and the dev's `ps.plaza()`) head for the shop once the lobby is laid out.
    const trip = opts.shop
    if (trip) requestAnimationFrame(() => visitShop(trip, opts.instant, opts.shelf))
    // Otherwise the survey asks by itself once; closed unanswered, its clipboard in the top bar keeps asking.
    else if (takeSurveyOffer()) openOver(actions.survey)
  }

  /**
   * A sync brought another device's progress (₽, the challenge, missions…):
   * the lobby is rebuilt in place on the same entry, the partner's walk
   * untouched. Not under another screen, which rebuilds the title as it closes;
   * on a trip to the shop it waits until the lobby is back home (`landed`).
   */
  const refresh = () => {
    if (visit) return void (stale = true)
    if (!lobby || overScreen || el.classList.contains('hidden')) return
    offKeys?.()
    closeChip?.()
    buildLobby()
  }
  const offSynced = onSaveSynced(refresh)
  // Each layout builds its own lobby (rails, cards, profiles in the top bar): a rotation or a resized window that switches it rebuilds.
  const layouts = [LANDSCAPE, NARROW].map((q) => matchMedia(q))
  for (const q of layouts) q.addEventListener('change', refresh)
  const offLayouts = () => layouts.forEach((q) => q.removeEventListener('change', refresh))

  if (opts.intro) {
    // Any key, pad button or tap. `later` keeps that same press from also pressing JOGAR.
    const start = () => {
      if (!offIntro) return
      playSfx('select')
      later(enterLobby)
      offIntro()
      offIntro = null
    }
    const offKey = input.onKey(start)
    const onTap = (e: Event) => e.target instanceof Element && !e.target.closest('a') && start()
    el.addEventListener('click', onTap)
    offIntro = () => (offKey(), el.removeEventListener('click', onTap))
  } else {
    enterLobby()
  }

  el.append(talkButton, exploreHud)
  root.append(el)
  return {
    el,
    dim: 0.12,
    tick: (time: number) => {
      overScreen?.tick?.(time)
      if (el.classList.contains('hidden')) return
      chat?.tick?.(time)
      if (visit) travel()
      else if (!chat) stroll()
      for (const tick of tickers) tick(time)
      if (logo.width > 1) fitLogo(logo, lobby === null)
    },
    dispose: () => (overScreen?.dispose(), chat?.dispose(), offIntro?.(), offKeys?.(), closeChip?.(), offSynced(), offLayouts(), offPointers(), leaveMeadow(), el.remove()),
  }
}
