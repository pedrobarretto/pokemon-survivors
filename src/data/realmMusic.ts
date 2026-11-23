import type { Score } from '../engine/score'

/**
 * The Poké Realm's own themes (spread into `THEMES` in `data/music.ts`), in the
 * tracker notation of `engine/score.ts`. All original. Which one plays where
 * is the shell's (`realmMusic.ts`): a town room's, a mini game's
 * (`MINIGAMES[id].theme`), the Safári's battle.
 */

/* ---------------- Accompaniment figures ---------------- */

const times = (n: number, bar: string) => Array.from({ length: n }, () => bar)

/** Chord tones on the offbeats, oom-pah style. */
const offbeats = (a: string, b: string) => `r:2 ${a} r ${b} r ${a} r ${b}`

/** Alberti figure in eighths: low, high, middle, high. */
const alberti = (low: string, mid: string, high: string) => `${low}:2 ${high} ${mid} ${high} ${low} ${high} ${mid} ${high}`

/** Root with a skip up the octave, then the fifth: a bouncy two-beat bass. */
const skip = (low: string, high: string, fifth: string) => `${low}:3 ${high}:1 ${fifth}:4 ${low}:3 ${high}:1 ${fifth}:4`

/** Root and octave bouncing in eighths, the driving chiptune bass. */
const pump = (low: string, high: string) => `${low}:2 ${high} ${low} ${high} ${low} ${high} ${low} ${high}`

/** 3+3+2 chord figure (tresillo), twice per bar. */
const tresillo = (a: string, b: string, c: string) => `${a}:3 ${b} ${c}:2 ${a}:3 ${b} ${c}:2`

/** Galloping sixteenth bass, for a fight. */
const gallop = (low: string, high: string) => `${low}:2 ${low}:1 ${low} ${high}:2 ${low}:1 ${low} ${low}:2 ${high} ${low}:1 ${low} ${high}:2`

/** Two chord tones swapping every eighth. */
const tremolo = (a: string, b: string) => `${a}:2 ${b} ${a} ${b} ${a} ${b} ${a} ${b}`

/** A walking bass: four quarter notes. */
const walk = (a: string, b: string, c: string, d: string) => `${a}:4 ${b} ${c} ${d}`

/** Swing comping: a stab on beat 2 and one pushed onto the and of 3. */
const comp = (a: string, b: string) => `r:4 ${a}:2 r:4 ${b}:2 r:4`

/** Dotted quarter, eighth, two quarters: a slow, swaying bass. */
const sway = (low: string, high: string) => `${low}:6 ${high}:2 ${low}:4 ${high}`

/** Four chord tones cycling in sixteenths: the arcade's bleeping arpeggio. */
const sparkle = (a: string, b: string, c: string, d: string) => times(4, `${a}:1 ${b} ${c} ${d}`).join(' ')

/** Short knocks a beat apart, like a pick on rock. */
const clink = (a: string, b: string) => `${a}:1 r:3 ${b}:1 r:3 ${a}:1 r:3 ${b}:1 r:3`

/** A chisel's rhythm on the bass: two hits, a breath, the fifth, and again. */
const chisel = (root: string, fifth: string) => `${root}:3 ${root}:1 r:2 ${fifth}:2 ${root}:3 ${root}:1 ${fifth}:2 ${root}:2`

/** Root and fifth hopping in staccato eighths. */
const hop = (root: string, fifth: string) => `${root}:2 r ${fifth} r ${root} r ${fifth} r`

/* ---------------- Themes ---------------- */

/** The Realm's cities: a bright, chatty G major stroll, the bass skipping along under offbeat chords. */
const realmTown: Score = {
  bpm: 116,
  duty: { lead: 0.25, harmony: 0.125 },
  tracks: {
    // | G | Em | C | D | G | Bm | C D | G |  then  | C | D | Bm | Em | Am | D | C | D |
    lead: [
      'D5:2 G5 B5:3 A5:1 G5:4 D5',
      'E5:2 G5 B5:3 C6:1 B5:4 G5',
      'C6:3 B5:1 A5:2 G5 E5:4 G5',
      'F#5:6 E5:2 D5:8',
      'D5:2 G5 B5:3 A5:1 G5:2 B5 D6:4',
      'D6:3 B5:1 A5:2 F#5 D5:4 F#5',
      'E5:2 G5 C6:4 A5:2 F#5 D5:4',
      'G5:12 r:4',
      'E6:4 D6:2 C6 G5:4 E5',
      'F#5:4 A5:2 D6 C6:4 A5',
      'B5:4 A5:2 F#5 D5:4 F#5',
      'G5:6 F#5:2 E5:8',
      'A5:3 C6:1 E6:4 D6:2 C6 A5:4',
      'F#5:3 A5:1 D6:4 C6:2 A5 F#5:4',
      'E5:2 G5 C6 E6 D6:4 C6',
      'A5:4 F#5:2 E5 D5:4 r',
    ],
    harmony: [
      offbeats('G4', 'B4'),
      offbeats('G4', 'B4'),
      offbeats('G4', 'C5'),
      offbeats('F#4', 'A4'),
      offbeats('G4', 'B4'),
      offbeats('F#4', 'B4'),
      'r:2 G4 r C5 r F#4 r A4',
      'r:2 G4 r B4 G4:8',
      alberti('C4', 'E4', 'G4'),
      alberti('D4', 'F#4', 'A4'),
      alberti('B3', 'D4', 'F#4'),
      alberti('E4', 'G4', 'B4'),
      alberti('A3', 'C4', 'E4'),
      alberti('D4', 'F#4', 'A4'),
      alberti('C4', 'E4', 'G4'),
      alberti('D4', 'F#4', 'C5'),
    ],
    bass: [
      skip('G2', 'G3', 'D3'),
      skip('E2', 'E3', 'B2'),
      skip('C2', 'C3', 'G2'),
      skip('D2', 'D3', 'A2'),
      skip('G2', 'G3', 'D3'),
      skip('B1', 'B2', 'F#2'),
      'C2:3 C3:1 G2:4 D2:3 D3:1 A2:4',
      'G2:3 G3:1 D3:4 G2:8',
      skip('C2', 'C3', 'G2'),
      skip('D2', 'D3', 'A2'),
      skip('B1', 'B2', 'F#2'),
      skip('E2', 'E3', 'B2'),
      skip('A1', 'A2', 'E2'),
      skip('D2', 'D3', 'A2'),
      skip('C2', 'C3', 'G2'),
      'D2:3 D3:1 A2:4 D2:2 E2 F#2 A2',
    ],
    drums: [
      ...times(7, 'k:3 h:1 h:2 k s:4 h:2 h'),
      'k:4 h:2 h s:2 s:1 s s:2 o',
      ...times(7, 'k:3 h:1 h:2 k s:4 h:2 h'),
      'k:4 h:2 h s:2 s:1 s s:2 o',
    ],
  },
}

/** The Zona Safári's tall grass: an outdoorsy E major trek with a mixolydian D, galloping on a tresillo. */
const safariField: Score = {
  bpm: 132,
  duty: { lead: 0.5, harmony: 0.25 },
  tracks: {
    // | E | D | A | E | E | D | A B | B |  then  | C#m | A | B | E | C#m | A | F#m B | B |
    lead: [
      'B4:2 E5 G#5:4 B5:6 A5:2',
      'A5:3 F#5:1 D5:4 A5:2 B5 A5:4',
      'E5:2 A5 C#6:4 B5:2 A5 E5:4',
      'G#5:8 r:2 E5 F#5 G#5',
      'B5:4 E6 D6:2 B5 G#5:4',
      'A5:6 F#5:2 D6:4 A5',
      'C#6:4 A5:2 E5 D#6:4 F#5',
      'B5:12 r:4',
      'G#5:3 E5:1 C#5:4 E5:2 G#5 C#6:4',
      'C#6:6 B5:2 A5:4 E5',
      'D#5:3 F#5:1 B5:4 A5:2 F#5 D#5:4',
      'E5:6 G#5:2 B5:8',
      'C#6:3 B5:1 G#5:4 E6 C#6',
      'E6:6 C#6:2 A5:4 C#6',
      'A5:4 C#6 B5:2 D#6 F#6:4',
      'F#6:2 D#6 B5 A5 F#5:4 D#5',
    ],
    harmony: [
      tresillo('G#4', 'B4', 'E5'),
      tresillo('F#4', 'A4', 'D5'),
      tresillo('A4', 'C#5', 'E5'),
      tresillo('G#4', 'B4', 'E5'),
      tresillo('G#4', 'B4', 'E5'),
      tresillo('F#4', 'A4', 'D5'),
      'A4:3 C#5 E5:2 B4:3 D#5 F#5:2',
      tresillo('F#4', 'B4', 'D#5'),
      tresillo('G#4', 'C#5', 'E5'),
      tresillo('A4', 'C#5', 'E5'),
      tresillo('F#4', 'B4', 'D#5'),
      tresillo('G#4', 'B4', 'E5'),
      tresillo('G#4', 'C#5', 'E5'),
      tresillo('A4', 'C#5', 'E5'),
      'F#4:3 A4 C#5:2 F#4:3 B4 D#5:2',
      tresillo('F#4', 'B4', 'D#5'),
    ],
    bass: [
      pump('E2', 'E3'),
      pump('D2', 'D3'),
      pump('A1', 'A2'),
      pump('E2', 'E3'),
      pump('E2', 'E3'),
      pump('D2', 'D3'),
      'A1:2 A2 A1 A2 B1 B2 B1 B2',
      'B1:2 B2 B1 B2 B1 F#2 A2 B2',
      pump('C#2', 'C#3'),
      pump('A1', 'A2'),
      pump('B1', 'B2'),
      pump('E2', 'E3'),
      pump('C#2', 'C#3'),
      pump('A1', 'A2'),
      'F#1:2 F#2 F#1 F#2 B1 B2 B1 B2',
      'B1:2 B2 B1 B2 D#2 F#2 A2 B2',
    ],
    drums: [
      ...times(7, 'k:2 h s h k h s h'),
      'k:2 h s h k:1 s s s s:2 o',
      ...times(7, 'k:2 h s h k h s h'),
      'k:2 h s h k:1 s s s s:2 o',
    ],
  },
}

/** A wild Pokémon in the Safári: a short, breathless B minor fight with a lydian sting and a Neapolitan C. */
const safariBattle: Score = {
  bpm: 172,
  duty: { lead: 0.25, harmony: 0.125 },
  tracks: {
    // | Bm | Bm | G | F# | Bm | Bm | G A | F# |  then  | Em | Bm | G | F# | Em | Bm | C | F#7 |
    lead: [
      'B4:2 D5 F#5 B5 A5:4 F#5:2 D5',
      'E5:2 F#5 D5:4 B4:8',
      'G5:2 B5 D6:4 C#6:2 B5 G5:4',
      'A#5:8 F#5:4 C#5',
      'B5:2 r B5 D6 F#6:4 E6:2 D6',
      'C#6:4 B5:2 A5 B5:4 F#5',
      'G5:2 B5 D6:4 E6:2 C#6 A5:4',
      'A#5:4 C#6 F#6:8',
      'G5:2 B5 E6:4 D6:2 B5 G5:4',
      'F#5:2 B5 D6:4 C#6:2 B5 F#5:4',
      'D6:4 B5:2 G5 E6:4 D6',
      'C#6:12 A#5:4',
      'E6:2 D6 B5 G5 E5:4 G5',
      'F#5:2 D5 B4 D5 F#5:4 B5',
      'C6:2 E6 G6:4 E6:2 C6 G5:4',
      'F#5:2 G5 A#5 C#6 E6:4 C#6',
    ],
    harmony: [
      tremolo('F#4', 'D5'),
      tremolo('F#4', 'B4'),
      tremolo('G4', 'D5'),
      tremolo('F#4', 'C#5'),
      tremolo('F#4', 'D5'),
      tremolo('F#4', 'B4'),
      'G4:2 B4 G4 B4 A4 C#5 A4 C#5',
      tremolo('A#4', 'C#5'),
      tremolo('G4', 'B4'),
      tremolo('F#4', 'B4'),
      tremolo('G4', 'B4'),
      tremolo('F#4', 'A#4'),
      tremolo('E4', 'G4'),
      tremolo('D4', 'F#4'),
      tremolo('E4', 'G4'),
      tremolo('E4', 'A#4'),
    ],
    bass: [
      gallop('B1', 'B2'),
      gallop('B1', 'B2'),
      gallop('G1', 'G2'),
      gallop('F#1', 'F#2'),
      gallop('B1', 'B2'),
      gallop('B1', 'B2'),
      'G1:2 G1:1 G1 G2:2 G1:1 G1 A1:2 A2 A1:1 A1 A2:2',
      gallop('F#1', 'F#2'),
      gallop('E2', 'E3'),
      gallop('B1', 'B2'),
      gallop('G1', 'G2'),
      gallop('F#1', 'F#2'),
      gallop('E2', 'E3'),
      gallop('B1', 'B2'),
      gallop('C2', 'C3'),
      gallop('F#1', 'F#2'),
    ],
    drums: [
      ...times(7, 'k:2 h s k:1 k h:2 k s h'),
      'k:2 s:1 s k:2 s:1 s s:2 s:1 s s s s:2',
      ...times(7, 'k:2 h s k:1 k h:2 k s h'),
      'k:2 s:1 s k:2 s:1 s s:2 s:1 s s s s:2',
    ],
  },
}

/** The Rocket Game Corner: a smoky B♭ swing, a walking bass under ii–V turns and comped guide tones. */
const gameCorner: Score = {
  bpm: 116,
  duty: { lead: 0.5, harmony: 0.25 },
  tracks: {
    // | Bb | Gm7 | Cm7 | F7 | Dm7 | G7 | Cm7 F7 | Bb |  then  | Eb | Edim | Bb/D | G7 | Cm7 | F7 | Dm7 G7 | Cm7 F7 |
    lead: [
      'D5:3 F5:1 Bb5:4 A5:3 F5:1 D5:4',
      'Bb5:3 A5:1 G5:3 F5:1 D5:8',
      'Eb5:3 G5:1 Bb5:4 C6:3 Bb5:1 G5:4',
      'A5:6 Ab5:2 F5:3 Eb5:1 C5:4',
      'F5:3 A5:1 C6:4 D6:3 C6:1 A5:4',
      'B5:6 G5:2 F5:3 D5:1 B4:4',
      'C5:3 Eb5:1 G5:3 Bb5:1 A5:3 F5:1 Eb5:4',
      'D5:12 r:4',
      'G5:3 Bb5:1 Eb6:4 D6:3 Bb5:1 G5:4',
      'G5:3 Bb5:1 Db6:4 C6:3 Bb5:1 G5:4',
      'F5:6 D5:2 Bb4:8',
      'B4:3 D5:1 F5:3 G5:1 Ab5:4 G5',
      'Eb5:3 G5:1 Bb5:3 D6:1 C6:8',
      'A5:3 C6:1 Eb6:4 D6:3 C6:1 A5:4',
      'F5:3 A5:1 C6:4 B5:3 G5:1 F5:4',
      'Eb5:3 D5:1 C5:3 Bb4:1 A4:3 C5:1 F5:4',
    ],
    harmony: [
      comp('D4', 'A4'),
      comp('Bb3', 'F4'),
      comp('Eb4', 'Bb4'),
      comp('A3', 'Eb4'),
      comp('F4', 'C5'),
      comp('B3', 'F4'),
      comp('Eb4', 'A3'),
      comp('D4', 'A4'),
      comp('G4', 'D5'),
      comp('G4', 'Db5'),
      comp('D4', 'A4'),
      comp('B3', 'F4'),
      comp('Eb4', 'Bb4'),
      comp('A3', 'Eb4'),
      comp('F4', 'B3'),
      comp('Eb4', 'A3'),
    ],
    bass: [
      walk('Bb2', 'D3', 'F3', 'F#3'),
      walk('G2', 'Bb2', 'D3', 'Db3'),
      walk('C3', 'D3', 'Eb3', 'E3'),
      walk('F2', 'A2', 'C3', 'C#3'),
      walk('D3', 'F3', 'A3', 'Ab3'),
      walk('G2', 'B2', 'D3', 'Db3'),
      walk('C3', 'Eb3', 'F2', 'A2'),
      walk('Bb2', 'D3', 'F3', 'D3'),
      walk('Eb2', 'G2', 'Bb2', 'C3'),
      walk('E2', 'G2', 'Bb2', 'Db3'),
      walk('D2', 'F2', 'Bb2', 'F#2'),
      walk('G2', 'B2', 'D3', 'Db3'),
      walk('C3', 'Bb2', 'G2', 'Eb2'),
      walk('F2', 'A2', 'C3', 'Eb3'),
      walk('D3', 'A2', 'G2', 'B2'),
      walk('C3', 'Eb3', 'F2', 'A2'),
    ],
    drums: [
      ...times(7, 'k:4 s:3 h:1 k:4 s:3 h:1'),
      'k:4 s:3 h:1 s:2 s:1 s s:2 o',
      ...times(7, 'k:4 s:3 h:1 k:4 s:3 h:1'),
      'k:4 s:3 h:1 s:2 s:1 s s:2 o',
    ],
  },
}

/** The café: a slow, warm E♭ tune on major sevenths, for a round of cards. */
const cafe: Score = {
  bpm: 84,
  duty: { lead: 0.25, harmony: 0.125 },
  tracks: {
    // | Ebmaj7 | Cm7 | Abmaj7 | Bb7 | Gm7 | Cm7 | Fm7 Bb7 | Eb |  then  | Abmaj7 | Bb | Gm7 | Cm7 | Fm7 | Bb7 | Ab Bb | Eb |
    lead: [
      'G5:6 F5:2 Eb5:4 Bb4',
      'C5:4 Eb5:2 G5 Bb5:8',
      'C6:6 Bb5:2 G5:4 Eb5',
      'F5:8 D5:4 Ab5',
      'G5:6 F5:2 D5:4 Bb4',
      'Eb5:4 G5:2 Bb5 D6:8',
      'C6:4 Ab5 D6:2 C6 Bb5:4',
      'G5:12 r:4',
      'Eb6:6 C6:2 Ab5:4 G5',
      'F5:6 D5:2 Bb4:8',
      'D5:4 F5:2 G5 Bb5:4 D6',
      'C6:6 Bb5:2 G5:8',
      'Ab5:4 G5:2 F5 C5:4 Eb5',
      'D5:6 F5:2 Ab5:8',
      'C6:4 Eb6 D6:2 C6 Bb5:4',
      'G5:2 F5 Eb5 Bb4 Eb5:8',
    ],
    harmony: [
      alberti('Eb4', 'G4', 'D5'),
      alberti('C4', 'Eb4', 'Bb4'),
      alberti('Ab3', 'C4', 'G4'),
      alberti('Bb3', 'D4', 'Ab4'),
      alberti('G3', 'Bb3', 'F4'),
      alberti('C4', 'Eb4', 'Bb4'),
      'F3:2 Eb4 Ab3 Eb4 Bb3 Ab4 D4 Ab4',
      alberti('Eb4', 'G4', 'Bb4'),
      alberti('Ab3', 'C4', 'G4'),
      alberti('Bb3', 'D4', 'F4'),
      alberti('G3', 'Bb3', 'F4'),
      alberti('C4', 'Eb4', 'Bb4'),
      alberti('F3', 'Ab3', 'Eb4'),
      alberti('Bb3', 'D4', 'Ab4'),
      'Ab3:2 Eb4 C4 Eb4 Bb3 F4 D4 F4',
      'Eb4:2 Bb4 G4 Bb4 Eb4:8',
    ],
    bass: [
      sway('Eb2', 'Bb2'),
      sway('C2', 'G2'),
      sway('Ab1', 'Eb2'),
      sway('Bb1', 'F2'),
      sway('G1', 'D2'),
      sway('C2', 'G2'),
      'F2:6 C3:2 Bb1:4 F2',
      sway('Eb2', 'Bb2'),
      sway('Ab1', 'Eb2'),
      sway('Bb1', 'F2'),
      sway('G1', 'D2'),
      sway('C2', 'G2'),
      sway('F1', 'C2'),
      sway('Bb1', 'F2'),
      'Ab1:6 Eb2:2 Bb1:4 F2',
      'Eb2:6 Bb2:2 Eb2:8',
    ],
    drums: [
      ...times(7, 'k:6 h:2 s:6 h:2'),
      'k:6 h:2 s:4 h:2 h',
      ...times(7, 'k:6 h:2 s:6 h:2'),
      'k:6 h:2 s:4 h:2 o',
    ],
  },
}

/** The arcade: a fast, bleeping C minor chase, the thinnest pulse over sixteenth arpeggios. */
const arcade: Score = {
  bpm: 152,
  duty: { lead: 0.125, harmony: 0.25 },
  tracks: {
    // | Cm | Ab | Bb | Cm | Cm | Ab | Fm G | Cm |  then  | Ab | Bb | Gm | Cm | Ab | Bb | G | G |
    lead: [
      'C5:2 r C5 Eb5 G5 C6:4 Bb5:2',
      'Ab5:2 r Ab5 G5 Eb5:4 C5',
      'Bb4:2 D5 F5 Bb5 D6:4 C6:2 Bb5',
      'G5:6 Eb5:2 C5:4 G4',
      'C6:2 r C6 Bb5 G5 Eb5 G5:4',
      'Ab5:2 C6 Eb6 C6 Ab5:4 Eb5',
      'F5:2 Ab5 C6:4 B5:2 D6 G5:4',
      'C6:2 G5 Eb5 G5 C6:4 r',
      'Eb6:4 C6:2 Ab5 Eb5:4 Ab5',
      'F6:4 D6:2 Bb5 F5:4 Bb5',
      'G5:2 Bb5 D6 G6 F6:4 D6',
      'Eb6:6 D6:2 C6:8',
      'C6:2 r C6 Eb6 Ab6:4 G6:2 Eb6',
      'D6:2 r D6 F6 Bb6:4 Ab6:2 F6',
      'G6:2 F6 D6 B5 G5 B5 D6:4',
      'F6:2 D6 B5 G5 D5 F5 B4:4',
    ],
    harmony: [
      sparkle('C4', 'Eb4', 'G4', 'Eb4'),
      sparkle('Ab3', 'C4', 'Eb4', 'C4'),
      sparkle('Bb3', 'D4', 'F4', 'D4'),
      sparkle('C4', 'Eb4', 'G4', 'Eb4'),
      sparkle('G4', 'Eb4', 'C4', 'Eb4'),
      sparkle('Eb4', 'C4', 'Ab3', 'C4'),
      'F4:1 C4 Ab3 C4 F4 C4 Ab3 C4 G4 D4 B3 D4 G4 D4 B3 D4',
      sparkle('C4', 'Eb4', 'G4', 'C5'),
      sparkle('Ab3', 'C4', 'Eb4', 'Ab4'),
      sparkle('Bb3', 'D4', 'F4', 'Bb4'),
      sparkle('G3', 'Bb3', 'D4', 'G4'),
      sparkle('C4', 'Eb4', 'G4', 'C5'),
      sparkle('Ab3', 'C4', 'Eb4', 'Ab4'),
      sparkle('Bb3', 'D4', 'F4', 'Bb4'),
      sparkle('G3', 'B3', 'D4', 'G4'),
      sparkle('B3', 'D4', 'F4', 'G4'),
    ],
    bass: [
      pump('C2', 'C3'),
      pump('Ab1', 'Ab2'),
      pump('Bb1', 'Bb2'),
      pump('C2', 'C3'),
      pump('C2', 'C3'),
      pump('Ab1', 'Ab2'),
      'F1:2 F2 F1 F2 G1 G2 G1 G2',
      pump('C2', 'C3'),
      pump('Ab1', 'Ab2'),
      pump('Bb1', 'Bb2'),
      pump('G1', 'G2'),
      pump('C2', 'C3'),
      pump('Ab1', 'Ab2'),
      pump('Bb1', 'Bb2'),
      pump('G1', 'G2'),
      'G1:2 G2 G1 G2 B1 D2 F2 G2',
    ],
    drums: [
      ...times(7, 'k:2 h s h k h s h:1 h'),
      's:1 s s s k:2 s:1 s k:2 s:1 s s s s:2',
      ...times(7, 'k:2 h s h k h s h:1 h'),
      's:1 s s s k:2 s:1 s k:2 s:1 s s s o:2',
    ],
  },
}

/** The pier and its fishing: a calm D lydian drift, ripples in the harmony and the wash of the open hat. */
const fishing: Score = {
  bpm: 92,
  duty: { lead: 0.5, harmony: 0.125 },
  tracks: {
    // | D | E/D | D | E/D | Bm | G | Em | A |  then  | G | A | F#m | Bm | G | A | Em A | D |
    lead: [
      'F#5:6 A5:2 D6:8',
      'B5:6 G#5:2 E5:8',
      'F#5:4 A5:2 F#5 D5:4 E5',
      'E5:4 G#5:2 B5 G#5:8',
      'F#5:6 D5:2 B4:4 D5',
      'B5:6 A5:2 G5:4 D5',
      'E5:4 G5:2 B5 E6:4 D6',
      'C#6:12 r:4',
      'D6:6 B5:2 G5:4 B5',
      'C#6:6 A5:2 E5:4 A5',
      'A5:4 C#6:2 A5 F#5:8',
      'D5:4 F#5:2 B5 D6:8',
      'E6:4 D6:2 B5 G5:8',
      'E5:4 A5:2 C#6 E6:8',
      'D6:4 B5 C#6:6 E5:2',
      'D5:8 r:4 A4',
    ],
    harmony: [
      alberti('D4', 'F#4', 'A4'),
      alberti('E4', 'G#4', 'B4'),
      alberti('D4', 'F#4', 'A4'),
      alberti('E4', 'G#4', 'B4'),
      alberti('B3', 'D4', 'F#4'),
      alberti('B3', 'D4', 'G4'),
      alberti('B3', 'E4', 'G4'),
      alberti('C#4', 'E4', 'A4'),
      alberti('B3', 'D4', 'G4'),
      alberti('C#4', 'E4', 'A4'),
      alberti('C#4', 'F#4', 'A4'),
      alberti('B3', 'D4', 'F#4'),
      alberti('B3', 'D4', 'G4'),
      alberti('C#4', 'E4', 'A4'),
      'B3:2 G4 E4 G4 C#4 A4 E4 A4',
      'D4:2 A4 F#4 A4 D4:8',
    ],
    bass: [
      sway('D2', 'A2'),
      sway('D2', 'B2'),
      sway('D2', 'A2'),
      sway('D2', 'B2'),
      sway('B1', 'F#2'),
      sway('G1', 'D2'),
      sway('E2', 'B2'),
      sway('A1', 'E2'),
      sway('G1', 'D2'),
      sway('A1', 'E2'),
      sway('F#1', 'C#2'),
      sway('B1', 'F#2'),
      sway('G1', 'D2'),
      sway('A1', 'E2'),
      'E2:6 B2:2 A1:4 E2',
      'D2:6 A2:2 D2:8',
    ],
    drums: [
      ...times(7, 'k:6 h:2 o:4 h'),
      'k:6 h:2 s:4 o',
      ...times(7, 'k:6 h:2 o:4 h'),
      'k:6 h:2 s:4 o',
    ],
  },
}

/** The Escavação: a G minor dig, knocks for chords and a chiseling bass, the kit doing the heavy lifting. */
const dig: Score = {
  bpm: 120,
  duty: { lead: 0.25, harmony: 0.125 },
  tracks: {
    // | Gm | Gm | Eb | D | Gm | Gm | Cm D | Gm |  then  | Eb | F | D | Gm | Eb | F | Cm | D |
    lead: [
      'G4:2 r Bb4 r D5:4 r',
      'C5:2 r Bb4 r A4:4 G4',
      'Bb4:2 r Eb5 r G5:4 F5',
      'F#5:6 D5:2 A4:8',
      'G5:2 r G5 F5 D5 Bb4 D5:4',
      'Eb5:2 D5 C5 Bb4 A4:4 G4',
      'C5:2 Eb5 G5:4 F#5:2 A5 D5:4',
      'G4:8 r:8',
      'G5:4 Bb5:2 G5 Eb5:4 Bb4',
      'A5:4 C6:2 A5 F5:4 C5',
      'F#5:2 A5 D6:4 C6:2 A5 F#5:4',
      'G5:12 r:4',
      'Bb5:2 r Bb5 G5 Eb5:4 G5',
      'C6:2 r C6 A5 F5:4 A5',
      'Eb6:4 D6:2 C6 G5:4 Eb5',
      'D5:2 F#5 A5 F#5 D5:4 A4',
    ],
    harmony: [
      clink('D4', 'Bb4'),
      clink('D4', 'Bb4'),
      clink('Eb4', 'G4'),
      clink('D4', 'F#4'),
      clink('D4', 'Bb4'),
      clink('G4', 'Bb4'),
      'C4:1 r:3 Eb4:1 r:3 D4:1 r:3 F#4:1 r:3',
      clink('D4', 'G4'),
      clink('Eb4', 'Bb4'),
      clink('F4', 'A4'),
      clink('D4', 'F#4'),
      clink('D4', 'Bb4'),
      clink('Eb4', 'Bb4'),
      clink('F4', 'A4'),
      clink('Eb4', 'G4'),
      clink('D4', 'A4'),
    ],
    bass: [
      chisel('G1', 'D2'),
      chisel('G1', 'D2'),
      chisel('Eb2', 'Bb2'),
      chisel('D2', 'A2'),
      chisel('G1', 'D2'),
      chisel('G1', 'D2'),
      'C2:3 C2:1 r:2 G2:2 D2:3 D2:1 A2:2 D2:2',
      chisel('G1', 'D2'),
      chisel('Eb2', 'Bb2'),
      chisel('F2', 'C3'),
      chisel('D2', 'A2'),
      chisel('G1', 'D2'),
      chisel('Eb2', 'Bb2'),
      chisel('F2', 'C3'),
      chisel('C2', 'G2'),
      'D2:3 D2:1 r:2 A2:2 D2:2 F#2 A2 D3',
    ],
    drums: [
      ...times(7, 'k:2 h:1 h s:2 h k:1 k h:2 s h:1 h'),
      'k:1 k s:2 k:1 k s:2 k:1 k s:1 s s s o:2',
      ...times(7, 'k:2 h:1 h s:2 h k:1 k h:2 s h:1 h'),
      'k:1 k s:2 k:1 k s:2 k:1 k s:1 s s s o:2',
    ],
  },
}

/** The Concurso de Insetos: a cheeky, buzzing A major hop, staccato on the thinnest pulse. */
const contest: Score = {
  bpm: 144,
  duty: { lead: 0.125, harmony: 0.25 },
  tracks: {
    // | A | F#m | D | E | A | C#m | D E | A |  then  | D | E | C#m | F#m | Bm | E | D E | E |
    lead: [
      'E5:1 r A5:2 C#6 A5 E5 r A5 C#6',
      'C#6:1 r A5:2 F#5 A5 C#6:4 r',
      'D6:2 C#6 B5 A5 F#5:4 A5',
      'G#5:2 E5 B4 E5 G#5:4 B5',
      'C#6:1 r A5:2 E6 C#6 A5 r C#6 E6',
      'E6:2 D#6 E6 G#5 C#6:4 G#5',
      'F#5:2 A5 D6 F#6 E6 D6 B5:4',
      'A5:2 r A5 r A5:8',
      'F#6:3 E6:1 D6:2 A5 F#5:4 A5',
      'G#6:3 F#6:1 E6:2 B5 G#5:4 B5',
      'C#6:2 E6 G#6 E6 C#6:4 G#5',
      'A5:2 C#6 F#6 C#6 A5:8',
      'B5:2 D6 F#6 D6 B5:4 F#5',
      'G#5:2 B5 E6 D6 B5:4 G#5',
      'A5:2 F#5 D5 F#5 G#5 B5 E6:4',
      'D6:2 C#6 B5 G#5 E5:4 r',
    ],
    harmony: [
      offbeats('A4', 'C#5'),
      offbeats('A4', 'C#5'),
      offbeats('F#4', 'A4'),
      offbeats('G#4', 'B4'),
      offbeats('A4', 'C#5'),
      offbeats('G#4', 'C#5'),
      'r:2 F#4 r A4 r G#4 r B4',
      offbeats('A4', 'E5'),
      offbeats('F#4', 'A4'),
      offbeats('G#4', 'B4'),
      offbeats('E4', 'G#4'),
      offbeats('F#4', 'A4'),
      offbeats('F#4', 'B4'),
      offbeats('G#4', 'B4'),
      'r:2 F#4 r A4 r G#4 r B4',
      offbeats('G#4', 'D5'),
    ],
    bass: [
      hop('A2', 'E2'),
      hop('F#2', 'C#2'),
      hop('D2', 'A2'),
      hop('E2', 'B1'),
      hop('A2', 'E2'),
      hop('C#2', 'G#2'),
      'D2:2 r A2 r E2 r B2 r',
      'A2:2 r E2 r A1:8',
      hop('D2', 'A2'),
      hop('E2', 'B1'),
      hop('C#2', 'G#2'),
      hop('F#2', 'C#2'),
      hop('B1', 'F#2'),
      hop('E2', 'B1'),
      'D2:2 r A2 r E2 r B2 r',
      'E2:2 r B1 r E2 G#2 B2 D3',
    ],
    drums: [
      ...times(7, 'k:3 h:1 s:2 h k:2 k s h'),
      'k:2 s:1 s k:2 s:1 s s:2 s s o',
      ...times(7, 'k:3 h:1 s:2 h k:2 k s h'),
      'k:2 s:1 s k:2 s:1 s s:2 s s o',
    ],
  },
}

export const REALM_THEMES = { realmTown, safariField, safariBattle, gameCorner, cafe, arcade, fishing, dig, contest } as const satisfies Record<string, Score>
