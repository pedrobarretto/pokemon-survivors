import type { MegaId } from '../data/megas'
import type { SpecialId } from '../game/special'

/**
 * The Grande Atualização's Megas on lines already playable (`data/megas.ts`, from Mewtwo X to
 * Zygarde): what each form does and its special's description, spread into every language's
 * `mega.effects` and `specials`.
 */
type GaMegaId = Extract<MegaId, 'mewtwoX' | 'heracross' | 'abomasnow' | 'froslass' | 'scrafty' | 'chandelure' | 'golurk' | 'malamar' | 'golisopod' | 'baxcalibur' | 'absolZ' | 'tatsugiri' | 'zygarde'>
type GaMegaSpecial = Extract<SpecialId, 'psychoCut' | 'megahorn' | 'avalanche' | 'icyWind' | 'highJumpKick' | 'inferno' | 'shadowPunch' | 'foulPlay' | 'firstImpression' | 'glaiveRush' | 'kowtowCleave' | 'chillingWater' | 'thousandArrows'>

type Words = { megas: Record<GaMegaId, string>; specials: Record<GaMegaSpecial, string> }

const pt: Words = {
  megas: {
    mewtwoX: 'cada golpe recebido dá velocidade +8 e golpes +6% por 4 s (até 3 vezes); golpes +40%, golpes Lutador +30%, velocidade +8 e defesa +1. O especial vira Psycho Cut, uma investida em cadeia que solta um anel de lâminas psíquicas a cada pouso.',
    heracross: '+1 projétil por golpe e golpes fracos +40% (todo golpe múltiplo acerta inteiro); golpes +30% e defesa +2. O especial vira Megahorn: dezesseis chifradas caem nos inimigos mais próximos.',
    abomasnow: 'traz a neve (fora das fendas), que desgasta a horda e não o Abomasnow, e gelo e água no chão não o atrasam; HP +60, defesa +2, golpes +20% e golpes Gelo e Planta +20%. O especial vira Avalanche.',
    froslass: 'traz a neve (fora das fendas), que desgasta a horda e não a Froslass, e inimigos a até 64 px podem congelar; velocidade +12, golpes +25% e golpes Gelo e Fantasma +20%. O especial vira Icy Wind, um rastro que congela.',
    scrafty: 'inimigos a até 80 px batem 30% mais fraco e quem encosta causa 30% menos dano; HP +40, defesa +2, golpes +25% e golpes Lutador e Sombrio +20%. O especial vira High Jump Kick.',
    chandelure: 'atravessa escudos de aliados (Bronzong) e inimigos a até 80 px podem queimar; golpes +30%, queimaduras e venenos 30% mais fortes e área +10%. O especial vira Inferno, que sempre queima.',
    golurk: 'golpes de soco +40% e todos os golpes atravessam escudos de aliados (Bronzong); HP +50, defesa +2 e golpes +25%. O especial vira Shadow Punch: oito punhos sombrios caem nos inimigos mais próximos.',
    malamar: 'cada golpe recebido dá golpes +4% até o fim da forma (até +40%) e inimigos a até 72 px podem ficar confusos; golpes +15%, recargas −10%, +8% de chance de condição e HP +30. O especial vira Foul Play.',
    golisopod: 'golpes +35%, defesa +3 e golpes Inseto e Aço +25%. O especial vira First Impression, uma investida em cadeia que solta um anel de ferrões a cada pouso.',
    baxcalibur: 'recebe metade do dano de ataques de Fogo e a lava não o fere; golpes +35%, HP +40 e golpes Dragão e Gelo +20%. O especial vira Glaive Rush.',
    absolZ: 'golpes cortantes e suas evoluções +50%; golpes +25%, velocidade +12 e recargas −8%. O especial vira Kowtow Cleave.',
    tatsugiri: 'Mega Evoluir chama o Dondozo na hora (se ele não acabou de ir embora); golpes +25%, recargas −12% e golpes Dragão e Água +20%. O especial vira Chilling Water.',
    zygarde: 'só a partir da Forma Completa. Recebe metade do dano de ataques Sombrios e de Fada e acerta chefes e elites 20% mais forte; HP +50, golpes +30% e defesa +2. O especial vira Thousand Arrows.',
  },
  specials: {
    psychoCut: 'Investida em cadeia de até 6 saltos; cada pouso solta um anel de lâminas psíquicas.',
    megahorn: 'Dezesseis chifradas caem nos inimigos mais próximos.',
    avalanche: 'Muralha de neve enorme que avança na direção em que você anda e desacelera.',
    icyWind: 'Você corre um pouco mais rápido e deixa um rastro de vento gelado que pode congelar.',
    highJumpKick: 'Duas ondas de choque enormes ao redor do pouso, que enfraquecem os inimigos.',
    inferno: 'Chuva de chamas ao seu redor que sempre queima.',
    shadowPunch: 'Oito punhos sombrios e pesados caem nos inimigos mais próximos.',
    foulPlay: 'Muralha sombria que avança na direção em que você anda e pode confundir.',
    firstImpression: 'Investida em cadeia de até 6 saltos; cada pouso solta um anel de ferrões.',
    glaiveRush: 'Muralha de lâminas dracônicas que avança na direção em que você anda.',
    kowtowCleave: 'Anel de 20 lâminas sombrias disparadas para todos os lados.',
    chillingWater: 'Anel de 22 jatos de água gelada que podem enfraquecer os inimigos.',
    thousandArrows: 'Chuva pesada de flechas de terra ao seu redor, que desaceleram.',
  },
}

const en: Words = {
  megas: {
    mewtwoX: 'each hit taken gives speed +8 and moves +6% for 4 s (up to 3 times); moves +40%, Fighting moves +30%, speed +8 and armor +1. The special becomes Psycho Cut, a chain dash that sends out a ring of psychic blades at every landing.',
    heracross: '+1 projectile per move and weak moves +40% (every multi-hit lands in full); moves +30% and armor +2. The special becomes Megahorn: sixteen horn strikes crash down on the nearest foes.',
    abomasnow: "brings the snow (outside rifts), which wears the horde down and not Abomasnow, and ice and water underfoot don't slow it; HP +60, armor +2, moves +20% and Ice and Grass moves +20%. The special becomes Avalanche.",
    froslass: 'brings the snow (outside rifts), which wears the horde down and not Froslass, and foes within 64 px may freeze; speed +12, moves +25% and Ice and Ghost moves +20%. The special becomes Icy Wind, a freezing trail.',
    scrafty: 'foes within 80 px hit 30% weaker and bodies that touch it deal 30% less; HP +40, armor +2, moves +25% and Fighting and Dark moves +20%. The special becomes High Jump Kick.',
    chandelure: 'goes through allies’ wards (Bronzong) and foes within 80 px may burn; moves +30%, burns and poisons 30% stronger and area +10%. The special becomes Inferno, which always burns.',
    golurk: 'punching moves +40% and every move goes through allies’ wards (Bronzong); HP +50, armor +2 and moves +25%. The special becomes Shadow Punch: eight shadow fists crash down on the nearest foes.',
    malamar: 'each hit taken gives moves +4% until the form ends (up to +40%) and foes within 72 px may get confused; moves +15%, cooldowns −10%, +8% status chance and HP +30. The special becomes Foul Play.',
    golisopod: 'moves +35%, armor +3 and Bug and Steel moves +25%. The special becomes First Impression, a chain dash that sends out a ring of stingers at every landing.',
    baxcalibur: "takes half damage from Fire attacks and lava doesn't hurt it; moves +35%, HP +40 and Dragon and Ice moves +20%. The special becomes Glaive Rush.",
    absolZ: 'slicing moves and their evolutions +50%; moves +25%, speed +12 and cooldowns −8%. The special becomes Kowtow Cleave.',
    tatsugiri: 'Mega Evolving calls Dondozo at once (unless it just left); moves +25%, cooldowns −12% and Dragon and Water moves +20%. The special becomes Chilling Water.',
    zygarde: 'from the Complete Forme only. Takes half damage from Dark and Fairy attacks and hits bosses and elites 20% harder; HP +50, moves +30% and armor +2. The special becomes Thousand Arrows.',
  },
  specials: {
    psychoCut: 'A chain dash of up to 6 jumps; every landing sends out a ring of psychic blades.',
    megahorn: 'Sixteen horn strikes crash down on the nearest foes.',
    avalanche: 'A huge wall of snow that sweeps the way you walk and slows.',
    icyWind: 'You run a little faster and leave a trail of icy wind that may freeze.',
    highJumpKick: 'Two huge shock waves around where you land, which weaken foes.',
    inferno: 'A rain of flames around you that always burns.',
    shadowPunch: 'Eight heavy shadow fists crash down on the nearest foes.',
    foulPlay: 'A dark wall that sweeps the way you walk and may confuse.',
    firstImpression: 'A chain dash of up to 6 jumps; every landing sends out a ring of stingers.',
    glaiveRush: 'A wall of draconic blades that sweeps the way you walk.',
    kowtowCleave: 'A ring of 20 dark blades fired all around.',
    chillingWater: 'A ring of 22 jets of chilling water that may weaken foes.',
    thousandArrows: 'A heavy rain of earthen arrows around you that slows.',
  },
}

const es: Words = {
  megas: {
    mewtwoX: 'cada golpe recibido da velocidad +8 y movimientos +6% por 4 s (hasta 3 veces); movimientos +40%, movimientos Lucha +30%, velocidad +8 y defensa +1. El especial pasa a ser Psycho Cut, una embestida en cadena que suelta un anillo de cuchillas psíquicas en cada aterrizaje.',
    heracross: '+1 proyectil por movimiento y movimientos débiles +40% (todo golpe múltiple acierta entero); movimientos +30% y defensa +2. El especial pasa a ser Megahorn: dieciséis cornadas caen sobre los enemigos más cercanos.',
    abomasnow: 'trae la nieve (fuera de las grietas), que desgasta a la horda y no a Abomasnow, y el hielo y el agua en el suelo no lo frenan; HP +60, defensa +2, movimientos +20% y movimientos Hielo y Planta +20%. El especial pasa a ser Avalanche.',
    froslass: 'trae la nieve (fuera de las grietas), que desgasta a la horda y no a Froslass, y los enemigos a hasta 64 px pueden congelarse; velocidad +12, movimientos +25% y movimientos Hielo y Fantasma +20%. El especial pasa a ser Icy Wind, un rastro que congela.',
    scrafty: 'los enemigos a hasta 80 px pegan 30% más débil y quien lo toca causa 30% menos daño; HP +40, defensa +2, movimientos +25% y movimientos Lucha y Siniestro +20%. El especial pasa a ser High Jump Kick.',
    chandelure: 'atraviesa los escudos de aliados (Bronzong) y los enemigos a hasta 80 px pueden quemarse; movimientos +30%, quemaduras y venenos 30% más fuertes y área +10%. El especial pasa a ser Inferno, que siempre quema.',
    golurk: 'movimientos de puño +40% y todos los movimientos atraviesan los escudos de aliados (Bronzong); HP +50, defensa +2 y movimientos +25%. El especial pasa a ser Shadow Punch: ocho puños sombríos caen sobre los enemigos más cercanos.',
    malamar: 'cada golpe recibido da movimientos +4% hasta el fin de la forma (hasta +40%) y los enemigos a hasta 72 px pueden confundirse; movimientos +15%, recargas −10%, +8% de probabilidad de estado y HP +30. El especial pasa a ser Foul Play.',
    golisopod: 'movimientos +35%, defensa +3 y movimientos Bicho y Acero +25%. El especial pasa a ser First Impression, una embestida en cadena que suelta un anillo de aguijones en cada aterrizaje.',
    baxcalibur: 'recibe la mitad del daño de ataques de Fuego y la lava no lo hiere; movimientos +35%, HP +40 y movimientos Dragón y Hielo +20%. El especial pasa a ser Glaive Rush.',
    absolZ: 'movimientos cortantes y sus evoluciones +50%; movimientos +25%, velocidad +12 y recargas −8%. El especial pasa a ser Kowtow Cleave.',
    tatsugiri: 'Megaevolucionar llama a Dondozo al instante (si no acaba de irse); movimientos +25%, recargas −12% y movimientos Dragón y Agua +20%. El especial pasa a ser Chilling Water.',
    zygarde: 'solo desde la Forma Completa. Recibe la mitad del daño de ataques Siniestros y Hada y golpea a jefes y élites 20% más fuerte; HP +50, movimientos +30% y defensa +2. El especial pasa a ser Thousand Arrows.',
  },
  specials: {
    psychoCut: 'Embestida en cadena de hasta 6 saltos; cada aterrizaje suelta un anillo de cuchillas psíquicas.',
    megahorn: 'Dieciséis cornadas caen sobre los enemigos más cercanos.',
    avalanche: 'Muralla de nieve enorme que avanza hacia donde caminas y ralentiza.',
    icyWind: 'Corres un poco más rápido y dejas un rastro de viento helado que puede congelar.',
    highJumpKick: 'Dos ondas de choque enormes alrededor del aterrizaje, que debilitan a los enemigos.',
    inferno: 'Lluvia de llamas a tu alrededor que siempre quema.',
    shadowPunch: 'Ocho puños sombríos y pesados caen sobre los enemigos más cercanos.',
    foulPlay: 'Muralla sombría que avanza hacia donde caminas y puede confundir.',
    firstImpression: 'Embestida en cadena de hasta 6 saltos; cada aterrizaje suelta un anillo de aguijones.',
    glaiveRush: 'Muralla de cuchillas dracónicas que avanza hacia donde caminas.',
    kowtowCleave: 'Anillo de 20 cuchillas sombrías disparadas en todas direcciones.',
    chillingWater: 'Anillo de 22 chorros de agua helada que pueden debilitar a los enemigos.',
    thousandArrows: 'Lluvia pesada de flechas de tierra a tu alrededor, que ralentizan.',
  },
}

const fr: Words = {
  megas: {
    mewtwoX: 'chaque coup reçu donne vitesse +8 et capacités +6 % pendant 4 s (jusqu’à 3 fois) ; capacités +40 %, capacités Combat +30 %, vitesse +8 et armure +1. L’attaque spéciale devient Psycho Cut, une charge en chaîne qui lâche un anneau de lames psychiques à chaque atterrissage.',
    heracross: '+1 projectile par capacité et capacités faibles +40 % (chaque coup multiple touche en entier) ; capacités +30 % et armure +2. L’attaque spéciale devient Megahorn : seize coups de corne s’abattent sur les ennemis les plus proches.',
    abomasnow: 'amène la neige (hors des failles), qui use la horde et pas Abomasnow, et la glace et l’eau au sol ne le ralentissent pas ; PV +60, armure +2, capacités +20 % et capacités Glace et Plante +20 %. L’attaque spéciale devient Avalanche.',
    froslass: 'amène la neige (hors des failles), qui use la horde et pas Froslass, et les ennemis à moins de 64 px peuvent geler ; vitesse +12, capacités +25 % et capacités Glace et Spectre +20 %. L’attaque spéciale devient Icy Wind, une traînée qui gèle.',
    scrafty: 'les ennemis à moins de 80 px frappent 30 % moins fort et ceux qui le touchent infligent 30 % de moins ; PV +40, armure +2, capacités +25 % et capacités Combat et Ténèbres +20 %. L’attaque spéciale devient High Jump Kick.',
    chandelure: 'traverse les boucliers des alliés (Bronzong) et les ennemis à moins de 80 px peuvent brûler ; capacités +30 %, brûlures et poisons 30 % plus forts et zone +10 %. L’attaque spéciale devient Inferno, qui brûle toujours.',
    golurk: 'capacités de poing +40 % et toutes les capacités traversent les boucliers des alliés (Bronzong) ; PV +50, armure +2 et capacités +25 %. L’attaque spéciale devient Shadow Punch : huit poings d’ombre s’abattent sur les ennemis les plus proches.',
    malamar: 'chaque coup reçu donne capacités +4 % jusqu’à la fin de la forme (jusqu’à +40 %) et les ennemis à moins de 72 px peuvent être confus ; capacités +15 %, recharges −10 %, +8 % de chance d’altération et PV +30. L’attaque spéciale devient Foul Play.',
    golisopod: 'capacités +35 %, armure +3 et capacités Insecte et Acier +25 %. L’attaque spéciale devient First Impression, une charge en chaîne qui lâche un anneau de dards à chaque atterrissage.',
    baxcalibur: 'subit moitié moins de dégâts des attaques Feu et la lave ne le blesse pas ; capacités +35 %, PV +40 et capacités Dragon et Glace +20 %. L’attaque spéciale devient Glaive Rush.',
    absolZ: 'capacités tranchantes et leurs évolutions +50 % ; capacités +25 %, vitesse +12 et recharges −8 %. L’attaque spéciale devient Kowtow Cleave.',
    tatsugiri: 'Méga-évoluer appelle Dondozo aussitôt (sauf s’il vient de partir) ; capacités +25 %, recharges −12 % et capacités Dragon et Eau +20 %. L’attaque spéciale devient Chilling Water.',
    zygarde: 'seulement depuis la Forme Parfaite. Subit moitié moins de dégâts des attaques Ténèbres et Fée et frappe les boss et les élites 20 % plus fort ; PV +50, capacités +30 % et armure +2. L’attaque spéciale devient Thousand Arrows.',
  },
  specials: {
    psychoCut: 'Une charge en chaîne de 6 sauts au plus ; chaque atterrissage lâche un anneau de lames psychiques.',
    megahorn: 'Seize coups de corne s’abattent sur les ennemis les plus proches.',
    avalanche: 'Un énorme mur de neige qui avance là où tu marches et ralentit.',
    icyWind: 'Tu cours un peu plus vite et laisses une traînée de vent glacé qui peut geler.',
    highJumpKick: 'Deux énormes ondes de choc autour de l’atterrissage, qui affaiblissent les ennemis.',
    inferno: 'Une pluie de flammes autour de toi qui brûle toujours.',
    shadowPunch: 'Huit lourds poings d’ombre s’abattent sur les ennemis les plus proches.',
    foulPlay: 'Un mur ténébreux qui avance là où tu marches et peut rendre confus.',
    firstImpression: 'Une charge en chaîne de 6 sauts au plus ; chaque atterrissage lâche un anneau de dards.',
    glaiveRush: 'Un mur de lames draconiques qui avance là où tu marches.',
    kowtowCleave: 'Un anneau de 20 lames ténébreuses tirées dans toutes les directions.',
    chillingWater: 'Un anneau de 22 jets d’eau glacée qui peuvent affaiblir les ennemis.',
    thousandArrows: 'Une lourde pluie de flèches de terre autour de toi, qui ralentissent.',
  },
}

const zh: Words = {
  megas: {
    mewtwoX: '每次受到攻擊，速度+8、招式+6%，持續4秒（最多3層）；招式+40%、格鬥屬性招式+30%、速度+8、護甲+1。必殺技變為 Psycho Cut，每次落地放出一圈念力刀刃的連鎖突進。',
    heracross: '每個招式多1發投射物，弱招式+40%（多段攻擊必定全中）；招式+30%、護甲+2。必殺技變為 Megahorn：十六記角擊砸向最近的敵人。',
    abomasnow: '帶來降雪（裂縫外），削弱獸群但不傷 Abomasnow，地上的冰與水也不會拖慢牠；HP+60、護甲+2、招式+20%、冰與草屬性招式+20%。必殺技變為 Avalanche。',
    froslass: '帶來降雪（裂縫外），削弱獸群但不傷 Froslass，64 px 內的敵人可能凍結；速度+12、招式+25%、冰與幽靈屬性招式+20%。必殺技變為 Icy Wind，一道會凍結的軌跡。',
    scrafty: '80 px 內的敵人攻擊力下降30%，碰觸牠的敵人傷害減少30%；HP+40、護甲+2、招式+25%、格鬥與惡屬性招式+20%。必殺技變為 High Jump Kick。',
    chandelure: '穿透同伴的護盾（Bronzong），80 px 內的敵人可能灼傷；招式+30%、灼傷與中毒強化30%、範圍+10%。必殺技變為 Inferno，必定灼傷。',
    golurk: '拳類招式+40%，所有招式穿透同伴的護盾（Bronzong）；HP+50、護甲+2、招式+25%。必殺技變為 Shadow Punch：八記暗影拳砸向最近的敵人。',
    malamar: '每次受到攻擊，招式+4%直到形態結束（最多+40%），72 px 內的敵人可能混亂；招式+15%、冷卻−10%、異常狀態機率+8%、HP+30。必殺技變為 Foul Play。',
    golisopod: '招式+35%、護甲+3、蟲與鋼屬性招式+25%。必殺技變為 First Impression，每次落地放出一圈毒針的連鎖突進。',
    baxcalibur: '受到火屬性攻擊的傷害減半，岩漿也傷不了牠；招式+35%、HP+40、龍與冰屬性招式+20%。必殺技變為 Glaive Rush。',
    absolZ: '切割類招式及其進化+50%；招式+25%、速度+12、冷卻−8%。必殺技變為 Kowtow Cleave。',
    tatsugiri: 'Mega 進化時立刻呼喚 Dondozo（除非牠剛離開）；招式+25%、冷卻−12%、龍與水屬性招式+20%。必殺技變為 Chilling Water。',
    zygarde: '僅限完全形態。受到惡與妖精屬性攻擊的傷害減半，對首領與精英的傷害+20%；HP+50、招式+30%、護甲+2。必殺技變為 Thousand Arrows。',
  },
  specials: {
    psychoCut: '最多6次跳躍的連鎖突進；每次落地放出一圈念力刀刃。',
    megahorn: '十六記角擊砸向最近的敵人。',
    avalanche: '一道巨大的雪牆朝你行走的方向推進，並使敵人減速。',
    icyWind: '你跑得稍快，並留下一道可能凍結敵人的寒風軌跡。',
    highJumpKick: '落地處周圍兩道巨大的衝擊波，會削弱敵人。',
    inferno: '你周圍降下必定灼傷的火焰雨。',
    shadowPunch: '八記沉重的暗影拳砸向最近的敵人。',
    foulPlay: '一道暗影之牆朝你行走的方向推進，可能使敵人混亂。',
    firstImpression: '最多6次跳躍的連鎖突進；每次落地放出一圈毒針。',
    glaiveRush: '一道龍之刀刃牆朝你行走的方向推進。',
    kowtowCleave: '向四面八方射出一圈共20道暗影刀刃。',
    chillingWater: '一圈共22道冰冷水柱，可能削弱敵人。',
    thousandArrows: '你周圍降下沉重的大地之箭雨，使敵人減速。',
  },
}

export const GA_MEGAS_WORDS = { pt, en, es, fr, zh } as const
