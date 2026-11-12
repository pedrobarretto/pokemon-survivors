import type { ForceId, RuinsRegi } from '../data/legends'

/**
 * The words of the Ruínas da Decisão's Regis (Regieleki, Regidrago) and the
 * Forces of Nature (Tornadus, Thundurus, Landorus, Enamorus): their moves,
 * innates, blurbs, where they're caught, their title cards and phase lines,
 * the Ruins' choice on screen and the Forces' visits. A table per language
 * (`pt` is the reference); each language's file spreads its parts where they
 * belong. Pokémon and move names stay in English.
 */

type Fork = { readonly fork: readonly [{ readonly name: string; readonly desc: string }, { readonly name: string; readonly desc: string }] }
type MoveText = { readonly description: string; readonly upgrades: readonly [string, string, Fork, string] }
type Legend = RuinsRegi | ForceId

const pt = {
  abilities: {
    transistor: 'Golpes do tipo Elétrico +30%.',
    dragonsMaw: 'Golpes do tipo Dragão +30%.',
    prankster: 'Recarga 8% mais rápida; golpes que causam condições +15%.',
    sandForce: 'Na tempestade de areia, golpes Terra, Pedra e Aço +30%; imune ao desgaste da areia.',
  },
  moves: {
    thunderCage: {
      description: 'Grades de raio se fecham sobre a maior multidão e eletrocutam quem fica dentro, puxando para o centro. Quanto mais rápido você corre, mais forte ela bate, e você deixa um rastro de faíscas por 2 s.',
      upgrades: [
        '+4 de dano',
        '+1 jaula',
        { fork: [{ name: 'Prisão', desc: 'A jaula dura +1 s' }, { name: 'Electro Drift', desc: '+3 de dano; o rastro de faíscas dura 4 s' }] },
        'Recarga 0.5s mais rápida e +4 de dano',
      ],
    },
    dragonEnergy: {
      description: 'As cabeças de dragão de Regidrago se abrem e um feixe de energia ruge até a multidão. Quanto mais HP você tem, mais forte (40% com o HP no fim).',
      upgrades: [
        '+16 de dano',
        '+15% de área',
        { fork: [{ name: 'Dois feixes', desc: 'Um segundo feixe em leque; -6 de dano' }, { name: 'Dragon’s Maw', desc: 'As mandíbulas mordem no fim do feixe; +10 de dano' }] },
        'Recarga 0.5s mais rápida e +16 de dano',
      ],
    },
    bleakwindStorm: {
      description: 'Um leque de rajadas geladas joga os inimigos para trás e pode congelá-los de lentidão. Cada lançamento traz um Tailwind: você e seus golpes ficam mais rápidos por 3 s.',
      upgrades: [
        '+6 de dano',
        '+2 rajadas',
        { fork: [{ name: 'Vento a favor', desc: 'O Tailwind dura +2 s' }, { name: 'Ciclone', desc: '+3 rajadas; -3 de dano' }] },
        'Recarga 0.4s mais rápida e +6 de dano',
      ],
    },
    nastyPlot: {
      description: 'Thundurus trama na tempestade: uma nuvem cobre a maior multidão e raios caem dela um atrás do outro (na chuva, o dobro). Cada lançamento aumenta seus golpes em 12% por 3 s.',
      upgrades: [
        '+8 de dano',
        '+1 nuvem',
        { fork: [{ name: 'Temporal', desc: '+3 raios por nuvem' }, { name: 'Raio certeiro', desc: '+10 de dano' }] },
        'Recarga 0.4s mais rápida e +8 de dano',
      ],
    },
    sandsearStorm: {
      description: 'Areia em brasa sai de Landorus em espiral, em braços que giram enquanto avançam, e pode queimar o que atravessam.',
      upgrades: [
        '+6 de dano',
        '+1 braço',
        { fork: [{ name: 'Tempestade larga', desc: '+20% de área' }, { name: 'Areia sem fim', desc: '+3 disparos por braço e +4 de dano' }] },
        'Recarga 0.4s mais rápida e +6 de dano',
      ],
    },
    springtideStorm: {
      description: 'Um redemoinho de pétalas e corações gira ao seu redor e pode confundir os inimigos. Pelo Contrary, cada lançamento seguido aumenta seus golpes em mais 3% (até 5 vezes).',
      upgrades: [
        '+4 de dano',
        '+4 pétalas',
        { fork: [{ name: 'Primavera longa', desc: 'O redemoinho dura +1 s' }, { name: 'Do contra', desc: '+3 de dano; acumula até 8 vezes' }] },
        'Recarga 0.4s mais rápida e +4 de dano',
      ],
    },
  } satisfies Record<string, MoveText>,
  blurbs: {
    regieleki: 'Velocidade pura. Quanto mais rápido, mais forte a Thunder Cage.',
    regidrago: 'Mandíbula de dragão. Dragon Energy mais forte com o HP cheio.',
    tornadus: 'Ciclone. Rajadas geladas e vento a favor a cada lançamento.',
    thundurus: 'Tempestade. Chama a chuva e dobra os raios nela.',
    landorus: 'Força da Areia. Ergue tempestades de areia e vira Forma Therian.',
    enamorus: 'Do contra. Fica mais forte a cada golpe e vira Forma Therian.',
  } satisfies Record<Legend, string>,
  /** Where they're caught (`LegendSource`: `ruins`, `force`). */
  where: {
    ruins: 'Depois de capturar *Regigigas*, o templo às vezes traz as _Ruínas da Decisão_: entre na ruína deste Regi e vença-o. Só uma ruína desperta por partida; a outra fica para outra partida.',
    force: 'Uma _Força da Natureza_: vaga pelo mapa trazendo o seu clima (Tornadus a neve, Thundurus a chuva, Landorus a areia, Enamorus o sol), e o HP que você tira fica guardado entre partidas. *Landorus* só aparece depois de capturar *Tornadus* e *Thundurus*; *Enamorus*, depois dos três.',
  },
  /** Their title cards ("REGIELEKI · Colosso Elétrico"). */
  epithets: {
    regieleki: 'Colosso Elétrico',
    regidrago: 'Colosso Dragão',
    tornadus: 'Senhor do Ciclone',
    thundurus: 'Raio da Tempestade',
    landorus: 'Senhor da Colheita',
    enamorus: 'Arauto da Primavera',
  } satisfies Record<Legend, string>,
  /** A line as each phase after the first begins: the Regis' on the map, the Forces' as their HP carried across runs crosses a third. */
  phases: {
    regieleki: ['*Regieleki* acelera! Investidas por todo lado: saia das _faixas_.', 'Thunder Cage! As grades se fecham: saia pela _abertura_.'],
    regidrago: ['*Regidrago* abre as mandíbulas: saia da _linha_ do feixe!', 'Dragon Energy! Corra para _longe_ dele antes da explosão.'],
    tornadus: ['*Tornadus* se enfurece: o vento gela e as rajadas dobram!', 'Bleakwind Storm! Passe pelos _vãos entre as correntes_.'],
    thundurus: ['*Thundurus* se enfurece: os raios caem mais rápido!', 'A tempestade toda! _Fuja dos círculos_ dos raios.'],
    landorus: ['*Landorus* se enfurece: o chão treme sob você!', 'Sandsear Storm! Saia da _jaula de areia_.'],
    enamorus: ['*Enamorus* se enfurece: cada golpe a deixa mais forte!', 'Springtide Storm! O anel fecha: ache a _saída_.'],
  } satisfies Record<Legend, readonly [string, string]>,
  ui: {
    ruins: {
      risen: 'As *Ruínas da Decisão* surgiram!',
      one: (name: string) => `As *Ruínas da Decisão* surgiram: só a de *${name}* dorme.`,
      chosen: (name: string, other: string) => `Você escolheu *${name}*! A ruína de ${other} se fecha até outra partida.`,
      woken: (name: string) => `A ruína de *${name}* desperta!`,
      silent: 'As ruínas estão quietas: termine a luta com o chefe primeiro.',
      /** The choice's card while the player is near the ruins (`ui/ruinsCard.ts`). */
      card: { title: 'RUÍNAS DA DECISÃO', hint: 'Entre numa ruína: só uma desperta', regieleki: 'Ruína Elétrica', regidrago: 'Ruína Dragão', caught: 'Capturado', waking: 'Despertando…' },
    },
    force: {
      sighted: {
        tornadus: '*Tornadus* trouxe a _nevasca_!',
        thundurus: '*Thundurus* trouxe a _chuva_!',
        landorus: '*Landorus* trouxe a _tempestade de areia_!',
        enamorus: '*Enamorus* trouxe o _sol da primavera_!',
      } satisfies Record<ForceId, string>,
    },
  },
}

const en: typeof pt = {
  abilities: {
    transistor: 'Electric-type moves +30%.',
    dragonsMaw: 'Dragon-type moves +30%.',
    prankster: '8% faster cooldowns; moves that inflict conditions +15%.',
    sandForce: 'In a sandstorm, Ground, Rock and Steel moves +30%; immune to the sand’s wear.',
  },
  moves: {
    thunderCage: {
      description: 'Bars of lightning snap shut over the densest crowd and shock what’s inside, pulling it to the middle. The faster you run, the harder it hits, and you leave a trail of sparks for 2 s.',
      upgrades: [
        '+4 damage',
        '+1 cage',
        { fork: [{ name: 'Prison', desc: 'The cage lasts +1 s' }, { name: 'Electro Drift', desc: '+3 damage; the spark trail lasts 4 s' }] },
        '0.5s faster cooldown and +4 damage',
      ],
    },
    dragonEnergy: {
      description: 'Regidrago’s dragon heads open and a beam of energy roars at the crowd. The more HP you have, the harder it hits (40% with your HP spent).',
      upgrades: [
        '+16 damage',
        '+15% area',
        { fork: [{ name: 'Twin beams', desc: 'A second beam fans out; -6 damage' }, { name: 'Dragon’s Maw', desc: 'The jaws bite at the beam’s end; +10 damage' }] },
        '0.5s faster cooldown and +16 damage',
      ],
    },
    bleakwindStorm: {
      description: 'A fan of icy gusts throws foes back and may chill them slow. Each cast brings a Tailwind: you and your moves speed up for 3 s.',
      upgrades: [
        '+6 damage',
        '+2 gusts',
        { fork: [{ name: 'Tailwind', desc: 'The Tailwind lasts +2 s' }, { name: 'Cyclone', desc: '+3 gusts; -3 damage' }] },
        '0.4s faster cooldown and +6 damage',
      ],
    },
    nastyPlot: {
      description: 'Thundurus plots in its storm: a cloud covers the densest crowd and bolts rain from it one after another (twice as many in the rain). Each cast boosts your moves by 12% for 3 s.',
      upgrades: [
        '+8 damage',
        '+1 cloud',
        { fork: [{ name: 'Tempest', desc: '+3 bolts per cloud' }, { name: 'True bolt', desc: '+10 damage' }] },
        '0.4s faster cooldown and +8 damage',
      ],
    },
    sandsearStorm: {
      description: 'Searing sand spirals out of Landorus in arms that turn as they go, and may burn what they cross.',
      upgrades: [
        '+6 damage',
        '+1 arm',
        { fork: [{ name: 'Wide storm', desc: '+20% area' }, { name: 'Endless sand', desc: '+3 shots per arm and +4 damage' }] },
        '0.4s faster cooldown and +6 damage',
      ],
    },
    springtideStorm: {
      description: 'A whirl of petals and hearts spins around you and may confuse foes. By Contrary, each cast in a row boosts your moves 3% more (up to 5 times).',
      upgrades: [
        '+4 damage',
        '+4 petals',
        { fork: [{ name: 'Long spring', desc: 'The whirl lasts +1 s' }, { name: 'Contrary', desc: '+3 damage; stacks up to 8 times' }] },
        '0.4s faster cooldown and +4 damage',
      ],
    },
  },
  blurbs: {
    regieleki: 'Raw speed. The faster it runs, the harder Thunder Cage hits.',
    regidrago: 'Dragon’s Maw. Dragon Energy hits harder at full HP.',
    tornadus: 'The cyclone. Icy gusts and a tailwind with every cast.',
    thundurus: 'The storm. Calls the rain and doubles its bolts in it.',
    landorus: 'Sand Force. Raises sandstorms and turns Therian Forme.',
    enamorus: 'Contrary. Grows stronger with every hit and turns Therian Forme.',
  },
  where: {
    ruins: 'Once *Regigigas* is captured, its temple sometimes brings the _Split-Decision Ruins_: step into this Regi’s ruin and beat it. Only one ruin wakes a run; the other waits for another run.',
    force: 'A _Force of Nature_: it roams the map bringing its weather (Tornadus the snow, Thundurus the rain, Landorus the sand, Enamorus the sun), and the HP you take stays taken from run to run. *Landorus* only shows once *Tornadus* and *Thundurus* are captured; *Enamorus*, once all three are.',
  },
  epithets: {
    regieleki: 'Electric Colossus',
    regidrago: 'Dragon Colossus',
    tornadus: 'Lord of the Cyclone',
    thundurus: 'Bolt of the Storm',
    landorus: 'Lord of the Harvest',
    enamorus: 'Herald of Spring',
  },
  phases: {
    regieleki: ['*Regieleki* speeds up! Charges everywhere: get out of the _lanes_.', 'Thunder Cage! The bars close in: get out through the _gap_.'],
    regidrago: ['*Regidrago* opens its jaws: get out of the beam’s _line_!', 'Dragon Energy! Get _far_ from it before the blast.'],
    tornadus: ['*Tornadus* is enraged: the wind turns icy and its gusts double!', 'Bleakwind Storm! Slip through the _gaps between the currents_.'],
    thundurus: ['*Thundurus* is enraged: the bolts fall faster!', 'The whole storm! _Dodge the circles_ of the bolts.'],
    landorus: ['*Landorus* is enraged: the ground shakes under you!', 'Sandsear Storm! Get out of the _sand cage_.'],
    enamorus: ['*Enamorus* is enraged: every hit makes it stronger!', 'Springtide Storm! The ring closes: find the _way out_.'],
  },
  ui: {
    ruins: {
      risen: 'The *Split-Decision Ruins* rose!',
      one: (name: string) => `The *Split-Decision Ruins* rose: only *${name}*’s sleeps.`,
      chosen: (name: string, other: string) => `You chose *${name}*! ${other}’s ruin closes until another run.`,
      woken: (name: string) => `*${name}*’s ruin awakens!`,
      silent: 'The ruins are quiet: finish the boss fight first.',
      card: { title: 'SPLIT-DECISION RUINS', hint: 'Step into a ruin: only one wakes', regieleki: 'Electric Ruin', regidrago: 'Dragon Ruin', caught: 'Captured', waking: 'Waking…' },
    },
    force: {
      sighted: {
        tornadus: '*Tornadus* brought the _snow_!',
        thundurus: '*Thundurus* brought the _rain_!',
        landorus: '*Landorus* brought the _sandstorm_!',
        enamorus: '*Enamorus* brought the _spring sun_!',
      },
    },
  },
}

const es: typeof pt = {
  abilities: {
    transistor: 'Movimientos de tipo Eléctrico +30%.',
    dragonsMaw: 'Movimientos de tipo Dragón +30%.',
    prankster: 'Recarga 8% más rápida; movimientos que causan estados +15%.',
    sandForce: 'En la tormenta de arena, movimientos Tierra, Roca y Acero +30%; inmune al desgaste de la arena.',
  },
  moves: {
    thunderCage: {
      description: 'Barrotes de rayo se cierran sobre la multitud más densa y electrocutan a quien queda dentro, tirando hacia el centro. Cuanto más rápido corres, más fuerte golpea, y dejas un rastro de chispas por 2 s.',
      upgrades: [
        '+4 de daño',
        '+1 jaula',
        { fork: [{ name: 'Prisión', desc: 'La jaula dura +1 s' }, { name: 'Electro Drift', desc: '+3 de daño; el rastro de chispas dura 4 s' }] },
        'Recarga 0.5s más rápida y +4 de daño',
      ],
    },
    dragonEnergy: {
      description: 'Las cabezas de dragón de Regidrago se abren y un haz de energía ruge hacia la multitud. Cuanto más PS tienes, más fuerte (40% con tus PS agotados).',
      upgrades: [
        '+16 de daño',
        '+15% de área',
        { fork: [{ name: 'Dos haces', desc: 'Un segundo haz en abanico; -6 de daño' }, { name: 'Dragon’s Maw', desc: 'Las fauces muerden al final del haz; +10 de daño' }] },
        'Recarga 0.5s más rápida y +16 de daño',
      ],
    },
    bleakwindStorm: {
      description: 'Un abanico de ráfagas heladas empuja a los enemigos y puede ralentizarlos de frío. Cada lanzamiento trae un Viento Afín: tú y tus movimientos van más rápido por 3 s.',
      upgrades: [
        '+6 de daño',
        '+2 ráfagas',
        { fork: [{ name: 'Viento a favor', desc: 'El Viento Afín dura +2 s' }, { name: 'Ciclón', desc: '+3 ráfagas; -3 de daño' }] },
        'Recarga 0.4s más rápida y +6 de daño',
      ],
    },
    nastyPlot: {
      description: 'Thundurus trama en su tormenta: una nube cubre la multitud más densa y caen rayos de ella uno tras otro (el doble bajo la lluvia). Cada lanzamiento aumenta tus movimientos un 12% por 3 s.',
      upgrades: [
        '+8 de daño',
        '+1 nube',
        { fork: [{ name: 'Temporal', desc: '+3 rayos por nube' }, { name: 'Rayo certero', desc: '+10 de daño' }] },
        'Recarga 0.4s más rápida y +8 de daño',
      ],
    },
    sandsearStorm: {
      description: 'Arena ardiente sale de Landorus en espiral, en brazos que giran mientras avanzan, y puede quemar lo que cruzan.',
      upgrades: [
        '+6 de daño',
        '+1 brazo',
        { fork: [{ name: 'Tormenta amplia', desc: '+20% de área' }, { name: 'Arena sin fin', desc: '+3 disparos por brazo y +4 de daño' }] },
        'Recarga 0.4s más rápida y +6 de daño',
      ],
    },
    springtideStorm: {
      description: 'Un remolino de pétalos y corazones gira a tu alrededor y puede confundir a los enemigos. Por Respondón, cada lanzamiento seguido aumenta tus movimientos un 3% más (hasta 5 veces).',
      upgrades: [
        '+4 de daño',
        '+4 pétalos',
        { fork: [{ name: 'Primavera larga', desc: 'El remolino dura +1 s' }, { name: 'Respondón', desc: '+3 de daño; acumula hasta 8 veces' }] },
        'Recarga 0.4s más rápida y +4 de daño',
      ],
    },
  },
  blurbs: {
    regieleki: 'Velocidad pura. Cuanto más rápido, más fuerte la Thunder Cage.',
    regidrago: 'Fauces de dragón. Dragon Energy más fuerte con los PS llenos.',
    tornadus: 'El ciclón. Ráfagas heladas y viento a favor en cada lanzamiento.',
    thundurus: 'La tormenta. Llama a la lluvia y dobla sus rayos en ella.',
    landorus: 'Poder Arena. Levanta tormentas de arena y toma su Forma Tótem.',
    enamorus: 'Respondón. Más fuerte con cada golpe y toma su Forma Tótem.',
  },
  where: {
    ruins: 'Tras capturar a *Regigigas*, su templo a veces trae las _Ruinas de la Elección_: entra en la ruina de este Regi y véncelo. Solo una ruina despierta por partida; la otra espera a otra partida.',
    force: 'Una _Fuerza de la Naturaleza_: recorre el mapa trayendo su clima (Tornadus la nieve, Thundurus la lluvia, Landorus la arena, Enamorus el sol), y los PS que le quitas se guardan entre partidas. *Landorus* solo aparece tras capturar a *Tornadus* y *Thundurus*; *Enamorus*, tras los tres.',
  },
  epithets: {
    regieleki: 'Coloso Eléctrico',
    regidrago: 'Coloso Dragón',
    tornadus: 'Señor del Ciclón',
    thundurus: 'Rayo de la Tormenta',
    landorus: 'Señor de la Cosecha',
    enamorus: 'Heraldo de la Primavera',
  },
  phases: {
    regieleki: ['¡*Regieleki* acelera! Embestidas por todas partes: sal de las _franjas_.', '¡Thunder Cage! Los barrotes se cierran: sal por la _abertura_.'],
    regidrago: ['*Regidrago* abre las fauces: ¡sal de la _línea_ del haz!', '¡Dragon Energy! Aléjate _lejos_ de él antes de la explosión.'],
    tornadus: ['¡*Tornadus* se enfurece: el viento se hiela y sus ráfagas se duplican!', '¡Bleakwind Storm! Pasa por los _huecos entre las corrientes_.'],
    thundurus: ['¡*Thundurus* se enfurece: los rayos caen más rápido!', '¡Toda la tormenta! _Esquiva los círculos_ de los rayos.'],
    landorus: ['¡*Landorus* se enfurece: el suelo tiembla bajo tus pies!', '¡Sandsear Storm! Sal de la _jaula de arena_.'],
    enamorus: ['¡*Enamorus* se enfurece: cada golpe la hace más fuerte!', '¡Springtide Storm! El anillo se cierra: busca la _salida_.'],
  },
  ui: {
    ruins: {
      risen: '¡Surgieron las *Ruinas de la Elección*!',
      one: (name: string) => `¡Surgieron las *Ruinas de la Elección*: solo duerme la de *${name}*!`,
      chosen: (name: string, other: string) => `¡Elegiste a *${name}*! La ruina de ${other} se cierra hasta otra partida.`,
      woken: (name: string) => `¡La ruina de *${name}* despierta!`,
      silent: 'Las ruinas están en calma: termina primero la pelea con el jefe.',
      card: { title: 'RUINAS DE LA ELECCIÓN', hint: 'Entra en una ruina: solo una despierta', regieleki: 'Ruina Eléctrica', regidrago: 'Ruina Dragón', caught: 'Capturado', waking: 'Despertando…' },
    },
    force: {
      sighted: {
        tornadus: '¡*Tornadus* trajo la _nevada_!',
        thundurus: '¡*Thundurus* trajo la _lluvia_!',
        landorus: '¡*Landorus* trajo la _tormenta de arena_!',
        enamorus: '¡*Enamorus* trajo el _sol de primavera_!',
      },
    },
  },
}

const fr: typeof pt = {
  abilities: {
    transistor: 'Capacités de type Électrik +30 %.',
    dragonsMaw: 'Capacités de type Dragon +30 %.',
    prankster: 'Recharge 8 % plus rapide ; capacités qui infligent un statut +15 %.',
    sandForce: 'Dans une tempête de sable, capacités Sol, Roche et Acier +30 % ; insensible à l’usure du sable.',
  },
  moves: {
    thunderCage: {
      description: 'Des barreaux de foudre se referment sur la foule la plus dense et électrocutent ce qui est dedans, en l’attirant au centre. Plus vous courez vite, plus elle frappe fort, et vous laissez une traînée d’étincelles pendant 2 s.',
      upgrades: [
        '+4 dégâts',
        '+1 cage',
        { fork: [{ name: 'Prison', desc: 'La cage dure +1 s' }, { name: 'Electro Drift', desc: '+3 dégâts ; la traînée d’étincelles dure 4 s' }] },
        'Recharge 0.5s plus rapide et +4 dégâts',
      ],
    },
    dragonEnergy: {
      description: 'Les têtes de dragon de Regidrago s’ouvrent et un rayon d’énergie rugit vers la foule. Plus vous avez de PV, plus il frappe fort (40 % à vos PV épuisés).',
      upgrades: [
        '+16 dégâts',
        '+15 % de zone',
        { fork: [{ name: 'Rayons jumeaux', desc: 'Un second rayon en éventail ; -6 dégâts' }, { name: 'Dragon’s Maw', desc: 'Les mâchoires mordent au bout du rayon ; +10 dégâts' }] },
        'Recharge 0.5s plus rapide et +16 dégâts',
      ],
    },
    bleakwindStorm: {
      description: 'Un éventail de rafales glacées repousse les ennemis et peut les ralentir de froid. Chaque lancer apporte un Vent Arrière : vous et vos capacités accélérez pendant 3 s.',
      upgrades: [
        '+6 dégâts',
        '+2 rafales',
        { fork: [{ name: 'Vent arrière', desc: 'Le Vent Arrière dure +2 s' }, { name: 'Cyclone', desc: '+3 rafales ; -3 dégâts' }] },
        'Recharge 0.4s plus rapide et +6 dégâts',
      ],
    },
    nastyPlot: {
      description: 'Thundurus complote dans sa tempête : un nuage couvre la foule la plus dense et des éclairs en tombent l’un après l’autre (deux fois plus sous la pluie). Chaque lancer renforce vos capacités de 12 % pendant 3 s.',
      upgrades: [
        '+8 dégâts',
        '+1 nuage',
        { fork: [{ name: 'Orage', desc: '+3 éclairs par nuage' }, { name: 'Éclair juste', desc: '+10 dégâts' }] },
        'Recharge 0.4s plus rapide et +8 dégâts',
      ],
    },
    sandsearStorm: {
      description: 'Du sable brûlant jaillit de Landorus en spirale, en bras qui tournent en avançant, et peut brûler ce qu’ils traversent.',
      upgrades: [
        '+6 dégâts',
        '+1 bras',
        { fork: [{ name: 'Large tempête', desc: '+20 % de zone' }, { name: 'Sable sans fin', desc: '+3 tirs par bras et +4 dégâts' }] },
        'Recharge 0.4s plus rapide et +6 dégâts',
      ],
    },
    springtideStorm: {
      description: 'Un tourbillon de pétales et de cœurs tourne autour de vous et peut désorienter les ennemis. Par Contestation, chaque lancer d’affilée renforce vos capacités de 3 % de plus (jusqu’à 5 fois).',
      upgrades: [
        '+4 dégâts',
        '+4 pétales',
        { fork: [{ name: 'Long printemps', desc: 'Le tourbillon dure +1 s' }, { name: 'Contestation', desc: '+3 dégâts ; cumule jusqu’à 8 fois' }] },
        'Recharge 0.4s plus rapide et +4 dégâts',
      ],
    },
  },
  blurbs: {
    regieleki: 'Vitesse pure. Plus il court vite, plus Thunder Cage frappe fort.',
    regidrago: 'Mâchoires de dragon. Dragon Energy plus forte à PV pleins.',
    tornadus: 'Le cyclone. Rafales glacées et vent arrière à chaque lancer.',
    thundurus: 'La tempête. Appelle la pluie et y double ses éclairs.',
    landorus: 'Force Sable. Lève des tempêtes de sable et passe en Forme Totémique.',
    enamorus: 'Contestation. Plus forte à chaque coup, passe en Forme Totémique.',
  },
  where: {
    ruins: 'Une fois *Regigigas* capturé, son temple apporte parfois les _Ruines du Choix_ : entrez dans la ruine de ce Regi et battez-le. Une seule ruine s’éveille par partie ; l’autre attend une autre partie.',
    force: 'Une _Force de la Nature_ : elle parcourt la carte avec son climat (Tornadus la neige, Thundurus la pluie, Landorus le sable, Enamorus le soleil), et les PV que vous lui prenez restent pris d’une partie à l’autre. *Landorus* n’apparaît qu’une fois *Tornadus* et *Thundurus* capturés ; *Enamorus*, une fois les trois.',
  },
  epithets: {
    regieleki: 'Colosse Électrik',
    regidrago: 'Colosse Dragon',
    tornadus: 'Seigneur du Cyclone',
    thundurus: 'Foudre de la Tempête',
    landorus: 'Seigneur des Moissons',
    enamorus: 'Héraut du Printemps',
  },
  phases: {
    regieleki: ['*Regieleki* accélère ! Des charges partout : sortez des _couloirs_.', 'Thunder Cage ! Les barreaux se referment : sortez par l’_ouverture_.'],
    regidrago: ['*Regidrago* ouvre ses mâchoires : sortez de la _ligne_ du rayon !', 'Dragon Energy ! Éloignez-vous _loin_ de lui avant l’explosion.'],
    tornadus: ['*Tornadus* s’emporte : le vent devient glacial et ses rafales doublent !', 'Bleakwind Storm ! Passez par les _trous entre les courants_.'],
    thundurus: ['*Thundurus* s’emporte : les éclairs tombent plus vite !', 'Toute la tempête ! _Évitez les cercles_ des éclairs.'],
    landorus: ['*Landorus* s’emporte : le sol tremble sous vos pieds !', 'Sandsear Storm ! Sortez de la _cage de sable_.'],
    enamorus: ['*Enamorus* s’emporte : chaque coup la rend plus forte !', 'Springtide Storm ! L’anneau se referme : trouvez la _sortie_.'],
  },
  ui: {
    ruins: {
      risen: 'Les *Ruines du Choix* ont surgi !',
      one: (name: string) => `Les *Ruines du Choix* ont surgi : seule celle de *${name}* dort.`,
      chosen: (name: string, other: string) => `Vous avez choisi *${name}* ! La ruine de ${other} se referme jusqu’à une autre partie.`,
      woken: (name: string) => `La ruine de *${name}* s’éveille !`,
      silent: 'Les ruines sont calmes : terminez d’abord le combat contre le boss.',
      card: { title: 'RUINES DU CHOIX', hint: 'Entrez dans une ruine : une seule s’éveille', regieleki: 'Ruine Électrik', regidrago: 'Ruine Dragon', caught: 'Capturé', waking: 'Réveil…' },
    },
    force: {
      sighted: {
        tornadus: '*Tornadus* amène la _neige_ !',
        thundurus: '*Thundurus* amène la _pluie_ !',
        landorus: '*Landorus* amène la _tempête de sable_ !',
        enamorus: '*Enamorus* amène le _soleil du printemps_ !',
      },
    },
  },
}

const zh: typeof pt = {
  abilities: {
    transistor: '電屬性招式 +30%。',
    dragonsMaw: '龍屬性招式 +30%。',
    prankster: '冷卻快 8%；會造成異常狀態的招式 +15%。',
    sandForce: '沙暴中，地面、岩石與鋼屬性招式 +30%；不受沙暴損耗。',
  },
  moves: {
    thunderCage: {
      description: '雷電柵欄在最密集的敵群上方合攏，電擊困在裡面的敵人並將其拉向中心。你跑得越快，威力越強，並留下 2 秒的火花軌跡。',
      upgrades: [
        '+4 傷害',
        '+1 個牢籠',
        { fork: [{ name: '囚牢', desc: '牢籠持續 +1 秒' }, { name: 'Electro Drift', desc: '+3 傷害；火花軌跡持續 4 秒' }] },
        '冷卻快 0.5 秒且 +4 傷害',
      ],
    },
    dragonEnergy: {
      description: 'Regidrago 的龍頭張開，一道能量光束朝敵群咆哮而去。HP 越多威力越強（HP 見底時為 40%）。',
      upgrades: [
        '+16 傷害',
        '+15% 範圍',
        { fork: [{ name: '雙光束', desc: '多一道扇形光束；-6 傷害' }, { name: 'Dragon’s Maw', desc: '光束盡頭龍顎咬合；+10 傷害' }] },
        '冷卻快 0.5 秒且 +16 傷害',
      ],
    },
    bleakwindStorm: {
      description: '一扇冰冷的狂風將敵人吹退，並可能凍得它們行動遲緩。每次施放都帶來順風：你和你的招式加速 3 秒。',
      upgrades: [
        '+6 傷害',
        '+2 道狂風',
        { fork: [{ name: '順風', desc: '順風持續 +2 秒' }, { name: '旋風', desc: '+3 道狂風；-3 傷害' }] },
        '冷卻快 0.4 秒且 +6 傷害',
      ],
    },
    nastyPlot: {
      description: 'Thundurus 在風暴中詭計連連：一片雲籠罩最密集的敵群，雷電接連落下（雨天時加倍）。每次施放使你的招式提升 12%，持續 3 秒。',
      upgrades: [
        '+8 傷害',
        '+1 片雲',
        { fork: [{ name: '暴風雨', desc: '每片雲 +3 道雷' }, { name: '必中之雷', desc: '+10 傷害' }] },
        '冷卻快 0.4 秒且 +8 傷害',
      ],
    },
    sandsearStorm: {
      description: '灼熱的沙從 Landorus 身上螺旋湧出，沙臂邊前進邊旋轉，可能灼傷穿過的敵人。',
      upgrades: [
        '+6 傷害',
        '+1 道沙臂',
        { fork: [{ name: '廣域風暴', desc: '+20% 範圍' }, { name: '無盡之沙', desc: '每道沙臂 +3 發且 +4 傷害' }] },
        '冷卻快 0.4 秒且 +6 傷害',
      ],
    },
    springtideStorm: {
      description: '花瓣與愛心的漩渦在你身邊旋轉，可能讓敵人混亂。藉由唱反調，每次連續施放使你的招式再提升 3%（最多 5 次）。',
      upgrades: [
        '+4 傷害',
        '+4 片花瓣',
        { fork: [{ name: '漫長春日', desc: '漩渦持續 +1 秒' }, { name: '唱反調', desc: '+3 傷害；最多疊加 8 次' }] },
        '冷卻快 0.4 秒且 +4 傷害',
      ],
    },
  },
  blurbs: {
    regieleki: '純粹的速度。跑得越快，Thunder Cage 越強。',
    regidrago: '龍之顎。HP 全滿時 Dragon Energy 更強。',
    tornadus: '旋風。每次施放都有冰冷狂風與順風。',
    thundurus: '風暴。呼喚雨天，雨中雷電加倍。',
    landorus: '沙之力。掀起沙暴，並化為靈獸形態。',
    enamorus: '唱反調。每受一擊就更強，並化為靈獸形態。',
  },
  where: {
    ruins: '捕獲*Regigigas*後，它的神殿有時會帶來_抉擇遺跡_：走進這隻雷吉的遺跡並打倒它。每場只有一座遺跡會甦醒；另一座留待下一場。',
    force: '一位_自然之力_：帶著它的天氣在地圖上遊蕩（Tornadus 帶來雪、Thundurus 帶來雨、Landorus 帶來沙、Enamorus 帶來陽光），你打掉的 HP 會跨場保留。*Landorus* 要在捕獲 *Tornadus* 與 *Thundurus* 後才會出現；*Enamorus* 則要三位都捕獲後。',
  },
  epithets: {
    regieleki: '電之巨像',
    regidrago: '龍之巨像',
    tornadus: '旋風之主',
    thundurus: '風暴之雷',
    landorus: '豐收之主',
    enamorus: '春之使者',
  },
  phases: {
    regieleki: ['*Regieleki* 加速了！到處都是衝撞：離開_軌道_。', 'Thunder Cage！柵欄合攏：從_缺口_出去。'],
    regidrago: ['*Regidrago* 張開巨顎：離開光束的_直線_！', 'Dragon Energy！爆炸前_遠離_它。'],
    tornadus: ['*Tornadus* 發怒了：風變得冰冷，狂風加倍！', 'Bleakwind Storm！從_氣流之間的縫隙_穿過。'],
    thundurus: ['*Thundurus* 發怒了：雷電落得更快！', '整場風暴！_避開雷電的圓圈_。'],
    landorus: ['*Landorus* 發怒了：腳下的大地在震動！', 'Sandsear Storm！離開_沙之牢籠_。'],
    enamorus: ['*Enamorus* 發怒了：每受一擊就更強！', 'Springtide Storm！圓環收攏：找到_出口_。'],
  },
  ui: {
    ruins: {
      risen: '*抉擇遺跡*出現了！',
      one: (name: string) => `*抉擇遺跡*出現了：只剩 *${name}* 的還在沉睡。`,
      chosen: (name: string, other: string) => `你選擇了 *${name}*！${other} 的遺跡關閉，留待下一場。`,
      woken: (name: string) => `*${name}* 的遺跡甦醒了！`,
      silent: '遺跡很安靜：先結束與首領的戰鬥。',
      card: { title: '抉擇遺跡', hint: '走進一座遺跡：只有一座會甦醒', regieleki: '電之遺跡', regidrago: '龍之遺跡', caught: '已捕獲', waking: '甦醒中…' },
    },
    force: {
      sighted: {
        tornadus: '*Tornadus* 帶來了_大雪_！',
        thundurus: '*Thundurus* 帶來了_大雨_！',
        landorus: '*Landorus* 帶來了_沙暴_！',
        enamorus: '*Enamorus* 帶來了_春日陽光_！',
      },
    },
  },
}

export const REGIS_FORCES_WORDS = { pt, en, es, fr, zh } as const
