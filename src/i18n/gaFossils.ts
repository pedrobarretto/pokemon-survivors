import type { GA_FOSSILS } from '../data/gaFossils'
import { FOSSIL_KIT_UPGRADES, type FossilKitMoveId } from '../game/fossilKitUpgrades'
import type { ModId } from '../game/mods'
import type { UpgradeStep } from '../game/moves'
import { enVocab, esVocab, fork, frVocab, ptVocab, zhVocab, type Mod, type Vocab } from './seasonOne/kits'

/**
 * The words of the fossil families the Grande Atualização restores
 * (`data/gaFossils.ts`), a table per language (`pt` is the reference). Each
 * language's file spreads its `blurbs`, `moves` and `megas` in. A move's
 * level-up lines are built from its steps' numbers
 * (`game/fossilKitUpgrades.ts`), so all five stay in step with the data.
 */

type Stats = Partial<Record<'damage' | 'area' | 'cooldown' | 'pierce' | 'amount', number>>

const MODS: readonly Mod[] = ['arc', 'bounce', 'burstOnKill', 'cruel', 'drain', 'echo', 'execute', 'hunter', 'seek', 'split', 'trail']

const isMod = (m: ModId): m is Mod => (MODS as readonly string[]).includes(m)

/** One plain step's line: each stat it moves, in the language's words. */
const statLine = (v: Vocab, s: Stats) =>
  [
    s.damage !== undefined && v.d(s.damage),
    s.amount !== undefined && v.amt(s.amount),
    s.pierce !== undefined && v.p(s.pierce),
    s.area !== undefined && v.a(Math.round(s.area * 100)),
    s.cooldown !== undefined && v.c(-s.cooldown),
  ]
    .filter((x): x is string => typeof x === 'string')
    .join('; ')

const modOf = (b: { mods?: readonly ModId[] }) => {
  const mod = b.mods?.find(isMod)
  if (!mod) throw new Error('every branch of a fossil signature has a worded mod')
  return mod
}

type Fork = ReturnType<typeof fork>

type Lines = readonly [string, string, Fork, string, string, Fork, string]

/** The seven lines of a signature, forks at the third and sixth. */
const linesOf = (v: Vocab, id: FossilKitMoveId): Lines => {
  const steps: readonly UpgradeStep[] = FOSSIL_KIT_UPGRADES[id]
  const plain = (i: number) => {
    const s = steps[i]
    if (!s || 'fork' in s) throw new Error(`${id}: step ${i} is no plain step`)
    return statLine(v, s)
  }
  const forked = (i: number) => {
    const s = steps[i]
    if (!s || !('fork' in s)) throw new Error(`${id}: step ${i} is no fork`)
    const [a, b] = s.fork
    return fork(v, [modOf(a), statLine(v, a.stats)], [modOf(b), statLine(v, b.stats)])
  }
  return [plain(0), plain(1), forked(2), plain(3), plain(4), forked(5), plain(6)]
}

const IDS = Object.keys(FOSSIL_KIT_UPGRADES) as FossilKitMoveId[]

/** A language's moves: each signature's description and its level-up lines. */
const movesOf = (v: Vocab, text: Record<FossilKitMoveId, string>) =>
  Object.fromEntries(IDS.map((id) => [id, { description: text[id], upgrades: linesOf(v, id) }])) as Record<FossilKitMoveId, { description: string; upgrades: Lines }>

type Words = { blurbs: Record<keyof typeof GA_FOSSILS, string>; moves: Record<FossilKitMoveId, string>; megas: { aerodactyl: string } }

const wordsOf = (v: Vocab, w: Words) => ({ blurbs: w.blurbs, moves: movesOf(v, w.moves), megas: w.megas })

const pt = wordsOf(ptVocab, {
  blurbs: {
    aerodactyl: 'Fóssil do Old Amber. De tempos em tempos mergulha do céu no inimigo mais forte por perto, sem ser atingido. Tem Mega, que mergulha duas vezes.',
    omanyte: 'Fóssil do Helix Fossil. Shell Smash: com a horda colada, quebra a concha, espalha espinhos e fica muito mais forte (e frágil) por um tempo, até a concha crescer de novo.',
    lileep: 'Fóssil do Root Fossil. Parado, cria raízes: regenera, ganha defesa e os tentáculos puxam e sugam os inimigos em volta. Ingrain fica mais forte enraizado.',
    anorith: 'Fóssil do Claw Fossil. Cada Crush Claw que acerta em sequência fica mais forte; com o combo cheio, Armaldo cruza as garras num X em volta.',
    dracozolt: 'Fósseis Bird e Drake. Primeiro bote: Bolt Beak dá dano dobrado em quem está com a vida cheia, e cada um carrega a cauda até soltar um anel de raios.',
    arctozolt: 'Fósseis Bird e Dino. Treme de frio e solta anéis gelados em volta, mais rápido na neve. Icicle Crash congela quem está com a vida cheia.',
    dracovish: 'Fósseis Fish e Drake. Primeiro bote: Fishious Rend dá dano dobrado em quem está com a vida cheia, e cada um deixa Dracovish mais forte e rápido por um tempo.',
  },
  moves: {
    wingAttack: 'As duas asas cortam à frente ao mesmo tempo, em duas lâminas de vento que se cruzam.',
    spikeCannon: 'Uma rajada de espinhos da concha em leque. Com a concha quebrada, saem mais espinhos.',
    ingrain: 'Raízes brotam embaixo dos inimigos mais próximos e os prendem. Enraizado, ferem mais e mais largo.',
    crushClaw: 'Uma garra rasga à frente e pode marcar o alvo. Acertar em sequência monta o combo.',
    boltBeak: 'Uma investida de bico elétrico no inimigo com vida cheia mais próximo. Primeiro bote: dano dobrado.',
    icicleCrash: 'Pingentes de gelo caem nos inimigos mais próximos e congelam quem está com a vida cheia.',
    fishiousRend: 'Um salto com mordida no inimigo com vida cheia mais próximo. Primeiro bote: dano dobrado.',
  },
  megas: { aerodactyl: 'golpes +30%, velocidade +6 e defesa +1; mergulha com mais frequência, duas vezes seguidas. O especial vira Sky Attack.' },
})

const en = wordsOf(enVocab, {
  blurbs: {
    aerodactyl: 'From Old Amber. Every so often it dives from the sky onto the toughest foe nearby, untouchable. Its Mega dives twice.',
    omanyte: 'From the Helix Fossil. Shell Smash: with the horde pressing in, it breaks its shell, sprays spikes and gets far stronger (and frailer) for a while, until the shell regrows.',
    lileep: 'From the Root Fossil. Standing still, it takes root: it regenerates, gains defense, and its tendrils pull in and sap the foes around. Ingrain hits harder rooted.',
    anorith: 'From the Claw Fossil. Every Crush Claw that lands in a row hits harder; with the combo full, Armaldo crosses its claws in an X all around.',
    dracozolt: 'From the Bird and Drake fossils. First strike: Bolt Beak deals double to foes at full HP, and each one charges its tail until it lets out a ring of lightning.',
    arctozolt: 'From the Bird and Dino fossils. It shivers out icy rings around it, faster in the snow. Icicle Crash freezes foes at full HP.',
    dracovish: 'From the Fish and Drake fossils. First strike: Fishious Rend deals double to foes at full HP, and each one makes Dracovish stronger and faster for a while.',
  },
  moves: {
    wingAttack: 'Both wings cleave ahead at once, two blades of wind crossing in front.',
    spikeCannon: 'A volley of shell spikes in a fan. With the shell smashed, more spikes fly.',
    ingrain: 'Roots burst up under the nearest foes and hold them. Rooted, they hit harder and wider.',
    crushClaw: 'A claw rakes ahead and may mark its target. Landing in a row builds the combo.',
    boltBeak: 'A charging beak of lightning into the nearest foe at full HP. First strike: double damage.',
    icicleCrash: 'Icicles crash down on the nearest foes and freeze the ones at full HP.',
    fishiousRend: 'A leaping bite at the nearest foe at full HP. First strike: double damage.',
  },
  megas: { aerodactyl: 'moves +30%, speed +6 and defense +1; it dives more often, twice in a row. The special becomes Sky Attack.' },
})

const es = wordsOf(esVocab, {
  blurbs: {
    aerodactyl: 'Del Old Amber. De vez en cuando se lanza en picada sobre el enemigo más fuerte cercano, sin recibir daño. Su Mega se lanza dos veces.',
    omanyte: 'Del Helix Fossil. Shell Smash: con la horda encima, rompe la concha, suelta púas y se vuelve mucho más fuerte (y frágil) un tiempo, hasta que la concha vuelve a crecer.',
    lileep: 'Del Root Fossil. Quieto, echa raíces: se regenera, gana defensa y sus tentáculos atraen y absorben a los enemigos cercanos. Ingrain pega más enraizado.',
    anorith: 'Del Claw Fossil. Cada Crush Claw que acierta seguido pega más fuerte; con el combo lleno, Armaldo cruza las garras en una X alrededor.',
    dracozolt: 'De los fósiles Bird y Drake. Primer golpe: Bolt Beak hace el doble a los enemigos con la vida llena, y cada uno carga su cola hasta soltar un anillo de rayos.',
    arctozolt: 'De los fósiles Bird y Dino. Tiembla de frío y suelta anillos helados alrededor, más rápido en la nieve. Icicle Crash congela a los enemigos con la vida llena.',
    dracovish: 'De los fósiles Fish y Drake. Primer golpe: Fishious Rend hace el doble a los enemigos con la vida llena, y cada uno vuelve a Dracovish más fuerte y rápido un tiempo.',
  },
  moves: {
    wingAttack: 'Las dos alas cortan al frente a la vez, dos cuchillas de viento que se cruzan.',
    spikeCannon: 'Una ráfaga de púas de la concha en abanico. Con la concha rota, salen más púas.',
    ingrain: 'Brotan raíces bajo los enemigos más cercanos y los atrapan. Enraizado, pegan más y más amplio.',
    crushClaw: 'Una garra desgarra al frente y puede marcar al objetivo. Acertar seguido arma el combo.',
    boltBeak: 'Una embestida de pico eléctrico contra el enemigo con vida llena más cercano. Primer golpe: daño doble.',
    icicleCrash: 'Carámbanos caen sobre los enemigos más cercanos y congelan a los que tienen la vida llena.',
    fishiousRend: 'Un salto con mordisco al enemigo con vida llena más cercano. Primer golpe: daño doble.',
  },
  megas: { aerodactyl: 'movimientos +30%, velocidad +6 y defensa +1; se lanza en picada más seguido, dos veces seguidas. El especial pasa a ser Sky Attack.' },
})

const fr = wordsOf(frVocab, {
  blurbs: {
    aerodactyl: 'De l’Old Amber. De temps en temps, il pique du ciel sur l’ennemi le plus coriace à proximité, intouchable. Sa Méga pique deux fois.',
    omanyte: 'Du Helix Fossil. Shell Smash : quand la horde le serre, il brise sa coquille, projette des pointes et devient bien plus fort (et fragile) un moment, jusqu’à ce qu’elle repousse.',
    lileep: 'Du Root Fossil. Immobile, il prend racine : il se régénère, gagne en défense et ses tentacules attirent et vident les ennemis autour. Ingrain frappe plus fort enraciné.',
    anorith: 'Du Claw Fossil. Chaque Crush Claw qui touche d’affilée frappe plus fort ; combo plein, Armaldo croise ses griffes en X tout autour.',
    dracozolt: 'Des fossiles Bird et Drake. Premier coup : Bolt Beak inflige le double aux ennemis en pleine santé, et chacun charge sa queue jusqu’à libérer un anneau d’éclairs.',
    arctozolt: 'Des fossiles Bird et Dino. Il grelotte et libère des anneaux glacés autour de lui, plus vite sous la neige. Icicle Crash gèle les ennemis en pleine santé.',
    dracovish: 'Des fossiles Fish et Drake. Premier coup : Fishious Rend inflige le double aux ennemis en pleine santé, et chacun rend Dracovish plus fort et plus rapide un moment.',
  },
  moves: {
    wingAttack: 'Les deux ailes tranchent devant en même temps, deux lames de vent qui se croisent.',
    spikeCannon: 'Une salve de pointes de coquille en éventail. Coquille brisée, il en part davantage.',
    ingrain: 'Des racines jaillissent sous les ennemis les plus proches et les retiennent. Enraciné, elles frappent plus fort et plus large.',
    crushClaw: 'Une griffe lacère devant et peut marquer la cible. Toucher d’affilée monte le combo.',
    boltBeak: 'Une charge de bec électrique sur l’ennemi en pleine santé le plus proche. Premier coup : dégâts doublés.',
    icicleCrash: 'Des stalactites de glace s’abattent sur les ennemis les plus proches et gèlent ceux en pleine santé.',
    fishiousRend: 'Un bond et une morsure sur l’ennemi en pleine santé le plus proche. Premier coup : dégâts doublés.',
  },
  megas: { aerodactyl: 'capacités +30 %, vitesse +6 et défense +1 ; il pique plus souvent, deux fois de suite. L’attaque spéciale devient Sky Attack.' },
})

const zh = wordsOf(zhVocab, {
  blurbs: {
    aerodactyl: '由 Old Amber 復原。不時從空中俯衝撲向附近最強的敵人，期間不會受傷。超級進化後會連續俯衝兩次。',
    omanyte: '由 Helix Fossil 復原。Shell Smash：被敵群包圍時打破外殼、射出尖刺，一段時間內變得更強（也更脆弱），直到外殼長回來。',
    lileep: '由 Root Fossil 復原。站著不動就會扎根：回復體力、提升防禦，觸手會把周圍的敵人拉近並吸取。扎根時 Ingrain 更強。',
    anorith: '由 Claw Fossil 復原。Crush Claw 連續命中會越打越強；連擊滿了，Armaldo 會交叉雙爪在周圍劃出一個X。',
    dracozolt: '由 Bird 與 Drake 化石復原。先制攻擊：Bolt Beak 對滿血的敵人造成雙倍傷害，每次都會替尾巴充電，充滿就放出一圈閃電。',
    arctozolt: '由 Bird 與 Dino 化石復原。冷得發抖，在周圍放出冰冷的環，在雪中更快。Icicle Crash 會冰凍滿血的敵人。',
    dracovish: '由 Fish 與 Drake 化石復原。先制攻擊：Fishious Rend 對滿血的敵人造成雙倍傷害，每次都讓 Dracovish 一段時間內更強更快。',
  },
  moves: {
    wingAttack: '雙翼同時向前劈砍，兩道風刃在前方交錯。',
    spikeCannon: '從外殼扇形射出一連串尖刺。外殼打破時射出更多。',
    ingrain: '根從最近的敵人腳下竄出並困住他們。扎根時威力更強、範圍更大。',
    crushClaw: '利爪向前撕裂，可能標記目標。連續命中會累積連擊。',
    boltBeak: '用電之喙衝向最近的滿血敵人。先制攻擊：雙倍傷害。',
    icicleCrash: '冰柱砸向最近的敵人，並冰凍滿血的敵人。',
    fishiousRend: '躍向最近的滿血敵人狠咬一口。先制攻擊：雙倍傷害。',
  },
  megas: { aerodactyl: '招式+30%、速度+6、防禦+1；俯衝更頻繁，而且連續兩次。必殺技變為 Sky Attack。' },
})

export const GA_FOSSILS_WORDS = { pt, en, es, fr, zh }
