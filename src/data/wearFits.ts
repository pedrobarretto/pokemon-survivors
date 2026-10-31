import type { WearableSlot } from './cosmetics'
import type { WearableId } from './wearables'

/**
 * Hand fitting for the wearables, by dex (a form by `'<dex>:<form>'`: its own,
 * a Mega's sprite is drawn anew; a shiny whose sheets differ by `'<dex>s'` or
 * `'<dex>:<form>s'`, its own too, else it wears its normal colors'): what the
 * head rig of `npm run rig` (`data/wearRig/`, `render/wearRig.ts`) gets wrong
 * for a species. The rig reads each direction's head once, on a Walk frame,
 * and tracks it into every frame of Walk, Idle and Hurt, so a fix of a
 * direction holds for all of them. The dev console's `ps.rig(dex)` shows a
 * frame's rig, takes fixes by mouse and keys and prints them back in this shape.
 *
 * - `rig`: fixes to the measures (`FixScope`): for every direction (`all`), an
 *   art direction (`ART_DIRS`; the west-facing rows take the east-facing
 *   ones', mirrored), an anim (`Idle`) or an anim facing one way (`'E:Idle'`,
 *   where an anim isn't the same drawing as Walk's: a flying Walk, a curled
 *   Hurt), applied in that order, in px (right, down), on every frame of
 *   their scope: `seat` moves the hat's seat (a third number widens its
 *   opening, which sizes the hat in that direction), `eyes` moves the eyes
 *   found (`'none'`: there are none to see), `eyesAt` puts them (from the
 *   seat) in place of those found, `left` and `right` move one eye of a pair
 *   (the left and right one facing east) or drop it (`'none'`: a false eye),
 *   `neck` and `back` move those points, and `over` lists pixels (from the
 *   seat) of the sprite drawn over any hat, a horn or a crest in front of it.
 *   Moves add up across scopes; the eyes take the narrowest scope's.
 * - `size`: px to add to a slot's measured size (its width) where the rig's is off.
 * - `no`: slots or items the species can't wear well (a flame where the hat
 *   goes, a shell or a tree where a cape hangs), or can't facing one way
 *   (`'head:S'`, its mirror too): left off, never drawn badly. The last
 *   resort: each says why.
 */
export const ART_DIRS = ['S', 'SE', 'E', 'NE', 'N'] as const

export type ArtDirName = (typeof ART_DIRS)[number]

export type Nudge = readonly [number, number]

/** A `WEAR_FITS` key: a species' dex, a form's `'<dex>:<form>'`, either with an `s` for a shiny whose sheets differ (`rigKey` in `render/wearFit.ts`). */
export type FitKey = number | `${number}:${string}` | `${number}s`

/** The anims a rig fix may single out. */
export const FIX_ANIMS = ['Walk', 'Idle', 'Hurt'] as const

/** What a `rig` fix applies to, broadest first: every frame, a direction, an anim, an anim facing one way. */
export type FixScope = 'all' | ArtDirName | (typeof FIX_ANIMS)[number] | `${ArtDirName}:${(typeof FIX_ANIMS)[number]}`

export type RigFix = {
  seat?: Nudge | readonly [number, number, number]
  eyes?: Nudge | 'none'
  eyesAt?: readonly Nudge[]
  left?: Nudge | 'none'
  right?: Nudge | 'none'
  neck?: Nudge
  back?: Nudge
  over?: readonly Nudge[]
}

/** What `no` leaves off: a slot or an item, everywhere or facing one way (`'head:S'`). */
export type NoKey = WearableSlot | WearableId | `${WearableSlot | WearableId}:${ArtDirName}`

export type SpeciesFit = {
  rig?: Partial<Record<FixScope, RigFix>>
  size?: Partial<Record<WearableSlot, number>>
  no?: readonly NoKey[]
}

/** What hangs down an upright back: on four legs (or a seal's flippers) it would hang off the side. */
const UPRIGHT = ['cape', 'royalCape', 'backpack', 'jetpack'] as const satisfies readonly WearableId[]

/** No neck to tie a scarf around and no back to hang anything from: a ball, a shell, a fish, a sword, a floating head. */
const NO_BODY = ['neck', 'back'] as const satisfies readonly WearableSlot[]

/** Drawn from above, not from the side the wearables are drawn from: a hat lands on the body, glasses and a scarf hang off the head. */
const SEEN_FROM_ABOVE = ['head', 'face', 'neck', 'back'] as const satisfies readonly WearableSlot[]

export const WEAR_FITS: Partial<Record<FitKey, SpeciesFit>> = {
  1: { no: ['back'] }, // Bulbasaur: the bulb rises over its head and fills its back
  2: { rig: { S: { seat: [0, 10, 9], eyesAt: [[-4, 5], [4, 5]], neck: [0, 12] }, SE: { seat: [4, 10, 6], eyesAt: [[3, 5]], neck: [4, 17] }, E: { seat: [6, 8, 5], eyesAt: [[5, 5]], neck: [7, 13] }, NE: { seat: [5, 6] } }, no: ['back'] }, // Ivysaur: the bud; its sheets' mouth marker sits on the bud, so the rig is measured there, not on the head under it
  3: { rig: { NE: { neck: [-2, 6] }, N: { neck: [0, 5] } }, no: ['head', 'back'] }, // Venusaur: the flower is where a hat or a cape would go; facing away, the neck under it
  5: { rig: { SE: { seat: [-1, -4], eyesAt: [[-3, 5], [2, 4]] }, E: { seat: [-3, -3], eyesAt: [[0, 5]] } } }, // Charmeleon: turned, its blue eyes aren't found and the seat drops to their line walking (idle, it looks up: the seat meets both halfway)
  6: { no: ['back'] }, // Charizard: its own wings
  '6:megaX': { rig: { S: { seat: [0, -2, -7], eyes: [0, -3] }, SE: { eyesAt: [[0, 5]] }, E: { eyesAt: [[6, 4]] } }, size: { face: -10, neck: -9 }, no: ['back'] }, // Mega Charizard X: its own wings; facing south its seat, face and neck span the wings, and its blue cheeks read as eyes
  9: { no: ['back'] }, // Blastoise: the cannons
  16: { no: UPRIGHT }, // Pidgey: a bird's back is its wings
  17: { no: UPRIGHT }, // Pidgeotto
  18: { no: UPRIGHT }, // Pidgeot
  37: { no: UPRIGHT }, // Vulpix
  38: { rig: { S: { seat: [1, 7, -6], eyesAt: [[-3, 4], [1, 4]] }, SE: { seat: [2, 6, -8], eyesAt: [[3, 5]] }, E: { seat: [4, 2, -8], eyesAt: [[3, 4]] } }, size: { face: -4 }, no: ['back'] }, // Ninetales: the tails fill its back; the seat found is its crest's tip and the eyes its fur's marks
  41: { rig: { S: { seat: [0, 0, -3] }, SE: { seat: [2, 0, -3] }, NE: { seat: [2, 0, -4] } }, size: { neck: -4 }, no: ['face', 'back'] }, // Zubat: no eyes, and it's all wings, which the seat spans
  42: { rig: { SE: { seat: [-2, 2, -2] }, E: { seat: [2, 1] } }, no: ['back'] }, // Golbat: its own wings, which the seat lands on turned a little
  58: { no: UPRIGHT }, // Growlithe
  59: { no: UPRIGHT }, // Arcanine
  60: { no: ['neck', ...UPRIGHT] }, // Poliwag: a round tadpole
  '65:mega': { rig: { S: { seat: [0, -7, -23], eyesAt: [[-2, 5], [2, 5]] }, SE: { seat: [0, 3] }, E: { seat: [0, 3] } }, size: { face: -22, neck: -14, back: -10 } }, // Mega Alakazam: facing south the seat, face and neck span its five spoons and its eyes aren't found; turned, the seat is its crest's tip
  74: { rig: { S: { seat: [0, 0, -3] }, SE: { seat: [3, 0, -8], eyesAt: [[-1, 5], [2, 5]] }, NE: { seat: [0, 1, -6] }, N: { seat: [0, 0, -14] } }, no: NO_BODY }, // Geodude: a rock with arms, which the seat spans; turned a little, a fist reads as an eye
  76: { no: ['back'] }, // Golem: the shell
  92: { rig: { S: { seat: [0, -5], eyes: [0, -4] }, SE: { seat: [1, -3], eyesAt: [[-1, 5], [6, 3]] }, E: { seat: [0, -3], eyesAt: [[0, 5]] }, NE: { seat: [-5, -1] }, N: { seat: [0, 3, 6] } }, no: NO_BODY }, // Gastly: a ball of gas; the seat drops into its face between the eyes, which are found by their lower edge, and not at all turned
  93: { no: NO_BODY }, // Haunter: a floating head and hands
  '94:mega': { rig: { SE: { eyes: [0, -2] }, E: { eyes: [0, -2] } } }, // Mega Gengar: turned, its grin's top reads as the eyes
  102: { rig: { S: { seat: [0, 0, -4] }, SE: { seat: [0, 2, -5] }, E: { seat: [3, 3, -4] }, NE: { seat: [0, 0, -2] } }, no: ['face', ...NO_BODY] }, // Exeggcute: six eggs; a hat sized to one egg, not to the clutch
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
  143: { rig: { S: { seat: [0, -3] }, SE: { seat: [1, 2, 1] }, E: { eyes: [9, 1] } } }, // Snorlax: facing south the seat drops to its face's top, turned a little it's an ear's tip, and in profile an ear's inside reads as the eye
  144: { rig: { SE: { seat: [15, -1, -26], eyesAt: [[4, 4]] }, E: { seat: [5, -2, -12], eyesAt: [[1, 3]] }, NE: { seat: [6, 0, -3] } }, no: ['back'] }, // Articuno: its own wings; turned, the seat and eyes slide down its near wing and neck
  145: { no: ['back'] }, // Zapdos: its own wings
  146: { rig: { SE: { seat: [11, 0, -22], eyesAt: [[2, 1]] }, E: { seat: [3, 9, 1] }, NE: { seat: [4, -1, -15] } }, no: ['back'] }, // Moltres: its own wings; turned a little, the seat and eyes slide down to its chest, and in profile the seat tops its flames
  147: { no: ['back'] }, // Dratini: a serpent
  148: { no: ['back'] }, // Dragonair: a serpent
  152: { no: UPRIGHT }, // Chikorita: on four legs
  153: { no: UPRIGHT }, // Bayleef
  154: { no: ['neck', ...UPRIGHT] }, // Meganium: the petals around its neck
  155: { rig: { all: { seat: [0, -2] }, S: { seat: [0, 0, 2] } }, no: ['back'] }, // Cyndaquil: the flames on its back; its closed eyes sit 3 px under the crown, so hats sit higher
  156: { rig: { SE: { seat: [3, 0, -5] }, E: { seat: [6, 0, -12] } }, no: ['neck', 'back'] }, // Quilava: flames at the neck and the back; turned, the seat spanned the whole back
  157: { no: ['neck'] }, // Typhlosion: the flame collar
  159: { rig: { S: { eyes: [0, -3] }, E: { seat: [0, 0, -5], eyesAt: [[1, 2]] } }, size: { head: 1 } }, // Croconaw: facing south the jaw's corners read as its eyes, and the seat spans the cheeks
  160: { rig: { SE: { seat: [4, 0, -5] } }, size: { head: -3 } }, // Feraligatr: the seat spanned its shoulders
  169: { size: { head: -11 } }, // Crobat: facing south the seat spanned its wings
  172: { size: { head: -3 } }, // Pichu: the seat spanned the ears' roots
  175: { rig: { S: { eyesAt: [[-4, 6], [5, 6]] }, E: { eyesAt: [[2, 6]] } }, no: ['back'] }, // Togepi: the shell; facing south its spikes' tips read as eyes
  176: { rig: { E: { eyes: [6, 3] } } }, // Togetic: in profile a shade on its crown read as the eye
  179: { rig: { S: { seat: [3, 7, 2] }, SE: { seat: [3, 0, -8] }, E: { seat: [7, 0, -12] } }, size: { head: -3 }, no: UPRIGHT }, // Mareep: the seat spanned the whole wool ball; the hat goes on the head, in front
  183: { size: { head: -4 } }, // Marill: the seat spanned its ears
  186: { rig: { S: { seat: [0, -6, 10], eyes: [0, -2] }, SE: { seat: [0, -1] } }, size: { head: -1 } }, // Politoed: facing south the seat dropped to its eyes and spanned the whole body
  196: { rig: { S: { eyes: [7, 5] } }, size: { head: 4, face: -9 }, no: UPRIGHT }, // Espeon: facing south the seat spanned its ears and an ear's inside read as its one eye
  197: { rig: { SE: { eyes: [1, 0] }, E: { seat: [6, -4, -10], eyesAt: [[2, 4]] } }, size: { head: -2 }, no: UPRIGHT }, // Umbreon: in profile the seat spanned its back at the eyes' height
  212: { no: ['back'] }, // Scizor: its own wings
  216: { size: { head: -6 } }, // Teddiursa: facing south the seat spanned its ears
  220: { no: NO_BODY }, // Swinub: a ball of fur
  221: { no: NO_BODY }, // Piloswine: a mound of fur
  228: { no: UPRIGHT }, // Houndour
  229: { rig: { SE: { seat: [4, 1], eyesAt: [[0, 3]] } }, no: UPRIGHT }, // Houndoom: turned a little, a horn's dark inside reads as a second eye, and the seat drops to it
  '229:mega': { no: UPRIGHT }, // Mega Houndoom
  230: { rig: { S: { seat: [0, -1, 2] }, SE: { seat: [3, 3, 1] }, E: { seat: [14, 3, -10] } }, size: { head: -2 } }, // Kingdra: the seat spanned its spines, and turned it slid back onto its body
  233: { rig: { E: { seat: [4, -1, -3], eyesAt: [[1, 5]] } }, no: UPRIGHT }, // Porygon2: walking in profile the seat spans its whole body (standing it doesn't: the nudge splits the two)
  243: { rig: { S: { seat: [0, 2] } }, size: { head: -8 }, no: UPRIGHT }, // Raikou: facing south the seat spanned its mane
  244: { rig: { S: { seat: [0, -6] }, SE: { seat: [6, 5, 1] }, E: { seat: [7, -2, -8] } }, size: { head: -4 }, no: UPRIGHT }, // Entei: the hat goes over the crest, not on the face; in profile the seat slid back onto its mane
  245: { rig: { S: { seat: [0, 7, 9] }, SE: { seat: [4, 6, -1] }, E: { seat: [6, 4, -13] } }, size: { head: -1 }, no: UPRIGHT }, // Suicune: the seat sat on the mane, not the head (turned, walking and standing disagree by 12 px: the nudge splits them)
  247: { rig: { all: { seat: [0, -2, -3] }, S: { seat: [0, 0, 1] }, SE: { seat: [0, 0, 3] } }, no: NO_BODY }, // Pupitar: a cocoon; its eyes sit right under the shell's top, and the seat spanned its spikes
  249: { no: ['back'] }, // Lugia: its own wings
  250: { no: ['head', 'face', 'neck', 'back'] }, // Ho-Oh: its head hangs low between its wings, under a crest
  251: { no: ['back'] }, // Celebi: its own wings
  253: { rig: { E: { eyesAt: [[-1, 3]] } } }, // Grovyle: its eye in profile isn't found
  254: { rig: { SE: { eyesAt: [[-1, 4]] }, E: { eyesAt: [[0, 6]] } } }, // Sceptile: its eye turned and in profile isn't found
  '254:mega': { rig: { SE: { eyesAt: [[-1, 5]] } } }, // Mega Sceptile: its eye turned isn't found
  255: { rig: { S: { seat: [0, -2] }, SE: { seat: [0, -1] }, E: { seat: [0, -1] } } }, // Torchic: all head, its eyes right under the crest
  256: { rig: { E: { eyesAt: [[1, 4]] } } }, // Combusken: its eye in profile isn't found
  257: { rig: { S: { seat: [0, -2] }, SE: { seat: [2, 0, -1] }, E: { seat: [3, 0, -7], eyesAt: [[2, 5]] } } }, // Blaziken: the seat sat on its brow, and turned it spanned the hair
  258: { rig: { S: { seat: [0, -1, 1] }, SE: { seat: [0, -1, -3] } }, size: { head: -4 }, no: UPRIGHT }, // Mudkip: the seat spanned the gills
  260: { rig: { SE: { seat: [-1, 1, -3] }, E: { seat: [1, 4, -1] } }, size: { head: -4 } }, // Swampert: the seat spanned the gills, and turned it sat on the fin
  280: { rig: { E: { seat: [0, 0, -2] } } }, // Ralts: in profile the seat spanned its horns
  285: { rig: { S: { eyesAt: [[-3, 6], [3, 6]] }, E: { eyes: [3, 10] } }, size: { head: -5 }, no: NO_BODY }, // Shroomish: a mushroom cap; facing south its closed eyes aren't found, in profile a fleck on the cap reads as the eye
  287: { rig: { S: { seat: [0, 1, -1] }, SE: { seat: [1, 1, 5] }, E: { seat: [6, 2, -10] } }, size: { face: -4 }, no: UPRIGHT }, // Slakoth: lying flat, the seat spans its arms facing south and its whole back in profile, where the head is the front end
  304: { no: UPRIGHT }, // Aron
  305: { rig: { SE: { back: [4, -9] }, E: { back: [8, -9] } }, no: UPRIGHT }, // Lairon: on four legs the back point falls under the body, so the wings hung from its rump
  306: { rig: { S: { seat: [0, 0, 2], eyesAt: [[-2, 4], [2, 4]] }, SE: { eyesAt: [[-1, 6]] }, E: { eyesAt: [[3, 6]] } }, size: { neck: -3 } }, // Aggron: the seat and the neck span its shoulder plates facing south, and the armor's dark holes read as eyes where its blue eyes are
  309: { rig: { SE: { back: [3, -9] }, E: { back: [5, -8] } }, no: UPRIGHT }, // Electrike: on four legs the back point falls under the body, so the wings hung from its rump
  310: { rig: { SE: { back: [3, -6] }, E: { back: [3, -4] } }, no: UPRIGHT }, // Manectric: on four legs the back point falls under the body
  '310:mega': { rig: { E: { seat: [7, 2, -16] } }, no: UPRIGHT }, // Mega Manectric: in profile the seat spans its whole mane, behind the head
  328: { rig: { SE: { eyesAt: [[-5, 6]] } }, no: NO_BODY }, // Trapinch: a head on legs; turned a little, one eye shows, read as two
  329: { rig: { S: { eyesAt: [[-4, 7], [4, 7]] }, SE: { seat: [5, 1, -4] }, E: { seat: [4, 1, -9] } }, no: ['back'] }, // Vibrava: its own wings; the seat spans them, behind its small head, and facing south the eyes found sit between its green ones
  330: { no: ['back'] }, // Flygon: its own wings
  333: { rig: { S: { seat: [0, -2, 13] }, SE: { seat: [6, -1, -1] }, E: { seat: [2, 0, 2] }, NE: { seat: [2, 1] } }, size: { neck: -3, head: -3, face: -4 }, no: ['back'] }, // Swablu: cotton wings, which the seat and the face span; its head is the small blue ball between them
  334: { rig: { S: { seat: [0, -1] } }, size: { head: -29, face: -4, neck: -12 }, no: ['back'] }, // Altaria: cloud wings; facing south the seat, the face and the neck span the cloud, around its small head
  '334:mega': { rig: { S: { seat: [0, 22, -23], eyesAt: [[-2, 6], [3, 6]] }, SE: { seat: [-1, 9, -6], eyesAt: [[-3, 6], [2, 6]] }, E: { eyesAt: [[3, 3]] } }, size: { face: -25 }, no: ['neck', 'back'] }, // Mega Altaria: a small face in a big cloud that hides its neck; the seat found is the cloud's top, the eyes found its folds
  349: { no: NO_BODY }, // Feebas
  350: { no: ['back'] }, // Milotic: a serpent
  353: { no: ['back'] }, // Shuppet: no shoulders
  361: { rig: { S: { eyesAt: [[-2, 8], [2, 8]] }, SE: { eyesAt: [[2, 6], [5, 6]] }, E: { seat: [2, -2, -3], eyesAt: [[5, 8]] } }, size: { face: -9 } }, // Snorunt: the eyes found are its mouth, low in the hood, the face spans the whole hood, and in profile the seat found is the hood's opening, under its top
  362: { rig: { S: { seat: [0, -13, 7], eyesAt: [[-5, 11], [5, 11]] }, SE: { eyesAt: [[2, 11], [8, 9]] }, E: { seat: [-4, 0, 6] } }, no: NO_BODY }, // Glalie: a floating head; facing south its teeth read as eyes and the seat drops onto them
  '362:mega': { rig: { S: { seat: [0, 0, 8], eyesAt: [[-4, 11], [3, 11]] }, SE: { eyesAt: [[1, 13], [8, 11]] }, E: { seat: [0, 11], eyesAt: [[7, 10]] } }, no: NO_BODY }, // Mega Glalie: the eyes found are the blue crest and the jaw's folds, far from its red eyes; facing south the seat is only the crest, in profile it sinks into the brow
  363: { no: NO_BODY }, // Spheal
  364: { rig: { SE: { seat: [6, 0, 3], eyesAt: [[-1, 5]] } }, size: { face: -6 }, no: UPRIGHT }, // Sealeo: turned a little, the seat falls behind its head and the head's outline reads as a second eye; the face found spans its whiskers
  365: { rig: { E: { eyesAt: [[3, 5]] } }, no: UPRIGHT }, // Walrein: in profile its small eye in the mane isn't found
  371: { rig: { SE: { seat: [0, -3, 1] }, E: { seat: [-4, -6] } } }, // Bagon: turned, the seat drops under its helmet, onto its face
  372: { rig: { S: { seat: [0, 0, 7] }, E: { seat: [0, 0, -5] } }, no: NO_BODY }, // Shelgon: a shell, its face peeking out of the opening; a hat as wide as the whole shell swallowed it
  373: { rig: { S: { seat: [0, -4, 4] }, SE: { seat: [3, 5, -2] } }, no: ['back'] }, // Salamence: its own wings; the seat sits on its brow facing south and slides off its head onto the crest's tip turned a little (on Walk: Idle's SE seat is on its back, see the PR)
  374: { no: ['roundGlasses', 'sunglasses', 'noseGlasses', 'heartShades', 'goggles', 'starShades', 'masquerade', ...NO_BODY] }, // Beldum: one eye (a monocle or a patch, never a pair of lenses), and no neck or back
  375: { rig: { S: { eyesAt: [[-4, 7], [4, 7]] }, SE: { eyesAt: [[2, 8], [8, 6]] }, E: { seat: [-7, 0, 7], eyesAt: [[1, 9]] } }, no: NO_BODY }, // Metang: the white spikes at its edges read as eyes where its red ones are, and in profile the seat is its front spike
  376: { rig: { S: { eyesAt: [[-4, 9], [4, 9]] }, SE: { seat: [1, -2, -2], eyesAt: [[-1, 8], [5, 6]] } }, no: NO_BODY }, // Metagross: the X's arms read as eyes where its red ones are, and turned a little the seat drops onto the X
  377: { rig: { S: { seat: [0, -4, -3], eyesAt: [[-2, 3], [2, 3]] }, SE: { seat: [-2, 4, -2], eyesAt: [[-1, 3], [3, 4]] }, E: { seat: [1, 2, 3], eyesAt: [[1, 5]] } } }, // Regirock: its eyes are the dots; facing south the seat cuts through them and spans the shoulder rocks, turned it sits on a shoulder
  378: { rig: { SE: { seat: [4, 1, 4], eyesAt: [[-1, 9], [4, 9]] }, E: { eyesAt: [[3, 9]] } } }, // Regice: its eyes are the dots; turned, the eyes found are dents over them and the seat sits on an ear spike, and in profile they aren't found
  379: { rig: { S: { eyesAt: [[-2, 9], [2, 9]] }, SE: { eyesAt: [[1, 9], [5, 9]] }, E: { eyesAt: [[10, 9]] } } }, // Registeel: its eyes are the dots, the eyes found the dark band's top corners
  380: { no: SEEN_FROM_ABOVE }, // Latias: a jet seen from above, its head pointing down the screen facing south (and its own wings)
  '380:mega': { no: SEEN_FROM_ABOVE }, // Mega Latias
  381: { no: SEEN_FROM_ABOVE }, // Latios
  '381:mega': { no: SEEN_FROM_ABOVE }, // Mega Latios
  382: { no: ['head', 'face', ...NO_BODY] }, // Kyogre: a whale seen from above, its head the front of its back (a hat lands mid-body, glasses on its mouth)
  '382:primal': { no: ['head', 'face', ...NO_BODY] }, // Primal Kyogre
  383: { rig: { SE: { eyesAt: [[-2, 9]] }, E: { seat: [3, -2, 4], eyesAt: [[1, 7]] } } }, // Groudon: turned, the crest's stripes read as eyes over its yellow one, and in profile the seat sinks behind the crest
  384: { rig: { S: { eyesAt: [[-5, 10], [4, 10]] }, E: { seat: [4, 1, -12] } }, no: ['back'] }, // Rayquaza: a serpent; facing south its nostrils read as eyes under its yellow ones, and in profile the seat spans its horns
  '384:mega': { size: { face: -8 }, no: ['back'] }, // Mega Rayquaza: a serpent; the face found spans its whiskers
  385: { rig: { SE: { eyesAt: [[-2, 8], [3, 7]] } }, no: ['head'] }, // Jirachi: the star is its head; turned a little, the star's point reads as an eye
  '386:speed': { rig: { SE: { eyesAt: [[0, 8]] }, E: { eyesAt: [[3, 6]] } } }, // Deoxys (Speed Forme): turned, the head's dark plates read as eyes beside its white one, and in profile it isn't found
  '386:attack': { rig: { S: { seat: [1, 0, -5], eyesAt: [[-2, 4], [2, 4]] }, SE: { seat: [2, 1], eyesAt: [[2, 6]] }, E: { seat: [2, 0], eyesAt: [[2, 5]] } } }, // Deoxys (Attack Forme): the seat spans its head's side spikes, and turned, the eyes found are the spikes' dark edges, or none
  387: { no: UPRIGHT }, // Turtwig
  388: { no: ['head', 'back'] }, // Grotle: its shell overhangs its head (a hat on it swallows the shell, under it the shell buries it) and the shrubs fill its back
  389: { no: ['head', 'back'] }, // Torterra: the tree
  390: { rig: { S: { seat: [0, -2, -1], neck: [0, 1] }, SE: { seat: [0, -2] } } }, // Chimchar: facing it, the seat sinks into its forehead, so the brims came down to its eyes, and the neck rides up onto its mouth
  391: { rig: { S: { seat: [0, -3, -1] }, SE: { seat: [0, -3, -2] }, E: { seat: [0, -2] } } }, // Monferno: the seat drops to the top of its blue mask, under its pointed crown, so the brims came down to its eyes
  392: { rig: { S: { eyesAt: [[-2, 11], [3, 11]] }, SE: { seat: [4, 1, 3], eyesAt: [[0, 8]] }, E: { seat: [6, 2, 1], eyesAt: [[2, 8]] } } }, // Infernape: the eyes found are its face's edges or its arm, and turned the seat follows its flame off its head
  394: { rig: { all: { eyes: [0, -1] } } }, // Prinplup: its eyes are found by their lower row, so hats came down onto them
  396: { no: UPRIGHT }, // Starly
  397: { rig: { S: { eyes: [0, -1] }, SE: { eyesAt: [[3, 4]] }, E: { eyesAt: [[1, 5]] }, 'E:Hurt': { seat: [0, -3] } }, no: UPRIGHT }, // Staravia: turned, no eye is found
  398: { no: UPRIGHT }, // Staraptor
  403: { rig: { S: { eyesAt: [[-4, 4], [4, 4]] }, SE: { seat: [0, 3, -4], eyesAt: [[1, 8]] }, E: { seat: [0, 2, -3], eyesAt: [[2, 6]] }, 'SE:Idle': { seat: [0, -8], eyesAt: [[2, 7]] }, 'E:Idle': { seat: [0, -2], eyesAt: [[2, 5]] }, NE: { seat: [0, 0, -3] }, N: { seat: [0, 0, -8] } }, size: { head: -4 }, no: UPRIGHT }, // Shinx: the seat spans the ears (facing south, on the first frame, its tail's star: the frames it tracks into are right), and turned its eyes sit low, by its nose
  404: { rig: { S: { eyesAt: [[-4, 7], [3, 7]] }, SE: { seat: [0, 0, -5] }, NE: { seat: [0, 0, -3] }, N: { seat: [0, 0, -10] } }, size: { head: -4, face: -4 }, no: UPRIGHT }, // Luxio: the seat spans the ears
  405: { rig: { S: { eyes: [-1, 4] }, SE: { eyesAt: [[-3, 9]] }, E: { seat: [0, -2], eyesAt: [[0, 9]] }, 'SE:Hurt': { seat: [0, -3] }, N: { seat: [0, 0, -4] } }, size: { head: -5 }, no: UPRIGHT }, // Luxray: the seat spans the ears, the eyes are read on the brow
  406: { rig: { 'SE:Hurt': { seat: [0, -4] } } }, // Budew: hurt, turned a little, the seat is tracked down to its eyes
  407: { rig: { E: { eyesAt: [[2, 4]] } } }, // Roserade: in profile the eye found is its hair's shading, behind its face
  425: { rig: { SE: { eyesAt: [[-1, 6], [4, 5]] }, E: { eyesAt: [[2, 5]] } }, no: NO_BODY }, // Drifloon: a balloon; turned, its eyes aren't found (or are read on its top, under the puff)
  426: { rig: { S: { eyesAt: [[-5, 5], [4, 5]] }, SE: { eyesAt: [[-1, 6], [7, 4]] }, E: { eyesAt: [[3, 5]] }, 'E:Hurt': { seat: [0, -2], eyesAt: [[-1, 4]] } }, no: NO_BODY }, // Drifblim: a balloon; its small red eyes aren't found, and hats came down over them
  443: { rig: { E: { eyes: [0, -1] } } }, // Gible: in profile its eye is found by its lower half
  444: { rig: { N: { seat: [0, 0, -8] } } }, // Gabite: from behind the seat spans its head's fins
  446: { rig: { Hurt: { eyes: [0, -1] } } }, // Munchlax: hurt, its squeezed eyes are found by their lower row
  447: { rig: { S: { eyesAt: [[-3, 6], [2, 6]] } }, size: { head: -5, face: -5 } }, // Riolu: the seat spans the ears hanging at its sides
  468: { size: { head: -15 }, no: ['neck', 'back'] }, // Togekiss: its own wings (the seat spans them), and its head is its body: no neck to tie anything round
  470: { rig: { SE: { seat: [0, 0, -3] }, NE: { seat: [0, 0, -3] } }, no: UPRIGHT }, // Leafeon: turned, the seat spans its ears' leaves
  471: { no: UPRIGHT }, // Glaceon
  473: { rig: { SE: { seat: [0, 0, -8] }, E: { seat: [0, 0, -8] }, NE: { seat: [0, 0, -7] }, N: { seat: [0, 0, -5] }, 'SE:Hurt': { eyes: [-1, -2] } }, size: { head: -7 }, no: ['neck', ...UPRIGHT] }, // Mamoswine: a mound of fur; hurt, turned a little, its eyes are tracked low
  474: { rig: { S: { eyesAt: [[-2, 6], [3, 6]] }, SE: { eyesAt: [[-1, 6]] }, E: { eyesAt: [[1, 5]] }, 'S:Hurt': { eyesAt: [[-3, 3], [3, 3]], neck: [0, 8], back: [0, 8] }, 'SE:Hurt': { seat: [3, 5], eyesAt: [[-2, 2]], back: [0, 7] }, 'E:Hurt': { seat: [4, 6], eyesAt: [[1, 3]], back: [0, 5] }, N: { seat: [0, 1, 5] } } }, // Porygon-Z: the eyes found are its face's glint, and from behind the seat is its crest's tip; hurt, its head flips loose of its body
  475: { rig: { 'E:Idle': { seat: [0, -2], eyesAt: [[2, 5]] } } }, // Gallade: standing in profile it raises its arm and its head with it (the first frame doesn't, and wears it 5 px high), and its eye isn't found
  '475:mega': { rig: { 'E:Idle': { seat: [0, -2], eyesAt: [[2, 5]] } } }, // Mega Gallade: as Gallade
  483: { no: UPRIGHT }, // Dialga
  488: { no: ['back'] }, // Cresselia: its own wings
  '491:mega': { rig: { SE: { left: 'none', right: [1, 1] }, E: { eyesAt: [[0, 23]] } }, no: ['head', 'back'] }, // Mega Darkrai: the plume over its head, the shadows on its back; its one eye under the plume isn't found in profile, and turned a little the shadow beside it reads as a second
  493: { rig: { S: { seat: [0, -2, -1], eyesAt: [[-3, 3], [3, 3]] }, SE: { seat: [0, -3], eyes: [0, -1] }, E: { seat: [-1, -6] } }, no: UPRIGHT }, // Arceus: facing south the seat and the eyes are read on its face mask, under the eyes; the hat goes on the crest's base
  495: { rig: { S: { eyesAt: [[-3, 6], [3, 6]], neck: [0, 2] }, SE: { eyesAt: [[-2, 5]] }, E: { eyesAt: [[0, 6]] }, 'E:Hurt': { seat: [0, -2], eyesAt: [[1, 6]] } } }, // Snivy: facing south its yellow collar reads as the eyes and the neck sits on the face; turned, its eye isn't found
  496: { rig: { S: { eyesAt: [[-3, 5], [3, 5]], neck: [0, 1] }, SE: { eyesAt: [[-1, 5]], neck: [-1, 3] }, E: { eyesAt: [[1, 5]], neck: [-2, 4] } } }, // Servine: its eyes aren't found; turned, the neck is read on its snout
  497: { rig: { S: { seat: [0, 1], eyes: [0, 4], neck: [0, 2] }, SE: { eyesAt: [[0, 5]], neck: [-3, 4] }, E: { eyesAt: [[0, 4]] }, 'SE:Hurt': { seat: [0, -3] }, 'E:Hurt': { seat: [0, -2] } }, size: { head: 2 }, no: ['back'] }, // Serperior: no shoulders to hang anything from; the eyes are read on its brow, the neck on its chin
  498: { rig: { 'E:Hurt': { seat: [0, -1], eyes: [3, -2] } }, no: UPRIGHT }, // Tepig: hurt, in profile its eye is tracked behind and under where it is
  499: { rig: { E: { eyes: [0, -1] }, N: { seat: [0, 0, -4] }, 'S:Idle': { eyesAt: [[-4, 4], [4, 4]] } } }, // Pignite: in profile its eye is found by its lower half; standing, facing south, the eyes found span its snout's band; from behind the seat spans its ears
  500: { rig: { NE: { seat: [0, 0, -3] }, N: { seat: [0, 0, -5] } } }, // Emboar: from behind the seat spans its flaming beard
  502: { rig: { all: { seat: [0, -2], eyes: [0, -1] } } }, // Dewott: a small head, its brows right under its crown, so the hat sits on its tuft's base
  503: { rig: { SE: { eyes: [0, -1] } }, no: UPRIGHT }, // Samurott: turned a little, its eyes are found by their lower row
  524: { rig: { all: { seat: [0, -2] } }, no: ['face', ...NO_BODY] }, // Roggenrola: a rock; the yellow hexagon is an ear, it has no eyes to wear glasses on, and the hat sits on its top's tuft, clear of the ear
  525: { rig: { all: { eyes: 'none' }, E: { seat: [1, -2] } }, no: ['face', ...NO_BODY] }, // Boldore: a rock with no eyes (the dark gaps beside its crest read as eyes and cut the hats)
  559: { rig: { S: { eyesAt: [[-4, 6], [4, 6]] }, SE: { eyesAt: [[-2, 6], [5, 6]] }, E: { eyesAt: [[2, 6]] }, 'E:Hurt': { eyesAt: [[1, 5]] } } }, // Scraggy: its eyes at the sides of its head aren't found
  560: { rig: { S: { eyes: [0, 2], neck: [0, 2] }, 'S:Idle': { seat: [0, -3], eyes: [0, 3] }, 'S:Hurt': { seat: [0, -3], eyes: [0, 3] } } }, // Scrafty: facing south its hood's spots read as its eyes, which sit lower, at its sides, right over its neck; standing and hurt, the seat is tracked into its hood
  570: { rig: { S: { eyesAt: [[-3, 7], [3, 7]] }, SE: { seat: [0, -4], eyesAt: [[-1, 7], [4, 7]] }, E: { eyesAt: [[0, 6]] } }, no: UPRIGHT }, // Zorua: the eyes found are its brow's red fur, or none; turned a little, the seat drops to them
  571: { rig: { SE: { seat: [0, -3] }, N: { seat: [0, 0, -8] }, 'S:Hurt': { eyes: [0, 3] }, 'SE:Hurt': { eyes: [0, 2] } } }, // Zoroark: turned a little, the hat sits on its mane's base, clear of its brow; hurt, it squeezes its eyes shut lower than they're tracked; from behind the seat spans its mane
  607: { rig: { S: { eyesAt: [[1, 10], [5, 10]] }, SE: { eyesAt: [[-1, 10], [3, 10]] }, E: { eyes: 'none' } }, no: ['head', 'back'] }, // Litwick: the flame is where a hat would go; the wax's shading reads as eyes (one shows, the other is under the wax)
  608: { rig: { all: { seat: [0, -6] }, S: { seat: [0, 0, 2], eyesAt: [[-4, 7], [3, 7]] }, SE: { seat: [-1, 3, 4], eyesAt: [[0, 7], [5, 7]] }, E: { seat: [0, 0, 4], eyesAt: [[2, 7]] }, NE: { seat: [0, 4, 3] }, N: { seat: [0, 3, 4] } }, size: { head: -2 }, no: NO_BODY }, // Lampent: a lamp; the hat goes on its cap, not round its brim over the eyes
  609: { no: ['head', 'back'] }, // Chandelure: a flame on top of its head
  633: { no: UPRIGHT }, // Deino
  634: { rig: { S: { seat: [10, -1, -5], eyesAt: [[-2, 4], [2, 4]], neck: [7, 1] }, SE: { seat: [11, -5], eyesAt: [[-1, 5], [3, 5]], neck: [6, -3] }, E: { seat: [8, -8], eyesAt: [[2, 4]], neck: [5, -3] }, N: { seat: [-13, 6], neck: [-7, -4] } }, size: { neck: -10 }, no: UPRIGHT }, // Zweilous: two heads, the rig reads both as one; everything goes on its left head
  635: { rig: { S: { eyesAt: [[-3, 4], [3, 4]] }, SE: { eyesAt: [[-1, 4], [3, 4]] }, E: { seat: [5, -3, -13], eyesAt: [[-1, 4]] }, 'SE:Hurt': { seat: [1, -3] }, 'E:Hurt': { seat: [0, 6], eyesAt: [[-1, 3]] } }, size: { head: 3 }, no: ['back'] }, // Hydreigon: its own wings; the seat is read narrower than the crest the hat must cover, the eyes found are its face's top corners, and in profile the seat spans its wings and its other heads
  636: { rig: { SE: { seat: [0, 0, -6], left: 'none', right: [1, -1] }, E: { seat: [0, 0, -6], eyesAt: [[2, 7]] }, NE: { seat: [0, 0, -4] }, N: { seat: [0, 0, -5] }, 'E:Hurt': { seat: [0, -3], eyesAt: [[4, 6]] } }, size: { head: -5 }, no: UPRIGHT }, // Larvesta: turned a little, a leg reads as a second eye, and in profile its eye isn't found; the seat spans its horns
  637: { rig: { S: { eyesAt: [[-2, 5], [2, 5]] }, SE: { seat: [7, -2, -3], eyesAt: [[0, 5], [3, 4]] }, N: { seat: [0, 0, -19] }, E: { seat: [2, -2], eyesAt: [[2, 5]] } }, size: { neck: -12, head: 1 }, no: ['back'] }, // Volcarona: its own wings (the seat spans them)
  650: { rig: { SE: { eyesAt: [[2, 8]] }, 'SE:Idle': { eyesAt: [[2, 7]] } } }, // Chespin: turned a little, the eyes found are its hood's dark seams
  651: { rig: { SE: { seat: [0, 0, -6], eyesAt: [[0, 4], [6, 4]] } } }, // Quilladin: turned a little, its eyes under the shell aren't found, and the seat spans the shell's spikes
  652: { rig: { NE: { seat: [2, -5, -10] }, N: { seat: [0, 0, -9] } }, no: ['back'] }, // Chesnaught: the shell, which the seat spans from behind (turned away, at its middle)
  653: { rig: { E: { seat: [0, 0, -3] }, 'E:Idle': { eyesAt: [[5, 7]] } }, no: UPRIGHT }, // Fennekin: standing in profile its eye isn't found, and the seat spans its ears
  656: { rig: { S: { seat: [0, 1] }, SE: { seat: [0, -2] } } }, // Froakie: its eyes bulge from the top of its head, so the hat rests on them
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
  715: { rig: { S: { seat: [0, 3, 7] } }, no: ['back'] }, // Noivern: its own wings; facing us the seat spans its ears and wings, a hat that wide swallowed its head
  722: { no: UPRIGHT }, // Rowlet
  724: { no: ['back'] }, // Decidueye: the cloak is its own
  725: { no: UPRIGHT }, // Litten
  726: { no: UPRIGHT }, // Torracat
  728: { rig: { E: { eyesAt: [[2, 6]] } }, no: UPRIGHT }, // Popplio: in profile a highlight on its head reads as the eye, which is further forward
  729: { no: UPRIGHT }, // Brionne
  730: { rig: { NE: { seat: [-8, -5] } }, no: UPRIGHT }, // Primarina: on flippers; turned away, the seat slips forward off its hair onto the brow
  736: { rig: { E: { seat: [7, -2, -11] } }, no: UPRIGHT }, // Grubbin: in profile the seat spans its whole body, at its jaws
  737: { rig: { E: { eyes: [-3, 2] } }, no: NO_BODY }, // Charjabug: a battery; in profile its front's corner reads as the eye
  738: { no: NO_BODY }, // Vikavolt: its own wings, and its jaws are where a neck would be
  744: { rig: { SE: { eyes: [7, 0] }, E: { eyes: [7, -1] } }, no: UPRIGHT }, // Rockruff: turned, the eyes are read off the dark of its ruff, behind the real ones
  745: { rig: { SE: { seat: [6, 0, -1], eyesAt: [[0, 6]] } }, no: UPRIGHT }, // Lycanroc: turned, the seat and the eyes are read off its white mane, behind the head
  770: { rig: { S: { seat: [0, -3, -16], eyesAt: [[-3, 5], [2, 5]] }, SE: { eyesAt: [[-1, 4], [4, 3]] } }, no: NO_BODY }, // Palossand: a sand castle; the hat goes on its middle tower, not over its walls, and its eyes are the tower's windows
  810: { rig: { NE: { seat: [0, -4] }, N: { seat: [0, -4] } } }, // Grookey: from behind the seat drops onto the back of its head
  813: { rig: { SE: { eyesAt: [[-2, 7], [3, 7]] }, E: { eyesAt: [[1, 7]] } } }, // Scorbunny: turned, its red eyes melt into the red of its face and aren't found
  816: { rig: { S: { seat: [0, -2] }, SE: { seat: [0, -2] }, E: { seat: [4, 1, -9], eyesAt: [[1, 4]] } }, no: UPRIGHT }, // Sobble: a short head with its eyes high, so the hat sits on its crown; in profile the seat spans the tail too
  817: { rig: { S: { eyes: [0, -3] }, SE: { seat: [3, 0], eyesAt: [[-1, 6], [3, 6]] }, E: { seat: [3, 2, -6], eyesAt: [[1, 4]] } } }, // Drizzile: its fringe hides an eye; turned, the seat spans its curled tail and the eyes are read off it
  885: { rig: { S: { seat: [0, -1, -6] } }, no: ['back'] }, // Dreepy: a head and a tail; facing us the seat spans its fins
  886: { rig: { S: { seat: [0, 0, -8] }, SE: { seat: [0, 0, -3] } } }, // Drakloak: the seat spans its horns, a hat that wide hid them
  907: { rig: { E: { eyes: [5, -2] } } }, // Floragato: in profile a dark leaf on its cheek reads as the eye, which is further forward
  908: { no: ['neck'] }, // Meowscarada: its cloak's collar hides its neck
  911: { no: ['head', 'face', 'neck', ...UPRIGHT] }, // Skeledirge: on four legs, its fire bird perches where a hat would go, its eyes hide in its skull mask and its neck under its head
  912: { rig: { SE: { eyesAt: [[-1, 9], [3, 8]] }, E: { eyesAt: [[2, 8]] } } }, // Quaxly: its shiny's eyes, turned, aren't found under its crest
  935: { no: ['head'] }, // Charcadet: its head is a flame
  959: { no: ['back'] }, // Tinkaton: the hammer on its back
}
