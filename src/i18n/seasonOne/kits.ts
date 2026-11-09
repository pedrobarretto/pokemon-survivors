/**
 * Temporada 1's mechanic families' words, a table per language (`pt` is the
 * reference). Each language's file spreads its `blurbs`, `moves` and
 * `abilities` here. A move's upgrade lines are built from the numbers of its
 * steps (`step` below), so all five languages stay in step with
 * `game/seasonOneKitMoves.ts`.
 */
type Mod = 'arc' | 'bounce' | 'burstOnKill' | 'cruel' | 'drain' | 'echo' | 'execute' | 'hunter' | 'seek' | 'split' | 'trail'

/** A language's wording of the plain steps and the mods the forks add. */
type Vocab = {
  d: (n: number) => string
  a: (n: number) => string
  c: (n: number) => string
  p: (n: number) => string
  amt: (n: number) => string
  dur: (n: number) => string
  mods: Record<Mod, readonly [name: string, desc: string]>
  /** Joins a mod's line and its stat's. */
  and: (mod: string, stat: string) => string
}

const fork = (v: Vocab, a: readonly [Mod, string], b: readonly [Mod, string]) => ({
  fork: [
    { name: v.mods[a[0]][0], desc: v.and(v.mods[a[0]][1], a[1]) },
    { name: v.mods[b[0]][0], desc: v.and(v.mods[b[0]][1], b[1]) },
  ],
}) as const

/** The seven level-up lines of each signature, from its steps' numbers (`seasonOneKitMoves.ts`). */
const stepLines = (v: Vocab) => ({
  crossChop: [v.d(2), v.a(20), fork(v, ['burstOnKill', v.d(2)], ['cruel', v.c(0.15)]), v.d(2), v.c(0.12), fork(v, ['hunter', v.d(3)], ['echo', v.a(20)]), v.d(3)],
  nightSlash: [v.d(2), v.a(20), fork(v, ['execute', v.d(2)], ['arc', v.c(0.15)]), v.d(2), v.c(0.12), fork(v, ['hunter', v.d(3)], ['burstOnKill', v.a(20)]), v.d(3)],
  dragonPulse: [v.d(2), v.a(15), fork(v, ['trail', v.d(2)], ['drain', v.c(0.2)]), v.d(2), v.a(15), fork(v, ['cruel', v.d(3)], ['burstOnKill', v.c(0.2)]), v.d(3)],
  waterPulse: [v.d(2), v.amt(1), fork(v, ['split', v.d(2)], ['seek', v.c(0.12)]), v.d(2), v.p(1), fork(v, ['burstOnKill', v.d(3)], ['bounce', v.amt(1)]), v.d(3)],
  populationBomb: [v.d(1), v.amt(1), fork(v, ['burstOnKill', v.d(2)], ['cruel', v.dur(0.5)]), v.d(1), v.amt(1), fork(v, ['hunter', v.d(2)], ['arc', v.c(0.3)]), v.d(2)],
  jetPunch: [v.d(2), v.c(0.1), fork(v, ['burstOnKill', v.d(2)], ['arc', v.c(0.1)]), v.d(2), v.a(20), fork(v, ['hunter', v.d(4)], ['echo', v.a(20)]), v.d(3)],
  auraWheel: [v.d(2), v.p(1), fork(v, ['arc', v.d(2)], ['seek', v.c(0.15)]), v.d(2), v.amt(1), fork(v, ['cruel', v.d(3)], ['burstOnKill', v.a(20)]), v.d(3)],
  discharge: [v.d(2), v.a(15), fork(v, ['arc', v.d(2)], ['burstOnKill', v.c(0.15)]), v.d(2), v.amt(1), fork(v, ['cruel', v.d(3)], ['echo', v.a(20)]), v.d(3)],
  forecast: [v.d(2), v.a(15), fork(v, ['burstOnKill', v.d(2)], ['seek', v.c(0.15)]), v.d(2), v.amt(1), fork(v, ['cruel', v.d(3)], ['split', v.a(20)]), v.d(3)],
  firePunch: [v.d(2), v.a(20), fork(v, ['burstOnKill', v.d(2)], ['cruel', v.c(0.15)]), v.d(3), v.c(0.12), fork(v, ['hunter', v.d(3)], ['echo', v.a(20)]), v.d(3)],
  xScissor: [v.d(2), v.a(20), fork(v, ['execute', v.d(2)], ['arc', v.c(0.12)]), v.d(2), v.c(0.1), fork(v, ['hunter', v.d(3)], ['burstOnKill', v.a(20)]), v.d(3)],
  shadowClaw: [v.d(2), v.a(20), fork(v, ['cruel', v.d(2)], ['drain', v.c(0.15)]), v.d(2), v.c(0.12), fork(v, ['hunter', v.d(3)], ['burstOnKill', v.a(20)]), v.d(3)],
  orderUp: [v.d(2), v.a(15), fork(v, ['burstOnKill', v.d(2)], ['echo', v.c(0.15)]), v.d(2), v.a(15), fork(v, ['hunter', v.d(3)], ['cruel', v.c(0.15)]), v.d(3)],
}) as const

type Descriptions = Record<keyof ReturnType<typeof stepLines>, string>

/** A language's moves: each signature's description and its level-up lines. */
const movesOf = (v: Vocab, text: Descriptions) => {
  const lines = stepLines(v)
  return {
    crossChop: { description: text.crossChop, upgrades: lines.crossChop },
    nightSlash: { description: text.nightSlash, upgrades: lines.nightSlash },
    dragonPulse: { description: text.dragonPulse, upgrades: lines.dragonPulse },
    waterPulse: { description: text.waterPulse, upgrades: lines.waterPulse },
    populationBomb: { description: text.populationBomb, upgrades: lines.populationBomb },
    jetPunch: { description: text.jetPunch, upgrades: lines.jetPunch },
    auraWheel: { description: text.auraWheel, upgrades: lines.auraWheel },
    discharge: { description: text.discharge, upgrades: lines.discharge },
    forecast: { description: text.forecast, upgrades: lines.forecast },
    firePunch: { description: text.firePunch, upgrades: lines.firePunch },
    xScissor: { description: text.xScissor, upgrades: lines.xScissor },
    shadowClaw: { description: text.shadowClaw, upgrades: lines.shadowClaw },
    orderUp: { description: text.orderUp, upgrades: lines.orderUp },
  } as const
}

const ptVocab: Vocab = {
  d: (n) => `+${n} de dano`,
  a: (n) => `+${n}% de área`,
  c: (n) => `recarga -${String(n).replace('.', ',')}s`,
  p: (n) => `+${n} de perfuração`,
  amt: (n) => `+${n} ${n === 1 ? 'projétil' : 'projéteis'}`,
  dur: (n) => `+${String(n).replace('.', ',')}s de duração`,
  and: (mod, stat) => `${mod}; ${stat}`,
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
    trail: ['Rastro', 'Deixa um rastro que causa dano'],
  },
}

const enVocab: Vocab = {
  d: (n) => `+${n} damage`,
  a: (n) => `+${n}% area`,
  c: (n) => `-${n}s cooldown`,
  p: (n) => `+${n} pierce`,
  amt: (n) => `+${n} projectile${n === 1 ? '' : 's'}`,
  dur: (n) => `+${n}s duration`,
  and: (mod, stat) => `${mod}; ${stat}`,
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
    trail: ['Trail', 'Leaves a harmful trail'],
  },
}

const esVocab: Vocab = {
  d: (n) => `+${n} de daño`,
  a: (n) => `+${n}% de área`,
  c: (n) => `recarga -${String(n).replace('.', ',')}s`,
  p: (n) => `+${n} de perforación`,
  amt: (n) => `+${n} ${n === 1 ? 'proyectil' : 'proyectiles'}`,
  dur: (n) => `+${String(n).replace('.', ',')}s de duración`,
  and: (mod, stat) => `${mod}; ${stat}`,
  mods: {
    arc: ['Chispa', 'Los golpes saltan a enemigos cercanos'],
    bounce: ['Rebote', 'Rebota hacia otros enemigos'],
    burstOnKill: ['Estallido', 'Los enemigos derrotados explotan'],
    cruel: ['Cruel', '×1,35 a enemigos con estado'],
    drain: ['Drenaje', 'Cura parte del daño causado'],
    echo: ['Eco', 'Se repite con la mitad del daño'],
    execute: ['Golpe final', 'Derriba a quien queda con poca vida'],
    hunter: ['Cazador', '×1,5 a élites y jefes'],
    seek: ['Teledirigido', 'Persigue al enemigo más cercano'],
    split: ['División', 'Se parte en dos al acertar'],
    trail: ['Rastro', 'Deja un rastro dañino'],
  },
}

const frVocab: Vocab = {
  d: (n) => `+${n} dégâts`,
  a: (n) => `+${n}% de zone`,
  c: (n) => `recharge -${String(n).replace('.', ',')}s`,
  p: (n) => `+${n} perforation`,
  amt: (n) => `+${n} projectile${n === 1 ? '' : 's'}`,
  dur: (n) => `+${String(n).replace('.', ',')}s de durée`,
  and: (mod, stat) => `${mod} ; ${stat}`,
  mods: {
    arc: ['Étincelle', 'Les coups sautent vers les ennemis proches'],
    bounce: ['Ricochet', 'Rebondit vers d’autres ennemis'],
    burstOnKill: ['Explosion', 'Les ennemis vaincus explosent'],
    cruel: ['Cruel', '×1,35 sur les ennemis affectés'],
    drain: ['Drain', 'Soigne une part des dégâts infligés'],
    echo: ['Écho', 'Se répète à moitié des dégâts'],
    execute: ['Coup final', 'Achève ceux qui ont peu de PV'],
    hunter: ['Chasseur', '×1,5 sur élites et boss'],
    seek: ['Autoguidé', 'Poursuit l’ennemi le plus proche'],
    split: ['Division', 'Se scinde en deux à l’impact'],
    trail: ['Traînée', 'Laisse une traînée nocive'],
  },
}

const zhVocab: Vocab = {
  d: (n) => `傷害+${n}`,
  a: (n) => `範圍+${n}%`,
  c: (n) => `冷卻-${n}秒`,
  p: (n) => `穿透+${n}`,
  amt: (n) => `投射物+${n}`,
  dur: (n) => `持續+${n}秒`,
  and: (mod, stat) => `${mod}；${stat}`,
  mods: {
    arc: ['電弧', '攻擊會跳到附近敵人'],
    bounce: ['彈射', '會彈向其他敵人'],
    burstOnKill: ['爆裂', '被擊倒的敵人會爆炸'],
    cruel: ['殘酷', '對異常狀態敵人×1.35'],
    drain: ['吸取', '回復部分造成的傷害'],
    echo: ['回音', '以一半傷害再發動一次'],
    execute: ['終結', '擊倒殘血的敵人'],
    hunter: ['獵人', '對菁英與頭目×1.5'],
    seek: ['追蹤', '追擊最近的敵人'],
    split: ['分裂', '命中時一分為二'],
    trail: ['軌跡', '留下有害的軌跡'],
  },
}

export const SEASON_ONE_KITS_WORDS = {
  pt: {
    blurbs: {
      mankey: 'Cada golpe recebido o enfurece: mais dano e velocidade, que somem se ninguém o acertar.',
      pawniard: 'Cada chefe derrotado na partida soma poder. Até 6 acúmulos.',
      goomy: 'Deixa um rastro de gosma que desacelera os inimigos e o cura um pouco.',
      wishiwashi: 'Pequeno e frágil. Encha o Cardume com derrotas e vire um cardume enorme por alguns segundos.',
      tandemaus: 'Solta ratinhos que correm, mordem e atraem os inimigos para longe de você.',
      finizen: 'Como Palafin, o primeiro desmaio vira a Forma Herói, uma vez por partida.',
      morpeko: 'A cada poucos segundos troca entre Elétrico e Sombrio. Aura Wheel muda junto.',
      rotom: 'O especial troca de aparelho, e cada um muda o tipo e o jeito de Discharge.',
      castform: 'Muda de forma com o clima, e Forecast muda de tipo e efeito junto.',
      darumaka: 'Abaixo de 50% de HP entra em Modo Zen: mais lento, com mais defesa e um orbe psíquico.',
      wimpod: 'Ao cair abaixo da metade do HP, foge num disparo. Recarga longa.',
      mimikyu: 'O Disfarce bloqueia um golpe e volta depois de um bom tempo.',
      tatsugiri: 'Encha o Comando com derrotas e entre em Dondozo para alguns segundos de ataques pesados.',
    },
    moves: movesOf(ptVocab, {
      crossChop: 'Dois golpes cruzados em frente, curtos e fortes.',
      nightSlash: 'Um corte largo que fere mais os chefes.',
      dragonPulse: 'Um anel de energia dracônica se expande ao redor. A gosma do seu rastro também conta como este golpe.',
      waterPulse: 'Um pulso de água pequeno. Em Cardume, lança um anel inteiro.',
      populationBomb: 'Solta ratinhos que perseguem os inimigos e os atraem. Até 5 de uma vez.',
      jetPunch: 'Um soco d’água que o leva ao inimigo mais próximo, com um instante de invencibilidade.',
      auraWheel: 'Normal: rodas rápidas que podem paralisar. Faminto: uma roda Sombria mais lenta e mais forte.',
      discharge: 'O aparelho decide: chamas em cone, água em círculo, gelo em leque, vento ao redor ou lâminas que voltam.',
      forecast: 'Uma bola que segue o clima: Fogo no sol, Água na chuva, Gelo na neve, Pedra na areia, Fantasma na névoa.',
      firePunch: 'Um soco em chamas à sua frente que pode queimar.',
      xScissor: 'Duas garras cruzadas, rápidas e curtas.',
      shadowClaw: 'Uma garra de sombra larga à sua frente.',
      orderUp: 'Uma onda dracônica à frente, bem mais forte dentro de Dondozo.',
    }),
    abilities: {},
  },
  en: {
    blurbs: {
      mankey: 'Every hit it takes makes it angrier: more damage and speed, fading if nothing lands on it.',
      pawniard: 'Every boss beaten this run adds power, up to 6 stacks.',
      goomy: 'Leaves a trail of slime that slows foes and heals it a little.',
      wishiwashi: 'Tiny and frail. Fill the School meter with kills to become a huge school for a few seconds.',
      tandemaus: 'Sends out little mice that run, bite and pull foes away from you.',
      finizen: 'As Palafin, its first faint becomes the Hero Forme, once a run.',
      morpeko: 'Swaps between Electric and Dark every few seconds. Aura Wheel changes with it.',
      rotom: 'The special swaps its appliance, and each one changes Discharge’s type and shape.',
      castform: 'Changes form with the weather, and Forecast’s type and effect follow.',
      darumaka: 'Below 50% HP it enters Zen Mode: slower, tougher, with a slow psychic orb.',
      wimpod: 'Dropping under half HP sends it dashing away. Long cooldown.',
      mimikyu: 'Its Disguise blocks one hit and comes back after a long while.',
      tatsugiri: 'Fill Commander with kills and dive into Dondozo for a few seconds of heavy attacks.',
    },
    moves: movesOf(enVocab, {
      crossChop: 'Two crossed chops in front, short and strong.',
      nightSlash: 'A wide cut that bites deeper into bosses.',
      dragonPulse: 'A ring of dragon energy spreads around you. Your slime trail counts as this move too.',
      waterPulse: 'A small water pulse. As a School, it throws a whole ring.',
      populationBomb: 'Sends out mice that chase foes and draw them in. Up to 5 at once.',
      jetPunch: 'A water punch that carries you to the nearest foe, briefly untouchable.',
      auraWheel: 'Full Belly: fast wheels that can paralyze. Hangry: a slower, harder Dark wheel.',
      discharge: 'The appliance decides: a flame cone, a water ring, an ice fan, wind around you or returning blades.',
      forecast: 'A ball that follows the weather: Fire in sun, Water in rain, Ice in snow, Rock in sand, Ghost in fog.',
      firePunch: 'A burning punch in front of you that can burn.',
      xScissor: 'Two crossed claws, quick and short.',
      shadowClaw: 'A wide claw of shadow in front of you.',
      orderUp: 'A dragon wave ahead, far stronger from inside Dondozo.',
    }),
    abilities: {},
  },
  es: {
    blurbs: {
      mankey: 'Cada golpe que recibe lo enfurece: más daño y velocidad, que se pierden si nadie lo toca.',
      pawniard: 'Cada jefe derrotado en la partida suma poder, hasta 6 acumulaciones.',
      goomy: 'Deja un rastro de baba que frena a los enemigos y lo cura un poco.',
      wishiwashi: 'Pequeño y frágil. Llena el Banco con derrotas para volverte un cardumen enorme unos segundos.',
      tandemaus: 'Suelta ratoncitos que corren, muerden y alejan a los enemigos de ti.',
      finizen: 'Como Palafin, su primer desmayo se vuelve la Forma Heroica, una vez por partida.',
      morpeko: 'Cada pocos segundos alterna entre Eléctrico y Siniestro. Aura Wheel cambia con él.',
      rotom: 'El especial cambia de aparato, y cada uno cambia el tipo y la forma de Discharge.',
      castform: 'Cambia de forma con el clima, y Forecast cambia de tipo y efecto.',
      darumaka: 'Por debajo del 50% de PS entra en Modo Zen: más lento, más duro y con un orbe psíquico.',
      wimpod: 'Al caer por debajo de la mitad de PS huye de un salto. Recarga larga.',
      mimikyu: 'Su Disfraz bloquea un golpe y vuelve tras un buen rato.',
      tatsugiri: 'Llena el Mando con derrotas y entra en Dondozo para unos segundos de ataques pesados.',
    },
    moves: movesOf(esVocab, {
      crossChop: 'Dos golpes cruzados al frente, cortos y fuertes.',
      nightSlash: 'Un corte ancho que hiere más a los jefes.',
      dragonPulse: 'Un anillo de energía dragón se expande a tu alrededor. Tu rastro de baba también cuenta como este movimiento.',
      waterPulse: 'Un pequeño pulso de agua. En banco, lanza un anillo entero.',
      populationBomb: 'Suelta ratones que persiguen a los enemigos y los atraen. Hasta 5 a la vez.',
      jetPunch: 'Un puñetazo de agua que te lleva al enemigo más cercano, con un instante de invencibilidad.',
      auraWheel: 'Normal: ruedas rápidas que pueden paralizar. Hambriento: una rueda Siniestra más lenta y fuerte.',
      discharge: 'El aparato decide: un cono de llamas, un anillo de agua, un abanico de hielo, viento alrededor o cuchillas que vuelven.',
      forecast: 'Una bola que sigue el clima: Fuego al sol, Agua con lluvia, Hielo con nieve, Roca en arena, Fantasma con niebla.',
      firePunch: 'Un puñetazo en llamas frente a ti que puede quemar.',
      xScissor: 'Dos garras cruzadas, rápidas y cortas.',
      shadowClaw: 'Una garra de sombra ancha frente a ti.',
      orderUp: 'Una ola dragón al frente, mucho más fuerte desde dentro de Dondozo.',
    }),
    abilities: {},
  },
  fr: {
    blurbs: {
      mankey: 'Chaque coup reçu le met en rage : plus de dégâts et de vitesse, qui retombent s’il n’est plus touché.',
      pawniard: 'Chaque boss vaincu dans la partie ajoute de la puissance, jusqu’à 6 cumuls.',
      goomy: 'Laisse une traînée de bave qui ralentit les ennemis et le soigne un peu.',
      wishiwashi: 'Petit et fragile. Remplis le Banc avec des victoires pour devenir un immense banc quelques secondes.',
      tandemaus: 'Lâche de petites souris qui courent, mordent et éloignent les ennemis de toi.',
      finizen: 'En Palafin, son premier K.O. devient la Forme Héros, une fois par partie.',
      morpeko: 'Alterne entre Électrik et Ténèbres toutes les quelques secondes. Aura Wheel change avec lui.',
      rotom: 'L’attaque spéciale change d’appareil, et chacun change le type et la forme de Discharge.',
      castform: 'Change de forme avec la météo, et Forecast change de type et d’effet.',
      darumaka: 'Sous 50 % de PV, il entre en Mode Transe : plus lent, plus résistant, avec un orbe psychique.',
      wimpod: 'En passant sous la moitié de ses PV, il s’enfuit d’un bond. Longue recharge.',
      mimikyu: 'Son Déguisement bloque un coup et revient après un long moment.',
      tatsugiri: 'Remplis le Commandement avec des victoires et entre dans Dondozo pour quelques secondes d’attaques lourdes.',
    },
    moves: movesOf(frVocab, {
      crossChop: 'Deux coups croisés devant toi, courts et puissants.',
      nightSlash: 'Une large entaille qui blesse davantage les boss.',
      dragonPulse: 'Un anneau d’énergie draconique se propage autour de toi. Ta traînée de bave compte aussi comme cette capacité.',
      waterPulse: 'Une petite onde d’eau. En banc, elle en lance tout un anneau.',
      populationBomb: 'Lâche des souris qui poursuivent les ennemis et les attirent. Jusqu’à 5 à la fois.',
      jetPunch: 'Un coup d’eau qui te porte vers l’ennemi le plus proche, intouchable un instant.',
      auraWheel: 'Normal : des roues rapides qui peuvent paralyser. Affamé : une roue Ténèbres plus lente et plus forte.',
      discharge: 'L’appareil décide : un cône de flammes, un anneau d’eau, un éventail de glace, du vent autour de toi ou des lames qui reviennent.',
      forecast: 'Une boule qui suit la météo : Feu au soleil, Eau sous la pluie, Glace sous la neige, Roche dans le sable, Spectre dans le brouillard.',
      firePunch: 'Un coup enflammé devant toi qui peut brûler.',
      xScissor: 'Deux griffes croisées, rapides et courtes.',
      shadowClaw: 'Une large griffe d’ombre devant toi.',
      orderUp: 'Une vague draconique devant toi, bien plus forte depuis Dondozo.',
    }),
    abilities: {},
  },
  zh: {
    blurbs: {
      mankey: '每次受傷都會發怒：傷害與速度提升，一段時間沒被打中就會消退。',
      pawniard: '本局每擊敗一隻頭目就會變強，最多疊加6層。',
      goomy: '留下黏液軌跡，使敵人減速並回復自身些許體力。',
      wishiwashi: '又小又脆弱。靠擊倒累積魚群量表，就能變成巨大魚群幾秒鐘。',
      tandemaus: '放出小老鼠，奔跑、撕咬並把敵人引離你身邊。',
      finizen: '進化成 Palafin 後，第一次倒下會化為英雄形態，每局一次。',
      morpeko: '每隔幾秒在電與惡屬性間切換，Aura Wheel 也隨之改變。',
      rotom: '必殺技切換家電，每種都會改變 Discharge 的屬性與形態。',
      castform: '形態隨天氣變化，Forecast 的屬性與效果也會跟著改變。',
      darumaka: '體力低於50%時進入禪模式：較慢、較硬，並有緩慢的超能光球。',
      wimpod: '體力跌破一半時立刻衝刺逃離，冷卻時間很長。',
      mimikyu: '偽裝能擋下一次攻擊，隔一段時間才會恢復。',
      tatsugiri: '靠擊倒累積指揮量表，鑽進 Dondozo 體內發動幾秒重攻擊。',
    },
    moves: movesOf(zhVocab, {
      crossChop: '向前交叉劈砍兩次，距離短但威力強。',
      nightSlash: '大範圍斬擊，對頭目傷害更高。',
      dragonPulse: '龍之能量環向四周擴散，你的黏液軌跡也算這招。',
      waterPulse: '小小的水之波動。魚群形態時會發射一整圈。',
      populationBomb: '放出老鼠追擊並吸引敵人，最多同時5隻。',
      jetPunch: '水之拳帶你衝向最近的敵人，短暫無敵。',
      auraWheel: '滿腹時是可能麻痺的快速輪；空腹時是較慢但更強的惡屬性輪。',
      discharge: '依家電不同：火焰錐、水環、冰扇、環繞之風或回力刃。',
      forecast: '隨天氣改變的球：晴天火、雨天水、下雪冰、沙暴岩、起霧幽靈。',
      firePunch: '在身前揮出可能灼傷的火焰拳。',
      xScissor: '快速而短距的交叉雙爪。',
      shadowClaw: '在身前揮出大範圍的影爪。',
      orderUp: '向前的龍之波，在 Dondozo 體內時威力大增。',
    }),
    abilities: {},
  },
}
