import type { WearableSlot } from './cosmetics'
import type { WearableId } from './wearables'

/**
 * Hand fitting for the wearables, by dex (a form by `'<dex>:<form>'`: its own,
 * a Mega's sprite is drawn anew): what the measures of `npm run anchors`
 * (`data/wearAnchors/`) get wrong for a species. The dev console's
 * `ps.wear('fit', id)` shows the players' species wearing an item in every
 * direction, takes nudges from the keyboard and prints the table back in this shape.
 *
 * - `nudge`: px to move a slot's pivot by (right, down), for every direction or per
 *   art direction (`ART_DIRS`); the west-facing rows take the east-facing ones', mirrored.
 * - `size`: a slot's size class (0, 1, 2: `SIZE_CLASSES` in `render/wearModels.ts`) where the measured one is off.
 * - `no`: slots or items the species can't wear well (a flame where the hat goes,
 *   a shell or a tree where a cape hangs): left off, never drawn badly.
 */
export const ART_DIRS = ['S', 'SE', 'E', 'NE', 'N'] as const

export type ArtDirName = (typeof ART_DIRS)[number]

export type Nudge = readonly [number, number]

/** A `WEAR_FITS` key: a species' dex, or a form's `'<dex>:<form>'` (`anchorKey` in `render/wearFit.ts`, without the shiny's `s`). */
export type FitKey = number | `${number}:${string}`

export type SpeciesFit = {
  nudge?: Partial<Record<WearableSlot, Nudge | Partial<Record<ArtDirName, Nudge>>>>
  size?: Partial<Record<WearableSlot, 0 | 1 | 2>>
  no?: readonly (WearableSlot | WearableId)[]
}

/** What hangs down an upright back: on four legs (or a seal's flippers) it would hang off the side. */
const UPRIGHT = ['cape', 'royalCape', 'backpack', 'jetpack'] as const satisfies readonly WearableId[]

/** No neck to tie a scarf around and no back to hang anything from: a ball, a shell, a fish, a sword, a floating head. */
const NO_BODY = ['neck', 'back'] as const satisfies readonly WearableSlot[]

export const WEAR_FITS: Partial<Record<FitKey, SpeciesFit>> = {
  1: { nudge: { head: { S: [0, 3], N: [0, 3] }, face: { S: [0, 3], SE: [0, 2] } }, no: ['back'] }, // Bulbasaur: the bulb rises over its head and fills its back
  2: { nudge: { head: { S: [0, 5], SE: [3, 5], E: [5, 4], NE: [1, 3], N: [0, 3] }, face: { S: [0, 2], SE: [0, 2], E: [0, 1] } }, no: ['back'] }, // Ivysaur: the bud
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
  144: { nudge: { head: { S: [0, -5], SE: [-1, -5], E: [-1, -6], NE: [0, -6] } }, no: ['back'] }, // Articuno: the head sits under its crest; its own wings
  145: { size: { head: 1 }, no: ['back'] }, // Zapdos: its own wings (and its spikes widen its head)
  146: { no: ['back'] }, // Moltres: its own wings
  147: { no: ['back'] }, // Dratini: a serpent
  148: { no: ['back'] }, // Dragonair: a serpent
  152: { nudge: { head: { S: [0, 7], SE: [0, 4], NE: [0, 3], N: [0, 6] }, face: { S: [0, 3], SE: [0, 2] } }, no: UPRIGHT }, // Chikorita: the leaf
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
  229: { no: UPRIGHT }, // Houndoom
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
  '334:mega': { nudge: { head: { S: [0, 18] }, face: { S: [0, 16] } }, size: { head: 0, face: 0 }, no: ['neck', 'back'] }, // Mega Altaria: a small face in a big cloud that hides its neck
  349: { no: NO_BODY }, // Feebas
  350: { size: { head: 1 }, no: ['back'] }, // Milotic: a serpent (its brows widen its head)
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
  380: { size: { head: 1 }, no: ['back'] }, // Latias: its own wings, which widen its head
  '380:mega': { size: { head: 1 }, no: ['back'] }, // Mega Latias
  381: { size: { head: 1 }, no: ['back'] }, // Latios
  '381:mega': { size: { head: 1 }, no: ['back'] }, // Mega Latios
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
  468: { size: { head: 1 }, no: ['back'] }, // Togekiss: its own wings, which widen its head
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
  700: { nudge: { head: { SE: [-1, -9], E: [-1, -9] } }, no: UPRIGHT }, // Sylveon: its feelers lead the markers off its head
  708: { no: ['back'] }, // Phantump: a stump
  709: { no: ['back'] }, // Trevenant: a tree
  714: { no: ['back'] }, // Noibat: its own wings
  715: { no: ['back'] }, // Noivern: its own wings
  722: { no: UPRIGHT }, // Rowlet
  724: { nudge: { head: { E: [-6, 3] }, face: { E: [-5, 1] } }, no: ['back'] }, // Decidueye: the beak sticks out of the hood, the cloak is its own
  725: { no: UPRIGHT }, // Litten
  726: { no: UPRIGHT }, // Torracat
  728: { no: UPRIGHT }, // Popplio
  729: { no: UPRIGHT }, // Brionne
  730: { nudge: { head: { NE: [-9, 3] } }, no: UPRIGHT }, // Primarina: the ponytail
  736: { no: UPRIGHT }, // Grubbin
  737: { no: NO_BODY }, // Charjabug: a battery
  738: { size: { head: 1 }, no: NO_BODY }, // Vikavolt: its own wings, and its jaws are where a neck would be
  744: { no: UPRIGHT }, // Rockruff
  745: { no: UPRIGHT }, // Lycanroc
  770: { no: NO_BODY }, // Palossand: a sand castle
  816: { no: UPRIGHT }, // Sobble
  885: { no: ['back'] }, // Dreepy: a head and a tail
  911: { nudge: { head: { E: [6, 2] } }, no: UPRIGHT }, // Skeledirge: the head leads its long body
  935: { no: ['head'] }, // Charcadet: its head is a flame
  959: { nudge: { head: { S: [1, 21], SE: [6, 22] }, face: { S: [1, 21], SE: [6, 11] }, neck: { NE: [0, -23], N: [0, -17] } }, size: { head: 1, face: 1 }, no: ['back'] }, // Tinkaton: the hammer over its head throws the measures off
}
