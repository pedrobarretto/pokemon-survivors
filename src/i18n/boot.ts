import { inLanguage, type Written } from '.'

type BootText = { slow: string; failed: string; reload: string }

/**
 * The only words the page has while the game can't boot (`ui/bootNotice.ts`): bundled with the entry, never a chunk,
 * since a language's chunk that won't load is one of the reasons it can't. Simplified Chinese reads the Traditional,
 * converted once its converter has landed (unconverted before: still readable).
 */
const BOOT_TEXT = {
  pt: { slow: 'Carregando o jogo… a conexão está lenta.', failed: 'Não deu para carregar o jogo. Confira a conexão e tente de novo.', reload: 'Recarregar' },
  en: { slow: 'Loading the game… the connection is slow.', failed: "The game couldn't load. Check your connection and try again.", reload: 'Reload' },
  es: { slow: 'Cargando el juego… la conexión está lenta.', failed: 'No se pudo cargar el juego. Revisa tu conexión e inténtalo de nuevo.', reload: 'Recargar' },
  fr: { slow: 'Chargement du jeu… la connexion est lente.', failed: "Le jeu n'a pas pu se charger. Vérifie ta connexion et réessaie.", reload: 'Recharger' },
  zh: { slow: '遊戲載入中……網路連線較慢。', failed: '遊戲無法載入。請檢查網路連線後再試一次。', reload: '重新載入' },
} as const satisfies Record<Written, BootText>

export const bootText = () => inLanguage<BootText>(BOOT_TEXT)
