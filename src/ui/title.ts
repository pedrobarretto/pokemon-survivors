import { realmHourTag } from './realmHour'
import { accountState, accountsEnabled, giftInbox, onInbox, onSaveSynced } from '../account'
import { lobbyPress } from '../analytics'
import { playSfx } from '../engine/audio'
import { ACTIONS } from '../engine/bindings'
import type { Input } from '../engine/input'
import { formatTime, type Dir8 } from '../engine/math'
import { blitPacked, blitCentered, context2d, ellipse } from '../engine/pixelart'
import { ENEMIES } from '../data/enemies'
import { GAME_MODES, type GameModeId } from '../data/gameModes'
import { HATCHLINGS, PLAYABLE } from '../data/hatchlings'
import { isLegend } from '../data/legends'
import { isReady } from '../game/eggs'
import { DISCORD_GIFT } from '../game/gifts'
import { missionStatus } from '../game/missions'
import { pendingPicks, playsShiny } from '../game/shinyPicks'
import { pollToVote, supporterCount, tierRank, type WallEntry } from '../game/supporters'
import { formatNumber, LOCALES, locale, t } from '../i18n'
import { arenaIcon, bulbIcon, chevronIcon, coinIcon, coopIcon, discordIcon, eggIcon, gearIcon, giftIcon, gridIcon, heartIcon, helpIcon, itemIcon, medalIcon, moveIcon, newsIcon, pokeballIcon, ribbonIcon, socialIcon, sparkleIcon, supporterIcon, surveyIcon } from '../render/art'
import { CAFE_PATRONS, cafeBubbles, cafePose, newCafePose } from '../render/cafeLife'
import { loadStage, stageHorizonRise, stageRidgeReach, type StageAnchor, type StageClouds, type StageSpan } from '../render/lobbyStage'
import { logoScale, titleLogo } from '../render/logo'
import { drawPokemon, loadedSprites, loadSpecies, type Dex } from '../render/sprites'
import type { Cover, Place } from '../render/titleScene'
import type { VisitorShelf } from './shop'
import { dialogue, type Dialogue } from './dialogue'
import { carpenterSpeaker, judgeSpeaker, senseiSpeaker, tailorSpeaker } from './visitors'
import { boutiqueSeen, type BoutiqueTab } from './boutiqueSeen'
import { gemChip } from './gemBits'
import { gemIconUrl } from '../render/gemArt'
import { inviterName } from '../ranking'
import { ROUTES, SOCIAL_IDS, SOCIALS, type SocialId } from '../site/routes'
import { fetchWall, knownStatus } from '../supporters'
import { h, later, rich } from './dom'
import { printedKeys } from './inputLabels'
import { challengeToday, halloweenToday, loadAttempt, loadSave, outbreakToday, today } from './save'
import { festivalBanner, festivalCard, festivalCardShows, type FestivalTab } from './festival'
import { fillHalloweenCard, halloweenCard, halloweenCardShows } from './halloween'
import { contentLine } from './gifts'
import { isUnread, latestUpdate } from './news'
import { hallFace, hallPortrait, type HallOpen } from './supporters'
import { designSurveyOffered, noteDesignSeen, surveyLabel, takeSurveyOffer, waitingSurvey, type SurveyId } from './survey'
import { takeInstallNudge } from './install'
import type { InstallOffer } from './installOffer'
import type { Screen } from './screens'
import { gearButton, iconButton, shellBody, topBar, walletChip } from './shell'
import { REALM_CROWD } from '../realm/entry'
import { realmIconUrl } from '../render/realmScene'
import { modeFacts, type ModeFacts } from './gameModes'
import { lobbyModeIn, loadLobbyMode, modeBeside, saveLobbyMode, shownModes } from './lobbyMode'
import { lobbySheet, type SheetEntry } from './lobbySheet'
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
  | 'boutique'
  | 'carpentry'
  | 'gems'
  | 'dojo'
  | 'ranking'
  | 'ideas'
  | 'coop'
  | 'realm'
  | 'arena'
  | 'legends'
  | 'community'
  | 'modes'
  | 'partner'
  | 'play'
  | SocialId

/**
 * The title's world: the side-view stage (`render/lobbyStage.ts`) on the rest
 * screen, and the top-down meadow (`render/titleScene.ts`) the lobby stands on,
 * under its cards and under a trip to the Kecleon plaza, the Boutique, the Dojo
 * or the Estádio.
 */
export type Meadow = {
  /**
   * Puts the partner at home in the meadow. Returns how this lobby lets it go: a no-op
   * once a newer lobby met it (the next title is built before this one goes).
   */
  meet: (partner: { dex: Dex; shiny: boolean }) => () => void
  /** Starts the camera's trip to a place or back home, the partner hopping along (`instant`: lands at once). */
  visit: (to: Place, instant?: boolean) => void
  /** Where the meadow rests, or `moving` during a trip. */
  at: () => Place | 'moving'
  /** Draws the rest screen's side-view stage this frame, standing on `at` (view px). */
  stage: (ctx: CanvasRenderingContext2D, dt: number, w: number, h: number, at: StageAnchor) => void
  /** The stage's clouds as images, placed each frame by `tickClouds`. */
  clouds: StageClouds['el']
  tickClouds: (w: number, horizon: number) => void
  /** Steps and draws the top-down meadow this frame: `covers` is what the lobby covers at home (the wild keep clear of it and the cast stands in for the partner), null on a trip. */
  draw: (ctx: CanvasRenderingContext2D, dt: number, w: number, h: number, covers: readonly Cover[] | null) => void
  /** CSS px per world px: how the DOM over the canvas lines up with it. */
  scale: () => number
}

export type TitleActions = {
  /** JOGAR on Survivors: the first run or the sign-in gate when due, then the Pokémon select, the saved partner picked. */
  play: () => void
  /** The partner pill: the Pokémon select, straight away. */
  partner: () => void
  /** JOGAR on Lendas: the Pokémon select on its Legends tab. */
  legends: () => void
  /** Opens Modos de jogo over the title; a pick lands back on the lobby with that mode. */
  modes: (focus: LobbyFocus, shown: readonly GameModeId[]) => Screen
  /** Opens the Desafio do dia. */
  challenge: () => void
  missions: () => void
  /** Opens the egg incubator. */
  incubator: () => void
  /** Opens the waiting Mystery Gifts (the Presentes card). */
  gifts: () => void
  /** The lobby is up: after the "press start" gesture, so the browser lets audio play. */
  ready: () => void
  /** Set, "press start" calls it instead of opening the lobby (a device's first run, `startFirstRun` in main.ts). */
  start?: () => void
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
  /** Opens the survey on the redesign over the title; the lobby opens it by itself once, like the difficulty one. */
  designSurvey: (focus: LobbyFocus) => Screen
  /** Opens the install offer over the title, like `settings`: the lobby opens it by itself, once per device (`takeInstallNudge`). */
  install: (offer: Exclude<InstallOffer, null>, focus: LobbyFocus) => Screen
  /** Opens the Discord screen (the community server, linking a Discord account) over the title, like `settings`. */
  discord: (focus: LobbyFocus) => Screen
  /** Opens the in-game Pokédex over the title; closing it rebuilds the title on `focus`, like `settings`. */
  pokedex: (focus: LobbyFocus) => Screen
  /**
   * Opens the shop over the Kecleon plaza once the camera got there (Kecleon
   * talks beside it, `ui/shop.ts`); its Back must call `close`, which pans
   * back home and brings the lobby back in. `shelf`: open on Meowth's caravan or a seasonal stall's shelf.
   * `festival` and `boutique` are its Festival and Boutique buttons (the lobby swaps the shop for that sheet).
   */
  mart: (close: () => void, shelf?: VisitorShelf, festival?: () => void, boutique?: () => void) => Screen
  /**
   * Opens the Festival da Praça's sheet over the Kecleon plaza once the camera
   * got there (`openFestival` in `ui/festival.ts`), on `tab`; `close` goes on
   * from it (home, or back to the shop it was opened from).
   */
  festival: (close: () => void, tab?: FestivalTab) => Screen
  /** Opens Leavanny's Boutique over the plaza once the camera got there (`openBoutique` in `ui/boutique.ts`), on `tab`; `close` goes home. */
  boutique: (close: () => void, tab: BoutiqueTab) => Screen
  /** The top bar's gem chip: the Boutique's Loja without the walk (`showBoutique`), back to the lobby. */
  gems: () => void
  /** Opens Bibarel's carpentry over the plaza once the camera got there (`openCarpentry` in `ui/carpentry.ts`); `close` goes home. */
  carpentry: (close: () => void) => Screen
  /** Opens the Trainer Card over the title (the Trainer chip, `C`, the invite banner), like `settings`. */
  trainer: (focus: LobbyFocus) => Screen
  /** Opens the boards over the title, like `settings`. No action (no API), no tile. */
  ranking?: (focus: LobbyFocus) => Screen
  /** Opens Ideias (the idea board) over the title, like `settings`. No action (no API), no entry. */
  ideas?: (focus: LobbyFocus) => Screen
  /** Opens Apoiadores over the title (the Hall da Fama card), like `settings`; `open` goes straight to the shiny picker or a poll. */
  supporters: (focus: LobbyFocus, open: HallOpen | null) => Screen
  /** Opens Convide amigos over the title (the Amigos tile), like `settings`. */
  invites: (focus: LobbyFocus) => Screen
  /** Jogar junto (co-op): the hub. No action (no relay in this build), no mode. */
  coop?: () => void
  /** The Poké Realm (`ui/realm.ts`), straight into a city. No action (no realm relay in this build), no mode. */
  realm?: () => void
  /** Today's Recados not collected yet (`realm/errands.ts`), for its chip; null when nobody can be asked. */
  realmErrands?: () => Promise<number> | null
  /** How many friends walk the Poké Realm now (`realm/friends.ts`), for its chip; null when nobody can be asked (a guest). */
  realmFriends?: () => Promise<number> | null
  /** How many trainers walk the Poké Realm now, for its way in; resolves to null offline. */
  realmCrowd?: () => Promise<number | null>
  /** Arena (Versus): its screen. Always there: against bots it needs no relay nor account. */
  arena: () => void
  /** The Dojo, once Machoke said hello: who trains (the partner select in its Dojo guise, `game/training.ts`). */
  dojo: () => void
  meadow: Meadow
}

/**
 * The lobby's three layouts, in sync with the media queries of the lobby's
 * section in `style.css`: phones on their side (a rail of tabs, the mode, Hoje
 * beside JOGAR), upright phones and tablets (one column over a tab bar) and
 * the rest (Hoje, the mode and Na Praça side by side).
 */
const LANDSCAPE = '(max-height: 500px) and (orientation: landscape)'
const NARROW = '(max-width: 899px) and (min-height: 501px), (orientation: portrait) and (max-width: 1100px)'
const layout = () => (matchMedia(LANDSCAPE).matches ? 'landscape' : matchMedia(NARROW).matches ? 'narrow' : 'wide')

/** Sizes a pixel-art canvas or image in `#ui` to `k` device px per art px (UI size included), so its pixels stay square. Touches the style only when it changes. */
const pixelSize = (el: HTMLCanvasElement | HTMLImageElement, k: number, w = el.width, h = el.height) => {
  const dpr = uiDpr()
  const width = `${(w * k) / dpr}px`
  const height = `${(h * k) / dpr}px`
  if (el.style.width === width && el.style.height === height) return
  el.style.width = width
  el.style.height = height
}

/** Fits the intro's logo to the viewport in whole device pixels per logo pixel. */
const fitLogo = (canvas: HTMLCanvasElement) => {
  const { w: vw, h: vh } = uiViewport()
  const [maxW, maxH] = [Math.min(vw * 0.9, 640), (vh - 60) * 0.4]
  pixelSize(canvas, logoScale(canvas.width, canvas.height, Math.max(maxW, 120), maxH, uiDpr()))
}

/* ---------------- Hoje: the day's cards ---------------- */

/** A Hoje card: its icon tile, the name over a line of live state, and an optional badge. */
const todayCard = (key: string, icon: Node, name: string, line: Node | string, badge: Node | null = null, hotkey: string | null = null) =>
  h(
    'button',
    { class: `arc-card lobby-day ${key}`, type: 'button' },
    h('span', { class: 'lobby-day-icon' }, icon),
    h('span', { class: 'lobby-day-text' }, h('b', {}, name), typeof line === 'string' ? h('small', {}, line) : line),
    badge,
    hotkey && h('span', { class: 'key-hint' }, printedKeys(hotkey)),
  )

const iconImg = (src: string, cls = 'lobby-icon') => h('img', { class: cls, src, alt: '' })

/** A red count, or nothing once it's 0. */
const countBadge = (n: number) => (n > 0 ? h('em', { class: 'arc-badge' }, formatNumber(n)) : null)
const callBadge = () => h('em', { class: 'arc-badge' }, '!')

/** Presentes: how many Mystery Gifts wait. Hidden while none does; it follows the inbox, so a gift a sync lists shows up with the lobby already open. */
const giftsCard = () => {
  const m = t().home
  const count = h('em', { class: 'arc-badge' })
  const line = h('small')
  const el = todayCard('gifts', iconImg(giftIcon()), m.gifts, line, count, 'G')
  const paint = (n: number) => {
    el.hidden = n === 0
    count.textContent = String(n)
    line.textContent = m.giftsToOpen(n)
    el.setAttribute('aria-label', t().gifts.buttonLabel(n))
  }
  paint(giftInbox().length)
  const off = onInbox((gifts) => (el.isConnected ? paint(gifts.length) : off()))
  return el
}

/** Today's Desafio do dia, and this device's official attempt at it once made. */
const challengeState = () => {
  const c = challengeToday()
  const attempt = loadAttempt()
  return { c, done: attempt?.day === c.day ? attempt : null }
}

/** Desafio do dia: today's attempt time once made, else the day's Pokémon, the ribbon it plays for and a "!". */
const challengeCard = () => {
  const m = t().home
  const { c, done } = challengeState()
  const line = done ? m.challengeDone(formatTime(done.time)) : m.challengeLine(PLAYABLE[c.starter].line[0].name)
  const el = todayCard('challenge', iconImg(ribbonIcon('gold')), m.challengeName, line, done ? null : callBadge())
  el.setAttribute('aria-label', `${m.challengeName}: ${done ? line : m.challengeOpen}`)
  return el
}

/** Ovos: what's ready to hatch, what's walking, or an empty incubator. */
const eggsCard = (ready: number, walking: number) => {
  const m = t().home
  const line = ready > 0 ? m.eggsReady(ready) : walking > 0 ? m.eggsWalking(walking) : m.eggsNone
  const el = todayCard('eggs', iconImg(eggIcon('rare')), m.eggs, line, countBadge(ready), 'O')
  el.setAttribute('aria-label', `${m.eggs}: ${line}`)
  return el
}

/** Today's daily missions: how many are done, out of how many. */
const dailyMissions = () => {
  const daily = missionStatus(loadSave().missions, today()).filter((s) => s.period === 'daily')
  const done = daily.filter((s) => s.done).length
  return { done, total: daily.length, left: daily.length - done }
}

/** Missões: today's missions done out of all, on a progress bar. */
const missionsCard = () => {
  const m = t().home
  const { done, total, left } = dailyMissions()
  const line = h(
    'span',
    { class: 'lobby-day-progress' },
    h('span', { class: 'lobby-progress' }, h('span', { style: `width:${total ? Math.round((done / total) * 100) : 0}%` })),
    h('b', {}, `${done}/${total}`),
  )
  const el = todayCard('missions', iconImg(medalIcon('silver')), m.missions, line, null, 'M')
  el.setAttribute('aria-label', `${m.missions}: ${m.missionsLeft(left)}`)
  return el
}

/** Surto do dia: the day's species walking on its canvas, which `tick` animates. */
const outbreakCard = () => {
  const m = t().home
  const def = ENEMIES[outbreakToday()]
  const walker = h('canvas', { class: 'lobby-walker', width: 30, height: 32, 'aria-hidden': 'true' })
  void loadSpecies(def.dex).catch(() => {})
  const tick = (time: number) => {
    pixelSize(walker, Math.max(1, Math.round(uiDpr())))
    const ctx = context2d(walker)
    ctx.clearRect(0, 0, walker.width, walker.height)
    const s = loadedSprites(def.dex)
    if (s) drawPokemon(ctx, s, 'Walk', 0, time, walker.width / 2, walker.height - 2)
  }
  const el = todayCard('outbreak', walker, m.outbreakName(def.name), m.outbreakLine, iconImg(sparkleIcon(), 'lobby-day-spark'))
  return { el, tick }
}

/* ---------------- Top bar ---------------- */

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
      el.append(callBadge())
    },
    () => {},
  )
  return el
}

/** The survey in the top bar while one waits for an answer (`waitingSurvey`): a clipboard under a red "!", like unread Novidades. */
const surveyButton = (survey: SurveyId, onClick: () => void) => {
  const el = iconButton(surveyIcon(), surveyLabel(survey), onClick)
  el.classList.add('lobby-survey')
  el.append(callBadge())
  return el
}

/** Opens an official profile in a new tab (or its app). */
const openSocial = (id: SocialId) => window.open(SOCIALS[id].url, '_blank', 'noopener')

/* ---------------- Hall da Fama ---------------- */

/** Who the Hall strip shows first: Diamond, then Gold, then supporters, then who came first. */
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
  return call === null ? t().home.hallName : `${t().home.hallName} · ${call === 'pick' ? m.banner : m.voteWaiting}`
}

/** Who joined the wall last: the latest first support, whatever the API's order. */
const newestOf = (entries: readonly WallEntry[]) => entries.reduce<WallEntry | undefined>((newest, e) => (!newest || e.since.localeCompare(newest.since) >= 0 ? e : newest), undefined)

/** Faces the Hall card holds; a Poké Ball rests in each until the wall arrives, so nothing moves when it does. */
const HALL_FACES = 4

/**
 * The Hall da Fama card: gold, its name and how many support the game (off
 * the wall too, so the number never drops when one hides), the first
 * supporters' faces and who joined last. Until the wall comes back, offline
 * or with nobody on it, Poké Balls hold the faces' places and it asks for
 * support, in the same shape. It sparkles while it calls the player to
 * something (`hallCall`). Without accounts it's a link to the support page.
 */
const hallStrip = (open: () => void) => {
  const m = t().home
  const call = hallCall()
  const stack = h('span', { class: 'hall-stack' }, ...Array.from({ length: HALL_FACES }, () => h('span', { class: 'hall-face portrait' }, h('img', { src: pokeballIcon(), alt: '' }))))
  const number = h('span', { class: 'hall-number' })
  const newest = h('span', { class: 'hall-newest' }, h('img', { class: 'hall-heart', src: heartIcon(), alt: '' }), h('span', { class: 'hall-newest-text' }, m.support))
  const label = hallLabel(call)
  const kids = [
    h('span', { class: 'hall-head' }, h('b', {}, m.hallName), h('span', { class: 'hall-count' }, h('img', { class: 'hall-heart', src: call ? sparkleIcon() : heartIcon(), alt: '' }), number)),
    h('span', { class: 'hall-row' }, stack, newest),
    h('span', { class: 'key-hint' }, 'H'),
  ]
  const attrs = { class: call ? 'arc-card lobby-hall waiting' : 'arc-card lobby-hall', 'aria-label': label, title: label }
  const el = accountsEnabled
    ? h('button', { ...attrs, type: 'button', onclick: open }, ...kids)
    : h('a', { ...attrs, href: ROUTES.support[locale()], target: '_blank', rel: 'noopener', onclick: () => playSfx('select') }, ...kids)
  void fetchWall().then((wall) => {
    const last = wall && newestOf(wall.entries)
    if (!wall || !last) return
    const count = supporterCount(wall)
    number.textContent = formatNumber(count)
    const others = wall.entries.filter((e) => e !== last).sort(byStanding).slice(0, HALL_FACES)
    if (others.length > 0) stack.replaceChildren(...others.map(wallFace))
    else stack.remove()
    newest.replaceChildren(wallFace(last), h('span', { class: 'hall-newest-text' }, h('em', {}, m.hallNewest), ' ', h('b', {}, last.name)))
    const full = `${label} · ${m.hallCount(count, formatNumber(count))} · ${m.hallNewest} ${last.name}`
    el.setAttribute('aria-label', full)
    el.title = full
  })
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
      { class: 'invite-banner arc-card pop', type: 'button', onclick: open },
      h('img', { src: eggIcon('friend'), alt: '' }),
      h('span', { class: 'invite-text' }, rich(m.banner(name), { class: 'invite-head' }), h('span', { class: 'invite-blurb' }, m.blurb)),
    )
    slot.append(el)
    ready(el)
  })
}

/* ---------------- Seen flags ---------------- */

/** A device flag: `key` set once something happened. Private modes may refuse the write: it just shows again next time. */
const seenFlag = (key: string) => ({
  seen: () => {
    try {
      return localStorage.getItem(key) !== null
    } catch {
      return true
    }
  },
  mark: () => {
    try {
      localStorage.setItem(key, '1')
    } catch {
      // Nothing to do.
    }
  },
})

/** Set once the player opens Co-op on this device. */
const COOP = seenFlag('ps:coopSeen')
/** Set once the player opens the Arena on this device. */
const ARENA = seenFlag('ps:arenaSeen')
/** Set once Bibarel first said its long hello on this device (`greetAtCarpentry`). */
const CARPENTRY = seenFlag('ps:carpentrySeen')
/** Set once the player first trains at the Dojo on this device: Machoke's long hello goes for good. */
const DOJO = seenFlag('ps:dojoSeen')
/** Set once Ninjask first greets the player at the Estádio on this device: its long hello goes for good. */
const STADIUM = seenFlag('ps:stadiumSeen')

/* ---------------- The mode's cast ---------------- */

/** A Pokémon of the cast: `x` from the middle (art px). `team` paints its ground (the Arena's sides). */
type Figure = { dex: Dex; shiny: boolean; x: number; dir: Dir8; team?: 'blue' | 'red' }
/** Who stands in the meadow for a mode: figures, a picture beside them (`img`: feet at `x`), the ribbon over the day's Pokémon, how much smaller than the partner its art is drawn (`shrink`), and the patrons around the Realm's café (`cafe`, `render/cafeLife.ts`). */
type Cast = { figures: readonly Figure[]; img?: { src: string; x: number }; ribbon?: boolean; shrink?: number; cafe?: boolean }

const ASSETS = `${import.meta.env.BASE_URL}assets`

const figure = (dex: Dex, x: number, dir: Dir8, team?: Figure['team']): Figure => ({ dex, shiny: false, x, dir, team })

/** What each mode stands in the meadow. */
const castOf = (mode: GameModeId): Cast => {
  const save = loadSave()
  const partner = PLAYABLE[save.partner].line[0]
  if (mode === 'survivors') return { figures: [{ dex: partner.dex, shiny: playsShiny(save, save.partner), x: 0, dir: 0 }] }
  if (mode === 'legends') {
    const legend = isLegend(save.partner) ? partner.dex : 382
    return { figures: [figure(legend, 0, 0)] }
  }
  if (mode === 'challenge') return { figures: [figure(PLAYABLE[challengeToday().starter].line[0].dex, 0, 0)], ribbon: true }
  if (mode === 'coop') return { figures: [figure(1, -38, 0), figure(25, 0, 0), figure(7, 38, 0)] }
  if (mode === 'arena') return { figures: [figure(448, -58, 2, 'blue'), figure(6, -24, 2, 'blue'), figure(445, 24, 6, 'red'), figure(94, 58, 6, 'red')] }
  if (mode === 'dojo') return { figures: [figure(67, -20, 2)], img: { src: `${ASSETS}/dojo/dummy.png`, x: 20 } }
  return { figures: [], img: { src: `${ASSETS}/realm/cafe.png`, x: 0 }, shrink: 2, cafe: true }
}

/** How big the cast stands in each layout, in CSS px per art px; the mockups' sizes. */
const CAST_CSS = { wide: 4, narrow: 3, landscape: 3 } as const

/**
 * The mode's cast on its own canvas over its slot in the meadow: in whole
 * device pixels per art pixel, as big as the layout asks and as the slot has
 * room for (a big legend's wings, a two-team Arena), the feet at the slot's
 * bottom, each with its shadow on the grass.
 */
const castPainter = (canvas: HTMLCanvasElement, slot: HTMLElement) => {
  let cast: Cast = { figures: [] }
  let picture: HTMLImageElement | null = null
  /** The cast's half width and height (local CSS px), which the meadow's wild keep clear of. */
  const box = { half: 0, tall: 0 }
  const pose = newCafePose()
  const ribbon = new Image()
  ribbon.src = ribbonIcon('gold')
  const set = (mode: GameModeId) => {
    cast = castOf(mode)
    picture = null
    if (cast.img) {
      picture = new Image()
      picture.src = cast.img.src
    }
    for (const f of cast.figures) void loadSpecies(f.dex, f.shiny).catch(() => {})
    if (cast.cafe) for (const p of CAFE_PATRONS) void loadSpecies(p.dex).catch(() => {})
  }
  const tick = (time: number) => {
    const { clientWidth: slotW, clientHeight: slotH } = slot
    if (slotW === 0 || slotH === 0) return
    const dpr = uiDpr()
    const want = Math.round((CAST_CSS[layout()] * dpr) / (cast.shrink ?? 1))
    // Cast extents in art px: the widest and tallest it may need, so nothing clips.
    const sprites = cast.figures.map((f) => loadedSprites(f.dex, f.shiny))
    const half = Math.max(16, picture?.complete ? (picture.naturalWidth / 2 + Math.abs(cast.img!.x)) : 0, ...sprites.map((s, i) => Math.abs(cast.figures[i]!.x) + (s ? s.bodyW / 2 + 6 : 16)))
    const tall = Math.max(40, picture?.complete ? picture.naturalHeight + 4 : 0, ...sprites.map((s) => (s ? s.bodyH + 18 : 40)))
    const k = Math.max(1, Math.min(want, Math.floor((slotW * dpr) / (half * 2)), Math.floor((slotH * dpr) / tall)))
    box.half = Math.round((half * k) / dpr)
    box.tall = Math.round((tall * k) / dpr)
    const w = Math.ceil((slotW * dpr) / k)
    const h = Math.ceil((slotH * dpr) / k)
    if (canvas.width !== w || canvas.height !== h) Object.assign(canvas, { width: w, height: h })
    pixelSize(canvas, k)
    const ctx = context2d(canvas)
    ctx.clearRect(0, 0, w, h)
    const mid = Math.floor(w / 2)
    const feet = h - 3
    for (const [i, f] of cast.figures.entries()) {
      const s = sprites[i]
      if (f.team) blitPacked(ctx, ellipse(13, 3, f.team === 'blue' ? 'rgba(48,112,224,0.5)' : 'rgba(232,64,47,0.5)'), mid + f.x, feet)
      else blitPacked(ctx, ellipse(Math.max(8, Math.round((s?.bodyW ?? 14) * 0.55)), 3, 'rgba(16,24,16,0.3)'), mid + f.x, feet)
      if (s) drawPokemon(ctx, s, 'Idle', f.dir, time + i * 0.4, mid + f.x, feet)
    }
    if (picture?.complete && picture.naturalWidth > 0 && cast.img) ctx.drawImage(picture, mid + cast.img.x - Math.floor(picture.naturalWidth / 2), feet + 2 - picture.naturalHeight)
    if (cast.cafe) {
      for (const p of CAFE_PATRONS) {
        cafePose(p, time, pose)
        const s = loadedSprites(p.dex)
        if (!s || pose.gone) continue
        const x = mid + Math.round(pose.x)
        blitPacked(ctx, ellipse(Math.max(6, Math.round(s.bodyW * 0.45)), 2, 'rgba(16,24,16,0.3)'), x, feet)
        drawPokemon(ctx, s, pose.anim, pose.dir, time, x, feet)
        if (pose.bubble) blitCentered(ctx, cafeBubbles()[pose.bubble], x, feet - s.bodyH - 9 - (Math.floor(time * 2.5) % 2))
      }
    }
    if (cast.ribbon && ribbon.complete) {
      const top = sprites[0]?.bodyH ?? 28
      ctx.drawImage(ribbon, mid - Math.floor(ribbon.naturalWidth / 2), feet - top - ribbon.naturalHeight - 3 - (Math.floor(time * 2) % 2))
    }
  }
  return { set, tick, box }
}

/* ---------------- What covers the meadow ---------------- */

/** What the lobby puts over the meadow, top bar included. Hoje's row scrolls sideways on a phone: its whole strip counts there. */
const COVERING = '.shell-slot > *, .lobby-col-head, .lobby-wide .lobby-today-cards > *, .lobby-narrow .lobby-today-cards, .lobby-landscape .lobby-today-cards, .lobby-plaza > :not(header), .lobby-notice > *, .lobby-mode-title, .lobby-pills > *, .lobby-arrow, .lobby-modes, .lobby-bottom > *, .lobby-play, .lobby-tabs'

/** The boxes of the lobby's blocks and of its cast (view px), for the wild in the meadow to keep clear of. */
const lobbyCovers = (screen: HTMLElement, slot: DOMRect, cast: { half: number; tall: number }, zoom: number, scale: number): Cover[] => {
  const covers: Cover[] = []
  for (const block of screen.querySelectorAll(COVERING)) {
    const r = block.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) covers.push({ left: r.left / scale, top: r.top / scale, right: r.right / scale, bottom: r.bottom / scale })
  }
  const middle = slot.left + slot.width / 2
  covers.push({ left: (middle - cast.half * zoom) / scale, top: (slot.bottom - cast.tall * zoom) / scale, right: (middle + cast.half * zoom) / scale, bottom: slot.bottom / scale })
  return covers
}

/* ---------------- Keyboard and gamepad ---------------- */

/** The arrows (and the pad) move between the lobby's buttons, the movement keys too. */
const DIRECTIONS: Readonly<Record<string, Direction>> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', [ACTIONS.up.key]: 'up', [ACTIONS.down.key]: 'down', [ACTIONS.left.key]: 'left', [ACTIONS.right.key]: 'right' }

/** Shortcuts, shown as key hints on what they press (`C` belongs to the Trainer chip; `Q`/`E` cycle the modes, 1 to 7 pick one). */
const HOTKEYS: Readonly<Record<string, LobbyFocus>> = { KeyF: 'festival', KeyG: 'gifts', KeyN: 'news', KeyX: 'pokedex', KeyO: 'eggs', KeyL: 'mart', KeyR: 'ranking', KeyU: 'community', KeyB: 'friends', KeyM: 'missions', KeyH: 'hall' }

/**
 * How the lobby goes to the Kecleon's shop: `shop` (the Loja tile and card, `?loja`) greets and
 * opens the shop, `festival` (the Festival card, `ps.festival('open')`) opens the Festival da
 * Praça's sheet there, `look` (dev, `ps.plaza()`) only goes there, for a look; Esc or Enter brings
 * it back. `boutique` (the Boutique card, the shop's Boutique button, `?boutique`) goes to
 * Leavanny's Boutique on the plaza's north-west and opens it on Loja (`locker`: on Visual, the
 * Trainer Card's row); walking there, Leavanny says hello first. `carpentry` goes to Bibarel's
 * carpentry on the plaza's north-east, where it says hello and opens its sheet. `dojo` and
 * `stadium` go west to the Dojo and south to the Estádio instead, where Machoke or Ninjask says hello.
 */
export type ShopTrip = 'shop' | 'festival' | 'look' | 'boutique' | 'skins' | 'locker' | 'carpentry' | 'dojo' | 'stadium'

/** The place a trip goes to. */
const tripPlace = (mode: ShopTrip): Place =>
  mode === 'dojo' || mode === 'stadium' || mode === 'carpentry' ? mode : mode === 'boutique' || mode === 'skins' || mode === 'locker' ? 'boutique' : 'plaza'

/** What the wipe in and out of a trip lasts, each way (s). */
const WIPE_TIME = 0.28
/** The wipe's circle grows in steps this big (CSS px), so it reads as pixel art. */
const WIPE_STEP = 14
/** The trip sound's own length and a little (ms): a leg turned back at once doesn't stack a second one on it. */
const TRIP_SOUND_GAP = 420
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

/** The press behind a mode's chip or a keyboard pick. */
type NavKey = LobbyFocus | `mode-${GameModeId}` | `tab-${TabId}` | 'prev' | 'next'

type TabId = 'home' | 'collection' | 'plaza' | 'social' | 'profile'
const TAB_IDS: readonly TabId[] = ['home', 'collection', 'plaza', 'social', 'profile']

/** A mode's little icon for the bar and JOGAR's world. */
const modeIcon = (id: GameModeId) =>
  ({ survivors: pokeballIcon(), legends: moveIcon('dragonAscent'), challenge: ribbonIcon('gold'), coop: coopIcon(), arena: arenaIcon(), dojo: itemIcon('blackBelt'), realm: realmIconUrl('wave') })[id]

/** The name-only line under JOGAR: the mode and the first thing it says about itself. */
const playLine = (id: GameModeId, facts: ModeFacts) => [t().gameModes.names[id], facts.tags.at(0)?.text].filter(Boolean).join(' · ')

/**
 * Title screen: the pixel logo and a blinking "press start" on the side-view
 * stage, then the lobby on the top-down meadow. The top bar holds the Trainer chip, the wallet, the
 * gems, a survey while one waits for an answer (each opens by itself once),
 * Novidades and the gear. Hoje has the day's cards (Presentes, Desafio, Ovos,
 * Missões, Surto; events too), Na Praça the Festival, the Kecleon shop, the
 * Boutique, the carpentry and the Hall da Fama. In the middle stands the mode
 * on show: its name, its pills, the cast and a round arrow for the mode either
 * side; the bar under it picks any of the 7, and JOGAR does the mode. The dock
 * has the collection, on a phone the bottom tabs and their sheets hold what has
 * no room. Arrows move between all of them by where they are on screen; Enter
 * presses the highlighted one, JOGAR at first. Going to the Loja, Boutique,
 * Dojo, Estádio or Festival is a trip across the meadow (`visitShop`), through
 * a wipe each way; `shop` starts on one once the lobby is up
 * (`instant`: already there; `back`: leaving the shop calls it instead of
 * going home). `intro: false` opens straight on the lobby (coming back from
 * another screen, or after a language switch), highlighting `focus`.
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
    fitLogo(logo)
    logo.classList.add('shown')
  })

  const prompt = h('p', { class: 'press-start blink' }, h('span', { class: 'keys-only' }, m.pressKeys), h('span', { class: 'touch-only' }, m.pressTouch))
  // The top bar waits for the lobby: the intro is just the logo and "press start".
  let bar: HTMLElement = h('span', { class: 'hidden' })
  const intro = shellBody(h('h1', { class: 'sr-only' }, 'Pokémon Survivors'), logo, prompt)
  const wipeEl = h('div', { class: 'lobby-wipe hidden', 'aria-hidden': 'true' })
  // The Noite das Bruxas dresses the lobby in orange and purple (`style.css`).
  const el = h('div', { class: halloweenToday() ? 'screen shell title-home haunted' : 'screen shell title-home' }, actions.meadow.clouds, bar, intro, wipeEl)

  let lobby: HTMLElement | null = null
  let tickers: ((time: number) => void)[] = []
  let current: NavKey = opts.focus ?? 'play'
  let offKeys: (() => void) | null = null
  let closeChip: (() => void) | null = null
  let offIntro: (() => void) | null = null
  /** Settings, the Pokédex, the Trainer Card… open over the lobby. */
  let overScreen: Screen | null = null
  /** How this lobby lets the partner go (see `Meadow.meet`). */
  let leave: (() => void) | null = null
  /** The partner the meadow holds, to meet it again only when it changes. */
  let met: { dex: Dex; shiny: boolean } | null = null
  /** A trip to the Kecleon's shop under way: going there, the shop open, or coming back (`landing`: the wipe home). */
  let visit: { mode: ShopTrip; phase: 'going' | 'here' | 'shop' | 'back' | 'landing'; shelf?: VisitorShelf; instant: boolean } | null = null
  /** A visitor talking, over the plaza (the lobby's keys wait). */
  let chat: Dialogue | null = null
  /** A sync landed during a trip: the lobby is rebuilt once back home (`refresh`). */
  let stale = false
  /** The top bar's wallet, refreshed when the shop closes. */
  let wallet: HTMLElement | null = null
  /** The Noite das Bruxas card, refreshed when the shop closes: the stall spends candies. */
  let candyCard: HTMLElement | null = null
  /** A sheet open over the lobby (Comunidade, a bottom tab's). */
  let sheet: Screen | null = null

  /** On a trip the meadow's partner hops along; at home the cast stands in for it. */
  let onTrip = false
  /** The slot the cast stands in; null while the intro shows. */
  let slot: HTMLElement | null = null
  /** What the wild keep clear of at home: measured a few times a second, the same array while nothing moved. */
  let covers: readonly Cover[] = []
  let coversKey = ''
  let measureAge = 0
  /** The cast's size (local CSS px), for `covers`. */
  let castBox = { half: 0, tall: 0 }
  /** What walkers on the rest screen's ridge keep out of: the logo. */
  let restStanding: readonly StageSpan[] = []
  /** The circle wiping in and out of a trip: closing, `mid` swaps what's behind it, then it opens and `done` runs. */
  let wipe: { t: number; closing: boolean; mid: () => void; done: () => void } | null = null

  const hiddenModes = [...(actions.coop ? [] : (['coop'] as const)), ...(actions.realm ? [] : (['realm'] as const))]
  const modes = shownModes(hiddenModes)
  let mode = lobbyModeIn(loadLobbyMode(), modes)
  if (opts.intro) loadStage()
  /** Set by `buildLobby`: repaints what follows the selected mode (its name, its pills, the cast, the arrows, the bar, JOGAR). */
  let paintMode: () => void = () => {}

  const setMode = (id: GameModeId, sound = true) => {
    if (id === mode) return
    if (sound) playSfx('move')
    mode = id
    saveLobbyMode(id)
    paintMode()
  }

  /* ---------- The arrows' tour ---------- */

  /** Everything the arrows reach, wherever the layout puts it. */
  let navs: { el: HTMLElement; key: NavKey }[] = []
  /** The element of `key`, while it shows (Presentes hides with nothing to open). */
  const itemOf = (key: NavKey) => navs.find((n) => n.key === key && !n.el.hidden)?.el

  const select = (key: NavKey, sound = true) => {
    if (key !== current && sound) playSfx('move')
    current = key
    for (const n of navs) n.el.classList.toggle('selected', n.key === key)
    // Hoje's row and the mode bar scroll sideways on a phone: what the arrows land on comes into view.
    itemOf(key)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  /** Makes `node` part of the arrows' tour as `key`; a mouse over it highlights it too. */
  const navigable = <T extends HTMLElement>(node: T, key: NavKey) => {
    navs.push({ el: node, key })
    node.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && select(key, false))
    return node
  }

  const move = (dir: Direction) => {
    const shown = navs.filter((n) => !n.el.hidden && n.el.isConnected)
    const next = shown[nearestInDirection(shown.map((n) => n.el.getBoundingClientRect()), shown.findIndex((n) => n.key === current), dir)]
    if (next) select(next.key)
  }

  /**
   * The lobby's cards are away during a trip: out of reach of taps and screen
   * readers until they're back. They only fade, still on the page, so without
   * this a tap on the plaza would land on the invisible buttons under it.
   */
  const setAway = () => {
    const away = visit !== null
    for (const node of [bar, lobby]) {
      if (!node) continue
      node.inert = away
      if (away) node.setAttribute('aria-hidden', 'true')
      else node.removeAttribute('aria-hidden')
    }
  }

  /** The keys of the lobby, when nothing else holds them. */
  const restKeys = () => input.onKey(lobbyKey)

  /** Another screen replaces the title (only the backdrop stays): its keys stay off until that one closes and the title is rebuilt. */
  const openOver = (open: (focus: LobbyFocus) => Screen) => {
    offKeys?.()
    closeChip?.()
    offKeys = closeChip = null
    closeSheet()
    el.classList.add('hidden')
    leaveMeadow()
    // One screen over the title at a time: one left open under the new one would outlive the title (nothing would close it).
    overScreen?.dispose()
    overScreen = open(current.startsWith('mode-') || current.startsWith('tab-') || current === 'prev' || current === 'next' ? 'play' : (current as LobbyFocus))
  }

  const { ranking, ideas, coop, realm } = actions
  const runs: Record<Exclude<LobbyFocus, 'trainer' | 'hall'>, () => void> = {
    help: () => location.assign(ROUTES.guide[lang]),
    settings: () => openOver(actions.settings),
    news: () => openOver(actions.news),
    survey: () => openOver(waitingSurvey() === 'design' ? actions.designSurvey : actions.survey),
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
    boutique: () => visitShop('boutique'),
    carpentry: () => visitShop('carpentry'),
    gems: actions.gems,
    dojo: () => visitShop('dojo'),
    ranking: () => ranking && openOver(ranking),
    ideas: () => ideas && openOver(ideas),
    coop: () => (COOP.mark(), coop?.()),
    realm: () => realm?.(),
    arena: () => visitShop('stadium'),
    legends: actions.legends,
    community: () => openCommunity(),
    modes: () => openOver((focus) => actions.modes(focus, modes)),
    partner: actions.partner,
    play: () => playRuns[mode](),
    tiktok: () => openSocial('tiktok'),
    youtube: () => openSocial('youtube'),
    instagram: () => openSocial('instagram'),
  }
  /** JOGAR, by the selected mode. */
  const playRuns: Record<GameModeId, () => void> = {
    survivors: actions.play,
    legends: runs.legends,
    challenge: runs.challenge,
    coop: runs.coop,
    arena: runs.arena,
    dojo: runs.dojo,
    realm: runs.realm,
  }
  /**
   * A press on `key`: the select sound, then its action after this dispatch (or the next screen would get the same press).
   * One per dispatch: Enter clicks the selected item and, when another lobby button holds the page's focus, the browser
   * clicks that one too; both opened a screen, and the first stayed behind the title for good (its Back did nothing).
   */
  // Survivors' JOGAR isn't counted: the run's `run_end` already says it, and it's a third of the lobby's presses.
  let pressing = false
  const press = (key: keyof typeof runs) => () => {
    if (pressing) return
    pressing = true
    select(key, false)
    playSfx('select')
    if (key !== 'play') lobbyPress(key)
    else if (mode !== 'survivors') lobbyPress(mode)
    later(() => {
      pressing = false
      runs[key]()
    })
  }
  const pressable = <T extends HTMLElement>(node: T, key: keyof typeof runs) => (node.addEventListener('click', press(key)), navigable(node, key))

  /* ---------- Sheets ---------- */

  function closeSheet() {
    sheet?.dispose()
    sheet = null
  }

  /** Opens a sheet of `entries`; the lobby's keys wait until it closes. */
  const openSheet = (title: string, entries: SheetEntry[]) => {
    if (sheet || visit) return
    offKeys?.()
    offKeys = null
    playSfx('select')
    sheet = lobbySheet(root, input, {
      title,
      entries,
      close: () => {
        sheet = null
        offKeys = restKeys()
      },
    })
  }

  /** A sheet row that closes the sheet and presses `key` (`lobbyPress` counts it). */
  const entry = (key: keyof typeof runs, icon: string, label: string, sub?: string, cls?: string): SheetEntry => ({ icon: iconImg(icon, cls), label, sub, run: press(key) })

  const hallEntry = (): SheetEntry => ({
    icon: iconImg(supporterIcon('gold')),
    label: m.hallName,
    sub: hallCall() ? hallLabel(hallCall()) : t().home.support,
    run: openHall,
  })

  /** Discord, with its gift (`DISCORD_GIFT`) while linking can bring it, the linked @username after. */
  const discordEntry = (): SheetEntry => {
    const d = t().discord
    const s = accountState()
    const linked = s.kind === 'signedIn' && s.discord
    return {
      icon: iconImg(discordIcon(), 'lobby-sheet-icon wide'),
      label: d.title,
      sub: linked ? `✓ @${s.discord}` : accountsEnabled ? d.cardGift(HATCHLINGS[DISCORD_GIFT.family].name) : d.join,
      extra: !linked && accountsEnabled ? iconImg(contentLine({ content: DISCORD_GIFT }).src, 'lobby-sheet-prize') : null,
      run: press('discord'),
    }
  }

  const socialEntry = (id: SocialId): SheetEntry => ({ icon: iconImg(socialIcon(id), 'lobby-sheet-icon wide'), label: SOCIALS[id].name, sub: SOCIALS[id].handle, run: press(id) })
  /** The Comunidade sheet's rows: Discord (with its Noibat) first, the official profiles, Ideias, the guide. */
  const communityEntries = (): SheetEntry[] => [
    discordEntry(),
    ...SOCIAL_IDS.map(socialEntry),
    ...(ideas ? [entry('ideas', bulbIcon(), m.ideas)] : []),
    entry('help', helpIcon(), t().shell.help, undefined, 'lobby-icon ink-icon'),
  ]
  const openCommunity = () => openSheet(m.community, communityEntries())

  /** Hall da Fama: the supporters' screen, on what it calls the player to; without accounts, the support page. */
  const openHall = () => {
    if (!accountsEnabled) return void window.open(ROUTES.support[locale()], '_blank', 'noopener')
    select('hall', false)
    playSfx('select')
    lobbyPress('hall')
    later(() => openOver((focus) => actions.supporters(focus, hallCall())))
  }

  const openTab = (id: TabId) => {
    if (id === 'home') return closeSheet()
    const save = loadSave()
    const ready = save.eggs.filter(isReady).length
    const gems = gemChip(() => {})
    const sheets: Record<Exclude<TabId, 'home'>, { title: string; entries: SheetEntry[] }> = {
      collection: {
        title: m.tabs.collection,
        entries: [
          entry('pokedex', pokeballIcon(), m.pokedex),
          { ...entry('eggs', eggIcon('rare'), m.eggs, ready > 0 ? m.eggsReady(ready) : undefined), extra: countBadge(ready) },
          entry('missions', medalIcon('silver'), m.missions),
        ],
      },
      plaza: {
        title: m.plaza,
        entries: [
          ...(festivalCardShows() ? [entry('festival', sparkleIcon(), t().festival.card)] : []),
          entry('mart', coinIcon(2), m.shopName, m.shopLine),
          entry('boutique', `${ASSETS}/shop/boutique.png`, m.boutiqueName, m.boutiqueLine),
          entry('carpentry', `${ASSETS}/shop/carpentry.png`, m.carpentryName, m.carpentryLine),
          hallEntry(),
        ],
      },
      social: {
        title: m.tabs.social,
        entries: [...(accountsEnabled ? [entry('friends', eggIcon('friend'), t().invites.title)] : []), ...communityEntries()],
      },
      profile: {
        title: m.tabs.profile,
        entries: [
          { icon: iconImg(medalIcon('gold')), label: t().trainer.open, run: () => (lobbyPress('trainer'), openOver(actions.trainer)) },
          ...(ranking ? [entry('ranking', medalIcon('gold'), m.ranking)] : []),
          ...(gems ? [entry('gems', gemIconUrl(), t().gems.chipGuest)] : []),
          entry('settings', gearIcon(), t().shell.settings),
        ],
      },
    }
    openSheet(sheets[id].title, sheets[id].entries)
  }

  /* ---------- The lobby ---------- */

  const buildLobby = () => {
    const save = loadSave()
    const kind = layout()
    navs = []
    const chip = trainerChip(input, { onOpen: () => (lobbyPress('trainer'), openOver(actions.trainer)) })
    closeChip = chip.dispose
    navigable(chip.el, 'trainer')
    // Beside the ₽, the gems (a guest's chip, only the gem): the Boutique's Loja, where guests browse too. Null in a build without the API.
    const gems = gemChip(() => (lobbyPress('gems'), runs.gems()))
    const shortWallet = kind !== 'wide'
    const survey = waitingSurvey()
    const nextBar = topBar({
      left: chip.el,
      right: [
        (wallet = walletChip(save.wallet, undefined, shortWallet)),
        ...(gems && kind !== 'narrow' ? [navigable(gems, 'gems')] : []),
        ...(survey ? [navigable(surveyButton(survey, press('survey')), 'survey')] : []),
        navigable(newsButton(press('news')), 'news'),
        navigable(gearButton(press('settings')), 'settings'),
      ],
    })
    bar.replaceWith(nextBar)
    bar = nextBar

    const partner = PLAYABLE[save.partner].line[0]
    const meeting = { dex: partner.dex, shiny: playsShiny(save, save.partner) }
    // Rebuilt with the same partner (`refresh`), this lobby keeps its `leave`.
    if (!leave || met?.dex !== meeting.dex || met.shiny !== meeting.shiny) {
      leave = actions.meadow.meet(meeting)
      met = meeting
    }

    const outbreak = outbreakCard()
    const ready = save.eggs.filter(isReady).length
    const dayCards = [
      ...(halloweenCardShows() ? [pressable((candyCard = halloweenCard()), 'halloween')] : []),
      pressable(giftsCard(), 'gifts'),
      pressable(challengeCard(), 'challenge'),
      pressable(eggsCard(ready, save.eggs.length), 'eggs'),
      pressable(missionsCard(), 'missions'),
      pressable(outbreak.el, 'outbreak'),
    ]
    const date = today().toLocaleDateString(LOCALES[lang].tag, { weekday: 'short', day: 'numeric', month: 'short' })
    const festival = festivalCardShows() ? pressable(kind === 'wide' ? festivalCard() : festivalBanner(), 'festival') : null
    const todayEl = h(
      'section',
      { class: 'lobby-today', 'aria-label': m.today },
      h('header', { class: 'lobby-col-head' }, h('h2', { class: 'arc-outline' }, m.today), h('span', { class: 'lobby-col-note' }, date)),
      h('div', { class: 'lobby-today-cards' }, ...(kind === 'landscape' && festival ? [festival] : []), ...dayCards),
    )

    const shopRow = (key: 'mart' | 'boutique' | 'carpentry', art: string, name: string, line: string) =>
      pressable(h('button', { class: 'lobby-shop-row', type: 'button', 'aria-label': `${name}: ${line}` }, h('span', { class: 'lobby-shop-art' }, iconImg(art, 'lobby-shop-img')), h('span', { class: 'lobby-day-text' }, h('b', {}, name), h('small', {}, line))), key)
    const shops = h(
      'div',
      { class: 'arc-card lobby-shops' },
      shopRow('mart', `${ASSETS}/shop/shop-lv${save.shop.level}.png`, m.shopName, m.shopLine),
      shopRow('boutique', `${ASSETS}/shop/boutique.png`, m.boutiqueName, m.boutiqueLine),
      shopRow('carpentry', `${ASSETS}/shop/carpentry.png`, m.carpentryName, m.carpentryLine),
    )
    const hall = navigable(hallStrip(openHall), 'hall')
    const plazaEl =
      kind === 'wide'
        ? h(
            'section',
            { class: 'lobby-plaza', 'aria-label': m.plaza },
            h('header', { class: 'lobby-col-head' }, h('h2', { class: 'arc-outline' }, m.plaza), h('span', { class: 'lobby-col-note' }, m.plazaNote)),
            festival,
            shops,
            hall,
          )
        : null
    // Phones: the invite banner sits with Hoje; wide screens under Na Praça's cards.
    const notice = h('div', { class: 'lobby-notice' })
    inviteBanner(notice, press('invite'), (banner) => navigable(banner, 'invite'))

    /* The middle: the mode's name and pills, its cast, the arrows. */
    const names = t().gameModes.names
    const facts = modeFacts()
    const title = navigable(h('button', { class: 'lobby-mode-title', type: 'button', 'aria-label': t().gameModes.title }, h('span', { class: 'lobby-mode-name arc-outline' })), 'modes')
    title.addEventListener('click', press('modes'))
    const titleText = title.firstElementChild as HTMLElement
    const blurb = h('span', { class: 'lobby-pill lobby-pill-blurb' })
    const tags = h('span', { class: 'lobby-pill' })
    const partnerPill = pressable(h('button', { class: 'lobby-pill lobby-pill-go', type: 'button' }, h('span', { class: 'lobby-pill-label' }), h('b'), ' ▸'), 'partner')
    const partnerName = partnerPill.querySelector('b')!
    const partnerLabel = partnerPill.querySelector('.lobby-pill-label')!
    const pills = h('div', { class: 'lobby-pills' }, blurb, tags, partnerPill)

    const stageEl = h('div', { class: 'lobby-stage' })
    slot = stageEl
    const castCanvas = h('canvas', { class: 'lobby-cast', 'aria-hidden': 'true' })
    const painter = castPainter(castCanvas, stageEl)
    const arrow = (side: 'prev' | 'next') => {
      const label = h('span', { class: 'lobby-arrow-name' })
      const icon = iconImg(chevronIcon(side === 'prev' ? 'left' : 'right'), 'lobby-arrow-icon')
      const button = navigable(h('button', { class: `lobby-arrow ${side}`, type: 'button' }, icon, label, h('span', { class: 'key-hint' }, side === 'prev' ? 'Q' : 'E')), side)
      button.addEventListener('click', () => setMode(modeBeside(modes, mode, side === 'prev' ? -1 : 1)))
      return { button, label }
    }
    const prev = arrow('prev')
    const next = arrow('next')
    const castHit = pressable(h('button', { class: 'lobby-cast-hit', type: 'button', 'aria-label': m.change }), 'partner')
    navs = navs.filter((n) => n.el !== castHit)
    stageEl.append(castCanvas, castHit, prev.button, next.button)
    const center = h('section', { class: 'lobby-center' }, title, pills, stageEl)

    /* The modes bar and JOGAR. */
    const chips = modes.map((id) => {
      const chip = navigable(
        h('button', { class: 'lobby-mode-chip', type: 'button', style: `--mode:${GAME_MODES[id].color}` }, h('span', { class: 'lobby-mode-chip-icon' }, iconImg(modeIcon(id), 'lobby-mode-chip-img')), h('span', { class: 'lobby-mode-chip-name' }, names[id])),
        `mode-${id}`,
      )
      if (GAME_MODES[id].fresh) chip.append(h('em', { class: 'arc-tag new' }, t().gameModes.tags.fresh))
      chip.addEventListener('click', () => (setMode(id), select('play', false)))
      return { id, chip }
    })
    const realmChip = realm ? chips.find((c) => c.id === 'realm')?.chip : undefined
    if (realmChip) {
      realmHourTag(realmChip)
      // One count on the chip: what's waiting for the player, then friends walking, then a crowd.
      void Promise.all([actions.realmErrands?.() ?? null, actions.realmFriends?.() ?? null, actions.realmCrowd?.() ?? null]).then(([errands, friends, crowd]) => {
        const words = t().realm
        const count = errands ? { n: errands, text: words.errands.lobby(errands) } : friends ? { n: friends, text: words.friends.lobby(friends) } : crowd !== null && crowd >= REALM_CROWD ? { n: crowd, text: words.cities.crowd(crowd) } : null
        if (count && realmChip.isConnected) realmChip.append(h('em', { class: 'arc-badge lobby-mode-pals', title: count.text, 'aria-label': count.text }, formatNumber(count.n)))
      })
    }
    const allModes = pressable(h('button', { class: 'lobby-mode-all', type: 'button', 'aria-label': t().gameModes.title, title: t().gameModes.title }, iconImg(gridIcon(), 'ink-icon')), 'modes')
    const bar_ = h('nav', { class: 'lobby-modes', 'aria-label': t().gameModes.title }, h('div', { class: 'lobby-modes-scroll' }, ...chips.map((c) => c.chip)), allModes)
    const playSub = h('small')
    const play = pressable(h('button', { class: 'arc-btn lobby-play', type: 'button' }, h('span', { class: 'arc-outline' }, m.play), playSub, h('span', { class: 'key-hint' }, 'ENTER')), 'play')

    const tile = (key: keyof typeof runs, icon: Node, label: string, hotkey: string | null, count = 0, aria = label) =>
      pressable(h('button', { class: 'arc-card lobby-tile', type: 'button', 'aria-label': aria }, h('span', { class: 'lobby-tile-icon' }, icon), h('span', { class: 'lobby-tile-name' }, label), count > 0 && h('em', { class: 'arc-badge' }, formatNumber(count)), hotkey && h('span', { class: 'key-hint' }, printedKeys(hotkey))), key)
    const dockLeft = [
      tile('pokedex', iconImg(pokeballIcon()), m.pokedex, 'X'),
      tile('eggs', iconImg(eggIcon('rare')), m.eggs, null, ready, ready > 0 ? `${m.eggs}: ${m.eggsReady(ready)}` : m.eggs),
      tile('mart', iconImg(coinIcon(2)), m.mart, 'L'),
    ]
    const communityIcon = h('span', { class: 'lobby-tile-pair' }, iconImg(discordIcon()), iconImg(socialIcon('youtube')))
    const dockRight = [
      ...(ranking ? [tile('ranking', iconImg(medalIcon('gold')), m.ranking, 'R')] : []),
      ...(accountsEnabled ? [tile('friends', iconImg(eggIcon('friend')), m.friends, 'B')] : []),
      tile('community', communityIcon, m.community, 'U'),
    ]
    const bottom = h('div', { class: 'lobby-bottom' }, h('div', { class: 'lobby-dock left' }, ...dockLeft), play, h('div', { class: 'lobby-dock right' }, ...dockRight))

    /* Phones: the bottom tabs. */
    const tabIcons: Record<TabId, string> = { home: pokeballIcon(), collection: eggIcon('rare'), plaza: coinIcon(2), social: eggIcon('friend'), profile: medalIcon('gold') }
    const tabs =
      kind === 'wide'
        ? null
        : h(
            'nav',
            { class: 'lobby-tabs', 'aria-label': m.tabs.home },
            ...TAB_IDS.map((id) => {
              const tab = navigable(
                h('button', { class: `lobby-tab ${id}`, type: 'button' }, iconImg(tabIcons[id], 'lobby-tab-icon'), h('span', {}, m.tabs[id]), id === 'collection' ? countBadge(ready) : null),
                `tab-${id}`,
              )
              tab.addEventListener('click', () => openTab(id))
              return tab
            }),
          )

    const layoutEls = kind === 'wide' ? [todayEl, center, plazaEl, bar_, notice, bottom] : [todayEl, ...(kind === 'narrow' && festival ? [festival] : []), notice, center, bar_, play, ...(tabs ? [tabs] : [])]
    const lobbyEl = h('div', { class: `lobby lobby-${kind}` }, h('h1', { class: 'sr-only' }, 'Pokémon Survivors'), ...layoutEls)

    paintMode = () => {
      const color = GAME_MODES[mode].color
      el.style.setProperty('--mode', color)
      play.dataset.mode = mode
      const f = facts[mode]
      titleText.textContent = names[mode]
      blurb.textContent = f.blurb
      const usesPartner = mode === 'survivors' || mode === 'dojo'
      const needs = GAME_MODES[mode].needs === 'account' ? [t().gameModes.tags.needsAccount] : []
      const parts = [...f.tags.map((tag) => tag.text), ...needs].slice(0, 2)
      tags.textContent = parts.join(' · ')
      tags.hidden = parts.length === 0
      partnerPill.hidden = !usesPartner
      castHit.hidden = mode !== 'survivors'
      partnerLabel.textContent = kind === 'wide' ? `${m.partner}: ` : ''
      partnerName.textContent = PLAYABLE[save.partner].line[0].name
      const left = modeBeside(modes, mode, -1)
      const right = modeBeside(modes, mode, 1)
      prev.label.textContent = names[left]
      next.label.textContent = names[right]
      prev.button.setAttribute('aria-label', names[left])
      next.button.setAttribute('aria-label', names[right])
      for (const c of chips) {
        const on = c.id === mode
        c.chip.classList.toggle('on', on)
        c.chip.setAttribute('aria-pressed', String(on))
      }
      if (lobbyEl.isConnected) chips.find((c) => c.id === mode)?.chip.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      playSub.textContent = playLine(mode, f)
      painter.set(mode)
      // Coming home to a mode the arrows stood on keeps the pick; everything else moves with it.
      if (current.startsWith('mode-') && navs.some((n) => n.key === `mode-${mode}`)) select(`mode-${mode}`, false)
    }
    paintMode()

    tickers = [outbreak.tick, painter.tick]
    castBox = painter.box

    ;(lobby ?? intro).replaceWith(lobbyEl)
    lobby = lobbyEl

    chips.find((c) => c.id === mode)?.chip.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    select(itemOf(current) ? current : 'play', false)
    offKeys = restKeys()
    setAway()
  }

  function lobbyKey(key: string) {
    const dir = DIRECTIONS[key]
    if (dir) return move(dir)
    if (key === 'Enter' || key === 'Space') return void itemOf(current)?.click()
    if (key === 'KeyQ') return setMode(modeBeside(modes, mode, -1))
    if (key === 'KeyE') return setMode(modeBeside(modes, mode, 1))
    if (/^Digit[1-9]$/.test(key)) {
      const picked = modes[Number(key.slice(5)) - 1]
      if (picked) setMode(picked)
      return
    }
    const hot = HOTKEYS[key]
    const target = hot && itemOf(hot)
    if (hot && target) target.click()
  }

  /* ---------------- The trip to the Kecleon's shop ---------------- */

  /** Runs the wipe: it closes, `mid` swaps what's behind it, it opens, then `done`. Reduced motion just swaps. */
  const runWipe = (mid: () => void, done: () => void) => {
    if (reducedMotion.matches) {
      mid()
      return done()
    }
    wipe = { t: 0, closing: true, mid, done }
    wipeEl.classList.remove('hidden')
    paintWipe()
  }

  /** Paints the wipe's circle: a hole in the dark that shrinks or grows around the cast. */
  function paintWipe() {
    if (!wipe) return
    const { w, h: vh } = uiViewport()
    const k = Math.min(1, wipe.t / WIPE_TIME)
    const rect = slot?.getBoundingClientRect()
    const x = rect ? (rect.left + rect.width / 2) / (uiDpr() / (window.devicePixelRatio || 1)) : w / 2
    const y = rect ? rect.bottom / (uiDpr() / (window.devicePixelRatio || 1)) - 40 : vh / 2
    const full = Math.hypot(Math.max(x, w - x), Math.max(y, vh - y)) + WIPE_STEP
    const r = Math.round(((wipe.closing ? 1 - k : k) * full) / WIPE_STEP) * WIPE_STEP
    const mask = `radial-gradient(circle at ${Math.round(x)}px ${Math.round(y)}px, transparent ${r}px, #000 ${r}px)`
    wipeEl.style.maskImage = mask
    wipeEl.style.webkitMaskImage = mask
  }

  /** The wipe's clock, stepped with every drawn frame. */
  const stepWipe = (dt: number) => {
    if (!wipe) return
    wipe.t += dt
    paintWipe()
    if (wipe.t < WIPE_TIME) return
    if (wipe.closing) {
      const { mid, done } = wipe
      wipe = { t: 0, closing: false, mid: () => {}, done }
      mid()
      return
    }
    const { done } = wipe
    wipe = null
    wipeEl.classList.add('hidden')
    done()
  }

  /** Sets the partner off on a leg of a trip, with its feet pattering away (never for an `instant` landing). */
  function setOff(place: Place) {
    playSfx('trip', TRIP_SOUND_GAP)
    actions.meadow.visit(place)
  }

  /**
   * Goes to a place: the cards fade, the circle closes on the cast and opens on
   * the meadow's partner, the camera panning there and the partner hopping along
   * (`instant`: lands there at once, no wipe). There Kecleon hops, cries
   * and says hello, then the shop opens over the plaza (`TitleActions.mart`);
   * closing it comes back (`goHome`).
   */
  function visitShop(mode_: ShopTrip, instant = false, shelf?: VisitorShelf) {
    if (visit || !lobby) return
    visit = { mode: mode_, phase: 'going', shelf, instant }
    offKeys?.()
    offKeys = input.onKey(visitKey)
    el.classList.add('visiting')
    setAway()
    const place = tripPlace(mode_)
    if (instant) {
      onTrip = true
      actions.meadow.visit(place, true)
      return
    }
    runWipe(
      () => {
        onTrip = true
        setOff(place)
      },
      () => {},
    )
  }

  /** Keys during a trip: Esc or Backspace turns back on the way; for a look, Enter or Space too once there. The wipe plays out first. */
  function visitKey(key: string) {
    if (!visit || wipe) return
    const back = key === 'Escape' || key === 'Backspace'
    if ((visit.phase === 'going' && back) || (visit.phase === 'here' && (back || key === 'Enter' || key === 'Space'))) goHome()
  }

  /** At the plaza: the shop opens, Kecleon talking beside it (a look just waits). At the Boutique, Leavanny (when walked to) and then its sheet; at the Dojo, Machoke says hello and the Dojo opens; at the Estádio, Ninjask and then the Arena. */
  const arrived = () => {
    if (!visit) return
    if (visit.mode === 'look') {
      visit.phase = 'here'
      return
    }
    visit.phase = 'shop'
    if (visit.mode === 'dojo') return greetAtDojo()
    if (visit.mode === 'stadium') return greetAtStadium()
    if (visit.mode === 'boutique' || visit.mode === 'skins' || visit.mode === 'locker') return greetAtBoutique(visit.mode === 'boutique' ? 'shop' : visit.mode, visit.instant)
    if (visit.mode === 'carpentry') return greetAtCarpentry()
    if (visit.mode === 'festival') overScreen = actions.festival(goHome, 'fountain')
    else openShop(visit.shelf)
  }

  /** Machoke's hello at the Dojo (the long one the first time), then who trains; Esc during it turns back home. */
  function greetAtDojo() {
    const m = t().training
    const lines = !DOJO.seen() ? m.first : [m.hello[Math.floor(Math.random() * m.hello.length)]!]
    chat = dialogue(root, input, {
      speaker: senseiSpeaker(),
      lines: lines.map((text, i) => ({ text, emotion: i === 0 ? 'Happy' : 'Joyous' })),
      onDone: () =>
        later(() => {
          chat?.dispose()
          chat = null
          DOJO.mark()
          actions.dojo()
        }),
    })
  }

  /** Ninjask's hello at the Estádio (the long one, explaining the Arena, the first time), then the Arena's screen. */
  function greetAtStadium() {
    const m = t().stadium
    const lines = !STADIUM.seen() ? m.first : [m.hello[Math.floor(Math.random() * m.hello.length)]!]
    chat = dialogue(root, input, {
      speaker: judgeSpeaker(),
      lines: lines.map((text, i) => ({ text, emotion: i === 0 ? 'Happy' : i === lines.length - 1 ? 'Joyous' : 'Normal' })),
      onDone: () =>
        later(() => {
          chat?.dispose()
          chat = null
          STADIUM.mark()
          ARENA.mark()
          actions.arena()
        }),
    })
  }

  /**
   * Leavanny's hello at the Boutique (the long one, about the shop, the first time), then its sheet on `tab`; Esc during it turns back home.
   * Landed there at once (a shortcut: the Trainer Card, the Arena, a link), the sheet opens straight away, Leavanny talking beside it.
   */
  function greetAtBoutique(tab: BoutiqueTab, instant: boolean) {
    const open = () => (overScreen = actions.boutique(goHome, tab))
    if (instant) return open()
    const m = t().boutique
    const lines = boutiqueSeen() ? [m.hello[Math.floor(Math.random() * m.hello.length)]!] : m.first
    chat = dialogue(root, input, {
      speaker: tailorSpeaker(),
      lines: lines.map((text, i) => ({ text, emotion: i === 0 ? 'Happy' : 'Joyous' })),
      onDone: () =>
        later(() => {
          chat?.dispose()
          chat = null
          if (visit?.phase === 'shop') open()
        }),
    })
  }

  /** Bibarel's hello at the carpentry (the long one, about the furniture, the first time), then its sheet. */
  function greetAtCarpentry() {
    const m = t().carpenter
    const lines = CARPENTRY.seen() ? [m.hello[Math.floor(Math.random() * m.hello.length)]!] : m.first
    chat = dialogue(root, input, {
      speaker: carpenterSpeaker(),
      // SpriteCollab draws Bibarel with one face only.
      lines: lines.map((text) => ({ text, emotion: 'Normal' })),
      onDone: () =>
        later(() => {
          chat?.dispose()
          chat = null
          CARPENTRY.mark()
          if (visit?.phase === 'shop') overScreen = actions.carpentry(goHome)
        }),
    })
  }

  /** The shop over the plaza; its Festival button swaps it for the festival's sheet, whose Back brings the shop again, and its Boutique button walks over to Leavanny. */
  function openShop(shelf?: VisitorShelf) {
    overScreen?.dispose()
    overScreen = actions.mart(
      goHome,
      shelf,
      () => {
        overScreen?.dispose()
        overScreen = actions.festival(() => openShop())
      },
      shopToBoutique,
    )
  }

  /** From the shop to the Boutique: the shop's sheet goes, the camera pans along the plaza and the partner hops over to Leavanny. */
  function shopToBoutique() {
    if (!visit) return
    overScreen?.dispose()
    overScreen = null
    visit = { mode: 'boutique', phase: 'going', instant: false }
    setOff('boutique')
  }

  /** Back from the shop: the camera pans home, the partner hops back, the circle wipes home and the lobby's cards return. */
  function goHome() {
    if (!visit || visit.phase === 'back' || visit.phase === 'landing') return
    overScreen?.dispose()
    overScreen = null
    // Opened from elsewhere (the partner select's wallet): back there instead of home.
    if (opts.back) return later(opts.back)
    const fresh = walletChip(loadSave().wallet, undefined, layout() !== 'wide')
    wallet?.replaceWith(fresh)
    wallet = fresh
    if (candyCard) fillHalloweenCard(candyCard)
    visit.phase = 'back'
    setOff('home')
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

  /** Every frame of a trip: it moves on when the meadow gets there. */
  const travel = () => {
    if (!visit) return
    const at = actions.meadow.at()
    if (visit.phase === 'going' && !wipe && at === tripPlace(visit.mode)) arrived()
    else if (visit.phase === 'back' && at === 'home') {
      visit.phase = 'landing'
      runWipe(
        () => {
          onTrip = false
          el.classList.remove('visiting')
        },
        landed,
      )
    }
  }

  /** The lobby goes away (another screen over it, or for good): so does the partner in the meadow. */
  const leaveMeadow = () => {
    leave?.()
    leave = null
    met = null
  }

  const enterLobby = () => {
    noteDesignSeen()
    buildLobby()
    actions.ready()
    // `?loja` (and the dev's `ps.plaza()`) head for the shop once the lobby is laid out.
    const trip = opts.shop
    if (trip) requestAnimationFrame(() => visitShop(trip, opts.instant, opts.shelf))
    else {
      // Otherwise a survey asks by itself, at most one per page load; closed unanswered, its clipboard in the top bar keeps asking.
      const survey = takeSurveyOffer()
      if (survey) openOver(survey === 'design' ? actions.designSurvey : actions.survey)
      // Or the app's install, once per device, after a few runs or a second visit (not right after the design survey: enough asking for one visit).
      else if (!designSurveyOffered()) {
        const offer = takeInstallNudge()
        if (offer) openOver((focus) => actions.install(offer, focus))
      }
    }
  }

  /**
   * A sync brought another device's progress (₽, the challenge, missions…):
   * the lobby is rebuilt in place on the same entry. Not under another screen,
   * which rebuilds the title as it closes; on a trip to the shop it waits until
   * the lobby is back home (`landed`).
   */
  function refresh() {
    if (visit) return void (stale = true)
    if (!lobby || overScreen || sheet || el.classList.contains('hidden')) return
    offKeys?.()
    closeChip?.()
    buildLobby()
  }
  const offSynced = onSaveSynced(refresh)
  // Each layout builds its own lobby (rows, columns, the rail): a rotation or a resized window that switches it rebuilds.
  const layouts = [LANDSCAPE, NARROW].map((q) => matchMedia(q))
  for (const q of layouts) q.addEventListener('change', refresh)
  const offLayouts = () => layouts.forEach((q) => q.removeEventListener('change', refresh))

  if (opts.intro) {
    // Any key, pad button or tap. `later` keeps that same press from also pressing JOGAR.
    const start = () => {
      if (!offIntro) return
      playSfx('select')
      later(actions.start ?? enterLobby)
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

  root.append(el)
  return {
    el,
    dim: 0,
    scene: (ctx, dt, w, vh) => {
      stepWipe(dt)
      const meadowUp = lobby !== null
      if (actions.meadow.clouds.hidden !== meadowUp) actions.meadow.clouds.hidden = meadowUp
      if (meadowUp) {
        // Layout reads, and they only change with the layout or the mode: a few times a second is plenty (never while it's hidden, every box would read 0).
        if (!onTrip && !el.classList.contains('hidden') && slot && measureAge++ % 20 === 0) {
          const next = lobbyCovers(el, slot.getBoundingClientRect(), castBox, uiZoom(), actions.meadow.scale())
          const key = next.map((c) => `${c.left},${c.top},${c.right},${c.bottom}`).join(' ')
          if (key !== coversKey) {
            coversKey = key
            covers = next
          }
        }
        return actions.meadow.draw(ctx, dt, w, vh, onTrip ? null : covers)
      }
      if (measureAge++ % 20 === 0) {
        // Walkers on the ridge keep out from behind the logo where it comes down that far.
        const scale = actions.meadow.scale()
        const box = logo.getBoundingClientRect()
        const reaches = box.height > 0 && box.bottom / scale > vh * 0.72 - stageHorizonRise - stageRidgeReach
        restStanding = reaches ? [{ from: box.left / scale - w / 2, to: box.right / scale - w / 2 }] : []
      }
      const at: StageAnchor = { x: Math.round(w / 2), feet: Math.round(vh * 0.72), standing: restStanding }
      actions.meadow.stage(ctx, dt, w, vh, at)
      actions.meadow.tickClouds(w, at.feet - stageHorizonRise)
    },
    tick: (time: number) => {
      overScreen?.tick?.(time)
      sheet?.tick?.(time)
      if (el.classList.contains('hidden')) return
      chat?.tick?.(time)
      if (visit) travel()
      for (const tick of tickers) tick(time)
      if (logo.width > 1 && lobby === null) fitLogo(logo)
    },
    dispose: () => (overScreen?.dispose(), sheet?.dispose(), chat?.dispose(), offIntro?.(), offKeys?.(), closeChip?.(), offSynced(), offLayouts(), leaveMeadow(), el.remove()),
  }
}
