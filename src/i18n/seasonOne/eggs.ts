/**
 * Temporada 1's egg and fossil families' words, a table per language (`pt` is the reference).
 * Each language's file spreads its `blurbs`, `moves` and `abilities` here.
 */
const blurbs = {
  snom: 'Snom',
  joltik: 'Joltik',
  salandit: 'Salandit',
  hatenna: 'Hatenna',
  applin: 'Applin',
  frigibax: 'Frigibax',
  cranidos: 'Cranidos',
  shieldon: 'Shieldon',
  archen: 'Archen',
  tyrunt: 'Tyrunt',
  amaura: 'Amaura',
}

export const SEASON_ONE_EGGS_WORDS = {
  pt: { blurbs, moves: {}, abilities: {} },
  en: { blurbs, moves: {}, abilities: {} },
  es: { blurbs, moves: {}, abilities: {} },
  fr: { blurbs, moves: {}, abilities: {} },
  zh: { blurbs, moves: {}, abilities: {} },
} as const
