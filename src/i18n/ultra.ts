import type { UltraBeast } from '../data/ultraBeasts'
import type { UltraMoveId } from '../game/ultraMoves'
import type { DomainLines } from './pt'

/**
 * The Ultra Beasts' words (`data/ultraBeasts.ts`), a table per language (`pt`
 * is the reference): their moves, blurbs and domains, Beast Boost, and the
 * Ultra Wormhole's lines (`ui`). Each language's file spreads its parts in
 * place, so the five stay in step with `game/ultraMoves.ts`. Pokémon, move
 * and item names stay in English.
 */

type Fork = { readonly fork: readonly [{ name: string; desc: string }, { name: string; desc: string }] }
type MoveText = { description: string; upgrades: readonly [string, string, Fork, string] }
type Ultra = 'nihilego' | 'buzzwole' | 'pheromosa' | 'xurkitree' | 'celesteela' | 'kartana' | 'guzzlord' | 'stakataka' | 'blacephalon' | 'naganadel' | 'poipole'

type UltraWords = {
  abilities: { beastBoost: string }
  moves: Record<UltraMoveId, MoveText>
  blurbs: Record<Ultra, string>
  domains: Record<UltraBeast, DomainLines>
  ui: {
    /** The omen, after the beast's own line: what's coming. */
    omen: (name: string) => string
    /** The wormhole stands open on the map, and the HUD's pill while it does. */
    open: string
    hudPortal: (time: string) => string
    /** The beast of the week: the lobby's card and its line, and the tag on its partner cell. */
    week: { title: string; line: (name: string, until: string) => string; tag: string; card: (name: string) => string; cardLine: string }
    /** The partner select's heading over the Ultra Beasts. */
    heading: string
    /** Poipole's locked card: how many beasts are captured. */
    progress: (n: number, of: number) => string
    /** A beast caught in its Beast Ball, and the last one (Poipole waits in the gift box). */
    caught: (name: string) => string
    allCaught: string
  }
}

const fork = (a: string, ad: string, b: string, bd: string): Fork => ({ fork: [{ name: a, desc: ad }, { name: b, desc: bd }] })

const pt: UltraWords = {
  abilities: {
    beastBoost: 'Cada sequência de nocautes aumenta seu melhor atributo (um nível a cada 12, até 5); sem nocautes, um nível some a cada 4 s.',
  },
  moves: {
    acidSpray: {
      description: 'Nihilego espirra um leque de ácido que atravessa 2 inimigos, e cada gota deixa uma poça. Sua neurotoxina pode confundir: o inimigo anda sem rumo e esbarra nos outros (chefes resistem).',
      upgrades: ['+6 de dano', '+2 gotas', fork('Neurotoxina', '+25% de chance de confundir; poças duram +0.6s', 'Ácido corrosivo', 'Os que caem explodem; +8 de dano'), 'Recarga 0.4s mais rápida e +6 de dano'],
    },
    powerUpPunch: {
      description: 'Buzzwole soca o inimigo mais perto. Cada golpe que acerta o infla: o próximo bate 12% mais forte e mais largo, até 6 vezes. Levar dano desinfla.',
      upgrades: ['+12 de dano', '+15% de área', fork('Soco explosivo', 'Os que caem explodem; +12 de dano', 'Bomba de músculos', 'Seus golpes te curam; recarga 0.25s mais rápida'), 'Recarga 0.25s mais rápida e +12 de dano'],
    },
    lunge: {
      description: 'Imagens de Pheromosa cruzam os inimigos mais perto mais rápido do que o olho vê, atravessando todos no caminho. Pode enfraquecer: o inimigo causa 25% menos dano.',
      upgrades: ['+8 de dano', '+1 investida', fork('Graça cruel', '+30% de chance de enfraquecer; +4 de dano', 'Caçadora', 'Mais dano em chefes e elites; +10 de dano'), 'Recarga 0.35s mais rápida e +8 de dano'],
    },
    tailGlow: {
      description: 'Xurkitree finca plugues luminosos ao seu redor e estica fios vivos entre eles: quem fica preso num fio leva choque de novo e de novo, e pode ficar paralisado.',
      upgrades: ['+4 de dano', '+1 plugue', fork('Rede elétrica', 'Os fios duram +1s; +15% de área', 'Curto-circuito', 'Os choques saltam para inimigos próximos; +20% de paralisia'), 'Recarga 0.6s mais rápida e +4 de dano'],
    },
    autotomize: {
      description: 'Celesteela solta suas placas como foguetes: eles decolam, fazem um arco e caem sobre as maiores multidões, e podem queimar. Mais leve, ela corre mais por 2.4s.',
      upgrades: ['+12 de dano', '+1 foguete', fork('Ogiva larga', '+20% de área', 'Ogiva em cadeia', 'Os que caem explodem; +14 de dano'), 'Recarga 0.5s mais rápida e +12 de dano'],
    },
    guillotine: {
      description: 'Kartana corta um X em cada um dos inimigos mais perto, fino como papel e sem nunca errar; um inimigo comum que fica quase sem vida cai na hora.',
      upgrades: ['+12 de dano', '+1 X', fork('Corte final', 'Inimigos com pouca vida caem na hora; +12 de dano', 'Fio do caçador', 'Mais dano em chefes e elites; recarga 0.3s mais rápida'), 'Recarga 0.3s mais rápida e +12 de dano'],
    },
    belch: {
      description: 'A bocarra de Guzzlord se abre sobre a maior multidão e a puxa, mordendo, até se fechar sobre o que pegou: devorar cura. A cada 3º lançamento, ele arrota tudo de volta numa onda ao seu redor.',
      upgrades: ['+10 de dano', '+15% de área', fork('Bocarra', 'A boca fica aberta +0.5s; +6 de dano', 'Indigestão', 'Os que caem explodem; +12 de dano'), 'Recarga 0.4s mais rápida e +10 de dano'],
    },
    wideGuard: {
      description: 'As pedras de Stakataka se empilham num muro à sua frente, empurrando todo inimigo que bate nele. Enquanto ele sobe, o primeiro golpe em você é bloqueado.',
      upgrades: ['+8 de dano', '+2 pedras', fork('Fortaleza', 'O muro dura +1s; +15% de área', 'Aríete', 'Empurra mais e bate mais em chefes e elites; +10 de dano'), 'Recarga 0.6s mais rápida e +8 de dano'],
    },
    mindBlown: {
      description: 'Blacephalon arremessa a própria cabeça na maior multidão, onde ela explode em fogo e confete, e pode queimar. Uma nova acende em seus ombros.',
      upgrades: ['+14 de dano', '+15% de área', fork('Duas cabeças', '+1 cabeça; -6 de dano', 'Grand finale', 'Os que caem explodem; +16 de dano'), 'Recarga 0.4s mais rápida e +14 de dano'],
    },
    fellStinger: {
      description: 'Naganadel dispara ferrões que perseguem os inimigos mais perto; um inimigo nocauteado por um deles o deixa afiado: +15% de dano por 5s.',
      upgrades: ['+6 de dano', '+2 ferrões', fork('Ferrão perfurante', 'Atravessa +1 inimigo; +4 de dano', 'Ferrão duplo', 'Divide-se em dois no primeiro acerto; +6 de dano'), 'Recarga 0.25s mais rápida e +6 de dano'],
    },
    poisonJab: {
      description: 'Poipole crava sua agulha de veneno no inimigo mais perto, várias vezes seguidas, e pode envenenar.',
      upgrades: ['+5 de dano', '+1 golpe', fork('Veneno forte', '+30% de chance de envenenar; +25% de dano do veneno', 'Agulha sedenta', 'Seus golpes te curam; +6 de dano'), 'Recarga 0.2s mais rápida e +5 de dano'],
    },
  },
  blurbs: {
    nihilego: 'Neurotoxina. Ácido que confunde e defesa que cresce.',
    buzzwole: 'Músculos. Socos que crescem a cada acerto.',
    pheromosa: 'Velocidade. Investidas que atravessam tudo.',
    xurkitree: 'Fios vivos. Uma rede de choque ao seu redor.',
    celesteela: 'Foguetes. Bombardeia multidões e fica mais rápida.',
    kartana: 'Lâminas. Cortes que nunca erram.',
    guzzlord: 'Devorar. Puxa, morde e se cura.',
    stakataka: 'Muralha. Empurra a horda e bloqueia golpes.',
    blacephalon: 'Explosões. Arremessa a própria cabeça.',
    naganadel: 'Ferrões. Cada nocaute o deixa mais afiado.',
    poipole: 'Agulha de veneno. Evolui em Naganadel no 1º despertar.',
  },
  domains: {
    nihilego: {
      place: 'Ultra-Abismo',
      epithet: 'Parasita do Além',
      omen: 'O céu se racha em luz de prisma, e um frio de veneno desce…',
      crossing: 'A Ultrafenda está se fechando atrás de você! Atravesse o Ultraespaço!',
      phases: ['*Nihilego* libera a neurotoxina! Os tentáculos te puxam: não fique parado.'],
    },
    buzzwole: {
      place: 'Ultra-Selva',
      epithet: 'Colosso Muscular',
      omen: 'O céu se racha em luz de prisma, e o ar zune como uma colmeia…',
      crossing: 'A Ultrafenda está se fechando atrás de você! Atravesse o Ultraespaço!',
      phases: ['*Buzzwole* entra no ritmo! Saia de perto antes do Superpower.'],
      cues: { pump: '*Buzzwole* flexiona os músculos! Agora bate mais forte.' },
    },
    pheromosa: {
      place: 'Ultra-Deserto',
      epithet: 'Graça Letal',
      omen: 'O céu se racha em luz de prisma, e um vento fino corta a areia…',
      crossing: 'A Ultrafenda está se fechando atrás de você! Atravesse o Ultraespaço!',
      phases: ['*Pheromosa* dança: o tempo corre mais rápido para ela!'],
    },
    xurkitree: {
      place: 'Ultra-Usina',
      epithet: 'Fios Vivos',
      omen: 'O céu se racha em luz de prisma, e tudo começa a estalar de estática…',
      crossing: 'A Ultrafenda está se fechando atrás de você! Atravesse o Ultraespaço!',
      phases: ['*Xurkitree* acende! Corra para trás dos cristais antes do Zap Cannon.'],
    },
    celesteela: {
      place: 'Ultra-Cratera',
      epithet: 'Foguete Vivo',
      omen: 'O céu se racha em luz de prisma, e um ronco de motores vem de cima…',
      crossing: 'A Ultrafenda está se fechando atrás de você! Atravesse o Ultraespaço!',
      phases: ['*Celesteela* decola! Fuja da trilha de fogo dela.'],
    },
    kartana: {
      place: 'Ultra-Floresta',
      epithet: 'Lâmina de Papel',
      omen: 'O céu se racha em luz de prisma, e folhas finas como papel caem…',
      crossing: 'A Ultrafenda está se fechando atrás de você! Atravesse o Ultraespaço!',
      phases: ['*Kartana* afia as bordas! Os cortes vêm de todo lado.'],
    },
    guzzlord: {
      place: 'Ultra-Ruínas',
      epithet: 'Fome Sem Fim',
      omen: 'O céu se racha em luz de prisma, e um ronco faminto ecoa…',
      crossing: 'A Ultrafenda está se fechando atrás de você! Atravesse o Ultraespaço!',
      phases: ['*Guzzlord* devora o próprio chão! Cuidado com as bordas.'],
    },
    stakataka: {
      place: 'Ultra-Muralha',
      epithet: 'Muralha Viva',
      omen: 'O céu se racha em luz de prisma, e pedras começam a se empilhar…',
      crossing: 'A Ultrafenda está se fechando atrás de você! Atravesse o Ultraespaço!',
      phases: ['As pedras de *Stakataka* se soltam: agora ela é mais frágil, e mais rápida!'],
    },
    blacephalon: {
      place: 'Ultra-Picadeiro',
      epithet: 'Palhaço Explosivo',
      omen: 'O céu se racha em luz de prisma, e fogos de artifício estouram ao longe…',
      crossing: 'A Ultrafenda está se fechando atrás de você! Atravesse o Ultraespaço!',
      phases: ['*Blacephalon* faz o grand finale! Fique longe quando a cabeça explodir.'],
    },
    naganadel: {
      place: 'Ultra-Ninho',
      epithet: 'Agulha Venenosa',
      omen: 'O céu se racha em luz de prisma, e gotas de veneno brilham no ar…',
      crossing: 'A Ultrafenda está se fechando atrás de você! Atravesse o Ultraespaço!',
      phases: ['*Naganadel* mergulha em rasantes! Saia das faixas marcadas.'],
    },
  },
  ui: {
    omen: (name) => `Uma *Ultrafenda* vai se abrir: *${name}* vem do Ultraespaço!`,
    open: 'A *Ultrafenda* se abriu! Entre nela para enfrentar a Ultracriatura.',
    hudPortal: (time) => `Ultrafenda ${time}`,
    week: {
      title: 'Ultracriatura da semana',
      line: (name, until) => `*${name}* sai das Ultrafendas com mais frequência até ${until}.`,
      tag: 'Da semana',
      card: (name) => `Ultra: ${name}`,
      cardLine: 'mais frequente esta semana',
    },
    heading: 'ULTRACRIATURAS',
    progress: (n, of) => `Ultracriaturas capturadas: ${n}/${of}`,
    caught: (name) => `*${name}* capturado numa *Beast Ball*! Jogável no _Modo Lendário_.`,
    allCaught: 'Todas as Ultracriaturas capturadas! *Poipole* espera na caixa de presentes.',
  },
}

const en: UltraWords = {
  abilities: {
    beastBoost: 'Every KO streak raises its best stat (a level every 12 KOs, up to 5); without KOs, a level wears off every 4 s.',
  },
  moves: {
    acidSpray: {
      description: 'Nihilego sprays a fan of acid that eats through 2 foes, each drop leaving a puddle. Its neurotoxin can confuse: the foe wanders off and bumps into the others (bosses resist).',
      upgrades: ['+6 damage', '+2 drops', fork('Neurotoxin', '+25% confusion chance; puddles last +0.6s', 'Corrosive acid', 'Fainted foes explode; +8 damage'), '0.4s faster cooldown and +6 damage'],
    },
    powerUpPunch: {
      description: 'Buzzwole punches the nearest foe. Every blow that lands pumps it up: the next hits 12% harder and wider, up to 6 times. Getting hurt deflates it.',
      upgrades: ['+12 damage', '+15% area', fork('Blast punch', 'Fainted foes explode; +12 damage', 'Muscle pump', 'Its hits heal you; 0.25s faster cooldown'), '0.25s faster cooldown and +12 damage'],
    },
    lunge: {
      description: 'Pheromosa\'s afterimages streak through the nearest foes faster than the eye can follow, through everything in the way. It can weaken: the foe deals 25% less damage.',
      upgrades: ['+8 damage', '+1 lunge', fork('Cruel grace', '+30% weaken chance; +4 damage', 'Huntress', 'More damage to bosses and elites; +10 damage'), '0.35s faster cooldown and +8 damage'],
    },
    tailGlow: {
      description: 'Xurkitree plants glowing plugs around itself and strings live wires between them: foes caught on a wire are shocked again and again, and may be paralyzed.',
      upgrades: ['+4 damage', '+1 plug', fork('Power grid', 'Wires last +1s; +15% area', 'Short circuit', 'Shocks arc to nearby foes; +20% paralysis'), '0.6s faster cooldown and +4 damage'],
    },
    autotomize: {
      description: 'Celesteela sheds its plating as rockets: they lift off, arc over and crash down on the densest crowds, and can burn. Lighter, it runs faster for 2.4s.',
      upgrades: ['+12 damage', '+1 rocket', fork('Wide warhead', '+20% area', 'Chain warhead', 'Fainted foes explode; +14 damage'), '0.5s faster cooldown and +12 damage'],
    },
    guillotine: {
      description: 'Kartana cuts an X through each of the nearest foes, paper-thin and never missing; a regular foe it leaves nearly spent falls outright.',
      upgrades: ['+12 damage', '+1 X', fork('Final cut', 'Foes low on HP fall at once; +12 damage', 'Hunter\'s edge', 'More damage to bosses and elites; 0.3s faster cooldown'), '0.3s faster cooldown and +12 damage'],
    },
    belch: {
      description: 'Guzzlord\'s maw opens on the densest crowd and drags it in, biting, until it shuts on what it caught: devouring heals. Every third cast, it belches it all back out in a wave around itself.',
      upgrades: ['+10 damage', '+15% area', fork('Gaping maw', 'The maw stays open +0.5s; +6 damage', 'Indigestion', 'Fainted foes explode; +12 damage'), '0.4s faster cooldown and +10 damage'],
    },
    wideGuard: {
      description: 'Stakataka\'s stones stack into a wall in front of it, shoving back every foe that runs into it. While it rises, the first hit on you is blocked.',
      upgrades: ['+8 damage', '+2 stones', fork('Fortress', 'The wall lasts +1s; +15% area', 'Battering ram', 'Shoves harder and hits bosses and elites harder; +10 damage'), '0.6s faster cooldown and +8 damage'],
    },
    mindBlown: {
      description: 'Blacephalon lobs its own head onto the densest crowd, where it blows up in fire and confetti, and can burn. A new one lights up on its shoulders.',
      upgrades: ['+14 damage', '+15% area', fork('Two heads', '+1 head; -6 damage', 'Grand finale', 'Fainted foes explode; +16 damage'), '0.4s faster cooldown and +14 damage'],
    },
    fellStinger: {
      description: 'Naganadel fires stingers that home in on the nearest foes; a foe one finishes off sharpens it: +15% damage for 5s.',
      upgrades: ['+6 damage', '+2 stingers', fork('Piercing stinger', 'Goes through +1 foe; +4 damage', 'Twin stinger', 'Splits in two on its first hit; +6 damage'), '0.25s faster cooldown and +6 damage'],
    },
    poisonJab: {
      description: 'Poipole jabs its venom needle into the nearest foe several times in a row, and can poison.',
      upgrades: ['+5 damage', '+1 jab', fork('Strong venom', '+30% poison chance; +25% poison damage', 'Thirsty needle', 'Its hits heal you; +6 damage'), '0.2s faster cooldown and +5 damage'],
    },
  },
  blurbs: {
    nihilego: 'Neurotoxin. Acid that confuses and a defense that grows.',
    buzzwole: 'Muscle. Punches that grow with every hit.',
    pheromosa: 'Speed. Lunges that go through everything.',
    xurkitree: 'Live wires. A web of shocks around it.',
    celesteela: 'Rockets. Shells crowds and speeds up.',
    kartana: 'Blades. Cuts that never miss.',
    guzzlord: 'Devour. Drags in, bites and heals.',
    stakataka: 'Wall. Shoves the horde back and blocks hits.',
    blacephalon: 'Explosions. Throws its own head.',
    naganadel: 'Stingers. Every KO sharpens it.',
    poipole: 'Venom needle. Evolves into Naganadel at its first awakening.',
  },
  domains: {
    nihilego: {
      place: 'Ultra Abyss',
      epithet: 'Parasite from Beyond',
      omen: 'The sky cracks with prismatic light, and a venomous chill comes down…',
      crossing: 'The Ultra Wormhole is closing behind you! Cross Ultra Space!',
      phases: ['*Nihilego* releases its neurotoxin! Its tentacles drag you in: keep moving.'],
    },
    buzzwole: {
      place: 'Ultra Jungle',
      epithet: 'Swollen Colossus',
      omen: 'The sky cracks with prismatic light, and the air hums like a hive…',
      crossing: 'The Ultra Wormhole is closing behind you! Cross Ultra Space!',
      phases: ['*Buzzwole* gets into its stride! Get away before Superpower.'],
      cues: { pump: '*Buzzwole* flexes! It hits harder now.' },
    },
    pheromosa: {
      place: 'Ultra Desert',
      epithet: 'Lethal Grace',
      omen: 'The sky cracks with prismatic light, and a thin wind cuts the sand…',
      crossing: 'The Ultra Wormhole is closing behind you! Cross Ultra Space!',
      phases: ['*Pheromosa* dances: time runs faster for her!'],
    },
    xurkitree: {
      place: 'Ultra Plant',
      epithet: 'Living Wires',
      omen: 'The sky cracks with prismatic light, and everything crackles with static…',
      crossing: 'The Ultra Wormhole is closing behind you! Cross Ultra Space!',
      phases: ['*Xurkitree* lights up! Get behind the crystals before Zap Cannon.'],
    },
    celesteela: {
      place: 'Ultra Crater',
      epithet: 'Living Rocket',
      omen: 'The sky cracks with prismatic light, and a roar of engines comes from above…',
      crossing: 'The Ultra Wormhole is closing behind you! Cross Ultra Space!',
      phases: ['*Celesteela* lifts off! Stay out of its trail of fire.'],
    },
    kartana: {
      place: 'Ultra Forest',
      epithet: 'Paper Blade',
      omen: 'The sky cracks with prismatic light, and leaves thin as paper fall…',
      crossing: 'The Ultra Wormhole is closing behind you! Cross Ultra Space!',
      phases: ['*Kartana* hones its edges! The cuts come from everywhere.'],
    },
    guzzlord: {
      place: 'Ultra Ruin',
      epithet: 'Endless Hunger',
      omen: 'The sky cracks with prismatic light, and a hungry rumble echoes…',
      crossing: 'The Ultra Wormhole is closing behind you! Cross Ultra Space!',
      phases: ['*Guzzlord* devours the floor itself! Mind the edges.'],
    },
    stakataka: {
      place: 'Ultra Rampart',
      epithet: 'Living Wall',
      omen: 'The sky cracks with prismatic light, and stones start stacking up…',
      crossing: 'The Ultra Wormhole is closing behind you! Cross Ultra Space!',
      phases: ['*Stakataka*\'s stones come loose: it\'s frailer now, and faster!'],
    },
    blacephalon: {
      place: 'Ultra Big Top',
      epithet: 'Fireworks Clown',
      omen: 'The sky cracks with prismatic light, and fireworks pop in the distance…',
      crossing: 'The Ultra Wormhole is closing behind you! Cross Ultra Space!',
      phases: ['*Blacephalon* goes for its grand finale! Stay far when the head blows.'],
    },
    naganadel: {
      place: 'Ultra Hive',
      epithet: 'Venom Needle',
      omen: 'The sky cracks with prismatic light, and drops of venom glint in the air…',
      crossing: 'The Ultra Wormhole is closing behind you! Cross Ultra Space!',
      phases: ['*Naganadel* swoops down! Get out of the marked lanes.'],
    },
  },
  ui: {
    omen: (name) => `An *Ultra Wormhole* is about to open: *${name}* is coming through from Ultra Space!`,
    open: 'The *Ultra Wormhole* is open! Step in to face the Ultra Beast.',
    hudPortal: (time) => `Wormhole ${time}`,
    week: {
      title: 'Ultra Beast of the week',
      line: (name, until) => `*${name}* comes through the Ultra Wormholes more often until ${until}.`,
      tag: 'This week',
      card: (name) => `Ultra: ${name}`,
      cardLine: 'more often this week',
    },
    heading: 'ULTRA BEASTS',
    progress: (n, of) => `Ultra Beasts captured: ${n}/${of}`,
    caught: (name) => `*${name}* caught in a *Beast Ball*! Playable in _Legend mode_.`,
    allCaught: 'Every Ultra Beast captured! *Poipole* is waiting in the gift box.',
  },
}

const es: UltraWords = {
  abilities: {
    beastBoost: 'Cada racha de derrotas sube su mejor estadística (un nivel cada 12, hasta 5); sin derrotas, un nivel se pierde cada 4 s.',
  },
  moves: {
    acidSpray: {
      description: 'Nihilego rocía un abanico de ácido que atraviesa a 2 enemigos, y cada gota deja un charco. Su neurotoxina puede confundir: el enemigo vaga sin rumbo y choca con los demás (los jefes resisten).',
      upgrades: ['+6 de daño', '+2 gotas', fork('Neurotoxina', '+25% de probabilidad de confundir; los charcos duran +0.6s', 'Ácido corrosivo', 'Los que caen explotan; +8 de daño'), 'Recarga 0.4s más rápida y +6 de daño'],
    },
    powerUpPunch: {
      description: 'Buzzwole golpea al enemigo más cercano. Cada golpe que acierta lo infla: el siguiente pega un 12% más fuerte y más amplio, hasta 6 veces. Recibir daño lo desinfla.',
      upgrades: ['+12 de daño', '+15% de área', fork('Puño explosivo', 'Los que caen explotan; +12 de daño', 'Bomba muscular', 'Sus golpes te curan; recarga 0.25s más rápida'), 'Recarga 0.25s más rápida y +12 de daño'],
    },
    lunge: {
      description: 'Las imágenes de Pheromosa cruzan a los enemigos más cercanos más rápido de lo que ve el ojo, atravesando todo a su paso. Puede debilitar: el enemigo hace un 25% menos de daño.',
      upgrades: ['+8 de daño', '+1 embestida', fork('Gracia cruel', '+30% de probabilidad de debilitar; +4 de daño', 'Cazadora', 'Más daño a jefes y élites; +10 de daño'), 'Recarga 0.35s más rápida y +8 de daño'],
    },
    tailGlow: {
      description: 'Xurkitree clava enchufes luminosos a su alrededor y tiende cables vivos entre ellos: quien queda atrapado en un cable recibe descargas una y otra vez, y puede paralizarse.',
      upgrades: ['+4 de daño', '+1 enchufe', fork('Red eléctrica', 'Los cables duran +1s; +15% de área', 'Cortocircuito', 'Las descargas saltan a enemigos cercanos; +20% de parálisis'), 'Recarga 0.6s más rápida y +4 de daño'],
    },
    autotomize: {
      description: 'Celesteela suelta sus placas como cohetes: despegan, hacen un arco y caen sobre las multitudes más densas, y pueden quemar. Más ligera, corre más durante 2.4s.',
      upgrades: ['+12 de daño', '+1 cohete', fork('Ojiva amplia', '+20% de área', 'Ojiva en cadena', 'Los que caen explotan; +14 de daño'), 'Recarga 0.5s más rápida y +12 de daño'],
    },
    guillotine: {
      description: 'Kartana corta una X en cada uno de los enemigos más cercanos, fina como el papel y sin fallar nunca; un enemigo común que queda casi sin vida cae al instante.',
      upgrades: ['+12 de daño', '+1 X', fork('Corte final', 'Los enemigos con poca vida caen al instante; +12 de daño', 'Filo cazador', 'Más daño a jefes y élites; recarga 0.3s más rápida'), 'Recarga 0.3s más rápida y +12 de daño'],
    },
    belch: {
      description: 'La boca de Guzzlord se abre sobre la multitud más densa y la arrastra, mordiendo, hasta cerrarse sobre lo que atrapó: devorar cura. Cada tercer lanzamiento, lo eructa todo de vuelta en una ola a su alrededor.',
      upgrades: ['+10 de daño', '+15% de área', fork('Bocaza', 'La boca queda abierta +0.5s; +6 de daño', 'Indigestión', 'Los que caen explotan; +12 de daño'), 'Recarga 0.4s más rápida y +10 de daño'],
    },
    wideGuard: {
      description: 'Las piedras de Stakataka se apilan en un muro delante de ella y empujan a todo enemigo que choca. Mientras se alza, el primer golpe que recibes queda bloqueado.',
      upgrades: ['+8 de daño', '+2 piedras', fork('Fortaleza', 'El muro dura +1s; +15% de área', 'Ariete', 'Empuja más y pega más a jefes y élites; +10 de daño'), 'Recarga 0.6s más rápida y +8 de daño'],
    },
    mindBlown: {
      description: 'Blacephalon lanza su propia cabeza a la multitud más densa, donde estalla en fuego y confeti, y puede quemar. Una nueva se enciende sobre sus hombros.',
      upgrades: ['+14 de daño', '+15% de área', fork('Dos cabezas', '+1 cabeza; -6 de daño', 'Gran final', 'Los que caen explotan; +16 de daño'), 'Recarga 0.4s más rápida y +14 de daño'],
    },
    fellStinger: {
      description: 'Naganadel dispara aguijones que persiguen a los enemigos más cercanos; un enemigo que uno remata lo afila: +15% de daño durante 5s.',
      upgrades: ['+6 de daño', '+2 aguijones', fork('Aguijón perforante', 'Atraviesa +1 enemigo; +4 de daño', 'Aguijón doble', 'Se divide en dos al primer golpe; +6 de daño'), 'Recarga 0.25s más rápida y +6 de daño'],
    },
    poisonJab: {
      description: 'Poipole clava su aguja de veneno en el enemigo más cercano varias veces seguidas, y puede envenenar.',
      upgrades: ['+5 de daño', '+1 pinchazo', fork('Veneno fuerte', '+30% de probabilidad de envenenar; +25% de daño del veneno', 'Aguja sedienta', 'Sus golpes te curan; +6 de daño'), 'Recarga 0.2s más rápida y +5 de daño'],
    },
  },
  blurbs: {
    nihilego: 'Neurotoxina. Ácido que confunde y una defensa que crece.',
    buzzwole: 'Músculo. Puñetazos que crecen con cada golpe.',
    pheromosa: 'Velocidad. Embestidas que lo atraviesan todo.',
    xurkitree: 'Cables vivos. Una red de descargas a su alrededor.',
    celesteela: 'Cohetes. Bombardea multitudes y se acelera.',
    kartana: 'Hojas. Cortes que nunca fallan.',
    guzzlord: 'Devorar. Arrastra, muerde y se cura.',
    stakataka: 'Muralla. Empuja a la horda y bloquea golpes.',
    blacephalon: 'Explosiones. Lanza su propia cabeza.',
    naganadel: 'Aguijones. Cada derrota lo afila más.',
    poipole: 'Aguja de veneno. Evoluciona en Naganadel en su primer despertar.',
  },
  domains: {
    nihilego: {
      place: 'Ultraabismo',
      epithet: 'Parásito del Más Allá',
      omen: 'El cielo se agrieta en luz de prisma y baja un frío venenoso…',
      crossing: '¡El Ultraumbral se cierra a tus espaldas! ¡Cruza el Ultraespacio!',
      phases: ['¡*Nihilego* libera su neurotoxina! Sus tentáculos te arrastran: no te quedes quieto.'],
    },
    buzzwole: {
      place: 'Ultraselva',
      epithet: 'Coloso Musculoso',
      omen: 'El cielo se agrieta en luz de prisma y el aire zumba como una colmena…',
      crossing: '¡El Ultraumbral se cierra a tus espaldas! ¡Cruza el Ultraespacio!',
      phases: ['¡*Buzzwole* entra en calor! Aléjate antes del Superpower.'],
      cues: { pump: '¡*Buzzwole* saca músculo! Ahora pega más fuerte.' },
    },
    pheromosa: {
      place: 'Ultradesierto',
      epithet: 'Gracia Letal',
      omen: 'El cielo se agrieta en luz de prisma y un viento fino corta la arena…',
      crossing: '¡El Ultraumbral se cierra a tus espaldas! ¡Cruza el Ultraespacio!',
      phases: ['*Pheromosa* baila: ¡el tiempo corre más rápido para ella!'],
    },
    xurkitree: {
      place: 'Ultracentral',
      epithet: 'Cables Vivos',
      omen: 'El cielo se agrieta en luz de prisma y todo empieza a chisporrotear…',
      crossing: '¡El Ultraumbral se cierra a tus espaldas! ¡Cruza el Ultraespacio!',
      phases: ['¡*Xurkitree* se enciende! Ponte tras los cristales antes del Zap Cannon.'],
    },
    celesteela: {
      place: 'Ultracráter',
      epithet: 'Cohete Viviente',
      omen: 'El cielo se agrieta en luz de prisma y un rugido de motores llega de arriba…',
      crossing: '¡El Ultraumbral se cierra a tus espaldas! ¡Cruza el Ultraespacio!',
      phases: ['¡*Celesteela* despega! Aléjate de su estela de fuego.'],
    },
    kartana: {
      place: 'Ultrabosque',
      epithet: 'Hoja de Papel',
      omen: 'El cielo se agrieta en luz de prisma y caen hojas finas como papel…',
      crossing: '¡El Ultraumbral se cierra a tus espaldas! ¡Cruza el Ultraespacio!',
      phases: ['¡*Kartana* afila sus bordes! Los cortes vienen de todos lados.'],
    },
    guzzlord: {
      place: 'Ultrarruinas',
      epithet: 'Hambre Sin Fin',
      omen: 'El cielo se agrieta en luz de prisma y retumba un rugido hambriento…',
      crossing: '¡El Ultraumbral se cierra a tus espaldas! ¡Cruza el Ultraespacio!',
      phases: ['¡*Guzzlord* devora el propio suelo! Cuidado con los bordes.'],
    },
    stakataka: {
      place: 'Ultramuralla',
      epithet: 'Muralla Viviente',
      omen: 'El cielo se agrieta en luz de prisma y las piedras empiezan a apilarse…',
      crossing: '¡El Ultraumbral se cierra a tus espaldas! ¡Cruza el Ultraespacio!',
      phases: ['Las piedras de *Stakataka* se sueltan: ¡ahora es más frágil, y más rápida!'],
    },
    blacephalon: {
      place: 'Ultracarpa',
      epithet: 'Payaso Explosivo',
      omen: 'El cielo se agrieta en luz de prisma y estallan fuegos artificiales a lo lejos…',
      crossing: '¡El Ultraumbral se cierra a tus espaldas! ¡Cruza el Ultraespacio!',
      phases: ['¡*Blacephalon* hace su gran final! Aléjate cuando estalle la cabeza.'],
    },
    naganadel: {
      place: 'Ultranido',
      epithet: 'Aguja Venenosa',
      omen: 'El cielo se agrieta en luz de prisma y brillan gotas de veneno en el aire…',
      crossing: '¡El Ultraumbral se cierra a tus espaldas! ¡Cruza el Ultraespacio!',
      phases: ['¡*Naganadel* baja en picada! Sal de las franjas marcadas.'],
    },
  },
  ui: {
    omen: (name) => `Un *Ultraumbral* está por abrirse: ¡*${name}* llega del Ultraespacio!`,
    open: '¡El *Ultraumbral* se abrió! Entra para enfrentar al Ultraente.',
    hudPortal: (time) => `Ultraumbral ${time}`,
    week: {
      title: 'Ultraente de la semana',
      line: (name, until) => `*${name}* sale de los Ultraumbrales más a menudo hasta el ${until}.`,
      tag: 'De la semana',
      card: (name) => `Ultra: ${name}`,
      cardLine: 'más a menudo esta semana',
    },
    heading: 'ULTRAENTES',
    progress: (n, of) => `Ultraentes capturados: ${n}/${of}`,
    caught: (name) => `¡*${name}* atrapado en una *Beast Ball*! Jugable en el _Modo Legendario_.`,
    allCaught: '¡Todos los Ultraentes capturados! *Poipole* te espera en la caja de regalos.',
  },
}

const fr: UltraWords = {
  abilities: {
    beastBoost: 'Chaque série de K.O. augmente sa meilleure stat (un niveau tous les 12, jusqu’à 5) ; sans K.O., un niveau s’efface toutes les 4 s.',
  },
  moves: {
    acidSpray: {
      description: 'Nihilego projette un éventail d’acide qui traverse 2 ennemis, chaque goutte laissant une flaque. Sa neurotoxine peut rendre confus : l’ennemi erre et bouscule les autres (les boss résistent).',
      upgrades: ['+6 dégâts', '+2 gouttes', fork('Neurotoxine', '+25% de chance de confusion ; flaques +0.6s', 'Acide corrosif', 'Les ennemis vaincus explosent ; +8 dégâts'), 'Recharge −0.4s et +6 dégâts'],
    },
    powerUpPunch: {
      description: 'Buzzwole frappe l’ennemi le plus proche. Chaque coup qui touche le gonfle : le suivant frappe 12% plus fort et plus large, jusqu’à 6 fois. Être blessé le dégonfle.',
      upgrades: ['+12 dégâts', '+15% de zone', fork('Poing explosif', 'Les ennemis vaincus explosent ; +12 dégâts', 'Gonflette', 'Ses coups te soignent ; recharge −0.25s'), 'Recharge −0.25s et +12 dégâts'],
    },
    lunge: {
      description: 'Les images de Pheromosa traversent les ennemis les plus proches plus vite que l’œil, et tout ce qui se trouve sur leur chemin. Peut affaiblir : l’ennemi inflige 25% de dégâts en moins.',
      upgrades: ['+8 dégâts', '+1 assaut', fork('Grâce cruelle', '+30% de chance d’affaiblir ; +4 dégâts', 'Chasseresse', 'Plus de dégâts aux boss et élites ; +10 dégâts'), 'Recharge −0.35s et +8 dégâts'],
    },
    tailGlow: {
      description: 'Xurkitree plante des prises lumineuses autour de lui et tend des câbles vivants entre elles : un ennemi pris sur un câble est électrocuté encore et encore, et peut être paralysé.',
      upgrades: ['+4 dégâts', '+1 prise', fork('Réseau électrique', 'Les câbles durent +1s ; +15% de zone', 'Court-circuit', 'Les décharges sautent aux ennemis proches ; +20% de paralysie'), 'Recharge −0.6s et +4 dégâts'],
    },
    autotomize: {
      description: 'Celesteela largue ses plaques comme des fusées : elles décollent, décrivent un arc et s’écrasent sur les foules les plus denses, et peuvent brûler. Allégée, elle court plus vite pendant 2.4s.',
      upgrades: ['+12 dégâts', '+1 fusée', fork('Ogive large', '+20% de zone', 'Ogive en chaîne', 'Les ennemis vaincus explosent ; +14 dégâts'), 'Recharge −0.5s et +12 dégâts'],
    },
    guillotine: {
      description: 'Kartana trace un X à travers chacun des ennemis les plus proches, fin comme du papier et sans jamais rater ; un ennemi ordinaire laissé presque à bout tombe aussitôt.',
      upgrades: ['+12 dégâts', '+1 X', fork('Coupe finale', 'Les ennemis à bout de PV tombent aussitôt ; +12 dégâts', 'Fil du chasseur', 'Plus de dégâts aux boss et élites ; recharge −0.3s'), 'Recharge −0.3s et +12 dégâts'],
    },
    belch: {
      description: 'La gueule de Guzzlord s’ouvre sur la foule la plus dense et l’aspire en mordant, jusqu’à se refermer sur ses prises : dévorer soigne. Un lancer sur trois, il rote tout en une vague autour de lui.',
      upgrades: ['+10 dégâts', '+15% de zone', fork('Gueule béante', 'La gueule reste ouverte +0.5s ; +6 dégâts', 'Indigestion', 'Les ennemis vaincus explosent ; +12 dégâts'), 'Recharge −0.4s et +10 dégâts'],
    },
    wideGuard: {
      description: 'Les pierres de Stakataka s’empilent en un mur devant lui et repoussent chaque ennemi qui le heurte. Pendant qu’il s’élève, le premier coup qui te vise est bloqué.',
      upgrades: ['+8 dégâts', '+2 pierres', fork('Forteresse', 'Le mur dure +1s ; +15% de zone', 'Bélier', 'Repousse plus et frappe plus fort boss et élites ; +10 dégâts'), 'Recharge −0.6s et +8 dégâts'],
    },
    mindBlown: {
      description: 'Blacephalon lance sa propre tête sur la foule la plus dense, où elle explose en feu et en confettis, et peut brûler. Une nouvelle s’allume sur ses épaules.',
      upgrades: ['+14 dégâts', '+15% de zone', fork('Deux têtes', '+1 tête ; -6 dégâts', 'Grand final', 'Les ennemis vaincus explosent ; +16 dégâts'), 'Recharge −0.4s et +14 dégâts'],
    },
    fellStinger: {
      description: 'Naganadel tire des dards qui traquent les ennemis les plus proches ; un ennemi qu’un dard achève l’aiguise : +15% de dégâts pendant 5s.',
      upgrades: ['+6 dégâts', '+2 dards', fork('Dard perçant', 'Traverse +1 ennemi ; +4 dégâts', 'Dard double', 'Se divise en deux au premier coup ; +6 dégâts'), 'Recharge −0.25s et +6 dégâts'],
    },
    poisonJab: {
      description: 'Poipole plante son aiguille venimeuse dans l’ennemi le plus proche plusieurs fois de suite, et peut empoisonner.',
      upgrades: ['+5 dégâts', '+1 piqûre', fork('Venin puissant', '+30% de chance d’empoisonner ; +25% de dégâts du poison', 'Aiguille assoiffée', 'Ses coups te soignent ; +6 dégâts'), 'Recharge −0.2s et +5 dégâts'],
    },
  },
  blurbs: {
    nihilego: 'Neurotoxine. Un acide qui rend confus et une défense qui grandit.',
    buzzwole: 'Muscles. Des poings qui grossissent à chaque coup.',
    pheromosa: 'Vitesse. Des assauts qui traversent tout.',
    xurkitree: 'Câbles vivants. Un filet de décharges autour de lui.',
    celesteela: 'Fusées. Pilonne les foules et accélère.',
    kartana: 'Lames. Des coupes qui ne ratent jamais.',
    guzzlord: 'Dévorer. Aspire, mord et se soigne.',
    stakataka: 'Rempart. Repousse la horde et bloque les coups.',
    blacephalon: 'Explosions. Lance sa propre tête.',
    naganadel: 'Dards. Chaque K.O. l’aiguise.',
    poipole: 'Aiguille venimeuse. Évolue en Naganadel à son premier éveil.',
  },
  domains: {
    nihilego: {
      place: 'Ultra-Abysse',
      epithet: 'Parasite de l’Au-delà',
      omen: 'Le ciel se fissure de lumière prismatique, et un froid venimeux descend…',
      crossing: 'L’Ultra-Brèche se referme derrière toi ! Traverse l’Ultra-Dimension !',
      phases: ['*Nihilego* libère sa neurotoxine ! Ses tentacules t’attirent : reste en mouvement.'],
    },
    buzzwole: {
      place: 'Ultra-Jungle',
      epithet: 'Colosse musclé',
      omen: 'Le ciel se fissure de lumière prismatique, et l’air bourdonne comme une ruche…',
      crossing: 'L’Ultra-Brèche se referme derrière toi ! Traverse l’Ultra-Dimension !',
      phases: ['*Buzzwole* trouve son rythme ! Éloigne-toi avant le Superpower.'],
      cues: { pump: '*Buzzwole* bombe les muscles ! Il frappe plus fort.' },
    },
    pheromosa: {
      place: 'Ultra-Désert',
      epithet: 'Grâce fatale',
      omen: 'Le ciel se fissure de lumière prismatique, et un vent fin tranche le sable…',
      crossing: 'L’Ultra-Brèche se referme derrière toi ! Traverse l’Ultra-Dimension !',
      phases: ['*Pheromosa* danse : le temps file plus vite pour elle !'],
    },
    xurkitree: {
      place: 'Ultra-Centrale',
      epithet: 'Câbles vivants',
      omen: 'Le ciel se fissure de lumière prismatique, et tout se met à grésiller…',
      crossing: 'L’Ultra-Brèche se referme derrière toi ! Traverse l’Ultra-Dimension !',
      phases: ['*Xurkitree* s’illumine ! Cache-toi derrière les cristaux avant le Zap Cannon.'],
    },
    celesteela: {
      place: 'Ultra-Cratère',
      epithet: 'Fusée vivante',
      omen: 'Le ciel se fissure de lumière prismatique, et un grondement de moteurs vient d’en haut…',
      crossing: 'L’Ultra-Brèche se referme derrière toi ! Traverse l’Ultra-Dimension !',
      phases: ['*Celesteela* décolle ! Évite sa traînée de feu.'],
    },
    kartana: {
      place: 'Ultra-Forêt',
      epithet: 'Lame de papier',
      omen: 'Le ciel se fissure de lumière prismatique, et des feuilles fines comme du papier tombent…',
      crossing: 'L’Ultra-Brèche se referme derrière toi ! Traverse l’Ultra-Dimension !',
      phases: ['*Kartana* affûte ses bords ! Les coupes viennent de partout.'],
    },
    guzzlord: {
      place: 'Ultra-Ruines',
      epithet: 'Faim sans fin',
      omen: 'Le ciel se fissure de lumière prismatique, et un grondement affamé résonne…',
      crossing: 'L’Ultra-Brèche se referme derrière toi ! Traverse l’Ultra-Dimension !',
      phases: ['*Guzzlord* dévore le sol lui-même ! Attention aux bords.'],
    },
    stakataka: {
      place: 'Ultra-Rempart',
      epithet: 'Mur vivant',
      omen: 'Le ciel se fissure de lumière prismatique, et des pierres commencent à s’empiler…',
      crossing: 'L’Ultra-Brèche se referme derrière toi ! Traverse l’Ultra-Dimension !',
      phases: ['Les pierres de *Stakataka* se détachent : il est plus fragile, et plus rapide !'],
    },
    blacephalon: {
      place: 'Ultra-Chapiteau',
      epithet: 'Clown explosif',
      omen: 'Le ciel se fissure de lumière prismatique, et des feux d’artifice éclatent au loin…',
      crossing: 'L’Ultra-Brèche se referme derrière toi ! Traverse l’Ultra-Dimension !',
      phases: ['*Blacephalon* lance son grand final ! Reste loin quand la tête explose.'],
    },
    naganadel: {
      place: 'Ultra-Nid',
      epithet: 'Aiguille venimeuse',
      omen: 'Le ciel se fissure de lumière prismatique, et des gouttes de venin brillent dans l’air…',
      crossing: 'L’Ultra-Brèche se referme derrière toi ! Traverse l’Ultra-Dimension !',
      phases: ['*Naganadel* fond en piqué ! Sors des couloirs marqués.'],
    },
  },
  ui: {
    omen: (name) => `Une *Ultra-Brèche* va s’ouvrir : *${name}* arrive de l’Ultra-Dimension !`,
    open: 'L’*Ultra-Brèche* est ouverte ! Entre pour affronter l’Ultra-Chimère.',
    hudPortal: (time) => `Ultra-Brèche ${time}`,
    week: {
      title: 'Ultra-Chimère de la semaine',
      line: (name, until) => `*${name}* sort plus souvent des Ultra-Brèches jusqu’au ${until}.`,
      tag: 'De la semaine',
      card: (name) => `Ultra : ${name}`,
      cardLine: 'plus souvent cette semaine',
    },
    heading: 'ULTRA-CHIMERES',
    progress: (n, of) => `Ultra-Chimères capturées : ${n}/${of}`,
    caught: (name) => `*${name}* capturé dans une *Beast Ball* ! Jouable en _mode Légende_.`,
    allCaught: 'Toutes les Ultra-Chimères capturées ! *Poipole* t’attend dans la boîte à cadeaux.',
  },
}

const zh: UltraWords = {
  abilities: {
    beastBoost: '每段連續擊倒都會提升其最高的能力（每12次1級，最多5級）；沒有擊倒時，每4秒失去1級。',
  },
  moves: {
    acidSpray: {
      description: 'Nihilego噴出扇形酸液，可貫穿2名敵人，每滴都會留下一灘酸液。其神經毒素可能使敵人混亂：漫無目的地亂走並撞上其他敵人（首領能抵抗）。',
      upgrades: ['傷害+6', '酸液+2', fork('神經毒素', '混亂機率+25%；酸液灘持續+0.6秒', '腐蝕酸液', '被擊倒的敵人會爆炸；傷害+8'), '冷卻縮短0.4秒，傷害+6'],
    },
    powerUpPunch: {
      description: 'Buzzwole揮拳打向最近的敵人。每命中一拳肌肉就更膨脹：下一拳傷害+12%且範圍更大，最多6層。受到傷害就會消退。',
      upgrades: ['傷害+12', '範圍+15%', fork('爆裂拳', '被擊倒的敵人會爆炸；傷害+12', '肌肉充血', '攻擊會治療你；冷卻縮短0.25秒'), '冷卻縮短0.25秒，傷害+12'],
    },
    lunge: {
      description: 'Pheromosa的殘影以肉眼跟不上的速度穿過最近的敵人，貫穿路上所有對手。可能使敵人虛弱：造成的傷害減少25%。',
      upgrades: ['傷害+8', '突進+1', fork('殘酷優雅', '虛弱機率+30%；傷害+4', '女獵手', '對首領與精英傷害更高；傷害+10'), '冷卻縮短0.35秒，傷害+8'],
    },
    tailGlow: {
      description: 'Xurkitree在身邊插下發光的插頭，並在之間拉起帶電電線：被電線纏住的敵人會一次又一次被電擊，還可能麻痺。',
      upgrades: ['傷害+4', '插頭+1', fork('電網', '電線持續+1秒；範圍+15%', '短路', '電擊會跳到附近敵人；麻痺+20%'), '冷卻縮短0.6秒，傷害+4'],
    },
    autotomize: {
      description: 'Celesteela把裝甲板化為火箭射出：它們升空、劃出弧線，砸向最密集的敵群，還可能灼傷。變輕之後2.4秒內跑得更快。',
      upgrades: ['傷害+12', '火箭+1', fork('廣域彈頭', '範圍+20%', '連鎖彈頭', '被擊倒的敵人會爆炸；傷害+14'), '冷卻縮短0.5秒，傷害+12'],
    },
    guillotine: {
      description: 'Kartana在最近的每名敵人身上劃出X形斬擊，薄如紙片，絕不落空；幾乎沒血的一般敵人會當場倒下。',
      upgrades: ['傷害+12', 'X斬+1', fork('終結一斬', '殘血的敵人當場倒下；傷害+12', '獵手之刃', '對首領與精英傷害更高；冷卻縮短0.3秒'), '冷卻縮短0.3秒，傷害+12'],
    },
    belch: {
      description: 'Guzzlord的巨口在最密集的敵群上張開，邊咬邊把它們吸進去，直到闔上吞下獵物：吞噬能回復體力。每第3次施放，會打個嗝把一切以波動噴回四周。',
      upgrades: ['傷害+10', '範圍+15%', fork('血盆大口', '巨口多張開0.5秒；傷害+6', '消化不良', '被擊倒的敵人會爆炸；傷害+12'), '冷卻縮短0.4秒，傷害+10'],
    },
    wideGuard: {
      description: 'Stakataka的石塊在面前堆成一道牆，把撞上的每名敵人推回去。石牆升起時，你受到的第一次攻擊會被擋下。',
      upgrades: ['傷害+8', '石塊+2', fork('要塞', '石牆持續+1秒；範圍+15%', '攻城槌', '推得更遠，對首領與精英傷害更高；傷害+10'), '冷卻縮短0.6秒，傷害+8'],
    },
    mindBlown: {
      description: 'Blacephalon把自己的頭丟向最密集的敵群，在火焰與彩紙中爆炸，還可能灼傷。肩上隨即點亮新的頭。',
      upgrades: ['傷害+14', '範圍+15%', fork('雙頭', '頭+1；傷害-6', '盛大謝幕', '被擊倒的敵人會爆炸；傷害+16'), '冷卻縮短0.4秒，傷害+14'],
    },
    fellStinger: {
      description: 'Naganadel射出會追蹤最近敵人的毒針；被毒針擊倒的敵人會讓它更加銳利：5秒內傷害+15%。',
      upgrades: ['傷害+6', '毒針+2', fork('貫穿毒針', '多貫穿1名敵人；傷害+4', '雙重毒針', '首次命中時一分為二；傷害+6'), '冷卻縮短0.25秒，傷害+6'],
    },
    poisonJab: {
      description: 'Poipole用毒針連續刺向最近的敵人，還可能使其中毒。',
      upgrades: ['傷害+5', '刺擊+1', fork('劇毒', '中毒機率+30%；毒傷+25%', '飢渴毒針', '攻擊會治療你；傷害+6'), '冷卻縮短0.2秒，傷害+5'],
    },
  },
  blurbs: {
    nihilego: '神經毒素。會造成混亂的酸液，防禦越戰越強。',
    buzzwole: '肌肉。每次命中都更強的拳頭。',
    pheromosa: '速度。貫穿一切的突進。',
    xurkitree: '活體電線。環繞身邊的電擊網。',
    celesteela: '火箭。轟炸敵群並加速。',
    kartana: '刀刃。絕不落空的斬擊。',
    guzzlord: '吞噬。吸入、咬碎並回復。',
    stakataka: '城牆。推回敵群並擋下攻擊。',
    blacephalon: '爆炸。丟出自己的頭。',
    naganadel: '毒針。每次擊倒都更加銳利。',
    poipole: '毒針。第一次覺醒時進化成Naganadel。',
  },
  domains: {
    nihilego: {
      place: '究極深淵',
      epithet: '異界寄生者',
      omen: '天空裂出稜鏡般的光芒，一股帶毒的寒意降下……',
      crossing: '究極之洞正在你身後關閉！穿越究極空間！',
      phases: ['*Nihilego*釋放神經毒素！觸手會把你拉過去：別停下來。'],
    },
    buzzwole: {
      place: '究極叢林',
      epithet: '膨脹巨力',
      omen: '天空裂出稜鏡般的光芒，空氣像蜂巢一樣嗡嗡作響……',
      crossing: '究極之洞正在你身後關閉！穿越究極空間！',
      phases: ['*Buzzwole*進入狀態！在Superpower之前遠離它。'],
      cues: { pump: '*Buzzwole*秀出肌肉！現在打得更重了。' },
    },
    pheromosa: {
      place: '究極沙漠',
      epithet: '致命優雅',
      omen: '天空裂出稜鏡般的光芒，一陣細風劃過沙地……',
      crossing: '究極之洞正在你身後關閉！穿越究極空間！',
      phases: ['*Pheromosa*起舞：她的時間流得更快了！'],
    },
    xurkitree: {
      place: '究極發電廠',
      epithet: '活體電線',
      omen: '天空裂出稜鏡般的光芒，四周開始劈啪作響……',
      crossing: '究極之洞正在你身後關閉！穿越究極空間！',
      phases: ['*Xurkitree*亮起來了！在Zap Cannon之前躲到水晶後面。'],
    },
    celesteela: {
      place: '究極隕石坑',
      epithet: '活體火箭',
      omen: '天空裂出稜鏡般的光芒，上方傳來引擎的轟鳴……',
      crossing: '究極之洞正在你身後關閉！穿越究極空間！',
      phases: ['*Celesteela*升空了！避開它的火焰尾跡。'],
    },
    kartana: {
      place: '究極森林',
      epithet: '紙刃',
      omen: '天空裂出稜鏡般的光芒，薄如紙片的葉子飄落……',
      crossing: '究極之洞正在你身後關閉！穿越究極空間！',
      phases: ['*Kartana*磨利刀鋒！斬擊從四面八方而來。'],
    },
    guzzlord: {
      place: '究極廢墟',
      epithet: '無盡饑餓',
      omen: '天空裂出稜鏡般的光芒，飢餓的低吼迴盪著……',
      crossing: '究極之洞正在你身後關閉！穿越究極空間！',
      phases: ['*Guzzlord*連地面都吞下去了！小心邊緣。'],
    },
    stakataka: {
      place: '究極城牆',
      epithet: '活體城牆',
      omen: '天空裂出稜鏡般的光芒，石塊開始層層堆疊……',
      crossing: '究極之洞正在你身後關閉！穿越究極空間！',
      phases: ['*Stakataka*的石塊鬆脫了：它變得更脆弱，也更快了！'],
    },
    blacephalon: {
      place: '究極馬戲棚',
      epithet: '煙火小丑',
      omen: '天空裂出稜鏡般的光芒，遠處煙火砰砰綻放……',
      crossing: '究極之洞正在你身後關閉！穿越究極空間！',
      phases: ['*Blacephalon*的盛大謝幕！頭爆炸時離遠一點。'],
    },
    naganadel: {
      place: '究極巢穴',
      epithet: '毒針',
      omen: '天空裂出稜鏡般的光芒，毒液在空中閃爍……',
      crossing: '究極之洞正在你身後關閉！穿越究極空間！',
      phases: ['*Naganadel*俯衝而下！離開標記的路線。'],
    },
  },
  ui: {
    omen: (name) => `*究極之洞*即將開啟：*${name}*從究極空間而來！`,
    open: '*究極之洞*開啟了！走進去對戰究極異獸。',
    hudPortal: (time) => `究極之洞 ${time}`,
    week: {
      title: '本週的究極異獸',
      line: (name, until) => `直到${until}，*${name}*會更常從究極之洞出現。`,
      tag: '本週',
      card: (name) => `究極：${name}`,
      cardLine: '本週更常出現',
    },
    heading: '究極異獸',
    progress: (n, of) => `已收服的究極異獸：${n}/${of}`,
    caught: (name) => `用*Beast Ball*收服了*${name}*！可在_傳說模式_中使用。`,
    allCaught: '收服了所有究極異獸！*Poipole*正在禮物箱裡等你。',
  },
}

export const ULTRA_WORDS = { pt, en, es, fr, zh } as const
