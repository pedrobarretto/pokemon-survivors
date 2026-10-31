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
  2: { no: ['back'] }, // Ivysaur: the bud
  3: { no: ['head', 'back'] }, // Venusaur: the flower is where a hat or a cape would go
  6: { no: ['back'] }, // Charizard: its own wings
  '6:megaX': { no: ['back'] }, // Mega Charizard X: its own wings
  9: { no: ['back'] }, // Blastoise: the cannons
  16: { no: UPRIGHT }, // Pidgey: a bird's back is its wings
  17: { no: UPRIGHT }, // Pidgeotto
  18: { no: UPRIGHT }, // Pidgeot
  37: { no: UPRIGHT }, // Vulpix
  38: { no: ['back'] }, // Ninetales: the tails fill its back
  41: { no: ['face', 'back'] }, // Zubat: no eyes, and it's all wings
  42: { no: ['back'] }, // Golbat: its own wings
  58: { no: UPRIGHT }, // Growlithe
  59: { no: UPRIGHT }, // Arcanine
  60: { no: ['neck', ...UPRIGHT] }, // Poliwag: a round tadpole
  74: { no: NO_BODY }, // Geodude: a rock with arms
  76: { no: ['back'] }, // Golem: the shell
  92: { no: NO_BODY }, // Gastly: a ball of gas
  93: { no: NO_BODY }, // Haunter: a floating head and hands
  102: { no: ['face', ...NO_BODY] }, // Exeggcute: six eggs
  123: { no: ['back'] }, // Scyther: its own wings
  129: { no: NO_BODY }, // Magikarp
  130: { no: ['back'] }, // Gyarados: a serpent
  133: { no: UPRIGHT }, // Eevee
  134: { no: UPRIGHT }, // Vaporeon
  135: { no: UPRIGHT }, // Jolteon
  136: { no: UPRIGHT }, // Flareon
  137: { no: UPRIGHT }, // Porygon
  140: { no: NO_BODY }, // Kabuto: a shell
  144: { no: ['back'] }, // Articuno: its own wings
  145: { no: ['back'] }, // Zapdos: its own wings
  146: { no: ['back'] }, // Moltres: its own wings
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
  397: { rig: { SE: { eyesAt: [[3, 5]] } }, no: UPRIGHT }, // Staravia: turned a little, no eye is found
  398: { no: UPRIGHT }, // Staraptor
  403: { rig: { S: { eyesAt: [[-4, 4], [4, 4]] } }, size: { head: -8 }, no: UPRIGHT }, // Shinx: the seat spans the ears, and facing south the eyes are read on the paws
  404: { rig: { S: { eyesAt: [[-4, 7], [3, 7]] } }, size: { head: -12, face: -4 }, no: UPRIGHT }, // Luxio: the seat spans the ears
  405: { rig: { S: { eyes: [-1, 4] } }, size: { head: -5 }, no: UPRIGHT }, // Luxray: the seat spans the ears, the eyes are read on the brow
  425: { no: NO_BODY }, // Drifloon: a balloon
  426: { rig: { S: { eyesAt: [[-5, 4], [4, 4]] }, SE: { eyesAt: [[-1, 5], [7, 3]] }, E: { eyesAt: [[3, 5]] } }, no: NO_BODY }, // Drifblim: a balloon; its small red eyes aren't found, and hats came down over them
  447: { rig: { S: { eyesAt: [[-3, 6], [2, 6]] } }, size: { head: -6, face: -5 } }, // Riolu: the seat spans the ears hanging at its sides
  468: { size: { head: -15 }, no: ['back'] }, // Togekiss: its own wings (the seat spans them)
  470: { no: UPRIGHT }, // Leafeon
  471: { no: UPRIGHT }, // Glaceon
  473: { no: ['neck', ...UPRIGHT] }, // Mamoswine: a mound of fur
  483: { no: UPRIGHT }, // Dialga
  488: { no: ['back'] }, // Cresselia: its own wings
  '491:mega': { no: ['head', 'back'] }, // Mega Darkrai: the plume over its head, the shadows on its back
  493: { rig: { S: { seat: [0, -4], eyesAt: [[-3, 3], [3, 3]] } }, no: UPRIGHT }, // Arceus: facing south the seat and the eyes are read on its face mask, under the eyes; the hat goes on the crest's base
  495: { rig: { S: { eyes: [0, -2], neck: [0, 2] } } }, // Snivy: facing south its yellow collar reads as the eyes and the neck sits on the face
  496: { rig: { S: { eyesAt: [[-3, 5], [3, 5]], neck: [0, 1] }, SE: { neck: [-1, 3] }, E: { neck: [-2, 4] } } }, // Servine: facing south its eyes aren't found; turned, the neck is read on its snout
  497: { rig: { S: { seat: [0, 1], eyes: [0, 4], neck: [0, 2] }, SE: { eyesAt: [[0, 5]], neck: [-3, 5] } }, size: { head: 2 }, no: ['back'] }, // Serperior: no shoulders to hang anything from; the eyes are read on its brow, the neck on its chin
  498: { no: UPRIGHT }, // Tepig
  503: { no: UPRIGHT }, // Samurott
  524: { no: ['face', ...NO_BODY] }, // Roggenrola: a rock; the yellow hexagon is an ear, it has no eyes to wear glasses on
  525: { rig: { all: { eyes: 'none' } }, no: ['face', ...NO_BODY] }, // Boldore: a rock with no eyes (the dark gaps beside its crest read as eyes and cut the hats)
  559: { rig: { S: { eyesAt: [[-4, 6], [4, 6]] }, SE: { eyesAt: [[-2, 6], [5, 6]] } } }, // Scraggy: its eyes at the sides of its head aren't found
  570: { no: UPRIGHT }, // Zorua
  607: { rig: { S: { eyesAt: [[-1, 10], [3, 10]] }, SE: { eyesAt: [[-1, 10], [3, 10]] }, E: { eyes: 'none' } }, no: ['head', 'back'] }, // Litwick: the flame is where a hat would go; the wax's shading reads as eyes (one shows, the other is under the wax)
  608: { rig: { all: { seat: [0, -6] }, S: { eyesAt: [[-4, 7], [3, 7]] }, SE: { seat: [-1, 0], eyesAt: [[0, 7], [5, 7]] }, E: { eyesAt: [[2, 7]] } }, size: { head: -4 }, no: NO_BODY }, // Lampent: a lamp; the hat goes on its cap, not round its brim over the eyes
  609: { no: ['head', 'back'] }, // Chandelure: a flame on top of its head
  633: { no: UPRIGHT }, // Deino
  634: { rig: { S: { seat: [9, -1], eyesAt: [[-2, 4], [2, 4]], neck: [7, 0] }, SE: { seat: [10, -5], eyesAt: [[-1, 4], [3, 4]], neck: [6, -3] }, E: { seat: [7, -8], eyesAt: [[2, 3]], neck: [5, -3] }, N: { seat: [-13, 2], neck: [-7, -4] } }, size: { head: -13, neck: -10 }, no: UPRIGHT }, // Zweilous: two heads, the rig reads both as one; everything goes on its left head
  635: { size: { head: 3 }, no: ['back'] }, // Hydreigon: its own wings; the seat is read narrower than the crest the hat must cover
  636: { no: UPRIGHT }, // Larvesta
  637: { rig: { S: { eyesAt: [[-2, 5], [2, 5]] }, SE: { seat: [7, -2], eyesAt: [[0, 5], [3, 4]] }, E: { seat: [2, -2], eyesAt: [[2, 5]] } }, size: { head: -17, neck: -12 }, no: ['back'] }, // Volcarona: its own wings (the seat spans them)
  651: { rig: { SE: { eyesAt: [[1, 3], [6, 2]] } } }, // Quilladin: turned a little, its eyes under the shell aren't found
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
