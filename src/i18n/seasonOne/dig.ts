/**
 * A Escavação's words, a table per language (`pt` is the reference). Each
 * language's file spreads `game` into `minigames.games`, `feats` into
 * `minigames.feats` and `words` into `minigames`.
 */
type DigWords = {
  game: { name: string; blurb: string }
  feats: { golden: string; fossilOrStone: string }
  pieces: Record<'digFossilDisplay' | 'digGeodeLamp' | 'digCrystals' | 'digMinecart', string>
  words: {
    keeper: string
    keeperOpen: string
    /** The label above the week's vein, on the entry and the odds sheet. */
    veinKicker: string
    /** Opens the week's odds; `back` closes them. */
    oddsOpen: string
    back: string
    veins: Record<'goldSeam' | 'gemSeam' | 'fossilBed' | 'crystalHollow' | 'cachedSupplies', string>
    veinNote: Record<'goldSeam' | 'gemSeam' | 'fossilBed' | 'crystalHollow' | 'cachedSupplies', string>
    groups: Record<'coins' | 'bag' | 'stone' | 'furniture' | 'fossil', string>
    pct: (share: number) => string
    golden: string
    goldenStart: string
    oneIn: (n: number) => string
    oddsNote: string
    fossilsDone: string
    fossilDue: string
    /** The lab where Galar's fossil halves wait for their other half (`GALAR_PAIRS`). */
    lab: {
      open: string
      kicker: string
      title: string
      note: string
      empty: string
      waiting: (names: string) => string
      tops: string
      bottoms: string
      owned: string
      arctovish: string
    }
    /** A half put in the lab, with what it still needs (`or` joins the names). */
    halfStored: (needs: string) => string
    /** A half that met the one waiting in the lab. */
    halfRestored: (other: string) => string
    or: (a: string, b: string) => string
    fossilProgress: (dry: number, of: number, owned: number, total: number) => string
    powers: Record<'bigHammer' | 'hold' | 'reveal' | 'deepPick', string>
    partnerLine: (name: string, power: string) => string
    partnerNone: (name: string) => string
    today: (used: number, cap: number) => string
    free: string
    paid: (price: string) => string
    resume: string
    resumeNote: string
    cap: string
    funds: string
    profile: string
    failed: string
    retry: string
    stopTitle: string
    stopNote: (n: number) => string
    stopYes: string
    stopNo: string
    repeat: (price: string) => string
    furnitureNote: string
    bagNote: string
    stoneNote: string
    fossilNote: string
    restored: (name: string) => string
    restoredNote: string
    collapsedKept: string
    collapsedNothing: string
    leftWith: string
    leftNothing: string
    coinsTotal: (price: string) => string
    buried: string
    close: string
  }
}

export const SEASON_ONE_DIG_WORDS: Record<'pt' | 'en' | 'es' | 'fr' | 'zh', DigWords> = {
  pt: {
    game: { name: 'Escavação', blurb: 'Quebre a parede e tire o que estiver enterrado antes que ela desabe.' },
    feats: { golden: 'Achei uma parede dourada!', fossilOrStone: 'Tirei um achado raro da parede!' },
    pieces: { digFossilDisplay: 'Vitrine de Fóssil', digGeodeLamp: 'Luminária de Geodo', digCrystals: 'Cristais', digMinecart: 'Vagonete de Mina' },
    words: {
      keeper: 'Bem-vindo à mina. *Picareta* abre uma pedra só, *marreta* abre em cruz e racha mais a parede. Encheu a trinca, desaba tudo!',
      keeperOpen: 'Sua parede continua lá, do jeito que você deixou.',
      veinKicker: 'Veio da semana',
      oddsOpen: 'Ver chances',
      back: 'Voltar',
      veins: { goldSeam: 'Filão de Ouro', gemSeam: 'Veio de Gemas', fossilBed: 'Leito de Fósseis', crystalHollow: 'Gruta de Cristal', cachedSupplies: 'Depósito Perdido' },
      veinNote: { goldSeam: 'Mais *pepitas* nas paredes desta semana.', gemSeam: 'Mais *pedras de evolução* nas paredes desta semana.', fossilBed: 'Mais *fósseis* nas paredes desta semana.', crystalHollow: 'Mais *móveis raros* nas paredes desta semana.', cachedSupplies: 'Mais *itens da Mochila* nas paredes desta semana.' },
      groups: { coins: 'Pepitas (₽)', bag: 'Itens da Mochila', stone: 'Pedras de evolução', furniture: 'Móveis raros', fossil: 'Fósseis' },
      pct: (share) => `${Math.max(1, Math.round(share * 100))}%`,
      golden: 'Parede dourada, muito mais rica',
      goldenStart: 'Uma parede dourada!',
      oneIn: (n) => `1 em ${n}`,
      oddsNote: 'Chance de cada tesouro enterrado ser desse tipo, com o veio desta semana.',
      fossilsDone: 'Você já tem todos os fósseis da mina.',
      fossilDue: 'A próxima parede vem com um fóssil que você não tem!',
      lab: {
        open: 'Laboratório de fósseis',
        kicker: 'Fósseis de Galar',
        title: 'Laboratório de fósseis',
        note: 'Os fósseis de Galar saem em *metades*: uma de cima e uma de baixo. Cada metade espera aqui até a sua outra metade sair da parede, e as duas restauram um Pokémon.',
        empty: 'Nenhuma metade esperando no laboratório.',
        waiting: (names) => `No laboratório: ${names}.`,
        tops: 'De cima',
        bottoms: 'De baixo',
        owned: 'Já é seu',
        arctovish: 'Fish + Dino daria o Arctovish, mas o laboratório ainda não consegue restaurá-lo: por enquanto o Fish só encaixa no Drake, e o Dino só no Bird.',
      },
      halfStored: (needs) => `Guardado no laboratório. Falta: ${needs}.`,
      halfRestored: (other) => `Encaixou no ${other} que esperava no laboratório!`,
      or: (a, b) => `${a} ou ${b}`,
      fossilProgress: (dry, of, owned, total) => `Garantia de fóssil: ${dry} de ${of} paredes. Fósseis: ${owned} de ${total}.`,
      powers: { bigHammer: 'marreta maior', hold: 'parede aguenta mais', reveal: 'revela uma pedra de um tesouro', deepPick: 'picareta corta rocha dura' },
      partnerLine: (name, power) => `${name} ajuda: ${power}.`,
      partnerNone: (name) => `${name} só observa desta vez.`,
      today: (used, cap) => `Hoje: ${used} de ${cap} paredes`,
      free: 'Parede grátis',
      paid: (price) => `Quebrar por ${price}`,
      resume: 'Voltar à parede',
      resumeNote: 'Paga e esperando por você.',
      cap: 'As paredes de hoje acabaram. Volte amanhã!',
      funds: 'Faltam ₽ para outra parede.',
      profile: 'Crie o seu @ para escavar.',
      failed: 'A mina não respondeu. Tente de novo.',
      retry: 'Tentar de novo',
      stopTitle: 'Parar e sair?',
      stopNote: (n) => (n === 0 ? 'Você ainda não tirou nada inteiro. O que ficou pela metade fica enterrado.' : `Você sai com ${n} ${n === 1 ? 'tesouro' : 'tesouros'}. O que ficou pela metade fica enterrado.`),
      stopYes: 'Sair com isso',
      stopNo: 'Continuar',
      repeat: (price) => `Você já tinha: vale ${price}.`,
      furnitureNote: 'Já está nos móveis da sua base secreta.',
      bagNote: 'Foi para a sua Mochila.',
      stoneNote: 'Agora é sua, para sempre.',
      fossilNote: 'Um fóssil inteirinho!',
      restored: (name) => `${name} voltou à vida!`,
      restoredNote: 'Já pode ser o seu parceiro.',
      collapsedKept: 'A parede desabou, mas você salvou isso:',
      collapsedNothing: 'A parede desabou e soterrou tudo.',
      leftWith: 'Você saiu com:',
      leftNothing: 'Você saiu de mãos vazias.',
      coinsTotal: (price) => `Pepitas: +${price}`,
      buried: 'Ficou soterrado:',
      close: 'Sair',
    },
  },
  en: {
    game: { name: 'Mine Dig', blurb: 'Break open the wall and pull out what’s buried before it comes down.' },
    feats: { golden: 'I found a golden wall!', fossilOrStone: 'I dug a rare find out of the wall!' },
    pieces: { digFossilDisplay: 'Fossil Display', digGeodeLamp: 'Geode Lamp', digCrystals: 'Crystal Cluster', digMinecart: 'Mine Cart' },
    words: {
      keeper: 'Welcome to the mine. The *pickaxe* opens one stone, the *hammer* opens a cross and cracks the wall more. Fill the crack and it all comes down!',
      keeperOpen: 'Your wall is right where you left it.',
      veinKicker: 'This week’s vein',
      oddsOpen: 'See odds',
      back: 'Back',
      veins: { goldSeam: 'Gold Seam', gemSeam: 'Gem Seam', fossilBed: 'Fossil Bed', crystalHollow: 'Crystal Hollow', cachedSupplies: 'Lost Cache' },
      veinNote: { goldSeam: 'More *nuggets* in this week’s walls.', gemSeam: 'More *evolution stones* in this week’s walls.', fossilBed: 'More *fossils* in this week’s walls.', crystalHollow: 'More *rare furniture* in this week’s walls.', cachedSupplies: 'More *Bag items* in this week’s walls.' },
      groups: { coins: 'Nuggets (₽)', bag: 'Bag items', stone: 'Evolution stones', furniture: 'Rare furniture', fossil: 'Fossils' },
      pct: (share) => `${Math.max(1, Math.round(share * 100))}%`,
      golden: 'Golden wall, far richer',
      goldenStart: 'A golden wall!',
      oneIn: (n) => `1 in ${n}`,
      oddsNote: 'Chance each buried treasure is this kind, with this week’s vein.',
      fossilsDone: 'You already have every fossil in the mine.',
      fossilDue: 'Your next wall holds a fossil you don’t have!',
      lab: {
        open: 'Fossil lab',
        kicker: 'Galar fossils',
        title: 'Fossil lab',
        note: 'Galar’s fossils come out in *halves*: a top and a bottom. Each half waits here until its other half comes out of a wall, and the two restore a Pokémon.',
        empty: 'No half is waiting in the lab.',
        waiting: (names) => `In the lab: ${names}.`,
        tops: 'Tops',
        bottoms: 'Bottoms',
        owned: 'Yours',
        arctovish: 'Fish + Dino would make Arctovish, but the lab can’t restore it yet: for now the Fish only fits the Drake, and the Dino only the Bird.',
      },
      halfStored: (needs) => `Kept in the lab. Still needs: ${needs}.`,
      halfRestored: (other) => `It fit the ${other} waiting in the lab!`,
      or: (a, b) => `${a} or ${b}`,
      fossilProgress: (dry, of, owned, total) => `Fossil guarantee: ${dry} of ${of} walls. Fossils: ${owned} of ${total}.`,
      powers: { bigHammer: 'a bigger hammer', hold: 'the wall holds longer', reveal: 'shows one stone of a treasure', deepPick: 'the pickaxe cuts hard rock' },
      partnerLine: (name, power) => `${name} helps: ${power}.`,
      partnerNone: (name) => `${name} is just watching this time.`,
      today: (used, cap) => `Today: ${used} of ${cap} walls`,
      free: 'Free wall',
      paid: (price) => `Break for ${price}`,
      resume: 'Back to your wall',
      resumeNote: 'Paid for and waiting.',
      cap: 'That’s all the walls for today. Come back tomorrow!',
      funds: 'Not enough ₽ for another wall.',
      profile: 'Create your @handle to dig.',
      failed: 'The mine didn’t answer. Try again.',
      retry: 'Try again',
      stopTitle: 'Stop and leave?',
      stopNote: (n) => (n === 0 ? 'You haven’t gotten anything out whole yet. What’s half dug stays buried.' : `You leave with ${n} ${n === 1 ? 'treasure' : 'treasures'}. What’s half dug stays buried.`),
      stopYes: 'Leave with these',
      stopNo: 'Keep digging',
      repeat: (price) => `You already had it: worth ${price}.`,
      furnitureNote: 'It’s in your secret base furniture now.',
      bagNote: 'It went into your Bag.',
      stoneNote: 'It’s yours for good.',
      fossilNote: 'A whole fossil!',
      restored: (name) => `${name} is back to life!`,
      restoredNote: 'It can be your partner now.',
      collapsedKept: 'The wall came down, but you saved this:',
      collapsedNothing: 'The wall came down and buried everything.',
      leftWith: 'You left with:',
      leftNothing: 'You left empty-handed.',
      coinsTotal: (price) => `Nuggets: +${price}`,
      buried: 'Left buried:',
      close: 'Leave',
    },
  },
  es: {
    game: { name: 'Excavación', blurb: 'Rompe la pared y saca lo enterrado antes de que se derrumbe.' },
    feats: { golden: '¡Encontré una pared dorada!', fossilOrStone: '¡Saqué un hallazgo raro de la pared!' },
    pieces: { digFossilDisplay: 'Vitrina de Fósil', digGeodeLamp: 'Lámpara de Geoda', digCrystals: 'Cristales', digMinecart: 'Vagoneta de Mina' },
    words: {
      keeper: 'Bienvenido a la mina. El *pico* abre una piedra, el *martillo* abre en cruz y agrieta más la pared. Si la grieta se llena, ¡se viene todo abajo!',
      keeperOpen: 'Tu pared sigue donde la dejaste.',
      veinKicker: 'Veta de la semana',
      oddsOpen: 'Ver probabilidades',
      back: 'Volver',
      veins: { goldSeam: 'Filón de Oro', gemSeam: 'Veta de Gemas', fossilBed: 'Lecho de Fósiles', crystalHollow: 'Gruta de Cristal', cachedSupplies: 'Depósito Perdido' },
      veinNote: { goldSeam: 'Más *pepitas* en las paredes de esta semana.', gemSeam: 'Más *piedras evolutivas* en las paredes de esta semana.', fossilBed: 'Más *fósiles* en las paredes de esta semana.', crystalHollow: 'Más *muebles raros* en las paredes de esta semana.', cachedSupplies: 'Más *objetos de la Mochila* en las paredes de esta semana.' },
      groups: { coins: 'Pepitas (₽)', bag: 'Objetos de la Mochila', stone: 'Piedras evolutivas', furniture: 'Muebles raros', fossil: 'Fósiles' },
      pct: (share) => `${Math.max(1, Math.round(share * 100))}%`,
      golden: 'Pared dorada, mucho más rica',
      goldenStart: '¡Una pared dorada!',
      oneIn: (n) => `1 de ${n}`,
      oddsNote: 'Probabilidad de que cada tesoro enterrado sea de este tipo, con la veta de esta semana.',
      fossilsDone: 'Ya tienes todos los fósiles de la mina.',
      fossilDue: '¡Tu próxima pared trae un fósil que no tienes!',
      lab: {
        open: 'Laboratorio de fósiles',
        kicker: 'Fósiles de Galar',
        title: 'Laboratorio de fósiles',
        note: 'Los fósiles de Galar salen en *mitades*: una de arriba y una de abajo. Cada mitad espera aquí hasta que su otra mitad salga de una pared, y las dos restauran un Pokémon.',
        empty: 'Ninguna mitad espera en el laboratorio.',
        waiting: (names) => `En el laboratorio: ${names}.`,
        tops: 'De arriba',
        bottoms: 'De abajo',
        owned: 'Ya es tuyo',
        arctovish: 'Fish + Dino daría Arctovish, pero el laboratorio aún no logra restaurarlo: por ahora el Fish solo encaja con el Drake, y el Dino solo con el Bird.',
      },
      halfStored: (needs) => `Guardado en el laboratorio. Falta: ${needs}.`,
      halfRestored: (other) => `¡Encajó con el ${other} que esperaba en el laboratorio!`,
      or: (a, b) => `${a} o ${b}`,
      fossilProgress: (dry, of, owned, total) => `Garantía de fósil: ${dry} de ${of} paredes. Fósiles: ${owned} de ${total}.`,
      powers: { bigHammer: 'un martillo más grande', hold: 'la pared aguanta más', reveal: 'revela una piedra de un tesoro', deepPick: 'el pico corta roca dura' },
      partnerLine: (name, power) => `${name} ayuda: ${power}.`,
      partnerNone: (name) => `${name} solo mira esta vez.`,
      today: (used, cap) => `Hoy: ${used} de ${cap} paredes`,
      free: 'Pared gratis',
      paid: (price) => `Romper por ${price}`,
      resume: 'Volver a tu pared',
      resumeNote: 'Pagada y esperándote.',
      cap: 'Se acabaron las paredes de hoy. ¡Vuelve mañana!',
      funds: 'No tienes suficientes ₽ para otra pared.',
      profile: 'Crea tu @ para excavar.',
      failed: 'La mina no respondió. Inténtalo de nuevo.',
      retry: 'Reintentar',
      stopTitle: '¿Parar y salir?',
      stopNote: (n) => (n === 0 ? 'Aún no sacaste nada entero. Lo que quedó a medias se queda enterrado.' : `Sales con ${n} ${n === 1 ? 'tesoro' : 'tesoros'}. Lo que quedó a medias se queda enterrado.`),
      stopYes: 'Salir con esto',
      stopNo: 'Seguir',
      repeat: (price) => `Ya lo tenías: vale ${price}.`,
      furnitureNote: 'Ya está en los muebles de tu base secreta.',
      bagNote: 'Fue a tu Mochila.',
      stoneNote: 'Ahora es tuya para siempre.',
      fossilNote: '¡Un fósil entero!',
      restored: (name) => `¡${name} volvió a la vida!`,
      restoredNote: 'Ya puede ser tu compañero.',
      collapsedKept: 'La pared se derrumbó, pero salvaste esto:',
      collapsedNothing: 'La pared se derrumbó y lo enterró todo.',
      leftWith: 'Saliste con:',
      leftNothing: 'Saliste con las manos vacías.',
      coinsTotal: (price) => `Pepitas: +${price}`,
      buried: 'Quedó enterrado:',
      close: 'Salir',
    },
  },
  fr: {
    game: { name: 'Excavation', blurb: 'Brise la paroi et sors ce qui est enfoui avant qu’elle ne s’écroule.' },
    feats: { golden: 'J’ai trouvé une paroi dorée !', fossilOrStone: 'J’ai sorti une trouvaille rare de la paroi !' },
    pieces: { digFossilDisplay: 'Vitrine à Fossile', digGeodeLamp: 'Lampe Géode', digCrystals: 'Cristaux', digMinecart: 'Wagonnet de Mine' },
    words: {
      keeper: 'Bienvenue à la mine. La *pioche* ouvre une pierre, la *masse* ouvre en croix et fissure plus la paroi. Si la fissure se remplit, tout s’écroule !',
      keeperOpen: 'Ta paroi t’attend là où tu l’as laissée.',
      veinKicker: 'Filon de la semaine',
      oddsOpen: 'Voir les chances',
      back: 'Retour',
      veins: { goldSeam: 'Filon d’Or', gemSeam: 'Filon de Gemmes', fossilBed: 'Lit de Fossiles', crystalHollow: 'Grotte de Cristal', cachedSupplies: 'Réserve Perdue' },
      veinNote: { goldSeam: 'Plus de *pépites* dans les parois de cette semaine.', gemSeam: 'Plus de *pierres d’évolution* dans les parois de cette semaine.', fossilBed: 'Plus de *fossiles* dans les parois de cette semaine.', crystalHollow: 'Plus de *meubles rares* dans les parois de cette semaine.', cachedSupplies: 'Plus d’*objets du Sac* dans les parois de cette semaine.' },
      groups: { coins: 'Pépites (₽)', bag: 'Objets du Sac', stone: 'Pierres d’évolution', furniture: 'Meubles rares', fossil: 'Fossiles' },
      pct: (share) => `${Math.max(1, Math.round(share * 100))} %`,
      golden: 'Paroi dorée, bien plus riche',
      goldenStart: 'Une paroi dorée !',
      oneIn: (n) => `1 sur ${n}`,
      oddsNote: 'Chance que chaque trésor enfoui soit de ce type, avec le filon de la semaine.',
      fossilsDone: 'Tu as déjà tous les fossiles de la mine.',
      fossilDue: 'Ta prochaine paroi contient un fossile que tu n’as pas !',
      lab: {
        open: 'Labo des fossiles',
        kicker: 'Fossiles de Galar',
        title: 'Labo des fossiles',
        note: 'Les fossiles de Galar sortent en *moitiés* : un haut et un bas. Chaque moitié attend ici que l’autre sorte d’une paroi, et les deux restaurent un Pokémon.',
        empty: 'Aucune moitié n’attend au labo.',
        waiting: (names) => `Au labo : ${names}.`,
        tops: 'Hauts',
        bottoms: 'Bas',
        owned: 'Déjà à toi',
        arctovish: 'Fish + Dino donnerait Arctovish, mais le labo ne sait pas encore le restaurer : pour l’instant le Fish ne va qu’avec le Drake, et le Dino qu’avec le Bird.',
      },
      halfStored: (needs) => `Rangé au labo. Il manque : ${needs}.`,
      halfRestored: (other) => `Ça s’emboîte avec le ${other} qui attendait au labo !`,
      or: (a, b) => `${a} ou ${b}`,
      fossilProgress: (dry, of, owned, total) => `Garantie de fossile : ${dry} sur ${of} parois. Fossiles : ${owned} sur ${total}.`,
      powers: { bigHammer: 'une masse plus grande', hold: 'la paroi tient plus longtemps', reveal: 'montre une pierre d’un trésor', deepPick: 'la pioche tranche la roche dure' },
      partnerLine: (name, power) => `${name} aide : ${power}.`,
      partnerNone: (name) => `${name} regarde, cette fois.`,
      today: (used, cap) => `Aujourd’hui : ${used} sur ${cap} parois`,
      free: 'Paroi gratuite',
      paid: (price) => `Briser pour ${price}`,
      resume: 'Revenir à ta paroi',
      resumeNote: 'Payée et en attente.',
      cap: 'C’est tout pour aujourd’hui. Reviens demain !',
      funds: 'Pas assez de ₽ pour une autre paroi.',
      profile: 'Crée ton @ pour creuser.',
      failed: 'La mine n’a pas répondu. Réessaie.',
      retry: 'Réessayer',
      stopTitle: 'Arrêter et sortir ?',
      stopNote: (n) => (n === 0 ? 'Tu n’as encore rien sorti d’entier. Ce qui est à moitié creusé reste enfoui.' : `Tu sors avec ${n} ${n === 1 ? 'trésor' : 'trésors'}. Ce qui est à moitié creusé reste enfoui.`),
      stopYes: 'Sortir avec ça',
      stopNo: 'Continuer',
      repeat: (price) => `Tu l’avais déjà : vaut ${price}.`,
      furnitureNote: 'Dans les meubles de ta base secrète.',
      bagNote: 'Il est dans ton Sac.',
      stoneNote: 'Elle est à toi pour de bon.',
      fossilNote: 'Un fossile entier !',
      restored: (name) => `${name} revit !`,
      restoredNote: 'Il peut devenir ton partenaire.',
      collapsedKept: 'La paroi s’est écroulée, mais tu as sauvé ça :',
      collapsedNothing: 'La paroi s’est écroulée et a tout enfoui.',
      leftWith: 'Tu repars avec :',
      leftNothing: 'Tu repars les mains vides.',
      coinsTotal: (price) => `Pépites : +${price}`,
      buried: 'Resté enfoui :',
      close: 'Sortir',
    },
  },
  zh: {
    game: { name: '礦坑挖掘', blurb: '敲開岩壁，在它崩塌前把埋著的寶物挖出來。' },
    feats: { golden: '我找到黃金岩壁了！', fossilOrStone: '我從岩壁挖出稀有寶物！' },
    pieces: { digFossilDisplay: '化石展示櫃', digGeodeLamp: '晶洞燈', digCrystals: '水晶', digMinecart: '礦車' },
    words: {
      keeper: '歡迎來到礦坑。*十字鎬*敲開一格，*大鎚*敲開十字範圍但更傷岩壁。裂痕滿了，整面牆就會崩塌！',
      keeperOpen: '你的岩壁還在原處等你。',
      veinKicker: '本週礦脈',
      oddsOpen: '查看機率',
      back: '返回',
      veins: { goldSeam: '黃金礦脈', gemSeam: '寶石礦脈', fossilBed: '化石層', crystalHollow: '水晶洞', cachedSupplies: '遺失的倉庫' },
      veinNote: { goldSeam: '本週岩壁裡有更多*金塊*。', gemSeam: '本週岩壁裡有更多*進化石*。', fossilBed: '本週岩壁裡有更多*化石*。', crystalHollow: '本週岩壁裡有更多*稀有家具*。', cachedSupplies: '本週岩壁裡有更多*背包道具*。' },
      groups: { coins: '金塊（₽）', bag: '背包道具', stone: '進化石', furniture: '稀有家具', fossil: '化石' },
      pct: (share) => `${Math.max(1, Math.round(share * 100))}%`,
      golden: '黃金岩壁，寶物多得多',
      goldenStart: '黃金岩壁！',
      oneIn: (n) => `${n} 分之 1`,
      oddsNote: '每件埋藏的寶物屬於這一類的機率（已計入本週礦脈）。',
      fossilsDone: '礦坑的化石你全都有了。',
      fossilDue: '你的下一面岩壁必定有你還沒有的化石！',
      lab: {
        open: '化石研究所',
        kicker: '伽勒爾化石',
        title: '化石研究所',
        note: '伽勒爾的化石會分成*兩半*挖出來：上半部和下半部。每一半都會在這裡等，直到另一半從岩壁挖出，兩半合起來就能復原一隻寶可夢。',
        empty: '研究所裡沒有等待中的化石。',
        waiting: (names) => `研究所裡有：${names}。`,
        tops: '上半部',
        bottoms: '下半部',
        owned: '已擁有',
        arctovish: 'Fish + Dino 會是 Arctovish，但研究所還無法復原它：目前 Fish 只能配 Drake，Dino 只能配 Bird。',
      },
      halfStored: (needs) => `存放在研究所。還缺：${needs}。`,
      halfRestored: (other) => `和研究所裡等待的 ${other} 合起來了！`,
      or: (a, b) => `${a} 或 ${b}`,
      fossilProgress: (dry, of, owned, total) => `化石保底：${dry} / ${of} 面岩壁。化石：${owned} / ${total}。`,
      powers: { bigHammer: '大鎚範圍更大', hold: '岩壁更耐敲', reveal: '顯示寶物的一格', deepPick: '十字鎬能切開硬岩' },
      partnerLine: (name, power) => `${name} 幫忙：${power}。`,
      partnerNone: (name) => `${name} 這次只是在旁邊看。`,
      today: (used, cap) => `今天：${used} / ${cap} 面岩壁`,
      free: '免費岩壁',
      paid: (price) => `花 ${price} 敲開`,
      resume: '回到你的岩壁',
      resumeNote: '已付款，正等著你。',
      cap: '今天的岩壁用完了，明天再來！',
      funds: '₽ 不夠挖下一面岩壁。',
      profile: '建立你的 @ 才能挖掘。',
      failed: '礦坑沒有回應，請再試一次。',
      retry: '再試一次',
      stopTitle: '要停手離開嗎？',
      stopNote: (n) => (n === 0 ? '你還沒有挖出完整的東西。挖到一半的會留在岩壁裡。' : `你會帶著 ${n} 件寶物離開。挖到一半的會留在岩壁裡。`),
      stopYes: '帶這些離開',
      stopNo: '繼續挖',
      repeat: (price) => `你已經有了，換成 ${price}。`,
      furnitureNote: '已放進你的秘密基地家具。',
      bagNote: '已放進你的背包。',
      stoneNote: '永遠屬於你了。',
      fossilNote: '完整的化石！',
      restored: (name) => `${name} 復活了！`,
      restoredNote: '現在可以當你的夥伴了。',
      collapsedKept: '岩壁崩塌了，但你救出了這些：',
      collapsedNothing: '岩壁崩塌，全都被埋住了。',
      leftWith: '你帶走了：',
      leftNothing: '你空手離開了。',
      coinsTotal: (price) => `金塊：+${price}`,
      buried: '被埋住的：',
      close: '離開',
    },
  },
}
