import type { WearableSlot } from './cosmetics'
import type { WearableId } from './wearables'

/**
 * Hand fitting for the wearables, by dex (a form by `'<dex>:<form>'`: its own,
 * a Mega's sprite is drawn anew): what the head rig of `npm run rig`
 * (`data/wearRig/`, `render/wearRig.ts`) gets wrong for a species. The dev
 * console's `ps.rig(dex)` shows a frame's rig, takes fixes by mouse and keys
 * and prints them back in this shape.
 *
 * - `rig`: fixes to the measures, for every direction (`all`) or per art
 *   direction (`ART_DIRS`; the west-facing rows take the east-facing ones',
 *   mirrored), in px (right, down), on every frame and anim of that direction:
 *   `seat` moves the hat's seat (a third number widens its opening), `eyes`
 *   moves the eyes found (`'none'`: there are none to see), `eyesAt` puts
 *   them where none were found (from the seat), `neck` and `back` move those
 *   points, and `over` lists pixels (from the seat) of the sprite drawn over
 *   any hat, a horn or a crest in front of it.
 * - `size`: px to add to a slot's measured size (its width) where the rig's is off.
 * - `no`: slots or items the species can't wear well (a flame where the hat
 *   goes, a shell or a tree where a cape hangs): left off, never drawn badly.
 *   The last resort: each says why.
 */
export const ART_DIRS = ['S', 'SE', 'E', 'NE', 'N'] as const

export type ArtDirName = (typeof ART_DIRS)[number]

export type Nudge = readonly [number, number]

/** A `WEAR_FITS` key: a species' dex, or a form's `'<dex>:<form>'` (`rigKey` in `render/wearFit.ts`, without the shiny's `s`). */
export type FitKey = number | `${number}:${string}`

export type RigFix = {
  seat?: Nudge | readonly [number, number, number]
  eyes?: Nudge | 'none'
  eyesAt?: readonly Nudge[]
  neck?: Nudge
  back?: Nudge
  over?: readonly Nudge[]
}

export type SpeciesFit = {
  rig?: Partial<Record<ArtDirName | 'all', RigFix>>
  size?: Partial<Record<WearableSlot, number>>
  no?: readonly (WearableSlot | WearableId)[]
}

/** What hangs down an upright back: on four legs (or a seal's flippers) it would hang off the side. */
const UPRIGHT = ['cape', 'royalCape', 'backpack', 'jetpack'] as const satisfies readonly WearableId[]

/** No neck to tie a scarf around and no back to hang anything from: a ball, a shell, a fish, a sword, a floating head. */
const NO_BODY = ['neck', 'back'] as const satisfies readonly WearableSlot[]

export const WEAR_FITS: Partial<Record<FitKey, SpeciesFit>> = {
  1: { no: ['back'] }, // Bulbasaur: the bulb rises over its head and fills its back
  2: { rig: { S: { seat: [0, 10, 9], eyesAt: [[-4, 5], [4, 5]], neck: [0, 12] }, SE: { seat: [4, 10, 6], eyesAt: [[3, 5]], neck: [4, 17] }, E: { seat: [6, 8, 5], eyesAt: [[5, 5]], neck: [7, 13] }, NE: { seat: [5, 6] } }, no: ['back'] }, // Ivysaur: the bud; its sheets' mouth marker sits on the bud, so the rig is measured there, not on the head under it
  3: { rig: { NE: { neck: [-2, 6] }, N: { neck: [0, 5] } }, no: ['head', 'back'] }, // Venusaur: the flower is where a hat or a cape would go; facing away, the neck under it
  5: { rig: { SE: { seat: [-1, -4], eyesAt: [[-3, 5], [2, 4]] }, E: { seat: [-3, -3], eyesAt: [[0, 5]] } } }, // Charmeleon: turned, its blue eyes aren't found and the seat drops to their line walking (idle, it looks up: the seat meets both halfway)
  6: { no: ['back'] }, // Charizard: its own wings
  '6:megaX': { rig: { S: { seat: [0, -2, -20], eyes: [0, -3] }, SE: { eyesAt: [[0, 5]] }, E: { eyesAt: [[3, 4]] } }, size: { face: -10, neck: -9 }, no: ['back'] }, // Mega Charizard X: its own wings; facing south its seat, face and neck span the wings, and its blue cheeks read as eyes
  9: { no: ['back'] }, // Blastoise: the cannons
  16: { no: UPRIGHT }, // Pidgey: a bird's back is its wings
  17: { no: UPRIGHT }, // Pidgeotto
  18: { no: UPRIGHT }, // Pidgeot
  37: { no: UPRIGHT }, // Vulpix
  38: { rig: { S: { seat: [-1, 6, -10], eyesAt: [[-3, 4], [1, 4]] }, SE: { seat: [2, 5, -8], eyesAt: [[3, 5]] }, E: { seat: [4, 2, -8], eyesAt: [[3, 4]] } }, size: { face: -4 }, no: ['back'] }, // Ninetales: the tails fill its back; the seat found is its crest's tip and the eyes its fur's marks
  41: { rig: { S: { seat: [0, 0, -15] }, SE: { seat: [0, 0, -4] }, NE: { seat: [0, 0, -4] } }, size: { neck: -4 }, no: ['face', 'back'] }, // Zubat: no eyes, and it's all wings: the seat spans them facing south and lands on one turned a little
  42: { rig: { SE: { seat: [-2, 1, -3] }, E: { seat: [2, 1] } }, no: ['back'] }, // Golbat: its own wings, which the seat lands on turned a little
  58: { no: UPRIGHT }, // Growlithe
  59: { no: UPRIGHT }, // Arcanine
  60: { no: ['neck', ...UPRIGHT] }, // Poliwag: a round tadpole
  '65:mega': { rig: { S: { seat: [0, -7, -23], eyesAt: [[-2, 5], [2, 5]] }, SE: { seat: [0, 3] }, E: { seat: [0, 3] } }, size: { face: -22, neck: -14, back: -10 } }, // Mega Alakazam: facing south the seat, face and neck span its five spoons and its eyes aren't found; turned, the seat is its crest's tip
  74: { rig: { S: { seat: [0, 0, -12] }, SE: { seat: [2, 0, -8], eyesAt: [[-1, 5], [2, 5]] }, NE: { seat: [0, 0, -6] }, N: { seat: [0, 0, -14] } }, no: NO_BODY }, // Geodude: a rock with arms, which the seat spans; turned a little, a fist reads as an eye
  76: { no: ['back'] }, // Golem: the shell
  92: { rig: { S: { seat: [0, -5], eyes: [0, -4] }, SE: { seat: [1, -3], eyesAt: [[-1, 5], [6, 3]] }, E: { seat: [0, -3], eyesAt: [[0, 5]] }, NE: { seat: [-5, -1] }, N: { seat: [0, 3, 6] } }, no: NO_BODY }, // Gastly: a ball of gas; the seat drops into its face between the eyes, which are found by their lower edge, and not at all turned
  93: { no: NO_BODY }, // Haunter: a floating head and hands
  '94:mega': { rig: { SE: { eyes: [0, -2] }, E: { eyes: [0, -2] } } }, // Mega Gengar: turned, its grin's top reads as the eyes
  102: { rig: { S: { seat: [0, 0, -16] }, SE: { seat: [0, 0, -11] }, E: { seat: [0, 0, -4] }, NE: { seat: [0, 0, -2] } }, no: ['face', ...NO_BODY] }, // Exeggcute: six eggs; a hat goes on the top one, not across the clutch
  117: { rig: { S: { eyesAt: [[-3, 7], [3, 7]] }, NE: { seat: [-4, 1, 4] } } }, // Seadra: facing south only its pupils are found, not the whites; turned away the seat lands on its snout's tip walking (and on its skull idle: halfway serves both)
  123: { no: ['back'] }, // Scyther: its own wings
  129: { no: NO_BODY }, // Magikarp
  130: { no: ['back'] }, // Gyarados: a serpent
  133: { no: UPRIGHT }, // Eevee
  134: { no: UPRIGHT }, // Vaporeon
  135: { no: UPRIGHT }, // Jolteon
  136: { no: UPRIGHT }, // Flareon
  137: { rig: { E: { eyesAt: [[0, 4]] } }, no: UPRIGHT }, // Porygon: in profile its eye isn't found
  140: { no: NO_BODY }, // Kabuto: a shell
  143: { rig: { S: { seat: [0, -3] }, SE: { seat: [1, 2] }, E: { eyes: [9, 1] } } }, // Snorlax: facing south the seat drops to its face's top, turned a little it's an ear's tip, and in profile an ear's inside reads as the eye
  144: { rig: { SE: { seat: [8, -1, -26], eyesAt: [[4, 4]] }, E: { seat: [5, -2, -12], eyesAt: [[1, 3]] }, NE: { seat: [2, 0, -9] } }, no: ['back'] }, // Articuno: its own wings; turned, the seat and eyes slide down its near wing and neck
  145: { no: ['back'] }, // Zapdos: its own wings
  146: { rig: { SE: { seat: [8, -6, -4], eyesAt: [[2, 1]] }, E: { seat: [2, 6] }, NE: { seat: [4, -1, -15] } }, no: ['back'] }, // Moltres: its own wings; turned a little, the seat and eyes slide down to its chest, and in profile the seat tops its flames
  147: { no: ['back'] }, // Dratini: a serpent
  148: { no: ['back'] }, // Dragonair: a serpent
  152: { no: UPRIGHT }, // Chikorita: on four legs
  153: { no: UPRIGHT }, // Bayleef
  154: { no: ['neck', ...UPRIGHT] }, // Meganium: the petals around its neck
  155: { no: ['back'] }, // Cyndaquil: the flames on its back
  156: { no: ['neck', 'back'] }, // Quilava: flames at the neck and the back
  157: { no: ['neck'] }, // Typhlosion: the flame collar
  175: { no: ['back'] }, // Togepi: the shell
  179: { no: UPRIGHT }, // Mareep
  196: { no: UPRIGHT }, // Espeon
  197: { no: UPRIGHT }, // Umbreon
  212: { no: ['back'] }, // Scizor: its own wings
  220: { no: NO_BODY }, // Swinub: a ball of fur
  221: { no: NO_BODY }, // Piloswine: a mound of fur
  228: { no: UPRIGHT }, // Houndour
  229: { rig: { SE: { seat: [4, -3], eyesAt: [[0, 3]] } }, no: UPRIGHT }, // Houndoom: turned a little, a horn's dark inside reads as a second eye, and the seat drops to it
  '229:mega': { no: UPRIGHT }, // Mega Houndoom
  233: { no: UPRIGHT }, // Porygon2
  243: { no: UPRIGHT }, // Raikou
  244: { no: UPRIGHT }, // Entei
  245: { no: UPRIGHT }, // Suicune
  247: { no: NO_BODY }, // Pupitar: a cocoon
  249: { no: ['back'] }, // Lugia: its own wings
  250: { no: ['head', 'face', 'neck', 'back'] }, // Ho-Oh: its head hangs low between its wings, under a crest
  251: { no: ['back'] }, // Celebi: its own wings
  258: { no: UPRIGHT }, // Mudkip
  285: { no: NO_BODY }, // Shroomish: a mushroom cap
  287: { no: UPRIGHT }, // Slakoth
  304: { no: UPRIGHT }, // Aron
  305: { no: UPRIGHT }, // Lairon
  309: { no: UPRIGHT }, // Electrike
  310: { no: UPRIGHT }, // Manectric
  '310:mega': { no: UPRIGHT }, // Mega Manectric
  328: { no: NO_BODY }, // Trapinch: a head on legs
  329: { no: ['back'] }, // Vibrava: its own wings
  330: { no: ['back'] }, // Flygon: its own wings
  333: { no: ['back'] }, // Swablu: cotton wings
  334: { no: ['back'] }, // Altaria: cloud wings
  '334:mega': { no: ['neck', 'back'] }, // Mega Altaria: a small face in a big cloud that hides its neck
  349: { no: NO_BODY }, // Feebas
  350: { no: ['back'] }, // Milotic: a serpent
  353: { no: ['back'] }, // Shuppet: no shoulders
  362: { no: NO_BODY }, // Glalie: a floating head
  '362:mega': { no: NO_BODY }, // Mega Glalie
  363: { no: NO_BODY }, // Spheal
  364: { no: UPRIGHT }, // Sealeo
  365: { no: UPRIGHT }, // Walrein
  372: { no: NO_BODY }, // Shelgon: a shell
  373: { no: ['back'] }, // Salamence: its own wings
  374: { no: NO_BODY }, // Beldum
  375: { no: NO_BODY }, // Metang
  376: { no: NO_BODY }, // Metagross
  380: { no: ['back'] }, // Latias: its own wings
  '380:mega': { no: ['back'] }, // Mega Latias
  381: { no: ['back'] }, // Latios
  '381:mega': { no: ['back'] }, // Mega Latios
  382: { no: NO_BODY }, // Kyogre: a whale
  '382:primal': { no: NO_BODY }, // Primal Kyogre
  384: { no: ['back'] }, // Rayquaza: a serpent
  '384:mega': { no: ['back'] }, // Mega Rayquaza
  385: { no: ['head'] }, // Jirachi: the star is its head
  387: { no: UPRIGHT }, // Turtwig
  388: { no: ['back'] }, // Grotle: the shrubs on its shell
  389: { no: ['head', 'back'] }, // Torterra: the tree
  396: { no: UPRIGHT }, // Starly
  397: { no: UPRIGHT }, // Staravia
  398: { no: UPRIGHT }, // Staraptor
  403: { no: UPRIGHT }, // Shinx
  404: { no: UPRIGHT }, // Luxio
  405: { no: UPRIGHT }, // Luxray
  425: { no: NO_BODY }, // Drifloon: a balloon
  426: { no: NO_BODY }, // Drifblim: a balloon
  468: { no: ['back'] }, // Togekiss: its own wings
  470: { no: UPRIGHT }, // Leafeon
  471: { no: UPRIGHT }, // Glaceon
  473: { no: ['neck', ...UPRIGHT] }, // Mamoswine: a mound of fur
  483: { no: UPRIGHT }, // Dialga
  488: { no: ['back'] }, // Cresselia: its own wings
  '491:mega': { no: ['head', 'back'] }, // Mega Darkrai: the plume over its head, the shadows on its back
  493: { no: UPRIGHT }, // Arceus
  497: { no: ['back'] }, // Serperior: no shoulders to hang anything from
  498: { no: UPRIGHT }, // Tepig
  503: { no: UPRIGHT }, // Samurott
  524: { no: NO_BODY }, // Roggenrola
  525: { no: NO_BODY }, // Boldore
  570: { no: UPRIGHT }, // Zorua
  607: { no: ['head', 'back'] }, // Litwick: the flame is where a hat would go
  608: { no: NO_BODY }, // Lampent: a lamp
  609: { no: ['head', 'back'] }, // Chandelure: a flame on top of its head
  633: { no: UPRIGHT }, // Deino
  634: { no: UPRIGHT }, // Zweilous
  635: { no: ['back'] }, // Hydreigon: its own wings
  636: { no: UPRIGHT }, // Larvesta
  637: { no: ['back'] }, // Volcarona: its own wings
  652: { no: ['back'] }, // Chesnaught: the shell
  653: { no: UPRIGHT }, // Fennekin
  657: { no: ['neck'] }, // Frogadier: the bubbles at its neck
  658: { no: ['neck'] }, // Greninja: its tongue is already a scarf
  679: { no: NO_BODY }, // Honedge: a sword
  680: { no: NO_BODY }, // Doublade: two swords
  681: { no: NO_BODY }, // Aegislash: a sword and a shield
  '681:blade': { no: NO_BODY }, // Aegislash (Blade Forme)
  700: { no: UPRIGHT }, // Sylveon: on four legs
  708: { no: ['back'] }, // Phantump: a stump
  709: { no: ['back'] }, // Trevenant: a tree
  714: { no: ['back'] }, // Noibat: its own wings
  715: { no: ['back'] }, // Noivern: its own wings
  722: { no: UPRIGHT }, // Rowlet
  724: { no: ['back'] }, // Decidueye: the cloak is its own
  725: { no: UPRIGHT }, // Litten
  726: { no: UPRIGHT }, // Torracat
  728: { no: UPRIGHT }, // Popplio
  729: { no: UPRIGHT }, // Brionne
  730: { no: UPRIGHT }, // Primarina: on flippers
  736: { no: UPRIGHT }, // Grubbin
  737: { no: NO_BODY }, // Charjabug: a battery
  738: { no: NO_BODY }, // Vikavolt: its own wings, and its jaws are where a neck would be
  744: { no: UPRIGHT }, // Rockruff
  745: { no: UPRIGHT }, // Lycanroc
  770: { no: NO_BODY }, // Palossand: a sand castle
  816: { no: UPRIGHT }, // Sobble
  885: { no: ['back'] }, // Dreepy: a head and a tail
  911: { no: UPRIGHT }, // Skeledirge: on four legs
  935: { no: ['head'] }, // Charcadet: its head is a flame
  959: { no: ['back'] }, // Tinkaton: the hammer on its back
}
