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
  287: { rig: { S: { seat: [0, 0, -8] }, SE: { seat: [1, 1] }, E: { seat: [6, 2, -10] } }, size: { face: -4 }, no: UPRIGHT }, // Slakoth: lying flat, the seat spans its arms facing south and its whole back in profile, where the head is the front end
  304: { no: UPRIGHT }, // Aron
  305: { rig: { SE: { back: [4, -9] }, E: { back: [8, -9] } }, no: UPRIGHT }, // Lairon: on four legs the back point falls under the body, so the wings hung from its rump
  306: { rig: { S: { seat: [0, 0, -10], eyesAt: [[-2, 4], [2, 4]] }, SE: { eyesAt: [[-1, 6]] }, E: { eyesAt: [[3, 6]] } }, size: { neck: -3 } }, // Aggron: the seat and the neck span its shoulder plates facing south, and the armor's dark holes read as eyes where its blue eyes are
  309: { rig: { SE: { back: [3, -9] }, E: { back: [5, -8] } }, no: UPRIGHT }, // Electrike: on four legs the back point falls under the body, so the wings hung from its rump
  310: { rig: { SE: { back: [3, -6] }, E: { back: [3, -4] } }, no: UPRIGHT }, // Manectric: on four legs the back point falls under the body
  '310:mega': { rig: { E: { seat: [7, 2, -16] } }, no: UPRIGHT }, // Mega Manectric: in profile the seat spans its whole mane, behind the head
  328: { rig: { SE: { eyesAt: [[-5, 6]] } }, no: NO_BODY }, // Trapinch: a head on legs; turned a little, one eye shows, read as two
  329: { rig: { S: { eyesAt: [[-4, 4], [4, 4]] }, SE: { seat: [5, 1, -8] }, E: { seat: [4, 0, -12] } }, no: ['back'] }, // Vibrava: its own wings; the seat spans them, behind its small head, and facing south the eyes found sit between its green ones
  330: { no: ['back'] }, // Flygon: its own wings
  333: { rig: { S: { seat: [0, -2] }, SE: { seat: [6, -1, -8] }, E: { seat: [2, 0] }, NE: { seat: [2, 1] } }, size: { head: -16, face: -4, neck: -3 }, no: ['back'] }, // Swablu: cotton wings, which the seat and the face span; its head is the small blue ball between them
  334: { rig: { S: { seat: [0, -2] } }, size: { head: -29, face: -4, neck: -12 }, no: ['back'] }, // Altaria: cloud wings; facing south the seat, the face and the neck span the cloud, around its small head
  '334:mega': { rig: { S: { seat: [0, 17, -31], eyesAt: [[-2, 6], [3, 6]] }, SE: { seat: [-1, 4, -8], eyesAt: [[-3, 6], [2, 6]] }, E: { eyesAt: [[3, 3]] } }, size: { face: -25 }, no: ['neck', 'back'] }, // Mega Altaria: a small face in a big cloud that hides its neck; the seat found is the cloud's top, the eyes found its folds
  349: { no: NO_BODY }, // Feebas
  350: { no: ['back'] }, // Milotic: a serpent
  353: { no: ['back'] }, // Shuppet: no shoulders
  361: { rig: { S: { eyesAt: [[-2, 9], [2, 9]] }, SE: { eyesAt: [[2, 9], [5, 9]] }, E: { seat: [-4, -5, 8], eyesAt: [[5, 8]] } }, size: { face: -9 } }, // Snorunt: the eyes found are its mouth, low in the hood, the face spans the whole hood, and in profile the seat found is the hood's opening, under its top
  362: { rig: { S: { seat: [0, -13, -2], eyesAt: [[-5, 11], [5, 11]] }, SE: { eyesAt: [[2, 11], [8, 9]] }, E: { seat: [-4, 0, 6] } }, no: NO_BODY }, // Glalie: a floating head; facing south its teeth read as eyes and the seat drops onto them
  '362:mega': { rig: { S: { seat: [0, 0, 8], eyesAt: [[-4, 11], [3, 11]] }, SE: { eyesAt: [[1, 13], [8, 11]] }, E: { seat: [0, -3], eyesAt: [[7, 10]] } }, no: NO_BODY }, // Mega Glalie: the eyes found are the blue crest and the jaw's folds, far from its red eyes; facing south the seat is only the crest, in profile it sinks into the brow
  363: { no: NO_BODY }, // Spheal
  364: { rig: { SE: { seat: [6, 0], eyesAt: [[-1, 5]] } }, size: { face: -6 }, no: UPRIGHT }, // Sealeo: turned a little, the seat falls behind its head and the head's outline reads as a second eye; the face found spans its whiskers
  365: { rig: { E: { eyesAt: [[3, 5]] } }, no: UPRIGHT }, // Walrein: in profile its small eye in the mane isn't found
  371: { rig: { SE: { seat: [-1, -7] }, E: { seat: [-4, -7] } } }, // Bagon: turned, the seat drops under its helmet, onto its face
  372: { rig: { S: { seat: [0, 0, -5] }, E: { seat: [0, 0, -5] } }, no: NO_BODY }, // Shelgon: a shell, its face peeking out of the opening; a hat as wide as the whole shell swallowed it
  373: { rig: { S: { seat: [0, -4] }, SE: { seat: [-6, -1, -2] } }, no: ['back'] }, // Salamence: its own wings; the seat sits on its brow facing south and slides off its head onto the crest's tip turned a little (on Walk: Idle's SE seat is on its back, see the PR)
  374: { no: ['roundGlasses', 'sunglasses', 'noseGlasses', 'heartShades', 'goggles', 'starShades', 'masquerade', ...NO_BODY] }, // Beldum: one eye (a monocle or a patch, never a pair of lenses), and no neck or back
  375: { rig: { S: { eyesAt: [[-4, 7], [4, 7]] }, SE: { eyesAt: [[2, 8], [8, 6]] }, E: { seat: [-7, 0, 7], eyesAt: [[1, 9]] } }, no: NO_BODY }, // Metang: the white spikes at its edges read as eyes where its red ones are, and in profile the seat is its front spike
  376: { rig: { S: { eyesAt: [[-4, 9], [4, 9]] }, SE: { seat: [1, -9, -4], eyesAt: [[-1, 8], [5, 6]] } }, no: NO_BODY }, // Metagross: the X's arms read as eyes where its red ones are, and turned a little the seat drops onto the X
  377: { rig: { S: { seat: [0, -4, -17], eyesAt: [[-2, 3], [2, 3]] }, SE: { seat: [-2, 2, -5], eyesAt: [[-1, 3], [3, 4]] }, E: { seat: [3, 1], eyesAt: [[1, 5]] } } }, // Regirock: its eyes are the dots; facing south the seat cuts through them and spans the shoulder rocks, turned it sits on a shoulder
  378: { rig: { SE: { seat: [4, 1], eyesAt: [[-1, 9], [4, 9]] }, E: { eyesAt: [[3, 9]] } } }, // Regice: its eyes are the dots; turned, the eyes found are dents over them and the seat sits on an ear spike, and in profile they aren't found
  379: { rig: { S: { eyesAt: [[-2, 9], [2, 9]] }, SE: { eyesAt: [[1, 9], [5, 9]] }, E: { eyesAt: [[8, 9]] } } }, // Registeel: its eyes are the dots, the eyes found the dark band's top corners
  380: { no: ['back'] }, // Latias: its own wings
  '380:mega': { no: ['back'] }, // Mega Latias
  381: { no: ['back'] }, // Latios
  '381:mega': { no: ['back'] }, // Mega Latios
  382: { no: NO_BODY }, // Kyogre: a whale
  '382:primal': { no: NO_BODY }, // Primal Kyogre
  383: { rig: { SE: { eyesAt: [[-2, 9]] }, E: { seat: [3, -2, 4], eyesAt: [[1, 7]] } } }, // Groudon: turned, the crest's stripes read as eyes over its yellow one, and in profile the seat sinks behind the crest
  384: { rig: { S: { eyesAt: [[-5, 10], [4, 10]] }, E: { seat: [4, 1, -12] } }, no: ['back'] }, // Rayquaza: a serpent; facing south its nostrils read as eyes under its yellow ones, and in profile the seat spans its horns
  '384:mega': { size: { face: -8 }, no: ['back'] }, // Mega Rayquaza: a serpent; the face found spans its whiskers
  385: { rig: { SE: { eyesAt: [[-2, 8], [3, 7]] } }, no: ['head'] }, // Jirachi: the star is its head; turned a little, the star's point reads as an eye
  '386:speed': { rig: { SE: { eyesAt: [[0, 8]] }, E: { eyesAt: [[3, 6]] } } }, // Deoxys (Speed Forme): turned, the head's dark plates read as eyes beside its white one, and in profile it isn't found
  '386:attack': { rig: { S: { seat: [0, 0, -5], eyesAt: [[-2, 4], [2, 4]] }, SE: { seat: [2, 1], eyesAt: [[2, 6]] }, E: { seat: [2, 0], eyesAt: [[2, 5]] } } }, // Deoxys (Attack Forme): the seat spans its head's side spikes, and turned, the eyes found are the spikes' dark edges, or none
  387: { no: UPRIGHT }, // Turtwig
  388: { no: ['head', 'back'] }, // Grotle: its shell overhangs its head (a hat on it swallows the shell, under it the shell buries it) and the shrubs fill its back
  389: { no: ['head', 'back'] }, // Torterra: the tree
  390: { rig: { S: { seat: [0, -2, -2], neck: [0, 1] }, SE: { seat: [0, -2] } } }, // Chimchar: facing it, the seat sinks into its forehead, so the brims came down to its eyes, and the neck rides up onto its mouth
  391: { rig: { S: { seat: [0, -3, -4] }, SE: { seat: [0, -3, -2] }, E: { seat: [0, -2] } } }, // Monferno: the seat drops to the top of its blue mask, under its pointed crown, so the brims came down to its eyes
  392: { rig: { S: { eyesAt: [[-2, 11], [3, 11]] }, SE: { seat: [-3, 1, -4], eyesAt: [[0, 8]] }, E: { seat: [6, 1, -6], eyesAt: [[2, 8]] } } }, // Infernape: the eyes found are its face's edges or its arm, and turned the seat follows its flame off its head
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
