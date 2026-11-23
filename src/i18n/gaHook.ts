import type { GA_FAMILIES_HOOK } from '../data/gaFamiliesHook'
import { GA_HOOK_UPGRADES, type GaHookMoveId } from '../game/gaHookUpgrades'
import type { ModId } from '../game/mods'
import type { UpgradeStep } from '../game/moves'

/**
 * The wave's hook families' words, a table per language (`pt` is the
 * reference). Each language's file spreads `blurbs`, `moves` and `where`
 * into its tables and holds the rest as `gaHook`. A move's level-up lines are
 * built from its steps' numbers (`game/gaHookUpgrades.ts`), so all five
 * languages stay in step with the data.
 */

type Mod = 'arc' | 'bounce' | 'burstOnKill' | 'cruel' | 'drain' | 'echo' | 'execute' | 'hunter' | 'split' | 'trail'

const MODS: readonly Mod[] = ['arc', 'bounce', 'burstOnKill', 'cruel', 'drain', 'echo', 'execute', 'hunter', 'split', 'trail']

/** A language's wording of the plain steps and the mods the forks add. */
type Vocab = {
  damage: (n: number) => string
  area: (n: number) => string
  cooldown: (n: number) => string
  pierce: (n: number) => string
  amount: (n: number) => string
  mods: Record<Mod, readonly [name: string, desc: string]>
  /** Joins two lines of one step. */
  and: (a: string, b: string) => string
}

type Stats = Partial<Record<'damage' | 'area' | 'cooldown' | 'pierce' | 'amount', number>>

const isMod = (m: ModId): m is Mod => (MODS as readonly string[]).includes(m)

/** One plain step's line: each stat it moves, in the language's words. */
const statLine = (v: Vocab, s: Stats) =>
  [
    s.damage !== undefined && v.damage(s.damage),
    s.amount !== undefined && v.amount(s.amount),
    s.pierce !== undefined && v.pierce(s.pierce),
    s.area !== undefined && v.area(Math.round(s.area * 100)),
    s.cooldown !== undefined && v.cooldown(-s.cooldown),
  ].filter((x): x is string => typeof x === 'string').reduce((a, b) => v.and(a, b))

const branch = (v: Vocab, b: { stats: Stats; mods?: readonly ModId[] }) => {
  const mod = b.mods?.find(isMod)
  if (!mod) throw new Error('every branch of the batch has a worded mod')
  const [name, desc] = v.mods[mod]
  return { name, desc: v.and(desc, statLine(v, b.stats)) }
}

const line = (v: Vocab, step: UpgradeStep) => ('fork' in step ? ({ fork: [branch(v, step.fork[0]), branch(v, step.fork[1])] } as const) : statLine(v, step))

type Fork = { fork: readonly [{ name: string; desc: string }, { name: string; desc: string }] }
type Lines = readonly [string, string, Fork, string, string, Fork, string]

/** The seven lines of a move, forks at the third and sixth. */
const linesOf = (v: Vocab, id: GaHookMoveId): Lines => {
  const [a, b, c, d, e, f, h] = GA_HOOK_UPGRADES[id].map((s) => line(v, s))
  const fork = (x: typeof a) => {
    if (typeof x === 'string' || x === undefined) throw new Error(`${id}: a fork is missing`)
    return x
  }
  const plain = (x: typeof a) => {
    if (typeof x !== 'string') throw new Error(`${id}: a plain step is missing`)
    return x
  }
  return [plain(a), plain(b), fork(c), plain(d), plain(e), fork(f), plain(h)]
}

const IDS = Object.keys(GA_HOOK_UPGRADES) as GaHookMoveId[]

/** A language's moves: each one's description and its level-up lines. */
const movesOf = (v: Vocab, text: Record<GaHookMoveId, string>) =>
  Object.fromEntries(IDS.map((id) => [id, { description: text[id], upgrades: linesOf(v, id) }])) as Record<GaHookMoveId, { description: string; upgrades: Lines }>

type Family = keyof typeof GA_FAMILIES_HOOK

type Words = {
  blurbs: Record<Family, string>
  moves: Record<GaHookMoveId, string>
  /** The partner select's locked card: where the family is found. */
  where: Record<Family, string>
  /** Tyrogue's evolution moment, read out from its build (`fighterNow`): the box while it evolves, and the in-run meter's legend. */
  tyrogue: { evolving: (name: string, attack: number, defense: number, to: string) => string; meter: string }
  /** Vivillon's pattern, as the partner select names it (pattern names stay official English). */
  vivillon: { pattern: (name: string) => string; why: string }
  /** Co-op: the line when Plusle and Minun link up. */
  plusMinus: { linked: string }
  /** The Game Corner's prize counter (`CORNER_PRIZES`): Plusle and Minun, and their Shadows, by prize id, and a line each. */
  prizes: Record<'plusle' | 'minun' | 'shadowPlusle' | 'shadowMinun', string>
  prizeBlurbs: Record<'plusle' | 'minun', string>
}

const wordsOf = (v: Vocab, w: Words) => ({ ...w, moves: movesOf(v, w.moves) })

const pt = wordsOf(
  {
    damage: (n) => `+${n} de dano`,
    area: (n) => `+${n}% de área`,
    cooldown: (n) => `recarga -${String(n).replace('.', ',')}s`,
    pierce: (n) => `+${n} de perfuração`,
    amount: (n) => `+${n} ${n === 1 ? 'projétil' : 'projéteis'}`,
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
      split: ['Divisão', 'Ao acertar, se parte em dois'],
      trail: ['Rastro', 'Deixa um rastro que causa dano'],
    },
  },
  {
    blurbs: {
      scatterbug: 'Solta nuvens de pó pelo caminho que deixam a horda lenta. Spewpa endurece parado; Vivillon alterna três pós e tem as asas da sua região.',
      minior: 'Shields Down: abaixo da metade do HP a casca quebra, estilhaça em volta e sai o Núcleo, mais rápido e mais forte. Curado, fecha de novo.',
      tyrogue: 'Evolui pela sua build: mais Ataque que Defesa vira Hitmonlee, mais Defesa vira Hitmonchan, empate vira Hitmontop.',
      plusle: 'Plus: cada derrota carrega, e cheio solta um anel de faíscas e corre mais. No co-op com um Minun, os dois ficam ligados.',
      minun: 'Minus: de tempos em tempos um pulso enfraquece e deixa lentos os inimigos em volta e o cura. No co-op com um Plusle, os dois ficam ligados.',
    },
    moves: {
      bugBuzz: 'Ondas de zumbido que se abrem à frente e atravessam tudo, às vezes enfraquecendo.',
      powerGem: 'Gemas no inimigo mais próximo. Com a casca, pedras; no Núcleo, prismas mais rápidos que atravessam mais.',
      fakeOut: 'Um soco rápido no inimigo mais próximo que o faz recuar por um instante.',
      jumpKick: 'Um salto de longe sobre um inimigo, caindo com a joelhada numa onda de choque. Espera ter um alvo ao alcance.',
      tripleKick: 'Três chutes giratórios em volta, cada um mais forte e mais largo que o anterior.',
      voltSwitch: 'Um raio que vai até o inimigo e volta, acertando na ida e na volta.',
      eerieImpulse: 'Um anel de corrente estranha em volta que enfraquece todo inimigo que toca.',
    },
    prizes: { plusle: 'Plusle', minun: 'Minun', shadowPlusle: 'Plusle Sombrio', shadowMinun: 'Minun Sombrio' },
    prizeBlurbs: { plusle: 'Cada derrota carrega um anel de faíscas. No co-op, liga com um Minun.', minun: 'Um pulso que enfraquece e cura. No co-op, liga com um Plusle.' },
    where: {
      scatterbug: 'Só na *Zona Safári*, na Campina Dourada, no Bosque das Bases do Poké Realm. Precisa de conta.',
      minior: 'Só na *Zona Safári*, na Serra Trovejante, e só de noite. No Bosque das Bases do Poké Realm. Precisa de conta.',
      tyrogue: 'Só na *Zona Safári*, na Serra Trovejante, no Bosque das Bases do Poké Realm. Precisa de conta.',
      plusle: 'Prêmio do balcão do Game Corner da Equipe Rocket, no Poké Realm.',
      minun: 'Prêmio do balcão do Game Corner da Equipe Rocket, no Poké Realm.',
    },
    tyrogue: {
      evolving: (name, attack, defense, to) => `${name} está evoluindo! Ataque +${attack}, Defesa +${defense}: vai virar ${to}.`,
      meter: 'Ataque × Defesa',
    },
    vivillon: { pattern: (name) => `Padrão de Vivillon: ${name}`, why: 'As asas seguem a região do seu aparelho.' },
    plusMinus: { linked: '*Plus* e *Minus*: Plusle e Minun estão ligados!' },
  },
)

const en = wordsOf(
  {
    damage: (n) => `+${n} damage`,
    area: (n) => `+${n}% area`,
    cooldown: (n) => `-${n}s cooldown`,
    pierce: (n) => `+${n} pierce`,
    amount: (n) => `+${n} projectile${n === 1 ? '' : 's'}`,
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
      split: ['Split', 'Splits in two on a hit'],
      trail: ['Trail', 'Leaves a harmful trail'],
    },
  },
  {
    blurbs: {
      scatterbug: 'Sheds clouds of powder as it goes that slow the horde. Spewpa hardens standing still; Vivillon cycles three powders and wears your region’s wings.',
      minior: 'Shields Down: below half HP its shell breaks, shards fly, and the Core comes out, faster and stronger. Healed, it closes again.',
      tyrogue: 'Evolves by your build: more Attack than Defense makes Hitmonlee, more Defense makes Hitmonchan, even makes Hitmontop.',
      plusle: 'Plus: every KO charges it, and full it lets out a ring of sparks and runs faster. In co-op with a Minun, the two link up.',
      minun: 'Minus: now and then a pulse weakens and slows the foes around and heals it. In co-op with a Plusle, the two link up.',
    },
    moves: {
      bugBuzz: 'Buzzing waves that widen ahead and pass through everything, sometimes weakening.',
      powerGem: 'Gems at the nearest foe. In its shell, rocks; as the Core, faster prisms that cut through more.',
      fakeOut: 'A quick jab at the nearest foe that makes it flinch for a moment.',
      jumpKick: 'A leap onto a foe from afar, the knee landing in a shockwave. It waits for a foe in reach.',
      tripleKick: 'Three spinning kicks around it, each harder and wider than the last.',
      voltSwitch: 'A bolt that zips out to a foe and back, hitting both ways.',
      eerieImpulse: 'A ring of eerie current around it that weakens every foe it touches.',
    },
    prizes: { plusle: 'Plusle', minun: 'Minun', shadowPlusle: 'Shadow Plusle', shadowMinun: 'Shadow Minun' },
    prizeBlurbs: { plusle: 'Every KO charges a ring of sparks. In co-op, it links with a Minun.', minun: 'A pulse that weakens foes and heals. In co-op, it links with a Plusle.' },
    where: {
      scatterbug: 'Only in the *Safari Zone*, in the Golden Meadow, at the Poké Realm’s Secret Base Grove. Needs an account.',
      minior: 'Only in the *Safari Zone*, on Thunder Ridge, and only at night. At the Poké Realm’s Secret Base Grove. Needs an account.',
      tyrogue: 'Only in the *Safari Zone*, on Thunder Ridge, at the Poké Realm’s Secret Base Grove. Needs an account.',
      plusle: 'A prize at Team Rocket’s Game Corner counter, in the Poké Realm.',
      minun: 'A prize at Team Rocket’s Game Corner counter, in the Poké Realm.',
    },
    tyrogue: {
      evolving: (name, attack, defense, to) => `${name} is evolving! Attack +${attack}, Defense +${defense}: it will become ${to}.`,
      meter: 'Attack × Defense',
    },
    vivillon: { pattern: (name) => `Vivillon pattern: ${name}`, why: 'Its wings follow your device’s region.' },
    plusMinus: { linked: '*Plus* and *Minus*: Plusle and Minun are linked!' },
  },
)

const es = wordsOf(
  {
    damage: (n) => `+${n} de daño`,
    area: (n) => `+${n}% de área`,
    cooldown: (n) => `recarga -${String(n).replace('.', ',')}s`,
    pierce: (n) => `+${n} de perforación`,
    amount: (n) => `+${n} ${n === 1 ? 'proyectil' : 'proyectiles'}`,
    and: (a, b) => `${a}; ${b}`,
    mods: {
      arc: ['Chispa', 'Los golpes saltan a enemigos cercanos'],
      bounce: ['Rebote', 'Rebota hacia otros enemigos'],
      burstOnKill: ['Estallido', 'Los enemigos derrotados explotan'],
      cruel: ['Cruel', '×1,35 en enemigos con estado'],
      drain: ['Drenaje', 'Cura parte del daño causado'],
      echo: ['Eco', 'Repite el golpe con la mitad del daño'],
      execute: ['Remate', 'Derriba a quien queda con poca vida'],
      hunter: ['Cazador', '×1,5 en élites y jefes'],
      split: ['División', 'Al acertar, se parte en dos'],
      trail: ['Rastro', 'Deja un rastro que hace daño'],
    },
  },
  {
    blurbs: {
      scatterbug: 'Suelta nubes de polvo a su paso que frenan a la horda. Spewpa se endurece quieto; Vivillon alterna tres polvos y lleva las alas de tu región.',
      minior: 'Shields Down: bajo la mitad de los PS su caparazón se rompe, lanza esquirlas y sale el Núcleo, más rápido y más fuerte. Curado, se cierra otra vez.',
      tyrogue: 'Evoluciona según tu build: más Ataque que Defensa da Hitmonlee, más Defensa da Hitmonchan, empate da Hitmontop.',
      plusle: 'Plus: cada derrota lo carga y, lleno, suelta un anillo de chispas y corre más. En co-op con un Minun, los dos se enlazan.',
      minun: 'Minus: de vez en cuando un pulso debilita y frena a los enemigos cercanos y lo cura. En co-op con un Plusle, los dos se enlazan.',
    },
    moves: {
      bugBuzz: 'Ondas de zumbido que se abren al frente y lo atraviesan todo, a veces debilitando.',
      powerGem: 'Gemas al enemigo más cercano. Con el caparazón, rocas; como Núcleo, prismas más rápidos que atraviesan más.',
      fakeOut: 'Un golpe rápido al enemigo más cercano que lo hace retroceder un instante.',
      jumpKick: 'Un salto desde lejos sobre un enemigo, cayendo con la rodilla en una onda de choque. Espera a tener un objetivo al alcance.',
      tripleKick: 'Tres patadas giratorias alrededor, cada una más fuerte y más amplia que la anterior.',
      voltSwitch: 'Un rayo que va hasta un enemigo y vuelve, golpeando a la ida y a la vuelta.',
      eerieImpulse: 'Un anillo de corriente extraña alrededor que debilita a todo enemigo que toca.',
    },
    prizes: { plusle: 'Plusle', minun: 'Minun', shadowPlusle: 'Plusle Oscuro', shadowMinun: 'Minun Oscuro' },
    prizeBlurbs: { plusle: 'Cada derrota carga un anillo de chispas. En co-op, se enlaza con un Minun.', minun: 'Un pulso que debilita y cura. En co-op, se enlaza con un Plusle.' },
    where: {
      scatterbug: 'Solo en la *Zona Safari*, en la Pradera Dorada, en el Bosque de Bases del Poké Realm. Necesita cuenta.',
      minior: 'Solo en la *Zona Safari*, en la Sierra Tronadora, y solo de noche. En el Bosque de Bases del Poké Realm. Necesita cuenta.',
      tyrogue: 'Solo en la *Zona Safari*, en la Sierra Tronadora, en el Bosque de Bases del Poké Realm. Necesita cuenta.',
      plusle: 'Premio del mostrador del Game Corner del Team Rocket, en el Poké Realm.',
      minun: 'Premio del mostrador del Game Corner del Team Rocket, en el Poké Realm.',
    },
    tyrogue: {
      evolving: (name, attack, defense, to) => `¡${name} está evolucionando! Ataque +${attack}, Defensa +${defense}: será ${to}.`,
      meter: 'Ataque × Defensa',
    },
    vivillon: { pattern: (name) => `Diseño de Vivillon: ${name}`, why: 'Sus alas siguen la región de tu dispositivo.' },
    plusMinus: { linked: '*Plus* y *Minus*: ¡Plusle y Minun están enlazados!' },
  },
)

const fr = wordsOf(
  {
    damage: (n) => `+${n} dégâts`,
    area: (n) => `+${n} % de zone`,
    cooldown: (n) => `recharge -${String(n).replace('.', ',')} s`,
    pierce: (n) => `+${n} perforation`,
    amount: (n) => `+${n} projectile${n === 1 ? '' : 's'}`,
    and: (a, b) => `${a} ; ${b}`,
    mods: {
      arc: ['Étincelle', 'Les coups sautent vers les ennemis proches'],
      bounce: ['Ricochet', 'Rebondit vers d’autres ennemis'],
      burstOnKill: ['Éclat', 'Les ennemis vaincus explosent'],
      cruel: ['Cruel', '×1,35 sur les ennemis avec un statut'],
      drain: ['Drain', 'Soigne une partie des dégâts infligés'],
      echo: ['Écho', 'Se répète avec moitié moins de dégâts'],
      execute: ['Coup de grâce', 'Achève les ennemis presque à terre'],
      hunter: ['Chasseur', '×1,5 sur les élites et les boss'],
      split: ['Division', 'Se divise en deux à l’impact'],
      trail: ['Traînée', 'Laisse une traînée qui blesse'],
    },
  },
  {
    blurbs: {
      scatterbug: 'Sème des nuages de poudre sur son passage qui ralentissent la horde. Spewpa durcit à l’arrêt ; Vivillon alterne trois poudres et porte les ailes de votre région.',
      minior: 'Shields Down : sous la moitié de ses PV, sa coque éclate en éclats et le Noyau sort, plus rapide et plus fort. Soigné, elle se referme.',
      tyrogue: 'Évolue selon votre build : plus d’Attaque que de Défense donne Hitmonlee, plus de Défense donne Hitmonchan, à égalité Hitmontop.',
      plusle: 'Plus : chaque K.O. le charge et, plein, il lâche un anneau d’étincelles et court plus vite. En coop avec un Minun, les deux se lient.',
      minun: 'Minus : de temps en temps une impulsion affaiblit et ralentit les ennemis autour et le soigne. En coop avec un Plusle, les deux se lient.',
    },
    moves: {
      bugBuzz: 'Des ondes bourdonnantes qui s’élargissent devant et traversent tout, affaiblissant parfois.',
      powerGem: 'Des gemmes sur l’ennemi le plus proche. Avec la coque, des pierres ; en Noyau, des prismes plus rapides qui percent davantage.',
      fakeOut: 'Un coup rapide sur l’ennemi le plus proche qui le fait reculer un instant.',
      jumpKick: 'Un bond de loin sur un ennemi, le genou retombant en onde de choc. Il attend d’avoir une cible à portée.',
      tripleKick: 'Trois coups de pied tournoyants autour, chacun plus fort et plus large que le précédent.',
      voltSwitch: 'Un éclair qui file jusqu’à un ennemi et revient, frappant à l’aller et au retour.',
      eerieImpulse: 'Un anneau de courant étrange autour qui affaiblit chaque ennemi qu’il touche.',
    },
    prizes: { plusle: 'Plusle', minun: 'Minun', shadowPlusle: 'Plusle Obscur', shadowMinun: 'Minun Obscur' },
    prizeBlurbs: { plusle: 'Chaque K.O. charge un anneau d’étincelles. En coop, il se lie à un Minun.', minun: 'Une impulsion qui affaiblit et soigne. En coop, il se lie à un Plusle.' },
    where: {
      scatterbug: 'Seulement dans la *Zone Safari*, dans la Prairie Dorée, au Bosquet des Bases du Poké Realm. Compte requis.',
      minior: 'Seulement dans la *Zone Safari*, sur la Crête du Tonnerre, et seulement la nuit. Au Bosquet des Bases du Poké Realm. Compte requis.',
      tyrogue: 'Seulement dans la *Zone Safari*, sur la Crête du Tonnerre, au Bosquet des Bases du Poké Realm. Compte requis.',
      plusle: 'Un lot du comptoir du Game Corner de la Team Rocket, dans le Poké Realm.',
      minun: 'Un lot du comptoir du Game Corner de la Team Rocket, dans le Poké Realm.',
    },
    tyrogue: {
      evolving: (name, attack, defense, to) => `${name} évolue ! Attaque +${attack}, Défense +${defense} : il deviendra ${to}.`,
      meter: 'Attaque × Défense',
    },
    vivillon: { pattern: (name) => `Motif de Vivillon : ${name}`, why: 'Ses ailes suivent la région de votre appareil.' },
    plusMinus: { linked: '*Plus* et *Minus* : Plusle et Minun sont liés !' },
  },
)

const zh = wordsOf(
  {
    damage: (n) => `傷害+${n}`,
    area: (n) => `範圍+${n}%`,
    cooldown: (n) => `冷卻-${n}秒`,
    pierce: (n) => `貫穿+${n}`,
    amount: (n) => `投射物+${n}`,
    and: (a, b) => `${a}；${b}`,
    mods: {
      arc: ['電弧', '攻擊會跳向附近的敵人'],
      bounce: ['彈射', '彈向其他敵人'],
      burstOnKill: ['爆裂', '被擊倒的敵人會爆炸'],
      cruel: ['殘酷', '對有異常狀態的敵人×1.35'],
      drain: ['吸取', '回復部分造成的傷害'],
      echo: ['回音', '以一半傷害再發動一次'],
      execute: ['終結', '擊倒殘血的敵人'],
      hunter: ['獵人', '對菁英與頭目×1.5'],
      split: ['分裂', '命中時一分為二'],
      trail: ['軌跡', '留下有害的軌跡'],
    },
  },
  {
    blurbs: {
      scatterbug: '一路撒下粉塵雲，讓敵群變慢。Spewpa 靜止時會變硬；Vivillon 輪流使用三種粉，翅膀圖案跟著你的地區。',
      minior: 'Shields Down：HP低於一半時外殼碎裂、碎片四射，露出更快更強的核心。回復後外殼會再次合上。',
      tyrogue: '依你的配置進化：攻擊高於防禦變成 Hitmonlee，防禦較高變成 Hitmonchan，平手變成 Hitmontop。',
      plusle: '正電：每擊倒一個敵人就充電，充滿時放出一圈火花並跑得更快。合作模式中與 Minun 同隊時兩者會相連。',
      minun: '負電：不時放出脈衝，削弱並減慢周圍敵人，同時回復自己。合作模式中與 Plusle 同隊時兩者會相連。',
    },
    moves: {
      bugBuzz: '向前擴散的振翅聲波，貫穿一切，有時會削弱敵人。',
      powerGem: '向最近的敵人射出寶石。有外殼時是岩石；核心狀態時是更快、貫穿更多的稜晶。',
      fakeOut: '對最近的敵人快速出拳，讓它畏縮片刻。',
      jumpKick: '從遠處跳向敵人，膝蓋落地掀起衝擊波。要有目標在範圍內才會發動。',
      tripleKick: '在周圍連續三次旋轉踢，一次比一次更強、更廣。',
      voltSwitch: '射向敵人再折返的閃電，去程和回程都會命中。',
      eerieImpulse: '在周圍放出一圈怪異電流，削弱碰到的每個敵人。',
    },
    prizes: { plusle: 'Plusle', minun: 'Minun', shadowPlusle: '黑暗 Plusle', shadowMinun: '黑暗 Minun' },
    prizeBlurbs: { plusle: '每次擊倒都會為火花環充電。合作模式中會與 Minun 相連。', minun: '削弱敵人並回復自己的脈衝。合作模式中會與 Plusle 相連。' },
    where: {
      scatterbug: '只在 Poké Realm 秘密基地森林的*狩獵地帶*，金色草原。需要帳號。',
      minior: '只在 Poké Realm 秘密基地森林的*狩獵地帶*，雷鳴山脊，而且只在夜晚。需要帳號。',
      tyrogue: '只在 Poké Realm 秘密基地森林的*狩獵地帶*，雷鳴山脊。需要帳號。',
      plusle: 'Poké Realm 中火箭隊遊戲城兌換櫃台的獎品。',
      minun: 'Poké Realm 中火箭隊遊戲城兌換櫃台的獎品。',
    },
    tyrogue: {
      evolving: (name, attack, defense, to) => `${name}正在進化！攻擊+${attack}，防禦+${defense}：會變成${to}。`,
      meter: '攻擊×防禦',
    },
    vivillon: { pattern: (name) => `Vivillon 圖案：${name}`, why: '翅膀圖案跟著你裝置的地區。' },
    plusMinus: { linked: '*正電*與*負電*：Plusle 和 Minun 相連了！' },
  },
)

export const GA_HOOK_WORDS = { pt, en, es, fr, zh }
