import type { ModId } from '../game/mods'
import type { UpgradeStep } from '../game/moves'
import { SC_KIT_UPGRADES, type ScKitMoveId } from '../game/scKitUpgrades'
import type { ScFamilyId } from '../data/scFamilies'
import { enVocab, esVocab, fork, frVocab, ptVocab, zhVocab, type Vocab } from './seasonOne/kits'

/**
 * The Safári and Game Corner wave's words, a table per language (`pt` is the
 * reference): the new families' blurbs and signatures (the level-up lines
 * built from `game/scKitUpgrades.ts`'s numbers, so all five stay in step),
 * Manaphy and its Heart Swap, Mega Clefable, the habitat titles, the counter's
 * new prizes, the locked cards, the Safári board's exclusives and rewards, and
 * the Ovo de Manaphy's scene. Each language's file spreads its parts where
 * they belong. Pokémon and move names stay in English.
 */

type Mod = Parameters<typeof fork>[1][0]

const MODS: readonly ModId[] = ['arc', 'bounce', 'burstOnKill', 'cruel', 'drain', 'echo', 'execute', 'hunter', 'seek', 'split', 'trail']

const isMod = (m: ModId): m is Mod => MODS.includes(m)

type Stats = Partial<Record<'damage' | 'area' | 'cooldown' | 'pierce' | 'amount' | 'duration', number>>

/** One step's stat line, in the language's words. */
const statLine = (v: Vocab, s: Stats) =>
  [
    s.damage !== undefined && v.d(s.damage),
    s.amount !== undefined && v.amt(s.amount),
    s.pierce !== undefined && v.p(s.pierce),
    s.area !== undefined && v.a(Math.round(s.area * 100)),
    s.cooldown !== undefined && v.c(-s.cooldown),
    s.duration !== undefined && v.dur(s.duration),
  ].filter((x): x is string => typeof x === 'string').join(' · ')

type Fork = ReturnType<typeof fork>
type Lines = readonly [string, string, Fork, string, string, Fork, string]

const branchOf = (v: Vocab, b: { stats: Stats; mods?: readonly ModId[] }): readonly [Mod, string] => {
  const mod = b.mods?.find(isMod)
  if (!mod) throw new Error('every branch of the wave has a worded mod')
  return [mod, statLine(v, b.stats)]
}

/** The seven lines of a signature, forks at the third and sixth. */
const linesOf = (v: Vocab, id: ScKitMoveId): Lines => {
  const steps: readonly UpgradeStep[] = SC_KIT_UPGRADES[id]
  const out = steps.map((s) => ('fork' in s ? fork(v, branchOf(v, s.fork[0]), branchOf(v, s.fork[1])) : statLine(v, s)))
  const plain = (x: (typeof out)[number] | undefined) => {
    if (typeof x !== 'string') throw new Error(`${id}: a plain step is missing`)
    return x
  }
  const forked = (x: (typeof out)[number] | undefined) => {
    if (x === undefined || typeof x === 'string') throw new Error(`${id}: a fork is missing`)
    return x
  }
  return [plain(out[0]), plain(out[1]), forked(out[2]), plain(out[3]), plain(out[4]), forked(out[5]), plain(out[6])]
}

const IDS = Object.keys(SC_KIT_UPGRADES) as ScKitMoveId[]

type MoveText = { readonly description: string; readonly upgrades: Lines }
type LegendMoveText = { readonly description: string; readonly upgrades: readonly [string, string, Fork, string] }

const movesOf = (v: Vocab, text: Record<ScKitMoveId, string>) =>
  Object.fromEntries(IDS.map((id) => [id, { description: text[id], upgrades: linesOf(v, id) }])) as Record<ScKitMoveId, MoveText>

type CornerPrize = 'nidoranF' | 'nidoranM' | 'cleffa' | 'shadowNidoranF' | 'shadowNidoranM' | 'shadowCleffa'
type HabitatTitle = 'safariMeadow' | 'safariMarsh' | 'safariRidge' | 'safariCove'

type Words = {
  blurbs: Record<ScFamilyId | 'manaphy', string>
  moves: Record<ScKitMoveId, string>
  heartSwap: LegendMoveText
  megas: { clefable: string }
  titles: Record<HabitatTitle, string>
  giftTitles: Record<HabitatTitle, string>
  prizes: Record<CornerPrize, string>
  prizeBlurbs: Record<'nidoranF' | 'nidoranM' | 'cleffa', string>
  /** The partner select's locked card: where the family comes from. */
  where: Record<ScFamilyId, string>
  /** Where Manaphy comes from (`LegendSource` `egg`). */
  legendWhere: string
  /** The Safári board's Exclusivos tab and the booth's line (`realm/games/safari.ts`). */
  safari: {
    tab: string
    title: string
    intro: string
    thisWeek: string
    inWeeks: (n: number) => string
    have: (n: number, total: number) => string
    owned: string
    missing: string
    gated: string
    rewardHead: string
    ultraEgg: string
    title_: (name: string) => string
    shiny: (name: string) => string
    manaphyEgg: string
    done: string
    /** A habitat whose Pokédex was completed before new exclusives moved in: it stays complete, and they're only missing from the collection. */
    doneBefore: string
    lacking: (n: number, names: string) => string
    allHere: string
    boost: string
  }
  /** The Ovo de Manaphy: its gift box line and its hatching scene (`ui/manaphyEgg.ts`). */
  egg: {
    name: string
    gift: string
    hatching: string
    glow: string
    hatched: string
    note: string
    play: string
    ok: string
    skip: string
  }
}

const wordsOf = (v: Vocab, w: Omit<Words, 'moves'> & { moves: Record<ScKitMoveId, string> }) => ({ ...w, moves: { ...movesOf(v, w.moves), heartSwap: w.heartSwap } })

const CORNER_WHERE = {
  pt: 'Prêmio do balcão do Game Corner da Equipe Rocket, no Poké Realm.',
  en: 'A prize at Team Rocket’s Game Corner counter, in the Poké Realm.',
  es: 'Premio del mostrador del Game Corner del Team Rocket, en el Poké Realm.',
  fr: 'Un lot du comptoir du Game Corner de la Team Rocket, dans le Poké Realm.',
  zh: '火箭隊遊戲城兌獎櫃台的獎品，在 Poké Realm。',
} as const

const pt = wordsOf(ptVocab, {
  blurbs: {
    nidoranF: 'Poison Point: de tempos em tempos, e logo depois de levar um golpe, solta um anel de espinhos venenosos. Nidoqueen fica mais resistente a cada inimigo envenenado por perto, e Sludge fere em dobro quem está envenenado.',
    nidoranM: 'Abaixa o chifre e investe pela horda de tempos em tempos, invencível no caminho, envenenando quem atravessa. A investida do Nidoking termina num tremor.',
    cleffa: 'A lua cresce sobre a cabeça com o tempo e a cada derrota. Na lua cheia caem raios de luar, os golpes Fada ficam mais fortes e Moonlight cura. Tem Mega (Clefable).',
    phione: 'Corrente morna: andar enche a corrente e bolhas giram em volta, acertando quem encosta. Parado, as bolhas estouram num jorro que cura. Dive sai maior com a corrente cheia.',
    manaphy: 'O Príncipe do Mar: Heart Swap rouba a força dos inimigos para Manaphy. Nasce do Ovo de Manaphy, prêmio da Pokédex da Baía Gelada.',
  },
  moves: {
    sludge: 'Joga bolas de lodo nos inimigos mais próximos, que espirram ao cair. Fere em dobro quem está envenenado.',
    furyAttack: 'O chifre golpeia à frente várias vezes seguidas, um pouco para cada lado.',
    moonlight: 'Raios de luar caem sobre os inimigos por perto. Na lua cheia cai mais um, e cada acerto cura um pouco.',
    dive: 'Mergulha por um instante (fica invencível) e gêiseres explodem embaixo dos inimigos mais próximos. Com a corrente cheia, saem maiores.',
  },
  heartSwap: {
    description: 'Corações saem de um anel em volta de Manaphy e perseguem os inimigos. Cada um que acerta enfraquece o inimigo (o toque dele fere menos) e aumenta seus golpes em 12% por 3 s.',
    upgrades: [
      '+7 de dano',
      '+2 corações',
      { fork: [{ name: 'Encanto', desc: 'Os corações deixam o inimigo confuso; +4 de dano' }, { name: 'Coração gentil', desc: 'Cada coração cura 1% da sua vida; +2 corações' }] },
      'Recarga 0.35s mais rápida e +7 de dano',
    ],
  },
  megas: { clefable: 'golpes +25%, HP +40, regeneração alta e golpes Fada +25%. O especial vira Moonblast.' },
  titles: { safariMeadow: 'Naturalista da Campina', safariMarsh: 'Vigia do Brejo', safariRidge: 'Desbravador da Serra', safariCove: 'Guardião da Baía' },
  giftTitles: {
    safariMeadow: 'Completou a Pokédex da Campina Dourada na Zona Safári',
    safariMarsh: 'Completou a Pokédex do Brejo Sombrio na Zona Safári',
    safariRidge: 'Completou a Pokédex da Serra Trovejante na Zona Safári',
    safariCove: 'Completou a Pokédex da Baía Gelada na Zona Safári',
  },
  prizes: { nidoranF: 'Nidoran♀', nidoranM: 'Nidoran♂', cleffa: 'Cleffa', shadowNidoranF: 'Nidoran♀ Sombrio', shadowNidoranM: 'Nidoran♂ Sombrio', shadowCleffa: 'Cleffa Sombrio' },
  prizeBlurbs: {
    nidoranF: 'Anel de espinhos venenosos. Nidoqueen protege o chão.',
    nidoranM: 'Investe com o chifre pela horda. Nidoking faz tremer.',
    cleffa: 'A lua cheia ilumina o campo. Tem Mega Clefable.',
  },
  where: { nidoranF: CORNER_WHERE.pt, nidoranM: CORNER_WHERE.pt, cleffa: CORNER_WHERE.pt, phione: 'Só na *Zona Safári*, na semana da Baía Gelada, depois que *Manaphy* for seu: complete a Pokédex da Baía Gelada para ganhar o Ovo de Manaphy.' },
  legendWhere: 'Nasce do _Ovo de Manaphy_: complete a Pokédex da Baía Gelada na *Zona Safári* do Poké Realm.',
  safari: {
    tab: 'Exclusivos',
    title: 'Exclusivos do Safári',
    intro: 'Pokémon que nenhum ovo traz: só a Zona Safári. Os que faltam para você aparecem 2× mais.',
    thisWeek: 'Esta semana',
    inWeeks: (n) => (n === 1 ? 'Semana que vem' : `Em ${n} semanas`),
    have: (n, total) => `Seus: ${n}/${total}`,
    owned: 'Seu',
    missing: 'Falta',
    gated: 'Chega depois de Manaphy',
    rewardHead: 'Completar a Pokédex daqui dá:',
    ultraEgg: 'Ovo Ultra',
    title_: (name) => `título *${name}*`,
    shiny: (name) => `*${name}* shiny garantido`,
    manaphyEgg: '*Ovo de Manaphy*',
    done: 'Pokédex completa! Os prêmios foram para a sua caixa de presentes.',
    doneBefore: 'Pokédex completa antes dos exclusivos novos chegarem: ela continua completa e os prêmios já são seus. Os que faltam acima são só para a sua coleção.',
    lacking: (n, names) => (n === 1 ? `Exclusivo que falta aqui: ${names}.` : `${n} exclusivos que faltam aqui: ${names}.`),
    allHere: 'Você já tem todos os exclusivos daqui.',
    boost: '2× mais',
  },
  egg: {
    name: 'Ovo de Manaphy',
    gift: 'Ovo de Manaphy',
    hatching: 'O ovo pulsa como o mar...',
    glow: 'Uma luz quente brilha lá dentro!',
    hatched: '*Manaphy* nasceu!',
    note: 'Jogável no _Modo Lendário_. E Phione agora vive na Baía Gelada da Zona Safári.',
    play: 'Jogar com Manaphy',
    ok: 'OK',
    skip: 'Toque para pular',
  },
})

const en = wordsOf(enVocab, {
  blurbs: {
    nidoranF: 'Poison Point: now and then, and right after a hit taken, it sends out a ring of poison barbs. Nidoqueen toughens up for each poisoned foe nearby, and Sludge hits the poisoned twice as hard.',
    nidoranM: 'Now and then it lowers its horn and charges through the horde, invincible on the way, poisoning what it runs through. Nidoking’s charge ends in a quake.',
    cleffa: 'The moon over its head waxes with time and every KO. At the full moon, moonbeams fall, Fairy moves grow stronger and Moonlight heals. Has a Mega (Clefable).',
    phione: 'Warm current: walking fills the current and bubbles circle it, hitting what they touch. Standing still, the bubbles burst in a splash that heals. Dive comes out bigger on a full current.',
    manaphy: 'The Prince of the Sea: Heart Swap drains the foes’ strength into Manaphy. Hatches from the Manaphy Egg, the Frozen Cove Pokédex’s prize.',
  },
  moves: {
    sludge: 'Lobs globs of sludge at the nearest foes that splash where they land. Hits the poisoned twice as hard.',
    furyAttack: 'The horn jabs ahead again and again, a little to each side.',
    moonlight: 'Moonbeams fall on the foes around. Under a full moon one more falls, and every hit heals a little.',
    dive: 'Dips under for a moment (invincible) and geysers burst under the nearest foes. On a full current they come out bigger.',
  },
  heartSwap: {
    description: 'Hearts burst from a ring around Manaphy and home in on the foes. Each one that lands weakens the foe (its touch hurts less) and raises your damage by 12% for 3 s.',
    upgrades: [
      '+7 damage',
      '+2 hearts',
      { fork: [{ name: 'Charm', desc: 'The hearts leave the foe confused; +4 damage' }, { name: 'Gentle Heart', desc: 'Each heart heals 1% of your HP; +2 hearts' }] },
      '0.35s faster cooldown and +7 damage',
    ],
  },
  megas: { clefable: 'damage +25%, HP +40, strong regeneration and Fairy moves +25%. The special becomes Moonblast.' },
  titles: { safariMeadow: 'Meadow Naturalist', safariMarsh: 'Marsh Watcher', safariRidge: 'Ridge Trailblazer', safariCove: 'Cove Guardian' },
  giftTitles: {
    safariMeadow: 'Completed the Golden Meadow Pokédex in the Safari Zone',
    safariMarsh: 'Completed the Gloomy Marsh Pokédex in the Safari Zone',
    safariRidge: 'Completed the Thunder Ridge Pokédex in the Safari Zone',
    safariCove: 'Completed the Frozen Cove Pokédex in the Safari Zone',
  },
  prizes: { nidoranF: 'Nidoran♀', nidoranM: 'Nidoran♂', cleffa: 'Cleffa', shadowNidoranF: 'Shadow Nidoran♀', shadowNidoranM: 'Shadow Nidoran♂', shadowCleffa: 'Shadow Cleffa' },
  prizeBlurbs: {
    nidoranF: 'A ring of poison barbs. Nidoqueen holds her ground.',
    nidoranM: 'Charges through the horde horn first. Nidoking shakes the ground.',
    cleffa: 'The full moon lights the field. Has Mega Clefable.',
  },
  where: { nidoranF: CORNER_WHERE.en, nidoranM: CORNER_WHERE.en, cleffa: CORNER_WHERE.en, phione: 'Only in the *Safari Zone*, on the Frozen Cove’s week, once *Manaphy* is yours: complete the Frozen Cove Pokédex to earn the Manaphy Egg.' },
  legendWhere: 'Hatches from the _Manaphy Egg_: complete the Frozen Cove Pokédex in the Poké Realm’s *Safari Zone*.',
  safari: {
    tab: 'Exclusives',
    title: 'Safari exclusives',
    intro: 'Pokémon no egg brings: only the Safari Zone. The ones you lack show up 2× as often.',
    thisWeek: 'This week',
    inWeeks: (n) => (n === 1 ? 'Next week' : `In ${n} weeks`),
    have: (n, total) => `Yours: ${n}/${total}`,
    owned: 'Yours',
    missing: 'Missing',
    gated: 'Comes after Manaphy',
    rewardHead: 'Completing this Pokédex gives:',
    ultraEgg: 'Ultra Egg',
    title_: (name) => `the *${name}* title`,
    shiny: (name) => `a sure shiny *${name}*`,
    manaphyEgg: 'the *Manaphy Egg*',
    done: 'Pokédex complete! The prizes went to your gift box.',
    doneBefore: 'Pokédex completed before the new exclusives arrived: it stays complete and its prizes are yours. The ones missing above are for your collection only.',
    lacking: (n, names) => (n === 1 ? `Exclusive you lack here: ${names}.` : `${n} exclusives you lack here: ${names}.`),
    allHere: 'You have every exclusive here.',
    boost: '2× as often',
  },
  egg: {
    name: 'Manaphy Egg',
    gift: 'Manaphy Egg',
    hatching: 'The egg pulses like the sea...',
    glow: 'A warm light glows inside!',
    hatched: '*Manaphy* hatched!',
    note: 'Playable in _Legend mode_. And Phione now lives in the Safari Zone’s Frozen Cove.',
    play: 'Play as Manaphy',
    ok: 'OK',
    skip: 'Tap to skip',
  },
})

const es = wordsOf(esVocab, {
  blurbs: {
    nidoranF: 'Punto Tóxico: de vez en cuando, y justo después de recibir un golpe, suelta un anillo de púas venenosas. Nidoqueen se vuelve más resistente por cada enemigo envenenado cerca, y Sludge hiere el doble a los envenenados.',
    nidoranM: 'De vez en cuando baja el cuerno y embiste a través de la horda, invencible en el camino, envenenando a quien atraviesa. La embestida de Nidoking termina en un temblor.',
    cleffa: 'La luna sobre su cabeza crece con el tiempo y con cada derrota. En luna llena caen rayos de luz lunar, los golpes Hada se vuelven más fuertes y Moonlight cura. Tiene Mega (Clefable).',
    phione: 'Corriente tibia: caminar llena la corriente y unas burbujas giran alrededor, golpeando lo que tocan. Quieto, las burbujas estallan en un chorro que cura. Dive sale más grande con la corriente llena.',
    manaphy: 'El Príncipe del Mar: Heart Swap roba la fuerza de los enemigos para Manaphy. Nace del Huevo de Manaphy, premio de la Pokédex de la Bahía Helada.',
  },
  moves: {
    sludge: 'Lanza bolas de lodo a los enemigos más cercanos, que salpican al caer. Hiere el doble a los envenenados.',
    furyAttack: 'El cuerno golpea al frente una y otra vez, un poco hacia cada lado.',
    moonlight: 'Rayos de luz lunar caen sobre los enemigos cercanos. En luna llena cae uno más, y cada acierto cura un poco.',
    dive: 'Se sumerge un instante (invencible) y géiseres estallan bajo los enemigos más cercanos. Con la corriente llena salen más grandes.',
  },
  heartSwap: {
    description: 'Corazones salen de un anillo alrededor de Manaphy y persiguen a los enemigos. Cada uno que acierta debilita al enemigo (su toque hiere menos) y sube tus golpes un 12% por 3 s.',
    upgrades: [
      '+7 de daño',
      '+2 corazones',
      { fork: [{ name: 'Encanto', desc: 'Los corazones confunden al enemigo; +4 de daño' }, { name: 'Corazón gentil', desc: 'Cada corazón cura el 1% de tu vida; +2 corazones' }] },
      'Recarga 0.35s más rápida y +7 de daño',
    ],
  },
  megas: { clefable: 'golpes +25%, PS +40, regeneración alta y golpes Hada +25%. El especial pasa a ser Moonblast.' },
  titles: { safariMeadow: 'Naturalista de la Pradera', safariMarsh: 'Vigía del Pantano', safariRidge: 'Explorador de la Sierra', safariCove: 'Guardián de la Bahía' },
  giftTitles: {
    safariMeadow: 'Completó la Pokédex de la Pradera Dorada en la Zona Safari',
    safariMarsh: 'Completó la Pokédex del Pantano Sombrío en la Zona Safari',
    safariRidge: 'Completó la Pokédex de la Sierra Tronadora en la Zona Safari',
    safariCove: 'Completó la Pokédex de la Bahía Helada en la Zona Safari',
  },
  prizes: { nidoranF: 'Nidoran♀', nidoranM: 'Nidoran♂', cleffa: 'Cleffa', shadowNidoranF: 'Nidoran♀ Oscuro', shadowNidoranM: 'Nidoran♂ Oscuro', shadowCleffa: 'Cleffa Oscuro' },
  prizeBlurbs: {
    nidoranF: 'Un anillo de púas venenosas. Nidoqueen defiende su terreno.',
    nidoranM: 'Embiste con el cuerno por la horda. Nidoking hace temblar el suelo.',
    cleffa: 'La luna llena ilumina el campo. Tiene Mega Clefable.',
  },
  where: { nidoranF: CORNER_WHERE.es, nidoranM: CORNER_WHERE.es, cleffa: CORNER_WHERE.es, phione: 'Solo en la *Zona Safari*, en la semana de la Bahía Helada, cuando *Manaphy* sea tuyo: completa la Pokédex de la Bahía Helada para ganar el Huevo de Manaphy.' },
  legendWhere: 'Nace del _Huevo de Manaphy_: completa la Pokédex de la Bahía Helada en la *Zona Safari* del Poké Realm.',
  safari: {
    tab: 'Exclusivos',
    title: 'Exclusivos del Safari',
    intro: 'Pokémon que ningún huevo trae: solo la Zona Safari. Los que te faltan aparecen el doble.',
    thisWeek: 'Esta semana',
    inWeeks: (n) => (n === 1 ? 'La semana que viene' : `En ${n} semanas`),
    have: (n, total) => `Tuyos: ${n}/${total}`,
    owned: 'Tuyo',
    missing: 'Falta',
    gated: 'Llega después de Manaphy',
    rewardHead: 'Completar esta Pokédex da:',
    ultraEgg: 'Huevo Ultra',
    title_: (name) => `el título *${name}*`,
    shiny: (name) => `*${name}* shiny asegurado`,
    manaphyEgg: 'el *Huevo de Manaphy*',
    done: '¡Pokédex completa! Los premios están en tu caja de regalos.',
    doneBefore: 'Pokédex completada antes de que llegaran los exclusivos nuevos: sigue completa y sus premios ya son tuyos. Los que faltan arriba son solo para tu colección.',
    lacking: (n, names) => (n === 1 ? `Exclusivo que te falta aquí: ${names}.` : `${n} exclusivos que te faltan aquí: ${names}.`),
    allHere: 'Ya tienes todos los exclusivos de aquí.',
    boost: '2× más',
  },
  egg: {
    name: 'Huevo de Manaphy',
    gift: 'Huevo de Manaphy',
    hatching: 'El huevo late como el mar...',
    glow: '¡Una luz cálida brilla dentro!',
    hatched: '¡Nació *Manaphy*!',
    note: 'Jugable en el _Modo Legendario_. Y Phione ahora vive en la Bahía Helada de la Zona Safari.',
    play: 'Jugar con Manaphy',
    ok: 'OK',
    skip: 'Toca para saltar',
  },
})

const fr = wordsOf(frVocab, {
  blurbs: {
    nidoranF: 'Point Poison : de temps en temps, et juste après un coup reçu, elle lance un anneau de piquants empoisonnés. Nidoqueen se renforce pour chaque ennemi empoisonné autour, et Sludge frappe deux fois plus fort les empoisonnés.',
    nidoranM: 'De temps en temps, il baisse sa corne et charge à travers la horde, invincible en chemin, empoisonnant ce qu’il traverse. La charge de Nidoking finit en séisme.',
    cleffa: 'La lune au-dessus de sa tête croît avec le temps et à chaque K.O. À la pleine lune, des rayons de lune tombent, les attaques Fée se renforcent et Moonlight soigne. A une Méga (Clefable).',
    phione: 'Courant tiède : marcher remplit le courant et des bulles tournent autour, frappant ce qu’elles touchent. À l’arrêt, les bulles éclatent en une gerbe qui soigne. Dive sort plus grand avec un courant plein.',
    manaphy: 'Le Prince de la Mer : Heart Swap vole la force des ennemis pour Manaphy. Naît de l’Œuf de Manaphy, prix du Pokédex de la Crique Gelée.',
  },
  moves: {
    sludge: 'Lance des boules de boue sur les ennemis les plus proches, qui éclaboussent en tombant. Frappe deux fois plus fort les empoisonnés.',
    furyAttack: 'La corne frappe devant encore et encore, un peu de chaque côté.',
    moonlight: 'Des rayons de lune tombent sur les ennemis autour. À la pleine lune, un de plus tombe, et chaque coup soigne un peu.',
    dive: 'Plonge un instant (invincible) et des geysers jaillissent sous les ennemis les plus proches. Avec un courant plein, ils sortent plus grands.',
  },
  heartSwap: {
    description: 'Des cœurs jaillissent d’un anneau autour de Manaphy et poursuivent les ennemis. Chacun qui touche affaiblit l’ennemi (son contact blesse moins) et augmente vos dégâts de 12 % pendant 3 s.',
    upgrades: [
      '+7 de dégâts',
      '+2 cœurs',
      { fork: [{ name: 'Charme', desc: 'Les cœurs rendent l’ennemi confus ; +4 de dégâts' }, { name: 'Cœur tendre', desc: 'Chaque cœur soigne 1 % de vos PV ; +2 cœurs' }] },
      'Recharge 0,35 s plus rapide et +7 de dégâts',
    ],
  },
  megas: { clefable: 'dégâts +25 %, PV +40, forte régénération et attaques Fée +25 %. L’attaque spéciale devient Moonblast.' },
  titles: { safariMeadow: 'Naturaliste de la Prairie', safariMarsh: 'Veilleur du Marais', safariRidge: 'Pionnier de la Crête', safariCove: 'Gardien de la Crique' },
  giftTitles: {
    safariMeadow: 'A rempli le Pokédex de la Prairie Dorée au Parc Safari',
    safariMarsh: 'A rempli le Pokédex du Marais Sombre au Parc Safari',
    safariRidge: 'A rempli le Pokédex de la Crête du Tonnerre au Parc Safari',
    safariCove: 'A rempli le Pokédex de la Crique Gelée au Parc Safari',
  },
  prizes: { nidoranF: 'Nidoran♀', nidoranM: 'Nidoran♂', cleffa: 'Cleffa', shadowNidoranF: 'Nidoran♀ Obscur', shadowNidoranM: 'Nidoran♂ Obscur', shadowCleffa: 'Cleffa Obscur' },
  prizeBlurbs: {
    nidoranF: 'Un anneau de piquants empoisonnés. Nidoqueen tient bon.',
    nidoranM: 'Charge la horde corne en avant. Nidoking fait trembler le sol.',
    cleffa: 'La pleine lune éclaire le terrain. A Méga-Clefable.',
  },
  where: { nidoranF: CORNER_WHERE.fr, nidoranM: CORNER_WHERE.fr, cleffa: CORNER_WHERE.fr, phione: 'Seulement au *Parc Safari*, la semaine de la Crique Gelée, une fois *Manaphy* à vous : remplissez le Pokédex de la Crique Gelée pour gagner l’Œuf de Manaphy.' },
  legendWhere: 'Naît de l’_Œuf de Manaphy_ : remplissez le Pokédex de la Crique Gelée au *Parc Safari* du Poké Realm.',
  safari: {
    tab: 'Exclusifs',
    title: 'Exclusifs du Safari',
    intro: 'Des Pokémon qu’aucun œuf n’apporte : seulement le Parc Safari. Ceux qui vous manquent apparaissent 2× plus.',
    thisWeek: 'Cette semaine',
    inWeeks: (n) => (n === 1 ? 'La semaine prochaine' : `Dans ${n} semaines`),
    have: (n, total) => `À vous : ${n}/${total}`,
    owned: 'À vous',
    missing: 'Manque',
    gated: 'Vient après Manaphy',
    rewardHead: 'Remplir ce Pokédex donne :',
    ultraEgg: 'Œuf Ultra',
    title_: (name) => `le titre *${name}*`,
    shiny: (name) => `*${name}* chromatique assuré`,
    manaphyEgg: 'l’*Œuf de Manaphy*',
    done: 'Pokédex rempli ! Les prix sont dans votre boîte à cadeaux.',
    doneBefore: 'Pokédex rempli avant l’arrivée des nouveaux exclusifs : il reste rempli et ses prix sont à vous. Ceux qui manquent ci-dessus ne comptent que pour votre collection.',
    lacking: (n, names) => (n === 1 ? `Exclusif qui vous manque ici : ${names}.` : `${n} exclusifs qui vous manquent ici : ${names}.`),
    allHere: 'Vous avez tous les exclusifs d’ici.',
    boost: '2× plus',
  },
  egg: {
    name: 'Œuf de Manaphy',
    gift: 'Œuf de Manaphy',
    hatching: 'L’œuf palpite comme la mer...',
    glow: 'Une lumière chaude brille à l’intérieur !',
    hatched: '*Manaphy* est né !',
    note: 'Jouable en _mode Légendaire_. Et Phione vit désormais dans la Crique Gelée du Parc Safari.',
    play: 'Jouer avec Manaphy',
    ok: 'OK',
    skip: 'Touchez pour passer',
  },
})

const zh = wordsOf(zhVocab, {
  blurbs: {
    nidoranF: '毒刺：不時、以及受到攻擊後，會放出一圈毒刺。Nidoqueen 身邊每有一個中毒的敵人就更加堅固，Sludge 對中毒的敵人造成雙倍傷害。',
    nidoranM: '不時低下角衝進敵群，途中無敵，讓穿過的敵人中毒。Nidoking 的衝鋒最後會引發地震。',
    cleffa: '頭上的月亮會隨時間與每次擊倒而變圓。滿月時月光落下、妖精招式變強，Moonlight 會回復體力。可超級進化（Clefable）。',
    phione: '暖流：走動會累積水流，泡泡繞著它轉，碰到就造成傷害。停下時泡泡會爆開成回復的水花。水流滿時 Dive 的範圍更大。',
    manaphy: '海之王子：Heart Swap 把敵人的力量奪給 Manaphy。從瑪納霏之蛋孵化，是冰封海灣圖鑑的獎勵。',
  },
  moves: {
    sludge: '向最近的敵人丟出污泥，落地時濺開。對中毒的敵人造成雙倍傷害。',
    furyAttack: '角向前方連續刺擊，每次稍微偏向一側。',
    moonlight: '月光落在附近的敵人身上。滿月時多落一道，每次命中都會回復一點體力。',
    dive: '潛入水中片刻（無敵），最近的敵人腳下噴出間歇泉。水流滿時噴得更大。',
  },
  heartSwap: {
    description: '心形從 Manaphy 身邊的光環飛出並追蹤敵人。每顆命中都會削弱敵人（接觸傷害降低），並讓你的傷害提高 12%，持續 3 秒。',
    upgrades: [
      '傷害 +7',
      '心形 +2',
      { fork: [{ name: '魅惑', desc: '心形讓敵人混亂；傷害 +4' }, { name: '溫柔之心', desc: '每顆心回復 1% 體力；心形 +2' }] },
      '冷卻快 0.35 秒，傷害 +7',
    ],
  },
  megas: { clefable: '傷害 +25%，HP +40，高回復，妖精招式 +25%。特殊招式變為 Moonblast。' },
  titles: { safariMeadow: '草原博物學家', safariMarsh: '沼澤守望者', safariRidge: '山脊開拓者', safariCove: '海灣守護者' },
  giftTitles: {
    safariMeadow: '完成狩獵地帶金色草原的圖鑑',
    safariMarsh: '完成狩獵地帶幽暗沼澤的圖鑑',
    safariRidge: '完成狩獵地帶雷鳴山脊的圖鑑',
    safariCove: '完成狩獵地帶冰封海灣的圖鑑',
  },
  prizes: { nidoranF: 'Nidoran♀', nidoranM: 'Nidoran♂', cleffa: 'Cleffa', shadowNidoranF: '黑暗 Nidoran♀', shadowNidoranM: '黑暗 Nidoran♂', shadowCleffa: '黑暗 Cleffa' },
  prizeBlurbs: {
    nidoranF: '一圈毒刺。Nidoqueen 守住陣地。',
    nidoranM: '用角衝過敵群。Nidoking 震動大地。',
    cleffa: '滿月照亮戰場。可超級進化為 Mega Clefable。',
  },
  where: { nidoranF: CORNER_WHERE.zh, nidoranM: CORNER_WHERE.zh, cleffa: CORNER_WHERE.zh, phione: '只在*狩獵地帶*的冰封海灣週出現，且要先擁有 *Manaphy*：完成冰封海灣的圖鑑即可獲得瑪納霏之蛋。' },
  legendWhere: '從_瑪納霏之蛋_孵化：完成 Poké Realm *狩獵地帶*冰封海灣的圖鑑。',
  safari: {
    tab: '限定',
    title: '狩獵地帶限定',
    intro: '沒有任何蛋能孵出的寶可夢：只有狩獵地帶有。你還沒有的出現機率加倍。',
    thisWeek: '本週',
    inWeeks: (n) => (n === 1 ? '下週' : `${n} 週後`),
    have: (n, total) => `已擁有 ${n}/${total}`,
    owned: '已擁有',
    missing: '尚缺',
    gated: '擁有 Manaphy 後出現',
    rewardHead: '完成這裡的圖鑑可獲得：',
    ultraEgg: '究極蛋',
    title_: (name) => `稱號「*${name}*」`,
    shiny: (name) => `必定異色的 *${name}*`,
    manaphyEgg: '*瑪納霏之蛋*',
    done: '圖鑑完成！獎勵已送到你的禮物箱。',
    doneBefore: '新的限定寶可夢加入前你就完成了這裡的圖鑑：圖鑑依然算完成，獎勵也已是你的。上面還缺的只差收進你的收藏。',
    lacking: (n, names) => `這裡你還缺 ${n} 隻限定：${names}。`,
    allHere: '這裡的限定你都有了。',
    boost: '機率加倍',
  },
  egg: {
    name: '瑪納霏之蛋',
    gift: '瑪納霏之蛋',
    hatching: '蛋像大海一樣脈動著……',
    glow: '裡面亮起溫暖的光！',
    hatched: '*Manaphy* 孵化了！',
    note: '可在_傳說模式_中使用。Phione 現在也住在狩獵地帶的冰封海灣了。',
    play: '用 Manaphy 遊玩',
    ok: 'OK',
    skip: '點擊跳過',
  },
})

export const SC_WAVE_WORDS = { pt, en, es, fr, zh }
