<div align="center">

<img src="public/assets/pokemon/4/portrait.png" width="56" alt="Charmander">
<img src="public/assets/pokemon/1/portrait.png" width="56" alt="Bulbasaur">
<img src="public/assets/pokemon/7/portrait.png" width="56" alt="Squirtle">

# Pokémon Survivors

**A free Vampire Survivors–style roguelite with Pokémon, playable in the browser.**

Pick one of 27 starters (or hatch eggs for 52 more Pokémon, 79 in all), survive 15 minutes of wild hordes, learn moves, evolve, and take down Mewtwo.

[**▶ Play at pokemonsurvivors.com**](https://www.pokemonsurvivors.com)

[![CI](https://github.com/pedrobarretto/pokemon-survivors/actions/workflows/ci.yml/badge.svg)](https://github.com/pedrobarretto/pokemon-survivors/actions/workflows/ci.yml)
[![License: MIT (code)](https://img.shields.io/badge/code-MIT-blue)](LICENSE)
[![Fan game](https://img.shields.io/badge/unofficial-fan%20game-ef5350)](#legal)

<img src="docs/screenshots/boss-fight.png" alt="Charizard fighting a horde while Moltres attacks" width="860">

</div>

> [!NOTE]
> Pokémon Survivors is an unofficial, non-commercial fan game. It is **not affiliated with, endorsed, sponsored or approved by** Nintendo, The Pokémon Company, GAME FREAK or Creatures. See [Legal](#legal).

The game is in Brazilian Portuguese 🇧🇷 and English 🇺🇸, picked from your browser language and switchable from the menus. Pokémon, move and item names use their official English names.

## Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/starter-select.png" alt="Starter select with the inspect panel"></td>
    <td width="50%"><img src="docs/screenshots/level-up.png" alt="Level-up screen offering moves and held items"></td>
  </tr>
  <tr>
    <td align="center"><sub>Pick a starter from any region and inspect its stats, evolutions and moves</sub></td>
    <td align="center"><sub>Level up and build your moveset with held items</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/evolution.png" alt="Fuecoco evolving into Crocalor"></td>
    <td><img src="docs/screenshots/poke-mart.png" alt="Poké Mart with permanent upgrades"></td>
  </tr>
  <tr>
    <td align="center"><sub>Evolve mid-run, just like on the handhelds</sub></td>
    <td align="center"><sub>Spend Poké Dollars on permanent upgrades</sub></td>
  </tr>
</table>

<p align="center">
  <img src="docs/screenshots/mobile.png" alt="Skeledirge on a phone in portrait mode" width="260"><br>
  <sub>Works on phones too: floating joystick, touch special button, installable as a fullscreen app</sub>
</p>

## Features

- **27 starters from every region**, each with a full 3-stage evolution line, its own stats, signature move and learnset.

  <table>
    <tr><th>Kanto</th><th>Johto</th><th>Hoenn</th><th>Sinnoh</th><th>Unova</th><th>Kalos</th><th>Alola</th><th>Galar</th><th>Paldea</th></tr>
    <tr>
      <td><img src="public/assets/pokemon/1/portrait.png" width="40" alt="Bulbasaur"></td>
      <td><img src="public/assets/pokemon/152/portrait.png" width="40" alt="Chikorita"></td>
      <td><img src="public/assets/pokemon/252/portrait.png" width="40" alt="Treecko"></td>
      <td><img src="public/assets/pokemon/387/portrait.png" width="40" alt="Turtwig"></td>
      <td><img src="public/assets/pokemon/495/portrait.png" width="40" alt="Snivy"></td>
      <td><img src="public/assets/pokemon/650/portrait.png" width="40" alt="Chespin"></td>
      <td><img src="public/assets/pokemon/722/portrait.png" width="40" alt="Rowlet"></td>
      <td><img src="public/assets/pokemon/810/portrait.png" width="40" alt="Grookey"></td>
      <td><img src="public/assets/pokemon/906/portrait.png" width="40" alt="Sprigatito"></td>
    </tr>
    <tr>
      <td><img src="public/assets/pokemon/4/portrait.png" width="40" alt="Charmander"></td>
      <td><img src="public/assets/pokemon/155/portrait.png" width="40" alt="Cyndaquil"></td>
      <td><img src="public/assets/pokemon/255/portrait.png" width="40" alt="Torchic"></td>
      <td><img src="public/assets/pokemon/390/portrait.png" width="40" alt="Chimchar"></td>
      <td><img src="public/assets/pokemon/498/portrait.png" width="40" alt="Tepig"></td>
      <td><img src="public/assets/pokemon/653/portrait.png" width="40" alt="Fennekin"></td>
      <td><img src="public/assets/pokemon/725/portrait.png" width="40" alt="Litten"></td>
      <td><img src="public/assets/pokemon/813/portrait.png" width="40" alt="Scorbunny"></td>
      <td><img src="public/assets/pokemon/909/portrait.png" width="40" alt="Fuecoco"></td>
    </tr>
    <tr>
      <td><img src="public/assets/pokemon/7/portrait.png" width="40" alt="Squirtle"></td>
      <td><img src="public/assets/pokemon/158/portrait.png" width="40" alt="Totodile"></td>
      <td><img src="public/assets/pokemon/258/portrait.png" width="40" alt="Mudkip"></td>
      <td><img src="public/assets/pokemon/393/portrait.png" width="40" alt="Piplup"></td>
      <td><img src="public/assets/pokemon/501/portrait.png" width="40" alt="Oshawott"></td>
      <td><img src="public/assets/pokemon/656/portrait.png" width="40" alt="Froakie"></td>
      <td><img src="public/assets/pokemon/728/portrait.png" width="40" alt="Popplio"></td>
      <td><img src="public/assets/pokemon/816/portrait.png" width="40" alt="Sobble"></td>
      <td><img src="public/assets/pokemon/912/portrait.png" width="40" alt="Quaxly"></td>
    </tr>
  </table>

- **Eggs and 51 more playable Pokémon.** Bosses, locked chests and rifts sometimes leave an egg. It waits in a 3-slot incubator and hatches with the steps you take in runs, unlocking one of 51 families from every type and generation (Pichu, Eevee, Pidgey, Geodude, Gastly, Abra, Magikarp, Riolu, Zorua… and the rarest Dratini, Larvitar, Beldum, Bagon, Gible, Dreepy, Slakoth and Feebas), each with its own move, special and mid-run evolution. Hatching plays a little scene with the cry, 1% of hatchlings are shiny for good, and duplicates become Poké Dollars. A 52nd family, Munchlax → Snorlax, only hatches from the Friendship Egg, which comes from inviting friends.
- **Invites and Mystery Gifts.** Every link the game shares carries your handle. A friend who signs up through it gets a Friendship Egg, you follow each other, and once they've played 3 verified runs you get a Mystery Gift: a Friendship Egg for the first friend, the Ambassador title and an exclusive card frame at 3, a shiny Munchlax at 10. Profiles show how many friends you brought.

- **32 moves and 25 held items.** Max out a move, pair it with the right item, and it evolves (Ember + Charcoal → Flamethrower).
- **Real type matchups**, burn, poison and paralysis, and a manual **special attack** for each of the 18 types that grows stronger at the final evolution: Blast Burn, Hydro Cannon, Frenzy Plant, Bolt Strike, Draco Meteor, Astral Barrage, Precipice Blades and more.
- **Readable damage numbers**: hits on the same target add up into one growing number, a few per target at most, with super-effective hits kept apart. On a crowded screen only the biggest hits show (or all of them, or none: it's a setting).
- **415 wild Pokémon from all 9 generations**, Dragon types included, in 5 tiers by base stat total. Kanto, Johto and Hoenn are complete: every species but the legendaries and mythicals (and Unown and Castform, whose look depends on a form) shows up, as a wild Pokémon or as a starter, egg or boss. Every run draws its own cast, a few new faces per stage, from basic Pokémon early to evolved ones late, and each biome pulls the draw towards its types (more Grass and Bug in the forest, Rock and Ground in the cave).
- **Bosses with telegraphed attack patterns**: Onix, Snorlax, a legendary trio drawn per run (the Kanto birds, the Johto beasts or the Hoenn Regis, at 7:00, 9:30 and 12:00, with the same stats per slot whichever trio comes) and Mewtwo. Sometimes a rare mythical joins the finale: Mew, Celebi or Jirachi. Each one switches between rushing in with area slams and hanging back to aim at you, and enrages under half HP (faster, quicker attacks, sometimes two in a row). The horde thins for each boss's first minute, and each boss has until the next one arrives, then it flees with its reward; Mewtwo blasts the horde away and thins it further, so the finale is a duel.
- **Elites and runners**: when the horde nearly fills, new arrivals come in as red-outlined elites (more HP, EXP and damage; none during the Mewtwo duel), and one new species each stage runs, aiming where you're going to be.

  <img src="public/assets/pokemon/95/portrait.png" width="40" alt="Onix"> <img src="public/assets/pokemon/143/portrait.png" width="40" alt="Snorlax"> <img src="public/assets/pokemon/144/portrait.png" width="40" alt="Articuno"> <img src="public/assets/pokemon/145/portrait.png" width="40" alt="Zapdos"> <img src="public/assets/pokemon/146/portrait.png" width="40" alt="Moltres"> <img src="public/assets/pokemon/243/portrait.png" width="40" alt="Raikou"> <img src="public/assets/pokemon/244/portrait.png" width="40" alt="Entei"> <img src="public/assets/pokemon/245/portrait.png" width="40" alt="Suicune"> <img src="public/assets/pokemon/377/portrait.png" width="40" alt="Regirock"> <img src="public/assets/pokemon/378/portrait.png" width="40" alt="Regice"> <img src="public/assets/pokemon/379/portrait.png" width="40" alt="Registeel"> <img src="public/assets/pokemon/150/portrait.png" width="40" alt="Mewtwo"> <img src="public/assets/pokemon/151/portrait.png" width="40" alt="Mew"> <img src="public/assets/pokemon/251/portrait.png" width="40" alt="Celebi"> <img src="public/assets/pokemon/385/portrait.png" width="40" alt="Jirachi">

- **Legendary rifts**: three times per run a rift opens on the map. Step in to duel Lugia, Ho-Oh, Kyogre, Groudon, Rayquaza, Dialga, Latias, Latios or Deoxys in an arena of its own (shallow water, pillars, a rising tide, lava rivers, a crumbling edge, an island ringed by surf, a meteor in space) for big rewards, before it collapses.
- **Mega Evolution**: the first rift legendary you beat with a Mega line drops its Mega Stone. At the final evolution, the MEGA button plays the transformation and the Mega form lasts 20 s (60 s recharge), with its own stats, special and ability. 26 Megas across 22 lines, from Mega Venusaur to Mega Greninja; Charizard, Raichu, Garchomp and Lucario have two, and the rift drops both stones so the player keeps the one picked up. Megas SpriteCollab hasn't drawn yet wear their final stage with a rainbow outline.
- **Endless mode**: after Mewtwo, keep going while the horde scales forever and Arceus, the reaper, hunts you from 20:00. Time survived is the score.
- **Three difficulty levels**, picked on the select screen and all open from the start: Normal, Hard (faster, denser hordes that hit harder) and Nightmare (brutal, fast and dense hordes and half of every heal). Each run records its level for the ranking.
- **Today's outbreak**: every day (Brasília time) one wild species takes over every run, the same for everyone. It's the most common Pokémon of the run from the first minute to the last, so its shiny shows up about twice a run. The title screen announces it, and a daily mission asks you to defeat it.
- **Daily Challenge and ribbons**: one run a day that is the same for everyone (Brasília time): the same seed, Pokémon (any playable one, egg families you haven't hatched yet included) and difficulty, with no Poké Mart upgrades, Lure, Incense or Shiny Charm, and the day's outbreak on. Only your first finished run of the day goes on the challenge board; the rest are practice. A few hours after the day closes, everyone on it gets a ribbon as a Mystery Gift: gold for the top 10%, silver for the top half, bronze for taking part. Ribbons show on your profile and Trainer Card, and an official attempt's card shows its place. Guests can play and practice it too, off the board.
- **Shinies**: any wild Pokémon can be a shiny elite (1/450, down to 1/225 with the Shiny Charm), and your starter has a 1/64 chance to be shiny for the whole run. Rolling it unlocks that Pokémon's shiny for good (pick Normal or Shiny on the select screen), and every shiny you catch lives in the **PC Box**, 30 to a box like the games' PC.
- **Share cards**: the results screen draws a pixel art card of the run (your Pokémon, time, level, the shinies you caught, the legendaries you beat) to share, copy or download, and the PC Box and your profile draw your **Trainer Card**. Shared links carry your handle (`?ref=`).
- **In-game Pokédex** of 569 species: every one you've seen, how many you defeated and which you caught. A defeated shiny is yours, and so are the Pokémon you hatch and every form you play. The end of a run shows what's new.
- **Five biomes per run**: Route 1, Viridian Forest, Mt. Moon, Mt. Silver and Lavender Tower, each with its own ground, breakables and theme, cross-dissolving with no loading screen.
- **Weather** for everyone: harsh sunlight (Fire ×1.5, Water ×0.75), rain (the opposite), sandstorm and snow (wear down non-immune types) and fog (short sight).
- **Items on the map**: break item balls, berry trees and tall grass for Potions, Rare Candies, Max Repels, a Voltorb that explodes, and more.
- **Map events** that make you pick where to go: buff altars, healing fountains, locked chests (stand in the ring while an ambush closes in), spike and bomb traps that hurt the horde too, and a fleeing Meowth that drops coins. Off-screen ones get an arrow on the screen edge.
- **Meta progression**: hatch eggs into new partners, collect Poké Dollars and spend them in the Poké Mart, on three shelves: permanent upgrades (HP Up, Protein, Exp. Charm… and the Shiny Charm), today's counter (the same for everyone, with a daily stock: a Lure for twice the shinies next run, an Incense for twice the eggs, an egg for sale and a daily deal) and Style (Poké, Great, Ultra and Master Ball card frames, backgrounds of the five biomes and PC Box wallpapers). Lures and Incenses wait in the Bag until you turn them on at the Pokémon select.
- **Missions and achievements**: three daily and two weekly missions, drawn from the date so everyone gets the same ones, pay ₽ (some weeklies also give an egg, and some missions a Lure or an Incense). 55 achievements earn bronze, silver and gold medals (gold ones bring an egg too), and some grant a title (Shiny Hunter, Pokémon Professor…) shown on the title and results screens.
- **Original chiptune soundtrack**, synthesized live in WebAudio (no audio files): a village theme in the menus, one theme per biome, and a boss theme while a boss is alive.
- **Co-op for up to 4 players**: "Play with friends" creates a room with a link to share (`/?sala=CODE`) or joins one by its code, no account needed. Everyone brings their own Pokémon and Poké Mart upgrades; the team shares EXP and levels up together (each player picks their own card, with a 15 s timer), the horde grows and toughens with every player, a fainted player gets back up when a teammate stands by them for 3 s, and the run ends when nobody is standing. Teammates show with their names, HP and arrows at the screen edge.
- **Friends**: following someone sends a friend request and following back accepts it. The Friends screen shows who is online, takes requests, searches by username and invites friends straight into your room.
- **Ranking and public profiles**: signed-in solo runs go to a board per difficulty, for today, this week and all time, plus the Daily Challenge's board for today and yesterday (days and weeks turn over in Brasília time), filterable by Pokémon and by friends (mutual follows). Each trainer picks a display name and a unique handle and gets a shareable profile (`/?u=handle`) with their title, records, challenge ribbons, Pokédex progress and recent runs. The server only takes a run that fits the wall clock since its start token.
- **Optional accounts**: sign in with Google to keep your progress in the cloud and continue on any device. Guest play stays the default; signing in brings the guest progress along (the collection joins, each upgrade and record keeps the higher value) and it syncs at the end of every run, offline-safe.
- **Settings**: music and effects volume, damage numbers (all, reduced or off), screen shake and language, saved in the browser.
- **Pixel-perfect**: the world renders at about 300px tall and is integer-upscaled, so sprites, effects and particles share one pixel grid.

## Controls

| | Keyboard / gamepad | Touch |
| --- | --- | --- |
| Move | WASD / arrows | Drag anywhere (floating joystick) |
| Special attack | `Space` / A (✕) | Round button, bottom right |
| Mega Evolution | `E` / Y (△) | MEGA button, above the special |
| Pause | `Esc` / `P` / Start | Pause button, top right |
| Pick an upgrade | `1`–`3` | Tap it |
| Mute | `M` | Settings, on the title screen or in the pause menu |
| Menus | Arrows / D-pad, `Enter` / A, `Esc` / B back | Tap |
| Switch language | `I` (title screen) or Settings | `PT \| EN`, top left of the title screen, or Settings |

On a gamepad, the D-pad and left stick drive every menu. In a run, A fires the special and Start pauses, but the gamepad can't move your Pokémon yet: use the keyboard or touch.

## Running locally

Requires Node.js 22+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # focused rules tests (vitest)
npm run build      # typecheck + production build
npm run roster     # rebuild the wild roster from PokeAPI + SpriteCollab (data/roster.generated.json)
npm run assets     # re-download sprites/cries (already committed in public/)
npm run credits    # regenerate CREDITS.md from SpriteCollab
```

In dev builds the browser console exposes `ps.run()` (current run state), `ps.startRun('squirtle')`, `ps.theme()` (music theme playing), `ps.biome('cave')`, `ps.weather('rain')`, `ps.terrain('cliff')` (walks you to the nearest rock, tree, cliff, tower or lake), `ps.spawn('chansey', 3)` (`ps.spawn('pidgey', 1, true)` for a shiny), `ps.dex()` (saved Pokédex), `ps.pc()` (the PC Box), `ps.card()` (the Trainer Card's share preview), `ps.unlockShiny('charmander')` (as if its 1/64 roll hit) and `ps.event('chest')` (places a map event next to you), plus `ps.trio('beasts')` (the run's legendary trio) and `ps.boss('entei')` (a wave boss now) to stage boss fights, `ps.rift()`, `ps.portal()`, `ps.victory()`, `ps.endless()` and `ps.reaper()` to stage rifts and the endless mode, `ps.mega()` (`'ready'`, `'stone'`, and a Mega id like `ps.mega('now', 'charizardY')`) to stage a Mega Evolution, and `ps.egg('rare')`, `ps.walk(500)`, `ps.hatch()`, `ps.hatch('gible', true, 2.8)`, `ps.unlockFamily()` and `ps.incubator()` for eggs. For missions: `ps.missions()` lists them, `ps.mission(i, n)` sets one's progress (one short of done by default), `ps.completeMission(i)`, `ps.date('2026-10-19')` moves the missions' clock, `ps.unlockAchievement(id?)` and `ps.resetProgress()`. For the outbreak and the Poké Mart: `ps.outbreak('gastly')` holds an outbreak instead of the day's (no argument goes back), `ps.item('lure', 3)` fills the Bag, `ps.money(20000)` adds ₽ and `ps.unlockStyles()` owns every style. For invites and Mystery Gifts: `ps.invite('ash', 'Ash')` lands as a guest invited by @ash (the title shows the invite banner, without asking the API) and `ps.gift(kind, arg?, why?)` lands a gift as if the account brought it (`ps.gift('egg', 'friend', 'ash')`, `ps.gift('coins', '500')`, `ps.gift('title')`, `ps.gift('style', 'ambassador', 3)`, `ps.gift('shinyHatch', 'munchlax')`; `why` is an inviter's handle or a count of friends).

## How it's built

Vite + TypeScript and Canvas 2D, with no game engine. Everything is plain data plus functions (no classes). The UI is DOM with pixel fonts (Press Start 2P / VT323).

```
src/
  engine/   math, deterministic math (dmath), seeded rng, spatial hash, input, WebAudio sfx and music synth, pixel-art helpers
  data/     pure game data: starters, egg families (hatchlings), enemies, waves, biomes, weather, held items, move evolutions, type chart, music scores
  game/     simulation (fixed 60 Hz tick): game.ts orchestrates the systems for a team of players (players.ts: who's in play)
            coop.ts (team rules: revives, wipes, scaling) · lockstep.ts (applies a co-op tick's inputs, checksums)
            moves.ts (weapons) · attacks.ts (hitboxes) · enemies.ts · spawner.ts
            combat.ts · pickups.ts · leveling.ts · effects.ts · special.ts (manual special attack) · mega.ts (Mega Evolution)
            status.ts (pure condition rules) · statusSystem.ts (DoT ticks, particles)
            consumables.ts (floor items, buffs) · props.ts (breakable item sources) · terrain.ts (rocks, trees, mountains, towers, lakes)
            mapEvents.ts (event director, altars, chests, traps, Meowth) · mapEventRules.ts (their pure rules)
            bosses.ts (boss attack patterns, enemy hazards) · bossFight.ts (stances and rage: pure rules)
            horde.ts (elites and runners) · shiny.ts · biomes.ts · weather.ts
            dex.ts (Pokédex rules and save format) · sightings.ts (who's on screen)
            rift.ts (rift rules) · riftPortal.ts (portal on the map) · riftArena.ts (the arena)
            endless.ts (endless rules) · endlessSystem.ts (horde events, Arceus)
            eggs.ts (egg drops, incubator, hatching: pure rules)
            gifts.ts (Mystery Gifts: parsing and applying them) · referral.ts (invites: landing, who counts, milestones)
            tally.ts (run counters and summary) · missions.ts · achievements.ts (missions, medals, titles)
            difficulty.ts (Normal, Hard, Nightmare as multipliers)
  render/   PMD sprite loader, code-drawn pixel art, procedural biome ground, weather overlays, map events, title scene and logo, frame renderer
  ui/       title screen, HUD, Pokémon select (with the egg box), incubator and hatching scene, level-up, pause, settings, results, missions and achievements, toasts, language switch, Pokédex
  i18n/     every player-facing string: pt.ts (reference) and en.ts; site/ has the website copy
  site/     static pages rendered at build time from data/: Pokédex, guide, changelog, legal
  account.ts  optional accounts: Clerk loaded on demand, save sync with the API
  ranking.ts  ranked runs (start token, offline queue), boards, profiles, friends through the API
  net/        co-op wire protocol (shared with the server), the WebSocket client, the room and presence stores
  coopRun.ts  a co-op run on this device: ticks in, inputs out, the jitter buffer and this player's prediction
server/     accounts API (Hono + Postgres, Clerk tokens) and the co-op relay (play/), deployed with Docker: see server/README.md
```

<details>
<summary><b>Architecture notes</b></summary>

- **Simulation and presentation are decoupled.** `step(game, input, dt)` mutates the state and pushes `GameEvent`s. `main.ts` drains them each frame to play sounds and cries and show toasts. Toasts and banners go through one queue (`ui/toasts.ts`, rules in `ui/toastQueue.ts`): banners show one at a time, toasts stack in a column whose CSS `max-height` keeps it clear of the Pokémon, and both wait out menus with their clocks stopped, so nothing is covered or lost.
- **Moves** are data plus a `fire(game, stats)` function. Upgrades are stat deltas. Player modifiers (might, area, cooldown…) are applied in `moveStats`. Each hitbox is a generic `Attack` with a `motion` (linear, homing, orbit, boomerang, follow, static) and a `visual`.
- **Waves** live in `data/waves.ts`: spawn stages by time, each a list of tier slots, plus events (flyby swarms and closing rings by tier, bosses, optionally rare via `chance`). A boss event names a fixed boss, a slot of the run's legendary trio (`TRIOS`: the slot owns the stats, so every trio is as hard) or the rare mythical (`MYTHICALS`); the roster draws both with the run's seed, so replays meet the same bosses. The horde keeps turning over (`game/renewal.ts`): at the cap each new spawn takes the place of the oldest regular enemy off-screen, and off-screen enemies older than a minute retire. Bosses, shinies, swarms and anything on screen are never touched. Past `ELITE.fill` of the cap new spawns are elites (not while the finale boss lives), and each stage's runner species (drawn with the roster) spawns fast and aims ahead of the player (`game/horde.ts`). For the first `BOSS_FIGHT.duration` s of a wave boss near the player, spawns drop to `BOSS_FIGHT.rate`.
- **The wild roster** is generated: `npm run roster` checks a curated list of species against SpriteCollab and pulls names, types and base stats from PokeAPI into `data/roster.generated.json`. `data/roster.ts` assigns each a tier by base stat total and derives its game stats. `game/roster.ts` draws each run's cast (seeded, weighted by `biomeWeight` towards the types of the biome each stage plays in), keeps species with a trait to at most one per stage from minute 1, and the shell loads only the first stage before the run, streaming the rest (rift legendaries, Arceus and Meowth included).
- **Bosses** attack with data-driven patterns from `data/bosses.ts` (telegraphed `strikes`, projectile `ring`s, lingering `trail`s). They spawn `Hazard`s, which hurt the player. Wave bosses tag their patterns with a `stance` (`close` or `ranged`), swap stance every few seconds and enrage under half HP (`BOSS_RAGE`; rules in `game/bossFight.ts`); rift legendaries and Arceus keep flat patterns. To add a legendary, add it to `ENEMIES` (`legendary: true`), add a boss event and its patterns, and add its dex to `scripts/dex.mjs`.
- **Map events** are data in `MAP_EVENTS` (`game/mapEvents.ts`): each kind has a spawn rule for the event director (earliest time, weight, max alive, lifetime, distance), a `create` for its state, an `update` with the interaction and reward, and optional `enter`/`expire` hooks. To add one, add its state to `MapEventStates`, its definition, its art in `render/mapEvents.ts` (plus an arrow in `MARKER` if it's important) and, if it talks to the player, a `MapEventNotice` handled in `ui/mapEvents.ts`.
- **Terrain** (`data/terrain.ts`, `game/terrain.ts`): each world cell holds at most one feature (a rock pile, a grove, a mountain, a lake or a tower), placed from the run's seed so replays rebuild the same map, kept off the cell's edges so neighbors never close a passage, and never near the start. Footprints are unions of ellipses from data, the same in every biome: `render/terrain.ts` dresses them per biome (the meadow's hill is the cave's rock wall), sculpting the sprites in code with `render/sculpt.ts`. Solids push walkers out (enemies slide along them toward the player) and break enemy shots; lakes slow walkers, or make the player slide on ice in the snow. Flyers, ghosts, bosses and the player's attacks ignore terrain. Tall pieces go see-through where the player walks behind them.
- **Rifts** keep the map side (`riftPortal.ts`: a portal opens, the player stands in it) apart from the arena (`riftArena.ts`). Entering sets the world aside (horde, hazards, pickups, props; map events, weather and the biome schedule pause) and leaving puts it back; the run clock keeps going. The portal stays out of `MAP_EVENTS`: it runs on a fixed schedule (`riftDue`: a slot every ~4 min, waiting up to 45 s for a living boss to fall) that the event director's random pacing can't promise. Legendaries, arena colors and timings live in `data/rifts.ts`; each arena's floor plan (shape, scenery, shallow water, lava and bridges, the rising tide or the crumbling edge) in `data/arenas.ts`, its geometry in `game/arenaFloor.ts` (pure, tested) and its look in `render/rift.ts`. The arena's scenery collides through `game/terrain.ts` like the map's.
- **Endless mode** starts from the victory screen (`continueEndless`). `endlessPressure` raises the spawn rate past 15:00 and `endlessSystem.ts` runs rings, swarms and the reaper.
- **Shinies:** each regular spawn has a 1/450 chance to be a shiny elite (8x HP, 10x EXP, drops a Poké Ball), times the run's `shinyBoost` (each Shiny Charm rank adds a third, a Lure doubles it). Shiny sprites come from SpriteCollab's `0000/0001` form, stored in `public/assets/pokemon/<dex>/shiny/`. The starter's 1/64 roll is always drawn; a shiny picked on the select screen (`shinyStarters` in the save, `game/shinyStarters.ts`) only reaches the run as `ReplayStart.shiny`, so it changes the colors and nothing else, and the `shinyStarter` medal counts only the roll (`player.luckyShiny`).
- **Surto do dia:** `game/outbreak.ts` draws one species per Brasília day (`game/day.ts`) from the plain tier-2 species with a shiny sprite, walking seeded cycles so each gets its day. `withOutbreak` adds it to every stage of the drawn roster at the weight of the stage's heaviest species (never as a runner), after the draw, so the rest of the cast stays the same. Its shinies come from the volume (measured: ~1,070 spawns and ~2.4 shinies a 15-min run, on the regular odds). It's a run input (`ReplayStart.outbreak`), and the API fails a replay whose outbreak isn't the one of the day its start token was made, or the day before (`outbreakFits`).
- **Poké Mart:** three shelves in `ui/shop.ts`. Upgrades are `UPGRADES` in `game/meta.ts` (an optional `growth` per upgrade; the Shiny Charm doubles). The counter (`game/mart.ts`) is drawn from the Brasília day (the egg's tier and the sale) with a daily stock per item (`counter` in the save). Bought items go to the Bag (`game/bag.ts`: per item a `got` and a `used` counter, so a merge never brings a used item back), and the run uses the armed ones up as it starts (`useArmed`), recording them as `ReplayStart.lure` and `incense`. Styles are priced in `data/style.ts`, drawn from `render/cosmetics.ts` and owned and worn in the save's `style` (`game/style.ts`). Everything bought at the counter or on the style shelf adds to the save's `spent`, which the sync counts as part of the fortune.
- **Share cards:** `render/card.ts` lays each card out on a 270×338 canvas (code art, PMD sprites at whole scales, the game fonts thresholded to hard pixels) and blows it up ×4 into a 1080×1352 PNG. The look comes from `render/cosmetics.ts` (card frames, backgrounds and PC Box wallpapers as data, plus the defaults), so a new style is a new entry there. `ui/share.ts` builds the card data from the run or the save and shows the preview (share sheet on phones, clipboard on computers, download otherwise). Links carry the sharer's handle as `?ref=`; on boot `captureRef` (`ranking.ts`) keeps the first handle a device lands with in `ps:ref` (never its own; rules in `game/referral.ts`).
- **Invites and Mystery Gifts:** the API keeps an inbox per player (`gifts` table). On every sync `account.ts` fetches the unclaimed gifts, applies each to the save with `applyGift` (`game/gifts.ts`: an egg, ₽, a gift title, a style, or a family hatched shiny on the spot; an egg waits while the incubator is full) and claims them; the save keeps the applied ids (`gifts`, a union on merge), so a gift never lands twice. `ui/gifts.ts` shows the "Presente Misterioso!" banner and `main.ts` plays a shiny hatch's scene out of a run. Invites: the device's first sync for an account sends the stored `ps:ref` before the save goes up (`POST /referral`); the API records it only for a new account (`canRefer` in `game/referral.ts`: no save yet, created in the last 48 h, not credited before, not oneself), makes both follow each other and sends the newcomer a Friendship Egg. After each verified re-simulation (`server/src/checks.ts`) `gifts.credit` checks whether the newcomer reached `REFERRAL.verifiedRuns`, credits the inviter once and sends the gifts of the milestone their count hits (`FRIEND_MILESTONES`). Gift titles (`GIFT_TITLES` in `data/achievements.ts`) live in the save's `titles` next to the medal titles, and gift-only styles have a `null` price in `data/style.ts` (the shelf lists them once owned).
- **Status conditions:** moves declare `status: { kind, chance, duration, power }` in data (burn, poison, paralysis, slow; the Poké Flute inflicts sleep). Burn and poison deal damage over time, burn halves contact damage, poison stacks up to 5x, paralysis stuns and stutters (shorter on bosses).
- **Special attack:** one manual move on a cooldown, defined in `special.ts` per Pokémon type (with optional per-species overrides). Fire, Water and Grass have bespoke forms; the other types pick one of six shared forms (bolt, nova, rain, ring, wave, trail) plus a color and a status, drawn by `render/specialFx.ts`. Per-species overrides (`BY_SPECIES`, per stage if needed) give the agile lines a chain dash (a lunge into the nearest foe; a press within 0.5 s of a hit jumps to the next, and the cooldown starts only when the chain ends) and Aegislash its Stance Change (`stance.ts`: Shield/Blade multipliers on the final stats). Input reaches `step()` as data (`{ move, special, mega }`), so a chain's follow-up presses replay like any other press.
- **Mega Evolution:** `data/megas.ts` holds each Mega as data (line, asset form, Mega Stone, stats, special, ability effect: `stats`, an `aura` status or a `weather`), `game/mega.ts` the rules. A beaten rift legendary drops the line's stones (`riftArena.ts`; two to choose from, which the magnet leaves alone, for the lines with two Megas) and the one picked up sets `mega.stone`; at the final stage a press starts the transformation, during which `step()` holds the world still (`updateMegaIntro`), then the form adds its stats in `recomputeStats` and `gameSpecial` swaps in its special until `MEGA.duration` runs out and `MEGA.recharge` starts. Mega sprites are alternate forms (`FORMS` in `scripts/dex.mjs`, only for the Megas SpriteCollab has drawn; the others fall back to the final stage plus an outline) and Mega cries come from PokeAPI (`FORM_CRIES`); the art lives in `render/megaFx.ts`.
- **Damage numbers:** `damageText.ts` groups them per target (a short merge window, a cap per target, fixed slot offsets) as a pure rule. Which ones get drawn is presentation: `render/damageNumbers.ts` applies the setting, and `reduced` (the default) keeps the 8 biggest on screen plus the boss's, shown a bit shorter.
- **Languages:** Brazilian Portuguese and English, picked from the browser language and switchable on the title screen (`PT | EN`, or `I`) and in Settings (pause menu). Text lives in `src/i18n`: `pt.ts` is the reference and its inferred type forces `en.ts` to match it, down to one line per move upgrade. Data files keep only the official English names. Toast strings use light markup (`*bold*`, `_accent_`) so each language can put names where its grammar wants them.
- **Type chart:** damage uses real Pokémon type matchups, softened (2x → 1.5x, 0x → 0.5x). Yellow numbers with `!` mean super effective.
- **Music** is code: `data/music.ts` holds the scores in a small tracker notation (`engine/score.ts`) and `engine/music.ts` plays them on two pulse channels, a triangle bass and a noise kit. The shell picks the theme each frame (`playTheme`). Music and effects have separate buses in `engine/audio.ts`, so music always sits under effects and cries.
- **Biomes and weather:** `data/biomes.ts` holds the biome order (equal slices of the run), each biome's weather odds, theme and `affinity` (the types that feel at home there, which weight the enemy draw through `biomeWeight`). `game/biomes.ts` follows the schedule and `game/weather.ts` rolls weather spells and applies their rules (`data/weather.ts`): `weatherBoost`/`weatherPower` multiply damage by attack type in `combat.ts` (player moves, enemy bodies by their types, boss hazards by `HAZARD_TYPES`), and sandstorm/snow wear down anyone not immune. The ground and breakables are drawn per biome in `render/world.ts` and `render/props.ts`, the overlays in `render/weather.ts`.
- **Meta progression** is saved in `localStorage`. `game/meta.ts` holds the pure rules.
- **Difficulty:** `game/difficulty.ts` holds the levels as plain multipliers (`DIFFICULTIES`; Normal is all 1s). Each one is applied in a single place: enemy HP in `spawnEnemy` (`enemyScale`), the damage the player takes in `hurtPlayer`, spawns in the spawner, the time slope through `scaling`'s `ramp` and every heal through `healPlayer`. The run keeps its `difficulty` and `summarizeRun` records it, so the ranking can keep a board per level.
- **Accounts** are optional and only mirror the local save. `account.ts` loads Clerk when the player signs in (or on boot, on a device that did) and pushes the save at sign in, on boot and at the end of every run. `game/sync.ts`, shared with `server/`, holds the rules: `mergeSaves` joins two saves keeping the larger side of everything (unions for the collection and the styles, max for upgrades, records, missions and the bag's counters, the larger fortune for ₽, spending included), so merging again changes nothing; `applyPush` stores a push made on top of the latest revision as is (so spending and hatching stick) and merges anything else (a first sign in, two devices). A failed sync never blocks the game: the save stays local and syncs next time.
- **Ranking:** `game/ranking.ts`, shared with `server/`, holds the rules: what a run reports (`RunResult`), the checks it must pass (`parseRunResult` for plausible numbers, `clockAllows` for the wall clock since its start token, with `RANKED.slack` for a late token) and the handle and display name rules. A signed-in run asks for its token when it starts loading (`startRanked` in `ranking.ts`), reports at a faint or a victory and again on the way out if it went on into endless mode; the result waits in `ps:runs` until the API takes it, so a run played offline still lands later, and nothing waits on the network. The boards keep each player's best run (`server/src/ranking.ts`); days and weeks follow `BOARD_TIME_ZONE` (America/Sao_Paulo). The ranking and profile screens are DOM screens in the game (`ui/ranking.ts`, `ui/profile.ts`), and a shared link `/?u=handle` opens the game straight on that profile.
- **Replays and verification:** the simulation is deterministic at its fixed 60 Hz step, on every engine: the seeded rng, hitboxes from data (`data/bodies.ts`, measured from the PNGs by `npm run bodies`, so they don't depend on when a sprite downloaded) and `engine/dmath` instead of `Math.sin`, `Math.atan2`, `Math.hypot`, `Math.exp` and `**`, which differ in the last bit between V8 and JavaScriptCore. Every run records a replay (`game/replay.ts`): its start (seed, Pokémon, Poké Mart ranks, difficulty, the day's outbreak, the bag items used, screen size) plus the stick per tick (32 directions × 7 speeds, run-length encoded; the run itself plays with that quantized stick) and the rare events (special, level-up picks, rerolls, skips, endless mode, screen resizes). A ranked run sends it with its result, and the API re-simulates it on a worker thread after answering (`server/src/checks.ts`): the run is verified when it ends on the same time, faints and level, and leaves the boards otherwise.
- **Co-op (lockstep):** every player runs the same deterministic simulation from the same seed; the play server (`server/src/play`) never simulates, it stamps each player's inputs into numbered 60 Hz ticks and relays them 30 times a second (`net/protocol.ts`), never waiting for anyone. A client keeps two ticks in hand against jitter, catches up after a hidden tab or a reload (it rejoins its slot and fast-forwards the backlog) and draws its own Pokémon where its stick already took it (`predictedOffset`). The game holds `players` by slot; per-player systems (walking, moves, the special, Mega) run once per player through `actAs`, which points `g.player` at them and stamps their slot on the events, and world systems go through `players.ts` (nearest player, anyone on screen, taking turns for spawns). Solo runs take the exact same path with one player and re-simulate bit for bit as before. Clients compare a `stateSum` every 2 s, so a drift shows up. Only inputs travel, so the relay costs ~30 small messages a second per player.
- **Pokédex:** the simulation fills a run's `dexLog` (species on screen via `sightings.ts`, defeats and caught shinies in `killEnemy`); the shell folds it into the save's `dex` field when the run is banked. `game/dex.ts` holds the pure rules: a compact `[defeated, flags]` mark per dex number, `markCaught` (defeated shinies, hatched eggs via `markHatch`, and the forms the player played, logged in `dexLog.own`) and `dexCounts` for anything that reads progress, like the Pokédex achievements.
- **Eggs:** `game/eggs.ts` holds the rules (drop odds per source, the per-run cap, steps per tier, the incubator, hatching, duplicates). A run counts `player.walked`; the shell banks steps and found eggs into the save (`eggs`, `hatched`) like ₽, and ready eggs hatch when the player leaves the run (`ui/incubator.ts`). The playable families live in `data/hatchlings.ts` with the starters' shape (`PlayableDef`), and `PLAYABLE` merges both. `grantEgg` gives an egg from outside a run (mission rewards).
- **Missions and achievements** never reach into the simulation's systems: the run keeps a small `tally` (kills by type, weather and biome, shinies, bosses, map event notices), bumped only when something faints or a map event speaks. When the run ends the shell takes a `summarizeRun` snapshot and `recordRun` adds it to the missions (`game/missions.ts`, drawn from the local date via a seeded rng) and the lifetime records behind the achievements (`game/achievements.ts`). Recording works on the difference from the last snapshot, so a victory that goes on into endless mode is never counted twice. Eggs hatch outside runs, so a hatch is recorded on its own (`recordHatch`: hatch missions and the egg achievements), and the Pokédex achievements read the save's `dex`. Weekly missions with an `egg` and gold medals (`MEDAL_EGG`) give an egg through `grantEgg`; at the end of a run those share the run's `EGGS.perRun` with the eggs it found. The catalogs live in `data/missions.ts` and `data/achievements.ts`.

</details>

## Roadmap

- Evolutions for the newer signature moves (Mach Punch, Spirit Shackle, Pyro Ball…).
- Custom effects/tiles.

## Contributing

Bug reports and ideas are very welcome: [open an issue](https://github.com/pedrobarretto/pokemon-survivors/issues/new/choose). Pull requests are welcome too. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first and follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Credits

- **Sprites and portraits:** [PMD SpriteCollab](https://sprites.pmdcollab.org) (CC BY-NC 4.0). Every artist is listed in [CREDITS.md](CREDITS.md).
- **Cries:** [PokéAPI/cries](https://github.com/PokeAPI/cries).
- **Fonts:** Press Start 2P and VT323 (SIL Open Font License).
- **Inspiration:** [Vampire Survivors](https://poncle.itch.io/vampire-survivors) by poncle.

## Legal

Pokémon Survivors is an unofficial, free, non-commercial fan project made by fans for fans. It is not affiliated with, endorsed, sponsored or approved by Nintendo, The Pokémon Company, GAME FREAK inc., Creatures Inc. or Spike Chunsoft.

Pokémon and Pokémon character names are trademarks of Nintendo. Pokémon © Nintendo, Creatures Inc. and GAME FREAK inc. All other trademarks belong to their respective owners. The game has no ads, no paid content and no in-app purchases. Poké Dollars exist only inside the game.

The [MIT license](LICENSE) covers only the original source code of this repository. It grants no rights to Pokémon characters, names, sounds or artwork. The sprites and portraits are distributed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/), so the game as a whole cannot be used commercially.

If you hold rights to any material used here and have concerns, please [open an issue](https://github.com/pedrobarretto/pokemon-survivors/issues) or contact [@pedrobarretto](https://github.com/pedrobarretto). It will be addressed promptly.

<sub>🇧🇷 Pokémon Survivors é um fan game não oficial e sem fins lucrativos. Não tem nenhum vínculo com a Nintendo, The Pokémon Company, GAME FREAK ou Creatures, nem é endossado por elas. Pokémon e os nomes dos personagens são marcas registradas da Nintendo.</sub>
