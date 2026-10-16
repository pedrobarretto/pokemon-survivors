import '@fontsource/press-start-2p'
import '@fontsource/vt323'
import './ui/style.css'

import { playCry, playSfx, unlockAudio, type Sfx } from './engine/audio'
import { createPadButton, createPadKeys } from './engine/gamepad'
import { createInput } from './engine/input'
import { currentTheme, duckMusic, playTheme, type ThemeId } from './engine/music'
import { context2d } from './engine/pixelart'
import { fitView } from './engine/viewport'
import { createRng } from './engine/rng'
import { BIOME_ORDER, BIOMES, type BiomeId, type WeatherId } from './data/biomes'
import { bodyOf } from './data/bodies'
import { MEGA_LINES, MEGAS, megasOf, type MegaId } from './data/megas'
import { RIFT, RIFT_LEGENDS } from './data/rifts'
import { ENEMIES, type EnemyDef, type EnemyId } from './data/enemies'
import { ITEMS } from './data/items'
import type { AchievementId } from './data/achievements'
import type { TraitId } from './data/traits'
import { REGIONS, STARTERS } from './data/starters'
import { challengeStart, nextIsOfficial, type Challenge } from './game/challenge'
import { HATCHLING_IDS, HATCHLINGS, isHatchling, PLAYABLE, playableDex, type HatchlingId, type PlayableId } from './data/hatchlings'
import { accountState, accountsEnabled, backFromSignIn, onAccountChange, onGifts, receiveGifts, startAccount, syncSave } from './account'
import { track } from './analytics'
import { BAG_ITEM_IDS, BAG_ITEMS, useArmed, type BagItem } from './game/bag'
import { CONSUMABLES } from './game/consumables'
import { depositEggs, EGGS, grantEgg, hatchEgg, isReady, toSteps, type EggTier, type Hatch } from './game/eggs'
import { setBiome } from './game/biomes'
import { brasiliaDay, previousDay, type DayKey } from './game/day'
import { spawnEnemy } from './game/enemies'
import { makeShiny } from './game/shiny'
import { MAP_EVENT_KINDS, MAP_EVENTS, spawnMapEvent, type MapEventKind } from './game/mapEvents'
import { MEOWTH_DEX } from './game/mapEventRules'
import { chooseOffer, playerDex, rerollOffers, skipLevelUp, step } from './game/game'
import { recomputeStats } from './game/leveling'
import type { Difficulty } from './game/difficulty'
import { dropMegaStones, grantStone, heldMega } from './game/mega'
import { ENDLESS, REAPER } from './game/endless'
import { continueEndless } from './game/endlessSystem'
import { riftDevTools } from './game/riftDev'
import { clearSpot, featureAt } from './game/terrain'
import { TERRAIN, type SolidKind } from './data/terrain'
import { dexNews, dexStatus, mergeDex, recordRun, type Pokedex } from './game/dex'
import { runEarnings, wonRun } from './game/meta'
import { missionStatus, type MissionStatus } from './game/missions'
import { summarizeRun, type RunSummary } from './game/tally'
import { parseHandle, rankable, runResult } from './game/ranking'
import { rosterSchedule, type Roster } from './game/roster'
import { recordEvent, recordStep, runRoster, startGame, startRecording, TICK, type Recorder, type ReplayStart } from './game/replay'
import { gameSpecial } from './game/special'
import { unlockShinyStarter } from './game/shinyStarters'
import { MOVES } from './game/moves'
import type { Game, GameEvent, Phase, RunEvent } from './game/types'
import { setWeather } from './game/weather'
import { render } from './render/draw'
import { drawJoystick } from './render/joystick'
import { cryUrl, loadAll, loadSpecies, portraitUrl, preloadForms, preloadShinies, sprites, streamSpecies } from './render/sprites'
import { setMarkerInsets } from './render/mapEvents'
import { consumableIcon } from './render/props'
import { bagIcon, eggIcon, ribbonIcon } from './render/art'
import { megaStoneIcon } from './render/megaFx'
import { createTitleScene, drawTitleScene, stepTitleScene } from './render/titleScene'
import { weatherIcon } from './render/weather'
import { formatDay, locale, LOCALES, setLocale, t, type Locale } from './i18n'
import { h, later, rich, setText } from './ui/dom'
import { captureRef, flushRuns, PROFILE_PARAM, rankingEnabled, stageInvite, startRanked, type RankedRun, type RankOutcome } from './ranking'
import { parseGiftContent, type GiftKind, type GiftReason } from './game/gifts'
import { announceGifts } from './ui/gifts'
import { accountScreen, playGate } from './ui/account'
import { createHud, type Hud } from './ui/hud'
import { bankEggs, challengeToday, depositPokeDollars, loadAttempt, loadSave, outbreakToday, recordRunProgress, saveAttempt, saveHatch, today, updateSave, writeSave } from './ui/save'
import { challengeScreen, challengeShiny } from './ui/challenge'
import { hatchScene, incubator } from './ui/incubator'
import { medalChips, missionReport, missionsScreen, progressToast, titleBadge } from './ui/missions'
import { martDevTools } from './ui/martDev'
import { missionDevTools } from './ui/missionsDev'
import { pcBoxScreen } from './ui/pcBox'
import { pokedexScreen } from './ui/pokedex'
import { profileEditor, profileScreen } from './ui/profile'
import { rankingScreen, rankPanel } from './ui/ranking'
import { flashScreen, levelUp, pauseMenu, results, textBox, type Screen } from './ui/screens'
import { isSettingsOpen, openSettings, settings, toggleMute } from './ui/settings'
import { mapEventFeedback } from './ui/mapEvents'
import { runShare, sharePreview, trainerShare } from './ui/share'
import { martButton, shop } from './ui/shop'
import { starterSelect } from './ui/starterSelect'
import { titleButton, titleScreen } from './ui/title'
import { banner, clearToasts, tickToasts, toast } from './ui/toasts'
import { backlog, CATCH_UP, createLink, me, predictedOffset, sendEntry, stepCoop, type CoopLink } from './coopRun'
import { createCoopGame } from './game/game'
import { connect, coopEnabled, playerName as coopName, reconnect } from './net/client'
import { onInvite } from './net/presence'
import { parseRoomCode, ROOM_PARAM, roomView, setupOf, type Member, type TickEntry } from './net/protocol'
import { backToLobby, createRoom, joinRoom, leaveRoom, loaded, onRoom, room, runOver, savedRoom, sendChoice, sendAway, sendOffer, sendPress, setLoadout, type RunStart } from './net/room'
import { coopHub, lobbyScreen, teamWait } from './ui/coop'
import { friendsScreen } from './ui/friends'
import { createTeamHud, type TeamHud } from './ui/teamHud'
import { createNameTags, type NameTags } from './ui/nameTags'
import { slotColor } from './render/coop'

/** Fixed simulation step: the replays the ranking re-simulates count on it. */
const STEP = TICK

const canvas = document.querySelector<HTMLCanvasElement>('#game')!
const ui = document.querySelector<HTMLDivElement>('#ui')!
const ctx = context2d(canvas)
const input = createInput(canvas)
/** Internal canvas size in world px. Shared by reference with the running game. */
const view = { w: 480, h: 270 }
/** CSS px per world px (integer in device px, see `fitView`). */
let cssScale = 4
/** Set when the canvas was cleared and must be redrawn even if the game is paused. */
let dirty = true

/**
 * Sizes the low-res canvas to the visible viewport. Runs on resize, rotation
 * and iOS toolbar changes (visualViewport), and only touches the canvas when
 * the result actually changed, because resizing clears it.
 */
const resize = () => {
  const width = window.visualViewport?.width ?? window.innerWidth
  const height = window.visualViewport?.height ?? window.innerHeight
  const fit = fitView(width, height, window.devicePixelRatio || 1)
  if (fit.w === view.w && fit.h === view.h && fit.cssScale === cssScale) return
  view.w = fit.w
  view.h = fit.h
  cssScale = fit.cssScale
  canvas.width = view.w
  canvas.height = view.h
  canvas.style.width = `${view.w * cssScale}px`
  canvas.style.height = `${view.h * cssScale}px`
  document.documentElement.style.setProperty('--px', `${Math.max(2, Math.round(cssScale))}px`)
  context2d(canvas)
  dirty = true
  // Runs after layout (and after module init, so `run` exists by then).
  requestAnimationFrame(() => run && syncMarkerInsets())
}
// Rotation often reports stale sizes in the same tick, so re-measure on the next frame too.
const scheduleResize = () => (resize(), requestAnimationFrame(resize))
window.addEventListener('resize', scheduleResize)
window.addEventListener('orientationchange', scheduleResize)
window.visualViewport?.addEventListener('resize', scheduleResize)
resize()

/* ---------------- App state ---------------- */

type Run = {
  game: Game
  hud: Hud
  overlay: Screen | null
  /** Phase + offers snapshot the overlay was built for. */
  shown: { phase: Phase; offers: Game['player']['offers']; picked: boolean; menu: boolean } | null
  closeText: (() => void) | null
  /** ₽ of this run already in the wallet: a victory banks right away and again if the run goes on endless. */
  paid: number
  /** True once the run's end was reported to analytics. */
  reported: boolean
  /** Missions as the run started, and what the run has recorded so far (see `recordProgress`). */
  missionsBefore: MissionStatus[]
  recorded: RunSummary | null
  unlocked: AchievementId[]
  /** ₽ paid for missions and medals this run, and the reward eggs and bag items they gave. */
  reward: number
  rewardEggs: number
  rewardItems: BagItem[]
  /** Steps and eggs of this run already in the incubator, and the ₽ paid for eggs that found it full. */
  hatchery: { steps: number; eggs: number; refund: number }
  /** The Pokédex as saved when the run began: banking folds the run's log into it, so banking twice changes nothing. */
  dexBase: Pokedex
  /** Everything the simulation took from the player, for the ranking to re-simulate (`game/replay.ts`). */
  recorder: Recorder
  /** Signed in: the run's start token and its result, once reported (see `rankRun`). */
  ranked: RankedRun | null
  rank: Promise<RankOutcome> | null
  /** The longest run on record before this one: beating it lights up the Share button. */
  bestBefore: number
  /**
   * A Desafio do dia run: its day, whether it started as the official attempt
   * (what the screen said; the API decides), and whether it's the attempt this
   * device keeps (`saveAttempt`). Null for any other run.
   */
  challenge: { day: DayKey; official: boolean; attempt: boolean } | null
  /** Co-op: this device's side of the shared run (`coopRun.ts`), and the teammates' HUD. Null solo. */
  coop: CoopLink | null
  team: TeamHud | null
  tags: NameTags | null
  /** Co-op: this player sent their level-up pick and waits for the tick that applies it. */
  picked: boolean
}

/** The run as this device's player sees it: in co-op, `player` is this device's slot (the simulation's acting player rests on slot 0). */
const own = (r: Run): Game => (r.coop ? { ...r.game, player: me(r.game, r.coop) } : r.game)

/** The run's Pokédex log as this player banks it: in co-op only their own line counts as caught (a teammate's forms as seen). */
const ownLog = (r: Run) => {
  const log = r.game.dexLog
  if (!r.coop) return log
  const line = new Set(playableDex(own(r).player.starter))
  return { ...log, own: new Map([...log.own].filter(([dex]) => line.has(dex))) }
}

let screen: Screen | null = null
let run: Run | null = null
let lastStarter: PlayableId = 'charmander'
/** Special attack press (Space, touch button, gamepad A), consumed by the next simulation step. */
let specialQueued = false
/** Mega Evolution press (E, the Mega button, gamepad Y), consumed like the special. */
let megaQueued = false
/** Manual lunge press (Shift, the lunge button, gamepad X) for Quick Attack, consumed like the special. */
let lungeQueued = false
const padA = createPadButton(0)
const padX = createPadButton(2)
const padY = createPadButton(3)
const padKeys = createPadKeys()
/** The meadow with wandering Pokémon behind every menu. Lives across screens, so it never pops. */
const scene = createTitleScene(Date.now())

const queueMega = () => {
  unlockAudio()
  if (run?.game.phase === 'playing') megaQueued = true
}

/** The player's name right now: its stage's, or its Mega form's while that lasts. */
const playerName = (g: Game) => (g.player.mega.active > 0 && heldMega(g)?.name) || PLAYABLE[g.player.starter].line[g.player.stage]!.name

/** The player's cry right now: its Mega form's own while that lasts. */
const playerCry = (g: Game) => cryUrl(playerDex(g), g.player.mega.active > 0 ? heldMega(g)?.form : undefined)

const queueSpecial = () => {
  unlockAudio()
  if (run?.game.phase === 'playing') specialQueued = true
}

const queueLunge = () => {
  unlockAudio()
  if (run?.game.phase === 'playing') lungeQueued = true
}

const setScreen = (next: Screen | null) => {
  screen?.dispose()
  screen = next
}

const changeLanguage = (next: Locale) => {
  setLocale(next)
  playSfx('select')
}

/** Title entries after Play move down one when the co-op entry shows. */
const TITLE_SHIFT = coopEnabled ? 1 : 0

/** Set by the title's "press start": the music waits for it, even where the browser would autoplay. */
let pressedStart = false

/**
 * Title screen. `intro` shows the blinking "press start" first (boot, PWA launch, not back from signing in);
 * coming back from the starter select goes straight to the menu. `focus` is the menu entry to highlight.
 */
const showTitle = (opts: { intro?: boolean; focus?: number } = {}) => {
  endRun()
  setScreen(
    titleScreen(ui, input, {
      play: () => (accountsEnabled && !playingAsGuest && accountState().kind === 'guest' ? showPlayGate() : showMenu()),
      coop: coopEnabled ? () => showCoopHub() : undefined,
      challenge: () => showChallenge(),
      incubator: () => showIncubator(() => showTitle({ focus: 2 + TITLE_SHIFT })),
      missions: () => showMissions(),
      // Every label is read at render time, so switching language just rebuilds the screen.
      language: (next) => (changeLanguage(next), showTitle()),
      ready: () => (pressedStart = true),
      // The language may change inside Settings, so closing them rebuilds the title on the same entry.
      settings: (focus) => openSettings(ui, input, () => showTitle({ focus })),
      pokedex: (focus) => pokedexScreen(ui, input, () => showTitle({ focus }), showPcBox),
      // Closing rebuilds the title, so a sign in's merged save (title badge) shows up.
      account: accountsEnabled ? (focus) => accountScreen(ui, input, () => showTitle({ focus })) : undefined,
      ranking: rankingEnabled ? (focus) => rankingScreen(ui, input, () => showTitle({ focus }), { difficulty: loadSave().difficulty }) : undefined,
    }, opts),
  )
}

/** Set once the player picks "play as a guest": the gate doesn't ask again until the page reloads. */
let playingAsGuest = false

/** Sign in or play as a guest, asked when a guest taps Play. */
const showPlayGate = () =>
  setScreen(
    playGate(ui, input, {
      play: () => showMenu(),
      guest: () => ((playingAsGuest = true), showMenu()),
      back: () => showTitle(),
    }),
  )

/** Pokémon select, with the Poké Mart (top right) and the way back to the title (top left). */
const showMenu = (initial: PlayableId = lastStarter) => {
  endRun()
  const select = starterSelect(ui, input, {
    pick: (id) => setTimeout(() => void startRun(id), 250),
    incubator: () => showIncubator(() => showMenu(select.selected())),
  }, initial)
  const closeMart = martButton(ui, input, () => showShop())
  const closeBack = titleButton(ui, input, () => showTitle())
  setScreen({ ...select, dispose: () => (closeMart(), closeBack(), select.dispose()) })
}

const showShop = () => setScreen(shop(ui, input, () => showMenu()))

/** The Caixa do PC (from the Pokédex); its Trainer Card stands the last Pokémon played beside the trainer. */
const showPcBox = (back: () => void) =>
  pcBoxScreen(ui, input, { onClose: back, trainerCard: (close) => sharePreview(ui, input, trainerShare(lastStarter), close) }, loadSave().style.equipped.wallpaper)

const showMissions = () => setScreen(missionsScreen(ui, input, () => showTitle({ focus: 3 + TITLE_SHIFT })))

/** The Desafio do dia's screen (from the title); its board opens over it and comes back to it. */
const showChallenge = () => {
  endRun()
  setScreen(
    challengeScreen(ui, input, {
      play: (c, official) => setTimeout(() => void startRun(c.starter, { challenge: c, official }), 250),
      board: rankingEnabled ? () => setScreen(rankingScreen(ui, input, () => showChallenge(), { challenge: true })) : undefined,
      onClose: () => showTitle({ focus: 1 + TITLE_SHIFT }),
    }),
  )
}

/** Today's challenge again (Try again after one): practice now, unless the attempt didn't count (a quit in the first minute). */
const replayChallenge = () => {
  const c = challengeToday()
  return startRun(c.starter, { challenge: c, official: nextIsOfficial(c.day, loadAttempt(), null) })
}

/** The incubator; hatching a ready egg plays its scene and comes back here. */
const showIncubator = (back: () => void) => {
  endRun()
  setScreen(incubator(ui, input, { onHatch: (i) => hatchAt(i, () => showIncubator(back)), onClose: back }))
}

/**
 * Hatches the ready egg at `index`, saving it with its missions and medals,
 * and plays its scene, then `then`. What it completed toasts once the scene is over.
 */
const hatchAt = (index: number, then: () => void) => {
  const result = hatchEgg(loadSave(), index, createRng(Date.now()))
  if (!result) return then()
  const record = saveHatch(result.save, result.hatch.shiny)
  void syncSave()
  showHatch(result.hatch, then, undefined, () => later(() => progressToast(ui, record)))
}

const showHatch = (hatch: Hatch, then: () => void, holdAt?: number, after = () => {}) =>
  setScreen(hatchScene(ui, input, hatch, { play: () => (void startRun(hatch.id), after()), done: () => (then(), after()) }, holdAt))

/** Leaves the run; every egg it made ready hatches first ("Oh? The Egg is hatching!"), then the gifts' hatches, then `then`. */
const afterRun = (then: () => void) => {
  endRun()
  const ready = loadSave().eggs.findIndex(isReady)
  if (ready < 0) return playGiftHatches(then)
  hatchAt(ready, () => afterRun(then))
}

/** Shiny hatches a Mystery Gift brought (already in the save), waiting to play out of a run. */
const giftHatches: Hatch[] = []

/** Plays each waiting gift hatch's scene (recording it in the missions and medals), then `then`. */
const playGiftHatches = (then: () => void) => {
  const hatch = giftHatches.shift()
  if (!hatch) return then()
  const record = saveHatch(loadSave(), hatch.shiny)
  void syncSave()
  showHatch(hatch, () => playGiftHatches(then), undefined, () => later(() => progressToast(ui, record)))
}

/**
 * Mystery Gifts that landed in the save (a sync, or a dev helper): a banner
 * each, and a shiny hatch plays right away on the title, else after the run.
 */
onGifts((arrived, waiting) => {
  announceGifts(ui, arrived, waiting)
  giftHatches.push(...arrived.flatMap((a) => (a.hatch ? [a.hatch] : [])))
  if (giftHatches.length > 0 && !run && screen?.el.classList.contains('title-home')) playGiftHatches(() => showTitle())
})

/** Moves the run's steps and new eggs into the incubator, once each (a victory banks, then endless banks again). */
const bankHatchery = (r: Run) => {
  const g = own(r)
  const steps = toSteps(g.player.walked)
  const fresh = g.eggs.found.slice(r.hatchery.eggs).map((e) => ({ tier: e.tier, steps: steps - toSteps(e.at) }))
  if (steps === r.hatchery.steps && fresh.length === 0) return
  const { refund } = bankEggs(steps - r.hatchery.steps, fresh)
  r.hatchery = { steps, eggs: g.eggs.found.length, refund: r.hatchery.refund + refund }
}

/**
 * Moves the run's ₽ not banked yet into the wallet and saves its Pokédex log.
 * Quitting keeps coins but forfeits the survival bonus, unless Mewtwo already
 * fell (victory or endless). Every species seen or defeated counts either way.
 */
const bankRun = (r: Run, withBonus: boolean) => {
  const g = own(r)
  const total = withBonus ? runEarnings(g).total : g.coins
  if (total > r.paid) depositPokeDollars(total - r.paid)
  r.paid = Math.max(r.paid, total)
  bankHatchery(r)
  // Merged into the stored Pokédex, which an account sync may have grown during the run.
  updateSave((save) => ({ ...save, dex: mergeDex(save.dex, recordRun(r.dexBase, ownLog(r))) }))
}

/**
 * Records the run into missions and achievements. Safe to call again (victory,
 * then endless mode, then the way out): only what changed since counts.
 */
const recordProgress = (r: Run) => {
  const summary = summarizeRun(own(r))
  // Reward eggs share the run's egg cap with the eggs it found.
  const record = recordRunProgress(summary, r.recorded, Math.max(0, EGGS.perRun - r.game.eggs.found.length - r.rewardEggs))
  r.recorded = summary
  r.unlocked.push(...record.unlocked)
  r.reward += record.reward
  r.rewardEggs += record.eggs.length
  r.rewardItems.push(...record.items)
  return record
}

/**
 * Reports the run to the ranking (signed in): at a victory or a faint, and on
 * the way out, which only sends again if the run went on into endless mode.
 * Quits in the first minute aren't worth a line on the profile.
 */
const rankRun = (r: Run) => {
  // Co-op runs stay off the boards (for now): the ranking compares solo runs.
  if (r.coop) return
  const result = runResult(r.game, __GAME_VERSION__)
  if (!rankable(result)) return
  if (r.ranked) r.rank = r.ranked.submit(result, r.recorder.replay)
  // The first challenge run of the day that counts is this device's attempt; it grows if it goes on into endless mode.
  const c = r.challenge
  if (c && (c.attempt || loadAttempt()?.day !== c.day)) {
    c.attempt = true
    saveAttempt({ day: c.day, time: result.time })
  }
}

/** Reports how the run ended, once. */
const reportRun = (r: Run) => {
  if (r.reported) return
  r.reported = true
  const g = own(r)
  const outcome = g.endless ? 'endless' : g.phase === 'victory' || g.phase === 'gameover' ? g.phase : 'quit'
  track('run_end', { starter: g.player.starter, difficulty: g.difficulty, outcome, minute: Math.floor(g.time / 60), level: g.player.level, kills: g.kills, team: g.players.length })
}

const endRun = () => {
  if (!run) return
  bankRun(run, wonRun(run.game))
  reportRun(run)
  rankRun(run)
  // Only a quit run can complete something here: the results screen already showed the rest.
  // The toast waits for the next screen, so it lands on top of it.
  const record = recordProgress(run)
  later(() => progressToast(ui, record))
  void syncSave()
  run.overlay?.dispose()
  run.closeText?.()
  run.hud.dispose()
  run.team?.dispose()
  run.tags?.dispose()
  coopNotice.classList.add('hidden')
  clearToasts(ui)
  run = null
}

const loadingScreen = () => h('div', { class: 'screen' }, h('p', { class: 'loading blink' }, t().loading))

/** The next run's seed, the day's outbreak and the wild cast, drawn ahead so the menus can warm up its first stage. */
type RunPlan = { seed: number; outbreak: EnemyId; roster: Roster }

/** A Desafio do dia run, as `startRun` takes it: the challenge, and whether the screen called it official. */
type ChallengeRun = { challenge: Challenge; official: boolean }

const planRun = (): RunPlan => {
  const seed = Date.now()
  const outbreak = outbreakToday()
  return { seed, outbreak, roster: runRoster(seed, outbreak) }
}

let upcoming = planRun()

/**
 * Species a run may need outside its drawn cast, with when they can first show
 * up: the fleeing Meowth, the rift legendaries and the endless mode's reaper.
 */
const EXTRAS = [
  { dex: MEOWTH_DEX, at: MAP_EVENTS.meowth.spawn.from },
  ...RIFT_LEGENDS.map((id) => ({ dex: ENEMIES[id].dex, at: RIFT.firstAt })),
  { dex: ENEMIES[REAPER].dex, at: ENDLESS.reaperAt },
]

/** Dex numbers of a cast's first stage, the only enemies a run waits for. */
const openingDex = (plan: Pick<RunPlan, 'roster'>) => rosterSchedule(plan.roster).flatMap((s) => (s.at === 0 ? [s.dex] : []))

/**
 * Loads the starter's evolution line and the first stage's species, then starts
 * a fresh run: a regular one from the save (upgrades, the Bag's armed items),
 * or the Desafio do dia's (`challengeStart`: its seed, nothing from the save
 * but the shiny colors). The rest of the cast (later stages, swarms, bosses) and the
 * `EXTRAS` stream in the background in the order the run needs them, then the
 * next run's opening.
 */
const startRun = async (starter: PlayableId, daily: ChallengeRun | null = null) => {
  setScreen(null)
  endRun()
  const c = daily?.challenge ?? null
  if (!c) lastStarter = starter
  const loading = loadingScreen()
  ui.append(loading)
  // The start token's clock starts now, while the sprites load.
  const ranked = startRanked(c?.day ?? null)
  // A plan from another day (the menus stayed open past midnight) would play yesterday's outbreak.
  const plan = c ? { seed: c.seed, outbreak: c.outbreak, roster: runRoster(c.seed, c.outbreak) } : upcoming.outbreak === outbreakToday() ? upcoming : planRun()
  if (!c) upcoming = planRun()
  await loadAll([...playableDex(starter), ...openingDex(plan)])
  // The outbreak's shiny can show up in the first minute.
  void preloadShinies([ENEMIES[plan.outbreak].dex])
  // Armed bag items are used up as the run starts (the challenge leaves them in the Bag).
  const { bag, used } = c ? { bag: loadSave().bag, used: { lure: false, incense: false } } : useArmed(loadSave().bag)
  updateSave((s) => ({ ...s, bag }))
  const save = loadSave()
  const start: ReplayStart = c ? challengeStart(c, view, challengeShiny(c)) : {
    seed: plan.seed,
    starter,
    difficulty: save.difficulty,
    ranks: save.ranks,
    // A shiny hatch is shiny for good; a starter rolled shiny once plays shiny when picked so.
    shiny: (isHatchling(starter) && save.hatched[starter]?.shiny === true) || save.shinyStarters[starter] === true,
    luckyEgg: save.eggs.length === 0 && HATCHLING_IDS.every((id) => !save.hatched[id]),
    outbreak: plan.outbreak,
    lure: used.lure,
    incense: used.incense,
    view: { w: view.w, h: view.h },
  }
  // Created like a replay is re-simulated (the roster drawn ahead is the same one).
  const game = startGame(start, view)
  // The 1/64 roll unlocks this Pokémon's shiny for good (Normal/Shiny on the select screen).
  if (game.player.luckyShiny) updateSave((s) => ({ ...s, shinyStarters: unlockShinyStarter(s.shinyStarters, starter) }))
  // A shiny run must not start in normal colors.
  if (game.player.shiny) await preloadShinies(playableDex(starter))
  // A co-op room may have started while the sprites loaded: it wins.
  if (run) return
  // Alternate forms (Aegislash's Blade Forme) stream in behind; until then the normal form stands in.
  void preloadForms(playableDex(starter), game.player.shiny)
  loading.remove()
  run = {
    game,
    hud: runHud(),
    overlay: null,
    shown: null,
    closeText: null,
    paid: 0,
    reported: false,
    missionsBefore: missionStatus(save.missions, today()),
    recorded: null,
    unlocked: [],
    reward: 0,
    rewardEggs: 0,
    rewardItems: [],
    hatchery: { steps: 0, eggs: 0, refund: 0 },
    dexBase: save.dex,
    recorder: startRecording(start),
    ranked,
    rank: null,
    coop: null,
    team: null,
    tags: null,
    picked: false,
    bestBefore: save.achievements.lifetime.bestTime,
    challenge: daily ? { day: daily.challenge.day, official: daily.official, attempt: false } : null,
  }
  track('run_start', { starter, difficulty: game.difficulty, team: 1, ...(daily ? { challenge: daily.official ? 'official' : 'practice' } : {}) })
  announceRun(start, run.challenge)
  const later = [...rosterSchedule(plan.roster).filter((s) => s.at > 0), ...EXTRAS].sort((a, b) => a.at - b.at)
  void streamSpecies([...later.map((s) => s.dex), ...openingDex(upcoming)], () => run?.game === game)
}

/** Opens the pause menu: solo it pauses the run; in co-op the run goes on behind the menu. */
const togglePause = () => {
  if (!run) return
  if (run.coop) {
    run.coop.menu = !run.coop.menu
    return
  }
  if (run.game.phase === 'playing') run.game.phase = 'paused'
}

/** The run's first toasts: the challenge it plays, the day's outbreak, then each bag item it used. */
const announceRun = (start: ReplayStart, challenge: Run['challenge']) => {
  if (challenge) {
    const m = t().challenge
    toast(ui, h('span', { class: 'item-toast' }, h('img', { src: ribbonIcon('gold'), alt: '' }), h('span', {}, rich(m.started(formatDay(challenge.day))), h('small', {}, challenge.official ? m.startedOfficial : m.startedPractice))), 4200, 'challenge')
  }
  if (start.outbreak) {
    const def = ENEMIES[start.outbreak]
    toast(ui, h('span', { class: 'item-toast' }, h('img', { src: portraitUrl(def.dex), alt: '' }), h('span', {}, rich(t().outbreak.started(def.name)), h('small', {}, t().outbreak.hint))), 4200, 'outbreak')
  }
  for (const id of BAG_ITEM_IDS) {
    if (start[id]) toast(ui, h('span', { class: 'item-toast' }, h('img', { src: bagIcon(id), alt: '' }), h('b', {}, BAG_ITEMS[id].name), t().bag.active[id]), 3200, id)
  }
}

const runHud = () => {
  const hud = createHud(ui, queueSpecial, queueMega, queueLunge, togglePause)
  requestAnimationFrame(syncMarkerInsets)
  return hud
}

/** Measures the HUD (top bar, status box, special button) in world px, so map event arrows stay clear of it. */
const syncMarkerInsets = () => {
  const box = canvas.getBoundingClientRect()
  // Hidden elements (the touch special button on desktop) measure 0x0: they don't count.
  const rect = (sel: string) => {
    const r = ui.querySelector(sel)?.getBoundingClientRect()
    return r && r.height > 0 ? r : null
  }
  const bottomOf = (sel: string) => rect(sel)?.bottom ?? box.top
  const topOf = (sel: string) => rect(sel)?.top ?? box.bottom
  const top = bottomOf('.hud-row') - box.top
  const bottom = box.bottom - Math.min(topOf('.hud .status'), topOf('.special-button'))
  setMarkerInsets({ top: Math.max(0, top) / cssScale + 10, bottom: Math.max(0, bottom) / cssScale + 10, side: 14 })
}

/** Settings from the pause menu. The HUD reads its labels once, so a language switch rebuilds it. */
const runSettings = (r: Run, back: () => void) => {
  const before = locale()
  return openSettings(ui, input, () => {
    if (locale() !== before) {
      r.hud.dispose()
      r.hud = runHud()
      dirty = true
    }
    back()
  })
}

/** Rebuilds the modal overlay whenever the simulation phase (or offer set, or the co-op menu) changes. */
const syncOverlay = (r: Run) => {
  const g = own(r)
  const link = r.coop
  // A new set of offers is a new pick for this player.
  if (link && r.shown && r.shown.offers !== g.player.offers) r.picked = false
  const menuOpen = link?.menu === true && g.phase === 'playing'
  if (r.shown?.phase === g.phase && r.shown.offers === g.player.offers && r.shown.picked === r.picked && r.shown.menu === menuOpen) return
  r.overlay?.dispose()
  r.overlay = null
  r.shown = { phase: g.phase, offers: g.player.offers, picked: r.picked, menu: menuOpen }
  r.hud.setMenuOpen(menuOpen || (g.phase !== 'playing' && g.phase !== 'evolving'))
  if (link) return syncCoopOverlay(r, g, link, menuOpen)
  switch (g.phase) {
    case 'levelup':
      r.overlay = levelUp(ui, input, g, (offer) => (recordEvent(r.recorder, ['offer', g.player.offers.indexOf(offer)]), chooseOffer(g, offer)), {
        reroll: () => (recordEvent(r.recorder, ['reroll']), rerollOffers(g)),
        skip: () => (recordEvent(r.recorder, ['skip']), skipLevelUp(g)),
      })
      break
    case 'paused':
      r.overlay = pauseMenu(ui, input, g, { resume: () => (g.phase = 'playing'), quit: () => afterRun(() => showMenu()), settings: (back) => runSettings(r, back) })
      break
    case 'gameover':
    case 'victory':
      r.overlay = results(
        ui,
        input,
        g,
        () => afterRun(() => void (r.challenge ? replayChallenge() : startRun(lastStarter))),
        () => afterRun(() => showMenu()),
        () => (recordEvent(r.recorder, ['endless']), continueEndless(g)),
        resultExtras(r),
      )
      break
  }
}

/** What the results add around the run: title, missions, medals, eggs, Pokédex news, the ranking (solo) and the share card. */
const resultExtras = (r: Run) => {
  const g = own(r)
  return {
    badge: titleBadge(loadSave().title),
    report: missionReport(r.missionsBefore, r.reward, r.rewardEggs, r.rewardItems),
    medals: medalChips(r.unlocked),
    eggs: { refund: r.hatchery.refund, ready: loadSave().eggs.filter(isReady).length },
    news: dexNews(r.dexBase, ownLog(r)),
    ranking:
      rankingEnabled && !r.coop
        ? { panel: rankPanel(r.rank, r.challenge !== null), open: (back: () => void) => rankingScreen(ui, input, back, { difficulty: g.difficulty, challenge: r.challenge !== null }) }
        : null,
    share: {
      open: (back: () => void) => sharePreview(ui, input, runShare(g, r.dexBase, r.challenge && r.rank ? r.rank.then((o) => (o.kind === 'ranked' ? o.challenge : null)) : null), back),
      glow: g.player.shiny || g.dexLog.shinies.size > 0 || wonRun(g) || g.time > r.bestBefore,
    },
  }
}

/** The team under a co-op run's results: each player's final form and name in their slot color. */
const teamRow = (g: Game, link: CoopLink) =>
  h(
    'div',
    { class: 'result-team' },
    ...g.players.map((p) =>
      h(
        'span',
        { class: p.gone ? 'result-mate gone' : 'result-mate', style: `--slot:${slotColor(p.slot)}` },
        h('img', { src: portraitUrl(playerDex(g, p), p.shiny), alt: '' }),
        link.names[p.slot] ?? `P${p.slot + 1}`,
      ),
    ),
  )

/**
 * Co-op overlays: this player's level-up (picks travel to the room and apply
 * when their tick comes back, with the team's timer), the team's wait once
 * picked, the menu (the run goes on behind it) and the results, where Back to
 * room returns to the lobby and a victory's Continue takes everyone on.
 */
const syncCoopOverlay = (r: Run, g: Game, link: CoopLink, menuOpen: boolean) => {
  const entry = (e: TickEntry, viaServer: () => void) => sendEntry(link, e, viaServer)
  switch (g.phase) {
    case 'levelup': {
      const p = g.player
      if (r.picked || p.pendingLevelUps <= 0 || p.offers.length === 0) {
        r.overlay = teamWait(ui, r.game, link.names)
        break
      }
      const round = p.round
      r.overlay = levelUp(
        ui,
        input,
        g,
        (offer) => {
          const index = p.offers.indexOf(offer)
          r.picked = true
          entry([link.slot, 'offer', index, round], () => sendOffer(index, round))
        },
        {
          reroll: () => entry([link.slot, 'reroll'], () => sendChoice('reroll')),
          skip: () => ((r.picked = true), entry([link.slot, 'skip'], () => sendChoice('skip'))),
          countdown: () => r.game.coop?.pickLeft ?? 0,
        },
      )
      break
    }
    case 'playing':
      if (menuOpen) {
        r.overlay = pauseMenu(ui, input, g, {
          coop: true,
          resume: () => (link.menu = false),
          quit: () => afterRun(() => (leaveRoom(), showMenu())),
          settings: (back) => runSettings(r, back),
        })
      }
      break
    case 'gameover':
    case 'victory':
      r.overlay = results(
        ui,
        input,
        g,
        () => afterRun(() => (link.bots ? showMenu() : (backToLobby(), showLobby()))),
        () => afterRun(() => (leaveRoom(), showMenu())),
        () => entry([link.slot, 'endless'], () => sendChoice('endless')),
        { ...resultExtras(r), coop: { team: teamRow(g, link) } },
      )
      break
  }
}

const offerLabel = (offer: Extract<GameEvent, { kind: 'pokeball' }>['offer']) => {
  const m = t().toast
  if (!offer) return m.pokeballEmpty
  if (offer.kind === 'move') return m.pokeballLevel(MOVES[offer.id].name, offer.level)
  if (offer.kind === 'item') return m.pokeballLevel(ITEMS[offer.id].name, offer.level)
  if (offer.kind === 'evolution') return m.pokeballEvolution(MOVES[offer.to].name)
  return m.pokeballBerry
}

/** Sounds of enemy traits: the warning (fuse lit, beam aimed, leap) and the moment it goes off. */
const TRAIT_SFX: Record<TraitId, Record<'warn' | 'fire', Sfx | null>> = {
  healer: { warn: null, fire: 'enemyPulse' },
  shield: { warn: null, fire: 'enemyPulse' },
  summoner: { warn: null, fire: 'enemyPulse' },
  kamikaze: { warn: 'selfDestruct', fire: 'blast' },
  beam: { warn: 'beamCharge', fire: 'beam' },
  leaper: { warn: 'leap', fire: 'quake' },
}

/**
 * A teammate's news in co-op: their fainting, revival, leaving, evolution
 * and Mega Evolution toast; their item pickups and hits on the horde sound
 * like the world; the rest (their level-up sounds, hurt, Poké Balls) stays theirs.
 */
const handleTeamEvent = (r: Run, e: RunEvent, slot: number): void => {
  const link = r.coop!
  const p = r.game.players[slot]
  const name = link.names[slot] ?? `P${slot + 1}`
  const c = t().coop
  switch (e.kind) {
    case 'fainted':
      playSfx('hurt', 120)
      return toast(ui, rich(c.fainted(name)), 3200, `fainted-${slot}`)
    case 'revived':
      playSfx('heal')
      return toast(ui, rich(c.revived(name)), 2400, `fainted-${slot}`)
    case 'left':
      return toast(ui, c.left(name), 3000)
    case 'evolve':
      // The world holds still for everyone while it plays: say why.
      if (p) toast(ui, rich(c.evolving(name, PLAYABLE[p.starter].line[p.stage]!.name)), 4400, `evolve-${slot}`)
      return
    case 'evolved':
      playSfx('evolve')
      if (p) toast(ui, rich(c.evolved(name, PLAYABLE[p.starter].line[p.stage]!.name)), 3200, `evolve-${slot}`)
      return
    case 'mega':
      playSfx('megaBurst', 0)
      return toast(ui, rich(c.mega(name, e.name)), 3000)
    case 'consumable':
    case 'kill':
    case 'hit':
    case 'propBreak':
      handleEvent(r, { ...e, slot: link.slot })
      return
  }
}

const handleEvent = (r: Run, e: RunEvent) => {
  if (r.coop && e.slot !== undefined && e.slot !== r.coop.slot) return handleTeamEvent(r, e, e.slot)
  const g = own(r)
  switch (e.kind) {
    case 'fainted':
      playSfx('gameOver')
      return toast(ui, t().coop.youFainted, 4000, 'fainted-me')
    case 'revived':
      playSfx('evolve')
      return toast(ui, t().coop.youRevived, 2400, 'fainted-me')
    case 'left':
      return
    case 'hit': return playSfx(e.effective > 1 ? 'superHit' : 'hit', 45)
    case 'kill': return playSfx('kill', 50)
    case 'pickup': return playSfx('pickup', 35)
    case 'coin': return playSfx('coin', 60)
    case 'heal': return playSfx('heal')
    case 'hurt': return playSfx('hurt', 120)
    case 'levelup': return playSfx('levelUp')
    case 'thunder': return playSfx('thunder', 150)
    case 'quake': return playSfx('quake', 150)
    case 'special': {
      // A chain dash "releases" on every landing: a cut, not an explosion.
      if (e.phase === 'release') return playSfx(gameSpecial(g).def.kind === 'chain' ? 'slash' : 'specialBlast', 0)
      playSfx('specialCharge', 0)
      playCry(playerCry(g), 0.5)
      return toast(ui, rich(t().toast.used(playerName(g), e.name)), 1600, 'special')
    }
    case 'megaChoice': {
      const [a, b] = megasOf(g.player.starter).map((id) => MEGAS[id].stone)
      playSfx('unlock')
      return a && b && toast(ui, rich(t().mega.choose(a, b)), 4200, 'mega')
    }
    case 'megaStone': {
      const def = heldMega(g)
      if (!def) return
      const line = PLAYABLE[g.player.starter].line
      const final = g.player.stage >= line.length - 1
      playSfx('unlock')
      return toast(
        ui,
        h('span', { class: 'item-toast mega-toast' }, h('img', { src: megaStoneIcon(def), alt: '' }), h('span', {}, rich(t().mega.stone(def.stone)), h('small', {}, rich(final ? t().mega.stoneReady : t().mega.stoneLocked(line.at(-1)!.name))))),
        4200,
        'mega',
      )
    }
    case 'megaStart': {
      const def = heldMega(g)
      playSfx('megaCharge', 0)
      playCry(sprites(playerDex(g)).cry, 0.6)
      return def && toast(ui, rich(t().mega.reacting(def.stone)), 1400, 'mega')
    }
    case 'mega': {
      playSfx('megaBurst', 0)
      playCry(playerCry(g), 0.9)
      return banner(ui, rich(t().mega.evolved(PLAYABLE[g.player.starter].line[g.player.stage]!.name, e.name)), 2400)
    }
    case 'megaEnd':
      playSfx('stance', 0)
      return toast(ui, t().mega.ended(playerName(g)), 1800, 'mega')
    case 'megaReady':
      playSfx('shiny')
      return toast(ui, rich(t().mega.ready), 2400, 'mega')
    case 'stance': {
      playSfx('stance', 0)
      const who = PLAYABLE[g.player.starter].line[g.player.stage]!.name
      return toast(ui, rich(t().toast.stance(who, t().hud.stances[e.stance])), 1200, 'special')
    }
    case 'boss': {
      const def: EnemyDef = ENEMIES[e.enemy]
      if (def.legendary) {
        playSfx('legendary')
        playCry(sprites(def.dex).cry, 0.7)
        flashScreen(ui)
        return banner(ui, rich(t().toast.legendary(def.name)))
      }
      playSfx('boss')
      playCry(sprites(def.dex).cry, 0.5)
      return toast(ui, rich(t().toast.boss(def.name)), 3200)
    }
    case 'bossFled': {
      const def = ENEMIES[e.enemy]
      playCry(sprites(def.dex).cry, 0.3)
      return toast(ui, h('span', { class: 'item-toast' }, h('img', { src: portraitUrl(def.dex), alt: '' }), rich(t().toast.bossFled(def.name))), 3200)
    }
    case 'enrage': {
      // No toast: the cry, the flash and the boss's red outline carry it.
      playSfx('boss')
      playCry(sprites(ENEMIES[e.enemy].dex).cry, 0.8)
      return flashScreen(ui)
    }
    case 'shiny': {
      const def = ENEMIES[e.enemy]
      playSfx('shiny')
      playCry(sprites(def.dex).cry, 0.4)
      return toast(ui, rich(t().toast.shiny(def.name)), 3200)
    }
    case 'caught': {
      const def = ENEMIES[e.enemy]
      if (dexStatus(r.dexBase, def.dex).shiny) return
      playSfx('shiny')
      return toast(ui, h('span', { class: 'item-toast' }, h('img', { src: portraitUrl(def.dex, true), alt: '' }), rich(t().toast.caught(def.name))), 3600)
    }
    case 'shinyPlayer': {
      playSfx('shiny')
      return toast(ui, rich(t().toast.shinyPlayer(PLAYABLE[g.player.starter].name)), 3600)
    }
    case 'evolve': {
      playCry(sprites(e.from).cry)
      r.closeText?.()
      r.closeText = textBox(ui, t().toast.evolving(PLAYABLE[g.player.starter].line[g.player.stage]!.name))
      return
    }
    case 'evolved': {
      const line = PLAYABLE[g.player.starter].line
      playSfx('evolve')
      playCry(sprites(e.to).cry)
      r.closeText?.()
      r.closeText = null
      return toast(ui, t().toast.evolved(line[g.player.stage - 1]!.name, line[g.player.stage]!.name), 3500)
    }
    case 'moveEvolved':
      playSfx('evolve')
      playCry(playerCry(g), 0.3)
      return toast(ui, rich(t().toast.moveEvolved(MOVES[e.from].name, MOVES[e.to].name), { class: 'toast-evo' }), 3500)
    case 'pokeball':
      playSfx('levelUp')
      return toast(ui, t().toast.pokeball(offerLabel(e.offer)))
    case 'consumable': {
      const def = CONSUMABLES[e.item]
      playSfx(def.sfx)
      return toast(ui, h('span', { class: 'item-toast' }, h('img', { src: consumableIcon(e.item), alt: '' }), h('b', {}, def.name), t().consumables[e.item]), 2200, e.item)
    }
    case 'propBreak':
      return playSfx('break', 60)
    case 'mapEvent':
      return mapEventFeedback(ui, e.notice)
    case 'revive':
      playSfx('evolve')
      return toast(ui, h('span', { class: 'item-toast' }, h('img', { src: consumableIcon('revive'), alt: '' }), rich(t().toast.revive)), 3000)
    case 'gameover':
      bankRun(r, true)
      recordProgress(r)
      reportRun(r)
      rankRun(r)
      playSfx('gameOver')
      return playCry(playerCry(g))
    case 'victory':
      bankRun(r, true)
      recordProgress(r)
      rankRun(r)
      return playSfx('evolve')
    case 'biome': {
      const w = t().world
      playSfx('item')
      return banner(
        ui,
        h('span', { class: 'biome-banner' }, h('small', {}, w.area(BIOME_ORDER.indexOf(e.biome) + 1, BIOME_ORDER.length)), h('b', {}, w.biomes[e.biome])),
        2800,
      )
    }
    case 'weather':
      return weatherToast(e.weather, e.prev)
    case 'trait': {
      const sfx = TRAIT_SFX[e.trait][e.phase]
      if (sfx) playSfx(sfx, 120)
      return
    }
    case 'traitIntro': {
      const def = ENEMIES[e.enemy]
      playCry(sprites(def.dex).cry, 0.35)
      return toast(ui, h('span', { class: 'item-toast' }, h('img', { src: portraitUrl(def.dex), alt: '' }), rich(t().traits[e.trait](def.name))), 3400)
    }
    case 'riftOpen':
      playSfx('shiny')
      return toast(ui, rich(t().rifts.open), 3200)
    case 'riftClosed':
      return toast(ui, t().rifts.closed, 2000)
    case 'riftEnter': {
      const def = ENEMIES[e.enemy]
      playSfx('legendary')
      playCry(sprites(def.dex).cry, 0.7)
      flashScreen(ui)
      return banner(ui, rich(e.shiny ? t().rifts.enterShiny(def.name) : t().rifts.enter(def.name)))
    }
    case 'riftCleared':
      playSfx('evolve')
      return toast(ui, rich(t().rifts.cleared(ENEMIES[e.enemy].name), { class: 'toast-evo' }), 3500)
    case 'riftExit':
      if (e.outcome === 'collapse') {
        playSfx('quake')
        return toast(ui, t().rifts.collapse, 3000)
      }
      return
    case 'reaper':
      playSfx('legendary')
      playCry(sprites(ENEMIES[REAPER].dex).cry, 0.8)
      flashScreen(ui)
      return banner(ui, rich(e.defeats > 0 ? t().rifts.reaperBack : t().rifts.reaper))
    case 'reaperDown':
      playSfx('evolve')
      flashScreen(ui)
      return banner(ui, rich(t().rifts.reaperDown))
    case 'egg': {
      const m = t().eggs
      playSfx('unlock')
      return toast(ui, h('span', { class: 'item-toast' }, h('img', { src: eggIcon(e.tier), alt: '' }), rich(m.found(m.tiers[e.tier]))), 3600)
    }
  }
}

/** Announces a weather change: what started (and what it does), or what just ended. The newest replaces one still showing. */
const weatherToast = (next: WeatherId, prev: WeatherId) => {
  const w = t().world
  if (next === 'clear') {
    if (prev !== 'clear') toast(ui, h('span', { class: 'item-toast' }, h('img', { src: weatherIcon(prev), alt: '' }), w.weatherEnd[prev]), 2600, 'weather')
    return
  }
  playSfx('select')
  toast(
    ui,
    h('span', { class: 'item-toast weather-toast' }, h('img', { src: weatherIcon(next), alt: '' }), h('span', {}, rich(w.weatherStart[next]), h('small', {}, w.weatherHint[next]))),
    3400,
    'weather',
  )
}

/* ---------------- Music ---------------- */

/** Silence until "press start", then menus play the village theme, a run its biome's theme, and a living boss takes over until it falls. */
const themeFor = (r: Run | null): ThemeId | null => {
  if (!pressedStart) return null
  if (!r || r.game.phase === 'gameover' || r.game.phase === 'victory') return 'menu'
  // A rift arena keeps the boss theme until the player is back, loot window included.
  return r.game.bossId !== null || r.game.rift.arena !== null ? 'boss' : BIOMES[r.game.biome.id].theme
}

/* ---------------- Global keys ---------------- */

input.onKey((key) => {
  unlockAudio()
  if (key === 'KeyM') toggleMute()
  if (!run) return
  const g = run.game
  if ((key === 'Escape' || key === 'KeyP') && g.phase === 'playing' && !run.overlay) togglePause()
  if (key === 'Space') queueSpecial()
  if (key === 'KeyE') queueMega()
  if (key === 'ShiftLeft' || key === 'ShiftRight') queueLunge()
})
// Touch only counts as a user activation on pointerup/touchend (not pointerdown).
for (const type of ['pointerdown', 'pointerup', 'touchend'] as const) window.addEventListener(type, unlockAudio)

/* ---------------- Browser chrome ---------------- */

// No pinch/double-tap zoom, pull-to-refresh, rubber-banding or long-press menus.
// CSS `touch-action` covers most browsers; these guards cover iOS Safari quirks.
const blockDefault = (e: Event) => e.preventDefault()
document.addEventListener('contextmenu', blockDefault)
document.addEventListener('gesturestart', blockDefault)
document.addEventListener(
  'touchmove',
  (e) => {
    const inScrollable = e.target instanceof Element && e.target.closest('.screen')
    if (e.touches.length > 1 || !inScrollable) e.preventDefault()
  },
  { passive: false },
)

// Solo pauses when the tab hides; co-op can't, so the player's Pokémon stands still (and the run catches up on return).
document.addEventListener('visibilitychange', () => {
  if (run?.coop) {
    if (!run.coop.bots) sendAway(document.hidden)
    return
  }
  if (document.hidden && run?.game.phase === 'playing') run.game.phase = 'paused'
})

/* ---------------- Loop ---------------- */

let last = performance.now()
let acc = 0

const frame = (now: number) => {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  const t = now / 1000
  // Gamepads drive the menus through the same key codes as the keyboard.
  for (const key of padKeys()) input.press(key)

  if (run?.coop) {
    coopFrame(run, run.coop, dt, t, now)
  } else if (run) {
    const r = run
    const g = r.game
    if (padA()) queueSpecial()
    if (padY()) queueMega()
    if (padX()) queueLunge()
    let steps = 0
    if (g.phase === 'playing' || g.phase === 'evolving') {
      acc += dt
      while (acc >= STEP) {
        // The simulation gets the stick as the replay stores it (`moveCode`), so a re-simulation sees the same run.
        if (specialQueued) recordEvent(r.recorder, ['special'])
        if (megaQueued) recordEvent(r.recorder, ['mega'])
        if (lungeQueued) recordEvent(r.recorder, ['lunge'])
        step(g, { move: recordStep(r.recorder, view, input.readMove()), special: specialQueued, mega: megaQueued, lunge: lungeQueued }, STEP)
        specialQueued = false
        megaQueued = false
        lungeQueued = false
        acc -= STEP
        steps++
      }
    } else {
      acc = 0
      specialQueued = false
      megaQueued = false
      lungeQueued = false
    }
    for (const e of g.events.splice(0)) handleEvent(r, e)
    if (run === r) {
      syncOverlay(r)
      // Toasts and banners wait out menus, level-ups and evolutions with their clocks stopped.
      tickToasts(ui, dt, g.phase !== 'playing')
      // Redraw only when the simulation advanced: halves the work on 120 Hz phones and
      // idles the GPU while a menu is open over a frozen frame.
      if (steps > 0 || dirty) {
        dirty = false
        g.camera.x = g.player.screen.x
        g.camera.y = g.player.screen.y
        render(ctx, g, t, settings())
        const stick = input.readStick()
        if (stick && g.phase === 'playing') drawJoystick(ctx, stick, cssScale)
        r.hud.update(g)
      }
    }
  } else {
    // Attract mode: wild Pokémon stroll through the meadow behind the menus.
    stepTitleScene(scene, dt, view.w, view.h)
    drawTitleScene(ctx, scene, view.w, view.h)
    ctx.fillStyle = `rgba(16,24,48,${screen?.dim ?? 0.35})`
    ctx.fillRect(0, 0, view.w, view.h)
    // Menu news (what a quit run completed) shares the run's queue.
    tickToasts(ui, dt, false)
  }
  screen?.tick?.(t)
  playTheme(themeFor(run))
  // Ducked under the pause menu, but at full level while the player tunes the volume.
  duckMusic(run?.game.phase === 'paused' && !isSettingsOpen())
  requestAnimationFrame(frame)
}

/* ---------------- Co-op ---------------- */

/** "Waiting for the other trainers" before the clock starts, "Syncing" while catching up. */
const coopNotice = h('div', { class: 'coop-notice box hidden' })
ui.append(coopNotice)

/** The co-op run seen from this device: its player drawn where the stick already took them, the camera on them, this screen's view. */
const coopLens = (r: Run, link: CoopLink): Game => {
  const g = r.game
  const mine = me(g, link)
  const off = predictedOffset(g, link)
  const shown = off.x !== 0 || off.y !== 0 ? { ...mine, x: mine.x + off.x, y: mine.y + off.y } : mine
  const players = shown === mine ? g.players : g.players.map((p) => (p === mine ? shown : p))
  return { ...g, player: shown, players, view, camera: { x: shown.x - view.w / 2, y: shown.y - 10 - view.h / 2 } }
}

/**
 * One frame of a co-op run: presses go to the room (or the local feed),
 * the lockstep driver simulates the ticks due (`stepCoop`), news plays
 * (held back while catching up), the overlays follow, and it draws from this
 * player's side. It always redraws: prediction moves this player between ticks.
 */
const coopFrame = (r: Run, link: CoopLink, dt: number, time: number, now: number) => {
  const g = r.game
  if (padA()) queueSpecial()
  if (padY()) queueMega()
  if (padX()) queueLunge()
  const press = (flag: boolean, kind: 'special' | 'mega' | 'lunge') => flag && sendEntry(link, [link.slot, kind], () => sendPress(kind))
  press(specialQueued, 'special')
  press(megaQueued, 'mega')
  press(lungeQueued, 'lunge')
  specialQueued = megaQueued = lungeQueued = false
  const going = link.bots !== null || room()?.going === true
  if (going) stepCoop(g, link, dt, input.readMove(), now)
  const catching = !link.bots && backlog(link) > CATCH_UP
  setText(coopNotice, !going ? t().coop.waiting : catching ? t().coop.syncing : '')
  coopNotice.classList.toggle('hidden', going && !catching)
  if (!link.over && (g.phase === 'gameover' || g.phase === 'victory')) {
    link.over = true
    if (!link.bots) runOver()
  }
  // Catching up, only the run's outcome matters: the rest is old news.
  for (const e of g.events.splice(0)) if (!catching || e.kind === 'gameover' || e.kind === 'victory') handleEvent(r, e)
  if (run !== r) return
  syncOverlay(r)
  r.overlay?.tick?.(time)
  tickToasts(ui, dt, g.phase !== 'playing')
  const lens = coopLens(r, link)
  render(ctx, lens, time, settings())
  r.tags?.update(lens, cssScale)
  const stick = input.readStick()
  if (stick && g.phase === 'playing' && !link.menu) drawJoystick(ctx, stick, cssScale)
  r.hud.update(lens)
  r.team?.update(g)
}

/** Loads what a co-op run needs (every player's line, the opening species) and starts it, from the room's `start`. */
const startCoopRun = async (start: RunStart, slot: number, bots = false) => {
  setScreen(null)
  endRun()
  const setups = start.members.map(setupOf)
  const names = start.members.map((m) => m.name)
  const loading = loadingScreen()
  ui.append(loading)
  // No outbreak in co-op: the day could differ between players' clocks.
  const roster = runRoster(start.seed, null)
  await loadAll([...setups.flatMap((s) => playableDex(s.starter)), ...openingDex({ roster })])
  const game = createCoopGame({ ...start.view }, start.seed, setups, start.difficulty, roster)
  for (const p of game.players) {
    if (p.shiny) await preloadShinies(playableDex(p.starter))
    void preloadForms(playableDex(p.starter), p.shiny)
  }
  loading.remove()
  if (run) endRun()
  const save = loadSave()
  run = {
    game,
    hud: runHud(),
    overlay: null,
    shown: null,
    closeText: null,
    paid: 0,
    reported: false,
    missionsBefore: missionStatus(save.missions, today()),
    recorded: null,
    unlocked: [],
    reward: 0,
    rewardEggs: 0,
    rewardItems: [],
    hatchery: { steps: 0, eggs: 0, refund: 0 },
    dexBase: save.dex,
    recorder: startRecording({ seed: start.seed, starter: setups[slot]!.starter, difficulty: start.difficulty, ranks: setups[slot]!.ranks, shiny: setups[slot]!.shiny, luckyEgg: false, outbreak: null, lure: false, incense: false, view: start.view }),
    ranked: null,
    rank: null,
    coop: createLink(slot, names, setups.length, bots),
    team: createTeamHud(ui, names, slot),
    tags: createNameTags(ui, names),
    picked: false,
    bestBefore: save.achievements.lifetime.bestTime,
    challenge: null,
  }
  track('run_start', { starter: setups[slot]!.starter, difficulty: start.difficulty, team: setups.length })
  if (!bots) loaded()
  const later = [...rosterSchedule(roster).filter((s) => s.at > 0), ...EXTRAS].sort((a, b) => a.at - b.at)
  void streamSpecies(later.map((s) => s.dex), () => run?.game === game)
}

/** What this player brings into a room: the Pokémon picked last, its hatched shininess and the Poké Mart ranks, plus this screen's size. */
const sendLoadout = () => {
  const save = loadSave()
  const shiny = isHatchling(lastStarter) && save.hatched[lastStarter]?.shiny === true
  setLoadout({ starter: lastStarter, shiny, ranks: save.ranks }, { w: view.w, h: view.h })
}

/** The co-op hub: create a room, join by code, friends. */
const showCoopHub = (code?: string) => {
  endRun()
  connect()
  setScreen(
    coopHub(ui, input, {
      create: () => createRoom(),
      join: (c) => joinRoom(c),
      friends: accountsEnabled ? () => showFriends(() => showCoopHub()) : null,
      back: () => showTitle({ focus: 1 }),
    }, code),
  )
}

/** The room's lobby (after creating or joining one, and back from a run). */
const showLobby = () => {
  endRun()
  setScreen(
    lobbyScreen(ui, input, {
      change: () => showLobbyPicker(),
      invite: accountsEnabled && accountState().kind === 'signedIn' ? () => showFriends(() => showLobby()) : null,
      leave: () => (leaveRoom(), showCoopHub()),
    }),
  )
}

/** Picks this player's Pokémon for the room, then back to the lobby. */
const showLobbyPicker = () => {
  const select = starterSelect(ui, input, {
    pick: (id) => {
      lastStarter = id
      sendLoadout()
      setTimeout(() => showLobby(), 250)
    },
    incubator: () => showIncubator(() => showLobbyPicker()),
  }, lastStarter)
  const closeBack = titleButton(ui, input, () => showLobby())
  setScreen({ ...select, dispose: () => (closeBack(), select.dispose()) })
}

/** Friends (signed in) or the nudge to sign in; profiles open over it. */
const showFriends = (back: () => void) =>
  setScreen(
    friendsScreen(ui, input, {
      profile: (handle, close) => profileScreen(ui, input, handle, close),
      signIn: () => setScreen(accountScreen(ui, input, () => showFriends(back))),
      close: back,
    }),
  )

// The room drives the screens: joining opens the lobby, a start loads the run (a rejoin too, then fast-forwards), a reset returns to the lobby.
onRoom((e) => {
  const r = room()
  switch (e.t) {
    case 'room':
      sendLoadout()
      if (!run) showLobby()
      return
    case 'start':
      if (r) void startCoopRun(r.run!, r.slot)
      return
    case 'lobby':
      if (e.phase !== 'lobby' || !run?.coop) return
      // The host took the room back to the lobby mid-run: this run is over.
      if (run.game.phase !== 'gameover' && run.game.phase !== 'victory') afterRun(() => showLobby())
      return
    case 'left':
      toast(ui, t().coop.refused.kicked, 3200)
      if (run?.coop) afterRun(() => showMenu())
      else if (screen?.el.querySelector('.lobby')) showCoopHub()
      return
    case 'desync':
      return toast(ui, t().coop.desync, 6000, 'desync')
    case 'refused':
      // A room link that didn't work lands on the hub, which explains why.
      if (!screen?.el.querySelector('.coop-hub, .lobby')) {
        showCoopHub()
        toast(ui, t().coop.refused[e.code], 3600)
      }
      return
  }
})

// A friend's invite: a toast with a button straight into their room.
onInvite((from, code) => {
  playSfx('unlock')
  const join = h('button', { class: 'btn small confirm', onclick: () => (run?.coop ? undefined : joinRoom(code)) }, t().coop.accept)
  toast(ui, h('span', { class: 'invite-toast' }, rich(t().coop.invited(from.name)), join), 12_000, `invite-${code}`)
})

// Signing in or out changes who presence says is online: reconnect with the new credentials.
onAccountChange((s) => {
  if (!coopEnabled || s.kind === 'busy') return
  if (s.kind === 'signedIn' || room()) reconnect()
})
/* ---------------- Boot ---------------- */

/**
 * Warms the sprite cache one species at a time so the menu stays responsive:
 * every region's trio first (menu cards), then the next run's first stage.
 */
const preloadInBackground = async () => {
  const queue = [...REGIONS.flatMap((r) => r.starters.map((id) => STARTERS[id].line[0].dex)), ...openingDex(upcoming)]
  for (const dex of queue) await loadSpecies(dex).catch(() => {})
}

/** A shared profile link (`/?u=handle`): the game opens on that profile, and closing it leaves the link. */
const showSharedProfile = (handle: string) => {
  setScreen(
    profileScreen(ui, input, handle, () => {
      history.replaceState(null, '', location.pathname)
      showTitle()
    }),
  )
}

/**
 * Right after the first sign in on a device (no handle yet), the title gives
 * way to the profile editor, so the player picks how they show up on the ranking.
 */
const promptProfile = () => {
  let asked = false
  onAccountChange((s) => {
    if (asked || s.kind !== 'signedIn' || s.handle !== null || run || !screen?.el.classList.contains('title-home')) return
    asked = true
    setScreen(profileEditor(ui, input, () => showTitle()))
  })
}

const boot = () => {
  document.documentElement.lang = LOCALES[locale()].tag
  // Someone's link (`?ref=`, a profile): remember who brought this device, before anything reads the URL.
  captureRef()
  const params = new URLSearchParams(location.search)
  const shared = rankingEnabled ? parseHandle(params.get(PROFILE_PARAM)) : null
  const code = coopEnabled ? parseRoomCode(params.get(ROOM_PARAM)) : null
  if (code) {
    history.replaceState(null, '', location.pathname)
    // Signed in, straight into the room; a guest first picks the name teammates see.
    if (accountState().kind === 'signedIn') joinRoom(code)
    showCoopHub(code)
  } else if (shared) showSharedProfile(shared)
  // Back from signing in, the player already pressed start before leaving: straight to the menu.
  else showTitle({ intro: !backFromSignIn() })
  requestAnimationFrame(frame)
  void preloadInBackground()
  promptProfile()
  startAccount()
  // Signed in: online for friends. A reload mid-room takes the slot back (held a while) and fast-forwards.
  if (coopEnabled && (savedRoom() || accountState().kind === 'signedIn')) connect()
  // Results that didn't reach the ranking last time (offline) go now, once the account is back.
  if (accountState().kind === 'signedIn') setTimeout(() => void flushRuns(), 5000)
}

boot()

/** Dev: places a map event `dx`, `dy` px from the player, e.g. `ps.event('chest')`. */
const devEvent = (kind: MapEventKind, dx = 70, dy = 0) => {
  if (!run || !MAP_EVENT_KINDS.includes(kind)) return `Kinds: ${MAP_EVENT_KINDS.join(', ')}`
  const p = run.game.player
  return spawnMapEvent(run.game, kind, Math.round(p.x + dx), Math.round(p.y + dy))
}

// Dev-only handle for poking at the running game from the console.
/** Dev: spawns `count` of an enemy in a small arc ahead of the player (staging trait screenshots); `shiny` makes them shiny elites. */
const devSpawn = (kind: EnemyId, count = 1, shiny = false) => {
  const g = run?.game
  if (!g) return
  const p = g.player
  const base = Math.atan2(p.facing.y, p.facing.x)
  for (let i = 0; i < count; i++) {
    const a = base + (i - (count - 1) / 2) * 0.35
    const e = spawnEnemy(g, kind, p.x + Math.cos(a) * 90, p.y + Math.sin(a) * 90)
    if (shiny) {
      void preloadShinies([ENEMIES[kind].dex])
      makeShiny(g, e)
    }
  }
}

/**
 * Dev: stages the run's Mega Evolution. `now` (default) jumps to the final stage with
 * the stone of `mega` (the line's first Mega by default) and presses the Mega button;
 * `ready` stops before the press; `stone` drops the line's stones 40 px to the right
 * instead, as a rift would.
 */
const devMega = (mode: 'now' | 'ready' | 'stone' = 'now', mega?: MegaId) => {
  const g = run?.game
  const ids = g ? megasOf(g.player.starter) : []
  if (!g || !ids[0]) return `Start a run with a Mega line: ${MEGA_LINES.join(', ')}`
  const p = g.player
  if (mode === 'stone') return dropMegaStones(g, p.x + 40, p.y)
  if (mega && !ids.includes(mega)) return `${PLAYABLE[g.player.starter].name}'s Megas: ${ids.join(', ')}`
  p.stage = PLAYABLE[g.player.starter].line.length - 1
  p.radius = Math.max(6, Math.round(bodyOf(playerDex(g)).bodyW * 0.3))
  recomputeStats(g)
  g.player.mega.stone = null
  grantStone(g, mega ?? ids[0])
  g.player.mega.charge = 0
  if (mode === 'now') queueMega()
}

/** Dev: eggs and hatching, to stage the incubator and the hatching scene. */
const devEggs = {
  /** Puts an egg in the incubator (a full one pays its ₽), like a mission reward. */
  egg: (tier: EggTier = 'common') => {
    const { save } = grantEgg(loadSave(), tier)
    writeSave(save)
    return save.eggs
  },
  /** Walks every incubating egg `steps` (all the way by default). */
  walk: (steps = 99999) => {
    const { save } = depositEggs(loadSave(), steps, [])
    writeSave(save)
    return save.eggs
  },
  /** Hatches every ready egg now, or plays the scene for `id` (unlocking it), held at `holdAt` seconds if given. */
  hatch: (id?: HatchlingId, shiny = false, holdAt?: number) => {
    if (!id) return afterRun(() => showMenu())
    const save = loadSave()
    writeSave({ ...save, hatched: { ...save.hatched, [id]: { shiny } } })
    endRun()
    showHatch({ id, tier: HATCHLINGS[id].egg, shiny, duplicate: false, refund: 0 }, () => showMenu(id), holdAt)
  },
  incubator: () => showIncubator(() => showMenu()),
  /** Unlocks the shiny of a Pokémon (every one without an argument), as if its 1/64 roll hit. */
  unlockShiny: (id?: PlayableId) => {
    const save = loadSave()
    const ids = id ? [id] : (Object.keys(PLAYABLE) as PlayableId[])
    writeSave({ ...save, shinyStarters: ids.reduce(unlockShinyStarter, save.shinyStarters) })
  },
  /** Unlocks a family (every family without an argument). */
  unlockFamily: (id?: HatchlingId, shiny = false) => {
    const save = loadSave()
    const ids = id ? [id] : HATCHLING_IDS
    writeSave({ ...save, hatched: { ...save.hatched, ...Object.fromEntries(ids.map((i) => [i, { shiny }])) } })
  },
  save: loadSave,
}

/** Dev: Mystery Gifts and invites, to stage the gift banners, the Ambassador's rewards and the title's invite banner. */
const devGifts = {
  /**
   * Lands a Mystery Gift as if the account brought it: `ps.gift('egg', 'friend')`, `ps.gift('coins', '500')`,
   * `ps.gift('title')`, `ps.gift('style', 'ambassador')` (a frame), `ps.gift('shinyHatch', 'munchlax')`,
   * `ps.gift('ribbon', 'gold')` (yesterday's challenge, #12 of 340).
   * `why`: an inviter's handle (welcome) or a count of friends brought.
   */
  gift: (kind: GiftKind = 'egg', arg?: string, why?: string | number) => {
    const raw = { egg: { tier: arg ?? 'friend' }, coins: { amount: Number(arg ?? 500) }, title: { title: arg ?? 'ambassador' }, style: { style: { slot: 'frame', id: arg ?? 'ambassador' } }, shinyHatch: { family: arg ?? 'munchlax' }, ribbon: { ribbon: { day: previousDay(brasiliaDay(today())), tier: arg ?? 'gold', rank: 12, total: 340 } } }[kind]
    const content = parseGiftContent({ kind, ...raw })
    if (!content) return 'Kinds: egg (tier), coins (amount), title, style (frame id), shinyHatch (family), ribbon (tier)'
    const reason: GiftReason | null = typeof why === 'number' ? { kind: 'friends', count: why } : why ? { kind: 'welcome', from: why } : null
    return receiveGifts([{ id: `dev-${Date.now()}`, content, reason }])
  },
  /** Lands as a guest invited by `handle` (shown as `name`): the title shows the invite banner. */
  invite: (handle = 'ash', name = 'Ash') => {
    stageInvite(handle, name)
    if (screen?.el.classList.contains('title-home')) showTitle()
  },
}

/**
 * Dev: the Desafio do dia. `ps.challenge()` opens its screen, `'play'` starts
 * today's run, `'done'` marks this device's attempt as made (`time` seconds),
 * `'reset'` forgets it. Returns today's challenge.
 */
const devChallenge = (mode?: 'play' | 'done' | 'reset', time = 754) => {
  const c = challengeToday()
  if (mode === 'play') void replayChallenge()
  else if (mode === 'done') saveAttempt({ day: c.day, time })
  else if (mode === 'reset') saveAttempt(null)
  if (mode !== 'play' && !run) showChallenge()
  return c
}

/**
 * Dev: walks the player to the nearest piece of terrain of a kind (`rock`,
 * `tree`, `cliff`, `tower` or `lake`), standing `dy` px south of it, e.g. `ps.terrain('cliff')`.
 */
const devTerrain = (g: Game, kind: SolidKind | 'lake' = 'cliff', dy = 70) => {
  const C = TERRAIN.cell
  const pcx = Math.floor(g.player.x / C)
  const pcy = Math.floor(g.player.y / C)
  for (let r = 0; r < 30; r++) {
    for (let cy = pcy - r; cy <= pcy + r; cy++) {
      for (let cx = pcx - r; cx <= pcx + r; cx++) {
        if (Math.max(Math.abs(cx - pcx), Math.abs(cy - pcy)) !== r) continue
        const f = featureAt(g.terrain.seed, cx, cy)
        const spot = kind === 'lake' ? f?.lake : f?.solids.find((s) => s.kind === kind)
        if (!spot) continue
        const at = clearSpot(g, { x: spot.x, y: spot.y + dy }, g.player.radius + 2)
        g.player.x = at.x
        g.player.y = at.y
        return f
      }
    }
  }
  return null
}

/**
 * Dev: a local co-op run with bot teammates and no server, through the same
 * lockstep path (`ps.coop(['pichu', 'gible'])`). Bots wander near the player
 * and pick level-ups at random.
 */
const devCoop = (mates: PlayableId[] = ['pichu', 'gible'], starter: PlayableId = lastStarter, difficulty: Difficulty = 'normal') => {
  const ranks = loadSave().ranks
  const members: Member[] = [starter, ...mates].slice(0, 4).map((id, slot) => ({
    slot, name: slot === 0 ? coopName() : `Bot ${slot}`, handle: null, ready: true, online: true, view: { w: view.w, h: view.h }, starter: id, shiny: false, ranks,
  }))
  void startCoopRun({ seed: Date.now(), difficulty, view: roomView(members.map((m) => m.view)), members }, 0, true)
}

// `ps.biome('cave')` and `ps.weather('rain')` stage a run for screenshots (they hold until the next scheduled change).
if (import.meta.env.DEV) {
  const withRun = (fn: (g: Game) => void) => (run ? fn(run.game) : console.warn('ps: start a run first'))
  Object.assign(window, {
    ps: {
      run: () => run,
      startRun,
      coop: devCoop,
      showTitle,
      showMenu,
      theme: currentTheme,
      spawn: devSpawn,
      mega: devMega,
      event: devEvent,
      challenge: devChallenge,
      dex: () => loadSave().dex,
      /** The Caixa do PC over the title; `ps.card()` opens the Trainer Card's share preview. */
      pc: () => (endRun(), setScreen(showPcBox(() => showTitle()))),
      card: (partner: PlayableId = lastStarter) => (endRun(), setScreen(sharePreview(ui, input, trainerShare(partner), () => showTitle()))),
      biome: (id: BiomeId) => withRun((g) => setBiome(g, id)),
      terrain: (kind?: SolidKind | 'lake', dy?: number) => (run ? devTerrain(run.game, kind, dy) : console.warn('ps: start a run first')),
      weather: (id: WeatherId) => withRun((g) => setWeather(g, id)),
      ...riftDevTools(() => run?.game),
      // Rebuilds the missions screen or the title so changes show up right away.
      ...missionDevTools(() => (screen?.el.classList.contains('title-home') ? showTitle() : screen?.el.querySelector('.missions') ? showMissions() : undefined)),
      ...devEggs,
      ...devGifts,
      ...martDevTools(() => {
        // A new outbreak plays from the next run's plan, and the title, the Mart or the select shows it.
        upcoming = planRun()
        if (screen?.el.classList.contains('title-home')) showTitle()
        else if (screen?.el.classList.contains('mart-screen')) showShop()
        else if (screen?.el.querySelector('.select-layout')) showMenu()
      }),
    },
  })
}
