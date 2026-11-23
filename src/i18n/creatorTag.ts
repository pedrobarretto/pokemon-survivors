/**
 * The content creator's tag's words (`ui/creatorTag.ts`: the request sheet,
 * the Trainer Card's row, the STREAMER tag and the channel links on the
 * profile and in the Poké Realm), a table per language (`pt` is the reference).
 */
type Words = {
  /** The tag over a verified creator's name. */
  tag: string
  /** The Trainer Card's row, by where the account's request stands. */
  row: { ask: string; pending: string; approved: string }
  title: string
  intro: string
  field: (n: number) => string
  placeholder: string
  hint: string
  send: string
  sending: string
  /** What the sheet says about the last request: `at` is its day. */
  status: { pending: (at: string) => string; approved: string; rejected: string; revoked: string }
  errors: { empty: string; many: string; invalid: (n: number) => string; profile: string; banned: string; open: string; offline: string }
  signIn: string
  loading: string
  /** The heading over a creator's links (profile, Realm card). */
  channels: string
  back: string
}

const pt: Words = {
  tag: 'STREAMER',
  row: { ask: 'Sou criador(a) de conteúdo', pending: 'Criador(a) de conteúdo: em análise', approved: 'Criador(a) de conteúdo verificado(a)' },
  title: 'Criador(a) de conteúdo',
  intro:
    'Faz lives ou vídeos de Pokémon Survivors? Mande os links dos seus canais. A equipe confere e, se aprovar, você ganha a tag STREAMER no perfil e no Poké Realm (com o link do canal), o título Criador(a) de Conteúdo e a moldura de criador.',
  field: (n) => `CANAL ${n}`,
  placeholder: 'twitch.tv/seucanal',
  hint: 'Twitch, YouTube, Kick ou TikTok. Até 3 links.',
  send: 'Enviar pedido',
  sending: 'Enviando…',
  status: {
    pending: (at) => `Pedido enviado em ${at}. A equipe vai conferir em breve.`,
    approved: 'Verificado! Todo mundo vê a sua tag e os seus canais.',
    rejected: 'O último pedido não foi aprovado. Confira os links e mande de novo.',
    revoked: 'A equipe tirou a sua tag. Você pode pedir de novo.',
  },
  errors: {
    empty: 'Coloque pelo menos um link.',
    many: 'No máximo 3 links.',
    invalid: (n) => `O link ${n} não é um canal da Twitch, do YouTube, do Kick ou do TikTok (https).`,
    profile: 'Escolha o seu @ no perfil antes.',
    banned: 'Esta conta não pode pedir a tag.',
    open: 'Você já tem um pedido.',
    offline: 'Sem conexão. Tente de novo.',
  },
  signIn: 'Entre na sua conta e escolha o seu @ para pedir a tag.',
  loading: 'Carregando…',
  channels: 'CANAIS',
  back: 'Voltar',
}

const en: Words = {
  tag: 'STREAMER',
  row: { ask: "I'm a content creator", pending: 'Content creator: under review', approved: 'Verified content creator' },
  title: 'Content creator',
  intro:
    'Do you stream or make videos of Pokémon Survivors? Send us your channel links. The team checks them and, once approved, you get the STREAMER tag on your profile and in the Poké Realm (with your channel link), the Content Creator title and the creator frame.',
  field: (n) => `CHANNEL ${n}`,
  placeholder: 'twitch.tv/yourchannel',
  hint: 'Twitch, YouTube, Kick or TikTok. Up to 3 links.',
  send: 'Send request',
  sending: 'Sending…',
  status: {
    pending: (at) => `Request sent on ${at}. The team will check it soon.`,
    approved: 'Verified! Everyone sees your tag and your channels.',
    rejected: "Your last request wasn't approved. Check the links and send it again.",
    revoked: 'The team removed your tag. You can ask again.',
  },
  errors: {
    empty: 'Add at least one link.',
    many: 'Three links at most.',
    invalid: (n) => `Link ${n} isn't a Twitch, YouTube, Kick or TikTok channel (https).`,
    profile: 'Pick your @ on your profile first.',
    banned: "This account can't ask for the tag.",
    open: 'You already have a request.',
    offline: 'No connection. Try again.',
  },
  signIn: 'Sign in and pick your @ to ask for the tag.',
  loading: 'Loading…',
  channels: 'CHANNELS',
  back: 'Back',
}

const es: Words = {
  tag: 'STREAMER',
  row: { ask: 'Soy creador(a) de contenido', pending: 'Creador(a) de contenido: en revisión', approved: 'Creador(a) de contenido verificado(a)' },
  title: 'Creador(a) de contenido',
  intro:
    '¿Haces directos o videos de Pokémon Survivors? Envía los enlaces de tus canales. El equipo los revisa y, si los aprueba, recibes la etiqueta STREAMER en tu perfil y en el Poké Realm (con el enlace de tu canal), el título Creador(a) de Contenido y el marco de creador.',
  field: (n) => `CANAL ${n}`,
  placeholder: 'twitch.tv/tucanal',
  hint: 'Twitch, YouTube, Kick o TikTok. Hasta 3 enlaces.',
  send: 'Enviar solicitud',
  sending: 'Enviando…',
  status: {
    pending: (at) => `Solicitud enviada el ${at}. El equipo la revisará pronto.`,
    approved: '¡Verificado! Todos ven tu etiqueta y tus canales.',
    rejected: 'Tu última solicitud no fue aprobada. Revisa los enlaces y envíala de nuevo.',
    revoked: 'El equipo quitó tu etiqueta. Puedes pedirla de nuevo.',
  },
  errors: {
    empty: 'Agrega al menos un enlace.',
    many: 'Tres enlaces como máximo.',
    invalid: (n) => `El enlace ${n} no es un canal de Twitch, YouTube, Kick o TikTok (https).`,
    profile: 'Elige tu @ en el perfil primero.',
    banned: 'Esta cuenta no puede pedir la etiqueta.',
    open: 'Ya tienes una solicitud.',
    offline: 'Sin conexión. Inténtalo de nuevo.',
  },
  signIn: 'Inicia sesión y elige tu @ para pedir la etiqueta.',
  loading: 'Cargando…',
  channels: 'CANALES',
  back: 'Volver',
}

const fr: Words = {
  tag: 'STREAMER',
  row: { ask: 'Je suis créateur·rice de contenu', pending: 'Créateur·rice de contenu : en examen', approved: 'Créateur·rice de contenu vérifié·e' },
  title: 'Créateur·rice de contenu',
  intro:
    "Tu fais des lives ou des vidéos de Pokémon Survivors ? Envoie les liens de tes chaînes. L'équipe les vérifie et, une fois approuvé, tu reçois le badge STREAMER sur ton profil et dans le Poké Realm (avec le lien de ta chaîne), le titre Créateur·rice de Contenu et le cadre de créateur.",
  field: (n) => `CHAÎNE ${n}`,
  placeholder: 'twitch.tv/tachaine',
  hint: "Twitch, YouTube, Kick ou TikTok. Jusqu'à 3 liens.",
  send: 'Envoyer la demande',
  sending: 'Envoi…',
  status: {
    pending: (at) => `Demande envoyée le ${at}. L'équipe la vérifiera bientôt.`,
    approved: 'Vérifié ! Tout le monde voit ton badge et tes chaînes.',
    rejected: "Ta dernière demande n'a pas été approuvée. Vérifie les liens et renvoie-la.",
    revoked: "L'équipe a retiré ton badge. Tu peux le redemander.",
  },
  errors: {
    empty: 'Ajoute au moins un lien.',
    many: 'Trois liens au maximum.',
    invalid: (n) => `Le lien ${n} n'est pas une chaîne Twitch, YouTube, Kick ou TikTok (https).`,
    profile: "Choisis d'abord ton @ sur ton profil.",
    banned: 'Ce compte ne peut pas demander le badge.',
    open: 'Tu as déjà une demande.',
    offline: 'Pas de connexion. Réessaie.',
  },
  signIn: 'Connecte-toi et choisis ton @ pour demander le badge.',
  loading: 'Chargement…',
  channels: 'CHAÎNES',
  back: 'Retour',
}

const zh: Words = {
  tag: '實況主',
  row: { ask: '我是內容創作者', pending: '內容創作者：審核中', approved: '已認證的內容創作者' },
  title: '內容創作者',
  intro: '你有直播或製作寶可夢生存戰的影片嗎？送出你的頻道連結。團隊審核通過後，你會在個人檔案和 Poké Realm 獲得「實況主」標籤（附上頻道連結），以及「內容創作者」稱號和創作者相框。',
  field: (n) => `頻道 ${n}`,
  placeholder: 'twitch.tv/你的頻道',
  hint: 'Twitch、YouTube、Kick 或 TikTok，最多 3 個連結。',
  send: '送出申請',
  sending: '送出中…',
  status: {
    pending: (at) => `已於 ${at} 送出申請，團隊會盡快審核。`,
    approved: '已認證！所有人都看得到你的標籤和頻道。',
    rejected: '上次的申請沒有通過。請檢查連結後再送一次。',
    revoked: '團隊已移除你的標籤。你可以重新申請。',
  },
  errors: {
    empty: '請至少填一個連結。',
    many: '最多 3 個連結。',
    invalid: (n) => `連結 ${n} 不是 Twitch、YouTube、Kick 或 TikTok 的頻道（https）。`,
    profile: '請先在個人檔案選好你的 @。',
    banned: '這個帳號無法申請標籤。',
    open: '你已經有一筆申請了。',
    offline: '沒有連線，請再試一次。',
  },
  signIn: '登入並選好你的 @ 才能申請標籤。',
  loading: '載入中…',
  channels: '頻道',
  back: '返回',
}

export const CREATOR_WORDS: Record<'pt' | 'en' | 'es' | 'fr' | 'zh', Words> = { pt, en, es, fr, zh }
