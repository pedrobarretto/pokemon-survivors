import type { REGIONAL_FAMILIES } from '../data/regionalFamilies'
import type { RegionId } from '../data/regionalForms'
import type { RegionalMoveId } from '../game/regionalMoves'
import type { ContentTexts } from './pt'

/**
 * The regional forms' words, a table per language (`pt` is the reference):
 * the families' blurbs, their moves and abilities, the Ovo de Viagem's tiers
 * and the trip of the week (`game/travel.ts`). Each language's file spreads
 * the parts into its own tables.
 */
type Words = {
  blurbs: Record<keyof typeof REGIONAL_FAMILIES, string>
  moves: Pick<ContentTexts['moves'], RegionalMoveId>
  abilities: Record<'snowWarning' | 'tanglingHair' | 'magnetPull' | 'galvanize' | 'poisonTouch' | 'steelySpirit' | 'defiant' | 'perishBody' | 'gorillaTactics' | 'aftermath' | 'angerPoint', string>
  /** The Ovo de Viagem of each region, as the egg's name. */
  tiers: Record<RegionId, string>
  travel: {
    /** The regions' names. */
    regions: Record<RegionId, string>
    /** The Vitrine card's name. */
    card: string
    /** Under the name: where this week's trip goes. */
    week: (region: string) => string
    text: (region: string, steps: string) => string
    /** How many of the region's families the save has. */
    progress: (got: number, of: number) => string
    /** When the next trip leaves and where to. */
    next: (region: string, when: string) => string
    /** The Safari's notice board: the trip's visitors. */
    safari: (region: string) => string
    /** Kecleon, on selling one. */
    said: string
  }
}

export const REGIONAL_WORDS: Record<'pt' | 'en' | 'es' | 'fr' | 'zh', Words> = {
  pt: {
    blurbs: {
      vulpixAlola: 'Véu de Aurora; na neve, que ela mesma chama, fica maior e mais forte.',
      sandshrewAlola: 'Vira uma bola de gelo e de aço que cresce rolando.',
      diglettAlola: 'Garras que afiam a cada acerto e cabelos dourados que prendem.',
      geodudeAlola: 'Rochas magnetizadas: dispara pedras e puxa itens de longe.',
      grimerAlola: 'Gás corrosivo que passa de um inimigo a outro. Come de tudo.',
      meowthGalar: 'Viking de aço: garras que afiam e Espírito de Aço no Perrserker.',
      slowpokeGalar: 'Concha ou veneno, conforme a distância. Vira Galarian Slowbro ou Galarian Slowking.',
      zigzagoonGalar: 'Bloqueia o golpe e responde com um X que quebra a defesa.',
      farfetchdGalar: 'Justa de alho-poró pela fila mais longa de inimigos. Não evolui.',
      corsolaGalar: 'Canto Perecer, e um corpo que marca quem encosta.',
      mimeJr: 'Espelho na hora certa; evolui para o Galarian Mr. Mime, de gelo.',
      darumakaGalar: 'Avalanches e Táticas de Gorila: lento, mas devastador.',
      growlitheHisui: 'Cabeçada de pedra em chamas; resistente como rocha.',
      zoruaHisui: 'Um rancor gelado que enfraquece a multidão, e uma ilusão que bloqueia um golpe de vez em quando.',
      voltorbHisui: 'Uma explosão verde fortíssima que custa um pouco de HP.',
      qwilfishHisui: 'Farpas para todos os lados; o Overqwil dispara ainda mais.',
      wooperPaldea: 'Uma poça tóxica que piora quanto mais se fica nela, e passa adiante.',
      taurosPaldea: 'Investida furiosa; no Lv 20 mostra a raça: Combate, Fogo ou Água.',
    },
    moves: {
      metalClaw: {
        description: 'Arranha o inimigo mais próximo. Cada acerto afia as garras (até +48% de dano); levar um golpe as cega de novo.',
        upgrades: ['+3 de dano', '+20% de área', { fork: [{ name: 'Garra Explosiva', desc: 'Inimigos derrotados explodem; +3 de dano' }, { name: 'Garra Faiscante', desc: 'Faíscas saltam para inimigos próximos; 0,1 s a menos de recarga' }] }, '+3 de dano', '0,08 s a menos de recarga', { fork: [{ name: 'Garra Caçadora', desc: '×1,5 em elites e chefes; +4 de dano' }, { name: 'Garra Cruel', desc: '×1,35 em inimigos afligidos; +20% de área' }] }, '+6 de dano'],
      },
      shellSideArm: {
        description: 'Escolhe o lado que dói mais: um inimigo perto leva uma pancada de concha; um longe, um projétil que envenena.',
        upgrades: ['+3 de dano', '+15% de chance de envenenar', { fork: [{ name: 'Concha Explosiva', desc: 'Inimigos derrotados explodem; +3 de dano' }, { name: 'Rastro Tóxico', desc: 'Deixa chão venenoso; 0,2 s a menos de recarga' }] }, '+4 de dano', '0,2 s a menos de recarga', { fork: [{ name: 'Mira Caçadora', desc: '×1,5 em elites e chefes; +4 de dano' }, { name: 'Veneno Cruel', desc: '×1,35 em inimigos afligidos; +20% de área' }] }, '+6 de dano'],
      },
      obstruct: {
        description: 'Cruza os braços: o próximo golpe (até metade da recarga) é bloqueado e respondido com um X que quebra a defesa de quem atinge.',
        upgrades: ['+5 de dano', '+0,2 s de bloqueio', { fork: [{ name: 'X Explosivo', desc: 'Inimigos derrotados explodem; +6 de dano' }, { name: 'X Faiscante', desc: 'Faíscas no X; 0,5 s a menos de recarga' }] }, '+6 de dano', '0,4 s a menos de recarga', { fork: [{ name: 'Bloqueio Caçador', desc: '×1,5 em elites e chefes; +25% de área' }, { name: 'Bloqueio Vital', desc: 'Parte do dano cura você; +6 de dano' }] }, '+8 de dano e +0,2 s de bloqueio'],
      },
      meteorAssault: {
        description: 'Uma justa de alho-poró pela fila mais longa de inimigos, intocável no caminho. Depois, um fôlego: fica mais lento por um instante.',
        upgrades: ['+6 de dano', '+20% de área', { fork: [{ name: 'Justa Explosiva', desc: 'Inimigos derrotados explodem; +6 de dano' }, { name: 'Rastro de Poeira', desc: 'Deixa um rastro que fere; 0,3 s a menos de recarga' }] }, '+7 de dano', '0,3 s a menos de recarga', { fork: [{ name: 'Lança Caçadora', desc: '×1,5 em elites e chefes; +8 de dano' }, { name: 'Segunda Justa', desc: 'Repete logo em seguida; -4 de dano' }] }, '+10 de dano e +20% de área'],
      },
      chloroblast: {
        description: 'Uma explosão de energia verde em volta, fortíssima, que custa um pouco de HP quando acerta (nunca o último ponto).',
        upgrades: ['+6 de dano', '+15% de área', { fork: [{ name: 'Clorofila Explosiva', desc: 'Inimigos derrotados explodem; +6 de dano' }, { name: 'Redemoinho Verde', desc: 'A explosão puxa inimigos; 0,4 s a menos de recarga' }] }, '+7 de dano', '0,3 s a menos de recarga', { fork: [{ name: 'Seiva Vital', desc: 'Parte do dano cura você; +6 de dano' }, { name: 'Arco Verde', desc: 'Faíscas saltam ao redor; +20% de área' }] }, '+10 de dano e +15% de área'],
      },
      bitterMalice: {
        description: 'Um rancor gelado na maior aglomeração: enfraquece quem atinge (bate menos ao encostar) e deixa lento. Inimigos afligidos levam ×1,4.',
        upgrades: ['+3 de dano', '+15% de área', { fork: [{ name: 'Rancor Explosivo', desc: 'Inimigos derrotados explodem; +3 de dano' }, { name: 'Rancor que Salta', desc: 'Faíscas saltam para inimigos próximos; 0,25 s a menos de recarga' }] }, '+4 de dano', '0,2 s a menos de recarga', { fork: [{ name: 'Rancor Caçador', desc: '×1,5 em elites e chefes; +4 de dano' }, { name: 'Redemoinho de Rancor', desc: 'Puxa inimigos; +20% de área' }] }, '+6 de dano e +15% de área'],
      },
      poisonSting: {
        description: 'Infla e dispara farpas para todos os lados. Inimigos envenenados levam ×1,5, e o Overqwil dispara 4 farpas a mais.',
        upgrades: ['+2 farpas', '+2 de dano', { fork: [{ name: 'Farpa Explosiva', desc: 'Inimigos derrotados explodem; +2 de dano' }, { name: 'Farpa Longa', desc: 'Cada farpa atravessa +1 inimigo e deixa chão venenoso' }] }, '+2 farpas', '0,2 s a menos de recarga', { fork: [{ name: 'Farpa Cruel', desc: '×1,35 em inimigos afligidos; +15% de chance de envenenar' }, { name: 'Farpa Caçadora', desc: '×1,5 em elites e chefes; +2 de dano' }] }, '+2 farpas e +3 de dano'],
      },
      toxic: {
        description: 'Lança uma poça tóxica na maior aglomeração: cada instante nela soma veneno. Quem cai muito envenenado passa o veneno adiante.',
        upgrades: ['+1 de dano', '+15% de área', { fork: [{ name: 'Lodo que Puxa', desc: 'A poça puxa inimigos; +0,6 s de duração' }, { name: 'Lodo Volátil', desc: 'Inimigos derrotados explodem; 0,3 s a menos de recarga' }] }, '+2 de dano', '0,3 s a menos de recarga', { fork: [{ name: 'Toxina Caçadora', desc: '×1,5 em elites e chefes; +15% de dano de status' }, { name: 'Toxina Cruel', desc: '×1,35 em inimigos afligidos; +20% de área' }] }, '+2 de dano e +0,6 s de duração'],
      },
      ragingBull: {
        description: 'Investe contra o inimigo mais próximo e atravessa elites e chefes (+30%). O tipo é o da raça: Lutador, Fogo (queima) ou Água (deixa lento).',
        upgrades: ['+5 de dano', '+20% de área', { fork: [{ name: 'Chifrada Explosiva', desc: 'Inimigos derrotados explodem; +5 de dano' }, { name: 'Estouro', desc: 'Deixa um rastro que fere; 0,3 s a menos de recarga' }] }, '+6 de dano', '0,25 s a menos de recarga', { fork: [{ name: 'Touro Caçador', desc: '×1,5 em elites e chefes; +6 de dano' }, { name: 'Segunda Investida', desc: 'Repete logo em seguida; -3 de dano' }] }, '+9 de dano e +20% de área'],
      },
    },
    abilities: {
      snowWarning: 'Chama a neve ao ser escolhida e a cada bioma novo, e não sofre com ela.',
      tanglingHair: 'Inimigos que encostam podem se enroscar nos fios e ficar bem lentos.',
      magnetPull: 'Puxa itens de bem mais longe, e golpes de Aço causam +10%.',
      galvanize: 'Golpes Normais causam +25% e os Elétricos +20%.',
      poisonTouch: 'Mais chance de efeitos, golpes de Veneno +10%, e quem encosta pode ser envenenado.',
      steelySpirit: 'Golpes de Aço causam +30%.',
      defiant: 'Ao levar um golpe, +30% de dano por 4 s.',
      perishBody: 'Quem encosta é marcado para perecer: leva mais dano de tudo, e um pouco ao tocar.',
      gorillaTactics: '+40% de dano, mas os golpes recarregam um pouco mais devagar.',
      aftermath: 'Imune a explosões, e quem encosta leva dano.',
      angerPoint: 'Ao levar um golpe, fica furioso: +45% de dano e mais velocidade por 3 s.',
    },
    tiers: { alola: 'Ovo de Viagem de Alola', galar: 'Ovo de Viagem de Galar', hisui: 'Ovo de Viagem de Hisui', paldea: 'Ovo de Viagem de Paldea' },
    travel: {
      regions: { alola: 'Alola', galar: 'Galar', hisui: 'Hisui', paldea: 'Paldea' },
      card: 'Ovo de Viagem',
      week: (region) => `Viagem da semana: ${region}`,
      text: (region, steps) => `Choca em ${steps} passos: só formas de ${region}, que nenhum outro ovo traz. Toda segunda a viagem muda de região, e o Safári recebe os mesmos visitantes.`,
      progress: (got, of) => `Você tem ${got} de ${of} famílias desta região.`,
      next: (region, when) => `Próxima viagem: ${region}, ${when}.`,
      safari: (region) => `Visitantes de ${region} nesta semana`,
      said: 'Kecleon! Esse veio de muito longe... olha o carimbo! Cuida bem dele!',
    },
  },
  en: {
    blurbs: {
      vulpixAlola: 'Aurora Veil; in the snow, which it calls itself, the veil grows wider and stronger.',
      sandshrewAlola: 'Curls into a ball of ice and steel that grows as it rolls.',
      diglettAlola: 'Claws that sharpen with every hit, and golden hair that snares.',
      geodudeAlola: 'Magnetized rock: it fires boulders and pulls drops from far away.',
      grimerAlola: 'Corrosive gas that jumps from foe to foe. It eats anything.',
      meowthGalar: 'A steel viking: claws that sharpen, and Steely Spirit on Perrserker.',
      slowpokeGalar: 'Shell or poison, by the distance. It becomes Galarian Slowbro or Slowking.',
      zigzagoonGalar: 'Blocks the hit and answers with an X that breaks Defense.',
      farfetchdGalar: 'A leek joust through the longest line of foes. It never evolves.',
      corsolaGalar: 'Perish Song, and a body that marks whatever touches it.',
      mimeJr: 'A mirror at the right moment; it evolves into the icy Galarian Mr. Mime.',
      darumakaGalar: 'Avalanches and Gorilla Tactics: slow, but devastating.',
      growlitheHisui: 'A flaming stone headbutt; tough as rock.',
      zoruaHisui: 'A cold spite that saps the crowd, and an illusion that blocks a hit now and then.',
      voltorbHisui: 'A huge green blast that costs a little HP.',
      qwilfishHisui: 'Barbs in every direction; Overqwil fires even more.',
      wooperPaldea: 'A toxic pool that gets worse the longer they stand in it, and passes it on.',
      taurosPaldea: 'A raging charge; at Lv 20 its breed shows: Combat, Blaze or Aqua.',
    },
    moves: {
      metalClaw: {
        description: 'Claws the nearest foe. Every hit sharpens the claws (up to +48% damage); taking a hit dulls them again.',
        upgrades: ['+3 damage', '+20% area', { fork: [{ name: 'Bursting Claw', desc: 'Defeated foes explode; +3 damage' }, { name: 'Sparking Claw', desc: 'Sparks leap to nearby foes; 0.1 s less cooldown' }] }, '+3 damage', '0.08 s less cooldown', { fork: [{ name: 'Hunting Claw', desc: '×1.5 on elites and bosses; +4 damage' }, { name: 'Cruel Claw', desc: '×1.35 on afflicted foes; +20% area' }] }, '+6 damage'],
      },
      shellSideArm: {
        description: 'Picks the side that hurts more: a foe up close gets a shell slam; one far away, a poisoning bolt.',
        upgrades: ['+3 damage', '+15% poison chance', { fork: [{ name: 'Bursting Shell', desc: 'Defeated foes explode; +3 damage' }, { name: 'Toxic Trail', desc: 'Leaves poisoned ground; 0.2 s less cooldown' }] }, '+4 damage', '0.2 s less cooldown', { fork: [{ name: 'Hunting Aim', desc: '×1.5 on elites and bosses; +4 damage' }, { name: 'Cruel Venom', desc: '×1.35 on afflicted foes; +20% area' }] }, '+6 damage'],
      },
      obstruct: {
        description: 'Arms crossed: the next hit (up to half the cooldown) is blocked and answered with an X that breaks the Defense of all it strikes.',
        upgrades: ['+5 damage', '+0.2 s block', { fork: [{ name: 'Bursting X', desc: 'Defeated foes explode; +6 damage' }, { name: 'Sparking X', desc: 'Sparks off the X; 0.5 s less cooldown' }] }, '+6 damage', '0.4 s less cooldown', { fork: [{ name: 'Hunting Block', desc: '×1.5 on elites and bosses; +25% area' }, { name: 'Vital Block', desc: 'Part of the damage heals you; +6 damage' }] }, '+8 damage and +0.2 s block'],
      },
      meteorAssault: {
        description: 'A leek joust through the longest line of foes, untouchable on the way. Then it needs a breath: slower for a moment.',
        upgrades: ['+6 damage', '+20% area', { fork: [{ name: 'Bursting Joust', desc: 'Defeated foes explode; +6 damage' }, { name: 'Dust Trail', desc: 'Leaves a trail that hurts; 0.3 s less cooldown' }] }, '+7 damage', '0.3 s less cooldown', { fork: [{ name: 'Hunting Lance', desc: '×1.5 on elites and bosses; +8 damage' }, { name: 'Second Joust', desc: 'Repeats right after; -4 damage' }] }, '+10 damage and +20% area'],
      },
      chloroblast: {
        description: 'A huge blast of green energy all around that costs a little HP when it lands (never the last point).',
        upgrades: ['+6 damage', '+15% area', { fork: [{ name: 'Bursting Chlorophyll', desc: 'Defeated foes explode; +6 damage' }, { name: 'Green Vortex', desc: 'The blast pulls foes in; 0.4 s less cooldown' }] }, '+7 damage', '0.3 s less cooldown', { fork: [{ name: 'Vital Sap', desc: 'Part of the damage heals you; +6 damage' }, { name: 'Green Arc', desc: 'Sparks leap around; +20% area' }] }, '+10 damage and +15% area'],
      },
      bitterMalice: {
        description: 'A cold spite on the thickest crowd: it saps whoever it hits (weaker on contact) and slows them. Afflicted foes take ×1.4.',
        upgrades: ['+3 damage', '+15% area', { fork: [{ name: 'Bursting Spite', desc: 'Defeated foes explode; +3 damage' }, { name: 'Leaping Spite', desc: 'Sparks leap to nearby foes; 0.25 s less cooldown' }] }, '+4 damage', '0.2 s less cooldown', { fork: [{ name: 'Hunting Spite', desc: '×1.5 on elites and bosses; +4 damage' }, { name: 'Spite Vortex', desc: 'Pulls foes in; +20% area' }] }, '+6 damage and +15% area'],
      },
      poisonSting: {
        description: 'Puffs up and fires barbs in every direction. Poisoned foes take ×1.5, and Overqwil fires 4 more barbs.',
        upgrades: ['+2 barbs', '+2 damage', { fork: [{ name: 'Bursting Barb', desc: 'Defeated foes explode; +2 damage' }, { name: 'Long Barb', desc: 'Each barb pierces 1 more foe and leaves poisoned ground' }] }, '+2 barbs', '0.2 s less cooldown', { fork: [{ name: 'Cruel Barb', desc: '×1.35 on afflicted foes; +15% poison chance' }, { name: 'Hunting Barb', desc: '×1.5 on elites and bosses; +2 damage' }] }, '+2 barbs and +3 damage'],
      },
      toxic: {
        description: 'Throws a toxic pool on the thickest crowd: every moment in it adds poison. A foe that falls badly poisoned passes it on.',
        upgrades: ['+1 damage', '+15% area', { fork: [{ name: 'Pulling Sludge', desc: 'The pool pulls foes in; +0.6 s duration' }, { name: 'Volatile Sludge', desc: 'Defeated foes explode; 0.3 s less cooldown' }] }, '+2 damage', '0.3 s less cooldown', { fork: [{ name: 'Hunting Toxin', desc: '×1.5 on elites and bosses; +15% status damage' }, { name: 'Cruel Toxin', desc: '×1.35 on afflicted foes; +20% area' }] }, '+2 damage and +0.6 s duration'],
      },
      ragingBull: {
        description: 'Charges the nearest foe and breaks through elites and bosses (+30%). Its type is the breed\'s: Fighting, Fire (burns) or Water (slows).',
        upgrades: ['+5 damage', '+20% area', { fork: [{ name: 'Bursting Horns', desc: 'Defeated foes explode; +5 damage' }, { name: 'Stampede', desc: 'Leaves a trail that hurts; 0.3 s less cooldown' }] }, '+6 damage', '0.25 s less cooldown', { fork: [{ name: 'Hunting Bull', desc: '×1.5 on elites and bosses; +6 damage' }, { name: 'Second Charge', desc: 'Repeats right after; -3 damage' }] }, '+9 damage and +20% area'],
      },
    },
    abilities: {
      snowWarning: 'Calls the snow when picked and at every new biome, and it takes no harm from it.',
      tanglingHair: 'Foes that touch you may get tangled in your hair and slow right down.',
      magnetPull: 'Pulls drops from much farther away, and Steel moves deal +10%.',
      galvanize: 'Normal moves deal +25% and Electric ones +20%.',
      poisonTouch: 'Better odds of effects, Poison moves +10%, and foes that touch you may be poisoned.',
      steelySpirit: 'Steel moves deal +30%.',
      defiant: 'When hit, +30% damage for 4 s.',
      perishBody: 'Whatever touches you is marked to perish: it takes more damage from everything, and a little on contact.',
      gorillaTactics: '+40% damage, but moves recharge a little slower.',
      aftermath: 'Immune to blasts, and foes that touch you take damage.',
      angerPoint: 'When hit, it flies into a rage: +45% damage and more speed for 3 s.',
    },
    tiers: { alola: 'Alola Travel Egg', galar: 'Galar Travel Egg', hisui: 'Hisui Travel Egg', paldea: 'Paldea Travel Egg' },
    travel: {
      regions: { alola: 'Alola', galar: 'Galar', hisui: 'Hisui', paldea: 'Paldea' },
      card: 'Travel Egg',
      week: (region) => `This week's trip: ${region}`,
      text: (region, steps) => `Hatches in ${steps} steps: only ${region} forms, which no other egg brings. Every Monday the trip moves to another region, and the Safari gets the same visitors.`,
      progress: (got, of) => `You have ${got} of this region's ${of} families.`,
      next: (region, when) => `Next trip: ${region}, ${when}.`,
      safari: (region) => `Visitors from ${region} this week`,
      said: 'Kecleon! This one came from far away... look at that stamp! Take good care of it!',
    },
  },
  es: {
    blurbs: {
      vulpixAlola: 'Velo Aurora; en la nieve, que ella misma llama, el velo crece y se vuelve más fuerte.',
      sandshrewAlola: 'Se hace una bola de hielo y acero que crece al rodar.',
      diglettAlola: 'Garras que se afilan con cada golpe y un pelo dorado que atrapa.',
      geodudeAlola: 'Roca magnetizada: dispara rocas y atrae objetos desde lejos.',
      grimerAlola: 'Gas corrosivo que salta de enemigo en enemigo. Se come de todo.',
      meowthGalar: 'Vikingo de acero: garras que se afilan y Alma Acerada en Perrserker.',
      slowpokeGalar: 'Concha o veneno, según la distancia. Se vuelve Galarian Slowbro o Galarian Slowking.',
      zigzagoonGalar: 'Bloquea el golpe y responde con una X que rompe la defensa.',
      farfetchdGalar: 'Una justa de puerro por la fila más larga de enemigos. No evoluciona.',
      corsolaGalar: 'Canto Mortal, y un cuerpo que marca a quien lo toca.',
      mimeJr: 'Un espejo en el momento justo; evoluciona en Galarian Mr. Mime, de hielo.',
      darumakaGalar: 'Aludes y Monotema: lento, pero devastador.',
      growlitheHisui: 'Un cabezazo de piedra en llamas; duro como la roca.',
      zoruaHisui: 'Un rencor helado que debilita a la multitud, y una ilusión que bloquea un golpe de vez en cuando.',
      voltorbHisui: 'Una explosión verde enorme que cuesta un poco de PS.',
      qwilfishHisui: 'Púas hacia todos lados; Overqwil dispara todavía más.',
      wooperPaldea: 'Un charco tóxico que empeora cuanto más se queda uno en él, y se contagia.',
      taurosPaldea: 'Embestida furiosa; en el Nv. 20 muestra su raza: Combate, Llama o Acuática.',
    },
    moves: {
      metalClaw: {
        description: 'Araña al enemigo más cercano. Cada golpe afila las garras (hasta +48% de daño); recibir un golpe las desafila.',
        upgrades: ['+3 de daño', '+20% de área', { fork: [{ name: 'Garra Explosiva', desc: 'Los enemigos derrotados explotan; +3 de daño' }, { name: 'Garra Chispeante', desc: 'Saltan chispas a enemigos cercanos; 0,1 s menos de recarga' }] }, '+3 de daño', '0,08 s menos de recarga', { fork: [{ name: 'Garra Cazadora', desc: '×1,5 contra élites y jefes; +4 de daño' }, { name: 'Garra Cruel', desc: '×1,35 contra enemigos afectados; +20% de área' }] }, '+6 de daño'],
      },
      shellSideArm: {
        description: 'Elige el lado que más duele: a un enemigo cerca, un golpe de concha; a uno lejos, un proyectil que envenena.',
        upgrades: ['+3 de daño', '+15% de probabilidad de envenenar', { fork: [{ name: 'Concha Explosiva', desc: 'Los enemigos derrotados explotan; +3 de daño' }, { name: 'Rastro Tóxico', desc: 'Deja suelo venenoso; 0,2 s menos de recarga' }] }, '+4 de daño', '0,2 s menos de recarga', { fork: [{ name: 'Puntería Cazadora', desc: '×1,5 contra élites y jefes; +4 de daño' }, { name: 'Veneno Cruel', desc: '×1,35 contra enemigos afectados; +20% de área' }] }, '+6 de daño'],
      },
      obstruct: {
        description: 'Cruza los brazos: el siguiente golpe (hasta la mitad de la recarga) se bloquea y responde con una X que rompe la defensa de todo lo que toca.',
        upgrades: ['+5 de daño', '+0,2 s de bloqueo', { fork: [{ name: 'X Explosiva', desc: 'Los enemigos derrotados explotan; +6 de daño' }, { name: 'X Chispeante', desc: 'Chispas en la X; 0,5 s menos de recarga' }] }, '+6 de daño', '0,4 s menos de recarga', { fork: [{ name: 'Bloqueo Cazador', desc: '×1,5 contra élites y jefes; +25% de área' }, { name: 'Bloqueo Vital', desc: 'Parte del daño te cura; +6 de daño' }] }, '+8 de daño y +0,2 s de bloqueo'],
      },
      meteorAssault: {
        description: 'Una justa de puerro por la fila más larga de enemigos, intocable en el camino. Después necesita aire: va más lento un instante.',
        upgrades: ['+6 de daño', '+20% de área', { fork: [{ name: 'Justa Explosiva', desc: 'Los enemigos derrotados explotan; +6 de daño' }, { name: 'Rastro de Polvo', desc: 'Deja un rastro que hiere; 0,3 s menos de recarga' }] }, '+7 de daño', '0,3 s menos de recarga', { fork: [{ name: 'Lanza Cazadora', desc: '×1,5 contra élites y jefes; +8 de daño' }, { name: 'Segunda Justa', desc: 'Se repite enseguida; -4 de daño' }] }, '+10 de daño y +20% de área'],
      },
      chloroblast: {
        description: 'Una explosión enorme de energía verde alrededor que cuesta un poco de PS al acertar (nunca el último punto).',
        upgrades: ['+6 de daño', '+15% de área', { fork: [{ name: 'Clorofila Explosiva', desc: 'Los enemigos derrotados explotan; +6 de daño' }, { name: 'Remolino Verde', desc: 'La explosión atrae enemigos; 0,4 s menos de recarga' }] }, '+7 de daño', '0,3 s menos de recarga', { fork: [{ name: 'Savia Vital', desc: 'Parte del daño te cura; +6 de daño' }, { name: 'Arco Verde', desc: 'Saltan chispas alrededor; +20% de área' }] }, '+10 de daño y +15% de área'],
      },
      bitterMalice: {
        description: 'Un rencor helado sobre la multitud más densa: debilita a quien golpea (hace menos daño al tocar) y lo ralentiza. Los enemigos afectados reciben ×1,4.',
        upgrades: ['+3 de daño', '+15% de área', { fork: [{ name: 'Rencor Explosivo', desc: 'Los enemigos derrotados explotan; +3 de daño' }, { name: 'Rencor Saltarín', desc: 'Saltan chispas a enemigos cercanos; 0,25 s menos de recarga' }] }, '+4 de daño', '0,2 s menos de recarga', { fork: [{ name: 'Rencor Cazador', desc: '×1,5 contra élites y jefes; +4 de daño' }, { name: 'Remolino de Rencor', desc: 'Atrae enemigos; +20% de área' }] }, '+6 de daño y +15% de área'],
      },
      poisonSting: {
        description: 'Se infla y dispara púas hacia todos lados. Los enemigos envenenados reciben ×1,5, y Overqwil dispara 4 púas más.',
        upgrades: ['+2 púas', '+2 de daño', { fork: [{ name: 'Púa Explosiva', desc: 'Los enemigos derrotados explotan; +2 de daño' }, { name: 'Púa Larga', desc: 'Cada púa atraviesa 1 enemigo más y deja suelo venenoso' }] }, '+2 púas', '0,2 s menos de recarga', { fork: [{ name: 'Púa Cruel', desc: '×1,35 contra enemigos afectados; +15% de probabilidad de envenenar' }, { name: 'Púa Cazadora', desc: '×1,5 contra élites y jefes; +2 de daño' }] }, '+2 púas y +3 de daño'],
      },
      toxic: {
        description: 'Lanza un charco tóxico a la multitud más densa: cada instante en él suma veneno. Quien cae muy envenenado lo contagia.',
        upgrades: ['+1 de daño', '+15% de área', { fork: [{ name: 'Lodo que Atrae', desc: 'El charco atrae enemigos; +0,6 s de duración' }, { name: 'Lodo Volátil', desc: 'Los enemigos derrotados explotan; 0,3 s menos de recarga' }] }, '+2 de daño', '0,3 s menos de recarga', { fork: [{ name: 'Toxina Cazadora', desc: '×1,5 contra élites y jefes; +15% de daño de estado' }, { name: 'Toxina Cruel', desc: '×1,35 contra enemigos afectados; +20% de área' }] }, '+2 de daño y +0,6 s de duración'],
      },
      ragingBull: {
        description: 'Embiste al enemigo más cercano y atraviesa élites y jefes (+30%). Su tipo es el de la raza: Lucha, Fuego (quema) o Agua (ralentiza).',
        upgrades: ['+5 de daño', '+20% de área', { fork: [{ name: 'Cornada Explosiva', desc: 'Los enemigos derrotados explotan; +5 de daño' }, { name: 'Estampida', desc: 'Deja un rastro que hiere; 0,3 s menos de recarga' }] }, '+6 de daño', '0,25 s menos de recarga', { fork: [{ name: 'Toro Cazador', desc: '×1,5 contra élites y jefes; +6 de daño' }, { name: 'Segunda Embestida', desc: 'Se repite enseguida; -3 de daño' }] }, '+9 de daño y +20% de área'],
      },
    },
    abilities: {
      snowWarning: 'Llama a la nieve al elegirla y en cada bioma nuevo, y no le hace daño.',
      tanglingHair: 'Los enemigos que te tocan pueden enredarse en tu pelo y quedar muy lentos.',
      magnetPull: 'Atrae objetos desde mucho más lejos, y los movimientos de Acero hacen +10%.',
      galvanize: 'Los movimientos Normales hacen +25% y los Eléctricos +20%.',
      poisonTouch: 'Más probabilidad de efectos, Veneno +10%, y quien te toca puede quedar envenenado.',
      steelySpirit: 'Los movimientos de Acero hacen +30%.',
      defiant: 'Al recibir un golpe, +30% de daño durante 4 s.',
      perishBody: 'Lo que te toca queda marcado para perecer: recibe más daño de todo, y un poco al tocarte.',
      gorillaTactics: '+40% de daño, pero los movimientos recargan un poco más lento.',
      aftermath: 'Inmune a explosiones, y quien te toca recibe daño.',
      angerPoint: 'Al recibir un golpe, se enfurece: +45% de daño y más velocidad durante 3 s.',
    },
    tiers: { alola: 'Huevo de Viaje de Alola', galar: 'Huevo de Viaje de Galar', hisui: 'Huevo de Viaje de Hisui', paldea: 'Huevo de Viaje de Paldea' },
    travel: {
      regions: { alola: 'Alola', galar: 'Galar', hisui: 'Hisui', paldea: 'Paldea' },
      card: 'Huevo de Viaje',
      week: (region) => `Viaje de la semana: ${region}`,
      text: (region, steps) => `Eclosiona en ${steps} pasos: solo formas de ${region}, que ningún otro huevo trae. Cada lunes el viaje cambia de región, y el Safari recibe los mismos visitantes.`,
      progress: (got, of) => `Tienes ${got} de las ${of} familias de esta región.`,
      next: (region, when) => `Próximo viaje: ${region}, ${when}.`,
      safari: (region) => `Visitantes de ${region} esta semana`,
      said: '¡Kecleon! Este vino de muy lejos... ¡mira el sello! ¡Cuídalo bien!',
    },
  },
  fr: {
    blurbs: {
      vulpixAlola: 'Voile Aurore ; dans la neige, qu’elle appelle elle-même, le voile grandit et frappe plus fort.',
      sandshrewAlola: 'Se roule en boule de glace et d’acier qui grossit en roulant.',
      diglettAlola: 'Des griffes qui s’aiguisent à chaque coup, et des cheveux dorés qui piègent.',
      geodudeAlola: 'Roche aimantée : il tire des rochers et attire les objets de loin.',
      grimerAlola: 'Un gaz corrosif qui saute d’ennemi en ennemi. Il mange de tout.',
      meowthGalar: 'Un viking d’acier : des griffes qui s’aiguisent, et Âme Acier chez Perrserker.',
      slowpokeGalar: 'Coquille ou poison, selon la distance. Il devient Galarian Slowbro ou Galarian Slowking.',
      zigzagoonGalar: 'Bloque le coup et riposte avec un X qui brise la Défense.',
      farfetchdGalar: 'Une joute au poireau à travers la plus longue file d’ennemis. Il n’évolue pas.',
      corsolaGalar: 'Requiem, et un corps qui marque tout ce qui le touche.',
      mimeJr: 'Un miroir au bon moment ; il évolue en Galarian Mr. Mime, de glace.',
      darumakaGalar: 'Avalanches et Entêtement : lent, mais dévastateur.',
      growlitheHisui: 'Un coup de tête de pierre en flammes ; dur comme la roche.',
      zoruaHisui: 'Une rancune glaciale qui affaiblit la foule, et une illusion qui bloque un coup de temps en temps.',
      voltorbHisui: 'Une énorme explosion verte qui coûte un peu de PV.',
      qwilfishHisui: 'Des dards dans toutes les directions ; Overqwil en tire encore plus.',
      wooperPaldea: 'Une flaque toxique qui empire plus on y reste, et qui se transmet.',
      taurosPaldea: 'Une charge furieuse ; au N. 20 sa race se révèle : Combat, Flamboyant ou Aquatique.',
    },
    moves: {
      metalClaw: {
        description: 'Griffe l’ennemi le plus proche. Chaque coup aiguise les griffes (jusqu’à +48 % de dégâts) ; prendre un coup les émousse.',
        upgrades: ['+3 dégâts', '+20 % de zone', { fork: [{ name: 'Griffe Explosive', desc: 'Les ennemis vaincus explosent ; +3 dégâts' }, { name: 'Griffe Étincelante', desc: 'Des étincelles sautent vers les ennemis proches ; 0,1 s de recharge en moins' }] }, '+3 dégâts', '0,08 s de recharge en moins', { fork: [{ name: 'Griffe Chasseuse', desc: '×1,5 sur les élites et les boss ; +4 dégâts' }, { name: 'Griffe Cruelle', desc: '×1,35 sur les ennemis affligés ; +20 % de zone' }] }, '+6 dégâts'],
      },
      shellSideArm: {
        description: 'Choisit le côté qui fait le plus mal : un ennemi proche prend un coup de coquille ; un ennemi lointain, un trait qui empoisonne.',
        upgrades: ['+3 dégâts', '+15 % de chance d’empoisonner', { fork: [{ name: 'Coquille Explosive', desc: 'Les ennemis vaincus explosent ; +3 dégâts' }, { name: 'Traînée Toxique', desc: 'Laisse un sol empoisonné ; 0,2 s de recharge en moins' }] }, '+4 dégâts', '0,2 s de recharge en moins', { fork: [{ name: 'Visée Chasseuse', desc: '×1,5 sur les élites et les boss ; +4 dégâts' }, { name: 'Venin Cruel', desc: '×1,35 sur les ennemis affligés ; +20 % de zone' }] }, '+6 dégâts'],
      },
      obstruct: {
        description: 'Bras croisés : le prochain coup (jusqu’à la moitié de la recharge) est bloqué, et la riposte est un X qui brise la Défense de tout ce qu’il touche.',
        upgrades: ['+5 dégâts', '+0,2 s de blocage', { fork: [{ name: 'X Explosif', desc: 'Les ennemis vaincus explosent ; +6 dégâts' }, { name: 'X Étincelant', desc: 'Des étincelles jaillissent du X ; 0,5 s de recharge en moins' }] }, '+6 dégâts', '0,4 s de recharge en moins', { fork: [{ name: 'Blocage Chasseur', desc: '×1,5 sur les élites et les boss ; +25 % de zone' }, { name: 'Blocage Vital', desc: 'Une partie des dégâts vous soigne ; +6 dégâts' }] }, '+8 dégâts et +0,2 s de blocage'],
      },
      meteorAssault: {
        description: 'Une joute au poireau à travers la plus longue file d’ennemis, intouchable en chemin. Puis il reprend son souffle : plus lent un instant.',
        upgrades: ['+6 dégâts', '+20 % de zone', { fork: [{ name: 'Joute Explosive', desc: 'Les ennemis vaincus explosent ; +6 dégâts' }, { name: 'Traînée de Poussière', desc: 'Laisse une traînée qui blesse ; 0,3 s de recharge en moins' }] }, '+7 dégâts', '0,3 s de recharge en moins', { fork: [{ name: 'Lance Chasseuse', desc: '×1,5 sur les élites et les boss ; +8 dégâts' }, { name: 'Seconde Joute', desc: 'Se répète aussitôt ; -4 dégâts' }] }, '+10 dégâts et +20 % de zone'],
      },
      chloroblast: {
        description: 'Une énorme explosion d’énergie verte tout autour, qui coûte un peu de PV quand elle touche (jamais le dernier point).',
        upgrades: ['+6 dégâts', '+15 % de zone', { fork: [{ name: 'Chlorophylle Explosive', desc: 'Les ennemis vaincus explosent ; +6 dégâts' }, { name: 'Tourbillon Vert', desc: 'L’explosion attire les ennemis ; 0,4 s de recharge en moins' }] }, '+7 dégâts', '0,3 s de recharge en moins', { fork: [{ name: 'Sève Vitale', desc: 'Une partie des dégâts vous soigne ; +6 dégâts' }, { name: 'Arc Vert', desc: 'Des étincelles sautent autour ; +20 % de zone' }] }, '+10 dégâts et +15 % de zone'],
      },
      bitterMalice: {
        description: 'Une rancune glaciale sur la foule la plus dense : elle affaiblit ce qu’elle touche (moins de dégâts au contact) et ralentit. Les ennemis affligés prennent ×1,4.',
        upgrades: ['+3 dégâts', '+15 % de zone', { fork: [{ name: 'Rancune Explosive', desc: 'Les ennemis vaincus explosent ; +3 dégâts' }, { name: 'Rancune Bondissante', desc: 'Des étincelles sautent vers les ennemis proches ; 0,25 s de recharge en moins' }] }, '+4 dégâts', '0,2 s de recharge en moins', { fork: [{ name: 'Rancune Chasseuse', desc: '×1,5 sur les élites et les boss ; +4 dégâts' }, { name: 'Tourbillon de Rancune', desc: 'Attire les ennemis ; +20 % de zone' }] }, '+6 dégâts et +15 % de zone'],
      },
      poisonSting: {
        description: 'Se gonfle et tire des dards dans toutes les directions. Les ennemis empoisonnés prennent ×1,5, et Overqwil tire 4 dards de plus.',
        upgrades: ['+2 dards', '+2 dégâts', { fork: [{ name: 'Dard Explosif', desc: 'Les ennemis vaincus explosent ; +2 dégâts' }, { name: 'Dard Long', desc: 'Chaque dard transperce 1 ennemi de plus et laisse un sol empoisonné' }] }, '+2 dards', '0,2 s de recharge en moins', { fork: [{ name: 'Dard Cruel', desc: '×1,35 sur les ennemis affligés ; +15 % de chance d’empoisonner' }, { name: 'Dard Chasseur', desc: '×1,5 sur les élites et les boss ; +2 dégâts' }] }, '+2 dards et +3 dégâts'],
      },
      toxic: {
        description: 'Lance une flaque toxique sur la foule la plus dense : chaque instant dedans ajoute du poison. Un ennemi qui tombe gravement empoisonné le transmet.',
        upgrades: ['+1 dégât', '+15 % de zone', { fork: [{ name: 'Boue Attirante', desc: 'La flaque attire les ennemis ; +0,6 s de durée' }, { name: 'Boue Volatile', desc: 'Les ennemis vaincus explosent ; 0,3 s de recharge en moins' }] }, '+2 dégâts', '0,3 s de recharge en moins', { fork: [{ name: 'Toxine Chasseuse', desc: '×1,5 sur les élites et les boss ; +15 % de dégâts de statut' }, { name: 'Toxine Cruelle', desc: '×1,35 sur les ennemis affligés ; +20 % de zone' }] }, '+2 dégâts et +0,6 s de durée'],
      },
      ragingBull: {
        description: 'Charge l’ennemi le plus proche et perce les élites et les boss (+30 %). Son type est celui de la race : Combat, Feu (brûle) ou Eau (ralentit).',
        upgrades: ['+5 dégâts', '+20 % de zone', { fork: [{ name: 'Cornes Explosives', desc: 'Les ennemis vaincus explosent ; +5 dégâts' }, { name: 'Ruée', desc: 'Laisse une traînée qui blesse ; 0,3 s de recharge en moins' }] }, '+6 dégâts', '0,25 s de recharge en moins', { fork: [{ name: 'Taureau Chasseur', desc: '×1,5 sur les élites et les boss ; +6 dégâts' }, { name: 'Seconde Charge', desc: 'Se répète aussitôt ; -3 dégâts' }] }, '+9 dégâts et +20 % de zone'],
      },
    },
    abilities: {
      snowWarning: 'Appelle la neige quand elle est choisie et à chaque nouveau biome, sans en souffrir.',
      tanglingHair: 'Les ennemis qui vous touchent peuvent s’emmêler dans vos cheveux et ralentir fortement.',
      magnetPull: 'Attire les objets de bien plus loin, et les capacités Acier font +10 %.',
      galvanize: 'Les capacités Normal font +25 % et les capacités Électrik +20 %.',
      poisonTouch: 'Plus de chances d’effets, capacités Poison +10 %, et ce qui vous touche peut être empoisonné.',
      steelySpirit: 'Les capacités Acier font +30 %.',
      defiant: 'Quand vous êtes touché, +30 % de dégâts pendant 4 s.',
      perishBody: 'Ce qui vous touche est marqué pour périr : il subit plus de dégâts de tout, et un peu au contact.',
      gorillaTactics: '+40 % de dégâts, mais les capacités se rechargent un peu plus lentement.',
      aftermath: 'Immunisé contre les explosions, et ce qui vous touche subit des dégâts.',
      angerPoint: 'Quand vous êtes touché, la colère monte : +45 % de dégâts et plus de vitesse pendant 3 s.',
    },
    tiers: { alola: 'Œuf de Voyage d’Alola', galar: 'Œuf de Voyage de Galar', hisui: 'Œuf de Voyage de Hisui', paldea: 'Œuf de Voyage de Paldea' },
    travel: {
      regions: { alola: 'Alola', galar: 'Galar', hisui: 'Hisui', paldea: 'Paldea' },
      card: 'Œuf de Voyage',
      week: (region) => `Voyage de la semaine : ${region}`,
      text: (region, steps) => `Éclot en ${steps} pas : uniquement des formes de ${region}, qu’aucun autre œuf n’apporte. Chaque lundi le voyage change de région, et le Safari reçoit les mêmes visiteurs.`,
      progress: (got, of) => `Vous avez ${got} des ${of} familles de cette région.`,
      next: (region, when) => `Prochain voyage : ${region}, ${when}.`,
      safari: (region) => `Visiteurs de ${region} cette semaine`,
      said: 'Kecleon ! Celui-ci vient de très loin... regardez ce tampon ! Prenez-en bien soin !',
    },
  },
  zh: {
    blurbs: {
      vulpixAlola: '極光幕；在牠自己招來的雪中，光幕會變得更大更強。',
      sandshrewAlola: '捲成冰與鋼的球，越滾越大。',
      diglettAlola: '每次命中都會磨利的爪子，以及會纏住敵人的金色頭髮。',
      geodudeAlola: '帶磁的岩石：發射岩石，並從遠處吸來道具。',
      grimerAlola: '在敵人之間傳播的腐蝕氣體。什麼都吃。',
      meowthGalar: '鋼鐵維京人：越打越利的爪子，進化成Perrserker後擁有鋼之意志。',
      slowpokeGalar: '依距離選擇貝殼或毒。會進化成Galarian Slowbro或Galarian Slowking。',
      zigzagoonGalar: '擋下攻擊，再以打破防禦的X字反擊。',
      farfetchdGalar: '用大蔥穿刺最長的一排敵人。不會進化。',
      corsolaGalar: '滅亡之歌，以及會標記觸碰者的身體。',
      mimeJr: '在對的時機架起鏡子；會進化成冰屬性的Galarian Mr. Mime。',
      darumakaGalar: '雪崩與一猩一意：緩慢，但威力驚人。',
      growlitheHisui: '燃燒的岩石頭槌；像岩石一樣堅硬。',
      zoruaHisui: '削弱敵群的冰冷怨恨，以及不時擋下一擊的幻覺。',
      voltorbHisui: '強大的綠色爆炸，會消耗一點HP。',
      qwilfishHisui: '向四面八方射出毒刺；Overqwil射得更多。',
      wooperPaldea: '待得越久越毒的毒池，而且會傳給別人。',
      taurosPaldea: '狂暴衝撞；Lv 20時顯現品種：鬥戰、火熾或水瀾。',
    },
    moves: {
      metalClaw: {
        description: '抓向最近的敵人。每次命中都會磨利爪子（最多+48%傷害）；受到攻擊後又會變鈍。',
        upgrades: ['+3傷害', '+20%範圍', { fork: [{ name: '爆裂之爪', desc: '被擊敗的敵人會爆炸；+3傷害' }, { name: '火花之爪', desc: '火花跳向附近的敵人；冷卻減少0.1秒' }] }, '+3傷害', '冷卻減少0.08秒', { fork: [{ name: '獵手之爪', desc: '對精英與首領×1.5；+4傷害' }, { name: '殘酷之爪', desc: '對異常狀態的敵人×1.35；+20%範圍' }] }, '+6傷害'],
      },
      shellSideArm: {
        description: '選擇傷害更高的一面：近處的敵人吃一記貝殼重擊；遠處的則中一發會中毒的毒彈。',
        upgrades: ['+3傷害', '中毒機率+15%', { fork: [{ name: '爆裂貝殼', desc: '被擊敗的敵人會爆炸；+3傷害' }, { name: '劇毒軌跡', desc: '留下有毒的地面；冷卻減少0.2秒' }] }, '+4傷害', '冷卻減少0.2秒', { fork: [{ name: '獵手瞄準', desc: '對精英與首領×1.5；+4傷害' }, { name: '殘酷之毒', desc: '對異常狀態的敵人×1.35；+20%範圍' }] }, '+6傷害'],
      },
      obstruct: {
        description: '雙臂交叉：擋下下一次攻擊（最多為冷卻的一半），並以X字反擊，打破所有被擊中者的防禦。',
        upgrades: ['+5傷害', '格擋+0.2秒', { fork: [{ name: '爆裂X字', desc: '被擊敗的敵人會爆炸；+6傷害' }, { name: '火花X字', desc: 'X字迸出火花；冷卻減少0.5秒' }] }, '+6傷害', '冷卻減少0.4秒', { fork: [{ name: '獵手格擋', desc: '對精英與首領×1.5；+25%範圍' }, { name: '生命格擋', desc: '部分傷害會治療你；+6傷害' }] }, '+8傷害，格擋+0.2秒'],
      },
      meteorAssault: {
        description: '用大蔥穿刺最長的一排敵人，途中無法被攻擊。之後需要喘口氣：短暫變慢。',
        upgrades: ['+6傷害', '+20%範圍', { fork: [{ name: '爆裂突刺', desc: '被擊敗的敵人會爆炸；+6傷害' }, { name: '塵土軌跡', desc: '留下會造成傷害的軌跡；冷卻減少0.3秒' }] }, '+7傷害', '冷卻減少0.3秒', { fork: [{ name: '獵手長槍', desc: '對精英與首領×1.5；+8傷害' }, { name: '第二次突刺', desc: '緊接著再發動一次；-4傷害' }] }, '+10傷害，+20%範圍'],
      },
      chloroblast: {
        description: '周圍爆發強大的綠色能量，命中時會消耗一點HP（絕不會扣到最後一點）。',
        upgrades: ['+6傷害', '+15%範圍', { fork: [{ name: '爆裂葉綠素', desc: '被擊敗的敵人會爆炸；+6傷害' }, { name: '綠色漩渦', desc: '爆炸會吸引敵人；冷卻減少0.4秒' }] }, '+7傷害', '冷卻減少0.3秒', { fork: [{ name: '生命樹液', desc: '部分傷害會治療你；+6傷害' }, { name: '綠色電弧', desc: '火花向周圍跳躍；+20%範圍' }] }, '+10傷害，+15%範圍'],
      },
      bitterMalice: {
        description: '對最密集的敵群施放冰冷的怨恨：被擊中者會被削弱（接觸傷害降低）並減速。異常狀態的敵人受到×1.4。',
        upgrades: ['+3傷害', '+15%範圍', { fork: [{ name: '爆裂怨恨', desc: '被擊敗的敵人會爆炸；+3傷害' }, { name: '跳躍怨恨', desc: '火花跳向附近的敵人；冷卻減少0.25秒' }] }, '+4傷害', '冷卻減少0.2秒', { fork: [{ name: '獵手怨恨', desc: '對精英與首領×1.5；+4傷害' }, { name: '怨恨漩渦', desc: '吸引敵人；+20%範圍' }] }, '+6傷害，+15%範圍'],
      },
      poisonSting: {
        description: '鼓起身體向四面八方射出毒刺。中毒的敵人受到×1.5，Overqwil會多射4根毒刺。',
        upgrades: ['+2根毒刺', '+2傷害', { fork: [{ name: '爆裂毒刺', desc: '被擊敗的敵人會爆炸；+2傷害' }, { name: '長毒刺', desc: '每根毒刺多穿透1個敵人，並留下有毒的地面' }] }, '+2根毒刺', '冷卻減少0.2秒', { fork: [{ name: '殘酷毒刺', desc: '對異常狀態的敵人×1.35；中毒機率+15%' }, { name: '獵手毒刺', desc: '對精英與首領×1.5；+2傷害' }] }, '+2根毒刺，+3傷害'],
      },
      toxic: {
        description: '向最密集的敵群丟出毒池：待在裡面的每一刻都會疊加中毒。嚴重中毒倒下的敵人會把毒傳下去。',
        upgrades: ['+1傷害', '+15%範圍', { fork: [{ name: '吸引毒泥', desc: '毒池會吸引敵人；持續+0.6秒' }, { name: '揮發毒泥', desc: '被擊敗的敵人會爆炸；冷卻減少0.3秒' }] }, '+2傷害', '冷卻減少0.3秒', { fork: [{ name: '獵手毒素', desc: '對精英與首領×1.5；狀態傷害+15%' }, { name: '殘酷毒素', desc: '對異常狀態的敵人×1.35；+20%範圍' }] }, '+2傷害，持續+0.6秒'],
      },
      ragingBull: {
        description: '衝向最近的敵人，貫穿精英與首領（+30%）。屬性取決於品種：格鬥、火（灼傷）或水（減速）。',
        upgrades: ['+5傷害', '+20%範圍', { fork: [{ name: '爆裂之角', desc: '被擊敗的敵人會爆炸；+5傷害' }, { name: '狂奔', desc: '留下會造成傷害的軌跡；冷卻減少0.3秒' }] }, '+6傷害', '冷卻減少0.25秒', { fork: [{ name: '獵手公牛', desc: '對精英與首領×1.5；+6傷害' }, { name: '第二次衝撞', desc: '緊接著再發動一次；-3傷害' }] }, '+9傷害，+20%範圍'],
      },
    },
    abilities: {
      snowWarning: '被選中時與每到新的生態域都會招來下雪，且不受其傷害。',
      tanglingHair: '碰到你的敵人可能被頭髮纏住，變得非常緩慢。',
      magnetPull: '從更遠的地方吸來道具，鋼屬性招式傷害+10%。',
      galvanize: '一般屬性招式傷害+25%，電屬性招式+20%。',
      poisonTouch: '效果機率提高，毒屬性招式+10%，碰到你的敵人可能中毒。',
      steelySpirit: '鋼屬性招式傷害+30%。',
      defiant: '受到攻擊時，4秒內傷害+30%。',
      perishBody: '碰到你的東西會被標記滅亡：受到的所有傷害提高，接觸時也會受到少量傷害。',
      gorillaTactics: '傷害+40%，但招式冷卻稍微變慢。',
      aftermath: '不受爆炸影響，碰到你的敵人會受到傷害。',
      angerPoint: '受到攻擊時陷入狂怒：3秒內傷害+45%，速度提升。',
    },
    tiers: { alola: '阿羅拉旅行蛋', galar: '伽勒爾旅行蛋', hisui: '洗翠旅行蛋', paldea: '帕底亞旅行蛋' },
    travel: {
      regions: { alola: '阿羅拉', galar: '伽勒爾', hisui: '洗翠', paldea: '帕底亞' },
      card: '旅行蛋',
      week: (region) => `本週旅行：${region}`,
      text: (region, steps) => `${steps}步孵化：只會孵出${region}的樣子，其他蛋都孵不出來。每週一旅行會換到另一個地區，狩獵地帶也會迎來同樣的訪客。`,
      progress: (got, of) => `你擁有這個地區${of}個家族中的${got}個。`,
      next: (region, when) => `下一趟旅行：${region}，${when}。`,
      safari: (region) => `本週來自${region}的訪客`,
      said: 'Kecleon！這顆蛋來自很遠的地方……看看這個郵戳！好好照顧它！',
    },
  },
}
