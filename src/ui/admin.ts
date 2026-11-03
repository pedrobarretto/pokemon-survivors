import { accountHandle } from '../account'
import { fetchReports, findPlayers, moderate, sendGift, sentGifts } from '../admin'
import { GIFT_TITLES, type GiftTitleId } from '../data/achievements'
import { HATCHLING_IDS, HATCHLINGS } from '../data/hatchlings'
import { styleIds, stylePrice, type FrameId } from '../data/style'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { formatTime } from '../engine/math'
import type { AdminSent, AdminUser, Ban } from '../game/admin'
import { EGG_TIER_IDS, type EggTier } from '../game/eggs'
import type { GiftContent } from '../game/gifts'
import { REPORT_REASONS, type Moderation, type ReportGroup, type ReportedRun, type ReportReason } from '../game/reports'
import { formatNumber, locale, t } from '../i18n'
import { PROFILE_PARAM } from '../ranking'
import { ROUTES } from '../site/routes'
import { contentLine } from './gifts'
import { h, later, rich } from './dom'
import { runForm, runPortrait } from './profile'
import type { Screen } from './screens'

/*
 * The admin's panel: the gift desk, and the reports with what to do about
 * them. Only the admin ever sees it (the API answers 403 to anyone else,
 * whatever the page shows), so its own words are in Portuguese only; what
 * the player will read comes from `t()`, as on their side.
 */

/** Waits this long after the last key before searching. */
const SEARCH_MS = 350

/** A second tap on a button that asks within this long acts; after it, the button asks again. */
const CONFIRM_MS = 4000

const KINDS = { egg: 'Ovo', coins: 'Pokédólares (₽)', shinyHatch: 'Shiny de uma família', shinyPick: 'Shiny à escolha (ticket)', title: 'Título', frame: 'Moldura' } as const

/** Frames that are never sold, only given (the Creator's, the Ambassador's…). */
const GIFT_FRAMES = styleIds('frame').filter((id) => stylePrice('frame', id) === null)

type Kind = keyof typeof KINDS

const isKind = (v: string): v is Kind => v in KINDS

const REASONS = { cheating: 'Trapaça', name: 'Nome ofensivo', other: 'Outro' } as const satisfies Record<ReportReason, string>

const VERDICT = { true: '✓ verificada', false: '✗ fora do ranking', null: '? não checada' } as const

const option = (value: string, label: string) => h('option', { value }, label)

const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

const who = (u: { handle: string | null; name: string | null }) => (u.handle ? `@${u.handle}` : (u.name ?? 'sem @'))

const banLine = (ban: Ban) => `⛔ Banido desde ${when(ban.at)}${ban.reason ? ` · ${ban.reason}` : ''}`

/** The game's own link to a profile, without crediting the admin as an inviter. */
const profileHref = (handle: string) => `${location.origin}${ROUTES.play[locale()]}?${PROFILE_PARAM}=${encodeURIComponent(handle)}`

/** One gift as a line with its icon, in the words the player gets. */
const giftLine = (content: GiftContent, ...after: (Node | string)[]) => {
  const line = contentLine({ content })
  return h('span', { class: 'gift-line' }, h('img', { src: line.src, alt: '' }), rich(line.text), ...after)
}

/**
 * A button that asks before acting: the first tap arms it (its label turns
 * into `ask`), a second one within `CONFIRM_MS` runs `act`, which says how
 * it went. `cls` adds to `btn`.
 */
const askingButton = (label: string, ask: string, act: () => Promise<void>, cls = '') => {
  const b = h('button', { class: `btn ${cls}`, type: 'button' }, label)
  let armed = 0
  let busy = false
  b.addEventListener('click', async () => {
    if (busy) return
    if (performance.now() - armed > CONFIRM_MS) {
      playSfx('move')
      armed = performance.now()
      b.textContent = ask
      window.setTimeout(() => !busy && performance.now() - armed >= CONFIRM_MS && (b.textContent = label), CONFIRM_MS)
      return
    }
    busy = true
    armed = 0
    b.textContent = 'Enviando…'
    await act()
    busy = false
    b.textContent = label
  })
  return b
}

/** What a moderation came to, in a line for the admin. */
const moderated = (out: number | 'unknown' | null, done: string) =>
  out === null ? 'Não foi. Tente de novo.' : out === 'unknown' ? 'Esse jogador (ou essa run) não existe mais.' : `${done}${out > 0 ? ` ${out} denúncia(s) resolvida(s).` : ''}`

/** A reported run's numbers in one line: Pokémon, time, difficulty, KOs, level, outcome and whether it verified. */
const runLine = (run: ReportedRun) =>
  [
    runForm(run).name,
    formatTime(run.time),
    t().difficulty.names[run.difficulty],
    `${formatNumber(run.kills)} KOs`,
    `Nv ${run.level}`,
    t().ranking.outcomes[run.outcome],
    VERDICT[`${run.verified}`],
    when(run.at),
  ].join(' · ')

/**
 * The panel, in two tabs. Presentes: search a player by handle or email,
 * pick one, then ban, unban or wipe their save, or choose a gift (an egg,
 * ₽, a family's shiny, a shiny ticket, or a title or frame only given, like
 * the Creator's), see it as the player will and send
 * it with a second tap; below, the latest gifts sent by hand. Denúncias
 * (with how many are open): the open reports grouped by run or player, each
 * with its numbers, notes, a link to the profile and its actions (take the
 * run off, wipe the save, ban or unban, dismiss), every destructive one
 * asking a second tap. Back or Esc close it and call `onClose`.
 */
export const adminScreen = (root: HTMLElement, input: Input, onClose: () => void): Screen => {
  let target: AdminUser | null = null
  let request = crypto.randomUUID()
  let searchId = 0
  let timer = 0
  let armed = 0
  let busy = false
  let closed = false
  let tab: 'gifts' | 'reports' = 'gifts'

  const query = h('input', { class: 'field-input', type: 'search', maxlength: 100, autocapitalize: 'none', autocorrect: 'off', autocomplete: 'off', spellcheck: 'false', placeholder: '@handle ou e-mail', enterkeyhint: 'search' })
  const results = h('div', { class: 'admin-results' })
  const status = h('p', { class: 'field-message' }, 'Busque pelo @ ou pelo e-mail.')

  const kind = h('select', { class: 'field-input admin-select' }, ...Object.entries(KINDS).map(([k, label]) => option(k, label)))
  const tier = h('select', { class: 'field-input admin-select' }, ...EGG_TIER_IDS.map((id) => option(id, t().eggs.tiers[id])))
  const amount = h('input', { class: 'field-input', type: 'number', inputmode: 'numeric', min: 1, max: 100000, step: 100, value: 1000 })
  const family = h('select', { class: 'field-input admin-select' }, ...HATCHLING_IDS.map((id) => option(id, HATCHLINGS[id].name)))
  const title = h('select', { class: 'field-input admin-select' }, ...GIFT_TITLES.map((id) => option(id, t().achievements.titles[id])))
  const frame = h('select', { class: 'field-input admin-select' }, ...GIFT_FRAMES.map((id) => option(id, t().mart.styles.frame[id])))
  /** The control that picks the gift's detail, per kind (none for a shiny ticket). */
  const controls: Partial<Record<Kind, HTMLElement>> = { egg: tier, coins: amount, shinyHatch: family, title, frame }
  const detail = h('span', { class: 'field-box' })
  const preview = h('div', { class: 'admin-preview box' })
  const message = h('p', { class: 'field-message' })
  const send = h('button', { class: 'btn confirm', type: 'button' }, 'Enviar presente')
  const modPart = h('div', { class: 'admin-mod' })
  const giftPart = h(
    'div',
    { class: 'admin-gift hidden' },
    h('p', { class: 'admin-target' }),
    modPart,
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'PRESENTE'), h('span', { class: 'field-box' }, kind)),
    h('label', { class: 'field' }, detail),
    h('span', { class: 'field-label' }, 'O QUE O JOGADOR VAI VER'),
    preview,
    message,
    send,
  )
  const recent = h('div', { class: 'admin-recent' })
  const reportsList = h('div', { class: 'admin-reports' })
  const reportsSummary = h('p', { class: 'field-message' }, 'Carregando…')
  /** How the last action on a group went (the list redraws after it). */
  const reportsStatus = h('p', { class: 'field-message' })
  const back = h('button', { class: 'btn', type: 'button' }, 'Voltar')

  const say = (el: HTMLElement, text: string, error = false) => {
    el.textContent = text
    el.classList.toggle('error', error)
  }

  /* ---------------- Tabs ---------------- */

  const giftsTab = h('button', { class: 'region-tab rank-tab selected', type: 'button' }, 'Presentes')
  const reportsTab = h('button', { class: 'region-tab rank-tab', type: 'button' }, 'Denúncias')
  const giftsSection = h('div', { class: 'admin-section' })
  const reportsSection = h('div', { class: 'admin-section hidden' }, reportsSummary, reportsStatus, reportsList)

  const setTab = (next: typeof tab) => {
    if (next === tab) return
    playSfx('move')
    tab = next
    giftsTab.classList.toggle('selected', tab === 'gifts')
    reportsTab.classList.toggle('selected', tab === 'reports')
    giftsSection.classList.toggle('hidden', tab !== 'gifts')
    reportsSection.classList.toggle('hidden', tab !== 'reports')
    if (tab === 'reports') void loadReports()
  }
  giftsTab.addEventListener('click', () => setTab('gifts'))
  reportsTab.addEventListener('click', () => setTab('reports'))

  /* ---------------- Gifts ---------------- */

  /** The gift the controls describe now, or null while ₽ isn't a valid amount. */
  const content = (): GiftContent | null => {
    const k = isKind(kind.value) ? kind.value : 'egg'
    switch (k) {
      case 'egg':
        return { kind: 'egg', tier: EGG_TIER_IDS.find((id): id is EggTier => id === tier.value) ?? 'common' }
      case 'coins': {
        const n = Math.floor(Number(amount.value))
        return n > 0 && n <= 100_000 ? { kind: 'coins', amount: n } : null
      }
      case 'shinyHatch':
        return { kind: 'shinyHatch', family: HATCHLING_IDS.find((id) => id === family.value) ?? HATCHLING_IDS[0]! }
      case 'shinyPick':
        return { kind: 'shinyPick' }
      case 'title':
        return { kind: 'title', title: GIFT_TITLES.find((id): id is GiftTitleId => id === title.value) ?? GIFT_TITLES[0] }
      case 'frame':
        return { kind: 'style', style: { slot: 'frame', id: GIFT_FRAMES.find((id): id is FrameId => id === frame.value) ?? 'creator' } }
    }
  }

  /** Redraws the detail control and the preview; any change asks for a fresh confirmation. */
  const refresh = () => {
    armed = 0
    send.textContent = 'Enviar presente'
    const control = isKind(kind.value) ? (controls[kind.value] ?? null) : null
    detail.replaceChildren(...(control ? [control] : []))
    detail.parentElement?.classList.toggle('hidden', !control)
    const c = content()
    const from = h('small', {}, t().gifts.staff(accountHandle()))
    preview.replaceChildren(...(c ? [from, h('span', { class: 'admin-preview-title' }, t().gifts.title), giftLine(c)] : [h('small', {}, 'Valor inválido (1 a 100.000).')]))
    send.toggleAttribute('disabled', !c || !target)
  }

  /* ---------------- Moderation ---------------- */

  /**
   * Ban (or unban) and wipe a player, with a reason field (prefilled with
   * `opts.reason`) and `opts.extra` buttons first. How it went goes to
   * `opts.note` (else a line of its own); `opts.after` hears the new ban state, to redraw.
   */
  const modControls = (u: { id: string; banned: Ban | null }, opts: { after?: (banned: Ban | null) => void; extra?: HTMLElement[]; reason?: string; note?: HTMLElement } = {}) => {
    const reason = h('input', { class: 'field-input', type: 'text', maxlength: 200, placeholder: 'Motivo (obrigatório para banir)', value: opts.reason ?? '' })
    const line = h('p', { class: 'field-message' }, u.banned ? banLine(u.banned) : '')
    const note = opts.note ?? line
    const act = async (m: Moderation, done: string, ban?: Ban | null) => {
      const out = await moderate(m)
      if (closed) return
      const ok = typeof out === 'number'
      playSfx(ok ? 'unlock' : 'hurt')
      say(note, moderated(out, done), !ok)
      if (ok && ban !== undefined) opts.after?.(ban)
      if (ok) void loadReports()
    }
    const ban = u.banned
      ? askingButton('Desbanir', 'Confirmar: desbanir?', () => act({ action: 'unban', userId: u.id, reason: reason.value.trim() || null }, 'Desbanido.', null))
      : askingButton(
          'Banir',
          'Confirmar: banir?',
          async () => {
            const why = reason.value.trim()
            if (!why) return (playSfx('denied'), say(note, 'Escreva o motivo do ban.', true), reason.focus())
            await act({ action: 'ban', userId: u.id, reason: why }, 'Banido.', { at: new Date().toISOString(), reason: why })
          },
          'danger',
        )
    const reset = askingButton('Zerar o save', 'Confirmar: zerar o save?', () => act({ action: 'reset', userId: u.id, reason: reason.value.trim() || null }, 'Save zerado e runs fora do ranking.'), 'danger')
    return h('div', { class: 'admin-actions' }, h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'MOTIVO (BAN OU SAVE ZERADO)'), h('span', { class: 'field-box' }, reason)), h('div', { class: 'buttons' }, ...(opts.extra ?? []), reset, ban), line)
  }

  /** The search pick's moderation box, redrawn after a ban or an unban. */
  const drawMod = (u: AdminUser) =>
    modPart.replaceChildren(
      h('span', { class: 'field-label' }, 'MODERAÇÃO'),
      modControls(u, {
        after: (banned) => {
          if (target?.id !== u.id) return
          target = { ...u, banned }
          drawMod(target)
        },
      }),
    )

  const pick = (u: AdminUser, button: HTMLElement) => {
    playSfx('select')
    target = u
    request = crypto.randomUUID()
    results.querySelectorAll('.btn').forEach((b) => b.classList.toggle('selected', b === button))
    giftPart.querySelector('.admin-target')!.replaceChildren(rich(`Para *${who(u)}*${u.email ? ` · ${u.email}` : ''}`))
    giftPart.classList.remove('hidden')
    drawMod(u)
    say(message, '')
    refresh()
  }

  const userButton = (u: AdminUser) => {
    const seen = u.seen ? `visto ${when(u.seen)}` : 'nunca sincronizou'
    const b = h(
      'button',
      { class: 'btn admin-user', type: 'button' },
      h('b', {}, who(u)),
      u.name && u.handle ? h('span', {}, u.name) : null,
      u.banned ? h('span', { class: 'admin-banned' }, 'BANIDO') : null,
      h('small', {}, [u.email, seen].filter(Boolean).join(' · ')),
    )
    b.addEventListener('click', () => pick(u, b))
    return b
  }

  const search = async () => {
    window.clearTimeout(timer)
    const q = query.value.trim()
    if (q.replace(/^@/, '').length < 2) return say(status, 'Busque pelo @ ou pelo e-mail.')
    const id = ++searchId
    say(status, 'Buscando…')
    const found = await findPlayers(q)
    if (id !== searchId || closed) return
    if (!found) return say(status, 'Não deu para buscar agora (sem conexão ou sem permissão).', true)
    say(status, found.length ? `${found.length} jogador(es). Toque em um para escolher.` : 'Ninguém com esse @ ou e-mail.', found.length === 0)
    results.replaceChildren(...found.map(userButton))
  }

  const recentLine = (g: AdminSent) =>
    h(
      'li',
      {},
      h('b', {}, who(g)),
      giftLine(g.content),
      h('small', { class: g.claimed ? 'claimed' : '' }, `${when(g.at)} · ${g.claimed ? `✓ resgatado ${when(g.claimed)}` : '⏳ aguardando a sincronização'}`),
    )

  const loadRecent = async () => {
    const list = await sentGifts()
    if (closed) return
    recent.replaceChildren(
      h('span', { class: 'field-label' }, 'ENVIADOS RECENTEMENTE'),
      !list ? h('p', { class: 'field-message error' }, 'Não deu para carregar.') : list.length === 0 ? h('p', { class: 'field-message' }, 'Nenhum ainda.') : h('ul', {}, ...list.map(recentLine)),
    )
  }

  send.addEventListener('click', async () => {
    const c = content()
    if (!c || !target || busy) return
    if (performance.now() - armed > CONFIRM_MS) {
      playSfx('move')
      armed = performance.now()
      send.textContent = `Confirmar: enviar para ${who(target)}?`
      return
    }
    busy = true
    send.textContent = 'Enviando…'
    const sent = await sendGift(target.id, c, request)
    busy = false
    if (closed) return
    refresh()
    if (sent === 'sent' || sent === 'again') {
      playSfx('unlock')
      request = crypto.randomUUID()
      say(message, sent === 'sent' ? `Enviado! Chega na próxima sincronização de ${who(target)}.` : 'Esse envio já tinha ido.')
      void loadRecent()
    } else {
      playSfx('hurt')
      say(message, sent === 'unknown' ? 'Esse jogador não existe mais.' : 'Não foi. Tente de novo (não duplica).', true)
    }
  })

  for (const el of [kind, tier, amount, family, title, frame]) el.addEventListener('input', refresh)
  query.addEventListener('input', () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => void search(), SEARCH_MS)
  })

  /* ---------------- Reports ---------------- */

  /** One group of reports: who, the run, the count and reasons, the notes, and what to do. */
  const groupCard = (g: ReportGroup) => {
    const reasons = REPORT_REASONS.filter((r) => g.reasons[r] > 0).map((r) => `${REASONS[r]} ×${g.reasons[r]}`)
    const top = REPORT_REASONS.reduce((a, b) => (g.reasons[b] > g.reasons[a] ? b : a))
    const run = g.run
    const actions = [
      ...(run && run.verified !== false
        ? [askingButton('Tirar a run', 'Confirmar: tirar do ranking?', async () => {
            const out = await moderate({ action: 'remove', userId: g.target.id, run: run.id })
            if (closed) return
            playSfx(typeof out === 'number' ? 'unlock' : 'hurt')
            say(reportsStatus, moderated(out, 'Run fora do ranking.'), typeof out !== 'number')
            void loadReports()
          })]
        : []),
    ]
    const dismiss = h('button', { class: 'btn', type: 'button' }, 'Descartar')
    dismiss.addEventListener('click', async () => {
      dismiss.textContent = 'Enviando…'
      const out = await moderate({ action: 'dismiss', userId: g.target.id, run: run?.id ?? null })
      if (closed) return
      say(reportsStatus, moderated(out, 'Descartado.'), typeof out !== 'number')
      void loadReports()
    })
    return h(
      'article',
      { class: 'admin-report box' },
      h(
        'div',
        { class: 'admin-report-head' },
        run ? h('img', { src: runPortrait(run), alt: '' }) : null,
        h('span', {}, h('b', {}, who(g.target)), g.target.name && g.target.handle ? h('small', {}, g.target.name) : null),
        g.target.banned ? h('span', { class: 'admin-banned' }, 'BANIDO') : null,
        h('b', { class: 'admin-report-count' }, `${g.count}×`),
      ),
      h('p', { class: 'admin-report-line' }, run ? `Run: ${runLine(run)}` : 'Sobre o jogador (sem run)'),
      h('p', { class: 'admin-report-line' }, `${reasons.join(' · ')} · ${g.count === 1 ? `em ${when(g.first)}` : `de ${when(g.first)} a ${when(g.last)}`}`),
      g.notes.length > 0 ? h('ul', { class: 'admin-report-notes' }, ...g.notes.map((n) => h('li', {}, `“${n.text}”`, h('small', {}, ` ${n.by ? `@${n.by}` : 'sem @'} · ${when(n.at)}`)))) : null,
      g.target.handle ? h('a', { class: 'admin-report-link', href: profileHref(g.target.handle), target: '_blank', rel: 'noopener' }, `Ver perfil de @${g.target.handle} ↗`) : null,
      modControls(g.target, { extra: [...actions, dismiss], reason: g.target.banned ? '' : REASONS[top], note: reportsStatus }),
    )
  }

  let reportsId = 0

  /** Loads the open reports into the tab, and their count into its label. */
  const loadReports = async () => {
    const id = ++reportsId
    const got = await fetchReports()
    if (id !== reportsId || closed) return
    if (!got) return say(reportsSummary, 'Não deu para carregar as denúncias.', true)
    reportsTab.textContent = got.open > 0 ? `Denúncias (${got.open})` : 'Denúncias'
    say(reportsSummary, got.open === 0 ? 'Nenhuma denúncia aberta.' : `${got.open} denúncia(s) aberta(s) em ${got.groups.length} grupo(s), as mais denunciadas primeiro.`)
    reportsList.replaceChildren(...got.groups.map(groupCard))
  }

  /* ---------------- The dialog ---------------- */

  const searchForm = h(
    'form',
    { class: 'admin-search', novalidate: true, onsubmit: (e: Event) => (e.preventDefault(), void search()) },
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'JOGADOR'), h('span', { class: 'field-box' }, query)),
  )
  giftsSection.append(searchForm, status, results, giftPart, recent)

  const dialog = h(
    'div',
    { class: 'dialog box pop admin' },
    h('div', { class: 'dialog-title' }, 'PAINEL ADMIN'),
    h('div', { class: 'region-tabs rank-tabs', role: 'tablist' }, giftsTab, reportsTab),
    giftsSection,
    reportsSection,
    back,
  )
  const el = h('div', { class: 'screen dim' }, dialog)

  const dispose = () => {
    closed = true
    window.clearTimeout(timer)
    offKeys()
    el.remove()
  }
  const close = () => {
    if (closed) return
    playSfx('select')
    dispose()
    later(onClose)
  }
  back.addEventListener('click', close)
  // Inside the fields the game's keys are off (see `createInput`), so Esc is caught here.
  dialog.addEventListener('keydown', (e) => e.key === 'Escape' && close())
  const offKeys = input.onKey((key) => key === 'Escape' && close())

  refresh()
  void loadRecent()
  void loadReports()
  root.append(el)
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) query.focus()
  return { el, dispose, dim: 0.5 }
}
