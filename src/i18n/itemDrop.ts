/**
 * Largar item's words (`ui/itemSwap.ts`, the pause menu's item rows, the
 * swap cards), a table per language (`pt` is the reference). Item and move
 * names stay in English and come in as arguments.
 */
type Words = {
  /** A full build's new-item card: the tag and the line under it. */
  swapTag: string
  swapNote: string
  swapTitle: string
  prompt: string
  /** No refund, and how many level-ups the dropped item sits out. */
  note: (levels: number) => string
  back: string
  hintKeys: string
  hintTouch: string
  /** Under an item: the held move it evolves. */
  pairOf: (move: string) => string
  dropTitle: string
  pauseHint: string
  confirm: (item: string) => string
  confirmPair: (move: string, levels: number) => string
  yes: string
  no: string
  dropped: (item: string) => string
}

export const ITEM_DROP_WORDS: Record<'pt' | 'en' | 'es' | 'fr' | 'zh', Words> = {
  pt: {
    swapTag: 'TROCA',
    swapNote: 'Espaços cheios: escolha um item para largar.',
    swapTitle: 'Trocar de item',
    prompt: 'Os 6 espaços estão cheios. Qual item sai?',
    note: (n) => `Sem reembolso: o item largado some da build e só volta às ofertas daqui a ${n} níveis.`,
    back: 'Voltar',
    hintKeys: '↑↓ escolher · Enter largar · Esc voltar',
    hintTouch: 'Toque no item que vai sair',
    pairOf: (move) => `evolui ${move}`,
    dropTitle: 'Largar este item',
    pauseHint: 'Toque num item para largá-lo.',
    confirm: (item) => `Largar ${item}?`,
    confirmPair: (move, n) => `Sem ele, ${move} não evolui. Sem reembolso, e ele só volta às ofertas daqui a ${n} níveis.`,
    yes: 'Largar',
    no: 'Manter',
    dropped: (item) => `**${item}** largado. O espaço está livre.`,
  },
  en: {
    swapTag: 'SWAP',
    swapNote: 'Slots full: pick an item to drop.',
    swapTitle: 'Swap an item',
    prompt: 'All 6 slots are full. Which item goes?',
    note: (n) => `No refund: the dropped item leaves your build and only comes back to the offers in ${n} levels.`,
    back: 'Back',
    hintKeys: '↑↓ choose · Enter drop · Esc back',
    hintTouch: 'Tap the item to drop',
    pairOf: (move) => `evolves ${move}`,
    dropTitle: 'Drop this item',
    pauseHint: 'Tap an item to drop it.',
    confirm: (item) => `Drop ${item}?`,
    confirmPair: (move, n) => `Without it, ${move} can't evolve. No refund, and it only comes back to the offers in ${n} levels.`,
    yes: 'Drop',
    no: 'Keep',
    dropped: (item) => `**${item}** dropped. The slot is free.`,
  },
  es: {
    swapTag: 'CAMBIO',
    swapNote: 'Espacios llenos: elige un objeto para soltar.',
    swapTitle: 'Cambiar de objeto',
    prompt: 'Los 6 espacios están llenos. ¿Qué objeto sale?',
    note: (n) => `Sin reembolso: el objeto soltado sale de tu build y solo vuelve a las ofertas en ${n} niveles.`,
    back: 'Volver',
    hintKeys: '↑↓ elegir · Enter soltar · Esc volver',
    hintTouch: 'Toca el objeto que va a salir',
    pairOf: (move) => `evoluciona ${move}`,
    dropTitle: 'Soltar este objeto',
    pauseHint: 'Toca un objeto para soltarlo.',
    confirm: (item) => `¿Soltar ${item}?`,
    confirmPair: (move, n) => `Sin él, ${move} no evoluciona. Sin reembolso, y solo vuelve a las ofertas en ${n} niveles.`,
    yes: 'Soltar',
    no: 'Conservar',
    dropped: (item) => `**${item}** soltado. El espacio está libre.`,
  },
  fr: {
    swapTag: 'ECHANGE',
    swapNote: 'Emplacements pleins : choisissez un objet à lâcher.',
    swapTitle: 'Échanger un objet',
    prompt: 'Les 6 emplacements sont pleins. Quel objet part ?',
    note: (n) => `Sans remboursement : l’objet lâché quitte votre build et ne revient dans les offres que dans ${n} niveaux.`,
    back: 'Retour',
    hintKeys: '↑↓ choisir · Entrée lâcher · Échap retour',
    hintTouch: 'Touchez l’objet à lâcher',
    pairOf: (move) => `fait évoluer ${move}`,
    dropTitle: 'Lâcher cet objet',
    pauseHint: 'Touchez un objet pour le lâcher.',
    confirm: (item) => `Lâcher ${item} ?`,
    confirmPair: (move, n) => `Sans lui, ${move} ne peut pas évoluer. Sans remboursement, et il ne revient dans les offres que dans ${n} niveaux.`,
    yes: 'Lâcher',
    no: 'Garder',
    dropped: (item) => `**${item}** lâché. L’emplacement est libre.`,
  },
  zh: {
    swapTag: '交換',
    swapNote: '欄位已滿：選一個道具丟掉。',
    swapTitle: '交換道具',
    prompt: '6 個欄位都滿了。要丟掉哪個道具？',
    note: (n) => `不會退還：丟掉的道具會離開你的組合，${n} 級之後才會再出現在選項中。`,
    back: '返回',
    hintKeys: '↑↓ 選擇 · Enter 丟掉 · Esc 返回',
    hintTouch: '點選要丟掉的道具',
    pairOf: (move) => `進化 ${move}`,
    dropTitle: '丟掉這個道具',
    pauseHint: '點選道具即可丟掉。',
    confirm: (item) => `丟掉 ${item}？`,
    confirmPair: (move, n) => `沒有它，${move} 就無法進化。不會退還，${n} 級之後才會再出現在選項中。`,
    yes: '丟掉',
    no: '保留',
    dropped: (item) => `已丟掉 **${item}**。欄位空出來了。`,
  },
}
