import type { Score } from '../engine/score'
import { BIOMES } from './biomes'
import type { ThemeId } from './music'

/**
 * The lobby's original themes, beside the village `menu` (`data/music.ts`
 * spreads them into `THEMES`), and which one plays when (`pickLobbyTheme`,
 * which the shell's `src/lobbyMusic.ts` asks and holds): by the hour of the
 * device's day, and the Festival da Praça while it runs. Same tracker notation as every theme (`engine/score.ts`).
 */

/* ---------------- Accompaniment figures ---------------- */

const times = (n: number, bar: string) => Array.from({ length: n }, () => bar)

/** Low, high, middle, high in eighths: a light rolling arpeggio. */
const roll = (low: string, mid: string, high: string) => `${low}:2 ${high} ${mid} ${high} ${low} ${high} ${mid} ${high}`

/** Chord tones on the offbeats. */
const lift = (a: string, b: string) => `r:2 ${a} r ${b} r ${a} r ${b}`

/** Root, a skip up the octave, then the fifth: a bouncy two-beat bass. */
const hop = (low: string, high: string, fifth: string) => `${low}:3 ${high}:1 ${fifth}:4 ${low}:3 ${high}:1 ${fifth}:4`

/** A short-long chord comp twice a bar, like a guitar strummed on the porch. */
const comp = (a: string, b: string) => `r:2 ${a}:2 ${b}:4 r:2 ${a}:2 ${b}:4`

/** Four chord tones up and back down in eighths, slow as stars coming out. */
const glow = (a: string, b: string, c: string, d: string) => `${a}:2 ${b} ${c} ${d} ${c} ${b} ${a} ${b}`

/** Four chord tones cycling in sixteenths: a soft twinkle. */
const twinkle = (a: string, b: string, c: string, d: string) => times(4, `${a}:1 ${b} ${c} ${d}`).join(' ')

/** Broken chord tones scattered over the bar like drops on a window. */
const patter = (a: string, b: string, c: string) => `${a}:2 ${b}:1 ${c} r:2 ${b}:2 ${a}:2 ${c}:1 ${b} r:2 ${c}:2`

/** Dotted quarter, eighth, two quarters: a slow, swaying bass. */
const lull = (low: string, high: string) => `${low}:6 ${high}:2 ${low}:4 ${high}`

/** Double offbeat stabs, the festival band's upbeat. */
const stab = (a: string, b: string) => times(4, `r:2 ${a}:1 ${b}`).join(' ')

/** Root and octave bouncing in eighths. */
const bounce = (low: string, high: string) => times(4, `${low}:2 ${high}`).join(' ')

/* ---------------- Themes ---------------- */

/** Morning in the lobby: a fresh G major, the lead calling and answering like birds over a rolling arpeggio. */
const lobbyMorning: Score = {
  bpm: 108,
  duty: { lead: 0.25, harmony: 0.125 },
  tracks: {
    // | G | D | Em | C | G | Bm | C D | G |  then  | Em | C | G | D | Em | C | Am D | G |
    lead: [
      'B4:1 D5 G5:2 B5:4 r:2 A5:2 B5:4',
      'A5:1 F#5 D5:2 A4:4 r:2 F#5:2 A5:4',
      'G5:2 F#5 E5 B4 E5:4 G5',
      'E5:6 D5:2 C5:4 r',
      'B4:1 D5 G5:2 B5:4 r:2 D6:2 B5:4',
      'F#5:2 B5 D6:4 C6:2 B5 F#5:4',
      'E5:2 G5 C6:4 A5:2 F#5 D5:4',
      'G5:10 r:2 B4:2 D5',
      'E5:6 G5:2 B5:4 E6',
      'D6:3 C6:1 B5:2 G5 E5:4 C5',
      'D5:2 G5 B5 D6 B5:4 G5',
      'A5:6 F#5:2 D5:8',
      'G5:2 B5 E6:4 D6:2 B5 G5:4',
      'E6:4 D6:2 C6 G5:4 E5',
      'C6:2 B5 A5 E5 F#5 A5 D6:4',
      'B5:1 A5 G5:2 D5:4 G5:4 r',
    ],
    harmony: [
      roll('G4', 'B4', 'D5'),
      roll('F#4', 'A4', 'D5'),
      roll('E4', 'G4', 'B4'),
      roll('E4', 'G4', 'C5'),
      roll('G4', 'B4', 'D5'),
      roll('D4', 'F#4', 'B4'),
      'E4:2 C5 G4 C5 F#4 D5 A4 D5',
      'G4:2 D5 B4 D5 G4:8',
      lift('G4', 'B4'),
      lift('G4', 'C5'),
      lift('B4', 'D5'),
      lift('F#4', 'A4'),
      lift('G4', 'B4'),
      lift('G4', 'C5'),
      'r:2 C4 r E4 r F#4 r A4',
      'r:2 B4 r D5 B4:4 r',
    ],
    bass: [
      hop('G2', 'G3', 'D3'),
      hop('D2', 'D3', 'A2'),
      hop('E2', 'E3', 'B2'),
      hop('C2', 'C3', 'G2'),
      hop('G2', 'G3', 'D3'),
      hop('B1', 'B2', 'F#2'),
      'C2:3 C3:1 G2:4 D2:3 D3:1 A2:4',
      'G2:3 G3:1 D3:4 G2:8',
      hop('E2', 'E3', 'B2'),
      hop('C2', 'C3', 'G2'),
      hop('G2', 'G3', 'D3'),
      hop('D2', 'D3', 'A2'),
      hop('E2', 'E3', 'B2'),
      hop('C2', 'C3', 'G2'),
      'A1:3 A2:1 E2:4 D2:3 D3:1 A2:4',
      'G2:3 G3:1 D3:4 G2:4 D2',
    ],
    drums: [
      ...times(7, 'k:6 h:2 s:4 h:2 h'),
      'k:6 h:2 s:2 s:1 s s:2 h',
      ...times(7, 'k:6 h:2 s:4 h:2 h'),
      'k:6 h:2 s:2 s:1 s s:2 o',
    ],
  },
}

/** Afternoon in the lobby: a warm B♭ major stroll over a walking bass, borrowing E♭ minor for a sigh. */
const lobbyAfternoon: Score = {
  bpm: 100,
  duty: { lead: 0.5, harmony: 0.25 },
  tracks: {
    // | Bb | Eb | Dm | Gm | Cm | F7 | Bb | F7 |  then  | Eb | Ebm | Dm | G7 | Cm | F7 | Bb Gm | Cm F |
    lead: [
      'F5:4 D5:2 F5:4 Bb5:2 A5:4',
      'G5:6 Eb5:2 Bb4:8',
      'A4:2 D5 F5 A5 G5:4 F5',
      'D5:12 r:2 C5:1 D5',
      'Eb5:4 C5:2 Eb5:4 G5:2 F5:4',
      'A5:6 F5:2 C5:4 Eb5',
      'D5:2 F5 Bb5:4 A5:2 Bb5 C6:4',
      'A5:8 r:4 F5:2 G5',
      'Bb5:4 G5:2 Bb5:4 Eb6:2 D6:4',
      'Db6:6 Bb5:2 Gb5:8',
      'F5:2 A5 D6 C6 A5:4 F5',
      'G5:4 B5:2 D6 F6:4 D6',
      'Eb6:6 D6:2 C6:4 G5',
      'A5:4 C6:2 A5 F5:4 Eb5',
      'D5:2 F5 Bb5:4 G5:2 Bb5 D6:4',
      'C6:4 Bb5:2 G5 A5:4 F5',
    ],
    harmony: [
      comp('D4', 'F4'),
      comp('Eb4', 'G4'),
      comp('F4', 'A4'),
      comp('D4', 'G4'),
      comp('Eb4', 'G4'),
      comp('Eb4', 'A4'),
      comp('D4', 'F4'),
      comp('Eb4', 'A4'),
      comp('G4', 'Bb4'),
      comp('Gb4', 'Bb4'),
      comp('F4', 'A4'),
      comp('F4', 'B4'),
      comp('Eb4', 'G4'),
      comp('Eb4', 'A4'),
      'r:2 D4:2 F4:4 r:2 D4:2 G4:4',
      'r:2 Eb4:2 G4:4 r:2 Eb4:2 A4:4',
    ],
    bass: [
      'Bb2 D3 F3 E3',
      'Eb3 G3 F3 Eb3',
      'D3 A2 F2 A2',
      'G2 Bb2 D3 B2',
      'C3 G2 Eb3 G3',
      'F3 A2 C3 A2',
      'Bb2 C3 D3 E3',
      'F3 C3 A2 D3',
      'Eb3 Bb2 G2 Bb2',
      'Eb3 Db3 Bb2 Eb3',
      'D3 F3 A2 Ab2',
      'G2 B2 F3 D3',
      'C3 G2 Eb2 E2',
      'F2 A2 C3 A2',
      'Bb2 F2 G2 Bb2',
      'C3 Eb3 F2 A2',
    ],
    drums: [
      ...times(7, 'k:4 h:2 h s:4 h:2 k'),
      'k:4 h:2 h s:2 s:1 s s:2 s',
      ...times(7, 'k:4 h:2 h s:4 h:2 k'),
      'k:4 h:2 h s:2 h s:1 s o:2',
    ],
  },
}

/** Night in the lobby: a quiet A♭ major under the stars, slow chords glowing, a Lydian twinkle in the second half. */
const lobbyNight: Score = {
  bpm: 80,
  duty: { lead: 0.25, harmony: 0.125 },
  tracks: {
    // | Ab | Fm | Db | Eb | Ab | Cm | Db Eb | Ab |  then  | Dbmaj7 | Cm7 | Bbm7 | Eb7 | Dbmaj7 | Cm7 | Fm Bbm | Eb |
    lead: [
      'Eb5:6 C5:2 Ab5:8',
      'G5:4 Ab5:2 G5 F5:8',
      'F5:6 Ab5:2 Db6:4 C6',
      'Bb5:12 r:4',
      'C6:6 Bb5:2 Ab5:4 Eb5',
      'G5:4 Eb5:2 G5 C6:8',
      'Ab5:4 F5 G5:2 Bb5 Eb6:4',
      'C6:8 r:4 Eb5',
      'Ab5:2 C6 F6 G6 F6:4 C6',
      'Eb6:6 Bb5:2 G5:8',
      'Db6:6 C6:2 Bb5:4 F5',
      'G5:8 Bb5:4 Eb6',
      'F6:6 Eb6:2 C6:4 Ab5',
      'Bb5:4 G5:2 Bb5 Eb6:8',
      'Ab5:4 C6 Bb5 Db6',
      'Bb5:8 G5:4 Eb5',
    ],
    harmony: [
      glow('Ab4', 'C5', 'Eb5', 'G5'),
      glow('F4', 'Ab4', 'C5', 'Eb5'),
      glow('Db4', 'F4', 'Ab4', 'C5'),
      glow('Eb4', 'G4', 'Bb4', 'Db5'),
      glow('Ab4', 'C5', 'Eb5', 'G5'),
      glow('C4', 'Eb4', 'G4', 'Bb4'),
      'Db4:2 F4 Ab4 F4 Eb4 G4 Bb4 G4',
      'Ab4:2 C5 Eb5 C5 Ab4:8',
      twinkle('Db4', 'F4', 'Ab4', 'C5'),
      twinkle('C4', 'Eb4', 'G4', 'Bb4'),
      twinkle('Bb3', 'Db4', 'F4', 'Ab4'),
      twinkle('Eb4', 'G4', 'Bb4', 'Db5'),
      twinkle('Db4', 'F4', 'Ab4', 'C5'),
      twinkle('C4', 'Eb4', 'G4', 'Bb4'),
      'Ab4:1 F4 C4 F4 Ab4 F4 C4 F4 Bb4 F4 Db4 F4 Bb4 F4 Db4 F4',
      twinkle('G4', 'Bb4', 'Eb5', 'Bb4'),
    ],
    bass: [
      'Ab2:12 Eb2:4',
      'F2:12 C3:4',
      'Db2:12 Ab2:4',
      'Eb2:12 Bb2:4',
      'Ab2:12 Eb2:4',
      'C3:12 G2:4',
      'Db2:8 Eb2',
      'Ab2:8 Eb2:4 Ab2',
      'Db2:12 Ab2:4',
      'C3:12 G2:4',
      'Bb1:12 F2:4',
      'Eb2:12 Bb2:4',
      'Db2:12 Ab2:4',
      'C3:12 G2:4',
      'F2:8 Bb1',
      'Eb2:8 Bb2:4 Eb2',
    ],
    drums: [
      ...times(7, 'k:8 h:6 h:2'),
      'k:8 h:4 o',
      ...times(7, 'k:4 h:4 s:4 h:2 h'),
      'k:6 k:2 s:4 o',
    ],
  },
}

/** A rainy lobby: a mellow F♯ minor, broken chords dripping like rain on the window over a swaying bass. */
const lobbyRain: Score = {
  bpm: 88,
  duty: { lead: 0.5, harmony: 0.125 },
  tracks: {
    // | F#m | Bm | E | A | D | Bm | C#m | C# |  then  | D | E7 | C#m | F#m | Bm | E7 | A D | C# |
    lead: [
      'A5:6 G#5:2 F#5:4 C#5',
      'D5:4 F#5:2 B5 A5:8',
      'G#5:6 F#5:2 E5:4 B4',
      'C#5:12 r:2 E5:1 F#5',
      'A5:6 F#5:2 D6:4 C#6',
      'B5:4 A5:2 F#5 D5:8',
      'E5:4 G#5 B5:2 A5 G#5:4',
      'G#5:8 E#5:4 C#5',
      'F#5:3 A5:1 D6:4 C#6:2 A5 F#5:4',
      'G#5:3 B5:1 E6:4 D6:2 B5 G#5:4',
      'E6:6 C#6:2 G#5:4 B5',
      'A5:12 r:4',
      'D6:4 C#6:2 B5 F#5:4 A5',
      'G#5:4 E5:2 G#5 B5:8',
      'C#6:4 B5:2 A5 F#5:4 A5',
      'G#5:6 E#5:2 C#5:8',
    ],
    harmony: [
      patter('F#4', 'A4', 'C#5'),
      patter('D4', 'F#4', 'B4'),
      patter('E4', 'G#4', 'B4'),
      patter('E4', 'A4', 'C#5'),
      patter('F#4', 'A4', 'D5'),
      patter('D4', 'F#4', 'B4'),
      patter('E4', 'G#4', 'C#5'),
      patter('E#4', 'G#4', 'C#5'),
      patter('F#4', 'A4', 'D5'),
      patter('E4', 'G#4', 'D5'),
      patter('E4', 'G#4', 'C#5'),
      patter('F#4', 'A4', 'C#5'),
      patter('D4', 'F#4', 'B4'),
      patter('E4', 'G#4', 'D5'),
      'E4:2 A4:1 C#5 r:2 A4:2 F#4:2 A4:1 D5 r:2 A4:2',
      patter('E#4', 'G#4', 'C#5'),
    ],
    bass: [
      lull('F#2', 'C#3'),
      lull('B1', 'F#2'),
      lull('E2', 'B2'),
      lull('A1', 'E2'),
      lull('D2', 'A2'),
      lull('B1', 'F#2'),
      lull('C#2', 'G#2'),
      'C#2:6 E#2:2 G#2:4 C#3',
      lull('D2', 'A2'),
      lull('E2', 'B2'),
      lull('C#2', 'G#2'),
      lull('F#2', 'C#3'),
      lull('B1', 'F#2'),
      lull('E2', 'B2'),
      'A1:6 E2:2 D2:4 A2',
      'C#2:6 G#2:2 C#2:8',
    ],
    drums: [
      ...times(7, 'k:4 h:1 h h:2 s:4 h:1 h h:2'),
      'k:4 h:1 h h:2 s:2 h:1 h s:2 h',
      ...times(7, 'k:4 h:1 h h:2 s:4 h:1 h h:2'),
      'k:4 h:1 h h:2 s:2 s:1 s o:4',
    ],
  },
}

/** While a Festival da Praça runs: a festive A major parade, a pipe-thin pentatonic lead over offbeat stabs and a bouncing bass. */
const lobbyFestival: Score = {
  bpm: 128,
  duty: { lead: 0.125, harmony: 0.25 },
  tracks: {
    // | A | F#m | D | E | A | F#m | D E | A |  then  | D | E | C#m | F#m | D | E | Bm E | A |
    lead: [
      'E5:2 F#5:1 E5 C#5:2 E5 A5:4 F#5:2 E5',
      'F#5:4 A5:2 F#5 E5:4 C#5',
      'D5:2 F#5 A5 B5 A5:2 F#5:1 E5 D5:4',
      'E5:8 B4:2 C#5 E5:4',
      'A5:2 B5:1 A5 F#5:2 A5 C#6:4 B5:2 A5',
      'C#6:4 E6:2 C#6 B5:4 A5',
      'F#5:2 A5 B5:4 G#5:2 B5 E6:4',
      'A5:12 r:2 E5',
      'F#5:3 E5:1 F#5:2 A5 D6:4 A5:4',
      'G#5:3 F#5:1 G#5:2 B5 E6:4 B5:4',
      'C#6:2 B5 G#5 E5 C#5:4 E5',
      'F#5:6 E5:2 C#5:8',
      'A5:2 B5:1 A5 F#5:2 D5 A5:4 B5',
      'B5:2 C#6:1 B5 G#5:2 E5 B5:4 C#6',
      'D6:2 C#6 B5 F#5 E5 G#5 B5:4',
      'A5:4 E5:2 C#5 A4:4 r',
    ],
    harmony: [
      stab('C#5', 'E5'),
      stab('A4', 'C#5'),
      stab('A4', 'D5'),
      stab('G#4', 'B4'),
      stab('C#5', 'E5'),
      stab('A4', 'C#5'),
      'r:2 A4:1 D5 r:2 A4:1 D5 r:2 G#4:1 B4 r:2 G#4:1 B4',
      'r:2 C#5:1 E5 r:2 C#5:1 E5 A4:8',
      stab('F#4', 'A4'),
      stab('G#4', 'B4'),
      stab('G#4', 'C#5'),
      stab('A4', 'C#5'),
      stab('F#4', 'A4'),
      stab('G#4', 'B4'),
      'r:2 F#4:1 B4 r:2 F#4:1 B4 r:2 G#4:1 D5 r:2 G#4:1 D5',
      'r:2 C#5:1 E5 r:2 C#5:1 E5 A4:8',
    ],
    bass: [
      bounce('A2', 'A3'),
      bounce('F#2', 'F#3'),
      bounce('D2', 'D3'),
      bounce('E2', 'E3'),
      bounce('A2', 'A3'),
      bounce('F#2', 'F#3'),
      'D2:2 D3 D2 D3 E2 E3 E2 E3',
      'A2:2 A3 A2 A3 A2 E3 C#3 A2',
      bounce('D2', 'D3'),
      bounce('E2', 'E3'),
      bounce('C#2', 'C#3'),
      bounce('F#2', 'F#3'),
      bounce('D2', 'D3'),
      bounce('E2', 'E3'),
      'B1:2 B2 B1 B2 E2 E3 E2 E3',
      'A2:2 A3 A2 A3 E2 E3 G#2 E2',
    ],
    drums: [
      ...times(7, 'k:2 h s h k h s:2 h:1 h'),
      'k:2 h s h k:1 s s s s:2 o',
      ...times(7, 'k:2 h s h k h s:2 h:1 h'),
      's:1 s s s k:2 s k:1 k s:2 o:4',
    ],
  },
}

export const LOBBY_THEMES = { lobbyMorning, lobbyAfternoon, lobbyNight, lobbyRain, lobbyFestival } as const satisfies Record<string, Score>

/* ---------------- Which one plays ---------------- */

export type LobbyBand = 'morning' | 'afternoon' | 'evening' | 'night'

/** The local hour each band starts at; night runs past midnight to the morning. */
const BAND_START = { morning: 5, afternoon: 11, evening: 17, night: 21 } as const satisfies Record<LobbyBand, number>

/** What each band takes turns playing, visit by visit (the rain on evenings and nights). */
export const LOBBY_ROTATION = {
  morning: ['lobbyMorning', 'menu'],
  afternoon: ['lobbyAfternoon', 'menu'],
  evening: ['lobbyRain', 'menu'],
  night: ['lobbyNight', 'lobbyRain'],
} as const satisfies Record<LobbyBand, readonly ThemeId[]>

export const bandOf = (hour: number): LobbyBand =>
  hour >= BAND_START.night || hour < BAND_START.morning ? 'night' : hour >= BAND_START.evening ? 'evening' : hour >= BAND_START.afternoon ? 'afternoon' : 'morning'

/** What the pick reads: the device's local hour and day (days since the epoch), how many picks came before, and the calendar's events. */
export type LobbyClock = { hour: number; day: number; visit: number; festival: boolean; halloween: boolean }

export type LobbyPick = { theme: ThemeId; why: LobbyBand | 'festival' | 'halloween' }

/**
 * The lobby's theme: the Noite das Bruxas' tower on its days; while a Festival
 * da Praça runs, its theme every other pick; otherwise the band's rotation,
 * one step per pick, starting a step further each day so the first tune of a
 * session changes too.
 */
export const pickLobbyTheme = ({ hour, day, visit, festival, halloween }: LobbyClock): LobbyPick => {
  if (halloween) return { theme: BIOMES.tower.theme, why: 'halloween' }
  if (festival && visit % 2 === 0) return { theme: 'lobbyFestival', why: 'festival' }
  const band = bandOf(hour)
  const turns: readonly ThemeId[] = LOBBY_ROTATION[band]
  const turn = festival ? (visit - 1) / 2 : visit
  return { theme: turns[(turn + day) % turns.length]!, why: band }
}
