/**
 * The lobby tour's words (`ui/lobbyTour.ts`): Rotom's line at each stop and the tour's buttons, a table per language (`pt` is the reference). Pokémon names stay in English.
 */
type Words = {
  /** The tour's name, for screen readers. */
  title: string
  /** Where the tour stands: `2/5`. */
  counter: (at: number, of: number) => string
  next: string
  /** The last stop's button. */
  done: string
  skip: string
  /** Rotom's line at each stop (`LOBBY_STOPS`): one or two short sentences. */
  stops: { play: string; modes: string; today: string; eggs: string; plaza: string }
}

export const LOBBY_TOUR_WORDS: Record<'pt' | 'en' | 'es' | 'fr' | 'zh', Words> = {
  pt: {
    title: 'Tour do lobby',
    counter: (at, of) => `${at}/${of}`,
    next: 'Próximo',
    done: 'Bora!',
    skip: 'Pular tour',
    stops: {
      play: 'Mandou bem! Pra outra run, é só JOGAR. Quer outro parceiro? Toca nele!',
      modes: 'Psiu: Survivors é só um dos modos! Tem Arena, Co-op, Dojo e mais. Troca aqui.',
      today: 'Todo dia tem coisa nova aqui: Desafio do dia, missões que pagam ₽ e surtos de shiny.',
      eggs: 'Ovos chocam enquanto você anda nas runs. É assim que chegam Pokémon novos!',
      plaza: 'Na Praça você gasta seus ₽: loja do Kecleon, Boutique e mais. Agora vai, campeão!',
    },
  },
  en: {
    title: 'Lobby tour',
    counter: (at, of) => `${at}/${of}`,
    next: 'Next',
    done: "Let's go!",
    skip: 'Skip tour',
    stops: {
      play: 'Nice run! For another, just hit PLAY. Want a new partner? Tap it!',
      modes: "Psst: Survivors is just one mode! There's Arena, Co-op, Dojo and more. Switch here.",
      today: "Something new every day: the Daily Challenge, missions that pay ₽ and shiny outbreaks.",
      eggs: "Eggs hatch as you walk in your runs. That's how new Pokémon join you!",
      plaza: 'The Plaza is where your ₽ go: Kecleon’s shop, the Boutique and more. Now go get ’em!',
    },
  },
  es: {
    title: 'Tour del lobby',
    counter: (at, of) => `${at}/${of}`,
    next: 'Siguiente',
    done: '¡Vamos!',
    skip: 'Saltar tour',
    stops: {
      play: '¡Bien jugado! Para otra partida, solo dale a JUGAR. ¿Otro compañero? ¡Tócalo!',
      modes: 'Psst: ¡Survivors es solo un modo! Hay Arena, Co-op, Dojo y más. Cámbialo aquí.',
      today: 'Cada día hay algo nuevo: el Desafío del día, misiones que pagan ₽ y brotes de shinies.',
      eggs: 'Los huevos eclosionan mientras caminas en tus partidas. ¡Así llegan Pokémon nuevos!',
      plaza: 'En la Plaza gastas tus ₽: la tienda de Kecleon, la Boutique y más. ¡Ahora a jugar!',
    },
  },
  fr: {
    title: 'Visite du lobby',
    counter: (at, of) => `${at}/${of}`,
    next: 'Suivant',
    done: 'C’est parti !',
    skip: 'Passer la visite',
    stops: {
      play: 'Bien joué ! Pour une autre partie, appuie sur JOUER. Un autre partenaire ? Touche-le !',
      modes: 'Psst : Survivors n’est qu’un mode ! Il y a l’Arène, la Coop, le Dojo et plus. Change ici.',
      today: 'Du nouveau chaque jour : le Défi du jour, des missions qui paient en ₽ et des apparitions de shinys.',
      eggs: 'Les Œufs éclosent pendant que tu marches en partie. C’est comme ça qu’arrivent de nouveaux Pokémon !',
      plaza: 'Sur la Place, tu dépenses tes ₽ : la Boutique de Kecleon, celle de Leavanny et plus. À toi de jouer !',
    },
  },
  zh: {
    title: '大廳導覽',
    counter: (at, of) => `${at}/${of}`,
    next: '下一步',
    done: '出發！',
    skip: '跳過導覽',
    stops: {
      play: '打得好！想再玩一場就按「開始遊戲」。想換夥伴？點一下牠！',
      modes: '偷偷告訴你：Survivors 只是其中一種模式！還有競技場、合作、道場等等。在這裡切換。',
      today: '每天都有新鮮事：每日挑戰、賺 ₽ 的任務，還有色違大量出現！',
      eggs: '蛋會在你冒險時邊走邊孵化。新的寶可夢就是這樣來的！',
      plaza: '在廣場花你的 ₽：變隱龍商店、精品店等等。好了，出發吧！',
    },
  },
}
