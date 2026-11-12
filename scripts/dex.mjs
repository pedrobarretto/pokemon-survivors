// Every species the game loads, shared by the asset and credits scripts.
// Keep in sync with src/data/starters.ts and src/data/enemies.ts; the wild
// horde comes from src/data/roster.generated.json (npm run roster).
import roster from '../src/data/roster.generated.json' with { type: 'json' }

export const STARTERS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, // Kanto starters + evolutions
  152, 153, 154, 155, 156, 157, 158, 159, 160, // Johto
  252, 253, 254, 255, 256, 257, 258, 259, 260, // Hoenn
  387, 388, 389, 390, 391, 392, 393, 394, 395, // Sinnoh
  495, 496, 497, 498, 499, 500, 501, 502, 503, // Unova
  650, 651, 652, 653, 654, 655, 656, 657, 658, // Kalos
  722, 723, 724, 725, 726, 727, 728, 729, 730, // Alola
  810, 811, 812, 813, 814, 815, 816, 817, 818, // Galar
  906, 907, 908, 909, 910, 911, 912, 913, 914, // Paldea
]
/**
 * A Grande Atualização's second batch of families (src/data/gaFamiliesB.ts), whole lines: Onix, Happiny,
 * Clauncher, Fletchling, Golett, Nacli, Inkay, Skorupi, Snover, Tynamo, Dewpider, Duraludon, Bounsweet, Sandile and Stufful's.
 */
export const GA_FAMILIES_B = [
  95, 208, 440, 113, 242, 692, 693, 661, 662, 663, 622, 623, 932, 933, 934, 686, 687, 451, 452, 459, 460, 602, 603, 604, 751, 752, 884, 1018, 761, 762, 763,
  551, 552, 553, 759, 760,
]
/**
 * The big update's first 15 families (src/data/gaFamiliesA.ts), whole lines: Jangmo-o, Axew, Lapras, Sneasel,
 * Heracross, Sableye, Spiritomb, Croagunk, Sinistea, Impidimp, Pawmi, Rookidee, Elekid, Magby and Nincada
 * (Ninjask, and Shedinja, its branch and the shell it leaves behind).
 */
export const GA_FAMILIES_A = [
  782, 783, 784, 610, 611, 612, 131, 215, 461, 214, 302, 442, 453, 454, 854, 855, 859, 860, 861,
  921, 922, 923, 821, 822, 823, 239, 125, 466, 240, 126, 467, 290, 291, 292,
]
/** Of those, the Flying forms that take to the sky: Rookidee's line and Ninjask. */
const GA_FLYERS_A = [821, 822, 823, 291]
/**
 * The Grande Atualização's fossil families (src/data/gaFossils.ts), whole lines: Aerodactyl, Omanyte, Lileep and
 * Anorith's, and Galar's Dracozolt, Arctozolt and Dracovish (Kabuto's line was a hatchling already).
 */
export const GA_FOSSILS = [142, 138, 139, 345, 346, 347, 348, 880, 881, 882]
/**
 * The Grande Atualização's Mega families (src/data/gaMegaFamiliesA.ts), whole lines, all Safari-only: Kangaskhan,
 * Pinsir, Skarmory, Drilbur (and Excadrill) and Drampa.
 */
export const GA_MEGA_FAMILIES_A = [115, 127, 227, 529, 530, 780]
/**
 * The big update's Mega families (src/data/megaFamiliesB.ts), whole lines, Safari-only: Meditite, Numel, Buneary,
 * Flabébé (the Eternal Flower Floette, `REGIONAL`, and Florges, its branch) and Skrelp.
 */
export const MEGA_FAMILIES_B = [307, 308, 322, 323, 427, 428, 669, 10061, 671, 690, 691]
/**
 * The regional forms (src/data/regionalFamilies.ts): the Ovo de Viagem's families by region, whole lines, and the
 * regional evolutions of lines already playable (branches). Regional forms go by PokeAPI's id (`REGIONAL`).
 */
export const REGIONAL_LINES = [
  10103, 10104, 10101, 10102, 10105, 10106, 10109, 10110, 10111, 10112, 10113, // Alola: Vulpix, Sandshrew, Diglett, Geodude, Grimer
  10161, 863, 10164, 10165, 10172, 10174, 10175, 862, 10166, 10173, 864, 439, 10168, 10176, 10177, // Galar: Meowth, Slowpoke, Zigzagoon, Farfetch'd, Corsola, Mime Jr., Darumaka
  10229, 10230, 10238, 10239, 10231, 10232, 10234, 904, // Hisui: Growlithe, Zorua, Voltorb, Qwilfish
  10253, 980, 10250, 10251, 10252, // Paldea: Wooper, Tauros and its breeds
  10100, 10114, 10115, 10233, 10236, 10244, 10242, // regional evolutions: Raichu, Exeggutor, Marowak, Typhlosion, Samurott, Decidueye, Goodra
]
/** Families that hatch from eggs (src/data/hatchlings.ts), whole lines. Some also roam the horde. */
export const HATCHLINGS = [
  172, 25, 26, 66, 67, 68, 133, 197, 175, 176, 468, 363, 364, 365, 396, 397, 398, 406, 315, 407, 744, 745, 736, 737, 738, // common
  92, 93, 94, 63, 64, 65, 280, 281, 282, 447, 448, 570, 571, 636, 637, 714, 715, 679, 680, 681, 848, 849, 957, 958, 959, 935, 936, // rare
  147, 148, 149, 246, 247, 248, 374, 375, 376, 443, 444, 445, 885, 886, 887, // ultra rare
  // Gen 1-3 families
  16, 17, 18, 41, 42, 169, 60, 61, 62, 74, 75, 76, 179, 180, 181,
  298, 183, 184, 285, 286, 220, 221, 473, 361, 362, // common
  58, 59, 37, 38, 104, 105, 123, 212, 129, 130, 116, 117, 230, 140, 141, 228, 229, 216, 217,
  304, 305, 306, 328, 329, 330, 333, 334, 309, 310, 353, 354, // rare
  371, 372, 373, 287, 288, 289, 349, 350, // ultra rare
  633, 634, 635, // Deino's line (ultra rare)
  524, 525, 526, // Roggenrola's line (common)
  403, 404, 405, // Shinx's line (common)
  446, 143, // Friendship Egg (invites)
  607, 608, 609, 708, 709, 425, 426, 769, 770, // Haunted Egg (Duskull's stall, Noite das Bruxas): Litwick, Phantump, Drifloon and Sandygast's lines
  137, 233, 474, 102, 103, 559, 560, 235, // Kecleon Egg (the Vitrine's fixed card): Porygon, Exeggcute, Scraggy and Smeargle's lines
  // Branching evolutions (src/data/branches.ts): the eeveelutions, Gallade, Froslass, Politoed, Kleavor and Ceruledge
  134, 135, 136, 196, 470, 471, 700, 475, 478, 186, 900, 937,
  // Temporada 1's families (src/data/seasonOne*.ts), whole lines; Dondozo is the one Tatsugiri pilots
  872, 873, 595, 596, 757, 758, 856, 857, 858, 840, 841, 842, 1011, 1019, 996, 997, 998, // eggs
  408, 409, 410, 411, 566, 567, 696, 697, 698, 699, // fossils
  56, 57, 979, 624, 625, 983, 704, 705, 706, 746, 924, 925, 963, 964, 877, 479, 351, 554, 555, 767, 768, 778, 978, 977,
  77, 78, 10162, 10163, // Ponyta's line and its Galarian form's (`REGIONAL`)
  ...GA_FAMILIES_B,
  ...GA_FAMILIES_A,
  ...REGIONAL_LINES,
  ...GA_FOSSILS,
  ...GA_MEGA_FAMILIES_A,
  ...MEGA_FAMILIES_B,
  // The Safári and Game Corner wave's families (src/data/scFamilies.ts): the Celadon prizes, both Nidoran lines and Cleffa's, and Phione
  29, 30, 31, 32, 33, 34, 173, 35, 36, 489,
]
export const HORDE = Object.values(roster).map((s) => s.dex)
/** Horde species with a behavior trait (`src/data/enemies.ts`), plus Nidoqueen's summons. */
export const TRAITS = [29, 31, 32, 81, 100, 101, 106, 113, 437]
/** Wave bosses: Onix, Snorlax, the three legendary trios (one drawn per run), Mewtwo and the rare mythicals. */
export const BOSSES = [95, 143, 144, 145, 146, 243, 244, 245, 377, 378, 379, 150, 151, 251, 385]
/** Map event Pokémon (the fleeing Meowth, the escort mission's Togepi). Keep in sync with MEOWTH_DEX and TOGEPI_DEX in src/game/. */
export const CRITTERS = [52, 175]
/** Rift legendaries (src/data/rifts.ts), which can also roll shiny. */
export const RIFT_LEGENDS = [249, 250, 382, 383, 384, 483, 380, 381, 386]
/** The Noite das Bruxas' event rift (src/data/rifts.ts): Darkrai, which can roll shiny. */
export const EVENT_LEGENDS = [491]
/** Cresselia, whose Lunar Wing breaks Darkrai's nightmare at its capture (a cameo, never fought). */
export const CAMEOS = [488]
/** The Festival das Lanternas' last prize (`FESTIVAL_LEGENDS` in src/data/legends.ts): Cresselia, playable in Legend mode, shiny through a shiny pick. */
export const FESTIVAL_LEGENDS = [488]
/** Arceus, the endless mode's reaper. */
export const REAPER = [493]
/** Places' bosses (src/data/places.ts): Spiritomb, out of the graveyard's Odd Keystone. It can roll shiny. */
export const PLACE_BOSSES = [442]
/** Hidden zones' own Pokémon (`hidden` in src/data/places.ts), never in the horde: Audino, out of the Hidden Grotto's shaking grass. It can roll shiny (and the sparkling grass's always is). */
export const HIDDEN_DWELLERS = [531]
/** Companions that aren't playable (`SPECIAL_COMPANIONS` in src/data/companions.ts): Pumpkaboo, the Noite das Bruxas supporters' (shiny for the Gold ones). */
export const COMPANIONS = [710]
/**
 * The Noite das Bruxas night bosses (`HALLOWEEN.bosses` in src/data/halloween.ts): Mimikyu, Banette, Sableye,
 * Drifblim, Mismagius, Houndoom, Gengar, Chandelure, Gourgeist, Trevenant, Honchkrow and Dusknoir. Like the
 * wave bosses, they never roll shiny (the ones the horde has come with its shinies).
 */
export const HALLOWEEN_BOSSES = [778, 354, 302, 426, 429, 229, 94, 609, 711, 709, 430, 477]
/** The lobby's shopkeepers (render/plaza.ts): Kecleon (and its purple brother, recolored from the same sheets), Leavanny, the Boutique's tailor, and Bibarel, the carpentry's carpenter. */
export const SHOPKEEPERS = [352, 542, 400]
/**
 * Team Rocket's Game Corner and Hideout (src/data/rocket*.ts): the prize counter's four families, whole lines
 * (Gimmighoul in its Roaming Form, `REGIONAL`: SpriteCollab has no Chest Form sheets), and the Hideout's cast
 * (Giovanni's Persian, the grunts' Ekans, Arbok, Koffing and Weezing).
 */
export const ROCKET_FAMILIES = [132, 359, 10263, 1000, 303]
export const ROCKET_CAST = [53, 23, 24, 109, 110]
/** Terastal's legend (`LEGENDS.terapagos`, the 7★ Tera Raid's giant): Terapagos, playable in Legend mode, its Terastal Form at the first awakening. */
export const TERA_LEGENDS = [1024]
/** The Ultra Beasts (src/data/ultraBeasts.ts): the Ultra Wormholes' ten, fought and captured, and Poipole, the gift for capturing them all. */
export const ULTRA_BEASTS = [793, 794, 795, 796, 797, 798, 799, 803, 804, 805, 806]
/**
 * The legend paths (src/data/legendPaths.ts), each its own long-term goal: Zygarde (its 10%, 50% and Complete
 * Formes, `FORMS`), Cosmog's line to Solgaleo or Lunala, Kubfu and Urshifu (both styles), Meltan and Melmetal, and
 * Regigigas, which wakes for the Regi trio's captor. All playable in Legend mode, and all can be shiny.
 */
export const LEGEND_PATHS = [718, 789, 790, 791, 792, 891, 892, 808, 809, 486]
/**
 * The café's card game (`realm/games/unown.ts`): Unown, whose letters (its `FORMS`) are the number cards' faces.
 * Never a player, a foe or shiny.
 */
export const CAFE_CARDS = [201]
/**
 * The legends with a road of their own (`QUEST_LEGENDS` in src/data/legends.ts): Palkia's rift (and its Origin Forme),
 * the roaming lake trio (Uxie, Mesprit, Azelf), the Swords of Justice (Cobalion, Terrakion, Virizion) and their
 * Keldeo, and Hoopa of the ring rush (and Hoopa Unbound). All playable in Legend mode, all able to roll shiny.
 */
export const QUEST_LEGENDS = [484, 480, 481, 482, 638, 639, 640, 647, 720]
/** The Safári's legend (`SAFARI_LEGENDS` in src/data/legends.ts): Manaphy, hatched from the cove's egg, playable in Legend mode and able to be shiny. */
export const SAFARI_LEGENDS = [490]
export const DEX = [...new Set([...STARTERS, ...HATCHLINGS, ...ROCKET_FAMILIES, ...ROCKET_CAST, ...HORDE, ...TRAITS, ...BOSSES, ...CRITTERS, ...RIFT_LEGENDS, ...EVENT_LEGENDS, ...CAMEOS, ...FESTIVAL_LEGENDS, ...REAPER, ...PLACE_BOSSES, ...HIDDEN_DWELLERS, ...COMPANIONS, ...HALLOWEEN_BOSSES, ...SHOPKEEPERS, ...TERA_LEGENDS, ...ULTRA_BEASTS, ...LEGEND_PATHS, ...QUEST_LEGENDS, ...CAFE_CARDS, ...SAFARI_LEGENDS])]
/**
 * The Arena's emotes (`emote` in src/data/arenaEffects.ts, `EMOTE_ANIMS` there too): extra SpriteCollab
 * animations, only for the species the Arena plays (the starters' lines) and only their front row
 * (`scripts/fetch-emotes.mjs`), into `public/assets/pokemon/<dex>/emote/` and src/data/emotes.generated.json.
 */
export const EMOTE_SPECIES = STARTERS
export const EMOTE_ANIMS = ['Hop', 'Rotate', 'Sleep', 'Charge', 'Pose']
/**
 * Flying types that take to the sky (the sky's flock in src/data/places.ts and the
 * Flying-type player forms): they get a `Fly` sheet when SpriteCollab has one.
 */
export const FLYERS = new Set([
  16, 17, 18, 21, 22, 227, 276, 277, 333, 334, 396, 397, 398, // the sky's flock
  6, 41, 42, 123, 130, 149, 169, 176, 373, 468, 714, 715, 722, 723, 566, 567, 661, 662, 663, // player forms
  ...GA_FLYERS_A,
  142, // Aerodactyl (src/data/gaFossils.ts)
])
/** Species that can roll shiny: the player lines, regular enemies, rift legendaries, places' bosses, the hidden zones' Audino and the companions (Pumpkaboo for Gold supporters). */
/** Legendaries that can also roll shiny as wave bosses (the trios, Mewtwo, the mythicals) and Arceus, for the Legend mode's captures. */
export const SHINY_LEGENDS = [144, 145, 146, 150, 151, 243, 244, 245, 251, 377, 378, 379, 385, 493]
/**
 * Every species a player can be: the starters' and the hatchlings' whole lines (branches included) and the Legend
 * mode's legends (the rift, event, festival and quest legends, the trios, the mythicals, Mewtwo and Arceus). The species whose
 * wearables `npm run rig` fits, with their `FORMS` (`render/wearFit.test.ts` keeps them in sync with `PLAYABLE`).
 */
export const PLAYERS = [...new Set([...STARTERS, ...HATCHLINGS, ...ROCKET_FAMILIES, ...RIFT_LEGENDS, ...EVENT_LEGENDS, ...FESTIVAL_LEGENDS, ...SHINY_LEGENDS, ...TERA_LEGENDS, ...ULTRA_BEASTS, ...LEGEND_PATHS, ...QUEST_LEGENDS, ...SAFARI_LEGENDS])]
export const SHINY = new Set([...STARTERS, ...HATCHLINGS, ...ROCKET_FAMILIES, ...HORDE, ...TRAITS, ...RIFT_LEGENDS, ...EVENT_LEGENDS, ...FESTIVAL_LEGENDS, ...PLACE_BOSSES, ...HIDDEN_DWELLERS, ...SHINY_LEGENDS, ...COMPANIONS, ...ULTRA_BEASTS, ...TERA_LEGENDS, ...LEGEND_PATHS, ...QUEST_LEGENDS, ...SAFARI_LEGENDS])

/**
 * Alternate formes the game draws, by key, mapped to their SpriteCollab form id
 * (`sprite/<dex>/<id>/`, shiny under `<id>/0001/`). They land in
 * `public/assets/pokemon/<dex>/<key>/` and under `forms.<key>` in the manifest.
 */
export const FORMS = {
  201: { b: '0001', c: '0002', f: '0005', j: '0009', k: '0010', n: '0013', o: '0014', u: '0020' }, // Unown's letters, the café's Unown cards (A is the species' own)
  681: { blade: '0001' }, // Aegislash's Blade Forme (Stance Change)
  // Temporada 1's formes (src/data/seasonOneKits.ts)
  351: { sunny: '0001', rainy: '0002', snowy: '0003' }, // Castform (the weather)
  479: { heat: '0001', wash: '0002', frost: '0003', fan: '0004', mow: '0005' }, // Rotom's appliances
  555: { zen: '0001' }, // Darmanitan's Zen Mode
  746: { school: '0001' }, // Wishiwashi's School Forme
  778: { busted: '0001' }, // Mimikyu's broken Disguise
  877: { hangry: '0001' }, // Morpeko's Hunger Switch
  964: { hero: '0001' }, // Palafin's Hero Forme
  // Mega Evolutions (src/data/megas.ts). Only these Megas have sprites on SpriteCollab so far; the
  // others wear their final stage's sprite until theirs land there (then add the form id here).
  6: { megaX: '0001' },
  65: { mega: '0001' },
  94: { mega: '0001' },
  229: { mega: '0001' },
  248: { mega: '0001' },
  254: { mega: '0001' }, // Walk and Idle only so far (no Hurt sheet: it flinches in its Walk)
  282: { mega: '0001' },
  310: { mega: '0001' },
  334: { mega: '0001' },
  354: { mega: '0001' },
  362: { mega: '0001' },
  448: { mega: '0001' },
  475: { mega: '0001' },
  208: { mega: '0001' }, // Mega Steelix (src/data/gaFamiliesB.ts)
  604: { mega: '0001' }, // Mega Eelektross
  302: { mega: '0001' }, // Mega Sableye (src/data/gaFamiliesA.ts)
  142: { mega: '0001' }, // Mega Aerodactyl (src/data/gaFossils.ts)
  // Legend mode's forms: Primal Reversion, Mega Rayquaza, the Latis', Mewtwo Y's and Darkrai's Megas, Deoxys' formes.
  150: { megaY: '0002', shadow: '0003' }, // Shadow Mewtwo: the Rocket Hideout's boss and its Legend-mode variant (src/data/shadow.ts)
  // Team Rocket's prize families' Megas (src/data/megas.ts)
  359: { mega: '0001' },
  303: { mega: '0001' },
  380: { mega: '0001' },
  381: { mega: '0001' },
  382: { primal: '0001' },
  383: { primal: '0001' },
  384: { mega: '0001' },
  386: { attack: '0001', defense: '0002', speed: '0003' },
  491: { mega: '0002' }, // 0001 is a cutscene sprite
  // Terapagos's Terastal Form (its Stellar Form has no sheets: it wears these in Stellar crystal, `render/teraArt.ts`).
  1024: { terastal: '0001' },
  // The legend paths' formes (src/data/legendPaths.ts): Zygarde's 10% and Complete (its 50% is the species' own), Urshifu's Rapid Strike Style.
  718: { ten: '0001', complete: '0002', mega: '0005' }, // and Mega Zygarde, from its Complete Forme (src/data/megas.ts)
  892: { rapid: '0001' },
  484: { origin: '0001' }, // Palkia's Origin Forme (its rift's last phase, its second awakening)
  720: { unbound: '0001' }, // Hoopa Unbound (its second awakening, the ring rush's last ring)
  978: { mega: '0003' }, // Mega Tatsugiri: the only one of its three Megas with sheets (its Curly form's)
  // The Mega families' Megas (src/data/gaMegaFamiliesA.ts); Mega Pinsir has no sheets yet (rainbow outline).
  115: { mega: '0001' },
  227: { mega: '0001' },
  530: { mega: '0001' },
  780: { mega: '0001' },
  // The big update's Mega families (src/data/megaFamiliesB.ts). Mega Floette sits beside the Eternal Flower in
  // Floette's folder, not under it: a form id with a slash is the whole folder (`formFolder`).
  308: { mega: '0001' },
  323: { mega: '0001' },
  428: { mega: '0001' },
  10061: { mega: '0670/0006' },
  691: { mega: '0001' },
}

/**
 * Form shinies SpriteCollab doesn't have yet, committed by hand at `public/assets/pokemon/<dex>/<key>/shiny/`
 * (Walk, Idle and Hurt): palette swaps of the form's own sheets, so they share its frame sizes and durations.
 * By dex and form key, the artist to credit in CREDITS.md. Drop an entry once SpriteCollab publishes that shiny.
 */
export const HANDMADE_SHINIES = {
  248: { mega: 'JFain (shared on Discord as @JaiFain)' },
}

/**
 * Species shinies SpriteCollab doesn't have yet, made by `scripts/fetch-assets.mjs` from the species' own sheets by
 * swapping these colors (the palette its line's official shinies use), into `public/assets/pokemon/<dex>/shiny/`
 * (Walk, Idle and Hurt; the portrait stays the normal one). Credited in CREDITS.md as a recolor of the sheets' artist.
 * Drop an entry once SpriteCollab publishes that shiny.
 */
export const RECOLORED_SHINIES = {
  // Naclstack: the salt turns orange, as on shiny Nacli and Garganacl; the rock keeps its browns.
  933: { '#ffffff': '#ffd5a0', '#e8e6e6': '#f9be74', '#cacaca': '#d89f64', '#8b7f79': '#c0753f' },
}

/**
 * Regional forms a player can be whose shiny SpriteCollab doesn't have yet: palette swaps of their own sheets
 * (Walk, Idle, Hurt and the portrait), made by `scripts/regionalShinies.mjs` into `public/assets/pokemon/<dex>/shiny/`.
 * By dex, the credit for CREDITS.md. Drop an entry once SpriteCollab publishes that shiny.
 */
export const HANDMADE_SPECIES_SHINIES = {
  10161: 'Pokémon Survivors (palette swap of the sprite above, after Perrserker\'s shiny)',
  10176: 'Pokémon Survivors (palette swap of the sprite above, after Galarian Darmanitan\'s shiny)',
}

/**
 * Forms that ship their portrait too (`<dex>/<key>/portrait.png`, `portrait` in the manifest's form), for the
 * screens that show one: Mega Darkrai, the Noite das Bruxas' Meta da comunidade (`ui/halloween.ts`).
 */
export const FORM_PORTRAITS = {
  491: ['mega'],
  1024: ['terastal'],
}

/**
 * Forms with a cry of their own, by key, mapped to their PokeAPI Pokémon name, with or without
 * sheets in `FORMS`. The cry lands in `public/assets/pokemon/<dex>/<key>/cry.ogg` and the key in
 * the species' `formCries` in the manifest.
 */
export const FORM_CRIES = {
  1024: { terastal: 'terapagos-terastal', stellar: 'terapagos-stellar' },
  3: { mega: 'venusaur-mega' },
  6: { megaX: 'charizard-mega-x', megaY: 'charizard-mega-y' },
  9: { mega: 'blastoise-mega' },
  18: { mega: 'pidgeot-mega' },
  26: { megaX: 'raichu-mega-x', megaY: 'raichu-mega-y' },
  65: { mega: 'alakazam-mega' },
  94: { mega: 'gengar-mega' },
  130: { mega: 'gyarados-mega' },
  149: { mega: 'dragonite-mega' },
  154: { mega: 'meganium-mega' },
  160: { mega: 'feraligatr-mega' },
  181: { mega: 'ampharos-mega' },
  212: { mega: 'scizor-mega' },
  229: { mega: 'houndoom-mega' },
  248: { mega: 'tyranitar-mega' },
  254: { mega: 'sceptile-mega' },
  257: { mega: 'blaziken-mega' },
  260: { mega: 'swampert-mega' },
  282: { mega: 'gardevoir-mega' },
  306: { mega: 'aggron-mega' },
  310: { mega: 'manectric-mega' },
  334: { mega: 'altaria-mega' },
  354: { mega: 'banette-mega' },
  362: { mega: 'glalie-mega' },
  373: { mega: 'salamence-mega' },
  376: { mega: 'metagross-mega' },
  398: { mega: 'staraptor-mega' },
  445: { mega: 'garchomp-mega', megaZ: 'garchomp-mega-z' },
  448: { mega: 'lucario-mega', megaZ: 'lucario-mega-z' },
  475: { mega: 'gallade-mega' },
  302: { mega: 'sableye-mega' },
  150: { megaY: 'mewtwo-mega-y', megaX: 'mewtwo-mega-x' },
  303: { mega: 'mawile-mega' },
  359: { mega: 'absol-mega', megaZ: 'absol-mega-z' },
  380: { mega: 'latias-mega' },
  381: { mega: 'latios-mega' },
  382: { primal: 'kyogre-primal' },
  383: { primal: 'groudon-primal' },
  384: { mega: 'rayquaza-mega' },
  386: { attack: 'deoxys-attack', defense: 'deoxys-defense', speed: 'deoxys-speed' },
  491: { mega: 'darkrai-mega' },
  718: { ten: 'zygarde-10', complete: 'zygarde-complete', mega: 'zygarde-mega' },
  892: { rapid: 'urshifu-rapid-strike' },
  484: { origin: 'palkia-origin' },
  720: { unbound: 'hoopa-unbound' },
  500: { mega: 'emboar-mega' },
  652: { mega: 'chesnaught-mega' },
  208: { mega: 'steelix-mega' },
  604: { mega: 'eelektross-mega' },
  655: { mega: 'delphox-mega' },
  658: { mega: 'greninja-mega' },
  // The Grande Atualização's Megas on lines already playable (src/data/megas.ts)
  214: { mega: 'heracross-mega' },
  460: { mega: 'abomasnow-mega' },
  478: { mega: 'froslass-mega' },
  560: { mega: 'scrafty-mega' },
  609: { mega: 'chandelure-mega' },
  623: { mega: 'golurk-mega' },
  687: { mega: 'malamar-mega' },
  768: { mega: 'golisopod-mega' },
  998: { mega: 'baxcalibur-mega' },
  978: { mega: 'tatsugiri-curly-mega' },
  142: { mega: 'aerodactyl-mega' },
  115: { mega: 'kangaskhan-mega' },
  127: { mega: 'pinsir-mega' },
  227: { mega: 'skarmory-mega' },
  530: { mega: 'excadrill-mega' },
  780: { mega: 'drampa-mega' },
  308: { mega: 'medicham-mega' },
  323: { mega: 'camerupt-mega' },
  428: { mega: 'lopunny-mega' },
  10061: { mega: 'floette-mega' },
  691: { mega: 'dragalge-mega' },
  36: { mega: 'clefable-mega' }, // Mega Clefable (src/data/scFamilies.ts): no SpriteCollab sheets, Clefable wears the rainbow outline
}

/**
 * Emotion portraits beyond `Normal` (SpriteCollab's `portrait/<dex>/<Emotion>.png`) for the species
 * that talk in a dialogue box (`ui/dialogue.ts`). They land in `public/assets/pokemon/<dex>/portraits/`.
 */
export const EMOTIONS = {
  352: ['Normal', 'Happy', 'Joyous', 'Surprised', 'Sigh', 'Inspired', 'Angry'],
  // The plaza's visitors (src/data/visitors.ts): Meowth's weekend caravan and the seasonal stalls' Duskull and Delibird.
  52: ['Normal', 'Happy', 'Joyous', 'Surprised', 'Sigh', 'Inspired', 'Angry'],
  355: ['Normal', 'Happy', 'Joyous', 'Surprised', 'Sigh', 'Inspired', 'Angry'],
  225: ['Normal', 'Happy', 'Joyous', 'Surprised', 'Sigh', 'Inspired', 'Angry'],
  // Lanturn, the Festival da Praça's Lantern Market keeper (render/plaza.ts).
  171: ['Normal', 'Happy', 'Joyous', 'Surprised', 'Sigh', 'Inspired', 'Angry'],
  // Machoke, the Dojo's sensei (render/dojo.ts).
  67: ['Normal', 'Happy', 'Joyous', 'Surprised', 'Sigh', 'Inspired', 'Angry'],
  // Ninjask, the Estádio's judge (render/stadium.ts).
  291: ['Normal', 'Happy', 'Joyous', 'Surprised', 'Sigh', 'Inspired', 'Angry'],
  // Leavanny, the Boutique's tailor (render/plaza.ts).
  542: ['Normal', 'Happy', 'Joyous', 'Surprised', 'Sigh', 'Inspired', 'Angry'],
  // Bibarel, the carpentry's carpenter (render/plaza.ts): SpriteCollab only has its Normal portrait.
  400: ['Normal'],
  // The Game Corner's Meowth talks with the 52 row above; Giovanni speaks through his Persian (the Rocket Hideout).
  53: ['Normal', 'Happy', 'Joyous', 'Surprised', 'Sigh', 'Inspired', 'Angry', 'Determined', 'Shouting'],
  // Sudowoodo, who tells of the Zygarde Cells (the legend paths, src/data/legendPaths.ts).
  185: ['Normal', 'Happy', 'Joyous', 'Surprised', 'Sigh', 'Inspired', 'Angry'],
}

/**
 * Regional forms played as species of their own (keep in sync with `src/data/regionalForms.ts`), by PokeAPI's id
 * for the form (its cry is there under that id): their SpriteCollab folder. Everything keyed by dex then just works.
 */
export const REGIONAL = {
  10162: '0077/0001', 10163: '0078/0001', 10263: '0999/0001', // Gimmighoul (Roaming Form, Team Rocket)
  // Alola
  10100: '0026/0001', 10101: '0027/0001', 10102: '0028/0001', 10103: '0037/0001', 10104: '0038/0001', 10105: '0050/0001', 10106: '0051/0001',
  10109: '0074/0001', 10110: '0075/0001', 10111: '0076/0001', 10112: '0088/0001', 10113: '0089/0001', 10114: '0103/0001', 10115: '0105/0001',
  // Galar
  10161: '0052/0002', 10164: '0079/0001', 10165: '0080/0001', 10166: '0083/0001', 10168: '0122/0001', 10172: '0199/0001', 10173: '0222/0001',
  10174: '0263/0001', 10175: '0264/0001', 10176: '0554/0001', 10177: '0555/0002',
  // Hisui
  10229: '0058/0001', 10230: '0059/0001', 10231: '0100/0001', 10232: '0101/0001', 10233: '0157/0001', 10234: '0211/0001', 10236: '0503/0001',
  10238: '0570/0001', 10239: '0571/0001', 10242: '0706/0001', 10244: '0724/0001',
  // Paldea (Tauros' three breeds)
  10250: '0128/0001', 10251: '0128/0002', 10252: '0128/0003', 10253: '0194/0002',
  // Floette of the Eternal Flower (src/data/megaFamiliesB.ts): Flabébé's line's final stage, the one with the Mega.
  10061: '0670/0005',
}
/** A species' SpriteCollab folder. */
export const pad = (n) => REGIONAL[n] ?? String(n).padStart(4, '0')
/** A form's SpriteCollab folder (`FORMS`): under the species' own, or the whole folder when the id has a slash. */
export const formFolder = (dex, id) => (id.includes('/') ? id : `${pad(dex)}/${id}`)
/** Where a species' shiny sits below its folder: a regional form's is directly under the form, like any form's. */
export const shinyPath = (dex) => (REGIONAL[dex] ? '/0001' : '/0000/0001')
