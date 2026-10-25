/**
 * Tiny tracker notation for the chiptune scores in `data/music.ts`.
 *
 * A track is a list of bars. Each bar is a string of space-separated tokens
 * `symbol:length`, where length counts sixteenth notes. The length is sticky
 * (MML style): a token without `:n` reuses the previous one, and every bar
 * starts back at 4 (a quarter note).
 *
 * - Notes: `C5`, `F#4`, `Bb3` (C4 is middle C).
 * - Drums: `k` kick, `s` snare, `h` closed hat, `o` open hat.
 * - `r` is a rest, `-` ties onto the previous note (also across bars).
 */
import * as dm from './dmath'

export const STEPS_PER_BAR = 16

export const DRUMS = ['k', 's', 'h', 'o'] as const
export type Drum = (typeof DRUMS)[number]

export type Note = { at: number; len: number; sym: string }

export type Track = { notes: Note[]; length: number }

export const parseTrack = (bars: readonly string[]): Track => {
  const notes: Note[] = []
  let at = 0
  for (const bar of bars) {
    let len = 4
    for (const token of bar.trim().split(/\s+/)) {
      const [sym = '', size] = token.split(':')
      if (size !== undefined) len = Number(size)
      const last = notes.at(-1)
      if (sym === '-' && last && last.at + last.len === at) last.len += len
      else if (sym !== 'r' && sym !== '-') notes.push({ at, len, sym })
      at += len
    }
  }
  return { notes, length: at }
}

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** `A4` → 69 (MIDI). `null` when the symbol isn't a note. */
export const noteToMidi = (sym: string) => {
  const m = /^([A-G])([#b]?)(\d)$/.exec(sym)
  if (!m) return null
  const accidental = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0
  return 12 * (Number(m[3]) + 1) + SEMITONES[m[1]!]! + accidental
}

export const midiToFreq = (midi: number) => 440 * dm.pow(2, (midi - 69) / 12)

export const isDrum = (sym: string): sym is Drum => (DRUMS as readonly string[]).includes(sym)

export const VOICES = ['lead', 'harmony', 'bass', 'drums'] as const
export type Voice = (typeof VOICES)[number]

/** Pulse width of a square channel: 0.125 is thin and nasal, 0.5 is a hollow square. */
export type Duty = 0.125 | 0.25 | 0.5

/** One looping theme: lead and harmony are pulse channels, bass a triangle, drums noise. */
export type Score = {
  bpm: number
  duty: { lead: Duty; harmony: Duty }
  tracks: Record<Voice, readonly string[]>
}
