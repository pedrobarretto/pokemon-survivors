/**
 * The Arena's screens in a chunk of their own: its picker, hub and queue, and
 * a match's splash, HUD, tray, quick chat, controls and end screen. `main.ts`
 * loads it as a player opens the Arena (or a match starts, `startCoopRun`);
 * the match's rules are the simulation's, shared with co-op, and stay in the
 * main bundle. The pieces the lobby and co-op rooms show are `ui/arenaBits.ts`.
 */
export { arenaScreen } from './ui/arena'
export { arenaHub } from './ui/arenaHub'
export { arenaQueue, arenaQueueLive } from './ui/arenaQueue'
export { versusSplash } from './ui/versusSplash'
export { createVersusHud, versusFeedback } from './ui/versusHud'
export { createVersusTray } from './ui/versusTray'
export { createVersusTalk } from './ui/versusTalk'
export { createArenaControls } from './ui/arenaControls'
export { versusEnd } from './ui/versusEnd'
