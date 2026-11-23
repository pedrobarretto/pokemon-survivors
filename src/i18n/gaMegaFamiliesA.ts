import type { GaMegaFamilyAId } from '../data/gaMegaFamiliesA'
import { GA_KIT_MA_UPGRADES, type GaKitMAMoveId } from '../game/gaKitMAUpgrades'
import type { ModId } from '../game/mods'
import type { UpgradeStep } from '../game/moves'

/**
 * The Grande Atualização's Mega families' words, a table per language (`pt`
 * is the reference). Each language's file spreads its `blurbs`, `moves` and
 * `megas` here, and the partner select's locked card reads `where`. A move's
 * level-up lines are built from its steps' numbers (`game/gaKitMAUpgrades.ts`),
 * so all five languages stay in step with the data.
 */

type Mod = 'boomerang' | 'burstOnKill' | 'cruel' | 'drain' | 'echo' | 'execute' | 'hunter' | 'split' | 'trail'

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

const MODS: readonly string[] = ['boomerang', 'burstOnKill', 'cruel', 'drain', 'echo', 'execute', 'hunter', 'split', 'trail'] satisfies readonly Mod[]

const isMod = (m: ModId): m is Mod => MODS.includes(m)

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

type Fork = { fork: readonly [{ name: string; desc: string }, { name: string; desc: string }] }

const line = (v: Vocab, step: UpgradeStep): string | Fork => ('fork' in step ? { fork: [branch(v, step.fork[0]), branch(v, step.fork[1])] } : statLine(v, step))

type Lines = readonly [string, string, Fork, string, string, Fork, string]

/** The seven lines of a signature, forks at the third and sixth. */
const linesOf = (v: Vocab, id: GaKitMAMoveId): Lines => {
  const steps: readonly UpgradeStep[] = GA_KIT_MA_UPGRADES[id]
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

const IDS = Object.keys(GA_KIT_MA_UPGRADES) as GaKitMAMoveId[]

/** A language's moves: each signature's description and its level-up lines. */
const movesOf = (v: Vocab, text: Record<GaKitMAMoveId, string>) =>
  Object.fromEntries(IDS.map((id) => [id, { description: text[id], upgrades: linesOf(v, id) }])) as Record<GaKitMAMoveId, { description: string; upgrades: Lines }>

type MegaId = 'kangaskhan' | 'pinsir' | 'skarmory' | 'excadrill' | 'drampa'

type Words = {
  blurbs: Record<GaMegaFamilyAId, string>
  moves: Record<GaKitMAMoveId, string>
  megas: Record<MegaId, string>
  /** The partner select's locked card: where the family is found. */
  where: Record<GaMegaFamilyAId, string>
}

const wordsOf = (v: Vocab, w: Words) => ({ blurbs: w.blurbs, moves: movesOf(v, w.moves), megas: w.megas, where: w.where })

const pt = wordsOf(
  {
    damage: (n) => `+${n} de dano`,
    area: (n) => `+${n}% de área`,
    cooldown: (n) => `recarga -${String(n).replace('.', ',')}s`,
    pierce: (n) => `+${n} de perfuração`,
    amount: (n) => `+${n} ${n === 1 ? 'golpe' : 'golpes'}`,
    and: (a, b) => `${a}; ${b}`,
    mods: {
      boomerang: ['Retorno', 'Volta até você e acerta de novo'],
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
      kangaskhan: 'Parental Bond: o filhote pula da bolsa e soca quem a mãe acabou de acertar. Ele cresce durante a run e bate cada vez mais forte.',
      pinsir: 'As pinças fecham à frente no próprio ritmo: prendem o inimigo, que passa a sofrer mais com tudo, e cortam ao meio quem já está fraco.',
      skarmory: 'Solta penas de aço afiadas pelo caminho: quem pisa nelas é cortado e fica lento. Quanto mais nível, mais penas no chão.',
      drilbur: 'Drill Run cava por baixo da horda e abre buracos que derrubam quem passa. Os túneis do Excadrill desabam atrás dele, e às vezes ele desenterra algo.',
      drampa: 'Berserk: quanto menos HP, mais forte e mais rápido. Ao cair abaixo da metade, solta um rugido que empurra a horda.',
    },
    moves: {
      cometPunch: 'Uma rajada de socos rápidos logo à frente. O filhote do Kangaskhan acompanha.',
      stormThrow: 'Agarra o inimigo à frente e o arremessa por cima do ombro em quem estiver atrás. Fere mais quem está preso nas pinças.',
      airCutter: 'Lâminas de ar em leque que cortam os primeiros inimigos que encontram.',
      drillRun: 'Gira e entra na terra, perfurando a horda até o inimigo mais próximo. Abre um buraco onde entra e outro onde sai.',
      hyperVoice: 'Ondas de som que se espalham em volta, uma depois da outra. Crescem com a fúria do Drampa.',
    },
    megas: {
      kangaskhan: 'golpes +25%, defesa +1 e velocidade +4. Parental Bond: o filhote luta fora da bolsa, soca mais forte, mais vezes e em área. O especial vira Focus Blast.',
      pinsir: 'golpes +30%, velocidade +8 e golpes Voador e Normal +30%. Aerilate: as pinças fecham mais rápido e cada mordida lança uma lâmina de vento. O especial vira Double-Edge.',
      skarmory: 'defesa +2, golpes +25% e golpes Aço e Voador +20%. Stalwart: o dobro de penas no chão, mais afiadas, e o Air Cutter atravessa escudos. O especial vira Hurricane.',
      excadrill: 'golpes +30%, velocidade +6 e golpes Terra e Aço +20%. Piercing Drill: a broca e os túneis atravessam escudos, e o Drill Run gira mais rápido. O especial vira Earth Power.',
      drampa: 'golpes +20%, área +15% e golpes Dragão +25%. Berserk: a fúria nunca fica abaixo da metade e o rugido volta mais rápido. O especial vira Draco Meteor.',
    },
    where: {
      kangaskhan: 'Só na *Zona Safári*, na semana da Campina Dourada, no Bosque das Bases do Poké Realm. Precisa de conta.',
      pinsir: 'Só na *Zona Safári*, na semana da Campina Dourada, no Bosque das Bases do Poké Realm. Precisa de conta.',
      skarmory: 'Só na *Zona Safári*, na semana da Serra Trovejante, no Bosque das Bases do Poké Realm. Precisa de conta.',
      drilbur: 'Só na *Zona Safári*, na semana da Serra Trovejante, no Bosque das Bases do Poké Realm. Precisa de conta.',
      drampa: 'Só na *Zona Safári*, na semana da Serra Trovejante, no Bosque das Bases do Poké Realm. Precisa de conta.',
    },
  },
)

const en = wordsOf(
  {
    damage: (n) => `+${n} damage`,
    area: (n) => `+${n}% area`,
    cooldown: (n) => `-${n}s cooldown`,
    pierce: (n) => `+${n} pierce`,
    amount: (n) => `+${n} hit${n === 1 ? '' : 's'}`,
    and: (a, b) => `${a}; ${b}`,
    mods: {
      boomerang: ['Return', 'Comes back to you and hits again'],
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
      kangaskhan: 'Parental Bond: the baby hops out of the pouch and punches whatever its mother just hit. It grows up through the run and hits harder and harder.',
      pinsir: 'Its pincers snap shut in front on their own rhythm: they clamp a foe, which then takes more from everything, and cut weak ones in two.',
      skarmory: 'Sheds razor-sharp steel feathers as it goes: foes that step on them are cut and slowed. The higher its level, the more feathers lie around.',
      drilbur: 'Drill Run digs under the horde and opens holes that trip whoever crosses them. Excadrill’s tunnels cave in behind it, and now and then it digs something up.',
      drampa: 'Berserk: the lower its HP, the harder and faster it hits. Falling under half lets out a roar that throws the horde back.',
    },
    moves: {
      cometPunch: 'A flurry of quick punches just ahead. Kangaskhan’s baby follows them up.',
      stormThrow: 'Grabs the foe ahead and hurls it over its shoulder into whoever is behind. Hits clamped foes harder.',
      airCutter: 'Blades of air in a fan that cut through the first foes they meet.',
      drillRun: 'Spins into the ground and drills through the horde to the nearest foe. Opens a hole where it dives and another where it comes up.',
      hyperVoice: 'Rings of sound that swell out around it, one after another. They grow with Drampa’s rage.',
    },
    megas: {
      kangaskhan: 'moves +25%, defense +1 and speed +4. Parental Bond: the baby fights out of the pouch, punching harder, more often and in a ring. The special becomes Focus Blast.',
      pinsir: 'moves +30%, speed +8 and Flying and Normal moves +30%. Aerilate: the pincers snap faster and each snap throws a blade of wind. The special becomes Double-Edge.',
      skarmory: 'defense +2, moves +25% and Steel and Flying moves +20%. Stalwart: twice the feathers on the ground, sharper, and Air Cutter goes through shields. The special becomes Hurricane.',
      excadrill: 'moves +30%, speed +6 and Ground and Steel moves +20%. Piercing Drill: the drill and its tunnels go through shields, and Drill Run spins faster. The special becomes Earth Power.',
      drampa: 'moves +20%, area +15% and Dragon moves +25%. Berserk: its rage never drops under half and the roar comes back sooner. The special becomes Draco Meteor.',
    },
    where: {
      kangaskhan: 'Only in the *Safari Zone*, on the Golden Meadow’s week, in the Poké Realm’s Secret Base Grove. Needs an account.',
      pinsir: 'Only in the *Safari Zone*, on the Golden Meadow’s week, in the Poké Realm’s Secret Base Grove. Needs an account.',
      skarmory: 'Only in the *Safari Zone*, on the Thunder Ridge’s week, in the Poké Realm’s Secret Base Grove. Needs an account.',
      drilbur: 'Only in the *Safari Zone*, on the Thunder Ridge’s week, in the Poké Realm’s Secret Base Grove. Needs an account.',
      drampa: 'Only in the *Safari Zone*, on the Thunder Ridge’s week, in the Poké Realm’s Secret Base Grove. Needs an account.',
    },
  },
)

const es = wordsOf(
  {
    damage: (n) => `+${n} de daño`,
    area: (n) => `+${n}% de área`,
    cooldown: (n) => `recarga -${String(n).replace('.', ',')}s`,
    pierce: (n) => `+${n} de perforación`,
    amount: (n) => `+${n} ${n === 1 ? 'golpe' : 'golpes'}`,
    and: (a, b) => `${a}; ${b}`,
    mods: {
      boomerang: ['Regreso', 'Vuelve hacia ti y golpea otra vez'],
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
      kangaskhan: 'Parental Bond: la cría salta de la bolsa y golpea a quien su madre acaba de golpear. Crece durante la partida y pega cada vez más fuerte.',
      pinsir: 'Sus pinzas se cierran al frente a su propio ritmo: atrapan al enemigo, que pasa a sufrir más con todo, y parten en dos a los que ya están débiles.',
      skarmory: 'Suelta plumas de acero afiladas por el camino: quien las pisa se corta y se vuelve lento. Cuanto más nivel, más plumas en el suelo.',
      drilbur: 'Drill Run excava bajo la horda y abre agujeros que hacen tropezar a quien pasa. Los túneles de Excadrill se derrumban tras él, y a veces desentierra algo.',
      drampa: 'Berserk: cuanto menos PS, más fuerte y más rápido. Al caer por debajo de la mitad, suelta un rugido que empuja a la horda.',
    },
    moves: {
      cometPunch: 'Una ráfaga de puñetazos rápidos justo al frente. La cría de Kangaskhan los sigue.',
      stormThrow: 'Agarra al enemigo de enfrente y lo lanza por encima del hombro contra los de atrás. Hiere más a los atrapados por las pinzas.',
      airCutter: 'Hojas de aire en abanico que cortan a los primeros enemigos que encuentran.',
      drillRun: 'Gira y se mete en la tierra, perforando la horda hasta el enemigo más cercano. Abre un agujero donde entra y otro donde sale.',
      hyperVoice: 'Ondas de sonido que se expanden a su alrededor, una tras otra. Crecen con la furia de Drampa.',
    },
    megas: {
      kangaskhan: 'movimientos +25%, defensa +1 y velocidad +4. Parental Bond: la cría pelea fuera de la bolsa, golpea más fuerte, más seguido y en área. El especial pasa a ser Focus Blast.',
      pinsir: 'movimientos +30%, velocidad +8 y movimientos Volador y Normal +30%. Aerilate: las pinzas se cierran más rápido y cada cierre lanza una hoja de viento. El especial pasa a ser Double-Edge.',
      skarmory: 'defensa +2, movimientos +25% y movimientos Acero y Volador +20%. Stalwart: el doble de plumas en el suelo, más afiladas, y Air Cutter atraviesa escudos. El especial pasa a ser Hurricane.',
      excadrill: 'movimientos +30%, velocidad +6 y movimientos Tierra y Acero +20%. Piercing Drill: el taladro y los túneles atraviesan escudos, y Drill Run gira más rápido. El especial pasa a ser Earth Power.',
      drampa: 'movimientos +20%, área +15% y movimientos Dragón +25%. Berserk: la furia nunca baja de la mitad y el rugido vuelve antes. El especial pasa a ser Draco Meteor.',
    },
    where: {
      kangaskhan: 'Solo en la *Zona Safari*, en la semana de la Pradera Dorada, en la Arboleda de Bases del Poké Realm. Necesitas una cuenta.',
      pinsir: 'Solo en la *Zona Safari*, en la semana de la Pradera Dorada, en la Arboleda de Bases del Poké Realm. Necesitas una cuenta.',
      skarmory: 'Solo en la *Zona Safari*, en la semana de la Sierra Tronadora, en la Arboleda de Bases del Poké Realm. Necesitas una cuenta.',
      drilbur: 'Solo en la *Zona Safari*, en la semana de la Sierra Tronadora, en la Arboleda de Bases del Poké Realm. Necesitas una cuenta.',
      drampa: 'Solo en la *Zona Safari*, en la semana de la Sierra Tronadora, en la Arboleda de Bases del Poké Realm. Necesitas una cuenta.',
    },
  },
)

const fr = wordsOf(
  {
    damage: (n) => `+${n} dégâts`,
    area: (n) => `+${n} % de zone`,
    cooldown: (n) => `recharge -${String(n).replace('.', ',')} s`,
    pierce: (n) => `+${n} perforation`,
    amount: (n) => `+${n} coup${n === 1 ? '' : 's'}`,
    and: (a, b) => `${a} ; ${b}`,
    mods: {
      boomerang: ['Retour', 'Revient vers vous et frappe à nouveau'],
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
      kangaskhan: 'Parental Bond : le petit saute de la poche et frappe ce que sa mère vient de toucher. Il grandit pendant la partie et frappe de plus en plus fort.',
      pinsir: 'Ses pinces se referment devant lui à leur propre rythme : elles serrent un ennemi, qui subit alors davantage de tout, et coupent en deux ceux qui sont déjà faibles.',
      skarmory: 'Sème des plumes d’acier tranchantes sur son chemin : les ennemis qui marchent dessus sont coupés et ralentis. Plus il monte de niveau, plus il y a de plumes au sol.',
      drilbur: 'Drill Run creuse sous la horde et ouvre des trous qui font trébucher ceux qui passent. Les tunnels d’Excadrill s’effondrent derrière lui, et parfois il déterre quelque chose.',
      drampa: 'Berserk : moins il a de PV, plus il frappe fort et vite. En passant sous la moitié, il pousse un rugissement qui repousse la horde.',
    },
    moves: {
      cometPunch: 'Une rafale de coups de poing rapides juste devant. Le petit de Kangaskhan suit.',
      stormThrow: 'Saisit l’ennemi devant lui et le projette par-dessus son épaule sur ceux de derrière. Blesse davantage les ennemis serrés par les pinces.',
      airCutter: 'Des lames d’air en éventail qui tranchent les premiers ennemis rencontrés.',
      drillRun: 'Tourne et s’enfonce dans le sol, perçant la horde jusqu’à l’ennemi le plus proche. Ouvre un trou là où il plonge et un autre là où il ressort.',
      hyperVoice: 'Des ondes sonores qui s’étendent autour de lui, l’une après l’autre. Elles grandissent avec la rage de Drampa.',
    },
    megas: {
      kangaskhan: 'capacités +25 %, défense +1 et vitesse +4. Parental Bond : le petit se bat hors de la poche, frappe plus fort, plus souvent et en zone. L’attaque spéciale devient Focus Blast.',
      pinsir: 'capacités +30 %, vitesse +8 et capacités Vol et Normal +30 %. Aerilate : les pinces se referment plus vite et chaque morsure lance une lame de vent. L’attaque spéciale devient Double-Edge.',
      skarmory: 'défense +2, capacités +25 % et capacités Acier et Vol +20 %. Stalwart : deux fois plus de plumes au sol, plus tranchantes, et Air Cutter traverse les boucliers. L’attaque spéciale devient Hurricane.',
      excadrill: 'capacités +30 %, vitesse +6 et capacités Sol et Acier +20 %. Piercing Drill : la foreuse et les tunnels traversent les boucliers, et Drill Run tourne plus vite. L’attaque spéciale devient Earth Power.',
      drampa: 'capacités +20 %, zone +15 % et capacités Dragon +25 %. Berserk : sa rage ne descend jamais sous la moitié et le rugissement revient plus tôt. L’attaque spéciale devient Draco Meteor.',
    },
    where: {
      kangaskhan: 'Seulement au *Parc Safari*, la semaine de la Prairie Dorée, au Bosquet des Bases du Poké Realm. Compte requis.',
      pinsir: 'Seulement au *Parc Safari*, la semaine de la Prairie Dorée, au Bosquet des Bases du Poké Realm. Compte requis.',
      skarmory: 'Seulement au *Parc Safari*, la semaine de la Crête du Tonnerre, au Bosquet des Bases du Poké Realm. Compte requis.',
      drilbur: 'Seulement au *Parc Safari*, la semaine de la Crête du Tonnerre, au Bosquet des Bases du Poké Realm. Compte requis.',
      drampa: 'Seulement au *Parc Safari*, la semaine de la Crête du Tonnerre, au Bosquet des Bases du Poké Realm. Compte requis.',
    },
  },
)

const zh = wordsOf(
  {
    damage: (n) => `傷害+${n}`,
    area: (n) => `範圍+${n}%`,
    cooldown: (n) => `冷卻-${n}秒`,
    pierce: (n) => `貫穿+${n}`,
    amount: (n) => `攻擊次數+${n}`,
    and: (a, b) => `${a}；${b}`,
    mods: {
      boomerang: ['折返', '飛回你身邊並再次命中'],
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
      kangaskhan: '親子愛：小寶寶會從育兒袋跳出來，揍媽媽剛打中的敵人。牠在冒險中逐漸長大，打得越來越用力。',
      pinsir: '大鉗子會以自己的節奏在前方夾緊：被夾住的敵人受到的所有傷害都會增加，已經虛弱的敵人會被一刀兩斷。',
      skarmory: '一路撒下鋒利的鋼鐵羽毛：踩到的敵人會被割傷並減速。等級越高，地上的羽毛越多。',
      drilbur: 'Drill Run 從怪群底下鑽過，留下會絆倒經過敵人的洞。Excadrill 的隧道會在身後崩塌，偶爾還能挖到寶物。',
      drampa: '怒火：HP越低，攻擊越強越快。HP跌破一半時會發出咆哮，把怪群震開。',
    },
    moves: {
      cometPunch: '朝正前方連續快拳。袋龍的小寶寶也會跟著出拳。',
      stormThrow: '抓住前方的敵人，從肩膀上方摔向身後的敵人。對被大鉗子夾住的敵人更痛。',
      airCutter: '扇形射出空氣之刃，切開最先碰到的敵人。',
      drillRun: '旋轉鑽入地下，一路鑽穿怪群直到最近的敵人。在鑽入處和鑽出處各留下一個洞。',
      hyperVoice: '聲波一圈接一圈向四周擴散。隨著老翁龍的怒火變大。',
    },
    megas: {
      kangaskhan: '招式+25%、防禦+1、速度+4。親子愛：小寶寶離開育兒袋作戰，出拳更重、更頻繁，而且是範圍攻擊。必殺技變為 Focus Blast。',
      pinsir: '招式+30%、速度+8，飛行與一般屬性招式+30%。飛行皮膚：大鉗子夾得更快，每次夾擊都會射出一道風刃。必殺技變為 Double-Edge。',
      skarmory: '防禦+2、招式+25%，鋼與飛行屬性招式+20%。堅毅：地上的羽毛加倍且更鋒利，Air Cutter 能穿透護盾。必殺技變為 Hurricane。',
      excadrill: '招式+30%、速度+6，地面與鋼屬性招式+20%。穿透鑽頭：鑽頭和隧道能穿透護盾，Drill Run 轉得更快。必殺技變為 Earth Power。',
      drampa: '招式+20%、範圍+15%，龍屬性招式+25%。怒火：怒氣永遠不低於一半，咆哮也更快恢復。必殺技變為 Draco Meteor。',
    },
    where: {
      kangaskhan: '只在 Poké Realm 秘密基地樹林的*狩獵地帶*，金色草原那一週出現。需要帳號。',
      pinsir: '只在 Poké Realm 秘密基地樹林的*狩獵地帶*，金色草原那一週出現。需要帳號。',
      skarmory: '只在 Poké Realm 秘密基地樹林的*狩獵地帶*，雷鳴山脊那一週出現。需要帳號。',
      drilbur: '只在 Poké Realm 秘密基地樹林的*狩獵地帶*，雷鳴山脊那一週出現。需要帳號。',
      drampa: '只在 Poké Realm 秘密基地樹林的*狩獵地帶*，雷鳴山脊那一週出現。需要帳號。',
    },
  },
)

export const GA_MEGA_FAMILIES_A_WORDS = { pt, en, es, fr, zh }
