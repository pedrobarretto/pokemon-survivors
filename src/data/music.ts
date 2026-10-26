import type { Score } from '../engine/score'

/**
 * Original chiptune themes, written in the tracker notation of `engine/score.ts`
 * (lengths in sixteenths, sticky within a bar). Every track of a theme spans the
 * same number of bars, so the loop stays in sync (see `score.test.ts`).
 */

/* ---------------- Accompaniment figures ---------------- */

/** Alberti bass in eighths: low, high, middle, high. */
const alberti = (low: string, mid: string, high: string) => `${low}:2 ${high} ${mid} ${high} ${low} ${high} ${mid} ${high}`

/** Chord tones on the offbeats, oom-pah style. */
const offbeats = (a: string, b: string) => `r:2 ${a} r ${b} r ${a} r ${b}`

/** Root and octave bouncing in eighths, the classic driving chiptune bass. */
const pump = (low: string, high: string) => `${low}:2 ${high} ${low} ${high} ${low} ${high} ${low} ${high}`

/** 3+3+2 chord figure (tresillo), twice per bar. */
const tresillo = (a: string, b: string, c: string) => `${a}:3 ${b} ${c}:2 ${a}:3 ${b} ${c}:2`

/** Galloping sixteenth bass for the boss. */
const gallop = (low: string, high: string) => `${low}:2 ${low}:1 ${low} ${high}:2 ${low}:1 ${low} ${low}:2 ${high} ${low}:1 ${low} ${high}:2`

/** Two chord tones swapping every eighth. */
const tremolo = (a: string, b: string) => `${a}:2 ${b} ${a} ${b} ${a} ${b} ${a} ${b}`

const times = (n: number, bar: string) => Array.from({ length: n }, () => bar)

/** Root with a skip up the octave, then the fifth: a bouncy two-beat bass. */
const skip = (low: string, high: string, fifth: string) => `${low}:3 ${high}:1 ${fifth}:4 ${low}:3 ${high}:1 ${fifth}:4`

/** Eighth-note pedal on the root, leaning on the fifth and the octave. */
const ostinato = (root: string, fifth: string, octave: string) =>
  `${root}:2 ${root} ${fifth} ${root} ${octave} ${root} ${fifth} ${root}`

/** Three lonely drops spread over the bar, like water dripping in a cave. */
const drip = (a: string, b: string, c: string) => `r:2 ${a}:1 r:3 ${b}:1 r:3 ${c}:1 r:5`

/** Four chord tones cycling in sixteenths: a glittering, icy arpeggio. */
const sparkle = (a: string, b: string, c: string, d: string) => times(4, `${a}:1 ${b} ${c} ${d}`).join(' ')

/** Dotted quarter, eighth, two quarters: a slow, swaying bass. */
const sway = (low: string, high: string) => `${low}:6 ${high}:2 ${low}:4 ${high}`

/** Low, high, middle, high in eighths, the eerie music-box figure of the tower. */
const creep = (low: string, mid: string, high: string) => `${low}:2 ${mid} ${high} ${mid} ${low} ${mid} ${high} ${mid}`

/* ---------------- Themes ---------------- */

/** Title and starter select: a calm village tune in F major. */
const menu: Score = {
  bpm: 96,
  duty: { lead: 0.25, harmony: 0.125 },
  tracks: {
    // | F | Dm | Bb | C | F | Am | Bb C | F |  then  | Bb | C | Am | Dm | Gm | C7 | F/A Bb | C |
    lead: [
      'C5:3 F5:1 A5:4 G5:2 F5 C5:4',
      'D5:3 F5:1 A5:4 C6 A5',
      'Bb5:6 A5:2 G5:4 F5',
      'G5:8 E5:4 C5',
      'C5:3 F5:1 A5:4 G5:2 F5 C6:4',
      'C6:4 A5:2 E5 A5:4 G5',
      'F5:4 D5:2 F5 E5:4 G5',
      'F5:12 r:4',
      'D6:4 C6:2 Bb5 A5:4 Bb5',
      'C6:6 Bb5:2 G5:8',
      'A5:4 G5:2 A5 C6:4 E5',
      'F5:6 E5:2 D5:8',
      'Bb5:4 A5:2 G5 D5:4 G5',
      'E5:4 F5:2 G5 C6:4 Bb5',
      'A5:4 G5:2 F5 D5:4 F5',
      'G5:6 A5:1 Bb5 C6:4 r',
    ],
    harmony: [
      alberti('F4', 'A4', 'C5'),
      alberti('D4', 'F4', 'A4'),
      alberti('Bb3', 'D4', 'F4'),
      alberti('C4', 'E4', 'G4'),
      alberti('F4', 'A4', 'C5'),
      alberti('A3', 'C4', 'E4'),
      'Bb3:2 F4 D4 F4 C4 G4 E4 G4',
      'F4:2 C5 A4 C5 F4:8',
      offbeats('D4', 'F4'),
      offbeats('E4', 'G4'),
      offbeats('C4', 'E4'),
      offbeats('F4', 'A4'),
      offbeats('Bb3', 'D4'),
      'r:2 E4 r Bb4 r E4 r G4',
      'r:2 C4 r F4 r D4 r F4',
      'r:2 E4 r G4 E4:4 r',
    ],
    bass: [
      'F2:4 A2 C3 A2',
      'D2:4 F2 A2 F2',
      'Bb2:4 F2 D2 F2',
      'C3:4 G2 E2 G2',
      'F2:4 A2 C3 A2',
      'A2:4 E2 C3 E2',
      'Bb2:4 F2 C3 G2',
      'F2:4 C3 F2:8',
      'Bb2:4 F2 D3 F2',
      'C3:4 G2 E3 G2',
      'A2:4 E2 C3 E2',
      'D3:4 A2 F2 A2',
      'G2:4 D3 Bb2 D3',
      'C3:4 G2 E2 G2',
      'A2:4 C3 Bb2 D3',
      'C3:4 G2 C3:2 D3 E3 G2',
    ],
    drums: [
      ...times(7, 'k:4 h:2 h s:4 h'),
      'k:4 h:2 h s s h s',
      ...times(7, 'k:4 h:2 h s:4 h'),
      'k:4 h:2 h s s h s',
    ],
  },
}

/** Route 1, the first biome: an adventurous dungeon march in A minor, with a harmonic-minor turnaround. */
const run: Score = {
  bpm: 138,
  duty: { lead: 0.5, harmony: 0.125 },
  tracks: {
    // | Am | F | G | Em | Am | F | G | G |  then  | F | G | Em | Am | F | G | E | E |
    lead: [
      'A4:2 C5 E5 A5:4 G5:2 E5:4',
      'F5:6 E5:2 C5:4 A4',
      'B4:2 D5 G5:4 F5:2 E5 D5:4',
      'E5:10 B4:2 C5 D5',
      'E5:2 A5 C6:4 B5:2 A5 E5:4',
      'F5:2 G5 A5:4 C6 A5',
      'B5:4 A5:2 G5 D5:4 G5',
      'G5:2 F5 E5 D5 B4:8',
      'A5:6 G5:2 F5:4 C5',
      'D5:6 E5:2 F5:4 G5',
      'G5:6 F5:2 E5:4 B4',
      'C5:2 D5 E5:4 A5:8',
      'C6:6 B5:2 A5:4 F5',
      'G5:6 A5:2 B5:4 D6',
      'E6:8 D6:2 B5 G#5:4',
      'E5:8 G#5:4 B5',
    ],
    harmony: [
      tresillo('C4', 'E4', 'A4'),
      tresillo('C4', 'F4', 'A4'),
      tresillo('B3', 'D4', 'G4'),
      tresillo('B3', 'E4', 'G4'),
      tresillo('C4', 'E4', 'A4'),
      tresillo('C4', 'F4', 'A4'),
      tresillo('B3', 'D4', 'G4'),
      'B3:3 D4 G4:2 D4:2 F4 G4:4',
      tresillo('C4', 'F4', 'A4'),
      tresillo('B3', 'D4', 'G4'),
      tresillo('B3', 'E4', 'G4'),
      tresillo('C4', 'E4', 'A4'),
      tresillo('C4', 'F4', 'A4'),
      tresillo('B3', 'D4', 'G4'),
      tresillo('B3', 'E4', 'G#4'),
      tresillo('B3', 'E4', 'G#4'),
    ],
    bass: [
      pump('A2', 'A3'),
      pump('F2', 'F3'),
      pump('G2', 'G3'),
      pump('E2', 'E3'),
      pump('A2', 'A3'),
      pump('F2', 'F3'),
      pump('G2', 'G3'),
      'G2:2 G3 G2 G3 G2 D3 B2 G2',
      pump('F2', 'F3'),
      pump('G2', 'G3'),
      pump('E2', 'E3'),
      pump('A2', 'A3'),
      pump('F2', 'F3'),
      pump('G2', 'G3'),
      pump('E2', 'E3'),
      'E2:2 E3 E2 E3 G#2 B2 D3 E3',
    ],
    drums: [
      ...times(7, 'k:2 h s h k k s h'),
      'k:2 h s h k:1 s s s s:2 s',
      ...times(7, 'k:2 h s h k k s h'),
      'k:2 h s h k:1 s s s s:2 o',
    ],
  },
}

/** While a boss is alive: a galloping E minor fight with phrygian and tritone bite. */
const boss: Score = {
  bpm: 160,
  duty: { lead: 0.25, harmony: 0.125 },
  tracks: {
    // | Em | Em | C | B | Em | Em | C | D B |  then  | Am | Em | F | B | Am | Em | C | B |
    lead: [
      'E5:8 F5:4 G5',
      'G5:4 F5 E5 B4',
      'C5:8 E5:4 G5',
      'F#5:8 D#5:4 B4',
      'E5:2 r E5 G5 B5:4 A5:2 G5',
      'A5:4 G5:2 F#5 G5:4 E5',
      'G5:2 A5 B5:4 C6 B5:2 G5',
      'A5:4 F#5 D#5 B4',
      'A5:2 C6 E6:4 D6:2 C6 B5:4',
      'G5:2 B5 E6:8 D6:4',
      'F5:2 A5 C6:4 B5:2 A5 F5:4',
      'F#5:12 D#5:4',
      'E6:4 D6:2 C6 B5:4 A5',
      'G5:4 F#5:2 E5 B4:8',
      'C5:2 E5 G5 C6 E6:8',
      'B5:2 A5 G5 F#5 D#5:4 B4',
    ],
    harmony: [
      'B4:16',
      'C5:16',
      'G4:16',
      'F#4:8 A4',
      'B4:16',
      'C5:16',
      'E5:16',
      'F#4:8 D#4',
      tremolo('A4', 'E4'),
      tremolo('G4', 'E4'),
      tremolo('A4', 'F4'),
      tremolo('F#4', 'D#4'),
      tremolo('A4', 'E4'),
      tremolo('G4', 'E4'),
      tremolo('G4', 'E4'),
      tremolo('F#4', 'D#4'),
    ],
    bass: [
      gallop('E2', 'E3'),
      gallop('E2', 'E3'),
      gallop('C2', 'C3'),
      gallop('B1', 'B2'),
      gallop('E2', 'E3'),
      gallop('E2', 'E3'),
      gallop('C2', 'C3'),
      'D2:2 D2:1 D2 D3:2 D2:1 D2 B1:2 B2 B1:1 B1 B2:2',
      gallop('A2', 'A3'),
      gallop('E2', 'E3'),
      gallop('F2', 'F3'),
      gallop('B1', 'B2'),
      gallop('A2', 'A3'),
      gallop('E2', 'E3'),
      gallop('C2', 'C3'),
      gallop('B1', 'B2'),
    ],
    drums: [
      ...times(7, 'k:2 h:1 h s:2 h:1 h k:2 k s h:1 h'),
      's:1 s s s k:2 s:1 s s:2 s:1 s s s k:2',
      ...times(3, 'k:2 h:1 h s:2 h:1 h k:2 k s h:1 h'),
      'k:2 o s k k k s o',
      ...times(3, 'k:2 h:1 h s:2 h:1 h k:2 k s h:1 h'),
      's:1 s s s k:2 s:1 s s:2 s:1 s s s k:2',
    ],
  },
}

/** Viridian Forest: a playful, slightly mysterious walk in D dorian, with an A major turnaround. */
const forest: Score = {
  bpm: 126,
  duty: { lead: 0.25, harmony: 0.125 },
  tracks: {
    // | Dm | C | G | C | Dm | C | G | A |  then  | F | G | Em | Am | F | G | Em A | Dm |
    lead: [
      'D5:3 E5:1 F5:2 A5 G5:4 F5:2 E5',
      'E5:2 G5 C6:4 B5:2 G5 E5:4',
      'D5:3 B4:1 D5:2 G5 F5:4 E5:2 D5',
      'E5:8 G5:2 E5 C5:4',
      'D5:3 E5:1 F5:2 A5 D6:4 C6:2 A5',
      'G5:2 A5 G5 E5 C5:4 E5',
      'B4:2 D5 G5 B5 A5:4 G5:2 F5',
      'E5:8 C#5:4 A4',
      'A5:6 G5:2 F5:4 C5',
      'B5:6 A5:2 G5:4 D5',
      'G5:2 F5 E5 D5 E5:8',
      'C5:2 D5 E5 G5 A5:8',
      'C6:6 A5:2 F5:4 A5',
      'D6:6 B5:2 G5:4 B5',
      'B5:4 G5 A5:2 G5 E5 C#5',
      'D5:12 r:4',
    ],
    harmony: [
      alberti('D4', 'F4', 'A4'),
      alberti('C4', 'E4', 'G4'),
      alberti('B3', 'D4', 'G4'),
      alberti('C4', 'E4', 'G4'),
      alberti('D4', 'F4', 'A4'),
      alberti('C4', 'E4', 'G4'),
      alberti('B3', 'D4', 'G4'),
      alberti('C#4', 'E4', 'A4'),
      alberti('C4', 'F4', 'A4'),
      alberti('B3', 'D4', 'G4'),
      alberti('B3', 'E4', 'G4'),
      alberti('C4', 'E4', 'A4'),
      alberti('C4', 'F4', 'A4'),
      alberti('B3', 'D4', 'G4'),
      'B3:2 G4 E4 G4 C#4 A4 E4 A4',
      'D4:2 A4 F4 A4 D4:8',
    ],
    bass: [
      skip('D2', 'D3', 'A2'),
      skip('C2', 'C3', 'G2'),
      skip('G2', 'G3', 'D3'),
      skip('C2', 'C3', 'G2'),
      skip('D2', 'D3', 'A2'),
      skip('C2', 'C3', 'G2'),
      skip('G2', 'G3', 'D3'),
      skip('A2', 'A3', 'E3'),
      skip('F2', 'F3', 'C3'),
      skip('G2', 'G3', 'D3'),
      skip('E2', 'E3', 'B2'),
      skip('A2', 'A3', 'E3'),
      skip('F2', 'F3', 'C3'),
      skip('G2', 'G3', 'D3'),
      'E2:3 E3:1 B2:4 A2:3 A3:1 E3:4',
      'D2:3 D3:1 A2:4 D2:8',
    ],
    drums: [
      ...times(7, 'k:4 h:2 h s:4 h:2 h'),
      'k:4 h:2 h s:2 s:1 s s:2 s',
      ...times(7, 'k:4 h:2 h s:4 h:2 h'),
      'k:4 h:2 h s:2 s:1 s s:2 o',
    ],
  },
}

/** Mt. Moon: a slow, echoing C minor crawl over a pedal bass, with drips in the dark and a diminished sting. */
const cave: Score = {
  bpm: 104,
  duty: { lead: 0.125, harmony: 0.25 },
  tracks: {
    // | Cm | Ab | Bb | Cm | Cm | Ab | Fm | G |  then  | Ab | Bb | Gm | Cm | Ab | Bb | G7b9 | G |
    lead: [
      'G4:6 C5:2 Eb5:4 D5:2 C5',
      'Eb5:8 C5:4 Ab4',
      'F4:6 Bb4:2 D5:4 C5:2 Bb4',
      'C5:12 r:4',
      'G5:6 F5:2 Eb5:4 G5',
      'Ab5:6 G5:2 F5:4 Eb5',
      'F5:2 Eb5 D5 C5 Ab4:8',
      'B4:8 D5:4 G5',
      'C6:6 Bb5:2 Ab5:4 Eb5',
      'D6:6 C6:2 Bb5:4 F5',
      'G5:2 Bb5 D6 Bb5 G5:8',
      'Eb5:2 G5 C6:12',
      'Ab5:4 G5 F5 Eb5',
      'D5:4 Eb5 F5 Bb5',
      'B5:8 Ab5:4 F5',
      'D5:4 B4 G4:8',
    ],
    harmony: [
      drip('G5', 'C6', 'Eb6'),
      drip('Ab5', 'C6', 'Eb6'),
      drip('F5', 'Bb5', 'D6'),
      drip('G5', 'C6', 'Eb6'),
      drip('G5', 'C6', 'Eb6'),
      drip('Ab5', 'C6', 'Eb6'),
      drip('F5', 'Ab5', 'C6'),
      drip('G5', 'B5', 'D6'),
      offbeats('C4', 'Eb4'),
      offbeats('D4', 'F4'),
      offbeats('D4', 'G4'),
      offbeats('Eb4', 'G4'),
      offbeats('C4', 'Eb4'),
      offbeats('D4', 'F4'),
      offbeats('D4', 'F4'),
      'r:2 D4 r B3 D4:8',
    ],
    bass: [
      ostinato('C2', 'G2', 'C3'),
      ostinato('Ab1', 'Eb2', 'Ab2'),
      ostinato('Bb1', 'F2', 'Bb2'),
      ostinato('C2', 'G2', 'C3'),
      ostinato('C2', 'G2', 'C3'),
      ostinato('Ab1', 'Eb2', 'Ab2'),
      ostinato('F2', 'C3', 'F3'),
      ostinato('G1', 'D2', 'G2'),
      ostinato('Ab1', 'Eb2', 'Ab2'),
      ostinato('Bb1', 'F2', 'Bb2'),
      ostinato('G1', 'D2', 'G2'),
      ostinato('C2', 'G2', 'C3'),
      ostinato('Ab1', 'Eb2', 'Ab2'),
      ostinato('Bb1', 'F2', 'Bb2'),
      ostinato('G1', 'D2', 'G2'),
      'G1:2 G1 D2 G1 G2:8',
    ],
    drums: [
      ...times(7, 'k:6 k:2 s:8'),
      'k:4 s:2 s s:4 s:1 s s s',
      ...times(7, 'k:4 h:2 h s:4 h:2 h'),
      'k:4 s:2 s s:4 s:1 s s s',
    ],
  },
}

/** Mt. Silver: a cold, wide-open E minor climb with a flute-like lead over glittering ice arpeggios. */
const snow: Score = {
  bpm: 116,
  duty: { lead: 0.5, harmony: 0.125 },
  tracks: {
    // | Em | C | G | D | Em | C | Am | B |  then  | C | D | Bm | Em | C | D | B7b9 | B |
    lead: [
      'B4:6 E5:2 G5:4 F#5:2 E5',
      'G5:6 E5:2 C5:8',
      'D5:6 G5:2 B5:4 A5:2 G5',
      'F#5:12 r:4',
      'B5:6 A5:2 G5:4 E5',
      'E6:6 D6:2 C6:4 G5',
      'A5:2 B5 C6 B5 A5:4 E5',
      'D#5:8 F#5:4 B5',
      'C6:4 B5 G5 E5',
      'D6:4 C6 A5 F#5',
      'B5:6 A5:2 F#5:4 D5',
      'E5:2 F#5 G5 A5 B5:8',
      'C6:6 B5:2 A5:4 G5',
      'A5:6 G5:2 F#5:4 D5',
      'D#5:4 F#5 A5 C6',
      'B5:8 F#5:4 D#5',
    ],
    harmony: [
      sparkle('E4', 'G4', 'B4', 'E5'),
      sparkle('E4', 'G4', 'C5', 'E5'),
      sparkle('D4', 'G4', 'B4', 'D5'),
      sparkle('D4', 'F#4', 'A4', 'D5'),
      sparkle('E4', 'G4', 'B4', 'E5'),
      sparkle('E4', 'G4', 'C5', 'E5'),
      sparkle('E4', 'A4', 'C5', 'E5'),
      sparkle('D#4', 'F#4', 'B4', 'D#5'),
      sparkle('E4', 'G4', 'C5', 'E5'),
      sparkle('D4', 'F#4', 'A4', 'D5'),
      sparkle('D4', 'F#4', 'B4', 'D5'),
      sparkle('E4', 'G4', 'B4', 'E5'),
      sparkle('E4', 'G4', 'C5', 'E5'),
      sparkle('D4', 'F#4', 'A4', 'D5'),
      sparkle('D#4', 'F#4', 'A4', 'C5'),
      sparkle('D#4', 'F#4', 'B4', 'D#5'),
    ],
    bass: [
      sway('E2', 'E3'),
      sway('C2', 'C3'),
      sway('G2', 'G3'),
      sway('D2', 'D3'),
      sway('E2', 'E3'),
      sway('C2', 'C3'),
      sway('A2', 'A3'),
      sway('B1', 'B2'),
      sway('C2', 'C3'),
      sway('D2', 'D3'),
      sway('B1', 'B2'),
      sway('E2', 'E3'),
      sway('C2', 'C3'),
      sway('D2', 'D3'),
      sway('B1', 'B2'),
      'B1:6 B2:2 F#2:4 D#2',
    ],
    drums: [
      ...times(7, 'k:8 s:4 h'),
      'k:4 s:2 s s:4 s:1 s s s',
      ...times(7, 'k:4 h:2 k s:4 h'),
      'k:4 s:2 s s:4 s:1 s s o',
    ],
  },
}

/** Lavender Tower: a slow A minor music box over a heartbeat, with chromatic sighs and a Neapolitan shiver. */
const tower: Score = {
  bpm: 96,
  duty: { lead: 0.25, harmony: 0.125 },
  tracks: {
    // | Am | Am/G# | F | E | Am | Dm | Bdim | E |  then  | Dm | Am | F | E7 | Dm | Am | Bb | E |
    lead: [
      'E6:8 D6:4 C6',
      'B5:8 C6:4 B5',
      'A5:12 F5:4',
      'G#5:8 B5:4 D6',
      'C6:6 B5:2 A5:4 E5',
      'F5:6 G5:2 A5:4 D6',
      'F6:4 E6 D6 B5',
      'G#5:12 r:4',
      'D6:6 E6:2 F6:4 D6',
      'E6:6 D6:2 C6:4 A5',
      'C6:2 A5 F5 A5 C6:4 F6',
      'E6:8 D6:4 B5',
      'A5:6 Bb5:2 A5:4 F5',
      'E5:6 F5:2 E5:4 C5',
      'D5:4 F5 Bb5 D6',
      'B5:8 G#5:4 E5',
    ],
    harmony: [
      creep('A4', 'C5', 'E5'),
      creep('G#4', 'C5', 'E5'),
      creep('A4', 'C5', 'F5'),
      creep('G#4', 'B4', 'E5'),
      creep('A4', 'C5', 'E5'),
      creep('A4', 'D5', 'F5'),
      creep('B4', 'D5', 'F5'),
      creep('G#4', 'B4', 'E5'),
      creep('A4', 'D5', 'F5'),
      creep('A4', 'C5', 'E5'),
      creep('A4', 'C5', 'F5'),
      creep('G#4', 'B4', 'D5'),
      creep('A4', 'D5', 'F5'),
      creep('A4', 'C5', 'E5'),
      creep('Bb4', 'D5', 'F5'),
      creep('G#4', 'B4', 'E5'),
    ],
    bass: [
      'A2:8 E2',
      'G#2:8 E2',
      'F2:8 C3',
      'E2:8 B1',
      'A2:8 E2',
      'D2:8 A2',
      'B1:8 F2',
      'E2:8 B1',
      'D2:8 A2',
      'A2:8 E2',
      'F2:8 C3',
      'E2:8 G#2',
      'D2:8 A2',
      'A2:8 E2',
      'Bb1:8 F2',
      'E2:8 E2',
    ],
    drums: [
      ...times(7, 'k:2 k:14'),
      'k:2 k:6 h:2 h h h',
      ...times(7, 'k:2 k:6 h:8'),
      'k:2 k:6 h:2 h h o',
    ],
  },
}


/** Rolling waves under Kyogre: a long swell on the root, up to the fifth and the octave, and back down. */
const swell = (root: string, fifth: string, octave: string) => `${root}:3 ${root} ${fifth}:2 ${octave}:3 ${fifth}:3 ${root}:2`

/** Kyogre's domain (Primordial Sea): a storm in D minor over rolling waves, with a Phrygian surge into A major. */
const kyogre: Score = {
  bpm: 138,
  duty: { lead: 0.5, harmony: 0.125 },
  tracks: {
    // | Dm | Dm | Bb | C | Dm | Gm | A | A |  then  | Bb | C | Dm | Bb | Gm | A | Dm | A |
    lead: [
      'D5:6 E5:2 F5:4 A5:4',
      'G5:4 F5:2 E5 D5:8',
      'Bb4:4 D5 F5 Bb5',
      'A5:6 G5:2 E5:8',
      'D5:2 F5 A5 D6:6 C6:2 A5:2',
      'Bb5:4 A5:2 G5 D5:8',
      'E5:4 A4 C#5 E5',
      'A5:12 r:4',
      'F5:3 G5:1 A5:4 Bb5 A5',
      'G5:3 A5:1 G5:4 E5 C5',
      'D5:2 E5 F5 A5 D6:8',
      'D6:4 C6:2 Bb5 F5:8',
      'G5:4 Bb5 D6 G5',
      'C#6:6 Bb5:2 A5:4 E5',
      'F5:2 E5 D5 A4 D5:8',
      'E5:4 C#5 A4 E4',
    ],
    harmony: [
      tremolo('F4', 'A4'),
      tremolo('F4', 'A4'),
      tremolo('F4', 'D4'),
      tremolo('G4', 'E4'),
      tremolo('F4', 'A4'),
      tremolo('G4', 'Bb4'),
      tremolo('E4', 'C#5'),
      tremolo('E4', 'C#5'),
      tremolo('F4', 'D4'),
      tremolo('G4', 'E4'),
      tremolo('F4', 'A4'),
      tremolo('F4', 'D4'),
      tremolo('G4', 'Bb4'),
      tremolo('E4', 'C#5'),
      tremolo('F4', 'A4'),
      tremolo('E4', 'C#5'),
    ],
    bass: [
      swell('D2', 'A2', 'D3'),
      swell('D2', 'A2', 'D3'),
      swell('Bb1', 'F2', 'Bb2'),
      swell('C2', 'G2', 'C3'),
      swell('D2', 'A2', 'D3'),
      swell('G1', 'D2', 'G2'),
      swell('A1', 'E2', 'A2'),
      swell('A1', 'E2', 'A2'),
      swell('Bb1', 'F2', 'Bb2'),
      swell('C2', 'G2', 'C3'),
      swell('D2', 'A2', 'D3'),
      swell('Bb1', 'F2', 'Bb2'),
      swell('G1', 'D2', 'G2'),
      swell('A1', 'E2', 'A2'),
      swell('D2', 'A2', 'D3'),
      swell('A1', 'E2', 'A2'),
    ],
    drums: [
      ...times(7, 'k:3 h k:2 s:4 k:2 h:2'),
      's:2 s s s k:2 s s o',
      ...times(7, 'k:3 h k:2 s:4 k:2 h:2'),
      's:2 s s s k:2 s s o',
    ],
  },
}

/** A heavy stomp on the root with a kick up the octave, under Groudon. */
const stomp = (low: string, high: string) => `${low}:3 ${low}:1 r:2 ${low}:2 ${high}:3 ${low}:1 ${low}:2 ${high}:2`

/** Groudon's domain (Desolate Land): a pounding C minor march over stomping bass, leaning on the Phrygian Db. */
const groudon: Score = {
  bpm: 120,
  duty: { lead: 0.25, harmony: 0.125 },
  tracks: {
    // | Cm | Cm | Db | Db | Cm | Ab | Bb | G |  then  | Ab | Bb | Cm | Db | Fm | G | Cm | G |
    lead: [
      'C5:4 Eb5:2 F5 G5:6 Ab5:2',
      'G5:4 F5:2 Eb5 C5:8',
      'Db5:4 F5 Ab5 Db6',
      'C6:6 Bb5:2 Ab5:8',
      'G5:2 Ab5 G5 F5 Eb5:4 G5',
      'Ab5:6 G5:2 Eb5:4 C5',
      'D5:4 F5 Bb5:6 Ab5:2',
      'B4:4 D5 G5:8',
      'C6:3 Bb5:1 Ab5:4 Eb5 C5',
      'D6:3 C6:1 Bb5:4 F5 D5',
      'Eb6:6 D6:2 C6:8',
      'Db6:4 C6 Bb5 Ab5',
      'Ab5:2 C6 F6:4 Eb6:2 Db6 C6:4',
      'B5:6 D6:2 G6:8',
      'G6:4 Eb6:2 C6 G5:4 Eb5',
      'D5:4 F5 G5:2 Ab5 B5:4',
    ],
    harmony: [
      tremolo('Eb4', 'G4'),
      tremolo('Eb4', 'G4'),
      tremolo('F4', 'Ab4'),
      tremolo('F4', 'Ab4'),
      tremolo('Eb4', 'G4'),
      tremolo('Eb4', 'C5'),
      tremolo('D4', 'F4'),
      tremolo('B3', 'D4'),
      tremolo('Eb4', 'C5'),
      tremolo('D4', 'F4'),
      tremolo('Eb4', 'G4'),
      tremolo('F4', 'Ab4'),
      tremolo('Ab4', 'C5'),
      tremolo('B3', 'D4'),
      tremolo('Eb4', 'G4'),
      tremolo('B3', 'D4'),
    ],
    bass: [
      stomp('C2', 'C3'),
      stomp('C2', 'C3'),
      stomp('Db2', 'Db3'),
      stomp('Db2', 'Db3'),
      stomp('C2', 'C3'),
      stomp('Ab1', 'Ab2'),
      stomp('Bb1', 'Bb2'),
      stomp('G1', 'G2'),
      stomp('Ab1', 'Ab2'),
      stomp('Bb1', 'Bb2'),
      stomp('C2', 'C3'),
      stomp('Db2', 'Db3'),
      stomp('F1', 'F2'),
      stomp('G1', 'G2'),
      stomp('C2', 'C3'),
      stomp('G1', 'G2'),
    ],
    drums: [
      ...times(7, 'k:2 k k:4 s:4 k:2 k'),
      'k:2 k s s k:1 k k k s:4',
      ...times(7, 'k:2 k k:4 s:4 k:2 k'),
      'k:2 k s s k:1 k k k o:4',
    ],
  },
}

/** The Eon duo's domain (Southern Island): a dreamy duet in E major, Latias's lead over Latios's glittering arpeggios. */
const latis: Score = {
  bpm: 126,
  duty: { lead: 0.25, harmony: 0.125 },
  tracks: {
    // | E | C#m | A | B | E | G#m | A | B |  then  | C#m | A | E | B | C#m | F#m | A B | E |
    lead: [
      'B4:4 E5:2 F#5 G#5:6 B5:2',
      'C#6:6 B5:2 G#5:8',
      'A5:4 G#5:2 F#5 E5:4 C#5',
      'D#5:6 E5:2 F#5:8',
      'B4:2 E5 G#5 B5 E6:6 D#6:2',
      'D#6:4 B5:2 G#5 D#5:8',
      'C#5:4 E5 A5 C#6',
      'B5:12 r:4',
      'G#5:3 A5:1 G#5:4 E5 C#5',
      'A5:3 B5:1 C#6:4 B5 A5',
      'G#5:2 F#5 E5 F#5 G#5:8',
      'F#5:6 D#5:2 B4:8',
      'E5:4 G#5 C#6 E6',
      'C#6:6 B5:2 A5:4 F#5',
      'A5:4 C#6 B5 D#6',
      'E6:12 r:4',
    ],
    harmony: [
      sparkle('E4', 'G#4', 'B4', 'G#4'),
      sparkle('C#4', 'E4', 'G#4', 'E4'),
      sparkle('A3', 'C#4', 'E4', 'C#4'),
      sparkle('B3', 'D#4', 'F#4', 'D#4'),
      sparkle('E4', 'G#4', 'B4', 'G#4'),
      sparkle('G#3', 'B3', 'D#4', 'B3'),
      sparkle('A3', 'C#4', 'E4', 'C#4'),
      sparkle('B3', 'D#4', 'F#4', 'D#4'),
      sparkle('C#4', 'E4', 'G#4', 'E4'),
      sparkle('A3', 'C#4', 'E4', 'C#4'),
      sparkle('E4', 'G#4', 'B4', 'G#4'),
      sparkle('B3', 'D#4', 'F#4', 'D#4'),
      sparkle('C#4', 'E4', 'G#4', 'E4'),
      sparkle('F#3', 'A3', 'C#4', 'A3'),
      'A3:1 C#4 E4 C#4 A3 C#4 E4 C#4 B3 D#4 F#4 D#4 B3 D#4 F#4 D#4',
      sparkle('E4', 'G#4', 'B4', 'G#4'),
    ],
    bass: [
      sway('E2', 'B2'),
      sway('C#2', 'G#2'),
      sway('A1', 'E2'),
      sway('B1', 'F#2'),
      sway('E2', 'B2'),
      sway('G#1', 'D#2'),
      sway('A1', 'E2'),
      sway('B1', 'F#2'),
      sway('C#2', 'G#2'),
      sway('A1', 'E2'),
      sway('E2', 'B2'),
      sway('B1', 'F#2'),
      sway('C#2', 'G#2'),
      sway('F#1', 'C#2'),
      'A1:8 B1:8',
      sway('E2', 'B2'),
    ],
    drums: [
      ...times(7, 'k:4 h:2 h s:4 h:2 h'),
      's:2 s s s k:4 o:4',
      ...times(7, 'k:4 h:2 h s:4 h:2 h'),
      's:2 s s s k:4 o:4',
    ],
  },
}

/** Lugia's domain (the Whirl Islands in a storm): a soaring E minor over driving octaves, wind arpeggios in the harmony. */
const lugia: Score = {
  bpm: 150,
  duty: { lead: 0.25, harmony: 0.125 },
  tracks: {
    // | Em | C | D | Bm | Em | C | Am | B |  then  | G | D | Em | C | Am | B | Em | B |
    lead: [
      'E5:6 F#5:2 G5:4 B5:4',
      'C6:4 B5:2 A5 G5:8',
      'A5:6 F#5:2 D5:4 A5',
      'F#5:12 r:4',
      'B4:2 E5 G5 B5 E6:6 D6:2',
      'C6:4 B5:2 G5 E5:8',
      'A5:4 C6 E6 C6',
      'D#6:8 B5:4 F#5',
      'G5:3 A5:1 B5:4 D6 B5',
      'A5:3 B5:1 A5:4 F#5 D5',
      'E5:2 F#5 G5 B5 E6:8',
      'E6:4 D6:2 C6 G5:8',
      'A5:4 C6 E6 A5',
      'D#6:6 C6:2 B5:4 F#5',
      'G5:2 F#5 E5 B4 E5:8',
      'F#5:4 D#5 B4 F#4',
    ],
    harmony: [
      sparkle('E4', 'G4', 'B4', 'G4'),
      sparkle('C4', 'E4', 'G4', 'E4'),
      sparkle('D4', 'F#4', 'A4', 'F#4'),
      sparkle('B3', 'D4', 'F#4', 'D4'),
      sparkle('E4', 'G4', 'B4', 'G4'),
      sparkle('C4', 'E4', 'G4', 'E4'),
      sparkle('A3', 'C4', 'E4', 'C4'),
      sparkle('B3', 'D#4', 'F#4', 'D#4'),
      sparkle('G3', 'B3', 'D4', 'B3'),
      sparkle('D4', 'F#4', 'A4', 'F#4'),
      sparkle('E4', 'G4', 'B4', 'G4'),
      sparkle('C4', 'E4', 'G4', 'E4'),
      sparkle('A3', 'C4', 'E4', 'C4'),
      sparkle('B3', 'D#4', 'F#4', 'D#4'),
      sparkle('E4', 'G4', 'B4', 'G4'),
      sparkle('B3', 'D#4', 'F#4', 'D#4'),
    ],
    bass: [
      pump('E2', 'E3'), pump('C2', 'C3'), pump('D2', 'D3'), pump('B1', 'B2'),
      pump('E2', 'E3'), pump('C2', 'C3'), pump('A1', 'A2'), pump('B1', 'B2'),
      pump('G1', 'G2'), pump('D2', 'D3'), pump('E2', 'E3'), pump('C2', 'C3'),
      pump('A1', 'A2'), pump('B1', 'B2'), pump('E2', 'E3'), pump('B1', 'B2'),
    ],
    drums: [
      ...times(7, 'k:2 h s h k k s h'),
      's:1 s s s s s s s k:2 s k o',
      ...times(7, 'k:2 h s h k k s h'),
      's:1 s s s s s s s k:2 s k o',
    ],
  },
}

/** Ho-Oh's domain (the burning Bell Tower): a regal G minor fanfare over a galloping skip, chords in tresillo. */
const hoOh: Score = {
  bpm: 132,
  duty: { lead: 0.5, harmony: 0.25 },
  tracks: {
    // | Gm | Eb | F | Bb | Gm | Eb | Cm | D |  then  | Eb | F | Gm | Eb | Cm | D | Gm | D |
    lead: [
      'G4:4 Bb4:2 D5 G5:8',
      'G5:4 F5:2 Eb5 Bb4:8',
      'A4:4 C5:2 F5 A5:8',
      'Bb5:6 A5:2 F5:4 D5',
      'D5:2 G5 Bb5 D6 Bb5:8',
      'C6:4 Bb5:2 G5 Eb5:8',
      'Eb5:4 G5 C6 Eb6',
      'D6:12 r:4',
      'Eb6:6 D6:2 Bb5:4 G5',
      'F5:6 G5:2 A5:4 C6',
      'D6:2 C6 Bb5 A5 G5:8',
      'Bb5:4 C6:2 Bb5 G5:8',
      'C5:2 Eb5 G5 C6 Eb6:8',
      'F#5:4 A5 D6 C6',
      'Bb5:2 A5 G5 D5 G5:8',
      'A5:4 F#5 D5 A4',
    ],
    harmony: [
      tresillo('G4', 'Bb4', 'D5'), tresillo('G4', 'Bb4', 'Eb5'), tresillo('A4', 'C5', 'F5'), tresillo('Bb4', 'D5', 'F5'),
      tresillo('G4', 'Bb4', 'D5'), tresillo('G4', 'Bb4', 'Eb5'), tresillo('G4', 'C5', 'Eb5'), tresillo('F#4', 'A4', 'D5'),
      tresillo('G4', 'Bb4', 'Eb5'), tresillo('A4', 'C5', 'F5'), tresillo('G4', 'Bb4', 'D5'), tresillo('G4', 'Bb4', 'Eb5'),
      tresillo('G4', 'C5', 'Eb5'), tresillo('F#4', 'A4', 'D5'), tresillo('G4', 'Bb4', 'D5'), tresillo('F#4', 'A4', 'D5'),
    ],
    bass: [
      skip('G1', 'G2', 'D2'), skip('Eb2', 'Eb3', 'Bb2'), skip('F1', 'F2', 'C2'), skip('Bb1', 'Bb2', 'F2'),
      skip('G1', 'G2', 'D2'), skip('Eb2', 'Eb3', 'Bb2'), skip('C2', 'C3', 'G2'), skip('D2', 'D3', 'A2'),
      skip('Eb2', 'Eb3', 'Bb2'), skip('F1', 'F2', 'C2'), skip('G1', 'G2', 'D2'), skip('Eb2', 'Eb3', 'Bb2'),
      skip('C2', 'C3', 'G2'), skip('D2', 'D3', 'A2'), skip('G1', 'G2', 'D2'), skip('D2', 'D3', 'A2'),
    ],
    drums: [
      ...times(7, 'k:4 s k:2 k s:4'),
      's:2 s s s s:1 s s s o:4',
      ...times(7, 'k:4 s k:2 k s:4'),
      's:2 s s s s:1 s s s o:4',
    ],
  },
}

/** Tick, tock: two chord tones on the beats, a clock in the harmony. */
const tick = (a: string, b: string) => `${a}:1 r:3 ${b}:1 r:3 ${a}:1 r:3 ${b}:1 r:3`

/** Dialga's domain (Spear Pillar, time unravelling): a driving C minor over a pedal ostinato, the harmony ticking like a clock. */
const dialga: Score = {
  bpm: 144,
  duty: { lead: 0.25, harmony: 0.125 },
  tracks: {
    // | Cm | Ab | Bb | G | Cm | Fm | G | G |  then  | Ab | Bb | Cm | Ab | Fm | G | Cm | G |
    lead: [
      'C5:4 Eb5 G5 C6',
      'C6:6 Bb5:2 Ab5:4 Eb5',
      'D5:4 F5 Bb5 D6',
      'B5:8 G5:4 D5',
      'Eb5:2 D5 C5 G4 C5:8',
      'F5:4 Ab5 C6 Ab5',
      'G5:6 F5:2 D5:4 B4',
      'G4:12 r:4',
      'Ab5:3 G5:1 Ab5:4 C6 Eb6',
      'D6:3 C6:1 Bb5:4 F5 D5',
      'G5:2 Ab5 G5 Eb5 C5:8',
      'Eb6:6 D6:2 C6:4 Ab5',
      'F5:4 Ab5 C6 F6',
      'D6:6 B5:2 G5:4 F5',
      'Eb5:2 D5 Eb5 G5 C6:8',
      'B5:4 G5 D5 B4',
    ],
    harmony: [
      tick('G4', 'C5'), tick('Ab4', 'C5'), tick('F4', 'Bb4'), tick('G4', 'B4'),
      tick('G4', 'C5'), tick('F4', 'Ab4'), tick('G4', 'B4'), tick('G4', 'B4'),
      tick('Ab4', 'C5'), tick('F4', 'Bb4'), tick('G4', 'C5'), tick('Ab4', 'C5'),
      tick('F4', 'Ab4'), tick('G4', 'B4'), tick('G4', 'C5'), tick('G4', 'B4'),
    ],
    bass: [
      ostinato('C2', 'G2', 'C3'), ostinato('Ab1', 'Eb2', 'Ab2'), ostinato('Bb1', 'F2', 'Bb2'), ostinato('G1', 'D2', 'G2'),
      ostinato('C2', 'G2', 'C3'), ostinato('F1', 'C2', 'F2'), ostinato('G1', 'D2', 'G2'), ostinato('G1', 'D2', 'G2'),
      ostinato('Ab1', 'Eb2', 'Ab2'), ostinato('Bb1', 'F2', 'Bb2'), ostinato('C2', 'G2', 'C3'), ostinato('Ab1', 'Eb2', 'Ab2'),
      ostinato('F1', 'C2', 'F2'), ostinato('G1', 'D2', 'G2'), ostinato('C2', 'G2', 'C3'), ostinato('G1', 'D2', 'G2'),
    ],
    drums: [
      ...times(7, 'k:2 h:2 s:2 h:2 k:2 k:2 s:2 h:2'),
      's:1 s s s k:2 s s:1 s s s o:4',
      ...times(7, 'k:2 h:2 s:2 h:2 k:2 k:2 s:2 h:2'),
      's:1 s s s k:2 s s:1 s s s o:4',
    ],
  },
}

/** Rayquaza's domain (the Sky Pillar's roof): a fast, soaring G mixolydian anthem over glittering arpeggios. */
const rayquaza: Score = {
  bpm: 156,
  duty: { lead: 0.25, harmony: 0.125 },
  tracks: {
    // | G | F | C | G | Em | C | D | D |  then  | C | D | Bm | Em | C | F | D | D |
    lead: [
      'G5:6 A5:2 B5:4 D6',
      'C6:6 A5:2 F5:8',
      'E5:2 G5 C6:4 B5:2 A5 G5:4',
      'D6:12 B5:4',
      'B5:4 G5:2 A5 B5:4 E6',
      'E6:6 D6:2 C6:4 G5',
      'F#5:2 A5 D6:4 C6:2 B5 A5:4',
      'A5:12 r:4',
      'G5:3 A5:1 C6:4 E6 C6',
      'F#6:6 E6:2 D6:8',
      'D6:4 B5:2 D6 F#6:4 D6',
      'E6:6 G6:2 E6:4 B5',
      'C6:2 E6 G6:4 E6:2 C6 G5:4',
      'F6:6 E6:2 C6:4 A5',
      'D6:4 F#6 A6:8',
      'G6:2 F#6 E6 D6 C6:4 A5',
    ],
    harmony: [
      sparkle('G4', 'B4', 'D5', 'G5'),
      sparkle('F4', 'A4', 'C5', 'F5'),
      sparkle('E4', 'G4', 'C5', 'E5'),
      sparkle('G4', 'B4', 'D5', 'G5'),
      sparkle('E4', 'G4', 'B4', 'E5'),
      sparkle('E4', 'G4', 'C5', 'E5'),
      sparkle('D4', 'F#4', 'A4', 'D5'),
      sparkle('D4', 'F#4', 'A4', 'D5'),
      sparkle('E4', 'G4', 'C5', 'E5'),
      sparkle('D4', 'F#4', 'A4', 'D5'),
      sparkle('D4', 'F#4', 'B4', 'D5'),
      sparkle('E4', 'G4', 'B4', 'E5'),
      sparkle('E4', 'G4', 'C5', 'E5'),
      sparkle('F4', 'A4', 'C5', 'F5'),
      sparkle('D4', 'F#4', 'A4', 'D5'),
      sparkle('D4', 'F#4', 'A4', 'C5'),
    ],
    bass: [
      pump('G2', 'G3'),
      pump('F2', 'F3'),
      pump('C2', 'C3'),
      pump('G2', 'G3'),
      pump('E2', 'E3'),
      pump('C2', 'C3'),
      pump('D2', 'D3'),
      pump('D2', 'D3'),
      pump('C2', 'C3'),
      pump('D2', 'D3'),
      pump('B1', 'B2'),
      pump('E2', 'E3'),
      pump('C2', 'C3'),
      pump('F2', 'F3'),
      pump('D2', 'D3'),
      pump('D2', 'D3'),
    ],
    drums: [
      ...times(7, 'k:2 h s h k h s h'),
      's:2 s s:1 s s:2 s s:1 s s:2 s',
      ...times(7, 'k:2 h s h k h s h'),
      's:2 s s:1 s s:2 s s:1 s k:2 o',
    ],
  },
}

/** Deoxys's domain (a meteoroid in space): a cold gallop in B minor, the lead leaning on tritones like a signal from far off. */
const deoxys: Score = {
  bpm: 152,
  duty: { lead: 0.125, harmony: 0.25 },
  tracks: {
    // | Bm | Bm | G | F# | Bm | C | F# | F# |  then  | Em | F | Bm | G | Em | C | F# | F# |
    lead: [
      'B4:2 r F#5 r B5:4 A5:2 F5',
      'F#5:6 E5:2 D5:4 C#5',
      'D5:2 G5 B5 D6 C#6:8',
      'A#5:6 G5:2 F#5:8',
      'B5:2 r B5 D6 F6:4 E6:2 D6',
      'E6:4 C6:2 G5 E5:8',
      'F#5:3 A#5:1 C#6:4 E6 A#5',
      'F#5:12 r:4',
      'G5:4 E5:2 G5 B5:4 G5',
      'A5:4 F5:2 A5 C6:8',
      'D6:2 C#6 B5 A#5 B5:8',
      'G5:6 A5:2 B5:4 D6',
      'E6:4 D6:2 B5 G5:4 E5',
      'F5:6 E5:2 C5:8',
      'A#4:4 C#5 E5 F#5',
      'A#5:12 r:4',
    ],
    harmony: [
      tremolo('D4', 'F#4'),
      tremolo('D4', 'F#4'),
      tremolo('D4', 'B3'),
      tremolo('C#4', 'A#3'),
      tremolo('D4', 'F#4'),
      tremolo('E4', 'G4'),
      tremolo('C#4', 'A#3'),
      tremolo('C#4', 'A#3'),
      tremolo('E4', 'G4'),
      tremolo('F4', 'A4'),
      tremolo('D4', 'F#4'),
      tremolo('D4', 'B3'),
      tremolo('E4', 'G4'),
      tremolo('E4', 'G4'),
      tremolo('C#4', 'A#3'),
      tremolo('C#4', 'A#3'),
    ],
    bass: [
      gallop('B1', 'B2'),
      gallop('B1', 'B2'),
      gallop('G1', 'G2'),
      gallop('F#1', 'F#2'),
      gallop('B1', 'B2'),
      gallop('C2', 'C3'),
      gallop('F#1', 'F#2'),
      gallop('F#1', 'F#2'),
      gallop('E1', 'E2'),
      gallop('F1', 'F2'),
      gallop('B1', 'B2'),
      gallop('G1', 'G2'),
      gallop('E1', 'E2'),
      gallop('C2', 'C3'),
      gallop('F#1', 'F#2'),
      gallop('F#1', 'F#2'),
    ],
    drums: [
      ...times(7, 'k:2 h k h s h k s'),
      's:1 s s s s s s s k:2 s k o',
      ...times(7, 'k:2 h k h s h k s'),
      's:1 s s s s s s s k:2 s k o',
    ],
  },
}

/* ---------------- The wave legendaries (`data/legendBosses.ts`) ---------------- */

/** The Kanto birds: a soaring E minor over bouncing octaves, glittering chord arpeggios on top. */
const birds: Score = {
  bpm: 150,
  duty: { lead: 0.5, harmony: 0.125 },
  tracks: {
    // | Em | C | D | B | Em | C | Am | B7 |
    lead: [
      'E5:6 F#5:2 G5:4 B5:4',
      'C6:6 B5:2 G5:8',
      'A5:4 F#5 D5 A5',
      'B5:12 D#5:4',
      'E5:2 G5 B5 E6:6 D6:2 B5:2',
      'C6:4 E6 G5:2 A5 B5 C6',
      'A5:6 C6:2 B5:4 A5',
      'F#5:4 A5 B5:8',
    ],
    harmony: [
      sparkle('E4', 'G4', 'B4', 'G4'),
      sparkle('C4', 'E4', 'G4', 'E4'),
      sparkle('D4', 'F#4', 'A4', 'F#4'),
      sparkle('B3', 'D#4', 'F#4', 'D#4'),
      sparkle('E4', 'G4', 'B4', 'G4'),
      sparkle('C4', 'E4', 'G4', 'E4'),
      sparkle('A3', 'C4', 'E4', 'C4'),
      sparkle('A3', 'B3', 'D#4', 'F#4'),
    ],
    bass: [pump('E2', 'E3'), pump('C2', 'C3'), pump('D2', 'D3'), pump('B1', 'B2'), pump('E2', 'E3'), pump('C2', 'C3'), pump('A1', 'A2'), pump('B1', 'B2')],
    drums: [...times(7, 'k:2 h s h k k s h'), 's:2 s s s k:2 s s o'],
  },
}

/** Johto's beasts: a G minor chase on a galloping bass. */
const beasts: Score = {
  bpm: 160,
  duty: { lead: 0.25, harmony: 0.125 },
  tracks: {
    // | Gm | Gm | Eb | F | Gm | Bb | Cm | D |
    lead: [
      'G5:3 G5:1 Bb5:4 D6:4 C6:2 Bb5:2',
      'A5:4 G5:2 F5:2 G5:8',
      'Eb5:3 G5:1 Bb5:4 Eb6:8',
      'D6:4 C6 A5 F5',
      'G5:2 Bb5 D6 G6:6 F6:2 D6:2',
      'F6:4 D6:2 Bb5 F5:8',
      'Eb6:4 D6 C6 G5',
      'F#5:8 A5:4 D6',
    ],
    harmony: [
      tremolo('Bb4', 'D5'),
      tremolo('Bb4', 'D5'),
      tremolo('G4', 'Bb4'),
      tremolo('A4', 'C5'),
      tremolo('Bb4', 'D5'),
      tremolo('D5', 'F5'),
      tremolo('Eb5', 'G4'),
      tremolo('F#4', 'A4'),
    ],
    bass: [gallop('G1', 'G2'), gallop('G1', 'G2'), gallop('Eb2', 'Eb3'), gallop('F1', 'F2'), gallop('G1', 'G2'), gallop('Bb1', 'Bb2'), gallop('C2', 'C3'), gallop('D2', 'D3')],
    drums: [...times(7, 'k:2 h s h k:1 k h:2 s h'), 's:1 s s s s:2 s k:4 o'],
  },
}

/** Hoenn's Regis: slow and heavy, C minor leaning on the flat second, with the braille's beeping figure. */
const regis: Score = {
  bpm: 104,
  duty: { lead: 0.125, harmony: 0.25 },
  tracks: {
    // | Cm | Db | Cm | Bb | Ab | Db | G | G |
    lead: [
      'C5:2 r Eb5 r G5:4 C6:4',
      'Db6:6 C6:2 Ab5:8',
      'G5:2 r Eb5 r C5:8',
      'D5:4 F5 Bb5 D6',
      'C6:6 Bb5:2 Ab5:4 Eb5',
      'F5:4 Ab5 Db6 F6',
      'G5:2 B5 D6 G6 F6:4 D6',
      'B5:12 r:4',
    ],
    harmony: [
      creep('C4', 'Eb4', 'G4'),
      creep('Db4', 'F4', 'Ab4'),
      creep('C4', 'Eb4', 'G4'),
      creep('Bb3', 'D4', 'F4'),
      creep('Ab3', 'C4', 'Eb4'),
      creep('Db4', 'F4', 'Ab4'),
      creep('G3', 'B3', 'D4'),
      creep('G3', 'B3', 'D4'),
    ],
    bass: [sway('C2', 'G2'), sway('Db2', 'Ab2'), sway('C2', 'G2'), sway('Bb1', 'F2'), sway('Ab1', 'Eb2'), sway('Db2', 'Ab2'), sway('G1', 'D2'), sway('G1', 'D2')],
    drums: [...times(7, 'k:4 h:2 h s:4 k:2 h'), 'k:4 s:2 s s s k:2 o'],
  },
}

/** Mewtwo's finale (the mythicals join it): a fast A minor storm with a Neapolitan turn. */
const mewtwo: Score = {
  bpm: 168,
  duty: { lead: 0.5, harmony: 0.125 },
  tracks: {
    // | Am | F | Dm | E | Am | Bb | Dm E | E |
    lead: [
      'A5:2 C6 E6 A6:6 G#6:2 E6:2',
      'F6:4 E6:2 C6 A5:8',
      'D6:3 E6:1 F6:4 A6:4 F6',
      'E6:6 D6:2 B5:4 G#5',
      'A5:2 B5 C6 E6 A6:8',
      'Bb6:4 A6:2 F6 D6:8',
      'F6:4 D6 E6 G#6',
      'B6:8 G#6:4 E6',
    ],
    harmony: [
      sparkle('A4', 'C5', 'E5', 'C5'),
      sparkle('F4', 'A4', 'C5', 'A4'),
      sparkle('D4', 'F4', 'A4', 'F4'),
      sparkle('E4', 'G#4', 'B4', 'G#4'),
      sparkle('A4', 'C5', 'E5', 'C5'),
      sparkle('Bb4', 'D5', 'F5', 'D5'),
      sparkle('D4', 'F4', 'E4', 'G#4'),
      sparkle('E4', 'G#4', 'B4', 'G#4'),
    ],
    bass: [gallop('A1', 'A2'), gallop('F1', 'F2'), gallop('D2', 'D3'), gallop('E1', 'E2'), gallop('A1', 'A2'), gallop('Bb1', 'Bb2'), gallop('D2', 'E2'), gallop('E1', 'E2')],
    drums: [...times(7, 'k:2 h s h k h s s'), 's:1 s s s s s s s k:2 s k s'],
  },
}

/** Arceus, the reaper: a stately D major with a Lydian lift (the E major chord), like an organ in a temple. */
const arceus: Score = {
  bpm: 112,
  duty: { lead: 0.25, harmony: 0.5 },
  tracks: {
    // | D | E/D | Bm | G | D | E | A | A7 |
    lead: [
      'D5:8 F#5:4 A5',
      'G#5:8 B5:4 E6',
      'D6:6 C#6:2 B5:4 F#5',
      'G5:4 B5 D6 G6',
      'F#6:8 E6:4 D6',
      'E6:6 F#6:2 G#6:4 B5',
      'C#6:4 E6 A6 G6',
      'A6:12 r:4',
    ],
    harmony: [
      tremolo('F#4', 'A4'),
      tremolo('G#4', 'B4'),
      tremolo('D4', 'F#4'),
      tremolo('B4', 'D5'),
      tremolo('F#4', 'A4'),
      tremolo('G#4', 'B4'),
      tremolo('C#5', 'E5'),
      tremolo('C#5', 'G4'),
    ],
    bass: [
      ostinato('D2', 'A2', 'D3'),
      ostinato('D2', 'B2', 'D3'),
      ostinato('B1', 'F#2', 'B2'),
      ostinato('G1', 'D2', 'G2'),
      ostinato('D2', 'A2', 'D3'),
      ostinato('E2', 'B2', 'E3'),
      ostinato('A1', 'E2', 'A2'),
      ostinato('A1', 'E2', 'A2'),
    ],
    drums: [...times(7, 'k:4 h s:4 h'), 'k:2 k s:4 k:2 k s:2 o'],
  },
}

/** Route 109: a sunny C major beach tune, the chords strummed in a lazy tresillo over a bouncing bass. */
const beach: Score = {
  bpm: 138,
  duty: { lead: 0.5, harmony: 0.25 },
  tracks: {
    // | C | Am | F | G | C | Am | Dm G | C |  then  | F | G | Em | Am | F | G | Dm G | C |
    lead: [
      'E5:3 G5:1 C6:4 B5:2 A5 G5:4',
      'A5:6 G5:2 E5:4 C5',
      'F5:3 A5:1 C6:4 A5:2 F5 A5:4',
      'G5:8 D5:4 B4',
      'E5:3 G5:1 C6:4 D6:2 C6 E6:4',
      'C6:4 A5:2 E5 A5:4 C6',
      'D6:2 C6 A5 F5 G5:4 B5',
      'C6:12 r:4',
      'A5:6 C6:2 A5:4 F5',
      'B5:6 D6:2 B5:4 G5',
      'G5:2 B5 E6 B5 G5:8',
      'A5:2 C6 E6 C6 A5:8',
      'F5:4 A5 C6 F6',
      'D6:4 B5 G5 D5',
      'F5:2 A5 D6 C6 B5:4 G5',
      'C6:8 G5:4 C5',
    ],
    harmony: [
      tresillo('E4', 'G4', 'C5'),
      tresillo('E4', 'A4', 'C5'),
      tresillo('F4', 'A4', 'C5'),
      tresillo('D4', 'G4', 'B4'),
      tresillo('E4', 'G4', 'C5'),
      tresillo('E4', 'A4', 'C5'),
      'D4:3 F4 A4:2 D4:3 G4 B4:2',
      tresillo('E4', 'G4', 'C5'),
      tresillo('F4', 'A4', 'C5'),
      tresillo('D4', 'G4', 'B4'),
      tresillo('E4', 'G4', 'B4'),
      tresillo('E4', 'A4', 'C5'),
      tresillo('F4', 'A4', 'C5'),
      tresillo('D4', 'G4', 'B4'),
      'D4:3 F4 A4:2 D4:3 G4 B4:2',
      'E4:3 G4 C5:2 E4:8',
    ],
    bass: [
      skip('C2', 'C3', 'G2'),
      skip('A1', 'A2', 'E2'),
      skip('F1', 'F2', 'C2'),
      skip('G1', 'G2', 'D2'),
      skip('C2', 'C3', 'G2'),
      skip('A1', 'A2', 'E2'),
      'D2:3 D3:1 A2:4 G1:3 G2:1 D2:4',
      skip('C2', 'C3', 'G2'),
      skip('F1', 'F2', 'C2'),
      skip('G1', 'G2', 'D2'),
      skip('E2', 'E3', 'B2'),
      skip('A1', 'A2', 'E2'),
      skip('F1', 'F2', 'C2'),
      skip('G1', 'G2', 'D2'),
      'D2:3 D3:1 A2:4 G1:3 G2:1 D2:4',
      'C2:3 C3:1 G2:4 C2:8',
    ],
    drums: [
      ...times(7, 'k:3 h:1 s:2 h k:3 h:1 s:4'),
      'k:2 h s h k h s:1 s s s',
      ...times(7, 'k:3 h:1 s:2 h k:3 h:1 s:4'),
      'k:2 s s s:1 s s s s s o:4',
    ],
  },
}

/** The Power Plant: a humming A minor machine, the bass pumping like a turbine under a thin, buzzing lead. */
const plant: Score = {
  bpm: 132,
  duty: { lead: 0.125, harmony: 0.25 },
  tracks: {
    // | Am | Am | F | G | Am | Am | F | E |  then  | Dm | Em | F | G | Dm | E | F E | Am |
    lead: [
      'A4:2 A4 C5 A4 E5:4 D5:2 C5',
      'B4:2 C5 B4 G4 A4:8',
      'F4:2 A4 C5 F5 E5:4 C5',
      'D5:2 B4 G4 B4 D5:4 G5',
      'A5:2 A5 G5 A5 E5:4 C5',
      'D5:2 E5 C5 B4 A4:8',
      'F5:2 E5 F5 A5 C6:4 A5',
      'G#5:8 E5:4 B4',
      'D5:3 F5:1 A5:4 G5:2 F5 E5:4',
      'E5:3 G5:1 B5:4 A5:2 G5 F#5:4',
      'F5:3 A5:1 C6:4 B5:2 A5 G5:4',
      'G5:8 B5:4 D6',
      'F6:4 E6:2 D6 A5:4 F5',
      'G#5:4 B5:2 D6 E6:8',
      'C6:4 B5 A5 G#5',
      'A5:12 r:4',
    ],
    harmony: [
      tremolo('C4', 'E4'),
      tremolo('C4', 'E4'),
      tremolo('A3', 'C4'),
      tremolo('B3', 'D4'),
      tremolo('C4', 'E4'),
      tremolo('C4', 'E4'),
      tremolo('A3', 'C4'),
      tremolo('B3', 'E4'),
      tremolo('D4', 'F4'),
      tremolo('E4', 'G4'),
      tremolo('F4', 'A4'),
      tremolo('D4', 'G4'),
      tremolo('D4', 'F4'),
      tremolo('D4', 'G#4'),
      'C4:2 F4 C4 F4 B3 E4 B3 E4',
      'C4:2 E4 C4 E4 A3:8',
    ],
    bass: [
      pump('A1', 'A2'),
      pump('A1', 'A2'),
      pump('F1', 'F2'),
      pump('G1', 'G2'),
      pump('A1', 'A2'),
      pump('A1', 'A2'),
      pump('F1', 'F2'),
      pump('E1', 'E2'),
      pump('D2', 'D3'),
      pump('E2', 'E3'),
      pump('F1', 'F2'),
      pump('G1', 'G2'),
      pump('D2', 'D3'),
      pump('E2', 'E3'),
      'F1:2 F2 F1 F2 E1 E2 E1 E2',
      'A1:2 A2 A1 A2 A1:8',
    ],
    drums: [
      ...times(7, 'k:2 h s h k k s h'),
      'k:2 h s h k:1 k s s s:2 o',
      ...times(7, 'k:2 h s h k k s h'),
      's:1 s s s k:2 s k s:1 s o:4',
    ],
  },
}

/** Route 111's desert: a slow E Phrygian sway under the sandstorm, a lone lead wandering over the dunes. */
const desert: Score = {
  bpm: 116,
  duty: { lead: 0.25, harmony: 0.125 },
  tracks: {
    // | E | F | E | Dm | E | F | G | F E |  then  | Am | G | F | E | Am | G | F | E |
    lead: [
      'E5:6 F5:2 G#5:4 F5:2 E5',
      'F5:6 E5:2 D5:4 C5',
      'B4:2 C5 D5 E5 G#5:8',
      'F5:4 D5 A4 D5',
      'E5:6 F5:2 G#5:4 B5',
      'C6:6 B5:2 A5:4 F5',
      'G5:2 F5 E5 D5 B4:8',
      'C5:4 A4 B4:8',
      'A5:6 C6:2 E6:4 C6',
      'B5:6 D6:2 B5:4 G5',
      'A5:2 G5 F5 E5 F5:4 A5',
      'G#5:8 E5:4 B4',
      'A5:6 B5:2 C6:4 E6',
      'D6:6 C6:2 B5:4 G5',
      'A5:2 B5 C6 A5 F5:8',
      'E5:12 r:4',
    ],
    harmony: [
      offbeats('G#4', 'B4'),
      offbeats('A4', 'C5'),
      offbeats('G#4', 'B4'),
      offbeats('F4', 'A4'),
      offbeats('G#4', 'B4'),
      offbeats('A4', 'C5'),
      offbeats('G4', 'B4'),
      'r:2 A4 r C5 r G#4 r B4',
      offbeats('A4', 'C5'),
      offbeats('G4', 'B4'),
      offbeats('A4', 'C5'),
      offbeats('G#4', 'B4'),
      offbeats('A4', 'C5'),
      offbeats('G4', 'B4'),
      offbeats('F4', 'A4'),
      'r:2 G#4 r B4 E4:8',
    ],
    bass: [
      sway('E2', 'B2'),
      sway('F2', 'C3'),
      sway('E2', 'B2'),
      sway('D2', 'A2'),
      sway('E2', 'B2'),
      sway('F2', 'C3'),
      sway('G2', 'D3'),
      'F2:6 C3:2 E2:4 B2',
      sway('A1', 'E2'),
      sway('G2', 'D3'),
      sway('F2', 'C3'),
      sway('E2', 'B2'),
      sway('A1', 'E2'),
      sway('G2', 'D3'),
      sway('F2', 'C3'),
      'E2:6 B2:2 E2:8',
    ],
    drums: [
      ...times(7, 'k:4 h:2 k s:4 h:2 h'),
      'k:4 h:2 k s:2 s:1 s s:2 o',
      ...times(7, 'k:4 h:2 k s:4 h:2 h'),
      'k:4 h:2 k s:2 s:1 s s:2 o',
    ],
  },
}

/** Mt. Chimney: a fierce D minor gallop, the bass pounding like the mountain's rumble. */
const volcano: Score = {
  bpm: 150,
  duty: { lead: 0.25, harmony: 0.125 },
  tracks: {
    // | Dm | Bb | C | A | Dm | Bb | Gm A | Dm |  then  | Bb | C | Am | Dm | Bb | C | A7 | A |
    lead: [
      'D5:2 F5 A5 D6 C6:4 A5',
      'Bb5:6 A5:2 F5:4 D5',
      'E5:2 G5 C6 E6 D6:4 C6',
      'C#6:8 A5:4 E5',
      'D6:2 C6 A5 F5 A5:4 D6',
      'F6:6 E6:2 D6:4 Bb5',
      'G5:2 Bb5 D6 G6 E6:4 C#6',
      'D6:12 r:4',
      'F5:3 Bb5:1 D6:4 C6:2 Bb5 F5:4',
      'G5:3 C6:1 E6:4 D6:2 C6 G5:4',
      'A5:2 C6 E6 C6 A5:8',
      'D6:4 F6 D6 A5',
      'Bb5:2 D6 F6 D6 Bb5:4 F5',
      'C6:2 E6 G6 E6 C6:4 G5',
      'C#6:4 E6 G6 E6',
      'A6:8 E6:4 C#6',
    ],
    harmony: [
      tremolo('F4', 'A4'),
      tremolo('F4', 'Bb4'),
      tremolo('E4', 'G4'),
      tremolo('E4', 'C#5'),
      tremolo('F4', 'A4'),
      tremolo('F4', 'Bb4'),
      'D4:2 G4 D4 G4 E4 A4 E4 A4',
      tremolo('F4', 'A4'),
      tremolo('D4', 'F4'),
      tremolo('E4', 'G4'),
      tremolo('E4', 'A4'),
      tremolo('F4', 'A4'),
      tremolo('D4', 'F4'),
      tremolo('E4', 'G4'),
      tremolo('E4', 'G4'),
      tremolo('C#4', 'E4'),
    ],
    bass: [
      gallop('D2', 'D3'),
      gallop('Bb1', 'Bb2'),
      gallop('C2', 'C3'),
      gallop('A1', 'A2'),
      gallop('D2', 'D3'),
      gallop('Bb1', 'Bb2'),
      'G1:2 G1:1 G1 G2:2 G1:1 G1 A1:2 A2 A1:1 A1 A2:2',
      gallop('D2', 'D3'),
      gallop('Bb1', 'Bb2'),
      gallop('C2', 'C3'),
      gallop('A1', 'A2'),
      gallop('D2', 'D3'),
      gallop('Bb1', 'Bb2'),
      gallop('C2', 'C3'),
      gallop('A1', 'A2'),
      gallop('A1', 'A2'),
    ],
    drums: [
      ...times(7, 'k:2 h s h k k s h'),
      's:1 s s s s s s s k:2 s k o',
      ...times(7, 'k:2 h s h k k s h'),
      's:1 s s s s s s s k:2 s k o',
    ],
  },
}

export const THEMES = { menu, run, boss, forest, cave, snow, tower, beach, plant, desert, volcano, kyogre, groudon, rayquaza, lugia, hoOh, dialga, latis, deoxys, birds, beasts, regis, mewtwo, arceus } as const satisfies Record<string, Score>

export type ThemeId = keyof typeof THEMES
