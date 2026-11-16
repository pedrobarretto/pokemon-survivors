import type { ContentTexts } from './pt'

/**
 * Terastal's and the Tera Raids' words (`game/tera.ts`, `game/teraRaid.ts`), a
 * table per language (`pt` is the reference). Each language's file spreads its
 * pieces: `tera` and `raid` as sections, `action` into the controls, the
 * achievements' names, titles and goals, Terapagos's blurb and Tera
 * Starstorm's card. Type names come from `types`; Stellar is `tera.stellar`.
 */
type Words = {
  action: string
  tera: {
    section: string
    button: string
    stellar: string
    title: (type: string) => string
    ready: (type: string) => string
    kicker: string
    banner: (type: string) => string
    start: (name: string) => string
    ended: (name: string) => string
    readyNews: string
    shardsChoice: string
    shard: (type: string) => string
    shardFrom: (from: string, to: string) => string
    stellarPulse: string
  }
  raid: {
    open: (stars: number, boss: string, type: string) => string
    openDay: (stars: number, boss: string, type: string) => string
    closed: string
    title: (boss: string, type: string) => string
    shieldUp: string
    shieldBroken: string
    cleared: (boss: string) => string
    clearedDay: string
    fall: string
    timeout: string
    hudDen: (time: string) => string
    hudRaid: (stars: number, time: string) => string
    shield: string
    dayTitle: string
    dayLine: (boss: string, type: string) => string
    dayWhen: string
    dayStellar: string
  }
  achievementNames: { tera1: string; tera50: string; raid1: string; raid25: string; raidStar6: string; raidStellar: string }
  titles: { raidStar6: string; raidStellar: string }
  goals: { teras: (n: string) => string; raids: (n: string) => string; raidBest: (n: string) => string }
  blurb: string
  move: ContentTexts['moves']['teraStarstorm']
}

export const TERA_WORDS: Record<'pt' | 'en' | 'es' | 'fr' | 'zh', Words> = {
  pt: {
    action: 'Terastal',
    tera: {
      section: 'Terastal',
      button: 'TERA',
      stellar: 'Astral',
      title: (type) => `Terastal ${type} (R): o Orbe Tera enche com nocautes e com o tempo`,
      ready: (type) => `Orbe Tera cheio: Terastalize em ${type} (R)!`,
      kicker: 'TERASTAL',
      banner: (type) => `Tera ${type}`,
      start: (name) => `${name} está se cristalizando!`,
      ended: (name) => `O cristal de ${name} se desfez.`,
      readyNews: 'O *Orbe Tera* está cheio! Botão *TERA* ou tecla *R*.',
      shardsChoice: 'O chefe deixou dois *Fragmentos Tera*: toque em um para escolher seu tipo Tera.',
      shard: (type) => `Tipo Tera: *${type}*! Encha o Orbe Tera e aperte *TERA*.`,
      shardFrom: (from, to) => `Tipo Tera: _${from}_ → *${to}*`,
      stellarPulse: 'A Forma Astral brilha de novo!',
    },
    raid: {
      open: (stars, boss, type) => `Um *Covil Tera* ${stars}★ se abriu: *${boss}* Tera ${type}!`,
      openDay: (stars, boss, type) => `A *Raide do dia* chegou: *${boss}* Tera ${type}, ${stars}★!`,
      closed: 'O Covil Tera se fechou.',
      title: (boss, type) => `${boss} Tera ${type}`,
      shieldUp: 'O *escudo Tera* se ergueu! Acerte a fraqueza ou Terastalize para quebrá-lo.',
      shieldBroken: 'Escudo Tera quebrado! O chefe cambaleia.',
      cleared: (boss) => `Raide vencida: *${boss}*! Pegue o Fragmento Tera.`,
      clearedDay: 'Raide do dia vencida!',
      fall: 'Você desmaiou na raide...',
      timeout: 'O tempo acabou: o covil expulsou vocês.',
      hudDen: (time) => `Covil ${time}`,
      hudRaid: (stars, time) => `Raide ${stars}★ · ${time}`,
      shield: 'ESCUDO TERA',
      dayTitle: 'Raide do dia',
      dayLine: (boss, type) => `${boss} Tera ${type}`,
      dayWhen: 'Aparece num covil perto dos 13:00 de qualquer partida, solo ou co-op.',
      dayStellar: 'Fim de semana: Terapagos Astral 7★. Vença para capturá-lo.',
    },
    achievementNames: { tera1: 'Cristalizado', tera50: 'Joia Viva', raid1: 'Primeira Raide', raid25: 'Caçador de Covis', raidStar6: 'Raider 6★', raidStellar: 'Coroa Astral' },
    titles: { raidStar6: 'Raider 6★', raidStellar: 'Coroa Astral' },
    goals: {
      teras: (n) => (n === '1' ? 'Terastalize uma vez' : `Terastalize ${n} vezes`),
      raids: (n) => (n === '1' ? 'Vença uma Raide Tera' : `Vença ${n} Raides Tera`),
      raidBest: (n) => (n === '7' ? 'Vença uma Raide Tera Astral 7★' : `Vença uma Raide Tera ${n}★`),
    },
    blurb: 'Lenda Tera. Astral desde o início; vira Forma Terastal e depois Astral.',
    move: {
      description: 'Um prisma dos sete cristais se forma sobre Terapagos e solta uma estrela de luz em cada uma das multidões mais densas.',
      upgrades: ['+1 estrela', '+12 de dano', { fork: [{ name: 'Chuva estelar', desc: '+3 estrelas; −6 de dano' }, { name: 'Prisma', desc: 'Quem cai explode; +30% de área' }] }, 'Recarga 0.4s mais rápida e +12 de dano'],
    },
  },
  en: {
    action: 'Terastal',
    tera: {
      section: 'Terastal',
      button: 'TERA',
      stellar: 'Stellar',
      title: (type) => `Terastal ${type} (R): the Tera Orb fills with KOs and with time`,
      ready: (type) => `Tera Orb full: Terastallize into ${type} (R)!`,
      kicker: 'TERASTAL',
      banner: (type) => `Tera ${type}`,
      start: (name) => `${name} is crystallizing!`,
      ended: (name) => `${name}'s crystal fell away.`,
      readyNews: 'The *Tera Orb* is full! *TERA* button or the *R* key.',
      shardsChoice: 'The boss left two *Tera Shards*: touch one to pick your Tera type.',
      shard: (type) => `Tera type: *${type}*! Fill the Tera Orb and press *TERA*.`,
      shardFrom: (from, to) => `Tera type: _${from}_ → *${to}*`,
      stellarPulse: 'The Stellar Form shines anew!',
    },
    raid: {
      open: (stars, boss, type) => `A ${stars}★ *Tera Den* opened: *${boss}*, Tera ${type}!`,
      openDay: (stars, boss, type) => `The *Raid of the Day* is here: *${boss}*, Tera ${type}, ${stars}★!`,
      closed: 'The Tera Den closed.',
      title: (boss, type) => `Tera ${type} ${boss}`,
      shieldUp: 'Its *Tera Shield* went up! Hit its weakness or Terastallize to break it.',
      shieldBroken: 'Tera Shield broken! The boss reels.',
      cleared: (boss) => `Raid won: *${boss}*! Grab the Tera Shard.`,
      clearedDay: 'Raid of the Day won!',
      fall: 'You fainted in the raid...',
      timeout: 'Time ran out: the den threw you out.',
      hudDen: (time) => `Den ${time}`,
      hudRaid: (stars, time) => `Raid ${stars}★ · ${time}`,
      shield: 'TERA SHIELD',
      dayTitle: 'Raid of the Day',
      dayLine: (boss, type) => `Tera ${type} ${boss}`,
      dayWhen: 'It shows up in a den around 13:00 in any run, solo or co-op.',
      dayStellar: 'Weekends: 7★ Stellar Terapagos. Beat it to catch it.',
    },
    achievementNames: { tera1: 'Crystallized', tera50: 'Living Jewel', raid1: 'First Raid', raid25: 'Den Hunter', raidStar6: '6★ Raider', raidStellar: 'Stellar Crown' },
    titles: { raidStar6: '6★ Raider', raidStellar: 'Stellar Crown' },
    goals: {
      teras: (n) => (n === '1' ? 'Terastallize once' : `Terastallize ${n} times`),
      raids: (n) => (n === '1' ? 'Win a Tera Raid' : `Win ${n} Tera Raids`),
      raidBest: (n) => (n === '7' ? 'Win a 7★ Stellar Tera Raid' : `Win a ${n}★ Tera Raid`),
    },
    blurb: 'Tera legend. Stellar from the start; turns Terastal, then Stellar.',
    move: {
      description: 'A prism of the seven crystals forms over Terapagos and drops a star of light on each of the thickest crowds.',
      upgrades: ['+1 star', '+12 damage', { fork: [{ name: 'Star shower', desc: '+3 stars; −6 damage' }, { name: 'Prism', desc: 'Foes it fells explode; +30% area' }] }, '0.4s faster cooldown and +12 damage'],
    },
  },
  es: {
    action: 'Teracristal',
    tera: {
      section: 'Teracristal',
      button: 'TERA',
      stellar: 'Astral',
      title: (type) => `Teracristal ${type} (R): el Orbe Tera se llena con derrotas y con el tiempo`,
      ready: (type) => `Orbe Tera lleno: ¡teracristaliza en ${type} (R)!`,
      kicker: 'TERACRISTAL',
      banner: (type) => `Tera ${type}`,
      start: (name) => `¡${name} se está cristalizando!`,
      ended: (name) => `El cristal de ${name} se deshizo.`,
      readyNews: '¡El *Orbe Tera* está lleno! Botón *TERA* o tecla *R*.',
      shardsChoice: 'El jefe dejó dos *Teralitos*: toca uno para elegir tu teratipo.',
      shard: (type) => `Teratipo: *${type}*. Llena el Orbe Tera y pulsa *TERA*.`,
      shardFrom: (from, to) => `Teratipo: _${from}_ → *${to}*`,
      stellarPulse: '¡La Forma Astral brilla de nuevo!',
    },
    raid: {
      open: (stars, boss, type) => `Se abrió una *Guarida Tera* de ${stars}★: *${boss}* Tera ${type}.`,
      openDay: (stars, boss, type) => `Llegó la *Incursión del día*: *${boss}* Tera ${type}, ${stars}★.`,
      closed: 'La Guarida Tera se cerró.',
      title: (boss, type) => `${boss} Tera ${type}`,
      shieldUp: '¡Se alzó su *escudo Tera*! Golpea su debilidad o teracristaliza para romperlo.',
      shieldBroken: '¡Escudo Tera roto! El jefe se tambalea.',
      cleared: (boss) => `¡Incursión ganada: *${boss}*! Toma el Teralito.`,
      clearedDay: '¡Incursión del día ganada!',
      fall: 'Te debilitaste en la incursión...',
      timeout: 'Se acabó el tiempo: la guarida los echó.',
      hudDen: (time) => `Guarida ${time}`,
      hudRaid: (stars, time) => `Incursión ${stars}★ · ${time}`,
      shield: 'ESCUDO TERA',
      dayTitle: 'Incursión del día',
      dayLine: (boss, type) => `${boss} Tera ${type}`,
      dayWhen: 'Aparece en una guarida cerca del 13:00 de cualquier partida, solo o cooperativa.',
      dayStellar: 'Fines de semana: Terapagos Astral 7★. Vénzelo para capturarlo.',
    },
    achievementNames: { tera1: 'Cristalizado', tera50: 'Joya viva', raid1: 'Primera incursión', raid25: 'Cazador de guaridas', raidStar6: 'Incursor 6★', raidStellar: 'Corona Astral' },
    titles: { raidStar6: 'Incursor 6★', raidStellar: 'Corona Astral' },
    goals: {
      teras: (n) => (n === '1' ? 'Teracristaliza una vez' : `Teracristaliza ${n} veces`),
      raids: (n) => (n === '1' ? 'Gana una Teraincursión' : `Gana ${n} Teraincursiones`),
      raidBest: (n) => (n === '7' ? 'Gana una Teraincursión Astral de 7★' : `Gana una Teraincursión de ${n}★`),
    },
    blurb: 'Leyenda Tera. Astral desde el inicio; pasa a Forma Teracristal y luego Astral.',
    move: {
      description: 'Un prisma de los siete cristales se forma sobre Terapagos y deja caer una estrella de luz sobre cada una de las multitudes más densas.',
      upgrades: ['+1 estrella', '+12 de daño', { fork: [{ name: 'Lluvia estelar', desc: '+3 estrellas; −6 de daño' }, { name: 'Prisma', desc: 'Los que caen explotan; +30% de área' }] }, 'Recarga 0.4s más rápida y +12 de daño'],
    },
  },
  fr: {
    action: 'Téracristal',
    tera: {
      section: 'Téracristal',
      button: 'TERA',
      stellar: 'Stellaire',
      title: (type) => `Téracristal ${type} (R) : l'Orbe Téracristal se remplit avec les K.O. et le temps`,
      ready: (type) => `Orbe Téracristal plein : téracristallisez-vous en ${type} (R) !`,
      kicker: 'TERACRISTAL',
      banner: (type) => `Téra ${type}`,
      start: (name) => `${name} se cristallise !`,
      ended: (name) => `Le cristal de ${name} est tombé.`,
      readyNews: "L'*Orbe Téracristal* est plein ! Bouton *TERA* ou touche *R*.",
      shardsChoice: 'Le boss a laissé deux *Téra-Éclats* : touchez-en un pour choisir votre type Téra.',
      shard: (type) => `Type Téra : *${type}* ! Remplissez l'Orbe et appuyez sur *TERA*.`,
      shardFrom: (from, to) => `Type Téra : _${from}_ → *${to}*`,
      stellarPulse: 'La Forme Stellaire brille à nouveau !',
    },
    raid: {
      open: (stars, boss, type) => `Une *Tanière Téra* ${stars}★ s'est ouverte : *${boss}* Téra ${type} !`,
      openDay: (stars, boss, type) => `Le *Raid du jour* est là : *${boss}* Téra ${type}, ${stars}★ !`,
      closed: 'La Tanière Téra s’est refermée.',
      title: (boss, type) => `${boss} Téra ${type}`,
      shieldUp: 'Son *bouclier Téra* s’est levé ! Frappez sa faiblesse ou téracristallisez-vous pour le briser.',
      shieldBroken: 'Bouclier Téra brisé ! Le boss vacille.',
      cleared: (boss) => `Raid gagné : *${boss}* ! Prenez le Téra-Éclat.`,
      clearedDay: 'Raid du jour gagné !',
      fall: 'Vous êtes K.O. dans le raid...',
      timeout: 'Temps écoulé : la tanière vous a rejetés.',
      hudDen: (time) => `Tanière ${time}`,
      hudRaid: (stars, time) => `Raid ${stars}★ · ${time}`,
      shield: 'BOUCLIER TERA',
      dayTitle: 'Raid du jour',
      dayLine: (boss, type) => `${boss} Téra ${type}`,
      dayWhen: 'Il apparaît dans une tanière vers 13:00 de n’importe quelle partie, solo ou coop.',
      dayStellar: 'Le week-end : Terapagos Stellaire 7★. Battez-le pour le capturer.',
    },
    achievementNames: { tera1: 'Cristallisé', tera50: 'Joyau vivant', raid1: 'Premier raid', raid25: 'Chasseur de tanières', raidStar6: 'Raideur 6★', raidStellar: 'Couronne Stellaire' },
    titles: { raidStar6: 'Raideur 6★', raidStellar: 'Couronne Stellaire' },
    goals: {
      teras: (n) => (n === '1' ? 'Téracristallisez-vous une fois' : `Téracristallisez-vous ${n} fois`),
      raids: (n) => (n === '1' ? 'Gagnez un Raid Téracristal' : `Gagnez ${n} Raids Téracristal`),
      raidBest: (n) => (n === '7' ? 'Gagnez un Raid Téracristal Stellaire 7★' : `Gagnez un Raid Téracristal ${n}★`),
    },
    blurb: 'Légende Téra. Stellaire dès le départ ; passe en Forme Téracristal puis Stellaire.',
    move: {
      description: 'Un prisme des sept cristaux se forme au-dessus de Terapagos et fait tomber une étoile de lumière sur chacune des foules les plus denses.',
      upgrades: ['+1 étoile', '+12 de dégâts', { fork: [{ name: 'Pluie d’étoiles', desc: '+3 étoiles ; −6 de dégâts' }, { name: 'Prisme', desc: 'Ceux qu’il abat explosent ; +30 % de zone' }] }, 'Recharge 0,4 s plus rapide et +12 de dégâts'],
    },
  },
  zh: {
    action: '太晶化',
    tera: {
      section: '太晶化',
      button: 'TERA',
      stellar: '星晶',
      title: (type) => `${type}太晶化（R）：太晶珠會隨擊倒與時間充能`,
      ready: (type) => `太晶珠已滿：太晶化為${type}屬性（R）！`,
      kicker: '太晶化',
      banner: (type) => `${type}太晶`,
      start: (name) => `${name}正在結晶化！`,
      ended: (name) => `${name}的結晶碎落了。`,
      readyNews: '*太晶珠*已充滿！按 *TERA* 按鈕或 *R* 鍵。',
      shardsChoice: '頭目留下了兩塊*太晶碎塊*：碰觸其中一塊來選擇你的太晶屬性。',
      shard: (type) => `太晶屬性：*${type}*！充滿太晶珠後按 *TERA*。`,
      shardFrom: (from, to) => `太晶屬性：_${from}_ → *${to}*`,
      stellarPulse: '星晶形態再次閃耀！',
    },
    raid: {
      open: (stars, boss, type) => `${stars}★ *太晶洞窟*開啟了：${type}太晶的 *${boss}*！`,
      openDay: (stars, boss, type) => `*今日團體戰*來了：${type}太晶的 *${boss}*，${stars}★！`,
      closed: '太晶洞窟關閉了。',
      title: (boss, type) => `${type}太晶 ${boss}`,
      shieldUp: '它的*太晶護盾*升起了！攻擊它的弱點，或太晶化來擊破它。',
      shieldBroken: '太晶護盾碎了！頭目搖搖晃晃。',
      cleared: (boss) => `團體戰勝利：*${boss}*！撿起太晶碎塊。`,
      clearedDay: '今日團體戰勝利！',
      fall: '你在團體戰中倒下了……',
      timeout: '時間到：洞窟把你們趕了出去。',
      hudDen: (time) => `洞窟 ${time}`,
      hudRaid: (stars, time) => `團體戰 ${stars}★ · ${time}`,
      shield: '太晶護盾',
      dayTitle: '今日團體戰',
      dayLine: (boss, type) => `${type}太晶 ${boss}`,
      dayWhen: '任何一局（單人或合作）約 13:00 時會在洞窟中出現。',
      dayStellar: '週末：星晶 7★ 太樂巴戈斯。擊敗它即可捕捉。',
    },
    achievementNames: { tera1: '結晶化', tera50: '活寶石', raid1: '首次團體戰', raid25: '洞窟獵人', raidStar6: '6★ 團戰家', raidStellar: '星晶王冠' },
    titles: { raidStar6: '6★ 團戰家', raidStellar: '星晶王冠' },
    goals: {
      teras: (n) => (n === '1' ? '太晶化一次' : `太晶化 ${n} 次`),
      raids: (n) => (n === '1' ? '贏得一場太晶團體戰' : `贏得 ${n} 場太晶團體戰`),
      raidBest: (n) => (n === '7' ? '贏得一場 7★ 星晶太晶團體戰' : `贏得一場 ${n}★ 太晶團體戰`),
    },
    blurb: '太晶傳說。一開始就是星晶；之後變為太晶形態，再成為星晶形態。',
    move: {
      description: '七色結晶的稜鏡在太樂巴戈斯上方成形，對最密集的每一群敵人落下一顆光之星。',
      upgrades: ['+1 顆星', '+12 傷害', { fork: [{ name: '星雨', desc: '+3 顆星；−6 傷害' }, { name: '稜鏡', desc: '被擊倒者會爆炸；+30% 範圍' }] }, '冷卻縮短 0.4 秒，+12 傷害'],
    },
  },
}
