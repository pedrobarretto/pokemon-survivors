import type { Messages } from './pt'

const typeBoost = (type: string) => `${type} türü saldırılara +%10 hasar.`

/** Türkçe. pt.ts ile anahtar anahtara birebir eşleşir (Messages tipi ile denetlenir). */
export const tr: Messages = {
  loading: 'Yükleniyor…',
  level: (n: number) => `Sv ${n}`,
  levelShort: (n: number) => `Sv${n}`,
  max: 'Maximum',
  new: 'YENİ!',
  language: 'Dil',
  spaceKey: 'BOŞLUK',
  stats: {
    hp: 'Can',
    attack: 'Saldırı',
    damage: 'Hasar',
    area: 'Alan',
    cooldown: 'Bekleme Süresi',
    duration: 'Süre',
    amount: 'Atış Sayısı',
    speed: 'Hız',
    defense: 'Savunma',
    regen: 'Yenilenme',
  },

  home: {
    pressKeys: 'Herhangi bir tuşa bas',
    pressTouch: 'Başlamak için dokun',
    play: 'OYNA',
    today: 'BUGÜN',
    outbreak: 'GÜNÜN SALGINI',
    challenge: 'GÜNLÜK MEYDAN OKUMA',
    challengeDone: (time: string) => `Tamamlandı: ${time}`,
    challengeOpen: 'Bugün henüz oynanmadı',
    missions: 'Görevler',
    missionsLeft: (n: number) => (n === 1 ? "Bugünün 1 görevi kaldı" : `Bugünün ${n} görevi kaldı`),
    hall: 'ŞÖHRETLER SALONU',
    hallJoined: (handle: string, today: boolean) => (today ? `@${handle} bugün katıldı` : `@${handle} Salona katıldı`),
    change: 'Değiştir',
    stroll: 'yürüyüşe çık',
    strollTouch: 'Yürüyüşe çıkmak için çimenlere dokun',
    pokedex: 'Pokédex',
    eggs: 'Yumurtalar',
    eggsReady: (n: number) => (n === 1 ? '1 yumurta çatlamaya hazır' : `${n} yumurta çatlamaya hazır`),
    mart: 'Mağaza',
    ranking: 'Sıralama',
    ideas: 'Fikirler',
    support: 'Projeyi destekle',
  },

  shell: {
    back: 'Geri',
    settings: 'Ayarlar',
    help: 'Nasıl oynanır',
    wallet: (amount: string) => `Cüzdan: ${amount}`,
  },

  trainer: {
    title: 'EĞİTMEN',
    open: 'Eğitmen Kartı',
    guest: 'Misafir',
    signIn: 'Giriş yap',
    stats: {
      runs: 'Koşular',
      wins: 'Zaferler',
      dex: 'Pokédex',
      shinies: 'Shiny',
    },
    noMedals: 'Madalyalar ve kurdeleler burada görünür.',
    sync: {
      synced: 'Buluta kaydedildi',
      syncing: 'Eşitleniyor…',
      offline: 'Çevrim dışı: Bu cihaza kaydedildi',
      guest: 'Yalnızca bu cihaza kaydedildi',
    },
    syncNow: 'Eşitle',
    editProfile: 'Profili düzenle',
    createProfile: 'Profil oluştur',
    viewProfile: 'Herkese açık profili gör',
    share: 'Kartı paylaş',
    supporterSince: (gold: boolean, date: string) => `${gold ? 'Altın Destekçi' : 'Destekçi'} (${date}'den beri)`,
    missions: 'Görevler ve başarımlar',
    join: 'Hesap oluştur / Giriş yap',
    signOut: 'Çıkış yap',
    hintKeys: '↑ ↓ seç · ENTER aç · ESC geri',
  },

  title: {
    statsSection: 'Değerler',
    legendBase: 'temel',
    legendFinal: 'evrimleşmiş',
    evolution: 'Evrim',
    special: 'Özel Güç',
    moves: 'Saldırılar',
    signature: 'BAŞLANGIÇ',
    normal: 'Normal',
    shiny: 'Shiny',
    shinyPick: 'Renkler',
    credits: 'Resmi olmayan hayran oyunu · Spritelar: PMD SpriteCollab · Sesler: PokéAPI · Pokémon © Nintendo/Creatures/GAME FREAK',
  },

  partner: {
    title: 'PARTNERİNİ SEÇ',
    titleShort: 'PARTNER',
    starters: 'BAŞLANGIÇLAR',
    hatched: 'YUMURTADAN ÇIKANLAR',
    noneHatched: 'Yumurtadan çıkanlar partnerin olur.',
    details: (mega: boolean): string => (mega ? 'Saldırılar, özel güç ve Mega' : 'Saldırılar ve özel güç'),
    detailsShort: 'Detaylar',
    tabs: {
      status: 'DEĞERLER',
      moves: 'SALDIRILAR',
      mega: 'MEGA',
    },
    start: 'Başlat',
    startWith: (name: string) => `${name} ile başla`,
    close: 'Kapat',
    learnStart: 'Başlangıçtan itibaren',
    learnNote: 'Her evrim yeni saldırıların kilidini açar. Yalnızca 6 yuva vardır: Her koşuda bazıları dışarıda kalır.',
  },

  hud: {
    pause: 'Duraklat',
    specialAttack: 'Özel saldırı',
    specialTitle: (name: string) => `${name} (Boşluk)`,
    lunge: 'Atılma',
    lungeTitle: (name: string) => `${name} (Shift)`,
    stances: {
      shield: 'Kalkan',
      blade: 'Kılıç',
      normal: 'Normal',
      attack: 'Saldırı',
      defense: 'Savunma',
      speed: 'Hız',
    },
    jumps: (n: number) => `×${n}`,
  },

  coop: {
    ping: (ms: number) => `${ms} ms`,
    reconnecting: 'Yeniden bağlanıyor…',
    reconnectingHint: 'Koşu devam ediyor: Kaldığın yerden döneceksin.',
    syncing: 'Eşitleniyor…',
    joining: 'Odaya giriliyor…',
    healed: 'Koşu takımla yeniden eşitlendi',
    slow: 'Yavaş bağlantı: Bazı komutlar gecikti',
    room: (code: string) => `Oda ${code}`,
    closed: {
      replaced: 'Koşu başka bir sekmede veya cihazda açıldı.',
      build: 'Birlikte oynamak için oyunu güncelle: Oda başka bir sürümde.',
      unavailable: 'Bu oda kullanılamıyor (dolu, başladı veya mevcut değil).',
      kicked: 'Oda kurucusu seni odadan çıkardı.',
      expired: 'Odanın süresi doldu.',
      left: 'Odadan ayrıldın.',
      version: 'Birlikte oynamak için oyunu güncelle.',
      auth: "Hesabın doğrulanamadı. Cihazının saatinin doğru olduğunu kontrol et, tekrar giriş yapıp dene.",
      signIn: 'Birlikte oynamak için giriş yap.',
      invalid: 'Odaya katılamadı.',
      refused: 'Odaya katılamadı.',
      abuse: 'Çok fazla veri gönderildiği için bağlantı kesildi.',
      offline: 'Co-op sunucusuna ulaşılamıyor.',
    },
    entry: 'Co-op',
    beta: 'BETA',
    off: 'Co-op oyunun bu sürümünde mevcut değil.',
    update: {
      title: 'Birlikte oynamak için oyunu güncelle: Oda farklı bir sürümde çalışıyor.',
      yes: 'Güncelle',
      no: 'Şimdi değil',
    },
    oldRoom: 'Bu oda oyunun eski bir sürümünde. Kurucudan yeni bir oda açmasını iste.',
    createFailed: {
      version: 'Oda kurmak için oyunu güncelle.',
      invalid: 'Oda kurulamadı.',
      rate: 'Şu anda çok fazla oda kuruldu. Biraz bekle ve tekrar dene.',
      busy: 'Co-op sunucusu dolu. Birazdan tekrar dene.',
      offline: 'Co-op sunucusuna ulaşılamıyor.',
    },
    denied: {
      notHost: 'Yalnızca oda kurucusu başlatabilir.',
      notReady: 'Herkesin hazır olmasını bekle.',
    },
    gate: {
      title: 'BİRLİKTE OYNA',
      pitch: 'Birlikte oynamak için giriş yap.',
      note: 'Co-op hesabını kullanır: Takım @kullanıcı adını görür ve ₽ hesabına kaydedilir. Giriş yapmak hesabını da oluşturur.',
      invited: (who: string) => `${who} seni birlikte oynamaya davet etti!`,
      room: (code: string) => `Oda ${code}`,
    },
    hub: {
      title: 'BİRLİKTE OYNA',
      intro: 'Aynı koşuda en fazla 4 eğitmen. Takımın ₽ kazancı herkes arasında paylaştırılır.',
      create: 'Oda kur',
      creating: 'Oda kuruluyor…',
      or: 'veya bir kodla katıl',
      code: 'Oda kodu',
      join: 'Katıl',
      joining: 'Odaya giriliyor…',
      badCode: 'Kod K7QF2 gibi 5 harf veya rakamdan oluşur.',
      friends: 'Arkadaşlar',
      back: 'Geri',
      hintKeys: '↑ ↓ seç · ENTER onayla · ESC geri',
      hintTouch: 'Seçmek için dokun',
    },
    lobby: {
      code: 'Kod',
      share: 'Bağlantıyı paylaş',
      copy: 'Bağlantıyı kopyala',
      copied: 'Oda bağlantısı kopyalandı!',
      shareText: 'Birlikte Pokémon Survivors oynayalım mı? Odama katıl:',
      you: 'Sen',
      host: 'Kurucu',
      state: {
        host: 'Kurucu',
        ready: 'Hazır',
        picking: 'Seçiyor',
        offline: 'Bağlantı koptu',
        away: 'Dışarıda',
      },
      empty: 'Boş yer',
      invite: 'Davet et',
      kick: 'Çıkar',
      kickConfirm: (name: string) => `${name} odadan çıkarılsın mı? Tekrar katılamaz.`,
      difficulty: 'Zorluk',
      hostPicks: 'kurucu seçer',
      partner: 'Pokémon değiştir',
      ready: 'Hazırım',
      unready: 'Hazır değilim',
      start: 'Başlat',
      friends: 'Arkadaş davet et',
      leave: 'Odadan ayrıl',
      leaveConfirm: 'Odadan ayrılsın mı?',
      waitAll: (ready: number, total: number) => `Herkesin hazır olması bekleniyor (${ready}/${total})`,
      allReady: 'Herkes hazır!',
      alone: 'Birini çağırmak için bağlantıyı paylaş (veya tek başına oyna).',
      waitHost: 'Kurucunun başlatması bekleniyor…',
      getReady: "Pokémon'unu seç ve hazırlan.",
      reconnecting: 'Yeniden bağlanıyor…',
      playing: 'Takım koşuda.',
      rejoin: 'Koşuya dön',
      rules: "Co-op standart moddur: Sıralama, Efsanevi Modu, Günün Salgını, Cadılar Bayramı Gecesi, Çanta veya mağaza TM'leri bulunmaz.",
      hintKeys: '← → seç · ENTER onayla · ESC ayrıl',
      hintTouch: 'Seçmek için dokun',
      pick: 'Seç',
    },
  },

  friends: {
    title: 'ARKADAŞLAR',
    tabs: {
      friends: 'Arkadaşlar',
      requests: 'İstekler',
      add: 'Ekle',
    },
    guest: 'Arkadaş eklemek, kimin çevrim içi olduğunu görmek ve birlikte oynamaya davet etmek için giriş yap.',
    signIn: 'Giriş yap',
    noHandle: 'Arkadaş eklemek için profilini (@kullanıcı adı) oluştur.',
    createProfile: 'Profil oluştur',
    unavailable: 'Arkadaşlar şu an kullanılamıyor. Daha sonra tekrar dene.',
    loading: 'Yükleniyor…',
    empty: 'Henüz arkadaşın yok. Ekle sekmesinden bir @kullanıcı adı ara.',
    presence: {
      offline: 'Çevrim dışı',
      lobby: 'Çevrim içi',
      room: 'Bir odada',
      run: 'Koşuda',
    },
    invite: 'Davet et',
    invited: (name: string) => `${name} adlı kişiye davet gönderildi`,
    inviteFailed: {
      notFriend: 'Artık arkadaş değilsiniz.',
      limit: 'Çok fazla davet gönderildi. Biraz bekle.',
      offline: 'Davet gönderilemedi.',
    },
    accept: 'Kabul et',
    decline: 'Reddet',
    cancel: 'İptal',
    remove: 'Arkadaşlıktan çıkar',
    removeConfirm: (name: string) => `${name} arkadaşlıktan çıkarılsın mı?`,
    noRequests: 'Arkadaşlık isteği yok.',
    sent: 'Gönderilen istekler',
    search: 'Bir @kullanıcı adı ara',
    searchHint: '@kullanıcı adının en az 2 harfini yaz.',
    noMatches: 'Bu @kullanıcı adına sahip kimse bulunamadı.',
    limit: 'Çok fazla arama yapıldı. Biraz bekle.',
    add: 'Ekle',
    relation: {
      following: 'İstek gönderildi',
      follower: 'Arkadaş olmak istiyor',
      friend: 'Arkadaşlar',
    },
    added: (name: string) => `${name} adlı kişiye arkadaşlık isteği gönderildi`,
    nowFriends: (name: string) => `Artık ${name} ile arkadaşsınız!`,
    failed: 'Bir şeyler ters gitti. Tekrar dene.',
    appearOffline: (on: boolean) => `Çevrim dışı görün: ${on ? 'açık' : 'kapalı'}`,
    back: 'Geri',
    hintKeys: '↑ ↓ seç · ← → sekmeler · ENTER onayla · ESC geri',
    hintTouch: 'Seçmek için dokun',
    inviteBanner: (name: string) => `*${name}* seni birlikte oynamaya davet etti!`,
    inviteJoin: 'Katıl',
    inviteLater: 'Şimdi değil',
  },

  levelUp: {
    title: (name: string, level: number) => `${name} Sv ${level}'e ulaştı!`,
    ready: 'HAZIR!',
    evolution: 'EVRİM!',
    evolves: (from: string, description: string) => `${from} evrimleşiyor! ${description}`,
    berry: (name: string) => `${name} 40 Can yeniler.`,
    autoBerry: (level: number, count: number) => `Sv ${level}! Her şey maksimumda: *Oran Berry*${count > 1 ? ` ×${count}` : ''}`,
    reroll: (n: number) => `Yenile (${n})`,
    skip: (n: number) => `Pas Geç (${n})`,
    hintKeys: '↑ ↓ seç · ENTER onayla · 1-3 kısayol',
    sideHintKeys: '← → seç · ENTER onayla · 1-3 kısayol',
    pairHintKeys: '← → seç · ENTER onayla · 1-2 kısayol',
    hintTouch: 'Seçmek için dokun · saldırıyı görmek için basılı tut',
    draftTitle: (name: string) => `${name}: 2. saldırını seç!`,
    forkTitle: (move: string, level: number) => `${move} Sv ${level} · bir yol seç`,
    forkTag: '2 YOL',
    forkHint: (a: string, b: string) => `Yol: ${a} veya ${b}`,
    branchOf: (move: string) => `${move} yolu`,
    freshTag: (form: string) => `✦ ${form}`,
    rare: 'NADİR! +2 Sv',
    shiny: 'SHINY!',
    shinyNote: 'Ücretsiz seçim: hemen ardından bir tane daha!',
    banish: (n: number) => `Unut (${n})`,
    banishCancel: 'İptal',
    banishHintKeys: 'Unutulacak kartı seç · ESC iptal eder',
    banishHintTouch: 'Unutmak istediğin karta dokun',
    prize: {
      alpha: 'Alfa ödülü!',
      mission: 'Görev tamamlandı!',
    },
  },

  difficulty: {
    label: 'Zorluk',
    names: {
      normal: 'Normal',
      hard: 'Zor',
      nightmare: 'Kabus',
    },
    blurbs: {
      normal: 'Oyunun tasarlanan standart hali.',
      hard: 'Daha hızlı, daha kalabalık ve daha sert vuran sürüler. Poké Mart geliştirmelerini tamamlayanlar için.',
      nightmare: 'Acımasız, aşırı hızlı ve yoğun sürüler; tüm iyileşmeler yarıya iner. Bol şans.',
    },
  },

  pause: {
    title: 'DURAKLATILDI',
    resume: 'Devam Et',
    quit: 'Pes Et',
    settings: 'Ayarlar',
    reportBug: 'Hata Bildir',
    evoLegend: "Maksimum seviye saldırı + belirtilen eşya = sonraki Poké Ball'da veya seviye atlamada evrim!",
    statsTitle: 'Değerler',
    movesTitle: 'Saldırılar',
    itemsTitle: 'Eşyalar',
    cards: 'Kartlar',
    cardsHint: 'Bu istatistik için alınan geliştirme kartları',
    noItems: 'Henüz eşya yok',
    typeDamage: 'Hasar',
    stats: {
      maxHp: 'Azami Can',
      might: 'Hasar',
      cooldown: 'Bekleme Süresi',
      area: 'Alan',
      duration: 'Süre',
      amount: 'Atış Sayısı',
      speed: 'Hız',
      armor: 'Savunma',
      regen: 'Yenilenme',
      magnet: 'Çekim Alanı',
      growth: 'TP',
      greed: 'Para (₽)',
      projectileSpeed: 'Atış Hızı',
      statusChance: 'Durum Etkisi Şansı',
      statusDamage: 'Durum Hasarı',
      damageTaken: 'Alınan Hasar',
      comboMoves: 'Kombo Saldırılar',
      specialRecharge: 'Özel Güç Yenilenmesi',
    },
    cardHintKeys: 'Kartını görmek için farenin imlecini saldırının üzerine getir',
    cardHintTouch: 'Kartını görmek için saldırıya basılı tut',
  },

  moveCard: {
    level: (n: number, max: number) => `Sv ${n}/${max}`,
    evolved: '★ EVRİMLEŞTİ',
    pierce: 'Delip Geçme',
    status: {
      burn: 'Yanma',
      poison: 'Zehir',
      paralysis: 'Felç',
      slow: 'Yavaşlatma',
      sleep: 'Uyku',
      freeze: 'Donma',
      mark: 'İşaret',
      confuse: 'Kafa Karışıklığı',
      seed: 'Tohum',
      weaken: 'Zayıflatma',
    },
    seconds: (s: string) => `${s} sn`,
    evolves: 'Evrim',
    evolvedFrom: 'Şundan evrimleşti:',
  },

  settings: {
    title: 'AYARLAR',
    music: 'Müzik',
    sfx: 'Efektler',
    sound: 'Ses',
    damageNumbers: 'Hasar sayıları',
    damageModes: {
      all: 'Tümü',
      reduced: 'Azaltılmış',
      off: 'KAPALI',
    },
    screenShake: 'Ekran sarsıntısı',
    flashes: 'Parlama efektleri',
    flashModes: {
      normal: 'Normal',
      reduced: 'Azaltılmış',
    },
    uiScale: 'Arayüz boyutu',
    uiScaleAuto: 'Otomatik',
    joystick: 'Joystick',
    joystickModes: {
      floating: 'Parmağı takip et',
      fixed: 'Sabit',
    },
    on: 'AÇIK',
    off: 'KAPALI',
    tabs: {
      sound: 'SES',
      game: 'OYUN',
      controls: 'KONTROLLER',
      about: 'HAKKINDA',
    },
    about: 'Pokémon Survivors, ücretsiz ve resmi olmayan bir hayran oyunudur. Nintendo, The Pokémon Company, GAME FREAK veya Creatures ile bir bağı yoktur.',
    legal: 'Yasal ve künye',
    github: 'GitHub kaynak kodu',
    reportBug: 'Hata bildir',
    guide: 'Nasıl oynanır',
    install: 'Uygulamayı yükle',
    hintKeys: '↑ ↓ seç · ← → ayarla veya sekme değiştir · ESC geri',
    hintTouch: 'Ayarlamak için dokun veya sürükle',
  },

  controls: {
    open: 'Klavye ve oyun kolu',
    title: 'KONTROLLER',
    keyboard: 'Klavye',
    gamepad: 'Oyun Kolu',
    actions: {
      up: 'Yukarı yürü',
      down: 'Aşağı yürü',
      left: 'Sola yürü',
      right: 'Sağa yürü',
      special: 'Özel saldırı',
      mega: 'Mega Evrim',
      lunge: 'Atılma',
      pause: 'Duraklat',
      confirm: 'Onayla',
      back: 'Geri',
    },
    press: (action: string) => `*${action}*: Bir tuşa veya oyun kolu butonuna bas… (ESC iptal eder)`,
    reserved: 'Ok tuşları ve ESC sabittir. Başka bir tuş seç.',
    bound: (action: string, key: string) => `*${action}* artık ${key} tuşunu kullanıyor.`,
    moved: (key: string, action: string, to: string | null) =>
      to ? `${key} tuşu *${action}* eylemindeydi, artık ${to} kullanıyor.` : `${key} tuşu *${action}* eylemindeydi, artık atanmadı.`,
    restore: 'Varsayılanlara dön',
    restored: 'Kontroller varsayılana sıfırlandı.',
    fixed: 'Ok tuşları ve ESC daima çalışır. Sol analog daima hareket ettirir.',
    touchNote: 'Dokunmatik ekranda joystick ve ekran butonları sabittir. Tuş atamak için klavye veya oyun kolu bağla.',
    padFound: (names: string) => `Oyun kolu bağlandı: *${names}*`,
    padMissing: "Oyun kolu algılanmadı. Kolun üzerindeki bir butona bas: Tarayıcılar kolu ancak tuşa basıldıktan sonra tanır. Hala görünmüyorsa tekrar bağla veya başka bir tarayıcı dene.",
    unbound: '—',
    back: 'Geri',
    hintKeys: '↑ ↓ seç · ← → sütun · ENTER değiştir · ESC geri',
    hintTouch: 'Değiştirmek istediğin tuşa veya butona dokun',
  },

  account: {
    pitch: 'İlerlemeni buluta kaydetmek ve herhangi bir cihazda devam etmek için Google ile giriş yap. Misafir olarak kazandığın her şey hesabına aktarılır.',
    google: 'Google ile giriş yap',
    failed: 'Giriş yapılamadı. Lütfen tekrar dene.',
    busy: 'Bağlanıyor…',
    back: 'Geri',
    hintKeys: '↑ ↓ seç · ENTER onayla · ESC geri',
    hintTouch: 'Seçmek için dokun',
    gateTitle: 'OYUNA BAŞLAMADAN ÖNCE',
    gatePitch: 'İlerlemeni buluta kaydetmek, dilediğin cihazdan devam etmek ve sıralamada görünmek için Google ile giriş yap.',
    gateNewAccount: 'Hesabın yok mu? İlk giriş yaptığında otomatik olarak oluşturulur.',
    playAsGuest: 'Misafir olarak oyna',
    gateGuestNote: 'Misafir olarak oynadığında ilerleme yalnızca bu cihazda saklanır ve koşuların sıralamaya dahil edilmez.',
  },

  socials: {
    follow: (name: string) => `Bizi ${name} üzerinde takip et`,
  },

  discord: {
    title: 'DISCORD',
    open: 'Discord',
    pitch: 'Topluluk sunucusunda oyun yenilikleri, Günlük Meydan Okuma dereceleri ve diğer eğitmenler yer alır. Genel dil İngilizcedir ve her dil için ayrı odalar bulunur.',
    linkPitch: 'Doğrudan sunucuya katılmak ve destekçi rolünü almak için Discord hesabını bağla.',
    guestPitch: 'Discord ile giriş yapmak hesabını oluşturur (veya mevcut olanı açar) ve ikisini tek seferde bağlar.',
    link: 'Discord bağla',
    signIn: 'Discord ile giriş yap',
    openServer: 'Sunucuyu aç',
    join: 'Sunucuya katıl',
    connected: (name: string) => `@${name} olarak bağlandı`,
    row: (name: string) => `Discord: @${name}`,
    failed: 'Discord bağlanamadı. Tekrar dene.',
    gift: (name: string) => `Hesabını bağlayıp sunucuya katıldığında bir *shiny ${name}* kazan!`,
    cardGift: (name: string) => `Bir shiny ${name} kazan`,
    busy: 'Bağlanıyor…',
    back: 'Geri',
  },

  install: {
    title: 'UYGULAMAYI YÜKLE',
    pitch: 'Tam ekran oyna, doğrudan ana ekranındaki bir simgeden başlat.',
    share: "Safari araç çubuğundaki (veya üç nokta menüsündeki) *Paylaş* butonuna dokun.",
    addHome: '*Ana Ekrana Ekle* seçeneğini seç, ardından *Ekle*ye dokun.',
    iosStorage: "Uygulama ilerlemesini Safari'den ayrı saklar: Kayıtlarını taşımak için hesabına giriş yap.",
    ok: 'Anladım',
  },

  ranking: {
    bag: (items: string) => `Çanta: ${items}`,
    title: 'SIRALAMA',
    periods: {
      day: 'Bugün',
      week: 'Hafta',
      all: 'Tüm Zamanlar',
    },
    everyone: 'Herkes',
    friends: 'Arkadaşlar',
    allPokemon: "Tüm Pokémon'lar",
    eggGroup: 'Yumurtadan çıkanlar',
    pokemon: 'Pokémon',
    loading: 'Yükleniyor…',
    offline: 'Sıralamaya ulaşılamıyor. Birazdan tekrar dene.',
    retry: 'Tekrar dene',
    empty: 'Bu tabloda henüz kimse yok. Neden ilki sen olmayasın?',
    emptyFriends: 'Diğer eğitmenleri burada görmek için profillerinden onları takip et.',
    friendsGuest: 'Arkadaş sıralamasını görmek için giriş yap.',
    you: 'sen',
    myProfile: 'Profilim',
    back: 'Geri',
    resets: 'Bugün ve Hafta sıralamaları Brasília saatine (UTC−3) göre gece yarısı yenilenir; haftalar pazartesi başlar.',
    hintKeys: '↑ ↓ oyuncu · ← → dönem · Q E zorluk · M mod · F arkadaşlar · ENTER profil · ESC geri',
    hintTouch: 'Profilini görmek için bir eğitmene dokun',
    outcomes: {
      victory: 'Kazandı',
      death: 'Yenildi',
      quit: 'Pes etti',
    },
    sending: 'Sıralamaya gönderiliyor…',
    place: {
      day: 'bugün',
      week: 'bu hafta',
      all: 'tüm zamanlar',
    },
    queued: 'Çevrim dışı: Koşu internete bağlandığında sıralamaya katılacak.',
    rejected: 'Bu koşu sıralamaya dahil edilemedi.',
    outdated: 'Sen oynarken oyun güncellendi, bu yüzden koşu sıralamaya eklenemedi. Sonraki koşun yeni sürümde geçerli olacak.',
    unranked: 'Bu koşu sıralama dışı: Çevrim dışı başladı veya oyun başka bir sekmede ya da cihazda açıktı.',
    unlisted: 'Bu koşu sıralama dışı kaldı: Oynarken bağlantı koptu. Profilinde sayılmaya devam eder.',
    guest: 'Sıralamada görünmek için giriş yap.',
    noHandle: 'Sıralamada görünmek için hesap ekranında profilini oluştur.',
    open: 'Sıralama',
    challengeTab: 'Meydan Okuma',
    days: {
      today: 'Bugün',
      yesterday: 'Dün',
    },
    challengeHead: (date: string, name: string, difficulty: string, n: number) => `${date} · ${name} · ${difficulty} · ${n === 1 ? '1 eğitmen' : `${n} eğitmen`}`,
    challengeEmpty: 'Bugün için henüz kimse resmi denemesini yapmadı.',
    challengeResets: "Yalnızca her eğitmenin ilk tamamladığı koşu geçerlidir. Kurdeleler ertesi gün Brasília saatiyle (UTC−3) 03.00'te dağıtılır.",
    challengeHint: '↑ ↓ oyuncu · ← → gün · Q E tablo · F arkadaşlar · ENTER profil · ESC geri',
    challengePlace: (date: string, rank: number, total: number) => `${date} Meydan Okuması: ${total} kişi arasından *#${rank}*`,
    challengeSent: 'Resmi deneme gönderildi: Derecen profilini oluşturduğunda görünecektir.',
    challengePractice: 'Antrenman: Bugünkü resmi denemen zaten kaydedildi.',
    challengePracticePlace: (rank: number, total: number) => `Antrenman · Resmi denemen: ${total} kişi arasından #${rank}`,
    challengeGuest: 'Yerel antrenman: Meydan okuma sıralamasına katılmak için giriş yap.',
    modes: {
      standard: 'Standart',
      legend: 'Efsanevi',
    },
    legendGroup: 'Efsaneviler',
  },

  profile: {
    title: 'PROFİL',
    follow: 'Takip et',
    unfollow: 'Takip ediliyor',
    followers: (n: number) => (n === 1 ? '1 takipçi' : `${n} takipçi`),
    following: (n: number) => `${n} takip edilen`,
    brought: (n: number) => (n === 1 ? '1 arkadaş davet edildi' : `${n} arkadaş davet edildi`),
    followGuest: 'Eğitmenleri takip etmek için giriş yap.',
    records: 'Rekorlar',
    legendRecords: 'Efsanevi Modu Rekorları',
    noRecord: '—',
    dex: 'Pokédex',
    dexLine: (caught: number, seen: number, total: number) => `${caught}/${total} yakalandı · ${seen} görüldü`,
    recent: 'Son Koşular',
    noRuns: 'Sıralamada henüz koşu yok.',
    share: 'Paylaş',
    report: 'Bildir',
    card: 'Eğitmen Kartı',
    copied: 'Profil bağlantısı kopyalandı!',
    edit: 'Düzenle',
    loading: 'Yükleniyor…',
    missing: (handle: string) => `@${handle} adında bir eğitmen bulunamadı.`,
    offline: 'Sunucuya ulaşılamıyor. Birazdan tekrar dene.',
    retry: 'Tekrar dene',
    back: 'Geri',
    hintKeys: '← → seç · ENTER onayla · ESC geri',
    hintTouch: 'Seçmek için dokun',
    editTitle: 'PROFİLİN',
    editIntro: 'Sıralamalarda ve profilinde bu şekilde görünürsün.',
    name: 'İsim',
    handle: 'Kullanıcı adı',
    handleHint: '3 ila 20 harf, rakam veya _. Profil bağlantında yer alır.',
    problems: {
      short: 'Çok kısa: En az 3 karakter kullan.',
      long: 'Çok uzun: En fazla 20 karakter.',
      chars: 'Yalnızca Türkçe olmayan düz harfler, rakamlar ve _ kullan.',
      reserved: 'Bu isim rezerve edilmiştir. Başka bir isim seç.',
      taken: 'Bu kullanıcı adı zaten alınmış.',
      name: 'En fazla 24 karakterden oluşan bir isim gir.',
    },
    useSuggestion: (handle: string) => `@${handle} kullan`,
    save: 'Kaydet',
    saving: 'Kaydediliyor…',
    later: 'Sonra',
    saveFailed: 'Kaydedilemedi. Bağlantını kontrol edip tekrar dene.',
    publicNote: "Profilin herkese açıktır: Bağlantıya sahip olan herkes ismini, unvanını, rekorlarını, Pokédex'ini ve son koşularını görebilir.",
    editHintKeys: 'TAB sonraki alan · ENTER kaydet · ESC geri',
  },

  results: {
    victory: "Mewtwo'yu yendin!",
    fainted: (name: string) => `${name} yere serildi!`,
    shiny: (name: string) => `Shiny ${name}`,
    time: 'Süre',
    level: 'Seviye',
    kills: 'Yenilen',
    earnings: (coins: string, bonus: string) => `Para: ${coins} · Bonus: ${bonus}`,
    retry: 'Tekrar dene',
    change: 'Pokémon değiştir',
    dexSpecies: (n: number) => (n === 1 ? '+1 yeni tür' : `+${n} yeni tür`),
    dexShinies: (n: number) => (n === 1 ? '1 shiny yakalandı' : `${n} shiny yakalandı`),
    support: 'Beğendin mi? Projeyi destekle',
  },

  share: {
    button: 'Paylaş',
    title: 'PAYLAŞ',
    trainerTitle: 'EĞİTMEN KARTI',
    rendering: 'Kart çiziliyor…',
    failed: 'Kart çizilemedi. Tekrar dene.',
    share: 'Paylaş',
    copy: 'Görseli kopyala',
    download: 'PNG İndir',
    back: 'Geri',
    copied: 'Görsel kopyalandı! Doğrudan yapıştırabilirsin.',
    saved: 'Görsel kaydedildi!',
    hintKeys: '← → seç · ENTER onayla · ESC geri',
    hintTouch: 'Seçmek için dokun',
    runText: (r: { name: string; shiny: boolean; shinies: number; outcome: string; link: string; time: string }) => {
      const who = `${r.name}${r.shiny ? ' ✨' : ''}`
      const caught = r.shinies === 0 ? '' : r.shinies === 1 ? ' ve 1 shiny yakaladım' : ` ve ${r.shinies} shiny yakaladım`
      return r.outcome === 'victory' ? `${who} ile Mewtwo'yu yendim${caught}! Geç bakalım: ${r.link}` : `${who} ile ${r.time} hayatta kaldım${caught}. Geç bakalım: ${r.link}`
    },
    trainerText: (shinies: number, caught: number, link: string) =>
      `Pokémon Survivors Eğitmen Kartım: ${shinies === 1 ? '1 shiny' : `${shinies} shiny`} ve Pokédex'te ${caught} Pokémon. Sen de oyna: ${link}`,
    card: {
      shiny: 'SHINY',
      outcomes: {
        victory: 'ZAFER',
        fainted: 'YENİLDİ',
        endless: 'SONSUZ',
      },
      time: 'Süre',
      level: 'Seviye',
      kills: 'Yenilen',
      shinies: 'KOŞUNUN SHINYLERİ',
      newShinies: (n: number) => (n === 1 ? "Pokédex'te 1 yeni" : `Pokédex'te ${n} yeni`),
      newSpecies: "POKÉDEX'TE YENİ",
      speciesCount: (n: number) => (n === 1 ? '1 tür' : `${n} tür`),
      moves: 'EN GÜÇLÜ SALDIRILAR',
      topMove: 'En güçlü saldırı',
      more: 'diğer',
      trainerCard: ['EĞİTMEN', 'KARTI'],
      idLabel: 'Eğitmen',
      guest: 'Misafir',
      medals: 'Madalyalar',
      shinyTotal: 'Shiny',
      pokedex: 'Pokédex',
      best: 'En iyi süre',
      showcase: 'SHINYLER',
      inBox: (n: number) => `PC Kutusunda ${n}`,
      noShinies: 'Henüz shiny yok',
      challenge: (date: string) => `${date} Meydan Okuması`,
      challengePlace: (rank: number, total: number) => `${total} KİŞİDE #${rank}`,
      ribbons: 'Kurdeleler',
      play: 'Tarayıcında ücretsiz oyna',
    },
  },

  pc: {
    title: 'PC KUTUSU',
    box: (n: number, total: number) => `KUTU ${n}/${total}`,
    prev: 'Önceki kutu',
    next: 'Sonraki kutu',
    empty: 'Boş yuva',
    none: 'Henüz hiç shiny yok. Alt ettiğin her shiny burada yaşamaya gelir!',
    trainer: 'Eğitmen Kartı',
    back: 'Geri',
    hintKeys: 'OKLAR gezin · Q E kutu · ESC geri',
    hintTouch: "Görmek için bir shiny'ye dokun · ◀ ▶ kutu değiştir",
  },

  dex: {
    seen: 'Görüldü',
    defeated: 'Yenildi',
    caught: 'Yakalandı',
    cleared: 'Kazanıldı',
    clear: 'Kazanıldı',
    clearedOn: (level: string) => `${level} zorluğunda Mewtwo yenildi`,
    filters: {
      all: 'Tümü',
      seen: 'Görülenler',
      caught: 'Yakalananlar',
      missing: 'Eksikler',
    },
    roles: {
      starter: 'Başlangıç',
      egg: 'Yumurta',
      enemy: 'Vahşi',
      boss: 'Boss',
      legendary: 'Efsanevi',
      event: 'Etkinlik',
    },
    owned: 'Yakalandı',
    yes: 'Evet!',
    no: 'Henüz değil',
    shiny: 'SHINY',
    unseen: 'Henüz görülmedi. Keşfetmeye devam et!',
    empty: 'Burada henüz bir şey yok.',
    back: 'Geri',
    site: 'Nerede bulunur ↗',
    pc: 'PC Kutusu',
    hintKeys: 'OKLAR gezin · Q E filtre · ESC geri',
    hintTouch: "Detaylar için bir Pokémon'a dokun",
  },

  mart: {
    open: "Poké Mart'ı Aç",
    rank: (name: string, rank: number, max: number) => `${name} · Sv ${rank}/${max}`,
    buy: (price: string) => `Satın al (${price})`,
    back: 'Geri',
    refund: 'İade et',
    refundConfirm: (amount: string) => `Her şeyi iade edip ${amount} geri almak istiyor musun?`,
    yes: 'Evet',
    no: 'Hayır',
    inBag: (n: number) => `Çantada: ${n}`,
    eggDescription: (steps: string) => `Doğrudan kuluçka makinesine gider ve ${steps} adımda çatlar.`,
    owned: 'Sahipsin',
    equipped: 'Kullanımda',
    equip: 'Kullan',
    styleSlots: {
      frame: 'Çerçeveler',
      background: 'Arka Planlar',
      wallpaper: 'Duvar Kağıtları',
    },
    styleDescriptions: {
      frame: 'Koşu kartının ve paylaştığın Eğitmen Kartının çerçevesi.',
      background: 'Koşu kartının ve Eğitmen Kartının gökyüzü arka planı.',
      wallpaper: 'PC Kutusunun duvar kağıdı.',
    },
    styles: {
      frame: {
        classic: 'Klasik',
        poke: 'Poké Ball',
        great: 'Great Ball',
        ultra: 'Ultra Ball',
        master: 'Master Ball',
        ambassador: 'Elçi',
        supporter: 'Destekçi',
        pumpkin: 'Balkabağı',
        spectral: 'Spektral',
        regular: 'Müdavim',
        kecleon: 'Altın Kecleon',
        meowth: 'Meowth',
      },
      background: {
        night: 'Yıldızlı gece',
        meadow: 'Route 1',
        forest: 'Viridian Forest',
        cave: 'Mt. Moon',
        snow: 'Mt. Silver',
        tower: 'Lavender Tower',
        supporter: 'Altın gökyüzü',
        halloween: 'Cadılar Bayramı Gecesi',
      },
      wallpaper: {
        classic: 'Klasik',
        forest: 'Yapraklar',
        cave: 'Çakıl taşları',
        snow: 'Kar taneleri',
        tower: 'Minik hayaletler',
        supporter: 'Altın yıldızlar',
        haunted: 'Perili Ev',
      },
    },
  },

  shop: {
    title: 'Kecleon Mağazası',
    levels: {
      '1': 'El Arabası',
      '2': 'Çadır',
      '3': 'Dükkan',
      '4': 'Kecleon Mart',
      '5': 'Büyük Mağaza',
    },
    level: (name: string, n: number) => `${name} (Sv ${n})`,
    tabs: {
      vitrine: 'Vitrin',
      bag: 'Çanta',
      tms: "TM'ler",
      evolution: 'Evrim',
      training: 'Geliştirme',
      style: 'Stil',
      caravan: 'Kervan',
      stall: 'Tezgah',
      loyalty: 'Sadakat',
      expansion: 'Genişletme',
    },
    badges: {
      gift: 'HEDİYE',
      wish: 'LİSTE',
      new: 'YENİ',
      armed: 'HAZIR',
      level: (n: number) => `SV ${n}`,
      exclusive: 'ÖZEL',
      found: 'BULUNDU',
      today: 'BUGÜN',
      owned: 'SENİN',
      sure: 'KESİN',
    },
    vitrineOf: (weekday: string, level: string) => `${weekday} vitrini · ${level}`,
    turnsIn: (time: string) => `${time} içinde yenilenir`,
    gift: (name: string) => `Hediye: ${name}`,
    giftDescription: (text: string) => `Ücretsiz, günde 1 adet. ${text}`,
    claim: 'Ücretsiz al',
    claimed: 'Hediye alındı',
    free: 'Ücretsiz',
    dayStyle: 'Günün stili',
    allStyles: 'Satıştaki tüm stillere zaten sahipsin.',
    eggOdds: (common: number, rare: number, ultra: number) => `Bugünkü yumurtanın şansları: Sıradan %${common}, nadir %${rare}, ultra nadir %${ultra}.`,
    blocks: {
      locked: 'Mağazayı büyüt',
      soldOut: 'Bugün tükendi',
      owned: 'Zaten sende var',
      full: 'Kuluçka makinesi dolu',
      poor: 'Yetersiz ₽',
    },
    lockedAt: (name: string, n: number) => `Mağaza Sv ${n} (${name}) olduğunda gelir.`,
    stock: (left: number, max: number) => `Bugünün stoğu: ${left}/${max}.`,
    have: (n: number) => `Sende ${n} adet var.`,
    deal: (pct: number) => `Günün fırsatı: %${pct} indirim!`,
    wish: {
      pin: 'İstek listesine ekle',
      unpin: 'Listeden çıkar',
      back: (on: string) => `Vitrinde tekrar gelişi: ${on}.`,
      today: 'Bugün vitrinde!',
      none: 'Önümüzdeki 2 hafta boyunca vitrine gelmeyecek.',
      locked: (name: string) => `İstek listesi: ${name} (Sv 2) ve sonrasında.`,
    },
    bag: {
      intro: (n: number, max: number) => `Sonraki koşu: ${n}/${max} eşya`,
      arm: 'Kuşan',
      disarm: 'Çıkar',
      empty: 'Hiç yok. Vitrinden satın alabilirsin.',
      more: (name: string, n: number, max: number) => `${name} (Sv ${n}) her koşuya ${max} eşya taşır.`,
    },
    tms: {
      intro: (n: number, max: number) => `Hazırlanan TM'ler: ${n}/${max} · ${max > 1 ? "koşunun ilk TM'leri senindir" : "koşunun ilk TM'si senindir"}`,
      groups: {
        exclusive: 'Mağazaya özel',
        found: 'Koşuda bulundu',
        today: 'Bugün rafta',
        owned: 'Çantanda',
      },
      arm: 'Hazırla',
      disarm: 'Çıkar',
      armed: 'Hazırlandı',
      text: "Bir kez satın alırsın ve sonsuza dek çantanda kalır. Koşudan önce hazırla: Bir boss'tan düşen ilk TM veya Move Tutor'un ilk dersi bu olur.",
      exclusive: 'Yalnızca mor kardeş satar.',
      found: 'Bir koşuda öğrendin: Her zaman rafta bulunur.',
      today: (on: string) => `Bugünün rotasyonunda: Günde 3 TM. ${on}`,
      back: (on: string) => `Rafa tekrar gelişi: ${on}.`,
      swap: (max: number) => (max === 1 ? 'Bunu hazırlamak diğerini çıkarır.' : `Aynı anda ${max} TM hazırlanır: Bunu hazırlamak en eskisini çıkarır.`),
      more: (name: string, n: number) => `${name} (Sv ${n}) 2 TM hazırlar.`,
      blocks: {
        locked: 'Mağazayı büyüt',
        owned: 'Zaten senin',
        away: 'Bugün yok',
        poor: 'Yetersiz ₽',
      },
    },
    evolution: {
      intro: 'Evrim eşyaları: Bir eşya gerektiren evrim yolu yalnızca o eşyayla açılır. Buradan alındığında kalıcı olarak senin olur; koşuda bir boss da düşürebilir (yalnızca o koşu için).',
      unlocks: (forms: string, family: string) => `${family} evrimleştiğinde ${forms} formunu açar. Kalıcı olarak senin olur.`,
      adds: (forms: string, family: string) => `${family} seçimine ${forms} ekler (eşyasızken üç ücretsiz formdan biri rastgele gelir). Kalıcı olarak senin olur.`,
      stays: (family: string) => `Eşya olmadan ${family} evrimleşmez (ancak %15 daha güçlü olur).`,
      evolves: (from: string, form: string, forGood: boolean) => `${from} Pokémon'unu ${form} formuna evrimleştirir.${forGood ? ' Kalıcı olarak senin olur.' : ''}`,
      drops: 'Bosslar da düşürebilir, yalnızca o koşu için geçerlidir.',
      owned: 'Çantanda',
    },
    caps: {
      group: (name: string) => `Bottle Cap · ${name}`,
      title: (n: number, max: number) => `Bottle Cap ${n}/${max}`,
      text: (name: string) => `Yalnızca ${name} ile oynarken seviye başına her şeye (Can, güç, savunma ve hız) +%3. En fazla 3 seviye.`,
      now: (pct: number) => `Şu an: +%${pct}.`,
      max: 'Maksimum',
      pick: 'Başka bir Pokémon',
      pickText: "Bu Bottle Cap'lerin hangi Pokémon için olduğunu seç.",
      pickTitle: 'Hangi Pokémon için Bottle Cap?',
      lockedAt: (name: string) => `Bottle Cap'ler: ${name} (Sv 3) ve sonrasında.`,
    },
    styleIntro: 'Çerçeveler, arka planlar ve duvar kağıtları. Satın aldığında hemen aktifleşir.',
    trainingGroup: 'Kalıcı geliştirmeler',
    trainingIntro: 'Kalıcı geliştirmeler. İstediğin zaman hepsini iade edebilirsin.',
    expansion: {
      intro: 'Mağazana yatırım yap: Meydanda büyüsün ve yeni şeylerin kilidini açsın. İadesi yoktur.',
      current: 'MEVCUT MAĞAZAN',
      next: 'SONRAKİ',
      building: (name: string) => `Bina ${name} haline gelir.`,
      vitrine: (n: number) => `Vitrinde günde ${n} eşya.`,
      bag: (n: number) => `Her koşuya çantadan ${n} eşya taşı.`,
      wishlist: 'İstek listesi: Kecleon eşya vitrine geldiğinde haber verir.',
      brother: "Kecleon'un mor kardeşi gelir.",
      props: {
        board: 'Meydanda bir ilan panosu.',
        flowers: 'Meydanda çiçek saksıları.',
        lights: 'Meydanda ışık zincirleri.',
        statue: "Kecleon'un altın heykeli.",
      },
      caravan: 'Cuma-pazar günleri meydanda Meowth kervanı.',
      tycoon: 'Magnate unvanı ve Altın Kecleon çerçevesi.',
      owned: 'Zaten senin.',
      invest: (price: string) => `Yatırım yap (${price})`,
    },
    caravan: {
      intro: (haggled: number | null) => `Meowth Kervanı · Cuma - Pazar · Her birinden 1 adet${haggled ? ` · -%${haggled} pazarlık indirimi` : ''}`,
      egg: 'Uzak diyarlardan geldi, yalnızca hafta sonu.',
      goldCap: {
        text: "Pokémon'larından birini doğrudan Bottle Cap 3/3 seviyesine taşır: Onunla oynarken her şeye +%9.",
        pickTitle: 'Hangi Pokémon için Gold Bottle Cap?',
        none: "Tüm Pokémon'ların zaten 3 Bottle Cap seviyesinde.",
      },
      frame: 'Meowth çerçevesi, yalnızca kervanda. Satın aldığında hemen aktifleşir.',
      tm: 'Özel TM, mor kardeşin raf fiyatına. Boş yer varsa hazırlanmış olarak gelir.',
      stock: 'Hafta sonu başına her birinden bir adet.',
      blocks: {
        closed: 'Kapalı',
        soldOut: 'Tükendi',
        owned: 'Zaten senin',
        full: 'Kuluçka makinesi dolu',
        poor: 'Yetersiz ₽',
      },
      haggle: {
        title: 'Pazarlık yap',
        text: (stamps: number, off: number) => `Kecleon müşteri kartındaki ${stamps} damga sayesinde Meowth bu hafta sonu her şeyde %${off} indirim yapıyor.`,
        done: (off: number) => `Pazarlık yapıldı: Pazara kadar her şeyde %${off} indirim.`,
        action: 'Pazarlık yap',
        doneAction: 'Pazarlık yapıldı',
      },
    },
    kecleonEgg: {
      text: (steps: string) => `${steps} adımda çatlar: Başka hiçbir yumurtada olmayan aileler. Günde 1 adet.`,
    },
    stall: {
      intro: (until: string) => `Duskull Tezgahı · Cadılar Bayramı Gecesi · ${until} tarihine kadar`,
      egg: (steps: string) => `${steps} adımda çatlar: Başka hiçbir yumurtada olmayan hayaletler.`,
      even: (names: string, pct: number) => `${names}: Her biri %${pct}`,
      odds: (list: string, shiny: number) => `${list}. Her ${shiny} taneden 1'i shiny.`,
      duplicate: (coins: string) => `Zaten varsa: ${coins}.`,
      stock: 'Günde bir adet, yalnızca Cadılar Bayramı Gecesi boyunca (gelecek yıl tekrar gelir).',
      blocks: {
        closed: 'Kapalı',
        soldOut: 'Yarın tekrar gel',
        full: 'Kuluçka makinesi dolu',
        poor: 'Yetersiz ₽',
      },
    },
    loyalty: {
      intro: (n: number) => `Müşteri kartı: ${n} damga · Günlük ziyaret başına bir damga`,
      card: 'Müşteri kartı',
      cardText: (n: number) => `${n} damga. Hiçbir şey satın almasan bile mağazaya uğradığın her gün bir damga kazanırsın. Uğramadığın günler damgalarını silmez.`,
      next: (left: number, reward: string) => `Şuna ${left} damga kaldı: ${reward}.`,
      milestone: (n: number) => `${n} damga`,
      rewards: {
        egg: 'Nadir Yumurta',
        frame: 'Müdavim Çerçevesi',
        title: 'VIP Müşteri Unvanı',
        statue: 'Altın Heykel',
        kecleonEgg: 'Kesinlikle Shiny Kecleon Yumurtası',
      },
      texts: {
        egg: 'Kuluçka makinesi için bir nadir yumurta. Ayrıca Meowth kervanında pazarlıkları kabul etmeye başlar.',
        frame: 'Müdavim çerçevesi: Köşelerinde damgalar bulunan Kecleon yeşili.',
        title: 'VIP Müşteri unvanı, kartında sergilemen için.',
        statue: "Kecleon'un altın heykeli, meydanında boy gösterir.",
        kecleonEgg: 'İçinden daima shiny çıkan Porygon, Exeggcute, Scraggy veya Smeargle çıkar. Sık sık uğradığın için teşekkürler!',
      },
      states: {
        claimed: 'Zaten senin',
        waiting: 'Hediyede bekliyor!',
        done: 'Meydanda',
        ahead: (left: number) => `${left} damga kaldı`,
      },
      waiting: 'Lobideki Hediye kutusunda seni bekliyor.',
    },
    investConfirm: (name: string, price: string) => `${price} yatırım yapıp mağazayı ${name} seviyesine yükseltmek istiyor musun? İadesi yoktur.`,
    hint: 'Q E raf · OKLAR seç · ENTER satın al · F liste · ESC geri',
    hintTouch: 'Seçmek için dokun, satın almak için tekrar dokun',
  },

  outbreak: {
    title: 'Günün salgını',
    blurb: 'Bugün her koşuda çıkar: Koşu başına yaklaşık 2 adet shiny.',
    started: (name: string) => `Kitlesel *${name}* salgını!`,
    hint: 'Bugün çok daha sık çıkar, shiny hali de öyle.',
  },

  halloween: {
    name: 'Cadılar Bayramı Gecesi',
    card: 'CADILAR BAYRAMI GECESİ',
    countdown: (days: number) => (days === 1 ? 'Yarın başlıyor!' : `${days} gün sonra başlıyor`),
    daysLeft: (days: number) => (days === 1 ? 'Son gün!' : `${days} gün kaldı`),
    daysLeftShort: (days: number) => (days === 1 ? 'SON GÜN' : `${days} GÜN`),
    over: 'Cadılar Bayramı Gecesi sona erdi. Gelecek yıla kadar görüşmek üzere!',
    dates: (from: string, to: string) => `${from} - ${to} arası`,
    blurb: 'Hayaletler kontrolü ele geçirdi! Her koşu lanetli: Her aşamada fazladan bir hayalet, günde bir lanetli salgın ve haritaya dağılmış balkabakları. Şeker topla, kavanozu doldur ve ödülleri kazan.',
    howGhosts: "*Hayalet* tipi Pokémon'lar şeker düşürür",
    howBosses: '*Bosslar* ve *Alfalar* daima 10 şeker verir',
    howPumpkins: '*Balkabaklarını* kır: Şeker mi şaka mı?',
    howEgg: "Meydandaki *Duskull*, günde 1 adet *Haunted Egg* satar",
    jarCount: (n: string) => `Şeker kavanozu: *${n}*`,
    jarNext: (n: string) => `Sonraki ödüle ${n} şeker kaldı`,
    received: 'alındı',
    inGiftBox: 'Hediyede!',
    forJoining: 'katıldığın için',
    shinyOf: (name: string) => `Shiny ${name}`,
    at: (n: string) => `${n} şeker`,
    calendar: 'LANETLİ SALGINLAR',
    today: 'BUGÜN',
    openGifts: (n: number) => (n === 1 ? 'Hediyeyi aç' : `Hediyeleri aç (${n})`),
    close: 'Kapat',
    hintKeys: '← → seç · ENTER onayla · ESC geri',
    hintTouch: 'Seçmek için dokun',
    started: '*Cadılar Bayramı Gecesi!*',
    startedHint: 'Hayaletler, bosslar ve Alfalar şeker düşürür. Balkabaklarını kır!',
    treat: '*Şeker!* Balkabağı şekerle doluydu.',
    trick: (name: string) => `*Şaka!* Bir ${name} sürüsü belirdi!`,
    candies: 'Şekerler',
    supporterBadge: (tier: string) => (tier === 'gold' ? 'Altın Destekçi · Cadılar Bayramı 2026' : 'Destekçi · Cadılar Bayramı 2026'),
    perk: 'Balkabağı',
    perkTitle: (date: string) => `${date} öncesinde destek ol: Kalbin sonsuza dek bu balkabağına dönüşsün ve Pumpkaboo sana eşlik etsin`,
    supportYes: "Desteğin için teşekkürler! Rozetin sıralamada, profilinde ve Şöhretler Salonunda sonsuza dek bir *balkabağı* olacak. Yalnızca destekçilere özel *Pumpkaboo* ise arkasında şeker ışıltıları bırakarak sana eşlik edecek (Altın için *shiny*).",
    supportNo: (date: string) => `${date} tarihine kadar projeyi *destekleyenler*, kalp yerine bu *balkabağını* sonsuza dek kazanır ve arkasında parıldayan şekerler bırakan *Pumpkaboo* yoldaş olur (Altın kademesinde *shiny*).`,
    support: 'Destek ol',
    hunt: 'HAYALET AVI',
    huntCount: (n: number, total: number) => `${n}/${total} avlandı`,
    huntBlurb: (candies: number) => `Her koşuda Onix ve Snorlax'ın yerini gece bossları alır. Her birinin ilk yenilgisi *${candies} şeker* kazandırır.`,
    huntReward: (title: string, frame: string) => `Hepsini alt et: *${title}* unvanı ve *${frame}* çerçevesi`,
    huntDone: 'Hepsi avlandı! Ödüller Hediye kutusunda seni bekliyor!',
    nightBoss: (name: string) => `Gece boss'u: *${name}*!`,
    hunted: (name: string, candies: number, n: number, total: number) => `*${name}* avlandı! +${candies} şeker · ${n}/${total}`,
    disguise: (name: string) => `${name} Pokémon'unun *Disguise* yeteneği bozuldu!`,
  },

  challenge: {
    title: 'GÜNLÜK MEYDAN OKUMA',
    day: (date: string) => `${date} Meydan Okuması`,
    same: 'Bugün koşu herkes için aynı: Tohum, Pokémon ve zorluk seviyesi.',
    off: 'Poké Mart geliştirmeleri, Lure, Incense ve Shiny Charm kapalıdır. Günün salgını geçerlidir.',
    outbreak: (name: string) => `Salgın: ${name}`,
    locked: 'Normalde senin için henüz yumurtada: Bugün oynayabilirsin!',
    official: 'RESMİ DENEME',
    officialHint: 'Bugün yalnızca ilk tamamladığın koşu meydan okuma sıralamasına girer.',
    practice: 'ANTRENMAN',
    practiceHint: 'Bugünkü resmi denemen yapıldı: Sonraki koşular antrenmandır.',
    attempt: (time: string) => `Denemen: ${time}`,
    place: (rank: number, total: number) => `${total} kişi arasından #${rank}`,
    next: (time: string) => `Yeni meydan okuma: ${time}`,
    guest: 'Misafirler oynayabilir ve antrenman yapabilir; ancak yalnızca kayıtlı hesaplar sıralamaya katılır ve kurdele kazanır.',
    ribbons: 'Kurdeleler: İlk %10 için altın, ilk yarı için gümüş, katılım için bronz.',
    play: 'Oyna (Resmi)',
    practicePlay: 'Antrenman',
    board: 'Sıralama',
    back: 'Geri',
    hintKeys: '← → seç · ENTER onayla · ESC geri',
    hintTouch: 'Seçmek için dokun',
    started: (date: string) => `*${date} Meydan Okuması*`,
    startedOfficial: 'Resmi deneme: Bol şans!',
    startedPractice: 'Antrenman: Meydan okuma sıralamasına girmez.',
  },

  news: {
    title: 'YENİLİKLER',
    open: 'Yenilikler',
    unread: 'Yenilikler: Yeni bir güncelleme!',
    update: (date: string) => `${date} Güncellemesi`,
    seeAll: 'Tümünü gör',
    close: 'Kapat',
    hintKeys: '← → seç · ENTER onayla · ESC geri',
    hintTouch: 'Seçmek için dokun',
  },

  survey: {
    title: 'HIZLI ANKET',
    open: 'Anket: Zorluk nasıl hissettiriyor?',
    question: 'Oyunun zorluk seviyesi sana nasıl hissettiriyor?',
    answers: {
      easy: 'Kolay',
      medium: 'Orta',
      hard: 'Zor',
      unsure: 'Emin değilim',
    },
    send: 'Gönder',
    later: 'Şimdi değil',
    thanks: 'Teşekkürler! Yanıtın oyunu dengelememize yardımcı oluyor.',
    hintKeys: '↑ ↓ zorluk · ← → yanıt · ENTER onayla · ESC kapat',
    hintTouch: 'Yanıtlamak için dokun',
  },

  ribbons: {
    names: {
      gold: 'Altın Kurdele',
      silver: 'Gümüş Kurdele',
      bronze: 'Bronz Kurdele',
    },
    section: 'Meydan okuma kurdeleleri',
  },

  invite: {
    banner: (name: string) => `*${name}* seni davet etti!`,
    blurb: 'Giriş yap ve bir Friendship Egg kazan. 3 koşu tamamladığında seni davet eden de bir tane kazanır.',
  },

  invites: {
    title: 'ARKADAŞLARINI DAVET ET',
    cardFirst: 'Arkadaş davet et',
    cardNext: (n: number) => `${n} arkadaş daha davet et`,
    cardAll: (friends: number) => (friends === 1 ? '1 arkadaş davet edildi' : `${friends} arkadaş davet edildi`),
    how: 'Nasıl çalışır?',
    steps: [
      'Arkadaşın *senin bağlantını* açar.',
      'Giriş yapar ve hemen bir *Friendship Egg* kazanır.',
      '*3 koşu* tamamladığında sana sayılır.',
    ],
    tip: 'Bağlantı X veya Instagram içinde açılırsa arkadaşın giriş yapmadan önce "Tarayıcıda aç"a dokunmalıdır.',
    link: 'Senin bağlantın',
    share: 'Bağlantıyı paylaş',
    copy: 'Bağlantıyı kopyala',
    copied: 'Bağlantı kopyalandı! Arkadaşlarına yapıştırabilirsin.',
    shareText: 'Benimle Pokémon Survivors oynamak ister misin? Bağlantımla katıl ve bir Friendship Egg kazan:',
    rewards: 'Ödüller',
    reward: {
      '1': 'Friendship Egg',
      '3': 'Elçi unvanı ve çerçevesi',
      '5': 'Ultra Nadir Yumurta',
      '10': 'Shiny Dratini',
    },
    milestone: (friends: number) => (friends === 1 ? '1 arkadaş' : `${friends} arkadaş`),
    friends: 'Arkadaşların',
    noFriends: 'Henüz bağlantınla kimse katılmadı.',
    runs: (runs: number, need: number) => `${runs}/${need} koşu`,
    counted: 'Sayımı tamamlandı!',
    loading: 'Yükleniyor…',
    offline: 'Bağlantı yok: Arkadaş listesi yüklenemedi.',
    guest: 'Davet bağlantını almak için giriş yap.',
    signIn: 'Giriş yap',
    noHandle: 'Davet bağlantını almak için profilini (@kullanıcı adı) oluştur.',
    createProfile: 'Profil oluştur',
    back: 'Geri',
    hintKeys: '← → buton · ENTER seç · ESC geri',
    hintTouch: 'Bir butona dokun',
  },

  gifts: {
    title: 'Gizemli Hediye!',
    egg: (egg: string) => `Kuluçka makinesine bir *${egg}* gitti.`,
    coins: (coins: string) => `*${coins}* kazandın.`,
    newTitle: (title: string) => `Yeni unvan: *${title}*! Hemen aktifleşti.`,
    style: (name: string) => `Yeni stil: *${name}*! Hemen aktifleşti.`,
    shinyHatch: (name: string) => `Senin için _shiny_ bir *${name}* geldi!`,
    companion: (name: string) => `*${name}* artık koşularda seninle yürüyor!`,
    ribbon: (name: string) => `*${name}*! Profilinde yerini aldı bile.`,
    ribbonWhy: (date: string, rank: number, total: number) => `${date} Meydan Okuması: ${total} kişi arasından #${rank}`,
    button: 'Hediye!',
    buttonLabel: (n: number) => (n === 1 ? 'Açılacak bir Gizemli Hediye' : `Açılacak ${n} Gizemli Hediye`),
    open: 'Aç',
    later: 'Sonra',
    tapToOpen: 'Açmak için kutuya dokun!',
    more: (n: number) => (n === 1 ? 'Bekleyen 1 hediye daha var' : `Bekleyen ${n} hediye daha var`),
    next: (n: number) => `Sonraki (${n})`,
    ok: 'Tamam',
    pickNow: 'Şimdi seç',
    full: 'Burada bir yumurta var ancak kuluçka makinesi dolu. Bir yumurta çatlatıp açmak için tekrar gel.',
    hintKeys: '← → seç · ENTER onayla · ESC geri',
    hintTouch: 'Seçmek için dokun',
    welcome: (from: string | null) => (from ? `@${from} davetiyle katıldığın için` : 'Bir davetle katıldığın için'),
    friends: (n: number) => (n === 1 ? 'İlk arkadaşını getirdiğin için' : `${n} arkadaş getirdiğin için`),
    shinyPick: '*Kendi seçeceğin bir shiny*! Şimdi seçebilir ya da sonraya, Şöhretler Salonuna bırakabilirsin.',
    support: (tier: string) => (tier === 'gold' ? 'Altın Destekçi seviyesine ulaştığın için ♥' : 'Projeyi desteklediğin için ♥'),
    staff: (from: string | null) => (from ? `Oyunu geliştiren @${from} tarafından bir hediye ♥` : 'Oyunun yapımcısından bir hediye ♥'),
    discord: 'Discord sunucumuza katıldığın için ♥',
    halloween: 'Cadılar Bayramı Gecesi şeker kavanozundan',
    halloweenSupport: 'Cadılar Bayramı Gecesinde destek olduğun için ♥',
    ghostHunt: 'Tüm Hayalet Avı bosslarını alt ettiğin için',
    loyalty: (n: number) => `Kecleon müşteri kartındaki ${n} damga için`,
    tycoon: "Kecleon Mağazasını Büyük Mağazaya dönüştürdüğün için",
  },

  supporters: {
    title: 'ŞÖHRETLER SALONU',
    lead: 'Oyunu yaşatanlar. Çok teşekkürler! ♥',
    perks: {
      title: 'Unvan',
      frame: 'Çerçeve',
      shiny: 'Shiny',
      companion: 'Yoldaş',
      vote: 'Oylama',
    },
    gold: '*Altın* (toplam 50 R$ veya 10 USD): Altın arka plan, duvar kağıdı ve rozet',
    legends: 'EFSANELER',
    goldFrom: '10 USD ve üzeri',
    fans: (n: number) => `DESTEKÇİLER · ${n}`,
    firstLegend: 'İlk Efsane sen ol',
    you: (tier: string) => (tier === 'gold' ? 'Sen bir Altın Destekçisin' : 'Sen bir Destekçisin'),
    join: 'Salona katıl',
    yours: 'Desteğin',
    cosmetic: 'Tüm destekler kozmetiktir: Asla para ödeyen kazanmaz (pay-to-win yoktur).',
    guest: 'Ödüller bir hesaba tanımlanır: Bağış yapmadan önce giriş yap.',
    noHandle: 'Bağışın doğrudan hesabına geçmesi için profilinde @kullanıcı adını seç.',
    none: 'Destek sayfasında @kullanıcı adınla bağış yap: Ödüller bir Gizemli Hediye olarak gelir.',
    loading: 'Yükleniyor…',
    offline: 'Şu anda sunucuya ulaşılamıyor.',
    since: (tier: string, date: string) => (tier === 'gold' ? `${date} tarihinden beri *Altın Destekçisin*. Çok teşekkürler! ♥` : `${date} tarihinden beri *Destekçisin*. Teşekkürler! ♥`),
    donate: 'DESTEK OL',
    signIn: 'Giriş yap',
    createProfile: 'Profil oluştur',
    pick: (n: number) => (n > 1 ? `Shiny seç (${n})` : 'Shiny seç'),
    companion: 'Yoldaş',
    vote: 'Anket',
    code: 'Bir kodum var',
    codeShort: 'Kod',
    show: (on: boolean) => (on ? 'Rozet ve isim: Görünür' : 'Rozet ve isim: Gizli'),
    shown: (on: boolean) => (on ? 'Görünür' : 'Gizli'),
    back: 'Geri',
    hintKeys: '↑ ↓ seç · ENTER onayla · ESC geri',
    hintTouch: 'Seçmek için dokun',
    gridHintKeys: 'OKLAR seç · ENTER onayla · ESC geri',
    pickTitle: 'SEÇECEĞİN BİR SHINY',
    pickIntro: 'Sonsuza dek shiny kalacak bir Pokémon seç. Henüz yumurtadan çıkarmadığın bir aileyle birlikte gelir.',
    starters: 'Başlangıçlar',
    eggs: 'Yumurta aileleri',
    pickConfirm: (name: string) => `${name} seç`,
    pickNone: "Bir Pokémon'a dokun",
    allShiny: 'Seçebileceğin tüm shinylere zaten sahipsin!',
    picked: (name: string) => `_Shiny_ *${name}* artık senin!`,
    pickedNote: "Oynamak için seçim ekranında Shiny'yi seç.",
    play: (name: string) => `${name} oyna`,
    ok: 'Tamam',
    companionTitle: 'YOLDAŞ',
    companionIntro: "Koşularda seni takip edecek Pokémon'u seç. Tamamen görseldir: Saldırmaz veya hiçbir şeyi etkilemez.",
    companionNone: 'Yok',
    companionShiny: (on: boolean) => (on ? 'Shiny: Evet' : 'Shiny: Hayır'),
    companionSave: 'Yanına al',
    companionSaved: (name: string) => `${name} seninle geliyor!`,
    companionOff: 'Yoldaş yok.',
    pollTitle: 'SIRADAKİ POKÉMON',
    pollIntro: 'Destekçiler yumurtadan çıkacak sıradaki aileyi seçer. Oyunu istediğin zaman değiştirebilirsin.',
    votes: (n: number) => (n === 1 ? '1 oy' : `${n} oy`),
    yourVote: 'SENİN OYUN',
    voteOnly: 'Yalnızca Destekçiler oy kullanabilir. Sonuçları herkes görebilir.',
    voted: (name: string) => `${name} için oy verildi!`,
    codeTitle: 'BİR KOD KULLAN',
    codeIntro: "@kullanıcı adın olmadan mı bağış yaptın? Kod teşekkür sayfasındadır. Kodu kullanan hesapta bir kez geçerlidir (bir arkadaşınınki de olabilir).",
    codeField: 'Kod',
    redeem: 'Kullan',
    redeeming: 'Kullanılıyor…',
    redeemed: 'Kod kullanıldı! Ödüller Gizemli Hediye olarak gelir.',
    codeErrors: {
      format: 'Kodlar PS-XXXX-XXXX biçimindedir.',
      unknown: 'Bu kod mevcut değil.',
      used: 'Bu kod zaten kullanılmış.',
      offline: 'Bağlantı yok. Tekrar dene.',
    },
    wallEmpty: 'Burada henüz kimse yok. İlk isim senin olabilir!',
    offWall: (total: number) => `Toplam ${total} destekçi. Bazıları panoda görünmemeyi tercih ediyor.`,
    credits: 'Oyunun devam etmesini sağlayan eğitmenlere teşekkürler',
    banner: 'Shiny seni bekliyor!',
    badge: (tier: string) => (tier === 'gold' ? 'Altın Destekçi' : 'Destekçi'),
    profileSince: (date: string) => `${date}'den beri Destekçi`,
  },

  ideas: {
    title: 'FİKİRLER',
    lead: 'Oyunda görmek istediklerini paylaş ve diğer eğitmenlerin fikirlerine oy ver. Ekip her fikri Havuz listesine eklemeden önce inceler ve en çok oy alanlar sıraya girer!',
    columns: {
      open: 'Havuz',
      todo: 'Sırada',
      cooking: 'Geliştiriliyor',
      done: 'Tamamlandı',
    },
    loading: 'Yükleniyor…',
    offline: 'Fikir panosuna ulaşılamıyor. Birazdan tekrar dene.',
    retry: 'Tekrar dene',
    empty: {
      open: 'Henüz fikir yok. İlkini sen göndermek ister misin?',
      todo: 'Şu an sırada bir şey yok.',
      cooking: 'Şu an geliştirilen bir şey yok.',
      done: 'Henüz yayınlanan bir şey yok ama yakında gelecek!',
    },
    pending: 'İnceleniyor',
    pendingNote: 'Ekip onaylayana kadar bu fikri yalnızca sen görebilirsin.',
    you: 'senin',
    done: 'Yayınlandı',
    doneOn: (date: string) => `${date} tarihinden beri oyunda`,
    up: 'Destekle (Oy ver)',
    down: 'Olumsuz oy ver',
    score: (n: number) => (n === 1 || n === -1 ? `${n} oy` : `${n} oy`),
    more: 'Daha fazla göster',
    post: 'Bir fikir öner',
    signIn: 'Önermek için giriş yap',
    createProfile: 'Önermek için profil oluştur',
    voteGuest: 'Oy kullanmak için giriş yap.',
    closed: 'Bu fikir artık oylamaya kapalı.',
    posted: "Fikir gönderildi! Ekip inceledikten sonra Havuz'a eklenecek.",
    form: {
      title: 'YENİ FİKİR',
      titleField: 'Fikrin',
      titlePlaceholder: 'Örn: Bir arkadaşla co-op modu',
      bodyField: 'Ayrıntılar (isteğe bağlı)',
      bodyPlaceholder: 'Nasıl çalışır? Neden eğlenceli olur?',
      note: (n: number) => `Her seferinde tek fikir ve günde en fazla ${n} adet. Önce birinin aynı fikri önerip önermediğini kontrol et ve ona oy ver.`,
      send: 'Gönder',
      sending: 'Gönderiliyor…',
      back: 'Geri',
      errors: {
        short: (min: number) => `Fikrini en az ${min} harfle yaz.`,
        invalid: 'Bu fikir gönderilemedi. Metni kontrol edip tekrar dene.',
        limit: (n: number) => `Bugün zaten ${n} fikir gönderdin. Yarın tekrar gel!`,
        profile: 'Öneri göndermeden önce profilini oluştur.',
        banned: 'Bu hesap fikir öneremez.',
        offline: 'Bağlantı yok. Birazdan tekrar dene.',
      },
    },
    hintKeys: '↑ ↓ ← → seç · ENTER oy ver · Q E sütun · N yeni fikir · ESC geri',
    hintTouch: 'Oy vermek için ▲ veya ▼ dokun',
  },

  bugReport: {
    title: 'HATA BİLDİR',
    crashTitle: 'OYUN KENDİLİĞİNDEN Mİ KAPANDI?',
    lead: 'Ne olduğunu anlat: Ne yapıyordun, ne bekliyordun ve ne ters gitti?',
    crashLead: (run: string | null) => `Görünüşe göre son koşunda oyun kendiliğinden kapandı${run ? ` (${run})` : ''}. Ne olduğunu anlatırsan inceleyebiliriz.`,
    crashText: 'Oyun koşunun ortasında kendiliğinden kapandı.',
    field: 'Ne oldu?',
    placeholder: 'Örn: Mağarada Onix belirdiği anda oyun dondu.',
    tech: 'Teknik bilgileri dahil et',
    techHint: "Sürüm, cihaz, ekran, koşu (Pokémon, süre, zorluk) ve oyunun son hata kayıtları. Kayıt dosyan dahil edilmez.",
    techShow: 'Nelerin gönderileceğini gör',
    note: 'Hesap gerekmez. Giriş yaptıysan bildirim @kullanıcı adınla iletilir.',
    send: 'Gönder',
    sending: 'Gönderiliyor…',
    back: 'Geri',
    sent: 'Bildirim gönderildi. Oyunun gelişmesine yardımcı olduğun için teşekkürler!',
    errors: {
      short: (min: number) => `En az ${min} harf yaz.`,
      invalid: 'Bu bildirim gönderilemedi. Metni kontrol edip tekrar dene.',
      limit: 'Az önce birkaç bildirim gönderdin. Lütfen daha sonra tekrar dene.',
      offline: 'Bağlantı yok. Birazdan tekrar dene.',
    },
    prompt: {
      text: 'Koşu sırasında oyun kapandı gibi görünüyor. Ne olduğunu bize anlatmak ister misin?',
      report: 'Bildir',
      dismiss: 'Şimdi değil',
    },
  },

  report: {
    title: 'BİLDİR',
    flag: (handle: string) => `@${handle} kullanıcısını bildir`,
    lead: (name: string, handle: string) => `${name} (@${handle}) kullanıcısını bildir`,
    run: (pokemon: string, time: string, difficulty: string) => `Koşu: ${pokemon} · ${time} · ${difficulty}`,
    reason: 'NEDEN',
    reasons: {
      cheating: {
        name: 'Hile',
        hint: 'İmkansız bir koşu veya ilerleme, değiştirilmiş kayıt dosyası.',
      },
      name: {
        name: 'Uygunsuz isim',
        hint: 'İsim veya @kullanıcı adı hakaret ya da saldırganlık içeriyor.',
      },
      other: {
        name: 'Başka bir şey',
        hint: 'Açıklama alanında bize anlat.',
      },
    },
    note: 'Açıklama (isteğe bağlı)',
    placeholder: 'Ne gördün?',
    privacy: 'Ekip her bildirimi inceler. Kimin bildirdiğini kimse öğrenemez.',
    send: 'Gönder',
    sending: 'Gönderiliyor…',
    back: 'Geri',
    thanksTitle: 'TEŞEKKÜRLER!',
    thanks: 'Bildirim gönderildi. Ekip inceleyecek. Sıralamanın adil kalmasına yardımcı olduğun için teşekkürler!',
    ok: 'Tamam',
    errors: {
      self: 'Kendini bildiremezsin.',
      limit: (n: number) => `Bugün zaten ${n} bildirim gönderdin. Yarın tekrar dene.`,
      banned: 'Bu hesap bildirim gönderemez.',
      invalid: 'Bildirim iletilemedi. Açıklamayı kontrol edip tekrar dene.',
      offline: 'Bağlantı yok. Birazdan tekrar dene.',
    },
  },

  bag: {
    label: 'Çanta',
    tmsLabel: "TM'ler",
    tmToggle: (name: string) => `TM ${name}`,
    descriptions: {
      lure: 'Sonraki koşunda vahşi shinyler iki kat daha sık çıkar (salgındakiler de dahil).',
      incense: 'Sonraki koşunda yumurtalar iki kat daha sık düşer.',
      rareCandy: "Sonraki koşuna Sv 3'te başla: İki seviye seçimi ilk seçiminden hemen sonra gelir.",
      luckyEgg: 'Sonraki koşunda +%25 TP.',
      luckIncense: 'Sonraki koşunda paralardan ve bitiş bonusundan +%50 ₽.',
      honey: "Sonraki koşunda günün salgınındaki Pokémon iki kat daha sık çıkar.",
      xAttack: 'Sonraki koşunda saldırılar +%10 vurur.',
      maxRevive: 'Sonraki koşunda ilk kez yere serildiğinde yarı Canınla ayağa kalkarsın.',
      everstone: 'Sonraki koşunda evrimleşmezsin ancak temel formun her şeyde (Can, güç, savunma ve hız) %15 daha güçlü olur.',
    },
    active: {
      lure: 'Bu koşuda shinyler iki kat daha sık çıkar!',
      incense: 'Bu koşuda yumurtalar iki kat daha sık düşer!',
      rareCandy: "Koşuya Sv 3'te başlıyorsun!",
      luckyEgg: 'Bu koşuda +%25 TP!',
      luckIncense: 'Bu koşuda +%50 ₽!',
      honey: "Salgın Pokémon'u bu koşuda iki kat daha sık çıkar!",
      xAttack: 'Bu koşuda saldırılar +%10 vurur!',
      maxRevive: 'Bu koşuda bir yere serilme hakkın var!',
      everstone: 'Bu koşuda evrim yok: Her şeye +%15!',
    },
    toggle: (name: string, n: number) => `${name} ×${n}`,
    armed: (n: number, max: number) => `${n}/${max}`,
    full: (max: number) => `Çanta her koşuya en fazla ${max} farklı eşya alır. Daha fazlasını taşımak için mağazayı büyüt.`,
  },

  toast: {
    used: (who: string, move: string) => `${who}, *${move}* kullandı!`,
    stance: (who: string, forme: string) => `${who}, *${forme} Formuna* geçti!`,
    legendary: (name: string) => `_Efsanevi_ bir *${name}* belirdi!`,
    boss: (name: string) => `Vahşi bir *${name}* belirdi!`,
    bossFled: (name: string) => `Vahşi *${name}* kaçtı!`,
    shiny: (name: string) => `Shiny bir *${name}* belirdi!`,
    shinyPlayer: (name: string) => `Şanslı günündesin! *${name}* Pokémon'un shiny! Artık seçim ekranında _açıldı_.`,
    caught: (name: string) => `Shiny *${name}* artık senin! _Pokédex'e_ eklendi.`,
    evolving: (name: string) => `Neler oluyor? ${name} evrimleşiyor!`,
    evolved: (from: string, to: string) => `Tebrikler! ${from}, ${to} formuna evrimleşti!`,
    moveEvolved: (from: string, to: string) => `*${from}*, *${to}* saldırısına evrimleşti!`,
    learns: (form: string) => `${form} artık şunları öğrenebilir:`,
    pokeball: (prize: string) => `Poké Ball: ${prize}`,
    pokeballEmpty: 'hiçbir şey çıkmadı… boştu!',
    pokeballLevel: (name: string, level: number) => `${name} Sv ${level}!`,
    pokeballEvolution: (name: string) => `${name}!`,
    pokeballBerry: 'bir Oran Berry!',
    revive: '*Revive* sayesinde yeniden ayağa kalktın!',
    maxRevive: '*Max Revive* seni yarı Can ile ayağa kaldırdı!',
    stolen: 'Taşıdığı eşyayı çaldın!',
    armedTm: (name: string, order: number) => `TM hazırlandı: *${name}*. Koşunun ${order === 0 ? 'ilk' : 'ikinci'} TM'si bu olacak!`,
  },

  mega: {
    button: 'MEGA',
    title: 'Mega Evrim (E)',
    section: 'Mega Evrim',
    sectionTwo: 'Mega Evrim (birini seç)',
    locked: (name: string) => `Mega Evrim geçirmek için ${name} formuna evrimleş`,
    stone: (stone: string) => `*${stone}* kazandın!`,
    stoneReady: '*MEGA* butonu veya *E* tuşu: Mega Evrim!',
    stoneLocked: (name: string) => `Mega Evrim geçirmek için _${name}_ formuna evrimleş.`,
    reacting: (stone: string) => `*${stone}* Key Stone ile tepki veriyor!`,
    evolved: (from: string, to: string) => `${from}, *${to}* formuna Mega Evrim geçirdi!`,
    ended: (name: string) => `${name} normal haline döndü.`,
    ready: '*Mega Evrim* yeniden hazır!',
    choose: (a: string, b: string) => `Efsanevi *${a}* ve *${b}* taşlarını bıraktı: Birini alırsan diğeri ufalanır.`,
    how: (stone: string, seconds: number, recharge: number) =>
      `${stone} taşını almak için bir yarık efsanevisini yen. Son evrimde ${seconds} sn boyunca Mega Evrim geçir (${recharge} sn bekleme süresi):`,
    effects: {
      venusaur: 'Can +50, savunma +3 ve 1 Can/sn yenilenme. Özel güç Petal Blizzard olur.',
      charizardX: 'Saldırılar +%30, hız +8 ve savunma +1. Özel güç Dragon Flare olur (mavi ejder alevleriyle atılma).',
      charizardY: 'Güneşi kavurucu hale getirir (yarıklar hariç), Ateş saldırıları ×1,5 vurur; saldırılar +%25 ve alan +%15. Özel güç Heat Wave olur.',
      blastoise: 'Saldırı başına +1 atış, atışlar %30 daha hızlı ve savunma +2. Özel güç Water Pulse olur.',
      raichuX: '70 px yakındaki düşmanlar felç olabilir, saldırılar +%30 ve Elektrik saldırıları +%25. Özel güç Volt Tackle olur (her inişte yıldırım saçan zincirleme atılma).',
      raichuY: 'Alan +%25, atışlar %30 daha hızlı, bekleme süreleri −%10 ve hız +8. Özel güç Rising Voltage olur.',
      alakazam: 'Her özel güç ayrıca rastgele 2 saldırını ateşler (Metronome gibi), bekleme süreleri −%15 ve saldırılar +%10. Özel güç Psystrike olur.',
      gengar: "90 px yakındaki düşmanlar hızlarının %45'ini kaybeder, saldırılar +%25 ve bekleme süreleri −%10. Özel güç Poltergeist olur.",
      dragonite: '%25 daha az hasar alır, saldırılar +%25 ve hız +6. Özel güç Hurricane olur.',
      mewtwoY: 'Saldırılar +%40, bekleme süreleri −%15 ve alan +%15. Özel güç Psystrike olur.',
      meganium: 'Can +40, 2 Can/sn yenilenme, Çimen ve Peri saldırıları +%30. Özel güç Solar Beam olur.',
      feraligatr: 'Ejderha saldırıları +%35, Su saldırıları +%20, saldırılar +%25 ve savunma +1. Özel güç Wave Crash olur (zincirleme atılma).',
      tyranitar: "Sürüyü hırpalayan ancak Tyranitar'a işlemeyen bir kum fırtınası koparır (yarıklar hariç). Can +60, savunma +3 ve saldırılar +%20. Özel güç Stone Edge olur.",
      sceptile: 'Hız +12, saldırılar +%20, Çimen ve Ejderha saldırıları +%20. Zincirleme atılma Dragon Claw olur ve her inişte ejder enerjisi halkası patlatır.',
      blaziken: 'Hız +16, saldırılar +%25 ve bekleme süreleri −%10. Özel güç Blaze Kick olur (yakabilen zincirleme atılma).',
      swampert: 'Yağmur getirir (yarıklar hariç), Su saldırıları ×1,5 vurur; Can +50, saldırılar +%25 ve hız +8. Özel güç Muddy Water olur.',
      gardevoir: 'Normal ve Peri saldırıları +%30, saldırılar +%15 ve 1,5 Can/sn yenilenme. Özel güç Moonblast olur.',
      gallade: 'Saldırılar +%30, Dövüş saldırıları +%25 ve hız +8. Zincirleme atılma en fazla 6 kez sıçrar ve her inişte Aura Sphere halkası patlatır.',
      metagross: 'Saldırılar +%30, savunma +2 ve hız +6. Özel güç Meteor Mash olur.',
      latias: '%15 daha az hasar alır, Can +30 ve saldırılar +%25. Özel güç Scale Shot olur.',
      latios: 'Saldırılar +%35, hız +8 ve atışlar %20 daha hızlı. Özel güç Dragon Claw olur.',
      staraptor: 'Saldırılar +%30 ve hız +10. Zincirleme atılma Sky Attack olur ve her inişte rüzgar bıçakları halkası patlatır.',
      garchomp: 'Saldırılar +%30, Yer, Kaya ve Çelik saldırıları +%30 ve savunma +1. Özel güç Earth Power olur.',
      garchompZ: 'Hız +14, bekleme süreleri −%15 ve saldırılar +%15. Özel güç Scale Shot olur.',
      lucario: 'Dövüş ve Çelik saldırıları +%35 ve hız +10. Zincirleme atılma en fazla 6 kez sıçrar ve her inişte Aura Sphere halkası patlatır.',
      lucarioZ: '%20 daha az hasar alır, savunma +2, Dövüş ve Çelik saldırıları +%25. Özel güç Focus Blast olur.',
      emboar: 'Saldırılar +%35 ve Can +40. Özel güç Heat Crash olur.',
      chesnaught: '%30 daha az hasar alır, savunma +2 ve Can +50. Özel güç Spiky Shield olur.',
      delphox: 'Bekleme süreleri −%15, saldırılar +%20 ve alan +%15. Özel güç Mystical Fire olur.',
      greninja: 'Saldırılar +%30, hız +8 ve bekleme süreleri −%10. Özel güç Night Slash olur (her inişte karanlık dalgalar patlatan zincirleme atılma).',
      pidgeot: 'Alan +%20, atışlar %30 daha hızlı, hız +10 ve saldırılar +%20. Özel güç Air Slash olur.',
      gyarados: 'Saldırılar +%35, Karanlık saldırıları +%30 ve savunma +2. Özel güç Waterfall olur.',
      ampharos: 'Ejderha saldırıları +%35, Elektrik saldırıları +%20, saldırılar +%25 ve Can +30. Özel güç Zap Cannon olur.',
      scizor: 'Saldırılar +%25, bekleme süreleri −%15 ve savunma +1. Özel güç Bullet Punch olur (en fazla 6 sıçramalı ve her inişte çelik parçacıkları saçan zincirleme atılma).',
      houndoom: 'Saldırılar +%35, Ateş saldırıları +%20; yanma ve zehir %20 daha güçlü. Özel güç Fiery Wrath olur.',
      aggron: '%25 daha az hasar alır, savunma +3 ve saldırılar +%15. Özel güç Heavy Slam olur.',
      manectric: "80 px yakındaki düşmanlar hızlarının %30'unu kaybeder, hız +12, saldırılar +%20 ve bekleme süreleri −%5. Özel güç Wild Charge olur.",
      altaria: 'Normal ve Peri saldırıları +%30, Ejderha saldırıları +%20, Can +30 ve 1 Can/sn yenilenme. Özel güç Hyper Voice olur.',
      banette: 'Bekleme süreleri −%20, her saldırıda +%10 durum etkisi şansı ve saldırılar +%15. Özel güç Phantom Force olur (her inişte gölge halkası patlatan zincirleme atılma).',
      glalie: 'Normal ve Buz saldırıları +%30 ve saldırılar +%25. Özel güç Sheer Cold olur.',
      salamence: 'Normal ve Uçan saldırıları +%30, hız +12 ve saldırılar +%25. Özel güç Double-Edge olur.',
    },
  },

  ability: {
    title: (name: string) => `${name} bir Yetenek uyandırdı!`,
    subtitle: 'Birini seç: Koşunun sonuna kadar kalır.',
    hidden: 'GİZLİ',
    hiddenLong: 'Gizli Yetenek',
    label: 'Yetenek',
    pending: '1. evrimde seçilir',
    section: 'Yetenekler',
    sectionBranch: 'Yetenekler (seçilen evrimden)',
    note: 'İlk evrimde bir tane seçersin (hiç evrimleşmeyenler için Sv 12). Gizli Yetenek ana oyunlarda en nadir olanıdır.',
    megaNote: "Mega formda Mega'nın Yeteneği devreye girer.",
    picked: (who: string, ability: string) => `${who} artık *${ability}* yeteneğine sahip!`,
    sturdy: (ability: string) => `*${ability}*: 1 Can ile dayandı!`,
    guard: (ability: string) => `*${ability}* darbeyi engelledi!`,
    summon: (ability: string) => `*${ability}* havayı değiştirdi!`,
    stack: (ability: string, n: number) => `*${ability}* ×${n}!`,
    mood: (ability: string, boost: string) => `*${ability}*: ${boost}!`,
    moods: ['yüksek hasar', 'daha hızlı', 'daha geniş alan', 'kısa bekleme süresi', 'daha yüksek savunma'],
    results: 'Yetenek',
  },

  branch: {
    title: (name: string) => `${name} evrimleşiyor… ama neye?`,
    subtitle: 'Evrim tipi, değerleri, özel gücü, saldırıları ve Yetenekleri değiştirir.',
    favored: (what: string) => `${what} bunu destekler`,
    unlocked: (item: string) => `${item} ile`,
    moves: 'Yeni saldırılar',
    abilities: 'Yetenekler',
    special: 'Özel Güç',
    section: 'Olası evrimler',
    noteDraw: 'Eşya olmadan ücretsiz üç formdan birine evrilir (hava durumu ve mekan birini öne çıkarır); elindeki her taş seçeneklere eklenir.',
    noteItems: 'Eşya gerektiren yollar yalnızca o eşyayla açılır: Kecleon Mağazasından alınabilir veya koşuda bir boss düşürebilir.',
    needs: (item: string) => `${item} ile`,
    found: (item: string) => `Bir evrim eşyası buldun: *${item}*!`,
    foundHint: 'Koşu bitene kadar sürer.',
    held: (name: string, items: string) => `*${name}*, ${items} olmadan evrimleşmez: Bu sırada her şeye +%15 güç kazanır.`,
    heldHint: "Bir boss bu eşyayı düşürebilir; Kecleon Mağazasından aldığında kalıcı olarak senin olur.",
    or: ' veya ',
    others: "Diğer yollar bir evrim eşyası ister: Kecleon Mağazasından ya da koşudaki bir boss'tan alınabilir.",
    choose: (n: number) => `${n} seçenek`,
    specialNote: "Evrim gerçekleştiğinde özel güç seçilen formunkine dönüşür.",
  },

  tm: {
    titleBoss: (boss: string) => `${boss} bir TM bıraktı!`,
    titleFound: 'Bir TM buldun!',
    titleLegendary: (legend: string) => `${legend} Pokémon'unun efsanevi TM'si!`,
    titleTutor: 'Move Tutor',
    subBoss: 'Öğrenme listen dışından bir saldırı. Öğrenilsin mi?',
    subLegendary: 'Koşu başına yalnızca bir efsanevi TM öğrenilebilir.',
    subTutor: (free: boolean) => (free ? "Kendi kendine asla öğrenemeyeceğin, tipine uygun saldırılar öğretirim. İlk ders ücretsiz!" : "Kendi kendine asla öğrenemeyeceğin, tipine uygun saldırılar öğretirim. Koşunun ₽'sini alırım."),
    tag: 'TM',
    free: 'ÜCRETSİZ',
    wallet: (coins: string) => `${coins} paran var`,
    broke: 'Yetersiz ₽',
    pass: 'Bırak',
    passTutor: 'Şimdi değil',
    forgetTitle: (who: string, move: string) => `${who}, ${move} öğrenmek istiyor…`,
    forgetFull: (who: string) => `…ancak ${who} zaten 6 saldırı biliyor. Hangisi unutulsun?`,
    forgetManual: '…ancak yalnızca tek bir manuel saldırı taşınabilir. Hangisi unutulsun?',
    keep: (move: string) => `${move} öğrenme`,
    poof: [
      '1, 2 ve…',
      '… … …',
      'Puf!',
    ],
    forgot: (who: string, move: string) => `${who}, ${move} unuttu.`,
    andLearned: (who: string, move: string) => `Ve… ${who}, ${move} öğrendi!`,
    learned: (move: string) => `*${move}* öğrenildi!`,
    learnedInstead: (old: string, move: string) => `_${old}_ unutuldu ve *${move}* öğrenildi!`,
    raised: (move: string, level: number) => `*${move}* Sv ${level}'e yükseldi!`,
    mastered: (move: string, coins: string) => `${move} zaten maksimum seviyede: TM *${coins}* haline geldi.`,
    hintKeys: '↑ ↓ seç · ENTER onayla',
    hintTouch: 'Seçmek için dokun',
  },

  abilities: {
    overgrow: "Can %33'ün altındayken Çimen saldırıları +%50 vurur.",
    blaze: "Can %33'ün altındayken Ateş saldırıları +%50 vurur.",
    torrent: "Can %33'ün altındayken Su saldırıları +%50 vurur.",
    swarm: "Can %33'ün altındayken Böcek saldırıları +%50 vurur.",
    swiftSwim: 'Yağmurda: Hız +18 ve bekleme süreleri −%8.',
    chlorophyll: 'Kavurucu güneşte: Hız +18 ve bekleme süreleri −%8.',
    sandRush: 'Kum fırtınasında: Hız +18 ve bekleme süreleri −%8; kum fırtınası seni hırpalamaz.',
    slushRush: 'Karda: Hız +18 ve bekleme süreleri −%8; kar seni hırpalamaz.',
    solarPower: 'Kavurucu güneşte: Saldırılar +%30 ama %10 daha fazla hasar alırsın.',
    rainDish: 'Yağmurda: 1,5 Can/sn yenilenme.',
    hydration: 'Yağmurda: 0,6 Can/sn yenilenme ve %15 daha az hasar.',
    iceBody: 'Karda: 1,5 Can/sn yenilenme; kar seni hırpalamaz.',
    sandVeil: 'Kum fırtınasında: %25 daha az hasar; kum fırtınası seni hırpalamaz.',
    snowCloak: 'Karda: %25 daha az hasar; kar seni hırpalamaz.',
    leafGuard: 'Kavurucu güneşte: %30 daha az hasar ve 0,5 Can/sn yenilenme.',
    drought: 'Seçildiğinde ve her yeni biyomda (yarıklar hariç) kavurucu güneşi çağırır: Ateş ×1,5.',
    sandStream: 'Seçildiğinde ve her yeni biyomda kum fırtınası başlatır: Sürüyü hırpalar, seni değil.',
    static: 'Sana temas eden düşmanlar felç olabilir.',
    flameBody: 'Sana temas eden düşmanlar yanabilir.',
    poisonPoint: 'Sana temas eden düşmanlar zehirlenebilir.',
    effectSpore: 'Sana temas eden düşmanlar zehirlenebilir, felç olabilir veya uyuyabilir.',
    cursedBody: 'Sana temas eden düşmanlar aşırı yavaşlayabilir.',
    cuteCharm: 'Sana temas eden düşmanlar uykuya dalabilir.',
    roughSkin: 'Sana temas eden düşmanlar her yarım saniyede hasar alır.',
    intimidate: 'Sana temas eden düşmanlar %25 daha az hasar vurur.',
    unnerve: "70 px yakındaki düşmanlar hızlarının %25'ini kaybeder.",
    unaware: 'Bosslar ve elitler sana %30 daha az hasar vurur.',
    thickFat: 'Ateş ve Buz saldırılarından yarı hasar alırsın.',
    flashFire: 'Ateş hasarını %60 daha az alırsın ve Ateş saldırıları +%15 vurur.',
    waterAbsorb: 'Su saldırıları sana hasar vermek yerine Canını doldurur.',
    voltAbsorb: 'Elektrik saldırıları sana hasar vermek yerine Canını doldurur.',
    lightningRod: 'Elektrik saldırıları Canını doldurur ve Elektrik saldırıları +%15 vurur.',
    bulletproof: 'Boss atışları ve patlamaları %60 daha az hasar verir.',
    levitate: 'Havada süzülürsün: Lav, tuzaklar, su ve buz seni etkilemez.',
    magicGuard: 'Yalnızca doğrudan darbelerden hasar alırsın: Lav, tuzak, patlama veya hava koşulları seni etkilemez.',
    magicBounce: "Her 12 sn'de bir darbeyi engeller ve dokunan düşmana iki katı olarak geri yansıtır.",
    illusion: "Her 10 sn'de bir darbeyi tamamen engeller.",
    damp: 'Patlamalar sana zarar vermez ve Su saldırıları +%10 vurur.',
    clearBody: 'Su ve buz seni yavaşlatmaz, ayrıca %10 daha az hasar alırsın.',
    shellArmor: 'Savunma +2.',
    rockHead: 'Savunma +1 ve saldırılar +%10.',
    heavyMetal: 'Savunma +3 ve Can +20, ancak hız −6.',
    lightMetal: 'Hız +10 ve bekleme süreleri −%5, ancak savunma −1.',
    sturdy: "Koşu başına bir kez, seni yere serecek darbe Canını 1'de bırakır.",
    multiscale: 'Canın doluyken yarı hasar alırsın.',
    marvelScale: "Canın yarının altındayken %30 daha az hasar alırsın.",
    shedSkin: "Her 10 sn'de azami Canının %6'sını yeniler.",
    naturalCure: '0,6 Can/sn yenilenme.',
    gluttony: 'Can +20 ve 0,8 Can/sn yenilenme.',
    guts: "Canın yarının altındayken saldırılar +%35 vurur.",
    quickFeet: "Canın yarının altındayken hız +16 ve bekleme süreleri −%10.",
    hugePower: 'Saldırılar +%30 vurur, ancak Can −10.',
    hustle: 'Saldırılar +%30 vurur, ancak alan −%10.',
    truant: 'Saldırılar +%40 vurur, ancak bekleme süreleri +%15.',
    noGuard: 'Alan +%20, ancak %10 daha fazla hasar alırsın.',
    reckless: 'Saldırılar +%25 vurur, ancak %10 daha fazla hasar alırsın.',
    technician: "Zayıf saldırılar (temel hasarı 10'a kadar olanlar) +%40 vurur.",
    ironFist: 'Yumruk saldırıları +%35 vurur (Mach Punch…).',
    strongJaw: 'Isırık saldırıları +%40 vurur (Crunch…).',
    sharpness: 'Kesme saldırıları +%35 vurur (Razor Leaf, Leaf Blade, Razor Shell, Water Shuriken…).',
    sheerForce: 'Durum etkisi uygulayan saldırılar (yanma, zehir…) +%25 vurur.',
    liquidVoice: 'Ses saldırıları +%30 vurur (Disarming Voice, Torch Song…), ve Su saldırıları +%10 vurur.',
    punkRock: 'Ses saldırıları +%35 vurur (Disarming Voice…), ve %5 daha az hasar alırsın.',
    adaptability: 'Kendi tipindeki saldırılar +%25 vurur.',
    protean: 'Kendi tipin dışındaki saldırılar +%20 vurur.',
    libero: 'Kendi tipin dışındaki saldırılar +%20 vurur.',
    pixilate: 'Normal saldırılar +%30 ve Peri saldırıları +%15 vurur.',
    grassySurge: '0,8 Can/sn yenilenme ve Çimen saldırıları +%10.',
    sniper: 'Bosslara ve elitlere yapılan vuruşlar +%25 vurur.',
    moldBreaker: "Dost kalkanlarını (Bronzong) deler; bosslara ve elitlere +%15 vurur.",
    infiltrator: "Dost kalkanlarını (Bronzong) deler ve saldırılar +%10 vurur.",
    moxie: "Yenilen her düşman hasara +%1 ekler (+%30'a kadar); düşman indirmedikçe söner.",
    battleBond: 'Her 200 alt etmede saldırılar +%8 ve hız +3 (en fazla 3 kez).',
    speedBoost: "Her 20 sn'de hız +3 (+30'a kadar).",
    competitive: 'Darbe aldığında 4 sn boyunca saldırılar +%25 vurur.',
    steadfast: 'Darbe aldığında 3 sn boyunca hız +14.',
    weakArmor: 'Darbe aldığında 3 sn boyunca hız +12 ve bekleme süreleri −%10, ancak bu sürede %5 daha fazla hasar alırsın.',
    contrary: "Aldığın her darbe koşunun kalanı boyunca hasara +%2 ekler (+%30'a kadar).",
    moody: "Her 15 sn'de rastgele güçlü bir güçlendirme: Hasar, hız, alan, bekleme süresi veya savunma.",
    unburden: 'Her boş eşya yuvası hız +4 ve bekleme süreleri −%2 verir.',
    pickup: 'Alt edilen düşmanlar bazen Oran Berry bırakır.',
    magician: 'Alt edilen düşmanlar bazen fazladan Exp. Candy bırakır.',
    frisk: 'Alt edilen düşmanlar bazen Poké Doları bırakır.',
    synchronize: '+%6 durum etkisi şansı ve durum etkileri %20 daha güçlü.',
    sereneGrace: 'Her saldırıda +%10 durum etkisi şansı.',
    keenEye: 'Çekim alanı +25 ve atışlar %15 daha hızlı.',
    longReach: 'Alan +%10 ve atışlar %20 daha hızlı.',
    vitalSpirit: 'Hız +8 ve bekleme süreleri −%5.',
    insomnia: 'Hız +5 ve 0,3 Can/sn yenilenme.',
    innerFocus: 'Özel saldırıyla alt edilen her düşman bekleme süresini 0,25 sn kısaltır.',
    stanceChange: 'Özel güç Shield Forme ile Blade Forme arasında geçiş yapar.',
    pressure: "64 px yakındaki düşmanlar hızlarının %20'sini kaybeder.",
    regenerator: "Her 8 sn'de azami Canın %5'ini yeniler.",
    drizzle: 'Başlangıçta ve her yeni biyomda (yarıklar hariç) yağmur çağırır: Su ×1,5.',
    airLock: 'Hava durumu düşmanları güçlendirmez, seni hırpalamaz; haritanın çevre saldırıları sana işlemez.',
    multitype: 'Tipin biyoma göre değişir ve o tipteki saldırılar +%20 vurur.',
  },

  world: {
    biomes: {
      meadow: 'Route 1',
      forest: 'Viridian Forest',
      cave: 'Mt. Moon',
      snow: 'Mt. Silver',
      tower: 'Lavender Tower',
    },
    area: (n: number, total: number) => `Bölge ${n} / ${total}`,
    weather: {
      clear: 'Açık hava',
      sun: 'Kavurucu güneş',
      rain: 'Sağanak yağmur',
      sand: 'Kum fırtınası',
      snow: 'Kar fırtınası',
      fog: 'Yoğun sis',
    },
    weatherStart: {
      sun: '*Kavurucu bir güneş* yükseldi!',
      rain: '*Bardaktan boşanırcasına bir yağmur* başladı!',
      sand: 'Bir *kum fırtınası* koptu!',
      snow: 'Bir *kar fırtınası* başladı!',
      fog: '*Yoğun bir sis* çöktü!',
    },
    weatherHint: {
      sun: 'Ateş daha sert vurur, Su daha zayıf',
      rain: 'Su daha sert vurur, Ateş daha zayıf',
      sand: 'Kaya, Yer ve Çelik dışındakileri hırpalar',
      snow: 'Buz dışındakileri hırpalar',
      fog: 'Uzağı görmek zordur',
    },
    weatherEnd: {
      sun: 'Güneş ışığı azaldı.',
      rain: 'Yağmur dindi.',
      sand: 'Kum fırtınası dindi.',
      snow: 'Kar durdu.',
      fog: 'Sis dağıldı.',
    },
  },

  eggs: {
    tiers: {
      common: 'Sıradan Yumurta',
      rare: 'Nadir Yumurta',
      ultra: 'Ultra Nadir Yumurta',
      friend: 'Friendship Egg',
      haunted: 'Haunted Egg',
      kecleon: 'Kecleon Egg',
      kecleonShiny: 'Shiny Kecleon Egg',
    },
    found: (egg: string) => `Bir *${egg}* buldun! Kuluçka makinesine gidiyor.`,
    foundFull: (egg: string, coins: string) => `Bir *${egg}* buldun! Kuluçka makinesi dolu olduğu için *${coins}* oldu.`,
    title: 'KULUÇKA MAKİNESİ',
    intro: 'Yumurtalar koşularda attığın adımlarla çatlar. Kuluçka makinesindeki her yumurta seninle birlikte yol alır.',
    sources: 'Bosslar, kilitli sandıklar ve yarıklar bazen bir yumurta bırakır.',
    empty: 'Boş',
    stepsLeft: (n: string) => `Kalan adım: ${n}`,
    ready: 'Hazır!',
    hatch: 'Çatlat!',
    back: 'Geri',
    collection: (n: number, total: number) => `Koleksiyon ${n}/${total}`,
    hint: '← → seç · ENTER çatlat · ESC geri',
    hatching: 'Neler oluyor? Yumurta kıpırdıyor!',
    hatched: (name: string) => `Yumurtadan *${name}* çıktı!`,
    hatchedShiny: (name: string) => `Yumurtadan _shiny_ bir *${name}* çıktı!`,
    unlocked: 'Artık onu partnerin olarak seçebilirsin.',
    shinyUnlocked: 'Artık sonraki tüm koşularda shiny olacak!',
    duplicate: (name: string, coins: string) => `Zaten ${name} sende vardı, bu yüzden ${coins} oldu.`,
    play: (name: string) => `${name} olarak oyna`,
    ok: 'Tamam',
    skip: 'Geçmek için dokun',
    tab: 'YUMURTALAR',
    locked: '???',
    lockedBlurb: (egg: string) => `Hala yumurtasında. Bir *${egg}* içinden çatar.`,
    friendBlurb: 'Yalnızca *Friendship Egg* içinden çıkar: Bir tane almak için bağlantınla arkadaşlarını davet et.',
    hauntedBlurb: "Yalnızca Cadılar Bayramı Gecesinde Duskull'ın sattığı *Haunted Egg* içinden çıkar. Sonrasında gelecek yıla kadar gelmez.",
    kecleonBlurb: "Yalnızca mağaza Vitrininin günde bir tane sattığı *Kecleon Egg* içinden çıkar.",
    lockedButton: 'Hala yumurta',
    incubator: (n: number, slots: number) => `Kuluçka makinesi ${n}/${slots}`,
    readyBadge: (n: number) => (n === 1 ? '1 yumurta hazır!' : `${n} yumurta hazır!`),
    steps: 'Adım',
    eggs: 'Yumurtalar',
    full: (n: number, coins: string) => (n === 1 ? `Kuluçka makinesi dolu: Yumurta ${coins} oldu.` : `Kuluçka makinesi dolu: ${n} yumurta ${coins} oldu.`),
    capped: (n: number, coins: string, cap: number) => (n === 1 ? `Koşu başına en fazla ${cap} yumurta: Yumurta ${coins} oldu.` : `Koşu başına en fazla ${cap} yumurta: ${n} yumurta ${coins} oldu.`),
  },

  mapEvents: {
    altar: (buff: string) => `Sunak *${buff}* bahşetti!`,
    fountain: 'Çeşme Canını yeniler. İçinde kal!',
    chestAmbush: 'Kilitli bir sandık! Açmak için yanında dur… _bu bir pusu_!',
    chestOpen: (coins: string) => `Sandık açıldı: *${coins}*, bir eşya ve bir Poké Ball!`,
    meowth: 'Para taşıyan bir *Meowth* koşuyor! Vur ona!',
    payDay: (coins: string) => `*Pay Day!* Meowth ${coins} düşürdü!`,
    meowthEscaped: '*Meowth* kaçtı…',
    tutor: 'Yakınlara bir *Move Tutor* çadır kurdu! Ders almak için içinde dur.',
    tutorEmpty: "Move Tutor'un sana öğretebileceği başka bir şey kalmadı.",
    tutorLeft: 'Move Tutor yola koyuldu…',
    field: {
      defense: 'Görev: Bir *yumurta* tehlikede! Oku takip et ve yuvayı savun.',
      collect: (n: number) => `Görev: Etrafta kaybolan *${n} Poké Ball* var! Süre bitmeden hepsini topla.`,
      escort: 'Görev: Bir *Togepi* kayboldu! Onu bul ve yuvasına geri götür.',
      nestRaid: "Vahşi Pokémon'lar yumurtayı istiyor! Tehlike geçene kadar *çemberin içinde kal*.",
      ballFound: (got: number, of: number) => `Poké Ball *${got}/${of}*`,
      togepiJoin: '*Togepi* seni takip ediyor! Onu yuvasına götür.',
      done: (coins: string) => `*Görev tamamlandı!* ${coins} ve bir seviye dolusu nadir kart!`,
      doneEgg: (coins: string) => `*Görev tamamlandı!* Yumurta senin oldu; ayrıca ${coins} ve nadir kartlar!`,
      failed: {
        defense: 'Yumurta kaybedildi…',
        collect: "Süre doldu: Poké Ball'lar kayboldu…",
        escort: 'Togepi korkup kaçtı…',
      },
      hudReach: (time: string) => `Yumurta tehlikede ${time}`,
      hudDefend: (left: string) => `Yumurtayı savun ${left}`,
      hudAway: (left: string) => `Yuvaya geri dön! ${left}`,
      hudCollect: (got: number, of: number, time: string) => `Poké Ball ${got}/${of} · ${time}`,
      hudFind: (time: string) => `Togepi'yi bul ${time}`,
      hudEscort: (time: string) => `Togepi'yi eve götür ${time}`,
    },
  },

  rifts: {
    open: '*Efsanevi bir yarık* açıldı! Oku takip et.',
    closed: 'Efsanevi yarık kapandı.',
    enter: (name: string) => `*${name}* diyarına girdin!`,
    enterShiny: (name: string) => `*${name}* diyarına girdin! _Shiny_ parıltısı yayılıyor…`,
    cleared: (name: string) => `*${name}* dize getirildi! Efsanevi yarık temizlendi!`,
    pairCleared: (a: string, b: string) => `*${a}* ve *${b}* dize getirildi! Efsanevi yarık temizlendi!`,
    collapse: 'Diyar çöküyor! Dışarı atılıyorsun!',
    fall: (name: string) => `*${name}* seni yendi! Yarık seni dışarı fırlatıyor…`,
    fallen: 'Yarık seni geri fırlattı. Koşu devam ediyor!',
    hudPortal: (time: string) => `Efsanevi yarık ${time}`,
    hudArena: (time: string) => `Çöküş: ${time}`,
    hudEndless: (time: string) => `Sonsuz +${time}`,
    hudReaper: (time: string) => `Arceus: ${time}`,
    hudHunting: 'Arceus seni avlıyor!',
    reaper: '*Arceus* seni yargılamak için indi!',
    reaperBack: '*Arceus* daha güçlü geri döndü!',
    reaperDown: '*Arceus* yere serildi! _Efsanevi_ bir zafer!',
    continue: 'Sonsuz mod',
    continueHint: 'Sürü asla durmaz ve Arceus 20:00 anında avlamak için iner. Ne kadar dayanabilirsin?',
    endlessOver: (name: string) => `${name} sonsuz modda yere serildi!`,
    overtime: 'Uzatma',
    legends: 'Efsaneviler',
    reaperDefeated: (n: number) => (n === 1 ? 'Arceus yenildi!' : `Arceus ${n} kez yenildi!`),
    omen: (name: string) => `*${name}* uyanıyor! Bir yarık açılmak üzere.`,
    omenFaint: '*Efsanevi* bir enerji kıpırdanıyor… Bir yarık açılmak üzere.',
    enterDomain: (place: string) => `*${place}* mekanına adım attın!`,
    hudCrossing: 'İlerlemeye devam et!',
    escaped: (name: string) => `*${name}* Poké Ball'dan kaçtı!`,
    caught: (name: string) => `*${name}* yakalandı!`,
    calms: (name: string) => `Rüzgar, *${name}* öfkesinden geriye kalanı dindiriyor.`,
    domains: {
      kyogre: {
        place: 'Deniz Dibi Mağarası',
        epithet: 'Denizlerin Efendisi',
        omen: 'Hiç yoktan bardaktan boşanırcasına bir yağmur başlıyor…',
        crossing: 'Sular yükseliyor! Mağaranın derinliklerine doğru ilerle!',
        phases: ['Mağara sular altında kalıyor! Surf dalgasından kurtulmak için adaların üzerinde dur.', 'Kyogre *İlkel forma* bürünüyor! Origin Pulse saldırısına dikkat et!'],
      },
      groudon: {
        place: 'Magma Mağarası',
        epithet: 'Karaların Efendisi',
        omen: 'Güneş acımasızca kavuruyor ve yer yarılıyor…',
        crossing: 'Tünel çöküyor ve lavlar yaklaşıyor! Koş!',
        phases: ['Lavlar yükselip odayı bölüyor! Soğumuş taşların üzerinden geç.', 'Groudon *İlkel forma* bürünüyor! Precipice Blades saldırısına dikkat et!'],
      },
      rayquaza: {
        place: 'Sky Pillar',
        epithet: 'Göklerin Efendisi',
        omen: 'Şiddetli bir rüzgar göğü yarıp tüm hava olaylarını dindiriyor…',
        crossing: 'Zemin arkandan çöküyor! Kuleye tırman!',
        phases: ['Çatı parçalanıp göğe dökülüyor! Kenarlara dikkat et.', 'Rayquaza *Mega Evrim* geçiriyor! Dragon Ascent saldırısına dikkat et!'],
      },
      lugia: {
        place: 'Whirl Islands',
        epithet: 'Denizlerin Muhafızı',
        omen: 'Ufukta bir fırtına toplanıyor…',
        crossing: 'Fırtına yaklaşıyor! Adaları aş ve anaforlardan uzak dur!',
        phases: ['Deniz yükseliyor! Anaforlardan çık ve Hurricane saldırısına dikkat et.', 'Lugia göğe yükseliyor! Yukarıdan yağan rüzgar darbelerinden kaç.'],
      },
      hoOh: {
        place: 'Bell Tower',
        epithet: 'Gökkuşağı Ankası',
        omen: 'Gökkuşağı göğü bölüyor ve küller yağmaya başlıyor…',
        crossing: 'Kule alevler içinde! Kat kat yukarı tırman!',
        phases: ['Ho-Oh havalanıyor! Alev izlerinden ve Brave Bird saldırısından kaç.', 'Ho-Oh *küllerinden doğuyor*! Çatının kenarları alevler içinde.'],
      },
      dialga: {
        place: 'Spear Pillar',
        epithet: 'Zamanın Efendisi',
        omen: 'Zaman tekleme başlıyor…',
        crossing: 'Zaman parçalanıyor! Spear Pillar boyunca ilerle!',
        phases: ['Zaman bükülüyor! Roar of Time sırasında saldırıların havada donup kalır.', 'Zaman hızlanıyor! Dialga gittikçe daha da hızlanıyor.'],
        cues: { stop: 'Zaman durdu!', forward: 'Zaman ileri sardı!', rewind: 'Zaman geriye sardı!' },
      },
      latias: {
        place: 'Southern Island',
        epithet: 'Eon İkilisi',
        omen: 'Rüya gibi bir sis her yeri kaplıyor…',
        crossing: 'Rüya dağılıyor! Sis seni yutmadan önce bahçeyi aş!',
        phases: ['Rüya bozuluyor ve deniz adayı yutuyor! Seraplara dikkat et.', 'Latias ve Latios *Mega Evrim* geçiriyor! Draco Meteor yağarken Latias’ın sisinin altına sığın!'],
      },
      deoxys: {
        place: 'The Drifting Meteoroid',
        epithet: 'Yıldızlardan Gelen Ziyaretçi',
        omen: 'Gökyüzünden bir göktaşı yağmuru akıyor…',
        crossing: 'Göktaşı parçalanıyor! Boşluk seni yutmadan önce ilerle!',
        phases: ['Deoxys *Atak Formuna* geçiyor! Kırılgan ama ölümcül.', 'Deoxys *Savunma Formuna* geçiyor! Kalkanı kırmak için muhafızları alt et.', 'Deoxys *Hız Formuna* geçiyor! Durmadan hareket et.'],
      },
    },
    pairName: (a: string, b: string) => `${a} & ${b}`,
    pairDown: (down: string, survivor: string) => `*${down}* düştü! *${survivor}* öfkelendi: Partnerini iyileştirmeden önce onu alt et!`,
    pairRevive: (healer: string, revived: string) => `*${healer}*, *${revived}* Pokémon'unu hayata döndürdü!`,
    guardUp: (name: string) => `*${name}* kalkan açtı! Kırmak için muhafızları alt et.`,
    guardDown: 'Kalkan kırıldı!',
  },

  landmarks: {
    names: {
      cottage: 'Terk Edilmiş Kulübe',
      tunnel: 'Maden Tüneli',
      maze: 'Çit Labirenti',
      ruins: 'Unown Harabeleri',
      camp: 'Terk Edilmiş Kamp',
    },
    hints: {
      cottage: 'Biri içeride bir sandık bırakmış…',
      tunnel: 'Bir ağzından gir, diğerinden çık.',
      maze: 'Labirentin merkezinde bir sandık bekliyor.',
      ruins: 'Sunak sessizlik içinde bekliyor.',
      camp: 'Ateşin başında unutulmuş bir sırt çantası.',
    },
    loot: {
      cottage: 'Eski sandığı karıştırdın!',
      maze: 'Labirentin merkezine ulaştın!',
      ruins: 'Unown glifleri parıldamaya başladı!',
      camp: 'Unutulmuş sırt çantasını açtın!',
    },
    tunnelOut: 'Tünelin öbür tarafından çıktın!',
  },

  places: {
    names: {
      cave: 'Karanlık Mağara',
      graveyard: 'Hayaletli Mezarlık',
      sky: 'Bulutların Üzeri',
    },
    hudNames: {
      cave: 'Mağara',
      graveyard: 'Mezarlık',
      sky: 'Hava Akımı',
    },
    open: {
      cave: 'Bir *mağara* ağzı belirdi! Oku takip et.',
      graveyard: 'Sisin içinden bir *mezarlık* belirdi! Oku takip et.',
      sky: 'Gökyüzüne yükselen bir *hava akımı* var! Oku takip et ve uç.',
    },
    sealed: {
      cave: "Mağaranın ağzına kayalar düştü.",
      graveyard: 'Mezarlığın demir kapısı kapandı.',
      sky: 'Hava akımı dindi.',
    },
    blocked: 'Yalnızca *Uçan* tip bir Pokémon bu hava akımına kapılabilir.',
    goal: {
      cave: 'Karanlıkta merdivenleri bul ve *hazineye* doğru in!',
      graveyard: 'Yendiğin her hayalet *Odd Keystone* taşını hareketlendirir…',
      sky: 'Rüzgar dinmeden önce getirdiği *kanatları* kap!',
    },
    floor: (n: number) => `B${n}F`,
    wind: [
      'Bir şeyler kıpırdanıyor…',
      'Giderek yaklaşıyor!',
      'Tam burada! Rüzgar çok şiddetli!',
    ],
    blownOut: 'Şiddetli bir rüzgar seni mağaradan dışarı savurdu!',
    monsterHouse: 'Bu bir *Canavar Yuvası* (Monster House)!',
    treasure: (coins: string) => `Hazine açıldı: *${coins}*, eşyalar ve bir Poké Ball!`,
    keystone: '*Odd Keystone* çatladı ve *Spiritomb* uyandı!',
    keystoneShiny: '*Odd Keystone* çatladı ve _shiny_ bir *Spiritomb* uyandı!',
    spiritomb: '*Spiritomb* alt edildi! Ruhlar huzura erdi.',
    dawnSoon: 'Şafak sökmek üzere…',
    dawn: 'Güneş doğdu ve hayaletler kayboldu.',
    calmSoon: 'Rüzgar dinmek üzere…',
    landed: (n: number) => (n === 0 ? 'Rüzgar dindi ve süzülerek geri indin.' : `Rüzgar dindi. Yanında ${n === 1 ? '1 kanatla' : `${n} kanatla`} döndün!`),
    wings: {
      healthWing: (n: number) => `+${n} azami Can`,
      muscleWing: (n: number) => `+%${n} hasar`,
      resistWing: (n: number) => `+${n} savunma`,
      swiftWing: (n: number) => `+${n} hız`,
      prettyWing: (n: number) => `Değeri: ₽${n}`,
    },
    hudOpen: (name: string, time: string) => `${name} ${time}`,
    hudCave: (floor: string, time: string) => `${floor} · rüzgar ${time}`,
    hudSpirits: (n: number, of: number, time: string) => `Ruhlar ${n}/${of} · ${time}`,
    hudDawn: (time: string) => `Şafak ${time}`,
    hudSky: (n: number, time: string) => `Kanatlar ${n} · ${time}`,
    results: 'Bölgeler',
    fall: 'Yere serildin! Bir *kurtarma ekibi* yola çıktı…',
    rescued: 'Haritaya geri kurtarıldın. Koşu devam ediyor!',
  },

  types: {
    normal: 'Normal',
    fire: 'Ateş',
    water: 'Su',
    grass: 'Çimen',
    electric: 'Elektrik',
    poison: 'Zehir',
    flying: 'Uçan',
    bug: 'Böcek',
    rock: 'Kaya',
    ground: 'Yer',
    ghost: 'Hayalet',
    fighting: 'Dövüş',
    psychic: 'Medyum',
    ice: 'Buz',
    steel: 'Çelik',
    dark: 'Karanlık',
    fairy: 'Peri',
    dragon: 'Ejderha',
  },

  missions: {
    title: 'GÖREVLER',
    tab: 'Görevler',
    daily: 'Günlük',
    weekly: 'Haftalık',
    resetsIn: (time: string) => `${time} içinde yenilenir`,
    duration: (d: number, h: number, m: number) => (d > 0 ? `${d}g ${h}sa` : h > 0 ? `${h}sa ${m}dk` : `${m}dk`),
    back: 'Geri',
    hintKeys: '← → sekme · ↑ ↓ kaydır · ENTER unvanı göster · ESC geri',
    hintTouch: 'Göstermek için unvanı olan bir başarıma dokun',
    report: 'Görevler',
    reportReward: (amount: string) => `Görevler ve madalyalar: +${amount}`,
    toastDone: (n: number, amount: string) => (n === 1 ? `Görev tamamlandı! *+${amount}*` : `${n} görev tamamlandı! *+${amount}*`),
    toastMedal: (name: string) => `Yeni madalya: *${name}*!`,
    toastEgg: (n: number) => (n === 1 ? 'Kuluçka makinesine bir *yumurta* gitti!' : `Kuluçka makinesine ${n} *yumurta* gitti!`),
    rewardEgg: (tier: string) => `+ ${tier}`,
    reportEggs: (n: number) => (n === 1 ? '+1 yumurta' : `+${n} yumurta`),
    rewardItem: (name: string) => `+ ${name} (çantaya gider)`,
    reportItems: (n: number) => (n === 1 ? '+1 çanta eşyası' : `+${n} çanta eşyası`),
    toastItem: (n: number) => (n === 1 ? 'Çantaya bir *eşya* eklendi!' : `Çantaya ${n} *eşya* eklendi!`),
    goals: {
      kills: (n: string) => `${n} Pokémon alt et`,
      typeKills: (n: string, type: string) => `${n} ${type} tipi Pokémon alt et`,
      weatherKills: {
        sun: (n: string) => `Kavurucu güneşte ${n} Pokémon alt et`,
        rain: (n: string) => `Yağmurda ${n} Pokémon alt et`,
        sand: (n: string) => `Kum fırtınasında ${n} Pokémon alt et`,
        snow: (n: string) => `Karda ${n} Pokémon alt et`,
        fog: (n: string) => `Siste ${n} Pokémon alt et`,
      },
      biomeKills: {
        meadow: (n: string) => `Route 1 üzerinde ${n} Pokémon alt et`,
        forest: (n: string) => `Viridian Forest içinde ${n} Pokémon alt et`,
        cave: (n: string) => `Mt. Moon içinde ${n} Pokémon alt et`,
        snow: (n: string) => `Mt. Silver üzerinde ${n} Pokémon alt et`,
        tower: (n: string) => `Lavender Tower içinde ${n} Pokémon alt et`,
      },
      traitKills: (n: string) => `Özel davranışa sahip ${n} Pokémon alt et`,
      shinyKills: (n: string) => (n === '1' ? 'Bir shiny Pokémon alt et' : `${n} shiny Pokémon alt et`),
      outbreakKills: (n: string, name: string) => `Bugünün salgınından ${n} ${name} alt et`,
      bossKills: (n: string) => `${n} boss alt et`,
      rifts: (n: string) => (n === '1' ? 'Bir efsanevi yarık kazan' : `${n} efsanevi yarık kazan`),
      chests: (n: string) => (n === '1' ? 'Bir sandık aç' : `${n} sandık aç`),
      meowths: (n: string) => (n === '1' ? "Meowth'a parasını düşürt" : `Meowth'a ${n} kez parasını düşürt`),
      altars: (n: string) => `${n} sunak kullan`,
      coins: (amount: string) => `${amount} topla`,
      moveEvolutions: (n: string) => (n === '1' ? 'Bir saldırıyı evrimleştir' : `${n} saldırı evrimleştir`),
      wins: (n: string) => (n === '1' ? "Mewtwo'yu yen" : `Mewtwo'yu ${n} kez yen`),
      typeWins: (n: string, type: string) => (n === '1' ? `Bir ${type} başlangıcıyla Mewtwo'yu yen` : `${type} başlangıçlarıyla Mewtwo'yu ${n} kez yen`),
      survive: (n: string) => `Tek koşuda ${n} dk hayatta kal`,
      typeSurvive: (n: string, type: string) => `Bir ${type} başlangıcıyla ${n} dk hayatta kal`,
      level: (n: string) => `Tek koşuda Sv ${n}'e ulaş`,
      endless: (n: string) => `Sonsuz modda ${n} dk hayatta kal`,
      steps: (n: string) => `${n} adım yürü`,
      species: (n: string) => `Tek koşuda ${n} farklı tür gör`,
      hatches: (n: string) => (n === '1' ? 'Bir yumurta çatlat' : `${n} yumurta çatlat`),
    },
  },

  achievements: {
    tab: 'Başarımlar',
    count: (n: number, total: number) => `${n}/${total} madalya`,
    medals: { bronze: 'Bronz', silver: 'Gümüş', gold: 'Altın' },
    title: 'Unvan',
    noTitle: 'yok',
    titleTag: 'UNVAN',
    equipped: 'GÖSTERİLİYOR',
    giftTitles: {
      ambassador: 'Oyuna 3 arkadaş davet etti',
      supporter: 'Projeyi bağışla destekledi',
      pumpkinKing: 'Cadılar Bayramı Gecesi şeker kavanozunu doldurdu',
      exorcist: 'Tüm Hayalet Avı bosslarını alt etti',
      vipCustomer: "Kecleon'un müşteri kartında 30 damga topladı",
      tycoon: "Kecleon'un dükkanını Büyük Mağazaya dönüştürdü",
    },
    newMedals: 'Yeni madalyalar',
    names: {
      firstRun: 'İlk adımlar',
      regular: 'Müdavim',
      veteran: 'Kıdemli',
      kills1k: 'Bin düşman devrildi',
      kills10k: 'Sürü kıran',
      kills100k: 'Durdurulamaz',
      survive5: 'Hayatta Kalan',
      survive10: 'Ölmesi zor',
      finalForm: 'Son form',
      level30: 'Deneyimli',
      level50: 'Savaş ustası',
      moveEvo: 'Evrimleşmiş saldırı',
      moveEvo50: 'Cephanelik',
      boss10: 'Boss avcısı',
      boss100: 'Bossların korkulu rüyası',
      chests10: 'Hazine avcısı',
      meowths5: 'Pay Day',
      altars25: 'Sadık',
      coins10k: 'Birikim',
      coins100k: 'Servet',
      coins1m: 'Kodaman',
      starters9: 'Gezgin',
      starters27: 'Eksiksiz eğitmen',
      missions10: 'Yardımsever',
      missions100: 'Yorulmak bilmez',
      shiny1: 'Parıldıyor!',
      shiny10: 'Keskin göz',
      shiny50: 'Shiny Avcısı',
      shinyStarter: 'Shiny partner',
      dex100: 'Araştırmacı',
      starterLines: 'Pokémon Profesörü',
      firstHatch: 'Aaa? Yumurta çatladı!',
      shinyHatch: 'Shiny yavru',
      rift1: 'Yarık kıran',
      rift25: 'Yarık gezgini',
      place1: 'Patikanın ötesi',
      place25: 'Maceracı',
      landmark1: 'Meraklı',
      landmark50: 'Hazine Avcısı',
      mega1: 'Mega Bağ',
      mega25: 'Mega Ustası',
      alpha1: 'İlk Alfa',
      alpha25: 'Alfa İz Sürücüsü',
      alpha100: 'Alfa Avcısı',
      legends: 'Efsane Terbiyecisi',
      shinyLegend: 'Işıltılı efsane',
      explorer: 'Kaşif',
      champion: 'Şampiyon',
      wins10: 'Hanedan',
      trio: 'Başlangıç üçlüsü',
      kanto: 'Kanto Şampiyonu',
      johto: 'Johto Şampiyonu',
      hoenn: 'Hoenn Şampiyonu',
      sinnoh: 'Sinnoh Şampiyonu',
      unova: 'Unova Şampiyonu',
      kalos: 'Kalos Şampiyonu',
      alola: 'Alola Şampiyonu',
      galar: 'Galar Şampiyonu',
      paldea: 'Paldea Şampiyonu',
      regions: 'Bölgelerin Efendisi',
      endless: "Mewtwo'nun ötesi",
      reaperSurvivor: "Arceus'un bakışları altında",
      reaperDown: 'Yaşayan Efsane',
    },
    titles: {
      veteran: 'Kıdemli',
      kills100k: 'Durdurulamaz',
      coins1m: 'Kodaman',
      starters27: 'Eksiksiz Eğitmen',
      missions100: 'Yorulmak Bilmez',
      shiny50: 'Shiny Avcısı',
      shinyStarter: 'Şanslı',
      starterLines: 'Pokémon Profesörü',
      shinyHatch: 'Shiny Yetiştiricisi',
      legends: 'Efsane Terbiyecisi',
      explorer: 'Kaşif',
      champion: 'Şampiyon',
      regions: 'Bölgelerin Efendisi',
      reaperDown: 'Yaşayan Efsane',
      alpha100: 'Alfa Avcısı',
      ambassador: 'Elçi',
      supporter: 'Destekçi',
      pumpkinKing: 'Balkabağı Kralı',
      exorcist: 'Şeytan Çıkarıcı',
      vipCustomer: 'VIP Müşteri',
      tycoon: 'Kodaman',
    },
    goals: {
      runs: (n: string) => (n === '1' ? 'Bir koşu oyna' : `${n} koşu oyna`),
      kills: (n: string) => `Toplamda ${n} Pokémon alt et`,
      bestMinutes: (n: string) => `Tek koşuda ${n} dk hayatta kal`,
      bestLevel: (n: string) => `Tek koşuda Sv ${n}'e ulaş`,
      finalStages: () => "Başlangıç Pokémon'unun son evrimine ulaş",
      wins: (n: string) => (n === '1' ? "Mewtwo'yu yen" : `Mewtwo'yu ${n} kez yen`),
      trio: () => "Bir Çimen, bir Ateş ve bir Su başlangıcıyla Mewtwo'yu yen",
      regions: () => "9 bölgenin tamamından başlangıçlarla Mewtwo'yu yen",
      starters: (n: string) => `${n} farklı başlangıçla oyna`,
      shinyKills: (n: string) => (n === '1' ? 'Bir shiny Pokémon alt et' : `${n} shiny Pokémon alt et`),
      shinyStarters: () => "Shiny bir başlangıç Pokémon'uyla koşuya başla (64'te 1)",
      shinyLegends: () => 'Bir yarıkta shiny bir efsaneviyi alt et',
      rifts: (n: string) => (n === '1' ? 'Bir efsanevi yarık kazan' : `${n} efsanevi yarık kazan`),
      legends: (n: string) => `Tüm ${n} yarık efsanevisini alt et`,
      overtimeMinutes: (n: string) => (n === '1' ? 'Sonsuz modda 1 dk hayatta kal' : `Sonsuz modda ${n} dk hayatta kal`),
      reaperDefeats: () => "Sonsuz modda Arceus'u yen",
      bossKills: (n: string) => `${n} boss alt et`,
      chests: (n: string) => `${n} sandık aç`,
      meowths: (n: string) => `Meowth'a ${n} kez parasını düşürt`,
      altars: (n: string) => `${n} sunak kullan`,
      coins: (amount: string) => `Toplamda ${amount} topla`,
      moveEvolutions: (n: string) => (n === '1' ? 'Eşyasıyla bir saldırıyı evrimleştir' : `${n} saldırı evrimleştir`),
      missions: (n: string) => `${n} görev tamamla`,
      dexSeen: (n: string) => `Pokédex'te ${n} tür gör`,
      starterLines: () => '27 başlangıcın tüm formlarını yakala (her birini son evrimine ulaştır)',
      hatches: (n: string) => (n === '1' ? 'Bir yumurta çatlat' : `${n} yumurta çatlat`),
      shinyHatches: () => "Shiny bir Pokémon çatlat (100'de 1)",
      megas: (n: string) => (n === '1' ? 'Bir kez Mega Evrim geçir' : `${n} kez Mega Evrim geçir`),
      alphaKills: (n: string) => (n === '1' ? 'Bir Alfa Pokémon alt et' : `${n} Alfa Pokémon alt et`),
      placeClears: (n: string) => (n === '1' ? 'Bir bölgeyi tamamla: Mağara hazinesi, Spiritomb veya kanatlarla uçuş' : `${n} bölge tamamla`),
      landmarks: (n: string) => (n === '1' ? 'Haritada gizli bir hazineyi aç: Terk edilmiş kulübede, labirentte, harabelerde veya kampta' : `Haritada gizli ${n} hazine aç`),
      places: (n: string) => `Tüm ${n} bölgeyi tamamla: Mağara hazinesi, mezarlıktaki Spiritomb ve bulutların üzerinde bir uçuş`,
    },
    region: (name: string) => `${name} bölgesinden bir başlangıçla Mewtwo'yu yen`,
  },

  moves: {
    "leechSeed": {
      "description": "En yakındaki düşmanlara tohum fırlatır. Tohum zamanla Can çeker ve seni iyileştirir; düşman bayıldığında iki komşu düşmana sıçrar.",
      "upgrades": [
        "+1 tohum",
        "+3 hasar",
        {
          "fork": [
            {
              "name": "Ekim",
              "desc": "Zeminde hasar veren alan bırakır; +%15 durum hasarı"
            },
            {
              "name": "Sarmaşık Dalı",
              "desc": "Tohum 2 düşmana daha sıçrar; -1 hasar"
            }
          ]
        },
        "Bekleme süresi 0,3 sn daha hızlı",
        "+1 tohum",
        {
          "fork": [
            {
              "name": "Tohum Bombası",
              "desc": "Bayılttığı düşmanlar patlar; +4 hasar"
            },
            {
              "name": "İkinci Ekim",
              "desc": "Anında tekrar kullanılır (%50); +%20 alan"
            }
          ]
        },
        "+2 tohum"
      ]
    },
    "rapidSpin": {
      "description": "Kabuğunun içinde dönersin: gövden düşmanlara çarpıp onları uzağa fırlatır. Dönerken %40 daha az hasar alır, daha hızlı hareket eder ve düşman atışlarını savuşturursun.",
      "upgrades": [
        "+3 hasar",
        "Dönüş süresi +0,3 sn",
        {
          "fork": [
            {
              "name": "Statik Dönüş",
              "desc": "2 düşmana daha sıçrar; +%10 alan"
            },
            {
              "name": "Can Veren Dönüş",
              "desc": "Vuruşları seni iyileştirir; +%10 alan"
            }
          ]
        },
        "Bekleme süresi 0,5 sn daha hızlı",
        "+4 hasar",
        {
          "fork": [
            {
              "name": "Kabuk Patlaması",
              "desc": "Bayılttığı düşmanlar patlar; +0,3 sn süre"
            },
            {
              "name": "Son Dönüş",
              "desc": "Canı ≤%12 olan düşmanları bitirir; +%15 alan, +16 hasar"
            }
          ]
        },
        "+5 hasar ve daha uzağa fırlatır"
      ]
    },
    "petalDance": {
      "description": "Etrafında yapraklar helezon çizer, art arda her dansta daha da hızlanır. Üçüncü dans en güçlüsüdür ama bir anlığına sersemletip yavaşlatır.",
      "upgrades": [
        "+1 yaprak",
        "+3 hasar",
        {
          "fork": [
            {
              "name": "Çift Helezon",
              "desc": "Daha geniş 2. bir helezon geriye döner; +2 hasar"
            },
            {
              "name": "Dökülen Yapraklar",
              "desc": "Zeminde hasar veren alan bırakır; +0,3 sn süre"
            }
          ]
        },
        "+1 yaprak",
        "Bekleme süresi 0,3 sn daha hızlı",
        {
          "fork": [
            {
              "name": "Tam Çiçeklenme",
              "desc": "Bayılttığı düşmanlar patlar; +4 hasar"
            },
            {
              "name": "Yaprak Hortumu",
              "desc": "Düşmanları içine çeker; +%15 alan"
            }
          ]
        },
        "+2 yaprak"
      ]
    },
    "eruption": {
      "description": "Sırtından fırlayan ateş bombaları etrafına yağar. Ne kadar çok Canın varsa o kadar sert vurur. Yakabilir.",
      "upgrades": [
        "+1 bomba",
        "+6 hasar",
        {
          "fork": [
            {
              "name": "Lav Alanı",
              "desc": "Zeminde hasar veren alan bırakır; +%10 alan"
            },
            {
              "name": "Artçı Sarsıntı",
              "desc": "Anında tekrar kullanılır (%50); -4 hasar"
            }
          ]
        },
        "+2 bomba",
        "Bekleme süresi 0,4 sn daha hızlı",
        {
          "fork": [
            {
              "name": "Piroklast",
              "desc": "Bayılttığı düşmanlar patlar; +8 hasar"
            },
            {
              "name": "Öfkeli Yanardağ",
              "desc": "Elitlere ve bosslara karşı ×1,5; +11 hasar"
            }
          ]
        },
        "+2 bomba ve +%15 alan"
      ]
    },
    "thrash": {
      "description": "Gözü dönmüş bir saldırı: 2,5 sn boyunca etrafındaki düşmanları aralıksız ısırırsın. Ardından yorulup bir anlığına yavaşlarsın.",
      "upgrades": [
        "+3 hasar",
        "Saniyede +1 ısırık",
        {
          "fork": [
            {
              "name": "Zincirleme Hiddet",
              "desc": "2 düşmana daha sıçrar; +%10 alan"
            },
            {
              "name": "Can Veren Hiddet",
              "desc": "Vuruşları seni iyileştirir; +%20 alan"
            }
          ]
        },
        "Saldırı süresi +0,5 sn",
        "+4 hasar",
        {
          "fork": [
            {
              "name": "Katliam",
              "desc": "Bayılttığı düşmanlar patlar; +1 ısırık"
            },
            {
              "name": "Titan Öfkesi",
              "desc": "Elitlere ve bosslara karşı ×1,5; +1 ısırık"
            }
          ]
        },
        "Bekleme süresi 1 sn daha hızlı ve +3 hasar"
      ]
    },
    "doubleKick": {
      "description": "Kavis çizerek peş peşe iki hızlı tekme atar: ilki hedefi işaretler, ikincisi ise ilkinin vurduğu hedefe ×1,5 hasar verir.",
      "upgrades": [
        "+3 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Zincirleme Tekme",
              "desc": "2 düşmana daha sıçrar; -0,1 sn bekleme süresi"
            },
            {
              "name": "Üçlü Tekme",
              "desc": "Anında tekrar kullanılır (%50); +0,1 sn bekleme süresi, +6 hasar"
            }
          ]
        },
        "+4 hasar",
        "Arkana doğru +1 çift tekme",
        {
          "fork": [
            {
              "name": "Son Darbe",
              "desc": "Canı ≤%12 olan düşmanları bitirir; +10 hasar"
            },
            {
              "name": "Patlama Tekmesi",
              "desc": "Bayılttığı düşmanlar patlar; +2 hasar"
            }
          ]
        },
        "+%25 alan ve daha güçlü iter"
      ]
    },
    "mudShot": {
      "description": "Düşmanları yavaşlatan ağır çamur fırlatır. İlk vuruş yakındaki diğer düşmanlara sıçrar.",
      "upgrades": [
        "+3 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Çift Dalga",
              "desc": "Geriye doğru da ateşler; +7 hasar"
            },
            {
              "name": "Bataklık",
              "desc": "Zayıflatan çamur bırakır; +1 dalga"
            }
          ]
        },
        "Bekleme süresi 0,25 sn daha hızlı",
        "+4 hasar",
        {
          "fork": [
            {
              "name": "Çamur Patlaması",
              "desc": "İsabette 2'ye ayrılır; +%10 alan, +5 hasar"
            },
            {
              "name": "Geri Dönen Dalga",
              "desc": "Gidip geri döner; +0,1 sn bekleme süresi"
            }
          ]
        },
        "+1 dalga ve +4 hasar"
      ]
    },
    "woodHammer": {
      "description": "Kütükten bir çekici kaldırıp var gücüyle önündeki zemine indirir. İsabet eden her vuruş Canından biraz götürür.",
      "upgrades": [
        "+6 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Kıymıklar",
              "desc": "2 düşmana daha sıçrar; -0,2 sn bekleme süresi"
            },
            {
              "name": "Kökleşme",
              "desc": "Zeminde hasar veren alan bırakır; -0,3 sn bekleme süresi"
            }
          ]
        },
        "+8 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Balyoz",
              "desc": "Bayılttığı düşmanlar patlar; -0,2 sn bekleme süresi, -10 hasar"
            },
            {
              "name": "Oduncu",
              "desc": "Elitlere ve bosslara karşı ×1,5; -0,3 sn bekleme süresi, +11 hasar"
            }
          ]
        },
        "+10 hasar"
      ]
    },
    "drillPeck": {
      "description": "Dönen bir gaga matkabı düşman dizisini delip geçer, içinden geçtiği her bir düşmanı biçerek yavaşlar.",
      "upgrades": [
        "+2 hasar",
        "+1 matkap",
        {
          "fork": [
            {
              "name": "Güdümlü Matkap",
              "desc": "Düşmanları takip eder; +4 hasar"
            },
            {
              "name": "Çift Gaga",
              "desc": "Geriye doğru da ateşler; -1 hasar"
            }
          ]
        },
        "Bekleme süresi 0,25 sn daha hızlı",
        "+3 hasar",
        {
          "fork": [
            {
              "name": "Şarapnel",
              "desc": "İsabette 2'ye ayrılır; +%10 alan, +4 hasar"
            },
            {
              "name": "Keskin Rüzgâr",
              "desc": "Zeminde hasar veren alan bırakır; +%25 alan"
            }
          ]
        },
        "+1 matkap ve +3 hasar"
      ]
    },
    "leafTornado": {
      "description": "Yapraklardan bir hortum ileri doğru süzülür, düşmanları içine çekip yavaşlatır, ardından bir yaprak çemberi şeklinde patlar.",
      "upgrades": [
        "+2 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Avcı Hortum",
              "desc": "Düşmanları takip eder; +0,3 sn süre"
            },
            {
              "name": "Fırtınanın Gözü",
              "desc": "Etrafında döner; +3 hasar"
            }
          ]
        },
        "+1 hortum",
        "+3 hasar",
        {
          "fork": [
            {
              "name": "Yeşil Patlama",
              "desc": "Bayılttığı düşmanlar patlar; +%20 alan"
            },
            {
              "name": "Kuru Yapraklar",
              "desc": "Zeminde hasar veren alan bırakır; +%20 alan"
            }
          ]
        },
        "+1 hortum ve +3 hasar"
      ]
    },
    "flameCharge": {
      "description": "Alevlere bürünerek yakındaki en kalabalık düşman grubunun üzerine atlar ve alev saçan bir patlamayla iner. Maksimum Canın ne kadar fazlaysa o kadar sert vurur. Yakabilir.",
      "upgrades": [
        "+5 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Ateş İzi",
              "desc": "Zeminde hasar veren alan bırakır; -0,3 sn bekleme süresi"
            },
            {
              "name": "Kıvılcımlar",
              "desc": "2 düşmana daha sıçrar; -0,4 sn bekleme süresi"
            }
          ]
        },
        "+6 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Meteor",
              "desc": "Bayılttığı düşmanlar patlar; -0,4 sn bekleme süresi"
            },
            {
              "name": "Can Veren Kor",
              "desc": "Vuruşları seni iyileştirir; -0,3 sn bekleme süresi"
            }
          ]
        },
        "+8 hasar ve +%15 alan"
      ]
    },
    "needleArm": {
      "description": "Dikenlerin kabarır: Her yöne iğneler uçar; 1,5 sn boyunca sana temas eden hiçbir düşman hasar veremez, bunun yerine hasar alıp geri savrulur.",
      "upgrades": [
        "+3 hasar",
        "+2 iğne",
        {
          "fork": [
            {
              "name": "Statik Dikenler",
              "desc": "2 düşmana daha sıçrar; +0,3 sn süre"
            },
            {
              "name": "Vampir Dikenler",
              "desc": "Vuruşları seni iyileştirir; +16 hasar"
            }
          ]
        },
        "Bekleme süresi 0,5 sn daha hızlı",
        "+4 hasar",
        {
          "fork": [
            {
              "name": "Kaktüs Bombası",
              "desc": "Bayılttığı düşmanlar patlar; +1 vuruş, -4 hasar"
            },
            {
              "name": "Çift Kabarma",
              "desc": "Anında tekrar kullanılır (%50); +1 vuruş, +8 hasar"
            }
          ]
        },
        "Diken süresi +0,4 sn ve +4 hasar"
      ]
    },
    "psybeam": {
      "description": "Renkli medyum halkalarından dalgalı bir ışın. Kafa karıştırabilir: Kafası karışan düşman hedefsizce dolaşır ve çarptığı diğer düşmanlara hasar verir.",
      "upgrades": [
        "+2 halka",
        "+3 hasar",
        {
          "fork": [
            {
              "name": "Çift Işın",
              "desc": "Geriye doğru da ateşler"
            },
            {
              "name": "Acımasız Zihin",
              "desc": "Durum etkisi altındaki düşmanlara ×1,35; +%6 durum ihtimali"
            }
          ]
        },
        "Bekleme süresi 0,25 sn daha hızlı",
        "+3 hasar ve +%20 alan",
        {
          "fork": [
            {
              "name": "Prizma",
              "desc": "İsabette 2'ye ayrılır; +1 vuruş"
            },
            {
              "name": "Medyum Aurası",
              "desc": "Etrafında döner; +1 vuruş"
            }
          ]
        },
        "+4 hasar ve +%6 kafa karıştırma ihtimali"
      ]
    },
    "darkestLariat": {
      "description": "Kollarını iki yana açıp 1,5 sn boyunca dönerek etrafındaki her şeyi biçer geçer. Kalkanları deler.",
      "upgrades": [
        "+3 hasar",
        "+%20 menzil",
        {
          "fork": [
            {
              "name": "Kement",
              "desc": "Düşmanları içine çeker; +0,3 sn süre"
            },
            {
              "name": "Karanlık Kucaklaşma",
              "desc": "Vuruşları seni iyileştirir; +0,4 sn süre"
            }
          ]
        },
        "Bekleme süresi 0,4 sn daha hızlı",
        "+4 hasar",
        {
          "fork": [
            {
              "name": "Dört Kol",
              "desc": "Daha geniş 2. bir kol çifti geriye döner; -2 hasar"
            },
            {
              "name": "Nakavt",
              "desc": "Canı ≤%12 olan düşmanları bitirir; +1 kol, +9 hasar"
            }
          ]
        },
        "+5 hasar ve +%15 menzil"
      ]
    },
    "sparklingAria": {
      "description": "Yavaş baloncuklar süzülür ve bir düşmana değdiğinde patlayarak etraftaki her şeye su sıçratır. Yakınında patlayan baloncuklar seni biraz iyileştirir.",
      "upgrades": [
        "+1 baloncuk",
        "+4 hasar",
        {
          "fork": [
            {
              "name": "Gelgit Havuzu",
              "desc": "Zeminde hasar veren su birikintileri bırakır; +4 hasar"
            },
            {
              "name": "Köpük Arkı",
              "desc": "2 düşmana daha sıçrar; +%20 alan"
            }
          ]
        },
        "Bekleme süresi 0,3 sn daha hızlı",
        "+2 baloncuk",
        {
          "fork": [
            {
              "name": "Baloncuk Bombası",
              "desc": "Bayılttığı düşmanlar patlar; +5 hasar"
            },
            {
              "name": "Bis",
              "desc": "Anında tekrar kullanılır (%50)"
            }
          ]
        },
        "+2 baloncuk ve +%15 alan"
      ]
    },
    "snipeShot": {
      "description": "Hedef göstergesi uzaktaki bir düşmana kilitlenir ve keskin bir atış düşmanı dümdüz delip geçer: Ne kadar uzağa uçarsa o kadar sert vurur. Kalkanları deler.",
      "upgrades": [
        "+5 hasar",
        "1 düşmanı daha delip geçer",
        {
          "fork": [
            {
              "name": "Büyük Av",
              "desc": "Elitlere ve bosslara karşı ×1,5; -0,2 sn bekleme süresi, +8 hasar"
            },
            {
              "name": "Parçalanan Atış",
              "desc": "İsabette 2'ye ayrılır; -0,3 sn bekleme süresi"
            }
          ]
        },
        "+6 hasar",
        "+1 atış",
        {
          "fork": [
            {
              "name": "Bağışlayıcı Atış",
              "desc": "Canı ≤%12 olan düşmanları bitirir; +1 delme, +13 hasar"
            },
            {
              "name": "Sıçrayan Atış",
              "desc": "2 düşmana daha sıçrar; +2 delme, -9 hasar"
            }
          ]
        },
        "+8 hasar"
      ]
    },
    "flowerTrick": {
      "description": "Hedefini kovalayan ve asla ıskalamayan bir çiçek fırlatır, çarptığında açar. Elitlere ve bosslara karşı ×1,5 vurur.",
      "upgrades": [
        "+1 çiçek",
        "+4 hasar",
        {
          "fork": [
            {
              "name": "Buket",
              "desc": "İsabette 2'ye ayrılır; -0,1 sn bekleme süresi"
            },
            {
              "name": "Bahçe",
              "desc": "Zeminde hasar veren alan bırakır; -0,2 sn bekleme süresi"
            }
          ]
        },
        "+1 çiçek",
        "+5 hasar",
        {
          "fork": [
            {
              "name": "Çiçek Patlaması",
              "desc": "Bayılttığı düşmanlar patlar; daha hızlı, -5 hasar"
            },
            {
              "name": "Ölümcül Çiçek",
              "desc": "Canı ≤%12 olan düşmanları bitirir; daha hızlı, +6 hasar"
            }
          ]
        },
        "+2 çiçek"
      ]
    },
    "aquaStep": {
      "description": "Bir dans adımı: Su sıçratarak ileriye doğru süzülürsün, kayarken dokunulmaz olursun. Art arda atılan her adım seni %3 hızlandırır (%15'e kadar).",
      "upgrades": [
        "+4 hasar",
        "+%20 menzil",
        {
          "fork": [
            {
              "name": "Su Birikintileri",
              "desc": "Zeminde hasar veren alan bırakır; -0,2 sn bekleme süresi"
            },
            {
              "name": "Can Veren Adım",
              "desc": "Vuruşları seni iyileştirir; -0,25 sn bekleme süresi"
            }
          ]
        },
        "+5 hasar",
        "+%20 menzil",
        {
          "fork": [
            {
              "name": "Zincirleme Sıçrama",
              "desc": "2 düşmana daha sıçrar; -0,25 sn bekleme süresi, +8 hasar"
            },
            {
              "name": "Son Dalga",
              "desc": "Bayılttığı düşmanlar patlar; -0,25 sn bekleme süresi"
            }
          ]
        },
        "+6 hasar ve +%20 menzil"
      ]
    },
    "ember": {
      "description": "En yakındaki düşmana köz fırlatır. Yakabilir.",
      "upgrades": [
        "+1 köz",
        "+4 hasar ve +%10 yanma ihtimali",
        {
          "fork": [
            {
              "name": "Güdümlü Alev",
              "desc": "Közler düşmanları takip eder; bekleme süresi %10 daha hızlı"
            },
            {
              "name": "Köz İzi",
              "desc": "Yanan zemin bırakır ama daha yavaş uçar"
            }
          ]
        },
        "+1 köz",
        "1 düşmanı daha delip geçer",
        {
          "fork": [
            {
              "name": "Parçalanma",
              "desc": "İsabette 2 köze ayrılır; +4 hasar"
            },
            {
              "name": "Çapraz Ateş",
              "desc": "Geriye doğru da ateşler; bekleme süresi %10 daha yavaş"
            }
          ]
        },
        "+1 köz ve +%25 alan"
      ]
    },
    "fireSpin": {
      "description": "Alevler etrafında döner. Yakabilir.",
      "upgrades": [
        "+1 alev",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Çift Çember",
              "desc": "Ters yönde dönen daha geniş 2. çember; -3 hasar"
            },
            {
              "name": "Ateş Çarkı",
              "desc": "Kavrulmuş zemin ve +4 hasar; daha yavaş döner"
            }
          ]
        },
        "Süre +0,6 sn",
        "+1 alev",
        {
          "fork": [
            {
              "name": "Parlama",
              "desc": "Alt edilen düşmanlar patlar; +5 hasar"
            },
            {
              "name": "Ateş Girdabı",
              "desc": "Hemen ardından tekrar döner (%50); daha sert yakar"
            }
          ]
        },
        "+1 alev ve daha hızlı döner"
      ]
    },
    "waterGun": {
      "description": "Hareket ettiğin yöndeki düşmanları delip geçen bir tazyikli su fışkırtır.",
      "upgrades": [
        "+1 su tazyiki",
        "+3 hasar",
        {
          "fork": [
            {
              "name": "Çift Tazyik",
              "desc": "Geriye doğru da püskürtür; -1 hasar"
            },
            {
              "name": "Güdümlü Tazyik",
              "desc": "Düşmanı takip eder ve 1 düşmanı daha delip geçer; daha yavaş"
            }
          ]
        },
        "Bekleme süresi 0,1 sn daha hızlı",
        "+1 su tazyiki",
        {
          "fork": [
            {
              "name": "Sıçrama",
              "desc": "2 düşmana daha seker; +4 hasar"
            },
            {
              "name": "Dip Akıntısı",
              "desc": "Geri dönüp tekrar vurur; %15 daha yavaş"
            }
          ]
        },
        "+1 su tazyiki ve 2 düşmanı daha delip geçer"
      ]
    },
    "whirlpool": {
      "description": "Yaklaşan herkesi yavaşlatan ve hasar veren sürekli bir girdap.",
      "upgrades": [
        "+%20 alan",
        "+2 hasar",
        {
          "fork": [
            {
              "name": "Acımasız Akıntı",
              "desc": "Durum etkisi altındaki düşmanlara ×1,35; -0,04 sn bekleme süresi"
            },
            {
              "name": "Memba",
              "desc": "Vuruşları seni iyileştirir; -0,08 sn bekleme süresi"
            }
          ]
        },
        "+%20 alan",
        "+3 hasar",
        {
          "fork": [
            {
              "name": "Çeken Akıntı",
              "desc": "2 düşmana daha sıçrar; -0,08 sn bekleme süresi"
            },
            {
              "name": "Dip Anaforu",
              "desc": "Canı ≤%12 olan düşmanları bitirir; -0,08 sn bekleme süresi"
            }
          ]
        },
        "+%25 alan ve +3 hasar"
      ]
    },
    "razorLeaf": {
      "description": "Keskin yapraklar bumerang gibi fırlayıp geri döner. Zehirleyebilir.",
      "upgrades": [
        "+1 yaprak",
        "+4 hasar",
        {
          "fork": [
            {
              "name": "Çift Yaprak",
              "desc": "Geriye doğru da fırlatır; -2 hasar"
            },
            {
              "name": "Bora",
              "desc": "Hemen ardından tekrar fırlatır (%50); +%20 alan"
            }
          ]
        },
        "+1 yaprak",
        "Yapraklar %25 daha hızlı",
        {
          "fork": [
            {
              "name": "Böğürtlen Çalısı",
              "desc": "Zemine zehirli dikenler bırakır; +%25 zehir"
            },
            {
              "name": "Yaprak Patlaması",
              "desc": "Alt edilen düşmanlar patlar; +5 hasar"
            }
          ]
        },
        "+1 yaprak"
      ]
    },
    "vineWhip": {
      "description": "Sarmaşıkların geniş menzilli yatay bir kırbaç darbesi. Zehirleyebilir.",
      "upgrades": [
        "Arkaya da vurur",
        "+5 hasar",
        {
          "fork": [
            {
              "name": "Kökler",
              "desc": "Zeminde hasar veren alan bırakır; +%10 alan"
            },
            {
              "name": "Zincirleme Kırbaç",
              "desc": "2 düşmana daha sıçrar; +%20 alan"
            }
          ]
        },
        "Bekleme süresi 0,15 sn daha hızlı",
        "+6 hasar",
        {
          "fork": [
            {
              "name": "Diken Patlaması",
              "desc": "Bayılttığı düşmanlar patlar; +%20 alan"
            },
            {
              "name": "Vampir Kırbaç",
              "desc": "Vuruşları seni iyileştirir; +%10 alan"
            }
          ]
        },
        "+8 hasar"
      ]
    },
    "swift": {
      "description": "Asla ıskalamayan güdümlü yıldızlar.",
      "upgrades": [
        "+1 yıldız",
        "+3 hasar",
        {
          "fork": [
            {
              "name": "Kayan Yıldızlar",
              "desc": "2 düşmana daha seker; +6 hasar"
            },
            {
              "name": "Takımyıldız",
              "desc": "+1 yıldız ve +2 hasar; etrafında dönerler"
            }
          ]
        },
        "+1 yıldız",
        "1 düşmanı daha delip geçer",
        {
          "fork": [
            {
              "name": "Kuyruklu Yıldız",
              "desc": "Alt ettikleri düşmanlar yıldız saçarak patlar; +5 hasar"
            },
            {
              "name": "Yıldız Yağmuru",
              "desc": "Hemen ardından tekrar kullanılır (%50); %12 daha hızlı"
            }
          ]
        },
        "+2 yıldız"
      ]
    },
    "thunder": {
      "description": "Ekrandaki rastgele düşmanların üzerine yıldırımlar düşer. Felç edebilir.",
      "upgrades": [
        "+1 yıldırım",
        "+8 hasar",
        {
          "fork": [
            {
              "name": "Fırtına",
              "desc": "+2 daha küçük yıldırım ve bir yankı (%50); -6 hasar"
            },
            {
              "name": "Odaklanmış Yıldırım",
              "desc": "1 devasa yıldırım, +34 hasar, 2 düşmana sıçrar"
            }
          ]
        },
        "+1 yıldırım",
        "Bekleme süresi 0,3 sn daha hızlı",
        {
          "fork": [
            {
              "name": "Paratoner",
              "desc": "Alt edilen düşmanlar elektrik saçar; +10 hasar"
            },
            {
              "name": "Yüklü Zemin",
              "desc": "Elektrik yüklü zemin bırakır; +%15 felç ihtimali"
            }
          ]
        },
        "+2 yıldırım"
      ]
    },
    "sludgeBomb": {
      "description": "Zehir birikintisi bırakan zehirli bir balçık fırlatır. Zehir etkisi katlanır.",
      "upgrades": [
        "+1 bomba",
        "+2 hasar ve %25 daha güçlü zehir",
        {
          "fork": [
            {
              "name": "Bataklık",
              "desc": "Düşmanları içine çeker; +0,3 sn süre"
            },
            {
              "name": "Zehir Yağmuru",
              "desc": "Anında tekrar kullanılır (%50)"
            }
          ]
        },
        "+%20 alan",
        "+1 bomba",
        {
          "fork": [
            {
              "name": "Aşınma",
              "desc": "Durum etkisi altındaki düşmanlara ×1,35; +1 hasar"
            },
            {
              "name": "Bulaşma",
              "desc": "Bayılan düşmanlar etrafa zehir saçarak patlar; +3 hasar"
            }
          ]
        },
        "+1 bomba ve +%20 alan"
      ]
    },
    "dreamEater": {
      "description": "Bir Hypnosis dalgası etrafındaki düşmanları uyutur ve hayaletimsi çeneler önce uyuyanları ısırır: Uyuyan düşmana ×3 hasar verir (düşman uyanır) ve ısırık sana Can kazandırır.",
      "upgrades": [
        "+1 ısırık",
        "+4 hasar",
        {
          "fork": [
            {
              "name": "Kabus",
              "desc": "2 düşmana daha sıçrar; +%10 alan"
            },
            {
              "name": "Ziyafet",
              "desc": "Vuruşları seni iyileştirir; +%20 alan"
            }
          ]
        },
        "+%15 uyutma ihtimali",
        "Bekleme süresi 0,3 sn daha hızlı",
        {
          "fork": [
            {
              "name": "Rüya Patlaması",
              "desc": "Bayılttığı düşmanlar patlar"
            },
            {
              "name": "Yutucu",
              "desc": "Elitlere ve bosslara karşı ×1,5; +11 hasar"
            }
          ]
        },
        "+2 ısırık"
      ]
    },
    "forcePalm": {
      "description": "En yakındaki düşmana felç edebilen bir aura avuç darbesi indirir. Zaten felç olmuş bir düşmanda aura doğrudan içinden geçip arkasında bir dalga halinde patlar.",
      "upgrades": [
        "+5 hasar",
        "+%15 felç ihtimali",
        {
          "fork": [
            {
              "name": "Zincirleme Şok",
              "desc": "2 düşmana daha sıçrar; +%10 alan"
            },
            {
              "name": "Çift Avuç",
              "desc": "Anında tekrar kullanılır (%50); +%20 alan"
            }
          ]
        },
        "Bekleme süresi 0,2 sn daha hızlı",
        "+1 avuç darbesi",
        {
          "fork": [
            {
              "name": "Hayati Darbe",
              "desc": "Canı ≤%12 olan düşmanları bitirir; +16 hasar"
            },
            {
              "name": "Aura Dalgası",
              "desc": "Bayılttığı düşmanlar patlar; +6 hasar"
            }
          ]
        },
        "+%25 alan ve +%10 felç ihtimali"
      ]
    },
    "dig": {
      "description": "Shift tuşuna veya atılma düğmesine bas: Yerin altına girersin (dokunulmaz olursun, sürü seni kaybeder) ve yakındaki en büyük düşmanın, öncelikle bir boss'un altından bir depremle çıkarsın.",
      "upgrades": [
        "+10 hasar",
        "%20 daha büyük deprem",
        {
          "fork": [
            {
              "name": "Yarıntı",
              "desc": "Zeminde hasar veren alan bırakır; -0,4 sn bekleme süresi"
            },
            {
              "name": "Pusu",
              "desc": "Elitlere ve bosslara karşı ×1,5; -0,5 sn bekleme süresi"
            }
          ]
        },
        "+12 hasar",
        "Yerin altında +0,3 sn",
        {
          "fork": [
            {
              "name": "Göçük",
              "desc": "Bayılttığı düşmanlar patlar; -0,5 sn bekleme süresi"
            },
            {
              "name": "Tuzak Çukuru",
              "desc": "Canı ≤%12 olan düşmanları bitirir; -0,5 sn bekleme süresi, +18 hasar"
            }
          ]
        },
        "+14 hasar ve %25 daha büyük deprem"
      ]
    },
    "twister": {
      "description": "Ejderha hortumları etrafında dolaşarak değdikleri düşmanları rüzgârın merkezine çeker.",
      "upgrades": [
        "+2 hasar",
        "Süre +1 sn",
        {
          "fork": [
            {
              "name": "Rüzgâr İzi",
              "desc": "Zeminde hasar veren alan bırakır; +1 hortum, -1 hasar"
            },
            {
              "name": "Değirmen",
              "desc": "Canı ≤%12 olan düşmanları bitirir; +1 hortum"
            }
          ]
        },
        "%20 daha büyük hortumlar",
        "+3 hasar",
        {
          "fork": [
            {
              "name": "Su Hortumu",
              "desc": "Bayılttığı düşmanlar patlar; -0,5 sn bekleme süresi"
            },
            {
              "name": "Fırtına",
              "desc": "Anında tekrar kullanılır (%50); -0,2 sn bekleme süresi"
            }
          ]
        },
        "+1 hortum ve %15 daha büyük"
      ]
    },
    "sandTomb": {
      "description": "Etrafında bir kum girdabı döner: İçine yakalanan düşmanları yıpratıp yavaşlatır, gözlerine kaçan kum ise temas vuruşlarının yarısını ıskalamalarına neden olur.",
      "upgrades": [
        "+2 hasar",
        "%20 daha büyük girdap",
        {
          "fork": [
            {
              "name": "Can Veren Kumlar",
              "desc": "Vuruşları seni iyileştirir; +0,5 sn süre"
            },
            {
              "name": "Acımasız Mezar",
              "desc": "Durum etkisi altındaki düşmanlara ×1,35; +1 sn süre"
            }
          ]
        },
        "Bekleme süresi 0,8 sn daha hızlı",
        "+3 hasar",
        {
          "fork": [
            {
              "name": "Gömme",
              "desc": "Bayılttığı düşmanlar patlar; +%20 alan"
            },
            {
              "name": "Kum Saati",
              "desc": "Canı ≤%12 olan düşmanları bitirir; +%10 alan, +4 hasar"
            }
          ]
        },
        "Süre +1,5 sn ve +2 hasar"
      ]
    },
    "meteorMash": {
      "description": "En yakındaki düşmanların üzerine meteor yumrukları yağar. İsabet eden her vuruş hasar alana dek sonraki vuruşları güçlendirir (+%6, en fazla +%60).",
      "upgrades": [
        "+1 meteor",
        "+5 hasar",
        {
          "fork": [
            {
              "name": "Çelik Parçacıkları",
              "desc": "2 düşmana daha sıçrar; +%10 alan, +13 hasar"
            },
            {
              "name": "Krater",
              "desc": "Zeminde hasar veren alan bırakır; +%20 alan"
            }
          ]
        },
        "Bekleme süresi 0,25 sn daha hızlı",
        "+6 hasar",
        {
          "fork": [
            {
              "name": "Çarpma",
              "desc": "Bayılttığı düşmanlar patlar; +1 meteor"
            },
            {
              "name": "Meteor Yağmuru",
              "desc": "Anında tekrar kullanılır (%50); +5 hasar"
            }
          ]
        },
        "+6 hasar ve +%20 alan"
      ]
    },
    "zenHeadbutt": {
      "description": "Doğrudan önündeki düşmana kafa üstü kısa bir medyum sıçrayışı yapar: Çarptığı düşman irkilip yarım saniye boyunca hareketsiz kalır.",
      "upgrades": [
        "+5 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Zihin Dalgası",
              "desc": "2 düşmana daha sıçrar; -0,15 sn bekleme süresi"
            },
            {
              "name": "Meditasyon",
              "desc": "Vuruşları seni iyileştirir; -0,2 sn bekleme süresi"
            }
          ]
        },
        "+6 hasar",
        "Daha fazla geri itme ve +%15 alan",
        {
          "fork": [
            {
              "name": "Sismik Kafa",
              "desc": "Bayılttığı düşmanlar patlar; -0,2 sn bekleme süresi"
            },
            {
              "name": "Aydınlanma",
              "desc": "Canı ≤%12 olan düşmanları bitirir; -0,15 sn bekleme süresi, +13 hasar"
            }
          ]
        },
        "+8 hasar"
      ]
    },
    "foulPlay": {
      "description": "İllüzyon pençeleri yakındaki en sert vuran düşmanı biçer: Düşman ne kadar çok temas hasarı veriyorsa darbe o kadar sert vurur (en fazla ×5). Bosslara karşı harikadır.",
      "upgrades": [
        "+4 hasar",
        "+1 hedef",
        {
          "fork": [
            {
              "name": "İhanet",
              "desc": "Elitlere ve bosslara karşı ×1,5; -0,1 sn bekleme süresi"
            },
            {
              "name": "Zincirleme Pençeler",
              "desc": "2 düşmana daha sıçrar; -0,25 sn bekleme süresi"
            }
          ]
        },
        "+5 hasar",
        "%25 daha uzun menzil",
        {
          "fork": [
            {
              "name": "Alçak Vuruş",
              "desc": "Canı ≤%12 olan düşmanları bitirir; +1 hedef, +14 hasar"
            },
            {
              "name": "Kapan",
              "desc": "Bayılttığı düşmanlar patlar; +1 hedef, -9 hasar"
            }
          ]
        },
        "+6 hasar"
      ]
    },
    "bodySlam": {
      "description": "Shift tuşuna veya atılma düğmesine bas: Yakındaki en kalabalık düşman grubunun üzerine ağır bir sıçrayış yapar. İniş anında felç edebilen bir şok dalgası yayar.",
      "upgrades": [
        "+6 hasar",
        "%20 daha büyük şok dalgası",
        {
          "fork": [
            {
              "name": "Sarsıntı",
              "desc": "Zeminde hasar veren alan bırakır; -0,3 sn bekleme süresi"
            },
            {
              "name": "Yer Çekimi",
              "desc": "İniş kalabalığı içine çeker; -0,4 sn bekleme süresi"
            }
          ]
        },
        "+%15 felç ihtimali",
        "+8 hasar",
        {
          "fork": [
            {
              "name": "Ağır Sıklet",
              "desc": "Bayılttığı düşmanlar patlar; -0,4 sn bekleme süresi"
            },
            {
              "name": "Statik Çarpma",
              "desc": "2 düşmana daha sıçrar; -0,4 sn bekleme süresi"
            }
          ]
        },
        "+10 hasar ve %25 daha büyük şok dalgası"
      ]
    },
    "dynamicPunch": {
      "description": "En yakındaki düşmana yavaş ve devasa bir yumruk savurur. Patlama, çarptığı düşmanları şaşkına çevirip kafalarını karıştırır: Sendeleyip birbirlerine çarparlar.",
      "upgrades": [
        "+10 hasar",
        "%20 daha büyük patlama",
        {
          "fork": [
            {
              "name": "Zincirleme Yumruk",
              "desc": "2 düşmana daha sıçrar; -0,3 sn bekleme süresi, +10 hasar"
            },
            {
              "name": "Çatlak Zemin",
              "desc": "Zeminde hasar veren alan bırakır; -0,4 sn bekleme süresi"
            }
          ]
        },
        "+12 hasar",
        "%20 daha büyük patlama",
        {
          "fork": [
            {
              "name": "Dinamit",
              "desc": "Bayılttığı düşmanlar patlar; -0,4 sn bekleme süresi, -13 hasar"
            },
            {
              "name": "Şampiyon",
              "desc": "Elitlere ve bosslara karşı ×1,5; -0,3 sn bekleme süresi, +28 hasar"
            }
          ]
        },
        "+16 hasar"
      ]
    },
    "rollout": {
      "description": "2 sn boyunca yuvarlanırsın (yön çubuğuyla yönlendirilir). Art arda gelen her vuruş sonrakini ikiye katlar (en fazla ×5).",
      "upgrades": [
        "+2 hasar",
        "Yuvarlanma süresi +0,5 sn",
        {
          "fork": [
            {
              "name": "Yüklü Kaya",
              "desc": "2 düşmana daha sıçrar; -0,5 sn bekleme süresi"
            },
            {
              "name": "Can Veren Yuvarlanma",
              "desc": "Vuruşları seni iyileştirir; -0,6 sn bekleme süresi, +3 hasar"
            }
          ]
        },
        "+2 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Çığ",
              "desc": "Bayılttığı düşmanlar patlar; +0,5 sn süre"
            },
            {
              "name": "Silindir",
              "desc": "Elitlere ve bosslara karşı ×1,5; +0,3 sn süre, +16 hasar"
            }
          ]
        },
        "+3 hasar ve bekleme süresi 0,5 sn daha hızlı"
      ]
    },
    "iceBall": {
      "description": "Kartopları sürünün arasından yuvarlanarak değdikleri her şeyi yavaşlatır. Her vuruş sonrakini ikiye katlar (en fazla ×5) ve topu büyütür; en büyük boyuta ulaştığında dondurur.",
      "upgrades": [
        "+3 hasar",
        "+1 top",
        {
          "fork": [
            {
              "name": "Buz İzi",
              "desc": "Zeminde hasar veren alan bırakır; daha hızlı"
            },
            {
              "name": "Dolu Arkı",
              "desc": "2 düşmana daha sıçrar; +6 hasar"
            }
          ]
        },
        "Bekleme süresi 0,2 sn daha hızlı",
        "+4 hasar",
        {
          "fork": [
            {
              "name": "Kar Kayması",
              "desc": "Bayılttığı düşmanlar patlar; +%20 alan"
            },
            {
              "name": "Kırma",
              "desc": "Canı ≤%12 olan düşmanları bitirir; +%10 alan"
            }
          ]
        },
        "+1 top"
      ]
    },
    "furyCutter": {
      "description": "En yakındaki düşmana tırpanla bir darbe indirir. İsabet eden her darbe sonrakini güçlendirir (en fazla ×4); boşluğa savrulan darbe seriyi sıfırlar.",
      "upgrades": [
        "+2 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Zincirleme Kesik",
              "desc": "2 düşmana daha sıçrar; -0,05 sn bekleme süresi"
            },
            {
              "name": "Vampir Tırpanı",
              "desc": "Vuruşları seni iyileştirir; -0,1 sn bekleme süresi"
            }
          ]
        },
        "+3 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Biçme",
              "desc": "Canı ≤%12 olan düşmanları bitirir; -0,1 sn bekleme süresi"
            },
            {
              "name": "Patlama Kesiği",
              "desc": "Bayılttığı düşmanlar patlar; -0,1 sn bekleme süresi"
            }
          ]
        },
        "+4 hasar"
      ]
    },
    "sacredSword": {
      "description": "Hayalet bir kılıç önündeki kavisi biçer. Bronzong kalkanlarını kesip geçer ve tip dirençlerini yok sayar.",
      "upgrades": [
        "+5 hasar",
        "%20 daha büyük kılıç",
        {
          "fork": [
            {
              "name": "Kutsal İz",
              "desc": "Zeminde hasar veren alan bırakır; -0,2 sn bekleme süresi"
            },
            {
              "name": "Ejderha Avcısı",
              "desc": "Elitlere ve bosslara karşı ×1,5; -0,25 sn bekleme süresi, +7 hasar"
            }
          ]
        },
        "+6 hasar",
        "%20 daha büyük kılıç",
        {
          "fork": [
            {
              "name": "Çift Biçme",
              "desc": "Anında tekrar kullanılır (%50); +6 hasar"
            },
            {
              "name": "Yargı",
              "desc": "Bayılttığı düşmanlar patlar; +1 savurma"
            }
          ]
        },
        "+7 hasar"
      ]
    },
    "dragonDarts": {
      "description": "İki güdümlü ok: Yakında iki düşman varsa her birine birer ok, sadece bir düşman varsa ikisi birden ona fırlar.",
      "upgrades": [
        "+3 hasar",
        "Daha hızlı oklar",
        {
          "fork": [
            {
              "name": "Çift Ok",
              "desc": "İsabette 2'ye ayrılır; -0,1 sn bekleme süresi, +16 hasar"
            },
            {
              "name": "Muhafız",
              "desc": "Etrafında döner; -0,15 sn bekleme süresi, -7 hasar"
            }
          ]
        },
        "+4 hasar",
        "+2 ok",
        {
          "fork": [
            {
              "name": "Sıçrama",
              "desc": "2 düşmana daha seker; +3 hasar"
            },
            {
              "name": "Boss Avcısı",
              "desc": "Elitlere ve bosslara karşı ×1,5; +16 hasar"
            }
          ]
        },
        "Bekleme süresi 0,2 sn daha hızlı ve +3 hasar"
      ]
    },
    "snarl": {
      "description": "Üç kafa, üç zincirleme dalga: Her biri bir öncekinin vurduğu yerden bir sonraki düşmana sıçrar, her defasında biraz daha büyür ve güçlenir.",
      "upgrades": [
        "+3 hasar",
        "%20 daha büyük dalgalar",
        {
          "fork": [
            {
              "name": "Zincirleme Hırlama",
              "desc": "2 düşmana daha sıçrar; -0,15 sn bekleme süresi"
            },
            {
              "name": "Açlık",
              "desc": "Vuruşları seni iyileştirir; -0,25 sn bekleme süresi"
            }
          ]
        },
        "+4 hasar",
        "+1 dalga",
        {
          "fork": [
            {
              "name": "Sürü Patlaması",
              "desc": "Bayılttığı düşmanlar patlar; +%20 alan"
            },
            {
              "name": "Yırtıcı",
              "desc": "Canı ≤%12 olan düşmanları bitirir; +%10 alan"
            }
          ]
        },
        "+5 hasar ve +1 dalga"
      ]
    },
    "gigaImpact": {
      "description": "Shift tuşuna veya atılma düğmesine bas: Muazzam bir darbeyle ileri atılırsın. Ardından nefesini toparlarken 1 sn boyunca yürüyemezsin.",
      "upgrades": [
        "+10 hasar",
        "%20 daha büyük çarpma alanı",
        {
          "fork": [
            {
              "name": "Çöküş",
              "desc": "Düşmanları içine çeker; -0,6 sn bekleme süresi, +10 hasar"
            },
            {
              "name": "Şok Dalgası",
              "desc": "2 düşmana daha sıçrar; -0,8 sn bekleme süresi"
            }
          ]
        },
        "+14 hasar",
        "Nefesini 0,25 sn daha çabuk toplar",
        {
          "fork": [
            {
              "name": "Afet",
              "desc": "Bayılttığı düşmanlar patlar; -0,8 sn bekleme süresi"
            },
            {
              "name": "Titan",
              "desc": "Elitlere ve bosslara karşı ×1,5; -0,6 sn bekleme süresi, +15 hasar"
            }
          ]
        },
        "+18 hasar ve %25 daha büyük çarpma alanı"
      ]
    },
    "flail": {
      "description": "Her yöne çaresizce kuyruk darbeleri indirir. Canın ne kadar düşükse darbeler o kadar sert (en fazla ×3) ve o kadar çok olur.",
      "upgrades": [
        "+3 hasar",
        "+1 kuyruk darbesi",
        {
          "fork": [
            {
              "name": "İkinci Nefes",
              "desc": "Vuruşları seni iyileştirir; +%10 alan"
            },
            {
              "name": "Kırbaç Arkı",
              "desc": "2 düşmana daha sıçrar; +%20 alan"
            }
          ]
        },
        "Bekleme süresi 0,15 sn daha hızlı",
        "+4 hasar",
        {
          "fork": [
            {
              "name": "Çaresizlik",
              "desc": "Bayılttığı düşmanlar patlar; +1 kuyruk darbesi"
            },
            {
              "name": "Son Direniş",
              "desc": "Canı ≤%12 olan düşmanları bitirir; +1 kuyruk darbesi, +4 hasar"
            }
          ]
        },
        "+5 hasar ve +%15 alan"
      ]
    },
    "boneRush": {
      "description": "En yakındaki düşmana kemik sopayla kombo yapar: 2 ila 5 savuruş ve son vuruş düşmanı uzağa fırlatır.",
      "upgrades": [
        "+3 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Kemik Arkı",
              "desc": "2 düşmana daha sıçrar; -0,1 sn bekleme süresi"
            },
            {
              "name": "Kemiklik",
              "desc": "Zeminde hasar veren alan bırakır; -0,2 sn bekleme süresi"
            }
          ]
        },
        "+1 savuruş",
        "+4 hasar",
        {
          "fork": [
            {
              "name": "Kemik Patlaması",
              "desc": "Bayılttığı düşmanlar patlar; +%20 alan"
            },
            {
              "name": "Ağır Sopa",
              "desc": "Elitlere ve bosslara karşı ×1,5; +%10 alan"
            }
          ]
        },
        "+1 savuruş ve +4 hasar"
      ]
    },
    "metronome": {
      "description": "Parmağını sallar ve rastgele bir saldırı kullanır: Ember'dan Earthquake'e kadar her şey olabilir ve ara sıra Blizzard veya Hydro Pump gibi evrimleşmiş bir saldırı bile gelebilir.",
      "upgrades": [
        "+%10 güç",
        "Bekleme süresi 0,2 sn daha hızlı",
        {
          "fork": [
            {
              "name": "Bis",
              "desc": "Hemen ardından tekrar sallar (%50)"
            },
            {
              "name": "Kıvılcım",
              "desc": "2 düşmana daha sıçrar; +4 hasar"
            }
          ]
        },
        "Bekleme süresi 0,2 sn daha hızlı",
        "+%15 güç",
        {
          "fork": [
            {
              "name": "Sürpriz",
              "desc": "Bayılttığı düşmanlar patlar; -0,2 sn bekleme süresi"
            },
            {
              "name": "Kaos",
              "desc": "Zeminde hasar veren alan bırakır; -0,2 sn bekleme süresi"
            }
          ]
        },
        "+%15 güç"
      ]
    },
    "echoedVoice": {
      "description": "Art arda her kullanımda büyüyen ses dalgaları yayar: Daha büyük, daha güçlü ve daha fazla yankılı (5 defaya kadar). Hasar almak yankıyı sıfırlar.",
      "upgrades": [
        "+3 hasar",
        "%20 daha büyük dalgalar",
        {
          "fork": [
            {
              "name": "Yankılanma",
              "desc": "Anında tekrar kullanılır (%50); -4 hasar"
            },
            {
              "name": "Akustik Yankı",
              "desc": "2 düşmana daha sıçrar; -0,2 sn bekleme süresi, +4 hasar"
            }
          ]
        },
        "+3 hasar",
        "%20 daha büyük dalgalar",
        {
          "fork": [
            {
              "name": "Gürleme",
              "desc": "Bayılttığı düşmanlar patlar; -0,2 sn bekleme süresi"
            },
            {
              "name": "Son Çığlık",
              "desc": "Canı ≤%12 olan düşmanları bitirir; -0,2 sn bekleme süresi"
            }
          ]
        },
        "+4 hasar"
      ]
    },
    "sketch": {
      "description": "Fırça kuyruğu en yakındaki düşmandan bir saldırı kopyalar (öncelikle menzildeki bir boss'tan): Kendi tipinden bir saldırı, boss'tan ise daha güçlü bir saldırı alır. Çizilen saldırıyı 3 kez kullanır, sonra yeniden çizer. Yakında kimse yoksa hafızasından çizer.",
      "upgrades": [
        "+%10 güç",
        "Bekleme süresi 0,2 sn daha hızlı",
        {
          "fork": [
            {
              "name": "Rötuş",
              "desc": "Anında tekrar çizer (%50); +%20 menzil"
            },
            {
              "name": "Boya Sıçraması",
              "desc": "2 düşmana daha sıçrar; +4 hasar"
            }
          ]
        },
        "Bekleme süresi 0,2 sn daha hızlı",
        "+%15 güç",
        {
          "fork": [
            {
              "name": "Başyapıt",
              "desc": "Bayılttığı düşmanlar patlar; -0,2 sn bekleme süresi"
            },
            {
              "name": "Portre",
              "desc": "Elitlerde ve bosslarda ×1,5; -0,2 sn bekleme süresi"
            }
          ]
        },
        "+%15 güç"
      ]
    },
    "curse": {
      "description": "Görüş alanındaki en güçlü düşmanı (öncelikle bir boss'u) lanetlemek için mevcut Canının %15'ini feda eder: Düşman kalkan ve dirençleri yok sayarak 6 sn boyunca saniyede maksimum Canının %1,2'sini kaybeder. Canın %25'in altındayken beklemede kalır.",
      "upgrades": [
        "Saniyede maksimum Canın +%0,3'ü",
        "Süre +2 sn",
        {
          "fork": [
            {
              "name": "Ahit",
              "desc": "Lanet sana Can kazandırır; -0,8 sn bekleme süresi"
            },
            {
              "name": "Veba",
              "desc": "Elitlere ve bosslara karşı ×1,5; -1 sn bekleme süresi"
            }
          ]
        },
        "Saniyede maksimum Canın +%0,3'ü",
        "+1 lanetli düşman",
        {
          "fork": [
            {
              "name": "Musallat",
              "desc": "Bayılttığı düşmanlar patlar; -1 sn bekleme süresi"
            },
            {
              "name": "Hüküm",
              "desc": "Canı ≤%12 olan düşmanları bitirir; -0,8 sn bekleme süresi"
            }
          ]
        },
        "Saniyede maksimum Canın +%0,4'ü"
      ]
    },
    "gust": {
      "description": "Herkesi uzağa savuran dairesel bir rüzgâr dalgası.",
      "upgrades": [
        "+3 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Can Veren Esinti",
              "desc": "Vuruşları seni iyileştirir; -0,3 sn bekleme süresi"
            },
            {
              "name": "Çift Rüzgâr",
              "desc": "Anında tekrar kullanılır (%50); -0,1 sn bekleme süresi"
            }
          ]
        },
        "+1 rüzgâr",
        "+4 hasar",
        {
          "fork": [
            {
              "name": "Bora",
              "desc": "Bayılttığı düşmanlar patlar; +%30 alan"
            },
            {
              "name": "Statik Rüzgâr",
              "desc": "2 düşmana daha sıçrar; +%20 alan"
            }
          ]
        },
        "+1 rüzgâr"
      ]
    },
    "machPunch": {
      "description": "En yakındaki düşmana hızlı yumruk kombosu yapar; son vuruş ileriye doğru bir şok dalgası fırlatır. Yürürken bekleme süresi daha hızlı dolar.",
      "upgrades": [
        "+1 yumruk",
        "+3 hasar",
        {
          "fork": [
            {
              "name": "Zincirleme Direk",
              "desc": "2 düşmana daha sıçrar; +%10 alan"
            },
            {
              "name": "Can Veren Direk",
              "desc": "Vuruşları seni iyileştirir; +%20 alan"
            }
          ]
        },
        "+1 yumruk",
        "Bekleme süresi 0,2 sn daha hızlı",
        {
          "fork": [
            {
              "name": "Nakavt",
              "desc": "Canı ≤%12 olan düşmanları bitirir; +6 hasar"
            },
            {
              "name": "Sonik Patlama",
              "desc": "Bayılttığı düşmanlar patlar; +5 hasar"
            }
          ]
        },
        "+2 yumruk"
      ]
    },
    "flashCannon": {
      "description": "Düz bir hat üzerindeki her şeyi delip geçen çelik bir küre.",
      "upgrades": [
        "+6 hasar",
        "+%25 alan",
        {
          "fork": [
            {
              "name": "Prizma",
              "desc": "İsabette 2'ye ayrılır; -0,2 sn bekleme süresi"
            },
            {
              "name": "Yansıtıcı",
              "desc": "Gidip geri döner; -0,1 sn bekleme süresi"
            }
          ]
        },
        "+1 küre",
        "+8 hasar",
        {
          "fork": [
            {
              "name": "Çift Top",
              "desc": "Geriye doğru da ateşler; +%10 alan"
            },
            {
              "name": "Zırh Delici",
              "desc": "Elitlere ve bosslara karşı ×1,5; +%25 alan"
            }
          ]
        },
        "+1 küre"
      ]
    },
    "spiritShackle": {
      "description": "Düşmanları delip geçen ve onları bir anlığına kendi gölgelerine sabitleyen hayalet oklardan bir yelpaze.",
      "upgrades": [
        "+1 ok",
        "+3 hasar",
        {
          "fork": [
            {
              "name": "Güdümlü Oklar",
              "desc": "Düşmanları takip eder; 1 düşmanı daha delip geçer"
            },
            {
              "name": "Çapraz Ateş",
              "desc": "Geriye doğru da ateşler"
            }
          ]
        },
        "+1 ok",
        "Bekleme süresi 0,2 sn daha hızlı",
        {
          "fork": [
            {
              "name": "Sıçrama",
              "desc": "2 düşmana daha seker; +1 hasar"
            },
            {
              "name": "Acımasız Pranga",
              "desc": "Durum etkisi altındaki düşmanlara ×1,35; +6 hasar"
            }
          ]
        },
        "+2 ok"
      ]
    },
    "waterShuriken": {
      "description": "Biçtiği her düşmanla daha da büyüyüp güçlenen güdümlü su shurikenleri.",
      "upgrades": [
        "+1 shuriken",
        "+2 hasar",
        {
          "fork": [
            {
              "name": "Sıçrama",
              "desc": "2 düşmana daha seker; -0,08 sn bekleme süresi, +6 hasar"
            },
            {
              "name": "Su İzi",
              "desc": "Zeminde hasar veren alan bırakır; -0,12 sn bekleme süresi, +7 hasar"
            }
          ]
        },
        "+1 shuriken",
        "+3 hasar",
        {
          "fork": [
            {
              "name": "Çift Yıldız",
              "desc": "İsabette 2'ye ayrılır; daha hızlı"
            },
            {
              "name": "Son Kesik",
              "desc": "Canı ≤%12 olan düşmanları bitirir; daha hızlı, +2 hasar"
            }
          ]
        },
        "+2 shuriken"
      ]
    },
    "crunch": {
      "description": "En yakındaki düşmanlara güçlü bir ısırık darbesi.",
      "upgrades": [
        "+6 hasar",
        "+1 ısırık",
        {
          "fork": [
            {
              "name": "Zincirleme Isırık",
              "desc": "Yakındaki 2 düşmana sıçrar; -3 hasar"
            },
            {
              "name": "Çift Isırık",
              "desc": "Hemen ardından tekrar ısırır (%50); +%15 alan"
            }
          ]
        },
        "Bekleme süresi 0,2 sn daha hızlı",
        "+1 ısırık",
        {
          "fork": [
            {
              "name": "Aç Dişler",
              "desc": "Alt edilen düşmanlar gölge saçarak patlar; +8 hasar"
            },
            {
              "name": "Gölge Isırığı",
              "desc": "Zeminde hasar veren gölge bırakır; +%20 alan"
            }
          ]
        },
        "+1 ısırık ve +%20 alan"
      ]
    },
    "pyroBall": {
      "description": "İndiğinde patlayan ve en yakındaki düşmana seken bir ateş topu fırlatır.",
      "upgrades": [
        "+1 top",
        "+6 hasar",
        {
          "fork": [
            {
              "name": "Közler",
              "desc": "Zeminde hasar veren alan bırakır; +%15 alan"
            },
            {
              "name": "Kıvılcım Topu",
              "desc": "2 düşmana daha sıçrar; +%25 alan"
            }
          ]
        },
        "Bekleme süresi 0,3 sn daha hızlı",
        "+8 hasar",
        {
          "fork": [
            {
              "name": "Golazo",
              "desc": "Bayılttığı düşmanlar patlar; +1 top"
            },
            {
              "name": "Çift Sekme",
              "desc": "Anında tekrar kullanılır (%50)"
            }
          ]
        },
        "+%25 alan ve +6 hasar"
      ]
    },
    "psyshock": {
      "description": "Medyum küreleri her yöne uçar ve geri döner.",
      "upgrades": [
        "+1 küre",
        "+3 hasar",
        {
          "fork": [
            {
              "name": "Medyum Yörüngesi",
              "desc": "Etrafında döner; +%10 alan"
            },
            {
              "name": "Parçacık",
              "desc": "İsabette 2'ye ayrılır; +%20 alan"
            }
          ]
        },
        "+1 küre",
        "+4 hasar",
        {
          "fork": [
            {
              "name": "Zihin Arkı",
              "desc": "2 düşmana daha sıçrar; daha hızlı"
            },
            {
              "name": "Zihin Ezmesi",
              "desc": "Elitlere ve bosslara karşı ×1,5; daha hızlı"
            }
          ]
        },
        "+2 küre"
      ]
    },
    "earthquake": {
      "description": "Etrafındaki her şeye hasar veren bir sarsıntı. Uzun bekleme süresi.",
      "upgrades": [
        "+8 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Artçı Sarsıntı",
              "desc": "Anında tekrar kullanılır (%50); -0,2 sn bekleme süresi"
            },
            {
              "name": "Yüklü Fay",
              "desc": "2 düşmana daha sıçrar; -0,4 sn bekleme süresi"
            }
          ]
        },
        "+1 sarsıntı",
        "+10 hasar",
        {
          "fork": [
            {
              "name": "Fay Hattı",
              "desc": "Bayılttığı düşmanlar patlar; +%25 alan"
            },
            {
              "name": "Uçurum",
              "desc": "Canı ≤%12 olan düşmanları bitirir; +%15 alan"
            }
          ]
        },
        "+1 sarsıntı ve +10 hasar"
      ]
    },
    "drumBeating": {
      "description": "Davul vuruşları: Düşmanları yavaşlatan kök dalgaları. Her üçüncü vuruş daha büyük ve daha serttir.",
      "upgrades": [
        "+4 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Acımasız Ritim",
              "desc": "Durum etkisi altındaki düşmanlara ×1,35; +1 vuruş"
            },
            {
              "name": "Can Veren Ritim",
              "desc": "Vuruşları seni iyileştirir; +1 vuruş"
            }
          ]
        },
        "Bekleme süresi 0,25 sn daha hızlı",
        "+5 hasar",
        {
          "fork": [
            {
              "name": "Orman Yankısı",
              "desc": "2 düşmana daha sıçrar; +1 vuruş"
            },
            {
              "name": "Savaş Davulu",
              "desc": "Bayılttığı düşmanlar patlar; +1 vuruş"
            }
          ]
        },
        "+%25 alan ve +5 hasar"
      ]
    },
    "disarmingVoice": {
      "description": "Her yöne yayılan kalp dalgaları.",
      "upgrades": [
        "+2 kalp",
        "+3 hasar",
        {
          "fork": [
            {
              "name": "Seken Kalpler",
              "desc": "2 düşmana daha seker; +9 hasar"
            },
            {
              "name": "Serenat",
              "desc": "Etrafında döner; -4 hasar"
            }
          ]
        },
        "Bekleme süresi 0,2 sn daha hızlı",
        "+2 kalp",
        {
          "fork": [
            {
              "name": "Kırık Kalp",
              "desc": "İsabette 2'ye ayrılır; +2 hasar"
            },
            {
              "name": "Tatlı Ses",
              "desc": "Vuruşları seni iyileştirir; +4 hasar"
            }
          ]
        },
        "+4 kalp"
      ]
    },
    "torchSong": {
      "description": "Alevli bir şarkı: Her yöne ateş notaları yayılır. Art arda söylenen her şarkı %8 daha güçlüdür (5'e kadar); hasar almak seriyi bozar.",
      "upgrades": [
        "+1 nota",
        "+3 hasar",
        {
          "fork": [
            {
              "name": "Güdümlü Notalar",
              "desc": "Düşmanları takip eder; 1 düşmanı daha delip geçer, +10 hasar"
            },
            {
              "name": "Kamp Ateşi",
              "desc": "Etrafında döner; -4 hasar"
            }
          ]
        },
        "+2 nota",
        "Bekleme süresi 0,3 sn daha hızlı",
        {
          "fork": [
            {
              "name": "Havai Fişek",
              "desc": "Bayılttığı düşmanlar patlar; +5 hasar"
            },
            {
              "name": "Alevli Sahne",
              "desc": "Zeminde hasar veren alan bırakır; +3 hasar"
            }
          ]
        },
        "+2 nota ve +%20 alan"
      ]
    },
    "leafBlade": {
      "description": "Etrafındaki her şeyi biçen dönen bir kılıç. Her üçüncü savuruş kritiktir: ×2 hasar veren daha büyük altın bir yaprak kılıç.",
      "upgrades": [
        "+4 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Çift Kılıç",
              "desc": "Daha geniş 2. bir savuruş geriye döner"
            },
            {
              "name": "Temiz Kesik",
              "desc": "Canı ≤%12 olan düşmanları bitirir; +1 kılıç"
            }
          ]
        },
        "Bekleme süresi 0,2 sn daha hızlı",
        "+6 hasar",
        {
          "fork": [
            {
              "name": "Patlama Kesiği",
              "desc": "Bayılttığı düşmanlar patlar; +%20 alan"
            },
            {
              "name": "Bitki Özü",
              "desc": "Vuruşları seni iyileştirir; +%10 alan"
            }
          ]
        },
        "+1 kılıç"
      ]
    },
    "razorShell": {
      "description": "Önünde kavis çizerek savrulan keskin bir kabuk darbesi. Düşmanı işaretleyebilir; işaretlenen düşman her vuruştan daha fazla hasar alır.",
      "upgrades": [
        "Arkaya da vurur",
        "+5 hasar",
        {
          "fork": [
            {
              "name": "Zincirleme Kesik",
              "desc": "2 düşmana daha sıçrar; +%10 alan"
            },
            {
              "name": "İnci",
              "desc": "Vuruşları seni iyileştirir; +%20 alan"
            }
          ]
        },
        "Bekleme süresi 0,15 sn daha hızlı",
        "+6 hasar",
        {
          "fork": [
            {
              "name": "Kabuk Bombası",
              "desc": "Bayılttığı düşmanlar patlar; +%20 alan"
            },
            {
              "name": "Acımasız Kabuk",
              "desc": "Durum etkisi altındaki düşmanlara ×1,35; +%10 alan"
            }
          ]
        },
        "+1 savuruş ve +6 hasar"
      ]
    },
    "quickAttack": {
      "description": "Shift tuşuna veya atılma düğmesine bas: Önündeki düşmana doğru kısa bir atılma yaparsın, yolundaki her şeye vurur ve bir anlığına dokunulmaz olursun.",
      "upgrades": [
        "+5 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Gölge İzi",
              "desc": "Zeminde hasar veren alan bırakır; -0,2 sn bekleme süresi"
            },
            {
              "name": "Şimşek Adım",
              "desc": "2 düşmana daha sıçrar; -0,3 sn bekleme süresi, +11 hasar"
            }
          ]
        },
        "+6 hasar",
        "Daha uzun atılma",
        {
          "fork": [
            {
              "name": "Sonik Darbe",
              "desc": "Bayılttığı düşmanlar patlar; -0,3 sn bekleme süresi, -8 hasar"
            },
            {
              "name": "Pusu Atılışı",
              "desc": "Canı ≤%12 olan düşmanları bitirir; -0,3 sn bekleme süresi, +26 hasar"
            }
          ]
        },
        "+8 hasar ve +%20 alan"
      ]
    },
    "shockWave": {
      "description": "Düşmandan düşmana atlayan ve her sıçrayışta zayıflayan bir elektrik şoku. Felç edebilir.",
      "upgrades": [
        "+1 sıçrama",
        "+4 hasar",
        {
          "fork": [
            {
              "name": "Aşırı Yükleme",
              "desc": "Alt edilen düşmanlar patlar; bekleme süresi %6 daha hızlı"
            },
            {
              "name": "Yankı Akımı",
              "desc": "Zincir darbesi tekrar vurur (%50); -1 sıçrama"
            }
          ]
        },
        "+1 sıçrama",
        "+5 hasar ve +%10 felç ihtimali",
        {
          "fork": [
            {
              "name": "Statik Alan",
              "desc": "Her sıçrayış kıvılcım bırakır; +%10 felç"
            },
            {
              "name": "Dallanma",
              "desc": "Her sıçrayış 2 düşmana daha ayrılır; -2 hasar"
            }
          ]
        },
        "+2 sıçrama"
      ]
    },
    "hex": {
      "description": "Düşmandan düşmana sıçrayan bir lanet. Durum etkisi altındaki düşmanlara ×1,7 hasar verir.",
      "upgrades": [
        "+1 sıçrama",
        "+4 hasar",
        {
          "fork": [
            {
              "name": "Lanet Patlaması",
              "desc": "Bayılttığı düşmanlar patlar; -0,1 sn bekleme süresi, -6 hasar"
            },
            {
              "name": "Ruh Emme",
              "desc": "Vuruşları seni iyileştirir; -0,2 sn bekleme süresi, +8 hasar"
            }
          ]
        },
        "+1 sıçrama",
        "+5 hasar",
        {
          "fork": [
            {
              "name": "Hayalet Ateşi",
              "desc": "Zeminde hasar veren alan bırakır; +%25 alan, -6 hasar"
            },
            {
              "name": "Lanetli Yankı",
              "desc": "Anında tekrar kullanılır (%50); +%10 alan, +11 hasar"
            }
          ]
        },
        "+2 sıçrama"
      ]
    },
    "toxicSpikes": {
      "description": "Zemine bir düşman bastığında patlayan zehirli dikenler bırakır. Kimse basmazsa yarı hasarla kendiliğinden patlarlar.",
      "upgrades": [
        "+6 hasar",
        "+1 diken",
        {
          "fork": [
            {
              "name": "Statik Dikenler",
              "desc": "2 düşmana daha sıçrar; +%20 alan"
            },
            {
              "name": "Zehirli Su Birikintisi",
              "desc": "Zeminde hasar veren alan bırakır; +%10 alan"
            }
          ]
        },
        "Diken süresi +2 sn",
        "+8 hasar ve %25 daha güçlü zehir",
        {
          "fork": [
            {
              "name": "Zincirleme Reaksiyon",
              "desc": "Bayılttığı düşmanlar patlar; +1 diken"
            },
            {
              "name": "Acımasız Zehir",
              "desc": "Durum etkisi altındaki düşmanlara ×1,35; +1 diken"
            }
          ]
        },
        "+%25 alan ve +6 hasar"
      ]
    },
    "willOWisp": {
      "description": "Arkanda en yakındaki düşmana kendiliğinden ateş püskürten bir hayalet alevi bırakır. Yakabilir.",
      "upgrades": [
        "+3 hasar",
        "Süre +1,5 sn",
        {
          "fork": [
            {
              "name": "Gezgin Alev",
              "desc": "Zeminde hasar veren alan bırakır; +1 alev, +6 hasar"
            },
            {
              "name": "Ateş Yığını",
              "desc": "Bayılttığı düşmanlar patlar; +1 alev, -2 hasar"
            }
          ]
        },
        "Bekleme süresi 1 sn daha hızlı",
        "+4 hasar ve +%10 yanma ihtimali",
        {
          "fork": [
            {
              "name": "Çift Alev",
              "desc": "Anında tekrar kullanılır (%50); +0,5 sn süre"
            },
            {
              "name": "Fener",
              "desc": "Elitlere ve bosslara karşı ×1,5; +1,5 sn süre, +4 hasar"
            }
          ]
        },
        "Yaylım ateşi başına +1 alev ve +3 hasar"
      ]
    },
    "iceShard": {
      "description": "Yavaşlayıp zemine saplanan, üzerine basan herkese hasar verip yavaşlatan buz parçacıkları fırlatır.",
      "upgrades": [
        "+1 parçacık",
        "+3 hasar",
        {
          "fork": [
            {
              "name": "Dönen Parçacıklar",
              "desc": "Etrafında döner; +6 hasar"
            },
            {
              "name": "Çift Yelpaze",
              "desc": "Geriye doğru da ateşler; +0,5 sn süre, -2 hasar"
            }
          ]
        },
        "+1 parçacık",
        "Bekleme süresi 0,2 sn daha hızlı",
        {
          "fork": [
            {
              "name": "Kıymık",
              "desc": "İsabette 2'ye ayrılır; +3 hasar"
            },
            {
              "name": "Kırma",
              "desc": "Canı ≤%12 olan düşmanları bitirir; +%20 durum etkisi, +2 hasar"
            }
          ]
        },
        "+2 parçacık ve +%20 alan"
      ]
    },
    "rockTomb": {
      "description": "En yakındaki düşmanların üzerine kayalar düşer; çarptığı düşmanları yere çivileyip yavaşlatır. Gölgeleri nereye düşeceklerini gösterir.",
      "upgrades": [
        "+1 kaya",
        "+6 hasar",
        {
          "fork": [
            {
              "name": "Moloz",
              "desc": "Zeminde hasar veren alan bırakır; +%10 alan, +3 hasar"
            },
            {
              "name": "Kaya Parçacıkları",
              "desc": "2 düşmana daha sıçrar; +%20 alan"
            }
          ]
        },
        "Bekleme süresi 0,3 sn daha hızlı",
        "+1 kaya",
        {
          "fork": [
            {
              "name": "Heyelan",
              "desc": "Bayılttığı düşmanlar patlar; +8 hasar"
            },
            {
              "name": "Anıt Mezar",
              "desc": "Elitlere ve bosslara karşı ×1,5; +11 hasar"
            }
          ]
        },
        "+1 kaya ve +%20 alan"
      ]
    },
    "pinMissile": {
      "description": "Yanlarından çıkıp en yakındaki düşmana doğru kavis çizen bir iğne yaylım ateşi. Zehirleyebilir.",
      "upgrades": [
        "+1 iğne",
        "+2 hasar",
        {
          "fork": [
            {
              "name": "Sıçrama",
              "desc": "2 düşmana daha seker"
            },
            {
              "name": "Oğul",
              "desc": "Geriye doğru da ateşler; +1 iğne, -1 hasar"
            }
          ]
        },
        "Bekleme süresi 0,15 sn daha hızlı",
        "1 düşmanı daha delip geçer",
        {
          "fork": [
            {
              "name": "İğneler",
              "desc": "İsabette 2'ye ayrılır; +2 hasar"
            },
            {
              "name": "Son İğne",
              "desc": "Canı ≤%12 olan düşmanları bitirir; +5 hasar"
            }
          ]
        },
        "+2 iğne"
      ]
    },
    "dragonBreath": {
      "description": "En yakındaki düşmana doğru koni şeklinde bir ejderha ateşi püskürtür; koninin tam ortası en sert darbeyi vurur. Yakabilir.",
      "upgrades": [
        "Koni +1 üfleme daha geniş",
        "+3 hasar",
        {
          "fork": [
            {
              "name": "Çift Nefes",
              "desc": "Geriye doğru da ateşler; +3 hasar"
            },
            {
              "name": "Kavrulmuş Toprak",
              "desc": "Zeminde hasar veren alan bırakır; +%20 alan"
            }
          ]
        },
        "Bekleme süresi 0,15 sn daha hızlı",
        "Koni +1 üfleme daha geniş",
        {
          "fork": [
            {
              "name": "Ejderha Gazabı",
              "desc": "Bayılttığı düşmanlar patlar; +4 hasar"
            },
            {
              "name": "Acımasız Alev",
              "desc": "Durum etkisi altındaki düşmanlara ×1,35; +%20 durum ihtimali, +3 hasar"
            }
          ]
        },
        "Koni +2 üfleme daha geniş"
      ]
    },
    "flameWheel": {
      "description": "Seninle birlikte yuvarlanan bir ateş çemberi yürürken geçtiğin yolda alevler bırakır. Hareketsiz durmak hiçbir işe yaramaz: Daireler çizerek koş. Yakabilir.",
      "upgrades": [
        "+3 hasar",
        "Alevlerin süresi +0,6 sn",
        {
          "fork": [
            {
              "name": "Can Veren Çark",
              "desc": "Vuruşları seni iyileştirir; +%10 alan"
            },
            {
              "name": "Kıvılcım Çarkı",
              "desc": "2 düşmana daha sıçrar; +%20 alan"
            }
          ]
        },
        "+3 hasar ve +%10 yanma ihtimali",
        "Alevlerin süresi +0,6 sn",
        {
          "fork": [
            {
              "name": "Patlama Çarkı",
              "desc": "Bayılttığı düşmanlar patlar; +4 hasar"
            },
            {
              "name": "Acımasız Çark",
              "desc": "Durum etkisi altındaki düşmanlara ×1,35; +2 hasar"
            }
          ]
        },
        "+3 hasar ve +%25 alan"
      ]
    },
    "solarBeam": {
      "description": "1 sn boyunca ışık toplar, ardından en yakındaki düşmanın üzerinden 90° süpüren bir ışın ateşler. Yoğun güneş ışığı altındayken beklemeden anında ateşler.",
      "upgrades": [
        "+8 hasar",
        "+%15 alan",
        {
          "fork": [
            {
              "name": "Prizma Işını",
              "desc": "2 düşmana daha sıçrar; -0,4 sn bekleme süresi, +9 hasar"
            },
            {
              "name": "Kavrulmuş Yol",
              "desc": "Zeminde hasar veren alan bırakır; -0,5 sn bekleme süresi"
            }
          ]
        },
        "+10 hasar",
        "+1 ışın",
        {
          "fork": [
            {
              "name": "Süpernova",
              "desc": "Bayılttığı düşmanlar patlar; +%20 alan"
            },
            {
              "name": "Kavurucu Güneş",
              "desc": "Elitlere ve bosslara karşı ×1,5; +%10 alan"
            }
          ]
        },
        "+12 hasar ve bekleme süresi 0,4 sn daha hızlı"
      ]
    },
    "brine": {
      "description": "Görüş alanındaki en çok yaralanmış düşmanlara tuzlu su fırlatır. Canı %50'nin altındaki herkese çift hasar verir: Tam bir infaz vuruşu.",
      "upgrades": [
        "+1 hedef",
        "+5 hasar",
        {
          "fork": [
            {
              "name": "Sıçrama Arkı",
              "desc": "2 düşmana daha sıçrar; -0,1 sn bekleme süresi"
            },
            {
              "name": "Tuz Havuzu",
              "desc": "Zeminde hasar veren alan bırakır; -0,2 sn bekleme süresi, +4 hasar"
            }
          ]
        },
        "+%25 alan",
        "+1 hedef",
        {
          "fork": [
            {
              "name": "Bağışlayıcı Sıçrama",
              "desc": "Canı ≤%12 olan düşmanları bitirir; +10 hasar"
            },
            {
              "name": "Tuz Dalgası",
              "desc": "Bayılttığı düşmanlar patlar; +7 hasar"
            }
          ]
        },
        "+1 hedef ve +5 hasar"
      ]
    },
    "electroBall": {
      "description": "Hasarı ve boyutu hareket hızınla birlikte artan (en fazla ×2,2) bir elektrik küresi. Düşmanları delip geçer ve felç edebilir.",
      "upgrades": [
        "+5 hasar",
        "1 düşmanı daha delip geçer",
        {
          "fork": [
            {
              "name": "Güdümlü Küre",
              "desc": "Düşmanları takip eder; -0,1 sn bekleme süresi, +20 hasar"
            },
            {
              "name": "Deşarj",
              "desc": "2 düşmana daha sıçrar; -0,2 sn bekleme süresi, -7 hasar"
            }
          ]
        },
        "+1 küre",
        "+6 hasar ve +%10 felç ihtimali",
        {
          "fork": [
            {
              "name": "Bölünen Küre",
              "desc": "İsabette 2'ye ayrılır; +%15 alan"
            },
            {
              "name": "Yoyo",
              "desc": "Gidip geri döner; +%25 alan"
            }
          ]
        },
        "+1 küre ve +5 hasar"
      ]
    },
    "venoshock": {
      "description": "Öncelikle zehirlenmiş düşmanları hedef alan ve onlara çift hasar veren güdümlü zehir damlaları.",
      "upgrades": [
        "+1 damla",
        "+4 hasar",
        {
          "fork": [
            {
              "name": "Damla Parçacıkları",
              "desc": "İsabette 2'ye ayrılır; -0,1 sn bekleme süresi"
            },
            {
              "name": "Zehir İzi",
              "desc": "Zeminde zehirleyen alan bırakır; -0,15 sn bekleme süresi"
            }
          ]
        },
        "+1 damla",
        "+5 hasar ve +%10 zehirleme ihtimali",
        {
          "fork": [
            {
              "name": "Sıçrama",
              "desc": "2 düşmana daha seker; +4 hasar"
            },
            {
              "name": "Zehir Patlaması",
              "desc": "Bayılttığı düşmanlar patlar; +1 delme"
            }
          ]
        },
        "+1 damla ve +4 hasar"
      ]
    },
    "selfDestruct": {
      "description": "Manuel: Etrafında devasa bir patlama yaratmak için mevcut Canının %20'sini harcar ve seni bir anlığına dokunulmaz kılar.",
      "upgrades": [
        "+15 hasar",
        "+%15 alan",
        {
          "fork": [
            {
              "name": "Toparlanma",
              "desc": "Patlama Can kazandırır; -0,7 sn bekleme süresi"
            },
            {
              "name": "Yanan Krater",
              "desc": "Zeminde hasar veren alan bırakır; -1 sn bekleme süresi"
            }
          ]
        },
        "+20 hasar",
        "+%15 alan",
        {
          "fork": [
            {
              "name": "Zincirleme Reaksiyon",
              "desc": "Bayılttığı düşmanlar patlar; -1 sn bekleme süresi"
            },
            {
              "name": "Kamikaze",
              "desc": "Elitlere ve bosslara karşı ×1,5; -0,8 sn bekleme süresi"
            }
          ]
        },
        "+25 hasar ve +%20 alan"
      ]
    },
    "roost": {
      "description": "Tünemek için 1 sn hareketsiz dur: Bir tüy rüzgârı düşmanları iter ve yerinde kaldığın sürece saniyede maksimum Canının %2'sini yenilersin.",
      "upgrades": [
        "+6 rüzgâr hasarı",
        "Saniyede Canın %2,5'ini yeniler",
        {
          "fork": [
            {
              "name": "Hızlı Tüneme",
              "desc": "İki kat hızlı tüner ama %30 daha az iyileştirir"
            },
            {
              "name": "Rüzgâr Yuvası",
              "desc": "Tüneme anı hasar veren rüzgâr bırakır; +%20 alan"
            }
          ]
        },
        "+%30 rüzgâr alanı",
        "Saniyede Canın %3'ünü yeniler",
        {
          "fork": [
            {
              "name": "Patlayan Tüyler",
              "desc": "Bayılttığı düşmanlar patlar; +4 hasar"
            },
            {
              "name": "Derin Dinlenme",
              "desc": "%60 daha fazla iyileştirir ama tünemesi daha uzun sürer"
            }
          ]
        },
        "+10 rüzgâr hasarı ve saniyede Canın %3,5'ini yeniler"
      ]
    },
    "focusPunch": {
      "description": "Hasar almadığın sürece odaklanırsın ve aura büyür. Tam şarj olduğunda yakındaki bir sonraki düşmana yıkıcı bir yumruk indirir. Darbe almak şarjı sıfırlar.",
      "upgrades": [
        "+18 hasar",
        "Daha hızlı şarj olur",
        {
          "fork": [
            {
              "name": "Zincirleme Dalga",
              "desc": "2 düşmana daha sıçrar; +%10 alan, +31 hasar"
            },
            {
              "name": "Usta Vuruşu",
              "desc": "Elitlere ve bosslara karşı ×1,5; +%20 alan"
            }
          ]
        },
        "+22 hasar",
        "Daha hızlı şarj olur",
        {
          "fork": [
            {
              "name": "Sismik Yumruk",
              "desc": "Bayılttığı düşmanlar patlar; +26 hasar"
            },
            {
              "name": "Kısa Odaklanma",
              "desc": "8 yerine 5 saniyede şarj olur; +4 hasar"
            }
          ]
        },
        "+22 hasar ve +%20 alan"
      ]
    },
    "gyroBall": {
      "description": "Etrafında dönen çelik dişliler sen ne kadar yavaş hareket edersen o kadar sert vurur. Hareketsiz dururken ×2,2'ye kadar hasar verir.",
      "upgrades": [
        "+1 dişli",
        "+3 hasar",
        {
          "fork": [
            {
              "name": "Can Veren Dişli",
              "desc": "Vuruşları seni iyileştirir; +%10 alan"
            },
            {
              "name": "Öğütücü",
              "desc": "Düşmanları içine çeker; +%20 alan"
            }
          ]
        },
        "Dönüş %25 daha hızlı",
        "+1 dişli",
        {
          "fork": [
            {
              "name": "Dişli Bombası",
              "desc": "Bayılttığı düşmanlar patlar; +4 hasar"
            },
            {
              "name": "Parçalayıcı",
              "desc": "Canı ≤%12 olan düşmanları bitirir; +9 hasar"
            }
          ]
        },
        "+5 hasar ve +%20 alan"
      ]
    },
    "suckerPunch": {
      "description": "Sinsi bir vuruş: Tam yanına yaklaşan herhangi bir düşmana, o sana dokunamadan anında vurur.",
      "upgrades": [
        "+4 hasar",
        "Vuruş başına +1 hedef",
        {
          "fork": [
            {
              "name": "Can Veren Karşı Darbe",
              "desc": "Vuruşları seni iyileştirir; -0,05 sn bekleme süresi"
            },
            {
              "name": "Zincirleme Vuruş",
              "desc": "2 düşmana daha sıçrar; -0,08 sn bekleme süresi"
            }
          ]
        },
        "+%20 menzil",
        "+6 hasar",
        {
          "fork": [
            {
              "name": "Kirli Numara",
              "desc": "Canı ≤%12 olan düşmanları bitirir; +1 hedef, +11 hasar"
            },
            {
              "name": "Tuzak",
              "desc": "Bayılttığı düşmanlar patlar; +1 hedef"
            }
          ]
        },
        "+6 hasar ve bekleme süresi 0,08 sn daha hızlı"
      ]
    },
    "futureSight": {
      "description": "Görüş alanındaki en kalabalık düşman gruplarını işaretler; 2 sn sonra işaretlerin üzerine medyum sütunları çöker.",
      "upgrades": [
        "+10 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Tekillik",
              "desc": "Düşmanları içine çeker; +1 işaret"
            },
            {
              "name": "Önceden Sezi",
              "desc": "2 düşmana daha sıçrar; +1 işaret"
            }
          ]
        },
        "Bekleme süresi 0,6 sn daha hızlı",
        "+14 hasar",
        {
          "fork": [
            {
              "name": "Kehanet",
              "desc": "Bayılttığı düşmanlar patlar; +1 işaret"
            },
            {
              "name": "Kader",
              "desc": "Elitlere ve bosslara karşı ×1,5; +1 işaret, +13 hasar"
            }
          ]
        },
        "+14 hasar ve +%20 alan"
      ]
    },
    "bonemerang": {
      "description": "Menzildeki en uzaktaki düşmana bir kemik fırlatır ve kemik bulunduğun yere geri döner; hem giderken hem dönerken çarpar.",
      "upgrades": [
        "+5 hasar",
        "+1 kemik",
        {
          "fork": [
            {
              "name": "Kemik İzi",
              "desc": "Zeminde hasar veren alan bırakır; +%15 alan"
            },
            {
              "name": "Yüklü Kemik",
              "desc": "2 düşmana daha sıçrar; +%25 alan"
            }
          ]
        },
        "Bekleme süresi 0,2 sn daha hızlı",
        "+6 hasar",
        {
          "fork": [
            {
              "name": "Patlama Kemiği",
              "desc": "Bayılttığı düşmanlar patlar; +1 kemik"
            },
            {
              "name": "Temiz Vuruş",
              "desc": "Canı ≤%12 olan düşmanları bitirir; +1 kemik"
            }
          ]
        },
        "+6 hasar ve %25 daha hızlı uçar"
      ]
    },
    "stealthRock": {
      "description": "Bulunduğun yere 20 sn boyunca içeri giren herkese hasar veren sivri taşlardan bir çember kurar. Nerede savaşacağını sen seçersin.",
      "upgrades": [
        "+1 taş",
        "+4 hasar",
        {
          "fork": [
            {
              "name": "Mıknatıs Taşı",
              "desc": "Düşmanları içine çeker; +3 sn süre"
            },
            {
              "name": "Statik Taşlar",
              "desc": "2 düşmana daha sıçrar; +3 sn süre"
            }
          ]
        },
        "+%20 alan",
        "+2 taş",
        {
          "fork": [
            {
              "name": "Kaya Mayını",
              "desc": "Bayılttığı düşmanlar patlar; +6 hasar"
            },
            {
              "name": "Kale",
              "desc": "Elitlere ve bosslara karşı ×1,5; +4 hasar"
            }
          ]
        },
        "+6 hasar ve taş süresi +5 sn"
      ]
    },
    "uTurn": {
      "description": "Manuel: En yakındaki düşmanın içinden geçip başladığın noktaya geri atılır, her iki yönde de vurur ve bu süreçte tamamen dokunulmaz kalır.",
      "upgrades": [
        "+6 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Hava Akımı",
              "desc": "Zeminde hasar veren alan bırakır; -0,2 sn bekleme süresi"
            },
            {
              "name": "Can Veren Dönüş",
              "desc": "Vuruşları seni iyileştirir; -0,3 sn bekleme süresi"
            }
          ]
        },
        "+8 hasar",
        "Daha uzağa gider",
        {
          "fork": [
            {
              "name": "Patlamalı Dönüş",
              "desc": "Bayılttığı düşmanlar patlar; -0,3 sn bekleme süresi"
            },
            {
              "name": "Zikzak",
              "desc": "2 düşmana daha sıçrar; -0,3 sn bekleme süresi, +25 hasar"
            }
          ]
        },
        "+10 hasar ve +%20 alan"
      ]
    },
    "dragonTail": {
      "description": "Kuyruğun arkandaki kavisi süpürür ve düşmanları uzağa fırlatır; savrulan düşman çarptığı herkese hasar verir.",
      "upgrades": [
        "+6 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Can Veren Kuyruk",
              "desc": "Vuruşları seni iyileştirir; -0,15 sn bekleme süresi"
            },
            {
              "name": "Titan Kuyruğu",
              "desc": "Elitlere ve bosslara karşı ×1,5; -0,2 sn bekleme süresi"
            }
          ]
        },
        "+7 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Patlama Fırlatışı",
              "desc": "Bayılttığı düşmanlar patlar; -0,2 sn bekleme süresi"
            },
            {
              "name": "Son Kuyruk",
              "desc": "Canı ≤%12 olan düşmanları bitirir; -0,2 sn bekleme süresi, +12 hasar"
            }
          ]
        },
        "+9 hasar"
      ]
    },
    "sheerCold": {
      "description": "Senden yayılan dondurucu bir halka: Hafifçe sıyırıp yavaşlatır ancak Canı %20'nin altındaki sıradan düşmanları anında parçalara ayırır.",
      "upgrades": [
        "+2 hasar",
        "+%15 alan",
        {
          "fork": [
            {
              "name": "Acımasız Don",
              "desc": "Durum etkisi altındaki düşmanlara ×1,35; +6 hasar"
            },
            {
              "name": "Parçalanan Buz",
              "desc": "Bayılttığı düşmanlar patlar; -1 hasar"
            }
          ]
        },
        "Bekleme süresi 0,4 sn daha hızlı",
        "+2 hasar ve %27'nin altındakileri parçalar",
        {
          "fork": [
            {
              "name": "Çift Dalga",
              "desc": "Anında tekrar kullanılır (%50); +%10 alan"
            },
            {
              "name": "Buzul Çağı",
              "desc": "Elitlere ve bosslara karşı ×1,5; +%20 alan"
            }
          ]
        },
        "Bekleme süresi 0,4 sn daha hızlı ve %30'un altındakileri parçalar"
      ]
    },
    "flamethrower": {
      "description": "En yakındaki düşmana kesintisiz bir alev püskürtür; alevin bittiği yerde zemin tutuşur. Yakabilir.",
      "upgrades": [
        "+5 hasar ve daha geniş alev püskürtme",
        "+2 alev ve daha uzun menzil",
        "Yanan zemin süresi +0,8 sn ve yanıklar %30 daha güçlü",
        "Bekleme süresi 0,15 sn daha hızlı ve +2 alev"
      ]
    },
    "fireBlast": {
      "description": "Zeminde yanmaya devam eden beş köşeli bir ateş yıldızına dönüşen ateş topları fırlatır.",
      "upgrades": [
        "+1 ateş topu",
        "+8 hasar ve daha büyük yıldız",
        "Yıldız +0,4 sn daha uzun yanar ve +%15 yanma ihtimali",
        "Bekleme süresi 0,4 sn daha hızlı ve +8 hasar"
      ]
    },
    "hydroPump": {
      "description": "Yürüdüğün yöne doğru yüksek basınçlı çift su tazyiki: Her şeyi delip geçer ve düşmanları havaya savuran bir su sıçramasıyla son bulur.",
      "upgrades": [
        "+8 hasar",
        "Daha kalın ve daha uzun tazyikler",
        "+1 su tazyiki",
        "Bekleme süresi 0,2 sn daha hızlı ve düşmanları daha uzağa savurur"
      ]
    },
    "surf": {
      "description": "Senden yayılan devasa dalgalar; ilki yürüdüğün yöne doğru akar ve yolundaki her şeyi süpürür, iter ve yavaşlatır.",
      "upgrades": [
        "+6 hasar",
        "Daha geniş dalgalar",
        "+1 dalga",
        "Bekleme süresi 0,25 sn daha hızlı ve +4 hasar"
      ]
    },
    "leafStorm": {
      "description": "Etrafında dönen iki helezoni yaprak kolu kesiştiği her şeyi biçen bir fırtınaya dönüşerek genişler.",
      "upgrades": [
        "+4 yaprak",
        "+6 hasar",
        "Daha büyük yapraklar ve daha uzun süren fırtına",
        "Bekleme süresi 0,25 sn daha hızlı ve daha hızlı dönüş"
      ]
    },
    "powerWhip": {
      "description": "Etrafında dönen devasa dikenli sarmaşıkların her biri yarım daire süpürerek düşmanları havaya savurur.",
      "upgrades": [
        "+10 hasar",
        "Daha uzun sarmaşıklar",
        "+1 sarmaşık",
        "Bekleme süresi 0,25 sn daha hızlı ve düşmanları daha uzağa savurur"
      ]
    },
    "triAttack": {
      "description": "Üzerinde dönen bir prizma en yakındaki düşmanlara ateş, buz ve yıldırım ışınları fırlatır: Yakar, dondurur ve felç eder.",
      "upgrades": [
        "+6 hasar",
        "+%20 durum ihtimali ve daha kalın ışınlar",
        "+3 ışın: İkinci bir üçgen",
        "Bekleme süresi 0,25 sn daha hızlı ve +6 hasar"
      ]
    },
    "wildboltStorm": {
      "description": "Bir fırtına bulutu tüm ekrana yıldırımlar yağdırır ve her yıldırım yakındaki iki düşmana çatallanır. Felç edebilir.",
      "upgrades": [
        "+2 yıldırım",
        "+10 hasar",
        "Çatallar daha uzağa ulaşır ve +%15 felç ihtimali",
        "Bekleme süresi 0,3 sn daha hızlı ve +2 yıldırım"
      ]
    },
    "gunkShot": {
      "description": "Güm diye yere düşüp zehirli su birikintilerine saçılan çöp yığınları fırlatır. Çoğunlukla zehirler.",
      "upgrades": [
        "+1 çöp yığını",
        "+4 hasar ve %25 daha güçlü zehir",
        "+0,6 sn daha uzun kalan daha büyük birikintiler",
        "Bekleme süresi 0,4 sn daha hızlı ve +5 hasar"
      ]
    },
    "hurricane": {
      "description": "Etrafında dönen hortumlar yakındaki düşmanları içine çekip uzağa fırlatır.",
      "upgrades": [
        "+5 hasar",
        "+1 hortum",
        "+1 sn daha uzun kalan daha büyük hortumlar",
        "Bekleme süresi 0,6 sn daha hızlı ve daha hızlı dönüş"
      ]
    },
    "extremeSpeed": {
      "description": "Shift tuşuna veya atılma düğmesine bas: Sürüyü yarıp geçen ve bir şok dalgasıyla son bulan ışık hızında bir atılma.",
      "upgrades": [
        "+10 hasar",
        "Daha büyük atılma ve şok dalgası",
        "Daha uzun atılma ve +6 hasar",
        "+12 hasar ve düşmanları daha uzağa savurur"
      ]
    },
    "thunderbolt": {
      "description": "Gökten en yakındaki düşmanın üzerine bir yıldırım iner ve elektrik akımı düşmandan düşmana sıçrar. Felç edebilir.",
      "upgrades": [
        "+3 hedef",
        "+8 hasar",
        "Akım daha uzağa sıçrar ve +%15 felç şansı",
        "0,2 sn daha kısa bekleme süresi ve +3 hedef"
      ]
    },
    "barbBarrage": {
      "description": "Dört bir yana zehirli dikenler saçar; dikenler patlayan ve geride zehirli bir bulut bırakan mayınlara dönüşür.",
      "upgrades": [
        "+2 diken",
        "+10 hasar",
        "Daha büyük patlamalar ve %30 daha güçlü zehir",
        "0,2 sn daha kısa bekleme süresi ve +2 diken"
      ]
    },
    "inferno": {
      "description": "Ayaklarının dibinde etrafı ateş halkasıyla çevrili bir şenlik ateşi yakar; ateş düşmanlara alev patlamaları fırlatır. Sık sık yakar.",
      "upgrades": [
        "+6 hasar",
        "Yaylım ateşi başına +1 atış",
        "Daha geniş ateş halkası ve şenlik ateşi +2 sn kalır",
        "1 sn daha kısa bekleme süresi ve +%15 yanma şansı"
      ]
    },
    "blizzard": {
      "description": "Etrafında bir tipi dönerken düşmanların üzerine buz sarkıtları iner; yere saplanan sarkıtlar yanından geçenleri yavaşlatır.",
      "upgrades": [
        "+3 buz sarkıtı",
        "+6 hasar",
        "Daha geniş darbeler ve buz +1 sn daha uzun kalır",
        "0,3 sn daha kısa bekleme süresi ve +2 buz sarkıtı"
      ]
    },
    "stoneEdge": {
      "description": "Yerden en yakındaki düşmanlara doğru taş sütun sıraları fışkırır.",
      "upgrades": [
        "+10 hasar",
        "+1 sütun sırası",
        "Daha büyük sütunlar ve daha uzun sıralar",
        "0,3 sn daha kısa bekleme süresi ve +6 hasar"
      ]
    },
    "megahorn": {
      "description": "Devasa boynuzlar sürüyü delip geçer ve bumerang gibi geri döner; hem giderken hem dönerken çarpar. Zehirleyebilir.",
      "upgrades": [
        "+10 hasar",
        "+1 boynuz",
        "Daha uzağa uçan daha büyük boynuzlar",
        "0,25 sn daha kısa bekleme süresi ve +%20 zehirleme şansı"
      ]
    },
    "outrage": {
      "description": "Ejderha öfkesi: En yakındaki düşmana gittikçe genişleyen alev nefesleri püskürtür ve etraftaki herkesi savuran bir kükremeyle son bulur.",
      "upgrades": [
        "+5 hasar",
        "Öfke nöbetinde +1 nefes",
        "Daha geniş nefesler ve kükreme",
        "0,25 sn daha kısa bekleme süresi ve +%15 yanma şansı"
      ]
    },
    "jawLock": {
      "description": "En yakındaki düşmanların altından gölge bir çene yükselir, onları sabitleyerek üç kez ısırır. Canı yarının altındaki düşmanlara ×1,6 vurur.",
      "upgrades": [
        "+1 çene",
        "+8 hasar",
        "+%25 alan ve 0,15 sn daha kısa bekleme süresi",
        "+1 çene ve +6 hasar"
      ]
    },
    "superpower": {
      "description": "Önündeki düşmanları devasa bir darbeyle sürünün içine fırlatır (fırlatılanlar çarptığı düşmanlara hasar verir), ardından peş peşe yumruklar indirir.",
      "upgrades": [
        "+10 hasar",
        "+3 yumruk",
        "+%20 alan",
        "0,25 sn daha kısa bekleme süresi ve +8 hasar"
      ]
    },
    "fissure": {
      "description": "Yer, senden dışarı doğru uzanan yarıklarla çatlar ve düşmanları uçuruma çeker. Canı %20'nin altına düşenler temelli içine düşer.",
      "upgrades": [
        "+1 yarık",
        "+12 hasar",
        "+%20 alan",
        "+1 yarık ve 0,3 sn daha kısa bekleme süresi"
      ]
    },
    "extrasensory": {
      "description": "Düşmanların tepesinde psişik gözler açılır, patlamadan önce kalabalığı merkezine çeker. Düşmanların kafasını karıştırabilir: Kafası karışanlar birbirine çarpıp zarar verir.",
      "upgrades": [
        "+1 göz",
        "+10 hasar ve +%20 kafa karışıklığı şansı",
        "+%20 alan",
        "+1 göz ve +0,3 sn daha uzun çeker"
      ]
    },
    "steelBeam": {
      "description": "En yakındaki düşmana kalın bir çelik ışın fırlatır ve hattını yavaşça süpürerek üzerindeki her şeye peş peşe çarpar.",
      "upgrades": [
        "+6 hasar",
        "+1 ışın",
        "+0,3 sn daha uzun sürer ve +%15 alan",
        "+1 ışın ve +6 hasar"
      ]
    },
    "infernalParade": {
      "description": "Etrafında düşmanları yakan hayalet alevler süzülür. Durum etkisi altındaki düşmanlara ×1,7 hasar verir.",
      "upgrades": [
        "+2 alev",
        "+5 hasar ve +%15 yanma şansı",
        "+1 sn daha uzun sürer ve alevler daha hızlı hareket eder",
        "+2 alev ve +4 hasar"
      ]
    },
    "phantomForce": {
      "description": "Gökyüzünde kaybolan bir ok yaylımı, en yakındaki düşmanların tepesine inerek onları oldukları yere prangalar.",
      "upgrades": [
        "+2 ok",
        "+10 hasar",
        "+%25 alan",
        "+2 ok ve 0,2 sn daha kısa bekleme süresi"
      ]
    },
    "aquaCutter": {
      "description": "Devasa su şurikenleri düşmanların üzerine fırlar ve hem giderken hem dönerken keserek sana geri döner.",
      "upgrades": [
        "+1 şuriken",
        "+7 hasar",
        "+%25 alan",
        "+1 şuriken ve daha fazla hız"
      ]
    },
    "searingShot": {
      "description": "Düşmanların üzerinde patlayan ve etrafa köz halkası saçan akkor alev topları fırlatır. Sık sık yakar.",
      "upgrades": [
        "+1 alev topu",
        "+10 hasar",
        "+%25 alan ve %25 daha güçlü yakar",
        "+1 alev topu ve 0,3 sn daha kısa bekleme süresi"
      ]
    },
    "gigaDrain": {
      "description": "Sarmaşıklar en yakındaki düşmanlara kenetlenip enerjilerini sömürerek seni iyileştirir. Hedef devrilirse sarmaşık sıradakine sıçrar.",
      "upgrades": [
        "+1 sarmaşık",
        "+4 hasar",
        "+0,5 sn daha uzun sömürür",
        "+2 sarmaşık ve +3 hasar"
      ]
    },
    "burningJealousy": {
      "description": "Bir kıskançlık ezgisi yankılanır ve ekrandaki en güçlü düşmanların altında ateş sütunları patlar. Elitlere ve bosslara ×1,5 vurur ve yakar.",
      "upgrades": [
        "+2 sütun",
        "+12 hasar",
        "+%25 alan ve %25 daha güçlü yakar",
        "+2 sütun ve 0,3 sn daha kısa bekleme süresi"
      ]
    },
    "trailblaze": {
      "description": "Devasa yaprak bıçaklar, uzaktan etrafını neredeyse tam bir daire halinde süpürür.",
      "upgrades": [
        "+8 hasar",
        "+%20 alan",
        "+1 bıçak",
        "0,25 sn daha kısa bekleme süresi ve +8 hasar"
      ]
    },
    "liquidation": {
      "description": "Kabaran dalgalar ileri geri çarparak düşmanları devirir ve savunmalarını düşürür (işaret: daha fazla hasar alırlar).",
      "upgrades": [
        "+1 dalga",
        "+10 hasar",
        "+%20 alan ve +%20 işaretleme şansı",
        "+1 dalga ve 0,2 sn daha kısa bekleme süresi"
      ]
    },
    "alluringVoice": {
      "description": "Senden dışarı doğru peş peşe kalp şeklinde şarkı dalgaları yayılır ve ulaştığı düşmanların kafasını karıştırabilir.",
      "upgrades": [
        "+1 dalga",
        "+8 hasar ve +%15 kafa karışıklığı şansı",
        "+%20 alan",
        "+1 dalga ve 0,3 sn daha kısa bekleme süresi"
      ]
    },
    "fieryDance": {
      "description": "Alevler bir halka halinde dans ederek yayılır ve fır dönüp sana geri gelir. Yakabilirler ve her dansın %50 şansla saldırılarını 4 sn boyunca %15 güçlendirme olasılığı vardır.",
      "upgrades": [
        "+2 alev",
        "+3 hasar",
        {
          "fork": [
            {
              "name": "Yangın",
              "desc": "Devrilen düşmanlar patlar; +%25 alan"
            },
            {
              "name": "Kıvılcım",
              "desc": "Darbe 2 düşmana sıçrar; +2 hasar"
            }
          ]
        },
        "0,3 sn daha kısa bekleme süresi",
        "+2 alev",
        {
          "fork": [
            {
              "name": "Canlı Köz",
              "desc": "Durum etkisindekilere ×1,35; +%25 yanma şansı, %30 daha güçlü yakar"
            },
            {
              "name": "Bis",
              "desc": "Hemen ardından tekrar dans eder (%50); +3 hasar"
            }
          ]
        },
        "+4 hasar ve +%20 alan"
      ]
    },
    "overdrive": {
      "description": "Ritmik bir gitar rifi: Senden peş peşe elektrik halkaları yayılır; her ölçünün son vuruşu daha büyük ve serttir, felç edebilir.",
      "upgrades": [
        "+2 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Uzun Solo",
              "desc": "Durum etkisindekilere ×1,35; +2 vuruş"
            },
            {
              "name": "Distorsiyon",
              "desc": "Darbe 2 düşmana sıçrar; +2 hasar"
            }
          ]
        },
        "0,3 sn daha kısa bekleme süresi",
        "+3 hasar",
        {
          "fork": [
            {
              "name": "Amfi",
              "desc": "Elitlere ve bosslara ×1,5; +%25 alan"
            },
            {
              "name": "Bis",
              "desc": "Hemen ardından tekrar çalar (%50); +%25 felç şansı"
            }
          ]
        },
        "+2 vuruş ve +2 hasar"
      ]
    },
    "gigatonHammer": {
      "description": "En yakındaki düşmanın üzerine yeri sarsan devasa bir çekiç indirir. Çekiç peş peşe sallanamayacak kadar ağırdır: Her ağır darbenin ardından hafif bir vuruş gelir.",
      "upgrades": [
        "+8 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Şarapnel",
              "desc": "Devrilen düşmanlar patlar; +6 hasar"
            },
            {
              "name": "Hafif Tutuş",
              "desc": "Canı ≤%12 olan düşmanları bitirir; -0,3 sn bekleme süresi"
            }
          ]
        },
        "+8 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Gigaton",
              "desc": "Elitlere ve bosslara ×1,5; +10 hasar"
            },
            {
              "name": "Şok Dalgası",
              "desc": "Darbe 2 düşmana sıçrar; +%30 alan"
            }
          ]
        },
        "+10 hasar ve 0,2 sn daha kısa bekleme süresi"
      ]
    },
    "bitterBlade": {
      "description": "Önüne doğru vurduğu hasarın yarısı kadar seni iyileştiren hayaletsi bir ateş kılıcı savurur. Yakabilir.",
      "upgrades": [
        "+4 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Çifte Kılıç",
              "desc": "Canı ≤%12 olan düşmanları bitirir; ikinci bir kesiş geri döner"
            },
            {
              "name": "Acı Köz",
              "desc": "Devrilen düşmanlar patlar; +4 hasar"
            }
          ]
        },
        "0,2 sn daha kısa bekleme süresi",
        "+5 hasar",
        {
          "fork": [
            {
              "name": "Ruh Ateşi",
              "desc": "Durum etkisindekilere ×1,35; +%30 yanma şansı"
            },
            {
              "name": "Gezgin Alev",
              "desc": "Darbe 2 düşmana sıçrar; +%20 alan"
            }
          ]
        },
        "+6 hasar ve +%15 alan"
      ]
    },
    "leechLife": {
      "description": "Hemen yanındaki düşmanı seri ve minik ısırıklarla ısırıp vurulan hasarın yarısını Can olarak emer. Yalnızca çok yakındaki düşmanlara ulaşır.",
      "upgrades": [
        "+2 hasar",
        "+1 düşman daha ısırır",
        {
          "fork": [
            {
              "name": "Susuzluk",
              "desc": "Canı ≤%12 olan düşmanları bitirir; -0,08 sn bekleme süresi"
            },
            {
              "name": "Bulaşma",
              "desc": "Isırık 2 düşmana sıçrar; +1 hasar"
            }
          ]
        },
        "+2 hasar",
        "+%30 menzil",
        {
          "fork": [
            {
              "name": "Sürü",
              "desc": "Elitlere ve bosslara ×1,5; +1 düşman daha ısırır"
            },
            {
              "name": "Kan Emici",
              "desc": "Devrilen düşmanlar patlar; +3 hasar"
            }
          ]
        },
        "+3 hasar"
      ]
    },
    "fireFang": {
      "description": "En yakındaki düşmanı alevli dişlerle ısırır; yakabilir. Zaten yanan bir düşman bunun yerine bir anlığına irkilir.",
      "upgrades": [
        "+5 hasar",
        "+%15 yanma şansı",
        {
          "fork": [
            {
              "name": "Çifte Diş",
              "desc": "Durum etkisindekilere ×1,35; +1 düşman daha ısırır"
            },
            {
              "name": "Köz",
              "desc": "Devrilen düşmanlar patlar; +4 hasar"
            }
          ]
        },
        "0,2 sn daha kısa bekleme süresi",
        "+6 hasar",
        {
          "fork": [
            {
              "name": "Derin Yanık",
              "desc": "Yerde ateş bırakır; %40 daha güçlü yakar"
            },
            {
              "name": "Sıçrayan Ateş",
              "desc": "Isırık 2 düşmana sıçrar; +%20 alan"
            }
          ]
        },
        "+1 düşman daha ısırır ve +4 hasar"
      ]
    },
    "furySwipes": {
      "description": "Hemen yanındaki düşmana 2 ila 5 pençe atar: Düşmanların yakınında peş peşe yapılan her saldırı darbe sayısını artırır. Kavgadan uzaklaşınca bu çılgınlık diner.",
      "upgrades": [
        "+2 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Çılgınlık",
              "desc": "Durum etkisindekilere ×1,35; -0,15 sn bekleme süresi"
            },
            {
              "name": "Uzun Pençeler",
              "desc": "Pençe darbesi 2 düşmana sıçrar; +1 hasar"
            }
          ]
        },
        "+2 hasar",
        "+1 pençe darbesi",
        {
          "fork": [
            {
              "name": "Hiddet",
              "desc": "Devrilen düşmanlar patlar; +2 hasar"
            },
            {
              "name": "Pati Tokadı",
              "desc": "Elitlere ve bosslara ×1,5; +%25 alan"
            }
          ]
        },
        "+3 hasar"
      ]
    },
    "heavySlam": {
      "description": "Küçük bir sıçrama ve etrafına çelik gibi ağır bir gümleme. Ne kadar çok zırhın ve azami Canın varsa o kadar sert vurur (en fazla 3 katı).",
      "upgrades": [
        "+6 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Ağır Adım",
              "desc": "Düşmanları içeri çeker; -0,4 sn bekleme süresi"
            },
            {
              "name": "Gürleme",
              "desc": "Devrilen düşmanlar patlar; +4 hasar"
            }
          ]
        },
        "+8 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Rezonans",
              "desc": "Gümleme 2 düşmana sıçrar; +4 hasar"
            },
            {
              "name": "Ağır Sıklet",
              "desc": "Elitlere ve bosslara ×1,5; +%20 alan"
            }
          ]
        },
        "+9 hasar"
      ]
    },
    "bulldoze": {
      "description": "Önüne doğru yuvarlanan bir toprak dalgası, içinden geçtiği her düşmanı yavaşlatır.",
      "upgrades": [
        "+4 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "İki Cephe",
              "desc": "Durum etkisindekilere ×1,35; yelpaze şeklinde +1 dalga"
            },
            {
              "name": "Heyelan",
              "desc": "Devrilen düşmanlar patlar; +3 hasar"
            }
          ]
        },
        "0,3 sn daha kısa bekleme süresi",
        "+5 hasar",
        {
          "fork": [
            {
              "name": "Sur",
              "desc": "Düşmanları içeri çeker; +%30 alan"
            },
            {
              "name": "Sarsıntı",
              "desc": "Darbe 2 düşmana sıçrar; +3 hasar, daha hızlı"
            }
          ]
        },
        "+1 dalga ve +4 hasar"
      ]
    },
    "perishSong": {
      "description": "Ürpertici bir şarkı 3 vuruş sayar: Üçüncü vuruşta şarkıyı duyan tüm sıradan düşmanlar yok olur, elitler ve bosslar ise ağır hasar alır.",
      "upgrades": [
        "+6 hasar",
        "+%15 alan",
        {
          "fork": [
            {
              "name": "Kresendo",
              "desc": "Devrilen düşmanlar patlar; +6 hasar"
            },
            {
              "name": "Tempo",
              "desc": "Vuruşlar 0,2 sn daha hızlıdır; 0,4 sn daha kısa bekleme süresi"
            }
          ]
        },
        "+8 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Ağıt",
              "desc": "Elitlere ve bosslara ×1,5; +8 hasar"
            },
            {
              "name": "Rezonans",
              "desc": "Şarkı 2 düşmana sıçrar; +%20 alan"
            }
          ]
        },
        "+10 hasar ve 0,4 sn daha kısa bekleme süresi"
      ]
    },
    "chargeBeam": {
      "description": "En yakındaki düşmana kıvılcımlı bir yıldırım atar: Her kullanım %70 şansla 5 sn boyunca tüm saldırılarının hasarını %10 artırır (en fazla 3 kez birikir).",
      "upgrades": [
        "+3 hasar",
        "+%10 güçlendirme şansı",
        {
          "fork": [
            {
              "name": "Dinamo",
              "desc": "Güçlendirme 5 kata kadar birikir; -0,05 sn bekleme süresi"
            },
            {
              "name": "Kondansatör",
              "desc": "Darbe 2 düşmana sıçrar; +2 hasar"
            }
          ]
        },
        "+4 hasar",
        "0,1 sn daha kısa bekleme süresi",
        {
          "fork": [
            {
              "name": "Aşırı Yükleme",
              "desc": "Güçlendirme +2 sn daha uzun sürer; elitlere ve bosslara ×1,5"
            },
            {
              "name": "Yay",
              "desc": "Devrilen düşmanlar patlar; +3 hasar"
            }
          ]
        },
        "+4 hasar ve güçlendirme +1,5 sn daha uzun sürer"
      ]
    },
    "moonblast": {
      "description": "Ayın gücünü toplayıp en yakındaki düşmana onu zayıflatabilecek parlak bir küre fırlatır (daha az temas hasarı verir).",
      "upgrades": [
        "+4 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Dolunay",
              "desc": "Durum etkisindekilere ×1,35; +1 küre"
            },
            {
              "name": "Ay Tozu",
              "desc": "Devrilen düşmanlar patlar; +4 hasar"
            }
          ]
        },
        "0,2 sn daha kısa bekleme süresi",
        "+5 hasar",
        {
          "fork": [
            {
              "name": "Tutulma",
              "desc": "+%25 zayıflatma şansı; yerde ay birikintisi bırakır"
            },
            {
              "name": "Hilal",
              "desc": "Darbe 2 düşmana sıçrar; +%20 alan"
            }
          ]
        },
        "+1 küre ve +4 hasar"
      ]
    },
    "frostBreath": {
      "description": "En yakındaki düşmana daima kritik vuran buz gibi bir nefes üfler: İki kat hasar verir.",
      "upgrades": [
        "+4 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Derin Dondurma",
              "desc": "Canı ≤%12 olan düşmanları bitirir; -0,15 sn bekleme süresi"
            },
            {
              "name": "Dondurucu Rüzgâr",
              "desc": "Nefes 2 düşmana sıçrar; +3 hasar"
            }
          ]
        },
        "0,2 sn daha kısa bekleme süresi",
        "+5 hasar",
        {
          "fork": [
            {
              "name": "Ebedi Buzul",
              "desc": "Yerde buzlu zemin bırakır; %40 daha sert yavaşlatır"
            },
            {
              "name": "Buz Parçası",
              "desc": "Devrilen düşmanlar patlar; +4 hasar"
            }
          ]
        },
        "+6 hasar ve +%15 alan"
      ]
    },
    "avalanche": {
      "description": "En yakındaki düşmanların üzerine buz kütleleri düşer. Son 2 saniye içinde darbe aldıysan iki kat daha sert vurur.",
      "upgrades": [
        "+5 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "İntikam",
              "desc": "Darbe aldıktan sonra 2,5 kat vurur; -0,2 sn bekleme süresi"
            },
            {
              "name": "Çığ",
              "desc": "Devrilen düşmanlar patlar; +4 hasar"
            }
          ]
        },
        "0,3 sn daha kısa bekleme süresi",
        "+6 hasar",
        {
          "fork": [
            {
              "name": "Buzul Duvarı",
              "desc": "+1 buz kütlesi; düşmanları içeri çeker"
            },
            {
              "name": "Buz Yanığı",
              "desc": "Darbe 2 düşmana sıçrar; +%25 alan"
            }
          ]
        },
        "+1 buz kütlesi ve +5 hasar"
      ]
    },
    "rockSlide": {
      "description": "En yakındaki düşmanların tepesine dev kayalar iner ve onları irkiltebilir.",
      "upgrades": [
        "+5 hasar",
        "+1 kaya",
        {
          "fork": [
            {
              "name": "Taş Ocağı",
              "desc": "Elitlere ve bosslara ×1,5; +1 kaya"
            },
            {
              "name": "Heyelan",
              "desc": "Devrilen düşmanlar patlar; +4 hasar"
            }
          ]
        },
        "0,2 sn daha kısa bekleme süresi",
        "+6 hasar",
        {
          "fork": [
            {
              "name": "Ağır Kayalar",
              "desc": "+%25 irkiltme şansı; geride kaya enkazı bırakır"
            },
            {
              "name": "Sekme",
              "desc": "Darbe 2 düşmana sıçrar; +%20 alan"
            }
          ]
        },
        "+1 kaya ve +5 hasar"
      ]
    },
    "yawn": {
      "description": "Kocaman bir esneme en yakındaki düşmanı 2 sn sonra uyutur: Uyuyan düşman donakalır ve sıradaki saldırından iki kat hasar alır.",
      "upgrades": [
        "+1 hedef",
        "0,5 sn daha hızlı uyutur",
        {
          "fork": [
            {
              "name": "Bulaşıcı",
              "desc": "Esneme 2 komşuya yayılır; -0,3 sn bekleme süresi"
            },
            {
              "name": "Ağır Uyku",
              "desc": "Uyku +1,5 sn daha uzun sürer; devrilen düşmanlar patlar"
            }
          ]
        },
        "0,4 sn daha kısa bekleme süresi",
        "+1 hedef",
        {
          "fork": [
            {
              "name": "Kâbus",
              "desc": "Sonraki darbe 2,5 kat vurur; +%25 alan"
            },
            {
              "name": "Zincirleme Esneme",
              "desc": "Darbe 2 düşmana sıçrar; -0,2 sn bekleme süresi"
            }
          ]
        },
        "+1 hedef ve 0,3 sn daha kısa bekleme süresi"
      ]
    },
    "iceBeam": {
      "description": "En yakındaki düşmana doğru buzdan bir ışın ateşler ve hattı süpürerek sıradaki düşmanlara çarpar. Dondurabilir.",
      "upgrades": [
        "+5 hasar",
        "+%15 donma şansı",
        {
          "fork": [
            {
              "name": "Kriyo Işın",
              "desc": "Durum etkisindekilere ×1,35; +1 ışın"
            },
            {
              "name": "Tuzla Buz",
              "desc": "Devrilen düşmanlar patlar; +5 hasar"
            }
          ]
        },
        "0,3 sn daha kısa bekleme süresi",
        "+6 hasar",
        {
          "fork": [
            {
              "name": "Mutlak Soğuk",
              "desc": "Yerde donmuş zemin bırakır; %25 daha uzun süre dondurur"
            },
            {
              "name": "Prizma",
              "desc": "Işın çarptığında bölünür; +%20 alan"
            }
          ]
        },
        "+1 ışın ve +5 hasar"
      ]
    },
    "discharge": {
      "description": "Etrafında her yana elektrik patlaması saçar ve menzildeki tüm düşmanlara çarpar. Sık sık felç eder.",
      "upgrades": [
        "+4 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Statik Alan",
              "desc": "+%25 felç şansı; geride kıvılcımlar bırakır"
            },
            {
              "name": "Kısa Devre",
              "desc": "Devrilen düşmanlar patlar; +4 hasar"
            }
          ]
        },
        "0,2 sn daha kısa bekleme süresi",
        "+5 hasar",
        {
          "fork": [
            {
              "name": "Yüksek Voltaj",
              "desc": "Elitlere ve bosslara ×1,5; +%25 alan"
            },
            {
              "name": "Zincir Yıldırım",
              "desc": "Parlama 2 düşmana sıçrar; +3 hasar"
            }
          ]
        },
        "+6 hasar ve +%15 alan"
      ]
    },
    "heatWave": {
      "description": "Kavurucu sıcak bir rüzgâr dışarı doğru eserek düşmanların içinden geçer ve onları geri iter. Sık sık yakar.",
      "upgrades": [
        "+5 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Siroko",
              "desc": "Yerde ateş bırakır; %30 daha güçlü yakar"
            },
            {
              "name": "Patlama Dalgası",
              "desc": "Devrilen düşmanlar patlar; +5 hasar"
            }
          ]
        },
        "0,3 sn daha kısa bekleme süresi",
        "+6 hasar",
        {
          "fork": [
            {
              "name": "Termal Parlama",
              "desc": "Durum etkisindekilere ×1,35; +%25 alan"
            },
            {
              "name": "Hava Akımı",
              "desc": "Düşmanları içeri çeker; dalga geri döner"
            }
          ]
        },
        "+7 hasar ve +%15 alan"
      ]
    },
    "thunderFang": {
      "description": "En yakındaki düşmanı elektrikli dişlerle ısırır; felç edebilir. Zaten felç olmuş bir düşman bunun yerine iki kat hasar alır.",
      "upgrades": [
        "+5 hasar",
        "+%15 felç şansı",
        {
          "fork": [
            {
              "name": "Çifte Diş",
              "desc": "Durum etkisindekilere ×1,35; +1 düşman daha ısırır"
            },
            {
              "name": "Kıvılcım",
              "desc": "Devrilen düşmanlar patlar; +4 hasar"
            }
          ]
        },
        "0,2 sn daha kısa bekleme süresi",
        "+6 hasar",
        {
          "fork": [
            {
              "name": "Statik Yük",
              "desc": "Yerde kıvılcımlar bırakır; %25 daha uzun süre şoklar"
            },
            {
              "name": "Yay Isırığı",
              "desc": "Isırık 2 düşmana sıçrar; +%20 alan"
            }
          ]
        },
        "+1 düşman daha ısırır ve +4 hasar"
      ]
    },
    "lavaPlume": {
      "description": "Etrafında kızıl alevler bir halka halinde püskürür ve dokunduğu her şeyi yakar. Sık sık yakar.",
      "upgrades": [
        "+5 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Magma Göleti",
              "desc": "Yerde lav bırakır; %30 daha güçlü yakar"
            },
            {
              "name": "Püskürme",
              "desc": "Devrilen düşmanlar patlar; +5 hasar"
            }
          ]
        },
        "0,3 sn daha kısa bekleme süresi",
        "+6 hasar",
        {
          "fork": [
            {
              "name": "Kaldera",
              "desc": "Elitlere ve bosslara ×1,5; +%25 alan"
            },
            {
              "name": "Gayzer",
              "desc": "Püskürme 2 düşmana sıçrar; +3 hasar"
            }
          ]
        },
        "+7 hasar ve +%15 alan"
      ]
    },
    "auroraBeam": {
      "description": "En yakındaki düşmana parıldayan gökkuşağı renginde bir ışın ateşler ve hattı süpürerek çarptığı her şeyi zayıflatır.",
      "upgrades": [
        "+4 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Kuzey Işıkları",
              "desc": "Durum etkisindekilere ×1,35; +1 ışın"
            },
            {
              "name": "Prizmatik Patlama",
              "desc": "Devrilen düşmanlar patlar; +4 hasar"
            }
          ]
        },
        "0,2 sn daha kısa bekleme süresi",
        "+5 hasar",
        {
          "fork": [
            {
              "name": "Kutup Işıması",
              "desc": "+%25 zayıflatma şansı; geride parıldayan zemin bırakır"
            },
            {
              "name": "Gökkuşağı Kırılması",
              "desc": "Işın çarptığında bölünür; +%20 alan"
            }
          ]
        },
        "+1 ışın ve +4 hasar"
      ]
    },
    "meteorBeam": {
      "description": "Bir anlığına kozmik enerji toplar, ardından ileri doğru gerisinde yanan bir krater bırakan devasa bir göktaşı fırlatır.",
      "upgrades": [
        "+8 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Süpernova",
              "desc": "Devrilen düşmanlar patlar; +8 hasar"
            },
            {
              "name": "Yıldız Işığı",
              "desc": "0,4 sn daha hızlı şarj olur; +1 göktaşı"
            }
          ]
        },
        "0,4 sn daha kısa bekleme süresi",
        "+10 hasar",
        {
          "fork": [
            {
              "name": "Çarpma Krateri",
              "desc": "Elitlere ve bosslara ×1,5; krater +2 sn daha uzun kalır"
            },
            {
              "name": "Kozmik Toz",
              "desc": "Patlama 2 düşmana sıçrar; +%25 alan"
            }
          ]
        },
        "+12 hasar ve +%20 alan"
      ]
    },
    "icyWind": {
      "description": "Önüne doğru geniş bir koni halinde esen dondurucu rüzgâr, içinden geçtiği tüm düşmanları yavaşlatır.",
      "upgrades": [
        "+3 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Bora",
              "desc": "Yerde kar bırakır; %30 daha sert yavaşlatır"
            },
            {
              "name": "Buz Şoku",
              "desc": "Devrilen düşmanlar patlar; +3 hasar"
            }
          ]
        },
        "0,2 sn daha kısa bekleme süresi",
        "+4 hasar",
        {
          "fork": [
            {
              "name": "Kutup Girdabı",
              "desc": "Durum etkisindekilere ×1,35; daha geniş koni"
            },
            {
              "name": "Dondurucu Esinti",
              "desc": "Rüzgâr 2 düşmana sıçrar; +%20 alan"
            }
          ]
        },
        "+5 hasar ve +%15 alan"
      ]
    },
    "ironHead": {
      "description": "Bir saniyeliğine sertleşerek daha az hasar alır, ardından önündeki düşmanlara kafa atarak çarpar.",
      "upgrades": [
        "+6 hasar",
        "+0,5 sn daha uzun sürer",
        {
          "fork": [
            {
              "name": "Şarapnel",
              "desc": "+4 parça; çelik patlamasıyla devrilen düşmanlar patlar"
            },
            {
              "name": "Çelik Refleks",
              "desc": "Bekleme süresi −0,8 sn ve tekrar sertleşir; -4 hasar"
            }
          ]
        },
        "+8 hasar",
        "+0,5 sn daha uzun sürer",
        {
          "fork": [
            {
              "name": "Sert Kafa",
              "desc": "+8 hasar; darbe 2 komşuya sıçrar"
            },
            {
              "name": "Gözdağı",
              "desc": "+%25 irkiltme şansı; geride çelik bir iz bırakır"
            }
          ]
        },
        "+10 hasar ve bekleme süresi 0,5 sn daha kısa"
      ]
    },
    "psystrike": {
      "description": "Etrafında toplanan psişik küreler farklı düşmanlara doğru fırlar; kalkanlar dahil her şeyin içinden geçer.",
      "upgrades": [
        "+1 küre",
        "+5 hasar",
        {
          "fork": [
            {
              "name": "Geri Dönüş",
              "desc": "Küreler geri dönüp tekrar çarpar; +3 hasar"
            },
            {
              "name": "Zihin Kilidi",
              "desc": "+1 küre ve hedefe yönelirler; -3 hasar"
            }
          ]
        },
        "Bekleme süresi 0,2 sn daha kısa",
        "+6 hasar",
        {
          "fork": [
            {
              "name": "Çifte Dalga",
              "desc": "+1 küre; arkaya doğru da ateşler"
            },
            {
              "name": "Bölünme",
              "desc": "Çarptığında 2'ye bölünür; +5 hasar"
            }
          ]
        },
        "+1 küre ve +5 hasar"
      ]
    },
    "payDay": {
      "description": "En yakındaki düşmanlara madeni paralar fırlatır. Her vuruş yere bir 10₽ düşürebilir (koşu başına en fazla 120).",
      "upgrades": [
        "+1 madeni para",
        "+3 hasar",
        {
          "fork": [
            {
              "name": "Büyük İkramiye",
              "desc": "+%3 ₽ şansı ve +2 hasar; devrilen düşmanlar patlar"
            },
            {
              "name": "Bozuk Para",
              "desc": "Çarptığında bölünen +2 para; -2 hasar"
            }
          ]
        },
        "Bekleme süresi 0,15 sn daha kısa",
        "+4 hasar",
        {
          "fork": [
            {
              "name": "Para Yağmuru",
              "desc": "+2 para ve hemen ardından tekrar fırlatır (%50)"
            },
            {
              "name": "Sekme",
              "desc": "+4 hasar ve +%2 ₽; paralar seker"
            }
          ]
        },
        "+1 madeni para ve +3 hasar"
      ]
    },
    "thief": {
      "description": "Gölge bir pençe menzildeki düşmanlara vurur; öncelik Alfa ve boss düşmanlardadır (onlara +%30 hasar). Alfa veya bossların taşıdığı eşyayı çalabilir: Düşman başına bir kez olmak üzere bir eşya ve 50₽.",
      "upgrades": [
        "+5 hasar",
        "+1 pençe",
        {
          "fork": [
            {
              "name": "Yankesici",
              "desc": "+1 pençe; darbe 2 komşuya sıçrar"
            },
            {
              "name": "Göz Koyma",
              "desc": "+4 hasar; vurulan hasarın bir kısmıyla iyileşir"
            }
          ]
        },
        "Bekleme süresi 0,15 sn daha kısa",
        "+6 hasar",
        {
          "fork": [
            {
              "name": "Düşürme",
              "desc": "+6 hasar; elitlerde ve bosslarda daha güçlüdür"
            },
            {
              "name": "Gece Kesisi",
              "desc": "+%30 alan; devrilen düşmanlar patlar"
            }
          ]
        },
        "+1 pençe ve +5 hasar"
      ]
    },
    "protect": {
      "description": "Her 12 sn'de bir seni 1 sn boyunca koruyan bir balon belirir: Hiçbir darbe geçemez ve dokunan her şey geriye savrulur.",
      "upgrades": [
        "+0,2 sn daha uzun sürer",
        "Bekleme süresi 1 sn daha kısa",
        {
          "fork": [
            {
              "name": "Dikenli Kalkan",
              "desc": "+8 hasar; balonun devirdiği düşmanlar patlar"
            },
            {
              "name": "Sezi",
              "desc": "+0,3 sn daha uzun sürer ve hemen ardından tekrar kalkan açar"
            }
          ]
        },
        "+0,2 sn daha uzun sürer",
        "Bekleme süresi 1 sn daha kısa",
        {
          "fork": [
            {
              "name": "Zehirli Sığınak",
              "desc": "+6 hasar; balon vuruşlarıyla iyileşir"
            },
            {
              "name": "Hızlı Koruma",
              "desc": "Bekleme süresi −1,5 sn ve +%20 alan; itme etkisi sıçrar"
            }
          ]
        },
        "+0,3 sn daha uzun sürer ve bekleme süresi 1 sn daha kısa"
      ]
    },
    "hyperBeam": {
      "description": "Bir anlığına şarj olur, ardından en yakındaki düşmana doğru hattındaki her şeye peş peşe vuran devasa bir ışın ateşler. Sonrasında toparlanmak için bir an hareketsiz kalırsın.",
      "upgrades": [
        "+8 hasar",
        "Bekleme süresi 0,8 sn daha kısa",
        {
          "fork": [
            {
              "name": "Aşırı Yükleme",
              "desc": "+12 hasar; devrilen düşmanlar patlar"
            },
            {
              "name": "Kavrulmuş Hat",
              "desc": "+%25 alan; yeri yanar halde bırakır"
            }
          ]
        },
        "+10 hasar",
        "Bekleme süresi 0,8 sn daha kısa",
        {
          "fork": [
            {
              "name": "Giga Işın",
              "desc": "+10 hasar; elitlerde ve bosslarda daha güçlüdür"
            },
            {
              "name": "Çifte Işın",
              "desc": "+1 ışın ve darbe sıçrar; -6 hasar"
            }
          ]
        },
        "+14 hasar ve +%15 alan"
      ]
    },
    "rainDance": {
      "description": "Dans ederek 40 sn boyunca yağmur çağırırsın; koşunun normal havası yağmur bitince geri döner. Sürdüğü müddetçe etrafındaki düşmanların üzerine ağır damlalar iner. Yağmurda Su türü saldırılar %50 daha sert, Ateş türü saldırılar ise daha zayıf vurur (düşmanlarınki de dahil).",
      "upgrades": [
        "+2 hasar",
        "Yağmur +5 sn daha uzun sürer",
        {
          "fork": [
            {
              "name": "Sağanak",
              "desc": "Yağmur +15 sn daha uzun sürer ve +1 damla; darbe komşulara sıçrar"
            },
            {
              "name": "Huzurlu Yağmur",
              "desc": "Üzerine yağdığı sürece saniyede %0,8 Can yeniler; damlalar hasarıyla iyileştirir"
            }
          ]
        },
        "Bekleme süresi 8 sn daha kısa",
        "+3 hasar",
        {
          "fork": [
            {
              "name": "Fırtına",
              "desc": "+4 hasar; devrilen düşmanlar patlar"
            },
            {
              "name": "Tufan",
              "desc": "+%40 alan; damlalar yerde hasar veren su birikintileri bırakır"
            }
          ]
        },
        "+1 damla ve +2 hasar"
      ]
    },
    "sunnyDay": {
      "description": "40 sn boyunca yakıcı bir güneş çağırırsın; koşunun normal havası güneş bitince geri döner. Sürdüğü müddetçe etrafındaki düşmanların üzerine güneş ışınları iner. Güneş altında Ateş türü saldırılar %50 daha sert, Su türü saldırılar ise daha zayıf vurur (düşmanlarınki de dahil).",
      "upgrades": [
        "+2 hasar",
        "Güneş +5 sn daha uzun sürer",
        {
          "fork": [
            {
              "name": "Uzun Yaz",
              "desc": "Güneş +15 sn daha uzun sürer ve +1 ışın; düştüğü yer yanar"
            },
            {
              "name": "Kavurucu Güneş",
              "desc": "Etrafındaki aydınlık halkaya basanları yakar; ışınlar durum etkisindekilere daha sert vurur"
            }
          ]
        },
        "Bekleme süresi 8 sn daha kısa",
        "+3 hasar",
        {
          "fork": [
            {
              "name": "Güneş Işını",
              "desc": "+4 hasar; elitlerde ve bosslarda daha güçlüdür"
            },
            {
              "name": "Parlama",
              "desc": "+%40 alan; devrilen düşmanlar patlar"
            }
          ]
        },
        "+1 ışın ve +2 hasar"
      ]
    },
    "swordsDance": {
      "description": "Etrafında kılıçlar döner ve bu dans 5 sn boyunca sana +%8 hasar kazandırır. Süresi bitmeden tekrar dans edersen etki birikir (en fazla 3 kez).",
      "upgrades": [
        "Bekleme süresi 1 sn daha kısa",
        "+1,2 sn daha uzun sürer",
        {
          "fork": [
            {
              "name": "Daha Keskin Kılıçlar",
              "desc": "5 kata kadar birikir ve +2 hasar; ikinci bir kılıç halkası"
            },
            {
              "name": "Uzun Dans",
              "desc": "+3 sn daha uzun sürer; kılıçlar elitlere ve bosslara daha sert vurur"
            }
          ]
        },
        "Bekleme süresi 0,5 sn daha kısa",
        "+3 hasar",
        {
          "fork": [
            {
              "name": "Çelik Girdap",
              "desc": "+2 kılıç; devrilen düşmanlar patlar"
            },
            {
              "name": "Vampir Kılıç",
              "desc": "+2 sn daha uzun sürer ve +2 hasar; kılıçlar hasarıyla iyileştirir"
            }
          ]
        },
        "+3 hasar ve +1 kılıç"
      ]
    },
    "drainPunch": {
      "description": "En yakındaki düşmana vurulan hasarın %35'i kadar seni iyileştiren parıldayan bir yumruk atar (saniyede en fazla Canının %4'ü kadar).",
      "upgrades": [
        "+4 hasar",
        "Bekleme süresi 0,1 sn daha kısa",
        {
          "fork": [
            {
              "name": "Yumruk Yağmuru",
              "desc": "+%40 alan ve yelpaze şeklinde +1 yumruk; hemen ardından tekrar yumruk atar (%50)"
            },
            {
              "name": "Sülük",
              "desc": "Hasarın +%20'si kadar daha iyileştirir; canı az kalanları bitirir"
            }
          ]
        },
        "+5 hasar",
        "Bekleme süresi 0,1 sn daha kısa",
        {
          "fork": [
            {
              "name": "Patlayıcı Yumruk",
              "desc": "+6 hasar; devrilen düşmanlar patlar"
            },
            {
              "name": "Tam Sömürü",
              "desc": "Hasarın +%10'u kadar daha iyileştirir ve +3 hasar; elitlerde ve bosslarda daha güçlüdür"
            }
          ]
        },
        "+6 hasar ve +%15 alan"
      ]
    },
    "thunderWave": {
      "description": "En yakındaki düşmana doğru statik bir koni yayarak üzerinden geçtiği herkesi 2 sn boyunca felç eder (bosslar etkisini çabuk atlatır).",
      "upgrades": [
        "Bekleme süresi 0,3 sn daha kısa",
        "+3 hasar",
        {
          "fork": [
            {
              "name": "Geniş Dalga",
              "desc": "Daha geniş bir koni; kıvılcım komşulara sıçrar"
            },
            {
              "name": "Statik",
              "desc": "Felç +1,5 sn daha uzun sürer; durum etkisindekilere daha sert vurur"
            }
          ]
        },
        "Bekleme süresi 0,3 sn daha kısa",
        "+3 hasar",
        {
          "fork": [
            {
              "name": "Çifte Dalga",
              "desc": "Daha da geniş bir koni ve +%20 alan; hemen ardından tekrar dalga gelir (%50)"
            },
            {
              "name": "Şok",
              "desc": "Felç +1 sn daha uzun sürer ve +4 hasar; elitlerde ve bosslarda daha güçlüdür"
            }
          ]
        },
        "Felç +0,5 sn daha uzun sürer ve +3 hasar"
      ]
    },
    "fly": {
      "description": "Her 7 sn'de bir anlığına göğe havalanırsın: Hiçbir darbe sana değmez ve düşmanlar seni gözden kaybeder. Hareket etmeyi sürdürürsün ve inişte sertçe yere inerek etraftaki herkese hasar verip onları savurursun.",
      "upgrades": [
        "+6 hasar",
        "Bekleme süresi 0,7 sn daha kısa",
        {
          "fork": [
            {
              "name": "Pike Bombası",
              "desc": "+%35 alan ve +6 hasar; devrilen düşmanlar patlar"
            },
            {
              "name": "Hızlı Uçuş",
              "desc": "Bekleme süresi 1,5 sn daha kısa; iniş yerde keskin bir rüzgâr bırakır"
            }
          ]
        },
        "+8 hasar",
        "Bekleme süresi 0,7 sn daha kısa",
        {
          "fork": [
            {
              "name": "Hava Ası",
              "desc": "+10 hasar ve +%15 alan; elitlerde ve bosslarda daha güçlüdür"
            },
            {
              "name": "Süzülüş",
              "desc": "Bekleme süresi 1 sn daha kısa; darbe komşulara sıçrar"
            }
          ]
        },
        "+10 hasar"
      ]
    },
    "ragingFury": {
      "description": "Alevlere bürünerek öfkeyle koşarsın: Yürürken sana dokunan herkes yanar, geçtiğin yol yanan bir ize dönüşür ve birkaç adımda bir bu öfke alevden bir halkayla patlar. Hareketsiz durursan yalnızca tüter. Yakabilir.",
      "upgrades": [
        "+4 hasar",
        "Alevler +0,6 sn daha uzun sürer ve +%15 alan",
        "+5 hasar ve +%15 yanma şansı",
        "+5 hasar ve +%20 alan"
      ]
    },
    "seedFlare": {
      "description": "Üzerinde küçük bir güneş büyür ve tam bir daireyi süpüren ışınlarla patlar; bittiği yerde ışık tohumları patlayarak açar. Yakıcı güneşte ışınlar etrafı iki kez süpürür.",
      "upgrades": [
        "+10 hasar",
        "+1 ışın",
        "+%20 alan",
        "+12 hasar ve 0,4 sn daha kısa bekleme süresi"
      ]
    },
    "waterSpout": {
      "description": "Senden fışkıran bir gayzer, görüş alanındaki en çok yaralanmış düşmanların üzerine ağır damlalar yağdırır. Canın ne kadar çoksa o kadar sert yağar; Canı %50'nin altındaki düşmanlar iki kat hasar alır.",
      "upgrades": [
        "+2 damla",
        "+8 hasar",
        "+%25 alan",
        "+2 damla ve 0,2 sn daha kısa bekleme süresi"
      ]
    },
    "electroDrift": {
      "description": "Senden dışarı doğru genişleyen bir spiral halinde elektrik küreleri yayılır; aralarındaki yıldırımlar araya giren herkesi çarpar. Ne kadar hızlıysan o kadar büyür ve güçlenirler. Felç edebilir.",
      "upgrades": [
        "+1 küre",
        "+7 hasar",
        "+0,4 sn daha uzun sürer ve +%20 alan",
        "+1 küre ve +%15 felç şansı"
      ]
    },
    "sludgeWave": {
      "description": "Senden dışarı doğru peş peşe balçık dalgaları yayılır ve zehirleyebilir. Zaten zehirlenmiş düşmanlar iki kat hasar alır ve patlayarak etraftakileri zehirleyen zehirli bir gayzere dönüşür.",
      "upgrades": [
        "+3 hasar",
        "+1 dalga",
        "+%20 alan ve +%15 zehirleme şansı",
        "+3 hasar ve 0,3 sn daha kısa bekleme süresi"
      ]
    },
    "explosion": {
      "description": "Manuel: Mevcut Canının beşte birini harcayarak devasa bir patlama yaratır ve içinde sen güvendesindir. Yendiği her düşman da patlar ve bu patlamalar daha fazlasını devirebilir.",
      "upgrades": [
        "+25 hasar",
        "+%15 alan",
        "1,2 sn daha kısa bekleme süresi",
        "+30 hasar ve +%15 alan"
      ]
    },
    "oblivionWing": {
      "description": "Ardı sıra kızıl kanatlar açılır ve en yakındaki düşmanlara ışınlar saçarak hasarın yarısını Can olarak emer. Bir anlığına hareketsiz durursan iki kat fazla ışın ateşler.",
      "upgrades": [
        "+9 hasar",
        "+1 ışın",
        "0,2 sn daha kısa bekleme süresi",
        "+1 ışın ve +9 hasar"
      ]
    },
    "skyUppercut": {
      "description": "Focus Punch gibi şarj olur (darbe almak sıfırlar), ancak yumruk aşağıdan gelir: Görüş alanındaki en zorlu düşmanların (öncelik bosslarda) altından etrafında şok dalgasıyla devasa bir yumruk fırlar.",
      "upgrades": [
        "+20 hasar",
        "+1 yumruk",
        "+%20 alan",
        "+24 hasar ve +1 yumruk"
      ]
    },
    "gearGrind": {
      "description": "Dev dişliler en yakındaki düşmanlara doğru yuvarlanarak önlerindeki her şeyi biçer ve sana geri döner. Gyro Ball gibi, ne kadar yavaş hareket edersen o kadar sert çarparlar.",
      "upgrades": [
        "+6 hasar",
        "+%20 alan",
        "+1 dişli",
        "+7 hasar ve 0,25 sn daha kısa bekleme süresi"
      ]
    },
    "kowtowCleave": {
      "description": "Sucker Punch gibi etrafındaki zemini kollar: İçeri adım atan bir düşman, üzerine doğru geniş bir kavisle inen kılıç biçişiyle vurulur. Asla ıskalamaz ve korumaları delip geçer.",
      "upgrades": [
        "+10 hasar",
        "+1 biçme",
        "+%20 alan",
        "+11 hasar ve 0,12 sn daha kısa bekleme süresi"
      ]
    },
    "hyperspaceHole": {
      "description": "Görüş alanındaki en yoğun grupların üzerinde uzayda halkalar açılır ve etraftaki düşmanları içine çeker; ardından her biri patlayarak çöker.",
      "upgrades": [
        "+14 hasar",
        "+1 halka",
        "+%20 alan ve +0,3 sn daha uzun çekerler",
        "+16 hasar ve 0,5 sn daha kısa bekleme süresi"
      ]
    },
    "thousandArrows": {
      "description": "Etrafındaki yerden bir ok yağmuru yükselir ve menzildeki en uzaktaki düşmanların tepesine yağar. Uçanları yere indirir: Uçan düşmanlar iki kat hasar alır.",
      "upgrades": [
        "+3 ok",
        "+9 hasar",
        "+%25 alan",
        "+3 ok ve 0,2 sn daha kısa bekleme süresi"
      ]
    },
    "stoneAxe": {
      "description": "Büyük bir taş balta en yakındaki düşmanın üzerine iner ve çarpmanın etkisiyle Stealth Rock misali etrafa havada asılı duran kıymıklar saçar: İçine yürüyen her düşmana hasar verirler.",
      "upgrades": [
        "+10 hasar",
        "+1 kıymık",
        "Kıymıklar +4 sn daha uzun kalır ve +%15 alan",
        "+12 hasar ve +1 kıymık"
      ]
    },
    "firstImpression": {
      "description": "Manuel: Her biri sıradaki en yakın düşmanın içinden geçen zikzak atılmalar serisi; boyunca dokunulmaz kalırsın ve indiğin yerde bir patlamayla biter.",
      "upgrades": [
        "+9 hasar",
        "+1 atılma",
        "0,3 sn daha kısa bekleme süresi",
        "+10 hasar ve +1 atılma"
      ]
    },
    "breakingSwipe": {
      "description": "Kuyruğun etrafında tam bir turdan fazla savrulur: Menzildeki her düşman darbe alır, zayıflar (temas hasarı azalır) ve geriye savrularak çarptığı diğer düşmanlara da hasar verir.",
      "upgrades": [
        "+8 hasar",
        "+%20 alan",
        "0,3 sn daha kısa bekleme süresi",
        "+10 hasar ve +%15 alan"
      ]
    },
    "glacialLance": {
      "description": "Devasa buz mızrakları düz bir hat boyunca sürüyü delip geçer: Canı %25'in altındaki sıradan düşmanları anında parçalar, diğerlerini dondurabilir; menzilin sonunda ise ayaza bürünerek patlar.",
      "upgrades": [
        "+1 mızrak",
        "+10 hasar",
        "+%20 alan ve +%15 donma şansı",
        "+1 mızrak ve 0,3 sn daha kısa bekleme süresi"
      ]
    },
    "braveBird": {
      "description": "Ateş mavisi kanatlara bürünerek en çok düşmanın bulunduğu hatta doğru dimdik dalar. Çarpılan her düşman azami Canının %2'sine mal olur (dalış başına en fazla %6, asla son Can puanını almaz).",
      "upgrades": [
        "+6 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Sert İniş",
              "desc": "Devrilen düşmanlar patlar; +6 hasar"
            },
            {
              "name": "Tüy İzi",
              "desc": "Geçtiği hatta kesici zemin bırakır; 0,3 sn daha kısa bekleme süresi"
            }
          ]
        },
        "+6 hasar",
        "0,3 sn daha kısa bekleme süresi",
        {
          "fork": [
            {
              "name": "Voltaj Kanadı",
              "desc": "Kıvılcımlar yakındaki düşmanlara sıçrar; +4 hasar"
            },
            {
              "name": "İkinci Uçuş",
              "desc": "Hemen ardından tekrar dalar (%50); -4 hasar"
            }
          ]
        },
        "+8 hasar ve +%20 alan"
      ]
    },
    "weatherBall": {
      "description": "En yakındaki düşmana hava durumuna göre değişen bir küre fırlatır: Açık havada Normal, güneşte yakan Ateş, yağmurda yavaşlatan Su, kum fırtınasında zayıflatan Kaya ve karda dondurabilen Buz. Herhangi bir hava durumu altındayken ×1,5 vurur.",
      "upgrades": [
        "+4 hasar",
        "+1 top",
        {
          "fork": [
            {
              "name": "Soğuk Cephe",
              "desc": "Devrilen düşmanlar patlar; +4 hasar"
            },
            {
              "name": "Yerel Hava",
              "desc": "Düştüğü yerde hava durumuna özel zemin bırakır; +%25 alan"
            }
          ]
        },
        "0,25 sn daha kısa bekleme süresi",
        "+4 hasar ve +%15 alan",
        {
          "fork": [
            {
              "name": "Top Yağmuru",
              "desc": "+1 top; elitlere ve bosslara ×1,5"
            },
            {
              "name": "Çifte Cephe",
              "desc": "Hemen ardından tekrar fırlatır (%50); -3 hasar"
            }
          ]
        },
        "+5 hasar ve +%15 etki şansı"
      ]
    },
    "accelerock": {
      "description": "Senden fırlayan bir kaya silüeti en yakındaki düşmana anında çarpar ve yoluna çıkan herkese de vurur. Çok kısa bekleme süresine sahiptir.",
      "upgrades": [
        "+2 hasar",
        "0,08 sn daha kısa bekleme süresi",
        {
          "fork": [
            {
              "name": "Parçacıklar",
              "desc": "Taş parçacıkları yakındaki düşmanlara sıçrar; +1 hasar"
            },
            {
              "name": "Darbe",
              "desc": "Devrilen düşmanlar patlar; +3 hasar"
            }
          ]
        },
        "+3 hasar",
        "+1 atılma",
        {
          "fork": [
            {
              "name": "Sürü",
              "desc": "+1 atılma ve durum etkisindekilere ×1,35; -1 hasar"
            },
            {
              "name": "Kaya Yankısı",
              "desc": "Hemen ardından tekrar atılır (%50); daha kısa bekleme süresi"
            }
          ]
        },
        "+4 hasar ve 0,06 sn daha kısa bekleme süresi"
      ]
    },
    "zapCannon": {
      "description": "Yavaş ve devasa bir elektrik küresi sürünün içinden süzülür; çarptığı her şeyi çarparak daima felç eder.",
      "upgrades": [
        "+3 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Güdümlü",
              "desc": "Küre en yakındaki düşmana yönelir; +2 hasar"
            },
            {
              "name": "Elektrik Alanı",
              "desc": "Geçtiği hat boyunca elektrikli zemin bırakır; +%15 alan"
            }
          ]
        },
        "0,4 sn daha kısa bekleme süresi",
        "+4 hasar",
        {
          "fork": [
            {
              "name": "Voltaik Yay",
              "desc": "Kıvılcımlar yakındaki düşmanlara sıçrar; +2 hasar"
            },
            {
              "name": "Çifte Top",
              "desc": "+1 küre ve vuruşlar seni iyileştirir; -3 hasar"
            }
          ]
        },
        "+5 hasar ve +%20 alan"
      ]
    },
    "aerialAce": {
      "description": "En yakındaki düşmanlara asla ıskalamayan çevik rüzgâr kesikleri savurur: Korumaları kesip geçer ve dirençli eşleşmelere bile normal vurur.",
      "upgrades": [
        "+3 hasar",
        "+1 kesiş",
        {
          "fork": [
            {
              "name": "Kuş Sürüsü",
              "desc": "+1 kesiş; elitlere ve bosslara ×1,5"
            },
            {
              "name": "Bitirici Darbe",
              "desc": "Devrilen düşmanlar patlar; +5 hasar"
            }
          ]
        },
        "0,2 sn daha kısa bekleme süresi",
        "+4 hasar",
        {
          "fork": [
            {
              "name": "Çifte Kesik",
              "desc": "Hemen ardından tekrar keser (%50); -3 hasar"
            },
            {
              "name": "Keskin Rüzgâr",
              "desc": "Rüzgâr kıvılcımları yakındaki düşmanlara sıçrar; +2 hasar"
            }
          ]
        },
        "+1 kesiş ve +4 hasar"
      ]
    },
    "crossPoison": {
      "description": "İki zehir kılıcı en yakındaki düşmanın üzerinde X şeklinde kesişir. Zehirleyebilir. Her dört vuruştan biri kritiktir: ×2 hasar.",
      "upgrades": [
        "+4 hasar",
        "+%15 zehirleme şansı",
        {
          "fork": [
            {
              "name": "Zehirli Zemin",
              "desc": "Yerde zehir birikintisi bırakır; +%20 zehirleme şansı"
            },
            {
              "name": "Ölümcül Vuruş",
              "desc": "Devrilen düşmanlar patlar; +6 hasar"
            }
          ]
        },
        "+%20 alan",
        "+1 X",
        {
          "fork": [
            {
              "name": "Çifte Çapraz",
              "desc": "Hemen ardından tekrar keser (%50); -3 hasar"
            },
            {
              "name": "Sıçrayan Toksin",
              "desc": "Zehir kıvılcımları yakındaki düşmanlara sıçrar; +%20 alan"
            }
          ]
        },
        "+6 hasar ve %30 daha güçlü zehir"
      ]
    },
    "bubbleBeam": {
      "description": "En yakındaki düşmana doğru bir baloncuk akımı püskürtür; patlayan her baloncuk hedefini yavaşlatır.",
      "upgrades": [
        "+2 baloncuk",
        "+2 hasar",
        {
          "fork": [
            {
              "name": "Köpük",
              "desc": "Baloncuklar çarptığında 2'ye bölünür; -1 hasar"
            },
            {
              "name": "Güdümlü Baloncuklar",
              "desc": "Baloncuklar düşmanlara yönelir; daha yavaş uçarlar"
            }
          ]
        },
        "+2 baloncuk",
        "+2 hasar ve +%20 alan",
        {
          "fork": [
            {
              "name": "Sekme",
              "desc": "Baloncuklar başka bir düşmana seker; +1 hasar"
            },
            {
              "name": "Çift Akıntı",
              "desc": "Arkaya doğru da ateşler; +0,1 sn bekleme süresi"
            }
          ]
        },
        "+3 baloncuk ve +1 hasar"
      ]
    },
    "rockBlast": {
      "description": "En yakındaki düşmana peş peşe 2 ila 5 kaya fırlatır (her kullanımda rastgele belirlenir; yükseltmeler sayıyı artırır).",
      "upgrades": [
        "+3 hasar",
        "0,15 sn daha kısa bekleme süresi",
        {
          "fork": [
            {
              "name": "Çakıl",
              "desc": "Kayalar çarptığında 2'ye bölünür; -2 hasar"
            },
            {
              "name": "Sıçrama",
              "desc": "Kayalar başka bir düşmana seker; +3 hasar"
            }
          ]
        },
        "+1 kaya",
        "+4 hasar ve +%15 alan",
        {
          "fork": [
            {
              "name": "Patlayıcı Kaya",
              "desc": "Devrilen düşmanlar patlar; +2 hasar"
            },
            {
              "name": "Güdümlü Kayalar",
              "desc": "Kayalar düşmanlara yönelir; daha yavaş uçarlar"
            }
          ]
        },
        "+1 kaya ve +4 hasar"
      ]
    },
    "cottonSpore": {
      "description": "En büyük kalabalığın üzerine kabarık bir pamuk bulutu çöker ve orada kalır: İçindeki düşmanlar adeta sürünürcesine yavaşlar.",
      "upgrades": [
        "+%20 alan",
        "+1 sn daha uzun sürer",
        {
          "fork": [
            {
              "name": "Daha Çok Pamuk",
              "desc": "Hemen ardından bir bulut daha bırakır (%50); +2 hasar"
            },
            {
              "name": "Statik Pamuk",
              "desc": "Kıvılcımlar yakındaki düşmanlara sıçrar; +3 hasar"
            }
          ]
        },
        "0,6 sn daha kısa bekleme süresi",
        "+%20 alan ve +2 hasar",
        {
          "fork": [
            {
              "name": "İki Bulut",
              "desc": "Başka bir kalabalığa +1 bulut; düşmanları içeri çekerler"
            },
            {
              "name": "Patlayıcı Pamuk",
              "desc": "Devrilen düşmanlar patlar; +%30 alan"
            }
          ]
        },
        "+1,5 sn daha uzun sürer ve +2 hasar"
      ]
    },
    "wildCharge": {
      "description": "Elektrikle çıtırdar, daha hızlı koşarsın ve temas ettiğin her düşmanı çarparsın. Her şok azami Canının %1'ine mal olur (hücum başına en fazla %5).",
      "upgrades": [
        "+4 hasar",
        "+0,4 sn daha uzun sürer",
        {
          "fork": [
            {
              "name": "Kıvılcım İzi",
              "desc": "Koştuğun yerde elektrikli zemin bırakır; +1 hasar"
            },
            {
              "name": "Kısa Devre",
              "desc": "Devrilen düşmanlar patlar; +4 hasar"
            }
          ]
        },
        "0,5 sn daha kısa bekleme süresi",
        "+5 hasar ve +%10 felç şansı",
        {
          "fork": [
            {
              "name": "İkinci Soluk",
              "desc": "+0,6 sn daha uzun sürer ve elektrik şokları seni iyileştirir"
            },
            {
              "name": "Zincir Yıldırım",
              "desc": "Kıvılcımlar yakındaki düşmanlara sıçrar; +2 hasar"
            }
          ]
        },
        "+6 hasar ve +%20 alan"
      ]
    },
    "playRough": {
      "description": "En yakındaki düşmanın üzerinde çizgi film misali bir kavga bulutu patlak verir (yıldızlar, yumruklar, bir kalp): Onu zayıflatabilecek seri darbeler indirir (daha az temas hasarı verir).",
      "upgrades": [
        "+2 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Yaygara",
              "desc": "Başka bir düşmana +1 bulut; durum etkisindekilere ×1,35"
            },
            {
              "name": "Kirli Dövüş",
              "desc": "Devrilen düşmanlar patlar; +2 hasar"
            }
          ]
        },
        "0,3 sn daha kısa bekleme süresi",
        "+3 hasar",
        {
          "fork": [
            {
              "name": "Rövanş",
              "desc": "Hemen ardından tekrar kavga çıkarır (%50); -1 hasar"
            },
            {
              "name": "Kışkırtma",
              "desc": "+%25 zayıflatma şansı, +%20 alan; düşmanları içeri çeker"
            }
          ]
        },
        "+1 bulut ve +2 hasar"
      ]
    },
    "spore": {
      "description": "Etrafındaki spor bulutu düşmanları uyutur. Hasar vermediğinden yalnızca başka bir saldırı çarptığında uyanırlar.",
      "upgrades": [
        "+%20 alan",
        "+%10 uyutma şansı",
        {
          "fork": [
            {
              "name": "Etki Sporu",
              "desc": "Uyuyanlar zehirlenir de"
            },
            {
              "name": "Ağır Spor",
              "desc": "+%30 alan; uyuyanlar yavaş uyanır"
            }
          ]
        },
        "Uyku +0,5 sn daha uzun sürer",
        "0,8 sn daha kısa bekleme süresi",
        {
          "fork": [
            {
              "name": "Çifte Spor",
              "desc": "Hemen ardından tekrar yayılır; 0,4 sn daha kısa bekleme süresi"
            },
            {
              "name": "Rüya Tozu",
              "desc": "Uyuyanlar işaretlenir ve daha fazla hasar alır"
            }
          ]
        },
        "+%20 alan ve uyku +0,5 sn daha uzun sürer"
      ]
    },
    "waterfall": {
      "description": "En yakındaki düşmana doğru bir hat boyunca peş peşe su sütunları yükselir ve çarptıklarını irkiltir. Magikarp iken zayıftır; evrimleşince sele dönüşür.",
      "upgrades": [
        "+4 hasar",
        "+1 sütun",
        {
          "fork": [
            {
              "name": "Uzun Şelale",
              "desc": "+2 sütun; elitlere ve bosslara ×1,5"
            },
            {
              "name": "Dip Akıntısı",
              "desc": "Devrilen düşmanlar patlar; +5 hasar"
            }
          ]
        },
        "0,3 sn daha kısa bekleme süresi",
        "+5 hasar ve +%15 alan",
        {
          "fork": [
            {
              "name": "Çifte Düşüş",
              "desc": "Hemen ardından tekrar yükselir (%50); -3 hasar"
            },
            {
              "name": "Sıçramalar",
              "desc": "Su damlacıkları yakındaki düşmanlara sıçrar; +%20 alan"
            }
          ]
        },
        "+7 hasar ve +1 sütun"
      ]
    },
    "lastResort": {
      "description": "En yakındaki düşmanın üzerine devasa bir yıldız darbesi indirir. Tam gücüne ancak 4 saldırı daha öğrenildiğinde ulaşır (öncesinde yalnızca hafif bir dokunuştur).",
      "upgrades": [
        "+8 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Ya Hep Ya Hiç",
              "desc": "+10 hasar; elitlere ve bosslara ×1,5"
            },
            {
              "name": "Süpernova",
              "desc": "Devrilen düşmanlar patlar; +%30 alan"
            }
          ]
        },
        "0,4 sn daha kısa bekleme süresi",
        "+10 hasar",
        {
          "fork": [
            {
              "name": "Dinlenmek Yok",
              "desc": "0,3 sn daha kısa bekleme süresi; canı az kalan düşmanları bitirir"
            },
            {
              "name": "Bis",
              "desc": "Hemen ardından tekrar çarpar (%50); -8 hasar"
            }
          ]
        },
        "+12 hasar ve +%20 alan"
      ]
    },
    "firePledge": {
      "description": "Etrafında bir halka halinde ateş sütunları patlar ve içindeki zemin, üzerinde duran herkesi yakan bir ateş denizine dönüşür.",
      "upgrades": [
        "+2 sütun ve +10 hasar",
        "Ateş denizi +1 sn daha uzun sürer ve +%15 alan",
        "+16 hasar ve %25 daha güçlü yakar",
        "+2 sütun ve 0,4 sn daha kısa bekleme süresi"
      ]
    },
    "waterPledge": {
      "description": "Kalabalıkların altında gayzerler fışkırır ve bir gökkuşağı belirir: Parladığı sürece saldırıların +%25 durum etkisi şansı kazanır.",
      "upgrades": [
        "+1 gayzer ve +10 hasar",
        "Gökkuşağı +1,2 sn daha uzun kalır",
        "+%25 alan ve +12 hasar",
        "+2 gayzer ve 0,35 sn daha kısa bekleme süresi"
      ]
    },
    "grassPledge": {
      "description": "Etrafına yayılan ve seninle birlikte hareket eden bir bataklık içindeki her düşmanı yavaşlatırken, yakaladıklarının altından sarmaşık sütunları fışkırır.",
      "upgrades": [
        "+1 sütun ve +7 hasar",
        "+%20 bataklık alanı",
        "+10 hasar",
        "+2 sütun ve 0,3 sn daha kısa bekleme süresi"
      ]
    },
    "fusionFlare": {
      "description": "En büyük kalabalığın tepesine akkor bir kuyruklu yıldız iner, patlar ve zemini tüter halde bırakır. Yakar.",
      "upgrades": [
        "+1 kuyruklu yıldız",
        "+18 hasar ve +%15 alan",
        "Közler +1 sn daha uzun kalır ve +%15 yanma şansı",
        "+1 kuyruklu yıldız ve 0,4 sn daha kısa bekleme süresi"
      ]
    },
    "fusionBolt": {
      "description": "En büyük kalabalığın tepesine yıldırımdan bir kuyruklu yıldız iner, patlar ve zemini çıtırdar halde bırakır. Felç eder.",
      "upgrades": [
        "+1 kuyruklu yıldız",
        "+36 hasar ve +%15 alan",
        "Kıvılcımlar +1 sn daha uzun kalır ve +%15 felç şansı",
        "+1 kuyruklu yıldız ve 0,4 sn daha kısa bekleme süresi"
      ]
    },
    "ionDeluge": {
      "description": "Düşmanların altında iletken su birikintileri belirir: Aralarında uzanan arklarla birlikte üzerindeki herkesi aynı anda çarpar. Yağmurda +1 birikinti.",
      "upgrades": [
        "+1 birikinti",
        "+9 hasar ve birikintiler +1 sn daha uzun kalır",
        "+%25 alan ve +%10 felç şansı",
        "+1 birikinti ve 0,3 sn daha kısa bekleme süresi"
      ]
    },
    "freezeDry": {
      "description": "Etrafına dondurucu bir sis yayılır ve düşmanları dondurur (sonraki darbe iki kat vurarak buzu kırar). Donmuş düşmanlara ×1,4.",
      "upgrades": [
        "+1 sis dalgası",
        "+6 hasar ve +%15 donma şansı",
        "+%25 alan",
        "+%15 alan ve 0,3 sn daha kısa bekleme süresi"
      ]
    },
    "nightmare": {
      "description": "Zehirleyen zincirleme bir Hex ve hemen ardından her hedefi tekrar ısıran bir kurukafa: Durum etkisindekilere ×2, zehirlenmişlerse bir de ×1,5 vurur.",
      "upgrades": [
        "+2 hedef",
        "+14 hasar ve +%15 zehirleme şansı",
        "+%25 menzil ve %25 daha güçlü zehir",
        "+2 hedef ve 0,3 sn daha kısa bekleme süresi"
      ]
    },
    "whirlwind": {
      "description": "Lugia'nın gümüş siklonu en büyük kalabalığın üzerinde yükselip alanda dolaşır, düşmanları fırtınanın gözüne çeker. Hepsini savuran güçlü bir rüzgârla son bulur.",
      "upgrades": [
        "+5 hasar",
        "+%20 alan ve +0,5 sn daha uzun sürer",
        {
          "fork": [
            {
              "name": "İkiz Fırtına",
              "desc": "+1 siklon; -3 hasar"
            },
            {
              "name": "Gök Gürültüsü",
              "desc": "Vuruşlar yakındaki düşmanlara kıvılcım sıçratır; +6 hasar"
            }
          ]
        },
        "0,7 sn daha kısa bekleme süresi ve +5 hasar"
      ]
    },
    "sacredFire": {
      "description": "Ho-Oh'nun kutsal ateşten anka kuşu kalabalığın içinden hızla geçer ve yerde gökkuşağı renginde bir alev hattı bırakır. Sık sık yakar.",
      "upgrades": [
        "+9 hasar",
        "Alevler +0,6 sn daha uzun kalır ve +%15 yanma şansı",
        {
          "fork": [
            {
              "name": "Arındırıcı Alev",
              "desc": "Devrilen düşmanlar alev alarak patlar; +6 hasar"
            },
            {
              "name": "Anka Çifti",
              "desc": "+1 anka kuşu; -5 hasar"
            }
          ]
        },
        "0,5 sn daha kısa bekleme süresi ve +1 anka kuşu"
      ]
    },
    "originPulse": {
      "description": "Kyogre'nin gücü: Senden ekranın ucuna kadar yayılan parıldayan bir su halkası her şeyi geriye iter ve dört bir yana mavi ışık huzmeleri saçar.",
      "upgrades": [
        "+8 hasar",
        "+2 ışın ve +%10 alan",
        {
          "fork": [
            {
              "name": "Çifte Gelgit",
              "desc": "Ardından ikinci bir dalga gelir; +%20 alan"
            },
            {
              "name": "Canlı Akım",
              "desc": "Vuruşlar yakındaki düşmanlara kıvılcım sıçratır; +10 hasar"
            }
          ]
        },
        "0,6 sn daha kısa bekleme süresi ve +2 ışın"
      ]
    },
    "scorchingSands": {
      "description": "Groudon'un sıcaklığı: Düşmanların üzerine doğru kabaran kavurucu bir kum duvarı, gerisinde üzerinde duran herkesi yakan akkor zemin bırakır.",
      "upgrades": [
        "+7 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "İki Dalga",
              "desc": "+1 kum duvarı"
            },
            {
              "name": "Erimiş Kum",
              "desc": "Sıcak zemin +1 sn daha uzun kalır, %30 daha güçlü yakar, devrilenler patlar"
            }
          ]
        },
        "0,4 sn daha kısa bekleme süresi ve +8 hasar"
      ]
    },
    "dragonAscent": {
      "description": "Rayquaza gibi yeşil bir hat çizerek göğe yükselir ve peş peşe en büyük kalabalıkların tepesine bir kuyruklu yıldız gibi dalarsın.",
      "upgrades": [
        "+15 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Üçlü Dalış",
              "desc": "+1 dalış"
            },
            {
              "name": "Meteor Darbesi",
              "desc": "Devrilen düşmanlar patlar; +20 hasar"
            }
          ]
        },
        "0,5 sn daha kısa bekleme süresi ve +1 dalış"
      ]
    },
    "roarOfTime": {
      "description": "Dialga'nın kükremesi zamanı durdurur: Senden tüm ekrana yayılan bir saat kadranı düşmanları dondurur ve onlara yapılan bir sonraki vuruş iki kat hasar verir. Zaman yeniden akmaya başladığında üzerlerine çöker.",
      "upgrades": [
        "+25 hasar",
        "+%15 alan ve zaman +0,3 sn daha uzun durur",
        {
          "fork": [
            {
              "name": "Zaman Bükülmesi",
              "desc": "0,7 sn daha kısa bekleme süresi"
            },
            {
              "name": "Zamanın Sonu",
              "desc": "Devrilen düşmanlar patlar; +30 hasar"
            }
          ]
        },
        "0,6 sn daha kısa bekleme süresi ve +25 hasar"
      ]
    },
    "mistBall": {
      "description": "Latias'ın sis küreleri farklı düşmanlara süzülür ve geride kalan, içindekileri yaralayıp zayıflatan bir sise dönüşerek patlar (daha az temas hasarı verirler).",
      "upgrades": [
        "+7 hasar",
        "+1 küre",
        {
          "fork": [
            {
              "name": "Yoğun Sis",
              "desc": "Her kullanım yarı güçte yankılanır; +%25 alan"
            },
            {
              "name": "Yüklü Sis",
              "desc": "Vuruşlar kıvılcım saçar; sis +1 sn daha uzun kalır ve +5 hasar"
            }
          ]
        },
        "0,4 sn daha kısa bekleme süresi ve +1 küre"
      ]
    },
    "lusterPurge": {
      "description": "Latios'un ışık huzmesi önündeki düşmanları bir o yana bir bu yana süpürür. Savunmalarını düşürebilir (işaretlenirler: daha fazla hasar alırlar).",
      "upgrades": [
        "+9 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Çapraz Işın",
              "desc": "Ters yöne doğru +1 ışın"
            },
            {
              "name": "Kör Edici Işık",
              "desc": "Vuruşlar kıvılcım saçar; +8 hasar, +%30 işaretleme şansı"
            }
          ]
        },
        "0,5 sn daha kısa bekleme süresi ve +9 hasar"
      ]
    },
    "psychoBoost": {
      "description": "Deoxys'in gücü tepedeki bir çekirdekte toplanır ve farklı düşmanları kovalayıp üzerlerinde patlayan psişik kuyruklu yıldızlar ateşler.",
      "upgrades": [
        "+10 hasar",
        "+2 kuyruklu yıldız",
        {
          "fork": [
            {
              "name": "Aşırı Yükleme",
              "desc": "Devrilen düşmanlar patlar; +12 hasar"
            },
            {
              "name": "Kuyruklu Yıldız Yağmuru",
              "desc": "Kıvılcım saçan +2 kuyruklu yıldız; -6 hasar"
            }
          ]
        },
        "0,4 sn daha kısa bekleme süresi ve +10 hasar"
      ]
    },
    "wish": {
      "description": "Jirachi'nin dileği: Tüm ekrandaki düşmanların üzerine bir yıldız yağmuru iner ve vurulan hasarın bir kısmı seni iyileştirir.",
      "upgrades": [
        "+2 yıldız",
        "+10 hasar",
        {
          "fork": [
            {
              "name": "Gerçekleşen Dilek",
              "desc": "Devrilen düşmanlar patlar; +%25 alan"
            },
            {
              "name": "Bin Dilek",
              "desc": "+3 yıldız ve yağmur yarı güçte tekrarlanır; -6 hasar"
            }
          ]
        },
        "0,5 sn daha kısa bekleme süresi ve +2 yıldız"
      ]
    },
    "ancientPower": {
      "description": "Mew'nun gücüyle etrafında kadim taşlar yükselir ve düşmanlara fırlar. Bazen (%30) birkaç saniyeliğine tüm özelliklerin yükselir.",
      "upgrades": [
        "+8 hasar",
        "+2 taş",
        {
          "fork": [
            {
              "name": "İlkel Güç",
              "desc": "Özellikler %60 şansla ve +2 sn daha uzun süreliğine artar"
            },
            {
              "name": "Temel Taşı",
              "desc": "Devrilen düşmanlar patlar; +10 hasar"
            }
          ]
        },
        "0,4 sn daha kısa bekleme süresi ve +8 hasar"
      ]
    },
    "magicalLeaf": {
      "description": "Celebi'nin büyülü yaprakları etrafında bir halka halinde açılır ve her biri kendi hedefini kovalar: Asla ıskalamazlar.",
      "upgrades": [
        "+2 yaprak",
        "+6 hasar",
        {
          "fork": [
            {
              "name": "Zaman Yankısı",
              "desc": "Her kullanım yarı güçte yankılanır; +2 hasar"
            },
            {
              "name": "Yaprak Fırtınası",
              "desc": "+4 yaprak; -4 hasar"
            }
          ]
        },
        "0,3 sn daha kısa bekleme süresi ve +6 hasar"
      ]
    },
    "snowscape": {
      "description": "Articuno'nun kanatları etrafına buz kristallerinden bir kar tanesi saçar. Havada asılı kalarak dokunanları üşütür (yavaşlatır), ardından hepsi birden kırılarak dondurabilir (sonraki darbe iki kat daha sert iner).",
      "upgrades": [
        "+10 hasar",
        "+2 kristal kolu",
        {
          "fork": [
            {
              "name": "Tipi",
              "desc": "Her kullanım yarı güçte yankılanır; +%20 alan ve +%20 donma şansı"
            },
            {
              "name": "Ebedi Buz",
              "desc": "Devrilen düşmanlar patlar; +14 hasar"
            }
          ]
        },
        "0,5 sn daha kısa bekleme süresi ve +10 hasar"
      ]
    },
    "electricTerrain": {
      "description": "Zapdos etrafındaki zemini elektriklendirir: Seninle birlikte hareket eden, her vuruşta içindeki bir düşmanın tepesine yıldırım indiren çıtırtılı bir alan. Felç edebilir.",
      "upgrades": [
        "+7 hasar",
        "+%20 alan ve alan +0,4 sn daha uzun kalır",
        {
          "fork": [
            {
              "name": "Gök Gürültülü Fırtına",
              "desc": "Vuruş başına +1 yıldırım; -4 hasar"
            },
            {
              "name": "Zincirleme Yıldırım",
              "desc": "Vuruşlar yakındaki düşmanlara kıvılcım saçar; +8 hasar"
            }
          ]
        },
        "0,6 sn daha kısa bekleme süresi ve +7 hasar"
      ]
    },
    "overheat": {
      "description": "Moltres'in sıcaklığı gittikçe artar: İlk iki kullanım alevli tüy yelpazeleri fırlatır, üçüncü kullanım ise aşırı ısınıp etrafında ulaştığı her şeyi yakan bir ateş patlamasına dönüşür.",
      "upgrades": [
        "+8 hasar",
        "+2 tüy",
        {
          "fork": [
            {
              "name": "Süpernova",
              "desc": "Devrilen düşmanlar patlar; +%25 alan"
            },
            {
              "name": "Köz İzi",
              "desc": "Tüyler yerde ateş bırakır; 0,2 sn daha kısa bekleme süresi"
            }
          ]
        },
        "0,3 sn daha kısa bekleme süresi ve +6 hasar"
      ]
    },
    "thunderclap": {
      "description": "Raikou'nun yıldırımı gözün seçemeyeceği bir hızla düşmandan düşmana sıçrar ve son düşman, etrafındaki kalabalığı sarsan bir gök gürültüsüyle vurulur. Felç edebilir.",
      "upgrades": [
        "+13 hasar",
        "+2 sıçrama ve +%10 alan",
        {
          "fork": [
            {
              "name": "Yıldırım Hızı",
              "desc": "+4 sıçrama ve +4 hasar"
            },
            {
              "name": "Son Yıldırım",
              "desc": "Devrilen düşmanlar patlar; +16 hasar"
            }
          ]
        },
        "0,5 sn daha kısa bekleme süresi ve +13 hasar"
      ]
    },
    "burningBulwark": {
      "description": "Entei'nin volkanik kabuğu seni sarar: Sıradaki darbeyi engeller ve dokunan her şeyi yakar. Kırıldığında veya süresi bittiğinde iki magma halkası halinde püskürür.",
      "upgrades": [
        "+18 hasar",
        "Kabuk +0,5 sn daha uzun sürer ve +%15 alan",
        {
          "fork": [
            {
              "name": "Yanardağ",
              "desc": "Halka başına +4 gayzer"
            },
            {
              "name": "Canlı Magma",
              "desc": "Devrilen düşmanlar patlar; +20 hasar"
            }
          ]
        },
        "0,7 sn daha kısa bekleme süresi ve +18 hasar"
      ]
    },
    "aquaRing": {
      "description": "Suicune kuzey rüzgârıyla senden dışarı doğru spiral çizerek düşmanları süpürür. Üzerinde koştuğu berrak su, onları geri iten ve seni biraz iyileştiren bir halkaya dönüşür.",
      "upgrades": [
        "+8 hasar",
        "+%15 alan ve halka +0,6 sn daha uzun kalır",
        {
          "fork": [
            {
              "name": "Kuzey Rüzgârı",
              "desc": "Her kullanım yarı güçte yankılanır; +4 halka parçası ve +1 sn daha uzun sürer"
            },
            {
              "name": "Arınmış Su",
              "desc": "Vuruşlar daha çok iyileştirir; +10 hasar"
            }
          ]
        },
        "0,6 sn daha kısa bekleme süresi ve +8 hasar"
      ]
    },
    "rockWrecker": {
      "description": "Regirock en yoğun kalabalığın tepesine devasa bir kaya fırlatır: Yeri sarsarak iner ve doğrudan düşmanların içinden yuvarlanmaya devam eder.",
      "upgrades": [
        "+22 hasar",
        "+%20 alan",
        {
          "fork": [
            {
              "name": "Kaya Düşüşü",
              "desc": "+1 kaya; -10 hasar"
            },
            {
              "name": "Yıkım Kayası",
              "desc": "Devrilen düşmanlar patlar; +26 hasar ve +0,4 sn daha yuvarlanır"
            }
          ]
        },
        "0,5 sn daha kısa bekleme süresi ve +22 hasar"
      ]
    },
    "glaciate": {
      "description": "Regice'ın soğuğu etrafında donmuş havadan bir kubbe gibi yayılarak içindeki her şeyi yavaşlatır. Ardından mutlak sıfıra düşer: İçindeki her şey parçalanır, son demlerindeki sıradan düşmanlar anında kırılır ve dondurabilir.",
      "upgrades": [
        "+22 hasar",
        "+%15 alan",
        {
          "fork": [
            {
              "name": "Mutlak Sıfır",
              "desc": "0,6 sn daha kısa bekleme süresi ve +%20 donma şansı"
            },
            {
              "name": "Kırık Buz",
              "desc": "Devrilen düşmanlar patlar; +26 hasar"
            }
          ]
        },
        "0,6 sn daha kısa bekleme süresi ve +22 hasar"
      ]
    },
    "metalBurst": {
      "description": "Registeel'ın Iron Defense savunması seni sertleştirir (aldığın her darbe 2 hasar kaybeder), ardından senden çelik bir patlama ve parçacık halkası fırlar. Bir önceki kullanımdan bu yana aldığın her darbe patlamayı daha da güçlendirir.",
      "upgrades": [
        "+15 hasar",
        "+4 parça",
        {
          "fork": [
            {
              "name": "Demir Duvar",
              "desc": "İki kat savunma, +1,2 sn daha uzun sürer ve +2 parça"
            },
            {
              "name": "Yüklü Çelik",
              "desc": "Vuruşlar yakındaki düşmanlara kıvılcım saçar; +16 hasar"
            }
          ]
        },
        "0,5 sn daha kısa bekleme süresi ve +15 hasar"
      ]
    },
    "telekinesis": {
      "description": "Mewtwo'nun zihni en yakındaki düşmanları kavrar ve oldukları yerde dondurarak yerden kaldırır. Ardından onları kalabalığın içine savurur: Yollarına çıkanlara çarparlar ve yere çarpış iki kat daha sert vurur. Bosslar uçmaz ama ezilirler.",
      "upgrades": [
        "+12 hasar",
        "+2 düşman daha kaldırır",
        {
          "fork": [
            {
              "name": "Sınırsız Zihin",
              "desc": "+3 düşman daha kaldırır; -8 hasar"
            },
            {
              "name": "Ölümcül Fırlatma",
              "desc": "Devrilen düşmanlar patlar; +14 hasar"
            }
          ]
        },
        "0,4 sn daha kısa bekleme süresi ve +12 hasar"
      ]
    },
    "judgment": {
      "description": "Arceus'un altın çarkı tepede döner ve her levha düşmanları delip geçen bir ışık mızrağı fırlatır. Çoklu tip: Türü bulunduğu bölgeye uyum sağlar (Route 1'de Çimen, Viridian Forest'ta Böcek, Mt. Moon'da Kaya, Mt. Silver'da Buz, Lavender Tower'da Hayalet).",
      "upgrades": [
        "+15 hasar",
        "+2 mızrak",
        {
          "fork": [
            {
              "name": "Çifte Hüküm",
              "desc": "Her kullanım yarı güçte yankılanır; +%25 alan"
            },
            {
              "name": "Son Hüküm",
              "desc": "Elitlere ve bosslara fazladan hasar; +18 hasar"
            }
          ]
        },
        "0,4 sn daha kısa bekleme süresi ve +15 hasar"
      ]
    }
  },

  items: {
    muscleBand: 'Tüm saldırılara +%10 hasar.',
    quickClaw: 'Saldırılar %8 daha hızlı dolar.',
    wideLens: '+%10 saldırı alanı.',
    lightClay: 'Etkiler %12 daha uzun sürer.',
    loadedDice: 'Çok vuruşlu saldırılara +1 atış.',
    leftovers: 'Saniyede 0,3 Can yeniler.',
    choiceScarf: '+%8 hareket hızı.',
    luckyEgg: '+%10 TP kazanımı.',
    dowsingMachine: 'Exp. Candy\'leri daha uzaktan çeker.',
    kingsRock: 'Durum etkisi (yanma, zehir, felç) uygulama şansı +%6.',
    toxicOrb: 'Yanma ve zehir +%20 daha fazla hasar verir.',
    assaultVest: '+20 azami Can ve +1 savunma (alınan her darbeden 1 hasar düşer, en fazla yarısına kadar).',
    metronome: 'Her zıplama veya atılmanın sonunda (ve diğer özeller tetiklendiğinde) oradan 1 saldırını ateşler. Son seviyede 2 saldırı, ancak zincirlemelerde ikincisi sadece son zıplamada.',
    powerHerb: 'Özel saldırının devirdiği (veya zincir sırasında devrilen) her düşman, bekleme süresini 0,25\u00a0sn kısaltır.',
    charcoal: typeBoost('Ateş'),
    mysticWater: typeBoost('Su'),
    miracleSeed: typeBoost('Çim'),
    silkScarf: typeBoost('Normal'),
    magnet: typeBoost('Elektrik'),
    poisonBarb: typeBoost('Zehir'),
    sharpBeak: typeBoost('Uçuş'),
    neverMeltIce: typeBoost('Buz'),
    hardStone: typeBoost('Kaya'),
    silverPowder: typeBoost('Böcek'),
    dragonFang: typeBoost('Ejderha'),
    blackBelt: typeBoost('Dövüş'),
    metalCoat: typeBoost('Çelik'),
    spellTag: typeBoost('Hayalet'),
    blackGlasses: typeBoost('Karanlık'),
    twistedSpoon: typeBoost('Psişik'),
    softSand: typeBoost('Yer'),
    fairyFeather: typeBoost('Peri'),
  },

  upgrades: {
    hpUp: 'Kademe başına +10 azami Can.',
    protein: 'Kademe başına +%5 hasar.',
    iron: 'Kademe başına +1 savunma: Alınan her darbeden 1 hasar düşer, en fazla yarısına kadar.',
    carbos: 'Kademe başına +%5 hız.',
    calcium: 'Kademe başına +%5 saldırı alanı.',
    zinc: 'Saldırılar kademe başına %2,5 daha hızlı dolar.',
    ppUp: 'Tüm saldırılara +1 atış.',
    expCharm: 'Kademe başına +%3 TP kazanımı.',
    amuletCoin: 'Kademe başına +%10 kazanılan ₽.',
    abilityCapsule: 'Koşu başına +1 seviye atlama yenilemesi.',
    escapeRope: 'Koşu başına +1 seviye atlama geçişi ve +1 Unutma hakkı.',
    shinyCharm: 'Vahşi shinyler daha sık çıkar: Seviye başına şansa +1/3 (1/450 → en fazla 1/225).',
  },

  consumables: {
    potion: '30 Can yenilendi.',
    superPotion: '60 Can yenilendi.',
    rareCandy: 'Seviye atlandı!',
    expShare: 'Tüm Exp. Candy\'ler sana doğru çekildi!',
    pokeFlute: 'Vahşi Pokémon\'lar uyuyakaldı!',
    maxRepel: 'Hiçbir vahşi Pokémon yaklaşamaz!',
    explosion: 'Explosion kullandı!',
    xAttack: 'Saldırı gücü keskin şekilde arttı!',
    xSpeed: 'Hız keskin şekilde arttı!',
    revive: 'Bayıldığında kullanılmak üzere çantana eklendi.',
  },

  blurbs: {
    bulbasaur: 'Dengeli. Can yeniler.',
    charmander: 'Saldırgan. Daha fazla hasar, daha az Can.',
    squirtle: 'Savunmacı. Daha fazla Can ve savunma.',
    chikorita: 'İyileştirici. Bol Can ve yenilenme.',
    cyndaquil: 'Alevli. Daha geniş ve uzun süreli saldırılar.',
    totodile: 'Kavgacı. Güçlü ısırıklar ve kalın bir deri.',
    treecko: 'Seri. Hızlı koşar ama kırılgandır.',
    torchic: 'Dövüşçü. Gittikçe güçlenen ateşli tekmeler.',
    mudkip: 'Tank. Darbeleri göğüsler ve yerden karşılık verir.',
    turtwig: 'Kale. Yavaş, zırhlı ve sarsıcı.',
    chimchar: 'Çevik. Hızlı yumruk komboları.',
    piplup: 'Gururlu. Savunma ve çelik atışlar.',
    snivy: 'Zarif. Hızlıdır ve toplama menzili geniştir.',
    tepig: 'Ağır siklet. Bol Can ve kaba kuvvet saldırıları.',
    oshawott: 'Kılıç ustası. Kavisli kabuk kesikleri.',
    chespin: 'Dikenli. Yüksek savunma, yakın mesafe yumrukları.',
    fennekin: 'Mistik. Psişik güçler ve daha geniş alan.',
    froakie: 'Ninja. Çok hızlı, az Can.',
    rowlet: 'Okçu. Hızlı ve isabetli oklar.',
    litten: 'Karanlık dövüşçü. Yüksek hasar ve dayanıklılık.',
    popplio: 'Sanatçı. Şarkı söyler, iyileştirir ve dört bir yana vurur.',
    grookey: 'Ritmik. Sürüyü yavaşlatan dalgalar.',
    scorbunny: 'Golcü. Patlayıcı tekmeler ve hız.',
    sobble: 'Keskin nişancı. Hızlı ve güçlü atışlar.',
    sprigatito: 'Hilebaz. Kısa bekleme süreleri ve daha fazla TP.',
    fuecoco: 'Geniş gönüllü. Bol Can ve alevli şarkılar.',
    quaxly: 'Dansçı. Suda fır döner ve vurur.',
    pichu: 'Elektrikli. Hızlı şoklar, fakat narin.',
    machop: 'Dövüşçü. Sert yumruklar ve bol Can.',
    eevee: 'Uyumlu. Hızlı gelişir ve 8 farklı türe evrilir.',
    togepi: 'Şanslı. Can yeniler ve daha fazla TP kazanır.',
    spheal: 'Yuvarlanan top. Tonton, dirençli ve buzlu.',
    starly: 'Seri. Hızlı uçar ve eşyaları uzaktan çeker.',
    budew: 'Zehirli. Durum etkilerini daha sık ve sert vurur.',
    rockruff: 'Sadık. Lycanroc\'a dönüşen seri ısırıklar.',
    grubbin: 'Batarya. Daha geniş ve uzun süreli saldırılar.',
    gastly: 'Hayalet. Yüksek hasar, az Can.',
    abra: 'Psişik. Çok kısa bekleme süreleri, çok kırılgan.',
    ralts: 'Empat. Geniş saldırı alanı ve can yenileme.',
    riolu: 'Aura. Hızlı, güçlü; zamanla Lucario olur.',
    zorua: 'İllüzyonist. Hızlı ve hasarı bol.',
    larvesta: 'Güneş. Alevli alan ve yanma şansı.',
    noibat: 'Ultrason. Geniş dalgalar ve hız.',
    honedge: 'Canlı kılıç. Yüksek savunma ve çelik kesişler.',
    toxel: 'Rocker. Ritmik elektrik şokları ve zehir.',
    tinkatink: 'Çekiç. Yeri sarsan ağır darbeler.',
    charcadet: 'Köz. Gücü ve menzili artan atışlar.',
    dratini: 'Nadir. Dengeli, zamanla Dragonite\'a dönüşür.',
    larvitar: 'Kale. Bol Can ve sarsıcı savunma.',
    beldum: 'Zırhlı. Çelik savunma ve saf güç.',
    gible: 'Kara köpekbalığı. Gittikçe hızlanan sert ısırıklar.',
    dreepy: 'Güdümlü füze. Hızlı ve isabetli minik Dreepler fırlatır.',
    pidgey: 'Kuş. Rüzgâr girdapları ve hız.',
    zubat: 'Yarasa. Hızlıdır, ısırır ve zehirler.',
    poliwag: 'İribaş. Su, yumruklar ve hızlı dolan saldırılar.',
    geodude: 'Kaya. Yavaş, sert ve ağır kayalar savurur.',
    roggenrola: 'Kristal. Kalın zırh; Gigalith geniş alana ezer.',
    mareep: 'Elektrikli yün. Felç eden şoklar.',
    shinx: 'Elektrik vaşağı. Dişler ve şoklar; Luxray\'in bakışı felç eder.',
    azurill: 'Zıpzıp top. Başta zayıf, sonunda Muazzam Güç.',
    shroomish: 'Mantar. Sporlar, ardından Breloom\'un yumrukları.',
    swinub: 'Domuzcuk. Yerde buz ve bitmeyen bir inat.',
    snorunt: 'Kardan adam. Buz parçacıkları ve ısırıklar.',
    growlithe: 'Ateş köpeği. Sadık, hızlı ve güçlü.',
    vulpix: 'Tilki. Hayalet alevleri ve uzun süreli yanmalar.',
    cubone: 'Yalnız. Kalın kafatası ve güçlü sarsıntılar.',
    scyther: 'Peygamberdevesi. Çok hızlı fakat kırılgan.',
    magikarp: 'Sadece Splash bilir. Ta ki Gyarados olana dek.',
    horsea: 'Keskin nişancı. Seri ve isabetli atışlar.',
    kabuto: 'Fosil. Sert kabuk ve keskin bıçaklar.',
    houndour: 'Karanlık tazı. Daha güçlü yanıklar.',
    teddiursa: 'Ayıcık. Bol Can, ağır pençeler.',
    aron: 'Zırh. En yüksek savunma, ancak çok yavaş.',
    trapinch: 'Karıncakurdu. Çukurlar kazar ve ejderhaya dönüşür.',
    swablu: 'Pamuk kuş. İyileştirir, şakır ve ejderha olur.',
    electrike: 'Yıldırım. Hızlı koşar ve çabuk şarj olur.',
    shuppet: 'Lanetli bez bebek. Durum etkileri ve lanetler.',
    bagon: 'Uçma hayalleri kurar. Yumurtadan ejderha ateşiyle çıkar.',
    slakoth: 'Tembel hayvan. Geç harekete geçer ama çok sert vurur.',
    feebas: 'En gösterişsizi. Ta ki en güzeline dönüşene dek.',
    deino: 'Kör ısırıcı. Sert vurur; üç kafasıyla daha çok ateş eder.',
    munchlax: 'Aç tank. Bol Can, savunma ve yenilenme; eşyaları uzaktan çeker.',
    litwick: 'Hayalet mum. Daha uzun süren ve daha sıcak yanan alevler.',
    phantump: 'Perili kütük. Bol Can ve can yenileme.',
    drifloon: 'Hayalet balon. Hızlıdır, eşyaları uzaktan çeker.',
    sandygast: 'Kumdan kale hayaleti. Dirençli ve geniş sarsıntılı.',
    porygon: 'Kodlardan üretildi. Hızlı dolum ve gelişim; Up-Grade ve Dubious Disc ile evrilir.',
    exeggcute: 'Altı yumurta, tek zihin. Geniş menzil ve yavaş iyileşme; Leaf Stone ile evrilir.',
    scraggy: 'Düşük pantolonlu kavgacı. Dayanıklı, sert yumruklar.',
    smeargle: 'Ressam. Asla evrilmez: Yanındakinin saldırısını kopyalar.',
    articuno: 'Buz kuşu. Geniş saldırılar; soğuğuyla düşmanları yavaşlatır.',
    zapdos: 'Yıldırım kuşu. Hızlıdır; dokunan düşmanlar felç olur.',
    moltres: 'Ateş kuşu. Devasa hasar; dokunan düşmanlar yanar.',
    raikou: 'Seri yıldırım. Canavarların en hızlısı.',
    entei: 'Canlı yanardağ. Güçlü ve dayanıklı.',
    suicune: 'Kuzey rüzgârı. Can yeniler ve zarafetle süzülür.',
    regirock: 'Kaya devi. Zirve savunma, ağır adımlar.',
    regice: 'Buz devi. Geniş saldırılar ve kalın bir buz kabuğu.',
    registeel: 'Çelik devi. En ağır ve delinmez zırh.',
    mew: 'Tüm Pokémon\'ların atası. Her şeyden biraz öğrenir, hızlı gelişir.',
    celebi: 'Zaman bekçisi. Can yenilemesi hiç durmaz.',
    jirachi: 'Dilek yıldızı. Nadir kartlar ve daha fazla ₽.',
    mewtwo: 'En güçlüsü. Yıkıcı psişik hasar.',
    lugia: 'Denizlerin koruyucusu. Canı doluyken neredeyse dokunulmazdır.',
    hoOh: 'Gökkuşağı. Kutsal ateş ve sürekli iyileşme.',
    kyogre: 'Denizlerin efendisi. Yağmuru getirir; İlkel forma bürünür.',
    groudon: 'Karaların efendisi. Güneşi getirir; İlkel forma bürünür.',
    rayquaza: 'Gökyüzünün efendisi. Hava durumundan etkilenmez; Mega evrilir.',
    dialga: 'Zamanın efendisi. Zırhlı ve amansız.',
    latias: 'Seri Eon. Lavların ve tuzakların üzerinden uçar.',
    latios: 'Keskin Eon. Uzaktan hızlı ve ölümcül.',
    deoxys: 'Uzay virüsü. Özel saldırısıyla form değiştirir.',
    arceus: 'Yaratıcı. Her biyomda türü değişir.',
  },

  specials: {
    blastBurn: 'Ateşten iz bırakan alevli bir atılma.',
    hydroCannon: 'Hareket ettiğin yöne doğru odaklanmış bir tazyik patlaması.',
    frenzyPlant: 'Yerden fışkıran ve düşmanları yavaşlatan kök halkaları.',
    boomburst: 'Etrafındaki her şeyi geriye savuran güçlü bir şok dalgası.',
    boltStrike: 'En yakındaki düşmanlara yıldırım indirir ve onları felç edebilir.',
    doomDesire: 'En yakındaki düşmanların üzerine inen çelikten ışık sütunları: Az sayıda ama çok ağır.',
    lightOfRuin: 'En yakındaki düşmanların üzerine düşen ve onları uyutabilen ışık huzmeleri.',
    expandingForce: 'Düşmanları iten ve yavaşlatan dört bir yana yayılan psişik dalgalar.',
    nightDaze: 'Düşmanları iten ve uyutabilen karanlık şok dalgaları.',
    dracoMeteor: 'Etrafına yağan ve yakabilen bir göktaşı yağmuru.',
    diamondStorm: 'Sert vuran ve geriye savuran kaya yağmuru.',
    blizzard: 'Etrafına yağan ve düşmanları yavaşlatan buz sarkıtları.',
    astralBarrage: 'Dört bir yana fırlatılan ve felç edebilen gölge küreleri halkası.',
    auraSphere: 'Dört bir yana fırlatılan enerji küreleri halkası.',
    attackOrder: 'Dört bir yana saçılan ve zehirleyebilen iğneler halkası.',
    precipiceBlades: 'Yürüdüğün yönü süpüren ve düşmanları yavaşlatan taş kılıçlar duvarı.',
    aeroblast: 'Yürüdüğün yönü süpüren ve düşmanları geri savuran rüzgâr duvarı.',
    malignantChain: 'Biraz daha hızlı koşarsın ve arkanda zehirli bir iz bırakırsın.',
    solarBlade: 'En yakındaki düşmanı biçip geçer. Vuruşun hemen ardından tekrar basarak sonrakine zıpla.',
    closeCombat: 'En yakındaki düşmanı delip geçer. Vuruşun hemen ardından tekrar basarak sonrakine zıpla.',
    dragonRush: 'Bir ejderha gibi en yakındaki düşmanın üzerine atılır. Vuruşun hemen ardından tekrar basarak sonrakine zıpla.',
    braveBird: 'En yakındaki düşmana dalar. Vuruşun hemen ardından tekrar basarak sonrakine zıpla.',
    ironHead: 'Kılıç önde en yakındaki düşmana hücum eder. Vuruşun hemen ardından tekrar basarak sonrakine zıpla.',
    stanceChange: 'Shield Forme (alınan hasar -%30, saldırılar ×0,7) ile Blade Forme (saldırılar ×1,3, alınan hasar +%10) arasında geçiş yapar.',
    formeChange: 'Normal, Attack (saldırılar ×1,35, alınan hasar +%25), Defense (alınan hasar -%40, saldırılar ×0,75) ve Speed Forme (+%35 hız) arasında sırayla değişir.',
    dragonFlare: 'Mavi ejderha alevleri içinde uzun bir atılma; arkasında ateş izi bırakır ve sonda patlar.',
    psystrike: 'Etrafında düşmanları iten ve yavaşlatan üç devasa psişik dalga.',
    poltergeist: 'Dört bir yana saçılan ve felç edebilen 24 gölge atışı halkası.',
    moonblast: 'En yakındaki düşmanlara çarpan ve onları uyutabilen on iki ay ışığı huzmesi.',
    auraStorm: 'En fazla 6 sıçramalı zincirleme atılma; her inişte bir Aura Sphere halkası patlatır.',
    stoneEdge: 'Etrafına yağan ağır taş bıçaklar yağmuru.',
    petalBlizzard: 'Etrafında düşmanları yavaşlatan üç yaprak dalgası.',
    heatWave: 'Etrafında yanık bırakabilen iki devasa sıcak hava dalgası.',
    waterPulse: 'Etrafında düşmanları yavaşlatabilen dört su dalgası.',
    voltTackle: 'En fazla 6 sıçramalı elektrikli zincir atılma; her inişte şok halkası patlatır.',
    risingVoltage: 'En yakındaki düşmanlara inen ve felç edebilen on dört yıldırım.',
    hurricane: 'Yürüdüğün yönü süpüren devasa bir fırtına duvarı.',
    solarBeam: 'En yakındaki düşmanlara vuran on iki güneş ışını.',
    waveCrash: 'Sulara sarılı, en fazla 6 sıçramalı zincirleme atılma.',
    dragonClaw: 'En fazla 6 sıçramalı zincir atılma; her inişte ejderha enerjisi halkası patlatır.',
    blazeKick: 'Yakabilen alevli zincirleme atılma (en fazla 6 sıçrama).',
    muddyWater: 'Etrafında düşmanları yavaşlatan üç çamur dalgası.',
    meteorMash: 'Etrafına yağan ağır çelik meteor yağmuru.',
    skyAttack: 'En fazla 6 sıçramalı zincir atılma; her inişte rüzgâr bıçakları halkası patlatır.',
    earthPower: 'Etrafında düşmanları yavaşlatan üç toprak dalgası.',
    scaleShot: 'Dört bir yana fırlatılan 24 pul halkası.',
    focusBlast: 'En yakındaki düşmanlara çarpan on enerji küresi.',
    heatCrash: 'En yakındaki düşmanlara inen ve yakabilen sekiz alevli darbe.',
    spikyShield: 'Etrafındaki her şeyi geriye savuran iki diken dalgası.',
    mysticalFire: 'Etrafında yakabilen üç mistik ateş dalgası.',
    nightSlash: 'En fazla 6 sıçramalı zincir atılma; her inişte karanlık dalgalar halkası patlatır.',
    airSlash: 'Dört bir yana saçılan 24 hava bıçağı halkası.',
    waterfall: 'Yürüdüğün yönü süpüren devasa bir su duvarı.',
    zapCannon: 'Etrafında neredeyse daima felç eden üç devasa elektrik dalgası.',
    bulletPunch: 'Kısa bekleme süreli, en fazla 6 sıçramalı zincir atılma; her inişte çelik parçacıkları patlatır.',
    fieryWrath: 'Etrafına yağan ve yakabilen ağır karanlık alev yağmuru.',
    heavySlam: 'En yakındaki düşmanların üzerine inen sekiz devasa çelik darbesi.',
    wildCharge: 'Daha hızlı koşarsın ve arkanda felç edebilen kıvılcım izi bırakırsın.',
    hyperVoice: 'Etrafında düşmanları uyutabilen üç büyüleyici ses dalgası.',
    phantomForce: 'En fazla 6 sıçramalı zincir atılma; her inişte gölge halkası patlatır.',
    sheerCold: 'Etrafında düşmanları çok sert yavaşlatan üç mutlak soğuk dalgası.',
    doubleEdge: 'En yakındaki düşmanların üzerine inen on iki pike dalışı.',
  },

  duo: {
    tag: 'İKİLİ!',
    frees: '1 saldırı yuvası açar · Koşu başına sadece 1',
    title: 'İkili saldırılar',
    legend: 'Gösterilen türlerdeki son seviye (veya evrilmiş) iki saldırı birleşerek ikili saldırı oluşturur. Koşu başına sadece 1.',
    done: 'TAMAM',
    fused: (a: string, b: string, to: string) => `*${a}* ve *${b}* güçlerini birleştirdi: *${to}*!`,
  },

  curses: {
    lifeOrb: { upside: '+%30 hasar.', downside: 'Kullanılan her saldırı %1 Can götürür (saniyede en fazla bir kez; 1 Can\'da durur).' },
    choiceBand: { upside: '+%40 hasar.', downside: 'Yeni saldırı öğrenemezsin: Yalnızca elindekileri yükseltebilirsin.' },
    flameOrb: { upside: '+%25 hasar ve +%10 durum etkisi şansı.', downside: 'Yanarsın: Saniyede %0,7 Can kaybedersin (1 Can\'da durur).' },
    ironBall: { upside: '+%30 hasar ve +1 savunma.', downside: 'Ağır: -13 hız.' },
  },
  curse: {
    title: 'Lanetli eşya!',
    subtitle: 'Sandığın dibinde kudretli bir şey yatıyor… bir bedel karşılığında.',
    take: 'Al',
    leave: 'Bırak',
    note: 'Eşya yuvası kaplamaz ve koşu sonuna kadar kalır.',
    label: 'LANETLİ',
    taken: (name: string) => `*${name}* aldın… _gücün bir bedeli var_.`,
    left: (name: string) => `*${name}* sandıkta bırakıldı.`,
  },
  pokeballPick: {
    label: 'POKÉ BALL',
    title: 'Poké Ball\'da yeni bir şey var!',
    take: 'Al',
    leave: 'Bırak',
    moveSlot: (used: number, max: number) => `Bir saldırı yuvası kaplar (${used}/${max} kullanımda).`,
    itemSlot: (used: number, max: number) => `Bir eşya yuvası kaplar (${used}/${max} kullanımda).`,
    note: 'Bırakırsan kaybolur. Elindekilerin yükseltmeleri kendiliğinden eklenir.',
    left: (name: string) => `*${name}* arkada bırakıldı.`,
    itemHintTouch: 'Seçmek için dokun',
  },
  plaza: {
    talk: 'Konuş',
    next: 'Devam',
    greetings: {
      morning: 'Günaydın, günaydın! Kecleon Dükkânı\'na hoş geldin! Taze mallar az önce geldi.',
      afternoon: 'Tünaydın! Hoş geldin, hoş geldin! Rahatına bak!',
      evening: 'İyi akşamlar! Hoş geldin, hoş geldin! Bugün ne arzu ederdin?',
      night: 'Hâlâ ayakta mısın? Hoş geldin, hoş geldin! Kecleon Dükkânı asla kapanmaz!',
    },
    lines: {
      first: 'Hoş geldin, hoş geldin! Kecleon Dükkânı! Yeni bir müşteri mi? Rahatına bak!',
      wishToday: (name: string) => `Listendeki ${name} bugün geldi! Vitrinde seni bekliyor!`,
      mewtwo: 'MEWTWO\'yu mu devirdin?! Bu bir kutlamayı hak eder... aa, bugünkü vitrine bir baksana!',
      loyal: (days: number) => `Üst üste ${days} gündür buradasın! En sevdiğim müşterim! Vitrinin en iyisini senin için ayırdım.`,
      invest: 'Vay be, cüzdana bak! Dükkâna yatırım yapmayı hiç düşündün mü? İkinci kat için planlarım var...',
      wishLater: (name: string, on: string) => `${name} mi? ${on} tekrar gelecek. Merak etme, bir tanesini sana ayıracağım.`,
      broke: 'Hımm... Poké Doları biraz suyunu çekmiş ha? Bir koşu yapıp dönersin. Seni bekliyorum.',
      shiny: 'Şu renge bak! Neredeyse benim kamuflajım kadar harika.',
      types: {
        fire: (name: string) => `Aa, ${name}! Tenteye çok yaklaşma yeter, tamam mı?`,
        water: (name: string) => `Aa, ${name}! Mallara su sıçratmamaya dikkat et!`,
        electric: (name: string) => `Aa, ${name}! Kasaya dokunma, geçen sefer kısa devre yaptı.`,
        grass: (name: string) => `Aa, ${name}! Benim gibi yemyeşil. Sevdim seni!`,
        ghost: (name: string) => `Aa, ${name}! Burada ödeme yapmadan duvarların içinden geçmek yok, anlaştık mı?`,
      },
      empty: 'Tezgâh boş görünüyor... ama şurada kırpışan iki göz var.',
      surprise: 'SÜRPRİZ! Hihi, yakaladım seni! Kamuflajımı kimse fark edemez.',
      pinned: (name: string, when: string) => `Not edildi! ${name} listene alındı. ${when}`,
      levelUp: (name: string) => `Şuna bir bak! Dükkân artık bir ${name}! Teşekkürler ortak!`,
      purpleTms: 'Pışt... en üst raf TM\'leri. Birini donan, koşunda mutlaka karşına çıksın. Garantili.',
      purpleEvolution: 'Taşlar ve kalıntılar! Dawn Stone olmadan Gallade olmaz. Benden al, temelli senin olsun.',
      greenBack: 'Yine tezgâhımın bu tarafındasın ha? Rahatına bak!',
      stamp: (n: number) => `Bugünün damgası! Sadakat kartında ${n} damga oldu.`,
      milestone: (n: number) => `${n} damga! Lobide sana bir hediye bıraktım dostum!`,
      statue: '60 damga! Heykelimi yaptırdım... yani heykelimizi! Meydanda duruyor!',
      tycoon: 'Bir Alışveriş Merkezi! Ortak, artık bir Ticaret Baronusun! Lobide bir hediye bıraktım.',
      kecleonEgg: 'Kecleon! O yumurta çok uzaklardan geldi... İçinde kim var ben bile bilmiyorum. Ona iyi bak!',
    },
    thanks: ['Teşekkürler! Yine bekleriz!', 'Harika seçim!', 'Anlaştık!', 'Hihi, güle güle kullan!'],
    thanksPurple: ['Hihi, gerçek bir uzman!', 'Güle güle kullan dostum!', 'Bu can yakacak!', 'Anlaştık, pışt!'],
    weekdays: ['Pazar günü', 'Pazartesi günü', 'Salı günü', 'Çarşamba günü', 'Perşembe günü', 'Cuma günü', 'Cumartesi günü'],
    dayNames: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],
    meowth: {
      hello: ['Hey! Haritada beni pataklayan sendin! ...Neyse, müşteri müşteridir.', 'Miyavhaha! Uzaklardan gelen kaliteli mallar. Sadece hafta sonları!', 'Tam vaktinde! Pazartesi yola koyuluyorum.'],
      haggleYes: (off: number) => `Pekala, pekala! Kecleon'un müdavimine %${off} indirim. Ama kimseye söyleme!`,
      haggleNo: (stamps: number) => `Pazarlık mı? Miyav! Daha müdavim bile değilsin! Kecleon\'un kartında ${stamps} damgayla gel.`,
      haggleAgain: 'Zaten indirim yaptım! Pay Day günümde beni meteliksiz mi bırakacaksın?',
      thanks: ['Miyavhaha! Anlaştık!', 'Ödendi ve bitti! İade yok!', 'Kafamdaki madeni paradan daha parlak parıldıyor!'],
    },
    duskull: {
      hello: ['Gecede bir Perili Yumurta. İçinden ne mi çıkar? Başka hiçbir yumurtada bulunmayan hayaletler.', 'Bööh... Bu yumurtalar sıcaklıkla çatlamaz. Korkuyla çatlar. İster misin?', 'Dört hayalet, tek yumurta. Hangisi çıkacak? Ben bile bilmiyorum... hihihi.'],
      thanks: ['Bööh... Güzel seçim. Gece yarısı gözünü üzerinden ayırma.', 'Hihihi... Şimdiden sana bakıyor.', 'Yarın yine gel. Cesaretin varsa tabii.'],
    },
    stalls: {
      halloween: ['Bööh... Cadılar Bayramı Gecesi meydana indi.', 'Koşularından topladığın şekerler lobideki kavanoza gidiyor. Burada başka şeyler satıyorum...'],
      christmas: ['Deli! Delibird Hediyeleri meydana geldi!', 'Hâlâ paketliyorum. Noel\'de yine gel, çuval ağzına kadar dolmuş olacak!'],
    },
  },
  traits: {
    healer: (name: string) => `*${name}* yakındaki müttefikleri iyileştirir. Önce onu indir!`,
    shield: (name: string) => `*${name}* müttefiklerini hasarı emen bir _kalkanla_ korur.`,
    summoner: (name: string) => `*${name}* birkaç saniyede bir takviye çağırır.`,
    kamikaze: (name: string) => `*${name}* yanıp söner ve _patlar_! Kırmızı çemberden çık.`,
    beam: (name: string) => `*${name}* bir _ışın_ doğrultuyor: Yerden kırmızı çizgiden çekil!`,
    leaper: (name: string) => `*${name}* sürünün üzerinden sıçrar: _Gölgeden_ kaç!`,
    spitter: (name: string) => `*${name}* uzaktan tükürür ve atışı aurayı deler: Kaçmak için _sürekli hareket et_!`,
  },
  hazards: {
    intro: '*Diyar harekete geçiyor!* Zemin durduğun yeri işaretler, ardından darbe iner: _sürekli hareket et_.',
  },
  alphas: {
    tag: 'ALFA',
    appeared: (name: string) => `Bir *Alfa ${name}* belirdi! Nişan aldığında _kırmızı çizgiden_ çekil.`,
    defeated: (name: string) => `*Alfa ${name}* devrildi! _Ödülü_ kap.`,
    prize: '*Alfa ödülü*: _nadir_ kartlar!',
  },
  legend: {
    mode: 'Efsanevi Modu',
    awakening: (name: string) => `${name} uyanıyor!`,
    awakened: (name: string) => `${name} uyandı! Gücü katlandı.`,
    awakenedForm: (from: string, to: string) => `${from}, *${to}* olarak uyandı!`,
    innate: 'Doğuştan',
    innateExtra: {
      articuno: 'Kanatlarının ayazı yakındaki düşmanları yavaşlatır.',
      jirachi: 'Nadir ve shiny kartlar daha sık gelir.',
    },
    clone: (name: string) => `${name} Klonu`,
    escaped: (name: string, wins: number, need: number) => `*${name}* kurtuldu… _${wins}/${need}_`,
    escapedHint: (left: number) => (left === 1 ? 'Yakalamak için 1 kez daha yen.' : `Yakalamak için ${left} kez daha yen.`),
    arceusHint: (left: number) => (left > 0 ? `Yalnızca sonsuz modda, diğer efsanevilerden sonra yakalanabilir (${left} kaldı).` : 'Yalnızca sonsuz modda yakalanabilir.'),
    caught: (name: string) => `*${name}* yakalandı! _Efsanevi Modunda_ oynanabilir.`,
    caughtShiny: (name: string) => `_Shiny_ *${name}* yakalandı! _Efsanevi Modunda_ oynanabilir.`,
    shinyUnlocked: (name: string) => `_Shiny_ *${name}*, _Efsanevi Modunda_ açıldı!`,
    caughtHint: 'Partner seçimindeki Efsaneviler sekmesinden seç.',
    tab: 'EFSANEVİLER',
    wins: (n: string) => `Zaferler: ${n}`,
    lockedButton: 'Yakalanmadı',
    where: {
      rift: '_Efsanevi yarığın_ içinde bekler: Portaldan geç ve onu orada yen.',
      trio: 'Koşunun _efsanevi üçlüsüyle_ birlikte bir boss olarak gelir.',
      mythical: 'Bazen (10 koşuda 1) sonda *Mewtwo*\'nun yanında belirir.',
      finale: 'Nihai bosstur: Bir koşuyu kazan.',
      endless: 'Son zafer kupası: Diğer 22 efsanevi yakalandığında _sonsuz modda_ onu yen.',
    },
    rule: (need: number) => (need === 1 ? 'Yakalamak için herhangi bir modda boss olarak 1 kez yen.' : `Yakalamak için herhangi bir modda boss olarak ${need} kez yen.`),
    shinyRule: 'Shiny bir efsaneviyi yakalanacağı zaferde veya sonrasında yenmek shiny formunu açar.',
    selectNote: 'Efsaneviler *Efsanevi Modunda* oynanır: Kendi sıralamaları, daha zorlu bir sürü, Sv 12 ve 28\'de uyanışlar.',
  },
  legends: {
    epithets: {
      articuno: 'Ebedi Buz Kuşu',
      zapdos: 'Gök Gürültüsü Efendisi',
      moltres: 'Ölümsüz Alev',
      raikou: 'Yıldırım Canavarı',
      entei: 'Yanardağ Canavarı',
      suicune: 'Kuzey Rüzgârı',
      regirock: 'Kaya Devi',
      regice: 'Buz Devi',
      registeel: 'Çelik Devi',
      mew: 'Tüm Canlıların Atası',
      celebi: 'Zaman Gezgini',
      jirachi: 'Dilek Yıldızı',
      mewtwo: 'Genetik Öfke',
      arceus: 'İlk Olan',
    },
    phases: {
      articuno: ['*Articuno* havalanıyor! _Gölgesinden_ kaç.', 'Tipi bastırdı! Snowscape öncesinde bir _kar sığınağına_ yetiş.'],
      zapdos: ['*Zapdos* Drill Peck ile hücum ediyor: _İşaretli şeritten_ çekil!', 'Zemin elektrik yüklendi! Electric Terrain öncesinde Zapdos\'tan _uzaklaş_.'],
      moltres: ['*Moltres* havalanıyor! _Gölgesi_ yakar.', 'Hava kaynıyor! Overheat\'ten sadece _Moltres\'in hemen yanı_ güvenlidir.'],
      raikou: ['*Raikou* Extreme Speed ile atılıyor: _Şeritlerden_ çekil!', 'Gök gürültüsü! _Mızrakların arasındaki boşluğu_ bul.'],
      entei: ['*Entei* alevler içinde hücum ediyor: _Şeritten_ çekil!', 'Burning Bulwark! Alevlerle çevrildin, _çemberin içinde kaçın_.'],
      suicune: ['*Suicune* alan üzerinde süzülüyor: _Şeritten_ çekil!', 'Aqua Ring! Su halkaları daralıyor: _Açıklıktan_ dışarı çık.'],
      regirock: ['*Regirock* seni Rock Tomb ile hapsediyor!', 'Rock Wrecker! Kayaların _nişan çizgisinden_ çekil.'],
      regice: ['*Regice* Icy Wind halkalarını kapatıyor: _Çıkış yolunu_ bul!', 'Glaciate! Yakındaki buzdan _uzaklaş_, ardından tekrar _yakınına gel_.'],
      registeel: ['*Registeel* Iron Head ile hücum ediyor: _Şeritten_ çekil!', 'Metal Burst! _Mızrakların arasındaki boşluğu_ bul.'],
      mew: ['*Mew* üzerine ışınlanıyor: _Çemberden_ dışarı çık!', 'Ancient Power! Taşlar daralıyor: _Açıklıktan_ dışarı çık.'],
      celebi: ['*Celebi* zamanda yolculuk ederek senden uzaklaşıyor!', 'Magical Leaf! Yapraklar seni takip ediyor: _Yön değiştir_.'],
      jirachi: ['*Jirachi* üzerine ışınlanıyor: _Çemberden_ dışarı çık!', 'Wish! Yıldız yağmuru: _Boşlukları_ bul.'],
      mewtwo: ['*Mewtwo* psişik gücünü serbest bırakıyor! Teleport\'un _çemberinden_ çık.', 'Psystrike! _Boşluklardan_ sıyrıl, ardından bir _sığınağa_ koş.'],
      arceus: ['*Arceus* seni yargılamak için ışınlanıyor!', 'Judgment! Seni sadece _ışık sığınakları_ kurtarabilir.'],
    },
  },
  team: {
    player: (n: number) => `Oyuncu ${n}`,
    you: 'Sen',
    state: { fainted: 'Baygın', away: 'Uzakta', choosing: 'Seçiyor', evolving: 'Evriliyor', left: 'Ayrıldı' },
    waiting: 'Takım bekleniyor…',
    awayWait: (name: string, time: string) => `*${name}* oyuncusunun dönmesi bekleniyor… ${time}`,
    picked: 'hazır',
    picking: 'seçiyor',
    auto: (s: number) => `*${s} sn* içinde otomatik seçim`,
    fainted: 'Bayıldın',
    reviveHint: 'Bir takım arkadaşın seni canlandırabilir',
    watching: (name: string) => `*${name}* izleniyor`,
    nextKeys: 'Tab: değiştir',
    nextTouch: 'Değiştirmek için dokun',
    menu: {
      title: 'MENÜ',
      note: 'Menü açıkken koşu devam eder.',
      sound: (on: boolean) => `Ses: ${on ? 'açık' : 'kapalı'}`,
      leave: 'Koşudan ayrıl',
      confirm: 'Koşudan ayrılsın mı? Pokémon\'un sahadan ayrılır ve şu ana kadarki ₽ payını alırsın.',
      yes: 'Ayrıl',
      no: 'Kal',
    },
    toast: {
      fainted: (name: string) => `*${name}* bayıldı! Canlandırmak için _Poké Ball_ yanında dur.`,
      revived: (name: string, by: string) => `*${by}*, *${name}* oyuncusunu canlandırdı!`,
      revivedYou: (by: string) => `*${by}* seni canlandırdı!`,
      youRevived: (name: string) => `*${name}* canlandırıldı!`,
      left: (name: string) => `*${name}* koşudan ayrıldı.`,
      away: (name: string) => `*${name}* uzakta.`,
      back: (name: string) => `*${name}* geri döndü!`,
      evolved: (name: string, from: string, to: string) => `*${name}*: ${from}, *${to}* formuna evrildi!`,
      mega: (name: string, form: string) => `*${name}*, *${form}* olarak Mega Evrim geçirdi!`,
      duo: (name: string, move: string) => `*${name}* bir ikili saldırı birleştirdi: *${move}*!`,
    },
    vote: {
      title: 'Takım Mewtwo\'yu devirdi!',
      question: 'Sonsuz modda devam edilsin mi?',
      yes: 'Devam et',
      no: 'Koşuyu bitir',
      rule: 'Çoğunluk karar verir. Eşitlik bitirir.',
      voting: 'oylanıyor…',
      endless: 'Sonsuz mod!',
    },
    results: {
      victory: 'Takım zaferi!',
      wipe: 'Tüm takım bayıldı',
      endless: 'Sonsuz mod bitti',
      time: 'Süre',
      damage: 'Hasar',
      kills: 'Yenilen',
      taken: 'Alınan',
      revives: 'Canlandırma',
      faints: 'Bayılma',
      team: 'Takım',
      share: 'Payın',
      split: (total: string, n: number, each: string) => `Takım: ${total} ÷ ${n} = her birine ${each}, artı herkesin kendi bonusu`,
      payout: (share: string, bonus: string) => `${share} takım payı + ${bonus} bonus`,
      left: 'Ayrıldı',
      againHost: (ready: number, total: number) => `Herkes hazır olduğunda başlar (${ready}/${total})`,
      againGuest: 'Hazır! Kurucunun başlatması bekleniyor…',
      playAgain: 'Tekrar oyna',
      lobby: 'Lobiye dön',
      awards: {
        damage: 'Zirve hasar',
        kills: 'En çok deviren',
        revives: 'Koruyucu melek',
        untouched: 'Dokunulmaz',
        tank: 'Tank',
        comeback: 'Anka kuşu',
        survivor: 'Hayatta kalan',
        specialist: 'Uzman',
        collector: 'Koleksiyoncu',
        loyal: 'Takım oyuncusu',
      },
    },
  },
}
