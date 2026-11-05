import { THEMES, type ThemeId } from '../data/music'
import { healthy, musicOutput, onAudioRunning } from './audio'
import { isDrum, midiToFreq, noteToMidi, parseTrack, VOICES, type Drum, type Duty, type Score, type Voice } from './score'

/**
 * Chiptune music player: two pulse channels, a triangle bass and a noise kit,
 * synthesized live on WebAudio from the scores in `data/music.ts` (no audio files).
 *
 * The shell calls `playTheme` with whatever the current screen wants (every
 * frame is fine) and `duckMusic` while paused. Nothing plays before the first
 * user gesture: the choice is remembered and starts once audio unlocks.
 */

/** Seconds of overlap when one theme hands over to another. */
const FADE = 0.8
/** The scheduler wakes every TICK_MS and books notes LOOKAHEAD seconds ahead (the "two clocks" pattern). */
const TICK_MS = 25
const LOOKAHEAD = 0.15
/** Music level while the game is paused. */
const DUCK_LEVEL = 0.3

/** Per-channel envelope: peak gain, sustain fraction, decay time constant and how much of the note length sounds. */
const CHANNELS = {
  lead: { gain: 0.2, sustain: 0.7, decay: 0.15, gate: 0.92 },
  harmony: { gain: 0.1, sustain: 0.5, decay: 0.1, gate: 0.85 },
  bass: { gain: 0.42, sustain: 0.85, decay: 0.2, gate: 0.8 },
} as const satisfies Record<Exclude<Voice, 'drums'>, { gain: number; sustain: number; decay: number; gate: number }>

/** Filtered noise bursts; the kick adds a falling triangle thump. */
const KIT = {
  k: { filter: 'lowpass', freq: 900, gain: 0.45, decay: 0.07 },
  s: { filter: 'bandpass', freq: 1800, gain: 0.32, decay: 0.12 },
  h: { filter: 'highpass', freq: 7000, gain: 0.1, decay: 0.03 },
  o: { filter: 'highpass', freq: 6000, gain: 0.1, decay: 0.22 },
} as const satisfies Record<Drum, { filter: BiquadFilterType; freq: number; gain: number; decay: number }>

type Event = { voice: Voice; sym: string; len: number }

/** A score flattened into one event list per sixteenth, ready for the scheduler. */
type Song = { stepDur: number; steps: Event[][]; duty: Score['duty'] }

/** Context-bound resources, built once audio runs. */
type Kit = { ctx: AudioContext; duck: GainNode; waves: Record<Duty, PeriodicWave>; noise: AudioBuffer }

type Playing = { id: ThemeId; song: Song; out: GainNode; echo: DelayNode; step: number; time: number }

let wanted: ThemeId | null = null
let ducked = false
let kit: Kit | null = null
let playing: Playing | null = null
let timer: ReturnType<typeof setInterval> | null = null
const songs = new Map<ThemeId, Song>()

const compile = (score: Score): Song => {
  const total = parseTrack(score.tracks.lead).length
  const steps: Event[][] = Array.from({ length: total }, () => [])
  for (const voice of VOICES) {
    for (const n of parseTrack(score.tracks[voice]).notes) steps[n.at % total]!.push({ voice, sym: n.sym, len: n.len })
  }
  return { stepDur: 60 / score.bpm / 4, steps, duty: score.duty }
}

const song = (id: ThemeId) => {
  let s = songs.get(id)
  if (!s) songs.set(id, (s = compile(THEMES[id])))
  return s
}

/** Band-limited pulse wave (Fourier series), the NES/GB square channel sound. */
const pulseWave = (ctx: AudioContext, duty: Duty) => {
  const real = new Float32Array(48)
  const imag = new Float32Array(48)
  for (let n = 1; n < real.length; n++) {
    real[n] = Math.sin(2 * Math.PI * n * duty) / (Math.PI * n)
    imag[n] = (1 - Math.cos(2 * Math.PI * n * duty)) / (Math.PI * n)
  }
  return ctx.createPeriodicWave(real, imag)
}

const createKit = (ctx: AudioContext, bus: GainNode): Kit => {
  const duck = ctx.createGain()
  duck.gain.value = ducked ? DUCK_LEVEL : 1
  duck.connect(bus)
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return { ctx, duck, noise, waves: { 0.125: pulseWave(ctx, 0.125), 0.25: pulseWave(ctx, 0.25), 0.5: pulseWave(ctx, 0.5) } }
}

const gainNode = (ctx: AudioContext, value: number) => {
  const g = ctx.createGain()
  g.gain.value = value
  return g
}

/** PMD-style vibrato that fades in on held notes. */
const vibrato = (ctx: AudioContext, osc: OscillatorNode, freq: number, t: number, end: number) => {
  const lfo = ctx.createOscillator()
  const depth = ctx.createGain()
  lfo.frequency.value = 5.5
  depth.gain.setValueAtTime(0, t + 0.15)
  depth.gain.linearRampToValueAtTime(freq * 0.008, t + 0.4)
  lfo.connect(depth).connect(osc.frequency)
  lfo.start(t)
  lfo.stop(end + 0.15)
}

const drum = (k: Kit, out: AudioNode, sym: Drum, t: number) => {
  const spec = KIT[sym]
  const src = k.ctx.createBufferSource()
  const filter = k.ctx.createBiquadFilter()
  const env = k.ctx.createGain()
  src.buffer = k.noise
  filter.type = spec.filter
  filter.frequency.value = spec.freq
  env.gain.setValueAtTime(spec.gain, t)
  env.gain.setTargetAtTime(0, t, spec.decay / 3)
  src.connect(filter).connect(env).connect(out)
  src.start(t, Math.random() * 0.5)
  src.stop(t + spec.decay * 2)
  if (sym !== 'k') return
  const thump = k.ctx.createOscillator()
  const tEnv = k.ctx.createGain()
  thump.type = 'triangle'
  thump.frequency.setValueAtTime(160, t)
  thump.frequency.exponentialRampToValueAtTime(45, t + 0.08)
  tEnv.gain.setValueAtTime(0.6, t)
  tEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
  thump.connect(tEnv).connect(out)
  thump.start(t)
  thump.stop(t + 0.12)
}

const note = (k: Kit, p: Playing, e: Event, t: number) => {
  if (e.voice === 'drums') return isDrum(e.sym) && drum(k, p.out, e.sym, t)
  const midi = noteToMidi(e.sym)
  if (midi === null) return
  const spec = CHANNELS[e.voice]
  const freq = midiToFreq(midi)
  const end = t + e.len * p.song.stepDur * spec.gate
  const osc = k.ctx.createOscillator()
  if (e.voice === 'bass') osc.type = 'triangle'
  else osc.setPeriodicWave(k.waves[p.song.duty[e.voice]])
  osc.frequency.value = freq
  const env = k.ctx.createGain()
  env.gain.setValueAtTime(0, t)
  env.gain.linearRampToValueAtTime(spec.gain, t + 0.006)
  env.gain.setTargetAtTime(spec.gain * spec.sustain, t + 0.006, spec.decay)
  env.gain.setTargetAtTime(0, end, 0.02)
  osc.connect(env).connect(p.out)
  if (e.voice === 'lead') {
    env.connect(p.echo)
    if (end - t > 0.3) vibrato(k.ctx, osc, freq, t, end)
  }
  osc.start(t)
  osc.stop(end + 0.15)
}

/** Books every note that starts within the lookahead window. */
const schedule = () => {
  const p = playing
  if (!p || !kit || kit.ctx.state !== 'running' || !healthy(kit.ctx)) return
  const now = kit.ctx.currentTime
  // Throttled background timers or a suspended context leave us behind: skip ahead instead of bursting (a NaN start too).
  if (!(p.time >= now)) p.time = now + 0.02
  while (p.time < now + LOOKAHEAD) {
    for (const e of p.song.steps[p.step]!) note(kit, p, e, p.time)
    p.time += p.song.stepDur
    p.step = (p.step + 1) % p.song.steps.length
  }
}

const start = (k: Kit, id: ThemeId, now: number): Playing => {
  const s = song(id)
  const out = k.ctx.createGain()
  out.gain.setValueAtTime(0, now)
  out.gain.linearRampToValueAtTime(1, now + FADE)
  out.connect(k.duck)
  // A dotted-eighth echo on the lead gives the dry square some room.
  const echo = k.ctx.createDelay(1)
  echo.delayTime.value = s.stepDur * 3
  echo.connect(gainNode(k.ctx, 0.3)).connect(echo)
  echo.connect(gainNode(k.ctx, 0.2)).connect(out)
  return { id, song: s, out, echo, step: 0, time: now + 0.05 }
}

const fadeOut = (p: Playing, now: number) => {
  p.out.gain.cancelScheduledValues(now)
  p.out.gain.setValueAtTime(p.out.gain.value, now)
  p.out.gain.linearRampToValueAtTime(0, now + FADE)
  setTimeout(() => p.out.disconnect(), (FADE + 2) * 1000)
}

const sync = () => {
  const out = musicOutput()
  if (!out || playing?.id === wanted) return
  const k = (kit ??= createKit(out.ctx, out.bus))
  const now = k.ctx.currentTime
  if (playing) fadeOut(playing, now)
  playing = wanted ? start(k, wanted, now) : null
  if (playing && !timer) timer = setInterval(schedule, TICK_MS)
  if (!playing && timer) {
    clearInterval(timer)
    timer = null
  }
  schedule()
}

onAudioRunning(sync)

/**
 * Crossfades to a theme; `null` fades the music out. Idempotent, so the shell
 * can call it every frame. Before the first user gesture it only remembers the
 * choice, and the theme starts as soon as audio unlocks.
 */
export const playTheme = (id: ThemeId | null) => {
  if (id === wanted) return
  wanted = id
  sync()
}

/** Theme actually sounding (null before audio unlocks). */
export const currentTheme = () => playing?.id ?? null

/** Lowers the music (pause menus) or brings it back. */
export const duckMusic = (on: boolean) => {
  if (on === ducked) return
  ducked = on
  if (kit && healthy(kit.ctx)) kit.duck.gain.setTargetAtTime(on ? DUCK_LEVEL : 1, kit.ctx.currentTime, 0.15)
}

export type { ThemeId }
