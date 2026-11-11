import { line2, line3, type HatchlingDef } from './playableLines'

/**
 * The regional forms' families: lines whose every stage is a regional form
 * (Alolan Vulpix, Galarian Zigzagoon…), plus Mime Jr., whose evolution is
 * Galarian Mr. Mime. Each is a species of its own
 * under PokeAPI's id for the form (`data/regionalForms.ts`), hatches only from
 * its region's Ovo de Viagem (`egg` is the region, `game/travel.ts`) and
 * plays its own way: its moves live in `game/regionalMoves.ts`, its words in
 * `i18n/regional.ts`. The regional evolutions of lines that were already
 * playable (Alolan Raichu, Hisuian Typhlosion…) are branches.
 */
export const REGIONAL_FAMILIES = {
  /* ---------- Alola ---------- */
  vulpixAlola: {
    name: 'Alolan Vulpix', color: '#a8d8f0', egg: 'alola', stats: { area: 0.06, maxHp: -5 }, signature: 'auroraVeil',
    learnset: [['auroraVeil', 'powderSnow', 'sheerCold', 'psyshock'], ['moonblast', 'iceShard', 'roost', 'futureSight', 'disarmingVoice']],
    line: line2(['Alolan Vulpix', 10103, ['ice']], ['Alolan Ninetales', 10104, ['ice', 'fairy']], { maxHp: 45, might: 0.22, area: 0.1, statusDamage: 0.1 }),
  },
  sandshrewAlola: {
    name: 'Alolan Sandshrew', color: '#b8d0e8', egg: 'alola', stats: { armor: 1, speed: -2 }, signature: 'iceBall',
    learnset: [['iceBall', 'rapidSpin', 'heavySlam', 'iceShard'], ['xScissor', 'suckerPunch', 'sheerCold', 'gyroBall', 'pinMissile']],
    line: line2(['Alolan Sandshrew', 10101, ['ice', 'steel']], ['Alolan Sandslash', 10102, ['ice', 'steel']], { maxHp: 50, armor: 1, might: 0.22 }),
  },
  diglettAlola: {
    name: 'Alolan Diglett', color: '#e8c858', egg: 'alola', stats: { speed: 5, maxHp: -10 }, signature: 'metalClaw',
    learnset: [['metalClaw', 'earthquake', 'quickAttack', 'stealthRock'], ['gigatonHammer', 'flashCannon', 'rockTomb', 'suckerPunch', 'crunch']],
    line: line2(['Alolan Diglett', 10105, ['ground', 'steel']], ['Alolan Dugtrio', 10106, ['ground', 'steel']], { maxHp: 40, speed: 4, might: 0.24 }),
  },
  geodudeAlola: {
    name: 'Alolan Geodude', color: '#a0a090', egg: 'alola', stats: { maxHp: 15, speed: -4 }, signature: 'rockBlast',
    learnset: [['rockBlast', 'electroBall', 'selfDestruct', 'rockTomb'], ['thunder', 'accelerock', 'stealthRock'], ['shockWave', 'earthquake', 'electroweb']],
    line: line3(['Alolan Geodude', 10109, ['rock', 'electric']], ['Alolan Graveler', 10110, ['rock', 'electric']], ['Alolan Golem', 10111, ['rock', 'electric']], [
      { maxHp: 25, armor: 1, might: 0.1 },
      { maxHp: 45, armor: 1, might: 0.24 },
    ]),
  },
  grimerAlola: {
    name: 'Alolan Grimer', color: '#68c048', egg: 'alola', stats: { maxHp: 15, speed: -3, statusDamage: 0.08 }, signature: 'corrosiveGas',
    learnset: [['corrosiveGas', 'venoshock', 'suckerPunch', 'bite'], ['sludgeBomb', 'toxicSpikes', 'fireFang', 'firePunch', 'electroBall']],
    line: line2(['Alolan Grimer', 10112, ['poison', 'dark']], ['Alolan Muk', 10113, ['poison', 'dark']], { maxHp: 60, regen: 0.3, might: 0.2 }),
  },

  /* ---------- Galar ---------- */
  meowthGalar: {
    name: 'Galarian Meowth', color: '#a89070', egg: 'galar', stats: { might: 0.06, speed: -2 }, signature: 'metalClaw',
    learnset: [['metalClaw', 'quickAttack', 'crunch', 'uTurn'], ['flashCannon', 'gyroBall', 'swift', 'suckerPunch', 'pinMissile']],
    line: line2(['Galarian Meowth', 10161, ['steel']], ['Perrserker', 863, ['steel']], { maxHp: 50, armor: 1, might: 0.24 }),
  },
  slowpokeGalar: {
    name: 'Galarian Slowpoke', color: '#f0a8c0', egg: 'galar', stats: { maxHp: 20, speed: -5, regen: 0.2 }, signature: 'shellSideArm',
    learnset: [['shellSideArm', 'psyshock', 'waterPulse', 'disarmingVoice'], ['futureSight', 'sludgeBomb', 'venoshock', 'whirlpool', 'toxicSpikes']],
    line: line2(['Galarian Slowpoke', 10164, ['psychic']], ['Galarian Slowbro', 10165, ['poison', 'psychic']], { maxHp: 60, armor: 1, might: 0.2 }),
  },
  zigzagoonGalar: {
    name: 'Galarian Zigzagoon', color: '#484048', egg: 'galar', stats: { speed: 5, maxHp: -5 }, signature: 'obstruct',
    learnset: [['obstruct', 'quickAttack', 'suckerPunch', 'swift'], ['pinMissile', 'nightSlash', 'lastResort'], ['darkestLariat', 'selfDestruct', 'focusPunch']],
    line: line3(['Galarian Zigzagoon', 10174, ['dark', 'normal']], ['Galarian Linoone', 10175, ['dark', 'normal']], ['Obstagoon', 862, ['dark', 'normal']], [
      { maxHp: 25, speed: 4, might: 0.1 },
      { maxHp: 50, armor: 1, might: 0.26 },
    ]),
  },
  farfetchdGalar: {
    name: "Galarian Farfetch'd", color: '#a87848', egg: 'galar', stats: { maxHp: 30, might: 0.18, speed: 2 }, signature: 'meteorAssault',
    learnset: [['meteorAssault', 'crossChop', 'leafBlade', 'roost', 'dualWingbeat', 'machPunch', 'razorLeaf', 'vineWhip', 'drumBeating']],
    line: [{ name: "Galarian Farfetch'd", dex: 10166, types: ['fighting'], bonus: {} }],
  },
  corsolaGalar: {
    name: 'Galarian Corsola', color: '#e8e0e0', egg: 'galar', stats: { maxHp: 10, armor: 1, speed: -3 }, signature: 'perishSong',
    learnset: [['perishSong', 'hex', 'spiritShackle', 'brine'], ['shadowClaw', 'willOWisp', 'sheerCold', 'stealthRock', 'futureSight']],
    line: line2(['Galarian Corsola', 10173, ['ghost']], ['Cursola', 864, ['ghost']], { maxHp: 30, might: 0.3, area: 0.1 }),
  },
  mimeJr: {
    name: 'Mime Jr.', color: '#f0a0b8', egg: 'galar', stats: { area: 0.05, cooldown: -0.02, maxHp: -5 }, signature: 'magicCoat',
    learnset: [['magicCoat', 'psyshock', 'disarmingVoice', 'iceShard'], ['frostBreath', 'sheerCold', 'dazzlingGleam', 'shockWave', 'torchSong']],
    line: line2(['Mime Jr.', 439, ['psychic', 'fairy']], ['Galarian Mr. Mime', 10168, ['ice', 'psychic']], { maxHp: 45, speed: 4, might: 0.22, area: 0.08 }),
  },
  darumakaGalar: {
    name: 'Galarian Darumaka', color: '#f0f0f8', egg: 'galar', stats: { might: 0.08, speed: -2 }, signature: 'avalanche',
    learnset: [['avalanche', 'iceShard', 'flameWheel', 'uTurn'], ['icicleSpear', 'drumBeating', 'fireSpin', 'sheerCold', 'pyroBall']],
    line: line2(['Galarian Darumaka', 10176, ['ice']], ['Galarian Darmanitan', 10177, ['ice']], { maxHp: 50, might: 0.3, speed: -2 }),
  },

  /* ---------- Hisui ---------- */
  growlitheHisui: {
    name: 'Hisuian Growlithe', color: '#d88840', egg: 'hisui', stats: { armor: 1, might: 0.04, speed: -1 }, signature: 'headSmash',
    learnset: [['headSmash', 'flameWheel', 'ember', 'rockTomb'], ['pyroBall', 'flareBlitz', 'thunder', 'torchSong', 'shockWave']],
    line: line2(['Hisuian Growlithe', 10229, ['fire', 'rock']], ['Hisuian Arcanine', 10230, ['fire', 'rock']], { maxHp: 60, armor: 1, might: 0.24 }),
  },
  zoruaHisui: {
    name: 'Hisuian Zorua', color: '#e0e8f0', egg: 'hisui', stats: { speed: 4, might: 0.04, maxHp: -10 }, signature: 'bitterMalice',
    learnset: [['bitterMalice', 'hex', 'swift', 'spiritShackle'], ['willOWisp', 'psyshock', 'sheerCold', 'selfDestruct', 'torchSong']],
    line: line2(['Hisuian Zorua', 10238, ['normal', 'ghost']], ['Hisuian Zoroark', 10239, ['normal', 'ghost']], { maxHp: 40, might: 0.3, speed: 5 }),
  },
  voltorbHisui: {
    name: 'Hisuian Voltorb', color: '#c86848', egg: 'hisui', stats: { speed: 6, maxHp: -10 }, signature: 'chloroblast',
    learnset: [['chloroblast', 'electroBall', 'razorLeaf', 'selfDestruct'], ['vineWhip', 'shockWave', 'solarBeam', 'gyroBall', 'thunder']],
    line: line2(['Hisuian Voltorb', 10231, ['electric', 'grass']], ['Hisuian Electrode', 10232, ['electric', 'grass']], { maxHp: 45, speed: 5, might: 0.24 }),
  },
  qwilfishHisui: {
    name: 'Hisuian Qwilfish', color: '#584860', egg: 'hisui', stats: { statusChance: 0.04, maxHp: -5 }, signature: 'poisonSting',
    learnset: [['poisonSting', 'toxicSpikes', 'waterGun', 'waterShuriken'], ['venoshock', 'brine', 'sludgeBomb', 'whirlpool', 'razorShell']],
    line: line2(['Hisuian Qwilfish', 10234, ['dark', 'poison']], ['Overqwil', 904, ['dark', 'poison']], { maxHp: 55, might: 0.24, statusDamage: 0.1 }),
  },

  /* ---------- Paldea ---------- */
  wooperPaldea: {
    name: 'Paldean Wooper', color: '#887060', egg: 'paldea', stats: { maxHp: 15, speed: -3 }, signature: 'toxic',
    learnset: [['toxic', 'toxicSpikes', 'waterGun', 'venoshock'], ['earthquake', 'sludgeBomb', 'whirlpool', 'brine', 'razorShell']],
    line: line2(['Paldean Wooper', 10253, ['poison', 'ground']], ['Clodsire', 980, ['poison', 'ground']], { maxHp: 75, armor: 1, might: 0.16, regen: 0.3 }),
  },
  taurosPaldea: {
    name: 'Paldean Tauros', color: '#383030', egg: 'paldea', stats: { might: 0.08, speed: 3 }, signature: 'ragingBull',
    learnset: [['ragingBull', 'machPunch', 'focusPunch', 'thunder'], ['aquaStep', 'pyroBall', 'drumBeating', 'pinMissile', 'razorShell']],
    line: line2(['Paldean Tauros', 10250, ['fighting']], ['Paldean Tauros', 10250, ['fighting']], { maxHp: 50, might: 0.24, speed: 3 }),
  },
} as const satisfies Record<string, HatchlingDef>

/** Their abilities: two regular ones and the Hidden one (Snow Warning, Steely Spirit, Perish Body… are the regions' own, `data/abilities.ts`). */
export const REGIONAL_FAMILY_ABILITIES = {
  vulpixAlola: ['snowCloak', 'iceBody', 'snowWarning'],
  sandshrewAlola: ['snowCloak', 'slushRush', 'sturdy'],
  diglettAlola: ['sandVeil', 'sandRush', 'tanglingHair'],
  geodudeAlola: ['magnetPull', 'sturdy', 'galvanize'],
  grimerAlola: ['poisonTouch', 'gluttony', 'shedSkin'],
  meowthGalar: ['shellArmor', 'unnerve', 'steelySpirit'],
  slowpokeGalar: ['gluttony', 'innerFocus', 'regenerator'],
  zigzagoonGalar: ['guts', 'reckless', 'defiant'],
  farfetchdGalar: ['steadfast', 'sniper', 'innerFocus'],
  corsolaGalar: ['weakArmor', 'cursedBody', 'perishBody'],
  mimeJr: ['vitalSpirit', 'iceBody', 'innerFocus'],
  darumakaGalar: ['hustle', 'iceBody', 'gorillaTactics'],
  growlitheHisui: ['intimidate', 'flashFire', 'rockHead'],
  zoruaHisui: ['illusion', 'cursedBody', 'infiltrator'],
  voltorbHisui: ['static', 'voltAbsorb', 'aftermath'],
  qwilfishHisui: ['poisonPoint', 'swiftSwim', 'intimidate'],
  wooperPaldea: ['poisonPoint', 'waterAbsorb', 'unaware'],
  taurosPaldea: ['intimidate', 'reckless', 'angerPoint'],
} as const

/** The abilities of the regional branches picked at a family's first evolution (`BRANCH_ABILITIES`); the lines' own forms keep the family's. */
export const REGIONAL_BRANCH_ABILITIES = {
  marowakAlola: ['cursedBody', 'lightningRod', 'rockHead'],
  exeggutorAlola: ['frisk', 'chlorophyll', 'leafGuard'],
  slowkingGalar: ['regenerator', 'innerFocus', 'sereneGrace'],
  taurosBlaze: ['intimidate', 'flashFire', 'angerPoint'],
  taurosAqua: ['intimidate', 'waterAbsorb', 'angerPoint'],
} as const
