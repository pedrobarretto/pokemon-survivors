/**
 * The words of the Grande Atualização's mythicals (`MYTHICAL_LEGENDS` in
 * `data/legends.ts`, `data/mythicals.ts`): Diancie dug up at the Escavação,
 * Zeraora's storm in the Power Plant, Ogerpon's Tera Raid and masks, and
 * Primal Dialga. A table per language (`pt` is the reference); each
 * language's file spreads its parts where they belong. Pokémon, move and item
 * names (the masks) stay in English.
 */

type Fork = { readonly fork: readonly [{ readonly name: string; readonly desc: string }, { readonly name: string; readonly desc: string }] }
type MoveText = { readonly description: string; readonly upgrades: readonly [string, string, Fork, string] }

const pt = {
  moves: {
    powerGem: {
      description: 'Gemas de luz giram num redemoinho ao redor de Diancie e disparam para todos os lados. Cada lançamento endurece a guarda: +1 de defesa por alguns segundos (+2 na Mega Diancie, que lança uma segunda espiral).',
      upgrades: [
        '+8 de dano',
        '+2 diamantes',
        { fork: [{ name: 'Tempestade', desc: '+4 diamantes; -2 de dano' }, { name: 'Lapidado', desc: 'A defesa dura +2 s; +6 de dano' }] },
        'Recarga 0.4s mais rápida e +8 de dano',
      ],
    },
    plasmaFists: {
      description: 'Zeraora salta de multidão em multidão: um soco de plasma cai em cada uma, um depois do outro, e o plasma explode em volta de cada golpe. Pode paralisar. Os socos da Mega Zeraora acertam duas vezes.',
      upgrades: [
        '+10 de dano',
        '+1 soco',
        { fork: [{ name: 'Rajada', desc: '+2 socos; -4 de dano' }, { name: 'Ion Deluge', desc: '+12 de dano e mais chance de paralisar' }] },
        'Recarga 0.4s mais rápida e +10 de dano',
      ],
    },
    ivyCudgel: {
      description: 'Ogerpon gira o porrete e o desce à frente: um arco e um impacto onde cai, do tipo da máscara (Grass, Water, Fire ou Rock). Terastalizado, o impacto explode no elemento da máscara ao redor.',
      upgrades: [
        '+14 de dano',
        '+15% de área',
        { fork: [{ name: 'Porrete gigante', desc: '+25% de área' }, { name: 'Golpe certeiro', desc: '+18 de dano' }] },
        'Recarga 0.3s mais rápida e +14 de dano',
      ],
    },
  } satisfies Record<string, MoveText>,
  blurbs: {
    diancie: 'A joia rara. Diamantes que protegem e a Mega Diancie.',
    zeraora: 'O raio em pessoa. Socos de plasma e a Mega Zeraora.',
    ogerpon: 'As quatro máscaras. O Terastal muda a máscara e o porrete.',
  },
  /** Where each mythical is caught (`LegendSource`). */
  where: {
    dig: 'O tesouro mais raro da _Escavação_ do Poké Realm: um *Pink Diamond* com Diancie dentro, enterrado só enquanto você não a tem. Precisa de conta.',
    storm: 'Às vezes, quando _chove na Usina_, uma tempestade se forma e Zeraora salta de um raio: vença-o no mapa.',
    mask: 'Às vezes a _Reide Tera_ da partida é a toca de Ogerpon, na máscara do seu tipo Tera: vença-o lá dentro.',
  },
  epithet: 'Trovão Errante',
  phases: ['*Zeraora* usa Volt Switch: ele surge em cima de você!', 'A tempestade desaba! Plasma Fists: corra para um _abrigo_.'] as readonly [string, string],
  ui: {
    dig: { found: 'Diancie saiu do diamante! Ela está no Presente do lobby.' },
    storm: {
      gathering: 'O céu escurece sobre a _Usina_… raios caem por perto!',
      fled: '*Zeraora* sumiu na tempestade…',
    },
    raid: (mask: string) => `A toca de *Ogerpon* se abriu! _${mask}_`,
    mask: (mask: string) => `Ogerpon pôs a _${mask}_!`,
    embody: (mask: string) => `*Embody Aspect!* A _${mask}_ brilha.`,
    primal: 'O tempo desmorona: *Primal Dialga*! Corra dos _círculos do futuro_.',
  },
}

const en: typeof pt = {
  moves: {
    powerGem: {
      description: 'Gems of light whirl around Diancie and shoot out on every side. Each cast hardens its guard: +1 defense for a few seconds (+2 as Mega Diancie, which throws a second spiral).',
      upgrades: [
        '+8 damage',
        '+2 diamonds',
        { fork: [{ name: 'Tempest', desc: '+4 diamonds; -2 damage' }, { name: 'Brilliant cut', desc: 'Defense lasts +2 s; +6 damage' }] },
        '0.4s faster cooldown and +8 damage',
      ],
    },
    plasmaFists: {
      description: 'Zeraora flashes from crowd to crowd: a plasma fist lands on each, one after another, and the plasma bursts around every blow. May paralyze. Mega Zeraora’s fists strike twice.',
      upgrades: [
        '+10 damage',
        '+1 fist',
        { fork: [{ name: 'Flurry', desc: '+2 fists; -4 damage' }, { name: 'Ion Deluge', desc: '+12 damage and a higher paralysis chance' }] },
        '0.4s faster cooldown and +10 damage',
      ],
    },
    ivyCudgel: {
      description: 'Ogerpon swings its cudgel and brings it down ahead: an arc, then a slam where it lands, in its mask’s type (Grass, Water, Fire or Rock). Terastallized, the slam bursts in the mask’s element all around.',
      upgrades: [
        '+14 damage',
        '+15% area',
        { fork: [{ name: 'Giant cudgel', desc: '+25% area' }, { name: 'Clean hit', desc: '+18 damage' }] },
        '0.3s faster cooldown and +14 damage',
      ],
    },
  },
  blurbs: {
    diancie: 'The rare jewel. Guarding diamonds and Mega Diancie.',
    zeraora: 'Lightning itself. Plasma fists and Mega Zeraora.',
    ogerpon: 'The four masks. Terastal changes the mask and the cudgel.',
  },
  where: {
    dig: 'The Poké Realm _Mine Dig_’s rarest treasure: a *Pink Diamond* with Diancie inside, buried only while you don’t have it. Needs an account.',
    storm: 'Sometimes, when it _rains on the Power Plant_, a storm gathers and Zeraora leaps out of a bolt: beat it on the map.',
    mask: 'Sometimes the run’s _Tera Raid_ is Ogerpon’s den, in the mask of your Tera type: beat it inside.',
  },
  epithet: 'Wandering Thunder',
  phases: ['*Zeraora* uses Volt Switch: it lands right on you!', 'The storm breaks! Plasma Fists: run for a _shelter_.'] as readonly [string, string],
  ui: {
    dig: { found: 'Diancie came out of the diamond! It’s waiting in the lobby’s Gift.' },
    storm: {
      gathering: 'The sky darkens over the _Power Plant_… lightning strikes nearby!',
      fled: '*Zeraora* vanished into the storm…',
    },
    raid: (mask: string) => `*Ogerpon*’s den opened! _${mask}_`,
    mask: (mask: string) => `Ogerpon put on the _${mask}_!`,
    embody: (mask: string) => `*Embody Aspect!* The _${mask}_ shines.`,
    primal: 'Time collapses: *Primal Dialga*! Run from the _marks of the future_.',
  },
}

const es: typeof pt = {
  moves: {
    powerGem: {
      description: 'Gemas de luz giran en un remolino alrededor de Diancie y salen disparadas hacia todos lados. Cada lanzamiento endurece su guardia: +1 de defensa por unos segundos (+2 como Mega Diancie, que lanza una segunda espiral).',
      upgrades: [
        '+8 de daño',
        '+2 diamantes',
        { fork: [{ name: 'Tempestad', desc: '+4 diamantes; -2 de daño' }, { name: 'Tallado', desc: 'La defensa dura +2 s; +6 de daño' }] },
        'Recarga 0.4s más rápida y +8 de daño',
      ],
    },
    plasmaFists: {
      description: 'Zeraora salta de multitud en multitud: un puño de plasma cae en cada una, uno tras otro, y el plasma estalla alrededor de cada golpe. Puede paralizar. Los puños de Mega Zeraora golpean dos veces.',
      upgrades: [
        '+10 de daño',
        '+1 puño',
        { fork: [{ name: 'Ráfaga', desc: '+2 puños; -4 de daño' }, { name: 'Ion Deluge', desc: '+12 de daño y más probabilidad de paralizar' }] },
        'Recarga 0.4s más rápida y +10 de daño',
      ],
    },
    ivyCudgel: {
      description: 'Ogerpon gira su garrote y lo baja al frente: un arco y un golpe donde cae, del tipo de su máscara (Grass, Water, Fire o Rock). Teracristalizado, el golpe estalla en el elemento de la máscara alrededor.',
      upgrades: [
        '+14 de daño',
        '+15% de área',
        { fork: [{ name: 'Garrote gigante', desc: '+25% de área' }, { name: 'Golpe certero', desc: '+18 de daño' }] },
        'Recarga 0.3s más rápida y +14 de daño',
      ],
    },
  },
  blurbs: {
    diancie: 'La joya rara. Diamantes que protegen y Mega Diancie.',
    zeraora: 'El rayo en persona. Puños de plasma y Mega Zeraora.',
    ogerpon: 'Las cuatro máscaras. El Teracristal cambia la máscara y el garrote.',
  },
  where: {
    dig: 'El tesoro más raro de la _Excavación_ del Poké Realm: un *Pink Diamond* con Diancie dentro, enterrado solo mientras no la tengas. Necesita cuenta.',
    storm: 'A veces, cuando _llueve en la Central_, se forma una tormenta y Zeraora salta de un rayo: véncelo en el mapa.',
    mask: 'A veces la _Incursión Tera_ de la partida es la guarida de Ogerpon, con la máscara de tu tipo Tera: véncelo adentro.',
  },
  epithet: 'Trueno Errante',
  phases: ['*Zeraora* usa Volt Switch: ¡aparece encima de ti!', '¡Estalla la tormenta! Plasma Fists: corre a un _refugio_.'] as readonly [string, string],
  ui: {
    dig: { found: '¡Diancie salió del diamante! Te espera en el Regalo del lobby.' },
    storm: {
      gathering: 'El cielo se oscurece sobre la _Central_… ¡caen rayos cerca!',
      fled: '*Zeraora* desapareció en la tormenta…',
    },
    raid: (mask: string) => `¡Se abrió la guarida de *Ogerpon*! _${mask}_`,
    mask: (mask: string) => `¡Ogerpon se puso la _${mask}_!`,
    embody: (mask: string) => `*¡Embody Aspect!* La _${mask}_ brilla.`,
    primal: 'El tiempo se derrumba: ¡*Primal Dialga*! Huye de las _marcas del futuro_.',
  },
}

const fr: typeof pt = {
  moves: {
    powerGem: {
      description: 'Des gemmes de lumière tourbillonnent autour de Diancie et jaillissent de tous côtés. Chaque lancer durcit sa garde : +1 de défense pendant quelques secondes (+2 en Méga Diancie, qui lance une seconde spirale).',
      upgrades: [
        '+8 de dégâts',
        '+2 diamants',
        { fork: [{ name: 'Tempête', desc: '+4 diamants ; -2 de dégâts' }, { name: 'Taille brillant', desc: 'La défense dure +2 s ; +6 de dégâts' }] },
        'Recharge 0.4s plus rapide et +8 de dégâts',
      ],
    },
    plasmaFists: {
      description: 'Zeraora bondit de foule en foule : un poing de plasma s’abat sur chacune, l’une après l’autre, et le plasma éclate autour de chaque coup. Peut paralyser. Les poings de Méga Zeraora frappent deux fois.',
      upgrades: [
        '+10 de dégâts',
        '+1 poing',
        { fork: [{ name: 'Rafale', desc: '+2 poings ; -4 de dégâts' }, { name: 'Ion Deluge', desc: '+12 de dégâts et plus de chances de paralyser' }] },
        'Recharge 0.4s plus rapide et +10 de dégâts',
      ],
    },
    ivyCudgel: {
      description: 'Ogerpon fait tournoyer son gourdin et l’abat devant lui : un arc, puis un impact là où il tombe, du type de son masque (Grass, Water, Fire ou Rock). Téracristallisé, l’impact éclate tout autour dans l’élément du masque.',
      upgrades: [
        '+14 de dégâts',
        '+15 % de zone',
        { fork: [{ name: 'Gourdin géant', desc: '+25 % de zone' }, { name: 'Coup net', desc: '+18 de dégâts' }] },
        'Recharge 0.3s plus rapide et +14 de dégâts',
      ],
    },
  },
  blurbs: {
    diancie: 'Le joyau rare. Des diamants protecteurs et Méga Diancie.',
    zeraora: 'La foudre incarnée. Poings de plasma et Méga Zeraora.',
    ogerpon: 'Les quatre masques. La Téracristallisation change le masque et le gourdin.',
  },
  where: {
    dig: 'Le trésor le plus rare de l’_Excavation_ du Poké Realm : un *Pink Diamond* avec Diancie dedans, enfoui seulement tant que vous ne l’avez pas. Compte requis.',
    storm: 'Parfois, quand _il pleut sur la Centrale_, un orage se forme et Zeraora bondit d’un éclair : battez-le sur la carte.',
    mask: 'Parfois, le _Raid Téracristal_ de la partie est l’antre d’Ogerpon, avec le masque de votre type Téra : battez-le à l’intérieur.',
  },
  epithet: 'Tonnerre Errant',
  phases: ['*Zeraora* utilise Volt Switch : il surgit sur vous !', 'L’orage éclate ! Plasma Fists : courez vers un _abri_.'] as readonly [string, string],
  ui: {
    dig: { found: 'Diancie est sortie du diamant ! Elle vous attend dans le Cadeau du lobby.' },
    storm: {
      gathering: 'Le ciel s’assombrit sur la _Centrale_… la foudre tombe tout près !',
      fled: '*Zeraora* a disparu dans l’orage…',
    },
    raid: (mask: string) => `L’antre d’*Ogerpon* s’est ouvert ! _${mask}_`,
    mask: (mask: string) => `Ogerpon a mis le _${mask}_ !`,
    embody: (mask: string) => `*Embody Aspect !* Le _${mask}_ brille.`,
    primal: 'Le temps s’effondre : *Primal Dialga* ! Fuyez les _marques du futur_.',
  },
}

const zh: typeof pt = {
  moves: {
    powerGem: {
      description: '光之寶石在Diancie身邊捲成旋渦，再往四面八方射出。每次施放都會強化防守：數秒內防禦+1（Mega Diancie為+2，並再甩出一道反向螺旋）。',
      upgrades: [
        '傷害+8',
        '鑽石+2',
        { fork: [{ name: '風暴', desc: '鑽石+4；傷害-2' }, { name: '明亮式切工', desc: '防禦多持續2秒；傷害+6' }] },
        '冷卻快0.4秒，傷害+8',
      ],
    },
    plasmaFists: {
      description: 'Zeraora在敵群之間閃動：一記等離子拳接連落在每一群上，等離子在每次打擊周圍爆開。可能造成麻痺。Mega Zeraora的拳會打兩下。',
      upgrades: [
        '傷害+10',
        '拳+1',
        { fork: [{ name: '連擊', desc: '拳+2；傷害-4' }, { name: 'Ion Deluge', desc: '傷害+12，麻痺機率提高' }] },
        '冷卻快0.4秒，傷害+10',
      ],
    },
    ivyCudgel: {
      description: 'Ogerpon揮動棍棒往前砸下：先劃出一道弧，再在落點重擊，屬性跟著面具（Grass、Water、Fire或Rock）。太晶化時，重擊會以面具的元素向四周爆開。',
      upgrades: [
        '傷害+14',
        '範圍+15%',
        { fork: [{ name: '巨型棍棒', desc: '範圍+25%' }, { name: '精準一擊', desc: '傷害+18' }] },
        '冷卻快0.3秒，傷害+14',
      ],
    },
  },
  blurbs: {
    diancie: '稀有的寶石。守護的鑽石與Mega Diancie。',
    zeraora: '化身為雷。等離子拳與Mega Zeraora。',
    ogerpon: '四張面具。太晶化會改變面具與棍棒。',
  },
  where: {
    dig: 'Poké Realm _礦坑挖掘_ 最稀有的寶物：裡面藏著Diancie的 *Pink Diamond*，只在你還沒有它時才會埋著。需要帳號。',
    storm: '有時 _發電廠下雨_ 時會形成雷暴，Zeraora從閃電中躍出：在地圖上打倒它。',
    mask: '有時這局的 _太晶團體戰_ 是Ogerpon的巢穴，戴著你的太晶屬性的面具：在裡面打倒它。',
  },
  epithet: '流浪的雷霆',
  phases: ['*Zeraora* 使出Volt Switch：它直接出現在你身上！', '雷暴降臨！Plasma Fists：快跑到 _避難處_。'] as readonly [string, string],
  ui: {
    dig: { found: 'Diancie從鑽石裡出來了！它在大廳的禮物裡等你。' },
    storm: {
      gathering: '_發電廠_ 上空暗了下來……閃電就落在附近！',
      fled: '*Zeraora* 消失在雷暴之中……',
    },
    raid: (mask: string) => `*Ogerpon* 的巢穴打開了！_${mask}_`,
    mask: (mask: string) => `Ogerpon戴上了 _${mask}_！`,
    embody: (mask: string) => `*Embody Aspect！* _${mask}_ 閃閃發光。`,
    primal: '時間崩塌：*Primal Dialga*！快躲開 _未來的印記_。',
  },
}

export const MYTHICAL_WORDS = { pt, en, es, fr, zh } as const
