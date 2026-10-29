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
 * The Arena's roster (`VERSUS_ROSTER` in src/data/versus.ts: the 27 starters) with every stage
 * a match evolves them to: the species whose wearables `npm run anchors` fits (`render/wearFit.test.ts` keeps them in sync).
 */
export const ARENA = STARTERS
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
/** Companions that aren't playable (`SPECIAL_COMPANIONS` in src/data/companions.ts): Pumpkaboo, the Noite das Bruxas supporters' (shiny for the Gold ones). */
export const COMPANIONS = [710]
/**
 * The Noite das Bruxas night bosses (`HALLOWEEN.bosses` in src/data/halloween.ts): Mimikyu, Banette, Sableye,
 * Drifblim, Mismagius, Houndoom, Gengar, Chandelure, Gourgeist, Trevenant, Honchkrow and Dusknoir. Like the
 * wave bosses, they never roll shiny (the ones the horde has come with its shinies).
 */
export const HALLOWEEN_BOSSES = [778, 354, 302, 426, 429, 229, 94, 609, 711, 709, 430, 477]
/** The lobby's shopkeepers (render/plaza.ts): Kecleon, and its purple brother recolored from the same sheets. */
export const SHOPKEEPERS = [352]
export const DEX = [...new Set([...STARTERS, ...HATCHLINGS, ...HORDE, ...TRAITS, ...BOSSES, ...CRITTERS, ...RIFT_LEGENDS, ...EVENT_LEGENDS, ...CAMEOS, ...FESTIVAL_LEGENDS, ...REAPER, ...PLACE_BOSSES, ...COMPANIONS, ...HALLOWEEN_BOSSES, ...SHOPKEEPERS])]
/**
 * Flying types that take to the sky (the sky's flock in src/data/places.ts and the
 * Flying-type player forms): they get a `Fly` sheet when SpriteCollab has one.
 */
export const FLYERS = new Set([
  16, 17, 18, 21, 22, 227, 276, 277, 333, 334, 396, 397, 398, // the sky's flock
  6, 41, 42, 123, 130, 149, 169, 176, 373, 468, 714, 715, 722, 723, // player forms
])
/** Species that can roll shiny: the player lines, regular enemies, rift legendaries, places' bosses and the companions (Pumpkaboo for Gold supporters). */
/** Legendaries that can also roll shiny as wave bosses (the trios, Mewtwo, the mythicals) and Arceus, for the Legend mode's captures. */
export const SHINY_LEGENDS = [144, 145, 146, 150, 151, 243, 244, 245, 251, 377, 378, 379, 385, 493]
export const SHINY = new Set([...STARTERS, ...HATCHLINGS, ...HORDE, ...TRAITS, ...RIFT_LEGENDS, ...EVENT_LEGENDS, ...FESTIVAL_LEGENDS, ...PLACE_BOSSES, ...SHINY_LEGENDS, ...COMPANIONS])

/**
 * Alternate formes the game draws, by key, mapped to their SpriteCollab form id
 * (`sprite/<dex>/<id>/`, shiny under `<id>/0001/`). They land in
 * `public/assets/pokemon/<dex>/<key>/` and under `forms.<key>` in the manifest.
 */
export const FORMS = {
  681: { blade: '0001' }, // Aegislash's Blade Forme (Stance Change)
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
}

/**
 * Forms with a cry of their own, by key, mapped to their PokeAPI Pokémon name, with or without
 * sheets in `FORMS`. The cry lands in `public/assets/pokemon/<dex>/<key>/cry.ogg` and the key in
 * the species' `formCries` in the manifest.
 */
export const FORM_CRIES = {
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
}

export const pad = (n) => String(n).padStart(4, '0')
