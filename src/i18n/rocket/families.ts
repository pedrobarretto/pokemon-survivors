import { enVocab, esVocab, fork, frVocab, ptVocab, zhVocab, type Vocab } from '../seasonOne/kits'

/**
 * The Rocket Game Corner's prize families' words (`data/rocketFamilies.ts`),
 * a table per language (`pt` is the reference): their partner blurbs, their
 * signatures (the level-up lines built from `game/rocketKitMoves.ts`'s steps,
 * so all five stay in step), their Megas and where a locked one is found.
 */

const stepLines = (v: Vocab) => ({
  transform: [v.d(3), v.amt(1), fork(v, ['burstOnKill', v.d(3)], ['echo', v.c(0.4)]), v.d(3), v.a(20), fork(v, ['hunter', v.d(4)], ['drain', v.amt(1)]), v.d(4)],
  razorWind: [v.d(2), v.p(1), fork(v, ['execute', v.d(2)], ['seek', v.amt(1)]), v.d(2), v.c(0.15), fork(v, ['cruel', v.d(3)], ['split', v.amt(1)]), v.d(3)],
  makeItRain: [v.d(2), v.amt(1), fork(v, ['burstOnKill', v.d(2)], ['arc', v.c(0.25)]), v.d(2), v.amt(1), fork(v, ['cruel', v.d(3)], ['echo', v.a(25)]), v.d(3)],
  viseGrip: [v.d(3), v.a(20), fork(v, ['execute', v.d(3)], ['drain', v.c(0.2)]), v.d(3), v.a(20), fork(v, ['hunter', v.d(4)], ['burstOnKill', v.c(0.2)]), v.d(4)],
}) as const

type Descriptions = Record<keyof ReturnType<typeof stepLines>, string>

const movesOf = (v: Vocab, text: Descriptions) => {
  const lines = stepLines(v)
  return {
    transform: { description: text.transform, upgrades: lines.transform },
    razorWind: { description: text.razorWind, upgrades: lines.razorWind },
    makeItRain: { description: text.makeItRain, upgrades: lines.makeItRain },
    viseGrip: { description: text.viseGrip, upgrades: lines.viseGrip },
  } as const
}

type Family = 'ditto' | 'absol' | 'gimmighoul' | 'mawile'

type Words = {
  blurbs: Record<Family, string>
  moves: ReturnType<typeof movesOf>
  megas: { absol: string; mawile: string }
  /** The locked card's line: where the family comes from. */
  where: Record<Family, string>
}

export const ROCKET_FAMILY_WORDS: Record<'pt' | 'en' | 'es' | 'fr' | 'zh', Words> = {
  pt: {
    blurbs: {
      ditto: 'Transform copia o inimigo mais forte por perto: a aparência, o tipo (seus golpes desse tipo ficam mais fortes) e um atributo, conforme o que copiou.',
      absol: 'Pressente a desgraça: marca com um Presságio o inimigo mais duro à vista, e quando ele cai leva os vizinhos junto.',
      gimmighoul: 'Junta moedas: cada ₽ que pega na partida engorda Make It Rain e, juntando 999, evolui para Gholdengo no nível seguinte. Sem as moedas, não evolui.',
      mawile: 'As mandíbulas ficam nas costas: Vise Grip e a mordida do Enganador pegam quem vem por trás.',
    },
    moves: movesOf(ptVocab, {
      transform: 'Vira o inimigo mais forte por perto (chefe, depois elite) e o acerta com o tipo dele. A cópia dura alguns segundos.',
      razorWind: 'Lâminas de vento em leque no alvo do Presságio, ou no mais próximo. Ferem mais quem está marcado.',
      makeItRain: 'Uma chuva de moedas cai sobre os inimigos por perto, mais pesada quanto mais moedas juntou na partida.',
      viseGrip: 'As mandíbulas se fecham atrás de você e desaceleram. Mega Mawile morde dos dois lados.',
    }),
    megas: {
      absol: 'golpes +30%, velocidade +10 e recargas −8%. O especial vira Night Slash.',
      mawile: 'golpes +45% e armadura +1; Vise Grip e o Enganador mordem dos dois lados. O especial vira Heavy Slam.',
    },
    where: {
      ditto: 'Prêmio do balcão do Game Corner da Equipe Rocket, no Poké Realm.',
      absol: 'Prêmio do balcão do Game Corner da Equipe Rocket, no Poké Realm.',
      gimmighoul: 'Prêmio do balcão do Game Corner da Equipe Rocket, no Poké Realm.',
      mawile: 'Prêmio do balcão do Game Corner da Equipe Rocket, no Poké Realm.',
    },
  },
  en: {
    blurbs: {
      ditto: 'Transform copies the strongest foe nearby: its look, its type (your moves of that type hit harder) and a stat, depending on what it copied.',
      absol: 'It senses disaster: it marks the toughest foe in view with an Omen, and when that foe falls it takes its neighbors down with it.',
      gimmighoul: 'It gathers coins: every ₽ it picks up in a run feeds Make It Rain and, once it holds 999, it evolves into Gholdengo at its next level. Without the coins it never evolves.',
      mawile: 'Its jaws are on its back: Vise Grip and the Deceiver’s bite catch whatever comes from behind.',
    },
    moves: movesOf(enVocab, {
      transform: 'Becomes the strongest foe nearby (a boss, then an elite) and strikes it with its own type. The copy lasts a few seconds.',
      razorWind: 'A fan of wind blades at the Omen’s target, or the nearest foe. They cut deeper into marked foes.',
      makeItRain: 'Coins rain down on the foes nearby, heavier the more coins it gathered this run.',
      viseGrip: 'The jaws snap shut behind you and slow. Mega Mawile bites both ways.',
    }),
    megas: {
      absol: 'moves +30%, speed +10 and cooldowns −8%. The special becomes Night Slash.',
      mawile: 'moves +45% and armor +1; Vise Grip and the Deceiver bite both ways. The special becomes Heavy Slam.',
    },
    where: {
      ditto: 'A prize at Team Rocket’s Game Corner counter, in the Poké Realm.',
      absol: 'A prize at Team Rocket’s Game Corner counter, in the Poké Realm.',
      gimmighoul: 'A prize at Team Rocket’s Game Corner counter, in the Poké Realm.',
      mawile: 'A prize at Team Rocket’s Game Corner counter, in the Poké Realm.',
    },
  },
  es: {
    blurbs: {
      ditto: 'Transform copia al enemigo más fuerte cerca: su aspecto, su tipo (tus ataques de ese tipo pegan más) y un atributo, según lo que copió.',
      absol: 'Presiente la desgracia: marca con un Presagio al enemigo más duro a la vista, y cuando cae se lleva a sus vecinos.',
      gimmighoul: 'Junta monedas: cada ₽ que recoge en la partida engorda Make It Rain y, al juntar 999, evoluciona a Gholdengo en el siguiente nivel. Sin las monedas, no evoluciona.',
      mawile: 'Sus fauces están en la espalda: Vise Grip y el mordisco del Engaño atrapan a quien viene por detrás.',
    },
    moves: movesOf(esVocab, {
      transform: 'Se vuelve el enemigo más fuerte cerca (jefe, luego élite) y lo golpea con su propio tipo. La copia dura unos segundos.',
      razorWind: 'Cuchillas de viento en abanico al blanco del Presagio, o al más cercano. Hieren más a los marcados.',
      makeItRain: 'Una lluvia de monedas cae sobre los enemigos cercanos, más pesada cuantas más monedas juntó en la partida.',
      viseGrip: 'Las fauces se cierran detrás de ti y ralentizan. Mega Mawile muerde a ambos lados.',
    }),
    megas: {
      absol: 'ataques +30%, velocidad +10 y recargas −8%. El especial pasa a ser Night Slash.',
      mawile: 'ataques +45% y armadura +1; Vise Grip y el Engaño muerden a ambos lados. El especial pasa a ser Heavy Slam.',
    },
    where: {
      ditto: 'Premio del mostrador del Casino del Team Rocket, en el Poké Realm.',
      absol: 'Premio del mostrador del Casino del Team Rocket, en el Poké Realm.',
      gimmighoul: 'Premio del mostrador del Casino del Team Rocket, en el Poké Realm.',
      mawile: 'Premio del mostrador del Casino del Team Rocket, en el Poké Realm.',
    },
  },
  fr: {
    blurbs: {
      ditto: 'Transform copie l’ennemi le plus fort à proximité : son apparence, son type (vos attaques de ce type frappent plus fort) et une stat selon ce qu’il a copié.',
      absol: 'Il pressent le malheur : il marque d’un Présage l’ennemi le plus coriace en vue, et quand il tombe il emporte ses voisins.',
      gimmighoul: 'Il amasse des pièces : chaque ₽ ramassé pendant la partie nourrit Make It Rain et, une fois 999 amassées, il évolue en Gholdengo au niveau suivant. Sans les pièces, il n’évolue pas.',
      mawile: 'Ses mâchoires sont dans son dos : Vise Grip et la morsure de la Tromperie happent ce qui vient par derrière.',
    },
    moves: movesOf(frVocab, {
      transform: 'Devient l’ennemi le plus fort à proximité (un boss, puis une élite) et le frappe avec son propre type. La copie dure quelques secondes.',
      razorWind: 'Un éventail de lames de vent vers la cible du Présage, ou l’ennemi le plus proche. Elles blessent plus les ennemis marqués.',
      makeItRain: 'Une pluie de pièces s’abat sur les ennemis proches, plus lourde selon les pièces amassées pendant la partie.',
      viseGrip: 'Les mâchoires se referment derrière vous et ralentissent. Méga-Mawile mord des deux côtés.',
    }),
    megas: {
      absol: 'attaques +30 %, vitesse +10 et recharges −8 %. Le spécial devient Night Slash.',
      mawile: 'attaques +45 % et armure +1 ; Vise Grip et la Tromperie mordent des deux côtés. Le spécial devient Heavy Slam.',
    },
    where: {
      ditto: 'Un lot au comptoir de la Salle de jeux de la Team Rocket, dans le Poké Realm.',
      absol: 'Un lot au comptoir de la Salle de jeux de la Team Rocket, dans le Poké Realm.',
      gimmighoul: 'Un lot au comptoir de la Salle de jeux de la Team Rocket, dans le Poké Realm.',
      mawile: 'Un lot au comptoir de la Salle de jeux de la Team Rocket, dans le Poké Realm.',
    },
  },
  zh: {
    blurbs: {
      ditto: 'Transform 會複製附近最強的敵人：外表、屬性（你的該屬性招式更強）以及依對象而定的一項能力。',
      absol: '能感知災厄：替視野中最難纏的敵人刻上預兆，它倒下時會拖著周圍的敵人一起。',
      gimmighoul: '收集硬幣：本局撿到的每 ₽ 都會強化 Make It Rain，集滿 999 後，在下一次升級時進化成 Gholdengo。沒有硬幣就不會進化。',
      mawile: '大顎長在背後：Vise Grip 與欺詐之咬會咬住從背後靠近的敵人。',
    },
    moves: movesOf(zhVocab, {
      transform: '變成附近最強的敵人（先頭目，再菁英），並以對方的屬性攻擊它。複製會持續幾秒。',
      razorWind: '向預兆目標或最近的敵人扇形射出風刃。對被標記的敵人傷害更高。',
      makeItRain: '硬幣如雨落在附近的敵人身上，本局收集的硬幣越多越重。',
      viseGrip: '大顎在你身後猛然咬合並使其減速。Mega Mawile 兩側都會咬。',
    }),
    megas: {
      absol: '招式 +30%、速度 +10、冷卻 −8%。特殊攻擊變為 Night Slash。',
      mawile: '招式 +45%、防禦 +1；Vise Grip 與欺詐兩側都會咬。特殊攻擊變為 Heavy Slam。',
    },
    where: {
      ditto: '寶可夢領域中火箭隊遊戲城的兌獎櫃台獎品。',
      absol: '寶可夢領域中火箭隊遊戲城的兌獎櫃台獎品。',
      gimmighoul: '寶可夢領域中火箭隊遊戲城的兌獎櫃台獎品。',
      mawile: '寶可夢領域中火箭隊遊戲城的兌獎櫃台獎品。',
    },
  },
}
