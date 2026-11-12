import type { MEGA_FAMILIES_B } from '../data/megaFamiliesB'
import { MEGA_KIT_B_UPGRADES } from '../game/megaKitBUpgrades'
import type { ModId } from '../game/mods'
import type { UpgradeStep } from '../game/moves'

/**
 * The Mega families' words (`data/megaFamiliesB.ts`), a table per language
 * (`pt` is the reference). Each language's file spreads its `blurbs`, `moves`,
 * `megas` and `specials` in; the partner select's locked card reads `where`
 * (`ui/research.ts`). A move's level-up lines are built from its steps'
 * numbers (`game/megaKitBUpgrades.ts`), so the five languages stay in step
 * with the data.
 */

type MoveId = keyof typeof MEGA_KIT_B_UPGRADES
type FamilyId = keyof typeof MEGA_FAMILIES_B

const MOD_IDS = ['arc', 'bounce', 'burstOnKill', 'cruel', 'drain', 'echo', 'execute', 'hunter', 'seek', 'split', 'vortex'] as const
type Mod = (typeof MOD_IDS)[number]

/** A language's wording of the plain steps and the mods the forks add. */
type Vocab = {
  damage: (n: number) => string
  area: (n: number) => string
  cooldown: (n: number) => string
  pierce: (n: number) => string
  amount: (n: number) => string
  speed: (n: number) => string
  mods: Record<Mod, readonly [name: string, desc: string]>
  /** Joins two lines of one step. */
  and: (a: string, b: string) => string
}

type Stats = Partial<Record<'damage' | 'area' | 'cooldown' | 'pierce' | 'amount' | 'speed', number>>

const isMod = (m: ModId): m is Mod => (MOD_IDS as readonly string[]).includes(m)

/** One plain step's line: each stat it moves, in the language's words. */
const statLine = (v: Vocab, s: Stats) =>
  [
    s.damage !== undefined && v.damage(s.damage),
    s.amount !== undefined && v.amount(s.amount),
    s.pierce !== undefined && v.pierce(s.pierce),
    s.speed !== undefined && v.speed(s.speed),
    s.area !== undefined && v.area(Math.round(s.area * 100)),
    s.cooldown !== undefined && v.cooldown(-s.cooldown),
  ].filter((x): x is string => typeof x === 'string').reduce((a, b) => v.and(a, b))

const branch = (v: Vocab, b: { stats: Stats; mods?: readonly ModId[] }) => {
  const mod = b.mods?.find(isMod)
  if (!mod) throw new Error('every branch of the batch has a worded mod')
  const [name, desc] = v.mods[mod]
  return { name, desc: v.and(desc, statLine(v, b.stats)) }
}

type Fork = { fork: readonly [{ name: string; desc: string }, { name: string; desc: string }] }
type Lines = readonly [string, string, Fork, string, string, Fork, string]

const line = (v: Vocab, step: UpgradeStep): string | Fork => ('fork' in step ? { fork: [branch(v, step.fork[0]), branch(v, step.fork[1])] } : statLine(v, step))

/** The seven lines of a signature, forks at the third and sixth. */
const linesOf = (v: Vocab, id: MoveId): Lines => {
  const steps: readonly UpgradeStep[] = MEGA_KIT_B_UPGRADES[id]
  const [a, b, c, d, e, f, h] = steps.map((s) => line(v, s))
  const fork = (x: string | Fork | undefined) => {
    if (typeof x === 'string' || x === undefined) throw new Error(`${id}: a fork is missing`)
    return x
  }
  const plain = (x: string | Fork | undefined) => {
    if (typeof x !== 'string') throw new Error(`${id}: a plain step is missing`)
    return x
  }
  return [plain(a), plain(b), fork(c), plain(d), plain(e), fork(f), plain(h)]
}

const IDS = Object.keys(MEGA_KIT_B_UPGRADES) as MoveId[]

type Words = {
  blurbs: Record<FamilyId, string>
  moves: Record<MoveId, string>
  megas: Record<'medicham' | 'camerupt' | 'lopunny' | 'floette' | 'dragalge', string>
  /** The partner select's locked card: where in the Safari each one lives. */
  where: Record<FamilyId, string>
  specials: { eruption: string }
}

const wordsOf = (v: Vocab, w: Words) => ({
  ...w,
  moves: Object.fromEntries(IDS.map((id) => [id, { description: w.moves[id], upgrades: linesOf(v, id) }])) as Record<MoveId, { description: string; upgrades: Lines }>,
})

const pt = wordsOf(
  {
    damage: (n) => `+${n} de dano`,
    area: (n) => `+${n}% de área`,
    cooldown: (n) => `recarga -${String(n).replace('.', ',')}s`,
    pierce: (n) => `+${n} de perfuração`,
    amount: (n) => `+${n} ${n === 1 ? 'projétil' : 'projéteis'}`,
    speed: (n) => `+${n} de velocidade do projétil`,
    and: (a, b) => `${a}; ${b}`,
    mods: {
      arc: ['Faísca', 'Os golpes saltam para inimigos próximos'],
      bounce: ['Ricochete', 'Quica para outros inimigos'],
      burstOnKill: ['Estouro', 'Inimigos derrotados explodem'],
      cruel: ['Cruel', '×1,35 em alvos com status'],
      drain: ['Dreno', 'Cura parte do dano causado'],
      echo: ['Eco', 'Repete o golpe com metade do dano'],
      execute: ['Golpe final', 'Derruba quem fica com pouca vida'],
      hunter: ['Caçador', '×1,5 em elites e chefes'],
      seek: ['Teleguiado', 'Persegue o inimigo mais próximo'],
      split: ['Divisão', 'Ao acertar, se parte em dois'],
      vortex: ['Vórtice', 'Puxa os inimigos para o centro'],
    },
  },
  {
    blurbs: {
      meditite: 'Pure Power: cada High Jump Kick que acerta soma força. Errar o salto é queda: perde a força e um pouco de HP.',
      numel: 'Eruption: as corcovas explodem de tempos em tempos e chovem bombas de lava. Quanto mais HP, mais bombas.',
      buneary: 'Quando um inimigo vai encostar, pula para longe sem levar o golpe e cai pisando. O próximo Dizzy Punch é o contra-ataque.',
      flabebe: 'Planta flores por onde passa: curam quem está nelas e atiram pétalas. Com a Shiny Stone, pode virar Florges.',
      skrelp: 'Veneno de longe: o Venom Drench cresce no ar e fere e espirra mais quanto mais longe voa.',
    },
    moves: {
      highJumpKick: 'Salta até o inimigo mais próximo e cai num chute. Se não acertar ninguém, é queda.',
      magnitude: 'O chão treme em volta, com força de 4 a 10, sorteada a cada vez.',
      dizzyPunch: 'Dois socos de orelha à frente que podem confundir. Depois de um pulo, o contra-ataque: mais forte e sempre confunde.',
      fairyWind: 'Um leque de vento cintilante à frente que atravessa alguns inimigos.',
      venomDrench: 'Cospe uma bola de veneno que cresce no ar e espirra onde acerta, envenenando em volta.',
    },
    megas: {
      medicham: 'golpes +35% e velocidade +4. Pure Power acumula até 8 vezes, e a queda não custa nada. O especial vira Focus Blast.',
      camerupt: 'golpes +25%, defesa +2 e golpes de Fogo e Terra +20%. A corcova explode mais cedo, com mais bombas. O especial vira Eruption.',
      lopunny: 'golpes +25%, velocidade +8, golpes Normais +20% e Lutadores +30%. Pula mais vezes, e o contra-ataque vira três socos. O especial vira Double-Edge.',
      floette: 'golpes +20%, regenera mais e golpes de Fada +35%. As flores atiram rápido como a luz. O especial vira Moonblast.',
      dragalge: 'golpes +20%, status +20% e golpes de Veneno e Dragão +30%. O veneno cresce mais e o respingo solta gotas. O especial vira Draco Meteor.',
    },
    where: {
      meditite: 'Só na *Zona Safári*, no *Brejo Sombrio*, no Bosque das Bases do Poké Realm. Precisa de conta.',
      numel: 'Só na *Zona Safári*, na *Serra Trovejante*, no Bosque das Bases do Poké Realm. Precisa de conta.',
      buneary: 'Só na *Zona Safári*, na *Campina Dourada*, no Bosque das Bases do Poké Realm. Precisa de conta.',
      flabebe: 'Só na *Zona Safári*, na *Campina Dourada*, no Bosque das Bases do Poké Realm. Precisa de conta.',
      skrelp: 'Só na *Zona Safári*, no *Brejo Sombrio*, no Bosque das Bases do Poké Realm. Precisa de conta.',
    },
    specials: { eruption: 'O vulcão das costas explode: chuva de lava ao seu redor que queima.' },
  },
)

const en = wordsOf(
  {
    damage: (n) => `+${n} damage`,
    area: (n) => `+${n}% area`,
    cooldown: (n) => `-${n}s cooldown`,
    pierce: (n) => `+${n} pierce`,
    amount: (n) => `+${n} projectile${n === 1 ? '' : 's'}`,
    speed: (n) => `+${n} projectile speed`,
    and: (a, b) => `${a}; ${b}`,
    mods: {
      arc: ['Spark', 'Hits arc to nearby foes'],
      bounce: ['Ricochet', 'Bounces to other foes'],
      burstOnKill: ['Burst', 'Foes it fells explode'],
      cruel: ['Cruel', '×1.35 on foes with a status'],
      drain: ['Drain', 'Heals part of the damage dealt'],
      echo: ['Echo', 'Repeats at half damage'],
      execute: ['Finisher', 'Fells foes left with little HP'],
      hunter: ['Hunter', '×1.5 on elites and bosses'],
      seek: ['Homing', 'Chases the nearest foe'],
      split: ['Split', 'Splits in two on a hit'],
      vortex: ['Vortex', 'Pulls foes to the middle'],
    },
  },
  {
    blurbs: {
      meditite: 'Pure Power: every High Jump Kick that lands builds power. Miss the leap and it crashes: the power goes, and a little HP.',
      numel: 'Eruption: its humps blow now and then, raining lava bombs. The more HP it has, the more bombs.',
      buneary: 'When a foe is about to touch it, it bounces away unhurt and lands in a stomp. Its next Dizzy Punch is the counter.',
      flabebe: 'Plants flowers as it goes: they heal whoever stands in them and fire petals. With a Shiny Stone, it can become Florges.',
      skrelp: 'Long-range venom: Venom Drench grows in flight, hurting and splashing more the farther it flies.',
    },
    moves: {
      highJumpKick: 'Leaps onto the nearest foe and lands in a kick. If it lands on nothing, it crashes.',
      magnitude: 'The ground shakes around you, at a magnitude from 4 to 10 rolled every time.',
      dizzyPunch: 'Two ear punches ahead that may confuse. After a hop, the counter: harder, and sure to confuse.',
      fairyWind: 'A fan of glittering wind ahead that cuts through a few foes.',
      venomDrench: 'Spits a glob of venom that grows in flight and splashes where it hits, poisoning all around.',
    },
    megas: {
      medicham: 'moves +35% and speed +4. Pure Power stacks up to 8 times, and a crash costs nothing. The special becomes Focus Blast.',
      camerupt: 'moves +25%, defense +2 and Fire and Ground moves +20%. The hump blows sooner, with more bombs. The special becomes Eruption.',
      lopunny: 'moves +25%, speed +8, Normal moves +20% and Fighting moves +30%. It hops more often, and the counter is three punches. The special becomes Double-Edge.',
      floette: 'moves +20%, more regen and Fairy moves +35%. The blossoms fire as fast as light. The special becomes Moonblast.',
      dragalge: 'moves +20%, status +20% and Poison and Dragon moves +30%. The venom grows further and its splash throws droplets. The special becomes Draco Meteor.',
    },
    where: {
      meditite: 'Only in the *Safari Zone*, in the *Gloomy Marsh*, at the Poké Realm’s Secret Base Grove. Needs an account.',
      numel: 'Only in the *Safari Zone*, on the *Thunder Ridge*, at the Poké Realm’s Secret Base Grove. Needs an account.',
      buneary: 'Only in the *Safari Zone*, in the *Golden Meadow*, at the Poké Realm’s Secret Base Grove. Needs an account.',
      flabebe: 'Only in the *Safari Zone*, in the *Golden Meadow*, at the Poké Realm’s Secret Base Grove. Needs an account.',
      skrelp: 'Only in the *Safari Zone*, in the *Gloomy Marsh*, at the Poké Realm’s Secret Base Grove. Needs an account.',
    },
    specials: { eruption: 'The volcano on its back blows: a rain of lava around you that burns.' },
  },
)

const es = wordsOf(
  {
    damage: (n) => `+${n} de daño`,
    area: (n) => `+${n}% de área`,
    cooldown: (n) => `recarga -${String(n).replace('.', ',')}s`,
    pierce: (n) => `+${n} de perforación`,
    amount: (n) => `+${n} ${n === 1 ? 'proyectil' : 'proyectiles'}`,
    speed: (n) => `+${n} de velocidad del proyectil`,
    and: (a, b) => `${a}; ${b}`,
    mods: {
      arc: ['Chispa', 'Los golpes saltan a enemigos cercanos'],
      bounce: ['Rebote', 'Rebota hacia otros enemigos'],
      burstOnKill: ['Estallido', 'Los enemigos derrotados explotan'],
      cruel: ['Cruel', '×1,35 contra enemigos con estado'],
      drain: ['Drenaje', 'Cura parte del daño causado'],
      echo: ['Eco', 'Repite el golpe con la mitad del daño'],
      execute: ['Remate', 'Derriba a quien queda con poca vida'],
      hunter: ['Cazador', '×1,5 contra élites y jefes'],
      seek: ['Teledirigido', 'Persigue al enemigo más cercano'],
      split: ['División', 'Al acertar, se parte en dos'],
      vortex: ['Vórtice', 'Atrae a los enemigos al centro'],
    },
  },
  {
    blurbs: {
      meditite: 'Pure Power: cada High Jump Kick que acierta suma fuerza. Si falla el salto, se estrella: pierde la fuerza y un poco de PS.',
      numel: 'Eruption: sus jorobas estallan cada tanto y llueven bombas de lava. Cuanto más PS, más bombas.',
      buneary: 'Cuando un enemigo va a tocarlo, salta lejos sin recibir el golpe y cae pisando. Su siguiente Dizzy Punch es el contraataque.',
      flabebe: 'Planta flores a su paso: curan a quien está en ellas y disparan pétalos. Con la Shiny Stone, puede volverse Florges.',
      skrelp: 'Veneno a distancia: Venom Drench crece en el aire y hiere y salpica más cuanto más lejos vuela.',
    },
    moves: {
      highJumpKick: 'Salta hacia el enemigo más cercano y cae con una patada. Si no le da a nadie, se estrella.',
      magnitude: 'El suelo tiembla a tu alrededor, con una magnitud de 4 a 10 sorteada cada vez.',
      dizzyPunch: 'Dos puñetazos de oreja al frente que pueden confundir. Tras un salto, el contraataque: más fuerte y siempre confunde.',
      fairyWind: 'Un abanico de viento brillante al frente que atraviesa a algunos enemigos.',
      venomDrench: 'Escupe una bola de veneno que crece en el aire y salpica donde acierta, envenenando alrededor.',
    },
    megas: {
      medicham: 'golpes +35% y velocidad +4. Pure Power se acumula hasta 8 veces, y estrellarse no cuesta nada. El especial pasa a ser Focus Blast.',
      camerupt: 'golpes +25%, defensa +2 y golpes de Fuego y Tierra +20%. La joroba estalla antes, con más bombas. El especial pasa a ser Eruption.',
      lopunny: 'golpes +25%, velocidad +8, golpes Normales +20% y Lucha +30%. Salta más seguido, y el contraataque son tres puñetazos. El especial pasa a ser Double-Edge.',
      floette: 'golpes +20%, más regeneración y golpes de Hada +35%. Las flores disparan rápido como la luz. El especial pasa a ser Moonblast.',
      dragalge: 'golpes +20%, estados +20% y golpes de Veneno y Dragón +30%. El veneno crece más y su salpicadura suelta gotas. El especial pasa a ser Draco Meteor.',
    },
    where: {
      meditite: 'Solo en la *Zona Safari*, en el *Pantano Sombrío*, en el Bosque de Bases del Poké Realm. Necesita cuenta.',
      numel: 'Solo en la *Zona Safari*, en la *Sierra Tronadora*, en el Bosque de Bases del Poké Realm. Necesita cuenta.',
      buneary: 'Solo en la *Zona Safari*, en la *Pradera Dorada*, en el Bosque de Bases del Poké Realm. Necesita cuenta.',
      flabebe: 'Solo en la *Zona Safari*, en la *Pradera Dorada*, en el Bosque de Bases del Poké Realm. Necesita cuenta.',
      skrelp: 'Solo en la *Zona Safari*, en el *Pantano Sombrío*, en el Bosque de Bases del Poké Realm. Necesita cuenta.',
    },
    specials: { eruption: 'El volcán de su lomo estalla: lluvia de lava a tu alrededor que quema.' },
  },
)

const fr = wordsOf(
  {
    damage: (n) => `+${n} de dégâts`,
    area: (n) => `+${n} % de zone`,
    cooldown: (n) => `recharge -${String(n).replace('.', ',')} s`,
    pierce: (n) => `+${n} de perforation`,
    amount: (n) => `+${n} projectile${n === 1 ? '' : 's'}`,
    speed: (n) => `+${n} de vitesse du projectile`,
    and: (a, b) => `${a} ; ${b}`,
    mods: {
      arc: ['Étincelle', 'Les coups sautent vers les ennemis proches'],
      bounce: ['Ricochet', 'Rebondit vers d’autres ennemis'],
      burstOnKill: ['Explosion', 'Les ennemis vaincus explosent'],
      cruel: ['Cruel', '×1,35 sur les ennemis avec un statut'],
      drain: ['Drain', 'Soigne une part des dégâts infligés'],
      echo: ['Écho', 'Se répète avec la moitié des dégâts'],
      execute: ['Coup de grâce', 'Achève les ennemis presque K.O.'],
      hunter: ['Chasseur', '×1,5 sur les élites et les boss'],
      seek: ['Autoguidé', 'Poursuit l’ennemi le plus proche'],
      split: ['Division', 'Se divise en deux en touchant'],
      vortex: ['Vortex', 'Attire les ennemis au centre'],
    },
  },
  {
    blurbs: {
      meditite: 'Pure Power : chaque High Jump Kick réussi accumule de la force. S’il rate son saut, il s’écrase : il perd sa force et un peu de PV.',
      numel: 'Eruption : ses bosses explosent de temps en temps et font pleuvoir des bombes de lave. Plus il a de PV, plus il y a de bombes.',
      buneary: 'Quand un ennemi va le toucher, il bondit au loin sans être touché et retombe en piétinant. Son prochain Dizzy Punch est la riposte.',
      flabebe: 'Plante des fleurs sur son passage : elles soignent qui s’y tient et tirent des pétales. Avec une Shiny Stone, il peut devenir Florges.',
      skrelp: 'Venin à distance : Venom Drench grossit en vol, et blesse et éclabousse d’autant plus qu’il vole loin.',
    },
    moves: {
      highJumpKick: 'Bondit sur l’ennemi le plus proche et retombe en coup de pied. S’il ne touche personne, il s’écrase.',
      magnitude: 'Le sol tremble autour de toi, d’une magnitude de 4 à 10 tirée à chaque fois.',
      dizzyPunch: 'Deux coups d’oreille devant toi qui peuvent rendre confus. Après un bond, la riposte : plus forte, et toujours confusante.',
      fairyWind: 'Un éventail de vent scintillant devant toi qui traverse quelques ennemis.',
      venomDrench: 'Crache une boule de venin qui grossit en vol et éclabousse là où elle touche, empoisonnant tout autour.',
    },
    megas: {
      medicham: 'attaques +35 % et vitesse +4. Pure Power se cumule jusqu’à 8 fois, et s’écraser ne coûte rien. Le spécial devient Focus Blast.',
      camerupt: 'attaques +25 %, défense +2 et attaques Feu et Sol +20 %. La bosse explose plus tôt, avec plus de bombes. Le spécial devient Eruption.',
      lopunny: 'attaques +25 %, vitesse +8, attaques Normal +20 % et Combat +30 %. Il bondit plus souvent, et la riposte devient trois coups. Le spécial devient Double-Edge.',
      floette: 'attaques +20 %, plus de régénération et attaques Fée +35 %. Les fleurs tirent vite comme la lumière. Le spécial devient Moonblast.',
      dragalge: 'attaques +20 %, statuts +20 % et attaques Poison et Dragon +30 %. Le venin grossit davantage et ses éclaboussures lâchent des gouttes. Le spécial devient Draco Meteor.',
    },
    where: {
      meditite: 'Uniquement au *Parc Safari*, au *Marais Sombre*, au Bosquet des bases du Poké Realm. Compte requis.',
      numel: 'Uniquement au *Parc Safari*, sur la *Crête du Tonnerre*, au Bosquet des bases du Poké Realm. Compte requis.',
      buneary: 'Uniquement au *Parc Safari*, dans la *Prairie Dorée*, au Bosquet des bases du Poké Realm. Compte requis.',
      flabebe: 'Uniquement au *Parc Safari*, dans la *Prairie Dorée*, au Bosquet des bases du Poké Realm. Compte requis.',
      skrelp: 'Uniquement au *Parc Safari*, au *Marais Sombre*, au Bosquet des bases du Poké Realm. Compte requis.',
    },
    specials: { eruption: 'Le volcan sur son dos explose : une pluie de lave autour de toi qui brûle.' },
  },
)

const zh = wordsOf(
  {
    damage: (n) => `傷害+${n}`,
    area: (n) => `範圍+${n}%`,
    cooldown: (n) => `冷卻-${n}秒`,
    pierce: (n) => `穿透+${n}`,
    amount: (n) => `投射物+${n}`,
    speed: (n) => `投射物速度+${n}`,
    and: (a, b) => `${a}；${b}`,
    mods: {
      arc: ['電弧', '攻擊會跳到附近的敵人'],
      bounce: ['彈射', '彈向其他敵人'],
      burstOnKill: ['爆裂', '被擊倒的敵人會爆炸'],
      cruel: ['殘酷', '對異常狀態的敵人×1.35'],
      drain: ['吸取', '回復部分造成的傷害'],
      echo: ['回音', '以一半傷害再打一次'],
      execute: ['終結', '擊倒HP所剩不多的敵人'],
      hunter: ['獵人', '對菁英與頭目×1.5'],
      seek: ['追蹤', '追擊最近的敵人'],
      split: ['分裂', '命中後一分為二'],
      vortex: ['漩渦', '把敵人吸向中央'],
    },
  },
  {
    blurbs: {
      meditite: 'Pure Power：每次命中的High Jump Kick都會累積力量。跳空就會摔落：失去力量，還會少一點HP。',
      numel: 'Eruption：背上的駝峰不時爆發，降下熔岩彈。HP越多，熔岩彈越多。',
      buneary: '敵人快碰到時，它會毫髮無傷地跳開，落地時踩踏一下。下一次Dizzy Punch就是反擊。',
      flabebe: '沿路種花：花能治療站在其中的人並射出花瓣。有Shiny Stone時，可以進化成Florges。',
      skrelp: '遠程毒液：Venom Drench在空中會變大，飛得越遠，傷害和飛濺範圍越大。',
    },
    moves: {
      highJumpKick: '跳向最近的敵人並以飛踢落下。如果沒踢中任何人，就會摔落。',
      magnitude: '你周圍的地面震動，每次隨機產生4到10級的震度。',
      dizzyPunch: '向前揮出兩記耳朵拳，可能使敵人混亂。跳開之後的反擊更強，而且一定混亂。',
      fairyWind: '向前吹出一扇閃亮的風，能穿過數名敵人。',
      venomDrench: '吐出一團在空中會變大的毒液，命中處飛濺並使周圍中毒。',
    },
    megas: {
      medicham: '招式+35%，速度+4。Pure Power最多累積8層，摔落也沒有代價。特殊招式變為Focus Blast。',
      camerupt: '招式+25%，防禦+2，火與地面招式+20%。駝峰更早爆發，熔岩彈更多。特殊招式變為Eruption。',
      lopunny: '招式+25%，速度+8，一般招式+20%，格鬥招式+30%。跳得更頻繁，反擊變成三拳。特殊招式變為Double-Edge。',
      floette: '招式+20%，回復更多，妖精招式+35%。花朵射得像光一樣快。特殊招式變為Moonblast。',
      dragalge: '招式+20%，異常狀態+20%，毒與龍招式+30%。毒液變得更大，飛濺時還會灑出水滴。特殊招式變為Draco Meteor。',
    },
    where: {
      meditite: '只出現在*狩獵地帶*的*幽暗沼澤*，位於Poké Realm的秘密基地樹林。需要帳號。',
      numel: '只出現在*狩獵地帶*的*雷鳴山脊*，位於Poké Realm的秘密基地樹林。需要帳號。',
      buneary: '只出現在*狩獵地帶*的*金色草原*，位於Poké Realm的秘密基地樹林。需要帳號。',
      flabebe: '只出現在*狩獵地帶*的*金色草原*，位於Poké Realm的秘密基地樹林。需要帳號。',
      skrelp: '只出現在*狩獵地帶*的*幽暗沼澤*，位於Poké Realm的秘密基地樹林。需要帳號。',
    },
    specials: { eruption: '背上的火山爆發：在你周圍降下會灼傷的熔岩雨。' },
  },
)

export const MEGA_FAMILIES_B_WORDS = { pt, en, es, fr, zh } as const
