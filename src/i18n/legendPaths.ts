import type { PathId, TrialId } from '../data/legendPaths'
import type { PATH_LEGENDS } from '../data/legends'
import type { PathLegendMoveId } from '../game/pathLegendMoves'

/**
 * The legend paths' words (`data/legendPaths.ts`), a table per language (`pt`
 * is the reference). Each language's file spreads its `abilities`, `moves` and
 * `blurbs` and holds the rest as `paths`. Pokémon, move and item names stay in
 * English. French ALL-CAPS labels drop their accents.
 */

type PathLegend = (typeof PATH_LEGENDS)[number]
type PathAbility = 'powerConstruct' | 'fullMetalBody' | 'shadowShield' | 'magnetPull' | 'slowStart'
type Branch = { name: string; desc: string }
type MoveText = { description: string; upgrades: readonly [string, string, { readonly fork: readonly [Branch, Branch] }, string] }

/** The Torre's words for a trial: its name and what it asks of the player. */
type TrialText = { name: string; desc: string }

export type PathWords = {
  abilities: Record<PathAbility, string>
  moves: Record<PathLegendMoveId, MoveText>
  blurbs: Record<PathLegend, string>
  /** Regigigas's title card, and its phase lines (`legends.epithets`, `legends.phases`). */
  epithet: string
  phases: readonly [string, string]
  paths: {
    /** The path's own name, its NPC's name and what it says (`ui/legendPaths.ts`). */
    names: Record<PathId, string>
    npc: Record<PathId, string>
    intro: Record<PathId, readonly string[]>
    /** The locked legend's line on the partner select. */
    where: Record<PathLegend, string>
    /** Why the legend came, in the gift box. */
    gift: Record<PathId, string>
    /** The button that opens a path's sheet, and the sheet's own. */
    open: string
    close: string
    /** Run toasts. */
    run: {
      cellSighted: string
      coreSighted: string
      cellFound: (pieces: string) => string
      coreFound: (cores: string) => string
      cellGone: string
      coreGone: string
      templeRisen: string
      templeSilent: string
      templeWoken: string
      nutFirst: string
      /** A path form opened by what the run brought. */
      formOpen: (name: string) => string
    }
    cube: {
      title: string
      pieces: (n: string) => string
      cells: (n: string, max: string) => string
      cores: (n: string, max: string) => string
      /** Each Forme and how many pieces it takes. */
      forms: { ten: string; fifty: string; complete: string }
      open: string
      need: (n: string) => string
      /** Complete also needs every Core. */
      needCores: (n: string) => string
      hint: string
    }
    cosmog: {
      researchHead: string
      steps: { night: string; day: string; rift: string }
      researchNote: string
      /** The lobby's Cosmog: how far along it is and where it leans. */
      runs: (n: string, to: string) => string
      toCosmoem: (n: number) => string
      toLegend: (n: number) => string
      sun: string
      moon: string
      lean: (name: string) => string
      leanMissing: (name: string) => string
      how: string
      none: string
      raised: (names: string) => string
      /** A run's end: Cosmog grew, or turned into its legend. */
      grew: string
      evolved: (name: string) => string
    }
    tower: {
      title: string
      intro: string
      floors: Record<TrialId, TrialText>
      goal: { damage: (n: string, s: number) => string; hits: (n: string, s: number) => string; knockouts: (n: string, s: number) => string }
      loadout: (name: string, moves: string) => string
      start: string
      retry: string
      back: string
      locked: string
      cleared: string
      chosen: string
      closed: string
      /** The trial under way and how it ended. */
      timeLeft: (s: string) => string
      progress: (n: string, need: string) => string
      won: string
      lost: string
      kubfu: string
      urshifu: (style: string) => string
      chooseNote: string
      styles: { dark: string; water: string }
    }
    meltan: {
      box: string
      boxHint: string
      /** The Escavação's reveal of the box. */
      found: string
      nuts: (n: string, need: string) => string
      ready: string
      note: string
    }
    regi: {
      wakers: (n: number) => string
      awake: string
      note: string
    }
  }
}

/** Upgrade lines shared in shape: the Lv2 and Lv3 steps, the Lv4 fork, the Lv5 step. */
const lines = (a: string, b: string, fork: readonly [Branch, Branch], d: string) => [a, b, { fork }, d] as const

const pt: PathWords = {
  abilities: {
    powerConstruct: 'Abaixo da metade do HP, as Cells se juntam: −25% de dano sofrido e regeneração.',
    fullMetalBody: 'Terreno não te atrasa, e você sofre −12% de dano.',
    shadowShield: 'Com o HP cheio, sofre −45% de dano.',
    magnetPull: 'Ímã maior (+30) e +1 de defesa.',
    slowStart: 'Começa lento e fraco; a cada 12 s ganha força, até passar do normal depois de 1 minuto.',
  },
  moves: {
    coreEnforcer: {
      description: 'O núcleo do Zygarde risca um Z de luz verde sobre a maior multidão, traço por traço. Quem é cruzado fica preso: lento por um tempo.',
      upgrades: lines('+10 de dano', '+15% de área', [{ name: 'Ordem dupla', desc: '+1 Z; −4 de dano' }, { name: 'Sentença', desc: 'Quem cai explode; +12 de dano' }], 'Recarga 0.5s mais rápida e +10 de dano'),
    },
    sunsteelStrike: {
      description: 'O Solgaleo vira um cometa de luz do sol: rasga a multidão em linha reta e explode como um pequeno sol onde para.',
      upgrades: lines('+14 de dano', '+15% de área', [{ name: 'Chuva de cometas', desc: '+1 cometa; −6 de dano' }, { name: 'Eco solar', desc: 'Cada lançamento se repete pela metade; +16 de dano' }], 'Recarga 0.5s mais rápida e +12 de dano'),
    },
    moongeistBeam: {
      description: 'As asas da Lunala se abrem e um raio de luar varre o campo, ferindo várias vezes tudo por onde passa; uma lua fica pairando onde ele termina.',
      upgrades: lines('+6 de dano', '+15% de área', [{ name: 'Eclipse', desc: '+1 raio, para o outro lado; −2 de dano' }, { name: 'Sombra lunar', desc: 'Drena vida; +6 de dano' }], 'Recarga 0.5s mais rápida e +6 de dano'),
    },
    wickedBlow: {
      description: 'Um soco certeiro no inimigo mais perto, que nunca falha. Urshifu no Estilo Golpe Fluido o lança como Surging Strikes: três golpes de água seguidos.',
      upgrades: lines('+16 de dano', '+15% de área', [{ name: 'Dois punhos', desc: '+1 golpe; −6 de dano' }, { name: 'Golpe final', desc: 'Quem cai explode; +18 de dano' }], 'Recarga 0.35s mais rápida e +14 de dano'),
    },
    doubleIronBash: {
      description: 'Duas porcas sextavadas giram até os inimigos e voltam; quando caem, o chão leva uma pancada de ferro em volta.',
      upgrades: lines('+8 de dano', '+15% de área', [{ name: 'Quatro porcas', desc: '+2 porcas, também para trás; −3 de dano' }, { name: 'Faísca', desc: 'Faíscas pulam entre os inimigos; +10 de dano' }], 'Recarga 0.4s mais rápida e +8 de dano'),
    },
    crushGrip: {
      description: 'A mão do gigante se fecha sobre o inimigo mais forte à vista e aperta, várias vezes. Quanto maior o alvo, mais dói: chefes e elites sofrem +60%.',
      upgrades: lines('+8 de dano', '+1 mão', [{ name: 'Punho de titã', desc: '+15% de área; +8 de dano' }, { name: 'Esmagar', desc: 'Quem cai explode; +6 de dano' }], 'Recarga 0.5s mais rápida e +8 de dano'),
    },
  },
  blurbs: {
    zygarde: 'Rápido como 10%; as Cells o tornam maior e mais forte.',
    solgaleo: 'Resistente e forte. Investe como um cometa.',
    lunala: 'Varre o campo com luar. Protegida com o HP cheio.',
    kubfu: 'Golpes certeiros. Vira Urshifu no estilo da torre.',
    meltan: 'Ímã enorme. Junte porcas para o Melmetal.',
    regigigas: 'Começa lento. Depois, o mais forte de todos.',
  },
  epithet: 'Colosso Ancestral',
  phases: ['*Regigigas* acordou de vez! Ele chama o poder dos três _Regis_.', 'Crush Grip! A mão se fecha: corra para um _abrigo_.'],
  paths: {
    names: { zygarde: 'Zygarde Cube', cosmog: 'Pesquisa estelar', kubfu: 'Torre do Dojo', meltan: 'Mystery Box', regigigas: 'Templo do Gigante' },
    npc: { zygarde: 'Sudowoodo', cosmog: 'Lanturn', kubfu: 'Machoke', meltan: 'Kecleon', regigigas: 'Ninjask' },
    intro: {
      zygarde: [
        'Psiu! Não sou uma árvore… tá, isso não vem ao caso.',
        'Andam brotando gosminhas verdes do chão nas partidas: *Zygarde Cells*. Encoste numa quando vir!',
        'Com 10 no Cube, o Zygarde aparece. Com 50 ele desperta na Forma 50%, e com 100, com os 5 *Zygarde Cores*, na Forma Completa.',
      ],
      cosmog: [
        'Sabia que de vez em quando cai uma estrelinha? Uma caiu aqui perto: um *Cosmog*!',
        'Ele é tímido. Faça a *Pesquisa estelar* (Missões, aba Pesquisa) e ele vem morar no seu prado.',
        'Aí ele cresce com as suas partidas. Jogando mais de dia, vira *Solgaleo*; mais de noite, *Lunala*. Ele segue o relógio do seu aparelho.',
      ],
      kubfu: [
        'Tenho um aluno especial esperando: um *Kubfu*. Ele só segue quem passa pela minha *Torre*.',
        'São três provas aqui no Dojo, com os golpes que eu te der. Vença as três e o Kubfu vem com você.',
        'Depois, uma última prova numa torre: a *da Escuridão* ou a *das Águas*. Ela decide o estilo do Urshifu, para sempre.',
      ],
      meltan: [
        'Psst, freguês! Um minerador da *Escavação* jura que viu uma *Mystery Box* lá embaixo.',
        'Dizem que tem um Meltan dentro! Cave as paredes do Poké Realm e quem sabe…',
        'E Meltan come *Porcas Sextavadas*: jogue com ele e junte 400 para ele virar *Melmetal* no segundo despertar.',
      ],
      regigigas: [
        'Zzzt! Notícia rápida: quem captura *Regirock*, *Regice* e *Registeel* acorda um gigante.',
        'Um *templo antigo* começa a surgir nas suas partidas. Ande até ele…',
        '…e o *Regigigas* desperta. Lento no começo, mas depois… cuidado!',
      ],
    },
    where: {
      zygarde: 'Junte *Zygarde Cells* nas partidas: com 10 no Cube, ele vem.',
      solgaleo: 'Cresce de um *Cosmog* criado de dia: comece pela Pesquisa estelar.',
      lunala: 'Cresce de um *Cosmog* criado de noite: comece pela Pesquisa estelar.',
      kubfu: 'Vença as três provas da *Torre*, no Dojo do Machoke.',
      meltan: 'Dorme numa *Mystery Box* na Escavação do Poké Realm. Precisa de conta.',
      regigigas: 'Capture *Regirock*, *Regice* e *Registeel*: depois, vença-o no templo que surge nas partidas.',
    },
    gift: { zygarde: 'Pelas Zygarde Cells', cosmog: 'O seu Cosmog cresceu', kubfu: 'Pelas provas da Torre', meltan: 'Da Mystery Box', regigigas: 'Do templo' },
    open: 'Ver caminho',
    close: 'Fechar',
    run: {
      cellSighted: 'Uma *Zygarde Cell* brotou por perto! Siga a seta.',
      coreSighted: 'Um *Zygarde Core*! Ele foge devagar: alcance!',
      cellFound: (pieces: string) => `*Zygarde Cell* guardada no Cube! _${pieces}_`,
      coreFound: (cores: string) => `*Zygarde Core* guardado no Cube! _${cores}_`,
      cellGone: 'A Zygarde Cell se enterrou e sumiu…',
      coreGone: 'O Zygarde Core escapou para dentro da terra…',
      templeRisen: 'Um *templo antigo* surgiu da terra! Siga a seta.',
      templeSilent: 'O templo está quieto: termine a luta com o chefe primeiro.',
      templeWoken: 'O templo treme…',
      nutFirst: '*Porca Sextavada*! O Meltan junta para virar Melmetal.',
      formOpen: (name: string) => `*${name}* liberado no Modo Lendário!`,
    },
    cube: {
      title: 'ZYGARDE CUBE',
      pieces: (n: string) => `${n}%`,
      cells: (n: string, max: string) => `Cells: ${n}/${max}`,
      cores: (n: string, max: string) => `Cores: ${n}/${max}`,
      forms: { ten: 'Zygarde 10%', fifty: 'Forma 50%', complete: 'Forma Completa' },
      open: 'Liberada',
      need: (n: string) => `Faltam ${n}`,
      needCores: (n: string) => `Faltam ${n} Cores`,
      hint: 'Zygarde Cells e Cores surgem nas partidas solo, no mapa aberto: até 3 Cells por partida, um Core de vez em quando. A Forma 50% vem no 1º despertar, a Completa no 2º.',
    },
    cosmog: {
      researchHead: 'Cosmog',
      steps: { night: 'Vença uma partida de noite (18h às 6h)', day: 'Vença uma partida de dia (6h às 18h)', rift: 'Derrote o lendário de uma fenda' },
      researchNote: 'Um passo por partida, em qualquer ordem. Vale o relógio do seu aparelho.',
      runs: (n: string, to: string) => `${n}/${to} partidas`,
      toCosmoem: (n: number) => (n === 1 ? 'Falta 1 partida para virar Cosmoem.' : `Faltam ${n} partidas para virar Cosmoem.`),
      toLegend: (n: number) => (n === 1 ? 'Falta 1 partida para evoluir!' : `Faltam ${n} partidas para evoluir.`),
      sun: 'Sol',
      moon: 'Lua',
      lean: (name: string) => `Está puxando para *${name}*.`,
      leanMissing: (name: string) => `Este sente falta do outro céu: vai virar *${name}*.`,
      how: 'Contam as partidas de 5 minutos ou mais. As que terminam de dia (6h às 18h) são do Sol; as de noite, da Lua. Quem tiver mais decide: Solgaleo ou Lunala.',
      none: 'Termine a Pesquisa estelar para o Cosmog chegar.',
      raised: (names: string) => `Já criou: ${names}.`,
      grew: 'O *Cosmog* virou *Cosmoem*!',
      evolved: (name: string) => `O seu Cosmoem evoluiu em *${name}*! Abra o Presente.`,
    },
    tower: {
      title: 'TORRE DO DOJO',
      intro: 'Cada prova te dá um Pokémon e seus golpes. Só conta como você joga.',
      floors: {
        fist: { name: 'Punho firme', desc: 'Um boneco só. Fique colado e não pare de bater.' },
        crowd: { name: 'No meio da multidão', desc: 'Dez bonecos juntos: só no meio deles você alcança todos.' },
        chase: { name: 'Alvos em fuga', desc: 'Quatro bonecos correndo em círculo. Acerte quantos golpes puder.' },
        dark: { name: 'Torre da Escuridão', desc: 'Bonecos blindados que desviam: derrube cada um com golpes únicos e pesados.' },
        water: { name: 'Torre das Águas', desc: 'Golpes como a correnteza: muitos e rápidos, nos bonecos que correm.' },
      },
      goal: {
        damage: (n: string, s: number) => `Cause ${n} de dano em ${s} s`,
        hits: (n: string, s: number) => `Acerte ${n} golpes em ${s} s`,
        knockouts: (n: string, s: number) => `Derrube ${n} bonecos em ${s} s`,
      },
      loadout: (name: string, moves: string) => `${name} · ${moves}`,
      start: 'Começar',
      retry: 'De novo',
      back: 'Voltar',
      locked: 'Trancada',
      cleared: 'Vencida',
      chosen: 'Escolhida',
      closed: 'Fechada',
      timeLeft: (s: string) => `${s} s`,
      progress: (n: string, need: string) => `${n}/${need}`,
      won: 'Prova vencida!',
      lost: 'O tempo acabou.',
      kubfu: 'O *Kubfu* quer ir com você! Abra o Presente no lobby.',
      urshifu: (style: string) => `O Kubfu escolheu o *${style}*: no 2º despertar ele vira *Urshifu*.`,
      chooseNote: 'Só dá para subir uma das duas torres. A escolhida decide o estilo do Urshifu para sempre.',
      styles: { dark: 'Estilo Golpe Único', water: 'Estilo Golpe Fluido' },
    },
    meltan: {
      box: 'Mystery Box',
      boxHint: 'Às vezes vem enterrada numa parede da Escavação, enquanto você não tem o Meltan.',
      found: 'Tem um Meltan dentro! Ele está no Presente do lobby.',
      nuts: (n: string, need: string) => `Porcas: ${n}/${need}`,
      ready: 'O Meltan vira *Melmetal* no 2º despertar.',
      note: 'Jogando com o Meltan, os inimigos derrubam Porcas Sextavadas (os de Aço mais). Com 400, o 2º despertar o transforma em Melmetal.',
    },
    regi: {
      wakers: (n: number) => `Trio capturado: ${n}/3`,
      awake: 'O gigante acordou: o templo pode surgir nas suas partidas solo.',
      note: 'Depois de capturado, o templo ainda aparece de vez em quando, para quem quer revê-lo.',
    },
  },
}

const en: PathWords = {
  abilities: {
    powerConstruct: 'Under half HP its Cells gather: −25% damage taken and regeneration.',
    fullMetalBody: 'Terrain never slows you, and you take −12% damage.',
    shadowShield: 'At full HP, takes −45% damage.',
    magnetPull: 'A bigger magnet (+30) and +1 defense.',
    slowStart: 'Starts slow and weak; every 12 s it gains strength, past normal after a minute.',
  },
  moves: {
    coreEnforcer: {
      description: 'Zygarde’s core draws a Z of green light over the biggest crowd, stroke by stroke. Whatever it crosses is held down: slowed for a while.',
      upgrades: lines('+10 damage', '+15% area', [{ name: 'Double order', desc: '+1 Z; −4 damage' }, { name: 'Sentence', desc: 'Foes that fall explode; +12 damage' }], '0.5s faster cooldown and +10 damage'),
    },
    sunsteelStrike: {
      description: 'Solgaleo becomes a comet of sunlight: it tears through the crowd in a straight line and bursts like a small sun where it stops.',
      upgrades: lines('+14 damage', '+15% area', [{ name: 'Comet shower', desc: '+1 comet; −6 damage' }, { name: 'Solar echo', desc: 'Each cast repeats at half power; +16 damage' }], '0.5s faster cooldown and +12 damage'),
    },
    moongeistBeam: {
      description: 'Lunala’s wings open and a beam of moonlight sweeps the field, hitting all it passes over again and again; a moon lingers where it ends.',
      upgrades: lines('+6 damage', '+15% area', [{ name: 'Eclipse', desc: '+1 beam, the other way; −2 damage' }, { name: 'Lunar shade', desc: 'Drains life; +6 damage' }], '0.5s faster cooldown and +6 damage'),
    },
    wickedBlow: {
      description: 'A sure blow at the nearest foe that never misses. Rapid Strike Urshifu throws it as Surging Strikes: three water blows in a row.',
      upgrades: lines('+16 damage', '+15% area', [{ name: 'Two fists', desc: '+1 blow; −6 damage' }, { name: 'Final blow', desc: 'Foes that fall explode; +18 damage' }], '0.35s faster cooldown and +14 damage'),
    },
    doubleIronBash: {
      description: 'Two hex nuts spin out at the foes and come back; as they land the ground takes an iron slam all around.',
      upgrades: lines('+8 damage', '+15% area', [{ name: 'Four nuts', desc: '+2 nuts, behind too; −3 damage' }, { name: 'Spark', desc: 'Sparks jump between foes; +10 damage' }], '0.4s faster cooldown and +8 damage'),
    },
    crushGrip: {
      description: 'The giant’s hand closes over the strongest foe in view and squeezes, again and again. The bigger it is, the more it hurts: bosses and elites take +60%.',
      upgrades: lines('+8 damage', '+1 hand', [{ name: 'Titan’s fist', desc: '+15% area; +8 damage' }, { name: 'Crush', desc: 'Foes that fall explode; +6 damage' }], '0.5s faster cooldown and +8 damage'),
    },
  },
  blurbs: {
    zygarde: 'Quick at 10%; its Cells make it bigger and stronger.',
    solgaleo: 'Sturdy and strong. Charges like a comet.',
    lunala: 'Sweeps the field with moonlight. Shielded at full HP.',
    kubfu: 'Sure blows. Becomes Urshifu in its tower’s style.',
    meltan: 'A huge magnet. Gather nuts for Melmetal.',
    regigigas: 'Starts slow. Then the strongest of all.',
  },
  epithet: 'Ancient Colossus',
  phases: ['*Regigigas* is fully awake! It calls on the three _Regis_’ power.', 'Crush Grip! The hand closes: run for a _shelter_.'],
  paths: {
    names: { zygarde: 'Zygarde Cube', cosmog: 'Star research', kubfu: 'Dojo Tower', meltan: 'Mystery Box', regigigas: 'Giant’s Temple' },
    npc: { zygarde: 'Sudowoodo', cosmog: 'Lanturn', kubfu: 'Machoke', meltan: 'Kecleon', regigigas: 'Ninjask' },
    intro: {
      zygarde: [
        'Psst! I’m not a tree… okay, never mind that.',
        'Little green blobs keep popping out of the ground in runs: *Zygarde Cells*. Touch one when you see it!',
        'With 10 in the Cube, Zygarde comes. With 50 it awakens in its 50% Forme, and with 100, all 5 *Zygarde Cores* among them, in its Complete Forme.',
      ],
      cosmog: [
        'Did you know a little star falls now and then? One landed nearby: a *Cosmog*!',
        'It’s shy. Finish the *Star research* (Missions, Research tab) and it’ll come live in your meadow.',
        'Then it grows with your runs. Play more by day and it becomes *Solgaleo*; more by night, *Lunala*. It follows your device’s clock.',
      ],
      kubfu: [
        'I have a special student waiting: a *Kubfu*. It only follows those who pass my *Tower*.',
        'Three trials here at the Dojo, with the moves I give you. Win all three and Kubfu comes with you.',
        'Then one last trial in a tower: *Darkness* or *Waters*. It decides Urshifu’s style, for good.',
      ],
      meltan: [
        'Psst, customer! A miner at the *Mine Dig* swears they saw a *Mystery Box* down there.',
        'They say there’s a Meltan inside! Dig the Poké Realm’s walls and who knows…',
        'And Meltan eats *Hex Nuts*: play with it and gather 400 to make it *Melmetal* at its second awakening.',
      ],
      regigigas: [
        'Zzzt! Quick news: whoever captures *Regirock*, *Regice* and *Registeel* wakes a giant.',
        'An *ancient temple* starts showing up in your runs. Walk up to it…',
        '…and *Regigigas* awakens. Slow at first, but then… watch out!',
      ],
    },
    where: {
      zygarde: 'Gather *Zygarde Cells* in runs: with 10 in the Cube, it comes.',
      solgaleo: 'Grows from a *Cosmog* raised by day: start with the Star research.',
      lunala: 'Grows from a *Cosmog* raised by night: start with the Star research.',
      kubfu: 'Win the three trials of the *Tower*, at Machoke’s Dojo.',
      meltan: 'Sleeps in a *Mystery Box* at the Poké Realm’s Mine Dig. Needs an account.',
      regigigas: 'Capture *Regirock*, *Regice* and *Registeel*: then beat it at the temple that rises in runs.',
    },
    gift: { zygarde: 'For the Cube’s Cells', cosmog: 'Your Cosmog grew up', kubfu: 'For the Tower’s trials', meltan: 'From the Mystery Box', regigigas: 'From the temple' },
    open: 'See path',
    close: 'Close',
    run: {
      cellSighted: 'A *Zygarde Cell* popped up nearby! Follow the arrow.',
      coreSighted: 'A *Zygarde Core*! It creeps away: catch up!',
      cellFound: (pieces: string) => `*Cell* stored in the Cube! _${pieces}_`,
      coreFound: (cores: string) => `*Core* stored in the Cube! _${cores}_`,
      cellGone: 'The Cell burrowed and vanished…',
      coreGone: 'The Core slipped back into the ground…',
      templeRisen: 'An *ancient temple* rose from the ground! Follow the arrow.',
      templeSilent: 'The temple is quiet: finish the boss fight first.',
      templeWoken: 'The temple shakes…',
      nutFirst: '*Hex Nut*! Meltan gathers them to become Melmetal.',
      formOpen: (name: string) => `*${name}* unlocked in Legend mode!`,
    },
    cube: {
      title: 'ZYGARDE CUBE',
      pieces: (n: string) => `${n}%`,
      cells: (n: string, max: string) => `Cells: ${n}/${max}`,
      cores: (n: string, max: string) => `Cores: ${n}/${max}`,
      forms: { ten: 'Zygarde 10%', fifty: '50% Forme', complete: 'Complete Forme' },
      open: 'Unlocked',
      need: (n: string) => `${n} to go`,
      needCores: (n: string) => `${n} Cores to go`,
      hint: 'Zygarde Cells and Cores turn up in solo runs on the open map: up to 3 Cells a run, a Core now and then. The 50% Forme comes at the 1st awakening, Complete at the 2nd.',
    },
    cosmog: {
      researchHead: 'Cosmog',
      steps: { night: 'Win a run by night (6 pm to 6 am)', day: 'Win a run by day (6 am to 6 pm)', rift: 'Beat a rift’s legendary' },
      researchNote: 'One step a run, in any order. Your device’s clock counts.',
      runs: (n: string, to: string) => `${n}/${to} runs`,
      toCosmoem: (n: number) => (n === 1 ? '1 run to become Cosmoem.' : `${n} runs to become Cosmoem.`),
      toLegend: (n: number) => (n === 1 ? '1 run to evolve!' : `${n} runs to evolve.`),
      sun: 'Sun',
      moon: 'Moon',
      lean: (name: string) => `It’s leaning toward *${name}*.`,
      leanMissing: (name: string) => `This one misses the other sky: it will become *${name}*.`,
      how: 'Runs of 5 minutes or more count. Those ending by day (6 am to 6 pm) are the Sun’s; by night, the Moon’s. Whichever has more decides: Solgaleo or Lunala.',
      none: 'Finish the Star research for Cosmog to come.',
      raised: (names: string) => `Raised so far: ${names}.`,
      grew: '*Cosmog* became *Cosmoem*!',
      evolved: (name: string) => `Your Cosmoem evolved into *${name}*! Open the Gift.`,
    },
    tower: {
      title: 'DOJO TOWER',
      intro: 'Each trial gives you a Pokémon and its moves. Only how you play counts.',
      floors: {
        fist: { name: 'Steady fist', desc: 'One dummy. Stay close and keep hitting.' },
        crowd: { name: 'Into the crowd', desc: 'Ten dummies together: only in their midst do you reach them all.' },
        chase: { name: 'Fleeing targets', desc: 'Four dummies running in a circle. Land as many hits as you can.' },
        dark: { name: 'Tower of Darkness', desc: 'Armored dummies that dodge: knock each down with single, heavy blows.' },
        water: { name: 'Tower of Waters', desc: 'Blows like a current: many and quick, on the running dummies.' },
      },
      goal: {
        damage: (n: string, s: number) => `Deal ${n} damage in ${s} s`,
        hits: (n: string, s: number) => `Land ${n} hits in ${s} s`,
        knockouts: (n: string, s: number) => `Knock down ${n} dummies in ${s} s`,
      },
      loadout: (name: string, moves: string) => `${name} · ${moves}`,
      start: 'Start',
      retry: 'Again',
      back: 'Back',
      locked: 'Locked',
      cleared: 'Cleared',
      chosen: 'Chosen',
      closed: 'Closed',
      timeLeft: (s: string) => `${s} s`,
      progress: (n: string, need: string) => `${n}/${need}`,
      won: 'Trial cleared!',
      lost: 'Time’s up.',
      kubfu: '*Kubfu* wants to come with you! Open the Gift in the lobby.',
      urshifu: (style: string) => `Kubfu chose the *${style}*: at its 2nd awakening it becomes *Urshifu*.`,
      chooseNote: 'Only one of the two towers can be climbed. The one chosen decides Urshifu’s style for good.',
      styles: { dark: 'Single Strike Style', water: 'Rapid Strike Style' },
    },
    meltan: {
      box: 'Mystery Box',
      boxHint: 'Sometimes it comes buried in a Mine Dig wall, while you don’t have Meltan.',
      found: 'There’s a Meltan inside! It’s waiting in the lobby’s Gift.',
      nuts: (n: string, need: string) => `Nuts: ${n}/${need}`,
      ready: 'Meltan becomes *Melmetal* at its 2nd awakening.',
      note: 'Playing Meltan, foes drop Hex Nuts (Steel types more). With 400, its 2nd awakening turns it into Melmetal.',
    },
    regi: {
      wakers: (n: number) => `Trio captured: ${n}/3`,
      awake: 'The giant is awake: the temple can rise in your solo runs.',
      note: 'Once captured, the temple still shows up now and then, for a rematch.',
    },
  },
}

const es: PathWords = {
  abilities: {
    powerConstruct: 'Con menos de la mitad de PS, sus Cells se juntan: −25% de daño recibido y regeneración.',
    fullMetalBody: 'El terreno nunca te frena, y recibes −12% de daño.',
    shadowShield: 'Con los PS llenos, recibe −45% de daño.',
    magnetPull: 'Un imán más grande (+30) y +1 de defensa.',
    slowStart: 'Empieza lento y débil; cada 12 s gana fuerza, hasta pasar de lo normal tras un minuto.',
  },
  moves: {
    coreEnforcer: {
      description: 'El núcleo de Zygarde traza una Z de luz verde sobre la multitud más grande, trazo a trazo. Lo que cruza queda retenido: lento por un rato.',
      upgrades: lines('+10 de daño', '+15% de área', [{ name: 'Orden doble', desc: '+1 Z; −4 de daño' }, { name: 'Sentencia', desc: 'Los que caen explotan; +12 de daño' }], 'Recarga 0.5s más rápida y +10 de daño'),
    },
    sunsteelStrike: {
      description: 'Solgaleo se vuelve un cometa de luz solar: atraviesa la multitud en línea recta y estalla como un pequeño sol donde se detiene.',
      upgrades: lines('+14 de daño', '+15% de área', [{ name: 'Lluvia de cometas', desc: '+1 cometa; −6 de daño' }, { name: 'Eco solar', desc: 'Cada lanzamiento se repite a la mitad; +16 de daño' }], 'Recarga 0.5s más rápida y +12 de daño'),
    },
    moongeistBeam: {
      description: 'Las alas de Lunala se abren y un rayo de luz de luna barre el campo, golpeando una y otra vez todo lo que cruza; una luna queda flotando donde termina.',
      upgrades: lines('+6 de daño', '+15% de área', [{ name: 'Eclipse', desc: '+1 rayo, hacia el otro lado; −2 de daño' }, { name: 'Sombra lunar', desc: 'Drena vida; +6 de daño' }], 'Recarga 0.5s más rápida y +6 de daño'),
    },
    wickedBlow: {
      description: 'Un golpe certero al enemigo más cercano, que nunca falla. Urshifu en Estilo Fluido lo lanza como Surging Strikes: tres golpes de agua seguidos.',
      upgrades: lines('+16 de daño', '+15% de área', [{ name: 'Dos puños', desc: '+1 golpe; −6 de daño' }, { name: 'Golpe final', desc: 'Los que caen explotan; +18 de daño' }], 'Recarga 0.35s más rápida y +14 de daño'),
    },
    doubleIronBash: {
      description: 'Dos tuercas hexagonales giran hacia los enemigos y vuelven; al caer, el suelo recibe un golpe de hierro alrededor.',
      upgrades: lines('+8 de daño', '+15% de área', [{ name: 'Cuatro tuercas', desc: '+2 tuercas, también hacia atrás; −3 de daño' }, { name: 'Chispa', desc: 'Chispas saltan entre enemigos; +10 de daño' }], 'Recarga 0.4s más rápida y +8 de daño'),
    },
    crushGrip: {
      description: 'La mano del gigante se cierra sobre el enemigo más fuerte a la vista y aprieta, una y otra vez. Cuanto más grande, más duele: jefes y élites reciben +60%.',
      upgrades: lines('+8 de daño', '+1 mano', [{ name: 'Puño de titán', desc: '+15% de área; +8 de daño' }, { name: 'Aplastar', desc: 'Los que caen explotan; +6 de daño' }], 'Recarga 0.5s más rápida y +8 de daño'),
    },
  },
  blurbs: {
    zygarde: 'Rápido al 10%; las Cells lo hacen más grande y fuerte.',
    solgaleo: 'Resistente y fuerte. Embiste como un cometa.',
    lunala: 'Barre el campo con luz de luna. Protegida con los PS llenos.',
    kubfu: 'Golpes certeros. Se vuelve Urshifu en el estilo de su torre.',
    meltan: 'Un imán enorme. Junta tuercas para Melmetal.',
    regigigas: 'Empieza lento. Luego, el más fuerte de todos.',
  },
  epithet: 'Coloso Ancestral',
  phases: ['¡*Regigigas* despertó del todo! Invoca el poder de los tres _Regis_.', '¡Crush Grip! La mano se cierra: corre a un _refugio_.'],
  paths: {
    names: { zygarde: 'Zygarde Cube', cosmog: 'Investigación estelar', kubfu: 'Torre del Dojo', meltan: 'Mystery Box', regigigas: 'Templo del Gigante' },
    npc: { zygarde: 'Sudowoodo', cosmog: 'Lanturn', kubfu: 'Machoke', meltan: 'Kecleon', regigigas: 'Ninjask' },
    intro: {
      zygarde: [
        '¡Psst! No soy un árbol… bueno, eso no importa.',
        'Andan brotando bolitas verdes del suelo en las partidas: *Zygarde Cells*. ¡Toca una cuando la veas!',
        'Con 10 en el Cube, Zygarde viene. Con 50 despierta en su Forma 50%, y con 100, con los 5 *Zygarde Cores*, en su Forma Completa.',
      ],
      cosmog: [
        '¿Sabías que a veces cae una estrellita? Una cayó aquí cerca: ¡un *Cosmog*!',
        'Es tímido. Termina la *Investigación estelar* (Misiones, pestaña Investigación) y vendrá a vivir a tu prado.',
        'Luego crece con tus partidas. Jugando más de día, se vuelve *Solgaleo*; más de noche, *Lunala*. Sigue el reloj de tu dispositivo.',
      ],
      kubfu: [
        'Tengo un alumno especial esperando: un *Kubfu*. Solo sigue a quien supera mi *Torre*.',
        'Son tres pruebas aquí en el Dojo, con los movimientos que te dé. Gana las tres y Kubfu va contigo.',
        'Después, una última prueba en una torre: la *de la Oscuridad* o la *de las Aguas*. Decide el estilo de Urshifu, para siempre.',
      ],
      meltan: [
        '¡Psst, cliente! Un minero de la *Excavación* jura que vio una *Mystery Box* allá abajo.',
        '¡Dicen que hay un Meltan dentro! Excava las paredes del Poké Realm y quién sabe…',
        'Y Meltan come *Tuercas Hexagonales*: juega con él y junta 400 para que se vuelva *Melmetal* en su segundo despertar.',
      ],
      regigigas: [
        '¡Zzzt! Noticia rápida: quien captura a *Regirock*, *Regice* y *Registeel* despierta a un gigante.',
        'Un *templo antiguo* empieza a aparecer en tus partidas. Camina hasta él…',
        '…y *Regigigas* despierta. Lento al principio, pero luego… ¡cuidado!',
      ],
    },
    where: {
      zygarde: 'Junta *Zygarde Cells* en las partidas: con 10 en el Cube, viene.',
      solgaleo: 'Crece de un *Cosmog* criado de día: empieza por la Investigación estelar.',
      lunala: 'Crece de un *Cosmog* criado de noche: empieza por la Investigación estelar.',
      kubfu: 'Gana las tres pruebas de la *Torre*, en el Dojo de Machoke.',
      meltan: 'Duerme en una *Mystery Box* en la Excavación del Poké Realm. Necesita cuenta.',
      regigigas: 'Captura a *Regirock*, *Regice* y *Registeel*: luego véncelo en el templo que surge en las partidas.',
    },
    gift: { zygarde: 'Por las Zygarde Cells', cosmog: 'Tu Cosmog creció', kubfu: 'Por las pruebas de la Torre', meltan: 'De la Mystery Box', regigigas: 'Del templo' },
    open: 'Ver camino',
    close: 'Cerrar',
    run: {
      cellSighted: '¡Una *Zygarde Cell* brotó cerca! Sigue la flecha.',
      coreSighted: '¡Un *Zygarde Core*! Huye despacio: ¡alcánzalo!',
      cellFound: (pieces: string) => `¡*Zygarde Cell* guardada en el Cube! _${pieces}_`,
      coreFound: (cores: string) => `¡*Zygarde Core* guardado en el Cube! _${cores}_`,
      cellGone: 'La Zygarde Cell se enterró y desapareció…',
      coreGone: 'El Zygarde Core se escapó bajo tierra…',
      templeRisen: '¡Un *templo antiguo* surgió del suelo! Sigue la flecha.',
      templeSilent: 'El templo está en calma: termina primero la pelea con el jefe.',
      templeWoken: 'El templo tiembla…',
      nutFirst: '¡*Tuerca Hexagonal*! Meltan las junta para volverse Melmetal.',
      formOpen: (name: string) => `¡*${name}* desbloqueado en el Modo Legendario!`,
    },
    cube: {
      title: 'ZYGARDE CUBE',
      pieces: (n: string) => `${n}%`,
      cells: (n: string, max: string) => `Cells: ${n}/${max}`,
      cores: (n: string, max: string) => `Cores: ${n}/${max}`,
      forms: { ten: 'Zygarde 10%', fifty: 'Forma 50%', complete: 'Forma Completa' },
      open: 'Desbloqueada',
      need: (n: string) => `Faltan ${n}`,
      needCores: (n: string) => `Faltan ${n} Cores`,
      hint: 'Zygarde Cells y Cores aparecen en partidas solo, en el mapa abierto: hasta 3 Cells por partida, un Core de vez en cuando. La Forma 50% llega en el 1.er despertar, la Completa en el 2.º.',
    },
    cosmog: {
      researchHead: 'Cosmog',
      steps: { night: 'Gana una partida de noche (18 h a 6 h)', day: 'Gana una partida de día (6 h a 18 h)', rift: 'Derrota al legendario de una grieta' },
      researchNote: 'Un paso por partida, en cualquier orden. Cuenta el reloj de tu dispositivo.',
      runs: (n: string, to: string) => `${n}/${to} partidas`,
      toCosmoem: (n: number) => (n === 1 ? 'Falta 1 partida para volverse Cosmoem.' : `Faltan ${n} partidas para volverse Cosmoem.`),
      toLegend: (n: number) => (n === 1 ? '¡Falta 1 partida para evolucionar!' : `Faltan ${n} partidas para evolucionar.`),
      sun: 'Sol',
      moon: 'Luna',
      lean: (name: string) => `Se inclina hacia *${name}*.`,
      leanMissing: (name: string) => `Este extraña el otro cielo: se volverá *${name}*.`,
      how: 'Cuentan las partidas de 5 minutos o más. Las que terminan de día (6 h a 18 h) son del Sol; de noche, de la Luna. La que tenga más decide: Solgaleo o Lunala.',
      none: 'Termina la Investigación estelar para que llegue Cosmog.',
      raised: (names: string) => `Ya criaste: ${names}.`,
      grew: '¡*Cosmog* se volvió *Cosmoem*!',
      evolved: (name: string) => `¡Tu Cosmoem evolucionó a *${name}*! Abre el Regalo.`,
    },
    tower: {
      title: 'TORRE DEL DOJO',
      intro: 'Cada prueba te da un Pokémon y sus movimientos. Solo cuenta cómo juegas.',
      floors: {
        fist: { name: 'Puño firme', desc: 'Un solo muñeco. Quédate cerca y no dejes de golpear.' },
        crowd: { name: 'En medio de la multitud', desc: 'Diez muñecos juntos: solo en medio de ellos alcanzas a todos.' },
        chase: { name: 'Blancos en fuga', desc: 'Cuatro muñecos corriendo en círculo. Acierta todos los golpes que puedas.' },
        dark: { name: 'Torre de la Oscuridad', desc: 'Muñecos blindados que esquivan: derriba cada uno con golpes únicos y pesados.' },
        water: { name: 'Torre de las Aguas', desc: 'Golpes como la corriente: muchos y rápidos, en los muñecos que corren.' },
      },
      goal: {
        damage: (n: string, s: number) => `Causa ${n} de daño en ${s} s`,
        hits: (n: string, s: number) => `Acierta ${n} golpes en ${s} s`,
        knockouts: (n: string, s: number) => `Derriba ${n} muñecos en ${s} s`,
      },
      loadout: (name: string, moves: string) => `${name} · ${moves}`,
      start: 'Empezar',
      retry: 'Otra vez',
      back: 'Volver',
      locked: 'Cerrada',
      cleared: 'Superada',
      chosen: 'Elegida',
      closed: 'Cerrada',
      timeLeft: (s: string) => `${s} s`,
      progress: (n: string, need: string) => `${n}/${need}`,
      won: '¡Prueba superada!',
      lost: 'Se acabó el tiempo.',
      kubfu: '¡*Kubfu* quiere ir contigo! Abre el Regalo en el lobby.',
      urshifu: (style: string) => `Kubfu eligió el *${style}*: en su 2.º despertar se vuelve *Urshifu*.`,
      chooseNote: 'Solo se puede subir una de las dos torres. La elegida decide el estilo de Urshifu para siempre.',
      styles: { dark: 'Estilo Brusco', water: 'Estilo Fluido' },
    },
    meltan: {
      box: 'Mystery Box',
      boxHint: 'A veces viene enterrada en una pared de la Excavación, mientras no tengas a Meltan.',
      found: '¡Hay un Meltan dentro! Te espera en el Regalo del lobby.',
      nuts: (n: string, need: string) => `Tuercas: ${n}/${need}`,
      ready: 'Meltan se vuelve *Melmetal* en su 2.º despertar.',
      note: 'Jugando con Meltan, los enemigos sueltan Tuercas Hexagonales (los de Acero, más). Con 400, su 2.º despertar lo vuelve Melmetal.',
    },
    regi: {
      wakers: (n: number) => `Trío capturado: ${n}/3`,
      awake: 'El gigante despertó: el templo puede surgir en tus partidas solo.',
      note: 'Ya capturado, el templo aún aparece de vez en cuando, para la revancha.',
    },
  },
}

const fr: PathWords = {
  abilities: {
    powerConstruct: 'Sous la moitié des PV, ses Cells se rassemblent : −25 % de dégâts subis et régénération.',
    fullMetalBody: 'Le terrain ne vous ralentit jamais, et vous subissez −12 % de dégâts.',
    shadowShield: 'Avec tous ses PV, subit −45 % de dégâts.',
    magnetPull: 'Un aimant plus grand (+30) et +1 de défense.',
    slowStart: 'Démarre lent et faible ; toutes les 12 s il gagne en force, jusqu’à dépasser la normale après une minute.',
  },
  moves: {
    coreEnforcer: {
      description: 'Le noyau de Zygarde trace un Z de lumière verte sur la plus grande foule, trait par trait. Ce qu’il traverse est retenu : ralenti un moment.',
      upgrades: lines('+10 dégâts', '+15 % de zone', [{ name: 'Ordre double', desc: '+1 Z ; −4 dégâts' }, { name: 'Sentence', desc: 'Les ennemis vaincus explosent ; +12 dégâts' }], 'Recharge 0.5s plus rapide et +10 dégâts'),
    },
    sunsteelStrike: {
      description: 'Solgaleo devient une comète de lumière solaire : il fend la foule en ligne droite et éclate comme un petit soleil là où il s’arrête.',
      upgrades: lines('+14 dégâts', '+15 % de zone', [{ name: 'Pluie de comètes', desc: '+1 comète ; −6 dégâts' }, { name: 'Écho solaire', desc: 'Chaque lancer se répète à moitié ; +16 dégâts' }], 'Recharge 0.5s plus rapide et +12 dégâts'),
    },
    moongeistBeam: {
      description: 'Les ailes de Lunala s’ouvrent et un rayon de lune balaie le terrain, frappant encore et encore tout ce qu’il traverse ; une lune flotte là où il s’arrête.',
      upgrades: lines('+6 dégâts', '+15 % de zone', [{ name: 'Éclipse', desc: '+1 rayon, dans l’autre sens ; −2 dégâts' }, { name: 'Ombre lunaire', desc: 'Draine la vie ; +6 dégâts' }], 'Recharge 0.5s plus rapide et +6 dégâts'),
    },
    wickedBlow: {
      description: 'Un coup sûr sur l’ennemi le plus proche, qui ne rate jamais. Urshifu en Style Mille Poings le lance en Surging Strikes : trois coups d’eau à la suite.',
      upgrades: lines('+16 dégâts', '+15 % de zone', [{ name: 'Deux poings', desc: '+1 coup ; −6 dégâts' }, { name: 'Coup final', desc: 'Les ennemis vaincus explosent ; +18 dégâts' }], 'Recharge 0.35s plus rapide et +14 dégâts'),
    },
    doubleIronBash: {
      description: 'Deux écrous hexagonaux filent vers les ennemis et reviennent ; à leur retour, le sol encaisse un coup de fer tout autour.',
      upgrades: lines('+8 dégâts', '+15 % de zone', [{ name: 'Quatre écrous', desc: '+2 écrous, vers l’arrière aussi ; −3 dégâts' }, { name: 'Étincelle', desc: 'Des étincelles sautent entre les ennemis ; +10 dégâts' }], 'Recharge 0.4s plus rapide et +8 dégâts'),
    },
    crushGrip: {
      description: 'La main du géant se referme sur l’ennemi le plus fort en vue et serre, encore et encore. Plus il est gros, plus ça fait mal : boss et élites subissent +60 %.',
      upgrades: lines('+8 dégâts', '+1 main', [{ name: 'Poing de titan', desc: '+15 % de zone ; +8 dégâts' }, { name: 'Écraser', desc: 'Les ennemis vaincus explosent ; +6 dégâts' }], 'Recharge 0.5s plus rapide et +8 dégâts'),
    },
  },
  blurbs: {
    zygarde: 'Rapide à 10 % ; ses Cells le rendent plus grand et plus fort.',
    solgaleo: 'Robuste et fort. Fonce comme une comète.',
    lunala: 'Balaie le terrain de clair de lune. Protégée à PV pleins.',
    kubfu: 'Coups sûrs. Devient Urshifu au style de sa tour.',
    meltan: 'Un aimant énorme. Ramassez des écrous pour Melmetal.',
    regigigas: 'Démarre lentement. Puis le plus fort de tous.',
  },
  epithet: 'Colosse Ancestral',
  phases: ['*Regigigas* est bien réveillé ! Il invoque le pouvoir des trois _Regis_.', 'Crush Grip ! La main se referme : courez vers un _abri_.'],
  paths: {
    names: { zygarde: 'Zygarde Cube', cosmog: 'Recherche stellaire', kubfu: 'Tour du Dojo', meltan: 'Mystery Box', regigigas: 'Temple du Géant' },
    npc: { zygarde: 'Sudowoodo', cosmog: 'Lanturn', kubfu: 'Machoke', meltan: 'Kecleon', regigigas: 'Ninjask' },
    intro: {
      zygarde: [
        'Psst ! Je ne suis pas un arbre… bon, peu importe.',
        'De petites boules vertes sortent du sol pendant les parties : des *Zygarde Cells*. Touchez-en une quand vous la voyez !',
        'Avec 10 dans le Cube, Zygarde arrive. Avec 50 il s’éveille en Forme 50 %, et avec 100, dont les 5 *Zygarde Cores*, en Forme Parfaite.',
      ],
      cosmog: [
        'Vous saviez qu’une petite étoile tombe de temps en temps ? Une est tombée tout près : un *Cosmog* !',
        'Il est timide. Terminez la *Recherche stellaire* (Missions, onglet Recherche) et il viendra vivre dans votre prairie.',
        'Ensuite, il grandit avec vos parties. Jouez plutôt de jour et il devient *Solgaleo* ; plutôt de nuit, *Lunala*. Il suit l’horloge de votre appareil.',
      ],
      kubfu: [
        'J’ai un élève spécial qui attend : un *Kubfu*. Il ne suit que ceux qui réussissent ma *Tour*.',
        'Trois épreuves ici au Dojo, avec les capacités que je vous donne. Gagnez-les toutes et Kubfu vient avec vous.',
        'Puis une dernière épreuve dans une tour : celle *des Ténèbres* ou celle *des Eaux*. Elle décide du style d’Urshifu, pour de bon.',
      ],
      meltan: [
        'Psst, client ! Un mineur de l’*Excavation* jure avoir vu une *Mystery Box* là-dessous.',
        'On dit qu’il y a un Meltan dedans ! Creusez les murs du Poké Realm, qui sait…',
        'Et Meltan mange des *Écrous Hexagonaux* : jouez avec lui et ramassez-en 400 pour qu’il devienne *Melmetal* à son deuxième éveil.',
      ],
      regigigas: [
        'Zzzt ! Petite nouvelle : qui capture *Regirock*, *Regice* et *Registeel* réveille un géant.',
        'Un *temple ancien* commence à apparaître dans vos parties. Approchez-vous…',
        '…et *Regigigas* s’éveille. Lent au début, mais ensuite… attention !',
      ],
    },
    where: {
      zygarde: 'Ramassez des *Zygarde Cells* en partie : avec 10 dans le Cube, il arrive.',
      solgaleo: 'Grandit d’un *Cosmog* élevé de jour : commencez par la Recherche stellaire.',
      lunala: 'Grandit d’un *Cosmog* élevé de nuit : commencez par la Recherche stellaire.',
      kubfu: 'Gagnez les trois épreuves de la *Tour*, au Dojo de Machoke.',
      meltan: 'Dort dans une *Mystery Box* à l’Excavation du Poké Realm. Compte requis.',
      regigigas: 'Capturez *Regirock*, *Regice* et *Registeel* : puis battez-le au temple qui surgit en partie.',
    },
    gift: { zygarde: 'Pour les Zygarde Cells', cosmog: 'Votre Cosmog a grandi', kubfu: 'Pour les épreuves de la Tour', meltan: 'De la Mystery Box', regigigas: 'Du temple' },
    open: 'Voir le chemin',
    close: 'Fermer',
    run: {
      cellSighted: 'Une *Zygarde Cell* est sortie tout près ! Suivez la flèche.',
      coreSighted: 'Un *Zygarde Core* ! Il s’enfuit lentement : rattrapez-le !',
      cellFound: (pieces: string) => `*Zygarde Cell* rangée dans le Cube ! _${pieces}_`,
      coreFound: (cores: string) => `*Zygarde Core* rangé dans le Cube ! _${cores}_`,
      cellGone: 'La Zygarde Cell s’est enfouie et a disparu…',
      coreGone: 'Le Zygarde Core s’est échappé sous terre…',
      templeRisen: 'Un *temple ancien* est sorti du sol ! Suivez la flèche.',
      templeSilent: 'Le temple est silencieux : finissez d’abord le combat contre le boss.',
      templeWoken: 'Le temple tremble…',
      nutFirst: '*Écrou Hexagonal* ! Meltan les ramasse pour devenir Melmetal.',
      formOpen: (name: string) => `*${name}* débloqué en mode Légende !`,
    },
    cube: {
      title: 'ZYGARDE CUBE',
      pieces: (n: string) => `${n} %`,
      cells: (n: string, max: string) => `Cells : ${n}/${max}`,
      cores: (n: string, max: string) => `Cores : ${n}/${max}`,
      forms: { ten: 'Zygarde 10 %', fifty: 'Forme 50 %', complete: 'Forme Parfaite' },
      open: 'Débloquée',
      need: (n: string) => `Encore ${n}`,
      needCores: (n: string) => `Encore ${n} Cores`,
      hint: 'Zygarde Cells et Cores apparaissent en partie solo, sur la carte ouverte : jusqu’à 3 Cells par partie, un Core de temps en temps. La Forme 50 % vient au 1er éveil, la Parfaite au 2e.',
    },
    cosmog: {
      researchHead: 'Cosmog',
      steps: { night: 'Gagnez une partie de nuit (18 h à 6 h)', day: 'Gagnez une partie de jour (6 h à 18 h)', rift: 'Battez le légendaire d’une faille' },
      researchNote: 'Une étape par partie, dans n’importe quel ordre. L’horloge de votre appareil compte.',
      runs: (n: string, to: string) => `${n}/${to} parties`,
      toCosmoem: (n: number) => (n === 1 ? 'Encore 1 partie pour devenir Cosmoem.' : `Encore ${n} parties pour devenir Cosmoem.`),
      toLegend: (n: number) => (n === 1 ? 'Encore 1 partie pour évoluer !' : `Encore ${n} parties pour évoluer.`),
      sun: 'Soleil',
      moon: 'Lune',
      lean: (name: string) => `Il penche vers *${name}*.`,
      leanMissing: (name: string) => `Celui-ci regrette l’autre ciel : il deviendra *${name}*.`,
      how: 'Les parties de 5 minutes ou plus comptent. Celles finies de jour (6 h à 18 h) sont au Soleil ; de nuit, à la Lune. Le plus grand total décide : Solgaleo ou Lunala.',
      none: 'Terminez la Recherche stellaire pour que Cosmog arrive.',
      raised: (names: string) => `Déjà élevés : ${names}.`,
      grew: '*Cosmog* est devenu *Cosmoem* !',
      evolved: (name: string) => `Votre Cosmoem a évolué en *${name}* ! Ouvrez le Cadeau.`,
    },
    tower: {
      title: 'TOUR DU DOJO',
      intro: 'Chaque épreuve vous donne un Pokémon et ses capacités. Seule votre façon de jouer compte.',
      floors: {
        fist: { name: 'Poing ferme', desc: 'Un seul mannequin. Restez collé et frappez sans arrêt.' },
        crowd: { name: 'Au cœur de la foule', desc: 'Dix mannequins ensemble : seul au milieu d’eux vous les atteignez tous.' },
        chase: { name: 'Cibles en fuite', desc: 'Quatre mannequins qui courent en cercle. Placez autant de coups que possible.' },
        dark: { name: 'Tour des Ténèbres', desc: 'Des mannequins blindés qui esquivent : abattez-les d’un coup lourd à chaque fois.' },
        water: { name: 'Tour des Eaux', desc: 'Des coups comme un courant : nombreux et rapides, sur les mannequins qui courent.' },
      },
      goal: {
        damage: (n: string, s: number) => `Infligez ${n} dégâts en ${s} s`,
        hits: (n: string, s: number) => `Placez ${n} coups en ${s} s`,
        knockouts: (n: string, s: number) => `Abattez ${n} mannequins en ${s} s`,
      },
      loadout: (name: string, moves: string) => `${name} · ${moves}`,
      start: 'Commencer',
      retry: 'Encore',
      back: 'Retour',
      locked: 'Verrouillée',
      cleared: 'Réussie',
      chosen: 'Choisie',
      closed: 'Fermée',
      timeLeft: (s: string) => `${s} s`,
      progress: (n: string, need: string) => `${n}/${need}`,
      won: 'Épreuve réussie !',
      lost: 'Temps écoulé.',
      kubfu: '*Kubfu* veut venir avec vous ! Ouvrez le Cadeau dans le lobby.',
      urshifu: (style: string) => `Kubfu a choisi le *${style}* : à son 2e éveil il devient *Urshifu*.`,
      chooseNote: 'On ne peut gravir qu’une des deux tours. Celle choisie décide du style d’Urshifu pour de bon.',
      styles: { dark: 'Style Poing Final', water: 'Style Mille Poings' },
    },
    meltan: {
      box: 'Mystery Box',
      boxHint: 'Elle vient parfois enfouie dans un mur de l’Excavation, tant que vous n’avez pas Meltan.',
      found: 'Il y a un Meltan dedans ! Il vous attend dans le Cadeau du lobby.',
      nuts: (n: string, need: string) => `Écrous : ${n}/${need}`,
      ready: 'Meltan devient *Melmetal* à son 2e éveil.',
      note: 'En jouant Meltan, les ennemis lâchent des Écrous Hexagonaux (les types Acier, plus souvent). Avec 400, son 2e éveil le transforme en Melmetal.',
    },
    regi: {
      wakers: (n: number) => `Trio capturé : ${n}/3`,
      awake: 'Le géant est réveillé : le temple peut surgir dans vos parties solo.',
      note: 'Une fois capturé, le temple revient de temps en temps, pour une revanche.',
    },
  },
}

const zh: PathWords = {
  abilities: {
    powerConstruct: 'HP 低於一半時，Cell 聚集起來：受到的傷害 −25%，並持續回復。',
    fullMetalBody: '地形不會讓你減速，受到的傷害 −12%。',
    shadowShield: 'HP 全滿時，受到的傷害 −45%。',
    magnetPull: '更大的磁力範圍（+30），防禦 +1。',
    slowStart: '一開始又慢又弱；每 12 秒變強一些，一分鐘後超越平常。',
  },
  moves: {
    coreEnforcer: {
      description: 'Zygarde 的核心在最大的敵群上，一筆一筆畫出綠光的 Z。被劃過的敵人會被壓制：一段時間內變慢。',
      upgrades: lines('傷害 +10', '範圍 +15%', [{ name: '雙重秩序', desc: 'Z +1；傷害 −4' }, { name: '審判', desc: '倒下的敵人會爆炸；傷害 +12' }], '冷卻快 0.5 秒，傷害 +10'),
    },
    sunsteelStrike: {
      description: 'Solgaleo化為陽光的彗星：直線穿過敵群，在停下的地方像小太陽般爆開。',
      upgrades: lines('傷害 +14', '範圍 +15%', [{ name: '彗星雨', desc: '彗星 +1；傷害 −6' }, { name: '太陽回音', desc: '每次施放以一半威力重複；傷害 +16' }], '冷卻快 0.5 秒，傷害 +12'),
    },
    moongeistBeam: {
      description: 'Lunala展開雙翼，一道月光橫掃戰場，反覆擊中掃過的一切；光束的盡頭會留下一輪月亮。',
      upgrades: lines('傷害 +6', '範圍 +15%', [{ name: '月蝕', desc: '光束 +1，往另一邊；傷害 −2' }, { name: '月影', desc: '吸取生命；傷害 +6' }], '冷卻快 0.5 秒，傷害 +6'),
    },
    wickedBlow: {
      description: '對最近的敵人打出絕不落空的一擊。連擊流的Urshifu會改用 Surging Strikes：連續三下水之拳。',
      upgrades: lines('傷害 +16', '範圍 +15%', [{ name: '雙拳', desc: '出拳 +1；傷害 −6' }, { name: '終結一擊', desc: '倒下的敵人會爆炸；傷害 +18' }], '冷卻快 0.35 秒，傷害 +14'),
    },
    doubleIronBash: {
      description: '兩顆六角螺帽旋轉飛向敵人再飛回來；落下時，地面四周受到一記鋼鐵重擊。',
      upgrades: lines('傷害 +8', '範圍 +15%', [{ name: '四顆螺帽', desc: '螺帽 +2，也往後方；傷害 −3' }, { name: '火花', desc: '火花在敵人之間跳躍；傷害 +10' }], '冷卻快 0.4 秒，傷害 +8'),
    },
    crushGrip: {
      description: '巨人的手握住視野中最強的敵人，一次又一次地捏緊。目標越大越痛：首領和精英承受 +60%。',
      upgrades: lines('傷害 +8', '手 +1', [{ name: '巨人之拳', desc: '範圍 +15%；傷害 +8' }, { name: '捏碎', desc: '倒下的敵人會爆炸；傷害 +6' }], '冷卻快 0.5 秒，傷害 +8'),
    },
  },
  blurbs: {
    zygarde: '10% 時很快；Cell 讓它變得更大更強。',
    solgaleo: '耐打又強壯。像彗星一樣衝撞。',
    lunala: '用月光橫掃戰場。HP 全滿時受到保護。',
    kubfu: '必中的拳。依塔的流派變成Urshifu。',
    meltan: '超大的磁力。收集螺帽變成Melmetal。',
    regigigas: '起步很慢。之後是最強的。',
  },
  epithet: '遠古巨像',
  phases: ['*Regigigas* 完全醒來了！它召喚三隻 _Regi_ 的力量。', 'Crush Grip！巨手正在合攏：快跑向 _掩護處_。'],
  paths: {
    names: { zygarde: 'Zygarde Cube', cosmog: '星空研究', kubfu: '道館之塔', meltan: 'Mystery Box', regigigas: '巨人神殿' },
    npc: { zygarde: 'Sudowoodo', cosmog: 'Lanturn', kubfu: 'Machoke', meltan: 'Kecleon', regigigas: 'Ninjask' },
    intro: {
      zygarde: [
        '噓！我不是樹……好啦，這不重要。',
        '最近對戰時地上會冒出綠色的小團團：*Zygarde Cell*。看到就碰一下！',
        'Cube 裡有 10 個，Zygarde就會來。有 50 個它會覺醒為 50% 形態，有 100 個（包含 5 個 *Zygarde Core*）則是完全體形態。',
      ],
      cosmog: [
        '你知道偶爾會有小星星掉下來嗎？附近就掉了一個：*Cosmog*！',
        '它很害羞。完成 *星空研究*（任務，研究分頁），它就會來你的草原住。',
        '之後它會隨著你的對戰長大。白天玩得多，會變成 *Solgaleo*；晚上玩得多，則是 *Lunala*。它跟著你裝置的時鐘。',
      ],
      kubfu: [
        '我有個特別的學生在等：一隻 *Kubfu*。它只跟隨通過我 *塔* 的人。',
        '在道館這裡有三場考驗，用我給你的招式。三場都贏，Kubfu就跟你走。',
        '最後還有一場在塔裡的考驗：*惡之塔* 或 *水之塔*。它會永遠決定Urshifu的流派。',
      ],
      meltan: [
        '噓，客人！*礦坑挖掘* 的礦工發誓在底下看到一個 *Mystery Box*。',
        '聽說裡面有一隻Meltan！去挖 Poké Realm 的岩壁，說不定……',
        'Meltan會吃 *六角螺帽*：和它一起對戰並收集 400 個，第二次覺醒時它就會變成 *Melmetal*。',
      ],
      regigigas: [
        '嗞嗞！快訊：捕捉了 *Regirock*、*Regice* 和 *Registeel* 的人，會喚醒一個巨人。',
        '你的對戰中會開始出現一座 *古老神殿*。走過去……',
        '……*Regigigas* 就會甦醒。一開始很慢，但之後……小心！',
      ],
    },
    where: {
      zygarde: '在對戰中收集 *Zygarde Cell*：Cube 裡有 10 個，它就會來。',
      solgaleo: '由白天養大的 *Cosmog* 長成：從星空研究開始。',
      lunala: '由晚上養大的 *Cosmog* 長成：從星空研究開始。',
      kubfu: '在 Machoke 的道館贏下 *塔* 的三場考驗。',
      meltan: '睡在 Poké Realm 礦坑挖掘的 *Mystery Box* 裡。需要帳號。',
      regigigas: '捕捉 *Regirock*、*Regice* 和 *Registeel*：然後在對戰中出現的神殿打倒它。',
    },
    gift: { zygarde: '來自 Zygarde Cell', cosmog: '你的 Cosmog 長大了', kubfu: '塔的考驗', meltan: '來自 Mystery Box', regigigas: '來自神殿' },
    open: '查看路線',
    close: '關閉',
    run: {
      cellSighted: '附近冒出了一個 *Zygarde Cell*！跟著箭頭走。',
      coreSighted: '一個 *Zygarde Core*！它會慢慢逃走：快追上！',
      cellFound: (pieces: string) => `*Zygarde Cell* 收進 Cube了！_${pieces}_`,
      coreFound: (cores: string) => `*Zygarde Core* 收進 Cube了！_${cores}_`,
      cellGone: 'Zygarde Cell 鑽進土裡不見了……',
      coreGone: 'Zygarde Core 溜回地底了……',
      templeRisen: '一座 *古老神殿* 從地面升起！跟著箭頭走。',
      templeSilent: '神殿很安靜：先打完首領吧。',
      templeWoken: '神殿在震動……',
      nutFirst: '*六角螺帽*！Meltan收集它們來變成Melmetal。',
      formOpen: (name: string) => `傳說模式解鎖了 *${name}*！`,
    },
    cube: {
      title: 'Zygarde Cube',
      pieces: (n: string) => `${n}%`,
      cells: (n: string, max: string) => `Cell：${n}/${max}`,
      cores: (n: string, max: string) => `Core：${n}/${max}`,
      forms: { ten: 'Zygarde 10%', fifty: '50% 形態', complete: '完全體形態' },
      open: '已解鎖',
      need: (n: string) => `還差 ${n}`,
      needCores: (n: string) => `還差 ${n} 個 Core`,
      hint: 'Zygarde Cell 和 Core 出現在單人對戰的開放地圖上：每場最多 3 個 Cell，偶爾一個 Core。50% 形態在第 1 次覺醒時到來，完全體在第 2 次。',
    },
    cosmog: {
      researchHead: 'Cosmog',
      steps: { night: '在晚上贏一場（18 點到 6 點）', day: '在白天贏一場（6 點到 18 點）', rift: '打倒裂縫中的傳說寶可夢' },
      researchNote: '每場一步，順序不拘。以你裝置的時鐘為準。',
      runs: (n: string, to: string) => `${n}/${to} 場`,
      toCosmoem: (n: number) => `再 ${n} 場變成Cosmoem。`,
      toLegend: (n: number) => (n === 1 ? '再 1 場就進化！' : `再 ${n} 場進化。`),
      sun: '太陽',
      moon: '月亮',
      lean: (name: string) => `它偏向 *${name}*。`,
      leanMissing: (name: string) => `這隻想念另一片天空：它會變成 *${name}*。`,
      how: '5 分鐘以上的對戰才算。白天（6 點到 18 點）結束的算太陽；晚上的算月亮。哪邊多就決定：Solgaleo或Lunala。',
      none: '完成星空研究，Cosmog才會來。',
      raised: (names: string) => `已經養大：${names}。`,
      grew: '*Cosmog* 變成了 *Cosmoem*！',
      evolved: (name: string) => `你的Cosmoem進化成了 *${name}*！打開禮物吧。`,
    },
    tower: {
      title: '道館之塔',
      intro: '每場考驗會給你一隻寶可夢和它的招式。只看你怎麼玩。',
      floors: {
        fist: { name: '穩定的拳', desc: '只有一個木樁。貼近它，不停地打。' },
        crowd: { name: '衝進人群', desc: '十個木樁擠在一起：只有站在中間才能打到全部。' },
        chase: { name: '逃跑的目標', desc: '四個木樁繞著圈跑。盡量多打中幾下。' },
        dark: { name: '惡之塔', desc: '會閃躲的裝甲木樁：每個都用沉重的一擊打倒。' },
        water: { name: '水之塔', desc: '像水流一樣的拳：又多又快，打向奔跑的木樁。' },
      },
      goal: {
        damage: (n: string, s: number) => `在 ${s} 秒內造成 ${n} 傷害`,
        hits: (n: string, s: number) => `在 ${s} 秒內打中 ${n} 下`,
        knockouts: (n: string, s: number) => `在 ${s} 秒內打倒 ${n} 個木樁`,
      },
      loadout: (name: string, moves: string) => `${name} · ${moves}`,
      start: '開始',
      retry: '再來',
      back: '返回',
      locked: '未解鎖',
      cleared: '已通過',
      chosen: '已選擇',
      closed: '已關閉',
      timeLeft: (s: string) => `${s} 秒`,
      progress: (n: string, need: string) => `${n}/${need}`,
      won: '考驗通過！',
      lost: '時間到了。',
      kubfu: '*Kubfu* 想跟你走！到大廳打開禮物吧。',
      urshifu: (style: string) => `Kubfu選擇了 *${style}*：第 2 次覺醒時會變成 *Urshifu*。`,
      chooseNote: '兩座塔只能爬一座。選擇的那座會永遠決定Urshifu的流派。',
      styles: { dark: '一擊流', water: '連擊流' },
    },
    meltan: {
      box: 'Mystery Box',
      boxHint: '你還沒有Meltan時，它有時會埋在礦坑挖掘的岩壁裡。',
      found: '裡面有一隻 Meltan！它在大廳的禮物裡等你。',
      nuts: (n: string, need: string) => `螺帽：${n}/${need}`,
      ready: 'Meltan會在第 2 次覺醒時變成 *Melmetal*。',
      note: '用Meltan對戰時，敵人會掉落六角螺帽（鋼屬性的更常掉）。有 400 個時，第 2 次覺醒會把它變成Melmetal。',
    },
    regi: {
      wakers: (n: number) => `已捕捉 Regi 三柱：${n}/3`,
      awake: '巨人醒了：神殿會出現在你的單人對戰中。',
      note: '捕捉之後，神殿仍會偶爾出現，可以再戰。',
    },
  },
}

export const LEGEND_PATHS_WORDS = { pt, en, es, fr, zh } as const satisfies Record<'pt' | 'en' | 'es' | 'fr' | 'zh', PathWords>
