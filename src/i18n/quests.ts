/**
 * The words of the legends with a road of their own (`QUEST_LEGENDS` in
 * `data/legends.ts`): Palkia, the roaming lake trio, the Swords of Justice and
 * Keldeo, Hoopa and its ring rush. A table per language (`pt` is the
 * reference); each language's file spreads its parts where they belong.
 * Pokémon and move names stay in English.
 */

type Fork = { readonly fork: readonly [{ readonly name: string; readonly desc: string }, { readonly name: string; readonly desc: string }] }
type MoveText = { readonly description: string; readonly upgrades: readonly [string, string, Fork, string] }

const pt = {
  abilities: {
    justified: 'Ao levar um golpe, golpes +8% por 5 s, acumulando até 3 vezes.',
  },
  moves: {
    spacialRend: {
      description: 'Palkia rasga o espaço: cortes paralelos atravessam a maior multidão um instante depois de as costuras aparecerem.',
      upgrades: [
        '+16 de dano',
        '+1 rasgo',
        { fork: [{ name: 'Rasgo cruzado', desc: 'Uma segunda leva de rasgos cruza a primeira em ângulo reto; +6 de dano' }, { name: 'Vácuo', desc: 'Os rasgos ficam abertos e puxam os inimigos para dentro; +20% de área' }] },
        'Recarga 0.5s mais rápida e +16 de dano',
      ],
    },
    mysticalPower: {
      description: 'Orbes de conhecimento, emoção e força de vontade saem de um halo ao seu redor e perseguem os inimigos. Cada lançamento aumenta seus golpes em 8% por 4 s.',
      upgrades: [
        '+8 de dano',
        '+3 orbes',
        { fork: [{ name: 'Mente desperta', desc: 'O aumento dura +2 s' }, { name: 'Três lagos', desc: '+3 orbes; -4 de dano' }] },
        'Recarga 0.4s mais rápida e +8 de dano',
      ],
    },
    retaliate: {
      description: 'As Espadas da Justiça revidam: um chifre corta um X nos inimigos à frente, e corta mais fundo quanto mais HP você perdeu (até +70%).',
      upgrades: [
        '+14 de dano',
        '+20% de área',
        { fork: [{ name: 'Lâmina veloz', desc: 'Recarga 0.3s mais rápida' }, { name: 'Justiça', desc: '+18 de dano' }] },
        'Recarga 0.3s mais rápida e +14 de dano',
      ],
    },
    secretSword: {
      description: 'O chifre de Keldeo vira uma longa lâmina de água e luz e varre um arco largo à sua frente.',
      upgrades: [
        '+16 de dano',
        '+20% de área',
        { fork: [{ name: 'Lâmina dupla', desc: 'Uma segunda varredura no sentido contrário' }, { name: 'Determinação', desc: '+20 de dano' }] },
        'Recarga 0.4s mais rápida e +16 de dano',
      ],
    },
    hyperspaceFury: {
      description: 'Os anéis de Hoopa se abrem sobre as maiores multidões e braços saem deles socando sem parar. Pode baixar a defesa (os golpes doem mais).',
      upgrades: [
        '+6 de dano',
        '+1 anel',
        { fork: [{ name: 'Fúria sem fim', desc: '+3 socos por anel' }, { name: 'Golpe certeiro', desc: '+8 de dano e +30% de chance de baixar a defesa' }] },
        'Recarga 0.4s mais rápida e +6 de dano',
      ],
    },
  } satisfies Record<string, MoveText>,
  blurbs: {
    palkia: 'Senhor do Espaço. Rasga o campo em linhas e vira a Forma Origem.',
    uxie: 'Conhecimento. Orbes que perseguem e sobe de nível mais rápido.',
    mesprit: 'Emoção. Orbes que perseguem e se cura com o tempo.',
    azelf: 'Força de vontade. Orbes que perseguem e fica mais forte ferido.',
    cobalion: 'Escudo da Justiça. Resistente, revida mais forte quando ferido.',
    terrakion: 'Força da Justiça. Golpes pesados que crescem quando ferido.',
    virizion: 'Velocidade da Justiça. Ágil, corta mais forte quando ferido.',
    keldeo: 'Jovem espadachim. Uma lâmina longa que varre arcos largos.',
    hoopa: 'Anéis do espaço. Socos que saem dos anéis e a forma Unbound.',
  },
  /** Where each of these legends is caught (`LegendSource`). */
  where: {
    roam: 'Vaga pelo mapa: às vezes aparece numa partida e foge quando você chega perto. O HP que você tira fica de uma partida para a outra: desgaste-o até capturar.',
    duel: 'Às vezes espera num bioma que combina com ele: aceite o duelo e passe no teste para que se junte a você.',
    swords: 'Chega como presente quando as três Espadas da Justiça (Cobalion, Terrakion e Virizion) estiverem capturadas.',
    rush: 'Vença os Anéis de Hoopa uma vez: o último anel é o próprio Hoopa.',
  },
  /** The open map's legends on screen (`ui/quests.ts`, the HUD's pill) and Hoopa's rings (`ui/rush.ts`). */
  ui: {
    roam: {
      sighted: (name: string, pct: number) => `*${name}* apareceu por perto! Ele foge quando você chega perto, mas o HP que você tirar fica guardado (${pct}%).`,
      fled: (name: string, pct: number) => `*${name}* fugiu… Ainda tem _${pct}%_ do HP. Ele volta em outra partida.`,
      wiped: '*Uxie* apagou sua memória: você perdeu a pista dele!',
      hud: (name: string, pct: number) => `${name} por perto · ${pct}%`,
    },
    duel: {
      waiting: (name: string, test: string) => `*${name}* espera por você. Fique no círculo para começar o duelo: _${test}_.`,
      tests: { endure: 'Teste de Defesa', power: 'Teste de Força', speed: 'Teste de Velocidade' },
      began: {
        endure: (name: string, floor: number) => `Resista a *${name}* sem deixar seu HP cair abaixo de ${floor}%!`,
        power: (name: string) => `Derrube *${name}* antes que o tempo acabe!`,
        speed: (_name: string, marks: number) => `Pise nas ${marks} folhas antes que o tempo acabe!`,
      },
      passed: (name: string) => `*${name}* reconhece sua força!`,
      failed: (name: string) => `*${name}* não se convenceu e partiu. Volte mais forte numa próxima partida!`,
      left: (name: string) => `*${name}* cansou de esperar e partiu.`,
      hudEndure: (name: string, time: string) => `${name}: resista ${time}`,
      hudPower: (name: string, time: string) => `Derrube ${name}: ${time}`,
      hudSpeed: (got: number, of: number, time: string) => `Folhas ${got}/${of} · ${time}`,
      hudWaiting: (name: string, time: string) => `${name} espera · ${time}`,
    },
  },
}

const en: typeof pt = {
  abilities: {
    justified: 'When hit, moves +8% for 5 s, stacking up to 3 times.',
  },
  moves: {
    spacialRend: {
      description: 'Palkia tears space: parallel cuts slice across the densest crowd a beat after the seams show.',
      upgrades: [
        '+16 damage',
        '+1 tear',
        { fork: [{ name: 'Crossed rend', desc: 'A second set of tears crosses the first at right angles; +6 damage' }, { name: 'Vacuum', desc: 'The tears stay open and drag foes in; +20% area' }] },
        '0.5s faster cooldown and +16 damage',
      ],
    },
    mysticalPower: {
      description: 'Orbs of knowledge, emotion and willpower burst out of a halo around you and home in on the foes. Each cast boosts your moves by 8% for 4 s.',
      upgrades: [
        '+8 damage',
        '+3 orbs',
        { fork: [{ name: 'Awakened mind', desc: 'The boost lasts +2 s' }, { name: 'Three lakes', desc: '+3 orbs; -4 damage' }] },
        '0.4s faster cooldown and +8 damage',
      ],
    },
    retaliate: {
      description: 'The Swords of Justice strike back: a horn cuts an X through the foes ahead, deeper the more HP you’ve lost (up to +70%).',
      upgrades: [
        '+14 damage',
        '+20% area',
        { fork: [{ name: 'Swift blade', desc: '0.3s faster cooldown' }, { name: 'Justice', desc: '+18 damage' }] },
        '0.3s faster cooldown and +14 damage',
      ],
    },
    secretSword: {
      description: 'Keldeo’s horn grows into a long blade of water and light and sweeps a wide arc ahead of you.',
      upgrades: [
        '+16 damage',
        '+20% area',
        { fork: [{ name: 'Twin blade', desc: 'A second sweep the other way' }, { name: 'Resolve', desc: '+20 damage' }] },
        '0.4s faster cooldown and +16 damage',
      ],
    },
    hyperspaceFury: {
      description: 'Hoopa’s rings open over the densest crowds and arms come punching out of them nonstop. May lower defense (hits hurt more).',
      upgrades: [
        '+6 damage',
        '+1 ring',
        { fork: [{ name: 'Endless fury', desc: '+3 punches per ring' }, { name: 'Sure blow', desc: '+8 damage and +30% chance to lower defense' }] },
        '0.4s faster cooldown and +6 damage',
      ],
    },
  },
  blurbs: {
    palkia: 'Lord of Space. Tears the field in lines and turns Origin Forme.',
    uxie: 'Knowledge. Homing orbs, and it levels up faster.',
    mesprit: 'Emotion. Homing orbs, and it heals over time.',
    azelf: 'Willpower. Homing orbs, and it hits harder when hurt.',
    cobalion: 'Shield of Justice. Tough, strikes back harder when hurt.',
    terrakion: 'Strength of Justice. Heavy blows that grow when hurt.',
    virizion: 'Speed of Justice. Nimble, cuts harder when hurt.',
    keldeo: 'Young swordsman. A long blade sweeping wide arcs.',
    hoopa: 'Rings of space. Fists out of its rings, and its Unbound form.',
  },
  where: {
    roam: 'Roams the map: sometimes it shows up in a run and flees when you get close. The HP you take stays from run to run: wear it down to catch it.',
    duel: 'Sometimes waits in a biome that suits it: take the duel and pass its test so it joins you.',
    swords: 'Comes as a gift once all three Swords of Justice (Cobalion, Terrakion and Virizion) are caught.',
    rush: 'Clear Hoopa’s Rings once: the last ring is Hoopa itself.',
  },
  ui: {
    roam: {
      sighted: (name: string, pct: number) => `*${name}* showed up nearby! It flees when you get close, but the HP you take stays taken (${pct}%).`,
      fled: (name: string, pct: number) => `*${name}* fled… It still has _${pct}%_ of its HP. It’ll be back in another run.`,
      wiped: '*Uxie* wiped your memory: you lost track of it!',
      hud: (name: string, pct: number) => `${name} nearby · ${pct}%`,
    },
    duel: {
      waiting: (name: string, test: string) => `*${name}* is waiting for you. Stand in the circle to start the duel: _${test}_.`,
      tests: { endure: 'Defense Test', power: 'Power Test', speed: 'Speed Test' },
      began: {
        endure: (name: string, floor: number) => `Hold out against *${name}* without letting your HP drop below ${floor}%!`,
        power: (name: string) => `Knock *${name}* out before time runs out!`,
        speed: (_name: string, marks: number) => `Step on the ${marks} leaves before time runs out!`,
      },
      passed: (name: string) => `*${name}* acknowledges your strength!`,
      failed: (name: string) => `*${name}* wasn’t convinced and left. Come back stronger in another run!`,
      left: (name: string) => `*${name}* grew tired of waiting and left.`,
      hudEndure: (name: string, time: string) => `${name}: hold out ${time}`,
      hudPower: (name: string, time: string) => `Knock out ${name}: ${time}`,
      hudSpeed: (got: number, of: number, time: string) => `Leaves ${got}/${of} · ${time}`,
      hudWaiting: (name: string, time: string) => `${name} waits · ${time}`,
    },
  },
}

const es: typeof pt = {
  abilities: {
    justified: 'Al recibir un golpe, movimientos +8% durante 5 s, acumulable hasta 3 veces.',
  },
  moves: {
    spacialRend: {
      description: 'Palkia rasga el espacio: cortes paralelos atraviesan la multitud más densa un instante después de que aparecen las costuras.',
      upgrades: [
        '+16 de daño',
        '+1 rasgón',
        { fork: [{ name: 'Rasgón cruzado', desc: 'Una segunda tanda de rasgones cruza la primera en ángulo recto; +6 de daño' }, { name: 'Vacío', desc: 'Los rasgones quedan abiertos y arrastran a los enemigos; +20% de área' }] },
        'Recarga 0.5s más rápida y +16 de daño',
      ],
    },
    mysticalPower: {
      description: 'Orbes de conocimiento, emoción y voluntad salen de un halo a tu alrededor y persiguen a los enemigos. Cada lanzamiento aumenta tus movimientos un 8% durante 4 s.',
      upgrades: [
        '+8 de daño',
        '+3 orbes',
        { fork: [{ name: 'Mente despierta', desc: 'El aumento dura +2 s' }, { name: 'Tres lagos', desc: '+3 orbes; -4 de daño' }] },
        'Recarga 0.4s más rápida y +8 de daño',
      ],
    },
    retaliate: {
      description: 'Las Espadas de la Justicia contraatacan: un cuerno corta una X en los enemigos de enfrente, más hondo cuanta más vida hayas perdido (hasta +70%).',
      upgrades: [
        '+14 de daño',
        '+20% de área',
        { fork: [{ name: 'Hoja veloz', desc: 'Recarga 0.3s más rápida' }, { name: 'Justicia', desc: '+18 de daño' }] },
        'Recarga 0.3s más rápida y +14 de daño',
      ],
    },
    secretSword: {
      description: 'El cuerno de Keldeo se vuelve una larga hoja de agua y luz y barre un arco amplio frente a ti.',
      upgrades: [
        '+16 de daño',
        '+20% de área',
        { fork: [{ name: 'Hoja doble', desc: 'Un segundo barrido en sentido contrario' }, { name: 'Determinación', desc: '+20 de daño' }] },
        'Recarga 0.4s más rápida y +16 de daño',
      ],
    },
    hyperspaceFury: {
      description: 'Los anillos de Hoopa se abren sobre las multitudes más densas y salen brazos golpeando sin parar. Puede bajar la defensa (los golpes duelen más).',
      upgrades: [
        '+6 de daño',
        '+1 anillo',
        { fork: [{ name: 'Furia sin fin', desc: '+3 golpes por anillo' }, { name: 'Golpe certero', desc: '+8 de daño y +30% de probabilidad de bajar la defensa' }] },
        'Recarga 0.4s más rápida y +6 de daño',
      ],
    },
  },
  blurbs: {
    palkia: 'Señor del Espacio. Rasga el campo en líneas y pasa a Forma Origen.',
    uxie: 'Conocimiento. Orbes que persiguen y sube de nivel más rápido.',
    mesprit: 'Emoción. Orbes que persiguen y se cura con el tiempo.',
    azelf: 'Voluntad. Orbes que persiguen y pega más fuerte herido.',
    cobalion: 'Escudo de la Justicia. Resistente, contraataca más fuerte herido.',
    terrakion: 'Fuerza de la Justicia. Golpes pesados que crecen al ser herido.',
    virizion: 'Velocidad de la Justicia. Ágil, corta más fuerte herido.',
    keldeo: 'Joven espadachín. Una hoja larga que barre arcos amplios.',
    hoopa: 'Anillos del espacio. Puños que salen de sus anillos y su forma Desatada.',
  },
  where: {
    roam: 'Vaga por el mapa: a veces aparece en una partida y huye cuando te acercas. La vida que le quitas se mantiene de una partida a otra: desgástalo hasta capturarlo.',
    duel: 'A veces espera en un bioma que le va: acepta el duelo y supera su prueba para que se una a ti.',
    swords: 'Llega como regalo cuando las tres Espadas de la Justicia (Cobalion, Terrakion y Virizion) estén capturadas.',
    rush: 'Supera los Anillos de Hoopa una vez: el último anillo es el propio Hoopa.',
  },
  ui: {
    roam: {
      sighted: (name: string, pct: number) => `¡*${name}* apareció cerca! Huye cuando te acercas, pero la vida que le quitas se queda (${pct}%).`,
      fled: (name: string, pct: number) => `*${name}* huyó… Aún tiene _${pct}%_ de su vida. Volverá en otra partida.`,
      wiped: '¡*Uxie* borró tu memoria: le perdiste el rastro!',
      hud: (name: string, pct: number) => `${name} cerca · ${pct}%`,
    },
    duel: {
      waiting: (name: string, test: string) => `*${name}* te espera. Quédate en el círculo para empezar el duelo: _${test}_.`,
      tests: { endure: 'Prueba de Defensa', power: 'Prueba de Fuerza', speed: 'Prueba de Velocidad' },
      began: {
        endure: (name: string, floor: number) => `¡Resiste a *${name}* sin dejar que tu vida baje del ${floor}%!`,
        power: (name: string) => `¡Derriba a *${name}* antes de que se acabe el tiempo!`,
        speed: (_name: string, marks: number) => `¡Pisa las ${marks} hojas antes de que se acabe el tiempo!`,
      },
      passed: (name: string) => `¡*${name}* reconoce tu fuerza!`,
      failed: (name: string) => `*${name}* no quedó convencido y se fue. ¡Vuelve más fuerte en otra partida!`,
      left: (name: string) => `*${name}* se cansó de esperar y se fue.`,
      hudEndure: (name: string, time: string) => `${name}: resiste ${time}`,
      hudPower: (name: string, time: string) => `Derriba a ${name}: ${time}`,
      hudSpeed: (got: number, of: number, time: string) => `Hojas ${got}/${of} · ${time}`,
      hudWaiting: (name: string, time: string) => `${name} espera · ${time}`,
    },
  },
}

const fr: typeof pt = {
  abilities: {
    justified: 'Quand tu es touché, capacités +8% pendant 5 s, cumulable jusqu’à 3 fois.',
  },
  moves: {
    spacialRend: {
      description: 'Palkia déchire l’espace : des entailles parallèles traversent la foule la plus dense un instant après l’apparition des coutures.',
      upgrades: [
        '+16 dégâts',
        '+1 déchirure',
        { fork: [{ name: 'Déchirure croisée', desc: 'Une seconde série de déchirures croise la première à angle droit ; +6 dégâts' }, { name: 'Vide', desc: 'Les déchirures restent ouvertes et aspirent les ennemis ; +20% de zone' }] },
        'Recharge −0.5s et +16 dégâts',
      ],
    },
    mysticalPower: {
      description: 'Des orbes de savoir, d’émotion et de volonté jaillissent d’un halo autour de toi et poursuivent les ennemis. Chaque lancer augmente tes capacités de 8 % pendant 4 s.',
      upgrades: [
        '+8 dégâts',
        '+3 orbes',
        { fork: [{ name: 'Esprit éveillé', desc: 'Le bonus dure +2 s' }, { name: 'Trois lacs', desc: '+3 orbes ; -4 dégâts' }] },
        'Recharge −0.4s et +8 dégâts',
      ],
    },
    retaliate: {
      description: 'Les Épées de la Justice ripostent : une corne trace un X dans les ennemis devant toi, plus profond quand tu as perdu des PV (jusqu’à +70 %).',
      upgrades: [
        '+14 dégâts',
        '+20% de zone',
        { fork: [{ name: 'Lame vive', desc: 'Recharge −0.3s' }, { name: 'Justice', desc: '+18 dégâts' }] },
        'Recharge −0.3s et +14 dégâts',
      ],
    },
    secretSword: {
      description: 'La corne de Keldeo devient une longue lame d’eau et de lumière qui balaie un large arc devant toi.',
      upgrades: [
        '+16 dégâts',
        '+20% de zone',
        { fork: [{ name: 'Double lame', desc: 'Un second balayage dans l’autre sens' }, { name: 'Détermination', desc: '+20 dégâts' }] },
        'Recharge −0.4s et +16 dégâts',
      ],
    },
    hyperspaceFury: {
      description: 'Les anneaux de Hoopa s’ouvrent au-dessus des foules les plus denses et des bras en sortent en frappant sans relâche. Peut baisser la défense (les coups font plus mal).',
      upgrades: [
        '+6 dégâts',
        '+1 anneau',
        { fork: [{ name: 'Fureur sans fin', desc: '+3 coups par anneau' }, { name: 'Coup sûr', desc: '+8 dégâts et +30% de chances de baisser la défense' }] },
        'Recharge −0.4s et +6 dégâts',
      ],
    },
  },
  blurbs: {
    palkia: 'Seigneur de l’Espace. Déchire le terrain en lignes et passe en Forme Originelle.',
    uxie: 'Savoir. Des orbes qui poursuivent, et il monte de niveau plus vite.',
    mesprit: 'Émotion. Des orbes qui poursuivent, et il se soigne avec le temps.',
    azelf: 'Volonté. Des orbes qui poursuivent, et il frappe plus fort blessé.',
    cobalion: 'Bouclier de la Justice. Robuste, riposte plus fort blessé.',
    terrakion: 'Force de la Justice. Des coups lourds qui grandissent blessé.',
    virizion: 'Vitesse de la Justice. Agile, tranche plus fort blessé.',
    keldeo: 'Jeune bretteur. Une longue lame qui balaie de larges arcs.',
    hoopa: 'Anneaux de l’espace. Des poings sortis de ses anneaux, et sa forme Déchaînée.',
  },
  where: {
    roam: 'Erre sur la carte : il apparaît parfois dans une partie et fuit quand tu approches. Les PV que tu lui retires restent d’une partie à l’autre : use-le jusqu’à le capturer.',
    duel: 'Attend parfois dans un biome qui lui ressemble : accepte le duel et réussis son épreuve pour qu’il te rejoigne.',
    swords: 'Arrive en cadeau une fois les trois Épées de la Justice (Cobalion, Terrakion et Virizion) capturées.',
    rush: 'Viens à bout des Anneaux de Hoopa une fois : le dernier anneau, c’est Hoopa lui-même.',
  },
  ui: {
    roam: {
      sighted: (name: string, pct: number) => `*${name}* est apparu tout près ! Il fuit quand tu approches, mais les PV que tu lui retires restent retirés (${pct} %).`,
      fled: (name: string, pct: number) => `*${name}* s’est enfui… Il lui reste _${pct} %_ de ses PV. Il reviendra dans une autre partie.`,
      wiped: '*Uxie* a effacé ta mémoire : tu as perdu sa trace !',
      hud: (name: string, pct: number) => `${name} tout près · ${pct} %`,
    },
    duel: {
      waiting: (name: string, test: string) => `*${name}* t’attend. Reste dans le cercle pour lancer le duel : _${test}_.`,
      tests: { endure: 'Épreuve de Défense', power: 'Épreuve de Force', speed: 'Épreuve de Vitesse' },
      began: {
        endure: (name: string, floor: number) => `Tiens bon face à *${name}* sans que tes PV passent sous ${floor} % !`,
        power: (name: string) => `Mets *${name}* K.O. avant la fin du temps !`,
        speed: (_name: string, marks: number) => `Marche sur les ${marks} feuilles avant la fin du temps !`,
      },
      passed: (name: string) => `*${name}* reconnaît ta force !`,
      failed: (name: string) => `*${name}* n’a pas été convaincu et est parti. Reviens plus fort dans une autre partie !`,
      left: (name: string) => `*${name}* s’est lassé d’attendre et est parti.`,
      hudEndure: (name: string, time: string) => `${name} : tiens ${time}`,
      hudPower: (name: string, time: string) => `K.O. ${name} : ${time}`,
      hudSpeed: (got: number, of: number, time: string) => `Feuilles ${got}/${of} · ${time}`,
      hudWaiting: (name: string, time: string) => `${name} attend · ${time}`,
    },
  },
}

const zh: typeof pt = {
  abilities: {
    justified: '受到攻擊時，招式+8%，持續5秒，最多疊加3次。',
  },
  moves: {
    spacialRend: {
      description: 'Palkia 撕裂空間：接縫浮現片刻後，數道平行的裂痕劃過最密集的敵群。',
      upgrades: [
        '傷害+16',
        '裂痕+1',
        { fork: [{ name: '交叉撕裂', desc: '第二組裂痕與第一組垂直交叉；傷害+6' }, { name: '真空', desc: '裂痕持續敞開並將敵人吸入；範圍+20%' }] },
        '冷卻縮短0.5秒，傷害+16',
      ],
    },
    mysticalPower: {
      description: '知識、情感與意志的寶珠從你身邊的光環中迸出，追擊敵人。每次施放讓你的招式傷害+8%，持續4秒。',
      upgrades: [
        '傷害+8',
        '寶珠+3',
        { fork: [{ name: '覺醒之心', desc: '增益多持續2秒' }, { name: '三湖', desc: '寶珠+3；傷害-4' }] },
        '冷卻縮短0.4秒，傷害+8',
      ],
    },
    retaliate: {
      description: '正義之劍的反擊：一道角斬在前方的敵人身上劃出X字，你失去的HP越多，斬得越深（最多+70%）。',
      upgrades: [
        '傷害+14',
        '範圍+20%',
        { fork: [{ name: '迅捷之刃', desc: '冷卻縮短0.3秒' }, { name: '正義', desc: '傷害+18' }] },
        '冷卻縮短0.3秒，傷害+14',
      ],
    },
    secretSword: {
      description: 'Keldeo 的角化為一把水與光的長刃，在你前方橫掃出一道寬弧。',
      upgrades: [
        '傷害+16',
        '範圍+20%',
        { fork: [{ name: '雙刃', desc: '再朝反方向橫掃一次' }, { name: '覺悟', desc: '傷害+20' }] },
        '冷卻縮短0.4秒，傷害+16',
      ],
    },
    hyperspaceFury: {
      description: 'Hoopa 的圓環在最密集的敵群上方打開，無數手臂從中不停揮拳。可能降低防禦（之後的攻擊更痛）。',
      upgrades: [
        '傷害+6',
        '圓環+1',
        { fork: [{ name: '無盡狂怒', desc: '每個圓環的拳頭+3' }, { name: '必中一擊', desc: '傷害+8，降低防禦的機率+30%' }] },
        '冷卻縮短0.4秒，傷害+6',
      ],
    },
  },
  blurbs: {
    palkia: '空間之主。將戰場撕成一道道裂痕，並化為起源形態。',
    uxie: '知識。追擊的寶珠，升級更快。',
    mesprit: '情感。追擊的寶珠，會隨時間恢復。',
    azelf: '意志。追擊的寶珠，受傷時更強。',
    cobalion: '正義之盾。堅韌，受傷時反擊更強。',
    terrakion: '正義之力。沉重的攻擊，受傷時更強。',
    virizion: '正義之速。敏捷，受傷時斬擊更強。',
    keldeo: '年輕的劍士。橫掃寬弧的長刃。',
    hoopa: '空間之環。從圓環中揮出的拳頭，以及解放形態。',
  },
  where: {
    roam: '在地圖上遊蕩：偶爾會在一局中出現，你一靠近就逃走。你打掉的HP會保留到下一局：持續消耗牠直到捕捉。',
    duel: '有時會在與牠相稱的生態區等待：接受決鬥並通過牠的考驗，牠就會加入你。',
    swords: '三把正義之劍（Cobalion、Terrakion、Virizion）都捕捉後，會以禮物的形式到來。',
    rush: '通關 Hoopa 的圓環一次：最後一個圓環就是 Hoopa 本身。',
  },
  ui: {
    roam: {
      sighted: (name: string, pct: number) => `*${name}* 出現在附近！你一靠近牠就逃走，但你打掉的HP會保留下來（${pct}%）。`,
      fled: (name: string, pct: number) => `*${name}* 逃走了…還剩 _${pct}%_ 的HP。牠會在另一局再出現。`,
      wiped: '*Uxie* 消除了你的記憶：你失去了牠的蹤跡！',
      hud: (name: string, pct: number) => `${name} 在附近 · ${pct}%`,
    },
    duel: {
      waiting: (name: string, test: string) => `*${name}* 正在等你。站進圓圈裡開始決鬥：_${test}_。`,
      tests: { endure: '防禦考驗', power: '力量考驗', speed: '速度考驗' },
      began: {
        endure: (name: string, floor: number) => `撐住 *${name}* 的攻勢，別讓HP降到${floor}%以下！`,
        power: (name: string) => `在時間結束前打倒 *${name}*！`,
        speed: (_name: string, marks: number) => `在時間結束前踩過${marks}片葉子！`,
      },
      passed: (name: string) => `*${name}* 認可了你的實力！`,
      failed: (name: string) => `*${name}* 不為所動地離開了。下一局變得更強再回來吧！`,
      left: (name: string) => `*${name}* 等得不耐煩，離開了。`,
      hudEndure: (name: string, time: string) => `${name}：撐住 ${time}`,
      hudPower: (name: string, time: string) => `打倒 ${name}：${time}`,
      hudSpeed: (got: number, of: number, time: string) => `葉子 ${got}/${of} · ${time}`,
      hudWaiting: (name: string, time: string) => `${name} 等待中 · ${time}`,
    },
  },
}

export const QUEST_WORDS = { pt, en, es, fr, zh } as const
