/**
 * Temporada 1's ways into a family that aren't an egg, a table per language
 * (`pt` is the reference). Each language's file holds its table as `seasonUnlocks`.
 * The locked card's lines say where to look, never the odds.
 */
type UnlockWords = {
  /** The partner select's locked card. */
  where: Record<'mankey' | 'goomy' | 'tatsugiri' | 'wishiwashi' | 'rotom' | 'castform' | 'mimikyu' | 'morpeko' | 'tandemaus', string>
  /** The locked card of the five fossil families. */
  fossilBlurb: string
  /** Why the family came, in the gift box. */
  way: Record<'find' | 'research' | 'fishing' | 'safari', string>
  find: { rotom: string; castformSighted: string; castformFound: string; castformGone: string }
  research: {
    tab: string
    intro: string
    complete: string
    hits: (n: string) => string
    wet: (n: number) => string
    partners: (n: number) => string
    have: (names: string) => string
  }
  fishingFamily: (name: string) => string
}

export const SEASON_ONE_UNLOCKS_WORDS: Record<'pt' | 'en' | 'es' | 'fr' | 'zh', UnlockWords> = {
  pt: {
    where: {
      mimikyu: "Só na *Zona Safári*, no Bosque das Bases do Poké Realm. Precisa de conta.",
      morpeko: "Só na *Zona Safári*, no Bosque das Bases do Poké Realm. Precisa de conta.",
      tandemaus: "Só na *Zona Safári*, no Bosque das Bases do Poké Realm. Precisa de conta.",
      mankey: 'Vem de uma *Pesquisa*: vença apanhando bastante. Veja em Missões, aba Pesquisa.',
      goomy: 'Vem de uma *Pesquisa*: vença com os pés molhados. Veja em Missões, aba Pesquisa.',
      tatsugiri: 'Vem de uma *Pesquisa*: vença com parceiros de Água ou Dragão. Veja em Missões, aba Pesquisa.',
      wishiwashi: 'Morde o anzol *longe do píer*, na pesca do Poké Realm. Precisa de conta.',
      rotom: 'Tem algo morando numa *TV velha*, dentro de uma casa abandonada. Quando ela chiar, fique por perto.',
      castform: 'Às vezes flutua pelo mapa quando o *tempo fecha*. Alcance antes que suma.',
    },
    fossilBlurb: 'Choca do *Ovo Fóssil*: cave as paredes do Subterrâneo atrás de Old Amber.',
    way: { find: 'Por um encontro no mapa', research: 'Por concluir uma Pesquisa', fishing: 'Pela sua pescaria', safari: 'Pela sua captura na Zona Safári' },
    find: {
      rotom: 'A TV deu um estalo e *Rotom* escapou! Ele espera na caixa de presentes.',
      castformSighted: 'Um *Castform* está flutuando por perto!',
      castformFound: 'Você alcançou o *Castform*! Ele espera na caixa de presentes.',
      castformGone: 'O Castform sumiu com o vento.',
    },
    research: {
      tab: 'Pesquisa',
      intro: 'Cada pesquisa anda um passo por vitória. Ao concluir, a família chega como presente.',
      complete: 'Concluída!',
      hits: (n) => `Vença o Mewtwo depois de levar ${n} golpes na mesma partida`,
      wet: (n) => `Vença o Mewtwo na chuva, na praia ou na floresta (${n}ª vez)`,
      partners: (n) => (n === 1 ? 'Vença o Mewtwo com um parceiro de Água ou Dragão' : `Vença o Mewtwo com ${n} parceiros diferentes de Água ou Dragão`),
      have: (names) => `Já venceram: ${names}`,
    },
    fishingFamily: (name) => `${name} veio junto! Ele chega na caixa de presentes.`,
  },
  en: {
    where: {
      mimikyu: "Only in the *Safari Zone*, at the Poké Realm's Secret Base Grove. Needs an account.",
      morpeko: "Only in the *Safari Zone*, at the Poké Realm's Secret Base Grove. Needs an account.",
      tandemaus: "Only in the *Safari Zone*, at the Poké Realm's Secret Base Grove. Needs an account.",
      mankey: 'Comes from *Research*: win after taking a beating. See Missions, Research tab.',
      goomy: 'Comes from *Research*: win with your feet wet. See Missions, Research tab.',
      tatsugiri: 'Comes from *Research*: win with Water or Dragon partners. See Missions, Research tab.',
      wishiwashi: 'Bites the hook *far from the pier*, fishing in the Poké Realm. Needs an account.',
      rotom: 'Something lives in an *old TV*, inside an abandoned cottage. When it crackles, stay close.',
      castform: 'Sometimes drifts across the map when the *weather turns*. Reach it before it’s gone.',
    },
    fossilBlurb: 'Hatches from the *Fossil Egg*: dig the Underground’s walls for Old Amber.',
    way: { find: 'For an encounter on the map', research: 'For finishing a Research', fishing: 'For your fishing', safari: 'For your catch in the Safari Zone' },
    find: {
      rotom: 'The TV crackled and *Rotom* got out! It’s waiting in your gift box.',
      castformSighted: 'A *Castform* is drifting nearby!',
      castformFound: 'You reached the *Castform*! It’s waiting in your gift box.',
      castformGone: 'The Castform drifted away.',
    },
    research: {
      tab: 'Research',
      intro: 'Each research moves one step per win. Finish it and the family arrives as a gift.',
      complete: 'Complete!',
      hits: (n) => `Defeat Mewtwo after taking ${n} hits in the same run`,
      wet: (n) => `Defeat Mewtwo in the rain, on the beach or in the forest (time ${n})`,
      partners: (n) => (n === 1 ? 'Defeat Mewtwo with a Water or Dragon partner' : `Defeat Mewtwo with ${n} different Water or Dragon partners`),
      have: (names) => `Already won with: ${names}`,
    },
    fishingFamily: (name) => `${name} came along! It’s on its way to your gift box.`,
  },
  es: {
    where: {
      mimikyu: "Solo en la *Zona Safari*, en el Bosque de Bases del Poké Realm. Necesita cuenta.",
      morpeko: "Solo en la *Zona Safari*, en el Bosque de Bases del Poké Realm. Necesita cuenta.",
      tandemaus: "Solo en la *Zona Safari*, en el Bosque de Bases del Poké Realm. Necesita cuenta.",
      mankey: 'Viene de una *Investigación*: gana después de recibir una paliza. Mira Misiones, pestaña Investigación.',
      goomy: 'Viene de una *Investigación*: gana con los pies mojados. Mira Misiones, pestaña Investigación.',
      tatsugiri: 'Viene de una *Investigación*: gana con compañeros de Agua o Dragón. Mira Misiones, pestaña Investigación.',
      wishiwashi: 'Pica el anzuelo *lejos del muelle*, pescando en el Poké Realm. Necesita una cuenta.',
      rotom: 'Algo vive en un *televisor viejo*, dentro de una casa abandonada. Cuando chisporrotee, quédate cerca.',
      castform: 'A veces flota por el mapa cuando *cambia el clima*. Alcánzalo antes de que se vaya.',
    },
    fossilBlurb: 'Nace del *Huevo Fósil*: excava las paredes del Subsuelo en busca de Old Amber.',
    way: { find: 'Por un encuentro en el mapa', research: 'Por completar una Investigación', fishing: 'Por tu pesca', safari: 'Por tu captura en la Zona Safari' },
    find: {
      rotom: '¡El televisor chisporroteó y *Rotom* escapó! Te espera en la caja de regalos.',
      castformSighted: '¡Un *Castform* flota cerca!',
      castformFound: '¡Alcanzaste al *Castform*! Te espera en la caja de regalos.',
      castformGone: 'El Castform se fue con el viento.',
    },
    research: {
      tab: 'Investigación',
      intro: 'Cada investigación avanza un paso por victoria. Al completarla, la familia llega como regalo.',
      complete: '¡Completada!',
      hits: (n) => `Derrota a Mewtwo tras recibir ${n} golpes en la misma partida`,
      wet: (n) => `Derrota a Mewtwo bajo la lluvia, en la playa o en el bosque (vez ${n})`,
      partners: (n) => (n === 1 ? 'Derrota a Mewtwo con un compañero de Agua o Dragón' : `Derrota a Mewtwo con ${n} compañeros distintos de Agua o Dragón`),
      have: (names) => `Ya ganaron: ${names}`,
    },
    fishingFamily: (name) => `¡${name} vino también! Llegará a tu caja de regalos.`,
  },
  fr: {
    where: {
      mimikyu: "Uniquement au *Parc Safari*, au Bosquet des bases du Poké Realm. Compte requis.",
      morpeko: "Uniquement au *Parc Safari*, au Bosquet des bases du Poké Realm. Compte requis.",
      tandemaus: "Uniquement au *Parc Safari*, au Bosquet des bases du Poké Realm. Compte requis.",
      mankey: 'Vient d’une *Recherche* : gagne après avoir pris des coups. Vois Missions, onglet Recherche.',
      goomy: 'Vient d’une *Recherche* : gagne les pieds mouillés. Vois Missions, onglet Recherche.',
      tatsugiri: 'Vient d’une *Recherche* : gagne avec des partenaires Eau ou Dragon. Vois Missions, onglet Recherche.',
      wishiwashi: 'Mord à l’hameçon *loin du ponton*, à la pêche du Poké Realm. Un compte est nécessaire.',
      rotom: 'Quelque chose vit dans une *vieille télé*, au fond d’une maison abandonnée. Quand elle grésille, reste près d’elle.',
      castform: 'Flotte parfois sur la carte quand le *temps se gâte*. Rejoins-le avant qu’il disparaisse.',
    },
    fossilBlurb: 'Éclot de l’*Œuf Fossile* : creuse les parois du Souterrain pour trouver de l’Old Amber.',
    way: { find: 'Pour une rencontre sur la carte', research: 'Pour avoir terminé une Recherche', fishing: 'Pour ta pêche', safari: 'Pour ta capture au Parc Safari' },
    find: {
      rotom: 'La télé a grésillé et *Rotom* s’est échappé ! Il t’attend dans la boîte à cadeaux.',
      castformSighted: 'Un *Castform* flotte tout près !',
      castformFound: 'Tu as rejoint le *Castform* ! Il t’attend dans la boîte à cadeaux.',
      castformGone: 'Le Castform s’est envolé.',
    },
    research: {
      tab: 'Recherche',
      intro: 'Chaque recherche avance d’une étape par victoire. Termine-la et la famille arrive en cadeau.',
      complete: 'Terminée !',
      hits: (n) => `Vaincs Mewtwo après avoir pris ${n} coups dans la même partie`,
      wet: (n) => `Vaincs Mewtwo sous la pluie, à la plage ou en forêt (fois ${n})`,
      partners: (n) => (n === 1 ? 'Vaincs Mewtwo avec un partenaire Eau ou Dragon' : `Vaincs Mewtwo avec ${n} partenaires Eau ou Dragon différents`),
      have: (names) => `Déjà gagné avec : ${names}`,
    },
    fishingFamily: (name) => `${name} est venu aussi ! Il arrive dans ta boîte à cadeaux.`,
  },
  zh: {
    where: {
      mimikyu: "只在 Poké Realm 秘密基地樹林的*狩獵地帶*出現。需要帳號。",
      morpeko: "只在 Poké Realm 秘密基地樹林的*狩獵地帶*出現。需要帳號。",
      tandemaus: "只在 Poké Realm 秘密基地樹林的*狩獵地帶*出現。需要帳號。",
      mankey: '來自*研究*：挨了不少打之後獲勝。請到任務的「研究」分頁查看。',
      goomy: '來自*研究*：在潮濕的地方獲勝。請到任務的「研究」分頁查看。',
      tatsugiri: '來自*研究*：用水系或龍系夥伴獲勝。請到任務的「研究」分頁查看。',
      wishiwashi: '在 Poké Realm 釣魚時，會在*離碼頭很遠*的地方上鉤。需要帳號。',
      rotom: '廢棄小屋裡的*舊電視*住著什麼東西。電視發出雜音時，請待在旁邊。',
      castform: '*天氣變化*時，偶爾會飄過地圖。要在它消失前追上。',
    },
    fossilBlurb: '由*化石蛋*孵化：在地下通道挖掘牆壁，尋找 Old Amber。',
    way: { find: '獎勵你在地圖上的邂逅', research: '獎勵你完成研究', fishing: '獎勵你的釣魚成果', safari: '獎勵你在狩獵地帶的捕捉' },
    find: {
      rotom: '電視一陣雜音，*Rotom* 跑出來了！牠在禮物箱等你。',
      castformSighted: '有隻 *Castform* 在附近飄著！',
      castformFound: '你追上了 *Castform*！牠在禮物箱等你。',
      castformGone: 'Castform 隨風飄走了。',
    },
    research: {
      tab: '研究',
      intro: '每次獲勝，研究前進一步。完成後，該家族會以禮物送達。',
      complete: '已完成！',
      hits: (n) => `在同一局中受到 ${n} 次攻擊後擊敗 Mewtwo`,
      wet: (n) => `在雨中、海灘或森林擊敗 Mewtwo（第 ${n} 次）`,
      partners: (n) => (n === 1 ? '用水系或龍系夥伴擊敗 Mewtwo' : `用 ${n} 隻不同的水系或龍系夥伴擊敗 Mewtwo`),
      have: (names) => `已獲勝：${names}`,
    },
    fishingFamily: (name) => `${name} 也來了！牠會送到你的禮物箱。`,
  },
}
