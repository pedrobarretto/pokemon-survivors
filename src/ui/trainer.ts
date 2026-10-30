import { accountState, accountsEnabled, onAccountChange, signIn, signOut, syncSave, type AccountState } from '../account'
import { isAdmin } from '../admin'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { MEDALS } from '../data/achievements'
import { RIBBON_TIERS, ribbonCounts } from '../game/ribbons'
import type { SupporterTier } from '../game/supporters'
import { trainerAvatar } from '../game/trainer'
import { formatNumber, LOCALES, locale, t } from '../i18n'
import { discordIcon, medalIcon, ogIcon, pokeballIcon, ribbonIcon, supporterIcon } from '../render/art'
import { portraitUrl } from '../render/sprites'
import { fetchSupporterStatus, knownOg, knownTier } from '../supporters'
import { adminScreen } from './admin'
import { boutiqueFresh } from './boutique'
import { slotIconUrl } from '../render/gemArt'
import { discordScreen } from './discord'
import { h, later } from './dom'
import { missionsScreen } from './missions'
import { profileEditor, profileScreen, supporterBadgeIcon } from './profile'
import { loadSave } from './save'
import { openSettings } from './settings'
import { sharePreview, trainerShare, trainerTotals } from './share'
import { hint, menu, type Screen } from './screens'
import { backButton, gearButton, shellBody, topBar } from './shell'

/**
 * The trainer's avatar: their Pokémon (`trainerAvatar`) once signed in, a
 * Poké Ball for guests; a gold ring for supporters.
 */
const avatar = (s: AccountState, size: 'small' | 'big') => {
  const save = loadSave()
  const signedIn = s.kind === 'signedIn'
  const tier = knownTier(save)
  const face = trainerAvatar(save, tier)
  const ring = signedIn && tier ? ' supporter' : ''
  return h('span', { class: `trainer-avatar ${size}${ring}`, 'aria-hidden': 'true' }, signedIn ? h('img', { src: portraitUrl(face.dex, face.shiny), alt: '' }) : h('img', { class: 'ball', src: pokeballIcon(), alt: '' }))
}

/** The equipped title, with the supporter's heart (and an OG's plate) before it, or null. */
const titleLine = (cls: string) => {
  const save = loadSave()
  if (!save.title) return null
  const tier = knownTier(save)
  return h(
    'span',
    { class: cls },
    tier && h('img', { src: supporterIcon(tier), alt: '' }),
    tier && knownOg() && h('img', { class: 'og', src: ogIcon(), alt: t().supporters.og.badge }),
    h('span', {}, t().achievements.titles[save.title]),
  )
}

/**
 * The Trainer chip, for the top bar's left slot (title screen): avatar, name
 * and, under it, the equipped title (or "Entrar" for a guest when accounts
 * are on), with the sync dot once signed in. A tap or `C` calls `onOpen`
 * (the Trainer Card). It follows the account state; `dispose` stops that.
 */
export const trainerChip = (input: Input, opts: { onOpen: () => void }) => {
  const open = () => (playSfx('select'), later(opts.onOpen))
  const el = h('button', { class: 'shell-chip trainer-chip box', type: 'button', onclick: open })
  const draw = (s: AccountState) => {
    const m = t().trainer
    const name = s.kind === 'signedIn' ? s.name || (s.handle ? `@${s.handle}` : m.guest) : s.kind === 'busy' ? '…' : m.guest
    const sub = s.kind === 'guest' && accountsEnabled ? h('span', { class: 'trainer-chip-sub join' }, m.signIn) : titleLine('trainer-chip-sub')
    el.replaceChildren(
      avatar(s, 'small'),
      h('span', { class: 'trainer-chip-who' }, h('b', {}, name), sub),
      ...(s.kind === 'signedIn' ? [h('span', { class: 'sync-dot', 'data-sync': s.sync, 'aria-hidden': 'true' })] : []),
      h('span', { class: 'key-hint' }, 'C'),
    )
    el.setAttribute('aria-label', `${m.open}: ${name}`)
  }
  draw(accountState())
  const offState = onAccountChange(draw)
  const offKey = input.onKey((key) => key === 'KeyC' && open())
  return { el, dispose: () => (offState(), offKey()) }
}

/** Month and year of a date, in the current language (`10/2026`). */
const monthYear = (iso: string) => new Date(iso).toLocaleDateString(LOCALES[locale()].tag, { month: '2-digit', year: 'numeric' })

/** One row under the card: a label, maybe an icon (`wide`: Discord's, not square), and what it opens. `tone: 'out'` is the red sign out; `fresh`, a NOVO tag. */
type Row = { label: string; run: () => void; icon?: string; wide?: boolean; tone?: 'out'; fresh?: boolean }

/**
 * The Trainer Card (from the Trainer chip): avatar, name, @handle, title,
 * runs, wins, Pokédex and shinies, medals and ribbons, the linked Discord,
 * the sync state (a tap syncs), then rows to edit the profile, see it, share
 * the card image, Discord (link it, or the server once linked), Apoiadores
 * (supporters), the Pokémon's look (Leavanny's Boutique on its Visual tab,
 * without the walk), missions and achievements, the admin's gift desk and sign
 * out. Guests get the same card from the local save, with "Criar conta /
 * Entrar" and "Entrar com Discord" when accounts are on. It follows the account state.
 *
 * `supporters` opens Apoiadores over it (it can start a run, so the caller
 * builds it); every screen opened from here comes back to the card, but the
 * look's row (`locker`), which leaves for the Boutique. The gear
 * opens Settings. ◀, Esc or Backspace close it and call `onClose` after the
 * key dispatch.
 */
export const trainerCardScreen = (
  root: HTMLElement,
  input: Input,
  opts: { supporters: (back: () => void) => Screen; locker: () => void },
  onClose: () => void,
): Screen => {
  const el = h('div', { class: 'screen shell dim trainer-screen' })
  let nav: ReturnType<typeof menu> | null = null
  /** A screen opened from the card: the card hides and ignores keys until it closes. */
  let sub: Screen | null = null
  /** Whether the API said this account runs the gift desk (asked once signed in). */
  let admin: boolean | null = null
  /** When the supporter's first donation came in (asked once, for the Apoiador row). */
  let since: string | null = null
  let askedSince = false
  let closed = false
  /** The row highlighted when a screen opened from the card, highlighted again when it comes back. */
  let resume: number | null = null

  const openSub = (open: (back: () => void) => Screen) => {
    playSfx('select')
    resume = nav?.index ?? null
    nav?.off()
    nav = null
    el.classList.add('hidden')
    later(() => {
      if (closed) return
      sub = open(() => {
        sub = null
        el.classList.remove('hidden')
        build(false)
      })
    })
  }

  const rowsFor = (s: AccountState, tier: SupporterTier | null): Row[] => {
    const m = t().trainer
    const share: Row = { label: m.share, run: () => openSub((back) => sharePreview(root, input, trainerShare(loadSave().partner), back)) }
    const missions: Row = { label: m.missions, run: () => openSub((back) => missionsScreen(root, input, back)) }
    const look: Row = { label: t().boutique.lockerRow, icon: slotIconUrl('head'), fresh: true, run: () => close(opts.locker) }
    const discord: Row = {
      label: s.kind === 'signedIn' && s.discord ? t().discord.row(s.discord) : s.kind === 'signedIn' ? t().discord.link : t().discord.signIn,
      icon: discordIcon(),
      wide: true,
      run: () => openSub((back) => discordScreen(root, input, back)),
    }
    if (s.kind !== 'signedIn') return [...(s.kind === 'guest' && accountsEnabled ? [{ label: m.join, run: () => void signIn() }, discord] : []), share, look, missions]
    const handle = s.handle
    return [
      { label: handle === null ? m.createProfile : m.editProfile, run: () => openSub((back) => profileEditor(root, input, back)) },
      ...(handle ? [{ label: m.viewProfile, run: () => openSub((back) => profileScreen(root, input, handle, back)) }] : []),
      share,
      discord,
      ...(tier ? [{ label: since ? m.supporterSince(tier, monthYear(since)) : t().supporters.badge(tier), icon: supporterBadgeIcon(tier, since), run: () => openSub(opts.supporters) }] : []),
      look,
      missions,
      // Admin only, so not translated (see `ui/admin.ts`).
      ...(admin ? [{ label: 'Painel admin', run: () => openSub((back) => adminScreen(root, input, back)) }] : []),
      { label: m.signOut, tone: 'out' as const, run: () => void signOut() },
    ]
  }

  /** Asks the API, once per card, what only it knows: admin, and the supporter's date. Each answer redraws. */
  const askApi = (s: AccountState, tier: SupporterTier | null) => {
    if (s.kind !== 'signedIn') return
    if (admin === null) {
      admin = false
      void isAdmin().then((yes) => yes && !closed && ((admin = true), build(false)))
    }
    if (tier && !askedSince) {
      askedSince = true
      void fetchSupporterStatus().then((status) => status?.since && !closed && ((since = status.since), build(false)))
    }
  }

  const card = (s: AccountState) => {
    const m = t().trainer
    const save = loadSave()
    const { counts, shinies, medals } = trainerTotals(save)
    const ribbons = ribbonCounts(save.ribbons)
    const name = s.kind === 'signedIn' ? s.name || m.guest : m.guest
    const handle = s.kind === 'signedIn' && s.handle ? `@${s.handle}` : null
    const discord = s.kind === 'signedIn' && s.discord ? s.discord : null
    const stat = (n: number, label: string) => h('span', { class: 'trainer-stat' }, h('b', {}, formatNumber(n)), h('small', {}, label))
    const chips = [
      ...[...MEDALS].reverse().filter((medal) => medals[medal] > 0).map((medal) => [medalIcon(medal), t().achievements.medals[medal], medals[medal]] as const),
      ...RIBBON_TIERS.filter((tier) => ribbons[tier] > 0).map((tier) => [ribbonIcon(tier), t().ribbons.names[tier], ribbons[tier]] as const),
    ]
    return h(
      'section',
      { class: 'trainer-card pop' },
      h(
        'div',
        { class: 'trainer-head' },
        avatar(s, 'big'),
        h(
          'div',
          { class: 'trainer-id' },
          h('h3', {}, name),
          handle && h('small', {}, handle),
          discord && h('small', { class: 'trainer-discord' }, h('img', { src: discordIcon(), alt: 'Discord' }), discord),
          titleLine('trainer-title'),
        ),
      ),
      h(
        'div',
        { class: 'trainer-stats' },
        stat(save.achievements.lifetime.runs, m.stats.runs),
        stat(save.achievements.lifetime.wins, m.stats.wins),
        stat(counts.caught, m.stats.dex),
        stat(shinies.length, m.stats.shinies),
      ),
      h(
        'div',
        { class: 'trainer-medals' },
        ...(chips.length > 0
          ? chips.map(([src, label, n]) => h('span', { class: 'trainer-medal', title: label }, h('img', { src, alt: label }), n > 1 && h('b', {}, `×${n}`)))
          : [h('small', {}, m.noMedals)]),
      ),
    )
  }

  /** The sync line: a button that syncs now once signed in, plain text for guests. */
  const syncLine = (s: AccountState) => {
    const m = t().trainer
    if (s.kind !== 'signedIn') return h('p', { class: 'trainer-sync' }, h('span', { class: 'sync-dot', 'data-sync': 'guest', 'aria-hidden': 'true' }), m.sync.guest)
    return h(
      'button',
      { class: 'trainer-sync', type: 'button' },
      h('span', { class: 'sync-dot', 'data-sync': s.sync, 'aria-hidden': 'true' }),
      m.sync[s.sync],
      s.sync !== 'syncing' && h('span', { class: 'trainer-sync-now' }, m.syncNow),
    )
  }

  const build = (opening: boolean) => {
    if (sub || closed) return
    const s = accountState()
    const tier = s.kind === 'signedIn' ? knownTier(loadSave()) : null
    askApi(s, tier)
    const a = t().account
    const sync = syncLine(s)
    const rows = rowsFor(s, tier)
    const buttons = rows.map((r) =>
      h(
        'button',
        { class: `box trainer-row${r.tone ? ` ${r.tone}` : ''}`, type: 'button' },
        r.icon && h('img', { src: r.icon, alt: '', class: r.wide ? 'wide' : '' }),
        h('span', {}, r.label),
        r.fresh && boutiqueFresh(),
        !r.tone && h('i', { 'aria-hidden': 'true' }, '▶'),
      ),
    )
    const syncs = sync instanceof HTMLButtonElement
    const items = syncs ? [sync, ...buttons] : buttons
    const run = (i: number) => (syncs ? (i === 0 ? () => void syncSave() : rows[i - 1]!.run) : rows[i]!.run)
    const at = nav?.index ?? resume ?? (syncs ? 1 : 0)
    nav?.off()
    nav = menu(input, items, (i) => (playSfx('select'), later(run(i))), { initial: Math.min(at, items.length - 1) })
    const notes =
      s.kind === 'busy'
        ? [h('p', { class: 'trainer-note blink' }, a.busy)]
        : s.kind === 'guest' && accountsEnabled
          ? [h('p', { class: 'trainer-note' }, a.pitch), s.failed && h('p', { class: 'trainer-note error' }, a.failed)]
          : []
    const cardEl = card(s)
    if (!opening) cardEl.classList.remove('pop')
    cardEl.append(sync)
    el.replaceChildren(
      topBar({ left: backButton(() => close()), title: t().trainer.title, right: [gearButton(() => openSub((back) => openSettings(root, input, back)))] }),
      shellBody(h('div', { class: 'trainer-panel' }, cardEl, ...notes, h('div', { class: 'trainer-rows' }, ...buttons), hint(t().trainer.hintKeys, ''))),
    )
  }

  const offState = onAccountChange(() => build(false))
  const offKeys = input.onKey((key) => !sub && (key === 'Escape' || key === 'Backspace') && close())

  const dispose = () => {
    closed = true
    sub?.dispose()
    nav?.off()
    offState()
    offKeys()
    el.remove()
  }

  /** Closes the card and goes back (`then`: somewhere else instead, the look's row). */
  const close = (then: () => void = onClose) => {
    if (closed) return
    playSfx('select')
    dispose()
    later(then)
  }

  build(true)
  root.append(el)
  // A screen opened from the card animates on the card's tick (the Hall's legends, the missions' countdowns).
  return { el, dispose, tick: (time: number) => sub?.tick?.(time) }
}
