import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { ACHIEVEMENT_IDS, ACHIEVEMENTS, MEDAL_EGG, MEDALS, TITLE_IDS, type AchievementDef, type AchievementId, type TitleId } from '../data/achievements'
import type { MissionGoal, MissionPeriod } from '../data/missions'
import { REGIONS } from '../data/starters'
import { achievementProgress } from '../game/achievements'
import type { RunRecord } from '../game/meta'
import { MISSION_PERIODS, missionStatus, periodEnd, type MissionStatus } from '../game/missions'
import { formatNumber, formatPokeDollars, t } from '../i18n'
import { ENEMIES } from '../data/enemies'
import { BAG_ITEMS, type BagItem } from '../game/bag'
import { bagIcon, coinIcon, eggIcon, giftIcon, medalIcon } from '../render/art'
import { h, later, rich, setText } from './dom'
import { researchRows } from './research'
import { equipTitle, loadSave, outbreakToday, today } from './save'
import { convertedEggLines, hint, type Screen } from './screens'
import { toast } from './toasts'

const isTouch = (e: Event) => e instanceof PointerEvent && e.pointerType !== '' && e.pointerType !== 'mouse'

/** The line a mission shows, e.g. "Defeat 80 Ghost-type Pokémon". */
export const missionText = (goal: MissionGoal, target: number) => {
  const g = t().missions.goals
  const types = t().types
  const n = formatNumber(target)
  switch (goal.kind) {
    case 'typeKills': return g.typeKills(n, types[goal.type])
    case 'weatherKills': return g.weatherKills[goal.weather](n)
    case 'biomeKills': return g.biomeKills[goal.biome](n)
    case 'coins': return g.coins(formatPokeDollars(target))
    case 'wins': return goal.type ? g.typeWins(n, types[goal.type]) : g.wins(n)
    case 'survive': return goal.type ? g.typeSurvive(n, types[goal.type]) : g.survive(n)
    case 'outbreakKills': return g.outbreakKills(n, ENEMIES[outbreakToday()].name)
    default: return g[goal.kind](n)
  }
}

/** The goal line under an achievement's name. */
export const achievementGoal = (id: AchievementId) => {
  const a = t().achievements
  const def: AchievementDef = ACHIEVEMENTS[id]
  if (def.stat === 'region') return a.region(REGIONS.find((r) => r.gen === def.gen)?.name ?? '')
  return a.goals[def.stat](def.stat === 'coins' ? formatPokeDollars(def.target) : formatNumber(def.target))
}

const progressBar = (value: number, target: number) =>
  h('span', { class: 'progress' }, h('span', { style: `width:${Math.round((Math.min(value, target) / target) * 100)}%` }))

/**
 * One mission: goal, reward (or a check once done) and a progress bar.
 * `gained` adds what the last run contributed; `fresh` highlights a mission the run just completed.
 */
const missionRow = (m: MissionStatus, opts: { gained?: number; fresh?: boolean } = {}) =>
  h(
    'div',
    { class: `mission-row${m.done ? ' done' : ''}${opts.fresh ? ' fresh' : ''}` },
    h('span', { class: 'mission-text' }, missionText(m.goal, m.target)),
    h(
      'span',
      { class: 'mission-reward' },
      m.done ? '✓' : h('img', { src: coinIcon(0), alt: '' }),
      m.done ? '' : formatNumber(m.reward),
      !m.done && m.egg && h('img', { src: eggIcon(m.egg), alt: t().eggs.tiers[m.egg], title: t().missions.rewardEgg(t().eggs.tiers[m.egg]) }),
      !m.done && m.item && h('img', { src: bagIcon(m.item), alt: BAG_ITEMS[m.item].name, title: t().missions.rewardItem(BAG_ITEMS[m.item].name) }),
    ),
    h(
      'span',
      { class: 'mission-progress' },
      progressBar(m.progress, m.target),
      h('span', {}, `${formatNumber(m.progress)}/${formatNumber(m.target)}`),
      opts.gained ? h('b', { class: 'mission-gain' }, `+${formatNumber(opts.gained)}`) : null,
    ),
  )

/** "renovam em 5h 12min": time left until the period's missions change. */
const resetsIn = (period: MissionPeriod) => {
  const left = Math.max(0, periodEnd(period, today()).getTime() - today().getTime())
  const minutes = Math.ceil(left / 60_000)
  return t().missions.resetsIn(t().missions.duration(Math.floor(minutes / 1440), Math.floor((minutes % 1440) / 60), minutes % 60))
}

/** Equipped title as a small badge, or nothing. */
export const titleBadge = (title: TitleId | null) => (title ? h('div', { class: 'player-title' }, '★ ', t().achievements.titles[title], ' ★') : null)

/** Results-screen line of a mission the run moved: goal, progress and what the run added (a check once done). */
const reportRow = (m: MissionStatus, gained: number, fresh: boolean) =>
  h(
    'div',
    { class: `report-row${m.done ? ' done' : ''}${fresh ? ' fresh' : ''}` },
    h('span', { class: 'mission-text' }, missionText(m.goal, m.target)),
    h('span', { class: 'report-count' }, m.done ? '✓' : `${formatNumber(m.progress)}/${formatNumber(m.target)}`, gained > 0 && h('b', { class: 'mission-gain' }, `+${formatNumber(gained)}`)),
    progressBar(m.progress, m.target),
  )

/**
 * Results-screen section: only the missions this run moved (`before` is the
 * board when the run started), with the ₽ and reward eggs that missions and
 * medals paid. Null when the run moved none, so the results stay short.
 */
export const missionReport = (before: readonly MissionStatus[], reward: number, eggs: number, items: readonly BagItem[] = []) => {
  const m = t().missions
  const moved = missionStatus(loadSave().missions, today()).flatMap((s) => {
    const was = before.find((b) => b.id === s.id)
    const gained = was ? s.progress - was.progress : 0
    return gained > 0 ? [reportRow(s, gained, s.done && was?.done === false)] : []
  })
  if (moved.length === 0 && reward === 0 && eggs === 0 && items.length === 0) return null
  return h(
    'div',
    { class: 'mission-report' },
    h(
      'div',
      { class: 'mission-report-head' },
      h('b', {}, m.report),
      reward > 0 && h('span', { class: 'mission-report-reward' }, h('img', { src: coinIcon(1), alt: '' }), m.reportReward(formatPokeDollars(reward))),
      eggs > 0 && h('span', { class: 'mission-report-reward' }, h('img', { src: eggIcon('rare'), alt: '' }), m.reportEggs(eggs)),
      items[0] && h('span', { class: 'mission-report-reward' }, h('img', { src: bagIcon(items[0]), alt: '' }), m.reportItems(items.length)),
    ),
    ...moved,
  )
}

/** The medals a run earned, as chips for the results' news line. */
export const medalChips = (unlocked: readonly AchievementId[]) =>
  unlocked.map((id) => h('span', { class: 'news-chip medal-chip' }, h('img', { src: medalIcon(ACHIEVEMENTS[id].medal), alt: t().achievements.medals[ACHIEVEMENTS[id].medal] }), t().achievements.names[id]))

/**
 * One toast for what was completed away from the results screen: a run quit from the pause menu, or a hatched egg.
 * Reward eggs that didn't fit say what they became.
 */
export const progressToast = (root: HTMLElement, record: Pick<RunRecord, 'completed' | 'unlocked' | 'reward' | 'eggs' | 'converted' | 'items'>) => {
  if (record.completed.length === 0 && record.unlocked.length === 0) return
  const m = t().missions
  const medal = record.unlocked[0]
  const lines = [
    record.completed.length > 0 && m.toastDone(record.completed.length, formatPokeDollars(record.reward)),
    medal && m.toastMedal(t().achievements.names[medal]),
    record.eggs.length > 0 && m.toastEgg(record.eggs.length),
    ...convertedEggLines(record.converted),
    record.items.length > 0 && m.toastItem(record.items.length),
  ].filter((line) => typeof line === 'string')
  playSfx('levelUp')
  toast(root, h('span', { class: 'item-toast' }, h('img', { src: medal ? medalIcon(ACHIEVEMENTS[medal].medal) : coinIcon(1), alt: '' }), rich(lines.join(' · '))), 3600)
}

type Tab = 'missions' | 'achievements' | 'research'

const TABS: readonly Tab[] = ['missions', 'achievements', 'research']

/**
 * Missions, achievements and research, opened from the title menu. Three tabs (← →),
 * a scrolling list (↑ ↓) and Back. On the achievements tab, Enter or a tap on
 * an unlocked achievement with a title shows that title (again hides it).
 */
export const missionsScreen = (root: HTMLElement, input: Input, onClose: () => void): Screen => {
  const m = t().missions
  const a = t().achievements
  let tab: Tab = 'missions'
  let index = 0
  let entries: HTMLElement[] = []
  let closed = false
  const resets: Array<[HTMLElement, MissionPeriod]> = []

  const tabs = { missions: h('button', { class: 'tab' }, m.tab), achievements: h('button', { class: 'tab' }, a.tab), research: h('button', { class: 'tab' }, t().seasonUnlocks.research.tab) } as const
  const list = h('div', { class: 'missions-list' })
  const back = h('button', { class: 'btn' }, m.back)
  // Closes on its own: opened over the Trainer Card it isn't the shell's screen, so nothing else disposes it.
  const close = () => {
    if (closed) return
    closed = true
    dispose()
    later(onClose)
  }

  const missionsTab = () => {
    resets.length = 0
    const all = missionStatus(loadSave().missions, today())
    return MISSION_PERIODS.flatMap((period) => {
      const left = h('span', {}, resetsIn(period))
      resets.push([left, period])
      const rows = all.filter((s) => s.period === period).map((s) => missionRow(s))
      return [h('div', { class: 'missions-head' }, h('b', {}, m[period]), left), ...rows]
    })
  }

  const achievementsTab = () => {
    const save = loadSave()
    const { unlocked, lifetime } = save.achievements
    const medals = MEDALS.map((medal) => {
      const ids = ACHIEVEMENT_IDS.filter((id) => ACHIEVEMENTS[id].medal === medal)
      return h('span', { class: 'medal-count', title: a.medals[medal] }, h('img', { src: medalIcon(medal), alt: a.medals[medal] }), `${ids.filter((id) => unlocked.includes(id)).length}/${ids.length}`)
    })
    const summary = h(
      'div',
      { class: 'ach-summary' },
      h('span', {}, a.count(unlocked.length, ACHIEVEMENT_IDS.length)),
      h('span', { class: 'medal-counts' }, ...medals),
      h('span', { class: 'ach-title' }, `${a.title}: `, h('b', {}, save.title ? a.titles[save.title] : a.noTitle)),
    )
    const rows = ACHIEVEMENT_IDS.map((id) => {
      const def = ACHIEVEMENTS[id]
      const got = unlocked.includes(id)
      const p = achievementProgress(lifetime, id, save.dex)
      const egg = MEDAL_EGG[def.medal]
      const titled = 'title' in def
      return h(
        'button',
        { class: `ach-row${got ? '' : ' locked'}${titled && got ? ' titled' : ''}`, 'data-id': id },
        h('img', { src: medalIcon(def.medal, !got), alt: a.medals[def.medal] }),
        h(
          'span',
          { class: 'ach-info' },
          h('b', {}, a.names[id]),
          h('span', {}, achievementGoal(id), !got && egg && h('img', { class: 'ach-egg', src: eggIcon(egg), alt: t().eggs.tiers[egg], title: t().missions.rewardEgg(t().eggs.tiers[egg]) })),
          !got && p.target > 1 && h('span', { class: 'mission-progress' }, progressBar(p.value, p.target), h('span', {}, `${formatNumber(p.value)}/${formatNumber(p.target)}`)),
        ),
        titled && h('span', { class: save.title === id ? 'tag tag-new' : 'tag' }, save.title === id ? a.equipped : a.titleTag),
      )
    })
    // Titles a Mystery Gift gave come first, to wear like any other.
    const gifted = save.titles.map((id) =>
      h(
        'button',
        { class: 'ach-row titled', 'data-id': id },
        h('img', { src: giftIcon(), alt: '' }),
        h('span', { class: 'ach-info' }, h('b', {}, a.titles[id]), h('span', {}, a.giftTitles[id])),
        h('span', { class: save.title === id ? 'tag tag-new' : 'tag' }, save.title === id ? a.equipped : a.titleTag),
      ),
    )
    return [summary, ...gifted, ...rows]
  }

  const focus = (i: number, sound = true) => {
    const next = Math.max(0, Math.min(entries.length - 1, i))
    if (next !== index && sound) playSfx('move')
    index = next
    entries.forEach((e, j) => e.classList.toggle('selected', j === index))
    entries[index]?.scrollIntoView({ block: 'nearest' })
  }

  const render = (keep = false) => {
    const items = tab === 'missions' ? missionsTab() : tab === 'achievements' ? achievementsTab() : researchRows()
    list.replaceChildren(...items)
    if (!keep) list.scrollTop = 0
    for (const [id, el] of Object.entries(tabs)) el.classList.toggle('on', id === tab)
    // Achievement rows are buttons; mission rows just scroll by.
    entries = [...items.filter((el) => el.classList.contains('ach-row') || el.classList.contains('mission-row')), back]
    entries.forEach((el, i) => {
      el.addEventListener('pointerenter', (e) => !isTouch(e) && focus(i, false))
      if (el !== back) el.addEventListener('click', () => (focus(i, false), activate(i)))
    })
    focus(keep ? index : 0, false)
  }

  const switchTab = (next: Tab) => {
    if (next === tab) return
    playSfx('move')
    tab = next
    index = 0
    render()
  }

  const activate = (i: number) => {
    const el = entries[i]
    if (el === back) return close()
    // Only unlocked achievements that grant a title do something.
    const title = TITLE_IDS.find((id) => id === el?.dataset.id)
    if (!title || !el?.classList.contains('titled')) return
    equipTitle(loadSave().title === title ? null : title)
    playSfx('select')
    render(true)
  }

  tabs.missions.addEventListener('click', () => switchTab('missions'))
  tabs.achievements.addEventListener('click', () => switchTab('achievements'))
  tabs.research.addEventListener('click', () => switchTab('research'))
  back.addEventListener('click', close)

  const off = input.onKey((key) => {
    if (key === 'ArrowLeft' || key === 'KeyA' || key === 'KeyQ') switchTab(TABS[Math.max(0, TABS.indexOf(tab) - 1)]!)
    else if (key === 'ArrowRight' || key === 'KeyD' || key === 'KeyE') switchTab(TABS[Math.min(TABS.length - 1, TABS.indexOf(tab) + 1)]!)
    else if (key === 'ArrowUp' || key === 'KeyW') focus(index - 1)
    else if (key === 'ArrowDown' || key === 'KeyS') focus(index + 1)
    else if (key === 'Enter' || key === 'Space') activate(index)
    else if (key === 'Escape' || key === 'Backspace') close()
  })

  const el = h(
    'div',
    { class: 'screen dim mart-screen' },
    h(
      'div',
      { class: 'dialog box pop mart missions' },
      h('div', { class: 'tabs', role: 'tablist' }, tabs.missions, tabs.achievements, tabs.research),
      list,
      h('div', { class: 'buttons' }, back),
      hint(m.hintKeys, m.hintTouch),
    ),
  )
  root.append(el)
  render()

  const dispose = () => (off(), el.remove())

  let lastTick = 0
  return {
    el,
    // The countdowns tick once a second.
    tick: (time) => {
      if (time - lastTick < 1) return
      lastTick = time
      for (const [span, period] of resets) setText(span, resetsIn(period))
    },
    dispose,
  }
}
