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
  656: { rig: { S: { seat: [0, -2] }, SE: { seat: [0, -2] } } }, // Froakie: its eyes bulge from the top of its head, so the hat rests on them
  657: { no: ['neck'] }, // Frogadier: the bubbles at its neck
  658: { no: ['neck'] }, // Greninja: its tongue is already a scarf
  679: { rig: { S: { eyesAt: [[0, 5]] }, SE: { eyesAt: [[0, 5]] } }, no: NO_BODY }, // Honedge: a sword; its one eye in the guard isn't found
  680: { no: NO_BODY }, // Doublade: two swords
  681: { rig: { S: { seat: [0, 3], eyesAt: [[0, 3]] } }, no: NO_BODY }, // Aegislash: a sword and a shield; facing us its eye in the guard blinks shut, and without it the seat climbs the pommel's spike
  '681:blade': { no: NO_BODY }, // Aegislash (Blade Forme)
  700: { no: UPRIGHT }, // Sylveon: on four legs
  708: { no: ['back'] }, // Phantump: a stump
  709: { no: ['back'] }, // Trevenant: a tree
  714: { rig: { E: { eyesAt: [[4, 10]] } }, no: ['back'] }, // Noibat: its own wings; in profile its small eye under the ear isn't found
  715: { rig: { S: { seat: [0, 3, -13] } }, no: ['back'] }, // Noivern: its own wings; facing us the seat spans its ears and wings, a hat that wide swallowed its head
  722: { no: UPRIGHT }, // Rowlet
  724: { no: ['back'] }, // Decidueye: the cloak is its own
  725: { no: UPRIGHT }, // Litten
  726: { no: UPRIGHT }, // Torracat
  728: { rig: { E: { eyesAt: [[1, 6]] } }, no: UPRIGHT }, // Popplio: in profile a highlight on its head reads as the eye, which is further forward
  729: { no: UPRIGHT }, // Brionne
  730: { rig: { NE: { seat: [-8, -5] } }, no: UPRIGHT }, // Primarina: on flippers; turned away, the seat slips forward off its hair onto the brow
  736: { rig: { E: { seat: [1, -4, -11] } }, no: UPRIGHT }, // Grubbin: in profile the seat spans its whole body, at its jaws
  737: { rig: { E: { eyes: [-3, 2] } }, no: NO_BODY }, // Charjabug: a battery; in profile its front's corner reads as the eye
  738: { no: NO_BODY }, // Vikavolt: its own wings, and its jaws are where a neck would be
  744: { rig: { SE: { eyes: [5, -1] }, E: { eyes: [6, -1] } }, no: UPRIGHT }, // Rockruff: turned, the eyes are read off the dark of its ruff, behind the real ones
  745: { rig: { SE: { seat: [6, -1, -20], eyesAt: [[0, 6]] } }, no: UPRIGHT }, // Lycanroc: turned, the seat and the eyes are read off its white mane, behind the head
  770: { rig: { S: { seat: [0, -3, -20], eyesAt: [[-3, 5], [2, 5]] }, SE: { eyesAt: [[-1, 4], [4, 3]] } }, no: NO_BODY }, // Palossand: a sand castle; the hat goes on its middle tower, not over its walls, and its eyes are the tower's windows
  810: { rig: { NE: { seat: [0, -4] }, N: { seat: [0, -4] } } }, // Grookey: from behind the seat drops onto the back of its head
  813: { rig: { SE: { eyesAt: [[-2, 7], [3, 7]] }, E: { eyesAt: [[1, 7]] } } }, // Scorbunny: turned, its red eyes melt into the red of its face and aren't found
  816: { rig: { S: { seat: [0, -2] }, SE: { seat: [0, -2] }, E: { seat: [4, 0, -9], eyesAt: [[1, 4]] } }, no: UPRIGHT }, // Sobble: a short head with its eyes high, so the hat sits on its crown; in profile the seat spans the tail too
  817: { rig: { S: { eyes: [0, -3] }, SE: { seat: [3, 0, -7], eyesAt: [[-1, 6], [3, 6]] }, E: { seat: [3, 1, -10], eyesAt: [[1, 4]] } } }, // Drizzile: its fringe hides an eye; turned, the seat spans its curled tail and the eyes are read off it
  885: { rig: { S: { seat: [0, -1, -8] } }, no: ['back'] }, // Dreepy: a head and a tail; facing us the seat spans its fins
  886: { rig: { S: { seat: [0, 0, -15] }, SE: { seat: [0, 0, -12] } } }, // Drakloak: the seat spans its horns, a hat that wide hid them
  907: { rig: { E: { eyes: [5, -2] } } }, // Floragato: in profile a dark leaf on its cheek reads as the eye, which is further forward
  908: { no: ['neck'] }, // Meowscarada: its cloak's collar hides its neck
  911: { no: ['head', 'face', 'neck', ...UPRIGHT] }, // Skeledirge: on four legs, its fire bird perches where a hat would go, its eyes hide in its skull mask and its neck under its head
  912: { rig: { SE: { eyesAt: [[-1, 9], [3, 8]] }, E: { eyesAt: [[2, 8]] } } }, // Quaxly: its shiny's eyes, turned, aren't found under its crest
  935: { no: ['head'] }, // Charcadet: its head is a flame
  959: { no: ['back'] }, // Tinkaton: the hammer on its back
}
