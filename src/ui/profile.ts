import { accountRealName, accountState, saveProfile } from '../account'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { formatTime } from '../engine/math'
import { PLAYABLE, type PlayableId } from '../data/hatchlings'
import { DIFFICULTY_IDS, type Difficulty } from '../game/difficulty'
import { handleProblem, normalizeHandle, parseDisplayName, suggestHandle, type ProfileRun, type PublicProfile } from '../game/ranking'
import { RIBBON_TIERS, type RibbonTier } from '../game/ribbons'
import { pokeballIcon, ribbonIcon } from '../render/art'
import { portraitUrl } from '../render/sprites'
import { send } from '../net/client'
import { fetchProfile, profileUrl, setFollow } from '../ranking'
import { pokedex } from '../site/pokedex'
import { LOCALES, locale, t } from '../i18n'
import { h, later } from './dom'
import { titleBadge } from './missions'
import { sharePreview, trainerShare } from './share'
import { difficultyTag, hint, menu, type Screen } from './screens'
import { toast } from './toasts'

/** The form a run's Pokémon ended in. */
export const runForm = (starter: PlayableId, stage: number) => {
  const line = PLAYABLE[starter].line
  return line[Math.min(stage, line.length - 1)]!
}

export const runPortrait = (starter: PlayableId, stage: number) => portraitUrl(runForm(starter, stage).dex)

/** Day and month of a run, in the current language (`14/10`, `10/14`). */
const runDay = (iso: string) => new Date(iso).toLocaleDateString(LOCALES[locale()].tag, { day: '2-digit', month: '2-digit' })

type Action = { label: string; run: () => void }

/** A line of status text inside a dialog (loading, offline, not found). */
const note = (text: string, cls = '') => h('p', { class: `profile-note ${cls}` }, text)

const section = (title: string, ...body: Node[]) => h('section', { class: 'profile-section' }, h('h3', {}, title), ...body)

const recordCell = (d: Difficulty, run: ProfileRun | undefined) =>
  h(
    'div',
    { class: run ? 'profile-record' : 'profile-record empty' },
    difficultyTag(d),
    run ? h('img', { src: runPortrait(run.starter, run.stage), alt: runForm(run.starter, run.stage).name, title: runForm(run.starter, run.stage).name }) : null,
    h('b', {}, run ? formatTime(run.time) : t().profile.noRecord),
  )

const recentRow = (run: ProfileRun) =>
  h(
    'div',
    { class: `profile-run ${run.outcome}` },
    h('img', { src: runPortrait(run.starter, run.stage), alt: '' }),
    h('span', { class: 'profile-run-name' }, runForm(run.starter, run.stage).name),
    difficultyTag(run.difficulty),
    h('b', {}, formatTime(run.time)),
    h('small', {}, `${run.verified === null ? t().ranking.pending : t().ranking.outcomes[run.outcome]} · ${runDay(run.at)}`),
  )

/** The Desafio do dia ribbons won, gold first, or null before the first one (or from an older API). */
const ribbonRow = (ribbons: Record<RibbonTier, number> | undefined) => {
  if (!ribbons || RIBBON_TIERS.every((tier) => ribbons[tier] === 0)) return null
  const names = t().ribbons.names
  return section(
    t().ribbons.section,
    h(
      'div',
      { class: 'profile-ribbons' },
      ...RIBBON_TIERS.map((tier) =>
        h('div', { class: ribbons[tier] > 0 ? 'profile-ribbon' : 'profile-ribbon empty', title: names[tier] }, h('img', { src: ribbonIcon(tier), alt: names[tier] }), h('b', {}, `×${ribbons[tier]}`)),
      ),
    ),
  )
}

/** The profile's face: the Pokémon of its longest record, or a Poké Ball before any. */
const headPortrait = (p: PublicProfile) => {
  const best = Object.values(p.records).sort((a, b) => b.time - a.time)[0]
  return best ? runPortrait(best.starter, best.stage) : pokeballIcon()
}

/** Shares a profile link: the share sheet on phones, the clipboard elsewhere. */
const share = async (root: HTMLElement, p: PublicProfile) => {
  const url = profileUrl(p.handle)
  try {
    if (navigator.share) return await navigator.share({ title: `${p.name} (@${p.handle}) · Pokémon Survivors`, url })
    await navigator.clipboard.writeText(url)
    toast(root, t().profile.copied, 2200)
  } catch {
    // Share sheet dismissed, or no clipboard: nothing to undo.
  }
}

/**
 * A public profile (`/?u=handle` opens it straight away): name, handle, the
 * equipped title, records per difficulty, Desafio do dia ribbons, Pokédex progress, recent ranked runs
 * and follower counts. Signed in, it offers Follow, or Edit on one's own.
 * Back, Esc or Backspace close it and call `onClose` after the key dispatch.
 */
export const profileScreen = (root: HTMLElement, input: Input, handle: string, onClose: () => void): Screen => {
  const el = h('div', { class: 'screen dim profile-screen' })
  let nav: ReturnType<typeof menu> | null = null
  /** The editor, open over the profile. */
  let sub: Screen | null = null
  let current = handle
  let request = 0
  let closed = false

  const frame = (body: Node[], actions: Action[], opening = false) => {
    const m = t().profile
    const buttons = actions.map((a) => h('button', { class: 'btn' }, a.label))
    const at = Math.min(nav?.index ?? 0, buttons.length - 1)
    nav?.off()
    nav = menu(input, buttons, (i) => (playSfx('select'), later(actions[i]!.run)), { horizontal: true, initial: at })
    el.replaceChildren(
      h(
        'div',
        { class: opening ? 'dialog box pop profile' : 'dialog box profile' },
        h('div', { class: 'dialog-title' }, m.title),
        ...body,
        h('div', { class: 'buttons' }, ...buttons),
        hint(m.hintKeys, m.hintTouch),
      ),
    )
  }

  const back = (): Action => ({ label: t().profile.back, run: close })

  const show = (p: PublicProfile) => {
    const m = t().profile
    const total = pokedex().length
    const signedIn = accountState().kind === 'signedIn'
    // Friends are mutual follows: following sends a request (or accepts theirs); following back is the friendship.
    const friendship = p.followed && p.followsYou ? 'friends' : p.followed ? 'sent' : p.followsYou ? 'incoming' : 'none'
    const follow: Action = {
      label: { none: m.addFriend, sent: m.requestSent, incoming: m.acceptRequest, friends: m.friends }[friendship],
      run: async () => {
        // Unfriending lives in the friends screen; here the friendship just shows.
        if (friendship === 'friends') return playSfx('select')
        const next = await setFollow(p.handle, friendship !== 'sent')
        if (!next || closed) return
        playSfx(next.followed ? 'unlock' : 'select')
        send({ t: 'friends' })
        show({ ...p, followed: next.followed, followers: next.followers })
      },
    }
    const actions = [
      ...(p.self ? [{ label: m.edit, run: openEditor }, { label: m.card, run: () => openCard(p) }] : signedIn ? [follow] : []),
      { label: m.share, run: () => void share(root, p) },
      back(),
    ]
    frame(
      [
        h(
          'div',
          { class: 'profile-head' },
          h('img', { class: 'profile-portrait', src: headPortrait(p), alt: '' }),
          h('div', { class: 'profile-id' }, h('b', { class: 'profile-name' }, p.name), h('span', { class: 'profile-handle' }, `@${p.handle}`), titleBadge(p.title)),
        ),
        h('p', { class: 'profile-social' }, [m.followers(p.followers), m.following(p.following), ...(p.brought ? [m.brought(p.brought)] : [])].join(' · ')),
        !p.self && !signedIn ? note(m.followGuest) : null,
        section(m.records, h('div', { class: 'profile-records' }, ...DIFFICULTY_IDS.map((d) => recordCell(d, p.records[d])))),
        ribbonRow(p.ribbons),
        section(
          m.dex,
          h('div', { class: 'profile-dex' }, h('span', { class: 'progress' }, h('span', { style: `width:${Math.min(100, Math.round((p.dex.caught / Math.max(1, total)) * 100))}%` })), h('span', {}, m.dexLine(p.dex.caught, p.dex.seen, total))),
        ),
        section(m.recent, ...(p.recent.length > 0 ? [h('div', { class: 'profile-runs' }, ...p.recent.map(recentRow))] : [note(m.noRuns)])),
      ].filter((n) => n !== null),
      actions,
    )
  }

  const load = async (opening = false) => {
    const m = t().profile
    const id = ++request
    frame([note(m.loading, 'blink')], [back()], opening)
    const p = await fetchProfile(current)
    if (id !== request || closed) return
    if (p === 'missing') return frame([note(m.missing(current))], [back()])
    if (!p) return frame([note(m.offline)], [{ label: m.retry, run: () => void load() }, back()])
    show(p)
  }

  /**
   * The Trainer Card's share preview over one's own profile: drawn from this
   * device's save, with the Pokémon of the longest record as the partner.
   */
  const openCard = (p: PublicProfile) => {
    nav?.off()
    el.classList.add('hidden')
    const best = Object.values(p.records).sort((a, b) => b.time - a.time)[0]
    sub = sharePreview(root, input, trainerShare(best?.starter ?? 'charmander'), () => {
      sub = null
      el.classList.remove('hidden')
      show(p)
    })
  }

  /** The editor replaces the profile until it closes; a saved one may have a new handle. */
  const openEditor = () => {
    nav?.off()
    el.classList.add('hidden')
    sub = profileEditor(root, input, (saved) => {
      sub = null
      el.classList.remove('hidden')
      const s = accountState()
      if (saved && s.kind === 'signedIn' && s.handle) current = s.handle
      void load()
    })
  }

  const offKeys = input.onKey((key) => !sub && (key === 'Escape' || key === 'Backspace') && close())

  const dispose = () => {
    request++
    sub?.dispose()
    nav?.off()
    offKeys()
    el.remove()
  }

  function close() {
    if (closed) return
    closed = true
    playSfx('select')
    dispose()
    later(onClose)
  }

  root.append(el)
  void load(true)
  return { el, dispose, dim: 0.5 }
}

/**
 * Picks the public handle and display name, on the first sign in and from the
 * profile. Starts from the current ones, or a suggestion from the Google name.
 * Checks the handle as it's typed; a taken one comes back with a free
 * suggestion. `onClose(saved)` runs after the key dispatch.
 */
export const profileEditor = (root: HTMLElement, input: Input, onClose: (saved: boolean) => void): Screen => {
  const m = t().profile
  const s = accountState()
  const known = s.kind === 'signedIn' && s.handle ? s.handle : null
  const nameInput = h('input', { class: 'field-input', type: 'text', maxlength: 24, autocomplete: 'nickname', spellcheck: 'false', enterkeyhint: 'next' })
  const handleInput = h('input', { class: 'field-input', type: 'text', maxlength: 21, autocomplete: 'username', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'done' })
  nameInput.value = s.kind === 'signedIn' ? s.name : ''
  handleInput.value = known ?? ''
  const message = h('p', { class: 'field-message' }, m.handleHint)
  const suggestion = h('button', { class: 'btn hidden', type: 'button' })
  const save = h('button', { class: 'btn confirm', type: 'submit' }, m.save)
  const skip = h('button', { class: 'btn', type: 'button', onclick: () => close(false) }, m.later)
  let busy = false
  let closed = false

  const setMessage = (text: string, error = false) => {
    message.textContent = text
    message.classList.toggle('error', error)
  }

  /** What's wrong with the fields right now, or null. */
  const problem = () => {
    const handle = normalizeHandle(handleInput.value)
    const why = handleProblem(handle)
    if (why) return m.problems[why]
    return parseDisplayName(nameInput.value) ? null : m.problems.name
  }

  const check = () => {
    suggestion.classList.add('hidden')
    const why = handleInput.value.trim() ? problem() : null
    setMessage(why ?? m.handleHint, why !== null)
  }

  const offerSuggestion = (handle: string | null) => {
    suggestion.classList.toggle('hidden', !handle)
    if (!handle) return
    suggestion.textContent = m.useSuggestion(handle)
    suggestion.onclick = () => ((handleInput.value = handle), check(), handleInput.focus())
  }

  const submit = async (e: Event) => {
    e.preventDefault()
    if (busy) return
    const why = problem()
    if (why) return setMessage(why, true)
    busy = true
    save.textContent = m.saving
    const result = await saveProfile({ handle: normalizeHandle(handleInput.value), name: parseDisplayName(nameInput.value)! })
    busy = false
    save.textContent = m.save
    if (closed) return
    if (result.ok) return (playSfx('unlock'), close(true))
    playSfx('hurt')
    if (result.reason === 'taken') return (setMessage(m.problems.taken, true), offerSuggestion(result.suggestion))
    setMessage(result.reason === 'invalid' ? (problem() ?? m.saveFailed) : m.saveFailed, true)
  }

  nameInput.addEventListener('input', check)
  handleInput.addEventListener('input', check)

  const field = (label: string, control: HTMLElement, prefix?: string) =>
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), h('span', { class: 'field-box' }, prefix && h('span', { class: 'field-prefix' }, prefix), control))

  const form = h(
    'form',
    { class: 'dialog box pop profile-editor', novalidate: true, onsubmit: (e: Event) => void submit(e) },
    h('div', { class: 'dialog-title' }, m.editTitle),
    h('p', { class: 'profile-note' }, m.editIntro),
    field(m.name, nameInput),
    field(m.handle, handleInput, '@'),
    message,
    suggestion,
    h('p', { class: 'profile-note small' }, m.publicNote),
    h('div', { class: 'buttons' }, save, skip),
    h('p', { class: 'hint keys-only' }, m.editHintKeys),
  )
  // Inside the fields the game's keys are off (see `createInput`), so Esc is caught here.
  form.addEventListener('keydown', (e) => e.key === 'Escape' && close(false))
  const offKeys = input.onKey((key) => key === 'Escape' && close(false))

  // First profile: suggest a handle from the Google name, unless the player started typing.
  if (!known) {
    void accountRealName().then((real) => {
      if (closed || handleInput.value) return
      handleInput.value = suggestHandle(real || nameInput.value)
      if (!nameInput.value) nameInput.value = parseDisplayName(real) ?? ''
      check()
    })
  }

  const el = h('div', { class: 'screen dim' }, form)
  const dispose = () => (offKeys(), el.remove())

  function close(saved: boolean) {
    if (closed) return
    closed = true
    if (!saved) playSfx('select')
    dispose()
    later(() => onClose(saved))
  }

  root.append(el)
  // A keyboard pops up on its own only where there's a physical one to type with.
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) nameInput.focus()
  return { el, dispose, dim: 0.5 }
}
