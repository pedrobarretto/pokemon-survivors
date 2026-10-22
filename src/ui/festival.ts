import { accountHandle, accountsEnabled, accountState, onAccountChange, signIn } from '../account'
import { FESTIVAL, type Festival, type FestivalId } from '../data/festivals'
import { BAG_ITEMS } from '../data/shop'
import type { FrameId } from '../data/style'
import { HATCHLINGS } from '../data/hatchlings'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { donateFestival, festivalView, loadFestival, onFestival, setDonorPublic, type FestivalView } from '../festival'
import { dayNumber, msToNextDay } from '../game/day'
import { festivalAnnounced, festivalEnd, nextFestival, nextMilestone, reachedMilestones } from '../game/festival'
import type { GiftContent } from '../game/gifts'
import { formatDay, formatNumber, formatPokeDollars, formatPokeDollarsShort, t } from '../i18n'
import { coinIcon, sparkleIcon } from '../render/art'
import { frameIcon } from '../render/cosmetics'
import { dialogue, type DialogueLine } from './dialogue'
import { h, later, setText } from './dom'
import { contentLine } from './gifts'
import { kecleonSpeaker } from './kecleon'
import { profileEditor } from './profile'
import { loadSave, today } from './save'
import { confirmDialog, type Screen } from './screens'
import { nearestInDirection, type Direction } from './spatial'

/**
 * Festival da Praça's sheet: the community pot of the festival the plaza
 * shows (`festivalView`), its milestones on a track, the next one's reward,
 * and the fountain (amount chips, a custom amount, today's cap and what the
 * player gave), with Kecleon talking beside it in a passive box. A second
 * tab is the donors' plaque (the top 10 by @handle, the player's own place
 * and the "my name on the plaque" switch). Guests see the pot and a sign-in
 * prompt; before a festival it counts down, after one it shows the result.
 * Laid out like the shop's panel (`.shop-sheet`: a side panel on wide
 * screens, a bottom sheet on portrait phones, inside the touch guard's
 * scrollable selector in `main.ts`).
 */

/** The chips' amounts; "Outro…" takes any whole amount the rules allow. */
const CHIPS = [1_000, 10_000, 50_000] as const

/** Donations from this much ask first. */
const CONFIRM_FROM = 50_000

/** Each festival's icon: the frame its milestones give, for its lanterns. */
const ICONS = { lanternas: 'lantern' } as const satisfies Record<FestivalId, FrameId>

/** A festival's icon (the lobby's card, the plaque). */
export const festivalIcon = (id: FestivalId) => frameIcon(ICONS[id])

/** A milestone's reward in a few words ("Ovo raro", "3× Lure", "Togepi shiny"). */
const rewardName = (c: GiftContent): string => {
  const m = t().festival
  switch (c.kind) {
    case 'egg':
      return t().eggs.tiers[c.tier]
    case 'style': {
      const names: Readonly<Record<string, string>> = t().mart.styles[c.style.slot]
      const name = names[c.style.id] ?? c.style.id
      return c.style.slot === 'frame' ? m.frame(name) : name
    }
    case 'bag':
      return `${c.count}× ${BAG_ITEMS[c.item].name}`
    case 'shinyHatch':
      return m.shiny(HATCHLINGS[c.family].name)
    case 'title':
      return t().achievements.titles[c.title]
    case 'coins':
      return formatPokeDollars(c.amount)
    case 'ribbon':
      return t().ribbons.names[c.ribbon.tier]
    case 'shinyPick':
    case 'companion':
      return contentLine({ content: c }).text.replace(/[*_]/g, '')
  }
}

/** Where the sheet stands: a festival running, one coming up, the last one's result, or nothing planned. */
type Phase = { kind: 'running'; f: Festival } | { kind: 'before'; f: Festival } | { kind: 'after'; f: Festival; next: Festival | null } | { kind: 'none' }

const phaseOf = (v: FestivalView): Phase => {
  if (v.running && v.festival) return { kind: 'running', f: v.festival }
  const next = nextFestival(v.day)
  if (next && (!v.festival || festivalAnnounced(v.day) === next)) return { kind: 'before', f: next }
  return v.festival ? { kind: 'after', f: v.festival, next } : { kind: 'none' }
}

/** "6d 14h" until `f` closes (the end of its last Brasília day). */
const timeLeft = (f: Festival, v: FestivalView) => {
  const hours = Math.floor((msToNextDay(today()) + (dayNumber(festivalEnd(f)) - dayNumber(v.day)) * 86_400_000) / 3_600_000)
  return t().festival.timeLeft(Math.floor(hours / 24), hours % 24)
}

/** Whole ₽ typed in the custom field (separators and the ₽ ignored), or null when empty. */
const typedAmount = (text: string) => {
  const digits = text.replace(/\D/g, '').slice(0, 9)
  return digits ? Number(digits) : null
}

const img = (src: string, cls = '') => h('img', { src, alt: '', class: cls, draggable: 'false' })

/** Where a milestone sits on the track, in % of the last one. */
const along = (f: Festival, pot: number) => Math.min(100, (pot / f.milestones[f.milestones.length - 1]!.pot) * 100)

/** The pot's track: the milestones' rewards above it, their markers on it and their pots under it (reached ones lit). */
const potTrack = (f: Festival, pot: number) => {
  const place = (i: number) => `left:${along(f, f.milestones[i]!.pot)}%`
  const last = f.milestones.length - 1
  const at = (i: number) => (i === last ? 'end' : '')
  return h(
    'div',
    { class: 'festival-track' },
    h('div', { class: 'festival-rewards' }, ...f.milestones.map((ms, i) => h('img', { src: contentLine({ content: ms.reward }).src, alt: rewardName(ms.reward), title: rewardName(ms.reward), class: `${pot >= ms.pot ? 'on' : ''} ${at(i)}`, style: place(i), draggable: 'false' }))),
    h(
      'div',
      { class: 'festival-bar' },
      h('span', { class: 'festival-fill', style: `width:${along(f, pot)}%` }),
      ...f.milestones.map((ms, i) => h('i', { class: pot >= ms.pot ? 'on' : '', style: place(i) })),
    ),
    h('div', { class: 'festival-marks' }, ...f.milestones.map((ms, i) => h('span', { class: `${pot >= ms.pot ? 'on' : ''} ${at(i)}`, style: place(i) }, formatPokeDollarsShort(ms.pot).replace('₽ ', '')))),
  )
}

/** The sheet's tabs: the fountain (the pot and giving) and the donors' plaque. */
export type FestivalTab = 'fountain' | 'plaque'

const isTouch = (e: Event) => e instanceof PointerEvent && e.pointerType !== '' && e.pointerType !== 'mouse'

const DIRECTIONS: Readonly<Record<string, Direction>> = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' }

/**
 * Opens the festival's sheet over whatever is behind (the plaza, from the
 * lobby's card, the shop's Festival button, or the fountain). `close` runs
 * once it's left (◀, Esc or Backspace). It opens on `start` (the plaque from
 * the plaza's plaque, while the festival shows one). Keyboard: arrows move,
 * Q/E change tab, Enter presses. A donation of `CONFIRM_FROM` or more asks first.
 */
export const openFestival = (root: HTMLElement, input: Input, close: () => void, start: FestivalTab = 'fountain'): Screen => {
  const m = t().festival
  let view = festivalView()
  let tab: FestivalTab = start
  /** The amount picked: a chip's (₽10k to start), or the custom field's (`custom`). */
  let chip: number | null = CHIPS[1]
  let custom = false
  let busy = false
  /** What the strip says after an action (a refusal, the thanks), until the next pick. */
  let said: { text: string; tone: 'error' | 'done' | 'info'; handle?: boolean } | null = null
  let nested: Screen | null = null
  let focused: HTMLElement | null = null
  let thanks = 0
  let closed = false

  const hello = (): DialogueLine => {
    const p = phaseOf(view)
    if (p.kind === 'before') return { text: m.helloBefore(m.names[p.f.id], formatDay(p.f.start)), emotion: 'Happy' }
    if (p.kind === 'after') return { text: m.helloAfter(m.names[p.f.id]), emotion: 'Normal' }
    return { text: m.hello, emotion: 'Joyous' }
  }

  const el = h('div', { class: 'shop-layer festival-layer' })
  root.append(el)
  const talk = dialogue(root, input, { speaker: kecleonSpeaker(), lines: [hello()], onDone: () => {}, className: 'shop-talk', passive: true })

  /* The parts that stay (they hold focus and the typed amount); `render` fills the rest around them. */
  const title = h('h2', { class: 'shop-title' })
  const wallet = h('span')
  const back = h('button', { class: 'btn shop-back', type: 'button', 'aria-label': t().mart.back }, '◀', h('span', { class: 'shop-back-label' }, ` ${t().mart.back}`))
  const tabs = { fountain: h('button', { class: 'shop-tab', type: 'button', role: 'tab' }, m.tabs.fountain), plaque: h('button', { class: 'shop-tab', type: 'button', role: 'tab' }, m.tabs.plaque) }
  const chips = [...CHIPS.map((n) => h('button', { class: 'festival-chip', type: 'button' }, formatPokeDollarsShort(n))), h('button', { class: 'festival-chip', type: 'button' }, m.other)]
  const field = h('input', {
    class: 'field-input festival-field',
    type: 'text',
    inputmode: 'numeric',
    pattern: '[0-9]*',
    enterkeyhint: 'done',
    autocomplete: 'off',
    maxlength: 9,
    'aria-label': m.otherLabel,
    placeholder: formatNumber(25_000),
  })
  const fieldHint = h('small', { class: 'festival-field-hint' })
  const fieldRow = h('label', { class: 'festival-field-row' }, h('span', { class: 'festival-field-coin' }, '₽'), field, fieldHint)
  const donateBtn = h('button', { class: 'btn confirm festival-donate', type: 'button' })
  const signInBtn = h('button', { class: 'btn confirm festival-donate', type: 'button' }, m.signIn)
  const handleBtn = h('button', { class: 'btn festival-donate', type: 'button' }, m.setHandle)
  const plaqueSwitch = h('button', { class: 'festival-switch', type: 'button', role: 'switch' })

  const potEl = h('div', { class: 'festival-pot' })
  const nextEl = h('div')
  const capEl = h('div', { class: 'festival-cap' })
  const giveEl = h('div', { class: 'festival-give' }, h('div', { class: 'festival-label' }, m.give), h('div', { class: 'festival-chips' }, ...chips), fieldRow, capEl)
  const aboutEl = h('div', { class: 'festival-about' })
  const fountainEl = h('div', { class: 'festival-pane' }, potEl, nextEl, giveEl, aboutEl)
  const plaqueEl = h('div', { class: 'festival-pane festival-plaque' })
  const body = h('div', { class: 'festival-body' }, fountainEl, plaqueEl)
  const footText = h('p', { class: 'festival-foot-text' })
  const foot = h('div', { class: 'festival-foot' }, footText, donateBtn, signInBtn, handleBtn)
  const sheet = h(
    'section',
    { class: 'shop-sheet box festival-sheet', 'aria-label': m.title },
    h('header', { class: 'shop-head' }, back, title, h('span', { class: 'shop-wallet' }, img(coinIcon(0)), wallet)),
    h('nav', { class: 'shop-tabs festival-tabs', role: 'tablist' }, tabs.fountain, tabs.plaque),
    body,
    foot,
  )
  el.append(sheet)

  const signedIn = () => accountState().kind === 'signedIn'
  /** The most the player may give now: the rules' cap, today's cap left and the wallet. */
  const most = () => Math.min(FESTIVAL.dailyCap, view.capLeft, loadSave().wallet)
  const amount = () => (custom ? typedAmount(field.value) : chip)

  /** Why `n` can't go (checked here before asking the API), or null. */
  const refusal = (n: number | null) => {
    const e = m.errors
    if (n === null) return m.pick
    if (n < FESTIVAL.minDonation || n > FESTIVAL.dailyCap) return e.invalid(formatPokeDollars(FESTIVAL.minDonation), formatPokeDollars(FESTIVAL.dailyCap))
    if (n > view.capLeft) return view.capLeft === 0 ? m.capReached : e.cap
    if (n > loadSave().wallet) return e.wallet
    return null
  }

  /** A refusal from the API (or the account) as words: `FestivalDonation`'s error codes. */
  const errorText = (code: string) => {
    const e = m.errors
    const known: Readonly<Record<string, string>> = {
      profile: e.profile,
      runs: e.runs,
      banned: e.banned,
      closed: e.closed,
      cap: e.cap,
      funds: e.funds,
      stale: e.stale,
      nosave: e.stale,
      offline: e.offline,
      rate: e.rate,
      guest: e.guest,
    }
    return known[code] ?? e.other
  }

  /** The strip under the sheet: what was said (or the live check of the amount picked) and its button. */
  const renderFoot = () => {
    const p = phaseOf(view)
    const giving = p.kind === 'running' && tab === 'fountain' && signedIn()
    const n = amount()
    const why = giving && (chip !== null || custom) ? refusal(n) : null
    const text = said?.text ?? (p.kind !== 'running' ? (p.kind === 'after' ? m.after.claim : m.foot) : !signedIn() ? (accountsEnabled ? m.guest : m.guestOffline) : (why ?? m.foot))
    setText(footText, text)
    footText.className = `festival-foot-text ${said?.tone ?? (why && n !== null ? 'error' : '')}`
    donateBtn.hidden = !giving || said?.handle === true
    signInBtn.hidden = p.kind !== 'running' || signedIn() || !accountsEnabled
    handleBtn.hidden = !giving || said?.handle !== true
    setText(donateBtn, busy ? m.donating : m.donate(n === null ? '' : formatPokeDollarsShort(n)).trim())
    donateBtn.toggleAttribute('disabled', busy || n === null || why !== null)
    const max = most()
    setText(fieldHint, m.otherHint(formatPokeDollarsShort(FESTIVAL.minDonation), formatPokeDollarsShort(Math.max(FESTIVAL.minDonation, max))))
    chips.forEach((c, i) => {
      const value = CHIPS[i]
      c.classList.toggle('on', value === undefined ? custom : !custom && chip === value)
      c.classList.toggle('off', value !== undefined && value > max)
    })
  }

  /** The fountain's pane: the pot and its track, the next milestone, then the chips (running, signed in) or the festival's before and after. */
  const renderFountain = (p: Exclude<Phase, { kind: 'none' }>) => {
    const pot = p.kind === 'before' ? 0 : view.pot
    const f = p.f
    const top = f.milestones[f.milestones.length - 1]!.pot
    const label = p.kind === 'running' ? `${m.potLabel} · ${m.endsIn(timeLeft(f, view))}` : p.kind === 'before' ? m.before.opens(formatDay(f.start)) : m.after.ended
    potEl.replaceChildren(
      h('div', { class: 'festival-pot-label' }, label),
      h('div', { class: 'festival-pot-num' }, h('b', {}, formatPokeDollars(pot)), h('span', {}, m.ofTotal(formatPokeDollarsShort(top)))),
      potTrack(f, pot),
    )
    const next = nextMilestone(f, pot)
    nextEl.className = next ? 'festival-next' : 'festival-next done'
    nextEl.replaceChildren(
      ...(next
        ? [
            h('span', { class: 'festival-next-icon' }, img(contentLine({ content: next.reward }).src)),
            h(
              'span',
              { class: 'festival-next-text' },
              h('small', {}, m.next(formatPokeDollarsShort(next.pot))),
              h('b', {}, m.forEveryone(rewardName(next.reward))),
              p.kind === 'before' ? null : h('span', {}, m.missing(formatPokeDollarsShort(next.pot - pot))),
            ),
          ]
        : [h('span', { class: 'festival-next-icon' }, img(sparkleIcon())), h('span', { class: 'festival-next-text' }, h('small', {}, m.allReached), h('span', {}, m.allReachedText))]),
    )
    nextEl.hidden = p.kind === 'after'
    giveEl.hidden = p.kind !== 'running' || !signedIn()
    fieldRow.hidden = !custom
    const mine = view.mine
    const given = mine?.given[f.id] ?? 0
    capEl.replaceChildren(
      h('span', { class: 'festival-cap-today' }, view.capLeft > 0 ? m.todayLeft(formatPokeDollars(view.capLeft)) : m.capReached),
      ...(given > 0
        ? [h('span', { class: 'festival-cap-you' }, `${m.given(formatPokeDollars(given))} · `, given >= FESTIVAL.patron ? h('em', {}, m.patron) : m.toPatron(formatPokeDollarsShort(FESTIVAL.patron - given)))]
        : []),
      ...(mine && mine.held > 0 ? [h('span', { class: 'festival-cap-you' }, m.held(formatPokeDollars(mine.held)))] : []),
    )
    const reached = reachedMilestones(f, pot)
    aboutEl.replaceChildren(
      ...(p.kind === 'before' ? [h('p', {}, m.before.text(f.days))] : []),
      ...(p.kind === 'after'
        ? [
            h('p', {}, h('b', {}, m.after.raised(formatPokeDollars(pot))), ` · ${m.after.reached(reached, f.milestones.length)}`),
            h('p', {}, p.next ? m.after.next(m.names[p.next.id], formatDay(p.next.start)) : m.after.soon),
          ]
        : []),
    )
    aboutEl.hidden = p.kind === 'running'
  }

  /** The plaque: the top donors by @handle (the player's row lit), and the player's own total, place and switch. */
  const renderPlaque = (f: Festival) => {
    const pl = m.plaque
    const mine = view.mine
    const handle = accountHandle()
    const given = mine?.given[f.id] ?? 0
    plaqueSwitch.setAttribute('aria-checked', String(mine?.public !== false))
    plaqueSwitch.replaceChildren(h('span', {}, pl.show), h('b', {}, mine?.public === false ? pl.hidden : pl.shown))
    plaqueEl.replaceChildren(
      h('div', { class: 'festival-plaque-head' }, img(festivalIcon(f.id)), h('span', {}, h('b', {}, pl.title), h('span', {}, pl.donors(m.names[f.id], view.donors)))),
      view.top.length > 0
        ? h(
            'ol',
            { class: 'festival-donors' },
            ...view.top.map((d, i) => h('li', { class: d.handle === handle ? 'me' : '' }, h('i', {}, String(i + 1)), h('b', {}, `@${d.handle}`), h('em', {}, formatPokeDollarsShort(d.amount)))),
          )
        : h('p', { class: 'festival-empty' }, pl.empty),
      ...(mine
        ? [
            h(
              'div',
              { class: 'festival-me' },
              h('span', {}, given > 0 ? `${pl.you(formatPokeDollars(given))}${mine.rank ? ` · ${pl.rank(mine.rank)}` : ''}` : pl.none),
              plaqueSwitch,
            ),
          ]
        : []),
    )
  }

  const render = () => {
    if (closed) return
    const p = phaseOf(view)
    const f = p.kind === 'none' ? null : p.f
    setText(title, f ? m.names[f.id] : m.title)
    setText(wallet, formatPokeDollars(loadSave().wallet))
    // The plaque only once someone may have given (running or over).
    tabs.plaque.hidden = p.kind !== 'running' && p.kind !== 'after'
    if (tabs.plaque.hidden) tab = 'fountain'
    for (const id of ['fountain', 'plaque'] as const) {
      tabs[id].classList.toggle('on', tab === id)
      tabs[id].setAttribute('aria-selected', String(tab === id))
    }
    fountainEl.hidden = tab !== 'fountain'
    plaqueEl.hidden = tab !== 'plaque'
    if (p.kind === 'none') {
      potEl.replaceChildren(h('p', {}, m.after.soon))
      nextEl.hidden = giveEl.hidden = aboutEl.hidden = true
    } else if (tab === 'fountain') renderFountain(p)
    else renderPlaque(p.f)
    renderFoot()
    for (const n of navs()) n.classList.toggle('selected', n === focused)
  }

  /** Everything the arrows reach, in the layout's order. */
  const navs = (): HTMLElement[] =>
    [back, tabs.fountain, tabs.plaque, ...chips, field, plaqueSwitch, donateBtn, signInBtn, handleBtn].filter((n) => n.isConnected && !n.hidden && !n.closest('[hidden]') && !(n instanceof HTMLButtonElement && n.disabled))

  const focus = (node: HTMLElement, sound = true) => {
    if (node === focused) return
    focused = node
    if (sound) playSfx('move')
    for (const n of navs()) n.classList.toggle('selected', n === focused)
    node.scrollIntoView({ block: 'nearest' })
  }

  const move = (dir: Direction) => {
    const list = navs()
    const next = list[nearestInDirection(list.map((n) => n.getBoundingClientRect()), Math.max(0, list.findIndex((n) => n === focused)), dir)]
    if (next) focus(next)
  }

  const switchTab = (next: FestivalTab) => {
    if (next === tab || tabs[next].hidden) return
    tab = next
    said = null
    playSfx('move')
    body.scrollTop = 0
    render()
  }

  /** A chip picks its amount ("Outro…" opens the field, focused, so a phone shows its number pad). */
  const pick = (i: number) => {
    const value = CHIPS[i]
    said = null
    custom = value === undefined
    chip = value ?? null
    playSfx('select')
    render()
    if (custom) {
      field.focus()
      field.scrollIntoView({ block: 'nearest' })
    }
  }

  const send = async (n: number) => {
    busy = true
    said = { text: m.donating, tone: 'info' }
    render()
    const done = await donateFestival(n)
    if (closed) return
    busy = false
    view = festivalView()
    if (done.ok) {
      playSfx('payDay')
      said = { text: done.held ? m.heldDone(formatPokeDollars(n)) : m.done(formatPokeDollars(n)), tone: 'done' }
      talk.say([{ text: m.thanks[thanks++ % m.thanks.length]!, emotion: 'Joyous' }], kecleonSpeaker())
      potEl.classList.remove('bump')
      // Restarts the pot's little hop.
      void potEl.offsetWidth
      potEl.classList.add('bump')
    } else {
      playSfx('denied')
      said = { text: errorText(done.error), tone: 'error', handle: done.error === 'profile' }
    }
    render()
  }

  const donate = () => {
    const n = amount()
    const why = refusal(n)
    if (busy || nested || n === null || why) {
      playSfx('denied')
      if (why) said = { text: why, tone: 'error' }
      return render()
    }
    playSfx('select')
    if (n < CONFIRM_FROM) return void send(n)
    later(() => {
      nested = confirmDialog(
        root,
        input,
        m.confirm(formatPokeDollars(n)),
        (yes) => {
          nested?.dispose()
          nested = null
          if (yes) void send(n)
        },
        { class: 'shop-confirm' },
      )
    })
  }

  /** Picking a @handle (the profile's editor over the sheet), after the API asked for one. */
  const editHandle = () => {
    if (nested) return
    playSfx('select')
    later(() => {
      nested = profileEditor(root, input, (saved) => {
        nested?.dispose()
        nested = null
        if (saved) said = null
        render()
      })
    })
  }

  const togglePlaque = async () => {
    const mine = view.mine
    if (!mine || busy) return playSfx('denied')
    busy = true
    playSfx('select')
    const ok = await setDonorPublic(!mine.public)
    busy = false
    if (closed) return
    said = ok ? null : { text: m.plaque.failed, tone: 'error' }
    view = festivalView()
    render()
  }

  const leave = () => {
    if (closed || busy) return
    closed = true
    playSfx('select')
    later(close)
  }

  /** Enter (A on a pad) on whatever the arrows are on. */
  const press = (node: HTMLElement | null) => {
    if (!node) return
    if (node === field) return field.focus()
    node.click()
  }

  back.addEventListener('click', leave)
  tabs.fountain.addEventListener('click', () => !nested && switchTab('fountain'))
  tabs.plaque.addEventListener('click', () => !nested && switchTab('plaque'))
  chips.forEach((c, i) => c.addEventListener('click', () => !nested && !busy && pick(i)))
  donateBtn.addEventListener('click', () => donate())
  signInBtn.addEventListener('click', () => (playSfx('select'), void signIn()))
  handleBtn.addEventListener('click', editHandle)
  plaqueSwitch.addEventListener('click', () => void togglePlaque())
  for (const n of [back, tabs.fountain, tabs.plaque, ...chips, field, plaqueSwitch, donateBtn, signInBtn, handleBtn]) n.addEventListener('pointerenter', (e) => !isTouch(e) && focus(n, false))
  field.addEventListener('input', () => {
    said = null
    renderFoot()
  })
  // The field keeps its keys from the game (`engine/input.ts`): Enter donates, Escape leaves the field.
  field.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      field.blur()
      donate()
    } else if (e.key === 'Escape') field.blur()
  })

  const offKeys = input.onKey((key) => {
    if (nested || closed) return
    const dir = DIRECTIONS[key]
    if (dir) move(dir)
    else if (key === 'KeyQ' || key === 'PageUp') switchTab('fountain')
    else if (key === 'KeyE' || key === 'PageDown') switchTab('plaque')
    else if (key === 'Enter' || key === 'Space') press(focused)
    else if (key === 'Escape' || key === 'Backspace') leave()
  })
  const offFestival = onFestival((next) => {
    view = next
    render()
  })
  const offAccount = onAccountChange(() => render())

  render()
  focus([chips[1]!, signInBtn, tabs.fountain].find((n) => navs().includes(n)) ?? tabs.fountain, false)
  // A fresh look at the pot (and the player's own) as the sheet opens.
  void loadFestival(true)

  let shownMinute = -1
  return {
    el,
    tick: (time) => {
      talk.tick?.(time)
      // The time left, once a minute.
      const minute = Math.floor(Date.now() / 60_000)
      if (minute !== shownMinute && !busy && document.activeElement !== field) {
        if (shownMinute >= 0 && tab === 'fountain') render()
        shownMinute = minute
      }
    },
    dispose: () => {
      closed = true
      offKeys()
      offFestival()
      offAccount()
      nested?.dispose()
      talk.dispose()
      el.remove()
    },
  }
}

/* ---------------- The lobby's card ---------------- */

/** Whether the lobby's Hoje rail shows the festival's card: while one runs. */
export const festivalCardShows = () => festivalView().running

/** The pot's way from the last milestone it passed to the next one, 0..1 (full past the last). */
const toNext = (f: Festival, pot: number) => {
  const next = nextMilestone(f, pot)
  if (!next) return 1
  const prev = [...f.milestones].reverse().find((ms) => ms.pot <= pot)?.pot ?? 0
  return (pot - prev) / Math.max(1, next.pot - prev)
}

/**
 * The Hoje card while a festival runs: its lantern, the pot's way to the
 * next milestone and the pot in short, with the days left. It follows the
 * pot as the API answers.
 */
export const festivalCard = () => {
  const m = t().festival
  const left = h('em', { class: 'lobby-badge festival-left' })
  const fill = h('span')
  const pot = h('b')
  const icon = img('', 'lobby-lantern')
  const el = h(
    'button',
    { class: 'lobby-card box festival', type: 'button' },
    h('small', { class: 'lobby-card-label' }, h('span', {}, m.card), left),
    h('span', { class: 'lobby-card-row' }, icon, h('span', { class: 'lobby-progress festival-pot-bar' }, fill), pot),
    h('span', { class: 'key-hint' }, 'F'),
  )
  const paint = (v: FestivalView) => {
    const f = v.festival
    if (!f) return
    const days = dayNumber(festivalEnd(f)) - dayNumber(v.day) + 1
    icon.src = festivalIcon(f.id)
    setText(left, m.daysLeftShort(days))
    fill.style.width = `${Math.round(toNext(f, v.pot) * 100)}%`
    setText(pot, formatPokeDollarsShort(v.pot))
    el.setAttribute('aria-label', `${m.names[f.id]}: ${formatPokeDollars(v.pot)}`)
  }
  paint(festivalView())
  const off = onFestival((v) => (el.isConnected ? paint(v) : off()))
  return el
}
