import { drawEvoItem } from './evoItemArt'
import { blitCentered, blitPacked, blitEllipse, blitRing, blitRotated, context2d, createCanvas, lazy, textSprite } from '../engine/pixelart'
import { HAZARD_COLORS } from './hazardColors'
import { drawCapture } from './capture'
import { drawNightmareAir, drawNightmareDark, drawNightmareGround, shadeAlpha, SLEEP_TINT } from './darkrai'
import { isAsleep } from '../game/playerSleep'
import { drawDomainFloor, drawTear, warmDomain } from './domain'
import { bossForm, drawBeamAir, drawBeamGround, drawBlasts, drawBossGround, drawBossMarker, drawEntrance, drawLegendScene, drawPairDown, drawPhantoms } from './legendFx'
import { sceneHides } from '../game/legendScene'
import { drawLegendSky, drawOmenGround } from './legendSky'
import { bossLook, drawDomainAir, drawDomainGround, drawDomainScreen, drawVortexAir, drawVortexGround } from './domainLooks'
import { TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import { BIOME_ORDER, BIOMES, biomeAt, type BiomeId } from '../data/biomes'
import { ENEMIES, type EnemyDef } from '../data/enemies'
import { TYPE_COLORS } from '../data/types'
import { FLEE_TIME } from '../game/enemies'
import { EVOLUTION_TIME } from '../game/game'
import { coinTier } from '../game/meta'
import { xpTier } from '../game/pickups'
import { isHeld } from '../game/status'
import { inSolid, overTerrain, type Solid } from '../game/terrain'
import { isAirborne, traitPace } from '../game/traits'
import type { Attack, Enemy, Game, Hazard, Player } from '../game/types'
import { FX, HAZARD_FX, hostile, PICKUPS, SPARKLE, SPIT_FX } from './art'
import { drawEvolvedAttack, drawEvolvedGround, drawFrost, drawShard } from './evolved'
import { drawMapEventMarkers, drawMapEvents, markerInsets } from './mapEvents'
import { ALPHA_PRIZE, alphaOutline, drawAlphaAir, drawAlphaGround, drawAlphaMarkers } from './alphas'
import { drawScale } from '../game/alphas'
import { drawMegaAir, drawMegaAttack, drawMegaGround, drawMegaStone, megaLook } from './megaFx'
import { drawModAttack, drawModGround, flightAngle } from './modFx'
import { drawMoveFxAttack, drawMoveFxGround } from './moveFx'
import { drawConsumable, drawFlash, drawProps, drawSleep } from './props'
import { drawSpecialAttack, drawSpecialAura, drawSpecialGround } from './specialFx'
import { awakeningLook, CLONE_OUTLINE, CLONE_TINT, drawLegendAura, playerSprites } from './legend'
import { isClone } from '../game/legend'
import { drawArena, drawRiftArrow, drawRiftFallAir, drawRiftFallGround, drawRiftFallOut, drawRiftPortal, dropArenas, riftFallLook, warmArena } from './rift'
import { drawEntranceAir, drawEntranceGround, drawPlaceArrow, drawPlaceDark, drawPlaceFallOut, drawPlaceFloor, drawPlaceGround, drawPlaceOver, drawWings, dropPlaceFloor, placeFallLook } from './places'
import { roomOf } from '../game/room'
import { drawLandmarkAir, drawTunnelDark, playerUnderground } from './landmarks'
import { drawPokemon, sprites, type AnimName, type SpeciesSprites } from './sprites'
import { drawWearables } from './wearables'
import { shownLook } from './looks'
import { bodyOf } from '../data/bodies'
import { drawDrainVines, drawTypeEvolvedAttack, drawTypeEvolvedGround } from './typeEvolved'
import { drawCompanion, type CompanionView } from './companion'
import { arenaEmote, arenaFollowers, drawArenaFxAir, drawArenaFxGround, drawFollower, isFollower, stepArenaFx, type FollowerDrawable } from './arenaFx'
import { drawPlateBar, plateOf } from './arenaPlates'
import { drawStatusBadge, statusTint } from './status'
import { drawGuard, drawKitStatus, drawTelegraph } from './kitFx'
import { drawEggAttack, drawEggGround, drawEggPlayer, eggPlayerLook } from './eggMoveFx'
import { drawEgg3Attack, drawEgg3Ground, drawEgg3Player, egg3PlayerLook } from './eggMove3Fx'
import { drawEgg2Attack, drawEgg2Ground } from './eggMove2Fx'
import { drawVerbAir, drawVerbGround, drawVerbPlayerAir, drawVerbPlayerGround } from './verbFx'
import { drawTmAir, drawTmDisc, drawTmGround, drawTmPlayer } from './tmFx'
import { drawShopTmAir } from './shopTmFx'
import { drawShopTm2Air, drawShopTm2Ground, drawShopTm2Player, shopTm2PlayerLook } from './shopTmFx2'
import { drawVerbEvolvedAir, drawVerbEvolvedGround } from './verbEvolvedFx'
import { drawDuoAir, drawDuoGround } from './duoFx'
import { drawAncientAura, drawLegendaryAir, drawLegendaryGround, drawStoppedFoes } from './legendaryFx'
import { drawHeatAura, drawIronDefense, drawLegendary2Air, drawLegendary2Ground } from './legendaryFx2'
import { drawSignatureAttack, drawSignatureGround, drawSignaturePlayer } from './signatureFx'
import { drawTraitAir, drawTraitGround, traitLift, traitTint } from './traits'
import { bolt, dashedRing } from './strokes'
import { dropFog, drawWeather, warmFog, type FogMode } from './weather'
import { drawHauntedNight, drawTreat } from './halloweenArt'
import { drawSolid, drawTerrainGround, drawWading, keepTerrain, solidCovers, solidsInView, warmTerrain } from './terrain'
import { drawGround, GROUND_LOOKAHEAD, warmGround } from './world'
import { damageBudget, showsText, textAlpha, type DamageNumbers } from './damageNumbers'
import { CALM_PERIOD, HURT_TINT, type Flashes } from './flashes'
import { detail } from './quality'
import { localPlayer } from '../game/players'
import { riftDomain } from '../game/rift'
import { drawTeamAir, drawTeamGround, drawTeammate, drawTeamMarkers, showsPlain, showsStanding } from './team'
import { drawVersusGuide } from './versusGuide'
import { mapOf } from '../game/versusRules'
import { drawArenaAim, type ArenaOverlay } from './arenaAim'
import { drawValeAir, drawValeFloor, drawValeGround, drawValeZones, dropVale, TEAM_COLORS, warmVale } from './vale'
import { concealed, drawGrassFront, drawGrassPatches, grassAlpha } from './valeGrass'
import { drawValeProp, valePropCovers, valePropsInView, type ValeProp } from './valeProps'
import { drawValePings } from './valePings'
import { paintAttacks, type AttackSide } from './attackLayers'
import { drawImpacts, watchImpacts } from './impacts'
import { drawCrunch, drawDragonBreath, drawEarthquake, drawEmber, drawPinMissile, drawFireSpin, drawWhirlpool, drawFlashCannon, drawPsyshock, drawPyroBall, drawGust, drawRazorLeaf, drawRockTombLanding, drawSludge, drawSludgeGround, drawSwift, drawThunder, drawThunderGround, drawVineWhip, drawWaterGun } from './baseMoveFx'

type Ctx = CanvasRenderingContext2D

export const shadow = (ctx: Ctx, x: number, y: number, width: number) => {
  const rx = Math.max(3, Math.round(width * 0.36))
  blitEllipse(ctx, rx, Math.max(1, Math.round(rx * 0.4)), 'rgba(16,40,16,0.28)', x, y)
}

/* ---------------- Attacks ---------------- */

const drawGroundAttack = (ctx: Ctx, a: Attack, t: number) => {
  if (a.shape.kind !== 'circle') return
  const r = a.shape.r
  switch (a.visual) {
    case 'telegraph':
      return drawTelegraph(ctx, a)
    case 'whirlpool':
      return drawWhirlpool(ctx, a, t)
    case 'sludge':
      return drawSludgeGround(ctx, a)
    case 'thunder':
      return drawThunderGround(ctx, a)
    case 'quake':
      return drawEarthquake(ctx, a)
    case 'drumRoots': {
      ctx.globalAlpha = Math.max(0, 1 - a.age / a.ttl)
      dashedRing(ctx, a.x, a.y - 4, r, a.age * 4, ['#78c850', '#a87840', '#58a838'], 0.75)
      // The downbeat rings twice.
      if (a.memo === 1) dashedRing(ctx, a.x, a.y - 4, r - 3, -a.age * 5, ['#c8f080', '#ffffff'], 0.6)
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * TAU + a.id
        const x = Math.round(a.x + Math.cos(angle) * r)
        const y = Math.round(a.y - 4 + Math.sin(angle) * r)
        ctx.fillStyle = '#5a3818'
        ctx.fillRect(x, y - 3, 1, 4)
        ctx.fillStyle = '#78c850'
        ctx.fillRect(x - 1, y - 4, 3, 1)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'iceShard':
      return drawFrost(ctx, a, r)
    case 'rockTomb': {
      // A growing shadow (and a blinking rim) warns where the boulder lands; then the dust ring spreads.
      if (a.age < a.activeFrom) {
        const k = 0.4 + 0.6 * (a.age / a.activeFrom)
        blitEllipse(ctx, Math.round(r * k), Math.max(1, Math.round(r * 0.5 * k)), 'rgba(24,16,8,0.4)', a.x, a.y)
        if (Math.floor(a.age * 24) % 2 === 0) dashedRing(ctx, a.x, a.y, r, 0, ['#d8c080'], 0.9, 0.5)
        return
      }
      const e = (a.age - a.activeFrom) / (a.ttl - a.activeFrom)
      ctx.globalAlpha = Math.max(0, 1 - e)
      dashedRing(ctx, a.x, a.y, r * (0.7 + e * 0.6), a.id, ['#685028', '#a08048', '#d8c080'], 0.7, 0.5)
      ctx.globalAlpha = 1
      return drawRockTombLanding(ctx, a)
    }
    default:
      drawEvolvedGround(ctx, a, t)
      drawMoveFxGround(ctx, a)
      drawEggGround(ctx, a, t)
      drawEgg3Ground(ctx, a, t)
      drawEgg2Ground(ctx, a, t)
      drawSignatureGround(ctx, a, t)
      drawTypeEvolvedGround(ctx, a, t)
      drawModGround(ctx, a, t)
      return drawSpecialGround(ctx, a)
  }
}

/** Small 8-ray impact spark (punch / bite hits). */
const spark = (ctx: Ctx, x: number, y: number, size: number) => {
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * TAU
    const len = i % 2 === 0 ? size : size * 0.6
    for (let d = 2; d <= len; d++) {
      ctx.fillStyle = d === 2 ? '#ffffff' : '#f8e070'
      ctx.fillRect(Math.round(x + Math.cos(angle) * d), Math.round(y + Math.sin(angle) * d), 1, 1)
    }
  }
}

/** Crescent slash arc, revealed by `sweep` (0..1). */
const slashArc = (ctx: Ctx, x: number, y: number, r: number, dir: number, sweep: number) => {
  const steps = Math.ceil(r * 2.6)
  const colors = ['#ffffff', '#a8d8f8', '#4878c0']
  for (let i = 0; i <= steps * sweep; i++) {
    const angle = dir - 1.1 + (2.2 * i) / steps
    const thick = Math.sin((i / steps) * Math.PI) * 3
    for (let k = 0; k < thick; k++) {
      ctx.fillStyle = colors[k]!
      ctx.fillRect(Math.round(x + Math.cos(angle) * (r - k)), Math.round(y + Math.sin(angle) * (r - k)), 1, 1)
    }
  }
}

const drawAttack = (ctx: Ctx, a: Attack, t: number) => {
  const m = a.motion
  switch (a.visual) {
    case 'ember':
      return drawEmber(ctx, a, t)
    case 'flame':
      return drawFireSpin(ctx, a, t)
    case 'water':
      return drawWaterGun(ctx, a, t)
    case 'leaf':
      return drawRazorLeaf(ctx, a)
    case 'star':
      return drawSwift(ctx, a, t)
    case 'sludge':
      return drawSludge(ctx, a, t)
    case 'thunder':
      return drawThunder(ctx, a)
    case 'gust':
      return drawGust(ctx, a)
    case 'vine':
      return drawVineWhip(ctx, a)
    case 'fist': {
      if (m.kind !== 'follow') return
      const angle = Math.atan2(m.oy + 8, m.ox)
      blitRotated(ctx, FX.fist(), a.x, a.y, angle)
      if (a.age > a.ttl * 0.5) spark(ctx, a.x + Math.cos(angle) * 6, a.y + Math.sin(angle) * 6, 5)
      return
    }
    case 'steel':
      return drawFlashCannon(ctx, a, t)
    case 'arrow':
      return blitRotated(ctx, FX.arrow(), a.x, a.y, flightAngle(m) ?? 0)
    case 'shuriken':
      // Water Shuriken swells as it cuts (`signatures.ts`).
      return blitRotated(ctx, FX.shuriken(), a.x, a.y, a.age * 22, a.shape.kind === 'circle' && a.shape.r > 6 ? 2 : 1)
    case 'jaws':
      return drawCrunch(ctx, a, (x, y, size) => spark(ctx, x, y, size))
    case 'pyro':
      return drawPyroBall(ctx, a, t)
    case 'psy':
      return drawPsyshock(ctx, a, t)
    case 'heart':
      return blitCentered(ctx, FX.heart(), a.x, a.y + Math.round(Math.sin(a.age * 14) * 1.5))
    case 'note': {
      const x = a.x + Math.round(Math.sin(a.age * 12) * 2)
      // Torch Song's streak: from the third song in a row the notes burn inside a flame.
      if (a.memo >= 3) blitCentered(ctx, FX.flame()[Math.floor((t + a.id) * 10) % 2]!, x, a.y - 3)
      return blitCentered(ctx, FX.note(), x, a.y)
    }
    case 'blade': {
      if (m.kind !== 'orbit') return
      const r = a.shape.kind === 'circle' ? a.shape.r : 9
      // Leaf Blade's critical swing is golden.
      return blitRotated(ctx, a.memo === 1 ? FX.critBlade() : FX.blade(), a.x, a.y, m.angle + Math.PI * 0.75, Math.max(1, Math.round(r / 5)))
    }
    case 'shell': {
      if (m.kind !== 'follow' || a.shape.kind !== 'circle') return
      const dir = Math.atan2(m.oy + 8, m.ox)
      ctx.globalAlpha = Math.min(1, (a.ttl - a.age) / 0.08)
      slashArc(ctx, a.x - Math.cos(dir) * a.shape.r * 0.5, a.y - Math.sin(dir) * a.shape.r * 0.5, a.shape.r * 1.2, dir, Math.min(1, a.age / 0.1))
      ctx.globalAlpha = 1
      return
    }
    case 'iceShard':
      return drawShard(ctx, a, FX.iceShard(), FX.icicles())
    case 'rockTomb': {
      // Falls from above, speeding up, then sits cracked where it landed until it crumbles.
      const k = Math.min(1, a.age / a.activeFrom)
      const drop = Math.round(80 * (1 - k * k))
      ctx.globalAlpha = Math.min(1, (a.ttl - a.age) / 0.25)
      blitCentered(ctx, FX.boulder(), a.x + (a.flip ? 1 : 0), a.y - 5 - drop)
      ctx.globalAlpha = 1
      return
    }
    case 'pin':
      return drawPinMissile(ctx, a, t)
    case 'dragonBreath':
      return drawDragonBreath(ctx, a, t)
    case 'whirlpool':
    case 'quake':
    case 'drumRoots':
    case 'telegraph':
      return
    default:
      drawEvolvedAttack(ctx, a, t)
      drawMoveFxAttack(ctx, a, t)
      drawEggAttack(ctx, a, t)
      drawEgg3Attack(ctx, a, t)
      drawEgg2Attack(ctx, a, t)
      drawSignatureAttack(ctx, a, t)
      drawTypeEvolvedAttack(ctx, a, t)
      drawModAttack(ctx, a, t)
      drawMegaAttack(ctx, a)
      return drawSpecialAttack(ctx, a, t)
  }
}

/* ---------------- Boss hazards ---------------- */


/** How far a volley's aim line reaches, px, and the step between its dashes. */
const AIM_LENGTH = 110
const AIM_STEP = 6

/** A volley shot's windup: a dashed line where it will fly, growing out and blinking faster as it's about to fire. */
const drawAimLine = (ctx: Ctx, h: Hazard, color: string) => {
  const k = h.age / h.armAt
  if (Math.floor(h.age * (5 + k * 15)) % 3 === 2) return
  const speed = Math.hypot(h.vx, h.vy) || 1
  const dx = h.vx / speed
  const dy = h.vy / speed
  ctx.fillStyle = color
  for (let d = AIM_STEP; d < AIM_LENGTH * Math.min(1, k * 2); d += AIM_STEP) {
    ctx.fillRect(Math.round(h.x + dx * d), Math.round(h.y + dy * d), 2, 2)
  }
}

/** Ground layer: telegraph circles, landed shockwaves, volley aim lines and lingering fire. */
const drawHazardGround = (ctx: Ctx, h: Hazard) => {
  const [line, fill] = HAZARD_COLORS[h.visual]
  const r = Math.round(h.r)
  if (h.kind === 'strike') {
    if (h.age < h.armAt) {
      const k = h.age / h.armAt
      blitEllipse(ctx, Math.max(1, Math.round(r * k)), Math.max(1, Math.round(r * k)), fill, h.x, h.y)
      // A boss about to land here (`leap`) casts its shadow first, growing as it falls.
      if (h.leaper >= 0) blitEllipse(ctx, Math.max(1, Math.round(r * 0.7 * k)), Math.max(1, Math.round(r * 0.35 * k)), 'rgba(24,16,32,0.45)', h.x, h.y)
      // The outline blinks faster as the impact gets close.
      if (Math.floor(h.age * (6 + k * 18)) % 2 === 0) blitRing(ctx, r, 1, line, h.x, h.y)
      return
    }
    if (h.visual === 'thunder' || h.visual === 'rock') return
    const k = (h.age - h.armAt) / (h.ttl - h.armAt)
    ctx.globalAlpha = 1 - k
    blitEllipse(ctx, r, r, fill, h.x, h.y)
    blitRing(ctx, Math.round(r * (0.6 + k * 0.5)), 2, line, h.x, h.y)
    ctx.globalAlpha = 1
    return
  }
  if (h.kind === 'zone' && h.world) return drawWorldZone(ctx, h, line, fill)
  if (h.kind === 'shot' && h.age < h.armAt) return drawAimLine(ctx, h, line)
  if (h.kind === 'zone') {
    // A zone fades in over the 0.15 s before it arms (a lobbed sludge's puddle shows as the blob lands).
    const shown = h.age - Math.max(0, h.armAt - 0.15)
    if (shown < 0) return
    ctx.globalAlpha = Math.min(1, shown / 0.15, (h.ttl - h.age) / 0.4)
    const ry = Math.max(1, Math.round(r * 0.5))
    // A sludge puddle gets a hard rim and a bubble that pops now and then.
    if (h.visual === 'sludge') blitEllipse(ctx, r + 1, ry + 1, line, h.x, h.y)
    blitEllipse(ctx, r, ry, fill, h.x, h.y)
    if (h.visual === 'fire') blitCentered(ctx, FX.flame()[Math.floor((h.age + h.id) * 8) % 2]!, h.x, h.y - 5)
    if (h.visual === 'sludge' && Math.floor((h.age + h.id) * 3) % 2 === 0) blitRing(ctx, 1, 1, '#e0a0f0', h.x + ((h.id % 5) - 2) * 2, h.y - 1)
    ctx.globalAlpha = 1
  }
}

/**
 * A world hazard's lingering patch (`game/hazards.ts`): telegraphed like a strike,
 * then a round patch (its hitbox is round) with a few pieces standing in it.
 */
const drawWorldZone = (ctx: Ctx, h: Hazard, line: string, fill: string) => {
  const r = Math.round(h.r)
  if (h.age < h.armAt) {
    const k = h.age / h.armAt
    blitEllipse(ctx, Math.max(1, Math.round(r * k)), Math.max(1, Math.round(r * k)), fill, h.x, h.y)
    if (Math.floor(h.age * (6 + k * 18)) % 2 === 0) blitRing(ctx, r, 1, line, h.x, h.y)
    return
  }
  ctx.globalAlpha = Math.min(1, (h.ttl - h.age) / 0.4)
  blitEllipse(ctx, r, r, fill, h.x, h.y)
  // Thunder crackles: its rim flickers.
  if (h.visual !== 'thunder' || Math.floor((h.age + h.id) * 10) % 3 === 0) blitRing(ctx, r, 1, line, h.x, h.y)
  for (let i = 0; i < 3; i++) {
    const a = h.id * 2.4 + i * 2.1
    const x = h.x + Math.cos(a) * r * 0.5
    const y = h.y + Math.sin(a) * r * 0.45
    if (h.visual === 'rock') blitCentered(ctx, HAZARD_FX.stealthRock(), x, y - 2)
    else if (h.visual === 'poison') blitCentered(ctx, HAZARD_FX.toxicSpike(), x, y - 2)
    else if (h.visual === 'ice') blitRotated(ctx, HAZARD_FX.ice(), x, y - 2, -Math.PI / 2)
    else if (h.visual === 'fire') blitCentered(ctx, FX.flame()[Math.floor((h.age + h.id + i) * 8) % 2]!, x, y - 4)
  }
  ctx.globalAlpha = 1
}

/**
 * Air layer: projectiles, lightning bolts and falling rocks. Every shot and
 * falling piece wears the red `hostile` rim, so it never passes for one of the
 * player's own (an enemy's Ember is the player's Ember sprite).
 */
const drawHazard = (ctx: Ctx, h: Hazard) => {
  if (h.kind === 'shot') {
    const y = h.y - 6
    switch (h.visual) {
      case 'ice':
      case 'grass':
        return blitRotated(ctx, hostile(HAZARD_FX[h.visual]()), h.x, y, Math.atan2(h.vy, h.vx))
      case 'fire':
        return blitCentered(ctx, hostile(FX.ember()[Math.floor(h.age * 12) % 2]!), h.x, y)
      case 'rock':
        return blitCentered(ctx, hostile(HAZARD_FX.rock()), h.x, y)
      case 'water':
      case 'dragon':
      case 'steel':
      case 'aero':
      case 'shadow':
      case 'judgment':
        return blitCentered(ctx, hostile(HAZARD_FX[h.visual]()), h.x, y + (Math.floor(h.age * 10) % 2))
      case 'fireball':
      case 'seed':
        return blitRotated(ctx, hostile(SPIT_FX[h.visual]()), h.x, y, Math.atan2(h.vy, h.vx))
      case 'spark':
        return blitRotated(ctx, hostile(SPIT_FX.spark()[Math.floor(h.age * 16) % 2]!), h.x, y, Math.atan2(h.vy, h.vx))
      case 'bubble':
      case 'sludge':
      case 'orb':
        return blitCentered(ctx, hostile(SPIT_FX[h.visual]()), h.x, y + (Math.floor(h.age * 8) % 2))
      default:
        return blitCentered(ctx, hostile(HAZARD_FX.psychic()), h.x, y + (Math.floor(h.age * 10) % 2))
    }
  }
  // The world's telegraphs land under the player, where the horde piles up: their blinking rim shows over the sprites too.
  if (h.world && h.age < h.armAt && Math.floor(h.age * (6 + (h.age / h.armAt) * 18)) % 2 === 0) blitRing(ctx, Math.round(h.r), 1, HAZARD_COLORS[h.visual][0], h.x, h.y)
  if (h.kind !== 'strike') return
  // Rocks fall onto their circles; so do the world's hail and flares (`game/hazards.ts`).
  if (h.age < h.armAt && (h.visual === 'rock' || (h.world && (h.visual === 'ice' || h.visual === 'fire')))) {
    const fall = 1 - (h.armAt - h.age) / 0.35
    if (fall <= 0) return
    const y = h.y - 3 - (1 - fall) * 120
    if (h.visual === 'ice') blitRotated(ctx, hostile(HAZARD_FX.ice()), h.x, y, Math.PI / 2)
    else if (h.visual === 'fire') blitCentered(ctx, hostile(FX.ember()[Math.floor(h.age * 12) % 2]!), h.x, y)
    else blitCentered(ctx, hostile(HAZARD_FX.rock()), h.x, y)
    return
  }
  if ((h.visual === 'thunder' || h.visual === 'judgment') && h.age >= h.armAt) {
    ctx.globalAlpha = Math.max(0, 1 - (h.age - h.armAt) / (h.ttl - h.armAt))
    // Arceus's Judgment falls as a pillar of light.
    if (h.visual === 'judgment') bolt(ctx, h.x, h.y, 220, { width: 5, edge: '#f8e070', core: '#ffffff' })
    else bolt(ctx, h.x, h.y, 200)
    blitEllipse(ctx, Math.round(h.r), Math.round(h.r * 0.5), 'rgba(255,248,160,0.7)', h.x, h.y)
    ctx.globalAlpha = 1
  }
}

/* ---------------- Shiny sparkles ---------------- */

const SPARKLE_BURST = 0.9
const TWINKLE_PERIOD = 0.8

/**
 * The shiny star burst (eight stars flying out for `SPARKLE_BURST` seconds),
 * followed by a twinkle at a random spot on the body every `TWINKLE_PERIOD`.
 * `since` is seconds since the entrance; `size` is the body size in px.
 */
export const drawSparkles = (ctx: Ctx, x: number, cy: number, size: number, since: number, seed: number) => {
  if (since < 0) return
  const stars = SPARKLE()
  if (since < SPARKLE_BURST) {
    const k = since / SPARKLE_BURST
    const r = 4 + (1 - (1 - k) ** 2) * (size * 0.7 + 10)
    const big = k < 0.2 ? 1 : k < 0.7 ? 2 : k < 0.85 ? 1 : 0
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + k * 0.6
      blitCentered(ctx, stars[i % 2 ? Math.max(0, big - 1) : big]!, x + Math.cos(a) * r, cy + Math.sin(a) * r)
    }
    return
  }
  const cycle = Math.floor(since / TWINKLE_PERIOD)
  const phase = since / TWINKLE_PERIOD - cycle
  if (phase > 0.4) return
  const frame = phase < 0.08 || phase > 0.32 ? 0 : phase < 0.14 || phase > 0.26 ? 1 : 2
  const ox = (hash2(seed, cycle, 1) - 0.5) * size
  const oy = (hash2(seed, cycle, 2) - 0.5) * size
  blitCentered(ctx, stars[frame]!, x + ox, cy + oy)
}

/* ---------------- Entities ---------------- */

/** True while the player is up in the sky, where Pokémon with a Fly sheet fly instead of walking. */
const inSky = (g: Game) => g.place.inside?.id === 'sky'

/** Up in the sky (`aloft`) a species with a Fly sheet is on the wing, standing still or not; `walk` otherwise. */
const airborne = (s: SpeciesSprites, aloft: boolean, walk: AnimName): AnimName => (aloft && s.anims.Fly ? 'Fly' : walk)

const enemyAnim = (e: Enemy, s: SpeciesSprites, aloft: boolean): AnimName =>
  e.dying >= 0 || e.flash > 0 ? 'Hurt' : airborne(s, aloft, isHeld(e.status) || traitPace(e) === 0 ? 'Idle' : 'Walk')

/**
 * `time` is game time (shiny entrance), `t` wall time (status tint). `calm`
 * (Flashes: reduced) swaps the white hit flash for a dim red tint; `aloft`
 * flies the species that can; `ringed` gives bosses their gold outline (out of a rift's arena).
 */
const drawEnemy = (ctx: Ctx, e: Enemy, time: number, t: number, calm: boolean, aloft: boolean, clone: boolean, ringed: boolean) => {
  const def: EnemyDef = ENEMIES[e.kind]
  const s = sprites(def.dex, e.shiny, bossForm(e))
  const scale = drawScale(e)
  if (e.fled) {
    // Running off: it keeps walking away, rising a little, and fades out at the end.
    const k = e.dying / FLEE_TIME
    drawPokemon(ctx, s, airborne(s, aloft, 'Walk'), e.dir, e.animTime + e.dying * 2, e.x, e.y - Math.round(k * 18), { alpha: 1 - k * k, scale })
    return
  }
  if (e.dying >= 0) {
    const k = e.dying / 0.4
    drawPokemon(ctx, s, 'Hurt', e.dir, e.dying, e.x, e.y, { alpha: 1 - k, flash: calm ? 0 : 0.6 + k * 0.4, tint: calm ? HURT_TINT : undefined, loop: false, scale })
    return
  }
  // Leapers are drawn lifted mid-jump, and a boss aloft or reborn as its phase says (`bossLook`); their shadow stays on the ground.
  const look = e.fight ? bossLook(e, t) : null
  const y = e.y - traitLift(e) - (look?.lift ?? 0)
  const size = Math.max(s.bodyW, s.bodyH) * scale
  const rage = e.fight?.enraged === true
  const anim = enemyAnim(e, s, aloft)
  if (e.runner && (anim === 'Walk' || anim === 'Fly') && e.status.stun <= 0) drawSpeedLines(ctx, e, y - Math.round((s.bodyH * scale) / 2), s.bodyW * scale, t)
  if (rage) RAGE_TINT.amount = 0.15 + 0.15 * pulse(t, 3)
  const hit = e.flash > 0.08
  const tint = traitTint(e) ?? statusTint(e.status, t, e.id) ?? (calm && hit ? HURT_TINT : rage ? RAGE_TINT : clone ? CLONE_TINT : undefined)
  if (look?.alpha === 0) return
  const outline = outlineOf(e, t, calm) ?? (clone ? CLONE_OUTLINE : ringed && e.boss ? bossOutline(e, t, calm) : undefined)
  drawPokemon(ctx, s, anim, e.dir, e.animTime, e.x, y, { flash: Math.max(look?.flash ?? 0, hit && !calm ? 0.85 : 0), tint: look?.tint ?? tint, scale, outline, outlineAlpha: outline === ELITE_OUTLINE ? eliteThrob(e, t) : 1, alpha: look?.alpha ?? shadeAlpha(e.kind, e.id, t) })
  if (e.shiny) drawSparkles(ctx, e.x, y - s.bodyH / 2, Math.max(s.bodyW, s.bodyH), time - e.bornAt, e.id)
  if (rage) drawRageEmbers(ctx, e.x, y - (s.bodyH * scale) / 2, size, t, e.id)
}

/** Reused red overlay of an enraged boss (no allocation per frame). */
const RAGE_TINT = { color: '#f83020', amount: 0 }

/** 0..1 triangle wave at `hz`. */
const pulse = (t: number, hz: number) => Math.abs(((t * hz) % 2) - 1)

/** An elite's outline: one crimson, throbbing in opacity (`eliteThrob`), so a crowd of them shares its silhouettes. */
const ELITE_OUTLINE = '#e02838'

/** An elite outline's opacity: a slow throb, each elite on its own beat. */
const eliteThrob = (e: Enemy, t: number) => (Math.floor(t * 2.5 + e.id * 0.37) % 2 === 0 ? 1 : 0.55)

/**
 * Enraged bosses flicker red and orange fast (steady red when `calm`); elites
 * keep a slow crimson throb so a crowd of them reads at a glance on a phone.
 */
const outlineOf = (e: Enemy, t: number, calm: boolean) => {
  if (e.alpha) return alphaOutline(e, t, calm)
  if (e.fight?.enraged) return calm || Math.floor(t * 8) % 2 === 0 ? '#f83020' : '#f8a020'
  if (e.elite) return ELITE_OUTLINE
  return undefined
}

/**
 * The gold a boss wears on the map so it stands out of the horde (an Alpha's
 * is crimson, an enraged boss's flickers red), pulsing slowly; steady when `calm`.
 */
const bossOutline = (e: Enemy, t: number, calm: boolean) => (calm || Math.floor(t * 1.5 + e.id * 0.37) % 2 === 0 ? '#f8c818' : '#f8f088')

/** Unit steps per `Dir8` (0 Down, 1 DownRight, 2 Right, 3 UpRight, 4 Up, 5 UpLeft, 6 Left, 7 DownLeft). */
const DIR_STEP: readonly (readonly [number, number])[] = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]]

/** Side of one speed-lines cell (`SPEED_LINES`), its middle where the streaks start. */
const STREAK_CELL = 17
const STREAK_MID = 8

/**
 * Every look of a runner's three streaks on one sheet: a row per direction, a
 * column per flicker step (their lengths cycle through 4), so a crowd of
 * runners draws one image each instead of a pixel at a time.
 */
const SPEED_LINES = lazy(() => {
  const canvas = createCanvas(STREAK_CELL * 4, STREAK_CELL * 8)
  const ctx = context2d(canvas)
  ctx.fillStyle = '#ffffff'
  DIR_STEP.forEach(([dx, dy], dir) => {
    for (let step = 0; step < 4; step++) {
      for (let i = -1; i <= 1; i++) {
        const len = 3 + ((step + i * 3) & 3) - (i === 0 ? 0 : 1)
        const ox = step * STREAK_CELL + STREAK_MID - dy * i * 3
        const oy = dir * STREAK_CELL + STREAK_MID + dx * i * 3
        for (let k = 0; k < len; k++) ctx.fillRect(ox - dx * k, oy - dy * k, 1, 1)
      }
    }
  })
  return canvas
})

/** A runner's three flickering white streaks trailing behind its body (`cy` is mid-body, `w` the body width). */
const drawSpeedLines = (ctx: Ctx, e: Enemy, cy: number, w: number, t: number) => {
  const [dx, dy] = DIR_STEP[e.dir]!
  const back = Math.round(w / 2) + 1
  const step = (Math.floor(t * 14) + e.id) & 3
  const x = Math.round(e.x) - dx * back - STREAK_MID
  const y = Math.round(cy) - dy * back - STREAK_MID
  ctx.globalAlpha = 0.8
  ctx.drawImage(SPEED_LINES(), step * STREAK_CELL, e.dir * STREAK_CELL, STREAK_CELL, STREAK_CELL, x, y, STREAK_CELL, STREAK_CELL)
  ctx.globalAlpha = 1
}

/** Embers rising off an enraged boss (`cy` mid-body, `size` its body size). */
const drawRageEmbers = (ctx: Ctx, x: number, cy: number, size: number, t: number, seed: number) => {
  for (let i = 0; i < 8; i++) {
    const phase = (t * 0.9 + hash2(seed, i, 3)) % 1
    ctx.globalAlpha = 1 - phase
    ctx.fillStyle = i % 2 === 0 ? '#f83020' : '#f8c030'
    ctx.fillRect(Math.round(x + (hash2(seed, i, 4) - 0.5) * size), Math.round(cy + size * 0.4 - phase * size), 2, 2)
  }
  ctx.globalAlpha = 1
}

const hpColor = (ratio: number) => (ratio > 0.5 ? '#48d048' : ratio > 0.2 ? '#f8c830' : '#f04030')

/** Chain dash afterimages: fading type-colored copies of `g`'s player along their own lunge (co-op: each teammate's from their copy). */
const drawAfterimages = (ctx: Ctx, g: Game, calm: boolean) => {
  const p = localPlayer(g)
  let s: ReturnType<typeof sprites> | null = null
  for (const a of g.attacks) {
    if (a.visual !== 'afterimage' || a.age < 0 || a.owner !== p.slot) continue
    s ??= playerSprites(g, megaLook(g, calm).form)
    const k = a.age / a.ttl
    drawPokemon(ctx, s, airborne(s, inSky(g), 'Walk'), p.dir, p.animTime, a.x, a.y, { alpha: 0.7 * (1 - k), tint: { color: TYPE_COLORS[a.type], amount: 1 } })
  }
}

/** `calm` (Flashes: reduced): a hit tints the player dim red, and nothing on it flickers white. */
const drawPlayer = (ctx: Ctx, g: Game, calm: boolean) => {
  const p = localPlayer(g)
  // A Mega wears its Mega form (flickering white while it transforms); a legend its own (`playerSprites`); Aegislash its Blade Forme in Blade stance.
  const mega = megaLook(g, calm)
  const s = playerSprites(g, mega.form)
  // Fainted in a rift arena (the rift pulls the player up and out) or in a place (a rescue fades them away).
  const fall = riftFallLook(g) ?? placeFallLook(g)
  if (fall) {
    drawPokemon(ctx, s, 'Hurt', p.dir, fall.seconds, p.x, p.y - fall.lift, { alpha: fall.alpha, flash: calm ? 0 : fall.flash, tint: fall.tint, loop: false, outline: mega.outline })
    if (fall.bar) drawHpBar(ctx, g)
    return
  }
  // Fly (the shop TM) lifts the player off the ground: a species with a Fly sheet flaps its wings.
  const flying = shopTm2PlayerLook(g)
  const anim: AnimName = p.hurt > 0 ? 'Hurt' : airborne(s, inSky(g) || flying !== null, p.moving ? 'Walk' : 'Idle')
  const charging = p.special.charge > 0 && Math.floor(p.animTime * 16) % 2 === 0
  const blink = p.iframes > 0 && p.special.active <= 0 && Math.floor(p.iframes * 20) % 2 === 0
  // Aegislash flashes white for a moment as it swaps stance.
  const swapped = localPlayer(g).special.stance !== null && localPlayer(g).special.total - localPlayer(g).special.cooldown < 0.12
  const flash = Math.max(mega.flash, calm ? 0 : p.hurt > 0.2 ? 0.7 : charging || swapped ? 0.6 : 0)
  // Asleep (Dark Void): the player wears its violet.
  const tint = calm && p.hurt > 0.2 ? HURT_TINT : isAsleep(p) ? SLEEP_TINT : undefined
  // Burrowed or out of sight (Dig): a faint ghost of the player.
  // Moves can lift the sprite (Body Slam's leap, Heavy Slam's hop, Fly) or hide it under the mound (Dig).
  const egg = flying ?? eggPlayerLook(g) ?? egg3PlayerLook(g)
  // Invulnerable after a hit: blinking, or a steady see-through when calm.
  const faded = calm ? p.iframes > 0 && localPlayer(g).special.active <= 0 : blink
  // Versus: in tall grass, the viewer's team draws see-through (`grassAlpha`).
  const alpha = (egg ? egg.alpha : p.hidden ? 0.3 : faded && mega.flash === 0 ? (calm ? 0.65 : 0.45) : 1) * grassAlpha(g, viewer, p)
  const feet = p.y - (egg?.lift ?? 0)
  // Arena: an emote plays its own sheet, facing the camera (`render/arenaFx.ts`).
  const emote = p.versus ? arenaEmote(g, p) : null
  // The seat's look (its worn cosmetics) on the sprite, behind it and over it, in every mode. The anchors only
  // cover the species' own Walk, Idle and Hurt (`render/wearFit.ts` checks the sheet), so the moments that
  // swap or reshape the Pokémon draw it bare: an emote's sheet, a Mega (its form, or the base sprite standing in
  // for a Mega without sheets) and its transformation, and a move's own look (Fly, Dig, a lunge).
  const bare = emote !== null || egg !== null || mega.form !== undefined || p.mega.intro > 0
  const look = bare ? null : shownLook(g, p.slot)
  if (alpha > 0) {
    if (look) drawWearables(ctx, s, look, anim, p.dir, p.animTime, p.x, feet, 'behind', { alpha })
    drawPokemon(ctx, s, anim, emote ? 0 : p.dir, emote ? emote.seconds : p.animTime, p.x, feet, { alpha, flash, tint, outline: mega.outline, ...(emote && { sheet: emote.sheet, loop: emote.loop }) })
    if (look) drawWearables(ctx, s, look, anim, p.dir, p.animTime, p.x, feet, 'front', { alpha })
  }
  if (p.versus && g.versus) drawGrassFront(ctx, mapOf(g.versus).grass, p.x, p.y, s.bodyW, g.now, p.moving, p.slot)
  // The shiny entrance plays shortly after the run starts.
  if (p.shiny) drawSparkles(ctx, p.x, p.y - s.bodyH / 2, Math.max(s.bodyW, s.bodyH), g.now - 0.3, 0)
  drawMegaAir(ctx, g, p.y - s.bodyH, p.animTime)
  drawHpBar(ctx, g)
}

/** GBA-style HP bar under the player's feet. */
const drawHpBar = (ctx: Ctx, g: Game) => {
  const p = localPlayer(g)
  const w = 22
  const x = Math.round(p.x - w / 2)
  const y = Math.round(p.y + 4)
  // A name plate frames the bar in its colors (`render/arenaPlates.ts`).
  const plate = plateOf(g, p.slot)
  if (plate) drawPlateBar(ctx, plate, x, y, w, g.now)
  else {
    ctx.fillStyle = '#181818'
    ctx.fillRect(x - 1, y - 1, w + 2, 4)
    ctx.fillStyle = '#504848'
    ctx.fillRect(x, y, w, 2)
  }
  const ratio = Math.max(0, p.hp / p.stats.maxHp)
  // Versus: everyone's bar in their team's color.
  ctx.fillStyle = p.versus ? TEAM_COLORS[p.versus.team] : hpColor(ratio)
  ctx.fillRect(x, y, Math.ceil(w * ratio), 2)
}

/** The pickups on the ground in view (`visible`): a long run leaves hundreds of candies and coins behind. */
const drawPickups = (ctx: Ctx, g: Game, t: number, visible: (x: number, y: number) => boolean) => {
  const candies = PICKUPS.candy()
  const coins = PICKUPS.coins()
  for (const k of g.pickups) {
    if (!visible(k.x, k.y)) continue
    const bob = k.attracted ? 0 : Math.round(Math.sin(t * 4 + k.id) * 1.2)
    // Drawing lean, loot goes without its shadow, like the horde: thousands of candies lie about in a long endless run.
    if (!k.attracted && !detail.lean) blitEllipse(ctx, 3, 1, 'rgba(16,40,16,0.25)', k.x, k.y + 4)
    if (k.kind === 'consumable') {
      drawConsumable(ctx, k.item, k.x, k.y + bob, k.id, t)
      continue
    }
    if (k.kind === 'megaStone') {
      drawMegaStone(ctx, k.mega, k.x, k.y + bob, t)
      continue
    }
    if (k.kind === 'tm') {
      drawTmDisc(ctx, k, k.x, k.y + bob, t)
      continue
    }
    if (k.kind === 'treat') {
      drawTreat(ctx, k.id, k.x, k.y + bob)
      continue
    }
    if (k.kind === 'evoItem') {
      drawEvoItem(ctx, k, k.x, k.y + bob, t)
      continue
    }
    const sprite =
      k.kind === 'xp' ? candies[xpTier(k.value)]!
      : k.kind === 'coin' ? coins[coinTier(k.value)]!
      : k.kind === 'berry' ? PICKUPS.berry()
      : k.kind === 'alphaPrize' ? ALPHA_PRIZE()
      : PICKUPS.pokeball()
    blitCentered(ctx, sprite, k.x, k.y + bob)
  }
}

/* ---------------- Evolution scene ---------------- */

/** The evolution scene. `calm` (Flashes: reduced) slows the silhouettes' swap and drops the white screen flashes. */
const drawEvolution = (ctx: Ctx, g: Game, t: number, calm: boolean) => {
  const evo = localPlayer(g).evolution
  if (!evo) return
  const { w, h } = g.view
  const k = evo.t
  ctx.fillStyle = `rgba(8,8,24,${Math.min(0.85, k * 1.5)})`
  ctx.fillRect(0, 0, w, h)

  const cx = Math.round(w / 2)
  const cy = Math.round(h / 2 + 24)
  // A legend's awakening plays the same scene on itself, landing in its form; the big ones at 1×.
  const look = evo.awakening ? awakeningLook(g, evo.from, evo.form) : null
  const from = look?.before ?? sprites(evo.from, localPlayer(g).shiny)
  const to = look?.after ?? sprites(evo.to, localPlayer(g).shiny)
  const scale = look?.scale ?? 2
  const flashStart = 0.7
  const flashEnd = 3.7
  if (k < flashStart) {
    drawPokemon(ctx, from, 'Idle', 0, t, cx, cy, { scale })
  } else if (k < flashEnd) {
    // Alternating silhouettes that speed up, like the handheld games.
    const progress = (k - flashStart) / (flashEnd - flashStart)
    const period = Math.max(calm ? CALM_PERIOD : 0, 0.5 - progress * 0.44)
    const showNew = Math.floor((k - flashStart) / period) % 2 === 1
    drawPokemon(ctx, showNew ? to : from, 'Idle', 0, t, cx, cy, { scale, flash: 1 })
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + k * 2
      const r = 70 - progress * 40
      ctx.fillStyle = i % 2 ? '#ffffff' : '#a8d8f8'
      ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy - 30 + Math.sin(a) * r * 0.6), 2, 2)
    }
  } else {
    drawPokemon(ctx, to, 'Idle', 0, t, cx, cy, { scale })
    const white = 1 - (k - flashEnd) / 0.5
    if (white > 0 && !calm) {
      ctx.fillStyle = `rgba(255,255,255,${white})`
      ctx.fillRect(0, 0, w, h)
    }
  }
  if (k > EVOLUTION_TIME - 0.2 && !calm) {
    ctx.fillStyle = `rgba(255,255,255,${(k - EVOLUTION_TIME + 0.2) * 2})`
    ctx.fillRect(0, 0, w, h)
  }
}

/* ---------------- Frame ---------------- */

/** A co-op teammate, drawn from a copy of the game as that player (`coop/view.ts`). */
type Mate = { mate: Game }

type Drawable = Enemy | 'player' | 'companion' | Solid | Mate | ValeProp | FollowerDrawable
const drawables: Drawable[] = []
/** `drawables` in depth order, with each one's depth worked out once: the sort compares them thousands of times a frame. */
const inDepth: Drawable[] = []
const depthKeys: number[] = []
const depthOrder: number[] = []
/** Compares by depth returning -1, 0 or 1: a fractional difference would be boxed on every call. */
const byDepth = (a: number, b: number) => {
  const da = depthKeys[a]!
  const db = depthKeys[b]!
  return da < db ? -1 : da > db ? 1 : 0
}

/** How far a hitbox reaches from its center, to cull it off screen. */
const reachOf = (shape: Attack['shape']) => (shape.kind === 'circle' ? shape.r : Math.max(shape.w, shape.h)) + 48
const isSolid = (d: Drawable): d is Solid => d !== 'player' && d !== 'companion' && 'foot' in d
/** Versus: a post, pillar or gate standing on the Vale (`render/valeProps.ts`). */
const isValeProp = (d: Drawable): d is ValeProp => typeof d === 'object' && 'prop' in d

/* ---------------- Biome ---------------- */

/** Seconds the ground takes to dissolve into the next biome. */
const BIOME_FADE = 2.4
/** How far ahead (game seconds) the next biome's ground starts building in the background. */
const BIOME_WARMUP = 10

/**
 * Builds at most one piece of scenery not built yet, most needed first: the
 * ground about to scroll in, this biome's terrain sprites, the next biome's
 * ground and terrain, the fog veil (in the `fog` setting's mode) where fog can roll in; and while `calm` (no
 * run, or a menu over it), every biome's terrain. True if it built one. The
 * shell calls it in idle time: a mountain or the veil takes longer than a frame
 * lasts, so building one the first time it shows would stall that frame.
 */
export const warmScenery = (g: Game | null, calm: boolean, fog: FogMode) => {
  const keep = terrainBiomes(g)
  keepTerrain(keep)
  if (!g?.rift.arena || g.rift.arena.domain) dropArenas()
  if (!g?.place.inside) dropPlaceFloor()
  if (!g?.versus) dropVale()
  else if (warmVale(g.versus.map)) return true
  if (g && warmDomain(g)) return true
  if (g && !roomOf(g)) {
    const { w, h } = g.view
    const { x, y } = g.camera
    const here = g.biome.id
    const upcoming = biomeAt(g.time + BIOME_WARMUP)
    if (warmGround(here, x, y, w, h, GROUND_LOOKAHEAD) || warmTerrain(here)) return true
    if (upcoming !== here && (warmGround(upcoming, x, y, w, h) || warmTerrain(upcoming))) return true
    if ('fog' in BIOMES[here].weather || 'fog' in BIOMES[upcoming].weather) {
      if (warmFog(w, h, fog)) return true
    } else if (g.weather.id !== 'fog' && g.weather.prev !== 'fog') dropFog()
  }
  return calm && keep.some((b) => warmTerrain(b))
}

/**
 * The biomes whose terrain stays sculpted: the one here, the one dissolving out and the next
 * in order (a run only moves forward); before a run, the first. The rest is dropped (`keepTerrain`).
 */
const terrainBiomes = (g: Game | null): BiomeId[] => {
  if (!g) return [BIOME_ORDER[0]]
  const here = g.biome.id
  const next = BIOME_ORDER[BIOME_ORDER.indexOf(here) + 1]
  const fading = biomeFade(g)?.from
  return [here, ...(next ? [next] : []), ...(fading && fading !== here ? [fading] : [])]
}

/** The ground dissolve in progress, if any. */
const biomeFade = (g: Game) => {
  const { prev, since } = g.biome
  const k = (g.time - since) / BIOME_FADE
  return prev && k < 1 ? { from: prev, k } : null
}

const TEXT_PASSES = [false, true] as const

/**
 * Player preferences from the settings screen, the supporter's companion walking along (`render/companion.ts`)
 * and, in co-op, the teammates: each a draw-only copy of the game as that player (`coop/view.ts`), and this
 * screen's own shake offset (`coop/shake.ts`; without one the draw rolls an offset from `g.shake` itself).
 */
export type RenderOptions = {
  damageNumbers: DamageNumbers
  screenShake: boolean
  flashes: Flashes
  fog: FogMode
  /** How opaque the moves draw, 0..1: this screen's player's, and in co-op the teammates' (`render/attackLayers.ts`). */
  attackOpacity: number
  teamAttackOpacity: number
  companion?: CompanionView | null
  mates?: readonly Game[]
  shakeOffset?: { x: number; y: number }
  /** The Arena's lock-on and a touch button's aim (`render/arenaAim.ts`), this screen's. */
  arena?: ArenaOverlay | null
}

/** The Arena's viewer (this screen's player, `render` sets it; null outside Versus): who the grass hides from and shows see-through. */
let viewer: Player | null = null

/** Reused lists of this screen's player's attacks and the teammates', refilled each co-op frame. */
const ownAttacks: Attack[] = []
const teamAttacks: Attack[] = []

/**
 * The moves on screen in the order they draw, each side with its opacity and a
 * game holding only its attacks for the move modules' passes. Solo, one side:
 * the game itself.
 */
const attackSides = (g: Game, slot: number, opts: RenderOptions): { side: AttackSide; alpha: number; game: Game }[] => {
  if (g.coop === null) return [{ side: 'own', alpha: opts.attackOpacity, game: g }]
  ownAttacks.length = teamAttacks.length = 0
  const me = g.players[slot]
  for (const a of g.attacks) {
    if (a.owner === slot) ownAttacks.push(a)
    // Versus: a rival hidden in the grass shows nothing of its own, its moves still out either.
    else if (!me || !g.players[a.owner] || !concealed(me, g.players[a.owner]!)) teamAttacks.push(a)
  }
  return [
    { side: 'own', alpha: opts.attackOpacity, game: { ...g, attacks: ownAttacks } },
    { side: 'team', alpha: opts.teamAttackOpacity, game: { ...g, attacks: teamAttacks } },
  ]
}

const isMate = (d: Drawable): d is Mate => typeof d === 'object' && 'mate' in d
/** The teammates' drawables, kept from frame to frame. */
const mateSlots: Mate[] = []

/**
 * On the floor around a player, from their own state (Sucker Punch's zone,
 * Focus Punch's and a special's charge, Roost's nest, Overheat, a Mega's
 * aura): `g` is that player's copy of the game, this screen's or a
 * teammate's. `own`: this screen's player (a Mega's transformation veils it).
 */
const drawPlayerGround = (ctx: Ctx, g: Game, camX: number, camY: number, t: number, own: boolean) => {
  drawVerbPlayerGround(ctx, g, t)
  drawHeatAura(ctx, g, t)
  drawSpecialAura(ctx, g, t)
  drawMegaGround(ctx, g, camX, camY, t, own)
}

/** Over a player, from their own state (a guard, buffs, charges, stacks, a called sky): `g` is that player's copy of the game. */
const drawPlayerAir = (ctx: Ctx, g: Game, t: number) => {
  drawGuard(ctx, g, t)
  drawEggPlayer(ctx, g, t)
  drawEgg3Player(ctx, g, t)
  drawSignaturePlayer(ctx, g, t)
  drawTmPlayer(ctx, g, t)
  drawShopTm2Player(ctx, g, t, g.player.y - playerSprites(g).bodyH)
  drawVerbPlayerAir(ctx, g, t)
  drawAncientAura(ctx, g, t)
  drawIronDefense(ctx, g, t)
}

/** The teammates drawn over the moves this frame (`liftsOver`), kept from frame to frame. */
const lifted: Game[] = []

/**
 * Whether a player standing plain at `at` in `inDepth` draws after the moves
 * instead of in the depth pass, so a screen full of them never buries their
 * sprite and HP bar (the horde's sprites included: the player shows over them
 * too). Not while a solid in front reaches over them (a tall one already goes
 * see-through around this screen's player), behind the graveyard's fence or
 * in a fall's look.
 */
const liftsOver = (g: Game, at: number, look: BiomeId) => {
  if (g.place.inside?.id === 'graveyard' || riftFallLook(g) || placeFallLook(g)) return false
  const p = localPlayer(g)
  const s = playerSprites(g)
  for (let i = at + 1; i < inDepth.length; i++) {
    const d = inDepth[i]!
    if (isSolid(d) && solidCovers(g, d, look, p.x, p.y, s.bodyW, s.bodyH)) return false
    if (isValeProp(d) && valePropCovers(g, d, p.x, p.y, s.bodyW, s.bodyH)) return false
  }
  return true
}

/** Particles a lean frame draws at most (`render/quality.ts`). */
const LEAN_PARTICLES = 120

export const render = (ctx: Ctx, g: Game, t: number, opts: RenderOptions) => {
  const { w, h } = g.view
  const lean = detail.lean
  const calm = opts.flashes === 'reduced'
  const shake = opts.screenShake ? g.shake : 0
  const given = opts.screenShake ? opts.shakeOffset : undefined
  const shakeX = given ? given.x : shake > 0 ? Math.round((Math.random() - 0.5) * shake * 2) : 0
  const shakeY = given ? given.y : shake > 0 ? Math.round((Math.random() - 0.5) * shake * 2) : 0
  const camX = Math.round(g.camera.x) + shakeX
  const camY = Math.round(g.camera.y) + shakeY

  // The looks' effects step on the drawing clock (and let go of a game once another starts). The player's own
  // companion walking along (a supporter's, `render/companion.ts`) keeps their follower home: one buddy at a time.
  stepArenaFx(g, t, opts.companion ? localPlayer(g).slot : -1)
  const fade = biomeFade(g)
  const inside = g.place.inside
  const indoors = roomOf(g) !== null
  if (g.rift.arena?.domain) drawDomainFloor(ctx, g.rift.arena, g.rift.arena.domain, camX, camY, w, h, t)
  else if (g.rift.arena) drawArena(ctx, g.rift.arena, camX, camY, w, h, t)
  else if (inside) drawPlaceFloor(ctx, inside, camX, camY, w, h, t)
  else if (g.versus) drawValeFloor(ctx, g.versus.map, camX, camY, w, h)
  else drawGround(ctx, camX, camY, w, h, g.biome.id, fade)
  const upcoming = biomeAt(g.time + BIOME_WARMUP)
  // Scenery warms in idle time (`warmScenery`); in case that never comes, one of the next biome's chunks per frame.
  if (upcoming !== g.biome.id && !g.versus) warmGround(upcoming, camX, camY, w, h)
  if (g.rift.arena && !g.rift.arena.domain) warmArena(g.rift.arena)
  // Scenery changes outfit halfway through the dissolve, like the breakables.
  const look = fade && fade.k < 0.5 ? fade.from : g.biome.id
  ctx.save()
  ctx.translate(-camX, -camY)

  const visible = (x: number, y: number, m = 48) => x > camX - m && x < camX + w + m && y > camY - m && y < camY + h + m * 2
  const mates = opts.mates ?? []
  viewer = g.versus ? localPlayer(g) : null
  // Versus: a rival hidden in the grass draws nowhere.
  const hiddenMate = (mate: Game) => viewer !== null && concealed(viewer, localPlayer(mate))
  // Teammates standing in view wear their own auras, as this screen's player does.
  const shown = (mate: Game) => {
    const p = localPlayer(mate)
    return showsPlain(p) && visible(p.x, p.y) && !hiddenMate(mate)
  }

  drawTerrainGround(ctx, g, look, camX, camY)
  // Versus: the spawn pads and the goal zones, under everything.
  if (g.versus) {
    drawValeZones(ctx, g, t)
    drawGrassPatches(ctx, g, t, visible)
  }
  const me = localPlayer(g)
  watchImpacts(g)
  // The moves go through see-through layers at the player's chosen opacity, your own first (`paintAttacks`).
  const sides = attackSides(g, me.slot, opts)
  for (const side of sides) {
    paintAttacks(ctx, side.side, side.alpha, g.view, camX, camY, (into) => {
      const v = side.game
      // Ground marks far off screen (trails left behind, lingering fields) are skipped; the margin covers the widest of them.
      for (const a of v.attacks) if (a.age >= 0 && visible(a.x, a.y, Math.max(200, reachOf(a.shape)))) drawGroundAttack(into, a, t)
      drawVerbGround(into, v, t)
      drawTmGround(into, v, t)
      drawShopTm2Ground(into, v, t)
      drawVerbEvolvedGround(into, v, t)
      drawDuoGround(into, v, t)
      drawLegendaryGround(into, v, t)
      drawLegendary2Ground(into, v, t)
    })
  }
  for (const hz of g.hazards) if (hz.kind === 'beam') drawBeamGround(ctx, hz)
    else if (hz.pull !== 0) drawVortexGround(ctx, hz, t)
    else if (visible(hz.x, hz.y)) drawHazardGround(ctx, hz)
  drawBossGround(ctx, g, t)
  drawOmenGround(ctx, g)
  drawDomainGround(ctx, g)
  drawNightmareGround(ctx, g, t)
  // Breakables change outfit halfway through the dissolve.
  drawProps(ctx, g, t, look)
  // Map events wait outside with the rest of the world while the player is in a room.
  if (!indoors) drawMapEvents(ctx, g, t, calm)
  if (g.rift.portal && !indoors) (riftDomain(g, g.rift.portal.legend) ? drawTear : drawRiftPortal)(ctx, g.rift.portal, t)
  drawEntranceGround(ctx, g, t)
  drawPlaceGround(ctx, g, t)
  drawPlayerGround(ctx, g, camX, camY, t, true)
  for (const mate of mates) if (shown(mate)) drawPlayerGround(ctx, mate, camX, camY, t, false)
  drawRiftFallGround(ctx, g, camX, camY)
  drawTraitGround(ctx, g, visible)
  drawAlphaGround(ctx, g, t, visible)
  drawPickups(ctx, g, t, visible)
  if (g.versus) drawValeGround(ctx, g, t, visible)
  drawArenaFxGround(ctx, g, t, visible)
  if (g.coop) drawTeamGround(ctx, g, t)

  drawables.length = 0
  // A wave legendary's scene draws it itself (its arrival, its capture).
  const hiddenBoss = sceneHides(g)
  // Versus: a Pokémon's avatar (its body for the rivals' moves) never draws; its player does.
  for (const e of g.enemies) if (visible(e.x, e.y) && e.id !== hiddenBoss && e.behavior.kind !== 'avatar') drawables.push(e)
  drawables.push('player')
  for (let i = 0; i < mates.length; i++) {
    const mate = mates[i]!
    const p = localPlayer(mate)
    if (p.gone || !visible(p.x, p.y) || hiddenMate(mate)) continue
    const slot = (mateSlots[i] ??= { mate })
    slot.mate = mate
    drawables.push(slot)
  }
  const companion = opts.companion
  if (companion) drawables.push('companion')
  // The looks' followers (`render/arenaFx.ts`).
  arenaFollowers(g, drawables)
  solidsInView(g, camX, camY, w, h, drawables)
  if (g.versus) valePropsInView(g.versus.map, visible, drawables)
  // Mid-jump leapers sort last so they fly over the horde, and so does a flyer over a rock or a mountain.
  const depth = (d: Drawable) =>
    d === 'player' ? localPlayer(g).y : isMate(d) ? localPlayer(d.mate).y : d === 'companion' ? (companion?.y ?? 0) : isFollower(d) ? d.follower.view.y : isSolid(d) || isValeProp(d) ? d.y : isAirborne(d) || (overTerrain(d) && inSolid(g, d.x, d.y, 4)) ? d.y + 4096 : d.y
  // Filled by index and cut to size (emptying them would drop their storage every frame).
  const n = drawables.length
  for (let i = 0; i < n; i++) {
    depthKeys[i] = depth(drawables[i]!)
    depthOrder[i] = i
  }
  depthKeys.length = depthOrder.length = inDepth.length = n
  // A stable sort of the indices: ties keep their order, as sorting `drawables` itself would.
  depthOrder.sort(byDepth)
  for (let i = 0; i < n; i++) inDepth[i] = drawables[depthOrder[i]!]!

  // Nothing casts a shadow up in the sky; under a tunnel's ridge the player isn't seen at all.
  const aloft = inSky(g)
  const hidden = playerUnderground(g)
  // The players drawn over the moves (`liftsOver`): this screen's one last, on top of all.
  let liftMe = false
  lifted.length = 0
  for (let i = 0; i < n; i++) {
    const d = inDepth[i]!
    if (d === 'player') liftMe = !hidden && (!g.coop || showsStanding(me)) && liftsOver(g, i, look)
    else if (isMate(d) && showsPlain(localPlayer(d.mate)) && liftsOver(d.mate, i, look)) lifted.push(d.mate)
  }
  for (const d of inDepth) {
    if (aloft) break
    // A fainted co-op player's Poké Ball casts its own.
    if (d === 'player') {
      if (hidden) continue
      if (!g.coop || showsStanding(me)) {
        const body = playerSprites(g).bodyW
        shadow(ctx, localPlayer(g).x, localPlayer(g).y, body)
        drawWading(ctx, g, body, t)
        drawLegendAura(ctx, g, t, calm)
      }
    }
    else if (d === 'companion') companion && shadow(ctx, companion.x, companion.y, bodyOf(companion.dex).bodyW)
    else if (isFollower(d)) shadow(ctx, d.follower.view.x, d.follower.view.y, bodyOf(d.follower.view.dex).bodyW)
    // Drawing lean, the regular horde goes without: a shadow each is a draw call each.
    else if (isMate(d)) {
      const m = localPlayer(d.mate)
      if (m.hp > 0 && !m.gone && !playerUnderground(d.mate)) {
        const body = playerSprites(d.mate).bodyW
        shadow(ctx, m.x, m.y, body)
        drawWading(ctx, d.mate, body, t)
      }
    } else if (!isSolid(d) && !isValeProp(d) && d.dying < 0 && (!lean || d.boss || d.alpha)) shadow(ctx, d.x, d.y, d.radius * 3)
  }
  drawAfterimages(ctx, g, calm)
  for (const mate of mates) if (!hiddenMate(mate)) drawAfterimages(ctx, mate, calm)
  for (const d of inDepth) {
    // Co-op: a player fainted, away or wrapped up in a moment of their own draws its own way (`render/team.ts`); this one only when fainted (their screen says the rest).
    if (d === 'player') !hidden && !liftMe && (g.coop && !showsStanding(me) ? drawTeammate(ctx, g, me, t, calm) : drawPlayer(ctx, g, calm))
    else if (d === 'companion') companion && drawCompanion(ctx, companion, t)
    else if (isFollower(d)) drawFollower(ctx, g, d, t)
    else if (isMate(d)) !lifted.includes(d.mate) && (showsPlain(localPlayer(d.mate)) ? drawPlayer(ctx, d.mate, calm) : drawTeammate(ctx, d.mate, localPlayer(d.mate), t, calm))
    else if (isSolid(d)) drawSolid(ctx, g, d, look)
    else if (isValeProp(d)) drawValeProp(ctx, g, d, t, playerSprites(g).bodyW, playerSprites(g).bodyH)
    else drawEnemy(ctx, d, g.now, t, calm, aloft, isClone(g, d), !g.rift.arena)
  }
  // Badges only on bosses: on a 300-enemy horde they'd bury the sprites (tint + particles carry it there).
  for (const d of inDepth) {
    if (d !== 'player' && d !== 'companion' && !isMate(d) && !isSolid(d) && !isValeProp(d) && !isFollower(d) && d.boss && d.dying < 0) {
      const def: EnemyDef = ENEMIES[d.kind]
      drawStatusBadge(ctx, d.status, d.x, d.y - bodyOf(def.dex).bodyH * drawScale(d) - (d.alpha ? 14 : 5))
    }
  }
  drawEntranceAir(ctx, g, t)
  drawLandmarkAir(ctx, g, t, visible)
  drawWings(ctx, g, t)
  drawPlaceOver(ctx, g, camX, camY)
  drawSleep(ctx, g, t)
  drawKitStatus(ctx, g, t, visible)
  if (!liftMe) drawPlayerAir(ctx, g, t)
  for (const mate of mates) if (shown(mate) && !lifted.includes(mate)) drawPlayerAir(ctx, mate, t)
  drawTraitAir(ctx, g, visible)
  drawAlphaAir(ctx, g, t, visible)
  drawRiftFallAir(ctx, g, t)
  drawEntrance(ctx, g, t)
  drawPairDown(ctx, g, t)
  drawCapture(ctx, g, t)
  drawDomainAir(ctx, g, t)
  drawNightmareAir(ctx, g, t)
  drawLegendScene(ctx, g, t)

  for (const side of sides) {
    paintAttacks(ctx, side.side, side.alpha, g.view, camX, camY, (into) => {
      const v = side.game
      for (const a of v.attacks) if (a.age >= 0 && visible(a.x, a.y, 200)) drawAttack(into, a, t)
      drawImpacts(into, g.now, (owner) => g.coop === null || (side.side === 'own') === (owner === me.slot))
      drawVerbAir(into, v, t, visible)
      drawTmAir(into, v, t, visible)
      drawShopTmAir(into, v, t, visible)
      drawShopTm2Air(into, v, t, visible)
      drawVerbEvolvedAir(into, v, t, visible)
      drawDuoAir(into, v, t, visible)
      drawLegendaryAir(into, v, t, visible)
      drawLegendary2Air(into, v, t, visible)
      drawDrainVines(into, v, t)
    })
  }
  // Over the moves (at any opacity), under the foes' attacks: the players lifted out of the depth pass, with what they wear above.
  for (const mate of lifted) {
    drawPlayer(ctx, mate, calm)
    drawPlayerAir(ctx, mate, t)
  }
  if (liftMe) {
    drawPlayer(ctx, g, calm)
    drawPlayerAir(ctx, g, t)
  }
  // Teammates' name tags and bubbles, over everyone (in Versus, the goals' points left under them).
  drawArenaFxAir(ctx, g, t, visible)
  if (g.versus) {
    drawValeAir(ctx, g)
    drawValePings(ctx, g, t)
  }
  if (g.versus && opts.arena) drawArenaAim(ctx, g, me, opts.arena, t)
  if (g.coop) drawTeamAir(ctx, g, me, t)
  // Roar of Time's clocks over the foes it stopped: a mark on them, not a move, so it stays opaque.
  drawStoppedFoes(ctx, g, t, visible)
  for (const hz of g.hazards) if (hz.kind === 'beam') drawBeamAir(ctx, hz, t, g)
    else if (hz.pull !== 0) drawVortexAir(ctx, hz, t)
    else if (hz.phantom === 0 && visible(hz.x, hz.y, 200)) drawHazard(ctx, hz)
  drawPhantoms(ctx, g, t)

  // Drawing lean, a big burst shows every 2nd (3rd...) particle, about `LEAN_PARTICLES` in all.
  const every = lean ? Math.max(1, Math.ceil(g.particles.length / LEAN_PARTICLES)) : 1
  for (let i = 0; i < g.particles.length; i += every) {
    const p = g.particles[i]!
    if (!visible(p.x, p.y, 8)) continue
    ctx.globalAlpha = Math.min(1, (1 - p.life / p.ttl) * 1.5)
    ctx.fillStyle = p.color
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size)
  }
  ctx.globalAlpha = 1
  ctx.restore()

  // A haunted run's night falls over the world (rift arenas and places keep their own light).
  if (g.halloween && !g.rift.arena && !g.place.inside) drawHauntedNight(ctx, g, camX, camY, t)
  // The cave's dark and the graveyard's night, then the weather, over the world but under damage numbers.
  drawPlaceDark(ctx, g, camX, camY, t)
  drawNightmareDark(ctx, g, camX, camY, t)
  drawTunnelDark(ctx, g, camX, camY)
  drawWeather(ctx, g, camX, camY, t, opts.fog)
  drawLegendSky(ctx, g, camX, camY, t)
  drawBlasts(ctx, g, camX, camY, t)
  drawDomainScreen(ctx, g, camX, camY, t)
  ctx.save()
  ctx.translate(-camX, -camY)
  // Two passes: super-effective and critical numbers (`12!`) land on top of the rest. Drawing lean, all of them shows reduced.
  const mode = lean && opts.damageNumbers === 'all' ? 'reduced' : opts.damageNumbers
  const budget = damageBudget(g.texts, g.bossId)
  for (const bang of TEXT_PASSES) {
    for (const text of g.texts) {
      if (text.text.endsWith('!') !== bang || !showsText(text, mode, g.bossId, budget)) continue
      ctx.globalAlpha = textAlpha(text, mode)
      blitPacked(ctx, textSprite(text.text, text.color), text.x, text.y)
    }
  }
  ctx.globalAlpha = 1
  ctx.restore()

  if (!inside) drawRiftArrow(ctx, g, camX, camY, t)
  drawPlaceArrow(ctx, g, camX, camY, t)
  if (!indoors) drawMapEventMarkers(ctx, g, t)
  drawAlphaMarkers(ctx, g, t, markerInsets())
  drawBossMarker(ctx, g, camX, camY, t)
  if (g.coop) drawTeamMarkers(ctx, g, me, camX, camY, t)
  if (g.versus) drawVersusGuide(ctx, g, me, camX, camY, t)
  drawRiftFallOut(ctx, g)
  drawPlaceFallOut(ctx, g)
  // Explosions, rift jumps, a Mega's burst: white over the whole screen, unless flashes are reduced.
  if (!calm) drawFlash(ctx, g)
  // A dungeon floor's title card holds the screen black (the shell writes the floor over it).
  if (inside && inside.intro > 0) {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, w, h)
  }
  // Co-op: a player's own evolution plays while the team plays on (the world's phase stays `playing`).
  if (g.phase === 'evolving' || localPlayer(g).phase === 'evolving') drawEvolution(ctx, g, t, calm)
}
