import type { Attack, Game } from './types'

type AttackInit = Pick<Attack, 'move' | 'type' | 'visual' | 'x' | 'y' | 'shape' | 'motion' | 'damage' | 'ttl'> & Partial<Attack>

/**
 * Creates a hitbox with sensible defaults. A negative `age` delays the attack:
 * it stays dormant (invisible, harmless) until its age crosses zero.
 */
export const spawnAttack = (g: Game, init: AttackInit) => {
  const attack: Attack = {
    id: g.nextId++,
    knockback: 0,
    pierce: Infinity,
    hitInterval: Infinity,
    hits: new Map(),
    age: 0,
    activeFrom: 0,
    activeUntil: Infinity,
    grow: 0,
    status: null,
    from: { x: init.x, y: init.y },
    flip: false,
    blast: 0,
    blastVisual: init.visual,
    turret: null,
    owner: g.player,
    ...init,
  }
  g.attacks.push(attack)
  return attack
}
