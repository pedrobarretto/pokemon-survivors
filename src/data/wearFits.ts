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
  150: { rig: { 'E:Hurt': { seat: [0, -2], eyesAt: [[2, 2]] } } }, // Mewtwo: hurt in profile its head is thrown back, the seat found on its eye's row and the eye on the back of its head
  '150:megaY': { rig: { S: { eyesAt: [[-3, 6], [3, 6]], neck: [0, 2] }, 'S:Hurt': { seat: [0, -3, -4], eyesAt: [[-3, 4], [2, 4]] }, SE: { eyesAt: [[1, 12], [6, 11]], neck: [0, 2] }, 'SE:Hurt': { eyes: 'none' }, E: { seat: [0, -2, -6], eyesAt: [[4, 9]] }, 'E:Hurt': { seat: [0, -2], eyes: 'none' } } }, // Mega Mewtwo Y: the hat rides the loop of its crest; its red eyes, low on the face, aren't found (the loop's inside is), the neck was read at their row, and hurt turned it shows no face
  151: { rig: { 'E:Hurt': { seat: [-2, -1], eyesAt: [[-1, 1]] } } }, // Mew: hurt in profile it curls, its head lower and further back than walking
  152: { rig: { S: { seat: [0, -4] }, E: { seat: [-1, -1] } }, no: UPRIGHT }, // Chikorita: on four legs; the hat sits on its leaf, as it does turned (standing it looks up, its eyes rising to the leaf's base)
  153: { no: UPRIGHT }, // Bayleef
  154: { rig: { E: { seat: [-2, -2] }, 'E:Hurt': { seat: [0, -2] } }, no: ['neck', ...UPRIGHT] }, // Meganium: the petals around its neck; in profile the seat sat over its eye, under the antennae (hurt, it looks up)
  155: { rig: { all: { seat: [0, -2] }, S: { seat: [0, 0, 2] } }, no: ['back'] }, // Cyndaquil: the flames on its back; its closed eyes sit 3 px under the crown, so hats sit higher
  156: { rig: { SE: { seat: [3, 0, -5], left: 'none' }, E: { seat: [6, 0, -12] } }, no: ['neck', 'back'] }, // Quilava: flames at the neck and the back; turned, the seat spanned the whole back and a mark on its throat read as a second eye
  157: { rig: { S: { eyesAt: [[-2, 7], [2, 7]] }, 'S:Idle': { seat: [2, 0, -5], eyesAt: [[-2, 7], [2, 7]] }, 'S:Hurt': { eyes: 'none' }, 'SE:Idle': { seat: [-1, 0] }, E: { eyesAt: [[5, 6]] }, 'E:Idle': { seat: [-3, 1] }, 'E:Hurt': { seat: [0, -1], eyesAt: [[4, 1]] }, 'NE:Idle': { seat: [-1, -1] }, 'N:Idle': { seat: [-2, 0] } }, no: ['neck'] }, // Typhlosion: the flame collar; its red eyes, where the blue meets the cream, aren't found (facing south its fur's dark spots are), standing the seat sat left of its head, and hurt facing south it shows its open mouth, not its eyes
  158: { rig: { 'S:Idle': { seat: [-1, -5, 7], eyesAt: [[-3, 5], [2, 5]] }, SE: { eyesAt: [[-2, 4]] }, 'SE:Idle': { seat: [-2, -4, 4] }, 'SE:Hurt': { eyesAt: [[-2, 3]] }, E: { eyesAt: [[0, 3]] }, 'E:Hurt': { eyesAt: [[2, 2]] }, 'N:Idle': { seat: [-1, 0] } } }, // Totodile: its red eyes aren't found turned (its teeth are); standing it crouches with its jaws open, the seat found on its eyes (for the short snap where it throws its head back, the hat stands off it)
  159: { rig: { S: { eyes: [0, -3] }, E: { seat: [0, 0, -5], eyesAt: [[1, 2]] }, 'E:Hurt': { seat: [1, -2] } }, size: { head: 1 } }, // Croconaw: facing south the jaw's corners read as its eyes, and the seat spans the cheeks
  160: { rig: { 'S:Hurt': { seat: [-1, 8, -11], eyes: 'none' }, SE: { seat: [4, 0, -5] }, 'SE:Hurt': { seat: [2, 4, -6], eyes: 'none' }, 'E:Hurt': { seat: [7, -1, -10], eyes: 'none' } }, size: { head: -3 } }, // Feraligatr: the seat spanned its shoulders; hurt, it throws its head back, jaws up, its eyes out of sight, and the hat rides its snout
  169: { rig: { SE: { eyesAt: [[0, 6], [5, 6]] }, E: { seat: [3, 0, -4] } }, size: { head: -11 }, no: ['back'] }, // Crobat: its own wings, which facing south the seat spanned; turned a little, a wing's shade read as its near eye, and in profile the seat spanned its ears
  172: { rig: { S: { seat: [0, -4] }, 'S:Idle': { seat: [0, 5] }, 'SE:Idle': { seat: [0, 1] }, E: { seat: [0, -2] } }, size: { head: -3 } }, // Pichu: the seat spanned the ears' roots, at its eyes' row facing south (standing, it was found on the head); in profile its far ear's black reads as the face's details
  175: { rig: { S: { eyesAt: [[-1, 5], [1, 5]] }, 'S:Idle': { seat: [-1, 1] }, SE: { eyesAt: [[1, 6], [3, 6]] }, E: { eyesAt: [[5, 5]] } }, no: ['back'] }, // Togepi: the shell; its small eyes, close together over the shell's rim, aren't found (the rim's dark band is); standing facing south, the seat sat a pixel off
  176: { rig: { E: { eyes: [6, 3] } } }, // Togetic: in profile a shade on its crown read as the eye
  179: { rig: { S: { eyesAt: [[-2, 12], [2, 12]] }, 'S:Idle': { seat: [0, 1] }, SE: { seat: [3, 0, -8] }, E: { seat: [7, 0, -12] } }, size: { head: -3 }, no: UPRIGHT }, // Mareep: its head is the wool ball, the hat on top of it (facing south its small face, under the wool, has no room for one); turned, the seat spanned the whole ball, and facing south its ears' stripes read as eyes
  180: { rig: { E: { eyesAt: [[3, 8]] } } }, // Flaaffy: in profile its eye, under the wool, isn't found
  181: { rig: { 'S:Idle': { seat: [0, -2], eyesAt: [[-2, 7], [2, 7]] }, 'E:Idle': { seat: [0, -4], eyesAt: [[3, 4]] } } }, // Ampharos: standing, its head rises over the seat walking found (and for a beat it looks up, out of the rig's reach)
  183: { rig: { 'S:Hurt': { seat: [0, -4] } }, size: { head: -4 } }, // Marill: the seat spanned its ears; hurt, facing south, it fell to its squeezed eyes
  184: { rig: { E: { seat: [2, -1, -2] }, 'N:Idle': { seat: [1, 1] } } }, // Azumarill: in profile the seat sat back on its ears' roots, over its far ear's stripes; standing facing away, a pixel off
  186: { rig: { S: { seat: [0, -2, -2], eyesAt: [[-5, 7], [5, 7]] }, SE: { seat: [0, -1], eyesAt: [[-1, 6], [6, 5]] } }, size: { head: -1 } }, // Politoed: facing south the seat dropped to its eyes, under its curl; turned a little, only its far eye was found
  196: { rig: { S: { eyes: [7, 5] }, SE: { eyesAt: [[0, 6], [6, 6]] }, E: { seat: [0, -1], eyesAt: [[3, 7]] } }, size: { head: 4, face: -9 }, no: UPRIGHT }, // Espeon: facing south the seat spanned its ears and an ear's inside read as its one eye, as it does turned
  197: { rig: { 'S:Idle': { seat: [0, 2] }, SE: { eyes: [1, 0] }, E: { seat: [6, -4, -10], eyesAt: [[2, 4]] }, 'E:Idle': { seat: [-1, 9] }, 'NE:Idle': { seat: [5, 1] }, 'N:Idle': { seat: [0, -1] } }, size: { head: -2 }, no: UPRIGHT }, // Umbreon: in profile the seat spanned its back at the eyes' height; standing, the seat stayed over its head as it crouched
  212: { rig: { 'SE:Idle': { seat: [1, -5] } }, no: ['back'] }, // Scizor: its own wings; standing turned a little, the seat sat low on its face
  216: { rig: { E: { seat: [1, -1, -2] } }, size: { head: -6 } }, // Teddiursa: facing south the seat spanned its ears; in profile it sat low, over its eyes
  217: { rig: { 'S:Idle': { seat: [0, -2, 4], eyesAt: [[-2, 5], [2, 5]] }, 'SE:Idle': { seat: [-2, -2] }, 'SE:Hurt': { neck: [0, 2] }, 'E:Idle': { seat: [0, 1] } } }, // Ursaring: standing, the seat sat a little lower on its head than walking (facing south on its brow, between its ears, where its eyes weren't found); hurt turned, the neck was read at its chin
  220: { no: ['face', ...NO_BODY] }, // Swinub: a ball of fur, its eyes hidden under it
  221: { no: ['face', ...NO_BODY] }, // Piloswine: a mound of fur, its eyes hidden under it
  228: { rig: { 'S:Idle': { seat: [0, -2], eyesAt: [[-3, 5], [2, 5]] }, 'S:Hurt': { eyes: 'none' }, 'SE:Idle': { seat: [-2, -2, 5], eyesAt: [[-3, 5], [1, 5]] }, 'E:Idle': { seat: [-1, -1, 2], eyesAt: [[1, 5]] } }, no: UPRIGHT }, // Houndour: standing, the seat sat low on its face and its eyes weren't found; hurt facing south it shows its throat
  229: { rig: { 'S:Idle': { seat: [0, -2], eyesAt: [[-2, 4], [2, 4]] }, SE: { seat: [4, -3], eyesAt: [[2, 4]] }, 'SE:Idle': { seat: [-6, 4] }, 'E:Idle': { seat: [-4, 1], eyesAt: [[2, 3]] }, 'NE:Idle': { seat: [-1, 0] } }, no: UPRIGHT }, // Houndoom: turned a little, a horn's dark inside reads as a second eye and the seat drops to it, on the real eye over its muzzle; standing, the seat strayed off its head (and for its howl, which throws its head back, the rig can't follow)
  '229:mega': { rig: { 'S:Idle': { eyesAt: [[-2, 3], [2, 3]] }, 'E:Idle': { seat: [-1, 2], eyesAt: [[0, 3]] }, 'NE:Idle': { seat: [-2, 4] }, 'N:Idle': { seat: [0, 6] } }, no: UPRIGHT }, // Mega Houndoom: standing, the seat strayed off its head and its eyes weren't found
  230: { rig: { S: { seat: [0, -1, 2] }, 'S:Hurt': { eyes: 'none' }, SE: { seat: [3, -1, 1], eyesAt: [[-1, 4]] }, E: { seat: [5, -1, -10], eyesAt: [[1, 4]] }, 'E:Idle': { seat: [0, 2] } }, size: { head: -2 } }, // Kingdra: the seat spanned its spines, and turned it slid back onto its body; turned, its red eye isn't found (its spines' shade is), and hurt facing south it throws its snout up
  233: { rig: { 'S:Hurt': { eyes: 'none' }, E: { seat: [4, -1, -3], eyesAt: [[1, 5]] }, 'E:Idle': { seat: [-5, 2] } }, no: UPRIGHT }, // Porygon2: in profile the seat spans its whole body (standing, its head sits further back and lower); hurt facing south it tumbles snout up, its eyes out of sight
  243: { rig: { S: { seat: [0, 2] }, SE: { eyesAt: [[0, 6], [4, 5]], neck: [0, 3] }, E: { eyesAt: [[3, 7]] }, 'NE:Idle': { seat: [-8, 1] }, 'N:Idle': { seat: [0, 1] } }, size: { head: -8 }, no: UPRIGHT }, // Raikou: facing south the seat spanned its mane; turned, the eyes found are its fangs and its jaw (and the neck its mouth), and standing facing away the seat strayed off its head
  244: { rig: { S: { seat: [0, -6] }, SE: { seat: [2, -1, 1], eyesAt: [[-2, 11], [3, 11]] }, E: { seat: [7, -2, -8] }, 'E:Idle': { seat: [-3, 0] }, 'N:Idle': { seat: [0, -1] } }, size: { head: -4 }, no: UPRIGHT }, // Entei: the hat goes over the crest, not on the face; in profile the seat slid back onto its mane (standing, further back still), and turned a little the eyes found were the crest's
  245: { rig: { S: { seat: [0, 4, 5], eyesAt: [[-2, 8], [2, 8]] }, 'S:Idle': { seat: [0, -1] }, SE: { seat: [7, 6, -1], eyesAt: [[1, 2]] }, 'SE:Idle': { seat: [-6, 0] }, E: { seat: [8, 4, -13], eyesAt: [[2, 5]] }, 'E:Idle': { seat: [-8, -3] }, 'NE:Idle': { seat: [-5, 4] }, 'N:Idle': { seat: [0, 7] } }, size: { head: -1 }, no: UPRIGHT }, // Suicune: the seat sat on the mane, not the head, and walking and standing disagree by up to 12 px; its red eyes aren't found (its muzzle and its ribbons are)
  246: { rig: { SE: { eyesAt: [[0, 6]] }, 'SE:Hurt': { seat: [0, -3], eyesAt: [[0, 3]] }, E: { eyesAt: [[1, 6]] }, 'E:Hurt': { eyesAt: [[0, 3]] } } }, // Larvitar: turned, the eyes found sat on its cheek, not on its red eye
  247: { rig: { all: { seat: [0, -2, -3] }, S: { seat: [0, 0, 1] }, SE: { seat: [0, 0, 3], eyesAt: [[0, 8], [5, 6]] }, E: { eyesAt: [[2, 9]] } }, no: NO_BODY }, // Pupitar: a cocoon; its eyes sit right under the shell's top, and the seat spanned its spikes; turned, the shell's holes read as its eyes
  '248:mega': { rig: { S: { eyesAt: [[-3, 10], [3, 10]], neck: [0, 3] }, SE: { eyesAt: [[0, 11], [4, 11]], neck: [0, 3] }, E: { eyesAt: [[0, 12]], neck: [0, 3] } } }, // Mega Tyranitar: the eyes found are the white spots on its forehead plate, over its red eyes, and the neck was read at their row
  249: { rig: { 'SE:Walk': { seat: [20, -9, -28], eyesAt: [[1, 10]] }, 'SE:Hurt': { seat: [19, -13, -28], eyesAt: [[-1, 3]] } }, no: ['back'] }, // Lugia: its own wings; flying turned a little, the seat spanned a wing and its head wasn't found
  250: { no: ['head', 'face', 'neck', 'back'] }, // Ho-Oh: its head hangs low between its wings, under a crest
  251: { no: ['back'] }, // Celebi: its own wings
  252: { rig: { 'E:Walk': { seat: [5, -2, -16], eyesAt: [[0, 3]] }, 'E:Idle': { seat: [0, -1], eyesAt: [[0, 6]] }, 'E:Hurt': { seat: [4, -2, -16], eyesAt: [[2, 5]] } } }, // Treecko: running in profile the seat spans its whole body and tail, and its eye isn't found
  253: { rig: { E: { eyesAt: [[-1, 3]] } } }, // Grovyle: its eye in profile isn't found
  254: { rig: { 'S:Hurt': { seat: [0, 5] }, SE: { eyesAt: [[-1, 4]] }, 'SE:Hurt': { seat: [0, 5] }, E: { eyesAt: [[0, 6]] } } }, // Sceptile: its eye turned and in profile isn't found (hurt, it crouches under the seat)
  '254:mega': { rig: { SE: { eyesAt: [[-1, 5]] }, E: { eyesAt: [[0, 6]] } } }, // Mega Sceptile: its eye turned and in profile isn't found
  255: { rig: { S: { seat: [0, -2] }, SE: { seat: [0, -1], eyesAt: [[-1, 7], [6, 5]] }, 'SE:Hurt': { eyesAt: [[0, 4], [6, 4]] }, E: { seat: [0, -1] } } }, // Torchic: all head, its eyes right under the crest; turned a little, only its far eye was found
  256: { rig: { 'SE:Idle': { seat: [1, 1] }, E: { eyesAt: [[1, 4]] }, 'NE:Idle': { seat: [1, 1] } } }, // Combusken: its eye in profile isn't found; standing turned, the seat sat a pixel off
  257: { rig: { S: { seat: [0, -2] }, SE: { seat: [2, 0, -1] }, E: { seat: [3, 0, -7], eyesAt: [[2, 5]] } } }, // Blaziken: the seat sat on its brow, and turned it spanned the hair
  258: { rig: { S: { seat: [0, -1, 1] }, SE: { seat: [0, -1, -3] } }, size: { head: -4 }, no: UPRIGHT }, // Mudkip: the seat spanned the gills
  259: { rig: { 'SE:Hurt': { seat: [3, 8] } } }, // Marshtomp: hurt turned a little, it ducks under the seat
  260: { rig: { SE: { seat: [-1, 1, -3] }, E: { seat: [1, 4, -1], eyesAt: [[3, 4]] } }, size: { head: -4 } }, // Swampert: the seat spanned the gills, and turned it sat on the fin; in profile its eye isn't found
  280: { rig: { E: { seat: [0, 0, -2] } }, no: ['face'] }, // Ralts: in profile the seat spanned its horns; its eyes are hidden under its hair
  281: { rig: { S: { seat: [0, -1] }, 'SE:Idle': { seat: [-5, 1], eyesAt: [[-1, 7], [5, 7]] }, 'SE:Hurt': { seat: [1, 8], eyes: 'none' }, 'E:Idle': { seat: [0, -2], eyesAt: [[-1, 9]] }, 'E:Hurt': { seat: [-1, 8], eyes: 'none' } } }, // Kirlia: standing, the seat strayed off its head and its eyes weren't found; hurt, it falls face down under the seat
  282: { rig: { E: { eyesAt: [[1, 8]] } } }, // Gardevoir: in profile the eye found sat on its hair, behind its red eye
  '282:mega': { rig: { E: { eyesAt: [[1, 8]] } } }, // Mega Gardevoir: in profile its red eye isn't found
  285: { rig: { S: { eyesAt: [[-3, 6], [3, 6]] }, E: { eyesAt: [[4, 6]] }, 'E:Idle': { seat: [0, -1] }, 'E:Hurt': { eyesAt: [[3, 4]] } }, size: { head: -5 }, no: NO_BODY }, // Shroomish: a mushroom cap; its closed eyes aren't found (in profile a fleck on the cap is)
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
  396: { no: UPRIGHT }, // Starly
  397: { rig: { SE: { eyesAt: [[3, 5]] } }, no: UPRIGHT }, // Staravia: turned a little, no eye is found
  398: { no: UPRIGHT }, // Staraptor
  403: { rig: { S: { eyesAt: [[-4, 4], [4, 4]] } }, size: { head: -4 }, no: UPRIGHT }, // Shinx: the seat spans the ears, and facing south the eyes are read on the paws
  404: { rig: { S: { eyesAt: [[-4, 7], [3, 7]] } }, size: { head: -4, face: -4 }, no: UPRIGHT }, // Luxio: the seat spans the ears
  405: { rig: { S: { eyes: [-1, 4] } }, size: { head: -5 }, no: UPRIGHT }, // Luxray: the seat spans the ears, the eyes are read on the brow
  425: { no: NO_BODY }, // Drifloon: a balloon
  426: { rig: { S: { eyesAt: [[-5, 5], [4, 5]] }, SE: { eyesAt: [[-1, 6], [7, 4]] }, E: { eyesAt: [[3, 5]] } }, no: NO_BODY }, // Drifblim: a balloon; its small red eyes aren't found, and hats came down over them
  447: { rig: { S: { eyesAt: [[-3, 6], [2, 6]] } }, size: { head: -5, face: -5 } }, // Riolu: the seat spans the ears hanging at its sides
  468: { size: { head: -15 }, no: ['back'] }, // Togekiss: its own wings (the seat spans them)
  470: { no: UPRIGHT }, // Leafeon
  471: { no: UPRIGHT }, // Glaceon
  473: { no: ['neck', ...UPRIGHT] }, // Mamoswine: a mound of fur
  483: { no: UPRIGHT }, // Dialga
  488: { no: ['back'] }, // Cresselia: its own wings
  '491:mega': { no: ['head', 'back'] }, // Mega Darkrai: the plume over its head, the shadows on its back
  493: { rig: { S: { seat: [0, -2, -1], eyesAt: [[-3, 3], [3, 3]] } }, no: UPRIGHT }, // Arceus: facing south the seat and the eyes are read on its face mask, under the eyes; the hat goes on the crest's base
  495: { rig: { S: { eyesAt: [[-3, 6], [3, 6]], neck: [0, 2] } } }, // Snivy: facing south its yellow collar reads as the eyes and the neck sits on the face
  496: { rig: { S: { eyesAt: [[-3, 5], [3, 5]], neck: [0, 1] }, SE: { neck: [-1, 3] }, E: { neck: [-2, 4] } } }, // Servine: facing south its eyes aren't found; turned, the neck is read on its snout
  497: { rig: { S: { seat: [0, 1], eyes: [0, 4], neck: [0, 2] }, SE: { eyesAt: [[0, 5]], neck: [-3, 4] } }, size: { head: 2 }, no: ['back'] }, // Serperior: no shoulders to hang anything from; the eyes are read on its brow, the neck on its chin
  498: { no: UPRIGHT }, // Tepig
  503: { no: UPRIGHT }, // Samurott
  524: { no: ['face', ...NO_BODY] }, // Roggenrola: a rock; the yellow hexagon is an ear, it has no eyes to wear glasses on
  525: { rig: { all: { eyes: 'none' } }, no: ['face', ...NO_BODY] }, // Boldore: a rock with no eyes (the dark gaps beside its crest read as eyes and cut the hats)
  559: { rig: { S: { eyesAt: [[-4, 6], [4, 6]] }, SE: { eyesAt: [[-2, 6], [5, 6]] } } }, // Scraggy: its eyes at the sides of its head aren't found
  570: { no: UPRIGHT }, // Zorua
  607: { rig: { S: { eyesAt: [[1, 10], [5, 10]] }, SE: { eyesAt: [[-1, 10], [3, 10]] }, E: { eyes: 'none' } }, no: ['head', 'back'] }, // Litwick: the flame is where a hat would go; the wax's shading reads as eyes (one shows, the other is under the wax)
  608: { rig: { all: { seat: [0, -6] }, S: { seat: [0, 0, 2], eyesAt: [[-4, 7], [3, 7]] }, SE: { seat: [-1, 3, 4], eyesAt: [[0, 7], [5, 7]] }, E: { seat: [0, 0, 4], eyesAt: [[2, 7]] }, NE: { seat: [0, 4, 3] }, N: { seat: [0, 3, 4] } }, size: { head: -2 }, no: NO_BODY }, // Lampent: a lamp; the hat goes on its cap, not round its brim over the eyes
  609: { no: ['head', 'back'] }, // Chandelure: a flame on top of its head
  633: { no: UPRIGHT }, // Deino
  634: { rig: { S: { seat: [10, -1, 7], eyesAt: [[-2, 4], [2, 4]], neck: [7, 1] }, SE: { seat: [11, -5], eyesAt: [[-1, 4], [3, 4]], neck: [6, -3] }, E: { seat: [8, -8], eyesAt: [[2, 3]], neck: [5, -3] }, N: { seat: [-13, 6], neck: [-7, -4] } }, size: { neck: -10, head: -6 }, no: UPRIGHT }, // Zweilous: two heads, the rig reads both as one; everything goes on its left head
  635: { size: { head: 3 }, no: ['back'] }, // Hydreigon: its own wings; the seat is read narrower than the crest the hat must cover
  636: { no: UPRIGHT }, // Larvesta
  637: { rig: { S: { eyesAt: [[-2, 5], [2, 5]] }, SE: { seat: [7, -2, 9], eyesAt: [[0, 5], [3, 4]] }, E: { seat: [2, -2], eyesAt: [[2, 5]] } }, size: { neck: -12, head: 1 }, no: ['back'] }, // Volcarona: its own wings (the seat spans them)
  651: { rig: { SE: { eyesAt: [[1, 3], [6, 2]] } } }, // Quilladin: turned a little, its eyes under the shell aren't found
  652: { no: ['back'] }, // Chesnaught: the shell
  653: { no: UPRIGHT }, // Fennekin
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
