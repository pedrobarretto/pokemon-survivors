import type { GA_FAMILIES_B } from '../data/gaFamiliesB'
import { GA_KIT_B_UPGRADES, type GaKitBMoveId } from '../game/gaKitBUpgrades'
import type { ModId } from '../game/mods'
import type { UpgradeStep } from '../game/moves'

/**
 * The Grande Atualização's second batch of families' words, a table per
 * language (`pt` is the reference). Each language's file spreads its
 * `blurbs`, `moves` and `megas` here. A move's level-up lines are built from
 * its steps' numbers (`game/gaKitBUpgrades.ts`), so all five languages stay in
 * step with the data.
 */

type Mod = 'arc' | 'bounce' | 'boomerang' | 'burstOnKill' | 'cruel' | 'drain' | 'echo' | 'execute' | 'hunter' | 'split' | 'trail'

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

const isMod = (m: ModId): m is Mod => ['arc', 'bounce', 'boomerang', 'burstOnKill', 'cruel', 'drain', 'echo', 'execute', 'hunter', 'split', 'trail'].includes(m)

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

type Lines = readonly [string, string, { fork: readonly [{ name: string; desc: string }, { name: string; desc: string }] }, string, string, { fork: readonly [{ name: string; desc: string }, { name: string; desc: string }] }, string]

/** The seven lines of a signature, forks at the third and sixth. */
const linesOf = (v: Vocab, id: GaKitBMoveId): Lines => {
  const [a, b, c, d, e, f, h] = GA_KIT_B_UPGRADES[id].map((s) => line(v, s))
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

const IDS = Object.keys(GA_KIT_B_UPGRADES) as GaKitBMoveId[]

/** A language's moves: each signature's description and its level-up lines. */
const movesOf = (v: Vocab, text: Record<GaKitBMoveId, string>) =>
  Object.fromEntries(IDS.map((id) => [id, { description: text[id], upgrades: linesOf(v, id) }])) as Record<GaKitBMoveId, { description: string; upgrades: Lines }>

type Words = { blurbs: Record<keyof typeof GA_FAMILIES_B, string>; moves: Record<GaKitBMoveId, string>; megas: Record<'steelix' | 'eelektross', string> }

const wordsOf = (v: Vocab, w: Words) => ({ blurbs: w.blurbs, moves: movesOf(v, w.moves), megas: w.megas })

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
      onix: 'O corpo de pedra se arrasta atrás de você e fere quem encosta. Steelix fica mais longo e de aço.',
      happiny: 'Bota Ovos da Sorte pelo chão: quem pegar se cura, inclusive o time no co-op.',
      clauncher: 'Mega Launcher: a cada poucas Aura Spheres, a garra dispara uma rajada enorme que atravessa tudo.',
      fletchling: 'Gale Wings: com o HP cheio fica mais rápido, com recargas menores e Acrobatics mais forte.',
      golett: 'Os jatos dos braços o tiram do chão de tempos em tempos, e ele cai esmagando tudo em volta.',
      nacli: 'Cada inimigo derrotado pelo Salt Cure soma uma camada de sal: mais defesa, que se desfaz com o tempo.',
      inkay: 'Topsy-Turvy: de tempos em tempos, um anel deixa os inimigos em volta confusos. Psycho Cut fere mais quem está afligido.',
      skorupi: 'A cauda agarra o inimigo mais próximo, puxa, prende e envenena. Drapion agarra mais longe e mais vezes.',
      snover: 'Snow Warning: uma nevasca o acompanha, deixa lentos os inimigos em volta e fortalece os golpes de Gelo.',
      tynamo: 'Spark leva até o inimigo. A partir de Eelektrik, se prende nele e dá choques; Eelektross espalha os choques.',
      dewpider: 'Water Bubble: uma bolha bloqueia um golpe e estoura num jato d’água. Golpes de Água mais fortes.',
      duraludon: 'Stamina: cada golpe recebido soma defesa e força, que somem se ninguém o acertar.',
      bounsweet: 'Queenly Majesty: um anel em volta quebra os tiros inimigos que chegam perto. Cresce a cada evolução.',
    },
    moves: {
      ironTail: 'A cauda gira por trás em um arco largo de pedra e aço que empurra forte.',
      eggBomb: 'Lança um ovo no inimigo mais próximo, que explode ao cair.',
      auraSphere: 'Uma esfera de aura que persegue o alvo. Mega Launcher: a cada poucas, sai a rajada cheia da garra.',
      acrobatics: 'Um voo rápido até o inimigo mais próximo, com um instante de invencibilidade. Mais forte com Gale Wings.',
      shadowPunch: 'Um soco de sombra que persegue o alvo e nunca erra.',
      saltCure: 'Pedras de sal que marcam os inimigos: cada marca faz qualquer golpe ferir mais.',
      psychoCut: 'Duas lâminas psíquicas à frente, mais fortes em inimigos com status.',
      poisonFang: 'Uma mordida à frente que costuma envenenar.',
      icePunch: 'Um soco gelado à frente que pode congelar.',
      spark: 'Uma investida elétrica até o inimigo mais próximo. Em Eelektrik, se prende no alvo e dá choques.',
      lunge: 'Uma investida que enfraquece o alvo: o toque dele passa a ferir menos.',
      electroShot: 'Carrega e dispara um raio longo que atravessa tudo. Na chuva, dispara na hora e mais forte.',
      tropKick: 'Um chute em leque à frente que pode enfraquecer os inimigos.',
    },
    megas: {
      steelix: 'defesa +3, recebe 20% menos dano e golpes Aço, Terra e Pedra +30%. O especial vira Heavy Slam.',
      eelektross: 'golpes +30%, velocidade +8 e golpes Elétricos +20%. O especial vira Zap Cannon.',
    },
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
      onix: 'Its rock body drags behind you and hurts whatever it touches. Steelix grows longer, and steel.',
      happiny: 'Lays Lucky Eggs on the ground: whoever picks one up heals, the team too in co-op.',
      clauncher: 'Mega Launcher: every few Aura Spheres, the claw fires a huge blast that goes through everything.',
      fletchling: 'Gale Wings: at full HP it gets faster, with shorter cooldowns and a stronger Acrobatics.',
      golett: 'Its arm jets lift it off the ground now and then, and it lands crushing everything around.',
      nacli: 'Every foe Salt Cure fells adds a salt layer: more defense, crumbling over time.',
      inkay: 'Topsy-Turvy: now and then, a ring confuses the foes around it. Psycho Cut hurts afflicted foes more.',
      skorupi: 'Its tail grabs the nearest foe, pulls it in, holds it and poisons it. Drapion reaches farther, more often.',
      snover: 'Snow Warning: a snowfall follows it, slows the foes around and powers up Ice moves.',
      tynamo: 'Spark carries it to a foe. From Eelektrik on it latches on and shocks; Eelektross spreads the shocks.',
      dewpider: 'Water Bubble: a bubble blocks one hit and bursts in a splash. Stronger Water moves.',
      duraludon: 'Stamina: every hit it takes adds defense and power, fading if nothing lands on it.',
      bounsweet: 'Queenly Majesty: a ring around it breaks enemy shots that come close. It grows with each evolution.',
    },
    moves: {
      ironTail: 'The tail swings round from behind in a wide arc of rock and steel that shoves hard.',
      eggBomb: 'Lobs an egg at the nearest foe that bursts where it lands.',
      auraSphere: 'An orb of aura that chases its target. Mega Launcher: every few, the claw fires its full blast.',
      acrobatics: 'A quick flight into the nearest foe, with a moment of invincibility. Stronger with Gale Wings.',
      shadowPunch: 'A fist of shadow that chases its target and never misses.',
      saltCure: 'Chunks of salt that mark foes: each mark makes every hit hurt more.',
      psychoCut: 'Two psychic blades ahead, stronger on foes with a status.',
      poisonFang: 'A bite ahead that often poisons.',
      icePunch: 'A frozen punch ahead that may freeze.',
      spark: 'An electric dash into the nearest foe. As Eelektrik it latches on and keeps shocking.',
      lunge: 'A lunge that weakens its target: its touch hurts less.',
      electroShot: 'Charges, then fires a long beam that goes through everything. In the rain it fires at once, harder.',
      tropKick: 'A sweeping kick ahead that may weaken foes.',
    },
    megas: {
      steelix: 'defense +3, takes 20% less damage and Steel, Ground and Rock moves +30%. The special becomes Heavy Slam.',
      eelektross: 'moves +30%, speed +8 and Electric moves +20%. The special becomes Zap Cannon.',
    },
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
      onix: 'Su cuerpo de roca se arrastra detrás de ti y hiere a quien lo toca. Steelix se vuelve más largo y de acero.',
      happiny: 'Deja Huevos Suerte en el suelo: quien los recoge se cura, también el equipo en co-op.',
      clauncher: 'Megadisparador: cada pocas Aura Sphere, la pinza dispara una ráfaga enorme que lo atraviesa todo.',
      fletchling: 'Alas Vendaval: con el PS lleno es más rápido, con recargas menores y Acrobatics más fuerte.',
      golett: 'Los propulsores de sus brazos lo elevan de vez en cuando, y cae aplastando todo alrededor.',
      nacli: 'Cada enemigo que derrota Salt Cure suma una capa de sal: más defensa, que se desmorona con el tiempo.',
      inkay: 'Reversión: de vez en cuando, un anillo confunde a los enemigos cercanos. Psycho Cut hiere más a los afligidos.',
      skorupi: 'Su cola agarra al enemigo más cercano, lo atrae, lo inmoviliza y lo envenena. Drapion llega más lejos y más seguido.',
      snover: 'Nevada: una nevada lo acompaña, ralentiza a los enemigos cercanos y potencia los movimientos de Hielo.',
      tynamo: 'Spark lo lleva hasta un enemigo. Desde Eelektrik se aferra a él y da descargas; Eelektross las esparce.',
      dewpider: 'Pompa: una burbuja bloquea un golpe y revienta en un chorro de agua. Movimientos de Agua más fuertes.',
      duraludon: 'Firmeza: cada golpe recibido suma defensa y fuerza, que se pierden si nadie lo golpea.',
      bounsweet: 'Regia Presencia: un anillo a su alrededor rompe los disparos enemigos que se acercan. Crece con cada evolución.',
    },
    moves: {
      ironTail: 'La cola gira desde atrás en un arco amplio de roca y acero que empuja fuerte.',
      eggBomb: 'Lanza un huevo al enemigo más cercano que estalla al caer.',
      auraSphere: 'Una esfera de aura que persigue a su objetivo. Megadisparador: cada pocas, la pinza dispara su ráfaga completa.',
      acrobatics: 'Un vuelo rápido hacia el enemigo más cercano, con un instante de invencibilidad. Más fuerte con Alas Vendaval.',
      shadowPunch: 'Un puño de sombra que persigue a su objetivo y nunca falla.',
      saltCure: 'Trozos de sal que marcan a los enemigos: cada marca hace que todo golpe hiera más.',
      psychoCut: 'Dos hojas psíquicas al frente, más fuertes en enemigos con estado.',
      poisonFang: 'Un mordisco al frente que suele envenenar.',
      icePunch: 'Un puñetazo helado al frente que puede congelar.',
      spark: 'Una embestida eléctrica hacia el enemigo más cercano. Como Eelektrik se aferra y sigue dando descargas.',
      lunge: 'Una embestida que debilita al objetivo: su toque hiere menos.',
      electroShot: 'Carga y dispara un rayo largo que lo atraviesa todo. Con lluvia dispara al instante y más fuerte.',
      tropKick: 'Una patada en abanico al frente que puede debilitar a los enemigos.',
    },
    megas: {
      steelix: 'defensa +3, recibe 20% menos daño y movimientos de Acero, Tierra y Roca +30%. El especial pasa a ser Heavy Slam.',
      eelektross: 'movimientos +30%, velocidad +8 y movimientos Eléctricos +20%. El especial pasa a ser Zap Cannon.',
    },
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
      onix: 'Son corps de roche traîne derrière vous et blesse ce qu’il touche. Steelix devient plus long, et d’acier.',
      happiny: 'Pond des Œufs Chance au sol : qui en ramasse un se soigne, l’équipe aussi en coop.',
      clauncher: 'Méga Blaster : toutes les quelques Aura Sphere, la pince tire une énorme décharge qui traverse tout.',
      fletchling: 'Ailes Bourrasque : PV au max, il va plus vite, avec des recharges plus courtes et un Acrobatics plus fort.',
      golett: 'Les réacteurs de ses bras le soulèvent de temps en temps, et il retombe en écrasant tout autour.',
      nacli: 'Chaque ennemi vaincu par Salt Cure ajoute une couche de sel : plus de défense, qui s’effrite avec le temps.',
      inkay: 'Renversement : de temps en temps, un anneau rend confus les ennemis autour. Psycho Cut blesse plus les ennemis affligés.',
      skorupi: 'Sa queue agrippe l’ennemi le plus proche, le tire, l’immobilise et l’empoisonne. Drapion attrape plus loin, plus souvent.',
      snover: 'Alerte Neige : une chute de neige le suit, ralentit les ennemis autour et renforce les capacités Glace.',
      tynamo: 'Spark le porte jusqu’à un ennemi. Dès Eelektrik, il s’y accroche et l’électrocute ; Eelektross propage les décharges.',
      dewpider: 'Aquabulle : une bulle bloque un coup et éclate en gerbe d’eau. Capacités Eau plus fortes.',
      duraludon: 'Endurance : chaque coup reçu ajoute défense et force, qui disparaissent si rien ne le touche.',
      bounsweet: 'Prestance Royale : un anneau autour de lui brise les tirs ennemis qui approchent. Il grandit à chaque évolution.',
    },
    moves: {
      ironTail: 'La queue balaie depuis l’arrière en un large arc de roche et d’acier qui repousse fort.',
      eggBomb: 'Lance un œuf sur l’ennemi le plus proche, qui éclate à l’impact.',
      auraSphere: 'Une sphère d’aura qui poursuit sa cible. Méga Blaster : toutes les quelques sphères, la pince tire à pleine puissance.',
      acrobatics: 'Un vol rapide vers l’ennemi le plus proche, avec un instant d’invincibilité. Plus fort avec Ailes Bourrasque.',
      shadowPunch: 'Un poing d’ombre qui poursuit sa cible et ne rate jamais.',
      saltCure: 'Des blocs de sel qui marquent les ennemis : chaque marque fait plus mal à chaque coup.',
      psychoCut: 'Deux lames psychiques devant, plus fortes sur les ennemis avec un statut.',
      poisonFang: 'Une morsure devant qui empoisonne souvent.',
      icePunch: 'Un coup de poing glacé devant qui peut geler.',
      spark: 'Une charge électrique vers l’ennemi le plus proche. En Eelektrik, il s’accroche et continue d’électrocuter.',
      lunge: 'Une charge qui affaiblit sa cible : son contact blesse moins.',
      electroShot: 'Se charge, puis tire un long rayon qui traverse tout. Sous la pluie, il tire aussitôt, plus fort.',
      tropKick: 'Un coup de pied en éventail devant qui peut affaiblir les ennemis.',
    },
    megas: {
      steelix: 'défense +3, subit 20 % de dégâts en moins et capacités Acier, Sol et Roche +30 %. L’attaque spéciale devient Heavy Slam.',
      eelektross: 'capacités +30 %, vitesse +8 et capacités Électrik +20 %. L’attaque spéciale devient Zap Cannon.',
    },
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
      onix: '岩石身軀拖在你身後，碰到的敵人都會受傷。進化成 Steelix 後更長，而且是鋼鐵。',
      happiny: '在地上產下幸運蛋：撿到的人會回復，合作模式中隊友也可以。',
      clauncher: '超級發射器：每發射幾顆 Aura Sphere，鉗子就會射出貫穿一切的巨大衝擊。',
      fletchling: '疾風之翼：HP全滿時移動更快、冷卻更短，Acrobatics 也更強。',
      golett: '手臂的噴射器不時把它推上空中，落地時壓垮周圍的一切。',
      nacli: '每個被 Salt Cure 擊倒的敵人都會疊上一層鹽：防禦提升，會隨時間崩落。',
      inkay: '顛倒：不時放出一道光環，讓周圍敵人陷入混亂。Psycho Cut 對異常狀態的敵人傷害更高。',
      skorupi: '尾巴會抓住最近的敵人，拉近、定住並使其中毒。Drapion 抓得更遠、更頻繁。',
      snover: '降雪：一場跟隨它的雪讓周圍敵人變慢，並強化冰屬性招式。',
      tynamo: 'Spark 讓它衝向敵人。從 Eelektrik 開始會吸附在敵人身上放電；Eelektross 會把電流擴散出去。',
      dewpider: '水泡：一顆泡泡擋下一次攻擊並爆成水花。水屬性招式更強。',
      duraludon: '持久力：每次受到攻擊都會增加防禦與力量，一段時間沒被打中就會消失。',
      bounsweet: '女王的威嚴：身邊的光環會擊碎靠近的敵方飛彈。每次進化都會變大。',
    },
    moves: {
      ironTail: '尾巴從後方甩出岩石與鋼鐵的寬弧，把敵人狠狠擊退。',
      eggBomb: '朝最近的敵人拋出一顆蛋，落地爆炸。',
      auraSphere: '追蹤目標的波導球。超級發射器：每隔幾發，鉗子就會全力射擊。',
      acrobatics: '快速飛向最近的敵人，並有短暫無敵。疾風之翼發動時更強。',
      shadowPunch: '追蹤目標、絕不落空的影子拳。',
      saltCure: '標記敵人的鹽塊：每層標記都讓所有攻擊造成更多傷害。',
      psychoCut: '向前射出兩道精神刃，對有異常狀態的敵人更強。',
      poisonFang: '向前咬一口，經常使敵人中毒。',
      icePunch: '向前打出冰拳，可能使敵人冰凍。',
      spark: '向最近的敵人電光衝刺。Eelektrik 起會吸附在目標上持續放電。',
      lunge: '削弱目標的飛撲：它的接觸傷害降低。',
      electroShot: '蓄力後射出貫穿一切的長光束。雨天時立即發射，而且更強。',
      tropKick: '向前扇形踢擊，可能削弱敵人。',
    },
    megas: {
      steelix: '防禦+3、受到的傷害減少20%，鋼、地面與岩石招式+30%。必殺技變為 Heavy Slam。',
      eelektross: '招式+30%、速度+8，電屬性招式+20%。必殺技變為 Zap Cannon。',
    },
  },
)

export const GA_FAMILIES_B_WORDS = { pt, en, es, fr, zh }
