import type { RadioGroup, RadioThemeId } from '../data/radio'
import type { RadioRepeat, RadioWhere } from '../radioRules'

/**
 * The Rádio's words (`ui/radio.ts`, its lobby button, the now-playing pills
 * and Settings' row), a table per language (`pt` is the reference). `tracks`
 * names every theme of `RADIO_TRACKS` (`data/radio.ts`): the game's own
 * tunes, so their names are the game's too.
 */
type Words = {
  title: string
  /** Rotom's line atop the sheet. */
  host: string
  /** The lobby's button and Settings' Som row. */
  open: string
  where: string
  places: Record<RadioWhere, string>
  /** With "everywhere": boss fights and legends' domains play the queue too. */
  fights: string
  tabs: { queue: string; library: string; favorites: string }
  groups: Record<RadioGroup, string>
  tracks: Record<RadioThemeId, string>
  prev: string
  next: string
  play: string
  stop: string
  shuffle: string
  repeat: Record<RadioRepeat, string>
  playNow: string
  add: string
  queued: string
  remove: string
  up: string
  down: string
  favorite: string
  unfavorite: string
  locked: string
  /** How a locked track opens: walking in its biome, or meeting one of its legends. */
  lockBiome: (biome: string) => string
  lockLegend: (names: string) => string
  lockHeard: string
  queueEmpty: string
  favoritesEmpty: string
  playFavorites: string
  playAll: string
  /** The sheet's top line while nothing of the queue plays: the game's own music. */
  idle: string
  /** The pill's label, before the track. */
  nowPlaying: string
  hintKeys: string
  hintTouch: string
}

export const RADIO_WORDS: Record<'pt' | 'en' | 'es' | 'fr' | 'zh', Words> = {
  pt: {
    title: 'Rádio',
    host: 'Bzzt! Eu cuido da rádio. Escolha o que toca e eu troco de música a cada duas voltas.',
    open: 'Rádio',
    where: 'Onde toca',
    places: { menus: 'Só nos menus', everywhere: 'Em todo lugar' },
    fights: 'Também nas lutas',
    tabs: { queue: 'Fila', library: 'Músicas', favorites: 'Favoritas' },
    groups: { menus: 'Menus', realm: 'Poké Realm', biomes: 'Biomas', bosses: 'Chefes', legends: 'Lendários' },
    tracks: {
      menu: 'Vila Tranquila', run: 'Primeiros Passos', forest: 'Entre as Folhas', beach: 'Maré de Verão', cave: 'Gotas no Escuro', plant: 'Alta Voltagem', desert: 'Areias Sem Fim', snow: 'Cume Gelado', volcano: 'Rio de Lava', tower: 'Caixinha da Torre',
      realmTown: 'Cidade do Realm', cafe: 'Café da Esquina', fishing: 'Píer ao Entardecer', arcade: 'Fliperama', gameCorner: 'Game Corner', dig: 'Escavação', safariField: 'Zona Safári', safariBattle: 'Batalha Safári', contest: 'Concurso de Insetos',
      boss: 'Chefe Selvagem', birds: 'Asas Lendárias', beasts: 'Corrida das Feras', regis: 'Gigantes Despertos', mewtwo: 'Clone Furioso', arceus: 'O Primeiro',
      lugia: 'Mergulho Prateado', hoOh: 'Arco-Íris em Chamas', kyogre: 'Oceano Primordial', groudon: 'Terra Primordial', rayquaza: 'Dragão do Céu', latis: 'Voo Eon', deoxys: 'Sinal do Espaço', dialga: 'Ponteiros Parados', palkia: 'Espaço Dobrado', ultraSpace: 'Ultraespaço',
    },
    prev: 'Anterior',
    next: 'Próxima',
    play: 'Tocar',
    stop: 'Parar',
    shuffle: 'Aleatório',
    repeat: { off: 'Sem repetir', all: 'Repetir fila', one: 'Repetir uma' },
    playNow: 'Tocar agora',
    add: 'Pôr na fila',
    queued: 'Na fila',
    remove: 'Tirar da fila',
    up: 'Subir',
    down: 'Descer',
    favorite: 'Favoritar',
    unfavorite: 'Desfavoritar',
    locked: 'Bloqueada',
    lockBiome: (biome) => `Ande por ${biome} numa partida.`,
    lockLegend: (names) => `Encontre ${names}.`,
    lockHeard: 'Ouça uma vez para liberar.',
    queueEmpty: 'A fila está vazia. Ponha músicas nela em Músicas.',
    favoritesEmpty: 'Toque na ★ de uma música para guardá-la aqui.',
    playFavorites: 'Tocar favoritas',
    playAll: 'Tocar todas',
    idle: 'Tocando a música do jogo',
    nowPlaying: 'Tocando',
    hintKeys: 'Q/E abas · ↑↓ rolar · N próxima · Esc voltar',
    hintTouch: 'Toque numa música para tocar',
  },
  en: {
    title: 'Radio',
    host: 'Bzzt! I run the radio. Pick what plays and I’ll switch tunes every two loops.',
    open: 'Radio',
    where: 'Where it plays',
    places: { menus: 'Menus only', everywhere: 'Everywhere' },
    fights: 'In fights too',
    tabs: { queue: 'Queue', library: 'Tracks', favorites: 'Favorites' },
    groups: { menus: 'Menus', realm: 'Poké Realm', biomes: 'Biomes', bosses: 'Bosses', legends: 'Legendaries' },
    tracks: {
      menu: 'Quiet Village', run: 'First Steps', forest: 'Under the Leaves', beach: 'Summer Tide', cave: 'Drops in the Dark', plant: 'High Voltage', desert: 'Endless Sands', snow: 'Frozen Peak', volcano: 'Lava River', tower: 'Tower Music Box',
      realmTown: 'Realm Town', cafe: 'Corner Café', fishing: 'Pier at Dusk', arcade: 'Arcade', gameCorner: 'Game Corner', dig: 'The Dig', safariField: 'Safari Zone', safariBattle: 'Safari Battle', contest: 'Bug-Catching Contest',
      boss: 'Wild Boss', birds: 'Legendary Wings', beasts: 'Run of the Beasts', regis: 'Giants Awake', mewtwo: 'Furious Clone', arceus: 'The Original One',
      lugia: 'Silver Dive', hoOh: 'Burning Rainbow', kyogre: 'Primal Ocean', groudon: 'Primal Land', rayquaza: 'Sky Dragon', latis: 'Eon Flight', deoxys: 'Signal from Space', dialga: 'Frozen Hands', palkia: 'Folded Space', ultraSpace: 'Ultra Space',
    },
    prev: 'Previous',
    next: 'Next',
    play: 'Play',
    stop: 'Stop',
    shuffle: 'Shuffle',
    repeat: { off: 'No repeat', all: 'Repeat queue', one: 'Repeat one' },
    playNow: 'Play now',
    add: 'Add to queue',
    queued: 'Queued',
    remove: 'Remove from queue',
    up: 'Move up',
    down: 'Move down',
    favorite: 'Favorite',
    unfavorite: 'Unfavorite',
    locked: 'Locked',
    lockBiome: (biome) => `Walk through ${biome} in a run.`,
    lockLegend: (names) => `Meet ${names}.`,
    lockHeard: 'Hear it once to unlock it.',
    queueEmpty: 'The queue is empty. Add tracks from Tracks.',
    favoritesEmpty: 'Tap a track’s ★ to keep it here.',
    playFavorites: 'Play favorites',
    playAll: 'Play all',
    idle: 'Playing the game’s music',
    nowPlaying: 'Playing',
    hintKeys: 'Q/E tabs · ↑↓ scroll · N next · Esc back',
    hintTouch: 'Tap a track to play it',
  },
  es: {
    title: 'Radio',
    host: '¡Bzzt! Yo llevo la radio. Elige qué suena y cambio de canción cada dos vueltas.',
    open: 'Radio',
    where: 'Dónde suena',
    places: { menus: 'Solo en los menús', everywhere: 'En todas partes' },
    fights: 'También en las peleas',
    tabs: { queue: 'Cola', library: 'Canciones', favorites: 'Favoritas' },
    groups: { menus: 'Menús', realm: 'Poké Realm', biomes: 'Biomas', bosses: 'Jefes', legends: 'Legendarios' },
    tracks: {
      menu: 'Pueblo Tranquilo', run: 'Primeros Pasos', forest: 'Entre las Hojas', beach: 'Marea de Verano', cave: 'Gotas en la Oscuridad', plant: 'Alto Voltaje', desert: 'Arenas sin Fin', snow: 'Cumbre Helada', volcano: 'Río de Lava', tower: 'Cajita de la Torre',
      realmTown: 'Ciudad del Realm', cafe: 'Café de la Esquina', fishing: 'Muelle al Atardecer', arcade: 'Arcade', gameCorner: 'Game Corner', dig: 'La Excavación', safariField: 'Zona Safari', safariBattle: 'Batalla Safari', contest: 'Concurso de Bichos',
      boss: 'Jefe Salvaje', birds: 'Alas Legendarias', beasts: 'Carrera de las Bestias', regis: 'Gigantes Despiertos', mewtwo: 'Clon Furioso', arceus: 'El Primero',
      lugia: 'Inmersión Plateada', hoOh: 'Arcoíris en Llamas', kyogre: 'Océano Primigenio', groudon: 'Tierra Primigenia', rayquaza: 'Dragón del Cielo', latis: 'Vuelo Eón', deoxys: 'Señal del Espacio', dialga: 'Manecillas Quietas', palkia: 'Espacio Plegado', ultraSpace: 'Ultraespacio',
    },
    prev: 'Anterior',
    next: 'Siguiente',
    play: 'Reproducir',
    stop: 'Detener',
    shuffle: 'Aleatorio',
    repeat: { off: 'Sin repetir', all: 'Repetir cola', one: 'Repetir una' },
    playNow: 'Reproducir ya',
    add: 'Añadir a la cola',
    queued: 'En la cola',
    remove: 'Quitar de la cola',
    up: 'Subir',
    down: 'Bajar',
    favorite: 'Marcar favorita',
    unfavorite: 'Quitar de favoritas',
    locked: 'Bloqueada',
    lockBiome: (biome) => `Recorre ${biome} en una partida.`,
    lockLegend: (names) => `Encuentra a ${names}.`,
    lockHeard: 'Escúchala una vez para desbloquearla.',
    queueEmpty: 'La cola está vacía. Añade canciones desde Canciones.',
    favoritesEmpty: 'Toca la ★ de una canción para guardarla aquí.',
    playFavorites: 'Reproducir favoritas',
    playAll: 'Reproducir todas',
    idle: 'Suena la música del juego',
    nowPlaying: 'Sonando',
    hintKeys: 'Q/E pestañas · ↑↓ desplazar · N siguiente · Esc volver',
    hintTouch: 'Toca una canción para reproducirla',
  },
  fr: {
    title: 'Radio',
    host: 'Bzzt ! C’est moi qui tiens la radio. Choisis ce qui passe et je change de morceau toutes les deux boucles.',
    open: 'Radio',
    where: 'Où elle joue',
    places: { menus: 'Menus seulement', everywhere: 'Partout' },
    fights: 'Aussi en combat',
    tabs: { queue: 'File', library: 'Morceaux', favorites: 'Favoris' },
    groups: { menus: 'Menus', realm: 'Poké Realm', biomes: 'Biomes', bosses: 'Boss', legends: 'Légendaires' },
    tracks: {
      menu: 'Village paisible', run: 'Premiers pas', forest: 'Sous les feuilles', beach: 'Marée d’été', cave: 'Gouttes dans le noir', plant: 'Haute tension', desert: 'Sables sans fin', snow: 'Sommet gelé', volcano: 'Rivière de lave', tower: 'Boîte à musique de la tour',
      realmTown: 'Ville du Realm', cafe: 'Le café du coin', fishing: 'Ponton au crépuscule', arcade: 'Salle d’arcade', gameCorner: 'Game Corner', dig: 'Les fouilles', safariField: 'Parc Safari', safariBattle: 'Combat Safari', contest: 'Concours de capture d’insectes',
      boss: 'Boss sauvage', birds: 'Ailes légendaires', beasts: 'La course des bêtes', regis: 'Les géants s’éveillent', mewtwo: 'Le clone furieux', arceus: 'Le Premier',
      lugia: 'Plongée argentée', hoOh: 'Arc-en-ciel en flammes', kyogre: 'Océan primitif', groudon: 'Terre primitive', rayquaza: 'Dragon du ciel', latis: 'Vol Éon', deoxys: 'Signal de l’espace', dialga: 'Aiguilles figées', palkia: 'Espace replié', ultraSpace: 'Ultra-Dimension',
    },
    prev: 'Précédent',
    next: 'Suivant',
    play: 'Lire',
    stop: 'Arrêter',
    shuffle: 'Aléatoire',
    repeat: { off: 'Sans répétition', all: 'Répéter la file', one: 'Répéter un morceau' },
    playNow: 'Lire maintenant',
    add: 'Ajouter à la file',
    queued: 'Dans la file',
    remove: 'Retirer de la file',
    up: 'Monter',
    down: 'Descendre',
    favorite: 'Ajouter aux favoris',
    unfavorite: 'Retirer des favoris',
    locked: 'Verrouillé',
    lockBiome: (biome) => `Traverse ${biome} pendant une partie.`,
    lockLegend: (names) => `Rencontre ${names}.`,
    lockHeard: 'Écoute-le une fois pour le débloquer.',
    queueEmpty: 'La file est vide. Ajoute des morceaux depuis Morceaux.',
    favoritesEmpty: 'Touche l’étoile ★ d’un morceau pour le garder ici.',
    playFavorites: 'Lire les favoris',
    playAll: 'Tout lire',
    idle: 'La musique du jeu joue',
    nowPlaying: 'En lecture',
    hintKeys: 'Q/E onglets · ↑↓ défiler · N suivant · Échap retour',
    hintTouch: 'Touche un morceau pour le lire',
  },
  zh: {
    title: '收音機',
    host: '嗶滋！收音機交給我。選好要播的歌，每首播兩輪我就換下一首。',
    open: '收音機',
    where: '播放範圍',
    places: { menus: '只在選單', everywhere: '所有地方' },
    fights: '戰鬥時也播放',
    tabs: { queue: '播放佇列', library: '曲目', favorites: '最愛' },
    groups: { menus: '選單', realm: 'Poké Realm', biomes: '地區', bosses: '頭目', legends: '傳說' },
    tracks: {
      menu: '寧靜小鎮', run: '踏出第一步', forest: '林葉之間', beach: '夏日潮汐', cave: '黑暗中的水滴', plant: '高壓電', desert: '無盡沙海', snow: '冰封山巔', volcano: '熔岩之河', tower: '高塔音樂盒',
      realmTown: 'Realm 城鎮', cafe: '街角咖啡館', fishing: '黃昏碼頭', arcade: '電玩間', gameCorner: '遊戲城', dig: '挖掘場', safariField: '狩獵地帶', safariBattle: '狩獵地帶對戰', contest: '捕蟲大會',
      boss: '野生頭目', birds: '傳說之翼', beasts: '神獸疾馳', regis: '巨人甦醒', mewtwo: '憤怒的複製體', arceus: '起源之神',
      lugia: '銀色潛流', hoOh: '燃燒的彩虹', kyogre: '原始之海', groudon: '原始大地', rayquaza: '天空之龍', latis: '夢幻飛行', deoxys: '來自太空的訊號', dialga: '靜止的指針', palkia: '摺疊的空間', ultraSpace: '究極空間',
    },
    prev: '上一首',
    next: '下一首',
    play: '播放',
    stop: '停止',
    shuffle: '隨機播放',
    repeat: { off: '不重複', all: '重複佇列', one: '單曲重複' },
    playNow: '立即播放',
    add: '加入佇列',
    queued: '已在佇列',
    remove: '移出佇列',
    up: '上移',
    down: '下移',
    favorite: '加入最愛',
    unfavorite: '移出最愛',
    locked: '未解鎖',
    lockBiome: (biome) => `在遊戲中走過${biome}。`,
    lockLegend: (names) => `遇見 ${names}。`,
    lockHeard: '聽過一次即可解鎖。',
    queueEmpty: '佇列是空的。到「曲目」加入歌曲吧。',
    favoritesEmpty: '點歌曲的 ★ 就能收藏在這裡。',
    playFavorites: '播放最愛',
    playAll: '全部播放',
    idle: '正在播放遊戲音樂',
    nowPlaying: '播放中',
    hintKeys: 'Q/E 分頁 · ↑↓ 捲動 · N 下一首 · Esc 返回',
    hintTouch: '點歌曲即可播放',
  },
}
