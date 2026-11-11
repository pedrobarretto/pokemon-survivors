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
/** Terastal's legend (`LEGENDS.terapagos`, the 7★ Tera Raid's giant): Terapagos, playable in Legend mode, its Terastal Form at the first awakening. */
export const TERA_LEGENDS = [1024]
export const DEX = [...new Set([...STARTERS, ...HATCHLINGS, ...HORDE, ...TRAITS, ...BOSSES, ...CRITTERS, ...RIFT_LEGENDS, ...EVENT_LEGENDS, ...CAMEOS, ...FESTIVAL_LEGENDS, ...REAPER, ...PLACE_BOSSES, ...HIDDEN_DWELLERS, ...COMPANIONS, ...HALLOWEEN_BOSSES, ...SHOPKEEPERS, ...TERA_LEGENDS])]
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
  6, 41, 42, 123, 130, 149, 169, 176, 373, 468, 714, 715, 722, 723, 566, 567, // player forms
])
/** Species that can roll shiny: the player lines, regular enemies, rift legendaries, places' bosses, the hidden zones' Audino and the companions (Pumpkaboo for Gold supporters). */
/** Legendaries that can also roll shiny as wave bosses (the trios, Mewtwo, the mythicals) and Arceus, for the Legend mode's captures. */
export const SHINY_LEGENDS = [144, 145, 146, 150, 151, 243, 244, 245, 251, 377, 378, 379, 385, 493]
/**
 * Every species a player can be: the starters' and the hatchlings' whole lines (branches included) and the Legend
 * mode's 25 (the rift, event and festival legends, the trios, the mythicals, Mewtwo and Arceus). The species whose
 * wearables `npm run rig` fits, with their `FORMS` (`render/wearFit.test.ts` keeps them in sync with `PLAYABLE`).
 */
export const PLAYERS = [...new Set([...STARTERS, ...HATCHLINGS, ...RIFT_LEGENDS, ...EVENT_LEGENDS, ...FESTIVAL_LEGENDS, ...SHINY_LEGENDS, ...TERA_LEGENDS])]
export const SHINY = new Set([...STARTERS, ...HATCHLINGS, ...HORDE, ...TRAITS, ...RIFT_LEGENDS, ...EVENT_LEGENDS, ...FESTIVAL_LEGENDS, ...PLACE_BOSSES, ...HIDDEN_DWELLERS, ...SHINY_LEGENDS, ...COMPANIONS, ...TERA_LEGENDS])

/**
 * Alternate formes the game draws, by key, mapped to their SpriteCollab form id
 * (`sprite/<dex>/<id>/`, shiny under `<id>/0001/`). They land in
 * `public/assets/pokemon/<dex>/<key>/` and under `forms.<key>` in the manifest.
 */
export const FORMS = {
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
  // Legend mode's forms: Primal Reversion, Mega Rayquaza, the Latis', Mewtwo Y's and Darkrai's Megas, Deoxys' formes.
  150: { megaY: '0002' },
  380: { mega: '0001' },
  381: { mega: '0001' },
  382: { primal: '0001' },
  383: { primal: '0001' },
  384: { mega: '0001' },
  386: { attack: '0001', defense: '0002', speed: '0003' },
  491: { mega: '0002' }, // 0001 is a cutscene sprite
  // Terapagos's Terastal Form (its Stellar Form has no sheets: it wears these in Stellar crystal, `render/teraArt.ts`).
  1024: { terastal: '0001' },
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
  150: { megaY: 'mewtwo-mega-y' },
  380: { mega: 'latias-mega' },
  381: { mega: 'latios-mega' },
  382: { primal: 'kyogre-primal' },
  383: { primal: 'groudon-primal' },
  384: { mega: 'rayquaza-mega' },
  386: { attack: 'deoxys-attack', defense: 'deoxys-defense', speed: 'deoxys-speed' },
  491: { mega: 'darkrai-mega' },
  500: { mega: 'emboar-mega' },
  652: { mega: 'chesnaught-mega' },
  655: { mega: 'delphox-mega' },
  658: { mega: 'greninja-mega' },
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
}

/**
 * Regional forms played as species of their own (keep in sync with `src/data/regionalForms.ts`), by PokeAPI's id
 * for the form (its cry is there under that id): their SpriteCollab folder. Everything keyed by dex then just works.
 */
export const REGIONAL = { 10162: '0077/0001', 10163: '0078/0001' }
/** A species' SpriteCollab folder. */
export const pad = (n) => REGIONAL[n] ?? String(n).padStart(4, '0')
/** Where a species' shiny sits below its folder: a regional form's is directly under the form, like any form's. */
export const shinyPath = (dex) => (REGIONAL[dex] ? '/0001' : '/0000/0001')
