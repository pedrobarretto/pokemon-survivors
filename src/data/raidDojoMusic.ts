import type { Score } from '../engine/score'

/**
 * Original themes for the Tera Raid den and the Dojo (`data/music.ts` spreads
 * them into `THEMES`; the shell's `gameTheme` in `main.ts` picks them): the
 * raid's crystalline fight, the Dojo's training and the Torre's trials. Same
 * tracker notation as every theme (`engine/score.ts`). The Dojo's two are
 * pentatonic, their koto-like lead plucked in short notes with rests (the
 * synth has one gate per channel, so the pluck is in the writing).
 */

const times = <T>(n: number, bar: T) => Array.from({ length: n }, () => bar)

/* ---------------- Accompaniment figures ---------------- */

/** Four chord tones cycling in sixteenths, high and light: the raid's crystal glitter. */
const prism = (a: string, b: string, c: string, d: string) => times(4, `${a}:1 ${b} ${c} ${d}`).join(' ')

/** 3+3+2 twice a bar on the root, the octave on the twos: the raid's surging bass. */
const surge = (low: string, high: string) => `${low}:3 ${low} ${high}:2 ${low}:3 ${low} ${high}:2`

/** Three chord tones in quarters, there and back: a slow second koto. */
const strum = (a: string, b: string, c: string) => `${a}:4 ${b} ${c} ${b}`

/** Three chord tones rippling in eighths, the second koto waking up. */
const ripple = (a: string, b: string, c: string) => `${a}:2 ${b} ${c} ${b} ${a} ${b} ${c} ${b}`

/** A low note, a breath, its octave, the low note again and a rest: the Dojo's unhurried bass. */
const breath = (low: string, high: string) => `${low}:4 r:2 ${high}:2 ${low}:4 r:4`

/** Two tones in eighths with gaps, struck hard: the Torre's comp. */
const strike = (a: string, b: string) => `${a}:2 r ${b} r ${a} ${a} ${b} r`

/** Two tones trembling in sixteenths, a koto's tremolo. */
const shiver = (a: string, b: string) => times(8, `${a}:1 ${b}`).join(' ')

/** Root, root, octave in sixteenths and an eighth, four times a bar: the Torre's charging bass. */
const charge = (low: string, high: string) => times(4, `${low}:1 ${low} ${high}:2`).join(' ')

/** The Dojo's big drum, a bar each: one deep stroke and a double, then a pickup and a rim. */
const DON = 'k:8 h:4 k:2 k'
const DODON = 'k:6 k:2 h:4 s'

/* ---------------- Themes ---------------- */

/**
 * Inside a Tera Raid den: an epic F♯ minor fight over sixteenth-note crystal
 * arpeggios and a surging 3+3+2 bass, its dominant major (the harmonic minor's
 * C♯) for the edge, and a brighter, climbing second half.
 */
const teraRaid: Score = {
  bpm: 148,
  duty: { lead: 0.25, harmony: 0.125 },
  tracks: {
    // | F#m | D | E | C# | F#m | D | Bm | C# |  then  | D | E | C#m | F#m | Bm | E | Dmaj7 | C# |
    lead: [
      'F#5:6 G#5:2 A5:4 C#6',
      'D6:6 C#6:2 A5:8',
      'B5:4 G#5:2 B5 E6:6 D6:2',
      'C#6:2 B5 G#5 F5 C#5:8',
      'F#5:2 A5 C#6 F#6:6 E6:2 C#6',
      'D6:4 E6:2 F#6 A6:6 F#6:2',
      'F#6:4 E6:2 D6 B5:4 D6',
      'C#6:8 F5:4 G#5',
      'A5:2 D6 F#6:4 E6:2 D6 A5:4',
      'B5:2 E6 G#6:4 F#6:2 E6 B5:4',
      'G#5:2 C#6 E6:4 D#6:2 C#6 G#5:4',
      'A5:6 G#5:2 F#5:8',
      'D6:2 C#6 B5 F#5 B5:4 D6',
      'E6:2 D6 B5 G#5 E6:4 G#6',
      'A6:6 F#6:2 C#6:4 A5',
      'G#5:2 C#6 F6 G#6 F6:4 C#6',
    ],
    harmony: [
      prism('F#4', 'A4', 'C#5', 'F#5'),
      prism('F#4', 'A4', 'D5', 'F#5'),
      prism('G#4', 'B4', 'E5', 'G#5'),
      prism('G#4', 'C#5', 'F5', 'G#5'),
      prism('F#4', 'A4', 'C#5', 'F#5'),
      prism('F#4', 'A4', 'D5', 'F#5'),
      prism('F#4', 'B4', 'D5', 'F#5'),
      'G#4:1 C#5 F5 G#5 G#4 C#5 F5 G#5 C#5:8',
      prism('A4', 'D5', 'F#5', 'A5'),
      prism('B4', 'E5', 'G#5', 'B5'),
      prism('G#4', 'C#5', 'E5', 'G#5'),
      prism('A4', 'C#5', 'F#5', 'A5'),
      prism('B4', 'D5', 'F#5', 'B5'),
      prism('B4', 'E5', 'G#5', 'B5'),
      prism('A4', 'C#5', 'D5', 'F#5'),
      prism('G#4', 'C#5', 'F5', 'G#5'),
    ],
    bass: [
      surge('F#2', 'F#3'),
      surge('D2', 'D3'),
      surge('E2', 'E3'),
      surge('C#2', 'C#3'),
      surge('F#2', 'F#3'),
      surge('D2', 'D3'),
      surge('B1', 'B2'),
      'C#2:3 C#2 C#3:2 C#2:1 C#2 C#3:2 E2 D#2',
      surge('D2', 'D3'),
      surge('E2', 'E3'),
      surge('C#2', 'C#3'),
      surge('F#2', 'F#3'),
      surge('B1', 'B2'),
      surge('E2', 'E3'),
      surge('D2', 'D3'),
      'C#2:3 C#2 C#3:2 C#2:3 C#2 G#2:2',
    ],
    drums: [
      ...times(3, 'k:2 h:1 h s:2 h:1 h k:1 k h:2 s:2 h'),
      'k:2 h:1 h s:2 h:1 h k:2 s:1 s s:2 o',
      ...times(3, 'k:2 h:1 h s:2 h:1 h k:1 k h:2 s:2 h'),
      's:1 s s s s:2 s k:2 s:1 s k:2 o',
      ...times(7, 'k:2 h:1 k s:2 h:1 h k:2 h:1 k s:2 h:1 h'),
      'k:2 k s:1 s s s k:4 o',
    ],
  },
}

/**
 * The Dojo's training: a calm, focused D minor pentatonic (D F G A C, nothing
 * else). A plucked koto-like lead with quick runs and a tremolo, a second koto
 * that wakes up in the second half, a breathing bass and a sparse big-drum pattern.
 */
const dojo: Score = {
  bpm: 92,
  duty: { lead: 0.125, harmony: 0.25 },
  tracks: {
    // | D | F | C | D | F | G | C | D |  then  | D | F | G | C | F | A | G | D |
    lead: [
      'D5:2 r A4 D5 F5:1 G5 A5:2 r:4',
      'C6:2 A5 r G5 A5:1 r:7',
      'G5:2 r F5 G5 C6:1 A5 G5:2 r:4',
      'A5:1 G5 F5 D5 C5:2 r D5:1 r:7',
      'F5:2 r A5 C6 D6:1 C6 A5:2 r:4',
      'G5:2 A5 C6:1 r:3 D6:1 D6 D6 D6 C6:2 r',
      'A5:2 G5 F5:1 G5 A5:2 C5:1 D5 F5 G5 A5:2 r',
      'D5:1 r:3 A4:1 r:3 D5:1 r:7',
      'D5:1 F5 G5 A5 C6:4 A5:2 C6 D6:4',
      'C6:2 r A5 G5 A5:1 r:3 F5:2 G5',
      'A5:1 C6 D6 F6 G6:4 F6:2 D6 C6 A5',
      'G5:1 G5 G5 G5 A5:2 G5 F5:1 D5 r:6',
      'F5:2 A5 C6 F6:1 r:3 D6:2 C6 A5:1 r',
      'C6:2 D6 C6 A5:1 G5 A5:2 G5:1 F5 D5:2 C5',
      'D5:1 F5 G5 A5 G5 A5 C6 D6 C6:2 A5 G5:1 F5 G5:2',
      'D5:1 r:3 A5:1 r:3 D6:1 r:7',
    ],
    harmony: [
      strum('D4', 'A4', 'C5'),
      strum('F4', 'A4', 'C5'),
      strum('C4', 'G4', 'A4'),
      strum('D4', 'A4', 'C5'),
      strum('F4', 'A4', 'C5'),
      strum('D4', 'G4', 'C5'),
      strum('C4', 'G4', 'A4'),
      'D4:4 A4 D5:8',
      ripple('D4', 'A4', 'C5'),
      ripple('F4', 'A4', 'C5'),
      ripple('D4', 'G4', 'C5'),
      ripple('C4', 'G4', 'A4'),
      ripple('F4', 'A4', 'C5'),
      ripple('A3', 'D4', 'G4'),
      ripple('D4', 'G4', 'C5'),
      'D4:2 A4 D5 A4 D4:8',
    ],
    bass: [
      breath('D2', 'D3'),
      breath('F2', 'F3'),
      breath('C2', 'C3'),
      breath('D2', 'D3'),
      breath('F2', 'F3'),
      breath('G1', 'G2'),
      breath('C2', 'C3'),
      'D2:4 r:2 A1:2 D2:8',
      breath('D2', 'D3'),
      breath('F2', 'F3'),
      breath('G1', 'G2'),
      breath('C2', 'C3'),
      breath('F2', 'F3'),
      breath('A1', 'A2'),
      breath('G1', 'G2'),
      'D2:4 r:2 A1:2 D2:8',
    ],
    drums: [
      ...times(3, [DON, DODON]).flat(),
      DON,
      'k:4 k k:2 k k:1 k k:2',
      ...times(3, [DON, DODON]).flat(),
      DON,
      'k:2 k k:4 s:2 s:1 s k:4',
    ],
  },
}

/**
 * A Torre trial at the Dojo: the same Japanese pentatonic family as the Dojo's
 * theme, now the dark in scale on D (D E♭ G A B♭, its half steps biting),
 * faster and driving, struck comps and koto tremolos, and heavy drums.
 */
const kubfuTower: Score = {
  bpm: 152,
  duty: { lead: 0.25, harmony: 0.125 },
  tracks: {
    // | D | G | Eb | D | G | A | Bb | A |  then  | Bb | A | G | D | Eb | D | Bb A | D |
    lead: [
      'D5:2 r D5:1 Eb5 D5:2 A4:4 Bb4:2 A4',
      'G4:2 A4 Bb4 D5 Eb5:4 D5:2 r',
      'Eb5:2 r Eb5:1 G5 Eb5:2 Bb4:4 D5:2 Eb5',
      'D5:1 Eb5 D5 Bb4 A4:4 r:2 A4:1 Bb4 D5:4',
      'G5:2 r G5:1 A5 G5:2 D5:4 Eb5:2 D5',
      'A5:2 Bb5 A5 G5 Eb5:4 D5:2 Eb5',
      'Bb4:1 D5 Eb5 G5 A5 Bb5 D6 Eb6 D6:4 Bb5:2 A5',
      'A5:1 G5 Eb5 D5 Eb5:4 D5:2 A4:6',
      'D6:2 r D6:1 Eb6 D6:2 Bb5:4 A5:2 Bb5',
      'A5:2 r A5:1 Bb5 A5:2 Eb5:4 D5:2 Eb5',
      'G5:1 A5 Bb5 D6 G6:4 Eb6:2 D6 Bb5 A5',
      'D6:1 D6 D6 D6 Eb6:2 D6 A5:4 r:2 D5',
      'Eb6:2 D6 Bb5 G5 Eb5:4 G5:2 Bb5',
      'A5:2 G5 Eb5 D5 A4:4 D5:2 Eb5',
      'D5:1 Eb5 G5 A5 Bb5 A5 G5 Eb5 A5 Bb5 D6 Eb6 D6:2 A5',
      'D6:4 A5:2 Eb5 D5:4 r:2 D4',
    ],
    harmony: [
      strike('D4', 'A4'),
      strike('G4', 'Bb4'),
      strike('Eb4', 'Bb4'),
      strike('D4', 'A4'),
      strike('G4', 'Bb4'),
      strike('A4', 'Eb5'),
      strike('Bb4', 'D5'),
      strike('A4', 'Eb5'),
      shiver('Bb4', 'D5'),
      shiver('A4', 'Eb5'),
      shiver('G4', 'Bb4'),
      shiver('D4', 'A4'),
      shiver('Eb4', 'Bb4'),
      shiver('D4', 'A4'),
      `${times(4, 'Bb4:1 D5').join(' ')} ${times(4, 'A4:1 Eb5').join(' ')}`,
      'D4:1 A4 D4 A4 D4 A4 D4 A4 D5:4 A4',
    ],
    bass: [
      charge('D2', 'D3'),
      charge('G1', 'G2'),
      charge('Eb2', 'Eb3'),
      charge('D2', 'D3'),
      charge('G1', 'G2'),
      charge('A1', 'A2'),
      charge('Bb1', 'Bb2'),
      charge('A1', 'A2'),
      charge('Bb1', 'Bb2'),
      charge('A1', 'A2'),
      charge('G1', 'G2'),
      charge('D2', 'D3'),
      charge('Eb2', 'Eb3'),
      charge('D2', 'D3'),
      'Bb1:1 Bb1 Bb2:2 Bb1:1 Bb1 Bb2:2 A1:1 A1 A2:2 A1:1 A1 A2:2',
      'D2:1 D2 D3:2 D2:1 D2 D3:2 D2:4 A1',
    ],
    drums: [
      ...times(7, 'k:2 h s h k k s h'),
      'k:2 k k:1 k k:2 s:1 s s s k:2 o',
      ...times(7, 'k:2 k:1 k s:2 h k k:1 k s:2 h:1 h'),
      'k:1 k k k s:2 k:1 k k:2 s:1 s s s k:2',
    ],
  },
}

export const RAID_DOJO_THEMES = { teraRaid, dojo, kubfuTower } as const satisfies Record<string, Score>
