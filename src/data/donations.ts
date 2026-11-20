/**
 * Donations, in whole reais through a Stripe Checkout (Pix and cards; abroad,
 * Adaptive Pricing shows the donor's own currency). The support page
 * (`/apoie/`) offers the presets or any amount in range, and the API
 * (`POST /donations`) refuses anything else. What a donation brings in the game is in `game/supporters.ts`.
 */
export const DONATION = {
  presets: [5, 10, 25, 50],
  preset: 10,
  /** Smaller gifts would mostly go to fees. */
  min: 5,
  max: 1000,
} as const

/** A donation amount in reais (`25`, `"25"`), or null if it isn't a whole number in range. */
export const parseDonation = (value: unknown) => {
  const amount = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof amount === 'number' && Number.isInteger(amount) && amount >= DONATION.min && amount <= DONATION.max ? amount : null
}
