import { isVivillonPattern, type VivillonPattern } from './data/vivillon'

/**
 * Which Vivillon pattern this device wears, as the games read the player's
 * region: from the device's time zone first (where it is), then its locale's
 * region (what it's set to), never the network. A look only: the simulation
 * never sees it (`data/vivillon.ts`). Roughly the games' world map, by zone and
 * by country; anything unknown wears Meadow, the species' own.
 */

/** Time zones (IANA) to patterns: the cities and regions most players' devices report. */
const BY_ZONE: Readonly<Record<string, VivillonPattern>> = {
  // The Americas
  'America/Sao_Paulo': 'savanna', 'America/Bahia': 'savanna', 'America/Fortaleza': 'savanna', 'America/Recife': 'savanna', 'America/Maceio': 'savanna',
  'America/Belem': 'jungle', 'America/Manaus': 'jungle', 'America/Porto_Velho': 'jungle', 'America/Rio_Branco': 'jungle', 'America/Boa_Vista': 'jungle', 'America/Santarem': 'jungle',
  'America/Cuiaba': 'savanna', 'America/Campo_Grande': 'savanna', 'America/Araguaina': 'savanna', 'America/Asuncion': 'savanna',
  'America/Argentina/Buenos_Aires': 'marine', 'America/Montevideo': 'marine', 'America/Santiago': 'marine',
  'America/Lima': 'sandstorm', 'America/Bogota': 'jungle', 'America/Caracas': 'jungle', 'America/Guayaquil': 'jungle', 'America/La_Paz': 'highPlains',
  'America/Mexico_City': 'sun', 'America/Monterrey': 'sun', 'America/Cancun': 'sun', 'America/Tijuana': 'sun', 'America/Guatemala': 'sun', 'America/Costa_Rica': 'sun', 'America/Panama': 'sun',
  'America/Puerto_Rico': 'archipelago', 'America/Havana': 'archipelago', 'America/Santo_Domingo': 'archipelago', 'America/Jamaica': 'archipelago', 'America/Nassau': 'archipelago',
  'America/New_York': 'modern', 'America/Chicago': 'modern', 'America/Detroit': 'modern', 'America/Los_Angeles': 'modern', 'America/Phoenix': 'sandstorm',
  'America/Denver': 'highPlains', 'America/Boise': 'highPlains', 'America/Edmonton': 'highPlains', 'America/Regina': 'highPlains', 'America/Winnipeg': 'polar',
  'America/Toronto': 'polar', 'America/Vancouver': 'polar', 'America/Halifax': 'polar', 'America/St_Johns': 'polar', 'America/Anchorage': 'icySnow', 'America/Nuuk': 'icySnow',
  'Pacific/Honolulu': 'ocean',
  // Europe
  'Europe/London': 'garden', 'Europe/Dublin': 'garden', 'Europe/Paris': 'meadow', 'Europe/Brussels': 'meadow', 'Europe/Amsterdam': 'meadow', 'Europe/Luxembourg': 'meadow', 'Europe/Zurich': 'meadow',
  'Europe/Madrid': 'marine', 'Europe/Lisbon': 'marine', 'Atlantic/Canary': 'marine', 'Europe/Rome': 'marine', 'Europe/Athens': 'marine', 'Europe/Istanbul': 'sandstorm',
  'Europe/Berlin': 'continental', 'Europe/Vienna': 'continental', 'Europe/Prague': 'continental', 'Europe/Warsaw': 'continental', 'Europe/Budapest': 'continental', 'Europe/Bucharest': 'continental', 'Europe/Kyiv': 'continental', 'Europe/Kiev': 'continental',
  'Europe/Copenhagen': 'polar', 'Europe/Oslo': 'polar', 'Europe/Stockholm': 'polar', 'Europe/Helsinki': 'polar', 'Atlantic/Reykjavik': 'icySnow', 'Europe/Moscow': 'tundra',
  // Asia and Oceania
  'Asia/Tokyo': 'elegant', 'Asia/Seoul': 'continental', 'Asia/Shanghai': 'monsoon', 'Asia/Hong_Kong': 'monsoon', 'Asia/Macau': 'monsoon', 'Asia/Taipei': 'monsoon',
  'Asia/Manila': 'archipelago', 'Asia/Singapore': 'jungle', 'Asia/Kuala_Lumpur': 'jungle', 'Asia/Jakarta': 'jungle', 'Asia/Bangkok': 'monsoon', 'Asia/Ho_Chi_Minh': 'monsoon', 'Asia/Saigon': 'monsoon',
  'Asia/Kolkata': 'monsoon', 'Asia/Calcutta': 'monsoon', 'Asia/Dhaka': 'monsoon', 'Asia/Karachi': 'sandstorm', 'Asia/Dubai': 'sandstorm', 'Asia/Riyadh': 'sandstorm', 'Asia/Tehran': 'sandstorm', 'Asia/Jerusalem': 'sandstorm',
  'Asia/Almaty': 'highPlains', 'Asia/Ulaanbaatar': 'highPlains', 'Asia/Novosibirsk': 'tundra', 'Asia/Yekaterinburg': 'tundra', 'Asia/Vladivostok': 'tundra',
  'Australia/Sydney': 'garden', 'Australia/Melbourne': 'garden', 'Australia/Brisbane': 'sun', 'Australia/Perth': 'sandstorm', 'Australia/Adelaide': 'river', 'Australia/Darwin': 'river', 'Pacific/Auckland': 'garden',
  // Africa
  'Africa/Cairo': 'river', 'Africa/Khartoum': 'river', 'Africa/Casablanca': 'sandstorm', 'Africa/Algiers': 'sandstorm', 'Africa/Tunis': 'sandstorm',
  'Africa/Lagos': 'jungle', 'Africa/Kinshasa': 'jungle', 'Africa/Nairobi': 'savanna', 'Africa/Johannesburg': 'savanna', 'Africa/Luanda': 'savanna', 'Africa/Maputo': 'savanna',
}

/** A zone's continent when its city isn't listed: the broad pattern of that part of the world. */
const BY_AREA: Readonly<Record<string, VivillonPattern>> = {
  America: 'modern', Europe: 'continental', Asia: 'monsoon', Africa: 'savanna', Australia: 'sandstorm', Pacific: 'ocean', Atlantic: 'marine', Arctic: 'icySnow', Antarctica: 'icySnow', Indian: 'ocean',
}

/** Countries (ISO 3166 alpha-2, a locale's region) to patterns, when the zone says nothing. */
const BY_COUNTRY: Readonly<Record<string, VivillonPattern>> = {
  BR: 'savanna', PY: 'savanna', AR: 'marine', UY: 'marine', CL: 'marine', PE: 'sandstorm', CO: 'jungle', VE: 'jungle', EC: 'jungle', BO: 'highPlains',
  MX: 'sun', GT: 'sun', CR: 'sun', PA: 'sun', PR: 'archipelago', CU: 'archipelago', DO: 'archipelago',
  US: 'modern', CA: 'polar', GL: 'icySnow',
  GB: 'garden', IE: 'garden', FR: 'meadow', BE: 'meadow', NL: 'meadow', LU: 'meadow', CH: 'meadow', ES: 'marine', PT: 'marine', IT: 'marine', GR: 'marine', TR: 'sandstorm',
  DE: 'continental', AT: 'continental', CZ: 'continental', PL: 'continental', HU: 'continental', RO: 'continental', UA: 'continental',
  DK: 'polar', NO: 'polar', SE: 'polar', FI: 'polar', IS: 'icySnow', RU: 'tundra',
  JP: 'elegant', KR: 'continental', CN: 'monsoon', HK: 'monsoon', MO: 'monsoon', TW: 'monsoon', PH: 'archipelago', SG: 'jungle', MY: 'jungle', ID: 'jungle', TH: 'monsoon', VN: 'monsoon', IN: 'monsoon', BD: 'monsoon',
  PK: 'sandstorm', AE: 'sandstorm', SA: 'sandstorm', IR: 'sandstorm', IL: 'sandstorm', KZ: 'highPlains', MN: 'highPlains',
  AU: 'sandstorm', NZ: 'garden', EG: 'river', SD: 'river', MA: 'sandstorm', DZ: 'sandstorm', TN: 'sandstorm', NG: 'jungle', CD: 'jungle', KE: 'savanna', ZA: 'savanna', AO: 'savanna', MZ: 'savanna',
}

/** The region part of a locale tag (`pt-BR` → `BR`), or null. */
const countryOf = (locale: string) => {
  const parts = locale.replace('_', '-').split('-')
  const region = parts.slice(1).find((p) => /^[A-Za-z]{2}$/.test(p))
  return region ? region.toUpperCase() : null
}

/** The pattern for a time zone and a locale: the zone's city, then the locale's country, then the zone's continent, else Meadow. Pure. */
export const patternFor = (timeZone: string | null, locale: string | null): VivillonPattern => {
  const zone = timeZone ? BY_ZONE[timeZone] : undefined
  if (zone) return zone
  const country = locale ? countryOf(locale) : null
  const byCountry = country ? BY_COUNTRY[country] : undefined
  if (byCountry) return byCountry
  const area = timeZone ? BY_AREA[timeZone.split('/')[0] ?? ''] : undefined
  return area ?? 'meadow'
}

const OVERRIDE = 'ps:vivillon'

let cached: VivillonPattern | null = null

/** This device's pattern (a dev override in `ps:vivillon` first, `ps.vivillon`), read once. */
export const devicePattern = (): VivillonPattern => {
  if (cached) return cached
  let forced: string | null = null
  try {
    forced = localStorage.getItem(OVERRIDE)
  } catch {
    forced = null
  }
  if (isVivillonPattern(forced)) return (cached = forced)
  let zone: string | null = null
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null
  } catch {
    zone = null
  }
  const locale = typeof navigator !== 'undefined' ? navigator.language : null
  return (cached = patternFor(zone, locale))
}

/** Dev: wears `pattern` on this device from now on (null: back to its region's). */
export const forcePattern = (pattern: VivillonPattern | null) => {
  try {
    if (pattern) localStorage.setItem(OVERRIDE, pattern)
    else localStorage.removeItem(OVERRIDE)
  } catch {
    // Storage blocked: the override lasts this page only.
  }
  cached = pattern
}
