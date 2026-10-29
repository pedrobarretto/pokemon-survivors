import { dirTo } from '../engine/math'
import { chance, range } from '../engine/rng'
import { effectiveness, TYPE_COLORS } from '../data/types'
import { VERSUS_ROSTER, VERSUS, isVersusPick, type Role, type Team } from '../data/versus'
import { armored, drainHeal } from './combat'
import { burst, damageText } from './effects'
import { despawnEnemy, spawnEnemy } from './enemies'
import { actAs, inPlay } from './players'
import { applyStatus, hitTakenMult, statusPace } from './status'
import { playerTypes } from './terrain'
import { gainXp } from './leveling'
import { isAlly, mapOf, pvpDamage, respawnTime, rulesOf } from './versusRules'
import { reveal } from './versusGrass'
import { assistsOf } from './versusSocial'
import type { Attack, DamageSource, Enemy, Game, Player } from './types'
import type { Objective } from './versus'
import * as dm from '../engine/dmath'

/**
 * Versus's PvP. The simulation's moves hit `Enemy` bodies, so every Pokémon
 * in a match has one: an avatar (`EnemyBehavior` `avatar`) that stands where
 * it stands, never moves or bites, and turns whatever hits it into damage to
 * its player. A move skips its own team's avatars (`isAlly`, checked where
 * hitboxes collide and moves aim), and the damage functions route an avatar's
 * hit here (`strikeAvatar`, `pvpHit`). Statuses land on the avatar and play
 * there (a burn ticks through `pvpHit`; a slow, a paralysis or a freeze slows
 * the player through `VersusSeat.pace`).
 */

/** The species an avatar is filed under: one with no trait, never drawn (its player is). */
const AVATAR_KIND = 'nidoranM'

/** A Pokémon's role in Versus (a pick outside the roster plays All-Rounder). */
export const roleOf = (p: Player): Role => (isVersusPick(p.starter) ? VERSUS_ROSTER[p.starter] : 'allRounder')

/** The player an avatar stands for, if it's still in the match. */
export const avatarPlayer = (g: Game, e: Enemy): Player | null => (e.behavior.kind === 'avatar' ? (g.players[e.behavior.slot] ?? null) : null)

/**
 * `amount` of damage from the acting player's move `move` to `target`, a
 * rival: cut to PvP scale and armor, soaked by a Drednaw shield first. Stops
 * the target's channel (an interrupt on the hitter's scoreboard when one was
 * filling), shows it in the grass (`reveal`) and marks who hit it (`hurtAt`,
 * `lastBy`, `hitAt` for the assists). Returns the HP taken, dealt and taken on
 * the scoreboard. A knockout goes through `knockOut`.
 */
export const pvpHit = (g: Game, target: Player, amount: number, move: DamageSource | null) => {
  const by = g.player
  const tv = target.versus
  const bv = by.versus
  if (!tv || !bv || tv.team === bv.team || !inPlay(target) || tv.safe > 0) return 0
  let dmg = armored(pvpDamage(amount, roleOf(by), roleOf(target), target.stats.damageTaken), target.stats.armor)
  if (tv.shield > 0) {
    const soaked = Math.min(tv.shield, dmg)
    tv.shield -= soaked
    dmg -= soaked
  }
  tv.hurtAt = g.now
  tv.lastBy = by.slot
  tv.hitAt[by.slot] = g.now
  if (tv.channel > 0) bv.interrupts++
  tv.channel = 0
  // Taking a hit shows a Pokémon, in the grass or not.
  reveal(tv)
  target.hurt = 0.3
  if (dmg <= 0) return 0
  target.hp -= dmg
  target.record.taken += dmg
  tv.taken += dmg
  bv.dealt += dmg
  if (move) by.damageByMove[move] = (by.damageByMove[move] ?? 0) + dmg
  if (target.hp <= 0) knockOut(g, target, by.slot)
  return dmg
}

/**
 * A rival's hitbox landed on `e`, an avatar (`damageEnemy`): the hit as it
 * would land on a foe (type effectiveness against the Pokémon's types, a
 * freeze's or a mark's bonus), its status, a shove and its drain, all on the
 * player behind it. Both ends of the hit show for a moment, grass or not.
 */
export const strikeAvatar = (g: Game, e: Enemy, attack: Attack) => {
  const target = avatarPlayer(g, e)
  if (!target || isAlly(g, e)) return
  const eff = attack.sure ? Math.max(1, effectiveness(attack.type, e.types)) : effectiveness(attack.type, e.types)
  const base = attack.damage * hitTakenMult(e.status)
  const dmg = pvpHit(g, target, base * eff * range(g.rng, 0.9, 1.1), attack.move)
  // Landing a hit shows its owner too (a move cast before it stepped into the grass).
  const own = g.player.versus
  if (own) reveal(own)
  if (dmg <= 0) return
  e.flash = 0.16
  const status = attack.status
  if (status && chance(g.rng, status.chance)) applyStatus(e.status, status, base * VERSUS.pvp.damage, false, attack.move, g.player.slot)
  if (attack.knockback > 0) {
    const away = dirTo(attack.x, attack.y, target.x, target.y, g.player.facing)
    const px = Math.min(12, (attack.knockback / 100) * VERSUS.pvp.shove)
    e.kx += away.x * px
    e.ky += away.y * px
  }
  if (attack.drain > 0) drainHeal(g, dmg, attack.drain)
  damageText(g, e, dmg, eff > 1 ? '#ffd830' : eff < 1 ? '#a8a8b8' : '#ffffff', eff > 1)
  burst(g, e.x, e.y - e.radius, { colors: [TYPE_COLORS[attack.type], '#ffffff'], count: eff > 1 ? 6 : 3, speed: 70, ttl: 0.25 })
  g.events.push({ kind: 'hit', effective: eff })
}

/** A burn, a poison, a seed or a body blow on an avatar: damage to its player from the acting player (who set it going). */
export const tickAvatar = (g: Game, e: Enemy, amount: number, move: DamageSource | null, color: string) => {
  const target = avatarPlayer(g, e)
  if (!target || isAlly(g, e)) return
  const dmg = pvpHit(g, target, amount, move)
  if (dmg > 0) damageText(g, e, dmg, color)
}

/**
 * `p` is knocked out (by the player at `by`, -1 for the wild or the spawn
 * pad, which credit the last rival to hit them within `ASSIST`): out until their respawn, half their Energy scattered where they fell,
 * their body gone from the field, and EXP for the knocker's team. Every other
 * rival who hit them within `VERSUS.assist` seconds gets an assist.
 */
export const knockOut = (g: Game, p: Player, by: number) => {
  const v = p.versus
  const s = g.versus
  if (!v || !s) return
  p.hp = 0
  p.moving = false
  p.vx = 0
  p.vy = 0
  p.guard = null
  p.record.faints++
  v.deaths++
  v.channel = 0
  v.shield = 0
  v.respawn = respawnTime(rulesOf(s), p.level, s.stretch)
  dropOrbs(g, p.x, p.y, Math.floor(v.energy * VERSUS.energy.dropShare))
  v.energy = 0
  removeAvatar(g, p)
  // Finished off by the wild or a pad: the rival who hit it last, within `ASSIST` seconds, gets the knockout.
  const credit = by < 0 && v.lastBy >= 0 && g.now - v.hurtAt < ASSIST ? v.lastBy : by
  const killer = credit >= 0 ? g.players[credit] : undefined
  if (killer?.versus && killer.versus.team !== v.team) {
    killer.versus.kos++
    killer.record.kills++
    shareXp(g, killer.versus.team, VERSUS.pvp.koXp * p.level, p.x, p.y)
  }
  for (const slot of assistsOf(v.hitAt, g.now, VERSUS.assist, killer ? credit : -1)) {
    const q = g.players[slot]?.versus
    if (q && q.team !== v.team) q.assists++
  }
  v.hitAt.fill(-99)
  burst(g, p.x, p.y - 10, { colors: ['#f83838', '#ffffff', '#202028'], count: 24, speed: 90, ttl: 0.5 })
  g.events.push({ kind: 'versusKo', slot: p.slot, by: killer ? credit : -1 })
}

/** Seconds a rival's hit keeps the credit for a knockout the wild or a pad finishes. */
const ASSIST = 4

/** Scatters `energy` as orbs around (x, y): one orb per 5 Energy and one for the rest. */
export const dropOrbs = (g: Game, x: number, y: number, energy: number) => {
  const s = g.versus
  if (!s || energy <= 0) return
  for (let left = energy; left > 0; left -= 5) {
    const value = Math.min(5, left)
    const a = g.rng() * Math.PI * 2
    const speed = range(g.rng, 30, 70)
    s.orbs.push({ id: g.nextId++, x, y: y - 4, vx: dm.cos(a) * speed, vy: dm.sin(a) * speed, value, age: 0 })
  }
}

/**
 * EXP worth `xp` (times the format's `xp`) for `team` from a faint at (x, y):
 * in full to the teammates nearby, a share to the rest (`xpShareOf`),
 * knocked out ones included.
 */
export const shareXp = (g: Game, team: Team, xp: number, x: number, y: number) => {
  const scale = g.versus ? rulesOf(g.versus).xp : 1
  const before = g.player
  for (const q of g.players) {
    if (q.gone || q.versus?.team !== team) continue
    g.player = q
    const near = dm.sq(q.x - x) + dm.sq(q.y - y) <= dm.sq(VERSUS.xpShare.radius)
    gainXp(g, (near ? xp : xp * VERSUS.xpShare.remote) * scale)
  }
  g.player = before
}

/** Puts `p`'s body on the field (`AVATAR_KIND`, its own team marked), where they stand. */
export const addAvatar = (g: Game, p: Player) => {
  const v = p.versus
  if (!v) return
  const e = spawnEnemy(g, AVATAR_KIND, p.x, p.y, { kind: 'avatar', slot: p.slot, team: v.team })
  v.avatar = e.id
  syncAvatar(g, p, e)
}

/** Takes `p`'s body off the field. */
export const removeAvatar = (g: Game, p: Player) => {
  const v = p.versus
  if (!v || v.avatar < 0) return
  const e = g.enemies.find((k) => k.id === v.avatar)
  if (e) despawnEnemy(e)
  v.avatar = -1
}

/** The body standing for `p`, if it's on the field. */
export const avatarOf = (g: Game, p: Player): Enemy | null => {
  const id = p.versus?.avatar ?? -1
  if (id < 0) return null
  for (const e of g.enemies) if (e.id === id && e.dying < 0) return e
  return null
}

/**
 * Puts the body where its player stands, with their HP, size and types. A
 * shove it took (a rival's knockback) moves the player instead; a slow, a
 * paralysis or a freeze on it slows them (`VersusSeat.pace`).
 */
const syncAvatar = (g: Game, p: Player, e: Enemy) => {
  if (e.kx !== 0 || e.ky !== 0) {
    p.x += e.kx
    p.y += e.ky
    e.kx = 0
    e.ky = 0
  }
  e.x = p.x
  e.y = p.y
  e.radius = p.radius
  e.hp = Math.max(1, p.hp)
  e.maxHp = p.stats.maxHp
  const before = actAs(g, p)
  e.types = playerTypes(g)
  actAs(g, before)
  if (p.versus) p.versus.slow = statusPace(e.status)
}

/** Every Pokémon in play has its body on the field, where it stands; the ones out of play have none. */
export const syncAvatars = (g: Game) => {
  for (const p of g.players) {
    if (!p.versus) continue
    const e = avatarOf(g, p)
    if (p.hp <= 0 || p.gone) {
      if (e) removeAvatar(g, p)
      continue
    }
    if (e) syncAvatar(g, p, e)
    else addAvatar(g, p)
  }
}

/**
 * A wild Pokémon fell to the acting player in a match (`killEnemy`): its
 * camp's Energy scatters and its EXP goes to their team; the objective
 * rewards the whole team. Nothing else a faint does in a run happens here (no
 * candies, ₽, items, eggs or Poké Balls).
 */
export const wildDown = (g: Game, e: Enemy) => {
  const s = g.versus
  if (!s) return
  e.dying = 0
  e.hp = 0
  g.kills++
  const p = g.player
  p.record.kills++
  const team = p.versus?.team ?? 0
  burst(g, e.x, e.y - e.radius, { colors: ['#ffffff', '#f8f8c8', '#c8d8f8'], count: e.boss ? 60 : 8, speed: e.boss ? 160 : 70, ttl: 0.45 })
  g.events.push({ kind: 'kill', boss: e.boss })
  const b = e.behavior
  if (b.kind === 'camp' && b.camp >= 0) {
    const def = mapOf(s).camps[b.camp]!
    dropOrbs(g, e.x, e.y, def.energy)
    shareXp(g, team, def.xp, e.x, e.y)
  }
  if (s.objective?.id === e.id) objectiveDown(g, s.objective, team, e)
}

/** The objective fell to `team`: Drednaw shields the team and gives each Energy; Zapdos gives Energy and its blessing. */
const objectiveDown = (g: Game, o: Objective, team: Team, e: Enemy) => {
  const s = g.versus!
  s.objective = null
  if (g.bossId === e.id) g.bossId = null
  const zap = o.kind === 'zapdos'
  const energy = zap ? VERSUS.zapdos.energy : VERSUS.drednaw.energy
  for (const p of g.players) {
    const v = p.versus
    if (!v || v.team !== team || p.gone) continue
    v.energy = Math.min(VERSUS.energy.cap, v.energy + energy)
    if (!zap && p.hp > 0) v.shield = p.stats.maxHp * VERSUS.drednaw.shield
  }
  shareXp(g, team, zap ? 120 : 60, e.x, e.y)
  if (zap) s.blessing[team] = VERSUS.zapdos.blessing
  else s.drednawAt = g.time + rulesOf(s).drednaw.respawn
  g.events.push({ kind: 'versusObjective', enemy: o.kind, team })
}
