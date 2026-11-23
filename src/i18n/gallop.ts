import { enVocab, esVocab, fork, frVocab, ptVocab, zhVocab, type Vocab } from './seasonOne/kits'

/**
 * Ponyta's gallop batch's words (`game/gallopMoves.ts`), a table per language
 * (`pt` is the reference). The level-up lines are built from the moves'
 * steps, so all five stay in step with the numbers; each language adds the
 * few units the shared vocabulary doesn't have.
 */

/** A language's units beyond `Vocab`: eruptions and hops, a status's odds, and joining two stats. */
type Units = {
  erupt: (n: number) => string
  hop: (n: number) => string
  odds: (n: number, status: 'trip' | 'paralysis' | 'confuse') => string
  both: (a: string, b: string) => string
}

const PT: Units = {
  erupt: (n) => `+${n} ${n === 1 ? 'erupção' : 'erupções'}`,
  hop: (n) => `+${n} ${n === 1 ? 'salto' : 'saltos'}`,
  odds: (n, s) => `+${n}% de chance de ${s === 'trip' ? 'derrubar' : s === 'paralysis' ? 'paralisar' : 'confundir'}`,
  both: (a, b) => `${a} e ${b}`,
}
const EN: Units = {
  erupt: (n) => `+${n} eruption${n === 1 ? '' : 's'}`,
  hop: (n) => `+${n} hop${n === 1 ? '' : 's'}`,
  odds: (n, s) => `+${n}% ${s === 'trip' ? 'trip' : s === 'paralysis' ? 'paralysis' : 'confusion'} chance`,
  both: (a, b) => `${a} and ${b}`,
}
const ES: Units = {
  erupt: (n) => `+${n} ${n === 1 ? 'erupción' : 'erupciones'}`,
  hop: (n) => `+${n} ${n === 1 ? 'salto' : 'saltos'}`,
  odds: (n, s) => `+${n}% de probabilidad de ${s === 'trip' ? 'derribar' : s === 'paralysis' ? 'paralizar' : 'confundir'}`,
  both: (a, b) => `${a} y ${b}`,
}
const FR: Units = {
  erupt: (n) => `+${n} éruption${n === 1 ? '' : 's'}`,
  hop: (n) => `+${n} bond${n === 1 ? '' : 's'}`,
  odds: (n, s) => `+${n}% de chances de ${s === 'trip' ? 'faire chuter' : s === 'paralysis' ? 'paralyser' : 'rendre confus'}`,
  both: (a, b) => `${a} et ${b}`,
}
const ZH: Units = {
  erupt: (n) => `噴發+${n}`,
  hop: (n) => `跳躍+${n}`,
  odds: (n, s) => `${s === 'trip' ? '絆倒' : s === 'paralysis' ? '麻痺' : '混亂'}機率+${n}%`,
  both: (a, b) => `${a}，${b}`,
}

/** The level-up lines, step by step as in `gallopMoves.ts` (forks at Lv 4 and Lv 7; the evolutions' four steps). */
const stepLines = (v: Vocab, u: Units) => ({
  highHorsepower: [v.d(4), u.erupt(1), fork(v, ['burstOnKill', v.d(4)], ['trail', v.c(0.3)]), v.d(5), u.both(v.a(20), v.c(0.2)), fork(v, ['hunter', v.d(6)], ['echo', u.erupt(1)]), u.both(v.d(7), u.erupt(1))],
  lowKick: [v.d(3), v.a(15), fork(v, ['burstOnKill', v.d(3)], ['arc', v.c(0.25)]), v.d(4), u.both(v.c(0.2), u.odds(15, 'trip')), fork(v, ['hunter', v.d(5)], ['echo', v.a(20)]), u.both(v.d(6), v.a(15))],
  hornDrill: [v.d(4), v.c(0.3), fork(v, ['burstOnKill', v.d(4)], ['cruel', v.c(0.4)]), v.d(5), v.c(0.3), fork(v, ['hunter', v.d(7)], ['echo', v.d(2)]), v.d(7)],
  morningSun: [v.d(3), v.c(0.5), fork(v, ['burstOnKill', v.a(25)], ['drain', v.c(0.8)]), v.d(4), u.both(v.c(0.5), v.a(15)), fork(v, ['cruel', v.d(6)], ['arc', v.a(20)]), u.both(v.d(6), v.c(0.4))],
  bounce: [v.d(3), u.hop(1), fork(v, ['burstOnKill', v.d(3)], ['trail', v.a(20)]), v.d(4), u.both(v.c(0.3), u.odds(10, 'paralysis')), fork(v, ['hunter', v.d(5)], ['arc', u.hop(1)]), u.both(v.d(5), v.a(15))],
  headlongRush: [v.d(7), u.erupt(1), u.both(v.a(20), v.c(0.2)), u.both(v.d(9), u.erupt(1))],
  axeKick: [v.d(10), v.a(20), u.both(v.c(0.3), u.odds(15, 'confuse')), u.both(v.d(14), v.a(15))],
  hyperDrill: [v.d(7), v.c(0.3), u.both(v.a(25), v.d(5)), u.both(v.d(10), v.c(0.3))],
  revivalBlessing: [v.d(5), v.c(0.5), u.both(v.a(20), v.d(4)), u.both(v.d(8), v.c(0.5))],
  skyDrop: [v.d(5), u.hop(1), u.both(v.a(20), u.odds(10, 'paralysis')), u.both(v.d(8), v.c(0.3))],
}) as const

type Lines = ReturnType<typeof stepLines>
type Descriptions = Record<keyof Lines, string>

const movesOf = (v: Vocab, u: Units, text: Descriptions) => {
  const lines = stepLines(v, u)
  return {
    highHorsepower: { description: text.highHorsepower, upgrades: lines.highHorsepower },
    lowKick: { description: text.lowKick, upgrades: lines.lowKick },
    hornDrill: { description: text.hornDrill, upgrades: lines.hornDrill },
    morningSun: { description: text.morningSun, upgrades: lines.morningSun },
    bounce: { description: text.bounce, upgrades: lines.bounce },
    headlongRush: { description: text.headlongRush, upgrades: lines.headlongRush },
    axeKick: { description: text.axeKick, upgrades: lines.axeKick },
    hyperDrill: { description: text.hyperDrill, upgrades: lines.hyperDrill },
    revivalBlessing: { description: text.revivalBlessing, upgrades: lines.revivalBlessing },
    skyDrop: { description: text.skyDrop, upgrades: lines.skyDrop },
  } as const
}

export const GALLOP_WORDS = {
  pt: movesOf(ptVocab, PT, {
    highHorsepower: 'Os cascos rasgam o chão: uma linha de terra explode rumo ao inimigo mais próximo e arremessa quem está nela. Quanto mais você correu desde o último golpe, mais forte ela sai; parado, sai fraca.',
    lowKick: 'Uma rasteira baixa à sua frente que derruba e desacelera. Quanto mais pesado o alvo, mais dói: Pokémon grandes e chefes levam bem mais.',
    hornDrill: 'O chifre gira e perfura o inimigo mais duro por perto e, num instante, dá o golpe final: quem fica fraco cai na hora. Chefes levam um golpe pesado.',
    morningSun: 'Um sol nasce sobre a cabeça e cura conforme o céu da partida: muito no sol, metade no céu limpo, pouco na chuva, areia, neve ou névoa. O halo queima quem está perto. A cura cresce com o nível.',
    bounce: 'Uma série de saltos: cada aterrissagem solta um anel de choque que pode paralisar, maior a cada vez. Os saltos vão com você enquanto corre.',
    headlongRush: 'Três linhas de terra em leque viram pilares de pedra que ficam e batem de novo. Quanto mais você correu, mais fortes; uma carga cheia ainda acelera o galope.',
    axeKick: 'O calcanhar desce sobre o inimigo mais pesado ao alcance, com aviso no chão, e solta uma onda de choque. Pesa como a Low Kick e pode confundir.',
    hyperDrill: 'Perfura mais rápido, atravessando qualquer proteção, e a broca segue como uma lança através do inimigo, derrubando os fracos que atravessa.',
    revivalBlessing: 'Uma cura maior conforme o céu; o que não cabe na vida vira uma explosão de luz do sol. Com a vida cheia, é um ataque.',
    skyDrop: 'Os saltos e, no fim, um mergulho do alto sobre a maior multidão ao alcance, puxada para o impacto. Pode paralisar.',
  }),
  en: movesOf(enVocab, EN, {
    highHorsepower: 'The hooves tear up the ground: a line of earth erupts toward the nearest foe and throws whoever stands in it. The more you ran since the last cast, the harder it hits; standing still, it comes out weak.',
    lowKick: 'A low sweep in front of you that trips and slows. The heavier the target, the more it hurts: big Pokémon and bosses take much more.',
    hornDrill: 'The horn spins into the toughest foe nearby and, a moment later, lands the finishing blow: whatever is left weak falls outright. Bosses take a heavy hit.',
    morningSun: 'A sun rises over your head and heals by the run’s sky: a lot in the sun, half under a clear sky, little in rain, sand, snow or fog. Its halo scorches whoever is close. The heal grows with its level.',
    bounce: 'A run of hops: each landing sends out a shock ring that may paralyze, wider every time. The hops come along as you run.',
    headlongRush: 'Three fanned lines of earth become stone pillars that stay and hit again. The more you ran, the stronger; a full charge also spurs your gallop.',
    axeKick: 'The heel comes down on the heaviest foe in reach, with a warning on the ground, and sends out a shockwave. Heavy like Low Kick, and may confuse.',
    hyperDrill: 'Bores in faster, through any protection, then the drill goes on as a lance through the foe, felling the weak ones it pierces.',
    revivalBlessing: 'A bigger heal by the sky; whatever doesn’t fit under your max HP bursts out as sunlight. At full health, it’s an attack.',
    skyDrop: 'The hops, then a dive from on high onto the thickest crowd in reach, dragged into the impact. May paralyze.',
  }),
  es: movesOf(esVocab, ES, {
    highHorsepower: 'Los cascos rasgan el suelo: una línea de tierra estalla hacia el enemigo más cercano y lanza a quien esté en ella. Cuanto más corriste desde el último golpe, más fuerte sale; quieto, sale débil.',
    lowKick: 'Una barrida baja frente a ti que derriba y ralentiza. Cuanto más pesado el objetivo, más duele: los Pokémon grandes y los jefes reciben mucho más.',
    hornDrill: 'El cuerno gira y perfora al enemigo más duro cercano y, un instante después, da el golpe final: lo que quede débil cae al momento. Los jefes reciben un golpe fuerte.',
    morningSun: 'Un sol sale sobre tu cabeza y cura según el cielo de la partida: mucho con sol, la mitad con cielo despejado, poco con lluvia, arena, nieve o niebla. El halo quema a quien esté cerca. La curación crece con el nivel.',
    bounce: 'Una serie de saltos: cada aterrizaje suelta un anillo de choque que puede paralizar, más grande cada vez. Los saltos te siguen mientras corres.',
    headlongRush: 'Tres líneas de tierra en abanico se vuelven pilares de piedra que se quedan y golpean de nuevo. Cuanto más corriste, más fuertes; una carga llena además acelera el galope.',
    axeKick: 'El talón cae sobre el enemigo más pesado a tu alcance, con aviso en el suelo, y suelta una onda de choque. Pesa como Low Kick y puede confundir.',
    hyperDrill: 'Perfora más rápido, atravesando cualquier protección, y la broca sigue como una lanza a través del enemigo, derribando a los débiles que atraviesa.',
    revivalBlessing: 'Una curación mayor según el cielo; lo que no cabe en tu vida estalla como luz solar. Con la vida llena, es un ataque.',
    skyDrop: 'Los saltos y, al final, un picado desde lo alto sobre la multitud más densa a tu alcance, arrastrada al impacto. Puede paralizar.',
  }),
  fr: movesOf(frVocab, FR, {
    highHorsepower: 'Les sabots déchirent le sol : une ligne de terre jaillit vers l’ennemi le plus proche et projette ceux qui s’y trouvent. Plus vous avez couru depuis la dernière fois, plus elle frappe fort ; à l’arrêt, elle reste faible.',
    lowKick: 'Un balayage bas devant vous qui fait chuter et ralentit. Plus la cible est lourde, plus ça fait mal : les gros Pokémon et les boss encaissent bien plus.',
    hornDrill: 'La corne tourne et transperce l’ennemi le plus coriace à proximité puis, un instant plus tard, porte le coup de grâce : ce qui reste affaibli tombe sur le coup. Les boss encaissent un coup lourd.',
    morningSun: 'Un soleil se lève au-dessus de votre tête et soigne selon le ciel de la partie : beaucoup au soleil, moitié moins par ciel clair, peu sous la pluie, le sable, la neige ou le brouillard. Son halo brûle ceux qui sont proches. Le soin grandit avec le niveau.',
    bounce: 'Une série de bonds : chaque atterrissage libère un anneau de choc qui peut paralyser, plus large à chaque fois. Les bonds vous suivent pendant que vous courez.',
    headlongRush: 'Trois lignes de terre en éventail deviennent des piliers de pierre qui restent et frappent encore. Plus vous avez couru, plus elles sont fortes ; une charge pleine accélère aussi votre galop.',
    axeKick: 'Le talon s’abat sur l’ennemi le plus lourd à portée, annoncé au sol, et libère une onde de choc. Lourd comme Low Kick, et peut rendre confus.',
    hyperDrill: 'Perce plus vite, à travers toute protection, puis la foreuse continue comme une lance à travers l’ennemi, abattant les faibles qu’elle transperce.',
    revivalBlessing: 'Un soin plus grand selon le ciel ; ce qui dépasse vos PV max jaillit en lumière solaire. En pleine santé, c’est une attaque.',
    skyDrop: 'Les bonds puis, à la fin, un piqué depuis les hauteurs sur la foule la plus dense à portée, entraînée dans l’impact. Peut paralyser.',
  }),
  zh: movesOf(zhVocab, ZH, {
    highHorsepower: '馬蹄撕裂地面：一道土石朝最近的敵人噴發，把站在上面的敵人拋飛。上次施放後跑得越遠，威力越強；站著不動時只會很弱。',
    lowKick: '在你面前低掃一腳，絆倒並使敵人減速。目標越重越痛：大型寶可夢和首領會受到多得多的傷害。',
    hornDrill: '角旋轉鑽進附近最強韌的敵人，片刻後給予致命一擊：剩下體力偏低的會當場倒下。首領會受到重擊。',
    morningSun: '太陽在你頭上升起，依照本局的天空回復：晴天回復很多，晴朗天空一半，下雨、沙暴、下雪或濃霧時很少。光環會灼傷附近的敵人。回復量隨等級成長。',
    bounce: '一連串跳躍：每次落地都會放出可能造成麻痺的震波環，一次比一次大。奔跑時跳躍會跟著你。',
    headlongRush: '三道扇形土石化為石柱，留在原地再次攻擊。跑得越遠越強；滿蓄力還會加快你的奔馳。',
    axeKick: '腳跟落在範圍內最重的敵人身上，地面會先出現警示，並放出震波。像 Low Kick 一樣重擊重型敵人，可能造成混亂。',
    hyperDrill: '鑽得更快並無視任何防護，之後鑽頭化為長槍貫穿敵人，擊倒沿途體力偏低的敵人。',
    revivalBlessing: '依照天空給予更大的回復；超出最大 HP 的部分會化為陽光爆發。滿血時就是一次攻擊。',
    skyDrop: '先是連續跳躍，最後從高空俯衝到範圍內最密集的敵群，把它們拉進衝擊中。可能造成麻痺。',
  }),
}
