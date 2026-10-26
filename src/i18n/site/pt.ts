import type { BlastSafe, BossStance } from '../../data/bosses'
import type { PlaceId, WingId } from '../../data/places'
import type { LandmarkId } from '../../data/landmarks'
import type { Drop } from '../../data/consumables'
import type { TraitId } from '../../data/traits'
import type { TrioId } from '../../data/waves'
import type { PokeType } from '../../data/types'
import type { EggSource } from '../../game/eggs'
import type { StatusKind } from '../../game/status'
import type { Difficulty } from '../../game/difficulty'

/** Number in Brazilian format (`1.250`, `0,75`). */
const n = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const s = (count: number, one: string, many: string) => (count === 1 ? one : many)
/** `a, b e c` */
const list = (items: readonly string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`)
/** `a, b ou c` */
const either = (items: readonly string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} ou ${items.at(-1)}`)

/** How a harder difficulty presses the wave bosses (`BOSS_DIFFICULTY`). */
type BossPress = { pace: number; more: number; chain: number }
/** The boss rules the guide quotes (`BOSS_RAGE`, `BOSS_DIFFICULTY`, and the spawn share of `BOSS_FIGHT` and `FINALE`). */
type BossRules = { stance: readonly [number, number]; below: number; speed: number; wait: number; chain: number; fight: number; window: number; finale: number; press: { hard: BossPress; nightmare: BossPress } }
/**
 * What the tier list's method quotes (`site/tierList.ts`): its window and runs, the smoothing's weight,
 * the difficulties' weights (percent) and the tiers' cuts (odds against the average Pokémon).
 */
export type TierMethod = {
  days: number
  runs: number
  prior: number
  minRuns: number
  weights: { normal: number; hard: number; nightmare: number }
  cuts: { S: number; A: number; B: number; C: number }
}
/** Elites and runners as the guide quotes them (`ELITE`, `RUNNER`; `from` is a clock like `1:00`). */
type HordeRules = { fill: number; share: number; hp: number; damage: number; from: string; speed: number; frail: number; lead: number }

/**
 * Copy of the static site pages (Pokédex, guide, changelog, legal), in Brazilian
 * Portuguese. Like the game's `pt.ts`, this is the reference: `SiteMessages` is
 * inferred from it and `en.ts` must match it key for key. Game content
 * (move, item and special descriptions, blurbs) comes from the game's own messages.
 */
export const sitePt = {
  lang: { tag: 'pt-BR', og: 'pt_BR', short: 'PT', switchTo: 'Ver em português' },
  skip: 'Pular para o conteúdo',
  nav: {
    label: 'Navegação principal',
    play: 'Jogar',
    pokedex: 'Pokédex',
    guide: 'Guia',
    changelog: 'Novidades',
    tierList: 'Tier list',
    legal: 'Legal',
    support: 'Apoie',
    language: 'Idioma',
  },
  footer: {
    disclaimer:
      'Pokémon Survivors é um fan game não oficial, gratuito e sem fins lucrativos. Não tem vínculo com Nintendo, The Pokémon Company, GAME FREAK, Creatures ou Spike Chunsoft, nem é endossado por elas. Pokémon e os nomes dos personagens são marcas registradas da Nintendo.',
    legal: 'Legal e privacidade',
    credits: 'Créditos',
    source: 'Código no GitHub',
    support: 'Apoie o projeto',
  },
  home: 'Início',
  playCta: 'Jogar grátis',

  types: {
    normal: 'Normal', fire: 'Fogo', water: 'Água', grass: 'Planta', electric: 'Elétrico', poison: 'Veneno',
    flying: 'Voador', bug: 'Inseto', rock: 'Pedra', ground: 'Terra', ghost: 'Fantasma', fighting: 'Lutador',
    psychic: 'Psíquico', ice: 'Gelo', steel: 'Aço', dark: 'Sombrio', fairy: 'Fada', dragon: 'Dragão',
  } satisfies Record<PokeType, string>,

  pokedex: {
    title: 'Pokédex do Pokémon Survivors: iniciais, inimigos, chefes e lendários',
    description:
      'Todos os Pokémon do Pokémon Survivors com sprite animado e shiny: os 27 iniciais e as 63 famílias dos ovos com suas evoluções, inimigos selvagens, chefes e lendários. Tipos, status no jogo, golpes, especiais e quando cada um aparece.',
    h1: 'Pokédex',
    intro: (count: number) =>
      `Os ${count} Pokémon que existem no Pokémon Survivors, com os números do jogo: iniciais de todas as regiões, as famílias que saem dos ovos e suas evoluções, a horda selvagem, os chefes e os lendários. Passe o mouse (ou toque) para ver o sprite andando e use ★ para ver o shiny.`,
    filters: 'Filtros',
    search: 'Buscar',
    searchPlaceholder: 'Nome ou número',
    region: 'Região',
    type: 'Tipo',
    role: 'Papel',
    all: 'Todos',
    allRegions: 'Todas',
    shinyAll: 'Shiny',
    shinyToggle: (name: string) => `Ver ${name} shiny`,
    results: (count: number) => `${count} ${s(count, 'Pokémon encontrado', 'Pokémon encontrados')}`,
    empty: 'Nenhum Pokémon com esses filtros.',
    clear: 'Limpar filtros',
    tierLink: 'Qual é o melhor Pokémon? Veja a tier list, feita com as partidas dos jogadores',
    roles: { starter: 'Inicial', egg: 'Ovo', enemy: 'Selvagem', boss: 'Chefe', legendary: 'Lendário', event: 'Evento' },
    roleFilter: { starter: 'Iniciais', egg: 'Ovos', enemy: 'Selvagens', boss: 'Chefes', legendary: 'Lendários', event: 'Eventos' },
    link: (name: string) => `Link para ${name}`,
    portrait: (name: string) => `Retrato de ${name}`,
    sprite: (name: string) => `Sprite animado de ${name}`,
    stats: 'Status no jogo',
    statsNote: 'Sem itens nem melhorias da Loja do Kecleon.',
    evolution: 'Linha evolutiva',
    evolvesAt: (level: number) => `Nv ${level}`,
    hatchNote: (egg: string) => `Jogável depois de chocar de um ${egg}.`,
    stageOf: (stage: number) => ['Estágio inicial', 'Primeira evolução', 'Evolução final'][stage] ?? '',
    signature: 'Golpe inicial',
    special: 'Ataque especial',
    specialFinal: 'Na evolução final',
    learnset: 'Golpes que aprende',
    /** The learnset's first row: what the family starts with (later rows say the level each evolution unlocks its moves at). */
    learnStart: 'desde o início',
    wildStats: { hp: 'HP', damage: 'Dano de contato', speed: 'Velocidade', xp: 'EXP' },
    eventNote: 'Aparece nos eventos do mapa: foge de você e solta moedas a cada golpe. Derrube ele antes que escape para ganhar o Pay Day.',
    companionNote: 'Companheiro de presente: chega na caixa de presentes dos apoiadores durante a Noite das Bruxas e anda ao seu lado na partida, deixando um rastro de doces.',
    cameoNote: 'Não é um inimigo: aparece por um instante na fenda do Darkrai, durante a Noite das Bruxas, e quebra o pesadelo com a Lunar Wing.',
    wildNote: 'Valores base. Inimigos comuns ficam mais fortes a cada minuto; chefes, não.',
    appears: 'Quando aparece',
    horde: (from: string, until: string) => `Pode entrar na horda, de ${from} a ${until}`,
    hordeEnd: (from: string) => `Pode entrar na horda, de ${from} até o fim`,
    swarm: (at: string, count: number) => `Pode liderar a revoada de ${count} em ${at}`,
    ring: (at: string, count: number) => `Pode formar o cerco de ${count} em ${at}`,
    ringFixed: (at: string, count: number) => `Forma o cerco de ${count} em ${at}`,
    boss: (at: string) => `Chefe em ${at}`,
    bossChance: (at: string, percent: number) => `Chefe em ${at} (${n(percent)}% de chance)`,
    trio: (at: string, trio: string) => `Chefe em ${at} nas partidas que sorteiam o trio ${trio} (1 em 3)`,
    night: (at: string, percent: number) => `Chefe da Noite das Bruxas em ${at}, nas partidas assombradas do evento (${n(percent)}% de chance)`,
    rift: (from: string) => `No seu domínio, atrás de uma fenda lendária, a partir de ${from} (opcional)`,
    eventRift: (from: string) => `Só na Noite das Bruxas 2026: numa partida assombrada, a fenda do Pesadelo pode tomar o lugar de uma fenda, a partir de ${from} (opcional)`,
    /** `name` comes with its preposition (`places`). */
    place: (name: string, from: string) => `Vive ${name}, a partir de ${from} (lugar opcional)`,
    placeBoss: (name: string, from: string) => `Desperta da Pedra Peculiar ${name}, a partir de ${from}`,
    places: { cave: 'na Caverna Escura', graveyard: 'no Cemitério Assombrado', sky: 'no céu, acima das nuvens (só para quem voa)' } satisfies Record<PlaceId, string>,
    reaper: (at: string) => `Ceifador do modo sem fim, a partir de ${at}`,
    attacks: 'Ataques',
    nightAttacks: 'Ataques como chefe da Noite das Bruxas',
    shinyNote: 'Pode aparecer shiny (1 em 450): elite com 8x HP.',
    /** A rift legendary's shiny odds (`RIFT.shinyOdds`); the map's bosses are never shiny. */
    riftShinyNote: (odds: number) => `Pode aparecer shiny em 1 de ${n(odds)} fendas: paga o dobro de ₽ e mais uma Poké Ball.`,
    summoned: (by: string) => `Chamado por ${by}`,
    retinue: (by: string) => `No domínio de ${by}, atrás de uma fenda lendária`,
    behavior: 'Comportamento',
    /** A legendary's card: how to capture it for the Legend mode (`game/capture.ts`). */
    legendMode: 'Modo Lendário',
    capture: (need: number) => (need === 1 ? 'Vença-o 1 vez como chefe, em qualquer modo, e ele fica jogável no Modo Lendário (ranking próprio, horda mais forte, despertares no Nv 12 e 28).' : `Vença-o ${need} vezes como chefe, em qualquer modo, e ele fica jogável no Modo Lendário (ranking próprio, horda mais forte, despertares no Nv 12 e 28).`),
    captureLast: 'O último troféu: só se deixa capturar no modo sem fim, depois que os outros 22 lendários forem capturados.',
    captureEvent: (need: number) => `Lenda de evento: vença-o ${need} vezes na fenda do Pesadelo durante a Noite das Bruxas 2026 (24/10 a 2/11) e ele fica jogável no Modo Lendário para sempre. Ele não conta para o Arceus.`,
    captureShiny: 'Vencer um shiny na vitória da captura, ou depois, libera a forma shiny.',
    innate: (name: string) => `Inata (sempre ativa): ${name}`,
    opens: (move: string) => `Começa com ${move}`,
  },

  /** A Pokémon's own page (`/pokedex/charmander/`): a family's stages together, or a legend. Names stay in English. */
  dexPage: {
    title: (names: readonly string[]) => `${list(names)} no Pokémon Survivors: golpes, evolução e habilidades`,
    legendTitle: (name: string) => `${name} no Pokémon Survivors: como capturar, ataques e Modo Lendário`,
    description: (name: string, signature: string) =>
      `${name} no Pokémon Survivors, o jogo grátis estilo Vampire Survivors com Pokémon: status, linha evolutiva, o golpe inicial ${signature}, ataque especial, golpes que aprende e Habilidades.`,
    legendDescription: (name: string) =>
      `${name} no Pokémon Survivors, o jogo grátis estilo Vampire Survivors com Pokémon: quando aparece, seus ataques de chefe e como capturá-lo para jogar com ele no Modo Lendário.`,
    h1: (names: readonly string[]) => `${list(names)} no Pokémon Survivors`,
    /** A long family (Eevee and its eight) is named by its first stage. */
    family: (name: string) => `${name} e suas evoluções`,
    starter: (name: string, types: readonly string[], region: string, count: number) =>
      `${name} é um dos ${count} iniciais do Pokémon Survivors, do tipo ${list(types)}, da região de ${region}.`,
    egg: (name: string, types: readonly string[]) => `${name} é uma das famílias que saem dos ovos no Pokémon Survivors, do tipo ${list(types)}.`,
    legend: (name: string, types: readonly string[], count: number) => `${name} é um dos ${count} lendários do Pokémon Survivors, do tipo ${list(types)}.`,
    eventLegend: (name: string, types: readonly string[]) => `${name} é a lenda de evento da Noite das Bruxas 2026 no Pokémon Survivors, do tipo ${list(types)}.`,
    faq: 'Perguntas frequentes',
    unlockQ: (name: string) => `Como liberar ${name} no Pokémon Survivors?`,
    starterA: (name: string) => `${name} é um inicial: está liberado desde a primeira partida, sem precisar de nada.`,
    eggA: (name: string, egg: string) =>
      `Chocando um ${egg}. Chefes, baús trancados e fendas às vezes deixam ovos, que chocam na incubadora com os passos dados nas partidas; quando ${name} sai do ovo, fica jogável para sempre.`,
    evolveQ: (name: string) => `Como ${name} evolui?`,
    evolveA: (steps: readonly string[]) => `No meio da partida, ao subir de nível: ${list(steps)}.`,
    /** One evolution step: the forms it can go to (a branching one names all of them) and the level. */
    step: (names: readonly string[], level: number) => `em ${either(names)} no Nv ${level}`,
    evolveItem: 'Algumas formas pedem um item de evolução, que você compra na Loja do Kecleon ou acha com os chefes.',
    signatureQ: (name: string) => `Qual é o golpe inicial de ${name}?`,
    signatureA: (name: string, move: string) => `${name} começa toda partida com ${move}, o golpe assinatura da família. Os outros golpes vêm dos level-ups, conforme a linha evolui.`,
    megaQ: (name: string) => `${name} tem Mega Evolução?`,
    megaA: (megas: readonly string[]) =>
      `Sim: na evolução final, ${either(megas)}. A Mega Stone cai do primeiro lendário de fenda que você vence na partida, e a Mega Evolução dura 20 segundos.`,
    catchQ: (name: string) => `Como capturar ${name} no Pokémon Survivors?`,
    whereQ: (name: string) => `Onde ${name} aparece?`,
    awakens: (form: string) => `No Modo Lendário, o segundo despertar (Nv 28) o transforma em ${form}.`,
    mega: 'Mega Evolução',
    megaLine: (stone: string, ability: string) => `${stone} · Habilidade ${ability}`,
    play: (name: string) => `Jogar com ${name}`,
    others: 'Outros Pokémon jogáveis',
    groups: { starter: 'Iniciais', egg: 'Ovos', legendary: 'Lendários' },
    back: 'Ver a Pokédex completa',
    page: (name: string) => `Página de ${name}`,
    tierQ: (name: string) => `${name} é bom no Pokémon Survivors?`,
    tierA: (name: string, tier: string, rate: number, runs: number, days: number) =>
      `Na tier list, feita com as partidas dos jogadores, ${name} está no tier ${tier}: venceu o Mewtwo em ${rate}% das ${n(runs)} partidas no Normal dos últimos ${days} dias.`,
    tierNoneA: (name: string) => `${name} ainda não tem partidas suficientes para ganhar um tier na tier list. Ela é atualizada com o tempo.`,
    tierLine: (tier: string, rate: number) => `Tier ${tier} na tier list · ${rate}% de vitórias no Normal`,
    tierLineNone: 'Ainda sem tier na tier list: poucas partidas',
  },

  /** The tier list (`/tier-list/`), ranked from real runs (`site/tierList.ts`). Pokémon names stay in English. */
  tierList: {
    title: 'Tier list do Pokémon Survivors: os melhores Pokémon, com dados reais',
    description:
      'Tier list do Pokémon Survivors feita com as partidas dos jogadores: os melhores Pokémon para vencer o Mewtwo, de S a D, com a taxa de vitória de cada inicial e família dos ovos no Normal, no Difícil e no Pesadelo.',
    h1: 'Tier list do Pokémon Survivors',
    best: (names: readonly string[], runs: number, days: number) =>
      `Qual é o melhor Pokémon do Pokémon Survivors? Pelas ${n(runs)} partidas dos últimos ${days} dias, hoje são ${list(names)}: com eles, os jogadores vencem o Mewtwo mais vezes do que com qualquer outro.`,
    intro: 'Os iniciais e as famílias dos ovos, de S a D, por quantas vezes vencem o Mewtwo nas três dificuldades. Toque num Pokémon para abrir a página dele; os números de cada um e o método estão logo abaixo.',
    updated: (date: string, days: number) => `Partidas dos ${days} dias até ${date}. A tier list é atualizada com o tempo.`,
    tiers: 'Tiers, do melhor para o pior',
    tier: (tier: string) => `Tier ${tier}`,
    noData: 'Sem dados',
    noDataNote: (min: number) => `Menos de ${min} partidas até agora: ainda sem tier.`,
    tableTitle: 'Os números de cada Pokémon',
    tableNote:
      'Em cada dificuldade, a porcentagem de partidas que venceram o Mewtwo (o modo sem fim conta como vitória) e, entre parênteses, quantas partidas. A nota compara as chances de vencer com as da média: 1× é a média.',
    head: { rank: '#', pokemon: 'Pokémon', tier: 'Tier', score: 'Nota', minute: 'Minuto médio' },
    methodTitle: 'Como a tier list é feita',
    method: (r: TierMethod) => [
      `Ela sai das ${n(r.runs)} partidas terminadas nos últimos ${r.days} dias no modo normal (sem o Desafio do dia e sem o Modo Lendário), contadas de forma anônima pelo jogo. Uma vitória é uma partida que venceu o Mewtwo.`,
      `Cada dificuldade conta separado. Para um Pokémon com poucas partidas não pular para o topo por sorte, a taxa de vitória de cada um é puxada para a média daquela dificuldade, como se ele tivesse jogado mais ${r.prior} partidas na média: com 20 partidas, o resultado anda bastante em direção à média; com 500, quase nada muda.`,
      `Depois, a nota compara as chances de vencer de cada Pokémon com as da média, em cada dificuldade, e junta as três: o Difícil vale ${r.weights.hard}%, o Normal ${r.weights.normal}% e o Pesadelo ${r.weights.nightmare}%. O Difícil pesa mais porque tem muitas partidas e é jogado sobretudo por quem já conhece o jogo, seja qual for o Pokémon. O Normal é o mais jogado, mas é onde os iniciantes se concentram, e o Pesadelo é o teste mais duro, mas tem poucas vitórias, então oscila mais. Comparar chances, e não porcentagens, faz subir de 5% para 10% no Pesadelo valer tanto quanto subir de 55% para 70% no Normal.`,
      `Os tiers saem da nota: S a partir de ${n(r.cuts.S)}× (quase o dobro das chances da média), A a partir de ${n(r.cuts.A)}×, B a partir de ${n(r.cuts.B)}× (na média ou acima), C a partir de ${n(r.cuts.C)}× e D abaixo disso. Quem tem menos de ${r.minRuns} partidas, somando as três dificuldades, fica em "Sem dados" até ser mais jogado.`,
    ],
    caveatsTitle: 'O que a tier list não diz',
    /** `popular`: the most played family on Normal and its runs there. */
    caveats: (popular: string, runs: number) => [
      `Quem escolhe faz diferença. Quem está começando costuma pegar os iniciais mais famosos (só ${popular} tem ${n(runs)} partidas no Normal), enquanto as famílias dos ovos ficam nas mãos de quem já jogou o bastante para chocá-las. Por isso a taxa de vitória dos ovos sai mais bonita e a dos iniciais populares, mais baixa, sem que o Pokémon seja tão melhor ou pior assim.`,
      'A Loja do Kecleon também pesa: quem já comprou mais melhorias vence mais, com qualquer Pokémon.',
      'O jogo muda. Golpes, chefes e dificuldades são ajustados com frequência, e partidas de antes de um ajuste ainda contam até saírem da janela.',
      'Mesmo com o ajuste para a média, poucas partidas dão números incertos: um tier de diferença entre dois Pokémon do meio da lista quase não quer dizer nada.',
      'No fim, o melhor Pokémon é aquele com quem você joga bem. Qualquer um deles pode vencer o Mewtwo.',
    ],
  },

  /** Enemy traits, built from `data/traits.ts`. */
  traits: {
    names: {
      healer: 'Curandeiro',
      shield: 'Escudo',
      summoner: 'Invocador',
      kamikaze: 'Kamikaze',
      beam: 'Raio',
      leaper: 'Saltador',
      spitter: 'Cuspidor',
    } satisfies Record<TraitId, string>,
    effects: {
      healer: (every: number, percent: number) =>
        `A cada ${n(every)}s, um pulso verde cura ${n(percent)}% do HP máximo dos aliados feridos por perto.`,
      shield: (every: number, percent: number, duration: number) =>
        `A cada ${n(every)}s, envolve os aliados por perto num escudo que absorve dano igual a ${n(percent)}% do HP máximo deles, por ${n(duration)}s.`,
      summoner: (every: number, count: number, max: number, names: readonly string[]) =>
        `A cada ${n(every)}s chama ${count} reforços (${list(names)}), até ${max} ao mesmo tempo.`,
      kamikaze: (fuse: number, damage: number, percent: number) =>
        `Chega perto, para, pisca em vermelho e explode depois de ${n(fuse)}s. A explosão causa ${n(damage)}x o dano de contato em você e tira ${n(percent)}% do HP dos inimigos no círculo.`,
      beam: (aim: number, damage: number) => `Para, desenha no chão a linha do raio por ${n(aim)}s e dispara: ${n(damage)}x o dano de contato.`,
      leaper: (warn: number, damage: number) =>
        `Salta sobre a horda até onde você estava. A sombra no chão marca a queda ${n(warn)}s antes, e o impacto causa ${n(damage)}x o dano de contato.`,
      spitter: (charge: number, damage: number) =>
        `Fica a distância, brilha por ${n(charge)}s e cospe um disparo lento onde você está: ${n(damage)}x o dano de contato. O tipo muda o disparo: bola de fogo, bolha, lodo que deixa uma poça, faísca rápida ou três sementes.`,
    } satisfies Record<TraitId, unknown>,
    tips: {
      healer: 'Derrube primeiro, senão a horda volta a encher a vida.',
      shield: 'Números azuis são dano absorvido. Derrube o escudeiro ou espere o escudo piscar e sumir.',
      summoner: 'Os reforços param quando ela cai.',
      kamikaze: 'Saia do círculo vermelho, ou atraia para o meio da horda: a explosão fere os inimigos também.',
      beam: 'A mira trava quando a linha aparece: um passo para o lado basta.',
      leaper: 'Saia de cima da sombra antes da queda.',
      spitter: 'O disparo é lento: um passo para o lado basta. Ficar parado é o que ele quer.',
    } satisfies Record<TraitId, string>,
  },

  /** Boss attack patterns, built from `data/bosses.ts`. */
  patterns: {
    strikesPlayer: (count: number, every: number, damage: number) =>
      `${count} ${s(count, 'impacto marcado', 'impactos marcados')} no chão perto de você a cada ${n(every)}s (${damage} de dano)`,
    strikesSelf: (every: number, damage: number) => `Pancada em área ao redor de si a cada ${n(every)}s (${damage} de dano)`,
    ring: (count: number, every: number, damage: number) => `Anel de ${count} projéteis a cada ${n(every)}s (${damage} de dano)`,
    trail: (ttl: number, damage: number) => `Deixa um rastro que fere por ${n(ttl)}s (${damage} de dano)`,
    stance: { close: 'De perto', ranged: 'De longe' } satisfies Record<BossStance, string>,
    // The wave bosses' aimed attacks (`lead`, `leap`, `volley`) and their gates (`PatternGate`).
    path: (count: number, every: number, damage: number) =>
      `${count} impactos marcados no seu caminho, de onde você está até onde vai estar, a cada ${n(every)}s (${damage} de dano)`,
    leap: (every: number, damage: number) => `Salta em cima de você, com um círculo marcando onde vai cair, a cada ${n(every)}s (${damage} de dano)`,
    volley: (count: number, every: number, damage: number) =>
      `Rajada de ${count} ${s(count, 'projétil mirado', 'projéteis mirados')} em você, com linhas de mira antes do disparo, a cada ${n(every)}s (${damage} de dano)`,
    far: 'se você ficar longe',
    below: (percent: number) => `abaixo de ${n(percent)}% do HP`,
    from: { normal: 'em todas as dificuldades', hard: 'no Difícil e no Pesadelo', nightmare: 'só no Pesadelo' } satisfies Record<Difficulty, string>,
    // The phased bosses' primitives (`BossPattern`), their phases and ultimates.
    beam: (count: number, every: number, damage: number) => `${count > 1 ? `${count} raios` : 'Raio'} saindo de si, com a linha piscando antes, a cada ${n(every)}s (${damage} de dano)`,
    lances: (count: number, every: number, damage: number) => `${count} lanças paralelas cruzando a tela, o vão entre elas é seguro, a cada ${n(every)}s (${damage} de dano)`,
    dash: (count: number, every: number, damage: number) => `Investida por uma faixa marcada${count > 1 ? `, ${count} seguidas` : ''}, a cada ${n(every)}s (${damage} de dano)`,
    dive: (every: number, damage: number) => `Some e a sombra persegue você; ela para e ele cai ali, a cada ${n(every)}s (${damage} de dano)`,
    teleport: (every: number, damage: number) => `Teleporta e cai num círculo marcado, a cada ${n(every)}s (${damage} de dano)`,
    blast: (safe: BlastSafe, damage: number) =>
      `Explosão em tudo (${damage} de dano), menos ${({ cover: 'atrás de uma rocha', dry: 'nas ilhas', near: 'colado nele', far: 'longe dele', spots: 'nos abrigos marcados' } satisfies Record<BlastSafe, string>)[safe]}`,
    cage: (every: number, damage: number) => `Prende você num círculo de chamas ou pedras, a cada ${n(every)}s (${damage} de dano)`,
    closing: (count: number, every: number, damage: number) => `Anel de ${count} projéteis fechando em você, com uma saída, a cada ${n(every)}s (${damage} de dano)`,
    summon: (every: number) => `Chama ajudantes a cada ${n(every)}s`,
    phase: (i: number, percent: number) => (i === 0 ? 'Fase 1' : `Fase ${i + 1} (abaixo de ${n(percent)}% do HP)`),
    ultimate: (move: string, every: number) => `Golpe supremo ${move}, a cada ${n(every)}s:`,
    /** Ho-Oh's last phase: reached by falling once, not by HP (`BossPhase.rebirth`). */
    reborn: (i: number, percent: number) => `Fase ${i + 1} (renasce das cinzas com ${n(percent)}% do HP)`,
    swoop: (count: number, every: number, damage: number) => `Passa rasante por uma faixa marcada${count > 1 ? `, ${count} vezes` : ''}, a cada ${n(every)}s (${damage} de dano)`,
    whirlpool: (count: number, every: number, damage: number) => `${count > 1 ? `${count} redemoinhos puxam` : 'Um redemoinho puxa'} você para o olho, a cada ${n(every)}s (${damage} de dano no olho)`,
    gust: (count: number, every: number, damage: number) => `Leque de ${count} rajadas que empurram você, a cada ${n(every)}s (${damage} de dano)`,
    timeStop: (every: number, duration: number) => `Para o tempo: seus golpes congelam no ar por ${n(duration)}s, a cada ${n(every)}s`,
    phantoms: (count: number, every: number, damage: number) => `${count} ${s(count, 'cópia risca', 'cópias riscam')} uma faixa marcada pelo seu lugar, uma depois da outra, a cada ${n(every)}s (${damage} de dano)`,
    guard: (names: string, every: number) => `Ergue uma barreira ligada a ${names}: enquanto um estiver de pé, ele não toma dano (volta ${n(every)}s depois que o último cai)`,
  },

  /** The legendary trios a run draws from (`TRIOS`), and `either` to name who may come. */
  trios: {
    names: { birds: 'Aves de Kanto', beasts: 'Feras de Johto', regis: 'Regis de Hoenn' } satisfies Record<TrioId, string>,
    either,
  },

  /** The wild roster: tiers and the cast each run draws (Pokédex filter and the guide's horde section). */
  roster: {
    tier: 'Faixa',
    tierOf: (tier: number) => `Faixa ${tier}`,
    allTiers: 'Todas',
    paragraphs: (species: number, perRun: number) => [
      `A horda tem ${species} espécies selvagens das 9 gerações, e cada partida sorteia o seu elenco: cerca de ${perRun} espécies, poucas novas por fase, para você reconhecer quem está chegando.`,
      'Cada espécie entra numa faixa pelo total de status base. As primeiras fases puxam da faixa 1 (Pokémon básicos fracos) e o fim da partida, das faixas 4 e 5 (evoluções). As revoadas pegam um Pokémon voador da faixa indicada e os cercos, um Pokémon da faixa que você já encontrou na partida.',
    ],
    special: (r: HordeRules) => [
      `Quando a horda passa de ${n(r.fill * 100)}% do limite da fase, quem nasce vem como elite (até ${n(r.share * 100)}% do limite), com contorno vermelho: ${n(r.hp)}x de HP e de EXP e ${n(r.damage)}x de dano. Limpar a tela evita que ela vire uma horda de elites. Na luta com o Mewtwo não nascem elites.`,
      `A partir de ${r.from}, uma das espécies novas de cada fase corre: ${n(r.speed)}x mais rápida (nunca mais que você sem bônus), com ${n(r.frail * 100)}% do HP, rastros de velocidade e mira em onde você vai estar, até ${n(r.lead)}s à frente. Correr em círculos não despista ela.`,
    ],
    formula: 'Os status no jogo saem dos status base: o HP vem da faixa e da defesa (HP, Defesa e Defesa Especial), o dano da faixa e do melhor ataque, a velocidade da Velocidade base, a EXP do HP e a resistência a empurrão do HP e da Defesa (voadores e fantasmas são mais leves).',
    tiersTitle: 'Faixas',
    tierHead: 'Faixa',
    totalHead: 'Total de status base',
    total: (min: number, max: number | null) => (max === null ? `${min} ou mais` : min === 0 ? `até ${max}` : `${min} a ${max}`),
    speciesHead: 'Espécies',
    examplesHead: 'Exemplos',
    stagesTitle: 'Faixas por fase',
    timeHead: 'Tempo',
    castHead: 'Faixas do elenco',
    /** `groups` = [tier, slots] pairs. */
    cast: (groups: readonly (readonly [number, number])[], fresh: number) =>
      `${list(groups.map(([tier, count]) => `${count} da faixa ${tier}`))} (${fresh} ${s(fresh, 'nova', 'novas')})`,
    swarm: (count: number, tier: number) => `Revoada: ${count} Pokémon voadores da faixa ${tier} cruzam a tela`,
    ring: (count: number, tier: number) => `Cerco: um círculo de ${count} Pokémon da faixa ${tier} se fecha ao seu redor`,
    ringOf: (count: number, name: string) => `Cerco: um círculo de ${count} ${name} se fecha ao seu redor`,
  },

  guide: {
    title: 'Como jogar Pokémon Survivors: guia completo',
    description:
      'Guia do Pokémon Survivors: controles no teclado, controle e celular, como funciona a partida, níveis, golpes, evolução de golpes com itens, ataque especial, tipos e status, chefes, shinies, itens e eventos do mapa, Loja do Kecleon e co-op online.',
    h1: 'Como jogar',
    intro:
      'Pokémon Survivors é um roguelite estilo Vampire Survivors: você só anda, e o seu Pokémon ataca sozinho. Este guia explica tudo o que acontece numa partida, com os números do jogo.',
    toc: 'Neste guia',
    sections: {
      controls: 'Controles',
      run: 'A partida',
      world: 'Biomas e clima',
      horde: 'A horda selvagem',
      levels: 'Níveis e golpes',
      moveEvolutions: 'Evolução de golpes',
      special: 'Ataque especial',
      types: 'Tipos e status',
      bosses: 'Chefes',
      traits: 'Inimigos especiais',
      rifts: 'Fendas lendárias e modo sem fim',
      places: 'Lugares: caverna, cemitério e céu',
      landmarks: 'Pontos de interesse do mapa',
      megas: 'Mega Evolução',
      legends: 'Modo Lendário',
      coop: 'Co-op online',
      shinies: 'Shinies',
      eggs: 'Ovos e incubadora',
      items: 'Itens no mapa',
      mapEvents: 'Eventos no mapa',
      mart: 'Loja do Kecleon e Poké Dollars',
      missions: 'Missões e conquistas',
      settings: 'Ajustes e música',
    },
    controls: {
      head: { action: 'Ação', keyboard: 'Teclado', gamepad: 'Controle', touch: 'Toque' },
      rows: [
        ['Andar', 'WASD ou setas', 'D-pad ou analógico esquerdo', 'Arraste em qualquer lugar da tela (joystick flutuante)'],
        ['Ataque especial', 'Espaço', 'A (Xbox) ou ✕ (PlayStation)', 'Botão redondo no canto inferior direito'],
        ['Mega Evolução', 'E', 'Y (Xbox) ou △ (PlayStation)', 'Botão MEGA, acima do especial'],
        ['Bote (Quick Attack, Extreme Speed)', 'Shift', 'X (Xbox) ou □ (PlayStation)', 'Botão redondo à esquerda do especial'],
        ['Pausar', 'Esc ou P', 'Start', 'Botão no canto superior direito'],
        ['Navegar nos menus', 'Setas, Enter confirma, Esc volta', 'D-pad ou analógico esquerdo, A confirma, B volta', 'Toque'],
        ['Escolher upgrade', '1 a 3, ou ↑ ↓ e Enter', 'D-pad e A', 'Toque na opção'],
        ['Escolher o parceiro', 'Setas na grade, Tab Iniciais/Ovos, 1 a 9 região, I detalhes, Enter começa', 'D-pad (↓ na última linha leva aos Ovos) e A', 'Toque para ver, toque de novo (ou Começar) para jogar'],
        ['Ir à Loja do Kecleon', 'L no lobby (ou na escolha de parceiro), ou ande até a praça e aperte E', 'D-pad até Loja e A', 'Toque em Loja, no Kecleon ou na plaquinha que aponta para a praça'],
        ['Som liga/desliga', 'M', 'Ajustes', 'Ajustes'],
        ['Idioma', 'I na tela de título, ou Ajustes', 'Ajustes', 'PT | EN | ES na tela de título, ou Ajustes'],
      ],
      notes: [
        'No controle, o D-pad e o analógico esquerdo movem o Pokémon e navegam em todos os menus, A confirma, B volta e Start pausa. Dentro da partida, A usa o ataque especial.',
        'Em Ajustes → Controles → Teclado e controle, dá para trocar a tecla e o botão do controle de cada ação (andar, especial, Mega, bote, pausar, confirmar e voltar). As setas e o Esc sempre funcionam.',
        'No celular, dá para instalar o jogo como app em tela cheia: abra o menu do navegador e escolha "Adicionar à tela inicial".',
      ],
    },
    run: {
      paragraphs: (minutes: number, starters: number) => [
        `Escolha um dos ${starters} iniciais, de Kanto a Paldea. Cada um tem status, golpe inicial, golpes que aprende e um ataque especial próprios (veja a Pokédex).`,
        `Ande pelo campo e desvie: os golpes disparam sozinhos no ritmo da recarga. Sobreviva ${minutes} minutos de hordas cada vez maiores. No fim, Mewtwo aparece, e derrotá-lo vence a partida. Depois, se quiser, dá para continuar no modo sem fim.`,
        'Se o seu HP chegar a zero, a partida acaba (a não ser que você tenha um Revive guardado ou esteja na arena de uma fenda ou num lugar, de onde você só é mandado de volta ao mapa). Os Poké Dollars coletados vão para a carteira.',
      ],
      scaling: (rows: readonly (readonly [string, string, string])[]) =>
        `Os inimigos comuns ficam mais fortes a cada minuto (chefes não): ${rows.map(([at, hp, dmg]) => `em ${at}, ${hp}x de HP e ${dmg}x de dano`).join('; ')}.`,
      difficulty: 'Dificuldade',
      difficultyIntro:
        'Escolha a dificuldade na barra de baixo da escolha de parceiro, ao lado do botão Começar (ou com a tecla X). Todas já vêm liberadas e a escolha fica salva. O Normal é a partida base; os outros níveis multiplicam:',
      difficultyHead: ['Nível', 'HP dos inimigos', 'Dano que você leva', 'Ritmo de spawn', 'Velocidade dos inimigos', 'Escala por minuto', 'Cura'],
      timeline: 'Linha do tempo',
      timeHead: 'Tempo',
      eventHead: 'Evento',
      boss: (name: string) => `Chefe: ${name}`,
      bossChance: (name: string, percent: number) => `Chefe raro: ${name} (${n(percent)}% de chance)`,
      bossTrio: (names: string) => `Chefe: o trio lendário da partida (${names})`,
    },
    world: {
      paragraphs: (count: number, minutes: number, odds: number) => [
        `A partida atravessa ${count} biomas, ${n(minutes)} minutos em cada um, sem tela de carregamento: o chão se dissolve no cenário seguinte e cada bioma tem a sua música. Os itens quebráveis também mudam de cara (na caverna, a grama alta vira uma rocha e a árvore de frutas vira um cogumelo gigante).`,
        `Cada bioma puxa a horda para os seus tipos: as espécies novas de cada fase têm ${n(odds)}x mais chance de ser de um tipo da casa (mais Planta e Inseto na floresta, mais Pedra e Terra na caverna), sem deixar de lado os outros.`,
        'O clima muda algumas vezes por partida e vale para todo mundo: para os seus golpes e para os ataques dos inimigos. Cada bioma tem os seus climas mais prováveis, e o ícone do clima aparece ao lado do relógio.',
      ],
      timeHead: 'A partir de',
      biomeHead: 'Bioma',
      hordeHead: 'Tipos da horda',
      weatherHead: 'Climas (do mais ao menos comum)',
      weatherTitle: 'Climas',
      weatherCol: 'Clima',
      effectHead: 'Efeito',
      power: (type: string, mult: number) => `golpes de ${type} ×${n(mult)}`,
      chip: (enemy: number, boss: number, player: number, every: number, floor: number, immune: readonly string[]) =>
        `a cada ${n(every)}s, inimigos perdem ${n(enemy)}% do HP máximo (chefes, ${n(boss)}%) e você perde ${n(player)}%, mas nunca abaixo de ${n(floor)}% do HP. Os tipos ${list(immune)} ficam imunes`,
      fog: 'a visão fica curta: só dá para ver bem perto do seu Pokémon',
    },
    levels: {
      paragraphs: (moves: number, items: number, moveLevel: number) => [
        'Pokémon derrotados soltam Exp. Candies. Ande perto deles para coletar (a Dowsing Machine aumenta o alcance).',
        `A cada nível, escolha 1 de 3 ofertas: um golpe novo da lista do seu Pokémon, um upgrade de golpe, um held item novo ou mais um nível de item. Você pode ter até ${moves} golpes e ${items} itens. Golpes vão até o Nv ${moveLevel}.`,
        'Itens de tipo (Charcoal, Mystic Water…) só aparecem se o seu Pokémon aprende golpes daquele tipo. Quando não sobra nada para oferecer, vem uma Oran Berry (+40 HP).',
        'Trocar (sortear outras ofertas) e Pular (dispensar a subida de nível sem escolher nada, útil quando nenhuma oferta serve) são cargas compradas na Loja do Kecleon.',
      ],
      choices: (rarePercent: number, shinyOneIn: number) => [
        'A partida começa com um draft: com o relógio parado, você escolhe o 2º golpe entre 3 da lista do seu Pokémon.',
        'Todo golpe base se divide em dois caminhos no Nv 4 e no Nv 7: o card mostra "2 caminhos" e, ao ser escolhido, se abre nos dois. Cada caminho muda como o golpe joga (ricochetear, explodir, deixar rastro, ecoar…), não só os números.',
        `Cada card sorteia a raridade: o raro (${n(rarePercent)}% de chance, moldura azul) sobe 2 níveis de uma vez, e o shiny (1 em ${shinyOneIn}, o dobro com o Shiny Charm) é uma escolha grátis, seguida de outra.`,
        'Esquecer tira uma oferta da partida: o card sai voando, o espaço é sorteado de novo e aquele golpe, item ou golpe em dupla não volta mais. As cargas vêm do Escape Rope da Loja do Kecleon, de cada chefe derrotado e de cada evolução.',
        'A lista de golpes cresce com o Pokémon: cada evolução libera golpes novos (um aviso mostra quais), que aparecem com mais frequência nas 3 subidas de nível seguintes. São mais golpes do que espaços, então cada partida deixa alguns de fora.',
        'Chefes derrotados deixam um TM com um golpe de fora do repertório, o Tutor de Golpes ensina golpes que combinam com o seu tipo, e vencer uma fenda oferece o golpe lendário do próprio lendário (um por partida). Com os espaços cheios, aprender pede para esquecer um golpe.',
      ],
      abilities: 'Na primeira evolução (o Smeargle, que não evolui, no Nv 12), o Pokémon desperta uma Habilidade: escolha 1 de 3 (a terceira é a Habilidade Oculta), que vale até o fim da partida. Eevee, Snorunt, Scyther, Charcadet, Kirlia e Poliwhirl podem evoluir em mais de uma forma, cada uma com tipo, especial, golpes e Habilidades próprios. Os caminhos que pedem um item nos jogos oficiais pedem aqui também (Gallade e Froslass a Dawn Stone, Politoed a King\'s Rock, Scizor a Metal Coat, Kleavor a Black Augurite, Armarouge e Ceruledge as armaduras, Espeon, Umbreon, Leafeon, Glaceon e Sylveon as pedras): comprado na Loja do Kecleon, é seu pra sempre; derrubado por um chefe, vale até o fim da partida. Sem itens, o Eevee vira Vaporeon, Jolteon ou Flareon, sorteado, e com itens você escolhe; Scyther e Charcadet sem item não evoluem, mas ficam 15% mais fortes. Algumas evoluções de uma linha só também pedem item: Porygon2 o Up-Grade, Porygon-Z o Dubious Disc e Exeggutor a Leaf Stone; sem ele, a forma anterior fica, 15% mais forte.',
      evolution: (first: number, second: number) =>
        `Seu Pokémon evolui no Nv ${first} e no Nv ${second}, como nos jogos. Cada evolução dá mais HP e status, e a evolução final fortalece o ataque especial.`,
      itemsTitle: 'Held items',
      itemHead: 'Item',
      effectHead: 'Efeito por nível',
      levelsHead: 'Níveis',
    },
    moveEvolutions: {
      paragraphs: [
        'Como no Vampire Survivors: leve um golpe ao nível máximo e segure o item pareado. Na próxima subida de nível (ou na próxima Poké Ball), a evolução aparece como oferta e substitui o golpe no mesmo espaço.',
        'Um item pode evoluir mais de um golpe: Charcoal serve para Ember e para Fire Spin, por exemplo.',
      ],
      moveHead: 'Golpe (nível máx.)',
      itemHead: 'Item',
      resultHead: 'Evolução',
      noEvolution: (moves: string) => `Ainda sem evolução: ${moves}.`,
      neverEvolves: 'Golpes assinatura, de TM, lendários e em dupla não evoluem: eles já são o golpe final e crescem pelos próprios caminhos.',
      duoTitle: 'Golpes em dupla',
      duoParagraphs: [
        'Leve dois golpes ao nível máximo (ou evolua-os) e, se os tipos deles formarem uma das receitas abaixo, um card dourado oferece uni-los num golpe em dupla: ele toma o espaço do primeiro, libera o do segundo e sobe até o Nv 5. Os dois golpes usados não voltam mais. Não quer a união? Esquecer tira o card, e aquela receita não volta mais na partida.',
        'As receitas vão por tipo, então funcionam com qualquer Pokémon. Só cabe 1 golpe em dupla por partida, e a Poké Ball nunca une golpes sozinha.',
      ],
      duoTypesHead: 'Tipos',
      duoHead: 'Golpe em dupla',
      cursedTitle: 'Itens amaldiçoados',
      cursedParagraphs: (minutes: number, chance: number, max: number) => [
        `A partir de ${minutes.toLocaleString('pt-BR')} min, um baú trancado tem ${Math.round(chance * 100)}% de chance de esconder um item amaldiçoado: muito forte, mas com um preço. Você escolhe pegar ou deixar. Ele não ocupa espaço de item, fica até o fim da partida, e cabem até ${max}.`,
      ],
      cursedUpHead: 'Vantagem',
      cursedDownHead: 'Preço',
    },
    special: {
      paragraphs: (min: number) => [
        'Além dos golpes automáticos, todo Pokémon tem um ataque especial manual: aperte Espaço, o botão A / ✕ do controle ou o botão redondo na tela. Ele carrega por um instante (você anda mais devagar) e depois dispara: alguns miram na direção em que você está andando, outros acertam tudo ao redor ou caem do céu nos inimigos mais próximos. Quick Attack e Extreme Speed também são manuais, porque movem você: aperte Shift, X / □ ou o botão de bote para avançar contra o inimigo à frente.',
        `Cada um dos 18 tipos tem o seu especial, e o seu Pokémon usa o do primeiro tipo dele. A recarga diminui com o status Recarga, até o mínimo de ${min}s. Na evolução final ele vira a versão mais forte, com mais dano e área.`,
        'Algumas linhagens ágeis trocam o especial do tipo por uma investida em cadeia: o Pokémon avança cortando até o inimigo mais próximo e, se acertar, tem meio segundo para apertar de novo e saltar ao próximo, até o limite de saltos. A recarga só começa quando a cadeia acaba. O Aegislash troca o especial pela Mudança de Postura: alterna entre a Forma Escudo, que recebe menos dano, e a Forma Lâmina, que bate mais forte.',
      ],
      typeHead: 'Tipo',
      moveHead: 'Especial → evolução final',
      cooldownHead: 'Recarga',
      usersHead: 'Quem usa',
      noUsers: 'Nenhum Pokémon jogável ainda',
    },
    types: {
      chart: (strong: string, double: string, weak: string, immune: string) =>
        `O dano usa a tabela de tipos real, suavizada para nenhuma build ficar inútil: super efetivo causa ${strong}x, duplamente super efetivo ${double}x, pouco efetivo ${weak}x, e imunidade vira ${immune}x. Números amarelos com "!" indicam golpe super efetivo.`,
      statusIntro: 'Alguns golpes causam condições de status. Chance e força crescem com upgrades e itens.',
      statusHead: 'Status',
      movesHead: 'Causado por',
      effectHead: 'Efeito',
      names: { burn: 'Queimadura', poison: 'Veneno', paralysis: 'Paralisia', slow: 'Lentidão', sleep: 'Sono', freeze: 'Congelamento', mark: 'Marca', confuse: 'Confusão', seed: 'Semente', weaken: 'Enfraquecido' } satisfies Record<StatusKind, string>,
      effects: {
        burn: (attack: number) => `Dano por segundo. O inimigo queimado causa só ${n(attack * 100)}% do dano de contato.`,
        poison: (stacks: number) => `Dano por segundo que acumula até ${stacks}x.`,
        paralysis: (boss: number) => `Trava o inimigo por um instante e depois ele engasga de vez em quando. Em chefes dura ${n(boss * 100)}% do tempo.`,
        slow: (boss: number) => `Desacelera quem está perto. Em chefes dura ${n(boss * 100)}% do tempo.`,
        sleep: (seconds: number, boss: number) => `Os inimigos na tela dormem por ${seconds}s. Em chefes dura ${n(boss * 100)}% do tempo.`,
        freeze: (shatter: number, boss: number) => `Congela o inimigo no lugar. O próximo golpe causa ${shatter}x de dano e quebra o gelo. Em chefes dura ${n(boss * 100)}% do tempo.`,
        mark: (stacks: number) => `O inimigo marcado recebe mais dano de cada golpe, acumulando até ${stacks}x.`,
        confuse: () => 'O inimigo anda sem rumo e machuca os outros inimigos em que esbarra. Chefes são imunes.',
        seed: (heal: number, jumps: number) => `Dano por segundo que cura você em ${n(heal * 100)}% do dano. Quando o inimigo cai, a semente pula para ${jumps} vizinhos.`,
        weaken: (boss: number) => `Lama nos olhos: o inimigo causa menos dano de contato. Em chefes dura ${n(boss * 100)}% do tempo.`,
      } satisfies Record<StatusKind, unknown>,
      flute: 'Poké Flute (item do mapa)',
      itemsNote: 'King\'s Rock aumenta a chance de status, Toxic Orb aumenta o dano de queimadura e veneno, e Light Clay faz os status durarem mais.',
    },
    /** The Legend mode: capturing legends and playing them (`game/capture.ts`, `game/legend.ts`). */
    /** Co-op: rooms, the team's rules and what it leaves out (`COOP`, `COOP_LOCKS` in `data/coop.ts`). */
    coop: {
      paragraphs: (m: { players: number; revive: number; reviveHp: number; pick: number; vote: number }) => [
        `No lobby, Co-op abre o jogo em equipe: até ${m.players} treinadores na mesma partida, cada um com o seu Pokémon. Crie uma sala e chame os amigos pelo link (quem abre entra direto na sala), pelo código de 5 letras e números ou pela lista de Amigos, que mostra quem está online, numa sala ou jogando, e manda o convite na hora. Cada um escolhe o seu Pokémon e fica pronto, e o anfitrião escolhe a dificuldade e começa. O co-op usa a sua conta: a equipe vê o seu @nome, e o ₽ que você ganha fica salvo nela.`,
        `A EXP é da equipe: todo Exp. Candy chega para todos, então todo mundo sobe de nível junto e escolhe ao mesmo tempo (quem passa de ${m.pick}s tem a escolha feita pelo jogo). A evolução, a Habilidade, a TM ou a Poké Ball de um jogador não param a partida dos outros, e chefes e fendas deixam para cada um a própria TM, Poké Ball, prêmio de Alfa e Mega Stone.`,
        `Quem desmaia vira uma Poké Ball no chão: um colega parado ao lado por ${m.revive}s o reanima com ${m.reviveHp}% do HP. A partida acaba quando ninguém mais consegue jogar; depois do Mewtwo, a equipe tem ${m.vote}s para votar se segue no modo sem fim. Se a conexão cair, o jogo reconecta e você volta de onde parou. No fim, o ₽ da equipe é dividido entre os jogadores que começaram a partida.`,
        'Por enquanto o co-op é o modo normal: os lugares (caverna, cemitério e céu) não abrem, os pontos de interesse ficam só de enfeite, os lendários das fendas lutam na arena antiga, sem domínio, e ficam de fora o Modo Lendário, a Mochila, as TMs, os itens de evolução e as Tampinhas da loja, o Surto do dia, a Noite das Bruxas, o Desafio do dia e o ranking.',
      ],
      scaleTitle: 'A horda cresce com a equipe',
      whatHead: 'O quê',
      perHead: 'Por jogador a mais',
      scale: { spawn: 'Ritmo da horda', cap: 'Tamanho máximo da horda', hp: 'HP dos inimigos', bossHp: 'HP de chefes, Alfas e lendários', coins: 'Poké Dollars coletados' },
    },
    legends: {
      paragraphs: (m: { count: number; awaken: readonly number[] }) => [
        `Os ${m.count} lendários do jogo podem ser capturados e jogados no Modo Lendário. Para capturar um, vença-o como chefe, em qualquer modo: a cada vitória antes da captura ele escapa da Poké Ball e o jogo conta (Kyogre escapou… 2/3); na vitória que fecha a conta, ele é capturado e aparece na aba Lendários da seleção de parceiro. Vencer um shiny na vitória da captura, ou em qualquer vitória depois, libera a forma shiny.`,
        `No Modo Lendário o lendário não evolui: ele desperta no Nv ${m.awaken[0]} e no Nv ${m.awaken[1]} (Habilidade, força e uma carga de Esquecer; Kyogre e Groudon viram Primal, Rayquaza vira Mega), começa com o golpe lendário e uma habilidade inata sempre ativa, e a horda vem mais forte (Pressão), só de Pokémon evoluídos, sem formas básicas nem o surto do dia. Latias, Latios e Mewtwo Mega Evoluem com a Mega Stone e o botão MEGA, como os outros, e o especial do Deoxys troca de Forma (Normal, Ataque, Defesa, Velocidade). A partida tem o mesmo tempo de sempre, as três dificuldades continuam valendo e o modo tem um ranking só dele, separado por dificuldade: no ranking, a linha Padrão | Lendário troca de quadro.`,
        'Os lendários do mapa (o trio sorteado da partida, o mítico raro junto do Mewtwo, o Mewtwo no final e o Arceus no modo sem fim) chegam com uma entrada e um card de título e lutam em três fases, até um golpe supremo com um lugar seguro marcado. Quando caem, a captura acontece ali mesmo, numa cena rápida; os das fendas, no fim do domínio. Um lendário nunca enfrenta a si mesmo: as fendas, o trio e o mítico pulam quem você joga, e um Mewtwo enfrenta o Mewtwo Clone no final.',
      ],
      legendHead: 'Lendário',
      whereHead: 'Onde vencer',
      winsHead: 'Vitórias',
      innateHead: 'Inata',
      opensHead: 'Golpe lendário',
      pressureTitle: 'Dificuldades no Modo Lendário',
      pressure: 'A Pressão soma-se a cada dificuldade: os multiplicadores do Modo Lendário ficam assim.',
      where: { rift: 'Fenda lendária', trio: 'Trio lendário', mythical: 'Junto do Mewtwo (1 em 10)', finale: 'Chefe final', endless: 'Modo sem fim, por último', event: 'Noite das Bruxas 2026 (evento)', festival: 'Festival das Lanternas 2026 (prêmio)' },
      /** The event legends (`EVENT_LEGENDS`), after the table. */
      eventNote: 'Na Noite das Bruxas de 2026 (24 de outubro a 2 de novembro), o Darkrai chega como lenda de evento: ele só aparece na fenda do Pesadelo, que pode tomar o lugar de uma fenda numa partida assombrada, e é capturado com 2 vitórias. Joga com o Dark Void, que faz as multidões dormirem, e a inata Bad Dreams, que fere quem dorme perto dele. Depois do evento ele volta para as sombras, mas quem o capturou segue jogando com ele. Ele não conta para o Arceus.',
    },
    megas: {
      paragraphs: (m: { lines: number; twins: string; duration: number; recharge: number; intro: string }) => [
        `${m.lines} linhagens podem Mega Evoluir. O primeiro lendário de fenda que você vencer com uma delas deixa a Mega Stone da linhagem junto com o tesouro. ${m.twins} têm duas Megas: o lendário deixa as duas pedras e a que você pegar decide a Mega (a outra se desfaz). Com a pedra na mão e o Pokémon na evolução final, aparece o botão MEGA (tecla E, ou Y no controle).`,
        `Ao apertar, a Pedra-chave reage: o mundo para por ${m.intro}s enquanto a energia de arco-íris envolve o Pokémon, e a Mega Evolução termina numa explosão que empurra e fere a horda ao redor e deixa você invulnerável por um instante. A forma Mega dura ${m.duration}s, ganha os status abaixo, troca o especial pelo dela (pronto para usar na hora) e ativa a habilidade. Depois ela volta ao normal e precisa de ${m.recharge}s para Mega Evoluir de novo: guarde para um chefe, uma fenda ou um cerco.`,
      ],
      megaHead: 'Mega',
      stoneHead: 'Mega Stone',
      abilityHead: 'Habilidade',
      specialHead: 'Especial Mega',
    },
    rifts: {
      paragraphs: (r: { first: string; second: string; bossWait: number; portal: number; enter: number; battle: number; fallHp: number; shiny: number }) => [
        `Toda partida tem 2 fendas lendárias: uma por volta de ${r.first} e outra por volta de ${r.second}. Antes de cada uma vem o presságio: o clima do lendário toma o céu (chuva torrencial, sol abrasador, vendaval, tempestade, arco-íris, chuva de meteoros, o tempo tropeçando) e um rasgo enorme se abre no ar, fora da tela, com uma seta roxa na borda apontando para ele. Ele fica aberto por ${r.portal}s. Se um chefe estiver vivo na hora, a fenda espera ele cair por até ${r.bossWait}s, então as duas fendas vêm mesmo que os chefes demorem.`,
        `Entrar é opcional: fique ${n(r.enter)}s dentro do rasgo. Cada lendário tem o seu domínio (tabela abaixo), e a primeira parte é a travessia: um lugar maior que a tela, subindo para o norte, com os Pokémon que servem o lendário vindo pela frente e uma ameaça que avança atrás de você (a maré, uma parede de lava, os andares desabando, o tempo se desfazendo) e machuca quem fica para trás. No fim, o caminho de volta se fecha, a câmera viaja até o lendário e ele chega com um card de título e o seu próprio tema.`,
        `A batalha tem três fases, marcadas na barra de HP. Cada fase transforma a arena (a caverna inunda e vira ilhas, a lava sobe em canais, o topo do Pilar Celeste cai no céu) e termina num golpe supremo, sempre avisado e com um lugar seguro marcado: atrás de uma rocha, numa ilha, no vão entre os raios, embaixo das asas do Ho-Oh. Ficar parado não funciona: golpes caem onde você está. Latias e Latios lutam juntos, e o Deoxys troca de Forma a cada fase. Se a batalha passar de uns ${n(r.battle)} minutos, o domínio colapsa e joga você de volta sem recompensa.`,
        `Vencido, o lendário se ajoelha e você joga a Poké Ball: cada vitória conta para capturá-lo (veja o Modo Lendário). Cair lá dentro não encerra a partida: a fenda expulsa você para o mapa com ${r.fallHp}% do HP, sem recompensa, e o seu Revive fica guardado. O relógio da partida para lá dentro; a horda lá fora fica congelada e nada novo nasce até você voltar.`,
        `A recompensa vale o risco: muita EXP, um saco de ₽ além da chuva de chefe, Poké Balls extras, uma Rare Candy, uma Super Potion e metade do HP de volta. Em 1 de ${r.shiny} fendas o lendário é shiny e paga o dobro de ₽ e mais uma Poké Ball.`,
      ],
      domainHead: 'Domínio',
      legendHead: 'Lendário',
      typesHead: 'Tipos',
      hpHead: 'HP base',
      attacksHead: 'Ataques',
      hpNote: (percent: number) => `O HP base é o da primeira fenda, às 4:00. Depois, o HP e o dano de contato do lendário crescem com o relógio: +${n(percent)}% de HP por minuto. Cada fenda traz um lendário diferente.`,
      endlessTitle: 'Modo sem fim',
      endless: (e: { every: number; reaper: string; hp: string; returns: number; perMinute: number; reaperBonus: string }) => [
        'Depois de derrotar Mewtwo, a tela de vitória oferece continuar no modo sem fim. Quem não quiser sai com a vitória normal, e o bônus já é pago na hora.',
        `A horda não para de crescer: nascem mais inimigos, o limite na tela sobe e cercos e revoadas chegam a cada ${e.every} segundos. As fendas continuam abrindo.`,
        `Às ${e.reaper}, Arceus desce para caçar você. Ele fica mais rápido quanto mais tempo caça, até ninguém conseguir fugir, e nunca se perde: se você se afastar, ele reaparece na borda da tela. Dá para derrotá-lo, mas ele tem ${e.hp} de HP; se cair, volta ${e.returns} minutos depois, mais forte.`,
        `O tempo sobrevivido é a métrica principal: cada minuto depois de 15:00 paga ₽${n(e.perMinute)} no bônus, e cada Arceus derrotado mais ₽${e.reaperBonus}.`,
      ],
    },
    landmarks: {
      paragraphs: (p: { block: number; odds: number; open: string; tunnel: string }) => [
        `O mapa tem pontos de interesse fixos, colocados pela semente da partida como as montanhas e os lagos: no máximo um a cada ${p.block}×${p.block} trechos do mapa (${p.odds}% deles têm um), sempre com a cara do bioma em que a partida está. Ao chegar perto, uma placa de madeira mostra o nome do lugar no canto da tela.`,
        `A maioria guarda um tesouro: fique perto dele para abrir (${p.open}s, um pouco mais em alguns). Cada tesouro abre uma vez só por partida, e um brilho mostra os que ainda estão fechados. O túnel não tem tesouro, mas é um atalho: fique ${p.tunnel}s numa das bocas e você sai pela outra, do outro lado da montanha, enquanto a horda perde o seu rastro.`,
        `Alguns acenam para os jogos: um Snorlax dormindo atravessado no caminho (fique cutucando até ele acordar, e ele luta como um Alfa), um Centro Pokémon que cura todo o HP uma vez, o esconderijo da Equipe Rocket com o balão do Meowth, e dois segredos raros que o mini mapa só mostra depois que você os encontra: um caminhão abandonado no cais e uma costa onde os pixels não parecem certos.`,
        `Entre eles, moitas, troncos caídos e pedras e árvores soltas. Tudo isso bloqueia quem anda (inclusive a horda), mas Pokémon voadores, fantasmas e chefes passam por cima.`,
      ],
      names: { cottage: 'Casa Abandonada', tunnel: 'Túnel da Mina', maze: 'Labirinto de Sebes', ruins: 'Ruínas Unown', camp: 'Acampamento Abandonado', snorlax: 'Snorlax Adormecido', center: 'Centro Pokémon', rocket: 'Esconderijo da Equipe Rocket', truck: 'Caminhão do Cais', glitch: 'Costa ???' } satisfies Record<LandmarkId, string>,
      placeHead: 'Lugar',
      whatHead: 'O que tem',
      lootHead: 'Tesouro',
      what: {
        cottage: 'Uma casa de pedra sem telhado: entre pela porta. Janelas, lareira, uma cama velha e um caixote no canto, além do poço no quintal.',
        tunnel: 'Uma serra comprida com uma boca de mina em cada ponta, trilhos e um carrinho de minério.',
        maze: 'Sebes altas com um único caminho até o baú no centro. Quem anda se perde nos becos; você não precisa.',
        ruins: 'Pedras com glifos Unown em roda, um altar no meio e colunas caídas.',
        camp: 'Uma barraca, troncos em volta da fogueira ainda acesa e uma mochila esquecida.',
        snorlax: 'Uma estrada de terra entre duas fileiras de árvores e um Snorlax enorme dormindo atravessado nela. Ninguém passa.',
        center: 'Telhado vermelho, a Poké Ball sobre as portas de vidro, a Enfermeira Joy lá dentro e a Chansey na porta.',
        rocket: 'Uma barraca preta com o R vermelho, caixotes de saque e o balão do Meowth amarrado numa estaca.',
        truck: 'Um cais de madeira, o S.S. Anne ancorado e um caminhão velho que ninguém nunca tirou dali.',
        glitch: 'Uma prainha onde os tiles da costa saíram embaralhados, e algo em forma de L parado neles.',
      } satisfies Record<LandmarkId, string>,
      /** What a landmark does besides (or instead of) its loot, in the loot column. */
      extra: {
        snorlax: 'acorda e luta como Alfa: derrote-o pelo prêmio do Alfa',
        center: 'cura todo o HP, uma vez',
        truck: 'quase sempre nada. Quase.',
        glitch: 'o item sai em dobro',
      } satisfies Partial<Record<LandmarkId, string>>,
      noLoot: 'Atalho: entre por uma boca, saia pela outra',
      loot: (l: { coins: string; items: number; berries: number; xp: number; egg: number }) =>
        [l.coins, l.items > 0 ? `${l.items === 1 ? 'um item' : `${l.items} itens`}` : '', l.berries > 0 ? `${l.berries} Oran Berries` : '', l.xp > 0 ? `Exp. Candy (cerca de ${l.xp}% de um nível)` : '', l.egg > 0 ? `${l.egg}% de chance de um ovo` : '']
          .filter(Boolean)
          .join(', '),
    },
    places: {
      paragraphs: (p: { first: string; every: number; bossWait: number; open: number; enter: string; rescue: number }) => [
        `A partir de ${p.first}, mais ou menos a cada ${n(p.every)} minutos, a entrada de um lugar aparece fora da tela, com uma seta na borda apontando para ela: a boca de uma caverna num morro, o portão de um cemitério ou uma corrente de ar entre pedras. Ela fica aberta por ${p.open}s e, se um chefe estiver vivo, espera ele cair por até ${p.bossWait}s. A partida mostra lugares diferentes antes de repetir algum.`,
        `Entrar é opcional: fique ${p.enter}s na porta. Lá dentro o mundo espera, como numa fenda: a horda fica congelada e nada novo nasce, mas o relógio da partida continua. Cada lugar tem seus próprios Pokémon, que ficam mais fortes conforme a partida avança, e um limite de tempo; quando ele acaba, você sai pela porta por onde entrou. Se desmaiar lá dentro, a partida não acaba: uma equipe de resgate leva você de volta à porta com ${p.rescue}% do HP, sem a recompensa e com o Revive guardado.`,
      ],
      names: { cave: 'Caverna Escura', graveyard: 'Cemitério Assombrado', sky: 'Acima das Nuvens' } satisfies Record<PlaceId, string>,
      placeHead: 'Lugar',
      timeHead: 'Tempo',
      speciesHead: 'Quem vive lá',
      seconds: (s: number) => `${s}s`,
      cave: (c: { floors: number; light: number; fire: number; electric: number; time: number; wind: string; house: number; egg: number }) => [
        `Caverna Escura, uma Mystery Dungeon: ${c.floors} andares de salas e corredores no escuro, sorteados a cada visita, e depois a câmara do tesouro. Você só enxerga um círculo de luz em volta do seu Pokémon (${c.light} px); os de Fogo carregam uma chama (${c.fire} px) e os Elétricos usam Flash (${c.electric} px). Cristais brilham nas salas, e os Pokémon no escuro mostram só os olhos.`,
        `Ache a escada de cada andar, que brilha no escuro, e desça; itens e ₽ ficam pelo chão. Na câmara do tesouro, o baú é guardado por uma Casa de Monstros com ${c.house} Pokémon (mais um a cada 2 minutos de partida): fique perto dele para abrir. Ele paga ₽, uma Poké Ball, uma Rare Candy e uma Super Potion, com ${c.egg}% de chance de um ovo.`,
        `Como nos jogos, um vento avisa três vezes (faltando ${c.wind}) e, aos ${c.time}s, sopra você para fora da caverna.`,
      ],
      graveyard: (g: { spirits: number; time: number; shiny: number; hp: string; egg: number }) => [
        `Cemitério Assombrado: só fantasmas vivem lá, e eles saem das covas. Eles atravessam as lápides; você não. Cada fantasma derrotado manda o espírito para a Pedra Peculiar no meio do cemitério.`,
        `Com ${g.spirits} espíritos, a pedra racha e Spiritomb desperta (${g.hp} de HP às 1:30, mais com o relógio; 1 em ${g.shiny} é shiny). Vencê-lo paga ₽, uma Poké Ball, uma Rare Candy, uma Super Potion, cura 30% do HP e tem ${g.egg}% de chance de um ovo. Aos ${g.time}s o dia nasce e os fantasmas somem, com ou sem Spiritomb derrotado.`,
      ],
      sky: (s: { time: number; tailwind: number; every: number; flock: number }) => [
        `Acima das Nuvens: só um Pokémon do tipo Voador consegue subir pela corrente de ar, e ela nem aparece para quem não voa. Lá em cima você voa com o vento a favor (+${s.tailwind}% de velocidade), só Pokémon voadores aparecem e um bando atravessa o céu a cada ${s.flock}s.`,
        `A cada ${s.every}s uma asa chega com o vento e atravessa o céu: pegue antes que ela passe. Cada asa melhora um atributo até o fim da partida. Aos ${s.time}s o vento acalma e você plana de volta.`,
      ],
      wingHead: 'Asa',
      effectHead: 'Efeito',
      wings: {
        healthWing: (n: number) => `+${n} de HP máximo`,
        muscleWing: (n: number) => `+${n}% de dano`,
        resistWing: (n: number) => `+${n} de defesa`,
        swiftWing: (n: number) => `+${n} de velocidade`,
        prettyWing: (n: number) => `₽${n} na hora`,
      } satisfies Record<WingId, (n: number) => string>,
    },
    bosses: {
      paragraphs: (r: BossRules) => [
        'Os chefes chegam em horários fixos. Os lendários entram com flash na tela, cry e um aviso. Todos têm uma barra de HP no topo e ataques próprios: os círculos marcados no chão avisam onde o golpe vai cair, então saia de dentro deles.',
        `Cada chefe alterna entre dois jeitos de lutar a cada ${r.stance[0]} a ${r.stance[1]} segundos: de perto, ele avança rápido e bate em área ao redor de si; de longe, para a alguns passos e mira em você. Abaixo de ${n(r.below * 100)}% do HP ele fica furioso (contorno vermelho, cry e flash na tela): ${n(Math.round((r.speed - 1) * 100))}% mais rápido, ataca ${n(Math.round((1 - r.wait) * 100))}% mais seguido e, ${n(r.chain * 100)}% das vezes, emenda um segundo ataque logo depois do primeiro.`,
        `Ficar parado não funciona: cada chefe mira onde você está ou no caminho por onde você vai, e quem foge para longe leva um salto ou uma rajada mirada. A fúria também libera um ataque novo. No Difícil os chefes atacam ${n(Math.round((1 - r.press.hard.pace) * 100))}% mais seguido, com ${n(Math.round((r.press.hard.more - 1) * 100))}% mais projéteis e avisos um pouco mais curtos, e furiosos emendam ${n(r.press.hard.chain * 100)}% das vezes; no Pesadelo, ${n(Math.round((1 - r.press.nightmare.pace) * 100))}% mais seguido, ${n(Math.round((r.press.nightmare.more - 1) * 100))}% mais projéteis, ${n(r.press.nightmare.chain * 100)}% de emendas e um ataque a mais cada um. Os lendários do mapa (o trio, o mítico, Mewtwo e Arceus) lutam em três fases, marcadas na barra de HP: cada fase traz um jeito novo de se mover (voo com sombra, investidas, teleporte, cerco) e a última, um golpe supremo com um lugar seguro marcado (abrigos, o vão entre as lanças, a saída de um anel, longe ou colado no chefe). Do Difícil para cima, a última fase do Mewtwo ainda salta e dispara rajadas largas.`,
        'Chefes não ficam mais fortes com o tempo, mas cada um solta uma Poké Ball e uma chuva de Poké Dollars.',
        `Nos primeiros ${r.window}s de cada chefe, com ele por perto, nascem só ${n(r.fight * 100)}% dos inimigos comuns, então a luta é com ele; depois a horda volta. Cada chefe tem até o próximo chegar: se ainda estiver de pé quando o seguinte aparecer, ele foge e não deixa nada. Mewtwo é o último: ao chegar, empurra a horda para longe e, enquanto ele estiver de pé, nascem só ${n(r.finale * 100)}% dos inimigos comuns, então a luta é desviar dos ataques dele.`,
      ],
      trios: (times: readonly string[], trios: readonly string[], mythicals: string, percent: number) => [
        `Às ${list(times)} chegam os três membros de um trio lendário, sorteado no começo de cada partida: ${list(trios)}. HP, dano de contato e velocidade são do horário, não do Pokémon, então nenhum sorteio é mais fácil que outro; o que muda são os ataques.`,
        `No fim, com ${n(percent)}% de chance, um Pokémon mítico chega junto com o Mewtwo: ${mythicals}, também sorteado por partida.`,
      ],
      timeHead: 'Tempo',
      bossHead: 'Chefe',
      hpHead: 'HP',
      attacksHead: 'Ataques',
    },
    traits: {
      paragraphs: (from: string, cap: number, alive: number) => [
        `Alguns Pokémon selvagens não só perseguem: eles curam, protegem e chamam a horda, ou atacam de longe. São tempero, não a maioria: a partir de ${from}, cada fase traz no máximo ${cap === 1 ? 'uma espécie' : `${cap} espécies`} com comportamento, ela aparece menos que as outras e nunca há mais de ${alive} vivos ao mesmo tempo. Vale a pena ficar de olho.`,
        'Todo ataque deles avisa antes: um "!" sobre a cabeça, um círculo vermelho, uma linha ou uma sombra no chão que pisca mais rápido quando o golpe está perto. Na primeira vez que cada um aparece numa partida, um aviso explica o que ele faz.',
      ],
      pokemonHead: 'Pokémon',
      traitHead: 'Comportamento',
      effectHead: 'O que faz',
    },
    shinies: {
      paragraphs: (wild: number, hp: number, xp: number, player: number, rift: number, species: number) => [
        `Cada Pokémon selvagem comum tem 1 chance em ${n(wild)} de nascer shiny. Ele vira uma elite com ${hp}x de HP e ${xp}x de EXP, e sempre solta uma Poké Ball e Poké Dollars. Os chefes do mapa, o Mewtwo e o Arceus nunca são shiny, mas o lendário de uma fenda tem 1 chance em ${rift} de ser, e paga mais.`,
        `O seu inicial tem 1 chance em ${player} de ser shiny, e continua shiny em todas as evoluções daquela partida.`,
        'A Poké Ball (de chefes e shinies) dá um upgrade aleatório na hora, ou uma evolução de golpe se alguma estiver pronta.',
        `Shiny derrotado vira seu: ele fica marcado como capturado, com o brilho, na Pokédex do jogo (Pokédex, no menu do título). Também contam como capturados o Pokémon que sai de um ovo (e a linha evolutiva dele fica vista) e cada forma que você jogou, inclusive as que alcançou evoluindo. A Pokédex tem as ${species} espécies do jogo, lembra cada uma que você viu e quantas derrotou, e o fim da partida mostra o que entrou de novo.`,
      ],
      seeAll: 'Veja todos os shinies na Pokédex',
    },
    eggs: {
      /** The incubator's upgrades (`INCUBATOR` in data/shop.ts): the slots sold, each with its price and shop level, and the Quick Incubator. */
      incubator: (m: { max: number; slots: readonly { n: number; price: string; level: string }[]; quick: string; speed: number }) =>
        `A aba Incubadora da loja do Kecleon vende mais vagas, que são suas para sempre: ${m.slots.map((s) => `a ${s.n}ª por ${s.price} (com a loja em ${s.level})`).join(' e ')}, até ${m.max} vagas. Ela também vende a Incubadora Rápida (${m.quick}): na incubadora, toque num ovo para usar, e ele anda ${m.speed}x mais rápido até chocar.`,
      paragraphs: (starters: number, families: number, slots: number, perRun: number, stepPx: number, shiny: number, weight: number) => [
        `Além dos ${starters} iniciais, ${families} famílias de Pokémon jogáveis saem de ovos, de todos os tipos e gerações: são ${starters + families} Pokémon para jogar. Cada uma tem golpe inicial, especial, evolução no meio da partida e status próprios.`,
        `Chefes, baús trancados e fendas às vezes deixam um ovo, no máximo ${perRun} por partida. Ele vai para a incubadora, que tem ${slots} vagas. Cada ${stepPx} px andados numa partida contam um passo, e todos os ovos da incubadora andam juntos. O ovo achado no meio da partida já conta os passos dados depois dele.`,
        `Quando um ovo fica pronto, ele choca ao sair da partida ou na incubadora (no menu inicial e na aba Ovos da escolha de parceiro). Famílias que você ainda não tem saem ${weight}x mais. O filhote tem 1 chance em ${shiny} de ser shiny, e aí fica shiny em todas as partidas.`,
        'Um repetido, ou um ovo achado com a incubadora cheia, vira Poké Dollars. O jogador que nunca teve um ovo ganha o primeiro com certeza.',
        'O Ovo da Amizade não cai em partidas: ele chega como Presente Misterioso quando você cria a conta pelo convite de alguém, e quando um amigo que você convidou termina 3 partidas. Só sai Munchlax dele. Com 3 amigos você ganha o título Embaixador(a) e uma moldura exclusiva, com 5, um Ovo ultra raro, e com 10, um Dratini shiny. O seu link e o progresso de cada amigo ficam no card Convide amigos, na tela inicial.',
        'O Ovo Assombrado também não cai em partidas: só a barraca do Duskull vende, na praça, durante a Noite das Bruxas (24/10 a 2/11), um por dia. Dele só saem Litwick, Phantump, Drifloon e Sandygast, 25% cada, tenha você já ou não. Depois do evento, ele só volta no ano que vem.',
        'O Ovo do Kecleon também não cai em partidas: ele fica fixo na Vitrine da loja: o primeiro do dia custa ₽ 10.000 e cada um depois custa o dobro do anterior, até 6 por dia (₽ 320.000 o sexto). Dele só saem Porygon, Exeggcute, Scraggy e Smeargle, 25% cada. Porygon2 pede o Up-Grade, Porygon-Z o Dubious Disc e Exeggutor a Leaf Stone; o Smeargle não evolui, mas o Sketch copia o golpe do inimigo mais perto. Com 100 carimbos no cartão fidelidade, vem um Ovo do Kecleon com shiny garantido.',
      ],
      tierHead: 'Ovo',
      stepsHead: 'Passos',
      refundHead: 'Repetido ou sem vaga',
      familiesHead: 'Pode chocar',
      sourceHead: 'Onde cai',
      chanceHead: 'Chance',
      oddsHead: 'Raridade',
      sources: {
        boss: 'Onix, Snorlax e o trio lendário',
        chest: 'Baú trancado',
        rift: 'Lendário de uma fenda',
        place: 'Baú da caverna e Spiritomb, no cemitério',
        final: 'Mewtwo e o mítico raro (Mew, Celebi ou Jirachi)',
        reaper: 'Arceus, no modo sem fim',
        mission: 'Missão de campo: o ninho defendido (Normal / Difícil / Pesadelo)',
      } satisfies Record<EggSource, string>,
    },
    items: {
      intro: 'Pelo mapa aparecem fontes de itens. Qualquer golpe quebra elas, e cada uma solta um item. Itens mais fortes ficam mais comuns no fim da partida.',
      sourceHead: 'Fonte',
      hitsHead: 'Golpes para quebrar',
      enemyNote: (berry: number, item: number) =>
        `Inimigos comuns também soltam uma Oran Berry (${n(berry)}% de chance) ou um item (${n(item)}%).`,
      sources: { itemBall: 'Item Ball', berryTree: 'Berry Tree', tallGrass: 'Mato alto', enemy: 'Inimigos' },
      itemHead: 'Item',
      effectHead: 'Efeito',
      whereHead: 'Onde aparece',
      effects: {
        oranBerry: 'Recupera 30% do HP máximo.',
        potion: 'Recupera 30 HP.',
        superPotion: 'Recupera 60 HP.',
        rareCandy: 'Sobe um nível na hora.',
        expShare: 'Puxa todos os Exp. Candies do mapa até você.',
        pokeFlute: 'Põe para dormir os Pokémon selvagens na tela.',
        maxRepel: 'Invulnerável por alguns segundos, empurrando os inimigos para longe.',
        explosion: 'Voltorb usa Explosion: derruba todos os inimigos comuns na tela e tira 10% do HP de chefes.',
        xAttack: 'Mais 50% de dano por 20s.',
        xSpeed: 'Mais velocidade e recarga mais rápida por 20s.',
        revive: 'Fica guardado. Quando você desmaiar, levanta com 50% do HP.',
      } satisfies Record<Drop, string>,
    },
    mapEvents: {
      intro: (first: number, gap: number, max: number) =>
        `A partir de ${first}s de partida, a cada ${gap}s mais ou menos um ponto de interesse pode surgir perto de você (no máximo ${max} ao mesmo tempo). Os importantes ganham uma seta na borda da tela. Se você demorar, eles somem.`,
      eventHead: 'Evento',
      howHead: 'Como funciona',
      rewardHead: 'Recompensa',
      altar: {
        name: 'Altar',
        how: 'Pise nele. O buff que ele dá aparece flutuando acima, para você decidir de longe.',
        reward: (boost: number) => `X Attack, X Speed ou Max Repel (o sorteio evita o que já está ativo), com ${n(boost)}x a duração normal.`,
      },
      fountain: {
        name: 'Fonte',
        how: (charges: number, interval: number) => `Fique nela enquanto estiver ferido: ${charges} cargas, uma a cada ${n(interval)}s. Com HP cheio, nada é gasto.`,
        reward: (heal: number) => `Cada carga recupera ${n(heal)}% do HP máximo.`,
      },
      chest: {
        name: 'Baú com cadeado',
        how: (unlock: number) =>
          `Fique dentro do anel por ${unlock}s. Fora dele, o progresso volta devagar. Assim que você começa, uma emboscada de Pokémon selvagens fecha o cerco.`,
        reward: (coins: string) => `${coins} ou mais (cresce com o tempo), um item e uma Poké Ball.`,
      },
      spikes: {
        name: 'Espinhos',
        how: 'Os espinhos sobem de tempos em tempos, com um aviso piscando antes. Ferem quem estiver em cima: você e os selvagens.',
        reward: 'Atraia a horda para cima deles.',
      },
      bomb: {
        name: 'Bomba',
        how: (fuse: number) => `Qualquer um que chegue perto acende o pavio. ${n(fuse)}s depois ela explode e fere tudo no raio, inclusive você.`,
        reward: 'Deixe a horda acender e saia de perto.',
      },
      meowth: {
        name: 'Meowth fugindo',
        how: (ttl: number) => `Corre de você e escapa em ${ttl}s. Seus golpes acertam ele.`,
        reward: (jackpot: string) => `Uma moeda a cada golpe e o Pay Day (${jackpot}) se ele desmaiar.`,
      },
      tutor: {
        name: 'Tutor de Golpes',
        how: (from: number, until: number) => `Arma a tenda uma vez entre ${from} e ${until} min (às vezes mais uma). Fique no círculo dela.`,
        reward: (price: string) => `Ensina 1 de 2 golpes que combinam com o tipo do seu Pokémon e que ele não aprende sozinho (nunca um golpe de Água para o Grovyle). A primeira aula é grátis; a próxima custa ${price} da partida.`,
      },
      field: {
        name: 'Missões de campo',
        how: (first: string, gap: number) =>
          `A partir de ${first}, uma por vez, a cada ${gap} min mais ou menos, longe de você e contra o relógio: defender um ovo no ninho de uma invasão (fique no anel), achar Poké Balls perdidas espalhadas ou levar um Togepi perdido até o ninho. Ignorar não custa nada.`,
        reward: 'Um nível com cartas raras (no Pesadelo a primeira é shiny), ₽ e o prêmio da missão: uma chance de ovo, um item e cura.',
      },
    },
    mart: {
      paragraphs: (coins: readonly number[], minute: number, kills: number, victory: number) => [
        `Inimigos derrotados às vezes soltam Poké Dollars: moeda, pilha e saco (${list(coins.map((c) => `₽${n(c)}`))}). Os mais fortes soltam com mais frequência, e chefes e shinies sempre pagam.`,
        `No fim da partida entra um bônus: ₽${minute} por minuto sobrevivido, ₽1 a cada ${kills} derrotados e ₽${n(victory)} pela vitória. Quem desiste pela pausa fica com as moedas, mas perde o bônus.`,
        'Gaste tudo na Loja do Kecleon, na praça a leste da casa do seu parceiro no lobby. A Vitrine do dia é igual para todo mundo e vira à meia-noite de Brasília: um brinde grátis por dia, o Ovo do Kecleon (até 6 por dia, cada um pelo dobro do anterior), uma oferta com 30% off, consumíveis para a Mochila, o ovo do dia e um estilo. O irmão roxo do Kecleon vende TMs (compradas uma vez, você arma antes da partida e a primeira TM que cair é ela) e itens de evolução: o caminho que pede um item só abre com ele (sem a Dawn Stone, nada de Gallade), e um chefe também pode derrubar um na partida, só para ela. No Treino ficam as melhorias permanentes: o botão Reembolsar devolve tudo o que você gastou nelas, para testar outras combinações. Lá também ficam as Tampinhas: +3% em tudo por nível, até 3, só para o Pokémon que as recebe. Na Expansão você investe para a loja crescer (Carrinho, Tenda, Loja, Kecleon Mart e Loja de Departamento), com mais itens na Vitrine e na Mochila. Na Incubadora, vagas extras para a incubadora (para sempre) e a Incubadora Rápida, que faz um ovo andar o dobro. De sexta a domingo, a partir do Kecleon Mart, a caravana do Meowth para na praça com um ovo ultra, a Tampinha Dourada e TMs exclusivas; com 7 carimbos no cartão fidelidade (um por dia em que você passa na loja) ele dá 20% de desconto. Sem conta, o progresso fica salvo só neste navegador.',
        'Festival da Praça: cerca de uma vez por mês, por 14 dias, a fonte da praça do Kecleon vira um pote da comunidade. Com uma conta (com @nome e 3 partidas terminadas), você joga ₽ na fonte, de ₽ 100 até ₽ 200 mil por dia. Cada marco que o pote passa vira um Presente para todos os jogadores, até para quem jogou como convidado ou não doou, e fica na caixa de Presentes até 7 dias depois do fim. Quem doa ₽ 50 mil num festival ganha o título Mecenas, e os 10 maiores doadores aparecem na placa da fonte (dá para esconder o seu nome). O primeiro é o Festival das Lanternas, de 03/11 a 16/11.',
      ],
      upgradeHead: 'Melhoria',
      effectHead: 'Efeito',
      pricesHead: 'Preço por nível',
    },
    missions: {
      paragraphs: (daily: number, weekly: number, dailyRewards: string, weeklyRewards: string, medals: string) => [
        `Missões fica no menu da tela de título. Todo dia saem ${daily} missões diárias (${dailyRewards}) e toda semana ${weekly} semanais (${weeklyRewards}). Elas são sorteadas pela data do seu aparelho, então todo mundo recebe as mesmas no mesmo dia: as diárias trocam à meia-noite e as semanais na segunda-feira.`,
        'O progresso conta no fim de cada partida, mesmo se você desistir pela pausa, e soma as partidas do dia ou da semana. Missões de sobreviver, de nível, do modo sem fim e de espécies vistas contam a sua melhor partida. As missões usam o que o jogo tem: derrotar Pokémon de um tipo, num clima ou num bioma, vencer fendas, abrir baús, pegar o Pay Day do Meowth, derrotar shinies e chefes, coletar Poké Dollars, andar, ver espécies diferentes, chocar ovos (conta quando o ovo choca) e vencer o Mewtwo com um inicial de certo tipo. A recompensa cai direto na carteira, e algumas semanais também dão um ovo.',
        `As conquistas são metas para a vida toda, com medalha de bronze, prata ou ouro (${medals}). Algumas dão um título, como Caçador de Shinies: toque nela na aba Conquistas para exibi-lo na tela de título e no resultado de cada partida. Ovos de recompensa vão para a incubadora (cheia, eles viram Poké Dollars) e, no fim de uma partida, dividem com os ovos achados o limite de ovos por partida.`,
      ],
      medalHead: 'Medalha',
      nameHead: 'Conquista',
      goalHead: 'Como conseguir',
      titleHead: 'Título',
      medals: { bronze: 'Bronze', silver: 'Prata', gold: 'Ouro' },
    },
    settings: {
      paragraphs: [
        'Os Ajustes ficam no menu da tela de título e no menu de pausa, que tem só Continuar · Ajustes · Desistir. Tudo vale na hora e fica salvo neste navegador.',
        'A trilha sonora é original, em estilo chiptune, composta em código e sintetizada ao vivo no navegador, sem arquivos de áudio: um tema de vila nos menus, uma marcha durante a partida e um tema de chefe enquanto um chefe está vivo.',
      ],
      optionHead: 'Opção',
      effectHead: 'O que faz',
      rows: [
        ['Música', 'Volume da trilha sonora.'],
        ['Efeitos', 'Volume dos efeitos sonoros e dos cries.'],
        ['Som', 'Liga ou desliga todo o som (atalho: M).'],
        ['Números de dano', 'Mostra ou esconde os números de dano na tela.'],
        ['Tremor de tela', 'Liga ou desliga o tremor em explosões e golpes fortes.'],
        ['Idioma', 'Troca entre português, inglês e espanhol.'],
      ],
    },
    cta: 'Pronto? Escolha seu parceiro e jogue.',
  },

  changelog: {
    title: 'Novidades do Pokémon Survivors: histórico de atualizações',
    description:
      'Tudo o que mudou no Pokémon Survivors, atualização por atualização: iniciais, chefes lendários, shinies, evolução de golpes, Loja do Kecleon, versão mobile e mais.',
    h1: 'Novidades',
    intro: 'Tudo o que mudou no jogo, atualização por atualização, da mais nova para a mais antiga. Cada uma abre com os destaques.',
    changes: (n: number) => `Todas as mudanças (${n})`,
  },

  support: {
    title: 'Apoie o Pokémon Survivors | Doe por Pix ou cartão',
    description:
      'O Pokémon Survivors é grátis, sem anúncios e sem compras. Se quiser ajudar a pagar os servidores, doe por Pix ou cartão brasileiro (AbacatePay) ou, de outros países, com cartão, Apple Pay ou Google Pay (Stripe). Com uma conta, quem doa ganha um agradecimento cosmético no jogo: título, moldura, selo, um shiny à escolha e um companheiro.',
    h1: 'Apoie o projeto',
    lead: 'O jogo é grátis e vai continuar assim, sem anúncios e sem nada à venda. Se ele te divertiu e você quiser ajudar a pagar os servidores (contas, ranking e o Desafio do dia), qualquer valor ajuda. Como agradecimento, quem doa com uma conta ganha recompensas cosméticas no jogo, nada que mude uma partida.',
    thanks: 'Obrigado pelo apoio! ♥',
    status: {
      pending: 'Confirmando o pagamento… Pode levar alguns minutos (deixe esta página aberta).',
      late: 'O pagamento ainda não foi confirmado. Volte a esta página daqui a pouco para ver seu código.',
      sent: (handle: string) => `As recompensas foram para @${handle}. Elas chegam como Presente Misterioso na próxima sincronização do jogo.`,
      code: 'Seu código de resgate:',
      codeHint: 'No jogo, entre na sua conta e abra o Hall da Fama do título → Tenho um código. Ele vale uma vez, para a conta que resgatar: pode ser a de um amigo.',
      copy: 'Copiar',
      copied: 'Copiado!',
      used: 'O código desta doação já foi resgatado.',
    },
    account: {
      title: 'Para quem vão as recompensas',
      label: 'Seu @ no jogo',
      placeholder: 'seu_arroba',
      hint: 'Opcional. Com o @ de uma conta (a sua ou a de um amigo), as recompensas vão direto para ela. Sem ele, você recebe um código para resgatar no jogo.',
      checking: 'Procurando…',
      found: (name: string) => `Para ${name}`,
      missing: 'Ninguém tem esse @ no jogo.',
    },
    perks: {
      title: 'O que quem doa ganha',
      items: [
        'O título e a moldura de cartão Apoiador(a).',
        'Um selo ♥ ao lado do @ no ranking e no perfil.',
        'Um shiny à sua escolha: qualquer inicial ou família dos ovos (uma família ainda não chocada vem junto).',
        'Um companheiro que te segue nas partidas.',
        'O nome no mural abaixo e nos agradecimentos da vitória.',
        'Voto no próximo Pokémon dos ovos.',
        'Ouro, com R$ 50 ou US$ 10 somados: fundo de cartão, papel de parede da Caixa do PC e selo dourados.',
      ],
      note: 'Tudo cosmético: nada muda uma partida nem o ranking. As recompensas precisam de uma conta no jogo (entrar com Google é grátis).',
    },
    wall: { title: 'Mural de apoiadores', empty: 'Ainda ninguém por aqui. Seu nome pode ser o primeiro!' },
    pick: 'Escolha como pagar',
    suggested: 'Sugerido para você',
    br: {
      title: 'No Brasil',
      methods: 'Pix ou cartão de crédito, em reais.',
      amount: 'Valor da doação',
      other: 'Outro valor',
      range: (min: number, max: number) => `De R$ ${min} a R$ ${max}, sem centavos.`,
      cta: (amount: number) => `Doar R$ ${amount}`,
      loading: 'Abrindo o pagamento…',
      error: 'Não deu para abrir o pagamento agora. Tente de novo em instantes.',
      via: 'O pagamento abre na AbacatePay. Seus dados de pagamento vão direto para eles.',
    },
    intl: {
      title: 'Outros países',
      methods: 'Cartão, Apple Pay ou Google Pay, em dólares.',
      cta: 'Doar pelo Stripe',
      via: 'Você escolhe o valor na próxima página, que abre no Stripe. Seus dados de pagamento vão direto para eles.',
    },
  },

  legal: {
    title: 'Legal, privacidade e créditos | Pokémon Survivors',
    description:
      'Pokémon Survivors é um fan game não oficial e gratuito, sem anúncios e sem compras. Licenças (código MIT, sprites CC BY-NC 4.0), privacidade (contas opcionais com perfil público no ranking; como convidado, nada sai do seu aparelho), créditos e contato.',
    h1: 'Legal, privacidade e créditos',
    sections: {
      fanGame: 'Fan game não oficial',
      free: 'Grátis, sem anúncios e sem compras',
      licenses: 'Licenças e créditos',
      privacy: 'Privacidade',
      contact: 'Contato e remoção de conteúdo',
    },
    fanGame: [
      'Pokémon Survivors é um fan game não oficial e sem fins lucrativos, feito por fãs para fãs por Pedro Barretto.',
      'Não tem nenhum vínculo com Nintendo, The Pokémon Company, GAME FREAK inc., Creatures Inc. ou Spike Chunsoft, nem é endossado, patrocinado ou aprovado por elas.',
      'Pokémon e os nomes dos personagens são marcas registradas da Nintendo. Pokémon © Nintendo, Creatures Inc. e GAME FREAK inc. As demais marcas pertencem aos seus donos.',
    ],
    free: [
      'O jogo é gratuito e vai continuar assim: não tem anúncios, conteúdo pago nem compras dentro do app.',
      'Poké Dollars (₽) existem só dentro do jogo e não podem ser comprados com dinheiro de verdade.',
      'Quem quiser pode doar na página Apoie o projeto. Doações são voluntárias e, com uma conta, dão só um agradecimento cosmético (título, moldura, selo, um shiny à escolha, um companheiro), nada que mude uma partida ou o ranking.',
    ],
    licenses: {
      code: 'Código-fonte',
      codeText: 'Licença MIT. Ela cobre só o código original deste projeto e não dá nenhum direito sobre personagens, nomes, sons ou artes de Pokémon.',
      sprites: 'Sprites e retratos',
      spritesText: 'PMD SpriteCollab, sob a licença CC BY-NC 4.0 (uso não comercial, com crédito). Cada artista está listado nos créditos.',
      creditsLink: 'Ver os créditos de cada artista (CREDITS.md)',
      cries: 'Cries (sons dos Pokémon)',
      criesText: 'PokéAPI/cries.',
      fonts: 'Fontes',
      fontsText: 'Press Start 2P e VT323, sob a SIL Open Font License (OFL), e Cubic 11 (俐方體11號) para o chinês, de uso livre. Servidas pelo próprio site.',
      /** Translation credits (`data/translators.ts`): each reviewed language (a key per `Locale`), named in this language. */
      translation: 'Tradução',
      languages: { pt: 'português', en: 'inglês', es: 'espanhol', fr: 'francês', zh: 'chinês' },
      reviewedBy: (language: string, name: string, discord: string) => `Tradução para o ${language} revisada por ${name}, moderadora do nosso Discord (${discord}). Perfil no jogo:`,
      inspiration: 'Inspiração',
      inspirationText: 'Vampire Survivors, da poncle.',
      nonCommercial: 'Como os sprites são CC BY-NC, o jogo como um todo não pode ser usado comercialmente.',
    },
    privacy: [
      'Jogar como convidado é o padrão e não exige cadastro: o jogo não usa cookies nem anúncios e não pede nenhum dado pessoal, como nome ou e-mail.',
      'Tudo o que o jogo lembra fica no localStorage do seu navegador, no seu aparelho. Como convidado, nada disso é enviado para nenhum servidor, a não ser o identificador aleatório do ph_ps, que vai junto com as estatísticas de uso (abaixo):',
    ],
    storage: {
      'ps:save': 'Poké Dollars, melhorias compradas na Loja do Kecleon, a Pokédex do jogo (espécies vistas, quantas você derrotou e quais capturou), os ovos da incubadora (eggs), os Pokémon chocados (hatched), progresso das missões, conquistas, recordes (como Pokémon derrotados e o maior tempo sobrevivido) e o título escolhido.',
      'ps:settings': 'Ajustes: volume da música e dos efeitos, som ligado ou desligado, números de dano e tremor de tela.',
      'ps:lang': 'Idioma escolhido (português, inglês ou espanhol).',
      'ps:muted': 'Só em quem jogou versões antigas: o som desligado de antes dos Ajustes. O jogo apenas lê essa chave, não grava mais.',
      'ps:account': 'Só se você entrar com uma conta: qual conta está conectada neste aparelho (o id dela, seu nome e seu nome de usuário) e a última versão do progresso que ele sincronizou.',
      'ps:runs': 'Só com uma conta: resultados de partidas que ainda não chegaram ao ranking (por exemplo, sem internet). Saem daqui assim que o servidor recebe.',
      ph_ps: 'Um identificador aleatório deste aparelho, que o PostHog usa para contar partidas e erros (abaixo). Ele não diz quem você é.',
    },
    account: [
      'Contas são opcionais e servem para guardar o progresso na nuvem e continuar em outro aparelho. O login é com o Google, feito pelo Clerk (clerk.com), que recebe do Google seu nome, e-mail e foto e usa cookies próprios para manter você conectado. O jogo nunca vê sua senha.',
      'Com uma conta, uma cópia do ps:save fica no nosso servidor, ligada ao id da sua conta. Ela é enviada quando você entra, quando abre o jogo e no fim de cada partida. No nosso servidor ficam o id da conta, o progresso, as datas de criação e de uso e o que o ranking precisa (abaixo), sem seu e-mail.',
      'Com uma conta, cada partida também vai para o ranking: o Pokémon, a dificuldade, o tempo sobrevivido, o nível, quantos inimigos você derrotou, se venceu e a versão do jogo, com a hora em que a partida começou e terminou, ligados ao id da sua conta. Partidas de convidado não vão para o ranking. Junto vai o replay da partida (a semente e os comandos que você deu, sem nada pessoal), que o servidor pode jogar de novo para conferir o resultado. Ele é apagado depois da conferência, ou logo que o servidor decide não conferir a partida.',
      'Seu perfil é público. Ao entrar, você escolhe um nome de exibição e um nome de usuário único, que vai no link do perfil. Qualquer pessoa, com ou sem conta, pode ver no ranking e no perfil: esses dois nomes, o título equipado, os recordes por dificuldade, o progresso da Pokédex, as partidas recentes e quantos seguidores você tem e quantos segue. Seu e-mail e sua foto nunca aparecem. Quem você segue e quem segue você fica guardado no servidor; o perfil mostra só as contagens.',
      'Ao sair da conta, o progresso continua neste aparelho. Para apagar a conta, o perfil, as partidas do ranking e o progresso guardado nela, peça pelo contato abaixo.',
    ],
    privacyAfter: [
      'Para apagar esses dados, limpe os dados do site nas configurações do navegador.',
      'Sprites, sons e fontes vêm do próprio site, sem chamadas a serviços de terceiros. O site é hospedado na Vercel, que, como qualquer servidor, pode registrar dados técnicos de acesso (como endereço IP) para operar e proteger o serviço.',
      'Para saber quantas pessoas visitam o site, usamos o Vercel Web Analytics. Ele conta visitas de forma anônima e agregada (página, país, navegador, dispositivo e site de origem), sem cookies e sem identificar ou seguir você entre sites.',
      'No jogo, usamos também o PostHog (posthog.com, com os dados guardados nos Estados Unidos) para entender como ele é jogado e corrigir erros. Ele recebe o resumo de cada partida (Pokémon, dificuldade, golpes, itens, até que minuto e nível você chegou e como ela terminou), quais telas você abre no menu e, quando o jogo dá erro, a mensagem do erro e o replay da partida em andamento (a semente e os comandos, sem nada pessoal). Tudo isso vai ligado ao identificador aleatório do ph_ps e, se você entrou com uma conta, ao id dela e ao seu nome de usuário, nunca ao seu e-mail ou nome. O PostHog não usa cookies aqui e não segue você entre sites.',
      'Doações são pagas nas páginas da AbacatePay (abacatepay.com: Pix e cartões brasileiros) ou do Stripe (stripe.com: cartões de outros países, Apple Pay e Google Pay). Os dados de pagamento vão direto para eles, e o jogo nunca vê seu cartão. Eles nos mostram o valor e, como a qualquer recebedor, dados de quem pagou (como nome e e-mail), que não usamos para nada além de registrar a doação. Se você der um @ (ou resgatar o código da doação), ela fica ligada a essa conta do jogo para as recompensas chegarem; o valor nunca aparece em público, só o selo de apoiador, que dá para esconder.',
    ],
    contact: [
      'Se você tem direitos sobre algum material usado aqui e quer que ele seja removido ou ajustado, abra uma issue no GitHub. O pedido vai ser atendido rapidamente.',
      'Bugs e ideias também são bem-vindos por lá.',
    ],
    issues: 'Abrir uma issue no GitHub',
    source: 'Ver o código-fonte',
  },
  notFound: {
    title: 'Página não encontrada · Pokémon Survivors',
    eyebrow: 'ERRO 404 · ROTA 404',
    h1: 'Você se perdeu na Rota 404.',
    lead: 'Esta página não existe, mas os Zubat sim. Ande até uma placa para sair.',
    url: 'Endereço procurado:',
    mean: { before: 'Você quis dizer ', after: '?' },
    hint: 'Setas ou WASD para andar. No celular, toque e arraste. Os ataques saem sozinhos.',
    game: 'Mini jogo: ande pela Rota 404 até uma placa',
    start: 'Ande para começar',
    go: 'Ir para',
    over: '{name} desmaiou na Rota 404.',
    time: 'Tempo',
    ko: 'Nocautes',
    best: 'Recorde',
    retry: 'Tentar de novo',
    notes: { play: 'Uma partida de verdade', pokedex: 'Todos os Pokémon do jogo', guide: 'Como jogar' },
  },
}

export type SiteMessages = typeof sitePt
