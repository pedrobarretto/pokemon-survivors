import { accountState, accountsEnabled, onAccountChange, signIn, syncSave } from '../account'
import { playCry, playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { HATCHLINGS, isHatchling, PLAYABLE, PLAYABLE_IDS, type PlayableId } from '../data/hatchlings'
import { HALLOWEEN } from '../data/halloween'
import { LEGEND_IDS } from '../data/legends'
import { pollOptions, SUPPORTER, type PollKind, type PollOption } from '../data/supporters'
import { pendingPicks, pickShiny, shinyChoices } from '../game/shinyPicks'
import { canWalkWith, companionForm, hallOf, isSupporter, mayVote, parseCode, pollToVote, SUPPORTER_TIERS, supporterCount, voteIn, walksShiny, type Companion, type CompanionId, type SupporterStatus, type SupporterTier, type Wall, type WallEntry } from '../game/supporters'
import { isSpecialCompanion, SPECIAL_COMPANION_IDS } from '../data/companions'
import { brasiliaDay } from '../game/day'
import { pumpkinOfferOpen } from '../game/halloween'
import { formatDay, LOCALES, locale, t } from '../i18n'
import { context2d } from '../engine/pixelart'
import { eggIcon, giftIcon, heartIcon, medalIcon, ogIcon, pokeballIcon, sparkleIcon, supporterIcon } from '../render/art'
import { pumpkinHeartIcon } from '../render/halloweenArt'
import { cryUrl, drawPokemon, hasShiny, loadSpecies, portraitUrl, type SpeciesSprites } from '../render/sprites'
import { ROUTES } from '../site/routes'
import { fetchPoll, fetchSupporterStatus, fetchWall, knownOg, knownStatus, knownTier, linkPatreon, redeemCode, setSupporterPublic, unlinkPatreon, vote } from '../supporters'
import { h, later, rich } from './dom'
import { hatchScene } from './incubator'
import { ogBadge, profileEditor, profileScreen, supporterBadgeIcon } from './profile'
import { loadSave, today, updateSave } from './save'
import { hint, menu, type Screen } from './screens'
import { actionBar, backButton, shellBody, topBar } from './shell'
import { toast } from './toasts'

/**
 * Apoiadores: what donating brings, the way to the support page, and what a
 * supporter can do with it (pick their shiny, a companion, vote, show their
 * badge). Rewards need an account: the support page takes the player's
 * handle, a code redeems a donation made without one, and a linked Patreon
 * sets the tier by its monthly pledge (Gold and Diamond come only from it).
 */

type Action = { label: string; run: () => void }

/** A screen the Hall opens straight onto (`supportersScreen`): the shiny picker or a poll. */
export type HallOpen = 'pick' | { poll: PollKind }

/** A date of the account's history, in the current language (`14/10/2026`). */
const longDay = (iso: string) => new Date(iso).toLocaleDateString(LOCALES[locale()].tag, { day: '2-digit', month: '2-digit', year: 'numeric' })

/** The support page, carrying the player's handle so the donation goes to their account. */
const supportUrl = () => {
  const s = accountState()
  const handle = s.kind === 'signedIn' ? s.handle : null
  return `${ROUTES.support[locale()]}${handle ? `?u=${encodeURIComponent(handle)}` : ''}`
}

/* ---------------- Spatial navigation ---------------- */

/**
 * Arrow keys over items laid out in rows (a grid of portraits and the buttons
 * under it): ← → step through the list, ↑ ↓ jump to the nearest item in the
 * row above or below, as laid out right now. Enter or Space picks.
 */
const spatialNav = (input: Input, items: HTMLElement[], activate: (i: number) => void, initial = 0) => {
  let index = Math.min(initial, items.length - 1)
  const focus = (i: number, sound = true) => {
    index = (i + items.length) % items.length
    items.forEach((el, j) => el.classList.toggle('selected', j === index))
    items[index]?.scrollIntoView({ block: 'nearest' })
    if (sound) playSfx('move')
  }
  const vertical = (dir: 1 | -1) => {
    const from = items[index]?.getBoundingClientRect()
    if (!from) return
    let best = -1
    let score = Infinity
    items.forEach((el, i) => {
      const r = el.getBoundingClientRect()
      const dy = (r.top - from.top) * dir
      if (dy <= 2) return
      const s = dy * 1000 + Math.abs(r.left + r.width / 2 - (from.left + from.width / 2))
      if (s < score) [score, best] = [s, i]
    })
    if (best >= 0) focus(best)
  }
  items.forEach((el, i) => el.addEventListener('click', () => (focus(i, false), activate(i))))
  focus(index, false)
  const off = input.onKey((key) => {
    if (key === 'ArrowLeft' || key === 'KeyA') focus(index - 1)
    else if (key === 'ArrowRight' || key === 'KeyD') focus(index + 1)
    else if (key === 'ArrowUp' || key === 'KeyW') vertical(-1)
    else if (key === 'ArrowDown' || key === 'KeyS') vertical(1)
    else if (key === 'Enter' || key === 'Space') activate(index)
  })
  return { off, focus, get index() { return index } }
}

/* ---------------- Pokémon grid ---------------- */

type Cell = { id: CompanionId | null; shiny: boolean }

/** A portrait to tap in a picker: the family's first stage (or a gift-only companion), a Poké Ball for "none". */
const cellButton = (c: Cell, extra: Node | null = null) => {
  const form = c.id ? companionForm(c.id) : null
  const name = form ? form.name : t().supporters.companionNone
  return h(
    'button',
    { class: 'pick-cell', type: 'button', title: name, 'aria-label': name },
    h('img', { src: form ? portraitUrl(form.dex, c.shiny) : pokeballIcon(), alt: '' }),
    extra,
  )
}

/**
 * A dialog to pick one Pokémon: sections of portraits and the footer's
 * buttons, under one spatial navigation. `pick` runs on a portrait; the
 * footer's actions run on their buttons. Returns the dialog's parts to redraw.
 */
const pickerDialog = (
  input: Input,
  opts: { title: string; intro: string; sections: { label: string; cells: { cell: Cell; el: HTMLElement }[] }[]; footer: Action[]; pick: (c: Cell) => void; initial?: number },
) => {
  const cells = opts.sections.flatMap((s) => s.cells)
  const buttons = opts.footer.map((a) => h('button', { class: 'btn' }, a.label))
  const items = [...cells.map((c) => c.el), ...buttons]
  const nav = spatialNav(input, items, (i) => {
    const cell = cells[i]
    if (cell) return (playSfx('select'), opts.pick(cell.cell))
    playSfx('select')
    later(opts.footer[i - cells.length]!.run)
  }, opts.initial)
  const box = h(
    'div',
    { class: 'dialog box pop supporters picker' },
    h('div', { class: 'dialog-title' }, opts.title),
    h('p', { class: 'account-line' }, opts.intro),
    h('div', { class: 'pick-scroll' }, ...opts.sections.flatMap((s) => (s.cells.length > 0 ? [h('h3', { class: 'pick-label' }, s.label), h('div', { class: 'pick-grid' }, ...s.cells.map((c) => c.el))] : []))),
    h('div', { class: 'buttons' }, ...buttons),
    hint(t().supporters.gridHintKeys, t().supporters.hintTouch),
  )
  return { box, nav, buttons }
}

/* ---------------- Sub-screens ---------------- */

type Back = () => void

/** A screen with its own keys that closes on Esc or Backspace, calling `back` after the key dispatch. */
const overlay = (root: HTMLElement, input: Input, back: Back) => {
  const el = h('div', { class: 'screen dim' })
  let off: (() => void) | null = null
  let closed = false
  const dispose = () => (off?.(), offKeys(), el.remove())
  const close = () => {
    if (closed) return
    closed = true
    playSfx('select')
    dispose()
    later(back)
  }
  const offKeys = input.onKey((key) => (key === 'Escape' || key === 'Backspace') && close())
  root.append(el)
  return { el, close, dispose, setNav: (next: () => void) => (off?.(), (off = next)) }
}

/**
 * "Shiny à sua escolha": every Pokémon the ticket can become, starters then
 * egg families. Picking one spends the oldest ticket: an egg family plays its
 * hatching scene (shiny), a starter shows its shiny portrait.
 */
const shinyPicker = (root: HTMLElement, input: Input, actions: { play: (id: PlayableId) => void }, back: Back): Screen => {
  const m = t().supporters
  const o = overlay(root, input, back)
  let picked: PlayableId | null = null
  let sub: Screen | null = null

  const reveal = (id: PlayableId) => {
    const def = PLAYABLE[id]
    playSfx('shiny')
    playCry(cryUrl(def.line[0].dex), 0.5)
    const buttons = [h('button', { class: 'btn' }, m.play(def.name)), h('button', { class: 'btn' }, m.ok)]
    const nav = menu(input, buttons, (i) => (playSfx('select'), later(i === 0 ? () => (o.dispose(), actions.play(id)) : o.close)), { horizontal: true })
    o.setNav(nav.off)
    o.el.replaceChildren(
      h(
        'div',
        { class: 'dialog box pop supporters pick-reveal' },
        h('div', { class: 'portrait-wrap' }, h('img', { class: 'result-portrait', src: portraitUrl(def.line[0].dex, true), alt: '' }), h('img', { class: 'shiny-badge', src: sparkleIcon(), alt: 'Shiny' })),
        h('p', { class: 'hatch-text' }, rich(m.picked(def.line[0].name)), h('small', {}, m.pickedNote)),
        h('div', { class: 'buttons' }, ...buttons),
      ),
    )
  }

  const confirm = () => {
    const ticket = pendingPicks(loadSave())[0]
    const id = picked
    if (!ticket || !id) return
    const next = pickShiny(loadSave(), ticket.id, id)
    if (!next) return
    updateSave(() => next)
    void syncSave()
    if (!isHatchling(id)) return reveal(id)
    // An egg family hatches for it, shiny, like the Mystery Gift's shiny hatch. The picker goes away (keys included) while it plays.
    o.dispose()
    sub = hatchScene(root, input, { id, tier: HATCHLINGS[id].egg, shiny: true, duplicate: false, refund: 0, guaranteed: false }, { play: () => (sub?.dispose(), actions.play(id)), done: () => (sub?.dispose(), later(back)) })
  }

  const draw = (initial = 0) => {
    const save = loadSave()
    const choices = shinyChoices(save)
    const section = (ids: PlayableId[]) =>
      ids.map((id) => {
        const el = cellButton({ id, shiny: true }, isHatchling(id) && !save.hatched[id] ? h('img', { class: 'pick-egg', src: eggIcon(HATCHLINGS[id].egg), alt: '' }) : null)
        el.classList.toggle('picked', id === picked)
        return { cell: { id, shiny: true }, el }
      })
    const footer: Action[] = [
      ...(choices.length > 0 ? [{ label: picked ? m.pickConfirm(PLAYABLE[picked].line[0].name) : m.pickNone, run: () => (picked ? confirm() : undefined) }] : []),
      { label: m.back, run: o.close },
    ]
    const { box, nav, buttons } = pickerDialog(input, {
      title: m.pickTitle,
      intro: choices.length > 0 ? m.pickIntro : m.allShiny,
      sections: [
        { label: m.starters, cells: section(choices.filter((id) => !isHatchling(id))) },
        { label: m.eggs, cells: section(choices.filter(isHatchling)) },
      ],
      footer,
      pick: (c) => {
        picked = c.id && !isSpecialCompanion(c.id) ? c.id : null
        // Back on the confirm button, so Enter twice picks.
        draw(choices.length)
      },
      initial,
    })
    if (choices.length > 0) buttons[0]!.classList.toggle('confirm', picked !== null)
    o.setNav(nav.off)
    o.el.replaceChildren(box)
  }

  draw()
  // The hatching scene animates on the frame's tick, passed down from whoever shows the picker.
  return { el: o.el, tick: (time) => sub?.tick?.(time), dispose: () => (sub?.dispose(), o.dispose()), dim: 0.5 }
}

/** Whether the companion picked may walk shiny (a shiny owned, or Pumpkaboo for Gold and up: `walksShiny`). */
const companionShiny = (save: ReturnType<typeof loadSave>, id: CompanionId | null, tier: SupporterTier | null) => id !== null && walksShiny(save, id, tier)

/**
 * The companion: any Pokémon the save can play (shiny if owned so), the
 * gift-only ones it got first (Pumpkaboo shiny for Gold), or none; and for
 * Diamond, a section of the legends the save captured (shiny if caught so).
 * `tier` is the account's (`knownTier`).
 */
const companionPicker = (root: HTMLElement, input: Input, tier: SupporterTier | null, back: Back): Screen => {
  const m = t().supporters
  const o = overlay(root, input, back)
  const now = loadSave().companion
  let picked: CompanionId | null = now?.id ?? null
  let shiny = now?.shiny ?? false

  const draw = (initial?: number) => {
    const save = loadSave()
    const walks = (id: CompanionId) => canWalkWith(save, { id, shiny: false }, tier)
    const cellOf = (id: CompanionId | null) => {
      const el = cellButton({ id, shiny: id !== null && id === picked && shiny })
      el.classList.toggle('picked', id === picked)
      return { cell: { id, shiny: false }, el }
    }
    const regular = [null, ...[...SPECIAL_COMPANION_IDS, ...PLAYABLE_IDS].filter(walks)].map(cellOf)
    const legends = LEGEND_IDS.filter(walks).map(cellOf)
    const cells = [...regular, ...legends]
    const canShiny = companionShiny(save, picked, tier)
    const footer: Action[] = [
      ...(canShiny ? [{ label: m.companionShiny(shiny), run: () => ((shiny = !shiny), draw(cells.length)) }] : []),
      {
        label: m.companionSave,
        run: () => {
          const companion = picked ? { id: picked, shiny: shiny && canShiny } : null
          updateSave((s) => ({ ...s, companion }))
          void syncSave()
          toast(root, companion ? m.companionSaved(companionForm(companion.id).name) : m.companionOff, 2200)
          o.close()
        },
      },
      { label: m.back, run: o.close },
    ]
    const { box, nav } = pickerDialog(input, {
      title: m.companionTitle,
      intro: m.companionIntro,
      sections: [
        { label: '', cells: regular },
        { label: m.companionLegends, cells: legends },
      ],
      footer,
      pick: (c) => {
        picked = c.id
        shiny = companionShiny(loadSave(), picked, tier) && shiny
        draw(cells.length)
      },
      initial: initial ?? Math.max(0, cells.findIndex((c) => c.cell.id === picked)),
    })
    o.setNav(nav.off)
    o.el.replaceChildren(box)
  }

  draw()
  return { el: o.el, dispose: o.dispose, dim: 0.5 }
}

/**
 * A poll: each option's votes; whoever may vote taps one (and may change it),
 * anyone else sees them. `supporters` is the next egg family's, any
 * supporter's; `diamond` Diamond's monthly ultra-rare (`DIAMOND_POLL`). It
 * reads the standing on its own (the device's, then the API's, again when the
 * account changes), so a link can open it before the account has loaded.
 */
const pollScreen = <K extends PollKind>(root: HTMLElement, input: Input, kind: K, back: Back): Screen => {
  const m = t().supporters
  const o = overlay(root, input, back)
  const options = pollOptions(kind)
  const words = kind === 'diamond' ? { title: m.diamondPoll.title, intro: m.diamondPoll.intro, voteOnly: m.diamondPoll.voteOnly } : { title: m.pollTitle, intro: m.pollIntro, voteOnly: m.voteOnly }
  let mine = knownStatus()
  let choice = options.find((p) => p.id === voteIn(mine, kind))?.id ?? null
  /** The votes per option, null until the API gave them. */
  let votes: Record<PollOption<K>, number> | null = null

  const frame = (body: Node[], rows: { el: HTMLElement; run: () => void }[]) => {
    const backButton = h('button', { class: 'btn' }, m.back)
    const all = [...rows, { el: backButton, run: o.close }]
    const nav = menu(input, all.map((r) => r.el), (i) => (playSfx('select'), later(all[i]!.run)), { initial: Math.max(0, options.findIndex((p) => p.id === choice)) })
    o.setNav(nav.off)
    o.el.replaceChildren(
      h('div', { class: `dialog box pop supporters${kind === 'diamond' ? ' diamond' : ''}` }, h('div', { class: 'dialog-title' }, words.title), h('p', { class: 'account-line' }, words.intro), ...body, h('div', { class: 'buttons' }, backButton), hint(m.hintKeys, m.hintTouch)),
    )
  }

  const show = () => {
    const canVote = mayVote(mine, kind)
    const total = votes ? Math.max(1, options.reduce((sum, p) => sum + (votes?.[p.id] ?? 0), 0)) : 1
    const rows = options.map((p) => {
      const n = votes?.[p.id] ?? 0
      const el = h(
        'button',
        { class: p.id === choice ? 'poll-row mine' : 'poll-row', type: 'button', disabled: !canVote },
        h('img', { src: portraitUrl(p.dex), alt: '' }),
        h('span', { class: 'poll-name' }, p.name, p.id === choice && h('span', { class: 'tag tag-new' }, m.yourVote)),
        h('span', { class: 'progress' }, h('span', { style: `width:${Math.round((n / total) * 100)}%` })),
        h('small', {}, votes ? m.votes(n) : '—'),
      )
      return {
        el,
        run: async () => {
          if (!canVote) return
          const next = await vote(kind, p.id)
          if (!next || next === 'denied') return toast(root, m.offline, 2200)
          choice = p.id
          votes = next.votes
          playSfx('unlock')
          toast(root, m.voted(p.name), 2000)
          show()
        },
      }
    })
    frame([...(canVote ? [] : [h('p', { class: 'account-line account-note' }, words.voteOnly)]), h('div', { class: 'poll-rows' }, ...rows.map((r) => r.el))], canVote ? rows : [])
  }

  /** The API's word on the standing: who may vote and for what they did. */
  const loadMine = () => {
    if (accountState().kind !== 'signedIn') return
    void fetchSupporterStatus().then((next) => {
      if (!next || !o.el.isConnected) return
      mine = next
      choice = options.find((p) => p.id === voteIn(mine, kind))?.id ?? null
      show()
    })
  }
  // Signed in after the screen opened (a link at boot, before the account loads): ask again. Leaves with the screen.
  const offAccount = onAccountChange(() => (o.el.isConnected ? loadMine() : offAccount()))

  show()
  loadMine()
  void fetchPoll(kind).then((p) => {
    if (!o.el.isConnected) return
    if (!p) return toast(root, m.offline, 2200)
    votes = p.votes
    show()
  })
  return { el: o.el, dispose: () => (offAccount(), o.dispose()), dim: 0.5 }
}

/** Redeems a donation's code for the signed-in account. `redeemed` runs once one goes through. */
const codeScreen = (root: HTMLElement, input: Input, redeemed: () => void, back: Back): Screen => {
  const m = t().supporters
  const field = h('input', { class: 'field-input', type: 'text', maxlength: 14, autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false', placeholder: 'PS-XXXX-XXXX', enterkeyhint: 'done' })
  const message = h('p', { class: 'field-message' }, m.codeIntro)
  const submit = h('button', { class: 'btn confirm', type: 'submit' }, m.redeem)
  const cancel = h('button', { class: 'btn', type: 'button' }, m.back)
  let busy = false
  const say = (text: string, error = false) => {
    message.textContent = text
    message.classList.toggle('error', error)
  }
  const form = h(
    'form',
    {
      class: 'dialog box pop supporters',
      novalidate: true,
      onsubmit: async (e: Event) => {
        e.preventDefault()
        if (busy) return
        const code = parseCode(field.value)
        if (!code) return (playSfx('hurt'), say(m.codeErrors.format, true))
        busy = true
        submit.textContent = m.redeeming
        const result = await redeemCode(code)
        busy = false
        submit.textContent = m.redeem
        if (!result.ok) return (playSfx('hurt'), say(m.codeErrors[result.reason], true))
        playSfx('unlock')
        say(m.redeemed)
        field.value = ''
        void syncSave()
        redeemed()
      },
    },
    h('div', { class: 'dialog-title' }, m.codeTitle),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, m.codeField), h('span', { class: 'field-box' }, field)),
    message,
    h('div', { class: 'buttons' }, submit, cancel),
  )
  const el = h('div', { class: 'screen dim' }, form)
  let closed = false
  const dispose = () => (offKeys(), el.remove())
  const close = () => {
    if (closed) return
    closed = true
    playSfx('select')
    dispose()
    later(back)
  }
  cancel.addEventListener('click', close)
  // Inside the field the game's keys are off (see `createInput`), so Esc is caught here.
  form.addEventListener('keydown', (e) => e.key === 'Escape' && close())
  const offKeys = input.onKey((key) => key === 'Escape' && close())
  root.append(el)
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) field.focus()
  return { el, dispose, dim: 0.5 }
}

/* ---------------- Hall da Fama ---------------- */

/** The final stage of a supporter's Pokémon (like the Trainer chip), shiny only if it has a shiny sprite; null for an API from before the Hall. */
export const hallFace = (p: Companion | null) => {
  if (!p) return null
  if (isSpecialCompanion(p.id)) {
    const dex = companionForm(p.id).dex
    return { dex, shiny: p.shiny && hasShiny(dex) }
  }
  const dex = PLAYABLE[p.id].line[PLAYABLE[p.id].line.length - 1]!.dex
  return { dex, shiny: p.shiny && hasShiny(dex) }
}

type Face = NonNullable<ReturnType<typeof hallFace>>

/**
 * A supporter's portrait for a round avatar: a Poké Ball wobbles in its
 * place while it downloads, a shiny that won't load wears the normal colors,
 * and a portrait that never comes leaves the Poké Ball resting.
 */
export const hallPortrait = (face: Face) => {
  const img = h('img', { class: 'ball wobble', src: pokeballIcon(), alt: '' })
  const urls = [...new Set([portraitUrl(face.dex, face.shiny), portraitUrl(face.dex)])]
  const next = () => {
    const url = urls.shift()
    if (!url) return void img.classList.remove('wobble')
    const probe = new Image()
    probe.onload = () => ((img.src = url), img.classList.remove('ball', 'wobble'))
    probe.onerror = next
    probe.src = url
  }
  next()
  return img
}

/**
 * A Lenda (Gold or Diamond): their Pokémon idling on a pedestal under a
 * spotlight, name, @handle and equipped title; Diamond's card, pedestal and
 * light are ice-blue, with the faceted heart in a corner, and an OG wears its
 * plate (`ogIcon`). A Poké Ball wobbles on the pedestal while the sheets download (and
 * rests there if they never come); then `draw` animates the sprite on the
 * frame's tick.
 */
const legendCard = (e: WallEntry) => {
  const face = hallFace(e.pokemon)
  const canvas = h('canvas', { class: 'legend-sprite', width: 96, height: 88 })
  const ball = h('img', { class: `legend-ball${face ? ' wobble' : ''}`, src: pokeballIcon(), alt: '' })
  let sprites: SpeciesSprites | null = null
  if (face)
    void loadSpecies(face.dex, face.shiny)
      .catch(() => loadSpecies(face.dex))
      .then(
        (loaded) => ((sprites = loaded), ball.replaceWith(canvas)),
        () => ball.classList.remove('wobble'),
      )
  const el = h(
    'button',
    { class: `legend-card ${e.tier}`, type: 'button', 'aria-label': `${e.name} @${e.handle}` },
    h('span', { class: 'legend-beam', 'aria-hidden': 'true' }),
    e.tier === 'diamond' && h('img', { class: 'legend-gem', src: supporterIcon('diamond'), alt: t().supporters.badge('diamond') }),
    e.og && ogBadge('hall-og-tag'),
    h('img', { class: 'legend-spark one', src: sparkleIcon(), alt: '' }),
    h('img', { class: 'legend-spark two', src: sparkleIcon(), alt: '' }),
    h('span', { class: 'legend-stage' }, ball, h('span', { class: 'legend-pedestal' })),
    h('b', { class: 'legend-name' }, e.name),
    h('small', { class: 'legend-handle' }, `@${e.handle}`),
    e.title && h('em', { class: 'legend-card-title' }, t().achievements.titles[e.title]),
  )
  const draw = (time: number) => {
    if (!sprites) return
    const ctx = context2d(canvas)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    // Small Pokémon get doubled (whole pixels), like the Pokédex; big ones stay 1:1.
    drawPokemon(ctx, sprites, 'Idle', 0, time, canvas.width / 2, canvas.height - 6, { scale: sprites.bodyH * 2 <= canvas.height - 24 ? 2 : 1 })
  }
  return { el, draw }
}

/** A supporter's chip: avatar, name, @handle, ♥ and the OG plate (phones keep the avatar, name and plate). */
const fanChip = (e: WallEntry) => {
  const face = hallFace(e.pokemon)
  return h(
    'button',
    { class: `fan-chip ${e.tier}`, type: 'button', 'aria-label': `${e.name} @${e.handle}` },
    h('span', { class: 'fan-avatar' }, face ? hallPortrait(face) : h('img', { src: pokeballIcon(), class: 'ball', alt: '' })),
    h('span', { class: 'fan-who' }, h('b', {}, e.name), h('small', {}, `@${e.handle}`)),
    h('img', { class: 'fan-heart', src: supporterBadgeIcon(e.tier, e.since), alt: '' }),
    e.og && ogBadge('hall-og-tag'),
  )
}

/**
 * The legends' strip: a row on wide screens (it scrolls sideways when they
 * don't fit), a swipeable carousel with dots on phones. The card nearest the
 * middle is `centered` (lit on phones) and its dot is on.
 */
const legendStrip = (cards: HTMLElement[]) => {
  const strip = h('div', { class: 'legend-strip' }, ...cards)
  const dots = cards.map(() => h('i', {}))
  const mark = () => {
    const mid = strip.scrollLeft + strip.clientWidth / 2
    let best = 0
    cards.forEach((c, i) => Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid) < Math.abs(cards[best]!.offsetLeft + cards[best]!.offsetWidth / 2 - mid) && (best = i))
    cards.forEach((c, i) => (c.classList.toggle('centered', i === best), dots[i]!.classList.toggle('on', i === best)))
  }
  strip.addEventListener('scroll', mark, { passive: true })
  // Laid out on the next frame: then the first card is the centered one.
  requestAnimationFrame(mark)
  return [strip, cards.length > 1 ? h('div', { class: 'hall-dots', 'aria-hidden': 'true' }, ...dots) : null]
}

/**
 * The OG Supporters: everyone who supported the game before the Patreon
 * tiers (the wall's `og`), in the order they came, as chips in a scrolling
 * grid (Gold ones ringed in gold). A tap opens their profile (`open`).
 */
const ogScreen = (root: HTMLElement, input: Input, entries: readonly WallEntry[], open: (handle: string) => void, back: Back): Screen => {
  const m = t().supporters
  const o = overlay(root, input, back)
  const chips = entries.map((e) => ({ e, el: fanChip(e) }))
  const backButton = h('button', { class: 'btn' }, m.back)
  const items = [...chips.map((c) => c.el), backButton]
  const nav = spatialNav(input, items, (i) => {
    playSfx('select')
    const chip = chips[i]
    later(chip ? () => (o.dispose(), open(chip.e.handle)) : o.close)
  })
  o.setNav(nav.off)
  o.el.replaceChildren(
    h(
      'div',
      { class: 'dialog box pop supporters picker og-list' },
      h('div', { class: 'dialog-title' }, m.og.title),
      h('p', { class: 'account-line' }, m.og.intro),
      h('div', { class: 'pick-scroll' }, h('div', { class: 'fan-grid' }, ...chips.map((c) => c.el))),
      h('div', { class: 'buttons' }, backButton),
      hint(m.gridHintKeys, m.hintTouch),
    ),
  )
  return { el: o.el, dispose: o.dispose, dim: 0.5 }
}

/** One perk of the call to action: an icon over a short label. A `run` makes it a button (a supporter's actions). */
type Tile = { icon: string; label: string; title?: string; run?: () => void; glow?: boolean }

const tileEl = (tile: Tile) =>
  h(
    tile.run ? 'button' : 'span',
    { class: `hall-tile${tile.glow ? ' glow' : ''}`, ...(tile.run ? { type: 'button' } : {}), title: tile.title ?? tile.label },
    h('img', { src: tile.icon, alt: '' }),
    h('small', {}, tile.label),
  )

export type SupportersActions = {
  /** Starts a run with a Pokémon just picked shiny. */
  play: (id: PlayableId) => void
  onClose: () => void
}

/**
 * The Hall da Fama (the lobby's Hall card, the Trainer Card's supporter
 * row): the Lendas (Diamond, then Gold) on
 * pedestals, the other supporters as chips (a tap opens their profile), the
 * OG Supporters behind their button, and
 * the call to action with the cosmetic perks and "Apoiar" (the support page
 * in a new tab, with the player's handle). A supporter's perks become their
 * actions there: pick their shiny (one per ticket), the companion, the poll (and Diamond's),
 * a code, show or hide themselves; anyone else gets the poll, a code and
 * sign in as links. Everyone sees Diamond's poll; only Diamond votes there. Signed in, both get Link Patreon (or Unlink) while the API has it. Wide screens put the call to action in a column on the
 * right; phones in a footer. `open` goes straight to a screen: `'pick'` the
 * shiny picker while a ticket waits (the lobby's Hall card sparkles then),
 * `{ poll }` that poll (the Hall card's call to vote, the `?votar` link).
 */
export const supportersScreen = (root: HTMLElement, input: Input, actions: SupportersActions, open: HallOpen | null = null): Screen => {
  const el = h('div', { class: 'screen shell hall-screen', style: `--sparkle:url(${sparkleIcon()})` })
  let nav: ReturnType<typeof spatialNav> | null = null
  /** How many buttons `nav` walks. */
  let navCount = 0
  let sub: Screen | null = null
  /** The account's standing: undefined while it loads, null when the API can't say. */
  let status: SupporterStatus | null | undefined
  /** The wall: undefined while it loads, null offline. */
  let wall: Wall | null | undefined
  let legends: ReturnType<typeof legendCard>[] = []
  let closed = false

  const openSub = (make: (back: Back) => Screen) => {
    nav?.off()
    nav = null
    el.classList.add('hidden')
    sub = make(() => {
      sub = null
      el.classList.remove('hidden')
      build()
    })
  }

  const loadStatus = () => {
    const s = accountState()
    if (s.kind !== 'signedIn') return void (status = null)
    status = undefined
    void fetchSupporterStatus().then((next) => {
      status = next
      if (!closed) build()
    })
  }

  const profile = (handle: string) => openSub((back) => profileScreen(root, input, handle, back))
  // A vote changes the standing kept on the device: the Hall picks it up on the way back.
  const poll = (kind: PollKind) => openSub((back) => pollScreen(root, input, kind, () => ((status = status && (knownStatus() ?? status)), back())))
  const picker = () => openSub((back) => shinyPicker(root, input, { play: (id) => (dispose(), actions.play(id)) }, back))

  /** The tier the top bar's chip shows: the API's word once it came, the save's until then. */
  const myTier = () => (accountState().kind !== 'signedIn' ? null : status === undefined || status === null ? knownTier(loadSave()) : status.tier)

  /** The account's line in the call to action, for anyone who isn't a supporter yet. */
  const standing = (): string | null => {
    const m = t().supporters
    const s = accountState()
    if (!accountsEnabled) return null
    if (s.kind !== 'signedIn') return m.guest
    if (s.handle === null) return m.noHandle
    if (status === undefined) return m.loading
    return status === null && isSupporter(loadSave()) ? m.offline : m.none
  }

  /** The call to action: the perks (a supporter's actions), the links and "Apoiar". Returns it and its buttons in order. */
  const cta = () => {
    const m = t().supporters
    const s = accountState()
    const save = loadSave()
    const signedIn = s.kind === 'signedIn'
    const tier = myTier()
    const pending = pendingPicks(save).length
    const toVote = pollToVote(status ?? knownStatus())
    const code = () => openSub((back) => codeScreen(root, input, loadStatus, back))
    const tiles: Tile[] = tier
      ? [
          ...(pending > 0 ? [{ icon: sparkleIcon(), label: m.perks.shiny, title: m.pick(pending), run: picker, glow: true }] : []),
          { icon: eggIcon('friend'), label: m.perks.companion, title: m.companion, run: () => openSub((back) => companionPicker(root, input, tier, back)) },
          { icon: giftIcon(), label: m.perks.vote, title: m.vote, run: () => poll('supporters'), glow: pending === 0 && toVote === 'supporters' },
          { icon: supporterIcon('diamond'), label: m.diamondPoll.tile, title: m.diamondPoll.title, run: () => poll('diamond'), glow: pending === 0 && toVote === 'diamond' },
          { icon: pokeballIcon(), label: m.codeShort, title: m.code, run: code },
          {
            icon: heartIcon(),
            label: m.shown(status?.public !== false),
            title: m.show(status?.public !== false),
            run: async () => {
              const next = await setSupporterPublic(!status?.public)
              if (!next) return toast(root, m.offline, 2200)
              status = next
              build()
            },
          },
        ]
      : [
          ...(pumpkinOfferOpen(brasiliaDay(today())) ? [{ icon: pumpkinHeartIcon('supporter'), label: t().halloween.perk, title: t().halloween.perkTitle(formatDay(HALLOWEEN.to)) }] : []),
          { icon: supporterIcon('gold'), label: m.perks.title },
          { icon: medalIcon('gold'), label: m.perks.frame },
          { icon: sparkleIcon(), label: m.perks.shiny },
          { icon: eggIcon('friend'), label: m.perks.companion },
          { icon: giftIcon(), label: m.perks.vote },
        ]
    // Only once the API said it has Patreon (`patreon` not null), for the account it answered about.
    const patreon: Action[] =
      signedIn && status && status.patreon !== null
        ? [
            status.patreon
              ? {
                  label: m.patreon.unlink,
                  run: async () => {
                    if (!(await unlinkPatreon())) return toast(root, m.offline, 2200)
                    toast(root, m.patreon.unlinked, 2200)
                    loadStatus()
                  },
                }
              : { label: m.patreon.link, run: async () => void ((await linkPatreon()) || toast(root, m.offline, 2200)) },
          ]
        : []
    const links: Action[] = tier
      ? patreon
      : [
          ...(accountsEnabled && s.kind === 'guest' ? [{ label: m.signIn, run: () => void signIn() }] : []),
          ...(signedIn && s.handle === null ? [{ label: m.createProfile, run: () => openSub((back) => profileEditor(root, input, () => back())) }] : []),
          { label: m.vote, run: () => poll('supporters') },
          { label: m.diamondPoll.link, run: () => poll('diamond') },
          ...(signedIn ? [{ label: m.code, run: code }] : []),
          ...patreon,
        ]
    const tileEls = tiles.map(tileEl)
    const linkEls = links.map((a) => h('button', { class: 'hall-link', type: 'button' }, a.label))
    const support = h('button', { class: 'hall-support', type: 'button' }, h('span', {}, m.donate), h('img', { src: heartIcon(), alt: '' }))
    const note = tier && status?.since ? h('p', { class: 'hall-cta-note since' }, h('img', { src: supporterBadgeIcon(tier, status.since), alt: '' }), rich(m.since(tier, longDay(status.since)))) : null
    const line = tier ? null : standing()
    const el = actionBar(
      h('h3', { class: 'hall-cta-title' }, tier ? m.yours : m.join),
      note ?? h('p', { class: 'hall-cta-note' }, m.cosmetic),
      h('div', { class: 'hall-tiles' }, ...tileEls),
      line !== null && h('p', { class: `hall-cta-line${status === undefined && line === m.loading ? ' blink' : ''}` }, line),
      linkEls.length > 0 && h('div', { class: 'hall-links' }, ...linkEls),
      tier ? null : h('p', { class: 'hall-cta-gold' }, rich(m.gold)),
      support,
    )
    el.classList.add('hall-cta')
    const buttons = [
      ...tiles.flatMap((tile, i) => (tile.run ? [{ el: tileEls[i]!, run: tile.run }] : [])),
      ...links.map((a, i) => ({ el: linkEls[i]!, run: a.run })),
      { el: support, run: () => void window.open(supportUrl(), '_blank', 'noopener') },
    ]
    return { el, buttons }
  }

  /**
   * The Lendas (Diamond, then Gold) and the supporters, with the way to the
   * OG Supporters by the supporters' label, or why they aren't here. Returns
   * the sections and their buttons in order.
   */
  const hall = () => {
    const m = t().supporters
    const sections: Node[] = [h('p', { class: 'hall-lead' }, m.lead)]
    const buttons: { el: HTMLElement; run: () => void }[] = []
    legends = []
    if (wall === undefined || wall === null) return { sections: [...sections, h('p', { class: `hall-note${wall === undefined ? ' blink' : ''}` }, wall === undefined ? m.loading : m.offline)], buttons }
    const split = hallOf(wall.entries)
    legends = split.legends.map(legendCard)
    const empty = h('div', { class: 'legend-card empty' }, h('span', { class: 'legend-stage' }, h('span', { class: 'legend-pedestal' })), h('b', { class: 'legend-name' }, m.firstLegend))
    sections.push(
      h(
        'section',
        { class: 'hall-legends' },
        h('h3', { class: 'hall-label gold' }, `${m.legends} · ${m.goldFrom}`),
        ...(legends.length > 0 ? legendStrip(legends.map((c) => c.el)) : [h('div', { class: 'legend-strip' }, empty)]),
      ),
    )
    const fans = split.supporters.map((e) => ({ e, el: fanChip(e) }))
    const og = split.og
    const ogButton = og.length > 0 ? h('button', { class: 'hall-og', type: 'button', title: m.og.title }, h('img', { src: ogIcon(), alt: '' }), h('span', {}, m.og.button(og.length))) : null
    const off = wall.hidden
    const hidden = SUPPORTER_TIERS.reduce((n, tier) => n + off[tier], 0)
    sections.push(
      h(
        'section',
        { class: 'hall-fans' },
        h('div', { class: 'hall-head' }, h('h3', { class: 'hall-label pink' }, m.fans(split.supporters.length + wall.hidden.supporter)), ogButton),
        fans.length > 0 ? h('div', { class: 'fan-grid' }, ...fans.map((f) => f.el)) : h('p', { class: 'hall-note' }, m.wallEmpty),
        // Supporters who chose to stay off the wall still count: the Hall says so, without naming them.
        ...(hidden > 0 ? [h('p', { class: 'hall-note' }, m.offWall(supporterCount(wall)))] : []),
      ),
    )
    buttons.push(
      ...split.legends.map((e, i) => ({ el: legends[i]!.el, run: () => profile(e.handle) })),
      ...(ogButton ? [{ el: ogButton, run: () => openSub((back) => ogScreen(root, input, og, profile, back)) }] : []),
      ...fans.map((f) => ({ el: f.el, run: () => profile(f.e.handle) })),
    )
    return { sections, buttons }
  }

  const build = () => {
    if (sub || closed) return
    const m = t().supporters
    const tier = myTier()
    const body = hall()
    const call = cta()
    const all = [...body.buttons, ...call.buttons]
    // The highlight stays put on a rebuild, unless buttons came or went (the Patreon link once the standing loads).
    const at = all.length === navCount ? nav?.index : undefined
    navCount = all.length
    nav?.off()
    // The highlight starts on "Apoiar", or on the shiny while a ticket waits.
    const start = call.buttons.findIndex((b) => b.el.classList.contains('glow'))
    nav = spatialNav(input, all.map((b) => b.el), (i) => (playSfx('select'), later(all[i]!.run)), at ?? body.buttons.length + (start >= 0 ? start : call.buttons.length - 1))
    const you =
      tier &&
      h(
        'span',
        { class: `shell-chip hall-you ${tier}`, title: m.you(tier) },
        h('img', { src: supporterBadgeIcon(tier, status?.since), alt: '' }),
        (status ? status.og : knownOg()) && ogBadge('og'),
        h('span', {}, m.you(tier)),
      )
    el.replaceChildren(topBar({ left: backButton(close), title: m.title, right: [you] }), shellBody(...body.sections), call.el)
  }

  const offState = onAccountChange(() => (loadStatus(), build()))
  const offKeys = input.onKey((key) => !sub && (key === 'Escape' || key === 'Backspace') && close())

  function dispose() {
    closed = true
    sub?.dispose()
    nav?.off()
    offState()
    offKeys()
    el.remove()
  }

  function close() {
    if (closed) return
    playSfx('select')
    dispose()
    later(actions.onClose)
  }

  root.append(el)
  loadStatus()
  build()
  void fetchWall().then((next) => {
    wall = next
    // The lists moved under the highlight: it starts over.
    nav?.off()
    nav = null
    if (!closed) build()
  })
  if (open === 'pick' && pendingPicks(loadSave()).length > 0) picker()
  else if (open !== null && open !== 'pick') poll(open.poll)
  const tick = (time: number) => {
    if (sub) return sub.tick?.(time)
    for (const card of legends) card.draw(time)
  }
  return { el, tick, dispose, dim: 0.5 }
}

/**
 * The victory screen's thanks: a line of supporters' names, a different
 * handful each time (at most `SUPPORTER.credits`). It fills in once the wall
 * comes back and stays empty offline or before the first supporter.
 */
export const creditsLine = () => {
  const el = h('p', { class: 'supporter-credits hidden' })
  void fetchWall().then((wall) => {
    if (!wall || wall.entries.length === 0) return
    const names = [...wall.entries].sort(() => Math.random() - 0.5).slice(0, SUPPORTER.credits).map((e) => e.name)
    el.replaceChildren(h('img', { src: heartIcon(), alt: '' }), h('small', {}, t().supporters.credits), h('span', {}, names.join(' · ')))
    el.classList.remove('hidden')
  })
  return el
}
