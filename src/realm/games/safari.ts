import { openGift, stageGifts } from '../../account'
import { HATCHLINGS, PLAYABLE, type HatchlingId } from '../../data/hatchlings'
import { isRegion } from '../../data/regionalForms'
import { regionOfWeek } from '../../game/travel'
import { CONTEST_POOL, HABITAT_REWARDS, SAFARI_GATED, SAFARI_HABITAT_IDS, SAFARI_HABITATS, habitatDone, habitatPool, habitatResidents, markLacking, poolAt, safariEntry, safariForm, whenAbout, type SafariHabitat } from '../../data/safari'
import type { GiftContent } from '../../game/gifts'
import { eggIcon, medalIcon, sparkleIcon } from '../../render/art'
import { manaphyEggIcon } from '../../render/manaphyEggArt'
import { PLAZA, SAFARI_MAPS, TILE } from '../../data/safariMaps'
import { playSfx } from '../../engine/audio'
import { LOCALES, formatPokeDollars, locale, t } from '../../i18n'
import type { SafariActed, SafariSession, SafariState } from '../../net/realmApi'
import { closeIcon } from '../../render/art'
import { loadSpecies, portraitUrl, walkSheet } from '../../render/sprites'
import { h, rich } from '../../ui/dom'
import { loadSave } from '../../ui/save'
import { isFailure } from '../api'
import { actSafari, fetchSafari, localDaypart, savedOpen, startSafari } from '../safariApi'
import { openGameBoard } from './board'
import { image, partnerDex } from './arcadeKit'
import type { GameInput, GameRun, SoloCtx, SoloGame } from './frame'
import { CONTEST, SAFARI, bestCatch, sessionPrice, shareOf, type SafariAction, type SafariDaypart, type SafariMode, type SafariMood, type SafariRarity } from './safari.rules'
import { ICONS, THEMES, drawGrassWipe, silhouetteUrl } from './safariArt'
import { bandPx, battleUi, createBattle, layoutBattle, type Battle, type BattleHost } from './safariBattle'
import { createField, type Field } from './safariField'
import { buildWorld } from './safariWorld'

/**
 * The Zona Safári (`MINIGAMES.safari`): a preserve the partner walks. The
 * Ranger's booth at the gate takes the session (the API charges it), the notice
 * board shows who lives here, and the tall grass does the rest: a rustle asks
 * the API for the next encounter in line and opens a battle
 * (`safariBattle.ts`), the map being `safariField.ts`. The canvas follows the
 * stage (`fluid`), and every word is DOM over it, sized from the canvas's scale.
 *
 * Who's about follows the player's own hour (`localDaypart`; the API takes the
 * same offset), and the map and the battle wear it. The session's wanderers
 * stand in the open (`Field.setWanderers`): sneaking up on one from behind
 * meets it calmer (`stalk`). On the contest days the booth also offers the
 * Concurso de Insetos (a free entry, bugs only, scored). The notice board has
 * four tabs: the Safari-only families (every habitat's, this week's first,
 * which the player lacks and what each habitat's Pokédex gives), who's about
 * now, each habitat's Pokédex and the contest.
 *
 * Touch: a floating stick anywhere on the map (a light push sneaks), the sneak
 * toggle, buttons in battle. Keys: arrows or WASD walk, Shift sneaks; 1 to 5
 * or arrows and Enter pick a command.
 */

type Phase = 'load' | 'lobby' | 'busy' | 'gate' | 'walk' | 'alert' | 'wipeIn' | 'battle' | 'wipeOut' | 'report' | 'trouble'

const WIPE = 0.55
const ALERT = 0.72
/** The walk up to the arch that opens a session: px/s, and how long it takes from the spawn. */
const GATE_SPEED = 62
const GATE_WALK = ((PLAZA.spawn.y - PLAZA.entry.y) * TILE) / GATE_SPEED

/** What the dev hooks (`ps.safari`) reach of the running game. */
export const safariDev: { run: { phase: () => Phase; wanderers: () => unknown; battle: () => string | null; rustle: () => void; stalk: () => void; sneakUp: (front: boolean) => void; say: (text: string) => void } | null } = { run: null }

/** The board's tabs: the Safari-only families, who's about now, each habitat's Pokédex and the contest. */
type BoardTab = 'only' | 'seen' | 'dex' | 'contest'

/** The next contest day on or after today (Brasília), for the board's line. */
const nextContestDay = (from: Date) => {
  for (let i = 0; i < 7; i++) {
    const d = new Date(from.getTime() + i * 86_400_000)
    if ((CONTEST.days as readonly number[]).includes(d.getDay())) return d
  }
  return from
}

/** A day/night icon for a time of day. */
const daypartIcon = (part: SafariDaypart) => (part === 'night' ? ICONS.moon() : part === 'day' ? ICONS.sun() : ICONS.dusk())

/** The kinds of rarity the board groups the shares by. */
const RARITIES: readonly SafariRarity[] = ['common', 'rare', 'ultra', 'special']

const start = (ctx: SoloCtx): GameRun => {
  const m = () => t().minigames.safari
  const dex = partnerDex(ctx.partner)
  const partnerName = Object.hasOwn(PLAYABLE, ctx.partner) ? PLAYABLE[ctx.partner as keyof typeof PLAYABLE].line[0].name : 'Pikachu'

  const textEl = h('p', {})
  const smallEl = h('small', {})
  const face = h('img', { class: 'sz-face hidden', src: portraitUrl(115), alt: '', width: 40, height: 40 })
  const box = h('div', { class: 'sz-text box hidden', onclick: () => finishTyping() }, face, h('div', { class: 'sz-text-body' }, textEl, smallEl))
  const cmds = h('div', { class: 'sz-cmds hidden' })
  const pouch = h('div', { class: 'sz-pouch hidden' })
  const endBtn = h('button', { class: 'sz-end box hidden', type: 'button', onclick: () => endSession() }, '')
  const sneakBtn = h('button', { class: 'sz-sneak box hidden', type: 'button', 'aria-pressed': 'false', onclick: () => toggleSneak() }, h('img', { src: ICONS.step(), alt: '', width: 14, height: 14 }), h('span', {}, ''))
  const readBtn = h('button', { class: 'sz-read box hidden', type: 'button', onclick: () => openBoard() }, '')
  const wildPanel = h('div', { class: 'sz-panel sz-panel-wild hidden' })
  const nearPanel = h('div', { class: 'sz-panel sz-panel-near hidden' })
  const band = h('div', { class: 'sz-band hidden' })
  const board = h('div', { class: 'sz-board hidden' })
  const report = h('div', { class: 'sz-report box hidden' })
  const hud = h('div', { class: 'sz-hud' }, pouch, endBtn, sneakBtn, readBtn, wildPanel, nearPanel, band, box, cmds, report)
  // The board covers the whole stage, not just the canvas, and while it's up its ✕ is the only one: the page's steps aside.
  ctx.stage.append(hud, board)
  const screenEl = ctx.stage.closest('.minigame-screen')

  let phase: Phase = 'load'
  let phaseT = 0
  let view: SafariState | null = null
  let session: SafariSession | null = null
  let field: Field | null = null
  let battle: Battle | null = null
  let habitat: SafariHabitat = 'meadow'
  let said = ''
  let shown = 0
  /** How long (s) the current line has stood fully typed. */
  let readFor = 0
  let disposed = false
  let confirmEnd = false
  let seen = 0
  /** The answer that opens the next battle, and whether its Pokémon's sprites are in. */
  let meeting: { acted: SafariActed; ready: boolean } | null = null
  let canvasK = 2
  let cursor = 0
  let cmdActions: (() => void)[] = []
  let hintLeft = 0
  let lastKey = ''
  let wildCalm = 0
  let wildMood: SafariMood | null = null
  /** The level the panel shows, kept once the encounter is gone (it fled, it was caught). */
  let wildLevelNow: number | null = null
  /** The API's last answer: the one that ended a session carries a contest's kept bug. */
  let lastActed: SafariActed | null = null
  let sneakOn = false
  let boardTab: BoardTab = 'seen'
  let dexHabitat: SafariHabitat = 'meadow'
  /** The time of day the map is lit for: the open session's, else this device's hour. */
  let daypart: SafariDaypart = localDaypart()

  const go = (next: Phase) => {
    phase = next
    phaseT = 0
    // The Ranger's booth and its messages wear the kit's sheet; the walk and the battle keep their own look.
    hud.classList.toggle('sz-lobby', next === 'lobby' || next === 'trouble')
    if (next !== 'lobby') hud.classList.remove('sz-three')
  }

  const lacks = (id: HatchlingId) => loadSave().hatched[id] === undefined

  /* ---------------- Words ---------------- */

  const say = (text: string, small = '') => {
    said = text
    shown = 0
    readFor = 0
    smallEl.textContent = small
    box.classList.toggle('hidden', text === '')
    fitText()
    textEl.textContent = ''
  }
  /** In battle the message has the band's fixed height: a sentence too long for it steps its type down until the whole of it fits. */
  const fitText = () => {
    textEl.style.removeProperty('font-size')
    if (!hud.classList.contains('sz-battle') || said === '') return
    const typedSoFar = textEl.textContent
    textEl.textContent = said
    let size = parseFloat(getComputedStyle(textEl).fontSize)
    const floor = box.getBoundingClientRect().bottom - parseFloat(getComputedStyle(box).paddingBottom) * (parseFloat(hud.style.zoom) || 1)
    const spills = () => textEl.getBoundingClientRect().bottom > floor + 0.5
    for (let i = 0; i < 6 && spills(); i++) {
      size = Math.floor(size * 0.9)
      textEl.style.fontSize = `${size}px`
    }
    textEl.textContent = typedSoFar
  }
  /** A typed line stays this long (s) before what follows replaces it, unless a tap hurried it. */
  const READ_HOLD = 0.7
  const typed = () => shown >= said.length && readFor >= READ_HOLD
  const finishTyping = () => {
    shown = said.length
    readFor = READ_HOLD
    textEl.textContent = said
  }
  const stepWords = (dt: number) => {
    if (shown >= said.length) {
      readFor += dt
      return
    }
    shown = Math.min(said.length, shown + dt * 46)
    textEl.textContent = said.slice(0, Math.floor(shown))
  }

  /** Puts up command buttons; `actions[i]` runs on a tap or on its number key. */
  const commands = (items: readonly { label: string; icon?: string; count?: number; run: () => void; hot?: boolean; off?: boolean }[]) => {
    cursor = 0
    cmdActions = items.map((c) => c.run)
    cmds.classList.toggle('hidden', items.length === 0)
    cmds.replaceChildren(
      ...items.map((c, i) =>
        h(
          'button',
          { class: `box${c.hot ? ' sz-hot' : ''}${i === 0 ? ' sz-sel' : ''}`, type: 'button', disabled: c.off === true, onclick: () => (playSfx('select'), c.run()) },
          c.icon ? h('img', { src: c.icon, alt: '', width: 22, height: 22 }) : false,
          h('span', { class: 'sz-cmd-label' }, c.label),
          c.count === undefined ? false : h('small', { class: 'sz-count' }, `×${c.count}`),
        ),
      ),
    )
  }

  const moveCursor = (by: number) => {
    const buttons = [...cmds.querySelectorAll('button')]
    if (buttons.length === 0) return
    buttons[cursor]?.classList.remove('sz-sel')
    cursor = (cursor + by + buttons.length) % buttons.length
    buttons[cursor]?.classList.add('sz-sel')
    playSfx('move', 80)
  }

  const trouble = (error: string) => {
    go('trouble')
    const w = m()
    const text = error === 'cap' ? w.cap : error === 'funds' ? w.funds : error === 'profile' ? w.profile : error === 'closed' ? w.contest.closed : w.failed
    face.classList.add('hidden')
    say(text)
    commands([{ label: w.retry, run: () => void load(), hot: true }])
  }

  /* ---------------- The HUD ---------------- */

  /** The chain's counter: the species and how many in a row, with its sparkle; nothing under two. */
  const chainChip = (): HTMLElement[] => {
    const chain = session?.chain
    if (!chain || chain.n < 2) return []
    return [h('span', { class: 'sz-chain', title: m().chainHint }, h('img', { class: 'sz-spark', src: ICONS.spark(), alt: '', width: 14, height: 14 }), m().chain(chain.n), h('img', { src: portraitUrl(safariForm(chain.family).dex), alt: safariForm(chain.family).name, width: 20, height: 20 }))]
  }

  const refreshPouch = () => {
    if (!session) return
    const w = m()
    pouch.classList.remove('hidden')
    const best = bestCatch(session.catches)
    pouch.replaceChildren(
      h('img', { class: 'sz-hour', src: daypartIcon(daypart), alt: w.dayparts[daypart], title: w.dayparts[daypart], width: 14, height: 14 }),
      h('span', {}, h('img', { src: `${import.meta.env.BASE_URL}assets/safari/ball.png`, alt: '', width: 16, height: 16 }), String(session.balls)),
      h('span', {}, h('img', { src: `${import.meta.env.BASE_URL}assets/safari/berry.png`, alt: '', width: 14, height: 16 }), String(session.berries)),
      h('em', {}, w.left(session.left)),
      ...(session.mode === 'contest' ? [h('b', { class: 'sz-score' }, h('img', { src: ICONS.net(), alt: '', width: 14, height: 14 }), w.contest.points(best?.score ?? 0))] : []),
      ...chainChip(),
    )
    endBtn.textContent = confirmEnd ? w.endSure : w.end
  }

  const toggleSneak = () => {
    sneakOn = !sneakOn
    field?.setSneak(sneakOn)
    refreshSneak()
    playSfx('select')
  }

  const refreshSneak = () => {
    sneakBtn.classList.toggle('sz-on', sneakOn)
    sneakBtn.setAttribute('aria-pressed', String(sneakOn))
    sneakBtn.querySelector('span')!.textContent = m().sneak
  }

  const showWalkHud = (on: boolean) => {
    endBtn.classList.toggle('hidden', !on)
    pouch.classList.toggle('hidden', !on)
    sneakBtn.classList.toggle('hidden', !on)
    if (on) {
      refreshPouch()
      refreshSneak()
    }
  }

  /** Puts the session's wanderers on the map (or the week's glimpses with no session). */
  const syncWanderers = () => {
    field?.setWanderers(session ? session.wanderers.map((w) => ({ slot: w.slot, dex: safariForm(w.family).dex })) : null)
  }

  const endSession = () => {
    if (phase !== 'walk' || !session) return
    if (!confirmEnd) {
      confirmEnd = true
      return refreshPouch()
    }
    confirmEnd = false
    go('busy')
    send({ kind: 'finish' }, (got) => toReport(got))
  }

  /* ---------------- The API ---------------- */

  const send = (action: SafariAction, then: (got: SafariActed) => void) => {
    if (!session) return
    void actSafari(session, action).then((got) => {
      if (disposed) return
      if (isFailure(got)) return trouble(got.error)
      session = got.session
      lastActed = got
      syncWanderers()
      then(got)
    })
  }

  /* ---------------- The way in ---------------- */

  const makeField = (at: SafariHabitat) => {
    if (field && habitat === at) return field
    field?.release()
    habitat = at
    const def = SAFARI_MAPS[at]
    const theme = THEMES[at]
    // A few of the week's residents, picked from the map's seed so a week looks the same.
    const pool = habitatPool(at, session?.week ?? view?.week ?? '')
    const residents = [0, 1, 2, 3].map((i) => safariForm(pool[(def.seed * (i + 2) * 7) % pool.length]!.family).dex)
    field = createField({ habitat: at, world: buildWorld(def), theme, dex, shiny: ctx.shiny, mapSeed: def.seed, residents, daypart })
    field.setSneak(sneakOn)
    for (const piece of ['kiosk', 'board']) image(`safari/${piece}`)
    image('realm/safari-gate')
    return field
  }

  /** A habitat's Safari-only families this account meets there (Phione once Manaphy is its own). */
  const exclusivesOf = (at: SafariHabitat) => {
    const open = savedOpen()
    return (SAFARI_HABITATS[at].only as readonly HatchlingId[]).filter((id) => SAFARI_GATED[id] === undefined || open.has(id))
  }

  /** The Safari-only families of a habitat the save still lacks. */
  const lackingHere = (at: SafariHabitat) => exclusivesOf(at).filter(lacks)

  const showLobby = () => {
    if (!view) return
    const w = m()
    const at = view.habitat
    const price = sessionPrice(view.used)
    const affordable = price !== null && price <= loadSave().wallet
    const contest = view.contest.open && view.contest.left > 0
    daypart = localDaypart()
    field?.setDaypart(daypart)
    syncWanderers()
    face.classList.remove('hidden')
    go('lobby')
    showWalkHud(false)
    readBtn.classList.add('hidden')
    const missing = lackingHere(at)
    const small = [
      missing.length > 0 ? w.only.lacking(missing.length, missing.map((id) => safariForm(id).name).join(', ')) : w.only.allHere,
      view.sure ? w.sureNow : w.sureIn(Math.max(0, SAFARI.guarantee - view.dry)),
      w.today(view.used, SAFARI.dailyCap),
      ...(view.contest.open ? [contest ? w.contest.open : w.contest.used] : []),
    ]
    // By day the booth says the rules; at another hour it says who comes out instead.
    say(`${w.welcome(w.habitats[at].name)} ${daypart === 'day' ? w.rules(SAFARI.balls, SAFARI.berries) : w.hourNote[daypart]}`, small.join(' · '))
    commands([
      ...(price === null || !affordable ? [] : [{ label: price === 0 ? w.free : w.paid(formatPokeDollars(price)), run: () => void enter('safari'), hot: true }]),
      ...(contest ? [{ label: w.contest.enter, run: () => void enter('contest'), hot: price === null || !affordable }] : []),
      { label: w.boardOpen, run: () => openBoard(contest ? 'contest' : missing.length > 0 ? 'only' : 'seen') },
    ])
    hud.classList.toggle('sz-three', cmds.childElementCount === 3)
    if (contest && (price === null || !affordable)) say(w.contest.welcome, small.join(' · '))
    else if (price === null) say(w.cap)
    else if (!affordable) say(w.funds)
  }

  const enter = async (mode: SafariMode) => {
    if (!view) return
    commands([])
    face.classList.add('hidden')
    go('busy')
    say('')
    const got = await startSafari(view.used, mode)
    if (disposed) return
    if (isFailure(got)) return trouble(got.error)
    view = { ...view, used: got.used, contest: mode === 'contest' ? { ...view.contest, left: Math.max(0, view.contest.left - 1) } : view.contest }
    session = got.session
    daypart = got.session.daypart
    field?.setDaypart(daypart)
    syncWanderers()
    playSfx('coin')
    seen = 0
    go('gate')
    showWalkHud(true)
    hintLeft = 3.6
  }

  const load = async () => {
    go('load')
    say('')
    commands([])
    report.classList.add('hidden')
    const got = await fetchSafari()
    if (disposed) return
    if (isFailure(got)) return trouble(got.error)
    view = got
    session = got.open
    daypart = session?.daypart ?? localDaypart()
    makeField(got.habitat)
    field?.setDaypart(daypart)
    syncWanderers()
    field?.place(PLAZA.spawn.x * TILE, PLAZA.spawn.y * TILE, 4)
    field?.resume()
    if (!session) return showLobby()
    if (session.encounter) return openBattle(session.encounter.family, session.encounter.shiny, true)
    go('walk')
    showWalkHud(true)
  }

  /* ---------------- The notice board ---------------- */

  /** A resident not caught yet: its shape, flat, filled in once its sheet loads. */
  const silhouette = (dexNo: number) => {
    const img = h('img', { class: 'sz-sil', alt: '', width: 40, height: 40 })
    // Made at twice the tile so a small body still scales by a whole factor; shown at the portraits' size.
    silhouetteUrl(walkSheet(dexNo), dexNo, 80, (url) => (img.src = url))
    return img
  }

  /** A resident's tile: its portrait (a silhouette while `hidden`), its name and the line under it. */
  const note = (family: HatchlingId, line: string | false, opts: { fresh?: boolean; hidden?: boolean; when?: string } = {}) => {
    const form = safariForm(family)
    const w = m()
    return h(
      'li',
      { class: `sz-note${opts.fresh ? ' sz-note-new' : ''}${opts.hidden ? ' sz-note-unknown' : ''}`, title: opts.fresh ? w.fresh : undefined },
      opts.hidden ? silhouette(form.dex) : h('img', { src: portraitUrl(form.dex), alt: '', width: 40, height: 40, loading: 'lazy' }),
      h('b', {}, opts.hidden ? w.dex.unknown : form.name),
      line ? h('span', {}, line) : h('span', { class: 'sz-note-when' }, opts.when ?? ''),
      opts.fresh ? h('em', { class: 'arc-tag new' }, w.fresh) : false,
    )
  }

  /** Who's about now: the shares of this hour's pool by rarity (the contest's bugs during an entry). */
  const seenTab = () => {
    const w = m()
    const at = session?.habitat ?? view!.habitat
    const partner = view!.partner
    const partnerTypes = partner ? PLAYABLE[partner].line[0].types : []
    const week = session?.week ?? view!.week
    const pool = session?.mode === 'contest' ? [...CONTEST_POOL] : markLacking(poolAt(at, daypart, week, savedOpen()), lacks)
    const all = shareOf(pool, partnerTypes).sort((a, b) => b.share - a.share)
    // The week's trip's visitors (`game/travel.ts`) get a section of their own, the region's name on it.
    const visiting = (family: (typeof all)[number]['family']) => isRegion(HATCHLINGS[family].egg)
    const rows = all.filter((r) => !visiting(r.family))
    const trip = all.filter((r) => visiting(r.family))
    const tiers = [
      ...RARITIES.map((rarity) => ({ title: w.tiers[rarity], rows: rows.filter((r) => r.rarity === rarity) })),
      { title: t().travel.safari(t().travel.regions[regionOfWeek(week)]), rows: trip },
    ].filter((tier) => tier.rows.length > 0)
    return [
      h('small', {}, partner ? w.partner(PLAYABLE[partner].line[0].name) : w.boardHint),
      h(
        'div',
        { class: 'sz-notes' },
        ...tiers.map((tier) =>
          h(
            'section',
            {},
            h('h4', {}, tier.title),
            h('ul', {}, ...tier.rows.map((entry) => note(entry.family, `${(entry.share * 100).toFixed(1)}%`, { fresh: lacks(entry.family) }))),
          ),
        ),
      ),
    ]
  }

  /** A habitat's Pokédex: everyone who lives there, a silhouette until caught there, the hour it keeps, and its reward. */
  const dexTab = () => {
    const w = m()
    const caught = view!.dex[dexHabitat]
    const residents = habitatResidents(dexHabitat)
    const done = habitatDone(dexHabitat, caught, view!.done)
    return [
      h(
        'nav',
        { class: 'sz-dex-places', role: 'tablist' },
        ...SAFARI_HABITAT_IDS.map((hb) => {
          const n = view!.dex[hb].filter((f) => habitatResidents(hb).some((e) => e.family === f)).length
          return h(
            'button',
            { type: 'button', role: 'tab', class: hb === dexHabitat ? 'sz-on' : '', 'aria-selected': String(hb === dexHabitat), onclick: () => ((dexHabitat = hb), renderBoard()) },
            h('span', {}, w.habitats[hb].name),
            h('small', {}, habitatDone(hb, view!.dex[hb], view!.done) ? `✓ ${w.dex.progress(n, habitatResidents(hb).length)}` : w.dex.progress(n, habitatResidents(hb).length)),
          )
        }),
      ),
      done ? h('small', { class: 'sz-dex-done' }, w.only.done) : rewardsLine(dexHabitat),
      !done && h('small', {}, w.dex.allReward),
      h(
        'div',
        { class: 'sz-notes' },
        h(
          'ul',
          { class: 'sz-dex' },
          ...residents.map((e) => {
            const has = caught.includes(e.family)
            const when = whenAbout(e.family)
            return note(e.family, false, { hidden: !has, when: w.dex.when[when] })
          }),
        ),
      ),
    ]
  }

  /** One of a habitat's rewards as a chip: its icon and its words. */
  const rewardChip = (c: GiftContent) => {
    const w = m().only
    const [src, text] =
      c.kind === 'egg' ? [eggIcon(c.tier), w.ultraEgg]
      : c.kind === 'title' ? [medalIcon('gold'), w.title_(t().achievements.titles[c.title])]
      : c.kind === 'shinyHatch' ? [portraitUrl(safariForm(c.family).dex, true), w.shiny(safariForm(c.family).name)]
      : c.kind === 'legend' ? [manaphyEggIcon(), w.manaphyEgg]
      : [sparkleIcon(), '']
    return h('li', { class: `sz-reward ${c.kind}` }, h('img', { src, alt: '', width: 24, height: 24 }), h('span', {}, rich(text)))
  }

  /** What filling a habitat's Pokédex gives: the Ultra egg, its title, its sure shiny and, for the cove, the Ovo de Manaphy. */
  const rewardsLine = (at: SafariHabitat) => {
    const rewards: readonly GiftContent[] = [{ kind: 'egg', tier: 'ultra' }, ...HABITAT_REWARDS[at]]
    return h('div', { class: 'sz-rewards' }, h('small', {}, m().only.rewardHead), h('ul', {}, ...rewards.map(rewardChip)))
  }

  /** The Safari-only families, habitat by habitat from this week's: which the player has, which it lacks, and each habitat's Pokédex prize. */
  const onlyTab = () => {
    const w = m()
    // The habitats come round in their weekly order (`habitatOfWeek`), from the one open now.
    const now = SAFARI_HABITAT_IDS.indexOf(session?.habitat ?? view!.habitat)
    const order = SAFARI_HABITAT_IDS.map((_, i) => ({ at: SAFARI_HABITAT_IDS[(now + i) % SAFARI_HABITAT_IDS.length]!, i }))
    const open = savedOpen()
    return [
      h('small', {}, w.only.intro),
      h(
        'div',
        { class: 'sz-notes sz-only' },
        ...order.map(({ at, i }) => {
          const all = SAFARI_HABITATS[at].only as readonly HatchlingId[]
          const met = exclusivesOf(at)
          const have = met.filter((id) => !lacks(id)).length
          const when = i === 0 ? w.only.thisWeek : w.only.inWeeks(i)
          const done = habitatDone(at, view!.dex[at], view!.done)
          return h(
            'section',
            { class: i === 0 ? 'sz-only-now' : '' },
            h('h4', {}, `${w.habitats[at].name} · ${when}`, h('em', { class: 'sz-only-count' }, w.only.have(have, met.length))),
            h(
              'ul',
              {},
              ...all.map((id) => {
                const gated = SAFARI_GATED[id] !== undefined && !open.has(id)
                const mine = !gated && !lacks(id)
                return note(id, gated ? w.only.gated : mine ? `✓ ${w.only.owned}` : `${w.only.missing} · ${w.only.boost}`, { fresh: !gated && !mine, hidden: gated })
              }),
            ),
            // A Pokédex completed before new exclusives moved in stays complete (`habitatDone`): say so beside the ones it lacks.
            done ? h('small', { class: 'sz-dex-done' }, have < met.length ? w.only.doneBefore : w.only.done) : rewardsLine(at),
          )
        }),
      ),
    ]
  }

  /** The contest: its days and rules, its prizes, this week's best and the way to its board. */
  const contestTab = () => {
    const w = m().contest
    const c = view!.contest
    const day = new Intl.DateTimeFormat(LOCALES[locale()].tag, { weekday: 'long' }).format(nextContestDay(new Date()))
    return [
      h(
        'div',
        { class: 'sz-notes sz-contest' },
        h('p', { class: 'sz-contest-day' }, h('img', { src: ICONS.net(), alt: '', width: 30, height: 30 }), h('b', {}, c.open ? (c.left > 0 ? w.open : w.used) : `${w.closed}`), c.open ? false : h('span', {}, day)),
        h('p', {}, w.blurb),
        h('p', {}, w.entry),
        h('p', {}, w.keep),
        h('p', { class: 'sz-contest-prizes' }, w.prizes),
        h('p', { class: 'sz-contest-best' }, c.best === null ? w.none : w.best(c.best)),
        h('button', { class: 'arc-btn arc-btn-small', type: 'button', onclick: () => openContestBoard() }, h('span', { class: 'arc-outline' }, w.board)),
      ),
    ]
  }

  const renderBoard = () => {
    if (!view) return
    const w = m()
    const at = session?.habitat ?? view.habitat
    const tabs: readonly BoardTab[] = ['only', 'seen', 'dex', 'contest']
    const kicker = boardTab === 'dex' ? w.habitats[dexHabitat].name : boardTab === 'contest' ? w.contest.days : boardTab === 'only' ? w.thisWeek : w.habitats[at].name
    const title = boardTab === 'seen' ? w.seenTitle(w.dayparts[daypart]) : boardTab === 'dex' ? w.dex.title : boardTab === 'only' ? w.only.title : w.contest.name
    board.replaceChildren(
      h(
        'div',
        { class: 'sz-board-frame' },
        // The tabs ride in the header: under the title upright, on its row sideways when there's room.
        h(
          'header',
          { class: 'mg-title' },
          h('span', { class: 'mg-kicker' }, kicker),
          h('h3', {}, boardTab === 'seen' ? h('img', { class: 'sz-hour', src: daypartIcon(daypart), alt: '', width: 28, height: 28 }) : false, title),
          h(
            'nav',
            { class: 'sz-tabs', role: 'tablist' },
            ...tabs.map((tab) => h('button', { type: 'button', role: 'tab', class: tab === boardTab ? 'sz-on' : '', 'aria-selected': String(tab === boardTab), onclick: () => ((boardTab = tab), playSfx('select'), renderBoard()) }, tab === 'only' ? w.only.tab : w.tabs[tab])),
          ),
        ),
        ...(boardTab === 'seen' ? seenTab() : boardTab === 'dex' ? dexTab() : boardTab === 'only' ? onlyTab() : contestTab()),
        h('button', { class: 'arc-icon-btn sz-board-close', type: 'button', 'aria-label': w.ok, title: w.ok, onclick: closeBoard }, h('img', { src: closeIcon(), alt: '' })),
      ),
    )
  }

  const openBoard = (tab: BoardTab = boardTab) => {
    if (!view) return
    boardTab = tab
    dexHabitat = session?.habitat ?? view.habitat
    renderBoard()
    board.classList.remove('hidden')
    screenEl?.classList.add('sz-board-up')
    playSfx('select')
  }

  /** The contest's weekly board, over the Safari (the mini games' Placar on the week). */
  const openContestBoard = () => {
    openGameBoard(ctx.stage, ['safari'], { period: 'week', note: m().contest.name, close: () => {} })
  }

  const closeBoard = () => {
    board.classList.add('hidden')
    screenEl?.classList.remove('sz-board-up')
    playSfx('select')
  }

  const boardOpen = () => !board.classList.contains('hidden')

  /* ---------------- A battle ---------------- */

  /**
   * The two info panels: name and level, then the wild one's calm, its mood
   * (angry or eating, its turns as dots) and whether it's a new family, and
   * the chain under them when it's two or more; the partner's encounters left.
   */
  const setPanels = (family: HatchlingId, shiny: boolean) => {
    const w = m()
    const e = session?.encounter
    const level = e?.level ?? wildLevelNow ?? SAFARI.levelBase[safariEntry(family).rarity]
    wildLevelNow = level
    const row = (...cells: (HTMLElement | string | false)[]) => h('div', { class: 'sz-panel-row' }, ...cells)
    const pips = Array.from({ length: SAFARI.maxCalm }, (_, i) => h('i', { class: i < wildCalm ? 'sz-pip sz-pip-on' : 'sz-pip' }))
    const moodTurns = e?.moodTurns ?? 0
    const fresh = session?.mode !== 'contest' && lacks(family)
    wildPanel.replaceChildren(
      row(h('b', {}, safariForm(family).name, ...(shiny ? [h('span', { class: 'sz-star' }, '★')] : [])), h('span', { class: 'sz-lv' }, w.level(level))),
      row(
        h('span', { class: 'sz-readout' }, h('small', {}, w.calmLabel), ...pips),
        wildMood ? h('em', { class: `sz-mood sz-mood-${wildMood}` }, w.moodLabel[wildMood], ...Array.from({ length: Math.max(1, moodTurns) }, () => h('i', { class: 'sz-mood-pip' }))) : fresh ? h('em', {}, w.fresh) : false,
      ),
      ...((e?.chain ?? 0) >= 2 ? [row(h('span', { class: 'sz-chain' }, h('img', { class: 'sz-spark', src: ICONS.spark(), alt: '', width: 14, height: 14 }), w.chain(e!.chain)))] : []),
    )
    nearPanel.replaceChildren(
      row(h('b', {}, partnerName), h('span', { class: 'sz-lv' }, w.level(Math.min(100, 5 + Object.keys(loadSave().hatched).length)))),
      row(h('small', {}, w.left(session?.left ?? 0))),
    )
  }

  const battleHost = (family: HatchlingId, shiny: boolean): BattleHost => ({
    say,
    typed,
    menu: (on) => {
      if (!on || !session) return commands([])
      const w = m()
      commands([
        { label: w.ballCmd, count: session.balls, icon: `${import.meta.env.BASE_URL}assets/safari/ball.png`, run: () => battle?.throwBall(), hot: true, off: session.balls === 0 },
        { label: w.berryCmd, count: session.berries, icon: `${import.meta.env.BASE_URL}assets/safari/berry.png`, run: () => battle?.giveBerry(), off: session.berries === 0 },
        { label: w.rockCmd, icon: ICONS.rock(), run: () => battle?.throwRock() },
        { label: w.baitCmd, icon: ICONS.bait(), run: () => battle?.throwBait() },
        { label: w.runCmd, run: () => battle?.run() },
      ])
    },
    mood: (next) => {
      wildMood = next
      setPanels(family, shiny)
    },
    panels: (show) => {
      wildPanel.classList.toggle('hidden', !show)
      nearPanel.classList.toggle('hidden', !show)
    },
    calm: (n) => {
      wildCalm = n
      setPanels(family, shiny)
    },
    send: (action, then) => send(action, then),
    land: (got) => {
      const out = got.gift ? (stageGifts([got.gift]), openGift(got.gift.id)) : null
      const hatch = out?.status === 'applied' ? out.hatch : null
      return { fresh: hatch !== null && hatch !== undefined && !hatch.duplicate, refund: hatch?.refund ?? 0, shiny: hatch?.shiny ?? false }
    },
    brag: ctx.brag,
    end: () => endBattle(),
    sceneButton: (show) => {
      if (show) commands([{ label: m().ok, run: () => battle?.closeScene(), hot: true }])
      else commands([])
    },
  })

  const openBattle = (family: HatchlingId, shiny: boolean, resumed: boolean) => {
    if (!session) return
    const calm = session.encounter?.calm ?? 0
    wildCalm = calm
    wildMood = session.encounter?.mood ?? null
    wildLevelNow = null
    seen += 1
    setPanels(family, shiny)
    hintLeft = 0
    battle?.release()
    battle = createBattle({ habitat, theme: THEMES[habitat], daypart, family, shiny, session, partnerDex: dex, partnerShiny: ctx.shiny, host: battleHost(family, shiny), resumed })
    go('battle')
    showBand(true)
    showWalkHud(false)
    readBtn.classList.add('hidden')
    hud.classList.toggle('sz-night', daypart === 'night')
  }

  /** Battle's bottom band: the same box and command list, restyled by `.sz-battle`. */
  const showBand = (on: boolean) => {
    band.classList.toggle('hidden', !on)
    hud.classList.toggle('sz-battle', on)
    box.classList.toggle('box', !on)
  }

  const endBattle = () => {
    go('wipeOut')
    wildPanel.classList.add('hidden')
    nearPanel.classList.add('hidden')
    commands([])
    say('')
  }

  const toReport = (acted: SafariActed | null = null) => {
    go('report')
    const w = m()
    showWalkHud(false)
    readBtn.classList.add('hidden')
    say('')
    commands([])
    const caught = session?.catches ?? []
    const outOf = session?.balls === 0 ? w.outOfBalls : session?.left === 0 ? w.outOfGrass : ''
    const again = h('button', { class: 'arc-btn arc-btn-small', type: 'button', onclick: () => ((session = null), void load()) }, h('span', { class: 'arc-outline' }, w.again))
    if (session?.mode === 'contest') {
      // The entry's best bug: its score, and whether it came home (the API sends it only when new).
      const best = bestCatch(caught)
      const gift = acted?.gift ?? null
      const kept = gift ? (stageGifts([gift]), openGift(gift.id)) : null
      const c = w.contest
      report.replaceChildren(
        h('header', { class: 'mg-title' }, h('span', { class: 'mg-kicker' }, c.name), h('h3', {}, w.done)),
        ...(outOf ? [h('p', {}, outOf)] : []),
        best
          ? h(
              'div',
              { class: 'sz-best' },
              h('img', { src: portraitUrl(safariForm(best.family).dex, best.shiny), alt: '', width: 56, height: 56 }),
              h('div', {}, h('small', {}, c.best0), h('b', {}, `${safariForm(best.family).name}${best.shiny ? ' ★' : ''}`), h('span', {}, w.level(best.level))),
              h('strong', { class: 'sz-best-score' }, c.points(best.score)),
            )
          : h('p', {}, c.nothing),
        ...(best ? [h('p', {}, kept?.status === 'applied' ? c.kept(safariForm(best.family).name) : c.keptNone)] : []),
        h('div', { class: 'sz-report-row' }, h('button', { class: 'arc-btn arc-btn-small sz-ghost', type: 'button', onclick: () => openContestBoard() }, h('span', { class: 'arc-outline' }, c.board)), again),
      )
      report.classList.remove('hidden')
      return
    }
    report.replaceChildren(
      h('header', { class: 'mg-title' }, h('h3', {}, w.done)),
      ...(outOf ? [h('p', {}, outOf)] : []),
      caught.length === 0
        ? h('p', {}, w.none)
        : h('ul', { class: 'sz-caught' }, ...caught.map((c) => h('li', {}, h('img', { src: portraitUrl(safariForm(c.family).dex, c.shiny), alt: '', width: 40, height: 40 }), h('b', {}, `${safariForm(c.family).name}${c.shiny ? ' ★' : ''}`)))),
      again,
    )
    report.classList.remove('hidden')
  }

  /* ---------------- The loop ---------------- */

  /** Meets the next in the grass, or the wanderer at `slot` sneaked up on. */
  const startRustle = (slot: number | null = null) => {
    if (phase !== 'walk' || !session || session.left === 0) return
    go('alert')
    confirmEnd = false
    if (slot === null) field?.alert()
    playSfx('safariAlert')
    showWalkHud(false)
    say('')
    readBtn.classList.add('hidden')
    meeting = null
    send(slot === null ? { kind: 'grass' } : { kind: 'stalk', slot }, (got) => {
      if (got.turn.kind !== 'appear') return
      const entry = { acted: got, ready: false }
      meeting = entry
      const { dex: wildDex } = safariForm(got.turn.family)
      void loadSpecies(wildDex, got.turn.shiny)
        .catch(() => {})
        .then(() => (entry.ready = true))
    })
  }

  const step = (dt: number, input: GameInput) => {
    phaseT += dt
    stepWords(dt)
    if (hintLeft > 0) {
      hintLeft -= dt
      if (hintLeft <= 0 && phase === 'walk') say('')
    }
    const k = canvasK
    if (boardOpen()) {
      if (input.pressed('Enter') || input.pressed('Space') || input.pressed('KeyE')) closeBoard()
      field?.step(dt, input, false, k)
      return
    }
    const walking = phase === 'walk'
    const event = field?.step(dt, input, walking, k) ?? null
    if (event && walking) startRustle(event.kind === 'stalk' ? event.slot : null)
    if (walking && input.pressed('KeyQ')) toggleSneak()

    // Keys for whatever commands are up.
    if (input.pressed('ArrowRight') || input.pressed('ArrowDown')) if (!cmds.classList.contains('hidden')) moveCursor(1)
    if (input.pressed('ArrowLeft') || input.pressed('ArrowUp')) if (!cmds.classList.contains('hidden')) moveCursor(-1)
    if (!cmds.classList.contains('hidden')) {
      const digit = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].findIndex((code) => input.pressed(code))
      const pick = digit >= 0 ? digit : input.pressed('Enter') || input.pressed('Space') ? cursor : -1
      if (pick >= 0 && cmdActions[pick]) {
        const b = cmds.querySelectorAll('button')[pick]
        if (b && !b.disabled) {
          playSfx('select')
          cmdActions[pick]!()
        }
      }
    }

    switch (phase) {
      case 'gate':
        if (field) {
          field.player.moving = true
          field.player.dir = 4
          field.player.y = Math.max(PLAZA.entry.y * TILE, field.player.y - GATE_SPEED * dt)
        }
        if (phaseT >= GATE_WALK) {
          go('walk')
          say(m().walkHint)
          field?.resume()
        }
        break
      case 'walk': {
        const near = field?.nearBoard() ?? false
        readBtn.classList.toggle('hidden', !near)
        readBtn.textContent = m().readBoard
        if (near && input.pressed('KeyE')) openBoard()
        break
      }
      case 'alert':
        if (phaseT >= ALERT) go('wipeIn')
        break
      case 'wipeIn':
        // Its sprites should be in by now; a sheet that hangs must not hold the player behind the grass.
        if (phaseT >= WIPE && meeting && (meeting.ready || phaseT >= WIPE + 5) && meeting.acted.turn.kind === 'appear') openBattle(meeting.acted.turn.family, meeting.acted.turn.shiny, false)
        break
      case 'battle':
        battle?.step(dt, layoutBattle(lastW, lastH, canvasK))
        break
      case 'wipeOut':
        if (phaseT >= WIPE / 2) showBand(false)
        if (phaseT >= WIPE) {
          battle?.release()
          battle = null
          if (session?.over) toReport(lastActed)
          else {
            go('walk')
            field?.resume()
            showWalkHud(true)
          }
        }
        break
      default:
    }
  }

  let canvasEl: HTMLCanvasElement | null = null
  let lastW = 200
  let lastH = 200

  const place = (W: number, H: number) => {
    const key = `${W}x${H}`
    canvasEl ??= ctx.stage.querySelector('canvas')
    const canvas = canvasEl
    if (!canvas) return
    const k = canvas.clientWidth / W
    canvasK = k
    // In battle the HUD zooms by `battleUi` (1 on a phone) and lays itself out in zoomed px, so its words keep their share of a desktop's scene.
    const u = hud.classList.contains('sz-battle') ? battleUi(canvas.clientWidth, canvas.clientHeight) : 1
    hud.style.zoom = String(u)
    hud.style.left = `${canvas.offsetLeft / u}px`
    hud.style.top = `${canvas.offsetTop / u}px`
    hud.style.width = `${canvas.clientWidth / u}px`
    hud.style.height = `${canvas.clientHeight / u}px`
    hud.style.setProperty('--k', String(k / u))
    if (key === lastKey) return
    lastKey = key
    lastW = W
    lastH = H
    const L = layoutBattle(W, H, k)
    hud.classList.toggle('sz-wide', L.wide)
    hud.classList.toggle('sz-tall', !L.wide)
    board.classList.toggle('sz-wide', L.wide)
    hud.style.setProperty('--band-px', `${bandPx(L.wide)}px`)
    fitText()
  }

  const draw = (g: CanvasRenderingContext2D) => {
    const W = g.canvas.width
    const H = g.canvas.height
    place(W, H)
    const theme = THEMES[habitat]
    if (phase === 'battle') battle?.draw(g, layoutBattle(W, H, canvasK))
    else if (phase === 'wipeOut') {
      const k = Math.min(1, phaseT / WIPE)
      if (k < 0.5) {
        battle?.draw(g, layoutBattle(W, H, canvasK))
        drawGrassWipe(g, W, H, k * 2, theme)
      } else {
        field?.draw(g, W, H, canvasK)
        drawGrassWipe(g, W, H, (1 - k) * 2, theme)
      }
    } else {
      if (field) field.draw(g, W, H, canvasK, phase === 'lobby' ? (W > H ? 44 : 104) : phase === 'walk' && !box.classList.contains('hidden') ? (W > H ? 40 : 56) : 0)
      else {
        g.fillStyle = '#20242c'
        g.fillRect(0, 0, W, H)
      }
      if (phase === 'wipeIn') drawGrassWipe(g, W, H, Math.min(1, phaseT / WIPE), theme)
      if (phase === 'alert') {
        // Two flashes before the grass closes in.
        const beat = Math.floor(phaseT / 0.11)
        if ((beat === 2 || beat === 4) && phaseT > 0.2) {
          g.fillStyle = 'rgba(255,255,255,0.75)'
          g.fillRect(0, 0, W, H)
        }
      }
    }
  }

  void load()

  if (import.meta.env.DEV) {
    safariDev.run = {
      phase: () => phase,
      wanderers: () => field?.peek() ?? null,
      battle: () => battle?.phase() ?? null,
      rustle: () => startRustle(),
      stalk: () => {
        const w = session?.wanderers[0]
        if (w) startRustle(w.slot)
      },
      say: (text) => say(text),
      sneakUp: (front) => {
        sneakOn = true
        field?.setSneak(true)
        refreshSneak()
        field?.sneakUp(front)
      },
    }
  }

  return {
    step,
    draw,
    // A session lasts until it's closed: the frame claims nothing here.
    over: () => null,
    dispose: () => {
      disposed = true
      hud.remove()
      board.remove()
      screenEl?.classList.remove('sz-board-up')
      field?.release()
      battle?.release()
      if (import.meta.env.DEV) safariDev.run = null
    },
  }
}

/** The widest canvas: the backdrop is 456 px and the camera leans a little. */
const MAX_W = 440

/** The canvas for a stage of this CSS size: as large a pixel as a phone held either way can spare. */
const fluid = (stageW: number, stageH: number) => {
  const dpr = window.devicePixelRatio || 1
  const raw = Math.min(stageW / 190, stageH / 165, 3)
  const k = Math.max(1, Math.floor(raw * dpr) / dpr)
  return { w: Math.min(MAX_W, Math.floor(stageW / k)), h: Math.min(420, Math.floor(stageH / k)) }
}

/** The Zona Safári (`MINIGAMES.safari`); its canvas follows the stage. */
export const safari: SoloGame = {
  size: { w: 224, h: 300 },
  fluid,
  start,
}
