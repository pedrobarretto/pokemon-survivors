/**
 * Progressive enhancement for the static site pages. The HTML is complete
 * without it; this only adds the Pokédex filters, shiny toggles and tap-to-walk,
 * the donation form (with the account's @, the thank-you's code and the
 * supporters' wall), who is live on the creators page, and remembers the language for the game. It must never
 * import game code (plain data like `data/donations` is fine), so the game and
 * the site never load each other's bundles.
 */

import { CREATOR_IDS, parseLive, type CreatorLive } from '../data/creators'
import { inBrazil, parseDonation } from '../data/donations'

/** Same key as `src/i18n`: picking PT/EN/ES here makes "Play" open the game in that language. */
const LANG_KEY = 'ps:lang'

document.documentElement.classList.add('js')

for (const link of document.querySelectorAll<HTMLAnchorElement>('a[data-lang]')) {
  link.addEventListener('click', () => {
    try {
      localStorage.setItem(LANG_KEY, link.dataset.lang ?? '')
    } catch {
      // Storage blocked: the game falls back to the page language.
    }
  })
}

/** On phones the nav scrolls sideways: brings the current page's tab into view (once the pixel font sized the tabs). */
const centerNav = () => {
  const current = document.querySelector<HTMLElement>('.site-nav [aria-current="page"]')
  const nav = current?.parentElement
  if (!current || !nav || nav.scrollWidth <= nav.clientWidth) return
  const tab = current.getBoundingClientRect()
  nav.scrollLeft += tab.left - nav.getBoundingClientRect().left - (nav.clientWidth - tab.width) / 2
}
void document.fonts.ready.then(centerNav)

/** Lowercase without accents or punctuation, like the cards' `data-search`. */
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const FILTERS = ['q', 'region', 'type', 'tier', 'role'] as const

type Filters = Record<(typeof FILTERS)[number], string>

const matches = (card: HTMLElement, f: Filters) => {
  const d = card.dataset
  const words = (d.search ?? '').replace(/-/g, ' ')
  return (
    (!f.q || f.q.split(' ').every((w) => words.includes(w))) &&
    (!f.region || d.region === f.region) &&
    (!f.type || (d.types ?? '').split(' ').includes(f.type)) &&
    (!f.tier || d.tier === f.tier) &&
    (!f.role || (d.roles ?? '').split(' ').includes(f.role))
  )
}

const setShiny = (card: HTMLElement, on: boolean) => {
  const button = card.querySelector('.shiny-btn')
  if (!button) return
  card.classList.toggle('is-shiny', on)
  button.setAttribute('aria-pressed', String(on))
  const portrait = card.querySelector<HTMLImageElement>('img.portrait[data-shiny-src]')
  if (portrait) {
    portrait.dataset.normalSrc ??= portrait.src
    portrait.src = on ? (portrait.dataset.shinySrc ?? portrait.src) : portrait.dataset.normalSrc
  }
}

const pokedex = (form: HTMLFormElement) => {
  const cards = [...document.querySelectorAll<HTMLElement>('.dex-card')]
  const count = form.querySelector<HTMLElement>('.dex-count')
  const empty = document.querySelector<HTMLElement>('.dex-empty')
  const control = (name: string) => form.elements.namedItem(name)

  const read = (): Filters => {
    const data = new FormData(form)
    const value = (name: string) => String(data.get(name) ?? '')
    return { q: normalize(value('q')), region: value('region'), type: value('type'), tier: value('tier'), role: value('role') }
  }

  const apply = () => {
    const filters = read()
    let shown = 0
    for (const card of cards) {
      card.hidden = !matches(card, filters)
      if (!card.hidden) shown++
    }
    if (count) {
      // Both templates hold one number ("2 Pokémon found"); swap in the real count.
      const template = (shown === 1 ? count.dataset.one : count.dataset.other) ?? ''
      count.textContent = template.replace(/\d+/, String(shown))
    }
    if (empty) empty.hidden = shown > 0
    const params = new URLSearchParams(FILTERS.flatMap((k) => (filters[k] ? [[k, filters[k]]] : [])))
    const query = params.toString()
    history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`)
  }

  // Filters live in the query string, so a filtered view can be shared.
  const params = new URLSearchParams(location.search)
  for (const name of FILTERS) {
    const value = params.get(name)
    const el = control(name)
    if (value === null || !el) continue
    if (el instanceof RadioNodeList) el.value = value
    else if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) el.value = value
  }

  /** A link to `#charizard` must show Charizard even if the filters hide it. */
  const reveal = () => {
    const target = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null
    if (!target?.classList.contains('dex-card') || !target.hidden) return
    form.reset()
    apply()
    target.scrollIntoView()
  }

  form.addEventListener('input', apply)
  form.addEventListener('submit', (e) => e.preventDefault())
  form.addEventListener('reset', () => requestAnimationFrame(() => (apply(), syncShinyAll())))
  window.addEventListener('hashchange', reveal)

  const shinyAll = control('shiny')
  const syncShinyAll = () => {
    if (shinyAll instanceof HTMLInputElement) for (const card of cards) setShiny(card, shinyAll.checked)
  }
  if (shinyAll instanceof HTMLInputElement) shinyAll.addEventListener('change', syncShinyAll)

  for (const card of cards) {
    card.querySelector('.shiny-btn')?.addEventListener('click', () => setShiny(card, !card.classList.contains('is-shiny')))
    // Touch screens have no hover: tapping the sprite toggles the walk cycle.
    card.querySelector('.stage')?.addEventListener('click', () => card.classList.toggle('walking'))
  }

  apply()
  reveal()
}

const form = document.querySelector<HTMLFormElement>('#dex-filters')
if (form) pokedex(form)

/** The accounts API, which opens AbacatePay checkouts (`POST /donations`) and knows the handles and supporters. */
const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '')

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/** A JSON body from the API, or null (no API, offline, an error). */
const api = async (path: string, init?: RequestInit): Promise<unknown> => {
  if (!API_URL) return null
  try {
    const res = await fetch(`${API_URL}${path}`, init)
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

/** Same rules as the game's `parseHandle` (3 to 20 of `a-z`, `0-9`, `_`), without importing game code. */
const HANDLE = /^[a-z0-9_]{3,20}$/

const typedHandle = (raw: string) => raw.trim().replace(/^@/, '').toLowerCase()

/** The handle to prefill: the game's link (`?u=`), else this browser's signed-in account (`ps:account`, see `src/account.ts`). */
const knownHandle = () => {
  const linked = new URLSearchParams(location.search).get('u')
  if (linked) return typedHandle(linked)
  try {
    const link: unknown = JSON.parse(localStorage.getItem('ps:account') ?? 'null')
    return isObject(link) && typeof link.handle === 'string' ? link.handle : ''
  } catch {
    return ''
  }
}

/**
 * The account that gets the rewards: checks the typed @ against the API
 * (`GET /profiles/:handle`) and says whose it is. `handle()` is the checked
 * handle, or null when the field is empty or nobody has it.
 */
const accountField = (box: HTMLElement, onChange: (handle: string | null) => void) => {
  const input = box.querySelector<HTMLInputElement>('input[name="handle"]')
  const status = box.querySelector<HTMLElement>('.donate-handle-status')
  let checked: string | null = null
  let request = 0
  if (!input || !status) return { handle: () => null }
  const say = (text: string, error = false) => {
    status.textContent = text
    status.classList.toggle('error', error)
  }
  const check = async () => {
    const id = ++request
    const handle = typedHandle(input.value)
    checked = null
    onChange(null)
    if (!handle) return say('')
    if (!HANDLE.test(handle)) return say(input.dataset.missing ?? '', true)
    say(input.dataset.checking ?? '')
    const profile = await api(`/profiles/${encodeURIComponent(handle)}`)
    if (id !== request) return
    if (!isObject(profile) || typeof profile.name !== 'string') return say(input.dataset.missing ?? '', true)
    checked = handle
    onChange(handle)
    say((input.dataset.found ?? '').replace('{name}', `${profile.name} (@${handle})`))
  }
  let timer = 0
  input.addEventListener('input', () => {
    clearTimeout(timer)
    timer = window.setTimeout(() => void check(), 400)
  })
  input.value = knownHandle()
  void check()
  return { handle: () => checked }
}

/**
 * Back from a checkout (`?thanks=<ref>`): asks the API where the donation
 * went (`GET /donations/:ref`) until its webhook has arrived, then says it
 * went to an account, or shows its code to redeem in the game. `?thanks=1`
 * (an older link) just says thanks.
 */
const thanks = (box: HTMLElement) => {
  const ref = new URLSearchParams(location.search).get('thanks')
  if (!ref) return
  box.hidden = false
  const status = box.querySelector<HTMLElement>('.donate-status')
  const codeBox = box.querySelector<HTMLElement>('.donate-code')
  const code = codeBox?.querySelector('code')
  const copy = codeBox?.querySelector('button')
  if (ref === '1' || !status || !codeBox || !code || !copy) return
  const d = box.dataset
  status.textContent = d.pending ?? ''
  copy.addEventListener('click', () => {
    void navigator.clipboard?.writeText(code.textContent ?? '').then(() => (copy.textContent = d.copied ?? ''))
  })
  // Pix confirms in seconds, cards in a minute or two; after that the page says to come back.
  let tries = 0
  const poll = async () => {
    const body = await api(`/donations/${encodeURIComponent(ref)}`)
    const paid = isObject(body) && body.paid === true
    if (!paid) {
      if (++tries < 40) return void setTimeout(() => void poll(), 3000)
      return void (status.textContent = d.late ?? '')
    }
    if (isObject(body) && typeof body.handle === 'string') return void (status.textContent = (d.sent ?? '').replace('{handle}', body.handle))
    if (isObject(body) && typeof body.code === 'string') {
      status.textContent = ''
      code.textContent = body.code
      codeBox.hidden = false
      return
    }
    status.textContent = d.used ?? ''
  }
  void poll()
}

/** The supporters' wall (`GET /supporters`): their names, oldest first. Stays hidden without the API. */
const supportersWall = async (section: HTMLElement) => {
  const list = section.querySelector('ul')
  const body = await api('/supporters')
  if (!list || !isObject(body) || !Array.isArray(body.supporters)) return
  const names = body.supporters.flatMap((e: unknown) =>
    isObject(e) && typeof e.name === 'string' && typeof e.handle === 'string' ? [{ name: e.name, handle: e.handle, gold: e.tier === 'gold' }] : [],
  )
  list.replaceChildren(
    ...names.map((n) => {
      const li = document.createElement('li')
      li.textContent = `${n.gold ? '★' : '♥'} ${n.name}`
      li.title = `@${n.handle}`
      if (n.gold) li.classList.add('gold')
      return li
    }),
  )
  if (names.length === 0) {
    const empty = document.createElement('p')
    empty.textContent = section.dataset.empty ?? ''
    list.replaceWith(empty)
  }
  section.hidden = false
}

/**
 * The support page: puts first (and marks) the way to pay that the time zone
 * suggests, says where a donation went once a checkout comes back, carries
 * the account's @ into both checkouts (the Stripe link's `client_reference_id`,
 * the AbacatePay request's `handle`) and turns the Brazilian form into an AbacatePay checkout.
 */
const support = (ways: HTMLElement) => {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const guess = document.getElementById(inBrazil(zone) ? 'donate-br' : 'donate-intl')
  if (guess) {
    ways.prepend(guess)
    guess.classList.add('is-guess')
  }

  const thanksBox = document.getElementById('donate-thanks')
  if (thanksBox) thanks(thanksBox)
  const wall = document.getElementById('donate-wall')
  if (wall) void supportersWall(wall)

  // The Stripe link carries the account as `client_reference_id`, which its webhook hands back.
  const stripe = document.querySelector<HTMLAnchorElement>('#donate-intl a.btn-play')
  const stripeBase = stripe?.href ?? ''
  const accountBox = document.getElementById('donate-account')
  const account = accountBox
    ? accountField(accountBox, (handle) => stripe && (stripe.href = handle ? `${stripeBase}?client_reference_id=${encodeURIComponent(handle)}` : stripeBase))
    : { handle: () => null }

  const form = document.querySelector<HTMLFormElement>('#donate-form')
  if (!form) return
  const button = form.querySelector('button')
  const error = form.querySelector<HTMLElement>('.donate-error')
  const other = form.elements.namedItem('other')
  const presets = form.querySelectorAll<HTMLInputElement>('input[name="preset"]')
  if (!button || !error || !(other instanceof HTMLInputElement)) return

  const amount = () => parseDonation(other.value || (new FormData(form).get('preset') ?? ''))
  const sync = () => {
    const value = amount()
    // The label holds one number ("Doar R$ 10"); swap in the chosen amount.
    button.textContent = (form.dataset.cta ?? '').replace(/\d+/, String(value ?? '…'))
    button.disabled = value === null
  }

  // Typing an amount unpicks the presets, and picking one clears it.
  other.addEventListener('input', () => {
    if (other.value) for (const p of presets) p.checked = false
    sync()
  })
  for (const p of presets) p.addEventListener('change', () => ((other.value = ''), sync()))

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const value = amount()
    if (value === null) return
    error.hidden = true
    button.disabled = true
    button.textContent = form.dataset.loading ?? ''
    try {
      if (!API_URL) throw new Error('no API')
      const res = await fetch(`${API_URL}/donations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: value, page: location.pathname, handle: account.handle() ?? undefined }),
      })
      const body: unknown = await res.json()
      const url = typeof body === 'object' && body !== null && 'url' in body && typeof body.url === 'string' ? body.url : null
      if (!res.ok || !url) throw new Error(`donation: ${res.status}`)
      location.href = url
    } catch {
      error.textContent = form.dataset.error ?? ''
      error.hidden = false
      sync()
    }
  })

  // Back from the checkout, the page may come from the bfcache with the button still "Opening…".
  window.addEventListener('pageshow', sync)
  sync()
}

const ways = document.getElementById('donate-ways')
if (ways) support(ways)

/** Who is live (`GET /creators/live`). In dev, `?live=<id>` (or `?live=all`) stages it without the API. */
const liveCreators = async (): Promise<CreatorLive[]> => {
  const staged = import.meta.env.DEV ? new URLSearchParams(location.search).get('live') : null
  const now = Date.now()
  if (staged) return parseLive((staged === 'all' ? CREATOR_IDS : [staged]).map((id) => ({ id, until: new Date(now + 3_600_000).toISOString() })), now)
  const body = await api('/creators/live')
  return isObject(body) ? parseLive(body.live, now) : []
}

/**
 * The creators page: the cards of whoever is live go first, in red, their
 * button pointing at the live; the banner over the list shows the newest
 * stream with its creator's partner.
 */
const creators = async (grid: HTMLElement) => {
  const live = await liveCreators()
  const cards = live.flatMap(({ id }) => grid.querySelector<HTMLElement>(`[data-creator="${id}"]`) ?? [])
  for (const card of [...cards].reverse()) {
    card.classList.add('is-live')
    grid.prepend(card)
    const watch = card.querySelector<HTMLAnchorElement>('.creator-watch')
    if (watch) {
      watch.href = card.dataset.liveUrl ?? watch.href
      watch.textContent = watch.dataset.watch ?? watch.textContent
    }
  }
  const first = cards[0]
  const banner = document.getElementById('live-now')
  if (!first || !banner) return
  const text = banner.querySelector('p')
  const watch = banner.querySelector<HTMLAnchorElement>('.live-now-watch')
  const sprite = first.querySelector('.creator-stage .sp')
  if (text) text.textContent = (banner.dataset.banner ?? '').replace('{name}', first.querySelector('h2')?.textContent ?? '').replace('{platform}', first.querySelector('.platform-chip')?.textContent ?? '')
  if (watch) watch.href = first.dataset.liveUrl ?? watch.href
  if (sprite) banner.querySelector('.live-now-sprite')?.replaceChildren(sprite.cloneNode())
  banner.hidden = false
}

const grid = document.getElementById('creator-grid')
if (grid) void creators(grid)
