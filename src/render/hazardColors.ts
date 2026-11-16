import type { HazardVisual } from '../data/bosses'

/** Each enemy hazard's rim and fill colors (telegraphs, zones, beams). */
export const HAZARD_COLORS: Record<HazardVisual, readonly [string, string]> = {
  rock: ['#c08040', 'rgba(120,80,32,0.28)'],
  slam: ['#f8d878', 'rgba(160,120,48,0.3)'],
  thunder: ['#f8e030', 'rgba(248,224,48,0.22)'],
  ice: ['#98d8f8', 'rgba(152,216,248,0.25)'],
  fire: ['#f08030', 'rgba(240,128,48,0.25)'],
  psychic: ['#f870c0', 'rgba(248,96,208,0.4)'],
  water: ['#58a8f8', 'rgba(88,168,248,0.28)'],
  dragon: ['#a070f8', 'rgba(112,56,248,0.3)'],
  steel: ['#c8e0f8', 'rgba(104,136,200,0.3)'],
  aero: ['#f0f8ff', 'rgba(200,220,248,0.28)'],
  grass: ['#78d850', 'rgba(112,208,72,0.28)'],
  shadow: ['#a890e8', 'rgba(56,32,88,0.42)'],
  judgment: ['#fff0a0', 'rgba(248,224,112,0.32)'],
  poison: ['#c060d8', 'rgba(160,64,192,0.3)'],
  fireball: ['#f08030', 'rgba(240,128,48,0.25)'],
  bubble: ['#58a8f8', 'rgba(88,168,248,0.28)'],
  sludge: ['#602070', 'rgba(160,64,176,0.85)'],
  spark: ['#f8e030', 'rgba(248,224,48,0.22)'],
  seed: ['#78d850', 'rgba(112,208,72,0.28)'],
  orb: ['#e8e8f0', 'rgba(200,200,216,0.3)'],
  mist: ['#f86078', 'rgba(248,176,200,0.42)'],
  luster: ['#58a0f8', 'rgba(72,136,248,0.32)'],
  space: ['#f8b8e8', 'rgba(232,112,200,0.32)'],
}
