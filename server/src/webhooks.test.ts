import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { ABACATE_GEMS_REF, ABACATE_REF, abacateDonation, abacateGems, ABACATEPAY_PUBLIC_KEY, patreonAmount, patreonCharge, patreonGemsRef, patreonMember, stripeDonation, stripeGems, verifyAbacate, verifyPatreon, verifyStandard, verifyStripe } from './webhooks'

const SECRET = 'whsec_test'

const stripeHeader = (body: string, t: number, secret = SECRET) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`

const session = (over: Record<string, unknown> = {}) => ({
  type: 'checkout.session.completed',
  data: { object: { id: 'cs_live_abc', payment_status: 'paid', amount_total: 1000, currency: 'usd', client_reference_id: 'Ash', payment_link: 'plink_1', ...over } },
})

describe('Stripe webhooks', () => {
  it('takes a fresh event signed with the secret', () => {
    const body = JSON.stringify(session())
    expect(verifyStripe(body, stripeHeader(body, 1000), SECRET, 1010)).toBe(true)
    expect(verifyStripe(body, stripeHeader(body, 1000, 'whsec_other'), SECRET, 1010)).toBe(false)
    expect(verifyStripe(`${body} `, stripeHeader(body, 1000), SECRET, 1010)).toBe(false)
    // A captured event replayed later.
    expect(verifyStripe(body, stripeHeader(body, 1000), SECRET, 2000)).toBe(false)
    expect(verifyStripe(body, undefined, SECRET, 1010)).toBe(false)
  })

  it('reads a paid session of the donation link, with its handle', () => {
    expect(stripeDonation(session(), 'plink_1')).toEqual({ provider: 'stripe', ref: 'cs_live_abc', amount: 1000, currency: 'usd', handle: 'ash' })
    expect(stripeDonation(session({ client_reference_id: null }), null)?.handle).toBeNull()
    expect(stripeDonation(session({ payment_link: 'plink_other' }), 'plink_1')).toBeNull()
    expect(stripeDonation(session({ payment_status: 'unpaid' }), null)).toBeNull()
    expect(stripeDonation({ ...session(), type: 'invoice.paid' }, null)).toBeNull()
  })

  it("counts an Adaptive Pricing session in the link's own currency", () => {
    const converted = session({ amount_total: 920, currency: 'eur', currency_conversion: { amount_total: 1000, source_currency: 'usd' } })
    expect(stripeDonation(converted, null)).toMatchObject({ amount: 1000, currency: 'usd' })
  })
})

describe('Stripe gem packs', () => {
  const REF = '8f14e45f-ceea-467f-a0e6-1b7a2c1c9a01'
  const pack = (over: Record<string, unknown> = {}) => session({ payment_link: null, client_reference_id: REF, payment_intent: 'pi_3Abc123', metadata: { kind: 'gems', ref: REF, user: 'user_1', pack: 'bag' }, ...over })

  it('reads a paid pack, never as a donation', () => {
    expect(stripeGems(pack())).toEqual({ kind: 'paid', provider: 'stripe', ref: REF, session: 'cs_live_abc', payment: 'pi_3Abc123', amount: 1000, currency: 'usd' })
    // What it charged, in the pack's own currency when Adaptive Pricing converted it.
    expect(stripeGems(pack({ amount_total: 920, currency: 'eur', currency_conversion: { amount_total: 1000, source_currency: 'USD' } }))).toMatchObject({ amount: 1000, currency: 'usd' })
    expect(stripeGems({ ...pack(), type: 'checkout.session.async_payment_succeeded' })?.kind).toBe('paid')
    expect(stripeDonation(pack(), null)).toBeNull()
    expect(stripeGems(pack({ payment_status: 'unpaid' }))).toBeNull()
    expect(stripeGems(pack({ metadata: { kind: 'gems', ref: "x'; drop table users" } }))).toBeNull()
    expect(stripeGems(session())).toBeNull()
  })

  it('reads refunds by their running total, disputes and won disputes', () => {
    const charge = (type: string, over: Record<string, unknown>) => ({ type, data: { object: { id: 'ch_3Abc123', payment_intent: 'pi_3Abc123', amount: 2490, ...over } } })
    expect(stripeGems(charge('charge.refunded', { amount_refunded: 1000 }))).toEqual({
      kind: 'refund', provider: 'stripe', purchase: { payment: 'pi_3Abc123' }, share: { refunded: 1000, amount: 2490 }, key: 'refund:stripe:ch_3Abc123:1000',
    })
    expect(stripeGems(charge('charge.refunded', { amount_refunded: 0 }))).toBeNull()
    const dispute = (type: string, status: string) => ({ type, data: { object: { id: 'du_1Abc123', payment_intent: 'pi_3Abc123', status } } })
    expect(stripeGems(dispute('charge.dispute.created', 'needs_response'))).toEqual({ kind: 'dispute', provider: 'stripe', purchase: { payment: 'pi_3Abc123' }, key: 'dispute:stripe:du_1Abc123' })
    // An inquiry withdraws no money: it takes nothing (an escalation opens a real dispute), and its close gives nothing.
    expect(stripeGems(dispute('charge.dispute.created', 'warning_needs_response'))).toBeNull()
    expect(stripeGems(dispute('charge.dispute.closed', 'warning_closed'))).toBeNull()
    expect(stripeGems(dispute('charge.dispute.closed', 'won'))).toMatchObject({ kind: 'disputeWon', dispute: 'dispute:stripe:du_1Abc123', key: 'dispute-won:stripe:du_1Abc123' })
    expect(stripeGems(dispute('charge.dispute.closed', 'lost'))).toBeNull()
  })
})

describe('AbacatePay gem packs', () => {
  const REF = '8f14e45f-ceea-467f-a0e6-1b7a2c1c9a01'
  const event = (name: string, externalId = `${ABACATE_GEMS_REF}${REF}`, status = 'PAID') => ({ event: name, data: { checkout: { id: 'bill_abc123', externalId, status, amount: 2490, paidAmount: 2490 } } })

  it('reads a paid pack, never as a donation', () => {
    expect(abacateGems(event('checkout.completed'))).toEqual({ kind: 'paid', provider: 'abacatepay', ref: REF, session: 'bill_abc123', payment: 'bill_abc123', amount: 2490, currency: 'brl' })
    expect(abacateDonation(event('checkout.completed'))).toBeNull()
    expect(abacateGems(event('checkout.completed', undefined, 'PENDING'))).toBeNull()
    expect(abacateGems(event('checkout.completed', `${ABACATE_REF}${REF}`))).toBeNull()
  })

  it('takes a refund in full, whatever its amounts say, and a dispute once, by name (their payloads still say PAID)', () => {
    const refund = { kind: 'refund', provider: 'abacatepay', purchase: { ref: REF }, share: 'all', key: 'refund:abacatepay:bill_abc123' }
    expect(abacateGems(event('checkout.refunded'))).toEqual(refund)
    const bare = { event: 'checkout.refunded', data: { checkout: { id: 'bill_abc123', externalId: `${ABACATE_GEMS_REF}${REF}`, status: 'REFUNDED' } } }
    expect(abacateGems(bare)).toEqual(refund)
    expect(abacateGems(event('checkout.disputed'))).toEqual({ kind: 'dispute', provider: 'abacatepay', purchase: { ref: REF }, key: 'dispute:abacatepay:bill_abc123' })
    expect(abacateGems(event('checkout.lost'))).toBeNull()
  })
})

describe('AbacatePay webhooks', () => {
  const event = (externalId: string, status = 'PAID') => ({ event: 'checkout.completed', data: { checkout: { externalId, status, amount: 2500, paidAmount: 2500 } } })

  it('checks the signature with the public key', () => {
    const body = JSON.stringify(event(`${ABACATE_REF}x`))
    expect(verifyAbacate(body, createHmac('sha256', ABACATEPAY_PUBLIC_KEY).update(body).digest('base64'))).toBe(true)
    expect(verifyAbacate(body, 'forged')).toBe(false)
  })

  it('reads only our paid checkouts (the account sells other things)', () => {
    expect(abacateDonation(event(`${ABACATE_REF}1234`))).toEqual({ provider: 'abacatepay', ref: '1234', amount: 2500, currency: 'brl', handle: null })
    expect(abacateDonation(event('chatdeia-plan-9'))).toBeNull()
    expect(abacateDonation(event(`${ABACATE_REF}1234`, 'PENDING'))).toBeNull()
  })
})

describe('Standard Webhooks (AbacatePay since 01/10/2026)', () => {
  const secret = `whsec_${Buffer.from('a 32-byte key for the test suite').toString('base64')}`
  const sign = (id: string, t: number, body: string) =>
    `v1,${createHmac('sha256', Buffer.from(secret.slice(6), 'base64')).update(`${id}.${t}.${body}`).digest('base64')}`

  it('takes a fresh delivery signed with the secret, among several signatures', () => {
    const body = '{"event":"checkout.completed"}'
    const signature = `v1,bm9wZQ== ${sign('msg_1', 1000, body)}`
    expect(verifyStandard(body, { id: 'msg_1', timestamp: '1000', signature }, secret, 1010)).toBe(true)
  })

  it('refuses another id, a changed body, an old delivery or a missing header', () => {
    const body = '{"event":"checkout.completed"}'
    const signature = sign('msg_1', 1000, body)
    expect(verifyStandard(body, { id: 'msg_2', timestamp: '1000', signature }, secret, 1010)).toBe(false)
    expect(verifyStandard(`${body} `, { id: 'msg_1', timestamp: '1000', signature }, secret, 1010)).toBe(false)
    expect(verifyStandard(body, { id: 'msg_1', timestamp: '1000', signature }, secret, 2000)).toBe(false)
    expect(verifyStandard(body, { id: 'msg_1', timestamp: undefined, signature }, secret, 1010)).toBe(false)
  })
})

describe('Patreon webhooks', () => {
  const member = (attributes: Record<string, unknown> = {}, included: unknown[] = [], tiers: string[] = ['29913157']) => ({
    data: {
      type: 'member',
      id: 'a1b2c3d4-0000-4000-8000-000000000001',
      attributes: { last_charge_status: 'Paid', last_charge_date: '2026-11-01T08:15:00.000+00:00', currently_entitled_amount_cents: 500, campaign_lifetime_support_cents: 1500, ...attributes },
      relationships: { user: { data: { id: '9876543', type: 'user' } }, currently_entitled_tiers: { data: tiers.map((id) => ({ id, type: 'tier' })) } },
    },
    included,
  })

  it('checks the HMAC-MD5 of the raw body', () => {
    const body = JSON.stringify(member())
    const signature = createHmac('md5', 'patreon-secret').update(body).digest('hex')
    expect(verifyPatreon(body, signature, 'patreon-secret')).toBe(true)
    expect(verifyPatreon(body, signature.toUpperCase(), 'patreon-secret')).toBe(true)
    expect(verifyPatreon(`${body} `, signature, 'patreon-secret')).toBe(false)
    expect(verifyPatreon(body, signature, 'other')).toBe(false)
    expect(verifyPatreon(body, undefined, 'patreon-secret')).toBe(false)
  })

  it('reads a paid charge, the same ref for every event that repeats it', () => {
    const charge = patreonCharge('members:pledge:create', member(), 'usd')
    expect(charge).toEqual({
      ref: 'patreon:a1b2c3d4-0000-4000-8000-000000000001:2026-11-01T08:15:00.000Z',
      member: 'a1b2c3d4-0000-4000-8000-000000000001',
      patron: '9876543',
      lifetime: 1500,
      entitled: 500,
      currency: 'usd',
      tier: 'supporter',
    })
    // A later update of the same member (a new address, say) names the same charge.
    expect(patreonCharge('members:update', member({ last_charge_date: '2026-11-01T08:15:00Z' }), 'usd')?.ref).toBe(charge?.ref)
  })

  it("keys a charge's gems by member and Brasília month", () => {
    expect(patreonGemsRef('patreon:m1:2026-11-20T12:00:00.000Z')).toBe('patreon-gems:m1:2026-11')
    // Still October in Brasília (UTC−3).
    expect(patreonGemsRef('patreon:m1:2026-11-01T02:59:00.000Z')).toBe('patreon-gems:m1:2026-10')
    expect(patreonGemsRef('patreon:m1:soon')).toBeNull()
    expect(patreonGemsRef('pack:m1:2026-11-01T00:00:00.000Z')).toBeNull()
  })

  it('takes the campaign currency when the payload includes it', () => {
    expect(patreonCharge('members:update', member({}, [{ type: 'campaign', id: '1', attributes: { currency: 'BRL' } }]), 'usd')?.currency).toBe('brl')
  })

  it('ignores charges that are not paid and events that are not about members', () => {
    expect(patreonCharge('members:update', member({ last_charge_status: 'Declined' }), 'usd')).toBeNull()
    expect(patreonCharge('members:create', member({ last_charge_status: null, last_charge_date: null }), 'usd')).toBeNull()
    expect(patreonCharge('posts:publish', member(), 'usd')).toBeNull()
    expect(patreonCharge(undefined, member(), 'usd')).toBeNull()
  })

  it("counts what the member's lifetime total grew past the charges already recorded", () => {
    const charge = patreonCharge('members:update', member(), 'usd')!
    expect(patreonAmount(charge, 1000)).toBe(500)
    // The first charge recorded counts all they ever paid; one that adds nothing counts nothing.
    expect(patreonAmount(charge, 0)).toBe(1500)
    expect(patreonAmount(charge, 1500)).toBe(0)
    expect(patreonAmount({ ...charge, lifetime: null }, 1000)).toBe(500)
  })

  it("reads the patron's tier from the tier they're entitled to, never from what they paid", () => {
    expect(patreonMember('members:pledge:create', member({ patron_status: 'active_patron' }))).toEqual({ patron: '9876543', tier: 'supporter' })
    // Months of US$ 5 add up in the lifetime total, the tier stays.
    expect(patreonMember('members:update', member({ patron_status: 'active_patron', campaign_lifetime_support_cents: 9000 }))?.tier).toBe('supporter')
    // A Brazilian's Supporter is R$ 32,50: their amounts come in reais, the tier is still Supporter.
    expect(patreonMember('members:pledge:create', member({ patron_status: 'active_patron', currently_entitled_amount_cents: 3250 }))?.tier).toBe('supporter')
    expect(patreonMember('members:pledge:update', member({ patron_status: 'active_patron' }, [], ['29913165']))?.tier).toBe('gold')
    expect(patreonMember('members:pledge:update', member({ patron_status: 'active_patron' }, [], ['29913157', '29913169']))?.tier).toBe('diamond')
  })

  it("prices a tier it doesn't know by the tier's own price, and gives nothing for a free one", () => {
    const tier = (id: string, amount: number) => ({ type: 'tier', id, attributes: { amount_cents: amount } })
    expect(patreonMember('members:pledge:create', member({ patron_status: 'active_patron' }, [tier('1', 1000)], ['1']))?.tier).toBe('gold')
    expect(patreonMember('members:pledge:create', member({ patron_status: 'active_patron' }, [tier('2', 0)], ['2']))?.tier).toBeNull()
    expect(patreonMember('members:pledge:create', member({ patron_status: 'active_patron' }, [], ['3']))?.tier).toBeNull()
    expect(patreonMember('members:create', member({ patron_status: 'active_patron' }, [], []))?.tier).toBeNull()
  })

  it('drops the tier once the pledge is declined, cancelled or the member is gone', () => {
    expect(patreonMember('members:update', member({ patron_status: 'declined_patron' }))?.tier).toBeNull()
    expect(patreonMember('members:update', member({ patron_status: 'former_patron' }))?.tier).toBeNull()
    expect(patreonMember('members:pledge:delete', member({ patron_status: 'active_patron' }))?.tier).toBeNull()
    expect(patreonMember('members:delete', member({ patron_status: 'active_patron' }))?.tier).toBeNull()
    expect(patreonMember('posts:publish', member({ patron_status: 'active_patron' }))).toBeNull()
  })
})
