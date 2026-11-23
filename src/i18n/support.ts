import type { SupportMilestone } from '../ui/supportAskRules'
import type { SupporterTier } from '../game/supporters'

/**
 * Support's words in the game: the gem shop's Patreon card
 * (`ui/patreonCard.ts`), the Hall's gems tile and the lobby's ask at a
 * milestone (`ui/supportAsk.ts`), a table per language (`pt` is the
 * reference). Gems and prices come in as arguments, read from the data
 * (`GEM_PATREON`, `PATREON_TIERS`), never written here.
 */
type Words = {
  card: {
    title: string
    names: Record<SupporterTier, string>
    /** A tier's price a month, `US$ 5`. */
    price: (usd: string) => string
    perMonth: (gems: string) => string
    perks: string
    join: string
    /** Signed in, not linked yet: the Hall's link, from here. */
    link: string
    /** Linked with an active pledge: the player's own tier and what it brings. */
    yours: (tier: string) => string
    yoursGems: (gems: string) => string
    /** The last paid charge's date and, while it's ahead, the next one's (`nextCharge`). */
    charges: (last: string, next: string | null) => string
    manage: string
    offline: string
  }
  /** The Hall's tile for anyone not supporting yet: the least a month, and every tier's on hover. */
  tile: (gems: string) => string
  tileTitle: (tiers: string) => string
  ask: {
    title: Record<SupportMilestone, string>
    body: string
    perks: (gems: string) => string
    patreon: string
    donate: string
    later: string
  }
}

export const SUPPORT_WORDS: Record<'pt' | 'en' | 'es' | 'fr' | 'zh', Words> = {
  pt: {
    card: {
      title: 'Mensal no Patreon',
      names: { supporter: 'Apoiador(a)', gold: 'Ouro', diamond: 'Diamante' },
      price: (usd) => `${usd}/mês`,
      perMonth: (gems) => `${gems} gemas/mês`,
      perks: 'E mais: shiny à escolha, companheiro e o seu nome no Hall da Fama.',
      join: 'Apoiar no Patreon',
      link: 'Já apoio: vincular',
      yours: (tier) => `Seu Patreon: ${tier}`,
      yoursGems: (gems) => `${gems} gemas chegam a cada cobrança mensal, no seu dia de cobrança do Patreon. Obrigado! ♥`,
      charges: (last, next) => `Última cobrança: ${last}${next ? ` · próxima por volta de ${next}` : ''}`,
      manage: 'Ver no Patreon',
      offline: 'Não deu para abrir o Patreon agora.',
    },
    tile: (gems) => `${gems}+ gemas/mês`,
    tileTitle: (tiers) => `No Patreon, gemas todo mês: ${tiers}`,
    ask: {
      title: { runs25: '25 partidas!', nightmare: 'Mewtwo caiu no Pesadelo!', runs100: '100 partidas!' },
      body: 'O Pokémon Survivors é feito por uma pessoa só, é grátis e não tem anúncios. Se ele te diverte, seu apoio mantém os servidores no ar e as atualizações chegando.',
      perks: (gems) => `No Patreon, até ${gems} gemas por mês. E quem apoia ganha um shiny à escolha, um companheiro e o nome no Hall da Fama.`,
      patreon: 'Patreon (mensal)',
      donate: 'Doar uma vez',
      later: 'Agora não',
    },
  },
  en: {
    card: {
      title: 'Monthly on Patreon',
      names: { supporter: 'Supporter', gold: 'Gold', diamond: 'Diamond' },
      price: (usd) => `${usd}/month`,
      perMonth: (gems) => `${gems} gems/month`,
      perks: 'Plus: a shiny of your choice, a companion and your name in the Hall of Fame.',
      join: 'Support on Patreon',
      link: 'Already a patron: link',
      yours: (tier) => `Your Patreon: ${tier}`,
      yoursGems: (gems) => `${gems} gems arrive with each monthly charge, on your Patreon billing day. Thank you! ♥`,
      charges: (last, next) => `Last charge: ${last}${next ? ` · next around ${next}` : ''}`,
      manage: 'View on Patreon',
      offline: "Couldn't open Patreon right now.",
    },
    tile: (gems) => `${gems}+ gems/month`,
    tileTitle: (tiers) => `On Patreon, gems every month: ${tiers}`,
    ask: {
      title: { runs25: '25 runs!', nightmare: 'Mewtwo fell on Nightmare!', runs100: '100 runs!' },
      body: 'Pokémon Survivors is made by one person, it’s free and has no ads. If you’re having fun, your support keeps the servers up and the updates coming.',
      perks: (gems) => `On Patreon, up to ${gems} gems a month. And supporters get a shiny of their choice, a companion and their name in the Hall of Fame.`,
      patreon: 'Patreon (monthly)',
      donate: 'Donate once',
      later: 'Not now',
    },
  },
  es: {
    card: {
      title: 'Mensual en Patreon',
      names: { supporter: 'Patrocinador(a)', gold: 'Oro', diamond: 'Diamante' },
      price: (usd) => `${usd}/mes`,
      perMonth: (gems) => `${gems} gemas/mes`,
      perks: 'Y más: un shiny a elección, un compañero y tu nombre en el Salón de la Fama.',
      join: 'Apoyar en Patreon',
      link: 'Ya apoyo: vincular',
      yours: (tier) => `Tu Patreon: ${tier}`,
      yoursGems: (gems) => `${gems} gemas llegan con cada cobro mensual, en tu día de cobro de Patreon. ¡Gracias! ♥`,
      charges: (last, next) => `Último cobro: ${last}${next ? ` · el próximo hacia el ${next}` : ''}`,
      manage: 'Ver en Patreon',
      offline: 'No se pudo abrir Patreon ahora.',
    },
    tile: (gems) => `${gems}+ gemas/mes`,
    tileTitle: (tiers) => `En Patreon, gemas cada mes: ${tiers}`,
    ask: {
      title: { runs25: '¡25 partidas!', nightmare: '¡Mewtwo cayó en Pesadilla!', runs100: '¡100 partidas!' },
      body: 'Pokémon Survivors lo hace una sola persona, es gratis y no tiene anuncios. Si te divierte, tu apoyo mantiene los servidores en línea y las actualizaciones llegando.',
      perks: (gems) => `En Patreon, hasta ${gems} gemas al mes. Y quien apoya recibe un shiny a elección, un compañero y su nombre en el Salón de la Fama.`,
      patreon: 'Patreon (mensual)',
      donate: 'Donar una vez',
      later: 'Ahora no',
    },
  },
  fr: {
    card: {
      title: 'Chaque mois sur Patreon',
      names: { supporter: 'Soutien', gold: 'Or', diamond: 'Diamant' },
      price: (usd) => `${usd}/mois`,
      perMonth: (gems) => `${gems} gemmes/mois`,
      perks: 'En plus : un chromatique au choix, un compagnon et ton nom au Panthéon.',
      join: 'Soutenir sur Patreon',
      link: 'Déjà soutien : lier',
      yours: (tier) => `Ton Patreon : ${tier}`,
      yoursGems: (gems) => `${gems} gemmes arrivent à chaque prélèvement mensuel, le jour où Patreon te prélève. Merci ! ♥`,
      charges: (last, next) => `Dernier prélèvement : ${last}${next ? ` · le prochain vers le ${next}` : ''}`,
      manage: 'Voir sur Patreon',
      offline: 'Impossible d’ouvrir Patreon pour l’instant.',
    },
    tile: (gems) => `${gems}+ gemmes/mois`,
    tileTitle: (tiers) => `Sur Patreon, des gemmes chaque mois : ${tiers}`,
    ask: {
      title: { runs25: '25 parties !', nightmare: 'Mewtwo est tombé en Cauchemar !', runs100: '100 parties !' },
      body: 'Pokémon Survivors est fait par une seule personne, gratuit et sans pubs. S’il t’amuse, ton soutien garde les serveurs en ligne et les mises à jour à venir.',
      perks: (gems) => `Sur Patreon, jusqu’à ${gems} gemmes par mois. Et les soutiens reçoivent un chromatique au choix, un compagnon et leur nom au Panthéon.`,
      patreon: 'Patreon (mensuel)',
      donate: 'Donner une fois',
      later: 'Pas maintenant',
    },
  },
  zh: {
    card: {
      title: 'Patreon 每月贊助',
      names: { supporter: '贊助者', gold: '金級', diamond: '鑽石級' },
      price: (usd) => `每月 ${usd}`,
      perMonth: (gems) => `每月 ${gems} 顆寶石`,
      perks: '還有：自選異色寶可夢、同伴，以及你在名人堂的名字。',
      join: '在 Patreon 贊助',
      link: '已經贊助：連結',
      yours: (tier) => `你的 Patreon：${tier}`,
      yoursGems: (gems) => `每次 Patreon 月扣款時送達 ${gems} 顆寶石，就在你的扣款日。謝謝你！♥`,
      charges: (last, next) => `上次扣款：${last}${next ? `・下次約在 ${next}` : ''}`,
      manage: '前往 Patreon',
      offline: '目前無法開啟 Patreon。',
    },
    tile: (gems) => `每月 ${gems}+ 寶石`,
    tileTitle: (tiers) => `在 Patreon 每月獲得寶石：${tiers}`,
    ask: {
      title: { runs25: '25 場對局！', nightmare: '在惡夢難度擊敗超夢！', runs100: '100 場對局！' },
      body: 'Pokémon Survivors 由一個人製作，免費又沒有廣告。如果你玩得開心，你的支持能讓伺服器持續運作，更新也會不斷推出。',
      perks: (gems) => `在 Patreon 每月最多可得 ${gems} 顆寶石。贊助者還能獲得自選的異色寶可夢、一隻同伴，並在名人堂留下名字。`,
      patreon: 'Patreon（每月）',
      donate: '單次捐款',
      later: '下次再說',
    },
  },
}
