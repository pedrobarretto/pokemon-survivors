/**
 * The first visit's welcome and first partner pick (`ui/welcome.ts`, `ui/firstPartner.ts`), Rotom's lines and the Settings' "see the tutorial again", a table per language (`pt` is the reference). Pokémon names stay in English.
 */
// Filled by the onboarding work: give `Words` its keys and every language its lines.
type Words = Record<never, never>

export const WELCOME_WORDS: Record<'pt' | 'en' | 'es' | 'fr' | 'zh', Words> = {
  pt: {},
  en: {},
  es: {},
  fr: {},
  zh: {},
}
