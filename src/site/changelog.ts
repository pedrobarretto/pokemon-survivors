import type { Localized } from './localized'

/** One change inside an update: a headline and its details, a sentence or two each. */
export type ChangelogChange = {
  title: Localized
  notes: readonly Localized[]
}

/** What shipped on one day, for players: a few highlights up top, then every change. */
export type ChangelogUpdate = {
  /** ISO date (`YYYY-MM-DD`) the update went live. One update per day, so it also names the update. */
  date: string
  title: Localized
  /** 3 to 5 one-liners, what a player most wants to hear: the lobby's Novidades shows the newest update's. */
  highlights: readonly Localized[]
  changes: readonly ChangelogChange[]
}

/**
 * Update history shown at `/novidades/`, `/en/changelog/` and `/es/novedades/`, newest first,
 * and in the lobby's Novidades (the newest update's highlights).
 * When a player-facing change ships, add it to the top update if it's from today (and revisit its
 * highlights), or open a new update on top.
 */
export const CHANGELOG: readonly ChangelogUpdate[] = [
  {
    date: '2026-10-27',
    title: { pt: 'Dojo', en: 'Dojo', es: 'Dojo', fr: 'Dojo', zh: '道場' },
    highlights: [
      { pt: 'Novo Dojo do Machoke no lobby, a oeste da sua casa: treine qualquer Pokémon que você já tem, lendários capturados inclusive, em alvos que não revidam, sem horda e sem relógio.', en: 'Machoke’s new Dojo in the lobby, west of your home: train any Pokémon you already have, captured legends included, on targets that don’t hit back, with no horde and no clock.', es: 'Nuevo Dojo de Machoke en el lobby, al oeste de tu casa: entrena a cualquier Pokémon que ya tengas, legendarios capturados incluidos, en blancos que no devuelven el golpe, sin horda y sin reloj.', fr: 'Nouveau Dojo de Machoke dans le lobby, à l’ouest de ta maison : entraîne n’importe quel Pokémon que tu as déjà, légendaires capturés compris, sur des cibles qui ne rendent pas les coups, sans horde et sans chrono.', zh: '大廳裡你家西邊新開了 Machoke 的道場：用你已經擁有的任何寶可夢（包括捕捉到的傳說寶可夢），在不會還手的靶子上修行，沒有怪群也沒有計時。' },
      { pt: 'Teste golpes (TMs e golpes lendários também), caminhos A/B, itens, formas e habilidades e veja o DPS de cada golpe no medidor.', en: 'Try moves (TMs and legendary moves too), A/B paths, items, forms and abilities and watch each move’s DPS on the meter.', es: 'Prueba movimientos (MTs y movimientos legendarios también), caminos A/B, objetos, formas y habilidades y mira el DPS de cada movimiento en el medidor.', fr: 'Essaie capacités (CT et capacités légendaires aussi), voies A/B, objets, formes et talents et regarde le DPS de chaque capacité sur le compteur.', zh: '試試招式（也包括招式學習器和傳說招式）、A/B 路線、道具、型態和特性，在計量表上看每個招式的 DPS。' },
      { pt: 'Salve a build: nas partidas, as cartas que seguem ela ganham ★ BUILD.', en: 'Save the build: in your runs, the cards that follow it wear ★ BUILD.', es: 'Guarda la build: en tus partidas, las cartas que la siguen llevan ★ BUILD.', fr: 'Sauve le build : en partie, les cartes qui le suivent portent ★ BUILD.', zh: '儲存配置：對局中符合配置的卡片會標上 ★ BUILD。' },
    ],
    changes: [
      {
        title: { pt: 'Dojo e builds', en: 'Dojo and builds', es: 'Dojo y builds', fr: 'Dojo et builds', zh: '道場與配置' },
        notes: [
          { pt: 'O Dojo do Machoke fica a oeste da sua casa no lobby: vá pelo botão Dojo ou passeando até lá. Escolha qualquer Pokémon que você já tem e treine sem horda, sem relógio e sem desmaiar, com as suas melhorias da loja e Bottle Caps.', en: 'Machoke’s Dojo stands west of your home in the lobby: take the Dojo button or walk there. Pick any Pokémon you already have and train with no horde, no clock and no fainting, with your shop upgrades and Bottle Caps.', es: 'El Dojo de Machoke está al oeste de tu casa en el lobby: entra con el botón Dojo o caminando hasta allí. Elige cualquier Pokémon que ya tengas y entrena sin horda, sin reloj y sin debilitarte, con tus mejoras de la tienda y Bottle Caps.', fr: 'Le Dojo de Machoke se trouve à l’ouest de ta maison dans le lobby : passe par le bouton Dojo ou marche jusque-là. Choisis n’importe quel Pokémon que tu as déjà et entraîne-toi sans horde, sans chrono et sans K.O., avec tes améliorations de la boutique et tes Bottle Caps.', zh: 'Machoke 的道場就在大廳裡你家的西邊：按「道場」按鈕或散步過去。選一隻你已經擁有的寶可夢，在沒有怪群、沒有計時、也不會倒下的情況下修行，商店升級和 Bottle Caps 都會生效。' },
          { pt: 'No painel você sobe e desce o nível de cada golpe (e escolhe o caminho A ou B nos níveis 4 e 7), equipa itens, troca de forma e de habilidade e escolhe os alvos: 1, 3, 8 ou 24, de 16 tipos diferentes, ou o Snorlax como chefe. O medidor mostra o DPS dos últimos 5 segundos, a média e o dano de cada golpe.', en: 'In the panel you raise and lower each move’s level (and pick path A or B at levels 4 and 7), hold items, switch forms and abilities and choose the targets: 1, 3, 8 or 24, across 16 types, or Snorlax as a boss. The meter shows the DPS of the last 5 seconds, the average and each move’s damage.', es: 'En el panel subes y bajas el nivel de cada movimiento (y eliges el camino A o B en los niveles 4 y 7), equipas objetos, cambias de forma y de habilidad y eliges los blancos: 1, 3, 8 o 24, de 16 tipos distintos, o Snorlax como jefe. El medidor muestra el DPS de los últimos 5 segundos, el promedio y el daño de cada movimiento.', fr: 'Dans le panneau, tu montes et baisses le niveau de chaque capacité (et choisis la voie A ou B aux niveaux 4 et 7), équipes des objets, changes de forme et de talent et choisis les cibles : 1, 3, 8 ou 24, parmi 16 types, ou Snorlax comme boss. Le compteur affiche le DPS des 5 dernières secondes, la moyenne et les dégâts de chaque capacité.', zh: '在面板裡可以調整每個招式的等級（並在 4 級和 7 級選擇 A 或 B 路線）、攜帶道具、切換型態和特性，還能選擇靶子：1、3、8 或 24 個，涵蓋 16 種屬性，或是當作頭目的 Snorlax。計量表會顯示最近 5 秒的 DPS、平均值和每個招式的傷害。' },
          { pt: 'A aba Golpes tem três prateleiras: os golpes da família, todas as TMs (as exclusivas da loja também) e os golpes dos lendários. Como numa partida, só cabe um golpe lendário e um golpe manual por vez.', en: 'The Moves tab has three shelves: the family’s moves, every TM (the shop-exclusive ones too) and the legendaries’ moves. As in a run, only one legendary move and one manual move fit at a time.', es: 'La pestaña Movimientos tiene tres estantes: los movimientos de la familia, todas las MTs (las exclusivas de la tienda también) y los movimientos de los legendarios. Como en una partida, solo cabe un movimiento legendario y un movimiento manual a la vez.', fr: 'L’onglet Capacités a trois rayons : les capacités de la famille, toutes les CT (les exclusives de la boutique aussi) et les capacités des légendaires. Comme en partie, une seule capacité légendaire et une seule capacité manuelle à la fois.', zh: '「招式」分頁有三個貨架：家族的招式、所有招式學習器（包括商店限定的）以及傳說寶可夢的招式。和對局一樣，一次只能放一個傳說招式和一個手動招式。' },
          { pt: 'Os lendários capturados também treinam no Dojo (aba Lendários da seleção): na aba Forma você escolhe o despertar, do Nv 1 ao Nv 28, com a forma Primal ou Mega onde houver.', en: 'Captured legends train at the Dojo too (the Legends tab of the select): on the Form tab you pick the awakening, from Lv 1 to Lv 28, with the Primal or Mega form where there is one.', es: 'Los legendarios capturados también entrenan en el Dojo (pestaña Legendarios de la selección): en la pestaña Forma eliges el despertar, del Nv 1 al Nv 28, con la forma Primigenia o Mega donde la haya.', fr: 'Les légendaires capturés s’entraînent aussi au Dojo (onglet Légendaires de la sélection) : dans l’onglet Forme, tu choisis l’éveil, du Nv 1 au Nv 28, avec la forme Primo ou Méga quand il y en a une.', zh: '捕捉到的傳說寶可夢也能在道場修行（選擇畫面的「傳說」分頁）：在「型態」分頁選擇覺醒階段，從 Lv 1 到 Lv 28，有原始回歸或超級進化型態的也能切換。' },
          { pt: 'No celular, o painel do Dojo ficou mais enxuto e a lista ganhou espaço, e a câmera mantém o seu Pokémon na parte do campo que o painel deixa livre.', en: 'On phones, the Dojo’s panel is leaner and the list has more room, and the camera keeps your Pokémon in the part of the field the panel leaves open.', es: 'En el celular, el panel del Dojo es más compacto y la lista tiene más espacio, y la cámara mantiene a tu Pokémon en la parte del campo que el panel deja libre.', fr: 'Sur téléphone, le panneau du Dojo est plus compact et la liste a plus de place, et la caméra garde ton Pokémon dans la partie du terrain que le panneau laisse libre.', zh: '在手機上，道場面板更精簡、清單空間更大，鏡頭也會讓你的寶可夢待在面板沒擋住的那片場地中。' },
          { pt: 'Salvar build guarda a combinação para aquele Pokémon (e sincroniza com a sua conta). Ela nunca muda a partida: nas telas de nível, evolução e habilidade, as cartas que seguem a build ganham a marca ★ BUILD, para você não ter que pensar na hora.', en: 'Save build keeps the combo for that Pokémon (and syncs with your account). It never changes a run: on the level-up, evolution and ability screens, the cards that follow the build get the ★ BUILD mark, so you don’t have to think on the fly.', es: 'Guardar build guarda la combinación para ese Pokémon (y se sincroniza con tu cuenta). Nunca cambia la partida: en las pantallas de nivel, evolución y habilidad, las cartas que siguen la build llevan la marca ★ BUILD, para que no tengas que pensar sobre la marcha.', fr: 'Sauver le build garde la combinaison pour ce Pokémon (et se synchronise avec ton compte). Il ne change jamais la partie : sur les écrans de niveau, d’évolution et de talent, les cartes qui suivent le build portent la marque ★ BUILD, pour ne pas avoir à réfléchir dans le feu de l’action.', zh: '「儲存配置」會為那隻寶可夢記下這個組合（並同步到你的帳號）。它絕不會改變對局：在升級、進化和特性畫面中，符合配置的卡片會標上 ★ BUILD，讓你不必臨場思考。' },
        ],
      },
      {
        title: { pt: 'Co-op', en: 'Co-op', es: 'Co-op' },
        notes: [
          { pt: 'Celulares mais lentos não ficam mais presos em "Sincronizando…" no fim da partida: quem fica para trás volta a alcançar o time.', en: 'Slower phones no longer get stuck on "Syncing…" late in a run: a player who falls behind catches up with the team again.', es: 'Los celulares más lentos ya no se quedan atascados en "Sincronizando…" al final de la partida: quien se queda atrás vuelve a alcanzar al equipo.' },
          { pt: 'O co-op agora funciona em iPhones e navegadores mais antigos, que não conseguiam acompanhar a partida do time.', en: 'Co-op now works on older iPhones and browsers, which couldn’t keep up with the team’s run.', es: 'El co-op ahora funciona en iPhones y navegadores más antiguos, que no lograban seguir la partida del equipo.' },
        ],
      },
    ],
  },
  {
    date: '2026-10-26',
    title: { pt: 'Patreon e OG Supporters', en: 'Patreon and OG Supporters', es: 'Patreon y OG Supporters', fr: 'Patreon et OG Supporters', zh: 'Patreon 與 OG 贊助者' },
    highlights: [
      { pt: 'Agora dá para apoiar o jogo todo mês pelo Patreon: Apoiador(a) (US$ 5), Ouro (US$ 10) e Diamante (US$ 20). Vincule o Patreon no Hall da Fama e as recompensas chegam sozinhas.', en: 'You can now support the game every month on Patreon: Supporter (US$ 5), Gold (US$ 10) and Diamond (US$ 20). Link your Patreon in the Hall of Fame and the rewards arrive on their own.', es: 'Ahora puedes apoyar el juego cada mes en Patreon: Patrocinador(a) (US$ 5), Oro (US$ 10) y Diamante (US$ 20). Vincula tu Patreon en el Salón de la Fama y las recompensas llegan solas.', fr: 'Tu peux maintenant soutenir le jeu chaque mois sur Patreon : Soutien (5 US$), Or (10 US$) et Diamant (20 US$). Lie ton Patreon dans le Panthéon et les récompenses arrivent toutes seules.', zh: '現在可以在 Patreon 每月支持遊戲：贊助者（5 美元）、金級（10 美元）與鑽石級（20 美元）。在名人堂連結 Patreon，獎勵就會自動送達。' },
      { pt: 'Quem apoiou o jogo até hoje virou OG Supporter, para sempre: selo OG ao lado do nome, o título Apoiador(a) OG na caixa de presentes e uma seção só sua no Hall da Fama. Obrigado! ♥', en: 'Everyone who supported the game until today is now an OG Supporter, for good: an OG badge next to your name, the OG Supporter title in your gift box and your own section in the Hall of Fame. Thank you! ♥', es: 'Quien apoyó el juego hasta hoy ahora es OG Supporter, para siempre: insignia OG junto a tu nombre, el título Patrocinador(a) OG en tu caja de regalos y una sección propia en el Salón de la Fama. ¡Gracias! ♥', fr: 'Tous ceux qui ont soutenu le jeu jusqu’à aujourd’hui sont désormais OG Supporters, pour toujours : un badge OG à côté de ton nom, le titre Soutien OG dans ta boîte à cadeaux et ta propre section dans le Panthéon. Merci ! ♥', zh: '至今支持過遊戲的人現在都是 OG 贊助者，永久有效：名字旁的 OG 徽章、禮物箱裡的「OG 贊助者」稱號，以及名人堂裡專屬的區塊。謝謝你！♥' },
      { pt: 'O novo nível Diamante traz selo de diamante, um companheiro lendário entre os lendários que você capturou e uma votação mensal por um novo Pokémon ultrarraro.', en: 'The new Diamond tier brings a diamond badge, a legendary companion from the legendaries you have caught and a monthly vote on a new ultra-rare Pokémon.', es: 'El nuevo nivel Diamante trae insignia de diamante, un compañero legendario entre los legendarios que capturaste y una votación mensual por un nuevo Pokémon ultrarraro.', fr: 'Le nouveau palier Diamant apporte un badge diamant, un compagnon légendaire parmi les légendaires que tu as capturés et un vote mensuel pour un nouveau Pokémon ultra-rare.', zh: '全新的 鑽石級帶來鑽石徽章、從你捕獲的傳說寶可夢中挑選的傳說同伴，以及每月一次的超稀有寶可夢投票。' },
      { pt: 'Tema escuro: menus, cartas e HUD em tons escuros, mais leves para os olhos à noite. Escolha Claro, Escuro ou Sistema em Ajustes → Jogo → Tema.', en: 'Dark theme: menus, cards and HUD in dark tones, easier on the eyes at night. Pick Light, Dark or System in Settings → Game → Theme.', es: 'Tema oscuro: menús, cartas y HUD en tonos oscuros, más suaves para los ojos de noche. Elige Claro, Oscuro o Sistema en Ajustes → Juego → Tema.', fr: 'Thème sombre : menus, cartes et HUD dans des tons sombres, plus doux pour les yeux la nuit. Choisis Clair, Sombre ou Système dans Réglages → Jeu → Thème.', zh: '深色主題：選單、卡片和 HUD 改用深色調，晚上看更舒服。在設定 → 遊戲 → 主題選擇淺色、深色或跟隨系統。' },
      { pt: 'Garantia nos ovos: depois de 5 ovos do mesmo tipo sem Pokémon novo, o próximo traz um com certeza.', en: 'Egg guarantee: after 5 eggs of a kind with no new Pokémon, the next one is sure to bring one.', es: 'Garantía en los huevos: después de 5 huevos del mismo tipo sin Pokémon nuevo, el siguiente trae uno seguro.', fr: 'Garantie sur les œufs : après 5 œufs du même type sans nouveau Pokémon, le suivant en apporte un à coup sûr.', zh: '孵蛋保底：同一種蛋連續 5 顆沒孵出新寶可夢，下一顆必定是新的。' },
    ],
    changes: [
      {
        title: { pt: 'Patreon', en: 'Patreon', es: 'Patreon', fr: 'Patreon', zh: 'Patreon' },
        notes: [
          { pt: 'Três níveis mensais no Patreon. Apoiador(a) (US$ 5): selo, cargo e canal no Discord, um shiny à sua escolha (sem lendários), um companheiro que segue você nas partidas (shiny também), voto no próximo Pokémon e um lugar no Hall da Fama enquanto for membro. Ouro (US$ 10): tudo do Apoiador(a), com selo e cargo dourados e lugar permanente no Hall da Fama. Diamante (US$ 20): tudo do Ouro, com selo e cargo de diamante, companheiro lendário, votação mensal ultrarrara e um card com decoração de diamante no Hall da Fama.', en: 'Three monthly tiers on Patreon. Supporter (US$ 5): a badge, a Discord role and channel, a shiny of your choice (legendaries excluded), a companion that follows you in runs (shiny too), a vote on the next Pokémon and a spot in the Hall of Fame while you are a member. Gold (US$ 10): everything in Supporter, with a gold badge and role and a permanent spot in the Hall of Fame. Diamond (US$ 20): everything in Gold, with a diamond badge and role, a legendary companion, a monthly ultra-rare vote and a Hall of Fame card with diamond decorations.', es: 'Tres niveles mensuales en Patreon. Patrocinador(a) (US$ 5): insignia, rol y canal en Discord, un shiny a tu elección (sin legendarios), un compañero que te sigue en las partidas (también shiny), voto en el próximo Pokémon y un lugar en el Salón de la Fama mientras seas miembro. Oro (US$ 10): todo lo de Patrocinador(a), con insignia y rol dorados y un lugar permanente en el Salón de la Fama. Diamante (US$ 20): todo lo de Oro, con insignia y rol de diamante, compañero legendario, votación mensual ultrarrara y una tarjeta con decoración de diamante en el Salón de la Fama.', fr: 'Trois paliers mensuels sur Patreon. Soutien (5 US$) : un badge, un rôle et un salon Discord, un shiny au choix (hors légendaires), un compagnon qui te suit en partie (shiny aussi), un vote pour le prochain Pokémon et une place dans le Panthéon tant que tu es membre. Or (10 US$) : tout le Soutien, avec badge et rôle dorés et une place permanente dans le Panthéon. Diamant (20 US$) : tout le palier Or, avec badge et rôle diamant, un compagnon légendaire, un vote mensuel ultra-rare et une carte décorée de diamants dans le Panthéon.', zh: 'Patreon 有三個每月等級。贊助者（5 美元）：徽章、Discord 身分組與頻道、自選一隻異色寶可夢（傳說除外）、在對局中跟著你的同伴（也可以是異色）、下一隻寶可夢的投票權，以及會員期間名人堂的一席之地。金級（10 美元）：贊助者 的全部內容，加上金色徽章與身分組，以及名人堂的永久位置。鑽石級（20 美元）：金級 的全部內容，加上鑽石徽章與身分組、傳說同伴、每月超稀有投票，以及名人堂裡的鑽石裝飾卡片。' },
          { pt: 'Para receber, entre na sua conta e toque em Vincular Patreon no Hall da Fama. O nível segue a assinatura ativa: se ela for cancelada, o selo e o companheiro voltam ao que você tinha antes, e os presentes já recebidos ficam com você.', en: 'To get them, sign in and tap Link Patreon in the Hall of Fame. Your tier follows your active pledge: if it ends, the badge and companion go back to what you had before, and gifts already received stay yours.', es: 'Para recibirlas, entra en tu cuenta y toca Vincular Patreon en el Salón de la Fama. El nivel sigue la suscripción activa: si termina, la insignia y el compañero vuelven a lo que tenías antes, y los regalos ya recibidos se quedan contigo.', fr: 'Pour les recevoir, connecte-toi et touche Lier Patreon dans le Panthéon. Ton palier suit ton abonnement actif : s’il s’arrête, le badge et le compagnon reviennent à ce que tu avais avant, et les cadeaux déjà reçus restent à toi.', zh: '登入後在名人堂點選「連結 Patreon」即可領取。等級依照有效的訂閱而定：訂閱結束後，徽章與同伴會回到原本的狀態，已收到的禮物仍然屬於你。' },
          { pt: 'Todo mundo vê a votação Diamante no Hall da Fama, mas só os Apoiadores Diamante votam. Enquanto houver uma votação aberta em que você ainda não votou, o card do Hall da Fama no lobby avisa e abre direto nela.', en: 'Everyone can see the Diamond poll in the Hall of Fame, but only Diamond Supporters vote. While a poll you haven’t voted in is open, the Hall of Fame card in the lobby lets you know and opens straight onto it.', es: 'Todos ven la votación Diamante en el Salón de la Fama, pero solo votan los Patrocinadores Diamante. Mientras haya una votación abierta en la que todavía no votaste, la tarjeta del Salón de la Fama en el lobby te avisa y abre directo en ella.', fr: 'Tout le monde voit le vote Diamant dans le Panthéon, mais seuls les Soutiens Diamant votent. Tant qu’un vote où tu n’as pas encore voté est ouvert, la carte du Panthéon dans le lobby te prévient et l’ouvre directement.', zh: '所有人都能在名人堂看到鑽石投票，但只有鑽石贊助者可以投票。只要還有你尚未投票的投票進行中，大廳的名人堂卡片就會提醒你，並直接開啟投票。' },
        ],
      },
      {
        title: { pt: 'OG Supporters', en: 'OG Supporters', es: 'OG Supporters', fr: 'OG Supporters', zh: 'OG 贊助者' },
        notes: [
          { pt: 'Todo mundo que doou antes do Patreon virou OG Supporter e mantém tudo o que ganhou para sempre: nível, selo, título, moldura, shiny, companheiro e cargo no Discord. Quem doou R$ 50 ou US$ 10 no total segue Ouro.', en: 'Everyone who donated before Patreon is now an OG Supporter and keeps everything they earned for good: tier, badge, title, frame, shiny, companion and Discord role. Anyone who gave R$ 50 or US$ 10 in total stays Gold.', es: 'Todos los que donaron antes de Patreon ahora son OG Supporters y conservan para siempre todo lo que ganaron: nivel, insignia, título, marco, shiny, compañero y rol en Discord. Quien donó R$ 50 o US$ 10 en total sigue siendo Oro.', fr: 'Tous ceux qui ont fait un don avant Patreon sont désormais OG Supporters et gardent pour toujours tout ce qu’ils ont gagné : palier, badge, titre, cadre, shiny, compagnon et rôle Discord. Ceux qui ont donné 50 R$ ou 10 US$ au total restent Or.', zh: '在 Patreon 之前捐款的所有人現在都是 OG 贊助者，永久保留已獲得的一切：等級、徽章、稱號、外框、異色寶可夢、同伴與 Discord 身分組。累計捐款 50 雷亞爾或 10 美元的人維持金級。' },
          { pt: 'Os OGs ganham um selo OG ao lado do selo do nível (no ranking, no perfil, no Cartão de Treinador e no Hall da Fama), o título Apoiador(a) OG na caixa de presentes, o cargo OG Supporter no Discord e uma seção própria no Hall da Fama. Assinar o Patreon soma: o selo OG continua lá.', en: 'OGs get an OG badge next to their tier badge (on the ranking, the profile, the Trainer Card and the Hall of Fame), the OG Supporter title in the gift box, the OG Supporter role on Discord and their own section in the Hall of Fame. Joining Patreon adds to it: the OG badge stays.', es: 'Los OG reciben una insignia OG junto a la de su nivel (en el ranking, el perfil, la Tarjeta de Entrenador y el Salón de la Fama), el título Patrocinador(a) OG en la caja de regalos, el rol OG Supporter en Discord y una sección propia en el Salón de la Fama. Suscribirte a Patreon suma: la insignia OG se queda.', fr: 'Les OG reçoivent un badge OG à côté du badge de leur palier (dans le classement, le profil, la Carte de Dresseur et le Panthéon), le titre Soutien OG dans la boîte à cadeaux, le rôle OG Supporter sur Discord et leur propre section dans le Panthéon. Rejoindre Patreon s’ajoute : le badge OG reste.', zh: 'OG 會在等級徽章旁多一枚 OG 徽章（排行榜、個人檔案、訓練家卡與名人堂），禮物箱裡收到「OG 贊助者」稱號、Discord 上的 OG Supporter 身分組，以及名人堂裡的專屬區塊。訂閱 Patreon 會再疊加：OG 徽章會一直保留。' },
          { pt: 'As doações avulsas na página Apoie continuam: elas tornam você Apoiador(a) para sempre. O Ouro agora vem só pelo Patreon (US$ 10 por mês).', en: 'One-time donations on the Support page are still there: they make you a Supporter for good. Gold now comes only from Patreon (US$ 10 a month).', es: 'Las donaciones únicas en la página Apoya siguen: te convierten en Patrocinador(a) para siempre. Oro ahora solo llega por Patreon (US$ 10 al mes).', fr: 'Les dons ponctuels sur la page Soutenir sont toujours là : ils font de toi un Soutien pour toujours. Or ne s’obtient plus que par Patreon (10 US$ par mois).', zh: '支持頁面的單次捐款依然保留：會讓你永久成為贊助者。金級現在只能透過 Patreon（每月 10 美元）取得。' },
        ],
      },
      {
        title: { pt: 'Tema escuro', en: 'Dark theme', es: 'Tema oscuro', fr: 'Thème sombre', zh: '深色主題' },
        notes: [
          { pt: 'Novo ajuste em Ajustes → Jogo → Tema: Claro, Escuro ou Sistema, que segue o modo escuro do celular ou do computador (o padrão). O tema escuro vale para os menus, as cartas, o HUD e as páginas do site, como o guia e o Pokédex; o mundo do jogo continua igual.', en: 'A new setting in Settings → Game → Theme: Light, Dark or System, which follows your phone’s or computer’s dark mode (the default). The dark theme covers menus, cards, the HUD and the site’s pages, like the guide and the Pokédex; the game world stays the same.', es: 'Un ajuste nuevo en Ajustes → Juego → Tema: Claro, Oscuro o Sistema, que sigue el modo oscuro del celular o de la computadora (el predeterminado). El tema oscuro cubre los menús, las cartas, el HUD y las páginas del sitio, como la guía y la Pokédex; el mundo del juego sigue igual.', fr: 'Un nouveau réglage dans Réglages → Jeu → Thème : Clair, Sombre ou Système, qui suit le mode sombre de ton téléphone ou de ton ordinateur (par défaut). Le thème sombre s’applique aux menus, aux cartes, au HUD et aux pages du site, comme le guide et le Pokédex ; le monde du jeu reste le même.', zh: '設定 → 遊戲 → 主題 新增選項：淺色、深色，或跟隨手機或電腦深色模式的「跟隨系統」（預設）。深色主題套用在選單、卡片、HUD 以及網站頁面（例如指南和圖鑑）；遊戲世界維持不變。' },
        ],
      },
      {
        title: { pt: 'Garantia nos ovos', en: 'Egg guarantee', es: 'Garantía en los huevos', fr: 'Garantie sur les œufs', zh: '孵蛋保底' },
        notes: [
          { pt: 'Cada tipo de ovo (comum, raro, ultra raro, Assombrado, do Kecleon) conta os ovos chocados seguidos sem Pokémon novo. Depois de 5, o próximo ovo daquele tipo traz uma família que você ainda não tem, com certeza, e a contagem volta a zero. A incubadora mostra a contagem de cada tipo e marca com NOVO! o ovo garantido.', en: 'Each kind of egg (common, rare, ultra rare, Haunted, Kecleon) counts the eggs hatched in a row with no new Pokémon. After 5, the next egg of that kind is sure to bring a family you don’t have yet, and the count starts over. The incubator shows each kind’s count and tags the guaranteed egg NEW!.', es: 'Cada tipo de huevo (común, raro, ultra raro, Embrujado, de Kecleon) cuenta los huevos eclosionados seguidos sin Pokémon nuevo. Después de 5, el siguiente huevo de ese tipo trae seguro una familia que todavía no tienes, y la cuenta vuelve a cero. La incubadora muestra la cuenta de cada tipo y marca con ¡NUEVO! el huevo garantizado.', fr: 'Chaque type d’œuf (commun, rare, ultra rare, Hanté, de Kecleon) compte les œufs éclos d’affilée sans nouveau Pokémon. Après 5, le prochain œuf de ce type apporte à coup sûr une famille que tu n’as pas encore, et le compte repart de zéro. L’incubateur affiche le compte de chaque type et marque l’œuf garanti NOUVEAU!.', zh: '每種蛋（普通、稀有、超稀有、鬧鬼、Kecleon）都會計算連續孵出、沒有新寶可夢的蛋數。滿 5 顆後，該種蛋的下一顆必定孵出你還沒有的家族，計數重新歸零。孵化器會顯示每種蛋的計數，並在保底的蛋上標示 NEW!。' },
        ],
      },
      {
        title: { pt: 'Névoa mais leve', en: 'Lighter fog', es: 'Niebla más ligera', fr: 'Brouillard plus léger', zh: '更淡的霧' },
        notes: [
          { pt: 'A névoa agora vem mais leve: o círculo limpo em volta de você é maior e o véu nas bordas é mais fino, então a horda continua visível sem forçar a vista. Em Ajustes → Jogo → Névoa dá para voltar à névoa Normal ou desligá-la (OFF deixa só uma bruma suave).', en: 'Fog is now lighter: the clear circle around you is bigger and the veil at the edges is thinner, so the horde stays visible without straining your eyes. In Settings → Game → Fog you can go back to Normal fog or turn it OFF (just a soft haze stays).', es: 'La niebla ahora es más ligera: el círculo despejado a tu alrededor es más grande y el velo en los bordes es más fino, así la horda sigue visible sin forzar la vista. En Ajustes → Juego → Niebla puedes volver a la niebla Normal o apagarla (OFF deja solo una bruma suave).', fr: 'Le brouillard est désormais plus léger : le cercle dégagé autour de toi est plus grand et le voile sur les bords plus fin, la horde reste visible sans te fatiguer les yeux. Dans Réglages → Jeu → Brouillard, tu peux revenir au brouillard Normal ou le couper (OFF ne laisse qu’une légère brume).', zh: '霧現在變淡了：你周圍的清晰範圍更大，邊緣的霧幕更薄，不用瞇眼也看得到敵群。在「設定 → 遊戲 → 霧」可以改回一般的霧，或把它關掉（關閉後只留下淡淡的薄霧）。' },
        ],
      },
      {
        title: { pt: 'Shiny da sorte', en: 'Lucky shinies', es: 'Shiny de la suerte', fr: 'Chromatiques chanceux', zh: '幸運異色' },
        notes: [
          { pt: 'O shiny 1 em 64 ao começar uma partida agora vale só para os iniciais. Os Pokémon dos ovos e os lendários não saem mais shiny assim: o shiny deles vem do ovo, da loja e das capturas. Reiniciar a partida até sair shiny não vale mais.', en: 'The 1 in 64 shiny at the start of a run now applies only to starters. Pokémon from eggs and legendaries no longer roll it: their shinies come from eggs, the shop and captures. Restarting until it rolls shiny no longer works.', es: 'El shiny 1 en 64 al empezar una partida ahora vale solo para los iniciales. Los Pokémon de huevos y los legendarios ya no salen shiny así: su shiny viene de los huevos, la tienda y las capturas. Reiniciar la partida hasta que salga shiny ya no sirve.', fr: 'Le chromatique à 1 sur 64 en début de partie ne vaut plus que pour les starters. Les Pokémon des œufs et les légendaires ne peuvent plus l’obtenir ainsi : leurs chromatiques viennent des œufs, de la boutique et des captures. Relancer la partie jusqu’à tomber dessus ne marche plus.', zh: '開局時 1/64 的異色現在只適用於御三家。蛋裡孵出的寶可夢和傳說寶可夢不會再這樣變成異色：牠們的異色來自孵蛋、商店和捕獲。反覆重開直到出現異色已經行不通。' },
        ],
      },
    ],
  },
  {
    date: '2026-10-25',
    title: { pt: 'Co-op online, mini mapa e controles para canhotos', en: 'Online co-op, mini map and left-handed controls', es: 'Co-op en línea, minimapa y controles para zurdos', fr: 'Coop en ligne, mini-carte et commandes pour gauchers', zh: '線上合作、小地圖與左手操作' },
    highlights: [
      { pt: 'O co-op chegou para todo mundo: até 4 treinadores na mesma partida, cada um com o seu Pokémon. É só tocar em Co-op no lobby.', en: 'Co-op is here for everyone: up to 4 trainers in the same run, each with their own Pokémon. Just tap Co-op in the lobby.', es: 'El co-op llegó para todos: hasta 4 entrenadores en la misma partida, cada uno con su Pokémon. Solo toca Co-op en el lobby.', fr: 'La coop arrive pour tout le monde : jusqu’à 4 dresseurs dans la même partie, chacun avec son Pokémon. Touche simplement Coop dans le lobby.', zh: '合作模式向所有人開放：最多 4 位訓練家同場對局，每人帶著自己的寶可夢。在大廳點選「合作模式」即可。' },
      { pt: 'Chame a turma pelo link da sala, pelo código de 5 letras ou pela sua lista de Amigos, que mostra quem está online.', en: 'Bring your friends with the room link, the 5-character code or your Friends list, which shows who’s online.', es: 'Invita a tus amigos con el enlace de la sala, el código de 5 caracteres o tu lista de Amigos, que muestra quién está en línea.', fr: 'Invite tes amis avec le lien du salon, le code à 5 caractères ou ta liste d’amis, qui montre qui est en ligne.', zh: '用房間連結、5 碼房間代碼或好友名單邀請朋友，名單會顯示誰在線上。' },
      { pt: 'Mini mapa no canto da tela: lagos, penhascos, bosques, construções e eventos ao seu redor, com o norte para cima.', en: 'A mini map in the corner of the screen: lakes, cliffs, groves, landmarks and events around you, north up.', es: 'Un minimapa en la esquina de la pantalla: lagos, acantilados, bosques, construcciones y eventos a tu alrededor, con el norte arriba.', fr: 'Une mini-carte dans le coin de l’écran : lacs, falaises, bosquets, constructions et événements autour de toi, nord en haut.', zh: '畫面角落的小地圖：你周圍的湖泊、懸崖、樹林、建築和事件，北方朝上。' },
      { pt: 'Os chefes do mapa ganharam um contorno dourado, fácil de achar no meio da horda, e uma seta dourada na borda da tela quando estão fora dela.', en: 'Bosses on the map now wear a gold outline, easy to spot in the horde, and a gold arrow on the screen’s edge points to them when they’re off screen.', es: 'Los jefes del mapa ahora tienen un contorno dorado, fácil de ver en medio de la horda, y una flecha dorada en el borde de la pantalla cuando están fuera de ella.', fr: 'Les boss de la carte ont maintenant un contour doré, facile à repérer dans la horde, et une flèche dorée au bord de l’écran quand ils sont hors champ.', zh: '地圖上的頭目現在有金色外框，在怪群中一眼就能看到；離開畫面時，邊緣的金色箭頭會指出牠們的位置。' },
      { pt: 'No celular, os botões de ataque especial, bote e Mega podem ir para a esquerda, com o joystick fixo à direita: Ajustes → Controles → Lado dos botões.', en: 'On phones, the special attack, lunge and Mega buttons can move to the left, with the fixed joystick on the right: Settings → Controls → Button side.', es: 'En el celular, los botones de ataque especial, embestida y Mega pueden ir a la izquierda, con el joystick fijo a la derecha: Ajustes → Controles → Lado de los botones.', fr: 'Sur mobile, les boutons d’attaque spéciale, de ruée et de Méga peuvent passer à gauche, avec le joystick fixe à droite : Réglages → Commandes → Côté des boutons.', zh: '在手機上，特殊攻擊、突進和超級進化按鈕可以移到左側，固定搖桿則移到右側：設定 → 操作 → 按鈕位置。' },
    ],
    changes: [
      {
        title: { pt: 'Co-op online', en: 'Online co-op', es: 'Co-op en línea', fr: 'Coop en ligne', zh: '線上合作' },
        notes: [
          {
            pt: 'No lobby, Co-op → Criar sala. Compartilhe o link ou o código, cada um escolhe o seu Pokémon e fica pronto, e o anfitrião escolhe a dificuldade e começa. Um link de sala leva direto para ela.',
            en: 'In the lobby, Co-op → Create room. Share the link or the code, everyone picks their Pokémon and gets ready, and the host picks the difficulty and starts. A room link takes you straight in.',
            es: 'En el lobby, Co-op → Crear sala. Comparte el enlace o el código, cada uno elige su Pokémon y se pone listo, y el anfitrión elige la dificultad y empieza. Un enlace de sala te lleva directo.',
            fr: 'Dans le lobby, Coop → Créer un salon. Partage le lien ou le code, chacun choisit son Pokémon et se met prêt, puis l’hôte choisit la difficulté et lance la partie. Un lien de salon t’y emmène directement.',
            zh: '在大廳選擇「合作模式」→「建立房間」。分享連結或代碼，每個人選好寶可夢並準備，房主選擇難度後開始。點房間連結就能直接加入。',
          },
          {
            pt: 'Para jogar junto é preciso uma conta com um @nome: é ele que a equipe vê.',
            en: 'Playing together needs an account with a @name: it’s what your team sees.',
            es: 'Para jugar juntos necesitas una cuenta con un @nombre: es lo que ve tu equipo.',
            fr: 'Pour jouer ensemble, il faut un compte avec un @nom : c’est ce que voit ton équipe.',
            zh: '一起玩需要一個有 @名稱 的帳號，隊友看到的就是它。',
          },
          {
            pt: 'Na partida, todo mundo sobe de nível junto e escolhe ao mesmo tempo. A horda, os chefes e o ₽ crescem com o número de jogadores, e cada um ganha os próprios TMs, Poké Balls, prêmios de Alfa e Mega Pedras. A partida termina quando ninguém mais consegue continuar.',
            en: 'In a run, everyone levels up together and picks at the same time. The horde, bosses and ₽ grow with the number of players, and each player gets their own TMs, Poké Balls, Alpha prizes and Mega Stones. The run ends when nobody can carry on.',
            es: 'En la partida, todos suben de nivel juntos y eligen al mismo tiempo. La horda, los jefes y los ₽ crecen con el número de jugadores, y cada uno recibe sus propias MT, Poké Balls, premios de Alfa y Megapiedras. La partida termina cuando nadie más puede seguir.',
            fr: 'En partie, tout le monde monte de niveau ensemble et choisit en même temps. La horde, les boss et les ₽ grandissent avec le nombre de joueurs, et chacun reçoit ses propres CT, Poké Balls, prix d’Alpha et Méga-Gemmes. La partie se termine quand plus personne ne peut continuer.',
            zh: '對局中，全隊一起升級、同時選擇。獸群、頭目和 ₽ 會隨玩家人數增加，每位玩家都會拿到自己的招式學習器、精靈球、頭目獎勵和超級石。沒有人能繼續時，對局才會結束。',
          },
          {
            pt: 'A EXP é da equipe e o ₽ é dividido entre todos. Quem desmaia vira uma Poké Ball até um amigo chegar perto para reanimar.',
            en: 'EXP is shared by the team and the ₽ is split among everyone. Whoever faints becomes a Poké Ball until a friend comes close to revive them.',
            es: 'La EXP es del equipo y los ₽ se reparten entre todos. Quien se debilita se vuelve una Poké Ball hasta que un amigo se acerque a reanimarlo.',
            fr: 'L’EXP est partagée par l’équipe et les ₽ sont partagés entre tous. Celui qui est K.O. devient une Poké Ball jusqu’à ce qu’un ami s’approche pour le ranimer.',
            zh: '經驗值由全隊共享，₽ 由所有人平分。倒下的人會變成精靈球，等隊友靠近就能復活。',
          },
          {
            pt: 'Em Amigos, adicione pelo @nome, veja quem está online, numa sala ou jogando, e convide direto para a sua sala. Se a conexão cair, o jogo reconecta e você volta de onde parou.',
            en: 'In Friends, add people by @name, see who’s online, in a room or playing, and invite them straight to your room. If your connection drops, the game reconnects and you pick up where you left off.',
            es: 'En Amigos, agrega gente por @nombre, mira quién está en línea, en una sala o jugando, e invítalos directo a tu sala. Si se cae la conexión, el juego se reconecta y vuelves donde estabas.',
            fr: 'Dans Amis, ajoute des joueurs par @nom, vois qui est en ligne, dans un salon ou en partie, et invite-les directement dans ton salon. Si la connexion coupe, le jeu se reconnecte et tu reprends là où tu en étais.',
            zh: '在「好友」中用 @名稱 加好友，查看誰在線上、在房間裡或正在遊戲，並直接邀請他們進你的房間。連線中斷時，遊戲會自動重連，讓你從中斷處繼續。',
          },
          {
            pt: 'Por enquanto ficam só nas partidas solo: a caverna, o cemitério e o céu, as construções do mapa, os domínios das fendas (os lendários lutam na arena antiga), o Modo Lendário, a Mochila e os TMs e itens da loja, o Surto do dia, a Noite das Bruxas, o Desafio do dia e o ranking.',
            en: 'For now these stay in solo runs: the cave, the graveyard and the sky, the map’s landmarks, rift domains (legendaries fight in the old arena), Legend Mode, the Bag and the shop’s TMs and items, the daily Outbreak, Halloween Night, the Daily Challenge and the ranking.',
            es: 'Por ahora se quedan en las partidas en solitario: la cueva, el cementerio y el cielo, las construcciones del mapa, los dominios de las grietas (los legendarios pelean en la arena antigua), el Modo Legendario, la Mochila y las MT y objetos de la tienda, la Horda del día, la Noche de Brujas, el Desafío del día y el ranking.',
            fr: 'Pour l’instant, restent en solo : la grotte, le cimetière et le ciel, les constructions de la carte, les domaines des failles (les légendaires combattent dans l’ancienne arène), le Mode Légendaire, le Sac et les CT et objets de la boutique, l’Apparition massive du jour, la Nuit des Sorcières, le Défi du jour et le classement.',
            zh: '目前以下內容仍只在單人對局中：洞窟、墓地和天空、地圖建築、裂縫領域（傳說寶可夢在舊競技場戰鬥）、傳說模式、背包與商店的招式學習器和道具、今日大量出現、女巫之夜、每日挑戰和排行榜。',
          },
        ],
      },
      {
        title: { pt: 'Mini mapa', en: 'Mini map', es: 'Minimapa', fr: 'Mini-carte', zh: '小地圖' },
        notes: [
          {
            pt: 'O mapa mostra o terreno do bioma, a área da tela, os eventos (altares, fontes, baús, Meowth, o Tutor de Golpes, as missões), as construções, as Poké Balls, TMs e Mega Pedras no chão e os seus companheiros de time. A horda selvagem fica de fora.',
            en: 'The map shows the biome’s terrain, the area on screen, events (altars, fountains, chests, Meowth, the Move Tutor, missions), landmarks, Poké Balls, TMs and Mega Stones on the ground, and your teammates. The wild horde stays off it.',
            es: 'El mapa muestra el terreno del bioma, el área en pantalla, los eventos (altares, fuentes, cofres, Meowth, el Tutor de Movimientos, las misiones), las construcciones, las Poké Balls, MTs y Megapiedras en el suelo y a tus compañeros de equipo. La horda salvaje queda fuera.',
            fr: 'La carte montre le terrain du biome, la zone à l’écran, les événements (autels, fontaines, coffres, Meowth, le Maître des capacités, les missions), les constructions, les Poké Balls, CT et Méga-Gemmes au sol et tes coéquipiers. La horde sauvage n’y figure pas.',
            zh: '地圖會顯示生態區的地形、畫面範圍、事件（祭壇、泉水、寶箱、Meowth、招式教學、任務）、建築、地上的精靈球、招式學習器和超級石，以及你的隊友。野生群體不會顯示。',
          },
          {
            pt: 'Dentro de uma fenda, da caverna ou do cemitério, o mapa mostra o lugar de perto: o chão da arena, os corredores e a escada da caverna, a Pedra Peculiar do cemitério.',
            en: 'Inside a rift, the cave or the graveyard, the map shows the place up close: the arena’s floor, the cave’s corridors and stairs, the graveyard’s keystone.',
            es: 'Dentro de una grieta, la cueva o el cementerio, el mapa muestra el lugar de cerca: el suelo de la arena, los pasillos y la escalera de la cueva, la Piedra Espíritu del cementerio.',
            fr: 'Dans une faille, la grotte ou le cimetière, la carte montre le lieu de près : le sol de l’arène, les couloirs et l’escalier de la grotte, la Clé de Voûte du cimetière.',
            zh: '在裂縫、洞窟或墓地裡，地圖會近距離顯示該地點：競技場的地面、洞窟的通道和樓梯、墓地的 Odd Keystone。',
          },
        ],
      },
      {
        title: { pt: 'Correções', en: 'Fixes', es: 'Correcciones', fr: 'Corrections', zh: '修正' },
        notes: [
          {
            pt: 'Quem abria o jogo com a janela em exatamente 1920×1080 (tela cheia num monitor 1080p) via o mapa num quadradinho no canto de cima, no lobby e na partida. Agora ele ocupa a tela toda desde o começo.',
            en: 'Opening the game in a window of exactly 1920×1080 (fullscreen on a 1080p monitor) showed the map in a small box in the top corner, in the lobby and in runs. It now fills the screen from the start.',
            es: 'Quien abría el juego con la ventana en exactamente 1920×1080 (pantalla completa en un monitor 1080p) veía el mapa en un cuadrito en la esquina de arriba, en el lobby y en la partida. Ahora ocupa toda la pantalla desde el principio.',
          },
          {
            pt: 'Com o mouse e o teclado juntos, um Enter num botão já clicado contava duas vezes: o Jogar começava duas partidas e a escolha de golpe da primeira ficava congelada na frente; no lobby, duas telas abriam e a de baixo ficava presa atrás. Agora cada aperto conta uma vez.',
            en: 'With mouse and keyboard together, Enter on a button you had clicked counted twice: Play started two runs and the first one’s move pick stayed frozen on top; in the lobby, two screens opened and the one below got stuck behind. Each press now counts once.',
            es: 'Con el mouse y el teclado juntos, un Enter en un botón ya clicado contaba dos veces: Jugar empezaba dos partidas y la elección de ataque de la primera se quedaba congelada encima; en el lobby, se abrían dos pantallas y la de abajo quedaba atrapada detrás. Ahora cada pulsación cuenta una vez.',
          },
          {
            pt: 'Magic Guard (Alakazam, Armarouge e lendários) deixava passar as poças de veneno dos cuspidores, as pedras que o mundo espalha pelo chão e as áreas que os chefes deixam no chão, além do custo do Life Orb, da queimadura do Flame Orb e do Bad Dreams do Darkrai. Agora só golpes diretos ferem, como a descrição promete.',
            en: 'Magic Guard (Alakazam, Armarouge and legendaries) let through spitters’ poison puddles, the rocks the world scatters on the ground and the patches bosses leave behind, plus Life Orb’s cost, Flame Orb’s burn and Darkrai’s Bad Dreams. Now only direct hits hurt, as its description promises.',
            es: 'Magic Guard (Alakazam, Armarouge y legendarios) dejaba pasar los charcos de veneno de los escupidores, las rocas que el mundo esparce por el suelo y las zonas que dejan los jefes, además del costo del Life Orb, la quemadura del Flame Orb y el Bad Dreams de Darkrai. Ahora solo los golpes directos hieren, como promete su descripción.',
            fr: 'Magic Guard (Alakazam, Armarouge et légendaires) laissait passer les flaques de poison des cracheurs, les rochers que le monde sème au sol et les zones laissées par les boss, ainsi que le coût du Life Orb, la brûlure du Flame Orb et le Bad Dreams de Darkrai. Désormais, seuls les coups directs blessent, comme le promet sa description.',
            zh: 'Magic Guard（Alakazam、Armarouge 與傳說寶可夢）之前擋不住吐射者的毒池、世界散落在地上的岩石與頭目留下的區域，也擋不住 Life Orb 的代價、Flame Orb 的灼傷和 Darkrai 的 Bad Dreams。現在只有直接攻擊會造成傷害，正如說明所寫。',
          },
        ],
      },
      {
        title: { pt: 'Escolha de parceiro e fim da partida', en: 'Partner select and the end of a run', es: 'Elección de compañero y fin de la partida' },
        notes: [
          {
            pt: 'Aleatório: o novo botão ao lado das abas (ou a tecla R) escolhe ao acaso um Pokémon desbloqueado da aba aberta (Iniciais, Ovos ou Lendários), nunca o que já está selecionado. Ele só seleciona: confira o painel e aperte Começar quando quiser.',
            en: 'Random: the new button beside the tabs (or the R key) picks an unlocked Pokémon from the open tab (Starters, Eggs or Legendaries) at random, never the one already selected. It only selects: check its panel and press Start when you’re ready.',
            es: 'Aleatorio: el nuevo botón junto a las pestañas (o la tecla R) elige al azar un Pokémon desbloqueado de la pestaña abierta (Iniciales, Huevos o Legendarios), nunca el que ya está seleccionado. Solo selecciona: revisa su panel y presiona Empezar cuando quieras.',
          },
          {
            pt: 'Tocar num Pokémon só seleciona, mesmo tocando de novo: a partida começa no botão Começar (ou Enter). O escolhido vira seu parceiro na hora, com a cor Normal ou Shiny que você deixou, então Voltar mostra ele no lobby.',
            en: 'Tapping a Pokémon only selects it, even on a second tap: the run starts from the Start button (or Enter). Your pick becomes your partner right away, in the Normal or Shiny colors you set, so Back shows it in the lobby.',
            es: 'Tocar un Pokémon solo lo selecciona, aunque lo toques de nuevo: la partida empieza con el botón Empezar (o Enter). El elegido se vuelve tu compañero al instante, con el color Normal o Shiny que dejaste, así que Volver lo muestra en el lobby.',
          },
          {
            pt: 'A tela de resultado ganhou o botão Lobby, ao lado de Tentar de novo e Trocar Pokémon. Os ₽, os ovos e o ranking da partida contam do mesmo jeito.',
            en: 'The results screen got a Lobby button, next to Try again and Change Pokémon. The run’s ₽, eggs and ranking count just the same.',
            es: 'La pantalla de resultados tiene un botón Lobby, junto a Reintentar y Cambiar Pokémon. Los ₽, los huevos y el ranking de la partida cuentan igual.',
          },
          {
            pt: 'O golpe final: quando seu Pokémon desmaia, a tela de resultado diz o que te derrubou, com o nome do Pokémon (Alfa, se era um), o ataque quando ele tem nome (os golpes finais dos chefes) ou o tipo de acerto (contato, projétil, raio, explosão, área, lava, armadilha, ataque do mundo) e o dano. Embaixo, os dois golpes que vieram antes. Pedido de jogadores no Discord.',
            en: 'The final blow: when your Pokémon faints, the results screen says what took you down, with the Pokémon’s name (Alpha, if it was one), the attack when it has a name (bosses’ ultimates) or the kind of hit (contact, shot, beam, blast, zone, lava, trap, world attack) and the damage. Below it, the two hits that came before. Requested by players on Discord.',
            es: 'El golpe final: cuando tu Pokémon se debilita, la pantalla de resultados dice qué te derribó, con el nombre del Pokémon (Alfa, si lo era), el ataque cuando tiene nombre (los golpes finales de los jefes) o el tipo de golpe (contacto, proyectil, rayo, explosión, zona, lava, trampa, ataque del mundo) y el daño. Debajo, los dos golpes que vinieron antes. Pedido de jugadores en Discord.',
          },
        ],
      },
      {
        title: { pt: 'Avisos na partida', en: 'Run alerts', es: 'Avisos en partida', fr: 'Alertes en partie' },
        notes: [
          {
            pt: 'Em Ajustes > Jogo, escolha quais avisos aparecem durante a partida. Só importantes mantém chefes chegando, fendas, perigos e eventos que pedem ação (Meowth, o Tutor, missões, a Mega pronta) e esconde drops, berries, shinies avistados e afins. Nenhum esconde todos.',
            en: 'In Settings > Game, pick which alerts show during a run. Important only keeps incoming bosses, rifts, dangers and events that need you (Meowth, the Move Tutor, missions, a Mega ready) and hides drops, berries, shinies spotted and the like. None hides them all.',
            es: 'En Ajustes > Juego, elige qué avisos aparecen durante la partida. Solo importantes mantiene los jefes que llegan, las grietas, los peligros y los eventos que piden acción (Meowth, el Tutor, misiones, la Mega lista) y oculta drops, bayas, shinies avistados y similares. Ninguno los oculta todos.',
          },
          {
            pt: 'No celular em pé, os avisos ficaram mais compactos, no máximo dois por vez logo abaixo do HUD, e os de shiny ganharam uma caixa dourada. Pedidos de jogadores no Discord.',
            en: 'On a phone held upright, alerts are more compact, at most two at a time right under the HUD, and shiny ones got a gold box. Requested by players on Discord.',
            es: 'En el celular en vertical, los avisos son más compactos, como máximo dos a la vez justo debajo del HUD, y los de shiny tienen una caja dorada. Pedidos de jugadores en Discord.',
          },
        ],
      },
      {
        title: { pt: 'Dano por golpe na pausa', en: 'Damage by move in the pause menu', es: 'Daño por ataque en la pausa' },
        notes: [
          {
            pt: 'A tela de pausa mostra o dano total da partida e o de cada golpe, em ordem, com o DPS médio de cada um (dano dividido pelo tempo jogado até agora).',
            en: 'The pause screen shows the run’s total damage and each move’s, in order, with each one’s average DPS (damage divided by the time played so far).',
            es: 'La pantalla de pausa muestra el daño total de la partida y el de cada ataque, en orden, con el DPS promedio de cada uno (daño dividido por el tiempo jugado hasta ahora).',
          },
        ],
      },
      {
        title: { pt: 'Botões à esquerda e joystick fixo ajustável', en: 'Buttons on the left and an adjustable fixed joystick', es: 'Botones a la izquierda y joystick fijo ajustable', fr: 'Boutons à gauche et joystick fixe réglable', zh: '按鈕移到左側，固定搖桿可調整' },
        notes: [
          {
            pt: 'Em Ajustes → Controles, o novo “Lado dos botões” espelha a parte de baixo da tela no celular: especial, bote e Mega vão para a esquerda, e o quadro de HP e o joystick fixo para a direita. Pedido de quem joga movendo com a mão direita.',
            en: 'In Settings → Controls, the new “Button side” mirrors the bottom of the screen on phones: special, lunge and Mega go to the left, the HP box and the fixed joystick to the right. Asked for by players who move with their right hand.',
            es: 'En Ajustes → Controles, el nuevo “Lado de los botones” refleja la parte de abajo de la pantalla en el celular: especial, embestida y Mega van a la izquierda, y el cuadro de PS y el joystick fijo a la derecha. Lo pidieron quienes se mueven con la mano derecha.',
            fr: 'Dans Réglages → Commandes, le nouveau « Côté des boutons » inverse le bas de l’écran sur mobile : spéciale, ruée et Méga passent à gauche, l’encadré des PV et le joystick fixe à droite. Demandé par ceux qui se déplacent de la main droite.',
            zh: '在設定 → 操作中，新的「按鈕位置」會在手機上把畫面下方左右對調：特殊攻擊、突進和超級進化移到左側，HP 框和固定搖桿移到右側。這是用右手移動的玩家提出的建議。',
          },
          {
            pt: 'Com o joystick fixo, “Altura do joystick” e “Distância da borda” tiram ele do canto, em três degraus cada, para celulares de todos os tamanhos.',
            en: 'With the fixed joystick, “Joystick height” and “Distance from edge” take it out of the corner, three steps each, for phones of every size.',
            es: 'Con el joystick fijo, “Altura del joystick” y “Distancia del borde” lo sacan de la esquina, en tres pasos cada uno, para celulares de todos los tamaños.',
            fr: 'Avec le joystick fixe, « Hauteur du joystick » et « Distance du bord » le sortent du coin, en trois crans chacun, pour les téléphones de toutes les tailles.',
            zh: '使用固定搖桿時，「搖桿高度」和「與邊緣距離」可以把它移出角落，各有三段，適合各種尺寸的手機。',
          },
          {
            pt: 'Os avisos da partida (evento, surto, Mega Stone…) respeitam o espaço da coluna deles: no celular deitado, um de cada vez quando falta altura, em vez de cobrir os botões.',
            en: 'In-run notices (event, outbreak, Mega Stone…) keep to their column’s room: on a phone held sideways, one at a time when there’s no height to spare, instead of covering the buttons.',
            es: 'Los avisos de la partida (evento, brote, Mega Stone…) respetan el espacio de su columna: en el celular en horizontal, uno a la vez cuando falta altura, en vez de tapar los botones.',
            fr: 'Les annonces de la partie (événement, apparition massive, Mega Stone…) restent dans leur colonne : sur un téléphone à l’horizontale, une à la fois quand la hauteur manque, au lieu de couvrir les boutons.',
            zh: '對局中的提示（活動、大量出現、Mega Stone……）會守在自己的欄位裡：手機橫拿、高度不夠時一次只顯示一則，不再蓋住按鈕。',
          },
        ],
      },
      {
        title: { pt: 'Visibilidade na partida', en: 'Visibility in a run', es: 'Visibilidad en la partida', fr: 'Visibilité en partie', zh: '對局中的辨識度' },
        notes: [
          {
            pt: 'Todo chefe que aparece no mapa ganha um contorno dourado, como o vermelho dos Alfas, e uma seta dourada na borda da tela enquanto está fora de vista. Os lendários continuam com a seta vermelha, e um chefe furioso troca o dourado pelo vermelho piscando.',
            en: 'Every boss that shows up on the map gets a gold outline, like the Alphas’ red one, and a gold arrow on the screen’s edge while it’s out of view. Legendaries keep their red arrow, and an enraged boss swaps the gold for the flickering red.',
            es: 'Todo jefe que aparece en el mapa recibe un contorno dorado, como el rojo de los Alfa, y una flecha dorada en el borde de la pantalla mientras está fuera de vista. Los legendarios mantienen la flecha roja, y un jefe furioso cambia el dorado por el rojo parpadeante.',
            fr: 'Chaque boss qui apparaît sur la carte reçoit un contour doré, comme le rouge des Alphas, et une flèche dorée sur le bord de l’écran tant qu’il est hors de vue. Les légendaires gardent leur flèche rouge, et un boss enragé remplace le doré par le rouge clignotant.',
            zh: '每個出現在地圖上的頭目都會有金色外框，就像頭目寶可夢的紅框一樣，離開畫面時邊緣還會有金色箭頭。傳說寶可夢仍是紅色箭頭，暴怒的頭目則會把金色換成閃爍的紅色。',
          },
          {
            pt: 'Seu Pokémon e a barra de vida são desenhados depois dos golpes, em qualquer opacidade escolhida nos ajustes, e por cima da horda. Atrás de uma árvore ou de um penhasco ele continua atrás, como antes.',
            en: 'Your Pokémon and its HP bar are drawn after the moves, at whatever opacity you picked in the settings, and over the horde. Behind a tree or a cliff it stays behind, as before.',
            es: 'Tu Pokémon y su barra de vida se dibujan después de los ataques, con la opacidad que elegiste en los ajustes, y por encima de la horda. Detrás de un árbol o de un acantilado sigue detrás, como antes.',
            fr: 'Ton Pokémon et sa barre de PV sont dessinés après les attaques, quelle que soit l’opacité choisie dans les réglages, et par-dessus la horde. Derrière un arbre ou une falaise, il reste derrière, comme avant.',
            zh: '你的寶可夢和 HP 條會在招式之後繪製（不論你在設定中選了多少不透明度），也在怪群之上。站在樹或懸崖後方時仍會被擋住，和以前一樣。',
          },
        ],
      },
      {
        title: { pt: 'Menos travadas de impacto', en: 'Less hit-stop', es: 'Menos congelamiento por impacto', fr: 'Moins de gel à l’impact', zh: '減少命中停頓' },
        notes: [
          {
            pt: 'Alguns golpes congelam a tela por um instante para dar peso ao impacto. Agora, depois de um congelamento, os impactos do segundo seguinte só tremem a tela: uma saraivada de punhos do Sky Uppercut congelava até quatro vezes seguidas, e o jogo parecia rodar aos trancos.',
            en: 'Some moves freeze the screen for an instant to give the impact weight. Now, after one freeze, impacts in the next second only shake the screen: a volley of Sky Uppercut fists used to freeze up to four times in a row, and the game felt choppy.',
            es: 'Algunos ataques congelan la pantalla un instante para darle peso al impacto. Ahora, después de un congelamiento, los impactos del segundo siguiente solo sacuden la pantalla: una ráfaga de puños de Sky Uppercut congelaba hasta cuatro veces seguidas y el juego se sentía entrecortado.',
          },
        ],
      },
      {
        title: { pt: 'Power Herb com o mínimo de 4 s', en: 'Power Herb keeps its 4 s minimum', es: 'Power Herb con el mínimo de 4 s', fr: 'Power Herb garde son minimum de 4 s', zh: 'Power Herb 的 4 秒下限' },
        notes: [
          {
            pt: 'A recarga do especial nunca devia ficar abaixo de 4 s, mas só o primeiro lote de abates respeitava o limite: o seguinte zerava a recarga, e o especial voltava a cada 0,3 s. Agora todo abate conta até o mínimo, e o anel do botão mostra a espera de verdade.',
            en: 'The special’s cooldown was never meant to go under 4 s, but only the first batch of defeats kept to it: the next one emptied the cooldown, and the special came back every 0.3 s. Now every defeat counts down to the minimum, and the button’s ring shows the real wait.',
            es: 'La recarga del especial nunca debía bajar de 4 s, pero solo el primer lote de derribos respetaba el límite: el siguiente vaciaba la recarga y el especial volvía cada 0,3 s. Ahora cada derribo cuenta hasta el mínimo y el anillo del botón muestra la espera real.',
          },
        ],
      },
      {
        title: { pt: 'Partidas longas mais leves', en: 'Lighter long runs', es: 'Partidas largas más livianas', fr: 'Parties longues plus légères', zh: '長時間對局更流暢' },
        notes: [
          {
            pt: 'Depois dos 40 minutos do modo sem fim o jogo ficava pesado a cada minuto. Agora a horda gasta bem menos para ser desenhada (o contorno dos elites e os rastros dos corredores) e para andar entre rochas e árvores, e as moedas e doces largados longe da tela não são mais desenhados. A partida continua exatamente a mesma.',
            en: 'Past 40 minutes of endless mode the game got heavier every minute. Now the horde takes far less work to draw (the elites’ outlines and the runners’ streaks) and to walk among rocks and trees, and coins and candies left far off screen aren’t drawn anymore. A run plays exactly the same.',
            es: 'Pasados los 40 minutos del modo infinito el juego se ponía más pesado cada minuto. Ahora la horda cuesta mucho menos de dibujar (el contorno de los élites y las estelas de los corredores) y de moverse entre rocas y árboles, y las monedas y dulces que quedan lejos de la pantalla ya no se dibujan. La partida sigue exactamente igual.',
            fr: 'Après 40 minutes en mode sans fin, le jeu devenait plus lourd à chaque minute. La horde coûte maintenant bien moins à dessiner (le contour des élites et les traînées des coureurs) et à déplacer entre rochers et arbres, et les pièces et bonbons laissés loin de l’écran ne sont plus dessinés. La partie reste exactement la même.',
            zh: '無盡模式過了 40 分鐘後，遊戲每分鐘都會更吃力。現在怪群的繪製（菁英的外框與疾行者的拖影）和在岩石樹木間移動都省力許多，留在畫面外遠處的金幣與糖果也不再繪製。對局內容完全不變。',
          },
          {
            pt: 'Moedas, doces, Oran Berries, Poké Balls e itens largados no chão somem depois de 2 minutos fora da tela: numa partida longa eles passavam dos milhares e eram o que mais pesava. Exp. Candies, TMs, Mega Pedras, itens de evolução e prêmios de Alfa continuam esperando por você.',
            en: 'Coins, candies, Oran Berries, Poké Balls and items left on the ground vanish after 2 minutes off screen: in a long run they piled up into the thousands and were the heaviest load of all. Exp. Candies, TMs, Mega Stones, evolution items and Alpha prizes still wait for you.',
            es: 'Las monedas, dulces, Oran Berries, Poké Balls y objetos que quedan en el suelo desaparecen tras 2 minutos fuera de la pantalla: en una partida larga se juntaban por miles y eran lo que más pesaba. Los Exp. Candies, MTs, Megapiedras, objetos evolutivos y premios de Alfa te siguen esperando.',
            fr: 'Les pièces, bonbons, Oran Berries, Poké Balls et objets laissés au sol disparaissent après 2 minutes hors de l’écran : dans une longue partie, ils s’entassaient par milliers et pesaient plus que tout le reste. Les Exp. Candy, CT, Méga-Gemmes, objets d’évolution et prix d’Alpha t’attendent toujours.',
            zh: '留在地上的金幣、糖果、Oran Berry、Poké Ball 和道具，在畫面外超過 2 分鐘就會消失：長時間對局裡它們會累積到上千個，是最拖慢遊戲的原因。經驗糖果、招式學習器、超級石、進化道具和頭目獎勵仍會等著你。',
          },
        ],
      },
    ],
  },
  {
    date: '2026-10-24',
    title: { pt: 'Mega Darkrai, um lobby novo no celular e golpes mais vivos', en: 'Mega Darkrai, a new lobby on phones and livelier moves', es: 'Mega Darkrai, un lobby nuevo en el celular y ataques con más vida', fr: 'Méga-Darkrai, un nouveau lobby sur mobile et des attaques plus vivantes', zh: '超級 Darkrai、手機上的全新大廳與更生動的招式' },
    highlights: [
      { pt: 'Meta da comunidade: juntem 15 milhões de doces na Noite das Bruxas e o Darkrai ganha a Mega Evolução para todo mundo, no Modo Lendário (Nv 28) e na fenda do Pesadelo. Acompanhe a barra na tela do evento.', en: 'Community goal: gather 15 million candies during Halloween Night and Darkrai gets its Mega Evolution for everyone, in Legend Mode (Lv 28) and in the Nightmare rift. Follow the bar on the event screen.', es: 'Meta de la comunidad: junten 15 millones de dulces en la Noche de Brujas y Darkrai obtiene su Megaevolución para todos, en el Modo Legendario (Nv 28) y en la grieta de la Pesadilla. Sigue la barra en la pantalla del evento.', fr: 'Objectif de la communauté : réunissez 15 millions de bonbons pendant la Nuit des Sorcières et Darkrai obtient sa Méga-Évolution pour tout le monde, en Mode Légendaire (Nv 28) et dans la faille du Cauchemar. Suis la barre sur l’écran de l’événement.', zh: '社群目標：在女巫之夜一起收集 1500 萬顆糖果，Darkrai 就會為所有人解鎖超級進化，在傳說模式（Lv 28）和夢魘裂縫中都看得到。在活動畫面追蹤進度條。' },
      { pt: 'No celular em pé, o lobby ficou mais limpo: seu Pokémon parceiro volta para o centro da tela, com o JOGAR logo abaixo.', en: 'On a phone held upright, the lobby is cleaner: your partner Pokémon is back in the middle of the screen, with PLAY right under it.', es: 'En el celular en vertical, el lobby quedó más limpio: tu Pokémon compañero vuelve al centro de la pantalla, con JUGAR justo debajo.', fr: 'Sur un téléphone tenu droit, le lobby est plus clair : ton Pokémon partenaire revient au centre de l’écran, avec JOUER juste en dessous.', zh: '直拿手機時，大廳變得更清爽了：你的夥伴寶可夢回到畫面中央，下方就是開始遊戲。' },
      { pt: 'Os golpes ganharam animações novas: bolas de fogo e jatos d’água apontam para onde voam, Thunder cai como um raio de verdade e os projéteis estouram ao acertar.', en: 'Moves got new animations: fireballs and water jets point where they fly, Thunder falls like real lightning and shots burst when they hit.', es: 'Los ataques tienen animaciones nuevas: las bolas de fuego y los chorros de agua apuntan hacia donde vuelan, Thunder cae como un rayo de verdad y los proyectiles estallan al acertar.', fr: 'Les attaques ont de nouvelles animations : les boules de feu et les jets d’eau pointent là où ils volent, Thunder tombe comme un vrai éclair et les projectiles éclatent à l’impact.', zh: '招式有了新動畫：火球和水柱會朝飛行方向前進，Thunder 像真正的閃電一樣落下，投射物命中時會爆開。' },
      { pt: 'Partidas longas no modo infinito voltam a contar no ranking, mesmo passando do nível 999 ou se o jogo fechar no meio.', en: 'Long endless runs count on the ranking again, even past level 999 or if the game closes midway.', es: 'Las partidas largas en el modo infinito vuelven a contar en el ranking, aunque pasen del nivel 999 o el juego se cierre a mitad.', fr: 'Les longues parties en mode infini comptent de nouveau au classement, même au-delà du niveau 999 ou si le jeu se ferme en cours de route.', zh: '無盡模式的長時間對局重新計入排行榜，即使超過 999 級或遊戲中途關閉也一樣。' },
      {
        pt: 'Ovo Assombrado sem limite: o Duskull agora vende quantos couberem na incubadora, por ₽ 6.000 ou por 1.000 doces. O pote continua contando todos os doces para os prêmios.',
        en: 'No more Haunted Egg limit: Duskull now sells as many as your incubator holds, for ₽6,000 or 1,000 candies. The jar still counts every candy for its prizes.',
        es: 'Huevo Embrujado sin límite: Duskull ahora vende todos los que quepan en tu incubadora, por ₽6.000 o 1.000 dulces. El frasco sigue contando todos los dulces para los premios.',
        fr: 'Plus de limite pour l’Œuf Hanté : Duskull en vend autant que ton incubateur en contient, pour 6 000 ₽ ou 1 000 bonbons. Le bocal compte toujours chaque bonbon pour ses prix.',
        zh: '鬧鬼蛋不再限量：Duskull 現在孵化器放得下多少就賣多少，₽6,000 或 1,000 顆糖果一顆。糖果罐仍會把每顆糖果算進獎勵。',
      },
    ],
    changes: [
      {
        title: { pt: 'Meta da comunidade: Mega Darkrai', en: 'Community goal: Mega Darkrai', es: 'Meta de la comunidad: Mega Darkrai', fr: 'Objectif de la communauté : Méga-Darkrai', zh: '社群目標：超級 Darkrai' },
        notes: [
          {
            pt: 'Todos os doces que os treinadores com conta juntam na Noite das Bruxas enchem um pote só, da comunidade. Com 15 milhões, o Darkrai ganha a Mega Evolução para todo mundo, para sempre. Cada treinador conta até 20 mil doces.',
            en: 'Every candy trainers with an account gather during Halloween Night fills one jar, the community’s. At 15 million, Darkrai gets its Mega Evolution for everyone, for good. Each trainer counts up to 20,000 candies.',
            es: 'Todos los dulces que juntan los entrenadores con cuenta en la Noche de Brujas llenan un solo frasco, el de la comunidad. Con 15 millones, Darkrai obtiene su Megaevolución para todos, para siempre. Cada entrenador cuenta hasta 20.000 dulces.',
            fr: 'Tous les bonbons que les dresseurs avec un compte récoltent pendant la Nuit des Sorcières remplissent un seul bocal, celui de la communauté. À 15 millions, Darkrai obtient sa Méga-Évolution pour tout le monde, pour de bon. Chaque dresseur compte jusqu’à 20 000 bonbons.',
            zh: '擁有帳號的訓練家在女巫之夜收集的每顆糖果，都會裝進同一個社群糖果罐。達到 1500 萬顆時，Darkrai 將為所有人永久解鎖超級進化。每位訓練家最多計入 20,000 顆糖果。',
          },
          {
            pt: 'Depois de liberada, no Modo Lendário o Darkrai desperta como Mega Darkrai no Nv 28, como o Rayquaza vira Mega Rayquaza, e na fenda do Pesadelo ele vira Mega Darkrai na última fase da batalha. A barra fica na tela da Noite das Bruxas.',
            en: 'Once unlocked, Darkrai awakens as Mega Darkrai at Lv 28 in Legend Mode, the way Rayquaza becomes Mega Rayquaza, and in the Nightmare rift it goes Mega for the battle’s last phase. The bar is on the Halloween Night screen.',
            es: 'Una vez desbloqueado, en el Modo Legendario Darkrai despierta como Mega Darkrai en el Nv 28, como Rayquaza se vuelve Mega Rayquaza, y en la grieta de la Pesadilla se vuelve Mega Darkrai en la última fase de la batalla. La barra está en la pantalla de la Noche de Brujas.',
            fr: 'Une fois débloqué, Darkrai s’éveille en Méga-Darkrai au Nv 28 en Mode Légendaire, comme Rayquaza devient Méga-Rayquaza, et dans la faille du Cauchemar il devient Méga-Darkrai pour la dernière phase du combat. La barre est sur l’écran de la Nuit des Sorcières.',
            zh: '解鎖之後，在傳說模式中 Darkrai 會在 Lv 28 覺醒為超級 Darkrai，就像 Rayquaza 變成超級 Rayquaza；在夢魘裂縫中，牠會在戰鬥最後階段變成超級 Darkrai。進度條在女巫之夜的畫面上。',
          },
        ],
      },
      {
        title: { pt: 'Ovo Assombrado por doces', en: 'Haunted Eggs for candies', es: 'Huevos Embrujados por dulces', fr: 'Œufs Hantés contre des bonbons', zh: '用糖果買鬧鬼蛋' },
        notes: [
          {
            pt: 'A barraca do Duskull não tem mais limite de um ovo por dia: compre quantos Ovos Assombrados couberem na incubadora, até o fim da Noite das Bruxas, para ir atrás de todos os fantasmas e dos shinies deles.',
            en: "Duskull's stall no longer stops at one egg a day: buy as many Haunted Eggs as your incubator holds, until Halloween Night ends, to chase every ghost and their shinies.",
            es: 'El puesto de Duskull ya no se limita a un huevo por día: compra todos los Huevos Embrujados que quepan en tu incubadora, hasta que termine la Noche de Brujas, para ir por todos los fantasmas y sus shinies.',
            fr: 'Le stand de Duskull ne s’arrête plus à un œuf par jour : achète autant d’Œufs Hantés que ton incubateur en contient, jusqu’à la fin de la Nuit des Sorcières, pour attraper tous les fantômes et leurs shinies.',
            zh: 'Duskull 的攤位不再限一天一顆：在女巫之夜結束前，孵化器放得下多少鬧鬼蛋就能買多少，把所有幽靈和牠們的異色都收集起來。',
          },
          {
            pt: 'Cada ovo sai por ₽ 6.000 ou por 1.000 doces. Gastar doces não esvazia o pote: os prêmios continuam contando tudo o que você já juntou.',
            en: 'Each egg costs ₽6,000 or 1,000 candies. Spending candies doesn’t empty the jar: its prizes still count everything you’ve collected.',
            es: 'Cada huevo cuesta ₽6.000 o 1.000 dulces. Gastar dulces no vacía el frasco: los premios siguen contando todo lo que ya juntaste.',
            fr: 'Chaque œuf coûte 6 000 ₽ ou 1 000 bonbons. Dépenser des bonbons ne vide pas le bocal : ses prix comptent toujours tout ce que tu as récolté.',
            zh: '每顆蛋 ₽6,000 或 1,000 顆糖果。花掉糖果不會清空糖果罐：獎勵仍會計算你收集過的所有糖果。',
          },
          {
            pt: 'Os doces que sobram para gastar aparecem ao lado do ₽ na barraca, no card da Noite das Bruxas (depois que o pote dá todos os prêmios) e na tela do evento.',
            en: 'The candies you have left to spend show next to your ₽ at the stall, on the Halloween Night card (once the jar has paid every prize) and on the event screen.',
            es: 'Los dulces que te quedan para gastar aparecen junto a los ₽ en el puesto, en la tarjeta de la Noche de Brujas (cuando el frasco ya dio todos los premios) y en la pantalla del evento.',
            fr: 'Les bonbons qu’il te reste à dépenser s’affichent à côté de tes ₽ au stand, sur la carte de la Nuit des Sorcières (une fois que le bocal a donné tous ses prix) et sur l’écran de l’événement.',
            zh: '剩下可花用的糖果會顯示在攤位的₽旁邊、女巫之夜卡片上（糖果罐的獎勵全部領完後）以及活動畫面中。',
          },
        ],
      },
      {
        title: { pt: 'Lobby no celular', en: 'Lobby on phones', es: 'Lobby en el celular', fr: 'Lobby sur mobile', zh: '手機大廳' },
        notes: [
          {
            pt: 'No celular em pé, cada card do lobby virou um ícone com um nome curto nas laterais da tela, e o seu Pokémon parceiro ganhou o espaço do meio de volta (antes ele ficava escondido atrás do JOGAR). Toque num ícone para abrir o que ele mostra, como antes; o PC e as telas grandes continuam iguais.',
            en: 'On a phone held upright, each lobby card became an icon with a short name along the sides of the screen, and your partner Pokémon got the middle back (it used to hide behind PLAY). Tap an icon to open what it shows, as before; computers and big screens stay the same.',
            es: 'En el celular en vertical, cada tarjeta del lobby se convirtió en un ícono con un nombre corto a los lados de la pantalla, y tu Pokémon compañero recuperó el centro (antes quedaba escondido detrás de JUGAR). Toca un ícono para abrir lo que muestra, como antes; la computadora y las pantallas grandes siguen iguales.',
            fr: 'Sur un téléphone tenu droit, chaque carte du lobby est devenue une icône avec un nom court sur les côtés de l’écran, et ton Pokémon partenaire a retrouvé le centre (avant, il se cachait derrière JOUER). Touche une icône pour ouvrir ce qu’elle montre, comme avant ; l’ordinateur et les grands écrans ne changent pas.',
            zh: '直拿手機時，大廳的每張卡片都變成畫面兩側附短名稱的圖示，你的夥伴寶可夢也重新回到中央（以前會被開始遊戲按鈕擋住）。點圖示就能打開它的內容，和以前一樣；電腦和大螢幕維持不變。',
          },
          {
            pt: 'Girar o celular troca o lobby para o jeito certo na hora, sem precisar recarregar.',
            en: 'Turning your phone switches the lobby to the right layout at once, no reload needed.',
            es: 'Girar el celular cambia el lobby al diseño correcto al instante, sin recargar.',
            fr: 'Tourner ton téléphone passe le lobby à la bonne disposition tout de suite, sans recharger.',
            zh: '旋轉手機時，大廳會立刻切換成正確的版面，不必重新整理。',
          },
          {
            pt: 'TikTok, YouTube e Instagram agora ficam na janela do Discord (e em Ajustes → Sobre).',
            en: 'TikTok, YouTube and Instagram now live in the Discord window (and in Settings → About).',
            es: 'TikTok, YouTube e Instagram ahora están en la ventana de Discord (y en Ajustes → Acerca de).',
            fr: 'TikTok, YouTube et Instagram sont maintenant dans la fenêtre Discord (et dans Réglages → À propos).',
            zh: 'TikTok、YouTube 和 Instagram 現在放在 Discord 視窗裡（以及設定 → 關於）。',
          },
        ],
      },
      {
        title: { pt: 'Animações dos golpes', en: 'Move animations', es: 'Animaciones de los ataques' },
        notes: [
          {
            pt: 'Fogo: Ember é um cometa de fogo com cauda tremulando e faíscas soltas; Fire Spin inclina as chamas contra o giro e deixa uma fita de fogo atrás; Pyro Ball voa em chamas e explode numa cúpula de fogo que esfria até virar brasa e fumaça; Dragon Breath sopra línguas de fogo violeta que viram fumaça.',
            en: 'Fire: Ember is a fiery comet with a flickering tail and loose sparks; Fire Spin leans its flames against the spin and leaves a ribbon of fire behind; Pyro Ball flies ablaze and erupts in a dome of fire that cools to embers and smoke; Dragon Breath blows tongues of violet fire that burn down to smoke.',
            es: 'Fuego: Ember es un cometa de fuego con cola que titila y chispas sueltas; Fire Spin inclina las llamas contra el giro y deja una cinta de fuego detrás; Pyro Ball vuela en llamas y estalla en una cúpula de fuego que se enfría hasta brasas y humo; Dragon Breath sopla lenguas de fuego violeta que se vuelven humo.',
          },
          {
            pt: 'Água: Water Gun é uma bala d’água que balança e solta gotas, com respingo na saída e ao acertar; Whirlpool virou um redemoinho com braços em espiral, espuma na borda e bolhas.',
            en: 'Water: Water Gun is a wobbling water bullet shedding droplets, with a splash at the muzzle and on impact; Whirlpool is now a vortex with spiral arms, foam on its rim and bubbles.',
            es: 'Agua: Water Gun es una bala de agua que se bambolea y suelta gotas, con salpicadura al salir y al acertar; Whirlpool ahora es un remolino con brazos en espiral, espuma en el borde y burbujas.',
          },
          {
            pt: 'Thunder: um aviso que pisca mais rápido antes de cair, um raio grosso e ramificado que tremula ao reacender, clarão, faíscas e marca de queimado no chão.',
            en: 'Thunder: a warning that blinks faster before it falls, a thick forked bolt that flickers as it re-strikes, a flash, sparks and a scorch mark on the ground.',
            es: 'Thunder: un aviso que parpadea más rápido antes de caer, un rayo grueso y ramificado que titila al volver a golpear, destello, chispas y una marca chamuscada en el suelo.',
          },
          {
            pt: 'E mais: Sludge Bomb balança no ar, espirra ao cair e forma uma poça com bolhas que estouram; Earthquake levanta uma onda de terra com rachaduras, pedras e poeira; Swift deixa um rastro de estrelinhas; Razor Leaf corta com rastro; Vine Whip estala na ponta e recolhe; Gust gira em rajadas; Psyshock é uma esfera com espiral e anel; Flash Cannon brilha; Pin Missile solta propulsão; Crunch abre antes de morder; Rock Tomb levanta pedrinhas e poeira.',
            en: 'And more: Sludge Bomb wobbles in the air, splashes as it lands and leaves a pool of popping bubbles; Earthquake heaves a wave of earth with cracks, rocks and dust; Swift trails twinkles; Razor Leaf slices with a trail; Vine Whip cracks at the tip and snaps back; Gust whirls in gusts; Psyshock is an orb with a spiral and a ring; Flash Cannon gleams; Pin Missile flies on exhaust; Crunch opens wide before it bites; Rock Tomb throws up chips and dust.',
            es: 'Y más: Sludge Bomb se bambolea en el aire, salpica al caer y deja un charco con burbujas que revientan; Earthquake levanta una ola de tierra con grietas, piedras y polvo; Swift deja un rastro de estrellitas; Razor Leaf corta con estela; Vine Whip chasquea en la punta y se recoge; Gust gira en ráfagas; Psyshock es una esfera con espiral y anillo; Flash Cannon brilla; Pin Missile vuela con propulsión; Crunch abre bien antes de morder; Rock Tomb levanta piedritas y polvo.',
          },
          {
            pt: 'Só visual: dano, alcance e velocidade dos golpes continuam iguais. No modo leve (celulares com dificuldade) os detalhes extras são desligados.',
            en: 'Looks only: the moves’ damage, reach and speed are unchanged. In lean mode (phones that struggle) the extra details are turned off.',
            es: 'Solo visual: el daño, el alcance y la velocidad de los ataques siguen iguales. En el modo ligero (celulares con dificultades) los detalles extra se apagan.',
          },
        ],
      },
      {
        title: { pt: 'Ranking do modo infinito', en: 'Endless mode on the ranking', es: 'Ranking del modo infinito', fr: 'Le mode infini au classement', zh: '無盡模式的排行榜' },
        notes: [
          {
            pt: 'Partidas que passavam do nível 999 no modo infinito eram recusadas pelo ranking e ficavam com o tempo da vitória. Agora contam com o tempo todo.',
            en: 'Endless runs that went past level 999 were refused by the ranking and kept the victory’s time. They now count with their whole time.',
            es: 'Las partidas que pasaban del nivel 999 en el modo infinito eran rechazadas por el ranking y se quedaban con el tiempo de la victoria. Ahora cuentan con todo su tiempo.',
            fr: 'Les parties en mode infini qui dépassaient le niveau 999 étaient refusées par le classement et gardaient le temps de la victoire. Elles comptent maintenant avec tout leur temps.',
            zh: '無盡模式中超過 999 級的對局會被排行榜拒絕，只留下勝利時的時間。現在會以完整時間計入。',
          },
          {
            pt: 'Se o jogo fechar no meio do modo infinito (um travamento, a aba fechada), o tempo jogado até o último minuto entra no ranking quando você abrir o jogo de novo.',
            en: 'If the game closes in the middle of endless mode (a crash, a closed tab), the time played up to the last minute goes on the ranking when you open the game again.',
            es: 'Si el juego se cierra en medio del modo infinito (un cuelgue, la pestaña cerrada), el tiempo jugado hasta el último minuto entra en el ranking cuando vuelvas a abrir el juego.',
            fr: 'Si le jeu se ferme en plein mode infini (un plantage, l’onglet fermé), le temps joué jusqu’à la dernière minute entre au classement quand tu rouvres le jeu.',
            zh: '如果遊戲在無盡模式中途關閉（當機、分頁被關閉），重新打開遊戲時，玩到最後一分鐘的時間會計入排行榜。',
          },
        ],
      },
    ],
  },
  {
    date: '2026-10-23',
    title: { pt: 'Francês, chinês, golpes transparentes e uma página para cada Pokémon', en: 'French, Chinese, see-through moves and a page for every Pokémon', es: 'Francés, chino, ataques transparentes y una página para cada Pokémon', fr: 'Français, chinois, attaques transparentes et une page pour chaque Pokémon', zh: '法文、繁體中文、半透明招式，還有每隻寶可夢的專屬頁面' },
    highlights: [
      { pt: 'O jogo agora fala francês e chinês tradicional (繁體中文): escolha em Ajustes ou deixe o navegador escolher. O site, a Pokédex e o guia também foram traduzidos.', en: 'The game now speaks French and Traditional Chinese (繁體中文): pick one in Settings or let your browser choose. The site, the Pokédex and the guide are translated too.', es: 'El juego ahora habla francés y chino tradicional (繁體中文): elígelo en Ajustes o deja que lo elija tu navegador. El sitio, la Pokédex y la guía también están traducidos.', fr: 'Le jeu parle maintenant français et chinois traditionnel (繁體中文) : choisis dans les Réglages ou laisse ton navigateur décider. Le site, le Pokédex et le guide sont traduits aussi.', zh: '遊戲現在支援法文和繁體中文：可以在設定裡選擇，或讓瀏覽器自動決定。網站、寶可夢圖鑑和攻略也都翻譯好了。' },
      { pt: 'Nova opção em Ajustes → Jogo: Opacidade dos golpes. Deixe seus golpes transparentes para enxergar seu Pokémon, os inimigos e os ataques deles mesmo com a build completa.', en: 'New option in Settings → Game: Move opacity. Make your moves see-through to spot your Pokémon, the foes and their attacks even with a full build.', es: 'Nueva opción en Ajustes → Juego: Opacidad de ataques. Haz tus ataques transparentes para ver a tu Pokémon, a los enemigos y sus ataques incluso con la build completa.', fr: 'Nouvelle option dans Réglages → Jeu : Opacité des attaques. Rends tes attaques transparentes pour voir ton Pokémon, les ennemis et leurs attaques même avec une build complète.', zh: '設定 → 遊戲新增選項：招式透明度。把你的招式調成半透明，即使配置滿了也能看清你的寶可夢、敵人和它們的攻擊。' },
      { pt: 'Raios mais finos no fim da partida: Ice Beam, Aurora Beam, Solar Beam, Hyper Beam e outros engrossavam demais com itens de área e cobriam a tela inteira.', en: 'Slimmer beams late in a run: Ice Beam, Aurora Beam, Solar Beam, Hyper Beam and others grew far too thick with area items and covered the whole screen.', es: 'Rayos más finos al final de la partida: Ice Beam, Aurora Beam, Solar Beam, Hyper Beam y otros engordaban demasiado con objetos de área y cubrían toda la pantalla.', fr: 'Des rayons plus fins en fin de partie : Ice Beam, Aurora Beam, Solar Beam, Hyper Beam et d’autres devenaient bien trop épais avec les objets de zone et couvraient tout l’écran.', zh: '對局後期的光束變細了：Ice Beam、Aurora Beam、Solar Beam、Hyper Beam 等招式以前會因範圍道具變得太粗，蓋住整個畫面。' },
      { pt: 'Não quer o golpe em dupla? Agora dá para usar o Esquecer no card dourado, e aquela união não aparece mais na partida.', en: 'Don’t want the duo move? Forget now works on the golden card, and that fusion won’t show up again in the run.', es: '¿No quieres el ataque en dúo? Ahora Olvidar funciona en la carta dorada, y esa unión no vuelve a aparecer en la partida.', fr: 'Tu ne veux pas de la capacité duo ? Oublier marche maintenant sur la carte dorée, et cette fusion ne revient plus de la partie.', zh: '不想要合體招式？現在可以對金色卡片使用遺忘，這個組合在本局就不會再出現。' },
      { pt: 'Espanhol revisado por LauKhaos, moderadora do nosso Discord: textos mais naturais no jogo inteiro e no site. ¡Gracias, Lau!', en: 'Spanish reviewed by LauKhaos, a moderator of our Discord: more natural text across the whole game and the site. ¡Gracias, Lau!', es: 'Español revisado por LauKhaos, moderadora de nuestro Discord: textos más naturales en todo el juego y en el sitio. ¡Gracias, Lau!', fr: 'Espagnol relu par LauKhaos, modératrice de notre Discord : des textes plus naturels dans tout le jeu et sur le site. ¡Gracias, Lau!', zh: '西班牙文由我們 Discord 的管理員 LauKhaos 校對：整個遊戲和網站的文字都更自然了。¡Gracias, Lau!' },
    ],
    changes: [
      {
        title: { pt: 'Opacidade dos golpes', en: 'Move opacity', es: 'Opacidad de ataques' },
        notes: [
          {
            pt: 'Em Ajustes → Jogo, Opacidade dos golpes vai de 10% a 100%. Abaixo de 100%, todos os seus golpes ficam transparentes juntos, como uma camada só: os raios que se cruzam não voltam a ficar opacos onde se sobrepõem. Os ataques dos inimigos e dos chefes continuam por cima e sem transparência.',
            en: "In Settings → Game, Move opacity goes from 10% to 100%. Below 100%, all your moves turn see-through together, as one layer: crossing beams don't turn opaque again where they overlap. Foes' and bosses' attacks stay on top and fully opaque.",
            es: 'En Ajustes → Juego, Opacidad de ataques va de 10% a 100%. Por debajo de 100%, todos tus ataques se vuelven transparentes juntos, como una sola capa: los rayos que se cruzan no vuelven a ser opacos donde se superponen. Los ataques de los enemigos y de los jefes siguen encima y sin transparencia.',
          },
          {
            pt: 'O arco-íris do Aurora Beam agora tem a largura de verdade do golpe: antes ele era desenhado mais largo do que acertava.',
            en: "Aurora Beam's rainbow is now as wide as the move really hits: it used to be drawn wider than its reach.",
            es: 'El arcoíris de Aurora Beam ahora tiene el ancho real del ataque: antes se dibujaba más ancho de lo que golpeaba.',
          },
        ],
      },
      {
        title: { pt: 'Raios na grossura certa', en: 'Beams at the right thickness', es: 'Rayos con el grosor correcto' },
        notes: [
          {
            pt: 'Corrigido: os itens e bônus de área (Wide Lens e outros) contavam duas vezes na grossura dos raios. Com Wide Lens no máximo, um raio ficava 50% mais grosso do que devia, e com outros bônus de área a diferença crescia ainda mais. Agora a área aumenta a grossura uma vez só, como aumenta o comprimento. Vale para Ice Beam, Aurora Beam, Solar Beam, Hyper Beam, Seed Flare, Charge Beam, Sacred Sword e Bitter Blade.',
            en: 'Fixed: area items and bonuses (Wide Lens and others) counted twice on beam thickness. With Wide Lens maxed, a beam came out 50% thicker than it should, and other area bonuses widened the gap further. Area now thickens a beam once, as it lengthens it. This goes for Ice Beam, Aurora Beam, Solar Beam, Hyper Beam, Seed Flare, Charge Beam, Sacred Sword and Bitter Blade.',
            es: 'Corregido: los objetos y bonos de área (Wide Lens y otros) contaban dos veces en el grosor de los rayos. Con Wide Lens al máximo, un rayo quedaba 50% más grueso de lo que debía, y con otros bonos de área la diferencia crecía aún más. Ahora el área engrosa el rayo una sola vez, igual que lo alarga. Vale para Ice Beam, Aurora Beam, Solar Beam, Hyper Beam, Seed Flare, Charge Beam, Sacred Sword y Bitter Blade.',
          },
        ],
      },
      {
        title: { pt: 'Lendários shiny nas ondas', en: 'Shiny legendaries in the waves', es: 'Legendarios shiny en las oleadas', fr: 'Légendaires chromatiques dans les vagues', zh: '波次中的異色傳說寶可夢' },
        notes: [
          {
            pt: 'Corrigido: as aves, os cães e os regis lendários, Mew, Celebi, Jirachi, Mewtwo e o Arceus do modo infinito nunca vinham shiny, então os shinies deles não dava para liberar no Modo Lendário. Agora cada um tem 1 chance em 8 de chegar shiny, como os lendários das fendas. Valeu, Lau, por perceber!',
            en: "Fixed: the legendary birds, beasts and regis, Mew, Celebi, Jirachi, Mewtwo and endless mode's Arceus never came shiny, so their shinies couldn't be unlocked for Legend Mode. Now each has a 1 in 8 chance to arrive shiny, like the rift legendaries. Thanks, Lau, for spotting it!",
            es: 'Corregido: las aves, los perros y los regis legendarios, Mew, Celebi, Jirachi, Mewtwo y el Arceus del modo infinito nunca aparecían shiny, así que sus shinies no se podían desbloquear para el Modo Legendario. Ahora cada uno tiene 1 probabilidad entre 8 de llegar shiny, como los legendarios de las grietas. ¡Gracias, Lau, por notarlo!',
            fr: "Corrigé : les oiseaux, les chiens et les régis légendaires, Mew, Celebi, Jirachi, Mewtwo et l'Arceus du mode infini n'arrivaient jamais chromatiques, donc leurs chromatiques ne pouvaient pas être débloqués pour le Mode Légendaire. Désormais chacun a 1 chance sur 8 d'arriver chromatique, comme les légendaires des failles. Merci, Lau, de l'avoir remarqué !",
            zh: '已修正：傳說中的三神鳥、三聖獸、三神柱，以及 Mew、Celebi、Jirachi、Mewtwo 和無盡模式的 Arceus 以前從不會以異色出現，所以無法在傳說模式解鎖牠們的異色。現在每一隻都有 1/8 的機率以異色登場，和裂縫中的傳說寶可夢一樣。謝謝 Lau 發現這個問題！',
          },
        ],
      },
      {
        title: { pt: 'Páginas dos Pokémon', en: 'Pokémon pages', es: 'Páginas de los Pokémon', fr: 'Pages des Pokémon', zh: '寶可夢頁面' },
        notes: [
          {
            pt: 'Na Pokédex, o nome de cada Pokémon jogável leva à página da família: os cards de cada estágio e ramificação, com status, linha evolutiva, golpes, especial e Habilidades, as Megas da linha e perguntas frequentes. Os lendários têm a sua, com quando aparecem, os ataques de chefe e como capturá-los para o Modo Lendário.',
            en: 'In the Pokédex, every playable Pokémon’s name leads to its family’s page: the cards of each stage and branch, with stats, evolution line, moves, special and Abilities, the line’s Megas and a FAQ. Legendaries get their own, with when they show up, their boss attacks and how to catch them for Legend Mode.',
            es: 'En la Pokédex, el nombre de cada Pokémon jugable lleva a la página de su familia: las cartas de cada etapa y rama, con estadísticas, línea evolutiva, movimientos, especial y Habilidades, las Megas de la línea y preguntas frecuentes. Los legendarios tienen la suya, con cuándo aparecen, sus ataques de jefe y cómo capturarlos para el Modo Legendario.', fr: 'Dans le Pokédex, le nom de chaque Pokémon jouable mène à la page de sa famille : les cartes de chaque stade et de chaque embranchement, avec stats, lignée d’évolution, capacités, attaque spéciale et Talents, les Méga de la lignée et une FAQ. Les légendaires ont la leur, avec quand ils apparaissent, leurs attaques de boss et comment les capturer pour le Mode Légendaire.', zh: '在寶可夢圖鑑中，每隻可使用的寶可夢名稱都會連到牠家族的頁面：每個階段與分支的卡片，附上能力值、進化路線、招式、必殺技與特性，還有該家族的超級進化與常見問題。傳說寶可夢也有自己的頁面，說明牠們的出現時機、首領攻擊，以及如何收服牠們來用於傳說模式。',
          },
        ],
      },
      {
        title: { pt: 'Tier list', en: 'Tier list', es: 'Tier list', fr: 'Tier list', zh: '強度排行' },
        notes: [
          {
            pt: 'A nova página Tier list (no menu do site) ordena os 90 Pokémon jogáveis de S a D pelas partidas dos últimos 30 dias no Normal, no Difícil e no Pesadelo, com a taxa de vitória e o minuto médio de cada um. Ela explica como a nota é feita e o que ela não diz: quem começa agora costuma jogar com os iniciais mais famosos, e isso pesa nos números.',
            en: 'The new Tier list page (in the site’s menu) ranks the 90 playable Pokémon from S to D using the last 30 days of runs on Normal, Hard and Nightmare, with each one’s win rate and average minute. It explains how the score works and what it doesn’t say: new players tend to pick the famous starters, and that weighs on the numbers.',
            es: 'La nueva página Tier list (en el menú del sitio) ordena los 90 Pokémon jugables de S a D con las partidas de los últimos 30 días en Normal, Difícil y Pesadilla, con el porcentaje de victorias y el minuto promedio de cada uno. Explica cómo se calcula la nota y lo que no dice: quien recién empieza suele elegir los iniciales más famosos, y eso pesa en los números.', fr: 'La nouvelle page Tier list (dans le menu du site) classe les 90 Pokémon jouables de S à D à partir des 30 derniers jours de parties en Normal, Difficile et Cauchemar, avec le taux de victoire et la minute moyenne de chacun. Elle explique comment le score est calculé et ce qu’il ne dit pas : les nouveaux joueurs choisissent surtout les starters célèbres, et ça pèse sur les chiffres.', zh: '新的強度排行頁面（在網站選單中）根據最近 30 天普通、困難、惡夢難度的對局，把 90 隻可操控的寶可夢從 S 排到 D，並列出每隻的勝率和平均分鐘數。頁面也說明分數怎麼算，以及它沒告訴你的事：新玩家多半選有名的初始寶可夢，這會影響數據。',
          },
          {
            pt: 'A página de cada Pokémon mostra o tier dele e a taxa de vitória no Normal, com um link para a tier list.',
            en: 'Each Pokémon’s page shows its tier and its win rate on Normal, with a link to the tier list.',
            es: 'La página de cada Pokémon muestra su tier y su porcentaje de victorias en Normal, con un enlace a la tier list.', fr: 'La page de chaque Pokémon affiche son rang et son taux de victoire en Normal, avec un lien vers la tier list.', zh: '每隻寶可夢的頁面都會顯示牠的等級和普通難度勝率，並連到強度排行。',
          },
        ],
      },
      {
        title: { pt: 'Idioma', en: 'Language', es: 'Idioma', fr: 'Langue', zh: '語言' },
        notes: [
          {
            pt: 'Dois idiomas novos, no jogo inteiro e no site: francês (/fr/) e chinês tradicional (/zh-tw/), com uma fonte pixel própria para o chinês. Nomes de Pokémon, golpes e itens continuam em inglês, como nos outros idiomas.',
            en: 'Two new languages, across the whole game and the site: French (/fr/) and Traditional Chinese (/zh-tw/), with a pixel font of its own for Chinese. Pokémon, move and item names stay in English, as in the other languages.',
            es: 'Dos idiomas nuevos, en todo el juego y el sitio: francés (/fr/) y chino tradicional (/zh-tw/), con una fuente pixel propia para el chino. Los nombres de Pokémon, movimientos y objetos siguen en inglés, como en los demás idiomas.', fr: 'Deux nouvelles langues, dans tout le jeu et sur le site : le français (/fr/) et le chinois traditionnel (/zh-tw/), avec une police pixel dédiée au chinois. Les noms des Pokémon, des capacités et des objets restent en anglais, comme dans les autres langues.', zh: '兩種新語言，遍及整個遊戲和網站：法文（/fr/）和繁體中文（/zh-tw/），中文還有專屬的像素字型。寶可夢、招式和道具名稱和其他語言一樣維持英文。',
          },
          {
            pt: 'A tradução em espanhol foi revisada por LauKhaos (@laukhaos), moderadora do nosso Discord: centenas de textos do jogo e do site ficaram mais naturais, e termos como Horda do dia, móvil e mando agora são os mesmos em toda parte. O crédito dela está em Ajustes → Sobre e na página Legal e créditos.',
            en: 'The Spanish translation was reviewed by LauKhaos (@laukhaos), a moderator of our Discord: hundreds of game and site texts read more naturally, and terms like Horda del día, móvil and mando are now the same everywhere. Her credit is in Settings → About and on the Legal and credits page.',
            es: 'La traducción al español fue revisada por LauKhaos (@laukhaos), moderadora de nuestro Discord: cientos de textos del juego y del sitio quedaron más naturales, y términos como Horda del día, móvil y mando ahora son los mismos en todas partes. Su crédito está en Ajustes → Acerca de y en la página Legal y créditos.',
            fr: 'La traduction espagnole a été relue par LauKhaos (@laukhaos), modératrice de notre Discord : des centaines de textes du jeu et du site sont plus naturels, et des termes comme Horda del día, móvil et mando sont désormais les mêmes partout. Son crédit figure dans Réglages → Infos et sur la page Mentions légales et crédits.',
            zh: '西班牙文翻譯由我們 Discord 的管理員 LauKhaos（@laukhaos）校對：遊戲和網站的數百段文字變得更自然，Horda del día、móvil、mando 等用語也全面統一。她的名字列在「設定 → 關於」和網站的法律與致謝頁面。',
          },
          {
            pt: 'O endereço em inglês (/en/) passou a seguir o idioma do navegador na primeira visita, como o principal; o idioma que você escolhe nos Ajustes continua valendo sempre.',
            en: 'The English address (/en/) now follows your browser’s language on a first visit, like the main one; the language you pick in Settings still always wins.',
            es: 'La dirección en inglés (/en/) ahora sigue el idioma de tu navegador en la primera visita, como la principal; el idioma que eliges en Ajustes sigue valiendo siempre.', fr: 'L’adresse en anglais (/en/) suit désormais la langue de ton navigateur lors d’une première visite, comme l’adresse principale ; la langue que tu choisis dans les Réglages a toujours le dernier mot.', zh: '英文網址（/en/）在第一次造訪時，現在會和主網址一樣跟隨你瀏覽器的語言；你在設定中選擇的語言仍然永遠優先。',
          },
        ],
      },
      {
        title: { pt: 'Correções', en: 'Fixes', es: 'Correcciones', fr: 'Corrections', zh: '修正' },
        notes: [
          {
            pt: 'O seu Pokémon parceiro não some mais do lobby depois de deixar o jogo um tempo em outra aba (e o shiny do Surto do dia também não).',
            en: 'Your partner Pokémon no longer vanishes from the lobby after the game sits in another tab for a while (nor does the Outbreak’s shiny).',
            es: 'Tu Pokémon compañero ya no desaparece del lobby después de dejar el juego un rato en otra pestaña (ni el shiny de la Horda del día).',
            fr: 'Ton Pokémon partenaire ne disparaît plus du lobby quand le jeu reste un moment dans un autre onglet (ni le shiny de l’Apparition massive du jour).',
            zh: '把遊戲放在其他分頁一段時間後，大廳裡的夥伴寶可夢不會再消失了（今日大量出現的異色寶可夢也一樣）。',
          },
          {
            pt: 'O campo do lobby fica parado de novo: o cenário não anda mais um pixel de cada vez, para os lados, para cima e para baixo.',
            en: 'The lobby’s meadow stands still again: the scenery no longer creeps a pixel at a time, sideways, up and down.',
            es: 'El prado del lobby vuelve a quedarse quieto: el escenario ya no se mueve de a un píxel, hacia los lados, arriba y abajo.',
            fr: 'La prairie du lobby reste immobile à nouveau : le décor ne bouge plus pixel par pixel, sur les côtés, en haut et en bas.',
            zh: '大廳的草原恢復靜止了：場景不會再一格一格地左右、上下移動。',
          },
          {
            pt: 'A plaquinha do Kecleon que aponta para a loja voltou ao lobby em telas grandes: com a barraca da Noite das Bruxas (ou a caravana do Meowth) na praça, um cantinho do calçamento entrava na tela e escondia a plaquinha. E o Duskull ganhou a dele, apontando para a barraca: toque nela para falar com ele.',
            en: 'Kecleon’s little sign pointing to the shop is back in the lobby on big screens: with the Halloween Night stall (or Meowth’s caravan) on the plaza, a corner of its cobblestones crept into view and hid the sign. And Duskull got one too, pointing to his stall: tap it to talk to him.',
            es: 'El cartelito de Kecleon que señala la tienda volvió al lobby en pantallas grandes: con el puesto de la Noche de Brujas (o la caravana de Meowth) en la plaza, una esquina del empedrado entraba en pantalla y ocultaba el cartelito. Y Duskull ganó el suyo, señalando su puesto: tócalo para hablar con él.',
            fr: 'Le petit panneau de Kecleon qui indique la boutique est de retour dans le lobby sur les grands écrans : avec l’échoppe de la Nuit des Sorcières (ou la caravane de Meowth) sur la place, un coin des pavés entrait à l’écran et cachait le panneau. Et Duskull a maintenant le sien, qui indique son échoppe : touche-le pour lui parler.',
            zh: '在大螢幕上，大廳裡指向商店的 Kecleon 小招牌回來了：當女巫之夜的攤位（或 Meowth 的商隊）在廣場上時，石板路的一角會進入畫面，把招牌藏起來。Duskull 也有了自己的小招牌，指向牠的攤位：點一下就能和牠說話。',
          },
        ],
      },
      {
        title: { pt: 'Golpes em dupla', en: 'Duo moves', es: 'Ataques en dúo' },
        notes: [
          {
            pt: 'O card dourado de golpe em dupla não é mais obrigatório: o Esquecer funciona nele como em qualquer golpe ou item. O espaço é sorteado de novo, os dois golpes continuam com você e aquela receita não volta mais na partida (a Fusion Flare e a Fusion Bolt saem juntas).',
            en: 'The golden duo move card is no longer forced on you: Forget works on it like on any move or item. The slot is rerolled, you keep both moves and that recipe won’t come back this run (Fusion Flare and Fusion Bolt go together).',
            es: 'La carta dorada de ataque en dúo ya no es obligatoria: Olvidar funciona en ella como en cualquier movimiento u objeto. El espacio se sortea de nuevo, te quedas con los dos ataques y esa receta no vuelve en la partida (Fusion Flare y Fusion Bolt salen juntas).',
          },
        ],
      },
    ],
  },
  {
    date: '2026-10-22',
    title: { pt: 'A economia ganhou sentido', en: 'The economy gets a purpose', es: 'La economía cobra sentido', fr: 'L’économie prend tout son sens', zh: '經濟有了意義' },
    highlights: [
      { pt: 'Ovo do Kecleon sem o limite de um por dia: até 6, e cada um custa o dobro do anterior (₽ 10.000, 20.000, 40.000…). A conta zera à meia-noite.', en: 'The Kecleon Egg is no longer one a day: up to 6, each costing double the last (₽ 10,000, 20,000, 40,000…). The count resets at midnight.', es: 'El Huevo Kecleon ya no es uno por día: hasta 6, y cada uno cuesta el doble del anterior (₽ 10.000, 20.000, 40.000…). La cuenta vuelve a cero a medianoche.', fr: 'L’Œuf de Kecleon n’est plus limité à un par jour : jusqu’à 6, chacun au double du précédent (₽ 10 000, 20 000, 40 000…). Le compteur repart à zéro à minuit.', zh: 'Kecleon蛋不再是每天一顆：最多 6 顆，每顆是前一顆的兩倍價（₽ 10,000、20,000、40,000…）。數量在午夜重置。' },
      { pt: 'Incubadora maior: a 4ª e a 5ª vaga, suas para sempre, e a Incubadora Rápida, que faz um ovo andar o dobro.', en: 'A bigger incubator: the 4th and 5th slots, yours for good, and the Quick Incubator, which makes an egg walk twice as fast.', es: 'Una incubadora más grande: el 4.º y el 5.º espacio, tuyos para siempre, y la Incubadora Rápida, que hace que un huevo avance el doble.', fr: 'Un incubateur plus grand : les 4e et 5e emplacements, à toi pour de bon, et l’Incubateur rapide, qui fait marcher un œuf deux fois plus vite.', zh: '更大的孵化器：第 4 與第 5 個欄位，永遠屬於你，還有快速孵化器，能讓一顆蛋的步數累積速度加倍。' },
      { pt: 'As partidas pagam cerca de metade do ₽, agora que a loja tem onde gastar. O que você já guardou continua valendo o mesmo.', en: 'Runs pay about half the ₽, now that the shop has somewhere to spend it. What you already saved keeps its full value.', es: 'Las partidas pagan cerca de la mitad de los ₽, ahora que la tienda tiene en qué gastarlos. Lo que ya ahorraste sigue valiendo lo mismo.', fr: 'Les parties rapportent environ moitié moins de ₽, maintenant que la boutique a de quoi les dépenser. Ce que tu as déjà économisé garde toute sa valeur.', zh: '既然商店有地方花錢了，對局給的 ₽ 大約減半。你已經存下的錢價值不變。' },
      { pt: 'Menos travamentos no celular: o começo da partida e as fendas lendárias pesam menos, e o novo Modo leve liga sozinho nos aparelhos que precisam.', en: 'Fewer crashes on phones: the start of a run and the legendary rifts weigh less, and the new Lite mode turns on by itself on devices that need it.', es: 'Menos cierres en el celular: el comienzo de la partida y las grietas legendarias pesan menos, y el nuevo Modo ligero se activa solo en los dispositivos que lo necesitan.', fr: 'Moins de plantages sur mobile : le début d’une partie et les failles légendaires sont plus légers, et le nouveau Mode léger s’active tout seul sur les appareils qui en ont besoin.', zh: '手機上更少閃退：對局開始與傳說裂縫的負擔變輕了，新的輕量模式也會在需要的裝置上自動開啟。' },
      { pt: 'Correções dos relatos de vocês: Groudon e Rayquaza não travam mais numa fase, Pokémon grandes cabem nos labirintos e ninguém mais fica preso no cenário.', en: 'Fixes from your reports: Groudon and Rayquaza no longer get stuck on a phase, big Pokémon fit through mazes and nobody gets stuck in the scenery anymore.', es: 'Correcciones de sus reportes: Groudon y Rayquaza ya no se traban en una fase, los Pokémon grandes caben en los laberintos y nadie más queda atrapado en el escenario.', fr: 'Corrections issues de vos signalements : Groudon et Rayquaza ne restent plus bloqués sur une phase, les grands Pokémon passent dans les labyrinthes et plus personne ne reste coincé dans le décor.', zh: '根據大家的回報修正：Groudon 與 Rayquaza 不會再卡在某個階段，大型寶可夢能通過迷宮，也不會再有人卡在場景裡。' },
    ],
    changes: [
      {
        title: { pt: 'Modo leve', en: 'Lite mode', es: 'Modo ligero', fr: 'Mode léger', zh: '輕量模式' },
        notes: [
          {
            pt: 'Novo Modo leve: menos partículas, chuva e neve mais ralas, menos sombras e menos memória, para o jogo rodar liso em celulares mais simples. Ele liga sozinho no aparelho que precisa e desliga quando as partidas voltam a rodar bem, e dá para ligar ou desligar em Ajustes → Jogo.',
            en: 'New Lite mode: fewer particles, lighter rain and snow, fewer shadows and less memory, so the game runs smoothly on simpler phones. It turns on by itself on a device that needs it and off once runs play well again, and you can switch it on or off in Settings → Game.',
            es: 'Nuevo Modo ligero: menos partículas, lluvia y nieve más ralas, menos sombras y menos memoria, para que el juego corra fluido en celulares más sencillos. Se activa solo en el dispositivo que lo necesita y se apaga cuando las partidas vuelven a ir bien, y puedes activarlo o desactivarlo en Ajustes → Juego.', fr: 'Nouveau Mode léger : moins de particules, une pluie et une neige plus légères, moins d’ombres et moins de mémoire, pour que le jeu tourne bien sur les téléphones plus modestes. Il s’active tout seul sur un appareil qui en a besoin et se désactive dès que les parties tournent bien à nouveau, et tu peux l’activer ou le désactiver dans Réglages → Jeu.', zh: '新的輕量模式：更少的粒子、更稀疏的雨和雪、更少的陰影、更少的記憶體用量，讓遊戲在較入門的手機上也能流暢執行。它會在需要的裝置上自動開啟，對局恢復順暢後自動關閉，你也可以在 設定 → 遊戲 中手動開關。',
          },
        ],
      },
      {
        title: { pt: 'Passear pela praça no celular', en: 'Walk around the plaza on your phone', es: 'Pasear por la plaza en el celular', fr: 'Se promener sur la place depuis ton téléphone', zh: '用手機在廣場散步' },
        notes: [
          {
            pt: 'O novo botão Passear, ao lado do seu Pokémon no lobby, guarda os cartões e deixa só o campo: toque na grama ou arraste o dedo para andar até a praça do Kecleon, e toque em Falar perto do Kecleon, do Meowth, das barracas, da fonte ou da placa. Ao fechar a loja ou o festival, você continua passeando; Voltar (ou Esc) traz o lobby de volta.',
            en: 'The new Explore button, next to your Pokémon in the lobby, puts the cards away and leaves just the meadow: tap the grass or drag your finger to walk to the Kecleon plaza, and tap Talk near Kecleon, Meowth, the stalls, the fountain or the plaque. Closing the shop or the festival keeps you walking; Back (or Esc) brings the lobby back.',
            es: 'El nuevo botón Pasear, al lado de tu Pokémon en el lobby, guarda las tarjetas y deja solo el campo: toca el pasto o arrastra el dedo para caminar hasta la plaza de Kecleon, y toca Hablar cerca de Kecleon, Meowth, los puestos, la fuente o la placa. Al cerrar la tienda o el festival, sigues paseando; Volver (o Esc) trae el lobby de vuelta.', fr: 'Le nouveau bouton Se promener, à côté de ton Pokémon à l’accueil, range les cartes et ne laisse que la prairie : touche l’herbe ou fais glisser ton doigt pour marcher jusqu’à la place de Kecleon, et touche Parler près de Kecleon, Meowth, des stands, de la fontaine ou de la plaque. Fermer la boutique ou le festival te laisse en promenade ; Retour (ou Échap) ramène l’accueil.', zh: '大廳裡你的寶可夢旁邊新增了「散步」按鈕，會把卡片收起來，只留下草地：點一下草地或拖曳手指，就能走到 Kecleon 廣場；靠近 Kecleon、Meowth、攤位、泉水或紀念牌時，點「交談」即可。關閉商店或祭典後，你會繼續散步；「返回」（或 Esc）會回到大廳。',
          },
          {
            pt: 'Corrigido: com a loja aberta, tocar na praça acima dela às vezes apertava botões invisíveis do lobby e abria o TikTok, o YouTube, o Instagram ou o Discord.',
            en: 'Fixed: with the shop open, tapping the plaza above it sometimes pressed invisible lobby buttons and opened TikTok, YouTube, Instagram or Discord.',
            es: 'Corregido: con la tienda abierta, tocar la plaza encima de ella a veces apretaba botones invisibles del lobby y abría TikTok, YouTube, Instagram o Discord.', fr: 'Corrigé : avec la boutique ouverte, toucher la place au-dessus appuyait parfois sur des boutons invisibles de l’accueil et ouvrait TikTok, YouTube, Instagram ou Discord.', zh: '修正：商店開啟時，點擊商店上方的廣場有時會按到大廳中看不見的按鈕，打開 TikTok、YouTube、Instagram 或 Discord。',
          },
        ],
      },
      {
        title: { pt: 'Ovo do Kecleon', en: 'Kecleon Egg', es: 'Huevo Kecleon', fr: 'Œuf de Kecleon', zh: 'Kecleon蛋' },
        notes: [
          {
            pt: 'O Ovo do Kecleon deixou de ser um por dia. O primeiro do dia custa ₽ 10.000, e cada um depois custa o dobro do anterior (₽ 20.000, 40.000, 80.000, 160.000 e 320.000), até 6 por dia; a conta volta a ₽ 10.000 à meia-noite de Brasília. O card mostra quantos você levou hoje e quanto custa o próximo. Ele choca em 4.000 passos, e um repetido vira ₽ 2.500.',
            en: "The Kecleon Egg is no longer one a day. The day's first costs ₽ 10,000, and each one after costs double the last (₽ 20,000, 40,000, 80,000, 160,000 and 320,000), up to 6 a day; the count goes back to ₽ 10,000 at midnight Brasília time. The card shows how many you took today and what the next one costs. It hatches in 4,000 steps, and a duplicate turns into ₽ 2,500.",
            es: 'El Huevo Kecleon ya no es uno por día. El primero del día cuesta ₽ 10.000, y cada uno después cuesta el doble del anterior (₽ 20.000, 40.000, 80.000, 160.000 y 320.000), hasta 6 por día; la cuenta vuelve a ₽ 10.000 a la medianoche de Brasilia. La carta muestra cuántos llevaste hoy y cuánto cuesta el siguiente. Eclosiona en 4.000 pasos, y uno repetido se convierte en ₽ 2.500.', fr: 'L’Œuf de Kecleon n’est plus limité à un par jour. Le premier du jour coûte ₽ 10 000, et chacun des suivants coûte le double du précédent (₽ 20 000, 40 000, 80 000, 160 000 et 320 000), jusqu’à 6 par jour ; le compteur revient à ₽ 10 000 à minuit, heure de Brasília. La carte indique combien tu en as pris aujourd’hui et le prix du suivant. Il éclot en 4 000 pas, et un doublon se transforme en ₽ 2 500.', zh: 'Kecleon蛋不再是每天一顆。當天第一顆 ₽ 10,000，之後每顆是前一顆的兩倍（₽ 20,000、40,000、80,000、160,000 與 320,000），每天最多 6 顆；巴西利亞時間午夜時，價格會回到 ₽ 10,000。卡片會顯示你今天買了幾顆，以及下一顆的價格。它需要 4,000 步孵化，重複的會變成 ₽ 2,500。',
          },
          {
            pt: 'Com a incubadora cheia, o Kecleon não vende: choque um ovo para abrir espaço e comprar o próximo, sem ver um ovo caro virar só ₽ 2.500.',
            en: "With the incubator full, Kecleon won't sell: hatch an egg to make room for the next one, instead of watching a pricey egg turn into just ₽ 2,500.",
            es: 'Con la incubadora llena, Kecleon no vende: eclosiona un huevo para hacer espacio y comprar el siguiente, sin ver un huevo caro convertirse en solo ₽ 2.500.', fr: 'Avec l’incubateur plein, Kecleon refuse de vendre : fais éclore un œuf pour faire de la place au suivant, plutôt que de voir un œuf hors de prix se transformer en simples ₽ 2 500.', zh: '孵化器滿了的時候，Kecleon 不會賣蛋給你：先孵化一顆蛋騰出空間再買下一顆，免得昂貴的蛋只變成 ₽ 2,500。',
          },
        ],
      },
      {
        title: { pt: 'Incubadora', en: 'Incubator', es: 'Incubadora', fr: 'Incubateur', zh: '孵化器' },
        notes: [
          {
            pt: 'A nova aba da loja vende mais vagas para a incubadora, suas para sempre: a 4ª por ₽ 150 mil (a partir da Tenda) e a 5ª por ₽ 500 mil (a partir do Kecleon Mart). E a Incubadora Rápida (₽ 8 mil): toque num ovo na incubadora para usar, e ele anda o dobro até chocar.',
            en: 'The shop\'s new tab sells more incubator slots, yours for good: the 4th for ₽150k (from the Tent) and the 5th for ₽500k (from the Kecleon Mart). And the Quick Incubator (₽8k): tap an egg in the incubator to use it, and that egg walks twice as fast until it hatches.',
            es: 'La nueva pestaña de la tienda vende más espacios para la incubadora, tuyos para siempre: el 4.º por ₽ 150 mil (desde la Tienda de campaña) y el 5.º por ₽ 500 mil (desde el Kecleon Mart). Y la Incubadora Rápida (₽ 8 mil): toca un huevo en la incubadora para usarla, y ese huevo avanza el doble hasta eclosionar.', fr: 'Le nouvel onglet de la boutique vend des emplacements d’incubateur en plus, à toi pour de bon : le 4e pour ₽150k (dès la Tente) et le 5e pour ₽500k (dès le Kecleon Mart). Et l’Incubateur rapide (₽8k) : touche un œuf dans l’incubateur pour l’utiliser, et cet œuf marche deux fois plus vite jusqu’à son éclosion.', zh: '商店的新分頁販售更多孵化器欄位，永遠屬於你：第 4 欄 ₽150k（從帳篷等級起），第 5 欄 ₽500k（從 Kecleon超市等級起）。還有快速孵化器（₽8k）：在孵化器中點一下蛋即可使用，該顆蛋的步數會以兩倍速累積，直到孵化。',
          },
        ],
      },
      {
        title: { pt: 'Economia', en: 'Economy', es: 'Economía', fr: 'Économie', zh: '經濟' },
        notes: [
          {
            pt: 'As partidas pagam menos ₽ agora que a Loja do Kecleon tem onde gastar: os inimigos soltam metade das moedas, chefes, Alfas, shinies e lendários das fendas incluídos, e os baús e o Meowth fujão pagam metade.',
            en: 'Runs pay fewer ₽ now that the Kecleon Shop has somewhere to spend them: foes drop half the coins, bosses, Alphas, shinies and rift legendaries included, and chests and the fleeing Meowth pay half.',
            es: 'Las partidas pagan menos ₽ ahora que la Tienda Kecleon tiene en qué gastarlos: los enemigos sueltan la mitad de las monedas, jefes, Alfas, shinies y legendarios de las grietas incluidos, y los cofres y el Meowth que huye pagan la mitad.', fr: 'Les parties rapportent moins de ₽ maintenant que la Boutique de Kecleon a de quoi les dépenser : les ennemis lâchent moitié moins de pièces, boss, Alphas, chromatiques et légendaires de faille compris, et les coffres et le Meowth en fuite paient moitié moins.', zh: '既然 Kecleon商店有地方花錢了，對局給的 ₽ 變少了：敵人掉落的硬幣減半，包括首領、頭目、異色寶可夢與裂縫傳說寶可夢，寶箱與逃跑的 Meowth 給的也減半。',
          },
          {
            pt: 'No modo infinito, os inimigos comuns soltam moedas com metade da frequência de novo, cada minuto depois de 15:00 paga ₽60 no bônus (eram ₽90), e cada Arceus derrotado paga ₽2.500 no bônus (eram ₽5.000) e solta metade dos sacos de ₽.',
            en: 'In endless mode, regular foes drop coins half as often again, every minute past 15:00 pays ₽60 in the bonus (it was ₽90), and every defeated Arceus pays ₽2,500 in the bonus (it was ₽5,000) and drops half the bags of ₽.',
            es: 'En el modo infinito, los enemigos comunes sueltan monedas con la mitad de frecuencia otra vez, cada minuto después de las 15:00 paga ₽60 en la bonificación (eran ₽90), y cada Arceus derrotado paga ₽2.500 en la bonificación (eran ₽5.000) y suelta la mitad de las bolsas de ₽.', fr: 'En mode sans fin, les ennemis normaux lâchent encore deux fois moins souvent des pièces, chaque minute au-delà de 15:00 rapporte ₽60 au bonus (au lieu de ₽90), et chaque Arceus vaincu rapporte ₽2 500 au bonus (au lieu de ₽5 000) et lâche moitié moins de sacs de ₽.', zh: '在無盡模式中，一般敵人掉落硬幣的頻率再減半，超過 15:00 後每分鐘在獎金中給 ₽60（原本是 ₽90），每擊敗一次 Arceus 在獎金中給 ₽2,500（原本是 ₽5,000），掉落的 ₽ 袋也減半。',
          },
        ],
      },
      {
        title: { pt: 'Proteções', en: 'Protections', es: 'Protecciones', fr: 'Protections', zh: '防護' },
        notes: [
          {
            pt: 'Proteções de golpes diferentes não se emendam mais, como um Protect usado duas vezes seguidas nos jogos. Enquanto Protect, Fly, Dig, Iron Head, Burning Bulwark ou Needle Arm protegem você, a proteção dos outros falha, e só volta a funcionar 0,75 s depois que essa acaba. Cada golpe sozinho continua igual. Obrigado, Armonich, por avisar da build que deixava o jogador imortal!',
            en: "Protections from different moves no longer chain, like Protect used twice in a row in the main games. While Protect, Fly, Dig, Iron Head, Burning Bulwark or Needle Arm shields you, the others' protection fails, and it only works again 0.75 s after that one ends. Each move on its own works as before. Thanks, Armonich, for reporting the build that made the player immortal!",
            es: 'Las protecciones de movimientos distintos ya no se encadenan, como un Protect usado dos veces seguidas en los juegos. Mientras Protect, Fly, Dig, Iron Head, Burning Bulwark o Needle Arm te protegen, la protección de los demás falla, y solo vuelve a funcionar 0,75 s después de que esa termina. Cada movimiento por sí solo sigue igual. ¡Gracias, Armonich, por avisar de la build que dejaba al jugador inmortal!', fr: 'Les protections de capacités différentes ne s’enchaînent plus, comme Protect utilisé deux fois de suite dans les jeux principaux. Tant que Protect, Fly, Dig, Iron Head, Burning Bulwark ou Needle Arm te protège, la protection des autres échoue, et elle ne remarche que 0,75 s après la fin de celle-ci. Chaque capacité seule fonctionne comme avant. Merci à Armonich d’avoir signalé le build qui rendait le joueur immortel !', zh: '不同招式的防護不再能連續銜接，就像正傳遊戲中連續使用兩次 Protect 一樣。當 Protect、Fly、Dig、Iron Head、Burning Bulwark 或 Needle Arm 正在保護你時，其他招式的防護會失敗，並在該防護結束 0.75 秒後才會再次生效。每個招式單獨使用時效果不變。感謝 Armonich 回報那個讓玩家無敵的配置！',
          },
        ],
      },
      {
        title: { pt: 'Correções visuais', en: 'Visual fixes', es: 'Correcciones visuales', fr: 'Corrections visuelles', zh: '畫面修正' },
        notes: [
          {
            pt: 'A fenda de Latias e Latios dá o TM lendário de Latias (Mist Ball), e o título agora diz isso: antes ele dizia "TM lendário de Latios" sobre o golpe dela.',
            en: 'The Latias and Latios rift gives Latias\'s legendary TM (Mist Ball), and the title now says so: it used to read "Latios\'s legendary TM" over her move.',
            es: 'La grieta de Latias y Latios da la MT legendaria de Latias (Mist Ball), y el título ahora lo dice: antes decía "MT legendaria de Latios" sobre su movimiento.', fr: 'La faille de Latias et Latios donne la CT légendaire de Latias (Mist Ball), et le titre le dit désormais : il affichait « CT légendaire de Latios » au-dessus de sa capacité à elle.', zh: 'Latias 與 Latios 的裂縫給的是 Latias 的傳說 TM（Mist Ball），現在標題也正確顯示了：之前她的招式上方寫的是「Latios 的傳說 TM」。',
          },
          {
            pt: 'No Modo Lendário, Moltres não fica mais menor que os outros lendários: as asas de fogo largas faziam o jogo encolher demais o sprite. Articuno, Lugia e Kyogre também ficaram um pouco maiores.',
            en: 'In Legend Mode, Moltres is no longer smaller than the other legendaries: its wide flaming wings made the game shrink its sprite too much. Articuno, Lugia and Kyogre got a little bigger too.',
            es: 'En el Modo Legendario, Moltres ya no se ve más pequeño que los otros legendarios: sus anchas alas de fuego hacían que el juego encogiera demasiado su sprite. Articuno, Lugia y Kyogre también quedaron un poco más grandes.', fr: 'En Mode Légendaire, Moltres n’est plus rapetissé par rapport aux autres légendaires : le jeu réduisait trop son sprite à cause de ses larges ailes enflammées. Articuno, Lugia et Kyogre ont aussi un peu grandi.', zh: '在傳說模式中，Moltres 不再比其他傳說寶可夢小：牠寬大的火焰翅膀讓遊戲把圖像縮得太小。Articuno、Lugia 與 Kyogre 也變大了一點。',
          },
          {
            pt: 'Na caverna, as paredes ao sul agora mostram o topo da rocha por cima do chão, onde os pés do Pokémon param: bater numa parede de baixo parece encostar nela, sem precisar se guiar pela sombra.',
            en: 'In the cave, the south walls now show the top of the rock over the floor, right where your Pokémon\'s feet stop: walking into a wall below you looks like touching it, no need to go by the shadow.',
            es: 'En la cueva, las paredes del sur ahora muestran la parte de arriba de la roca sobre el suelo, justo donde se detienen los pies del Pokémon: chocar con una pared de abajo se ve como tocarla, sin tener que guiarse por la sombra.', fr: 'Dans la grotte, les murs sud montrent maintenant le haut de la roche au-dessus du sol, pile là où s’arrêtent les pieds de ton Pokémon : marcher contre un mur en dessous de toi donne l’impression de le toucher, plus besoin de te fier à l’ombre.', zh: '在洞窟裡，南側的牆壁現在會在地面上方顯示岩石頂端，正好在你的寶可夢腳步停下的地方：往下方走進牆壁時看起來就像碰到牆，不必再靠影子判斷。',
          },
          {
            pt: 'Mega Sceptile ganhou o sprite próprio. As Megas sem sprite no PMD SpriteCollab (como Mega Venusaur, Blastoise e Garchomp) seguem com o sprite normal e o contorno de arco-íris até os artistas publicarem os delas.',
            en: 'Mega Sceptile got its own sprite. Megas with no sprite on PMD SpriteCollab yet (like Mega Venusaur, Blastoise and Garchomp) keep the regular sprite with the rainbow outline until the artists publish theirs.',
            es: 'Mega Sceptile ganó su propio sprite. Las Megas sin sprite en PMD SpriteCollab (como Mega Venusaur, Blastoise y Garchomp) siguen con el sprite normal y el contorno de arcoíris hasta que los artistas publiquen los suyos.', fr: 'Méga-Sceptile a son propre sprite. Les Méga qui n’ont pas encore de sprite sur PMD SpriteCollab (comme Méga-Venusaur, Blastoise et Garchomp) gardent le sprite normal avec le contour arc-en-ciel jusqu’à ce que les artistes publient le leur.', zh: '超級 Sceptile 有了專屬圖像。在 PMD SpriteCollab 上還沒有圖像的超級進化（例如超級 Venusaur、超級 Blastoise 與超級 Garchomp）會維持一般圖像加上彩虹外框，直到畫師們發布。',
          },
        ],
      },
      {
        title: { pt: 'Menos travamentos no celular', en: 'Fewer crashes on phones', es: 'Menos cierres en el celular', fr: 'Moins de plantages sur mobile', zh: '手機上更少閃退' },
        notes: [
          {
            pt: 'O começo da partida e a entrada nas fendas lendárias pesam bem menos no celular: o jogo solta os Pokémon do lobby antes de carregar os da partida, carrega as imagens aos poucos em vez de todas de uma vez, e só baixa uma Mega ou a forma de um lendário quando ela está para aparecer (a Mega da Latias, por exemplo, só na fase anterior à dela).',
            en: "The start of a run and stepping into a legendary rift weigh much less on phones: the game lets go of the lobby's Pokémon before loading the run's, loads pictures a few at a time instead of all at once, and only downloads a Mega or a legendary's form when it's about to show up (Latias's Mega, for one, only in the phase before it).",
            es: 'El comienzo de la partida y la entrada a las grietas legendarias pesan mucho menos en el celular: el juego suelta los Pokémon del lobby antes de cargar los de la partida, carga las imágenes de a poco en vez de todas a la vez, y solo descarga una Mega o la forma de un legendario cuando está por aparecer (la Mega de Latias, por ejemplo, solo en la fase anterior a la suya).', fr: 'Le début d’une partie et l’entrée dans une faille légendaire pèsent beaucoup moins sur les téléphones : le jeu libère les Pokémon de l’accueil avant de charger ceux de la partie, charge les images quelques-unes à la fois au lieu de toutes d’un coup, et ne télécharge une Méga ou la forme d’un légendaire que quand elle va apparaître (la Méga de Latias, par exemple, seulement à la phase d’avant).', zh: '在手機上，對局開始與進入傳說裂縫的負擔大幅減輕：遊戲會先釋放大廳的寶可夢，再載入對局的寶可夢；圖片一次只載入幾張，而不是全部一起載入；超級進化或傳說寶可夢的型態只會在快要出現時才下載（例如 Latias 的超級進化，只會在它出現的前一個階段下載）。',
          },
        ],
      },
      {
        title: { pt: 'Fendas lendárias', en: 'Legendary rifts', es: 'Grietas legendarias', fr: 'Failles légendaires', zh: '傳說裂縫' },
        notes: [
          {
            pt: 'Corrigido: Groudon e Rayquaza podiam travar no limite de uma fase para sempre quando ficavam paralisados, congelados ou dormindo sem parar. Agora o golpe final da fase (Precipice Blades, Hyper Beam, Dragon Ascent…) sai mesmo com o lendário sob efeito de status, e a luta segue.',
            en: "Fixed: Groudon and Rayquaza could get stuck at a phase's limit forever while kept paralyzed, frozen or asleep. Now the phase's signature attack (Precipice Blades, Hyper Beam, Dragon Ascent…) goes off even through a status condition, and the fight moves on.",
            es: 'Corregido: Groudon y Rayquaza podían quedarse trabados en el límite de una fase para siempre cuando los mantenían paralizados, congelados o dormidos. Ahora el ataque final de la fase (Precipice Blades, Hyper Beam, Dragon Ascent…) sale aunque el legendario tenga un estado, y la pelea sigue.', fr: 'Corrigé : Groudon et Rayquaza pouvaient rester bloqués pour toujours à la limite d’une phase s’ils étaient maintenus paralysés, gelés ou endormis. Désormais, l’attaque signature de la phase (Precipice Blades, Hyper Beam, Dragon Ascent…) part même à travers une altération de statut, et le combat avance.', zh: '修正：Groudon 與 Rayquaza 在持續被麻痺、冰凍或睡眠時，可能會永遠卡在階段的界限上。現在該階段的招牌攻擊（Precipice Blades、Hyper Beam、Dragon Ascent…）即使處於異常狀態也會發動，戰鬥會繼續進行。',
          },
          {
            pt: 'Quando você leva um deles até o limite da fase, ele solta o golpe final na hora, em vez de seguir lutando com a vida parada no limite (ou zerada, na última fase).',
            en: "When you bring one of them down to a phase's limit, it unleashes its signature attack right away, instead of fighting on with its HP stuck at the limit (or at zero, in the last phase).",
            es: 'Cuando llevas a uno de ellos hasta el límite de la fase, suelta el ataque final al instante, en vez de seguir peleando con la vida detenida en el límite (o en cero, en la última fase).', fr: 'Quand tu en amènes un à la limite d’une phase, il déchaîne aussitôt son attaque signature, au lieu de continuer à se battre avec ses PV bloqués à la limite (ou à zéro, dans la dernière phase).', zh: '當你把牠們之中的任一隻打到階段界限時，牠會立刻放出招牌攻擊，而不是 HP 卡在界限上（或最後階段卡在零）繼續戰鬥。',
          },
          {
            pt: 'Corrigido: um lendário derrotado no meio de um mergulho ou de uma passada para fora da arena (como o Rayquaza) era capturado longe e deixava a recompensa fora do alcance. Agora ele cai no seu lugar na arena.',
            en: 'Fixed: a legendary defeated mid-dive or while out on a pass off the arena (like Rayquaza) was captured far away and left its loot out of reach. Now it falls back at its spot in the arena.',
            es: 'Corregido: un legendario derrotado en medio de una zambullida o de una pasada fuera de la arena (como Rayquaza) era capturado lejos y dejaba la recompensa fuera de alcance. Ahora cae en su lugar en la arena.', fr: 'Corrigé : un légendaire vaincu en plein piqué ou pendant un passage hors de l’arène (comme Rayquaza) était capturé au loin et laissait son butin hors de portée. Désormais, il retombe à sa place dans l’arène.', zh: '修正：在俯衝途中或飛出競技場外（例如 Rayquaza）時被擊敗的傳說寶可夢，會在遠處被收服，戰利品也落在拿不到的地方。現在牠會落回競技場中的位置。',
          },
        ],
      },
      {
        title: { pt: 'Golpes que travavam ou sumiam', en: 'Moves that got stuck or vanished', es: 'Movimientos que se trababan o desaparecían', fr: 'Capacités bloquées ou invisibles', zh: '卡住或消失的招式' },
        notes: [
          {
            pt: 'Corrigido: um golpe gasto num golpe duplo e aprendido de novo por uma TM (como o Aurora Beam do Suicune depois do Freeze-Dry) ficava preso no Nv. 1, e os níveis só davam Oran Berry. Agora ele sobe de nível como qualquer outro.',
            en: "Fixed: a move spent on a duo move and learned again from a TM (like Suicune's Aurora Beam after Freeze-Dry) got stuck at Lv 1, and level-ups only gave Oran Berries. Now it levels up like any other.",
            es: 'Corregido: un movimiento gastado en un movimiento dúo y aprendido de nuevo con una MT (como el Aurora Beam de Suicune después de Freeze-Dry) se quedaba trabado en el Nv. 1, y los niveles solo daban Oran Berry. Ahora sube de nivel como cualquier otro.', fr: 'Corrigé : une capacité utilisée pour une capacité duo puis réapprise par une CT (comme l’Aurora Beam de Suicune après Freeze-Dry) restait bloquée au Nv 1, et les montées de niveau ne donnaient que des Oran Berries. Désormais, elle monte de niveau comme les autres.', zh: '修正：用來合成合體招式、之後又從 TM 重新學會的招式（例如 Suicune 在 Freeze-Dry 之後的 Aurora Beam）會卡在 Lv 1，升級時只會給 Oran Berry。現在它會像其他招式一樣升級。',
          },
          {
            pt: 'Corrigido: o Drill Peck do Piplup no ramo que persegue os inimigos (Nv. 4), o Mud Shot no ramo bumerangue e o Psybeam no ramo que gira em volta de você (Nv. 7) continuavam acertando, mas ficavam invisíveis. Agora aparecem.',
            en: "Fixed: Piplup's Drill Peck on its foe-seeking branch (Lv 4), Mud Shot on its boomerang branch and Psybeam on its ring branch (Lv 7) still hit, but were invisible. Now they show.",
            es: 'Corregido: el Drill Peck de Piplup en la rama que persigue a los enemigos (Nv. 4), el Mud Shot en la rama bumerán y el Psybeam en la rama que gira a tu alrededor (Nv. 7) seguían golpeando, pero eran invisibles. Ahora se ven.', fr: 'Corrigé : le Drill Peck de Piplup sur son embranchement à tête chercheuse (Nv 4), Mud Shot sur son embranchement boomerang et Psybeam sur son embranchement en anneau (Nv 7) touchaient toujours, mais étaient invisibles. Désormais, ils s’affichent.', zh: '修正：Piplup 的 Drill Peck 在追蹤敵人的分支（Lv 4）、Mud Shot 在迴力鏢分支，以及 Psybeam 在環狀分支（Lv 7）時仍會命中，但看不見。現在會正常顯示。',
          },
        ],
      },
      {
        title: { pt: 'Controles e portais', en: 'Controls and portals', es: 'Controles y portales', fr: 'Commandes et portails', zh: '操作與傳送門' },
        notes: [
          {
            pt: 'Corrigido: a partida recomeçava sozinha quando você apertava Espaço logo depois de desmaiar, sem mostrar o resultado. Espaço é o especial e não escolhe mais nada na tela de resultado: use Enter, o toque ou o A do controle.',
            en: 'Fixed: the run restarted on its own when you pressed Space right after fainting, without showing the results. Space is the special and no longer picks anything on the results screen: use Enter, a tap or the controller\'s A.',
            es: 'Corregido: la partida volvía a empezar sola cuando apretabas Espacio justo después de desmayarte, sin mostrar el resultado. Espacio es el especial y ya no elige nada en la pantalla de resultado: usa Enter, el toque o la A del control.', fr: 'Corrigé : la partie redémarrait toute seule quand tu appuyais sur Espace juste après avoir été K.O., sans afficher les résultats. Espace est l’attaque spéciale et ne choisit plus rien sur l’écran des résultats : utilise Entrée, un toucher ou le A de la manette.', zh: '修正：倒下後立刻按空白鍵，對局會在沒有顯示結果的情況下自行重新開始。空白鍵是必殺技，在結果畫面上不再選取任何東西：請使用 Enter、點擊或手把的 A。',
          },
          {
            pt: 'Corrigido: um controle conectado com o analógico fora do centro (ou um volante, um pedal) fazia o Pokémon andar sozinho e travava o teclado. Agora o teclado sempre manda, e um analógico só conta depois de passar pelo centro.',
            en: "Fixed: a connected controller with its stick off center (or a wheel, a pedal) made the Pokémon walk on its own and locked out the keyboard. The keyboard now always wins, and a stick only counts once it has been centered.",
            es: 'Corregido: un control conectado con el stick fuera del centro (o un volante, un pedal) hacía que el Pokémon caminara solo y bloqueaba el teclado. Ahora el teclado siempre manda, y un stick solo cuenta después de pasar por el centro.', fr: 'Corrigé : une manette branchée avec son stick décentré (ou un volant, un pédalier) faisait marcher le Pokémon tout seul et bloquait le clavier. Le clavier a désormais toujours la priorité, et un stick ne compte qu’une fois recentré.', zh: '修正：連接的手把如果搖桿沒有置中（或是方向盤、踏板），會讓寶可夢自己走動並鎖住鍵盤。現在鍵盤永遠優先，搖桿只有在置中過一次之後才會生效。',
          },
          {
            pt: 'Portais das fendas e entradas dos lugares: sair de dentro esvazia a carga bem mais devagar, então golpes que te tiram do lugar sozinhos, como o Aqua Step, não impedem mais de entrar.',
            en: 'Rift portals and place entrances: stepping out drains the charge much more slowly, so moves that hop you around on their own, like Aqua Step, no longer keep you from getting in.',
            es: 'Portales de las grietas y entradas de los lugares: salir de adentro vacía la carga mucho más despacio, así que los movimientos que te sacan del lugar solos, como Aqua Step, ya no impiden entrar.', fr: 'Portails des failles et entrées des lieux : en sortir vide la jauge beaucoup plus lentement, donc les capacités qui te font bondir toutes seules, comme Aqua Step, ne t’empêchent plus d’entrer.', zh: '裂縫傳送門與地點入口：走出範圍時充能流失的速度慢了很多，所以像 Aqua Step 這種會讓你自己跳來跳去的招式，不會再妨礙你進入。',
          },
        ],
      },
      {
        title: { pt: 'Ninguém mais fica preso no cenário', en: 'No more getting stuck in the scenery', es: 'Nadie más queda atrapado en el escenario', fr: 'Plus personne coincé dans le décor', zh: '不會再卡在場景裡' },
        notes: [
          {
            pt: 'Corrigido: Pokémon grandes, como Salamence, Milotic, Hydreigon, Dragapult e Altaria, não passavam pelos corredores dos labirintos, pela porta da casa abandonada nem por trechos da caverna do Groudon. Agora todo Pokémon passa por todos os caminhos (o tamanho para levar dano continua o mesmo).',
            en: "Fixed: big Pokémon like Salamence, Milotic, Hydreigon, Dragapult and Altaria couldn't fit through maze corridors, the abandoned cottage's door or parts of Groudon's cave. Now every Pokémon fits every path (the size that takes hits stays the same).",
            es: 'Corregido: los Pokémon grandes como Salamence, Milotic, Hydreigon, Dragapult y Altaria no pasaban por los pasillos de los laberintos, la puerta de la casa abandonada ni partes de la cueva de Groudon. Ahora todo Pokémon pasa por todos los caminos (el tamaño para recibir daño sigue igual).', fr: 'Corrigé : les grands Pokémon comme Salamence, Milotic, Hydreigon, Dragapult et Altaria ne passaient pas dans les couloirs des labyrinthes, par la porte de la maisonnette abandonnée ou dans certaines parties de la grotte de Groudon. Désormais, chaque Pokémon passe partout (la taille qui encaisse les coups reste la même).', zh: '修正：Salamence、Milotic、Hydreigon、Dragapult 與 Altaria 等大型寶可夢無法通過迷宮的走道、廢棄小屋的門，或 Groudon 洞窟的部分區域。現在每隻寶可夢都能通過每條路（受擊判定的大小維持不變）。',
          },
          {
            pt: 'Corrigido: evoluir dentro da casa, ou ser empurrado entre a barraca, a fogueira e a mochila do acampamento, entre cristais da caverna ou contra as paredes de uma fenda, podia te deixar preso sem conseguir andar. Agora quem fica entalado sai para o lugar livre mais perto.',
            en: 'Fixed: evolving inside the cottage, or getting pushed between the camp\'s tent, campfire and backpack, between cave crystals or against a rift\'s walls, could leave you stuck and unable to move. Now anyone wedged in steps out to the nearest open spot.',
            es: 'Corregido: evolucionar dentro de la casa, o ser empujado entre la carpa, la fogata y la mochila del campamento, entre cristales de la cueva o contra las paredes de una grieta, podía dejarte atrapado sin poder moverte. Ahora quien queda atascado sale al lugar libre más cercano.', fr: 'Corrigé : évoluer dans la maisonnette, ou se faire pousser entre la tente, le feu de camp et le sac à dos du campement, entre les cristaux de la grotte ou contre les murs d’une faille, pouvait te laisser coincé sans pouvoir bouger. Désormais, quiconque est coincé est replacé à l’endroit libre le plus proche.', zh: '修正：在小屋裡進化，或被擠在營地的帳篷、營火與背包之間、洞窟水晶之間，或裂縫的牆邊時，可能會卡住無法移動。現在被卡住的寶可夢會移到最近的空地。',
          },
        ],
      },
    ],
  },
  {
    date: '2026-10-21',
    title: { pt: 'Noite das Bruxas e lendários jogáveis', en: 'Halloween Night and playable legendaries', es: 'Noche de Brujas y legendarios jugables' },
    highlights: [
      { pt: 'Modo Lendário: vença os 23 lendários como chefes, no mapa ou nas novas fendas épicas, para capturá-los e jogar com eles, com ranking próprio.', en: 'Legend Mode: beat all 23 legendaries as bosses, on the map or in the new epic rifts, to catch them and play as them, with their own ranking.', es: 'Modo Legendario: vence a los 23 legendarios como jefes, en el mapa o en las nuevas grietas épicas, para capturarlos y jugar con ellos, con su propio ranking.' },
      { pt: 'Noite das Bruxas de 24/10 a 2/11: partidas assombradas, à noite, com um surto de fantasma por dia, abóboras pelo mapa e 12 chefes da noite no lugar do Onix e do Snorlax. Os doces enchem um pote de prêmios.', en: 'Halloween Night from Oct 24 to Nov 2: haunted runs, at night, with a ghost outbreak every day, jack-o\'-lanterns all over the map and 12 night bosses in Onix\'s and Snorlax\'s places. Candies fill a jar of prizes.', es: 'Noche de Brujas del 24/10 al 2/11: partidas embrujadas, de noche, con un brote de fantasma por día, calabazas por el mapa y 12 jefes de la noche en el lugar de Onix y Snorlax. Los dulces llenan un frasco de premios.' },
      { pt: 'Dois ovos que só a praça vende, um por dia, cada um com 4 famílias que nenhum outro ovo traz: o Ovo Assombrado do Duskull, na Noite das Bruxas (Litwick, Phantump, Drifloon e Sandygast), e o Ovo do Kecleon, sempre na Vitrine (Porygon, Exeggcute, Scraggy e o Smeargle, que copia golpes com o Sketch).', en: 'Two eggs only the plaza sells, one a day, each with 4 families no other egg brings: Duskull\'s Haunted Egg, on Halloween Night (Litwick, Phantump, Drifloon and Sandygast), and the Kecleon Egg, always in the Showcase (Porygon, Exeggcute, Scraggy and Smeargle, which copies moves with Sketch).', es: 'Dos huevos que solo vende la plaza, uno por día, cada uno con 4 familias que ningún otro huevo trae: el Huevo Embrujado de Duskull, en la Noche de Brujas (Litwick, Phantump, Drifloon y Sandygast), y el Huevo Kecleon, siempre en la Vitrina (Porygon, Exeggcute, Scraggy y Smeargle, que copia movimientos con Sketch).' },
      { pt: 'Loja do Kecleon: vá até a praça, pegue o brinde grátis do dia, leve consumíveis na Mochila, compre TMs (10 exclusivas, do Pay Day ao Fly, com Rain Dance e Sunny Day mudando o clima), itens de evolução (sem a Dawn Stone, nada de Gallade) e Tampinhas, e invista para a loja crescer em 5 níveis. Nos fins de semana, a caravana do Meowth; todo dia, um carimbo no cartão fidelidade.', en: 'Kecleon Shop: walk to the plaza, take the free daily gift, pack consumables in your Bag, buy TMs (10 exclusives, from Pay Day to Fly, with Rain Dance and Sunny Day changing the weather), evolution items (no Dawn Stone, no Gallade) and Bottle Caps, and invest to grow the shop through 5 levels. On weekends, Meowth\'s caravan; every day, a stamp on your loyalty card.', es: 'Tienda Kecleon: ve hasta la plaza, toma el regalo gratis del día, lleva consumibles en la Mochila, compra MTs (10 exclusivas, de Pay Day a Fly, con Rain Dance y Sunny Day cambiando el clima), objetos evolutivos (sin Dawn Stone, no hay Gallade) y Chapas, e invierte para que la tienda crezca en 5 niveles. Los fines de semana, la caravana de Meowth; cada día, un sello en tu tarjeta de cliente.' },
      { pt: 'Apoiadores até 2/11 trocam o coração por uma abóbora, para sempre, e ganham o Pumpkaboo como companheiro (shiny no Ouro).', en: 'Supporters by Nov 2 swap their heart for a jack-o\'-lantern, forever, and get Pumpkaboo as a companion (shiny for Gold).', es: 'Quien apoye hasta el 2/11 cambia el corazón por una calabaza, para siempre, y gana a Pumpkaboo como compañero (shiny en Oro).' },
    ],
    changes: [
      {
        title: { pt: 'Cenário e ícones novos', en: 'New scenery and icons', es: 'Escenario e íconos nuevos' },
        notes: [
          {
            pt: 'Os itens agora usam os ícones oficiais dos jogos: a Choice Scarf é azul, o Leftovers é a maçã mordida, a Muscle Band é dourada. Vale para itens, vitaminas do Poké Mart, consumíveis, a Bolsa e a Loja do Kecleon: Mochila, pedras e itens de evolução, Bottle Caps e as TMs, cada uma na cor do seu tipo.',
            en: 'Items now use the official icons from the games: the Choice Scarf is blue, Leftovers is the bitten apple, the Muscle Band is golden. That goes for held items, Poké Mart vitamins, consumables, the Bag and the Kecleon Shop: Bag items, stones and evolution items, Bottle Caps and TMs, each in its type\'s color.',
            es: 'Los objetos ahora usan los íconos oficiales de los juegos: la Choice Scarf es azul, Leftovers es la manzana mordida, la Muscle Band es dorada. Vale para objetos, vitaminas del Poké Mart, consumibles, la Mochila y la Tienda Kecleon: objetos de la Mochila, piedras y objetos de evolución, Bottle Caps y las MTs, cada una del color de su tipo.',
          },
          {
            pt: 'O mapa ganhou arte nova: torres maiores em cada bioma (o pagode do prado, a árvore oca da floresta, a espiral de cristal da caverna, a torre de gelo e a torre assombrada), árvores, pedras e arbustos, barracas, menires e altares das ruínas, lápides, a Odd Keystone e as pedras do vento do céu.',
            en: 'The map got new art: bigger towers in every biome (the meadow pagoda, the forest\'s hollow tree, the cave\'s crystal spire, the ice tower and the haunted tower), trees, rocks and bushes, tents, the ruins\' menhirs and altars, tombstones, the Odd Keystone and the sky\'s wind stones.',
            es: 'El mapa tiene arte nuevo: torres más grandes en cada bioma (la pagoda de la pradera, el árbol hueco del bosque, la espiral de cristal de la cueva, la torre de hielo y la torre embrujada), árboles, rocas y arbustos, tiendas, los menhires y altares de las ruinas, lápidas, la Odd Keystone y las piedras del viento del cielo.',
          },
        ],
      },
      {
        title: { pt: 'Noite das Bruxas', en: 'Halloween Night', es: 'Noche de Brujas' },
        notes: [
          {
            pt: 'De 24 de outubro a 2 de novembro (horário de Brasília), toda partida é assombrada: cai a noite, um fantasma a mais entra em cada fase (do Shedinja ao Gengar) e abóboras iluminadas aparecem entre os itens do mapa. O lobby também se veste para a noite, com abóboras, morcegos e fantasmas passeando.',
            en: 'From October 24 to November 2 (Brasília time), every run is haunted: night falls, an extra ghost joins each stage (from Shedinja to Gengar) and lit jack-o\'-lanterns stand among the breakables. The lobby dresses for the night too, with jack-o\'-lanterns, bats and ghosts wandering around.',
            es: 'Del 24 de octubre al 2 de noviembre (hora de Brasilia), cada partida está embrujada: cae la noche, un fantasma más se une a cada fase (de Shedinja a Gengar) y calabazas iluminadas aparecen entre los objetos del mapa. El lobby también se viste para la noche, con calabazas, murciélagos y fantasmas paseando.',
          },
          {
            pt: 'Surtos assombrados: cada dia do evento tem o seu fantasma (Shuppet, Phantump, Sinistea, Honedge, Dreepy, Cubone…), o Gastly no dia 31, as velas do Litwick no Día de Muertos e o Duskull no Dia de Finados. O Desafio do dia também fica assombrado.',
            en: 'Haunted outbreaks: each event day has its ghost (Shuppet, Phantump, Sinistea, Honedge, Dreepy, Cubone…), Gastly on the 31st, Litwick\'s candles for the Día de Muertos and Duskull for All Souls\' Day. The Daily Challenge gets haunted too.',
            es: 'Brotes embrujados: cada día del evento tiene su fantasma (Shuppet, Phantump, Sinistea, Honedge, Dreepy, Cubone…), Gastly el 31, las velas de Litwick en el Día de Muertos y Duskull en el Día de los Fieles Difuntos. El Desafío del día también se embruja.',
          },
          {
            pt: 'Doces: Pokémon do tipo Fantasma deixam cair doces, chefes e Alfas sempre trazem 10, e as abóboras são doces ou travessuras (às vezes uma roda de fantasmas aparece em volta de você). Os doces enchem um pote que dá prêmios no Presente do lobby: a moldura Abóbora só por participar, o fundo Noite das Bruxas, um Ovo Raro, o papel de parede Casa Assombrada, o título Rei das Abóboras e um Gastly shiny.',
            en: 'Candies: Ghost-type Pokémon drop candies, bosses and Alphas always bring 10, and jack-o\'-lanterns are trick or treat (sometimes a ring of ghosts shows up around you). Candies fill a jar that pays prizes in the lobby\'s Gift box: the Pumpkin frame just for joining in, the Halloween Night background, a Rare Egg, the Haunted House wallpaper, the Pumpkin King title and a shiny Gastly.',
            es: 'Dulces: los Pokémon de tipo Fantasma sueltan dulces, los jefes y los Alfas siempre traen 10, y las calabazas son dulce o truco (a veces aparece una ronda de fantasmas a tu alrededor). Los dulces llenan un frasco que da premios en el Regalo del lobby: el marco Calabaza solo por participar, el fondo Noche de Brujas, un Huevo Raro, el fondo de pantalla Casa Embrujada, el título Rey Calabaza y un Gastly shiny.',
          },
          {
            pt: 'Apoiadores da Noite das Bruxas: quem já apoia o jogo ou apoiar até 2 de novembro troca o coração por uma abóbora com um coração entalhado (dourada no Ouro), no ranking, no perfil e no Hall da Fama. Ela fica para sempre, e durante o evento a linha deles no ranking brilha como uma vela. E quem entrar no jogo como apoiador durante o evento ganha o Pumpkaboo, um companheiro que só apoiadores têm e que deixa um rastro de doces brilhando por onde passa. Apoiadores Ouro podem levá-lo shiny.',
            en: 'Halloween Night supporters: anyone who already supports the game or does by November 2 swaps their heart for a jack-o\'-lantern with a heart carved in (golden for Gold), on the ranking, their profile and the Hall of Fame. It stays forever, and during the event their ranking line glows like a candle. And supporters who play during the event get Pumpkaboo, a companion only supporters have, leaving a trail of sparkling candy wherever it goes. Gold supporters can take it along shiny.',
            es: 'Patrocinadores de la Noche de Brujas: quien ya apoya el juego o lo apoye hasta el 2 de noviembre cambia el corazón por una calabaza con un corazón tallado (dorada en Oro), en el ranking, su perfil y el Salón de la Fama. Se queda para siempre, y durante el evento su línea en el ranking brilla como una vela. Y quien entre al juego como patrocinador durante el evento gana a Pumpkaboo, un compañero que solo tienen los patrocinadores y que deja un rastro de dulces brillantes por donde pasa. Los patrocinadores Oro pueden llevarlo shiny.',
          },
        ],
      },
      {
        title: { pt: 'Ovo Assombrado', en: 'Haunted Egg', es: 'Huevo Embrujado' },
        notes: [
          {
            pt: 'Durante a Noite das Bruxas, a barraca do Duskull na praça vende o Ovo Assombrado por ₽ 6.000, um por dia. Fale com o Duskull (ou abra a aba Barraca da loja) para comprar. Ele choca em 3.000 passos, com um brilho roxo e fogos-fátuos em volta.',
            en: 'During Halloween Night, Duskull\'s stall at the plaza sells the Haunted Egg for ₽ 6,000, one a day. Talk to Duskull (or open the shop\'s Stall tab) to buy it. It hatches in 3,000 steps, in a violet glow with will-o\'-wisps around it.',
            es: 'Durante la Noche de Brujas, el puesto de Duskull en la plaza vende el Huevo Embrujado por ₽ 6.000, uno por día. Habla con Duskull (o abre la pestaña Puesto de la tienda) para comprarlo. Eclosiona en 3.000 pasos, con un brillo violeta y fuegos fatuos alrededor.',
          },
          {
            pt: 'Dele saem 4 famílias novas, com a mesma chance cada (25%), que nenhum outro ovo ou desafio traz: Litwick (até Chandelure), Phantump (Trevenant), Drifloon (Drifblim) e Sandygast (Palossand). O shiny sai na chance de sempre, e um repetido vira ₽ 1.500. Depois do evento o ovo some, e só volta no ano que vem.',
            en: 'Out come 4 new families, each as likely (25%), that no other egg or challenge brings: Litwick (up to Chandelure), Phantump (Trevenant), Drifloon (Drifblim) and Sandygast (Palossand). Shinies come at the usual odds, and a duplicate turns into ₽ 1,500. After the event the egg is gone until next year.',
            es: 'De él salen 4 familias nuevas, con la misma probabilidad cada una (25%), que ningún otro huevo o desafío trae: Litwick (hasta Chandelure), Phantump (Trevenant), Drifloon (Drifblim) y Sandygast (Palossand). El shiny sale con la probabilidad de siempre, y uno repetido se convierte en ₽ 1.500. Después del evento el huevo desaparece hasta el año que viene.',
          },
        ],
      },
      {
        title: { pt: 'Ovo do Kecleon', en: 'Kecleon Egg', es: 'Huevo Kecleon' },
        notes: [
          {
            pt: 'A Vitrine do dia ganhou um card fixo, fora do sorteio: o Ovo do Kecleon, por ₽ 10.000, um por dia em qualquer nível da loja. Ele choca em 4.000 passos, e um repetido vira ₽ 2.500.',
            en: "Today's Showcase has a fixed card, outside the draw: the Kecleon Egg, for ₽ 10,000, one a day at any shop level. It hatches in 4,000 steps, and a duplicate turns into ₽ 2,500.",
            es: 'La Vitrina del día tiene una carta fija, fuera del sorteo: el Huevo Kecleon, por ₽ 10.000, uno por día en cualquier nivel de la tienda. Eclosiona en 4.000 pasos, y uno repetido se convierte en ₽ 2.500.',
          },
          {
            pt: 'Dele saem 4 famílias novas, 25% cada, que nenhum outro ovo ou desafio traz: Porygon (Porygon2 pede o Up-Grade e Porygon-Z o Dubious Disc), Exeggcute (o Exeggutor pede a Leaf Stone, a mesma do Leafeon), Scraggy (Scrafty no Nv 20) e Smeargle, que não evolui: o rabo-pincel copia o golpe do inimigo mais perto (o de um chefe, mais forte) e usa ele 3 vezes antes de pintar outro. O Up-Grade e o Dubious Disc estão na prateleira de Evolução e também caem de chefes.',
            en: "Out come 4 new families, 25% each, that no other egg or challenge brings: Porygon (Porygon2 needs the Up-Grade and Porygon-Z the Dubious Disc), Exeggcute (Exeggutor needs the Leaf Stone, Leafeon's too), Scraggy (Scrafty at Lv 20) and Smeargle, which never evolves: its brush tail copies the nearest foe's move (a boss's, stronger) and casts it 3 times before painting another. The Up-Grade and the Dubious Disc are on the Evolution shelf and drop from bosses too.",
            es: 'De él salen 4 familias nuevas, 25% cada una, que ningún otro huevo o desafío trae: Porygon (Porygon2 pide el Up-Grade y Porygon-Z el Dubious Disc), Exeggcute (Exeggutor pide la Leaf Stone, la misma de Leafeon), Scraggy (Scrafty en Nv 20) y Smeargle, que no evoluciona: su cola-pincel copia el movimiento del enemigo más cercano (el de un jefe, más fuerte) y lo usa 3 veces antes de pintar otro. El Up-Grade y el Dubious Disc están en el estante de Evolución y también caen de los jefes.',
          },
          {
            pt: 'E o segredo dos 100 carimbos do cartão fidelidade é um Ovo do Kecleon com shiny garantido.',
            en: "And the loyalty card's 100-stamp secret is a Kecleon Egg sure to hatch shiny.",
            es: 'Y el secreto de los 100 sellos de la tarjeta de cliente es un Huevo Kecleon con shiny garantizado.',
          },
        ],
      },
      {
        title: { pt: 'Chefes da noite e Caça aos Fantasmas', en: 'Night bosses and the Ghost Hunt', es: 'Jefes de la noche y Cacería de Fantasmas' },
        notes: [
          {
            pt: 'Nas partidas assombradas, o Onix (2:30) e o Snorlax (5:00) dão lugar a chefes da noite, sorteados a cada partida, cada um com seus próprios golpes: Mimikyu (a Disguise aguenta o primeiro golpe forte), Banette, Sableye, Drifblim, Mismagius e Houndoom às 2:30; Gengar (some e reaparece em cima de você), Chandelure (paredes de fogo), Gourgeist, Trevenant (raízes que te puxam), Honchkrow (chama os Murkrow) e Dusknoir às 5:00. Eles batem como o chefe que substituem. Os lendários continuam onde estavam.',
            en: 'In haunted runs, Onix (2:30) and Snorlax (5:00) give way to night bosses, drawn each run, each with its own moves: Mimikyu (its Disguise takes the first big hit), Banette, Sableye, Drifblim, Mismagius and Houndoom at 2:30; Gengar (it fades and comes back on top of you), Chandelure (walls of fire), Gourgeist, Trevenant (roots that drag you in), Honchkrow (it calls its Murkrow) and Dusknoir at 5:00. They hit as hard as the boss they stand in for. The legendaries keep their slots.',
            es: 'En las partidas embrujadas, Onix (2:30) y Snorlax (5:00) dejan su lugar a jefes de la noche, sorteados en cada partida, cada uno con sus propios golpes: Mimikyu (su Disguise aguanta el primer golpe fuerte), Banette, Sableye, Drifblim, Mismagius y Houndoom a las 2:30; Gengar (se desvanece y reaparece encima de ti), Chandelure (muros de fuego), Gourgeist, Trevenant (raíces que te arrastran), Honchkrow (llama a sus Murkrow) y Dusknoir a las 5:00. Pegan como el jefe que reemplazan. Los legendarios siguen en su lugar.',
          },
          {
            pt: 'Caça aos Fantasmas: a tela da Noite das Bruxas mostra os 12 como sombras até você vencê-los. A primeira vitória sobre cada um rende 25 doces no pote, e vencer todos dá o título Exorcista e a moldura Espectral no Presente.',
            en: 'Ghost Hunt: the Halloween Night screen shows all 12 as shadows until you beat them. The first win over each one puts 25 candies in the jar, and beating them all brings the Exorcist title and the Spectral frame to your Gift box.',
            es: 'Cacería de Fantasmas: la pantalla de la Noche de Brujas muestra a los 12 como sombras hasta que los vences. La primera victoria sobre cada uno pone 25 dulces en el frasco, y vencerlos a todos trae el título Exorcista y el marco Espectral a tu Regalo.',
          },
        ],
      },
      {
        title: { pt: 'Ranking', en: 'Ranking', es: 'Ranking' },
        notes: [
          {
            pt: 'Com o jogo aberto desde antes de uma atualização, as partidas eram recusadas pelo ranking sem explicação. Agora o jogo carrega a versão nova antes da próxima partida, e uma partida que atravessou uma atualização diz o motivo de ter ficado fora.',
            en: 'With the game left open from before an update, runs were turned away from the ranking with no reason given. Now the game loads the new version before your next run, and a run that spanned an update tells you why it stayed off.',
            es: 'Con el juego abierto desde antes de una actualización, las partidas quedaban fuera del ranking sin explicación. Ahora el juego carga la versión nueva antes de tu próxima partida, y una partida que atravesó una actualización te dice por qué quedó fuera.',
          },
        ],
      },
      {
        title: { pt: 'Evoluções que pedem item', en: 'Evolutions that need an item', es: 'Evoluciones que piden un objeto' },
        notes: [
          {
            pt: 'Como nos jogos oficiais, os caminhos que pedem um item agora só abrem com ele: Gallade e Froslass (Dawn Stone), Politoed (King\'s Rock), Scizor (Metal Coat), Kleavor (Black Augurite), Armarouge e Ceruledge (as armaduras), e Espeon, Umbreon, Leafeon, Glaceon e Sylveon (as pedras). Gardevoir, Glalie e Poliwrath continuam livres: sem o item, a evolução vai direto para eles. Do Ovo do Kecleon, Porygon2 (Up-Grade), Porygon-Z (Dubious Disc) e Exeggutor (Leaf Stone) também pedem o seu.',
            en: "As in the official games, the paths that need an item now only open with it: Gallade and Froslass (Dawn Stone), Politoed (King's Rock), Scizor (Metal Coat), Kleavor (Black Augurite), Armarouge and Ceruledge (the armors), and Espeon, Umbreon, Leafeon, Glaceon and Sylveon (the stones). Gardevoir, Glalie and Poliwrath stay free: without the item, the evolution goes straight to them. From the Kecleon Egg, Porygon2 (Up-Grade), Porygon-Z (Dubious Disc) and Exeggutor (Leaf Stone) need theirs too.",
            es: 'Como en los juegos oficiales, los caminos que piden un objeto ahora solo se abren con él: Gallade y Froslass (Dawn Stone), Politoed (King\'s Rock), Scizor (Metal Coat), Kleavor (Black Augurite), Armarouge y Ceruledge (las armaduras), y Espeon, Umbreon, Leafeon, Glaceon y Sylveon (las piedras). Gardevoir, Glalie y Poliwrath siguen libres: sin el objeto, la evolución va directo a ellos. Del Huevo Kecleon, Porygon2 (Up-Grade), Porygon-Z (Dubious Disc) y Exeggutor (Leaf Stone) también piden el suyo.',
          },
          {
            pt: 'O item vale se você comprou na Loja do Kecleon (para sempre) ou achou na partida: enquanto o seu Pokémon tem um caminho fechado pela frente, cada chefe derrotado tem 30% de chance de derrubar um dos itens que faltam, que vale até o fim da partida.',
            en: "The item counts if you bought it at the Kecleon Shop (for good) or found it in the run: while your Pokémon has a closed path ahead, each boss you beat has a 30% chance to drop one of the missing items, which lasts until the run ends.",
            es: 'El objeto vale si lo compraste en la Tienda de Kecleon (para siempre) o lo encontraste en la partida: mientras tu Pokémon tenga un camino cerrado por delante, cada jefe derrotado tiene un 30% de probabilidad de soltar uno de los objetos que faltan, que vale hasta el final de la partida.',
          },
          {
            pt: 'Sem itens, o Eevee evolui em Vaporeon, Jolteon ou Flareon, sorteado (o clima e o lugar puxam um deles), sem escolha; com itens, você escolhe entre o sorteado e cada caminho que os seus itens abrem (a Water, a Thunder e a Fire Stone também colocam o seu na escolha). Scyther e Charcadet sem item não evoluem, mas ficam 15% mais fortes em tudo, como com a Everstone, até um item aparecer: aí evoluem na hora.',
            en: 'Without items, Eevee evolves into Vaporeon, Jolteon or Flareon, drawn at random (the weather and the place pull one in), with no choice; with items, you choose between the drawn one and every path your items open (the Water, Thunder and Fire Stones put theirs in the choice too). Scyther and Charcadet without an item don\'t evolve, but get 15% stronger in everything, as with the Everstone, until an item turns up: then they evolve on the spot.',
            es: 'Sin objetos, Eevee evoluciona en Vaporeon, Jolteon o Flareon, al azar (el clima y el lugar atraen a uno), sin elegir; con objetos, eliges entre el sorteado y cada camino que tus objetos abren (la Water, la Thunder y la Fire Stone también ponen el suyo en la elección). Scyther y Charcadet sin objeto no evolucionan, pero son un 15% más fuertes en todo, como con la Everstone, hasta que aparece un objeto: entonces evolucionan en el acto.',
          },
        ],
      },
      {
        title: { pt: 'Loja do Kecleon', en: 'Kecleon Shop', es: 'Tienda Kecleon' },
        notes: [
          {
            pt: 'A loja agora é um lugar: a praça do Kecleon fica a leste da casa do seu parceiro, no prado do lobby. Aperte Loja (L) e a câmera vai até lá com o parceiro pulando junto, ou vá andando e fale com o Kecleon (E, ou toque nele). Uma plaquinha na borda da tela mostra o caminho.',
            en: 'The shop is a place now: the Kecleon plaza stands east of your partner\'s home, in the lobby\'s meadow. Press Shop (L) and the camera heads there with your partner hopping along, or walk over and talk to Kecleon (E, or tap it). A little sign at the edge of the screen points the way.',
            es: 'La tienda ahora es un lugar: la plaza de Kecleon está al este de la casa de tu compañero, en la pradera del lobby. Pulsa Tienda (L) y la cámara va hasta allá con tu compañero saltando a su lado, o ve caminando y habla con Kecleon (E, o tócalo). Un letrerito en el borde de la pantalla muestra el camino.',
          },
          {
            pt: 'A Vitrine do dia substitui o Balcão: é igual para todo mundo e vira à meia-noite de Brasília. Todo dia tem um brinde grátis, uma oferta com 30% off e cards sorteados entre os consumíveis, o ovo do dia e um estilo. Nenhum item fica mais de 7 dias sem voltar, e a partir da Tenda dá para colocar um item na lista de desejos: o Kecleon avisa em que dia ele volta.',
            en: "Today's Showcase replaces the Counter: it's the same for everyone and turns over at midnight Brasília time. Every day brings a free gift, a deal at 30% off and cards drawn from the consumables, the day's egg and a style. No item stays away for more than 7 days, and from the Tent on you can pin one on your wishlist: Kecleon tells you the day it's back.",
            es: 'La Vitrina del día reemplaza al Mostrador: es igual para todos y cambia a medianoche de Brasilia. Cada día trae un regalo gratis, una oferta con 30% de descuento y cartas sorteadas entre los consumibles, el huevo del día y un estilo. Ningún objeto tarda más de 7 días en volver, y desde la Tienda de campaña puedes poner uno en tu lista de deseos: Kecleon te avisa qué día vuelve.',
          },
          {
            pt: 'A Mochila tem 8 consumíveis: Lure, Incense, Rare Candy (começa no Nv 3), Lucky Egg (+25% de EXP), Luck Incense (+50% de ₽), Honey (o surto aparece em dobro), X Attack (+10% de dano) e Max Revive (levanta uma vez com metade do HP). Leve até 2 diferentes por partida, mais com a loja maior. O ranking mostra os itens que cada partida usou, e o Desafio do dia continua sem nenhum.',
            en: 'The Bag holds 8 consumables: Lure, Incense, Rare Candy (start at Lv 3), Lucky Egg (+25% EXP), Luck Incense (+50% ₽), Honey (the outbreak shows up twice as often), X Attack (+10% damage) and Max Revive (get back up once with half your HP). Pack up to 2 different ones per run, more with a bigger shop. The ranking shows the items each run used, and the Daily Challenge still takes none.',
            es: 'La Mochila tiene 8 consumibles: Lure, Incense, Rare Candy (empiezas en Nv 3), Lucky Egg (+25% de EXP), Luck Incense (+50% de ₽), Honey (el brote aparece el doble), X Attack (+10% de daño) y Max Revive (te levanta una vez con la mitad del HP). Lleva hasta 2 distintos por partida, más con la tienda más grande. El ranking muestra los objetos que usó cada partida, y el Desafío del día sigue sin ninguno.',
          },
          {
            pt: 'Expansão: invista ₽ e a loja cresce na sua praça, de Carrinho a Tenda, Loja, Kecleon Mart e Loja de Departamento (₽ 30 mil, 100 mil, 300 mil e 800 mil). Cada nível troca o prédio, aumenta a Vitrine e a Mochila e enfeita a praça; na Tenda chega o irmão roxo do Kecleon. O Treino (as vitaminas, com reembolso) e o Estilo continuam como estavam.',
            en: 'Expansion: invest ₽ and the shop grows on your plaza, from Cart to Tent, Shop, Kecleon Mart and Department Store (₽30k, 100k, 300k and 800k). Each level swaps the building, widens the Showcase and the Bag and decorates the plaza; the Tent brings Kecleon\'s purple brother. Training (the vitamins, refundable) and Style stay as they were.',
            es: 'Expansión: invierte ₽ y la tienda crece en tu plaza, de Carrito a Tienda de campaña, Tienda, Kecleon Mart y Gran Almacén (₽ 30 mil, 100 mil, 300 mil y 800 mil). Cada nivel cambia el edificio, amplía la Vitrina y la Mochila y decora la plaza; con la Tienda de campaña llega el hermano morado de Kecleon. El Entreno (las vitaminas, con reembolso) y el Estilo siguen como estaban.',
          },
          {
            pt: 'TMs do irmão roxo (a partir da Tenda): compradas uma vez, ficam no seu estojo para sempre. Antes da partida você arma 1 (2 a partir do Kecleon Mart), e a primeira TM que cair de um chefe, ou a primeira aula do Tutor de Golpes, é ela (com duas armadas, a segunda vem logo depois). As TMs que você já aprendeu numa partida ficam sempre na prateleira; as outras rodam, 3 por dia, e voltam em até 7 dias.',
            en: "The purple brother's TMs (from the Tent): buy one once and it stays in your case for good. Before a run you arm 1 (2 from the Kecleon Mart), and the first TM a boss drops, or the Move Tutor's first lesson, is that one (with two armed, the second comes right after). TMs you've learned in a run are always on the shelf; the others rotate, 3 a day, back within 7 days.",
            es: 'MTs del hermano morado (desde la Tienda de campaña): las compras una vez y quedan en tu estuche para siempre. Antes de la partida preparas 1 (2 desde el Kecleon Mart), y la primera MT que suelte un jefe, o la primera clase del Tutor de Movimientos, es esa (con dos preparadas, la segunda viene justo después). Las MTs que ya aprendiste en una partida siempre están en el estante; las demás rotan, 3 por día, y vuelven en 7 días como mucho.',
          },
          {
            pt: '10 TMs novas, só na loja: Pay Day (moedas que soltam ₽ ao acertar), Thief (rouba o item que Alfas e chefes seguram), Protect (uma bolha onde nenhum golpe passa), Hyper Beam (um raio enorme com recarga), Rain Dance e Sunny Day (chamam chuva ou sol por 40s por cima do clima da partida, com gotas e raios caindo nos inimigos), Swords Dance (+8% de dano que acumula), Drain Punch (um soco que cura), Thunder Wave (um cone que paralisa) e Fly (você levanta voo, intocável, e cai com tudo). Todas com garfos no Nv 4 e 7.',
            en: '10 new TMs, only at the shop: Pay Day (coins that knock ₽ loose), Thief (steals the item Alphas and bosses hold), Protect (a bubble no hit gets through), Hyper Beam (a huge beam with a recharge), Rain Dance and Sunny Day (call rain or sun for 40s over the run\'s weather, with drops and beams falling on the foes), Swords Dance (+8% damage that stacks), Drain Punch (a punch that heals), Thunder Wave (a cone that paralyzes) and Fly (take off out of reach and come down hard). All with forks at Lv 4 and 7.',
            es: '10 MTs nuevas, solo en la tienda: Pay Day (monedas que sueltan ₽ al golpear), Thief (roba el objeto que llevan Alfas y jefes), Protect (una burbuja que ningún golpe atraviesa), Hyper Beam (un rayo enorme con recarga), Rain Dance y Sunny Day (llaman lluvia o sol por 40s por encima del clima de la partida, con gotas y rayos cayendo sobre los enemigos), Swords Dance (+8% de daño que se acumula), Drain Punch (un puñetazo que cura), Thunder Wave (un cono que paraliza) y Fly (alzas el vuelo, intocable, y caes con todo). Todas con bifurcaciones en Nv 4 y 7.',
          },
          {
            pt: 'Na Loja (Nv 3): itens de evolução, comprados uma vez e seus pra sempre, que abrem os caminhos que pedem um item (a Ice Stone o Glaceon, a Metal Coat o Scizor…); a Everstone na Mochila, para uma partida sem evolução com +15% em tudo; e as Tampinhas no Treino, +3% em tudo por nível (até 3) para um Pokémon. O Desafio do dia continua sem nada disso.',
            en: 'At the Shop (Lv 3): evolution items, bought once and yours for good, which open the paths that need an item (the Ice Stone Glaceon, the Metal Coat Scizor…); the Everstone in the Bag, for a run without evolving at +15% to everything; and Bottle Caps in Training, +3% to everything per level (up to 3) for one Pokémon. The Daily Challenge still takes none of them.',
            es: 'En la Tienda (Nv 3): objetos evolutivos, comprados una vez y tuyos para siempre, que abren los caminos que piden un objeto (la Ice Stone a Glaceon, el Metal Coat a Scizor…); la Everstone en la Mochila, para una partida sin evolucionar con +15% en todo; y las Chapas en el Entreno, +3% en todo por nivel (hasta 3) para un Pokémon. El Desafío del día sigue sin nada de esto.',
          },
          {
            pt: 'Caravana do Meowth: de sexta a domingo, a partir do Kecleon Mart, o Meowth estaciona a carroça na praça. Ele traz um ovo ultra, a Tampinha Dourada (um Pokémon seu direto às 3 Tampinhas), a moldura Meowth e duas TMs exclusivas, uma de cada por fim de semana. Com 7 carimbos no cartão fidelidade, ele aceita pechinchar: 20% em tudo até domingo.',
            en: "Meowth's caravan: Friday to Sunday, from the Kecleon Mart on, Meowth parks his wagon on the plaza. He brings an ultra egg, the Gold Bottle Cap (one of your Pokémon straight to 3 Bottle Caps), the Meowth frame and two exclusive TMs, one of each per weekend. With 7 stamps on your loyalty card he takes haggling: 20% off everything until Sunday.",
            es: 'Caravana de Meowth: de viernes a domingo, desde el Kecleon Mart, Meowth estaciona su carreta en la plaza. Trae un huevo ultra, la Chapa Dorada (uno de tus Pokémon directo a 3 Chapas), el marco Meowth y dos MTs exclusivas, una de cada por fin de semana. Con 7 sellos en tu tarjeta de cliente acepta regatear: 20% en todo hasta el domingo.',
          },
          {
            pt: 'Cartão fidelidade: um carimbo por dia em que você passa na loja, sem precisar comprar, e dia perdido não zera nada. Com 7 vem um ovo raro, com 14 a moldura Freguês, com 30 o título Freguês VIP, com 60 uma estátua dourada do Kecleon na sua praça e com 100 um Ovo do Kecleon com shiny garantido.',
            en: "Loyalty card: one stamp per day you come by the shop, no purchase needed, and a missed day never resets it. 7 bring a rare egg, 14 the Regular frame, 30 the VIP Customer title, 60 a golden Kecleon statue on your plaza and 100 a Kecleon Egg sure to hatch shiny.",
            es: 'Tarjeta de cliente: un sello por día que pasas por la tienda, sin comprar nada, y un día perdido no borra nada. Con 7 llega un huevo raro, con 14 el marco Cliente frecuente, con 30 el título Cliente VIP, con 60 una estatua dorada de Kecleon en tu plaza y con 100 un Huevo Kecleon con shiny garantizado.',
          },
          {
            pt: 'Loja de Departamento (Nv 5): o título Magnata, a moldura Kecleon Dourado e a estátua dourada do Kecleon na praça. E nas datas especiais aparece uma barraca na praça: na Noite das Bruxas é a do Duskull, perto do pote de doces.',
            en: 'Department Store (Lv 5): the Tycoon title, the Golden Kecleon frame and the golden Kecleon statue on the plaza. And on special dates a stall shows up on the plaza: on Halloween Night it is Duskull\'s, by the candy jar.',
            es: 'Gran Almacén (Nv 5): el título Magnate, el marco Kecleon Dorado y la estatua dorada de Kecleon en la plaza. Y en fechas especiales aparece un puesto en la plaza: en la Noche de Brujas es el de Duskull, junto al frasco de dulces.',
          },
          {
            pt: 'O Kecleon fala com você: dá boas-vindas a quem chega pela primeira vez, comemora uma vitória contra o Mewtwo, lembra dos fregueses de todo dia, comenta o seu parceiro e agradece cada compra. E de vez em quando o balcão parece vazio...',
            en: 'Kecleon talks to you: it welcomes first-timers, cheers a win against Mewtwo, remembers its daily regulars, has a word about your partner and thanks you for every purchase. And every now and then the counter looks empty...',
            es: 'Kecleon habla contigo: da la bienvenida a quien llega por primera vez, celebra una victoria contra Mewtwo, recuerda a sus clientes de todos los días, comenta sobre tu compañero y agradece cada compra. Y de vez en cuando el mostrador parece vacío...',
          },
        ],
      },
      {
        title: { pt: 'Pesquisa de dificuldade', en: 'Difficulty survey', es: 'Encuesta de dificultad' },
        notes: [
          {
            pt: 'O lobby pergunta o que você está achando das dificuldades Normal, Difícil e Pesadelo. Leva dez segundos e ajuda a ajustar o jogo. Se fechar sem responder, a prancheta com "!" no topo fica lá para quando você quiser.',
            en: 'The lobby asks how Normal, Hard and Nightmare feel to you. It takes ten seconds and helps tune the game. Close it without answering and the clipboard with a "!" up top waits for whenever you want.',
            es: 'El lobby pregunta qué te parecen las dificultades Normal, Difícil y Pesadilla. Toma diez segundos y ayuda a ajustar el juego. Si la cierras sin responder, la tablilla con "!" arriba se queda ahí para cuando quieras.',
          },
        ],
      },
      {
        title: { pt: 'Mural de ideias em colunas', en: 'Ideas board in columns', es: 'Muro de ideas en columnas' },
        notes: [
          {
            pt: 'O mural de ideias virou um quadro com quatro colunas: Backlog, A fazer, Cozinhando e Pronto. Dá para ver o que vem por aí e o que já está sendo feito, e votar em tudo que ainda não saiu.',
            en: 'The ideas board is now a board with four columns: Backlog, To do, Cooking and Done. See what\'s coming and what\'s being made right now, and vote on anything that hasn\'t shipped yet.',
            es: 'El muro de ideas ahora es un tablero con cuatro columnas: Backlog, Por hacer, Cocinando y Listo. Puedes ver lo que viene y lo que ya se está haciendo, y votar todo lo que todavía no salió.',
          },
          {
            pt: 'Cada ideia nova passa pela equipe antes de entrar no Backlog. Enquanto isso, só você a vê, marcada como Em análise.',
            en: 'Every new idea goes past the team before it lands in the Backlog. Meanwhile only you see it, marked In review.',
            es: 'Cada idea nueva pasa por el equipo antes de entrar al Backlog. Mientras tanto, solo tú la ves, marcada como En revisión.',
          },
        ],
      },
      {
        title: { pt: 'Partidas inteiras no celular', en: 'Whole runs on your phone', es: 'Partidas enteras en el celular' },
        notes: [
          {
            pt: 'O jogo não fecha mais sozinho no meio da partida em celulares. A memória que ele usa agora fica estável do começo ao fim: carrega só os Pokémon da fase atual e da próxima, solta os que já passaram e só baixa um shiny quando ele aparece.',
            en: 'The game no longer closes by itself mid-run on phones. The memory it uses now stays flat from start to finish: it loads only the Pokémon of the current and next stage, lets go of the ones already behind you and only downloads a shiny when one shows up.',
            es: 'El juego ya no se cierra solo en medio de la partida en celulares. La memoria que usa ahora se mantiene estable de principio a fin: carga solo los Pokémon de la fase actual y la siguiente, suelta los que ya pasaron y solo descarga un shiny cuando aparece.',
          },
        ],
      },
      {
        title: { pt: 'Mais leve no celular', en: 'Lighter on phones', es: 'Más liviano en el celular' },
        notes: [
          {
            pt: 'O jogo agora gasta bem menos memória numa partida longa (a do Dialga, antes de abrir a fenda, chegava a encher a memória do celular em segundos) e desenha menos coisas fora da tela, como o arco-íris do Water Pledge. Em celulares que engasgam, ele passa sozinho a desenhar menos partículas, sombras, números de dano e golpes lendários mais leves até a partida voltar a fluir.',
            en: 'The game now uses far less memory over a long run (Dialga\'s, before its rift opens, could fill a phone\'s memory in seconds) and draws less off screen, like Water Pledge\'s rainbow. On phones that stutter, it switches on its own to fewer particles, shadows and damage numbers and lighter legendary moves until the run flows again.',
            es: 'El juego ahora usa mucha menos memoria en una partida larga (la de Dialga, antes de abrir su grieta, podía llenar la memoria del celular en segundos) y dibuja menos fuera de la pantalla, como el arcoíris de Water Pledge. En celulares que se traban, pasa solo a dibujar menos partículas, sombras y números de daño y movimientos legendarios más livianos hasta que la partida vuelve a fluir.',
          },
        ],
      },
      {
        title: { pt: 'Correções', en: 'Fixes', es: 'Correcciones' },
        notes: [
          {
            pt: 'Loja do Kecleon no celular: a lista e as abas agora rolam com o dedo (dava para ver só a primeira fileira, sem chegar às Melhorias), o painel cresce em telas baixas para mostrar mais itens, e o disco das TMs não cobre mais o nome.',
            en: 'Kecleon Shop on phones: the list and the tabs now scroll with your finger (only the first row showed, with no way down to the upgrades), the panel grows on short screens to show more items, and the TM discs no longer cover their names.',
            es: 'Tienda Kecleon en el celular: la lista y las pestañas ahora se desplazan con el dedo (solo se veía la primera fila, sin llegar a las mejoras), el panel crece en pantallas bajas para mostrar más objetos, y el disco de las MTs ya no tapa su nombre.',
          },
          {
            pt: 'Entrar em tela cheia (F11) ou trocar de aba no meio do movimento não deixa mais o Pokémon andando sozinho numa direção.',
            en: 'Going fullscreen (F11) or switching tabs mid-move no longer leaves your Pokémon walking on its own in one direction.',
            es: 'Entrar en pantalla completa (F11) o cambiar de pestaña en pleno movimiento ya no deja a tu Pokémon caminando solo en una dirección.',
          },
          {
            pt: 'Achar um ovo na partida com a incubadora cheia agora avisa na hora que ele vai virar ₽, com o valor, em vez de dizer que foi para a incubadora. Ovos de missões e medalhas que não cabem também dizem quanto viraram. Ovos de Presente Misterioso continuam esperando na caixa até abrir um espaço.',
            en: 'Finding an egg in a run with a full incubator now tells you right away that it will become ₽, and how much, instead of saying it went to the incubator. Mission and medal eggs that don’t fit say what they became too. Mystery Gift eggs still wait in the box until a slot frees up.',
            es: 'Encontrar un huevo en la partida con la incubadora llena ahora avisa al momento que se convertirá en ₽, con el monto, en vez de decir que fue a la incubadora. Los huevos de misiones y medallas que no caben también dicen en cuánto se convirtieron. Los huevos de Regalo Misterioso siguen esperando en la caja hasta que se libere un espacio.',
          },
          {
            pt: 'Desistir na pausa, ou Trocar Pokémon no fim da partida, com Espaço, Enter ou o botão A do controle começava outra partida com o mesmo Pokémon em vez de abrir a seleção de parceiro. Agora abre a seleção, como com o mouse ou o toque.',
            en: 'Give up on the pause menu, or Change Pokémon at the end of a run, picked with Space, Enter or the pad’s A button started another run with the same Pokémon instead of opening the partner select. It opens the select now, as with the mouse or touch.',
            es: 'Rendirse en la pausa, o Cambiar Pokémon al final de la partida, con Espacio, Enter o el botón A del control empezaba otra partida con el mismo Pokémon en vez de abrir la selección de compañero. Ahora abre la selección, como con el mouse o el toque.',
          },
          {
            pt: 'O retrato do seu Pokémon no avatar de Treinador, no Cartão de Treinador e nas carinhas do Hall da Fama ficava preso no canto de cima, à esquerda, cortando metade do rosto. Agora fica centralizado no círculo.',
            en: 'Your Pokémon’s portrait on the Trainer avatar, the Trainer Card and the Hall of Fame faces hung from the top-left corner, cutting off half the face. It’s centered in the circle now.',
            es: 'El retrato de tu Pokémon en el avatar de Entrenador, la Tarjeta de Entrenador y las caritas del Salón de la Fama quedaba pegado a la esquina superior izquierda, cortando medio rostro. Ahora queda centrado en el círculo.',
          },
          {
            pt: 'Com conta, voltar ao jogo (outra aba, outro app, o app instalado reaberto) sincroniza sozinho, e o lobby mostra na hora os ₽, as missões e o Desafio do dia feitos no outro aparelho, sem apertar sincronizar nem recarregar. A tentativa oficial do Desafio do dia também passa entre os aparelhos: feita no notebook, o celular já mostra treino.',
            en: 'With an account, coming back to the game (another tab, another app, the installed app reopened) syncs on its own, and the lobby shows right away the ₽, missions and Daily Challenge done on your other device, without pressing sync or reloading. The Daily Challenge’s official attempt carries across devices too: made on the laptop, the phone already shows practice.',
            es: 'Con cuenta, volver al juego (otra pestaña, otra app, la app instalada reabierta) sincroniza solo, y el lobby muestra al momento los ₽, las misiones y el Desafío del día hechos en el otro dispositivo, sin tocar sincronizar ni recargar. El intento oficial del Desafío del día también pasa entre dispositivos: hecho en la laptop, el celular ya muestra práctica.',
          },
        ],
      },
    ],
  },
  {
    date: '2026-10-20',
    title: { pt: 'Lendários jogáveis e um mapa para explorar', en: 'Playable legendaries and a map to explore', es: 'Legendarios jugables y un mapa para explorar' },
    highlights: [
      { pt: 'Modo Lendário: capture os 23 lendários vencendo-os como chefes e jogue com eles, com ranking próprio.', en: 'Legend Mode: catch all 23 legendaries by beating them as bosses, then play as them, with their own ranking.', es: 'Modo Legendario: captura a los 23 legendarios venciéndolos como jefes y juega con ellos, con su propio ranking.' },
      { pt: 'Fendas épicas: o céu avisa, você atravessa o domínio do lendário, vence uma batalha em 3 fases e joga a Poké Ball.', en: 'Epic rifts: the sky warns you, you cross the legendary’s domain, win a 3-phase battle and throw the Poké Ball.', es: 'Grietas épicas: el cielo avisa, cruzas el dominio del legendario, ganas una batalla en 3 fases y lanzas la Poké Ball.' },
      { pt: 'Os lendários do mapa, de Articuno a Arceus, agora lutam em 3 fases, com entrada, tema próprio e um golpe supremo.', en: 'The legendaries on the map, from Articuno to Arceus, now fight in 3 phases, with an entrance, their own theme and an ultimate.', es: 'Los legendarios del mapa, de Articuno a Arceus, ahora pelean en 3 fases, con entrada, tema propio y un golpe supremo.' },
      { pt: 'Pontos de interesse e tesouros pelo mapa, e lugares para entrar: uma Mystery Dungeon no escuro, um cemitério com Spiritomb e o céu.', en: 'Landmarks and treasures all over the map, and places to step into: a Mystery Dungeon in the dark, a graveyard with Spiritomb and the sky.', es: 'Puntos de interés y tesoros por el mapa, y lugares para entrar: un Mundo Misterioso a oscuras, un cementerio con Spiritomb y el cielo.' },
      { pt: 'Viu uma partida impossível no ranking? Toque na bandeira ao lado dela para denunciar.', en: 'Saw an impossible run on the ranking? Tap the flag next to it to report it.', es: '¿Viste una partida imposible en el ranking? Toca la bandera a su lado para denunciarla.' },
    ],
    changes: [
      {
        title: { pt: 'Modo Lendário', en: 'Legend Mode', es: 'Modo Legendario' },
        notes: [
          {
            pt: 'A ideia mais votada do mural de ideias, de @clementwong212: os lendários agora são jogáveis, num modo só deles. São 23: Articuno, Zapdos, Moltres, Raikou, Entei, Suicune, Regirock, Regice, Registeel, Mew, Celebi, Jirachi, Mewtwo, Lugia, Ho-Oh, Kyogre, Groudon, Rayquaza, Dialga, Latias, Latios, Deoxys e Arceus.',
            en: 'The most voted idea on the ideas board, from @clementwong212: legendaries are now playable, in a mode of their own. All 23 of them: Articuno, Zapdos, Moltres, Raikou, Entei, Suicune, Regirock, Regice, Registeel, Mew, Celebi, Jirachi, Mewtwo, Lugia, Ho-Oh, Kyogre, Groudon, Rayquaza, Dialga, Latias, Latios, Deoxys and Arceus.',
            es: 'La idea más votada del muro de ideas, de @clementwong212: los legendarios ahora son jugables, en un modo propio. Son 23: Articuno, Zapdos, Moltres, Raikou, Entei, Suicune, Regirock, Regice, Registeel, Mew, Celebi, Jirachi, Mewtwo, Lugia, Ho-Oh, Kyogre, Groudon, Rayquaza, Dialga, Latias, Latios, Deoxys y Arceus.',
          },
          {
            pt: 'Para capturar um lendário, vença-o como chefe, em qualquer modo: 3 vezes para os das fendas e dos trios, 5 para o Mewtwo e 1 para Mew, Celebi e Jirachi. A cada vitória ele escapa da Poké Ball e o jogo conta (Kyogre escapou… 2/3); na última, ele é seu e aparece na nova aba Lendários da seleção de parceiro. Arceus é o último troféu: só se deixa capturar no modo sem fim, depois dos outros 22.',
            en: 'To catch a legendary, beat it as a boss, in any mode: 3 times for the rift and trio legendaries, 5 for Mewtwo and once for Mew, Celebi and Jirachi. Every win before that it breaks free from the Poké Ball and the game keeps count (Kyogre broke free… 2/3); on the last one it’s yours and shows up in the new Legendaries tab of the partner select. Arceus is the final trophy: it can only be caught in endless mode, after the other 22.',
            es: 'Para capturar un legendario, véncelo como jefe, en cualquier modo: 3 veces los de las grietas y los tríos, 5 a Mewtwo y 1 a Mew, Celebi y Jirachi. En cada victoria se escapa de la Poké Ball y el juego lleva la cuenta (Kyogre se escapó… 2/3); en la última es tuyo y aparece en la nueva pestaña Legendarios de la selección de compañero. Arceus es el último trofeo: solo se deja capturar en el modo infinito, después de los otros 22.',
          },
          {
            pt: 'Lendários não evoluem: eles despertam no Nv 12 e no Nv 28, com Habilidade, mais força e uma carga de Esquecer. No segundo despertar, Kyogre e Groudon viram Primal e Rayquaza vira Mega; Latias, Latios e Mewtwo (Y) Mega Evoluem com o botão Mega, e o especial do Deoxys troca de Forma. Cada um começa com o seu golpe lendário e uma Habilidade inata sempre ativa: Drizzle traz a chuva, Drought o sol, Air Lock deixa o Rayquaza imune ao clima, Levitate faz os Latis flutuarem sobre a lava.',
            en: 'Legendaries don’t evolve: they awaken at Lv 12 and Lv 28, with an Ability, more power and a Forget charge. On the second awakening, Kyogre and Groudon turn Primal and Rayquaza turns Mega; Latias, Latios and Mewtwo (Y) Mega Evolve with the Mega button, and Deoxys’s special swaps its Forme. Each one opens with its legendary move and an innate Ability that’s always on: Drizzle brings the rain, Drought the sun, Air Lock makes Rayquaza immune to the weather, Levitate floats the Latis over lava.',
            es: 'Los legendarios no evolucionan: despiertan en el Nv 12 y en el Nv 28, con Habilidad, más fuerza y una carga de Olvidar. En el segundo despertar, Kyogre y Groudon se vuelven Primigenios y Rayquaza, Mega; Latias, Latios y Mewtwo (Y) megaevolucionan con el botón Mega, y el especial de Deoxys cambia su Forma. Cada uno empieza con su movimiento legendario y una Habilidad innata siempre activa: Drizzle trae la lluvia, Drought el sol, Air Lock vuelve a Rayquaza inmune al clima y Levitate hace flotar a los Latis sobre la lava.',
          },
          {
            pt: 'A partida dura o mesmo tempo, as três dificuldades continuam valendo e a horda vem mais forte (Pressão). O modo tem um ranking só dele, o Lendário, separado por dificuldade: no ranking, troque entre Padrão e Lendário. E ninguém enfrenta a si mesmo: um Mewtwo encara o Mewtwo Clone no final.',
            en: 'A run lasts as long as ever, all three difficulties still apply and the horde comes in stronger (Pressure). The mode has a ranking of its own, Legendary, split by difficulty: on the rankings, switch between Standard and Legendary. And no one faces themselves: a Mewtwo takes on the Mewtwo Clone at the end.',
            es: 'La partida dura lo mismo, las tres dificultades siguen valiendo y la horda viene más fuerte (Presión). El modo tiene un ranking propio, el Legendario, separado por dificultad: en el ranking, cambia entre Estándar y Legendario. Y nadie se enfrenta a sí mismo: un Mewtwo se mide con el Mewtwo Clon al final.',
          },
          {
            pt: '11 golpes lendários novos, um para cada membro dos trios, Mewtwo e Arceus: Snowscape, Electric Terrain, Overheat, Thunderclap, Burning Bulwark, Aqua Ring, Rock Wrecker, Glaciate, Metal Burst, Telekinesis e Judgment, que muda de tipo com o bioma.',
            en: '11 new legendary moves, one for each trio member, Mewtwo and Arceus: Snowscape, Electric Terrain, Overheat, Thunderclap, Burning Bulwark, Aqua Ring, Rock Wrecker, Glaciate, Metal Burst, Telekinesis and Judgment, which changes type with the biome.',
            es: '11 movimientos legendarios nuevos, uno para cada miembro de los tríos, Mewtwo y Arceus: Snowscape, Electric Terrain, Overheat, Thunderclap, Burning Bulwark, Aqua Ring, Rock Wrecker, Glaciate, Metal Burst, Telekinesis y Judgment, que cambia de tipo con el bioma.',
          },
        ],
      },
      {
        title: { pt: 'Fendas épicas', en: 'Epic rifts', es: 'Grietas épicas' },
        notes: [
          {
            pt: 'Agora são 2 fendas por partida, por volta de 4:00 e de 10:20, e o relógio da partida para lá dentro. Antes de cada uma, o lendário avisa: o clima dele toma o céu (chuva torrencial, sol abrasador, vendaval, tempestade, arco-íris, chuva de meteoros, o tempo tropeçando) e um rasgo enorme se abre no ar.',
            en: 'There are now 2 rifts per run, around 4:00 and 10:20, and the run clock stops inside. Before each one, the legendary gives a sign: its weather takes over the sky (pouring rain, harsh sun, a gale, a storm, a rainbow, a meteor shower, time stumbling) and a huge tear opens in the air.',
            es: 'Ahora hay 2 grietas por partida, alrededor de 4:00 y de 10:20, y el reloj de la partida se detiene adentro. Antes de cada una, el legendario avisa: su clima se adueña del cielo (lluvia torrencial, sol abrasador, vendaval, tormenta, arcoíris, lluvia de meteoros, el tiempo que tropieza) y se abre un desgarro enorme en el aire.',
          },
          {
            pt: 'Cada lendário tem o seu domínio, maior que a tela, para atravessar com os Pokémon que o servem e uma ameaça vindo atrás: a maré na Caverna do Fundo do Mar (Kyogre), a lava na Caverna de Magma (Groudon), os andares desabando no Pilar Celeste (Rayquaza), os redemoinhos das Ilhas Redemoinho (Lugia), a Torre do Sino em chamas (Ho-Oh), os saltos no tempo do Pilar Lança (Dialga), a névoa de sonho da Ilha do Sul (Latias e Latios, juntos) e o Meteoro à Deriva se desfazendo no vazio (Deoxys).',
            en: 'Each legendary has its own domain, bigger than the screen, to cross past the Pokémon that serve it with a threat coming up behind: the tide in the Seafloor Cavern (Kyogre), lava in the Magma Cavern (Groudon), floors crumbling on the Sky Pillar (Rayquaza), the whirlpools of the Whirl Islands (Lugia), the Bell Tower on fire (Ho-Oh), time skipping on Spear Pillar (Dialga), the dream mist of Southern Island (Latias and Latios, together) and the Drifting Meteoroid coming apart in the void (Deoxys).',
            es: 'Cada legendario tiene su dominio, más grande que la pantalla, que cruzar entre los Pokémon que lo sirven con una amenaza que viene detrás: la marea en la Cueva Fondo Marino (Kyogre), la lava en la Caverna de Magma (Groudon), los pisos que se derrumban en el Pilar Celeste (Rayquaza), los remolinos de las Islas Remolino (Lugia), la Torre Campana en llamas (Ho-Oh), los saltos en el tiempo de la Columna Lanza (Dialga), la neblina de ensueño de la Isla Sur (Latias y Latios, juntos) y el Meteoroide a la Deriva que se deshace en el vacío (Deoxys).',
          },
          {
            pt: 'No fim, o lendário chega com um card de título e o seu próprio tema, e a batalha tem 3 fases: cada uma transforma a arena e termina num golpe supremo, sempre com um lugar seguro marcado. Kyogre inunda a caverna e solta o Origin Pulse, Ho-Oh renasce das cinzas, o Roar of Time do Dialga congela os seus golpes no ar e o Deoxys troca de Forma a cada fase.',
            en: 'At the end the legendary arrives with a title card and its own theme, and the battle has 3 phases: each one transforms the arena and builds to an ultimate, always with a marked safe spot. Kyogre floods the cavern and unleashes Origin Pulse, Ho-Oh rises from its ashes, Dialga’s Roar of Time freezes your attacks in mid-air and Deoxys swaps Formes every phase.',
            es: 'Al final, el legendario llega con una tarjeta de título y su propio tema, y la batalla tiene 3 fases: cada una transforma la arena y termina en un golpe supremo, siempre con un lugar seguro marcado. Kyogre inunda la cueva y suelta el Origin Pulse, Ho-Oh renace de sus cenizas, el Roar of Time de Dialga congela tus ataques en el aire y Deoxys cambia de Forma en cada fase.',
          },
          {
            pt: 'Vencido, ele se ajoelha e a Poké Ball voa: balança três vezes e prende ou estoura, contando para a captura. Desmaiar lá dentro continua sem encerrar a partida: você volta ao mapa com 30% do HP.',
            en: 'Once beaten, it kneels and the Poké Ball flies: it shakes three times and either clicks or bursts open, counting toward the catch. Fainting inside still doesn’t end the run: you land back on the map with 30% HP.',
            es: 'Vencido, se arrodilla y vuela la Poké Ball: se sacude tres veces y lo atrapa o se abre, y cuenta para la captura. Desmayarte adentro sigue sin terminar la partida: vuelves al mapa con 30% del HP.',
          },
        ],
      },
      {
        title: { pt: 'Lendários do mapa em 3 fases', en: 'Map legendaries in 3 phases', es: 'Legendarios del mapa en 3 fases' },
        notes: [
          {
            pt: 'O trio da partida, o mítico raro, Mewtwo e Arceus chegam com uma entrada: as aves descem do céu, as feras saltam, os Regis sobem do chão, um card mostra o nome e o epíteto (ZAPDOS · Senhor do Trovão) e cada trio tem o seu tema.',
            en: 'The run’s trio, the rare mythical, Mewtwo and Arceus make an entrance: the birds swoop down from the sky, the beasts leap in, the Regis rise from the ground, a card shows the name and epithet (ZAPDOS · Lord of Thunder) and each trio has its own theme.',
            es: 'El trío de la partida, el mítico raro, Mewtwo y Arceus llegan con una entrada: las aves bajan del cielo, las bestias saltan, los Regis salen del suelo, una tarjeta muestra el nombre y el epíteto (ZAPDOS · Señor del Trueno) y cada trío tiene su tema.',
          },
          {
            pt: 'A luta tem 3 fases, marcadas na barra de HP: a segunda traz um jeito novo de se mover e a terceira, um golpe supremo com o golpe lendário de cada um (Snowscape, Electric Terrain, Psystrike, Judgment…), sempre com um lugar seguro marcado. O Judgment do Arceus muda de tipo com o bioma. Quando ele cai, uma captura rápida acontece ali mesmo, no mapa.',
            en: 'The fight has 3 phases, marked on the HP bar: the second brings a new way to move and the third an ultimate built on each one’s legendary move (Snowscape, Electric Terrain, Psystrike, Judgment…), always with a marked safe spot. Arceus’s Judgment changes type with the biome. When it falls, a quick capture plays right there on the map.',
            es: 'La pelea tiene 3 fases, marcadas en la barra de HP: la segunda trae una forma nueva de moverse y la tercera, un golpe supremo con el movimiento legendario de cada uno (Snowscape, Electric Terrain, Psystrike, Judgment…), siempre con un lugar seguro marcado. El Judgment de Arceus cambia de tipo con el bioma. Cuando cae, una captura rápida sucede ahí mismo, en el mapa.',
          },
        ],
      },
      {
        title: { pt: 'Pontos de interesse no mapa', en: 'Landmarks on the map', es: 'Puntos de interés en el mapa' },
        notes: [
          {
            pt: 'Ideia do @samael no mural de ideias, a mais votada: o mapa agora tem lugares fixos para descobrir, com a cara de cada bioma. Ao chegar perto, uma placa mostra o nome do lugar, como nos jogos.',
            en: 'An idea from @samael on the ideas board, the most voted one: the map now has fixed places to discover, dressed for each biome. As you come close, a sign shows the place’s name, like in the games.',
            es: 'Idea de @samael en el muro de ideas, la más votada: el mapa ahora tiene lugares fijos para descubrir, con el aspecto de cada bioma. Al acercarte, un cartel muestra el nombre del lugar, como en los juegos.',
          },
          {
            pt: 'Casa Abandonada: uma casa de pedra sem telhado, com janelas, lareira e um caixote esquecido lá dentro. Labirinto de Sebes: um baú no coração do labirinto. Ruínas Unown: um altar que acende os glifos e solta Exp. Candy. Acampamento Abandonado: a fogueira ainda acesa e uma mochila com Oran Berries.',
            en: 'Abandoned Cottage: a stone cottage without its roof, with windows, a fireplace and a crate left inside. Hedge Maze: a chest at its heart. Unown Ruins: an altar that lights up the glyphs and spills Exp. Candy. Abandoned Camp: the fire still burning and a backpack with Oran Berries.',
            es: 'Casa Abandonada: una casa de piedra sin techo, con ventanas, chimenea y una caja olvidada adentro. Laberinto de Setos: un cofre en su corazón. Ruinas Unown: un altar que enciende los glifos y suelta Exp. Candy. Campamento Abandonado: la fogata todavía encendida y una mochila con Oran Berries.',
          },
          {
            pt: 'Túnel da Mina: entre por uma boca e saia pela outra, do outro lado da montanha. A horda perde o seu rastro enquanto você está lá embaixo.',
            en: 'Mine Tunnel: go in one mouth and come out the other, on the far side of the ridge. The horde loses track of you while you’re down there.',
            es: 'Túnel de la Mina: entra por una boca y sal por la otra, del otro lado de la montaña. La horda te pierde el rastro mientras estás allá abajo.',
          },
          {
            pt: 'Cada tesouro abre uma vez por partida, ficando um instante perto dele. Duas conquistas novas contam os tesouros abertos.',
            en: 'Each treasure opens once per run, by standing next to it for a moment. Two new achievements count the treasures opened.',
            es: 'Cada tesoro se abre una vez por partida, quedándote un instante junto a él. Dos logros nuevos cuentan los tesoros abiertos.',
          },
        ],
      },
      {
        title: { pt: 'Lugares para entrar', en: 'Places to step into', es: 'Lugares para entrar' },
        notes: [
          {
            pt: 'Algumas vezes por partida, a entrada de um lugar aparece no mapa, com uma seta apontando para ela. Fique na porta para entrar: lá dentro o mundo espera e o lugar tem seus próprios Pokémon, um objetivo e um limite de tempo.',
            en: 'A few times a run, the entrance to a place shows up on the map, with an arrow pointing at it. Stand in the doorway to go in: inside, the world waits and the place has its own Pokémon, a goal and a time limit.',
            es: 'Algunas veces por partida, la entrada de un lugar aparece en el mapa, con una flecha que apunta hacia ella. Quédate en la entrada para pasar: adentro el mundo espera y el lugar tiene sus propios Pokémon, un objetivo y un límite de tiempo.',
          },
          {
            pt: 'Caverna Escura, uma Mystery Dungeon: andares no escuro com escadas para achar, uma Casa de Monstros e um baú no fundo. Pokémon de Fogo e Elétricos iluminam mais longe, e o vento avisa antes de soprar você para fora.',
            en: 'Dark Cave, a Mystery Dungeon: floors in the dark with stairs to find, a Monster House and a chest at the bottom. Fire and Electric types light up farther, and the wind warns before it blows you out.',
            es: 'Cueva Oscura, un Mundo Misterioso: pisos a oscuras con escaleras que encontrar, una Casa de Monstruos y un cofre al fondo. Los Pokémon de Fuego y Eléctricos iluminan más lejos, y el viento avisa antes de sacarte de la cueva.',
          },
          {
            pt: 'Cemitério Assombrado: só fantasmas, saindo das covas. Os espíritos deles despertam a Pedra Peculiar e, dela, Spiritomb, um chefe novo (que pode ser shiny). Vença antes do amanhecer.',
            en: 'Haunted Graveyard: ghosts only, rising from the graves. Their spirits stir the Odd Keystone, and out of it comes Spiritomb, a new boss (who can be shiny). Beat it before dawn.',
            es: 'Cementerio Embrujado: solo fantasmas, saliendo de las tumbas. Sus espíritus despiertan a la Piedra Espíritu y, de ella, a Spiritomb, un jefe nuevo (que puede ser shiny). Véncelo antes del amanecer.',
          },
          {
            pt: 'Acima das Nuvens, só para quem voa: com um Pokémon do tipo Voador, uma corrente de ar leva você ao céu, onde só aparecem voadores, todos batendo as asas, e asas chegam com o vento. Cada asa melhora um atributo até o fim da partida.',
            en: 'Above the Clouds, for flyers only: with a Flying-type Pokémon, an updraft takes you up to the sky, where only flying Pokémon come, all flapping their wings, and wings drift in on the wind. Each wing raises a stat for the rest of the run.',
            es: 'Sobre las Nubes, solo para quien vuela: con un Pokémon de tipo Volador, una corriente de aire te lleva al cielo, donde solo aparecen voladores, todos batiendo las alas, y el viento trae plumas. Cada pluma mejora una estadística hasta el final de la partida.',
          },
          {
            pt: 'Três conquistas novas, uma delas com o título Explorador(a), para quem concluir os três lugares.',
            en: 'Three new achievements, one with the Explorer title, for clearing all three places.',
            es: 'Tres logros nuevos, uno con el título Explorador(a), para quien complete los tres lugares.',
          },
        ],
      },
      {
        title: { pt: 'Um mapa mais vivo', en: 'A livelier map', es: 'Un mapa más vivo' },
        notes: [
          {
            pt: 'Moitas (com flores ou frutinhas), troncos caídos e pedras e árvores soltas entre os bosques e as montanhas, cada bioma com o seu jeito: cogumelos que brilham na caverna, arbustos com neve na montanha e espinheiros no cemitério.',
            en: 'Bushes (with flowers or berries), fallen logs and lone rocks and trees between the groves and the mountains, each biome in its own way: glowing mushrooms in the cave, snowy shrubs on the mountain and thorns in the graveyard.',
            es: 'Arbustos (con flores o bayas), troncos caídos y rocas y árboles sueltos entre los bosques y las montañas, cada bioma a su manera: hongos que brillan en la cueva, arbustos nevados en la montaña y espinos en el cementerio.',
          },
        ],
      },
      {
        title: { pt: 'Ranking mais confiável', en: 'A more reliable ranking', es: 'Ranking más confiable' },
        notes: [
          {
            pt: 'A conferência das partidas do ranking tirava algumas partidas honestas: as jogadas numa versão anterior do jogo, depois de uma atualização que mudou as regras, e as que terminaram com a tela de level-up aberta. As duas coisas foram corrigidas, e agora o próprio jogo avisa a equipe antes que uma atualização mude as regras sem cuidado.',
            en: 'The check of ranked runs was taking some honest runs off: the ones played on an older version of the game after an update changed the rules, and the ones that ended with the level-up screen open. Both are fixed, and the game now warns the team before an update changes the rules by accident.',
            es: 'La revisión de las partidas del ranking sacaba algunas partidas honestas: las jugadas en una versión anterior del juego, después de una actualización que cambió las reglas, y las que terminaron con la pantalla de subida de nivel abierta. Las dos cosas están corregidas, y ahora el propio juego avisa al equipo antes de que una actualización cambie las reglas sin querer.',
          },
          {
            pt: 'Com a data do aparelho errada, uma partida do ranking podia jogar o Surto de outro dia e sair do ranking. Agora o servidor diz ao jogo qual é o Surto de hoje.',
            en: "With the device's date wrong, a ranked run could play another day's Outbreak and leave the ranking. Now the server tells the game which Outbreak is today's.",
            es: 'Con la fecha del dispositivo mal, una partida del ranking podía jugar el Brote de otro día y salir del ranking. Ahora el servidor le dice al juego cuál es el Brote de hoy.',
          },
          {
            pt: 'Tentar de novo, tocado depois de abrir o ranking ou o cartão de compartilhar nos resultados, começava duas partidas de uma vez, e a que ficava saía do ranking. Agora começa uma só.',
            en: 'Try again, tapped after opening the ranking or the share card on the results, started two runs at once, and the one that stayed was off the ranking. Now it starts just one.',
            es: 'Reintentar, tocado después de abrir el ranking o la tarjeta para compartir en los resultados, empezaba dos partidas a la vez, y la que quedaba salía del ranking. Ahora empieza una sola.',
          },
          {
            pt: 'Desmaiar no mesmo instante em que um baú se abria mostrava a escolha do item amaldiçoado, e a partida, já enviada ao ranking, seguia com 0 de HP. Agora o desmaio vale: o baú não abre numa partida que acabou, e espera qualquer outra tela fechar em vez de cobri-la.',
            en: 'Fainting the very moment a chest opened showed the cursed item choice, and the run, already sent to the ranking, went on at 0 HP. Now the faint counts: the chest never opens on a run that ended, and it waits for any other screen to close instead of covering it.',
            es: 'Desmayarse en el mismo instante en que se abría un cofre mostraba la elección del objeto maldito, y la partida, ya enviada al ranking, seguía con 0 de HP. Ahora el desmayo cuenta: el cofre no se abre en una partida que terminó, y espera a que se cierre cualquier otra pantalla en vez de taparla.',
          },
        ],
      },
      {
        title: { pt: 'Denúncias', en: 'Reports', es: 'Denuncias' },
        notes: [
          {
            pt: 'Com uma conta, cada linha do ranking (e do Desafio do dia) tem uma bandeira para denunciar aquela partida, e o perfil de outro treinador tem o botão Denunciar. Escolha o motivo (trapaça, nome ofensivo ou outro), deixe um comentário se quiser e pronto: ninguém fica sabendo quem denunciou.',
            en: "With an account, every line of the ranking (and of the Daily Challenge) has a flag to report that run, and another trainer's profile has a Report button. Pick the reason (cheating, offensive name or something else), leave a comment if you like and that's it: nobody finds out who reported.",
            es: 'Con una cuenta, cada línea del ranking (y del Desafío del día) tiene una bandera para denunciar esa partida, y el perfil de otro entrenador tiene el botón Denunciar. Elige el motivo (trampa, nombre ofensivo u otro), deja un comentario si quieres y listo: nadie se entera de quién denunció.',
          },
          {
            pt: 'As partidas continuam entrando no ranking na hora. Só uma denúncia faz a equipe olhar: uma partida trapaceada sai do ranking, um save editado volta ao zero e uma conta banida não entra mais no ranking nem nos perfis (ela ainda pode jogar no aparelho, sem conta).',
            en: "Runs still join the ranking right away. Only a report gets the team to look: a cheated run leaves the ranking, an edited save goes back to zero, and a banned account no longer shows on the ranking or in profiles (it can still play on the device, without an account).",
            es: 'Las partidas siguen entrando al ranking al instante. Solo una denuncia hace que el equipo revise: una partida con trampa sale del ranking, una partida guardada editada vuelve a cero y una cuenta baneada ya no aparece en el ranking ni en los perfiles (aún puede jugar en el dispositivo, sin cuenta).',
          },
        ],
      },
      {
        title: { pt: 'Hall da Fama', en: 'Hall of Fame', es: 'Salón de la Fama' },
        notes: [
          {
            pt: 'O Hall da Fama conta todos os apoiadores, inclusive quem preferiu ficar fora do mural, então o número não cai mais quando alguém se esconde.',
            en: 'The Hall of Fame counts every supporter, including those who chose to stay off the wall, so the number no longer drops when someone hides.',
            es: 'El Salón de la Fama cuenta a todos los patrocinadores, incluso a quienes prefirieron quedar fuera del muro, así que el número ya no baja cuando alguien se oculta.',
          },
        ],
      },
    ],
  },
  {
    date: '2026-10-19',
    title: { pt: 'Modo difícil e convites', en: 'Hard mode and invites', es: 'Modo difícil e invitaciones' },
    highlights: [
      { pt: 'Ficar parado não funciona mais: cuspidores de longe, Pokémon Alfa gigantes e o mapa atacando.', en: "Standing still doesn't work anymore: ranged spitters, giant Alpha Pokémon and a map that strikes back.", es: 'Quedarse quieto ya no funciona: escupidores a distancia, Pokémon Alfa gigantes y el mapa que ataca.' },
      { pt: 'Missões de campo: defenda um ovo, junte Poké Balls e leve um Togepi perdido para casa.', en: 'Field missions: defend an egg, gather Poké Balls and lead a lost Togepi home.', es: 'Misiones de campo: defiende un huevo, junta Poké Balls y lleva a casa a un Togepi perdido.' },
      { pt: 'Chefes mais espertos, que miram onde você vai e ganham um ataque novo na fúria.', en: "Smarter bosses that aim where you're going and gain a new attack when enraged.", es: 'Jefes más astutos, que apuntan adonde vas y ganan un ataque nuevo con la furia.' },
      { pt: 'Servidor no Discord: conecte sua conta para entrar direto e ganhar um Noibat shiny.', en: 'A Discord server: link your account to join right away and get a shiny Noibat.', es: 'Servidor en Discord: conecta tu cuenta para entrar directo y ganar un Noibat shiny.' },
      { pt: 'Convide amigos e ganhe ovos, um título e até um Dratini shiny.', en: 'Invite friends to earn eggs, a title and even a shiny Dratini.', es: 'Invita amigos y gana huevos, un título y hasta un Dratini shiny.' },
    ],
    changes: [
      {
        title: { pt: 'Modo difícil de verdade', en: 'Hard mode, for real', es: 'Modo difícil de verdad' },
        notes: [
          {
            pt: 'Ficar parado não funciona mais. Cada fase tem uma espécie que cospe de longe: ela brilha antes e solta um disparo lento do seu tipo (bola de fogo, bolha, lodo que deixa poça, faísca, sementes) que passa pela aura. Basta dar um passo para o lado.',
            en: "Standing still doesn't work anymore. Each stage has a species that spits from afar: it glows first and fires a slow shot of its type (fireball, bubble, sludge that leaves a puddle, spark, seeds) that passes through your aura. One step aside is enough.",
            es: 'Quedarse quieto ya no funciona. Cada fase tiene una especie que escupe de lejos: brilla antes y suelta un disparo lento de su tipo (bola de fuego, burbuja, lodo que deja un charco, chispa, semillas) que atraviesa el aura. Basta con dar un paso al costado.',
          },
          {
            pt: 'Pokémon Alfa: gigantes de brilho vermelho entram na horda, não recuam com os golpes e investem numa linha vermelha que miram antes. Derrote um para ganhar EXP, ₽ e o Prêmio do Alfa, um level-up só de cartas raras. Conquistas novas: Primeiro Alfa, Rastreador de Alfas e Caçador de Alfas, que dá título.',
            en: "Alpha Pokémon: red-glowing giants join the horde, shrug off knockback and charge along a red lane they aim first. Beat one for EXP, ₽ and the Alpha's prize, a level-up of rare cards only. New achievements: First Alpha, Alpha Tracker and Alpha Hunter, which grants a title.",
            es: 'Pokémon Alfa: gigantes de brillo rojo se unen a la horda, no retroceden con los golpes y embisten por una línea roja que apuntan antes. Derrota a uno para ganar EXP, ₽ y el Premio del Alfa, una subida de nivel solo de cartas raras. Logros nuevos: Primer Alfa, Rastreador de Alfas y Cazador de Alfas, que da título.',
          },
          {
            pt: 'O mapa ataca: mais para o fim da partida caem raios na chuva, granizo na neve, Rock Slide na tempestade de areia, chamas no sol e Stealth Rock ou Toxic Spikes no chão, sempre onde você está e sempre marcados no chão antes de cair.',
            en: 'The map strikes back: later in a run, Thunder falls in the rain, hail in the snow, Rock Slide in a sandstorm, flames in the sun, and Stealth Rock or Toxic Spikes cover the ground, always where you stand and always marked on the ground before they land.',
            es: 'El mapa ataca: más adelante en la partida caen rayos con lluvia, granizo con nieve, Rock Slide en la tormenta de arena, llamas con sol, y Stealth Rock o Toxic Spikes cubren el suelo, siempre donde estás y siempre marcados en el suelo antes de caer.',
          },
          {
            pt: 'Missões de campo: um ovo em perigo para defender no ninho, Poké Balls perdidas para juntar contra o relógio e um Togepi perdido para levar para casa. Aparecem longe de você e pagam ₽ e um level-up de cartas raras.',
            en: 'Field missions: an egg in danger to defend in its nest, lost Poké Balls to gather against the clock and a lost Togepi to lead home. They show up away from you and pay ₽ and a level-up of rare cards.',
            es: 'Misiones de campo: un huevo en peligro que defender en su nido, Poké Balls perdidas que juntar contra el reloj y un Togepi perdido que llevar a casa. Aparecen lejos de ti y pagan ₽ y una subida de nivel de cartas raras.',
          },
          {
            pt: 'Chefes mais espertos, sem ganhar HP: miram no caminho que você vai fazer, saltam em quem foge e liberam um ataque novo na fúria. No Pesadelo cada um tem um ataque a mais, e no Difícil e no Pesadelo o Mewtwo tem uma segunda fase.',
            en: "Smarter bosses, with no extra HP: they aim at the path you're taking, leap at you when you keep away and unlock a new attack when enraged. On Nightmare each gets an extra attack, and on Hard and Nightmare Mewtwo has a second phase.",
            es: 'Jefes más astutos, sin ganar PS: apuntan al camino que vas a tomar, saltan sobre quien huye y liberan un ataque nuevo con la furia. En Pesadilla cada uno tiene un ataque más, y en Difícil y Pesadilla Mewtwo tiene una segunda fase.',
          },
          {
            pt: 'A horda do fim da partida recua menos com os golpes e bate mais forte, Iron e Assault Vest tiram no máximo metade de cada golpe, e quem está dominando sem levar dano vê a horda chegar mais rápida e mais perto (no Pesadelo, bem mais). O Normal continua tranquilo para quem se mexe.',
            en: "Late hordes get knocked back less and hit harder, Iron and Assault Vest take off at most half of a hit, and a player who's dominating without getting hurt sees the horde come faster and closer (much more so on Nightmare). Normal stays relaxed for anyone who keeps moving.",
            es: 'La horda del final de la partida retrocede menos con los golpes y pega más fuerte, Iron y Assault Vest quitan como máximo la mitad de cada golpe, y quien está dominando sin recibir daño ve a la horda llegar más rápido y más cerca (en Pesadilla, mucho más). Normal sigue tranquilo para quien se mueve.',
          },
        ],
      },
      {
        title: { pt: 'Ranking na hora', en: 'Instant ranking', es: 'Ranking al instante' },
        notes: [
          {
            pt: 'A sua partida entra no ranking assim que termina, sem o "Conferindo…" que podia durar horas. O servidor ainda confere as partidas do topo e do Desafio do dia, e só tira do ranking uma partida que não chega ao resultado que mostrou.',
            en: 'Your run joins the ranking as soon as it ends, without the "Checking…" that could last hours. The server still checks the runs at the top and the Daily Challenge, and only takes a run off the ranking when it doesn\'t end where it said.',
            es: 'Tu partida entra al ranking en cuanto termina, sin el "Revisando…" que podía durar horas. El servidor todavía revisa las partidas de la cima y del Desafío del día, y solo saca del ranking una partida que no llega al resultado que mostró.',
          },
          {
            pt: 'As fitas do Desafio do dia saem para todas as tentativas oficiais, sem esperar a conferência.',
            en: 'Daily Challenge ribbons go out for every official attempt, without waiting for the check.',
            es: 'Las cintas del Desafío del día salen para todos los intentos oficiales, sin esperar la revisión.',
          },
          {
            pt: 'Num computador com o relógio atrasado, o fim da partida dizia "Sem conexão" e ela não entrava no ranking, e o save também não sincronizava. Agora funciona com qualquer relógio, e as partidas que ficaram esperando entram no ranking na próxima vez que você abrir o jogo naquele navegador.',
            en: 'On a computer whose clock runs behind, the end of a run said "Offline" and the run never made the ranking, and the save didn\'t sync either. Now it works whatever the clock says, and runs left waiting make the ranking the next time you open the game in that browser.',
            es: 'En una computadora con el reloj atrasado, el final de la partida decía "Sin conexión" y no entraba al ranking, y la partida guardada tampoco se sincronizaba. Ahora funciona con cualquier reloj, y las partidas que quedaron esperando entran al ranking la próxima vez que abras el juego en ese navegador.',
          },
        ],
      },
      {
        title: { pt: 'O jogo não fecha mais no iPhone', en: 'No more closing on iPhone', es: 'El juego ya no se cierra en iPhone' },
        notes: [
          {
            pt: 'Em alguns iPhones o jogo fechava sozinho segundos depois de começar uma partida: ele preparava de uma vez o brilho de golpe de todos os Pokémon carregados e passava do limite de memória do aparelho. Agora cada um é preparado só quando leva o primeiro golpe, com bem menos memória.',
            en: "On some iPhones the game closed by itself seconds into a run: it prepared the hit flash of every loaded Pokémon at once and went past the device's memory limit. Now each one is prepared only when it takes its first hit, with far less memory.",
            es: 'En algunos iPhones el juego se cerraba solo segundos después de empezar una partida: preparaba de una vez el destello de golpe de todos los Pokémon cargados y pasaba el límite de memoria del aparato. Ahora cada uno se prepara solo cuando recibe su primer golpe, con mucha menos memoria.',
          },
        ],
      },
      {
        title: { pt: 'Os Exp. Candy não somem mais', en: 'Exp. Candies no longer vanish', es: 'Los Exp. Candy ya no desaparecen' },
        notes: [
          {
            pt: 'Com muitos Exp. Candy esquecidos pelo mapa, os Pokémon derrotados paravam de soltar doces novos: a EXP ia para um doce antigo, longe de você. Agora todo Pokémon derrotado solta o seu doce, e o doce mais antigo do chão se junta a ele, sem perder EXP.',
            en: 'With lots of Exp. Candies left around the map, fainted Pokémon stopped dropping new ones: the EXP went into an old candy, far from you. Now every fainted Pokémon drops its candy, and the oldest candy on the ground joins it, with no EXP lost.',
            es: 'Con muchos Exp. Candy olvidados por el mapa, los Pokémon derrotados dejaban de soltar caramelos nuevos: la EXP iba a un caramelo antiguo, lejos de ti. Ahora todo Pokémon derrotado suelta su caramelo, y el caramelo más antiguo del suelo se une a él, sin perder EXP.',
          },
        ],
      },
      {
        title: { pt: 'Convide amigos', en: 'Invite friends', es: 'Invita amigos' },
        notes: [
          {
            pt: 'A tela inicial ganhou o card Convide amigos: ele mostra o seu link de convite, as recompensas (1 amigo: Ovo da Amizade; 3: título e moldura Embaixador(a); 5: Ovo ultra raro, novo; 10: Dratini shiny, no lugar do Munchlax shiny, que já sai do Ovo da Amizade) e cada amigo que entrou pelo seu link, com quantas partidas ele já jogou.',
            en: 'The home screen has a new Invite friends card: it shows your invite link, the rewards (1 friend: Friendship Egg; 3: Ambassador title and frame; 5: Ultra rare egg, new; 10: shiny Dratini, replacing the shiny Munchlax, which already hatches from the Friendship Egg) and every friend who joined through your link, with how many runs they have played.',
            es: 'La pantalla de inicio tiene la nueva tarjeta Invita amigos: muestra tu link de invitación, las recompensas (1 amigo: Huevo de la Amistad; 3: título y marco Embajador(a); 5: Huevo ultra raro, nuevo; 10: Dratini shiny, en lugar del Munchlax shiny, que ya sale del Huevo de la Amistad) y cada amigo que entró por tu link, con cuántas partidas lleva.',
          },
          {
            pt: 'Um convite agora conta assim que o seu amigo termina 3 partidas, sem esperar a verificação delas, que podia levar horas. Convites que já tinham chegado lá contam sozinhos, e quem já passou de 5 amigos recebe o novo Ovo ultra raro.',
            en: "An invite now counts as soon as your friend finishes 3 runs, without waiting for their check, which could take hours. Invites that already got there count on their own, and anyone past 5 friends gets the new Ultra rare egg.",
            es: 'Una invitación ahora cuenta en cuanto tu amigo termina 3 partidas, sin esperar su verificación, que podía tardar horas. Las invitaciones que ya habían llegado cuentan solas, y quien ya pasó de 5 amigos recibe el nuevo Huevo ultra raro.',
          },
          {
            pt: 'O link de convite continua valendo quando o seu amigo o abre dentro do X ou do Instagram e passa para o navegador para entrar com o Google.',
            en: 'The invite link keeps working when your friend opens it inside X or Instagram and moves to the browser to sign in with Google.',
            es: 'El link de invitación sigue valiendo cuando tu amigo lo abre dentro de X o Instagram y pasa al navegador para entrar con Google.',
          },
        ],
      },
      {
        title: { pt: 'Tutor de Golpes que combina com você', en: 'A Move Tutor that suits you', es: 'Un Tutor de Movimientos a tu medida' },
        notes: [
          {
            pt: 'O Tutor de Golpes agora ensina golpes que combinam com o tipo da forma em que você está, e não mais qualquer tipo que faltasse: um Grovyle ouve falar de Earthquake, Crunch, U-turn ou Sludge Bomb, mas nunca de Water Shuriken. Os golpes continuam sendo de fora do repertório da família.',
            en: "The Move Tutor now teaches moves that suit your current form's type instead of any type you lacked: a Grovyle hears about Earthquake, Crunch, U-turn or Sludge Bomb, but never Water Shuriken. The moves are still ones its family doesn't learn on its own.",
            es: 'El Tutor de Movimientos ahora enseña movimientos que van con el tipo de tu forma actual, en lugar de cualquier tipo que te faltara: un Grovyle oye hablar de Earthquake, Crunch, U-turn o Sludge Bomb, pero nunca de Water Shuriken. Siguen siendo movimientos que su familia no aprende por su cuenta.',
          },
        ],
      },
      {
        title: { pt: 'Poké Balls que perguntam', en: 'Poké Balls that ask', es: 'Poké Balls que preguntan' },
        notes: [
          {
            pt: 'Quando uma Poké Ball traz um golpe ou item novo, que ocuparia um espaço, o jogo pausa e pergunta: Pegar ou Deixar. Se deixar, ele some. Melhorias do que você já tem continuam entrando sozinhas, e abrir uma Poké Ball agora tem um estalo e um brilho.',
            en: "When a Poké Ball holds a new move or item, one that would take a slot, the game pauses and asks: Take or Leave. Leave it and it's gone. Upgrades to what you already have still go in on their own, and opening a Poké Ball now pops and sparkles.",
            es: 'Cuando una Poké Ball trae un movimiento u objeto nuevo, que ocuparía un espacio, el juego se pausa y pregunta: Tomar o Dejar. Si lo dejas, desaparece. Las mejoras de lo que ya tienes siguen entrando solas, y abrir una Poké Ball ahora hace un chasquido y brilla.',
          },
        ],
      },
      {
        title: { pt: 'Novidades no lobby', en: "What's new, in the lobby", es: 'Novedades en el lobby' },
        notes: [
          {
            pt: 'O botão Novidades, no topo do lobby, pula com um "!" quando sai uma atualização e mostra os destaques dela. Ver tudo abre esta página, que agora vem organizada por atualização, com os destaques primeiro.',
            en: 'The What\'s new button, at the top of the lobby, hops with a "!" when an update comes out and shows its highlights. See everything opens this page, now organized by update, highlights first.',
            es: 'El botón Novedades, arriba en el lobby, salta con un "!" cuando sale una actualización y muestra sus destacados. Ver todo abre esta página, que ahora viene organizada por actualización, con los destacados primero.',
          },
        ],
      },
      {
        title: { pt: 'Presentes Misteriosos na caixa', en: 'Mystery Gifts in a box', es: 'Regalos Misteriosos en una caja' },
        notes: [
          {
            pt: 'Os Presentes Misteriosos agora esperam numa caixa ao lado do seu parceiro no lobby. Toque nela para abrir um de cada vez: um shiny choca na hora e o shiny à sua escolha abre direto a escolha, sem passar pelo Hall da Fama.',
            en: 'Mystery Gifts now wait in a box beside your partner in the lobby. Tap it to open them one at a time: a shiny hatches on the spot and a shiny of your choice opens its picker right away, no trip to the Hall of Fame.',
            es: 'Los Regalos Misteriosos ahora esperan en una caja junto a tu compañero en el lobby. Tócala para abrirlos de a uno: un shiny eclosiona en el momento y el shiny a tu elección abre la elección directo, sin pasar por el Salón de la Fama.',
          },
        ],
      },
      {
        title: { pt: 'Servidor no Discord', en: 'Discord server', es: 'Servidor en Discord' },
        notes: [
          {
            pt: 'O jogo ganhou um servidor no Discord, com as novidades, o pódio do Desafio do dia, o Surto do dia e salas para cada idioma. O botão do Discord fica no topo do lobby.',
            en: 'The game has a Discord server now, with the news, the Daily Challenge podium, the daily outbreak and rooms for each language. The Discord button sits at the top of the lobby.',
            es: 'El juego tiene un servidor en Discord, con las novedades, el podio del Desafío del día, el Brote del día y salas para cada idioma. El botón de Discord está arriba en el lobby.',
          },
          {
            pt: 'Conecte seu Discord à conta, no botão do Discord ou no Cartão de Treinador, para entrar no servidor direto e ganhar o cargo de apoiador. Também dá para entrar no jogo com o Discord.',
            en: 'Link your Discord to your account, from the Discord button or the Trainer Card, to join the server right away and get your supporter role. You can also sign in to the game with Discord.',
            es: 'Conecta tu Discord a tu cuenta, desde el botón de Discord o la Tarjeta de Entrenador, para entrar al servidor directo y recibir tu rol de patrocinador. También puedes entrar al juego con Discord.',
          },
          {
            pt: 'Quem conecta o Discord e entra no servidor ganha um Noibat shiny de Presente Misterioso, uma vez por conta. Quem já tinha conectado também recebe o seu.',
            en: 'Linking your Discord and joining the server brings a shiny Noibat as a Mystery Gift, once per account. Players who linked already get theirs too.',
            es: 'Quien conecta su Discord y entra al servidor gana un Noibat shiny como Regalo Misterioso, una vez por cuenta. Quien ya lo había conectado también recibe el suyo.',
          },
        ],
      },
      {
        title: { pt: 'TikTok oficial', en: 'Official TikTok', es: 'TikTok oficial' },
        notes: [
          {
            pt: 'O jogo tem um TikTok oficial, @pokemonsurvivors. Ele fica embaixo do Discord no lobby (no topo, com o celular deitado) e em Ajustes → Sobre.',
            en: "The game has an official TikTok, @pokemonsurvivors. It sits under Discord in the lobby (at the top with your phone sideways) and in Settings → About.",
            es: 'El juego tiene un TikTok oficial, @pokemonsurvivors. Está debajo de Discord en el lobby (arriba con el celular acostado) y en Ajustes → Acerca de.',
          },
        ],
      },
      {
        title: { pt: 'YouTube oficial', en: 'Official YouTube', es: 'YouTube oficial' },
        notes: [
          {
            pt: 'O canal oficial do jogo no YouTube é o @PokemonSurvivors, com o trailer, Shorts todo dia e um vídeo para cada atualização. Ele fica ao lado do TikTok no lobby e em Ajustes → Sobre.',
            en: "The game's official YouTube channel is @PokemonSurvivors, with the trailer, daily Shorts and a video for each update. It sits beside TikTok in the lobby and in Settings → About.",
            es: 'El canal oficial del juego en YouTube es @PokemonSurvivors, con el tráiler, Shorts todos los días y un video por cada actualización. Está junto al TikTok en el lobby y en Ajustes → Acerca de.',
          },
        ],
      },
      {
        title: { pt: 'Instagram oficial', en: 'Official Instagram', es: 'Instagram oficial' },
        notes: [
          {
            pt: 'O jogo também está no Instagram, @pokemonsurvivors, com Reels e carrosséis do jogo. Ele fica ao lado do TikTok e do YouTube no lobby e em Ajustes → Sobre.',
            en: 'The game is on Instagram too, @pokemonsurvivors, with Reels and carousels of the game. It sits beside TikTok and YouTube in the lobby and in Settings → About.',
            es: 'El juego también está en Instagram, @pokemonsurvivors, con Reels y carruseles del juego. Está junto a TikTok y YouTube en el lobby y en Ajustes → Acerca de.',
          },
        ],
      },
      {
        title: { pt: 'Normal ou Shiny, você escolhe', en: 'Normal or Shiny, your call', es: 'Normal o Shiny, tú eliges' },
        notes: [
          {
            pt: 'Um Pokémon que nasceu shiny do ovo (ou que você escolheu como apoiador) agora também tem o seletor Normal/Shiny na escolha do Pokémon, como os iniciais. O shiny continua seu, na Pokédex e nas conquistas: só muda a cor com que você joga, e a escolha vale no lobby, no Cartão de Treinador e no Hall da Fama, em todos os seus aparelhos.',
            en: 'A Pokémon that hatched shiny (or that you picked as a supporter) now gets the Normal/Shiny picker on the Pokémon select too, like the starters. The shiny stays yours, in the Pokédex and the achievements: only the colors you play change, and the pick shows in the lobby, on the Trainer Card and in the Hall of Fame, on all your devices.',
            es: 'Un Pokémon que nació shiny del huevo (o que elegiste como patrocinador) ahora también tiene el selector Normal/Shiny en la elección del Pokémon, como los iniciales. El shiny sigue siendo tuyo, en la Pokédex y en los logros: solo cambian los colores con los que juegas, y la elección se ve en el lobby, en la Tarjeta de Entrenador y en el Salón de la Fama, en todos tus dispositivos.',
          },
        ],
      },
      {
        title: { pt: 'Controle mais gostoso', en: 'Smoother gamepad play', es: 'Control más cómodo' },
        notes: [
          {
            pt: 'O analógico do controle agora anda em qualquer direção, e com a velocidade que você inclina, como o joystick de toque. O direcional e o teclado continuam em 8 direções.',
            en: 'The gamepad stick now moves in any direction, at the speed you tilt it, like the touch joystick. The D-pad and the keyboard stay at 8 directions.',
            es: 'El stick del control ahora se mueve en cualquier dirección, con la velocidad con que lo inclinas, como el joystick táctil. La cruceta y el teclado siguen en 8 direcciones.',
          },
          {
            pt: 'Apertar A (ou Espaço) para o especial na hora em que a partida acaba não começa outra sem querer: a tela de resultado espera uma pausa curta nos seus toques.',
            en: "Pressing A (or Space) for the special right as a run ends no longer starts another by accident: the results screen waits for a short pause in your presses.",
            es: 'Apretar A (o Espacio) para el especial justo cuando termina la partida ya no empieza otra sin querer: la pantalla de resultados espera una breve pausa en tus pulsaciones.',
          },
        ],
      },
      {
        title: { pt: 'Level-up sem toque com tudo no máximo', en: 'No more tapping when everything is maxed', es: 'Subir de nivel sin tocar con todo al máximo' },
        notes: [
          {
            pt: 'Com todos os golpes e itens no máximo, o level-up só tinha a Oran Berry para escolher. Agora ela é pega sozinha, sem abrir a tela, e um aviso rápido mostra o nível e quantas foram (com o Exp. Share, várias de uma vez).',
            en: 'With every move and item maxed out, a level-up only had the Oran Berry to pick. Now it takes itself without opening the screen, and a quick notice shows the level and how many you got (several at once with an Exp. Share).',
            es: 'Con todos los movimientos e ítems al máximo, subir de nivel solo ofrecía la Oran Berry. Ahora se toma sola, sin abrir la pantalla, y un aviso rápido muestra el nivel y cuántas fueron (con el Exp. Share, varias a la vez).',
          },
        ],
      },
      {
        title: { pt: 'Menos clarões, disparos mais visíveis', en: 'Fewer flashes, easier-to-see shots', es: 'Menos destellos, disparos más visibles' },
        notes: [
          {
            pt: 'Nova opção em Ajustes → Jogo: Clarões Reduzidos. Some o clarão branco da tela (fúria dos chefes, fendas, Mega Evolução, evolução, ovos chocando), os Pokémon atingidos ficam com um tom vermelho escuro em vez de piscar em branco e nada pisca rápido.',
            en: 'New option in Settings → Game: Flashes Reduced. No more white screen flashes (enraged bosses, rifts, Mega Evolution, evolving, hatching eggs), Pokémon that get hit take a dark red tint instead of flashing white, and nothing flickers fast.',
            es: 'Nueva opción en Ajustes → Juego: Destellos Reducidos. Se van los destellos blancos de la pantalla (furia de los jefes, grietas, Megaevolución, evolución, huevos que eclosionan), los Pokémon golpeados toman un tono rojo oscuro en vez de parpadear en blanco y nada parpadea rápido.',
          },
          {
            pt: 'Os disparos inimigos (cuspidores, chefes e o próprio mapa) agora têm um contorno vermelho, para não se perderem no meio dos seus golpes.',
            en: 'Enemy shots (spitters, bosses and the map itself) now have a red outline, so they stand out among your own attacks.',
            es: 'Los disparos enemigos (escupidores, jefes y el propio mapa) ahora tienen un contorno rojo, para que no se pierdan entre tus ataques.',
          },
        ],
      },
      {
        title: { pt: 'Troféu de zerado', en: 'Clear trophies', es: 'Trofeo de superado' },
        notes: [
          {
            pt: 'Venceu o Mewtwo com um Pokémon? A linha evolutiva dele ganha um troféu na Pokédex e na escolha de parceiro: bronze no Normal, prata no Difícil e ouro no Pesadelo. A Pokédex conta quantos você já zerou, para tentar zerar com todos. Ideia de @havenlad no Mural de ideias.',
            en: 'Beat Mewtwo with a Pokémon? Its evolution line gets a trophy in the Pokédex and on the partner select: bronze on Normal, silver on Hard, gold on Nightmare. The Pokédex counts how many you cleared, so you can go for a clear with every one. An idea from @havenlad on the Ideas board.',
            es: '¿Venciste a Mewtwo con un Pokémon? Su línea evolutiva gana un trofeo en la Pokédex y en la elección de compañero: bronce en Normal, plata en Difícil y oro en Pesadilla. La Pokédex cuenta cuántos superaste, para intentar superarlo con todos. Idea de @havenlad en el Muro de ideas.',
          },
          {
            pt: 'Vitórias de antes dos troféus também contam. Com conta, toda vitória que está no ranking ganha o troféu na próxima vez que o jogo sincronizar. Sem conta, valem as que o seu histórico prova (por exemplo, um inicial que é o único que você jogou da região). Antes, quem tinha vencido com vários Pokémon ficava sem troféu por essas vitórias; obrigado a @justwex pelo aviso.',
            en: "Wins from before trophies existed count too. With an account, every win on the ranking gets its trophy the next time the game syncs. Without one, the ones your records prove do (for example, a starter that's the only one you played from its region). Before, if you had won with several Pokémon, those wins got no trophy; thanks to @justwex for the report.",
            es: 'Las victorias de antes de los trofeos también cuentan. Con cuenta, toda victoria que está en el ranking gana su trofeo la próxima vez que el juego sincronice. Sin cuenta, valen las que tu historial prueba (por ejemplo, un inicial que es el único que jugaste de su región). Antes, si habías ganado con varios Pokémon, esas victorias no daban trofeo; gracias a @justwex por el aviso.',
          },
        ],
      },
      {
        title: { pt: 'Tamanho da interface', en: 'UI size', es: 'Tamaño de la interfaz' },
        notes: [
          {
            pt: 'Em telas grandes, os menus e o HUD agora crescem junto com o mapa em vez de ficarem minúsculos. Em Ajustes → Jogo dá para escolher o tamanho, de 100% a 200%, ou deixar no Auto. No celular nada muda.',
            en: 'On big screens, the menus and the HUD now grow with the map instead of staying tiny. Pick the size in Settings → Game, from 100% to 200%, or leave it on Auto. Nothing changes on phones.',
            es: 'En pantallas grandes, los menús y el HUD ahora crecen junto con el mapa en vez de quedarse diminutos. En Ajustes → Juego puedes elegir el tamaño, de 100% a 200%, o dejarlo en Auto. En el celular no cambia nada.',
          },
        ],
      },
      {
        title: { pt: 'Instale o jogo como app', en: 'Install the game as an app', es: 'Instala el juego como app' },
        notes: [
          {
            pt: 'Ajustes → Sobre agora tem Instalar o app: no Android e no computador (Chrome, Edge) o jogo vira um ícone que abre em tela cheia, sem a barra do navegador. No iPhone e no iPad, o botão mostra como fazer pelo Safari: Compartilhar → Adicionar à Tela de Início.',
            en: "Settings → About now has Install the app: on Android and on computers (Chrome, Edge) the game becomes an icon that opens fullscreen, without the browser bar. On iPhone and iPad, the button shows how to do it in Safari: Share → Add to Home Screen.",
            es: 'Ajustes → Acerca de ahora tiene Instalar la app: en Android y en la computadora (Chrome, Edge) el juego se vuelve un ícono que abre en pantalla completa, sin la barra del navegador. En iPhone y iPad, el botón muestra cómo hacerlo en Safari: Compartir → Agregar a pantalla de inicio.',
          },
        ],
      },
      {
        title: { pt: 'Reportar bug', en: 'Report a bug', es: 'Reportar un error' },
        notes: [
          {
            pt: 'Achou um bug? Em Ajustes → Sobre, ou direto na pausa, conte o que aconteceu e mande, sem precisar de conta. Junto vão dados técnicos (versão, aparelho, tela e os últimos erros do jogo), que você pode desligar e ver antes de enviar.',
            en: "Found a bug? From Settings → About, or straight from the pause screen, tell us what happened and send it, no account needed. Technical info goes along (version, device, screen and the game's last errors), which you can turn off and look at before sending.",
            es: '¿Encontraste un error? En Ajustes → Acerca de, o directo en la pausa, cuenta lo que pasó y envíalo, sin necesitar cuenta. Van junto datos técnicos (versión, dispositivo, pantalla y los últimos errores del juego), que puedes apagar y ver antes de enviar.',
          },
          {
            pt: 'Se o jogo fechar sozinho no meio de uma partida, na próxima vez que você abrir ele pergunta se quer reportar, com o que deu para salvar da partida, para a gente achar o problema.',
            en: 'If the game closes by itself in the middle of a run, the next time you open it asks whether you want to report it, with what it could save about the run, so we can track the problem down.',
            es: 'Si el juego se cierra solo en medio de una partida, la próxima vez que lo abras pregunta si quieres reportarlo, con lo que pudo guardar de la partida, para que encontremos el problema.',
          },
        ],
      },
      {
        title: { pt: 'Sempre na versão nova', en: 'Always on the latest version', es: 'Siempre en la versión nueva' },
        notes: [
          {
            pt: 'Quem deixava o jogo aberto enquanto saía uma atualização podia ficar sem abrir as Novidades. Agora o jogo percebe a versão nova e recarrega sozinho no menu, ou ao fim da partida se você estiver jogando. Seu progresso fica salvo.',
            en: "If the game stayed open while an update came out, What's new could fail to open. Now the game notices the new version and reloads on its own in the menus, or at the end of the run if you're playing. Your progress stays saved.",
            es: 'Si el juego quedaba abierto mientras salía una actualización, las Novedades podían no abrir. Ahora el juego detecta la versión nueva y se recarga solo en el menú, o al final de la partida si estás jugando. Tu progreso queda guardado.',
          },
        ],
      },
    ],
  },
  {
    date: '2026-10-18',
    title: { pt: 'Muito mais golpes', en: 'Many more moves', es: 'Muchos más movimientos' },
    highlights: [
      { pt: '196 golpes, e cada família tem a sua assinatura.', en: '196 moves, and every family has its own signature.', es: '196 movimientos, y cada familia tiene su firma.' },
      { pt: 'Todo golpe se divide em dois caminhos no Nv 4 e no Nv 7: cada partida joga de um jeito.', en: 'Every move splits into two paths at Lv 4 and Lv 7: no two runs play the same.', es: 'Todo movimiento se divide en dos caminos en el Nv. 4 y en el Nv. 7: cada partida se juega distinto.' },
      { pt: 'Habilidades: escolha 1 de 3 na primeira evolução, e o Eevee escolhe a sua eeveelution.', en: 'Abilities: pick 1 of 3 at your first evolution, and Eevee picks its eeveelution.', es: 'Habilidades: elige 1 de 3 en la primera evolución, y Eevee elige su eeveelución.' },
      { pt: 'TMs dos chefes, Tutor de Golpes no mapa, golpes lendários e golpes em dupla.', en: 'TMs from bosses, a Move Tutor on the map, legendary moves and duo moves.', es: 'MT de los jefes, Tutor de Movimientos en el mapa, movimientos legendarios y en dúo.' },
      { pt: 'A pausa mostra a sua ficha de status, e cada golpe tem a sua ficha.', en: 'The pause screen shows your stat sheet, and every move has its own card.', es: 'La pausa muestra tu ficha de estadísticas, y cada movimiento tiene su ficha.' },
    ],
    changes: [
      {
        title: { pt: 'Ficha de status na pausa', en: 'Stat sheet on the pause screen', es: 'Ficha de estadísticas en la pausa' },
        notes: [
          {
            pt: 'A pausa agora mostra a ficha completa da partida: vida máxima, dano, recarga, área, velocidade, regeneração, alcance de coleta e os bônus de tipo, status e dinheiro assim que você os tiver, cada um com quantas cartas de upgrade você já pegou para ele.',
            en: "The pause screen now shows the run's full stat sheet: max HP, damage, cooldown, area, speed, regen, pickup range and the type, status and money bonuses once you have them, each with how many upgrade cards you've taken for it.",
            es: 'La pausa ahora muestra la ficha completa de la partida: vida máxima, daño, recarga, área, velocidad, regeneración, alcance de recogida y los bonos de tipo, estado y dinero en cuanto los tengas, cada uno con cuántas cartas de mejora ya tomaste para él.',
          },
          {
            pt: 'Golpes e itens aparecem em listas separadas com o nível de cada um (MAX quando chegam ao topo), e no celular a ficha rola enquanto os botões ficam sempre à mão.',
            en: 'Moves and held items get their own lists with each level (MAX once they top out), and on phones the sheet scrolls while the buttons stay within reach.',
            es: 'Los movimientos y los objetos tienen listas propias con el nivel de cada uno (MAX cuando llegan al tope), y en el celular la ficha se desplaza mientras los botones quedan siempre a mano.',
          },
        ],
      },
      {
        title: { pt: 'Ficha do golpe', en: 'Move cards', es: 'Ficha del movimiento' },
        notes: [
          {
            pt: 'Passe o mouse sobre um golpe na barra do topo, na pausa ou nas cartas de subida de nível (no celular, segure o dedo) para ver a ficha dele: dano e recarga já com os seus itens e bônus, projéteis, área, duração, perfuração e chance de status quando o golpe usa, o nível e do que ele precisa para evoluir.',
            en: 'Hover a move in the top bar, the pause menu or the level-up cards (on phones, hold your finger on it) to see its card: damage and cooldown with your items and bonuses applied, projectiles, area, duration, pierce and status chance when the move uses them, its level and what it needs to evolve.',
            es: 'Pasa el ratón por un movimiento en la barra superior, en la pausa o en las cartas de subida de nivel (en el celular, mantén el dedo encima) para ver su ficha: daño y recarga con tus objetos y bonificaciones, proyectiles, área, duración, perforación y probabilidad de estado cuando el movimiento los usa, su nivel y lo que necesita para evolucionar.',
          },
          {
            pt: 'Nas cartas de subida de nível, a ficha mostra o antes e o depois de cada melhoria. Segurar a carta só abre a ficha: ela nunca escolhe a carta sem querer.',
            en: 'On level-up cards, the card shows each upgrade before and after. Holding a card only opens its details: it never picks the card by accident.',
            es: 'En las cartas de subida de nivel, la ficha muestra el antes y el después de cada mejora. Mantener pulsada la carta solo abre la ficha: nunca la elige sin querer.',
          },
        ],
      },
      {
        title: { pt: 'Mega Evolução sem travar o jogo', en: 'Mega Evolution no longer freezes the game', es: 'La Megaevolución ya no congela el juego' },
        notes: [
          {
            pt: 'Mega Evoluir enquanto o especial ainda carregava travava o jogo e a partida se perdia. Acontecia com os Megas cujo especial é uma sequência de investidas: Raichu X, Feraligatr, Scizor, Blaziken, Gallade, Banette e Greninja. Agora a carga é cancelada e o especial do Mega já vem pronto. Obrigado ao @DashtheBard pelo aviso!',
            en: 'Mega Evolving while your special was still charging froze the game and the run was lost. It happened with the Megas whose special is a chain of dashes: Raichu X, Feraligatr, Scizor, Blaziken, Gallade, Banette and Greninja. Now the charge is canceled and the Mega’s special comes ready. Thanks to @DashtheBard for the report!',
            es: 'Megaevolucionar mientras el especial aún se cargaba congelaba el juego y se perdía la partida. Pasaba con los Megas cuyo especial es una cadena de embestidas: Raichu X, Feraligatr, Scizor, Blaziken, Gallade, Banette y Greninja. Ahora la carga se cancela y el especial del Mega ya viene listo. ¡Gracias a @DashtheBard por el aviso!',
          },
        ],
      },
      {
        title: { pt: 'Golpes, golpes e mais golpes', en: 'Moves, moves and more moves', es: 'Movimientos, movimientos y más movimientos' },
        notes: [
          {
            pt: 'A ideia mais votada do mural de ideias (71 votos) dizia que os golpes eram poucos e as partidas, todas iguais. Agora são 196 golpes, e cada família tem a sua assinatura: Brave Bird, Weather Ball, Spore, Fiery Dance, Gigaton Hammer, Moonblast e dezenas de outras, cada uma com um jeito próprio de jogar.',
            en: 'The top idea on the ideas board (71 votes) said moves were too few and every run felt the same. Now there are 196 moves, and every family has its own signature: Brave Bird, Weather Ball, Spore, Fiery Dance, Gigaton Hammer, Moonblast and dozens more, each one playing its own way.',
            es: 'La idea más votada del muro de ideas (71 votos) decía que había pocos movimientos y que todas las partidas eran iguales. Ahora son 196 movimientos, y cada familia tiene su firma: Brave Bird, Weather Ball, Spore, Fiery Dance, Gigaton Hammer, Moonblast y decenas más, cada una con su propia forma de jugar.',
          },
          {
            pt: 'Os golpes que um Pokémon aprende crescem a cada evolução, e a lista final tem mais golpes do que os 6 espaços: toda partida deixa alguns de fora. A partida começa com um draft do 2º golpe.',
            en: 'The moves a Pokémon learns grow with each evolution, and the final list has more moves than the 6 slots: every run leaves some out. A run starts with a draft for your 2nd move.',
            es: 'Los movimientos que aprende un Pokémon crecen con cada evolución, y la lista final tiene más movimientos que los 6 espacios: cada partida deja algunos fuera. La partida empieza con un draft de tu 2.º movimiento.',
          },
          {
            pt: 'Todo golpe base se divide em dois caminhos no Nv 4 e no Nv 7, que mudam como ele joga (ricochetear, explodir, deixar rastro, ecoar…). Cards raros sobem 2 níveis, cards shiny são uma escolha grátis, e o botão Esquecer tira da partida o que você não quer ver.',
            en: 'Every base move splits into two paths at Lv 4 and Lv 7 that change how it plays (bouncing, exploding, leaving a trail, echoing…). Rare cards give 2 levels, shiny cards are a free pick, and the Forget button takes what you don’t want out of the run.',
            es: 'Todo movimiento base se divide en dos caminos en el Nv. 4 y en el Nv. 7, que cambian cómo juega (rebotar, explotar, dejar un rastro, hacer eco…). Las cartas raras suben 2 niveles, las shiny son una elección gratis, y el botón Olvidar saca de la partida lo que no quieres ver.',
          },
          {
            pt: '91 Habilidades: na primeira evolução você escolhe 1 de 3, a Oculta incluída. Eevee escolhe entre as 8 eeveelutions, e Kirlia, Snorunt, Poliwhirl, Scyther e Charcadet também ramificam. Chegou a Mega Gallade: 38 Megas.',
            en: '91 Abilities: at the first evolution you pick 1 of 3, the Hidden one included. Eevee picks among its 8 eeveelutions, and Kirlia, Snorunt, Poliwhirl, Scyther and Charcadet branch too. Mega Gallade is here: 38 Megas.',
            es: '91 Habilidades: en la primera evolución eliges 1 de 3, la Oculta incluida. Eevee elige entre sus 8 eeveeluciones, y Kirlia, Snorunt, Poliwhirl, Scyther y Charcadet también se ramifican. Llegó Mega Gallade: 38 Megas.',
          },
          {
            pt: 'Agora todo golpe comum evolui, com 7 itens de tipo novos (Black Belt, Metal Coat, Spell Tag, Black Glasses, Twisted Spoon, Soft Sand e Fairy Feather), e os golpes evoluídos mudam de forma e seguem subindo até o Nv 5.',
            en: 'Every regular move now evolves, with 7 new type items (Black Belt, Metal Coat, Spell Tag, Black Glasses, Twisted Spoon, Soft Sand and Fairy Feather), and evolved moves change shape and keep growing up to Lv 5.',
            es: 'Ahora todo movimiento común evoluciona, con 7 objetos de tipo nuevos (Black Belt, Metal Coat, Spell Tag, Black Glasses, Twisted Spoon, Soft Sand y Fairy Feather), y los movimientos evolucionados cambian de forma y siguen subiendo hasta el Nv. 5.',
          },
          {
            pt: 'Golpes de fora do repertório: chefes derrotados deixam um TM (Rock Slide, Ice Beam, Psystrike…), o Tutor de Golpes arma a tenda no mapa, e vencer uma fenda oferece o golpe lendário do próprio lendário (Sacred Fire, Origin Pulse, Roar of Time…). Com os espaços cheios: "1, 2 e… Puf!".',
            en: 'Moves from outside the learnset: beaten bosses drop a TM (Rock Slide, Ice Beam, Psystrike…), the Move Tutor pitches a tent on the map, and clearing a rift offers the legendary’s own move (Sacred Fire, Origin Pulse, Roar of Time…). With every slot full: "1, 2 and… Poof!".',
            es: 'Movimientos de fuera de la lista: los jefes derrotados dejan una MT (Rock Slide, Ice Beam, Psystrike…), el Tutor de Movimientos arma su carpa en el mapa, y ganar una grieta ofrece el movimiento legendario del propio legendario (Sacred Fire, Origin Pulse, Roar of Time…). Con los espacios llenos: "1, 2 y… ¡Puf!".',
          },
          {
            pt: 'Golpes em dupla: dois golpes no máximo com os tipos certos se unem em Fire Pledge, Water Pledge, Grass Pledge, Fusion Flare, Fusion Bolt, Ion Deluge, Freeze-Dry ou Nightmare (um por partida). E baús trancados podem esconder um item amaldiçoado: Life Orb, Choice Band, Flame Orb ou Iron Ball, muito fortes, com um preço.',
            en: 'Duo moves: two maxed moves of the right types fuse into Fire Pledge, Water Pledge, Grass Pledge, Fusion Flare, Fusion Bolt, Ion Deluge, Freeze-Dry or Nightmare (one per run). And locked chests may hide a cursed item: Life Orb, Choice Band, Flame Orb or Iron Ball, very strong, at a price.',
            es: 'Movimientos en dúo: dos movimientos al máximo de los tipos correctos se unen en Fire Pledge, Water Pledge, Grass Pledge, Fusion Flare, Fusion Bolt, Ion Deluge, Freeze-Dry o Nightmare (uno por partida). Y los cofres cerrados pueden esconder un objeto maldito: Life Orb, Choice Band, Flame Orb o Iron Ball, muy fuertes, con un precio.',
          },
        ],
      },
    ],
  },
  {
    date: '2026-10-17',
    title: { pt: 'Um lobby novo', en: 'A brand-new lobby', es: 'Un lobby nuevo' },
    highlights: [
      { pt: 'O título virou um lobby, com o seu parceiro passeando pelo gramado.', en: 'The title screen became a lobby, with your partner strolling on the grass.', es: 'El título ahora es un lobby, con tu compañero paseando por el pasto.' },
      { pt: 'Nova escolha de parceiro, com os 27 iniciais numa grade só.', en: 'A new partner select, with all 27 starters on a single grid.', es: 'Nueva selección de compañero, con los 27 iniciales en una sola cuadrícula.' },
      { pt: 'Shinx, Roggenrola e Deino chegaram aos ovos.', en: 'Shinx, Roggenrola and Deino now hatch from eggs.', es: 'Shinx, Roggenrola y Deino ahora salen de los huevos.' },
      { pt: 'Mural de ideias: peça e vote no que você quer ver no jogo.', en: 'Ideas board: ask for and vote on what you want in the game.', es: 'Muro de ideas: pide y vota lo que quieres ver en el juego.' },
      { pt: 'Cair numa fenda não acaba mais a partida.', en: 'Falling in a rift no longer ends your run.', es: 'Caer en una grieta ya no termina la partida.' },
    ],
    changes: [
      {
        title: { pt: 'Shinx chegou aos ovos', en: 'Shinx hatches from eggs', es: 'Shinx sale de los huevos' },
        notes: [
          {
            pt: 'Shinx › Luxio › Luxray é a nova família do Ovo comum: um lince elétrico rápido que acerta em cadeia com Shock Wave, e o olhar do Luxray faz os choques paralisarem com mais frequência. São 55 famílias nos ovos e 82 Pokémon jogáveis.',
            en: 'Shinx › Luxio › Luxray is the new Common Egg family: a quick electric lynx that chains Shock Wave from foe to foe, and Luxray’s glare makes its shocks paralyze more often. That makes 55 egg families and 82 playable Pokémon.',
            es: 'Shinx › Luxio › Luxray es la nueva familia del Huevo común: un lince eléctrico rápido que encadena Shock Wave de enemigo en enemigo, y la mirada de Luxray hace que sus descargas paralicen más seguido. Son 55 familias en los huevos y 82 Pokémon jugables.',
          },
        ],
      },
      {
        title: { pt: 'Roggenrola chegou aos ovos', en: 'Roggenrola hatches from eggs', es: 'Roggenrola sale de los huevos' },
        notes: [
          {
            pt: 'Roggenrola › Boldore › Gigalith é a nova família do Ovo comum, ao lado do Geodude: uma pedra de couraça grossa que derruba Rock Tomb nos inimigos, e os cristais do Gigalith fazem cada golpe pegar uma área maior. São 54 famílias nos ovos e 81 Pokémon jogáveis. Pedido do @RedmanRubels no X!',
            en: 'Roggenrola › Boldore › Gigalith is the new Common Egg family, alongside Geodude: a thick-armored rock that drops Rock Tomb on foes, and Gigalith’s crystals make every hit cover a wider area. That makes 54 egg families and 81 playable Pokémon. Requested by @RedmanRubels on X!',
            es: 'Roggenrola › Boldore › Gigalith es la nueva familia del Huevo común, junto a Geodude: una roca de coraza gruesa que deja caer Rock Tomb sobre los enemigos, y los cristales de Gigalith hacen que cada golpe cubra más área. Son 54 familias en los huevos y 81 Pokémon jugables. ¡Pedido de @RedmanRubels en X!',
          },
        ],
      },
      {
        title: { pt: 'Cair numa fenda não acaba a partida', en: 'Falling in a rift no longer ends the run', es: 'Caer en una grieta ya no termina la partida' },
        notes: [
          {
            pt: 'Se o seu HP chegar a zero na arena de uma fenda lendária, você não perde mais a partida: o seu Pokémon desmaia, a fenda o puxa de volta e você reaparece no mapa com 30% do HP, sem a recompensa da fenda. O Revive fica guardado para depois. Ideia do @holyfield no mural de ideias!',
            en: 'If your HP hits zero in a legendary rift’s arena, the run is no longer over: your Pokémon faints, the rift pulls it back and you land on the map with 30% HP, without the rift’s reward. Your Revive stays in the Bag for later. An idea from @holyfield on the ideas board!',
            es: 'Si tu HP llega a cero en la arena de una grieta legendaria, ya no pierdes la partida: tu Pokémon se debilita, la grieta lo jala de vuelta y reapareces en el mapa con 30% de HP, sin la recompensa de la grieta. Tu Revive queda guardado para después. ¡Idea de @holyfield en el muro de ideas!',
          },
        ],
      },
      {
        title: { pt: 'Hall da Fama sem pedestais vazios', en: 'No more empty pedestals in the Hall of Fame', es: 'Salón de la Fama sin pedestales vacíos' },
        notes: [
          {
            pt: 'Aberto pelo Cartão de Treinador, o Hall da Fama deixava os pedestais das Lendas vazios. Agora os Pokémon sempre aparecem, e enquanto carregam uma Poké Ball balança no lugar deles. Se um não carregar, a Poké Ball fica lá em vez de um espaço em branco.',
            en: 'Opened from the Trainer Card, the Hall of Fame left the Legends’ pedestals empty. Now the Pokémon always show up, and a Poké Ball wobbles in their place while they load. If one doesn’t load, the Poké Ball stays instead of a blank space.',
            es: 'Abierto desde la Tarjeta de Entrenador, el Salón de la Fama dejaba vacíos los pedestales de las Leyendas. Ahora los Pokémon siempre aparecen, y mientras cargan una Poké Ball se balancea en su lugar. Si uno no carga, la Poké Ball se queda en vez de un espacio en blanco.',
          },
        ],
      },
      {
        title: { pt: 'Mural de ideias', en: 'Ideas board', es: 'Muro de ideas' },
        notes: [
          {
            pt: 'Agora você pode pedir o que quer ver no jogo! Toque em Ideias no menu principal (ou abra pokemonsurvivors.com/?ideias): dá para ler as ideias de todo mundo, votar a favor ou contra com uma conta e mandar as suas (até 3 por dia). As mais votadas entram na fila, e as que chegam ao jogo aparecem na aba Feitas.',
            en: 'Now you can ask for what you want to see in the game! Tap Ideas in the main menu (or open pokemonsurvivors.com/?ideias): read everyone’s ideas, vote them up or down with an account and send your own (up to 3 a day). The most voted go in the queue, and the ones that make it into the game show up in the Shipped tab.',
            es: '¡Ahora puedes pedir lo que quieres ver en el juego! Toca Ideas en el menú principal (o abre pokemonsurvivors.com/?ideias): lee las ideas de todos, vota a favor o en contra con una cuenta y envía las tuyas (hasta 3 por día). Las más votadas entran en la fila, y las que llegan al juego aparecen en la pestaña Hechas.',
          },
        ],
      },
      {
        title: { pt: 'O jogo reconhece o seu controle', en: 'The game recognizes your gamepad', es: 'El juego reconoce tu control' },
        notes: [
          {
            pt: 'Com mais de um controle ligado (Joy-Cons, um controle virtual), um botão segurado em um deles escondia o mesmo botão apertado no outro: o controle Xbox parecia não funcionar na tela de Controles. Agora cada controle conta sozinho.',
            en: 'With more than one gamepad on (Joy-Cons, a virtual controller), a button held on one hid the same button pressed on the other, so an Xbox controller seemed dead in the Controls screen. Now each gamepad counts on its own.',
            es: 'Con más de un control encendido (Joy-Cons, un control virtual), un botón presionado en uno escondía el mismo botón en el otro, y el control de Xbox parecía no funcionar en la pantalla de Controles. Ahora cada control cuenta por separado.',
          },
          {
            pt: 'A tela de Controles mostra o nome do controle conectado, ou o que fazer quando o navegador ainda não o vê, e os botões aparecem como no seu controle: A B X Y no Xbox, ✕ ○ □ △ no PlayStation e B A Y X no Nintendo. As setas ← → do direcional não aparecem mais como um traço.',
            en: 'The Controls screen names the gamepad connected, or says what to do while the browser doesn’t see it yet, and the buttons show as printed on your pad: A B X Y on Xbox, ✕ ○ □ △ on PlayStation and B A Y X on Nintendo. The D-pad’s ← → no longer show as a dash.',
            es: 'La pantalla de Controles muestra el nombre del control conectado, o qué hacer mientras el navegador todavía no lo ve, y los botones aparecen como en tu control: A B X Y en Xbox, ✕ ○ □ △ en PlayStation y B A Y X en Nintendo. Las flechas ← → de la cruceta ya no aparecen como un guion.',
          },
          {
            pt: 'Jogando com o controle, as dicas das telas e os botões do HUD mostram os botões do controle no lugar das teclas, e os atalhos que só existem no teclado saem da frente. Basta apertar uma tecla para voltar às dicas do teclado.',
            en: 'Playing with a gamepad, the screens’ hints and the HUD show its buttons instead of keys, and keyboard-only shortcuts step aside. Press any key to get the keyboard hints back.',
            es: 'Jugando con el control, las pistas de las pantallas y los botones del HUD muestran sus botones en lugar de las teclas, y los atajos que solo existen en el teclado se apartan. Presiona una tecla para volver a las pistas del teclado.',
          },
        ],
      },
      {
        title: { pt: 'Fim do rastro de imagens no celular', en: 'No more smeared images on phones', es: 'Adiós al rastro de imágenes en el celular' },
        notes: [
          {
            pt: 'Em partidas longas no celular, o navegador às vezes reinicia a placa de vídeo para liberar memória. Quando isso acontecia, o chão sumia e os Pokémon passavam a deixar rastros pela tela, até virar um borrão. Agora o jogo redesenha tudo na hora e a partida segue normal. Obrigado ao @franbarquero pelo vídeo!',
            en: 'In long runs on phones, the browser sometimes resets the graphics card to free memory. When that happened, the ground vanished and the Pokémon left trails across the screen until it all turned into a smear. Now the game redraws everything right away and the run goes on normally. Thanks to @franbarquero for the video!',
            es: 'En partidas largas en el celular, el navegador a veces reinicia la tarjeta gráfica para liberar memoria. Cuando pasaba, el suelo desaparecía y los Pokémon dejaban rastros por la pantalla hasta volverse un borrón. Ahora el juego vuelve a dibujar todo al instante y la partida sigue normal. ¡Gracias a @franbarquero por el video!',
          },
        ],
      },
      {
        title: { pt: 'Remapear com o controle', en: 'Remapping with a gamepad', es: 'Reasignar con el control' },
        notes: [
          {
            pt: 'Na tela de Controles, escolher uma ação com o botão A do controle ficava esperando uma tecla do teclado, e o controle parecia não ser detectado. Agora a troca aceita a tecla ou o botão que você apertar, venha do teclado ou do controle.',
            en: 'In the Controls screen, picking an action with the gamepad’s A button waited for a keyboard key, so the gamepad seemed undetected. Now it takes the key or button you press next, from the keyboard or the gamepad.',
            es: 'En la pantalla de Controles, elegir una acción con el botón A del control esperaba una tecla del teclado, y el control parecía no detectarse. Ahora acepta la tecla o el botón que presiones, del teclado o del control.',
          },
        ],
      },
      {
        title: { pt: 'Passeie com seu parceiro no menu', en: 'Take your partner for a walk in the menu', es: 'Pasea con tu compañero en el menú' },
        notes: [
          {
            pt: 'No menu principal, seu parceiro agora pula do palco e passeia pelo gramado: use WASD no computador, ou toque na grama (ou arraste, como no joystick) no celular. Os Pokémon selvagens que passam por ali respondem ao oi com o próprio grito e um balão: alguns pulam de alegria, outros rodopiam, os tímidos fogem e alguns ficam tão felizes que seguem você por um tempo. Depois de um descanso, o parceiro volta sozinho para o palco.',
            en: 'In the main menu, your partner now hops off its stage and walks around the meadow: use WASD on a computer, or tap the grass (or drag, like the joystick) on a phone. The wild Pokémon wandering by answer its hello with their cry and a speech bubble: some hop with joy, some twirl, shy ones run off, and some are so happy they follow you for a while. After a rest, your partner walks back to its stage on its own.',
            es: 'En el menú principal, tu compañero ahora salta del escenario y pasea por el prado: usa WASD en la computadora, o toca el pasto (o arrastra, como el joystick) en el celular. Los Pokémon salvajes que pasan responden al saludo con su grito y un globo: algunos saltan de alegría, otros giran, los tímidos huyen y algunos se ponen tan contentos que te siguen un rato. Después de descansar, tu compañero vuelve solo al escenario.',
          },
        ],
      },
      {
        title: { pt: 'Teclas WASD no lugar do joystick no computador', en: 'WASD keys instead of the joystick on computers', es: 'Teclas WASD en lugar del joystick en la computadora' },
        notes: [
          {
            pt: 'Com o joystick fixo ligado, o computador mostrava o joystick de toque no canto da tela. Agora, com mouse e teclado, esse canto mostra as teclas de movimento (WASD, ou as que você remapeou), meio transparentes, que acendem enquanto são apertadas. No celular, o joystick fixo continua igual.',
            en: 'With the fixed joystick on, computers showed the touch joystick in the corner of the screen. Now, with a mouse and keyboard, that corner shows the movement keys (WASD, or the ones you remapped), semi-transparent, lighting up while held. On phones, the fixed joystick stays the same.',
            es: 'Con el joystick fijo activado, la computadora mostraba el joystick táctil en la esquina de la pantalla. Ahora, con mouse y teclado, esa esquina muestra las teclas de movimiento (WASD, o las que remapeaste), semitransparentes, que se iluminan mientras las presionas. En el celular, el joystick fijo sigue igual.',
          },
        ],
      },
      {
        title: { pt: 'Deino chegou aos ovos', en: 'Deino hatches from eggs', es: 'Deino sale de los huevos' },
        notes: [
          {
            pt: 'Deino › Zweilous › Hydreigon é a nova família do Ovo ultra raro, ao lado de Dratini, Gible e Bagon: um dragão sombrio que morde com Crunch, bate forte desde o ovo e, com as três cabeças do Hydreigon, dispara um projétil a mais. São 53 famílias nos ovos e 80 Pokémon jogáveis.',
            en: 'Deino › Zweilous › Hydreigon is the new Ultra Rare Egg family, alongside Dratini, Gible and Bagon: a dark dragon that bites with Crunch, hits hard from the start and, with its three heads as Hydreigon, fires one more projectile. That makes 53 egg families and 80 playable Pokémon.',
            es: 'Deino › Zweilous › Hydreigon es la nueva familia del Huevo ultrarraro, junto a Dratini, Gible y Bagon: un dragón siniestro que muerde con Crunch, pega fuerte desde el huevo y, con las tres cabezas de Hydreigon, dispara un proyectil más. Son 53 familias en los huevos y 80 Pokémon jugables.',
          },
        ],
      },
      {
        title: { pt: 'Silhuetas na aba Ovos', en: 'Silhouettes in the Eggs tab', es: 'Siluetas en la pestaña Huevos' },
        notes: [
          {
            pt: 'Na escolha de parceiro, os Pokémon que ainda estão no ovo aparecem como uma silhueta preta no lugar do ovo, como no clássico "Quem é esse Pokémon?".',
            en: 'In the partner select, Pokémon still in their egg now show as a black silhouette instead of the egg, like the classic "Who\'s that Pokémon?".',
            es: 'En la selección de compañero, los Pokémon que siguen en su huevo aparecen como una silueta negra en lugar del huevo, como en el clásico "¿Quién es ese Pokémon?".',
          },
        ],
      },
      {
        title: { pt: 'Os apoiadores ganharam um Hall da Fama', en: 'Supporters got a Hall of Fame', es: 'Los patrocinadores tienen un Salón de la Fama' },
        notes: [
          {
            pt: 'A tela de Apoiadores virou o Hall da Fama: as Lendas (quem somou R$ 50 ou US$ 10) ficam em pedestais dourados sob um holofote, com o shiny que escolheram (ou o Pokémon que acompanham), e os outros apoiadores aparecem com seu avatar. Toque em qualquer um para ver o perfil.',
            en: 'The Supporters screen became the Hall of Fame: the Legends (R$ 50 or US$ 10 in all) stand on golden pedestals under a spotlight with the shiny they picked (or the Pokémon they walk with), and the other supporters show up with their avatar. Tap anyone to see their profile.',
            es: 'La pantalla de Patrocinadores se convirtió en el Salón de la Fama: las Leyendas (R$ 50 o US$ 10 en total) están en pedestales dorados bajo un reflector con el shiny que eligieron (o el Pokémon que los acompaña), y los demás patrocinadores aparecen con su avatar. Toca a cualquiera para ver su perfil.',
          },
          {
            pt: 'Embaixo (ou ao lado, na tela deitada) ficam as recompensas, todas cosméticas, e o botão Apoiar. Para quem já apoia, os mesmos ícones viram atalhos: escolher o shiny, o companheiro, a votação, resgatar um código e mostrar ou esconder seu nome.',
            en: 'Below (or beside it, on a wide screen) are the rewards, all cosmetic, and the Support button. If you already support the game, the same icons become shortcuts: pick your shiny, your companion, the poll, redeem a code and show or hide your name.',
            es: 'Abajo (o al lado, en pantalla horizontal) están las recompensas, todas cosméticas, y el botón Apoyar. Si ya apoyas el juego, los mismos íconos se vuelven atajos: elegir tu shiny, tu compañero, la votación, canjear un código y mostrar u ocultar tu nombre.',
          },
        ],
      },
      {
        title: { pt: 'Nova escolha de parceiro', en: 'A new partner select', es: 'Nueva selección de compañero' },
        notes: [
          {
            pt: 'Os 27 iniciais aparecem todos de uma vez, numa grade de 9 regiões por Planta, Fogo e Água, sem abas de região. Os Pokémon dos ovos ficam na aba Ovos, e os que você já chocou também aparecem embaixo da grade.',
            en: 'All 27 starters show at once, in a grid of 9 regions by Grass, Fire and Water, with no region tabs. Egg Pokémon live in the Eggs tab, and the ones you hatched also show under the grid.',
            es: 'Los 27 iniciales aparecen todos a la vez, en una cuadrícula de 9 regiones por Planta, Fuego y Agua, sin pestañas de región. Los Pokémon de los huevos están en la pestaña Huevos, y los que ya eclosionaste también aparecen debajo de la cuadrícula.',
          },
          {
            pt: 'O parceiro escolhido aparece com seu papel, os principais status e a linha evolutiva; golpes, especial e Megas ficam no botão de detalhes (no celular, uma folha que sobe de baixo). Bolsa, dificuldade e o botão Começar dividem uma barra só, e o Começar muda de cor com a dificuldade.',
            en: 'Your pick shows its role, main stats and evolution line; moves, special and Megas sit behind the details button (a sheet that slides up on phones). Bag, difficulty and the Start button share one bar, and Start changes color with the difficulty.',
            es: 'Tu elegido muestra su rol, sus stats principales y su línea evolutiva; los movimientos, el especial y las Megas están en el botón de detalles (en el celular, una hoja que sube desde abajo). Mochila, dificultad y el botón Empezar comparten una sola barra, y Empezar cambia de color con la dificultad.',
          },
          {
            pt: 'No celular, nada fica mais escondido embaixo dos botões: a lista rola acima da barra. Para abrir o Poké Mart, toque na carteira no topo.',
            en: 'On phones nothing hides under the buttons anymore: the list scrolls above the bar. To open the Poké Mart, tap the wallet at the top.',
            es: 'En el celular ya nada queda escondido debajo de los botones: la lista se desplaza arriba de la barra. Para abrir el Poké Mart, toca la cartera arriba.',
          },
        ],
      },
      {
        title: { pt: 'Um título novo: o lobby', en: 'A new title screen: the lobby', es: 'Un título nuevo: el lobby' },
        notes: [
          {
            pt: 'O menu em lista virou um lobby: seu último parceiro fica no meio do campo e o botão JOGAR abre a escolha de Pokémon com ele já selecionado (tocar no parceiro faz o mesmo). Pokédex, Ovos, Loja e Ranking ficam ao lado do JOGAR no computador e numa barra de abas embaixo no celular, com um aviso quando um ovo está pronto para chocar.',
            en: 'The list menu became a lobby: your last partner stands in the middle of the field and the PLAY button opens the Pokémon select with it already picked (tapping the partner does the same). Pokédex, Eggs, Shop and Ranking sit beside PLAY on computers and in a tab bar at the bottom on phones, with a badge when an egg is ready to hatch.',
            es: 'El menú en lista se volvió un lobby: tu último compañero queda en medio del campo y el botón JUGAR abre la elección de Pokémon con él ya seleccionado (tocar al compañero hace lo mismo). Pokédex, Huevos, Tienda y Ranking quedan junto a JUGAR en la computadora y en una barra de pestañas abajo en el celular, con un aviso cuando un huevo está listo para eclosionar.',
          },
          {
            pt: 'Os cards de Hoje mostram o dia de relance: o Surto do dia andando (normal e shiny), se você já jogou o Desafio do dia e com que tempo, e as missões de hoje com barra de progresso. O novo card dourado do Hall da Fama mostra quem apoia o jogo e quem entrou por último, e abre a tela de apoiadores.',
            en: "The Today cards show the day at a glance: the day's Outbreak walking (normal and shiny), whether you've played the Daily Challenge and your time, and today's missions with a progress bar. The new golden Hall of Fame card shows who supports the game and who joined last, and opens the supporters screen.",
            es: 'Las tarjetas de Hoy muestran el día de un vistazo: el Brote del día caminando (normal y shiny), si ya jugaste el Desafío del día y con qué tiempo, y las misiones de hoy con barra de progreso. La nueva tarjeta dorada del Salón de la Fama muestra quién apoya el juego y quién entró último, y abre la pantalla de apoyadores.',
          },
          {
            pt: 'No teclado e no controle, as setas andam por tudo do lobby e o Enter começa pelo JOGAR. Atalhos: X Pokédex, O Ovos, L Loja, R Ranking, M Missões, H Hall da Fama e C Cartão de Treinador. Como jogar agora é o ? no topo, ao lado dos Ajustes.',
            en: 'On keyboard and gamepad, the arrows move across the whole lobby and Enter starts on PLAY. Shortcuts: X Pokédex, O Eggs, L Shop, R Ranking, M Missions, H Hall of Fame and C Trainer Card. How to play is now the ? at the top, next to Settings.',
            es: 'En teclado y control, las flechas recorren todo el lobby y Enter empieza en JUGAR. Atajos: X Pokédex, O Huevos, L Tienda, R Ranking, M Misiones, H Salón de la Fama y C Tarjeta de Entrenador. Cómo jugar ahora es el ? de arriba, junto a Ajustes.',
          },
        ],
      },
      {
        title: { pt: 'Seu cartão de treinador e Ajustes em abas', en: 'Your Trainer Card and tabbed Settings', es: 'Tu tarjeta de entrenador y Ajustes en pestañas' },
        notes: [
          {
            pt: 'O título ganhou uma barra no topo: seu treinador à esquerda (com seu Pokémon, nome e título; o Poké Ball de convidado com "Entrar"), e sua carteira e a engrenagem dos Ajustes à direita. Toque no treinador para abrir o Cartão de Treinador, com partidas, vitórias, Pokédex, shinies, medalhas e fitas, e atalhos para editar o perfil, compartilhar o cartão, missões e conquistas.',
            en: 'The title got a bar on top: your trainer on the left (with your Pokémon, name and title; a guest gets a Poké Ball and "Sign in"), and your wallet and the Settings gear on the right. Tap the trainer to open your Trainer Card, with runs, wins, Pokédex, shinies, medals and ribbons, and shortcuts to edit your profile, share the card, and missions and achievements.',
            es: 'El título ganó una barra arriba: tu entrenador a la izquierda (con tu Pokémon, nombre y título; un invitado recibe una Poké Ball y "Entrar"), y tu cartera y el engranaje de Ajustes a la derecha. Toca al entrenador para abrir tu Tarjeta de Entrenador, con partidas, victorias, Pokédex, shinies, medallas y cintas, y atajos para editar el perfil, compartir la tarjeta, y misiones y logros.',
          },
          {
            pt: 'Os Ajustes agora têm abas: Som, Jogo, Controles e Sobre. A escolha de idioma (PT, EN, ES) foi para a aba Jogo, e os links de Legal e créditos e do GitHub foram para Sobre.',
            en: 'Settings now has tabs: Sound, Game, Controls and About. The language picker (PT, EN, ES) moved to the Game tab, and the Legal and credits and GitHub links moved to About.',
            es: 'Los Ajustes ahora tienen pestañas: Sonido, Juego, Controles y Acerca de. La elección de idioma (PT, EN, ES) pasó a la pestaña Juego, y los enlaces de Legal y créditos y de GitHub pasaron a Acerca de.',
          },
        ],
      },
      {
        title: { pt: 'Runs legítimas voltam ao ranking', en: 'Legit runs are back on the leaderboards', es: 'Las partidas legítimas vuelven al ranking' },
        notes: [
          {
            pt: 'Uma parte das runs era tirada do ranking na verificação mesmo sem nada de errado: quando o jogo subia de nível ou o Pokémon desmaiava num quadro em que o aparelho atrasava, o replay ganhava alguns instantes a mais e a re-simulação não chegava ao mesmo resultado. Isso acontecia mais em celulares. O jogo não grava mais esses instantes, o servidor passou a aceitar os replays antigos e as runs recusadas por isso foram verificadas de novo.',
            en: 'Some runs were dropped from the leaderboards at verification with nothing wrong: when a level-up or a faint landed on a frame where the device lagged, the replay got a few extra moments and the re-simulation didn\'t end where the run did. It happened more on phones. The game no longer records those moments, the server now accepts the older replays, and the runs turned away by it were checked again.',
            es: 'Una parte de las partidas salía del ranking en la verificación sin nada malo: cuando subías de nivel o el Pokémon se debilitaba en un cuadro en que el dispositivo se atrasaba, el replay ganaba unos instantes de más y la re-simulación no llegaba al mismo resultado. Pasaba más en celulares. El juego ya no graba esos instantes, el servidor ahora acepta los replays antiguos y las partidas rechazadas por eso se verificaron de nuevo.',
          },
        ],
      },
    ],
  },
  {
    date: '2026-10-16',
    title: { pt: 'Desafio do dia e espanhol', en: 'Daily Challenge and Spanish', es: 'Desafío del día y español' },
    highlights: [
      { pt: 'Desafio do dia: a mesma partida para todo mundo, com fitas para os melhores.', en: 'Daily Challenge: the same run for everyone, with ribbons for the best.', es: 'Desafío del día: la misma partida para todos, con cintas para los mejores.' },
      { pt: 'O jogo agora fala espanhol.', en: 'The game now speaks Spanish.', es: '¡El juego ahora habla español!' },
      { pt: 'Mais 11 Megas, de Mega Pidgeot a Mega Salamence.', en: '11 more Megas, from Mega Pidgeot to Mega Salamence.', es: '11 Megas más, de Mega Pidgeot a Mega Salamence.' },
      { pt: 'Troque as teclas e os botões do controle como quiser.', en: 'Remap your keys and gamepad buttons however you like.', es: 'Cambia las teclas y los botones del control como quieras.' },
      { pt: 'Doe por Pix ou cartão e ganhe recompensas cosméticas.', en: 'Donate by card or Pix and get cosmetic rewards.', es: 'Dona con tarjeta o Pix y recibe recompensas cosméticas.' },
    ],
    changes: [
      {
        title: { pt: 'Runs longas no modo sem fim entram no ranking', en: 'Long endless runs make the leaderboards', es: 'Las partidas largas del modo sin fin entran al ranking' },
        notes: [
          {
            pt: 'Runs de mais de uma hora no modo sem fim eram recusadas pelo ranking: o replay passava do tamanho aceito e a quantidade de derrotados parecia alta demais. Agora o limite de derrotados cresce com o tempo de partida e o replay pode ser bem maior, então as runs mais longas também contam.',
            en: 'Endless runs longer than an hour were turned away by the leaderboards: the replay was over the accepted size and the number of faints looked too high. Now the faint limit grows with the run time and the replay can be much larger, so the longest runs count too.',
            es: 'Las partidas de más de una hora en el modo sin fin eran rechazadas por el ranking: el replay superaba el tamaño aceptado y la cantidad de derrotados parecía demasiado alta. Ahora el límite de derrotados crece con el tiempo de partida y el replay puede ser mucho más grande, así que las partidas más largas también cuentan.',
          },
        ],
      },
      {
        title: { pt: 'Troque as teclas e os botões do controle', en: 'Remap your keys and gamepad buttons', es: 'Cambia las teclas y los botones del control' },
        notes: [
          {
            pt: 'Em Ajustes → Controles → Teclado e controle, cada ação (andar nas quatro direções, especial, Mega, bote, pausar, confirmar e voltar) tem uma tecla e um botão do controle que você escolhe: aperte a nova tecla ou botão, e o Esc cancela. Se ela já estiver em uso, as duas ações trocam e o jogo avisa. Restaurar padrão volta tudo como era.',
            en: 'In Settings → Controls → Keyboard and gamepad, every action (moving in the four directions, special, Mega, lunge, pause, confirm and back) has a key and a gamepad button of your choice: press the new key or button, and Esc cancels. If it is already taken, the two actions swap and the game tells you. Restore defaults puts everything back.',
            es: 'En Ajustes → Controles → Teclado y control, cada acción (moverse en las cuatro direcciones, especial, Mega, embestida, pausa, confirmar y volver) tiene una tecla y un botón del control que tú eliges: presiona la nueva tecla o botón, y Esc cancela. Si ya está en uso, las dos acciones se intercambian y el juego te avisa. Restaurar valores lo deja todo como antes.',
          },
          {
            pt: 'O controle agora também move o Pokémon na partida, pelo D-pad ou pelo analógico esquerdo.',
            en: 'The gamepad now moves your Pokémon in a run too, with the D-pad or the left stick.',
            es: 'El control ahora también mueve al Pokémon durante la partida, con el D-pad o el stick izquierdo.',
          },
        ],
      },
      {
        title: { pt: 'Recompensas para quem apoia', en: 'Rewards for supporters', es: 'Recompensas para quien apoya' },
        notes: [
          {
            pt: 'Doar com uma conta agora traz um agradecimento no jogo, como Presente Misterioso: o título e a moldura Apoiador(a), um selo ♥ ao lado do seu @ no ranking e no perfil, um shiny à sua escolha (qualquer inicial ou família dos ovos, que vem junto), um companheiro que te segue nas partidas, seu nome no mural e nos agradecimentos da vitória e voto no próximo Pokémon dos ovos. Com R$ 50 ou US$ 10 somados, vira Ouro: fundo, papel de parede e selo dourados. Tudo cosmético, nada muda uma partida.',
            en: 'Donating with an account now brings a thank-you in the game, as a Mystery Gift: the Supporter title and card frame, a ♥ badge by your @ on the ranking and your profile, a shiny of your choice (any starter, or an egg family, which comes with it), a companion that follows you in runs, your name on the wall and in the victory thanks, and a vote on the next egg Pokémon. R$ 50 or US$ 10 in all makes it Gold: a golden background, wallpaper and badge. All cosmetic, nothing changes a run.',
            es: 'Donar con una cuenta ahora trae un agradecimiento en el juego, como Regalo Misterioso: el título y el marco Patrocinador(a), un sello ♥ junto a tu @ en el ranking y en tu perfil, un shiny a tu elección (cualquier inicial o familia de huevo, que viene con él), un compañero que te sigue en las partidas, tu nombre en el mural y en los agradecimientos de la victoria y voto en el próximo Pokémon de los huevos. Con R$ 50 o US$ 10 en total, pasa a Oro: fondo, fondo de la caja y sello dorados. Todo cosmético, nada cambia una partida.',
          },
          {
            pt: 'Na página Apoie o projeto, informe seu @ para as recompensas irem direto para a sua conta (ou para a de um amigo). Sem @, você recebe um código para resgatar no jogo, no ♥ do título.',
            en: 'On the Support the project page, enter your @ so the rewards go straight to your account (or a friend\'s). Without one, you get a code to redeem in the game, under the ♥ on the title.',
            es: 'En la página Apoya el proyecto, escribe tu @ para que las recompensas vayan directo a tu cuenta (o a la de un amigo). Sin @, recibes un código para canjear en el juego, en el ♥ del título.',
          },
        ],
      },
      {
        title: { pt: 'Doe por Pix', en: 'Donate from anywhere, Pix included', es: 'Dona desde cualquier país, también con Pix' },
        notes: [
          {
            pt: 'O Ko-fi não aceitava vários cartões, inclusive brasileiros. As doações agora têm uma página própria: do Brasil, por Pix ou cartão em reais (AbacatePay), com valores prontos ou o valor que você quiser; de outros países, com cartão, Apple Pay ou Google Pay em dólares (Stripe). A página sugere o jeito certo pelo fuso horário do aparelho, não pelo idioma, e você pode escolher o outro. Doar continua não dando nada dentro do jogo.',
            en: "Ko-fi turned down many cards, Brazilian ones included. Donations now have their own page: from outside Brazil, by card, Apple Pay or Google Pay in US dollars (Stripe); from Brazil, by Pix or card in reais (AbacatePay), with preset amounts or any amount you like. The page suggests the right way from your device's time zone, not its language, and you can always pick the other. Donating still gives nothing in the game.",
            es: 'Ko-fi rechazaba muchas tarjetas, incluso las brasileñas. Las donaciones ahora tienen su propia página: desde fuera de Brasil, con tarjeta, Apple Pay o Google Pay en dólares (Stripe); desde Brasil, con Pix o tarjeta en reales (AbacatePay), con montos listos o el que quieras. La página sugiere la forma correcta según la zona horaria del dispositivo, no el idioma, y siempre puedes elegir la otra. Donar sigue sin dar nada dentro del juego.',
          },
        ],
      },
      {
        title: { pt: 'O ímã não deixa mais nada orbitando', en: 'The magnet no longer leaves pickups orbiting', es: 'El imán ya no deja nada orbitando' },
        notes: [
          {
            pt: 'Exp. Candy, moedas e itens puxados pelo ímã às vezes ficavam girando em volta do seu Pokémon sem nunca chegar. Agora eles vêm direto até você, mesmo correndo em círculos. Valeu pelo aviso!',
            en: 'Exp. Candy, coins and items pulled in by the magnet could get stuck circling your Pokémon without ever landing. Now they come straight to you, even while you run in circles. Thanks for the report!',
            es: 'Los Exp. Candy, las monedas y los objetos atraídos por el imán a veces se quedaban girando alrededor de tu Pokémon sin llegar nunca. Ahora vienen directo a ti, incluso si corres en círculos. ¡Gracias por el aviso!',
          },
        ],
      },
      {
        title: { pt: 'Joystick fixo no celular', en: 'Fixed joystick on phones', es: 'Joystick fijo en el celular' },
        notes: [
          {
            pt: 'Os Ajustes ganharam uma seção Controles. Nela, o joystick de toque pode continuar seguindo o dedo (o padrão) ou ficar fixo no canto inferior esquerdo, sempre no mesmo lugar e com a base à mostra.',
            en: 'Settings have a new Controls section. There, the touch joystick can keep following your finger (the default) or stay fixed in the bottom-left corner, always in the same spot with its base showing.',
            es: 'Los Ajustes tienen una nueva sección Controles. Ahí, el joystick táctil puede seguir tu dedo (lo predeterminado) o quedarse fijo en la esquina inferior izquierda, siempre en el mismo lugar y con la base a la vista.',
          },
        ],
      },
      {
        title: { pt: 'Apoie o projeto no Ko-fi', en: 'Support the project on Ko-fi', es: 'Apoya el proyecto en Ko-fi' },
        notes: [
          {
            pt: 'O jogo continua gratuito e sem nada à venda. Quem quiser ajudar a manter os servidores agora pode doar no Ko-fi (cartão, PayPal, Apple Pay e Google Pay, de qualquer país), pelo botão no canto superior direito do título e da escolha de Pokémon, na tela de vitória e no rodapé do site. Doar não dá nada dentro do jogo.',
            en: 'The game stays free, with nothing for sale. If you want to help keep the servers running, you can now donate on Ko-fi (card, PayPal, Apple Pay and Google Pay, from any country), from the button in the top-right corner of the title and Pokémon select screens, on the victory screen and in the site footer. Donating gives nothing in the game.',
            es: 'El juego sigue siendo gratis y sin nada a la venta. Si quieres ayudar a mantener los servidores, ahora puedes donar en Ko-fi (tarjeta, PayPal, Apple Pay y Google Pay, desde cualquier país), con el botón en la esquina superior derecha del título y de la elección de Pokémon, en la pantalla de victoria y al pie del sitio. Donar no da nada dentro del juego.',
          },
        ],
      },
      {
        title: { pt: 'Sem perder a partida por engano', en: 'No more losing a run by accident', es: 'Ya no pierdes la partida por error' },
        notes: [
          {
            pt: 'Fechar ou recarregar a aba no meio de uma partida (pausada ou escolhendo um golpe também) agora pede confirmação antes. Nos menus e nos resultados, nada muda. No iPhone e no iPad, o Safari não mostra esse aviso.',
            en: 'Closing or reloading the tab in the middle of a run (paused or picking a move too) now asks first. Menus and the results screen are unchanged. On iPhone and iPad, Safari does not show this prompt.',
            es: 'Cerrar o recargar la pestaña en medio de una partida (en pausa o eligiendo un movimiento también) ahora pide confirmación antes. En los menús y en los resultados, nada cambia. En iPhone y iPad, Safari no muestra este aviso.',
          },
        ],
      },
      {
        title: { pt: 'O jogo agora fala espanhol', en: 'The game now speaks Spanish', es: '¡El juego ahora habla español!' },
        notes: [
          {
            pt: 'Espanhol (América Latina) é o terceiro idioma: o jogo inteiro, o Pokédex, o guia e estas novidades. Quem usa o navegador em espanhol já começa nele, e dá para trocar no título (PT | EN | ES, ou a tecla I) e nos Ajustes.',
            en: 'Spanish (Latin America) is the third language: the whole game, the Pokédex, the guide and this changelog. Browsers set to Spanish start in it, and you can switch on the title screen (PT | EN | ES, or the I key) and in Settings.',
            es: 'El español (Latinoamérica) es el tercer idioma: todo el juego, la Pokédex, la guía y estas novedades. Si tu navegador está en español, el juego ya empieza así, y puedes cambiarlo en el título (PT | EN | ES, o la tecla I) y en Ajustes.',
          },
          {
            pt: 'O jogo em espanhol tem o seu próprio endereço, pokemonsurvivors.com/es/, para compartilhar com os amigos.',
            en: 'The Spanish game has its own address, pokemonsurvivors.com/es/, to share with friends.',
            es: 'El juego en español tiene su propia dirección, pokemonsurvivors.com/es/, para compartir con tus amigos.',
          },
        ],
      },
      {
        title: { pt: 'Mais 11 Megas para as famílias da Gen 1 à 3', en: '11 more Megas for the Gen 1–3 families', es: '11 Megas más para las familias de la Gen 1 a la 3' },
        notes: [
          {
            pt: 'Toda família de ovo que tem Mega Evolução agora Mega Evolui: chegam Mega Pidgeot, Gyarados, Ampharos, Scizor, Houndoom, Aggron, Manectric, Altaria, Banette, Glalie e Salamence, cada uma com status, especial, habilidade e grito próprios. São 37 Megas em 33 linhagens.',
            en: 'Every egg family with a Mega Evolution can now Mega Evolve: Mega Pidgeot, Gyarados, Ampharos, Scizor, Houndoom, Aggron, Manectric, Altaria, Banette, Glalie and Salamence join, each with its own stats, special, ability and cry. That makes 37 Megas across 33 lines.',
            es: 'Toda familia de huevo que tiene Megaevolución ahora megaevoluciona: llegan Mega Pidgeot, Gyarados, Ampharos, Scizor, Houndoom, Aggron, Manectric, Altaria, Banette, Glalie y Salamence, cada una con sus propias estadísticas, especial, habilidad y grito. Son 37 Megas en 33 líneas evolutivas.',
          },
          {
            pt: 'Destaques: Mega Scizor (Technician) ganha uma investida em cadeia de aço com recarga curta, Mega Manectric (Intimidate) desacelera quem chega perto e corre deixando faíscas, e Mega Altaria, Glalie e Salamence reforçam os golpes Normal junto com os de Fada, Gelo e Voador. Houndoom, Manectric, Altaria, Banette e Glalie já aparecem com o sprite da forma Mega.',
            en: 'Highlights: Mega Scizor (Technician) gets a steel chain dash on a short cooldown, Mega Manectric (Intimidate) slows whoever comes close and runs leaving sparks behind, and Mega Altaria, Glalie and Salamence power up Normal moves along with Fairy, Ice and Flying ones. Houndoom, Manectric, Altaria, Banette and Glalie already show their Mega sprite.',
            es: 'Destacados: Mega Scizor (Technician) gana una embestida en cadena de acero con poco tiempo de recarga, Mega Manectric (Intimidate) ralentiza a quien se acerca y corre dejando chispas, y Mega Altaria, Glalie y Salamence potencian los movimientos de tipo Normal junto con los de Hada, Hielo y Volador. Houndoom, Manectric, Altaria, Banette y Glalie ya aparecen con el sprite de su forma Mega.',
          },
        ],
      },
      {
        title: { pt: 'Competir: Desafio do dia e fitas', en: 'Compete: the Daily Challenge and ribbons', es: 'Competir: Desafío del día y cintas' },
        notes: [
          {
            pt: 'Desafio do dia: uma partida por dia igual para todo mundo, com a mesma semente, o mesmo Pokémon (pode ser até uma família de ovo que você ainda não chocou) e a mesma dificuldade, sem melhorias da Poké Mart, Isca, Incenso ou Amuleto Brilhante. O surto do dia continua valendo. Fica no menu do título, com a contagem para o próximo.',
            en: "Daily Challenge: one run a day that is the same for everyone, with the same seed, the same Pokémon (even an egg family you haven't hatched yet) and the same difficulty, with no Poké Mart upgrades, Lure, Incense or Shiny Charm. Today's outbreak is still on. It's on the title menu, with a countdown to the next one.",
            es: 'Desafío del día: una partida al día igual para todo el mundo, con la misma semilla, el mismo Pokémon (puede ser hasta una familia de huevo que todavía no eclosionaste) y la misma dificultad, sin mejoras de la Poké Mart, Cebo, Incienso ni Amuleto Iris. El brote del día sigue activo. Está en el menú del título, con la cuenta regresiva para el próximo.',
          },
          {
            pt: 'Só a sua primeira partida terminada do dia é a tentativa oficial e entra no ranking do desafio, que ganhou uma aba no Ranking (hoje e ontem). As outras são treino. O fim da partida mostra a sua posição, e o cartão para compartilhar também.',
            en: 'Only your first finished run of the day is the official attempt and goes on the challenge ranking, which has its own tab in the Ranking (today and yesterday). The rest are practice. The end of the run shows your place, and so does the card you share.',
            es: 'Solo tu primera partida terminada del día es el intento oficial y entra en el ranking del desafío, que ahora tiene su propia pestaña en el Ranking (hoy y ayer). Las demás son de práctica. El final de la partida muestra tu posición, y la tarjeta para compartir también.',
          },
          {
            pt: 'Fitas: depois que o dia fecha, todo mundo no ranking do desafio ganha uma fita como Presente Misterioso, de ouro para os 10% melhores, de prata para a metade de cima e de bronze para quem participou. Elas aparecem no seu perfil e no Cartão de Treinador.',
            en: 'Ribbons: once the day closes, everyone on the challenge ranking gets a ribbon as a Mystery Gift, gold for the top 10%, silver for the top half and bronze for taking part. They show on your profile and Trainer Card.',
            es: 'Cintas: cuando cierra el día, todos los del ranking del desafío reciben una cinta como Regalo Misterioso, de oro para el 10% mejor, de plata para la mitad de arriba y de bronce para quien participó. Aparecen en tu perfil y en la Tarjeta de Entrenador.',
          },
        ],
      },
    ],
  },
  {
    date: '2026-10-15',
    title: { pt: 'Megas e lendários', en: 'Megas and legendaries', es: 'Megas y legendarios' },
    highlights: [
      { pt: 'Mega Evolução: 26 Megas, ganhas vencendo os lendários das fendas.', en: 'Mega Evolution: 26 Megas, earned by beating the rift legendaries.', es: 'Megaevolución: 26 Megas, que se ganan venciendo a los legendarios de las grietas.' },
      { pt: 'Feras de Johto e Regis de Hoenn como chefes, e uma arena para cada lendário.', en: "Johto's beasts and Hoenn's Regis as bosses, and an arena for each legendary.", es: 'Las bestias de Johto y los Regis de Hoenn como jefes, y una arena para cada legendario.' },
      { pt: '26 famílias novas nos ovos, e Kanto, Johto e Hoenn completos na horda.', en: '26 new egg families, and Kanto, Johto and Hoenn complete in the horde.', es: '26 familias nuevas en los huevos, y Kanto, Johto y Hoenn completos en la horda.' },
      { pt: 'O mapa ganhou relevo: pedras, bosques, montanhas, torres e lagos.', en: 'The map got terrain: rocks, woods, mountains, towers and lakes.', es: 'El mapa ganó relieve: rocas, bosques, montañas, torres y lagos.' },
      { pt: 'Surto do dia, Poké Mart nova e um cartão para compartilhar a sua partida.', en: "Today's outbreak, a new Poké Mart and a card to share your run.", es: 'Brote del día, una Poké Mart nueva y una tarjeta para compartir tu partida.' },
    ],
    changes: [
      {
        title: {
          pt: 'Traga amigos: convites, Presente Misterioso e Munchlax',
          en: 'Bring friends: invites, Mystery Gifts and Munchlax',
          es: 'Trae amigos: invitaciones, Regalo Misterioso y Munchlax',
        },
        notes: [
          {
            pt: 'Convide amigos: todo link que você compartilha leva o seu nome. Quem chega por ele vê "Fulano te convidou!" na tela de título, e ao criar a conta ganha um Ovo da Amizade. Vocês dois passam a se seguir.',
            en: 'Invite friends: every link you share carries your name. Whoever lands through it sees "So-and-so invited you!" on the title screen, and gets a Friendship Egg on signing up. You two follow each other.',
            es: 'Invita a tus amigos: cada enlace que compartes lleva tu nombre. Quien llega por él ve "¡Fulano te invitó!" en la pantalla de título y, al crear su cuenta, recibe un Huevo de la Amistad. Ustedes dos pasan a seguirse.',
          },
          {
            pt: 'Quando o amigo joga 3 partidas verificadas no ranking, o convite conta para você e chega um Presente Misterioso: com 1 amigo, um Ovo da Amizade; com 3, o título Embaixador(a) e uma moldura exclusiva para o cartão; com 10, um Munchlax shiny. O seu perfil mostra quantos amigos você trouxe.',
            en: 'Once your friend plays 3 verified ranked runs, the invite counts for you and a Mystery Gift arrives: at 1 friend, a Friendship Egg; at 3, the Ambassador title and an exclusive card frame; at 10, a shiny Munchlax. Your profile shows how many friends you brought.',
            es: 'Cuando tu amigo juega 3 partidas verificadas en el ranking, la invitación cuenta para ti y llega un Regalo Misterioso: con 1 amigo, un Huevo de la Amistad; con 3, el título Embajador(a) y un marco exclusivo para la tarjeta; con 10, un Munchlax shiny. Tu perfil muestra cuántos amigos trajiste.',
          },
          {
            pt: 'Família nova: Munchlax, que evolui em Snorlax no Nv 20. Um tanque guloso, com muita vida, defesa e regeneração, que abre caminho com Earthquake. Só sai do Ovo da Amizade.',
            en: 'New family: Munchlax, which evolves into Snorlax at Lv 20. A hungry tank with lots of HP, defense and regen that clears the way with Earthquake. It only hatches from the Friendship Egg.',
            es: 'Familia nueva: Munchlax, que evoluciona a Snorlax en el Nv. 20. Un tanque glotón, con mucha vida, defensa y regeneración, que abre camino con Earthquake. Solo sale del Huevo de la Amistad.',
          },
        ],
      },
      {
        title: { pt: 'Hoje tem: Surto do dia e Poké Mart nova', en: "Today's outbreak and a new Poké Mart", es: 'Brote del día y una Poké Mart nueva' },
        notes: [
          {
            pt: 'Surto do dia: todo dia (no horário de Brasília) uma espécie selvagem toma conta de todas as partidas, a mesma para todo mundo. Ela é o Pokémon mais comum da partida do começo ao fim, e por isso o shiny dela aparece umas duas vezes por partida. A tela de título mostra quem é o surto de hoje, e uma missão diária nova pede para derrotar os Pokémon do surto.',
            en: "Today's outbreak: every day (Brasília time) one wild species takes over every run, the same for everyone. It's the most common Pokémon of the run from start to finish, so its shiny shows up about twice a run. The title screen shows today's outbreak, and a new daily mission asks you to defeat it.",
            es: 'Brote del día: cada día (en hora de Brasilia) una especie salvaje se adueña de todas las partidas, la misma para todo el mundo. Es el Pokémon más común de la partida de principio a fin, y por eso su shiny aparece unas dos veces por partida. La pantalla de título muestra cuál es el brote de hoy, y una misión diaria nueva pide derrotar a los Pokémon del brote.',
          },
          {
            pt: 'A Poké Mart ganhou três prateleiras. Melhorias tem o novo Amuleto Brilhante (Shiny Charm): três níveis que levam a chance de shiny selvagem de 1/450 a 1/225. O Balcão do dia muda à meia-noite, igual para todos, com estoque limitado: Isca (shinies 2× mais comuns na próxima partida), Incenso (chance de ovo 2× maior), um ovo à venda e um item em promoção. Estilo vende molduras do cartão (Poké, Great, Ultra e Master Ball), fundos dos cinco lugares do jogo e papéis de parede para a Caixa do PC.',
            en: "The Poké Mart has three shelves now. Upgrades has the new Shiny Charm: three levels that take the wild shiny odds from 1/450 to 1/225. Today's counter turns over at midnight, the same for everyone, with a daily stock: Lure (shinies twice as common next run), Incense (eggs twice as likely), an egg for sale and one item on sale. Style sells card frames (Poké, Great, Ultra and Master Ball), backgrounds from the game's five places and PC Box wallpapers.",
            es: 'La Poké Mart ahora tiene tres estantes. Mejoras tiene el nuevo Amuleto Iris (Shiny Charm): tres niveles que llevan la probabilidad de shiny salvaje de 1/450 a 1/225. El Mostrador del día cambia a medianoche, igual para todos, con existencias limitadas: Cebo (shinies 2× más comunes en la próxima partida), Incienso (probabilidad de huevo 2× mayor), un huevo a la venta y un objeto en oferta. Estilo vende marcos para la tarjeta (Poké, Great, Ultra y Master Ball), fondos de los cinco lugares del juego y fondos de pantalla para la Caja del PC.',
          },
          {
            pt: 'Isca e Incenso vão para a Bolsa. Na escolha do Pokémon, ligue o que quiser usar (teclas C e V) e ele é gasto quando a partida começa. Algumas missões agora pagam uma Isca ou um Incenso junto com os ₽.',
            en: 'Lures and Incenses go into the Bag. On the select screen, turn on what you want to use (C and V keys) and it gets used up as the run starts. Some missions now pay a Lure or an Incense on top of the ₽.',
            es: 'El Cebo y el Incienso van a la Mochila. En la selección de Pokémon, activa lo que quieras usar (teclas C y V) y se gasta cuando empieza la partida. Algunas misiones ahora pagan un Cebo o un Incienso junto con los ₽.',
          },
          {
            pt: 'No celular, os botões redondos da partida (especial, Mega e bote) não ficam mais por cima dos botões da tela de resultados e dos menus.',
            en: "On phones, the run's round buttons (special, Mega and lunge) no longer sit on top of the results screen's and the menus' buttons.",
            es: 'En el celular, los botones redondos de la partida (especial, Mega y embestida) ya no quedan encima de los botones de la pantalla de resultados ni de los menús.',
          },
        ],
      },
      {
        title: { pt: 'Mostre sua coleção', en: 'Show off your collection', es: 'Muestra tu colección' },
        notes: [
          {
            pt: 'Nova tela de resultados com o botão Compartilhar: o jogo desenha um cartão da run em pixel art, com o seu Pokémon, o tempo, o nível, os shinies que você pegou e os lendários que venceu. No celular ele abre o compartilhar do sistema; no computador, copia a imagem.',
            en: 'The results screen has a new Share button: the game draws a pixel art card of your run, with your Pokémon, time, level, the shinies you caught and the legendaries you beat. On phones it opens the share sheet; on computers it copies the image.',
            es: 'Nueva pantalla de resultados con el botón Compartir: el juego dibuja una tarjeta de la partida en pixel art, con tu Pokémon, el tiempo, el nivel, los shinies que atrapaste y los legendarios que venciste. En el celular abre el menú de compartir del sistema; en la computadora, copia la imagen.',
          },
          {
            pt: 'Caixa do PC: todo shiny que você pegou, em caixas de 30 como no PC dos jogos, com cada um se mexendo. Abra pela Pokédex. De lá (ou do seu perfil) sai o Cartão de Treinador, com suas medalhas, sua Pokédex, seu recorde e seus melhores shinies.',
            en: 'PC Box: every shiny you caught, in boxes of 30 like the PC in the games, each one moving. Open it from the Pokédex. From there (or your profile) comes your Trainer Card, with your medals, Pokédex, best time and best shinies.',
            es: 'Caja del PC: todos los shinies que atrapaste, en cajas de 30 como en el PC de los juegos, cada uno moviéndose. Ábrela desde la Pokédex. Desde ahí (o desde tu perfil) sale la Tarjeta de Entrenador, con tus medallas, tu Pokédex, tu récord y tus mejores shinies.',
          },
          {
            pt: 'Tirou o seu inicial shiny (a chance de 1 em 64)? Agora ele fica liberado para sempre: na seleção, escolha Normal ou Shiny (tecla Z).',
            en: 'Rolled your starter shiny (the 1 in 64 chance)? It now stays unlocked for good: on the select screen, pick Normal or Shiny (Z key).',
            es: '¿Te salió tu inicial shiny (la probabilidad de 1 en 64)? Ahora queda desbloqueado para siempre: en la selección, elige Normal o Shiny (tecla Z).',
          },
        ],
      },
      {
        title: {
          pt: '26 famílias de Kanto, Johto e Hoenn nos ovos',
          en: '26 Kanto, Johto and Hoenn families in eggs',
          es: '26 familias de Kanto, Johto y Hoenn en los huevos',
        },
        notes: [
          {
            pt: 'Os ovos agora podem chocar 26 famílias novas da Gen 1 à 3, 51 no total (78 Pokémon jogáveis). Comuns: Pidgey, Zubat, Poliwag, Geodude, Mareep, Azurill, Shroomish, Swinub e Snorunt. Raros: Growlithe, Vulpix, Cubone, Scyther, Magikarp, Horsea, Kabuto, Houndour, Teddiursa, Aron, Trapinch, Swablu, Electrike e Shuppet. Ultra raros: Bagon, Slakoth e Feebas.',
            en: 'Eggs can now hatch 26 new families from Gen 1 to 3, 51 in all (78 playable Pokémon). Common: Pidgey, Zubat, Poliwag, Geodude, Mareep, Azurill, Shroomish, Swinub and Snorunt. Rare: Growlithe, Vulpix, Cubone, Scyther, Magikarp, Horsea, Kabuto, Houndour, Teddiursa, Aron, Trapinch, Swablu, Electrike and Shuppet. Ultra rare: Bagon, Slakoth and Feebas.',
            es: 'De los huevos ahora pueden salir 26 familias nuevas de la Gen 1 a la 3, 51 en total (78 Pokémon jugables). Comunes: Pidgey, Zubat, Poliwag, Geodude, Mareep, Azurill, Shroomish, Swinub y Snorunt. Raros: Growlithe, Vulpix, Cubone, Scyther, Magikarp, Horsea, Kabuto, Houndour, Teddiursa, Aron, Trapinch, Swablu, Electrike y Shuppet. Ultra raros: Bagon, Slakoth y Feebas.',
          },
          {
            pt: 'Cada uma tem seus status, golpe inicial e golpes. Magikarp e Feebas começam fraquíssimos e viram Gyarados e Milotic; Slakoth é lento para agir, mas bate muito forte. Swinub vai até Mamoswine (o único da Gen 4), para a linha ficar completa.',
            en: 'Each has its own stats, starting move and moves. Magikarp and Feebas start out very weak and become Gyarados and Milotic; Slakoth is slow to act but hits very hard. Swinub goes all the way to Mamoswine (the only Gen 4 member), so the line is complete.',
            es: 'Cada una tiene sus estadísticas, movimiento inicial y movimientos. Magikarp y Feebas empiezan debilísimos y se convierten en Gyarados y Milotic; Slakoth es lento para actuar, pero pega muy fuerte. Swinub llega hasta Mamoswine (el único de la Gen 4), para que la línea quede completa.',
          },
          {
            pt: 'A caixa de ovos na escolha do Pokémon agora rola por dentro e mostra mais colunas, para caber todo mundo também no celular.',
            en: 'The egg box on the Pokémon select now scrolls on its own and shows more columns, so everyone fits on phones too.',
            es: 'La caja de huevos de la selección de Pokémon ahora se desplaza por dentro y muestra más columnas, para que quepan todos también en el celular.',
          },
        ],
      },
      {
        title: { pt: 'Golpes de Gelo, Pedra, Inseto e Dragão', en: 'Ice, Rock, Bug and Dragon moves', es: 'Movimientos de Hielo, Roca, Bicho y Dragón' },
        notes: [
          {
            pt: 'Quatro golpes novos para os tipos que não tinham um: Ice Shard (estilhaços que se cravam no chão e desaceleram quem pisa), Rock Tomb (pedregulhos que caem nos inimigos mais próximos), Pin Missile (agulhas que fazem a curva até o alvo) e Dragon Breath (um cone de fogo dracônico).',
            en: 'Four new moves for the types that had none: Ice Shard (shards that stick in the ground and slow whoever steps on them), Rock Tomb (boulders that drop on the nearest foes), Pin Missile (needles that curve into their target) and Dragon Breath (a cone of dragon fire).',
            es: 'Cuatro movimientos nuevos para los tipos que no tenían uno: Ice Shard (esquirlas que se clavan en el suelo y ralentizan a quien las pisa), Rock Tomb (rocas que caen sobre los enemigos más cercanos), Pin Missile (agujas que hacen una curva hasta el objetivo) y Dragon Breath (un cono de fuego dracónico).',
          },
          {
            pt: 'Cada um evolui com seu item: Ice Shard + Never-Melt Ice vira Blizzard, Rock Tomb + Hard Stone vira Stone Edge, Pin Missile + Silver Powder vira Megahorn e Dragon Breath + Dragon Fang vira Outrage.',
            en: 'Each one evolves with its item: Ice Shard + Never-Melt Ice becomes Blizzard, Rock Tomb + Hard Stone becomes Stone Edge, Pin Missile + Silver Powder becomes Megahorn and Dragon Breath + Dragon Fang becomes Outrage.',
            es: 'Cada uno evoluciona con su objeto: Ice Shard + Never-Melt Ice se vuelve Blizzard, Rock Tomb + Hard Stone se vuelve Stone Edge, Pin Missile + Silver Powder se vuelve Megahorn y Dragon Breath + Dragon Fang se vuelve Outrage.',
          },
          {
            pt: 'Spheal, Rockruff, Larvitar, Grubbin, Larvesta, Noibat, Dratini, Gible e Dreepy agora podem aprendê-los.',
            en: 'Spheal, Rockruff, Larvitar, Grubbin, Larvesta, Noibat, Dratini, Gible and Dreepy can now learn them.',
            es: 'Spheal, Rockruff, Larvitar, Grubbin, Larvesta, Noibat, Dratini, Gible y Dreepy ahora pueden aprenderlos.',
          },
        ],
      },
      {
        title: { pt: 'Os lendários da Gen 1 à 3', en: 'The legendaries of Gens 1 to 3', es: 'Los legendarios de la Gen 1 a la 3' },
        notes: [
          {
            pt: 'As aves de Kanto agora dividem os horários das 7:00, 9:30 e 12:00 com as feras de Johto (Raikou, Entei e Suicune) e os Regis de Hoenn (Regirock, Regice e Registeel). Cada partida sorteia um trio, e cada um tem ataques próprios: Raikou deixa estática por onde corre, Entei faz chover fogo, Suicune solta ondas lentas e densas, Regirock derruba pedras, Regice congela o chão e Registeel fecha o caminho com anéis de aço.',
            en: "The Kanto birds now share the 7:00, 9:30 and 12:00 slots with the Johto beasts (Raikou, Entei and Suicune) and the Hoenn Regis (Regirock, Regice and Registeel). Each run draws one trio, and each member has its own attacks: Raikou leaves static where it runs, Entei rains fire, Suicune sends slow, dense waves, Regirock drops rocks, Regice freezes the ground and Registeel walls you in with steel rings.",
            es: 'Las aves de Kanto ahora comparten los horarios de las 7:00, 9:30 y 12:00 con las bestias de Johto (Raikou, Entei y Suicune) y los Regis de Hoenn (Regirock, Regice y Registeel). Cada partida sortea un trío, y cada uno tiene ataques propios: Raikou deja electricidad estática por donde corre, Entei hace llover fuego, Suicune lanza olas lentas y densas, Regirock derriba rocas, Regice congela el suelo y Registeel cierra el camino con anillos de acero.',
          },
          {
            pt: 'O HP, o dano e a velocidade são do horário, não do Pokémon: nenhum trio é mais fácil que outro.',
            en: 'HP, damage and speed belong to the time slot, not the Pokémon: no trio is easier than another.',
            es: 'El HP, el daño y la velocidad dependen del horario, no del Pokémon: ningún trío es más fácil que otro.',
          },
          {
            pt: 'Novas fendas lendárias: Latias e Latios na Ilha do Sul, uma ilha de areia com palmeiras para se proteger e uma arrebentação em volta que deixa lento, e Deoxys num meteoro no espaço, com aglomerados de cristal no caminho. Agora são 9 lendários de fenda, e a conquista Domador de Lendas pede os 9 (quem já tinha continua com ela).',
            en: 'New legendary rifts: Latias and Latios on Southern Island, a sandy island with palms for cover and surf around it that slows you down, and Deoxys on a meteor in space, with crystal clusters in the way. There are 9 rift legendaries now, and the Legend Tamer achievement asks for all 9 (if you already had it, you keep it).',
            es: 'Nuevas grietas legendarias: Latias y Latios en Isla Sur, una isla de arena con palmeras para cubrirse y un oleaje alrededor que ralentiza, y Deoxys en un meteorito en el espacio, con cúmulos de cristal en el camino. Ahora son 9 legendarios de grieta, y el logro Domador de Leyendas pide los 9 (quien ya lo tenía lo conserva).',
          },
          {
            pt: 'O chefe raro do fim pode ser Mew, Celebi ou Jirachi. A chance de aparecer continua 10%.',
            en: 'The rare boss at the end can be Mew, Celebi or Jirachi. The chance it shows up is still 10%.',
            es: 'El jefe raro del final puede ser Mew, Celebi o Jirachi. La probabilidad de que aparezca sigue siendo del 10%.',
          },
        ],
      },
      {
        title: { pt: 'Kanto, Johto e Hoenn completos na horda', en: 'Kanto, Johto and Hoenn complete in the horde', es: 'Kanto, Johto y Hoenn completos en la horda' },
        notes: [
          {
            pt: '222 espécies da 1ª à 3ª geração entram na horda selvagem, de Metapod e Magikarp a Blissey, Slaking e Salamence. Agora todo Pokémon de Kanto, Johto e Hoenn que não é lendário nem mítico aparece no jogo (menos Unown e Castform, cujo visual depende da forma). A horda passa de 193 para 415 espécies e a Pokédex do jogo, de 334 para 556.',
            en: '222 species from generations 1 to 3 join the wild horde, from Metapod and Magikarp to Blissey, Slaking and Salamence. Every Kanto, Johto and Hoenn Pokémon that isn\'t legendary or mythical is now in the game (but Unown and Castform, whose look depends on their form). The horde grows from 193 to 415 species and the in-game Pokédex from 334 to 556.',
            es: '222 especies de la 1.ª a la 3.ª generación entran en la horda salvaje, de Metapod y Magikarp a Blissey, Slaking y Salamence. Ahora todos los Pokémon de Kanto, Johto y Hoenn que no son legendarios ni míticos aparecen en el juego (menos Unown y Castform, cuyo aspecto depende de la forma). La horda pasa de 193 a 415 especies y la Pokédex del juego, de 334 a 556.',
          },
          {
            pt: 'Cada partida continua sorteando o seu elenco do mesmo jeito, então rostos das três primeiras gerações vão aparecer bem mais.',
            en: 'Each run still draws its cast the same way, so faces from the first three generations show up a lot more.',
            es: 'Cada partida sigue sorteando su elenco de la misma manera, así que las caras de las tres primeras generaciones van a aparecer mucho más.',
          },
        ],
      },
      {
        title: { pt: 'Uma arena para cada lendário', en: 'An arena for each legendary', es: 'Una arena para cada legendario' },
        notes: [
          {
            pt: 'As fendas não levam mais para o mesmo círculo. Lugia espera num templo submerso, com ilhas em água rasa que deixa lento. Ho-Oh, num salão octogonal com pilares e o grande sino. Kyogre nada num poço cuja maré sobe e aperta o anel de pedra. Groudon fica numa caverna cortada por rios de lava (só se atravessa pelas pontes, a não ser que você seja do tipo Fogo). Rayquaza, num losango de jade cuja borda desaba durante a luta. E Dialga, numa nave de mármore com colunatas para se esconder do Roar of Time.',
            en: "Rifts no longer lead to the same circle. Lugia waits in a sunken temple, with islands in shallow water that slows you down. Ho-Oh, in an octagonal hall with pillars and the great bell. Kyogre swims in a pool whose tide rises and squeezes the stone ring. Groudon holds a cave split by lava rivers (cross on the bridges, unless you're a Fire type). Rayquaza, a jade diamond whose edge falls away during the fight. And Dialga, a marble nave with colonnades to hide from Roar of Time.",
            es: 'Las grietas ya no llevan al mismo círculo. Lugia espera en un templo sumergido, con islas en agua poco profunda que te ralentiza. Ho-Oh, en un salón octogonal con pilares y la gran campana. Kyogre nada en un pozo cuya marea sube y estrecha el anillo de piedra. Groudon está en una cueva cortada por ríos de lava (solo se cruza por los puentes, a menos que seas de tipo Fuego). Rayquaza, en un rombo de jade cuyo borde se derrumba durante la pelea. Y Dialga, en una nave de mármol con columnatas para esconderse del Roar of Time.',
          },
        ],
      },
      {
        title: {
          pt: 'Montanhas, árvores, torres e lagos no mapa',
          en: 'Mountains, trees, towers and lakes on the map',
          es: 'Montañas, árboles, torres y lagos en el mapa',
        },
        notes: [
          {
            pt: 'O mapa ganhou relevo: pedras, bosques, montanhas em degraus, torres e lagos, que se vestem conforme o bioma (a colina da planície vira paredão na caverna e cripta na Torre). Quem anda não atravessa os sólidos, então dá para usar uma pedra de cobertura contra tiros ou fazer a horda dar a volta na montanha. Voadores, fantasmas e chefes passam por cima.',
            en: 'The map got some relief: rocks, groves, terraced mountains, towers and lakes, dressed for each biome (the meadow hill becomes a rock wall in the cave and a crypt at the Tower). Walkers can\'t go through solids, so a rock makes cover against shots and the horde has to go around a mountain. Flyers, ghosts and bosses go over it all.',
            es: 'El mapa ahora tiene relieve: rocas, bosquecillos, montañas escalonadas, torres y lagos, que se visten según el bioma (la colina de la pradera se vuelve un paredón en la cueva y una cripta en la Torre). Quien camina no atraviesa los sólidos, así que puedes usar una roca como cobertura contra los disparos o hacer que la horda rodee la montaña. Los voladores, los fantasmas y los jefes pasan por encima.',
          },
          {
            pt: 'Água deixa mais lento (Pokémon do tipo Água nadam sem perder velocidade) e o lago congelado da neve faz escorregar. Árvores, torres e montanhas ficam transparentes quando você passa atrás.',
            en: 'Water slows you down (Water types swim at full speed) and the frozen lakes in the snow make you slide. Trees, towers and mountains turn see-through when you walk behind them.',
            es: 'El agua te ralentiza (los Pokémon de tipo Agua nadan sin perder velocidad) y el lago congelado de la nieve te hace resbalar. Los árboles, las torres y las montañas se vuelven transparentes cuando pasas por detrás.',
          },
        ],
      },
      {
        title: { pt: 'Cadastro com Google destravado', en: 'Google sign up unstuck', es: 'Registro con Google destrabado' },
        notes: [
          {
            pt: 'Quem começou a criar a conta e parou na verificação anti-robô ficava preso numa tela de "Verification didn\'t complete in time" em toda tentativa seguinte. Agora uma nova tentativa recomeça o cadastro do zero e entra normalmente.',
            en: 'If you started creating your account and stopped at the bot check, every later try got stuck on a "Verification didn\'t complete in time" screen. Now a new try starts the sign up over and gets you in.',
            es: 'Quien empezaba a crear su cuenta y se detenía en la verificación anti-bots quedaba atrapado en una pantalla de "Verification didn\'t complete in time" en cada intento siguiente. Ahora un nuevo intento empieza el registro desde cero y entra normalmente.',
          },
        ],
      },
      {
        title: { pt: 'Login com Google mais firme', en: 'Sturdier Google sign in', es: 'Inicio de sesión con Google más firme' },
        notes: [
          {
            pt: 'Quando criar a conta pede uma etapa a mais depois do Google (uma verificação anti-robô ou um dado que faltou), o jogo agora te leva para a página da conta, termina por lá e te traz de volta, em vez de falhar o login.',
            en: 'When creating your account needs one more step after Google (a bot check or a missing detail), the game now takes you to the account page, finishes there and brings you back, instead of failing the sign in.',
            es: 'Cuando crear la cuenta pide un paso más después de Google (una verificación anti-bots o un dato que faltó), el juego ahora te lleva a la página de la cuenta, termina ahí y te trae de vuelta, en lugar de fallar el inicio de sesión.',
          },
        ],
      },
      {
        title: { pt: 'Quick Attack no seu comando', en: 'Quick Attack on your command', es: 'Quick Attack a tus órdenes' },
        notes: [
          {
            pt: 'Quick Attack e Extreme Speed não disparam mais sozinhos: como movem você, agora o bote sai quando você aperta Shift, X / □ no controle ou o novo botão redondo à esquerda do especial no celular. Sem inimigo por perto, o bote avança reto para a frente, bom para escapar de um cerco.',
            en: "Quick Attack and Extreme Speed no longer fire on their own: since they move you, the lunge now goes when you press Shift, X / □ on a gamepad or the new round button left of the special on phones. With no foe in reach it hops straight ahead, handy to slip out of a crowd.",
            es: 'Quick Attack y Extreme Speed ya no se disparan solos: como te mueven, ahora la embestida sale cuando presionas Shift, X / □ en el control o el nuevo botón redondo a la izquierda del especial en el celular. Sin enemigos cerca, la embestida avanza recto hacia adelante, ideal para escapar de un cerco.',
          },
        ],
      },
      {
        title: { pt: 'Todas as Megas', en: 'Every Mega', es: 'Todas las Megas' },
        notes: [
          {
            pt: 'Agora toda linhagem do jogo que tem Mega Evolução Mega Evolui: são 26 Megas em 22 linhagens, com Venusaur, Blastoise, Charizard Y, Raichu X e Y, Dragonite, Meganium, Feraligatr, Sceptile, Blaziken, Swampert, Metagross, Staraptor, Garchomp e Garchomp Z, Lucario Z, Emboar, Chesnaught, Delphox e Greninja chegando agora, cada uma com status, especial, habilidade e grito próprios.',
            en: 'Every line in the game with a Mega Evolution can now Mega Evolve: 26 Megas across 22 lines, with Venusaur, Blastoise, Charizard Y, Raichu X and Y, Dragonite, Meganium, Feraligatr, Sceptile, Blaziken, Swampert, Metagross, Staraptor, Garchomp and Garchomp Z, Lucario Z, Emboar, Chesnaught, Delphox and Greninja joining now, each with its own stats, special, ability and cry.',
            es: 'Ahora todas las líneas del juego que tienen Megaevolución pueden megaevolucionar: son 26 Megas en 22 líneas, con Venusaur, Blastoise, Charizard Y, Raichu X e Y, Dragonite, Meganium, Feraligatr, Sceptile, Blaziken, Swampert, Metagross, Staraptor, Garchomp y Garchomp Z, Lucario Z, Emboar, Chesnaught, Delphox y Greninja llegando ahora, cada una con estadísticas, especial, habilidad y grito propios.',
          },
          {
            pt: 'Charizard, Raichu, Garchomp e Lucario têm duas Megas: o lendário da fenda deixa as duas pedras no chão e a que você pegar decide a Mega. A outra se desfaz.',
            en: 'Charizard, Raichu, Garchomp and Lucario have two Megas: the rift legendary leaves both stones on the ground and the one you pick up decides the Mega. The other crumbles.',
            es: 'Charizard, Raichu, Garchomp y Lucario tienen dos Megas: el legendario de la grieta deja las dos piedras en el suelo y la que recojas decide la Mega. La otra se deshace.',
          },
          {
            pt: 'As Megas que ainda não têm sprite no PMD SpriteCollab aparecem com o sprite da evolução final e um contorno arco-íris enquanto a forma dura.',
            en: 'Megas that don\'t have a PMD SpriteCollab sprite yet show the final evolution\'s sprite with a rainbow outline while the form lasts.',
            es: 'Las Megas que todavía no tienen sprite en PMD SpriteCollab aparecen con el sprite de la evolución final y un contorno arcoíris mientras dura la forma.',
          },
        ],
      },
      {
        title: { pt: 'Gritos das Megas', en: 'Mega cries', es: 'Gritos de las Megas' },
        notes: [
          {
            pt: 'As Megas agora têm o próprio cry: o Pokémon solta o grito da forma Mega ao terminar a transformação, ao usar o especial e se cair enquanto ela dura.',
            en: 'Megas now have their own cry: the Pokémon lets out its Mega form\'s cry as the transformation lands, when it uses its special and if it faints while the form lasts.',
            es: 'Las Megas ahora tienen su propio grito: el Pokémon suelta el grito de la forma Mega al terminar la transformación, al usar el especial y si cae mientras dura.',
          },
        ],
      },
      {
        title: { pt: 'Mega Evolução', en: 'Mega Evolution', es: 'Megaevolución' },
        notes: [
          {
            pt: 'Charmander, Abra, Gastly, Ralts, Riolu e Larvitar agora podem Mega Evoluir. Vença um lendário de fenda com um deles para ganhar a Mega Stone da linhagem e, na evolução final, aperte o botão MEGA (tecla E, ou Y no controle).',
            en: 'Charmander, Abra, Gastly, Ralts, Riolu and Larvitar can now Mega Evolve. Beat a rift legendary with one of them to get the line\'s Mega Stone, then press the MEGA button at the final evolution (E key, or Y on a gamepad).',
            es: 'Charmander, Abra, Gastly, Ralts, Riolu y Larvitar ahora pueden megaevolucionar. Vence a un legendario de grieta con uno de ellos para obtener la Mega Stone de la línea y, en la evolución final, presiona el botón MEGA (tecla E, o Y en el control).',
          },
          {
            pt: 'A forma Mega dura 20 segundos e volta depois de 60. Ela começa com uma transformação com explosão de arco-íris que empurra a horda, ganha status, troca o especial por um mais forte e ativa a habilidade: o Dragon Flare em chamas azuis do Mega Charizard X, o Trace do Mega Alakazam (cada especial dispara dois dos seus golpes), o Shadow Tag do Mega Gengar (desacelera quem chega perto), o Pixilate do Mega Gardevoir, a cadeia de 6 saltos com Aura Spheres do Mega Lucario e a tempestade de areia do Mega Tyranitar.',
            en: "The Mega form lasts 20 seconds and comes back after 60. It starts with a transformation and a rainbow burst that pushes the horde back, gains stats, swaps the special for a stronger one and turns its ability on: Mega Charizard X's blue-flame Dragon Flare, Mega Alakazam's Trace (every special fires two of your moves), Mega Gengar's Shadow Tag (slows anyone who comes close), Mega Gardevoir's Pixilate, Mega Lucario's 6-jump chain dash with Aura Spheres and Mega Tyranitar's sandstorm.",
            es: 'La forma Mega dura 20 segundos y vuelve después de 60. Empieza con una transformación y una explosión arcoíris que empuja a la horda, gana estadísticas, cambia el especial por uno más fuerte y activa la habilidad: el Dragon Flare en llamas azules de Mega Charizard X, el Trace de Mega Alakazam (cada especial dispara dos de tus movimientos), el Shadow Tag de Mega Gengar (ralentiza a quien se acerca), el Pixilate de Mega Gardevoir, la embestida en cadena de 6 saltos con Aura Spheres de Mega Lucario y la tormenta de arena de Mega Tyranitar.',
          },
          {
            pt: 'Duas conquistas novas: Laço Mega e Mestre Mega.',
            en: 'Two new achievements: Mega Bond and Mega Master.',
            es: 'Dos logros nuevos: Lazo Mega y Maestro Mega.',
          },
        ],
      },
      {
        title: { pt: 'Aegislash na Forma Lâmina', en: 'Aegislash in Blade Forme', es: 'Aegislash en Forma Filo' },
        notes: [
          {
            pt: 'Na Forma Lâmina, o Aegislash agora aparece com o sprite da Forma Lâmina (também na versão shiny), como nos jogos. O ícone sobre a cabeça saiu: o próprio sprite, o anel no chão e o botão do especial mostram a postura.',
            en: 'In Blade Forme, Aegislash now shows its Blade Forme sprite (shiny too), like in the games. The icon over its head is gone: the sprite itself, the ring at its feet and the special button show the stance.',
            es: 'En Forma Filo, Aegislash ahora aparece con el sprite de la Forma Filo (también en la versión shiny), como en los juegos. El ícono sobre su cabeza ya no está: el propio sprite, el anillo en el suelo y el botón del especial muestran la postura.',
          },
        ],
      },
    ],
  },
  {
    date: '2026-10-14',
    title: { pt: 'Contas, ranking e missões', en: 'Accounts, rankings and missions', es: 'Cuentas, ranking y misiones' },
    highlights: [
      { pt: 'Entre com o Google e guarde o seu progresso na nuvem.', en: 'Sign in with Google and keep your progress in the cloud.', es: 'Inicia sesión con Google y guarda tu progreso en la nube.' },
      { pt: 'Ranking por dificuldade, perfis públicos e ranking dos amigos.', en: 'Rankings per difficulty, public profiles and a friends ranking.', es: 'Ranking por dificultad, perfiles públicos y ranking de amigos.' },
      { pt: 'Missões diárias e semanais, conquistas e títulos.', en: 'Daily and weekly missions, achievements and titles.', es: 'Misiones diarias y semanales, logros y títulos.' },
      { pt: 'Três dificuldades: Normal, Difícil e Pesadelo.', en: 'Three difficulties: Normal, Hard and Nightmare.', es: 'Tres dificultades: Normal, Difícil y Pesadilla.' },
      { pt: 'Os 18 tipos ganharam ataque especial, e os chefes ficam furiosos.', en: 'All 18 types got a special attack, and bosses get enraged.', es: 'Los 18 tipos tienen ataque especial, y los jefes se enfurecen.' },
    ],
    changes: [
      {
        title: { pt: 'Metronome e Power Herb', en: 'Metronome and Power Herb', es: 'Metronome y Power Herb' },
        notes: [
          {
            pt: 'Novo item, Metronome: ao fim de cada salto da investida em cadeia, da investida de fogo ou de uma troca de postura (e ao soltar os outros especiais), dispara um dos seus golpes dali. No nível máximo, dois (numa cadeia, o segundo só no último salto).',
            en: 'New item, Metronome: at the end of every chain dash jump, fire dash or stance swap (and when other specials go off), it fires one of your moves from there. Two at max level (in a chain, the second only on the last jump).',
            es: 'Nuevo objeto, Metronome: al final de cada salto de la embestida en cadena, de la carga de fuego o de un cambio de postura (y al soltar los demás especiales), dispara uno de tus movimientos desde ahí. En el nivel máximo, dos (en una cadena, el segundo solo en el último salto).',
          },
          {
            pt: 'Novo item, Power Herb: cada inimigo derrubado pelo especial, ou durante uma cadeia, corta 0,25 s da recarga dele (até 0,75 s no nível máximo). A recarga nunca fica abaixo do mínimo de 4 s.',
            en: 'New item, Power Herb: each foe the special defeats, or any defeated mid-chain, cuts 0.25 s off its cooldown (up to 0.75 s at max level). The cooldown never drops below the 4 s minimum.',
            es: 'Nuevo objeto, Power Herb: cada enemigo derribado por el especial, o durante una cadena, le quita 0.25 s a su recarga (hasta 0.75 s en el nivel máximo). La recarga nunca baja del mínimo de 4 s.',
          },
        ],
      },
      {
        title: { pt: 'Investida em cadeia e Mudança de Postura', en: 'Chain dash and Stance Change', es: 'Carga en cadena y Cambio Táctico' },
        notes: [
          {
            pt: 'Treecko, Sprigatito, Riolu, Gible, Starly e Honedge ganharam um especial novo: uma investida que corta até o inimigo mais próximo. Acertou? Aperte de novo em meio segundo para saltar ao próximo, até 3 saltos (4 na evolução final). A recarga só começa quando a cadeia acaba.',
            en: 'Treecko, Sprigatito, Riolu, Gible, Starly and Honedge get a new special: a dash that slashes through to the nearest foe. Landed a hit? Press again within half a second to jump to the next one, up to 3 jumps (4 at the final evolution). The cooldown only starts when the chain ends.',
            es: 'Treecko, Sprigatito, Riolu, Gible, Starly y Honedge tienen un especial nuevo: una carga que corta hasta el enemigo más cercano. ¿Acertaste? Presiona de nuevo en medio segundo para saltar al siguiente, hasta 3 saltos (4 en la evolución final). La recarga solo empieza cuando termina la cadena.',
          },
          {
            pt: 'O Aegislash troca o especial pela Mudança de Postura: alterna entre a Forma Escudo (recebe 30% menos dano, golpes ×0,7) e a Forma Lâmina (golpes ×1,3). A forma atual aparece sobre a cabeça dele e no botão do especial.',
            en: 'Aegislash trades its special for Stance Change: it swaps between Shield Forme (takes 30% less damage, moves ×0.7) and Blade Forme (moves ×1.3). The current forme shows over its head and on the special button.',
            es: 'Aegislash cambia su especial por Cambio Táctico: alterna entre la Forma Escudo (recibe 30% menos daño, movimientos ×0.7) y la Forma Filo (movimientos ×1.3). La forma actual aparece sobre su cabeza y en el botón del especial.',
          },
        ],
      },
      {
        title: {
          pt: 'Cinco golpes novos: bote, corrente, minas e torres',
          en: 'Five new moves: lunges, chains, mines and turrets',
          es: 'Cinco movimientos nuevos: embestidas, cadenas, minas y torretas',
        },
        notes: [
          {
            pt: 'Quick Attack dá um bote curto contra o inimigo à frente, acerta tudo no caminho e deixa você invulnerável por um instante. Ele só avança na direção em que você já está andando e recarrega em no mínimo 1,5 s. Com Silk Scarf, evolui para Extreme Speed.',
            en: "Quick Attack lunges a short hop at the foe ahead, hits everything on the way and makes you invulnerable for an instant. It only lunges the way you're already walking and never recharges in under 1.5 s. With Silk Scarf it evolves into Extreme Speed.",
            es: 'Quick Attack da una embestida corta contra el enemigo de enfrente, golpea todo lo que hay en el camino y te deja invulnerable por un instante. Solo avanza en la dirección en la que ya estás caminando y se recarga en 1.5 s como mínimo. Con Silk Scarf, evoluciona a Extreme Speed.',
          },
          {
            pt: 'Shock Wave salta de inimigo em inimigo, perdendo 15% de força a cada salto, e evolui para Thunderbolt com Magnet. Hex faz o mesmo e causa ×1,7 de dano em quem está com algum status (queimado, envenenado, paralisado…).',
            en: 'Shock Wave jumps from foe to foe, losing 15% power per jump, and evolves into Thunderbolt with Magnet. Hex does the same and deals ×1.7 damage to foes with a status condition (burned, poisoned, paralyzed…).',
            es: 'Shock Wave salta de enemigo en enemigo, perdiendo 15% de fuerza en cada salto, y evoluciona a Thunderbolt con Magnet. Hex hace lo mismo y causa ×1.7 de daño a quien tiene algún problema de estado (quemado, envenenado, paralizado…).',
          },
          {
            pt: 'Toxic Spikes deixa espinhos que explodem quando um inimigo pisa (ou com metade do dano quando acabam) e evolui para Barb Barrage com Poison Barb. Will-O-Wisp deixa para trás um fogo-fátuo que atira sozinho e evolui para Inferno com Charcoal.',
            en: 'Toxic Spikes leaves spikes that burst when a foe steps on them (or for half damage when they run out) and evolves into Barb Barrage with Poison Barb. Will-O-Wisp leaves a wisp behind that shoots on its own and evolves into Inferno with Charcoal.',
            es: 'Toxic Spikes deja púas que explotan cuando un enemigo las pisa (o con la mitad del daño cuando se acaban) y evoluciona a Barb Barrage con Poison Barb. Will-O-Wisp deja atrás un fuego fatuo que dispara solo y evoluciona a Inferno con Charcoal.',
          },
          {
            pt: 'Quem aprende: Pichu, Eevee, Starly, Riolu e Torchic (Quick Attack), Pichu, Toxel e Beldum (Shock Wave), Gastly, Dreepy, Honedge e Rowlet (Hex), Budew, Bulbasaur e Chespin (Toxic Spikes), Charmander, Cyndaquil, Fennekin, Litten e Charcadet (Will-O-Wisp).',
            en: 'Who learns them: Pichu, Eevee, Starly, Riolu and Torchic (Quick Attack), Pichu, Toxel and Beldum (Shock Wave), Gastly, Dreepy, Honedge and Rowlet (Hex), Budew, Bulbasaur and Chespin (Toxic Spikes), Charmander, Cyndaquil, Fennekin, Litten and Charcadet (Will-O-Wisp).',
            es: 'Quién los aprende: Pichu, Eevee, Starly, Riolu y Torchic (Quick Attack), Pichu, Toxel y Beldum (Shock Wave), Gastly, Dreepy, Honedge y Rowlet (Hex), Budew, Bulbasaur y Chespin (Toxic Spikes), Charmander, Cyndaquil, Fennekin, Litten y Charcadet (Will-O-Wisp).',
          },
        ],
      },
      {
        title: { pt: 'Chefes furiosos, elites e corredores', en: 'Enraged bosses, elites and runners', es: 'Jefes furiosos, élites y corredores' },
        notes: [
          {
            pt: 'Os chefes do mapa agora alternam entre lutar de perto, avançando e batendo em área ao redor de si, e de longe, parados mirando em você. Abaixo da metade do HP eles ficam furiosos: contorno vermelho, cry, mais velocidade, menos pausa entre ataques e às vezes dois ataques seguidos.',
            en: 'Map bosses now switch between fighting up close, rushing in and slamming the area around them, and at range, standing back and aiming at you. Under half HP they enrage: red outline, a cry, more speed, shorter pauses between attacks and sometimes two attacks in a row.',
            es: 'Los jefes del mapa ahora alternan entre pelear de cerca, avanzando y golpeando el área a su alrededor, y de lejos, quietos y apuntándote. Por debajo de la mitad del HP se enfurecen: contorno rojo, grito, más velocidad, menos pausa entre ataques y a veces dos ataques seguidos.',
          },
          {
            pt: 'No primeiro minuto de cada chefe nascem bem menos inimigos comuns, então a luta é com ele. Depois disso a horda volta, então não vale enrolar.',
            en: "For each boss's first minute far fewer regular enemies spawn, so the fight is with it. After that the horde comes back, so don't drag it out.",
            es: 'En el primer minuto de cada jefe aparecen muchos menos enemigos comunes, así que la pelea es con él. Después la horda vuelve, así que no te conviene alargarlo.',
          },
          {
            pt: 'Quando a horda quase enche, quem nasce vem como elite: contorno vermelho, mais HP, mais EXP e mais dano (menos na luta com o Mewtwo, que segue um duelo). E uma espécie nova de cada fase corre, com rastros de velocidade, e mira em onde você vai estar, então correr em círculos não despista mais.',
            en: "When the horde is nearly full, new arrivals come in as elites: red outline, more HP, more EXP and more damage (not during the Mewtwo fight, which stays a duel). And one new species each stage runs, with speed lines, aiming where you're going to be, so running in circles no longer shakes it.",
            es: 'Cuando la horda está casi llena, los que aparecen llegan como élites: contorno rojo, más HP, más EXP y más daño (menos en la pelea con Mewtwo, que sigue siendo un duelo). Y una especie nueva de cada fase corre, con estelas de velocidad, y apunta a donde vas a estar, así que correr en círculos ya no la despista.',
          },
        ],
      },
      {
        title: { pt: 'Fim de partida sem impasse', en: 'No more endgame stalemates', es: 'Fin de partida sin estancamientos' },
        notes: [
          {
            pt: 'Os inimigos comuns não viram mais esponjas no fim da partida: o HP sobe mais devagar depois dos 8:00, e o Difícil e o Pesadelo agora apertam com hordas mais rápidas, mais cheias e que batem mais forte, em vez de HP de sobra. No fim, um inimigo do Pesadelo tem cerca de 2x o HP do Normal (antes eram 4,5x).',
            en: "Regular enemies no longer turn into sponges late in the run: their HP grows slower after 8:00, and Hard and Nightmare now press with faster, denser hordes that hit harder instead of piles of HP. Late on Nightmare an enemy has about 2x Normal's HP (it was 4.5x).",
            es: 'Los enemigos comunes ya no se vuelven esponjas al final de la partida: el HP sube más despacio después de las 8:00, y Difícil y Pesadilla ahora aprietan con hordas más rápidas, más llenas y que pegan más fuerte, en lugar de HP de sobra. Al final, un enemigo de Pesadilla tiene cerca de 2x el HP de Normal (antes era 4.5x).',
          },
          {
            pt: 'Cada chefe tem até o próximo chegar: se ainda estiver de pé quando o seguinte aparecer, ele foge sem deixar recompensa, em vez de se acumular na horda.',
            en: "Each boss has until the next one arrives: if it's still standing when the next boss shows up, it flees without a reward instead of piling up in the horde.",
            es: 'Cada jefe tiene hasta que llegue el siguiente: si sigue en pie cuando aparece el próximo, huye sin dejar recompensa, en lugar de acumularse en la horda.',
          },
          {
            pt: 'O Mewtwo virou o clímax: ao chegar, ele empurra a horda para longe e, enquanto estiver de pé, quase não nascem inimigos comuns. A horda só passa a crescer sem parar depois dos 15:00 se você escolher o modo sem fim.',
            en: 'Mewtwo is now the climax: it blasts the horde away when it arrives and, while it stands, regular enemies barely spawn. The horde only keeps escalating past 15:00 once you choose endless mode.',
            es: 'Mewtwo ahora es el clímax: al llegar, empuja lejos a la horda y, mientras siga en pie, casi no aparecen enemigos comunes. La horda solo crece sin parar después de las 15:00 si eliges el modo infinito.',
          },
        ],
      },
      {
        title: {
          pt: 'Horda que se renova e menos números na tela',
          en: 'A horde that renews and fewer numbers on screen',
          es: 'Una horda que se renueva y menos números en pantalla',
        },
        notes: [
          {
            pt: 'No fim da partida, a horda não vira mais um bloco parado: quando chega no limite, cada Pokémon novo toma o lugar do mais antigo fora da tela, e quem passa de um minuto fora da tela vai embora. Chefes, shinies, revoadas e quem está na tela nunca somem assim.',
            en: "Late in a run the horde no longer freezes into a still blob: at the cap, each new Pokémon takes the place of the oldest one off-screen, and anyone off-screen for over a minute leaves. Bosses, shinies, flocks and anything on screen never vanish this way.",
            es: 'Al final de la partida, la horda ya no se vuelve un bloque inmóvil: cuando llega al límite, cada Pokémon nuevo toma el lugar del más antiguo fuera de la pantalla, y quien pasa más de un minuto fuera de la pantalla se va. Los jefes, los shinies, las bandadas y lo que está en pantalla nunca desaparecen así.',
          },
          {
            pt: 'Números de dano agora têm três opções em Ajustes: Todos, Reduzidos (o novo padrão) e OFF. Em Reduzidos, com a tela cheia aparecem só os maiores acertos, mais os do chefe, e eles somem um pouco antes.',
            en: 'Damage numbers now have three options in Settings: All, Reduced (the new default) and OFF. On Reduced, a crowded screen only shows the biggest hits, plus the boss\'s, and they fade a little sooner.',
            es: 'Los números de daño ahora tienen tres opciones en Ajustes: Todos, Reducidos (el nuevo predeterminado) y OFF. En Reducidos, con la pantalla llena solo aparecen los golpes más grandes, más los del jefe, y desaparecen un poco antes.',
          },
        ],
      },
      {
        title: { pt: 'Entrar ou jogar como convidado', en: 'Sign in or play as a guest', es: 'Iniciar sesión o jugar como invitado' },
        notes: [
          {
            pt: 'Ao tocar em Jogar sem estar conectado, o jogo pergunta se você quer entrar com o Google (a conta é criada no primeiro acesso) ou jogar como convidado. Escolhendo convidado, ele não pergunta de novo até recarregar a página.',
            en: "Tapping Play while signed out now asks whether you want to sign in with Google (the account is created the first time) or play as a guest. Pick guest and it won't ask again until the page reloads.",
            es: 'Al tocar Jugar sin haber iniciado sesión, el juego pregunta si quieres entrar con Google (la cuenta se crea en el primer acceso) o jugar como invitado. Si eliges invitado, no vuelve a preguntar hasta que recargues la página.',
          },
          {
            pt: 'Depois de entrar com o Google, o jogo volta direto para o menu, sem a tela de "Aperte qualquer tecla".',
            en: 'After signing in with Google, the game comes back straight to the menu, skipping the "Press any key" screen.',
            es: 'Después de entrar con Google, el juego vuelve directo al menú, sin la pantalla de "Presiona cualquier tecla".',
          },
        ],
      },
      {
        title: { pt: 'Ranking conferido pelo servidor', en: 'A ranking the server checks', es: 'Ranking verificado por el servidor' },
        notes: [
          {
            pt: 'Cada partida do ranking agora é jogada de novo pelo servidor, a partir do replay, e só fica no quadro se terminar igual. Enquanto isso, ela aparece como "Conferindo…".',
            en: 'Every ranked run is now played again by the server from its replay, and only stays on the board if it ends the same. Meanwhile it shows as "Checking…".',
            es: 'Cada partida del ranking ahora la vuelve a jugar el servidor a partir del replay, y solo queda en la tabla si termina igual. Mientras tanto, aparece como "Verificando…".',
          },
          {
            pt: 'O tamanho de cada Pokémon na hora de acertar e levar golpes agora vem pronto com o jogo. Antes, um inimigo que surgia antes do sprite baixar tinha um corpo diferente por alguns instantes.',
            en: 'Each Pokémon\'s hitbox now ships with the game. Before, an enemy that showed up before its sprite downloaded had a different body for a moment.',
            es: 'El tamaño de cada Pokémon a la hora de golpear y recibir golpes ahora viene listo con el juego. Antes, un enemigo que aparecía antes de que su sprite se descargara tenía un cuerpo distinto por unos instantes.',
          },
        ],
      },
      {
        title: { pt: 'Ranking, perfis e amigos', en: 'Ranking, profiles and friends', es: 'Ranking, perfiles y amigos' },
        notes: [
          {
            pt: 'Ranking por tempo sobrevivido na tela inicial, um para cada dificuldade, com as abas Hoje, Semana e Total. Dá para filtrar por Pokémon e ver só os amigos. Hoje e Semana viram à meia-noite de Brasília.',
            en: 'A ranking by time survived on the title screen, one per difficulty, with Today, Week and All time tabs. Filter it by Pokémon or show only your friends. Today and Week turn over at midnight Brasília time.',
            es: 'Ranking por tiempo sobrevivido en la pantalla de inicio, uno para cada dificultad, con las pestañas Hoy, Semana y Total. Puedes filtrar por Pokémon y ver solo a tus amigos. Hoy y Semana se reinician a medianoche, hora de Brasilia.',
          },
          {
            pt: 'Com uma conta, cada partida entra no ranking sozinha, e o resumo do fim mostra sua posição do dia, da semana e geral. Sem internet, ela entra quando a conexão voltar.',
            en: 'With an account, every run joins the ranking on its own, and the results screen shows where you stand today, this week and all time. Offline, it joins once you are back online.',
            es: 'Con una cuenta, cada partida entra sola en el ranking, y el resumen del final muestra tu posición del día, de la semana y general. Sin internet, entra cuando vuelva la conexión.',
          },
          {
            pt: 'Perfil público: escolha um nome e um nome de usuário e compartilhe o link. Ele mostra seu título, os recordes de cada dificuldade, a Pokédex e as partidas recentes. Siga outros treinadores para montar o ranking dos amigos.',
            en: 'Public profiles: pick a name and a username and share the link. It shows your title, your records on each difficulty, your Pokédex and your recent runs. Follow other trainers to build your friends ranking.',
            es: 'Perfil público: elige un nombre y un nombre de usuario y comparte el enlace. Muestra tu título, los récords de cada dificultad, la Pokédex y las partidas recientes. Sigue a otros entrenadores para armar el ranking de amigos.',
          },
        ],
      },
      {
        title: {
          pt: 'Dificuldades e um fim de partida que volta a assustar',
          en: 'Difficulty levels and an endgame that bites again',
          es: 'Dificultades y un final de partida que vuelve a asustar',
        },
        notes: [
          {
            pt: 'Três níveis na tela de seleção do Pokémon: Normal, Difícil e Pesadelo. Todos já vêm liberados e a escolha fica salva. O Difícil traz hordas bem mais duras, que batem mais forte. O Pesadelo vai além e corta toda a cura pela metade.',
            en: 'Three levels on the Pokémon select screen: Normal, Hard and Nightmare. All of them are open from the start and your pick is saved. Hard brings much tougher hordes that hit harder. Nightmare goes further and halves every heal.',
            es: 'Tres niveles en la pantalla de selección de Pokémon: Normal, Difícil y Pesadilla. Todos vienen desbloqueados y la elección queda guardada. Difícil trae hordas mucho más duras, que pegan más fuerte. Pesadilla va más allá y reduce toda la curación a la mitad.',
          },
          {
            pt: 'A dificuldade aparece na pausa e no resumo do fim da partida, e cada partida guarda a sua para o ranking que vem aí.',
            en: 'The difficulty shows in the pause menu and on the results screen, and every run keeps its own for the upcoming ranking.',
            es: 'La dificultad aparece en la pausa y en el resumen del final de la partida, y cada partida guarda la suya para el ranking que viene.',
          },
          {
            pt: 'No Normal, os últimos minutos voltaram a ser uma ameaça. A partir de 8:00 os inimigos ganham HP mais rápido e, de 10:00 em diante, aparecem mais deles. Antes, um time pronto limpava a tela antes de qualquer inimigo encostar.',
            en: 'On Normal, the last minutes are a threat again. From 8:00 enemies gain HP faster, and from 10:00 more of them show up. Before, a finished build cleared the screen before anything could touch you.',
            es: 'En Normal, los últimos minutos vuelven a ser una amenaza. A partir de las 8:00 los enemigos ganan HP más rápido y, de las 10:00 en adelante, aparecen más. Antes, un equipo armado limpiaba la pantalla antes de que cualquier enemigo te tocara.',
          },
        ],
      },
      {
        title: { pt: 'Contas: seu progresso na nuvem', en: 'Accounts: your progress in the cloud', es: 'Cuentas: tu progreso en la nube' },
        notes: [
          {
            pt: 'Entre com o Google pelo botão no canto da tela inicial para guardar o progresso na nuvem e continuar em qualquer aparelho. Jogar como convidado continua sendo o padrão, e nada muda para quem não entrar.',
            en: 'Sign in with Google from the button in the corner of the title screen to keep your progress in the cloud and pick it up on any device. Playing as a guest is still the default, and nothing changes if you don\'t sign in.',
            es: 'Entra con Google desde el botón en la esquina de la pantalla de inicio para guardar tu progreso en la nube y seguir en cualquier dispositivo. Jugar como invitado sigue siendo lo predeterminado, y nada cambia para quien no entre.',
          },
          {
            pt: 'Ao entrar, o que você conquistou como convidado vai junto: a Pokédex, os ovos, os Pokémon chocados e as conquistas se somam aos da conta, e cada melhoria, recorde e missão fica com o maior valor.',
            en: 'When you sign in, everything you got as a guest comes along: the Pokédex, eggs, hatched Pokémon and achievements join the account\'s, and every upgrade, record and mission keeps the higher value.',
            es: 'Al entrar, lo que conseguiste como invitado se va contigo: la Pokédex, los huevos, los Pokémon eclosionados y los logros se suman a los de la cuenta, y cada mejora, récord y misión se queda con el valor más alto.',
          },
          {
            pt: 'O progresso sincroniza no fim de cada partida. Sem internet, o jogo segue normal e sincroniza depois.',
            en: 'Progress syncs at the end of every run. Offline, the game plays as usual and syncs later.',
            es: 'El progreso se sincroniza al final de cada partida. Sin internet, el juego sigue normal y sincroniza después.',
          },
        ],
      },
      {
        title: {
          pt: 'Um especial para cada tipo e números de dano legíveis',
          en: 'A special for every type and readable damage numbers',
          es: 'Un especial para cada tipo y números de daño legibles',
        },
        notes: [
          {
            pt: 'Os 18 tipos agora têm o seu ataque especial, que fica mais forte na evolução final: Thunderbolt → Bolt Strike, Dragon Pulse → Draco Meteor, Shadow Ball → Astral Barrage, Bulldoze → Precipice Blades, Air Cutter → Aeroblast e mais. Raios do céu, chuvas de meteoros e de gelo, anéis de projéteis, muralhas que avançam e rastros de veneno, cada um com a cor e o efeito do tipo.',
            en: 'All 18 types now have their own special attack, which grows stronger at the final evolution: Thunderbolt → Bolt Strike, Dragon Pulse → Draco Meteor, Shadow Ball → Astral Barrage, Bulldoze → Precipice Blades, Air Cutter → Aeroblast and more. Bolts from the sky, meteor and icicle showers, rings of projectiles, sweeping walls and poison trails, each with its type\'s color and effect.',
            es: 'Los 18 tipos ahora tienen su ataque especial, que se vuelve más fuerte en la evolución final: Thunderbolt → Bolt Strike, Dragon Pulse → Draco Meteor, Shadow Ball → Astral Barrage, Bulldoze → Precipice Blades, Air Cutter → Aeroblast y más. Rayos del cielo, lluvias de meteoros y de hielo, anillos de proyectiles, murallas que avanzan y estelas de veneno, cada uno con el color y el efecto de su tipo.',
          },
          {
            pt: 'Os Pokémon dos ovos usam o especial do primeiro tipo deles. O Guia lista os 18 e quem usa cada um.',
            en: 'Egg Pokémon use their first type\'s special. The guide lists all 18 and who uses each one.',
            es: 'Los Pokémon de los huevos usan el especial de su primer tipo. La Guía lista los 18 y quién usa cada uno.',
          },
          {
            pt: 'Números de dano num mesmo alvo se somam num número que cresce, com no máximo três por alvo em posições fixas. Chefes sob muitos golpes não viram mais uma tira ilegível, e os acertos super efetivos continuam em amarelo e por cima.',
            en: 'Damage numbers on the same target add up into one growing number, at most three per target in fixed spots. Bosses under many moves no longer turn into an unreadable strip, and super-effective hits stay yellow and on top.',
            es: 'Los números de daño sobre un mismo objetivo se suman en un número que crece, con un máximo de tres por objetivo en posiciones fijas. Los jefes bajo muchos golpes ya no se vuelven una tira ilegible, y los golpes supereficaces siguen en amarillo y por encima.',
          },
        ],
      },
      {
        title: { pt: 'Aviso de captura só na primeira vez', en: 'Catch notice only the first time', es: 'Aviso de captura solo la primera vez' },
        notes: [
          {
            pt: 'Derrotar um shiny de uma espécie que já é sua não mostra mais o aviso de captura. Ele aparece só quando o shiny é novo na sua Pokédex.',
            en: 'Defeating a shiny of a species you already own no longer shows the catch notice. It only shows when the shiny is new to your Pokédex.',
            es: 'Derrotar a un shiny de una especie que ya es tuya ya no muestra el aviso de captura. Solo aparece cuando el shiny es nuevo en tu Pokédex.',
          },
        ],
      },
      {
        title: { pt: 'Ovos, Pokédex e missões juntos', en: 'Eggs, Pokédex and missions together', es: 'Huevos, Pokédex y misiones juntos' },
        notes: [
          {
            pt: 'O Pokémon que sai de um ovo entra na Pokédex como capturado, shiny se for o caso, e a linha evolutiva inteira dele conta como vista. Cada forma que você joga, inclusive as que alcança evoluindo, também conta como sua.',
            en: 'The Pokémon that comes out of an egg joins the Pokédex as caught, shiny if it is, and its whole evolution line counts as seen. Every form you play, the ones you evolve into included, counts as yours too.',
            es: 'El Pokémon que sale de un huevo entra en la Pokédex como atrapado, shiny si es el caso, y toda su línea evolutiva cuenta como vista. Cada forma que juegas, incluidas las que alcanzas evolucionando, también cuenta como tuya.',
          },
          {
            pt: 'Quatro conquistas novas: veja 100 espécies, capture todas as formas dos 27 iniciais, choque o primeiro ovo e choque um shiny. Agora são 53.',
            en: 'Four new achievements: see 100 species, catch every form of the 27 starters, hatch your first egg and hatch a shiny. There are 53 now.',
            es: 'Cuatro logros nuevos: ve 100 especies, atrapa todas las formas de los 27 iniciales, eclosiona tu primer huevo y eclosiona un shiny. Ahora son 53.',
          },
          {
            pt: 'Missões novas de andar, de ver espécies diferentes numa partida e de chocar ovos. Algumas semanais e toda medalha de ouro também dão um ovo, sem passar das 3 vagas da incubadora nem do limite de ovos por partida.',
            en: 'New missions to walk, to see different species in one run and to hatch eggs. Some weeklies and every gold medal also give an egg, within the incubator\'s 3 slots and the per-run egg limit.',
            es: 'Misiones nuevas de caminar, de ver especies distintas en una partida y de eclosionar huevos. Algunas semanales y todas las medallas de oro también dan un huevo, sin pasar de los 3 espacios de la incubadora ni del límite de huevos por partida.',
          },
          {
            pt: 'O resultado da partida ficou mais enxuto: Pokédex, ovos e missões num bloco só, que cabe no celular em pé.',
            en: 'A tidier run result: Pokédex, eggs and missions in one block that fits a phone held upright.',
            es: 'El resultado de la partida quedó más compacto: Pokédex, huevos y misiones en un solo bloque, que cabe en el celular en vertical.',
          },
          {
            pt: 'No computador, as abas de região da escolha de Pokémon quebram em duas linhas, então Paldea e a aba Ovos ficam sempre à vista.',
            en: 'On a computer, the region tabs of the Pokémon select wrap onto two lines, so Paldea and the Eggs tab are always in sight.',
            es: 'En la computadora, las pestañas de región de la selección de Pokémon se dividen en dos líneas, así que Paldea y la pestaña Huevos siempre quedan a la vista.',
          },
          {
            pt: 'O Guia agora diz certo: os lendários das fendas podem ser shiny (1 em 8). Chefes do mapa, Mewtwo e Arceus nunca são.',
            en: 'The guide now gets it right: rift legendaries can be shiny (1 in 8). Map bosses, Mewtwo and Arceus never are.',
            es: 'La Guía ahora lo dice bien: los legendarios de las grietas pueden ser shiny (1 en 8). Los jefes del mapa, Mewtwo y Arceus nunca lo son.',
          },
        ],
      },
      {
        title: { pt: 'Missões, conquistas e títulos', en: 'Missions, achievements and titles', es: 'Misiones, logros y títulos' },
        notes: [
          {
            pt: 'Missões no menu do título: três diárias e duas semanais, iguais para todo mundo no mesmo dia, com recompensa em Poké Dollars. Derrote Pokémon de um tipo ou na chuva, vença fendas, abra baús, pegue o Pay Day do Meowth e mais.',
            en: 'Missions in the title menu: three daily and two weekly ones, the same for everyone on the same day, paid in Poké Dollars. Defeat Pokémon of a type or in the rain, win rifts, open chests, grab Meowth\'s Pay Day and more.',
            es: 'Misiones en el menú del título: tres diarias y dos semanales, iguales para todo el mundo el mismo día, con recompensa en Poké Dollars. Derrota Pokémon de un tipo o bajo la lluvia, gana grietas, abre cofres, recoge el Pay Day de Meowth y más.',
          },
          {
            pt: '49 conquistas com medalhas de bronze, prata e ouro, de jogar a primeira partida a derrotar o Arceus. Cada medalha paga Poké Dollars.',
            en: '49 achievements with bronze, silver and gold medals, from playing your first run to defeating Arceus. Every medal pays Poké Dollars.',
            es: '49 logros con medallas de bronce, plata y oro, desde jugar tu primera partida hasta derrotar a Arceus. Cada medalla paga Poké Dollars.',
          },
          {
            pt: 'Algumas conquistas dão um título, como Caçador de Shinies ou Domador de Lendas, que aparece na tela de título e no resultado da partida.',
            en: 'Some achievements grant a title, like Shiny Hunter or Legend Tamer, shown on the title screen and on the run results.',
            es: 'Algunos logros dan un título, como Cazador de Shinies o Domador de Leyendas, que aparece en la pantalla de título y en el resultado de la partida.',
          },
          {
            pt: 'O resultado da partida mostra o progresso de cada missão e as medalhas novas. Durante a partida, nada de avisos extras.',
            en: 'The run results show every mission\'s progress and the new medals. No extra pop-ups during the run.',
            es: 'El resultado de la partida muestra el progreso de cada misión y las medallas nuevas. Durante la partida, nada de avisos extra.',
          },
        ],
      },
    ],
  },
  {
    date: '2026-10-13',
    title: { pt: 'Lançamento', en: 'Launch', es: 'Lanzamiento' },
    highlights: [
      { pt: 'Sobreviva 15 minutos de hordas com os 27 iniciais, de Kanto a Paldea.', en: 'Survive 15 minutes of hordes with all 27 starters, from Kanto to Paldea.', es: 'Sobrevive 15 minutos de hordas con los 27 iniciales, de Kanto a Paldea.' },
      { pt: 'Ovos com 25 Pokémon novos para jogar e uma Pokédex dentro do jogo.', en: 'Eggs with 25 new Pokémon to play and an in-game Pokédex.', es: 'Huevos con 25 Pokémon nuevos para jugar y una Pokédex dentro del juego.' },
      { pt: 'Fendas lendárias, modo sem fim e o Arceus caçando você.', en: 'Legendary rifts, endless mode and Arceus hunting you down.', es: 'Grietas legendarias, modo sin fin y Arceus cazándote.' },
      { pt: 'Cinco biomas com clima, shinies e chefes lendários.', en: 'Five biomes with weather, shinies and legendary bosses.', es: 'Cinco biomas con clima, shinies y jefes legendarios.' },
      { pt: 'Poké Mart, evolução de golpes e versão para celular.', en: 'The Poké Mart, move evolutions and a mobile version.', es: 'Poké Mart, evolución de movimientos y versión para celular.' },
    ],
    changes: [
      {
        title: { pt: 'Ovos e 25 Pokémon novos para jogar', en: 'Eggs and 25 new Pokémon to play', es: 'Huevos y 25 Pokémon nuevos para jugar' },
        notes: [
          {
            pt: 'Chefes, baús trancados e fendas às vezes deixam um ovo. Ele vai para a incubadora (3 vagas) e choca com os passos que você dá nas partidas.',
            en: 'Bosses, locked chests and rifts sometimes leave an egg. It goes to the incubator (3 slots) and hatches with the steps you take in runs.',
            es: 'Los jefes, los cofres cerrados y las grietas a veces dejan un huevo. Va a la incubadora (3 espacios) y eclosiona con los pasos que das en las partidas.',
          },
          {
            pt: '25 famílias jogáveis saem dos ovos, de todos os tipos e gerações: de Pichu, Eevee e Machop a Gastly, Riolu e Zorua, e os raros Dratini, Larvitar, Beldum, Gible e Dreepy. Cada uma com golpe, especial e evolução no meio da partida.',
            en: '25 playable families hatch from eggs, from every type and generation: from Pichu, Eevee and Machop to Gastly, Riolu and Zorua, plus the rare Dratini, Larvitar, Beldum, Gible and Dreepy. Each one with its own move, special and mid-run evolution.',
            es: '25 familias jugables salen de los huevos, de todos los tipos y generaciones: de Pichu, Eevee y Machop a Gastly, Riolu y Zorua, y los raros Dratini, Larvitar, Beldum, Gible y Dreepy. Cada una con movimiento, especial y evolución a mitad de la partida.',
          },
          {
            pt: 'Chocar é um momento: o ovo balança, racha e o Pokémon aparece com o seu grito. 1% de chance de sair shiny, e aí ele é shiny em todas as partidas.',
            en: 'Hatching is a moment: the egg wobbles, cracks and the Pokémon pops out with its cry. A 1% chance to hatch shiny, and then it stays shiny in every run.',
            es: 'Eclosionar es todo un momento: el huevo se balancea, se agrieta y el Pokémon aparece con su grito. 1% de probabilidad de salir shiny, y entonces es shiny en todas las partidas.',
          },
          {
            pt: 'A escolha de parceiro ganhou a aba Ovos, com os chocados e as silhuetas dos que faltam. Repetidos e ovos sem vaga viram Poké Dollars.',
            en: 'The Pokémon select has a new Eggs tab with your hatchlings and silhouettes of the rest. Duplicates and eggs with no room become Poké Dollars.',
            es: 'La selección de compañero ahora tiene la pestaña Huevos, con los eclosionados y las siluetas de los que faltan. Los repetidos y los huevos sin espacio se convierten en Poké Dollars.',
          },
        ],
      },
      {
        title: { pt: 'Pokédex dentro do jogo', en: 'An in-game Pokédex', es: 'Pokédex dentro del juego' },
        notes: [
          {
            pt: 'O botão Pokédex do título agora abre a Pokédex do jogo: todas as espécies, com as que você viu, quantas derrotou e quais capturou. As que faltam aparecem como "?".',
            en: 'The Pokédex button on the title now opens the in-game Pokédex: every species, with the ones you have seen, how many you defeated and which you caught. Missing ones show as "?".',
            es: 'El botón Pokédex del título ahora abre la Pokédex del juego: todas las especies, con las que viste, cuántas derrotaste y cuáles atrapaste. Las que faltan aparecen como "?".',
          },
          {
            pt: 'Shiny derrotado vira seu: ele entra na Pokédex como capturado, com o brilho.',
            en: 'A defeated shiny is yours: it joins the Pokédex as caught, sparkle and all.',
            es: 'Un shiny derrotado es tuyo: entra en la Pokédex como atrapado, con su brillo.',
          },
          {
            pt: 'O fim da partida mostra o que entrou de novo, como "+3 espécies novas · 1 shiny capturado".',
            en: 'The end of a run shows what is new, like "+3 new species · 1 shiny caught".',
            es: 'El final de la partida muestra lo que entró de nuevo, como "+3 especies nuevas · 1 shiny atrapado".',
          },
        ],
      },
      {
        title: { pt: 'Avisos em fila e 3 fendas por partida', en: 'Queued notices and 3 rifts per run', es: 'Avisos en fila y 3 grietas por partida' },
        notes: [
          {
            pt: 'Os avisos agora fazem fila numa coluna, sem cobrir um ao outro, o HUD ou o seu Pokémon. Eles esperam o menu de nível e a evolução terminarem, então nenhum se perde. No celular deitado, eles ficam no canto direito.',
            en: 'Notices now line up in a column, without covering each other, the HUD or your Pokémon. They wait for the level-up menu and evolutions to finish, so none get lost. On a phone held sideways, they sit on the right.',
            es: 'Los avisos ahora hacen fila en una columna, sin taparse entre sí ni tapar el HUD o tu Pokémon. Esperan a que terminen el menú de nivel y la evolución, así que ninguno se pierde. En el celular en horizontal, quedan en la esquina derecha.',
          },
          {
            pt: 'A fenda lendária espera um chefe vivo cair por até 45 segundos e depois abre mesmo assim. Toda partida tem 3 fendas, mesmo quando os chefes demoram.',
            en: 'A legendary rift waits up to 45 seconds for a living boss to fall, then opens anyway. Every run gets 3 rifts, even when bosses take a while.',
            es: 'La grieta legendaria espera hasta 45 segundos a que caiga un jefe vivo y después se abre de todos modos. Cada partida tiene 3 grietas, aunque los jefes tarden.',
          },
          {
            pt: 'Ao sair de uma fenda, a troca de clima espera alguns segundos, para não chegar junto com o loot.',
            en: 'When you leave a rift, the weather waits a few seconds to change, so it doesn\'t arrive along with the loot.',
            es: 'Al salir de una grieta, el cambio de clima espera unos segundos, para no llegar junto con el botín.',
          },
        ],
      },
      {
        title: { pt: 'Tudo junto: horda do bioma e Dragões', en: 'All together: biome hordes and Dragons', es: 'Todo junto: horda del bioma y Dragones' },
        notes: [
          {
            pt: 'A horda segue o bioma: as espécies novas de cada fase puxam para os tipos do lugar (Planta e Inseto na floresta, Pedra e Terra na caverna, Fantasma e Psíquico na torre).',
            en: 'The horde follows the biome: each stage\'s new species lean towards the local types (Grass and Bug in the forest, Rock and Ground in the cave, Ghost and Psychic in the tower).',
            es: 'La horda sigue al bioma: las especies nuevas de cada fase tiran hacia los tipos del lugar (Planta y Bicho en el bosque, Roca y Tierra en la cueva, Fantasma y Psíquico en la torre).',
          },
          {
            pt: 'O tipo Dragão chegou à horda com 15 espécies, de Dratini a Flygon. Dragões resistem a Fogo, Água, Planta e Elétrico e sofrem com Gelo, Dragão e Fada. A horda agora tem 193 espécies.',
            en: 'Dragon types join the horde with 15 species, from Dratini to Flygon. Dragons resist Fire, Water, Grass and Electric and fall to Ice, Dragon and Fairy. The horde now has 193 species.',
            es: 'El tipo Dragón llegó a la horda con 15 especies, de Dratini a Flygon. Los Dragones resisten Fuego, Agua, Planta y Eléctrico y sufren con Hielo, Dragón y Hada. La horda ahora tiene 193 especies.',
          },
          {
            pt: 'Pokémon com comportamento entram no sorteio da partida, no máximo um por fase a partir de 1:00. Bronzor, Drifloon, Lokix e Vikavolt também ganharam um.',
            en: 'Pokémon with a behavior join each run\'s draw, at most one per stage from 1:00. Bronzor, Drifloon, Lokix and Vikavolt got one too.',
            es: 'Los Pokémon con comportamiento entran en el sorteo de la partida, como máximo uno por fase a partir de 1:00. Bronzor, Drifloon, Lokix y Vikavolt también recibieron uno.',
          },
          {
            pt: 'Dentro de uma fenda o clima e a troca de bioma esperam lá fora, e os lendários das fendas e o Arceus carregam em segundo plano.',
            en: 'Inside a rift, the weather and the biome change wait outside, and the rift legendaries and Arceus load in the background.',
            es: 'Dentro de una grieta, el clima y el cambio de bioma esperan afuera, y los legendarios de las grietas y Arceus cargan en segundo plano.',
          },
        ],
      },
      {
        title: { pt: 'Horda de todas as gerações', en: 'A horde from every generation', es: 'Una horda de todas las generaciones' },
        notes: [
          {
            pt: '171 Pokémon selvagens das 9 gerações. Cada partida sorteia o seu elenco, com poucas espécies novas por fase.',
            en: '171 wild Pokémon from all 9 generations. Every run draws its own cast, with only a few new species per stage.',
            es: '171 Pokémon salvajes de las 9 generaciones. Cada partida sortea su elenco, con pocas especies nuevas por fase.',
          },
          {
            pt: 'Os inimigos são divididos em 5 faixas pelo total de status base: básicos no começo, evoluções no fim. Revoadas e cercos usam o elenco da partida.',
            en: 'Enemies are split into 5 tiers by base stat total: basic Pokémon early, evolved ones late. Swarms and rings use the run\'s cast.',
            es: 'Los enemigos se dividen en 5 rangos según el total de estadísticas base: básicos al principio, evoluciones al final. Las bandadas y los cercos usan el elenco de la partida.',
          },
          {
            pt: 'A partida começa mais rápido: só o primeiro elenco é baixado antes, o resto chega em segundo plano.',
            en: 'Runs start faster: only the opening cast is downloaded up front, the rest streams in the background.',
            es: 'La partida empieza más rápido: solo el primer elenco se descarga antes, el resto llega en segundo plano.',
          },
          {
            pt: 'Pokédex com filtro por faixa e o Guia com a seção da horda selvagem.',
            en: 'A tier filter in the Pokédex and a wild horde section in the guide.',
            es: 'Pokédex con filtro por rango y la Guía con la sección de la horda salvaje.',
          },
        ],
      },
      {
        title: { pt: 'Fendas lendárias e modo sem fim', en: 'Legendary rifts and endless mode', es: 'Grietas legendarias y modo infinito' },
        notes: [
          {
            pt: 'Algumas vezes por partida, uma fenda se abre no mapa. Entre nela para enfrentar Lugia, Ho-Oh, Kyogre, Groudon, Rayquaza ou Dialga numa arena fechada, com ataques próprios de cada lendário.',
            en: 'A few times per run, a rift opens on the map. Step in to face Lugia, Ho-Oh, Kyogre, Groudon, Rayquaza or Dialga in a walled arena, each with its own attacks.',
            es: 'Algunas veces por partida, una grieta se abre en el mapa. Entra en ella para enfrentar a Lugia, Ho-Oh, Kyogre, Groudon, Rayquaza o Dialga en una arena cerrada, con ataques propios de cada legendario.',
          },
          {
            pt: 'Vencer paga muita EXP, Poké Dollars, Poké Balls, itens e cura. Às vezes o lendário é shiny e paga o dobro. Se o tempo acabar, a fenda colapsa e joga você de volta.',
            en: 'Winning pays lots of EXP, Poké Dollars, Poké Balls, items and a heal. Sometimes the legendary is shiny and pays double. If time runs out, the rift collapses and throws you back.',
            es: 'Ganar paga mucha EXP, Poké Dollars, Poké Balls, objetos y curación. A veces el legendario es shiny y paga el doble. Si se acaba el tiempo, la grieta colapsa y te devuelve afuera.',
          },
          {
            pt: 'Depois de derrotar Mewtwo, continue no modo sem fim: a horda não para de crescer e Arceus vem caçar você às 20:00. Dá para derrotá-lo, se você for muito forte.',
            en: 'After beating Mewtwo, keep going in endless mode: the horde keeps growing and Arceus comes hunting at 20:00. It can be beaten, if you are strong enough.',
            es: 'Después de derrotar a Mewtwo, sigue en el modo infinito: la horda no deja de crecer y Arceus viene a cazarte a las 20:00. Se le puede derrotar, si eres muy fuerte.',
          },
          {
            pt: 'O tempo sobrevivido agora vale mais: cada minuto além de 15:00 rende Poké Dollars extras no fim da partida.',
            en: 'Time survived is worth more now: every minute past 15:00 pays extra Poké Dollars at the end of the run.',
            es: 'El tiempo sobrevivido ahora vale más: cada minuto después de las 15:00 da Poké Dollars extra al final de la partida.',
          },
        ],
      },
      {
        title: { pt: 'Biomas e clima', en: 'Biomes and weather', es: 'Biomas y clima' },
        notes: [
          {
            pt: 'A partida agora atravessa cinco biomas: Rota 1, Floresta de Viridian, Monte Moon, Monte Prateado e Torre de Lavender, cada um com visual, itens quebráveis e música próprios.',
            en: 'A run now walks through five biomes: Route 1, Viridian Forest, Mt. Moon, Mt. Silver and Lavender Tower, each with its own look, breakables and music.',
            es: 'La partida ahora atraviesa cinco biomas: Ruta 1, Bosque Verde, Monte Moon, Monte Plateado y Torre Lavanda, cada uno con aspecto, objetos rompibles y música propios.',
          },
          {
            pt: 'Clima que muda durante a partida e vale para todos: sol forte (Fogo ×1,5, Água ×0,75), chuva (o inverso), tempestade de areia, neve e névoa.',
            en: 'Weather that changes during the run and applies to everyone: harsh sunlight (Fire ×1.5, Water ×0.75), rain (the opposite), sandstorm, snow and fog.',
            es: 'Clima que cambia durante la partida y vale para todos: sol intenso (Fuego ×1.5, Agua ×0.75), lluvia (al revés), tormenta de arena, nieve y niebla.',
          },
          {
            pt: 'Quatro temas novos na trilha sonora, um por bioma.',
            en: 'Four new soundtrack themes, one per biome.',
            es: 'Cuatro temas nuevos en la banda sonora, uno por bioma.',
          },
        ],
      },
      {
        title: { pt: 'Inimigos com personalidade', en: 'Enemies with personality', es: 'Enemigos con personalidad' },
        notes: [
          {
            pt: 'Seis comportamentos novos na horda: Chansey cura os aliados, Bronzong protege com um escudo que absorve dano, Nidoqueen chama Nidoran, Voltorb e Electrode explodem, Magnemite dispara raios e Hitmonlee salta sobre a horda.',
            en: 'Six new behaviors in the horde: Chansey heals its allies, Bronzong shields them with a ward that soaks damage, Nidoqueen calls in Nidoran, Voltorb and Electrode explode, Magnemite fires beams and Hitmonlee leaps over the horde.',
            es: 'Seis comportamientos nuevos en la horda: Chansey cura a sus aliados, Bronzong los protege con un escudo que absorbe daño, Nidoqueen llama a Nidoran, Voltorb y Electrode explotan, Magnemite dispara rayos y Hitmonlee salta sobre la horda.',
          },
          {
            pt: 'Todo ataque avisa antes: círculo vermelho, linha ou sombra no chão, piscando mais rápido quando o golpe está perto. A explosão do Voltorb fere os inimigos também.',
            en: 'Every attack warns you first: a red circle, a line or a shadow on the ground, blinking faster as the hit gets close. Voltorb\'s blast hurts enemies too.',
            es: 'Todo ataque avisa antes: círculo rojo, línea o sombra en el suelo, que parpadea más rápido cuando el golpe está cerca. La explosión de Voltorb también hiere a los enemigos.',
          },
          {
            pt: 'Um cerco de Voltorb aos 4:30 e uma seção nova no guia.',
            en: 'A ring of Voltorb at 4:30 and a new guide section.',
            es: 'Un cerco de Voltorb a las 4:30 y una sección nueva en la guía.',
          },
        ],
      },
      {
        title: { pt: 'Eventos no mapa', en: 'Map events', es: 'Eventos en el mapa' },
        notes: [
          {
            pt: 'Pontos de interesse surgem durante a partida e fazem você escolher para onde ir: altares de buff, fontes que curam e baús trancados que pedem 3 segundos dentro do anel enquanto uma emboscada fecha o cerco.',
            en: 'Points of interest show up during a run and make you choose where to go: buff altars, healing fountains and locked chests that need 3 seconds inside their ring while an ambush closes in.',
            es: 'Aparecen puntos de interés durante la partida que te hacen elegir adónde ir: altares de mejora, fuentes que curan y cofres cerrados que piden 3 segundos dentro del anillo mientras una emboscada cierra el cerco.',
          },
          {
            pt: 'Armadilhas de espinhos e bombas ferem você e a horda: atraia os selvagens para cima delas.',
            en: 'Spike and bomb traps hurt you and the horde alike: lure the wild Pokémon onto them.',
            es: 'Las trampas de púas y las bombas te hieren a ti y a la horda: atrae a los salvajes hacia ellas.',
          },
          {
            pt: 'Um Meowth foge com moedas: cada golpe derruba uma, e se ele desmaiar vem o Pay Day.',
            en: 'A Meowth runs off with coins: every hit knocks one loose, and if it faints you get the Pay Day.',
            es: 'Un Meowth huye con monedas: cada golpe le hace soltar una, y si se debilita llega el Pay Day.',
          },
          {
            pt: 'Setas na borda da tela apontam para os eventos importantes.',
            en: 'Arrows on the screen edge point to the important events.',
            es: 'Flechas en el borde de la pantalla apuntan a los eventos importantes.',
          },
        ],
      },
      {
        title: {
          pt: 'Site: Pokédex, guia, novidades e página legal',
          en: 'Website: Pokédex, guide, changelog and legal page',
          es: 'Sitio: Pokédex, guía, novedades y página legal',
        },
        notes: [
          {
            pt: 'Pokédex com todos os Pokémon do jogo, sprites animados, versão shiny, filtros por região, tipo e papel, e busca.',
            en: 'A Pokédex with every Pokémon in the game, animated sprites, shiny forms, region, type and role filters, and search.',
            es: 'Pokédex con todos los Pokémon del juego, sprites animados, versión shiny, filtros por región, tipo y rol, y búsqueda.',
          },
          {
            pt: 'Guia completo de como jogar, com os números do próprio jogo.',
            en: 'A complete how-to-play guide, with the game\'s own numbers.',
            es: 'Guía completa de cómo jugar, con los números del propio juego.',
          },
          {
            pt: 'Esta página de novidades e uma página de legal, privacidade e créditos.',
            en: 'This changelog and a legal, privacy and credits page.',
            es: 'Esta página de novedades y una página legal, de privacidad y de créditos.',
          },
        ],
      },
      {
        title: { pt: 'Nova tela de título', en: 'New title screen', es: 'Nueva pantalla de título' },
        notes: [
          {
            pt: 'Tela de título com um campo vivo ao fundo, logo em pixel art e menu: Jogar, Pokédex, Como jogar e Ajustes.',
            en: 'A title screen with a living meadow behind it, a pixel-art logo and a menu: Play, Pokédex, How to play and Settings.',
            es: 'Pantalla de título con un campo vivo de fondo, logo en pixel art y menú: Jugar, Pokédex, Cómo jugar y Ajustes.',
          },
          {
            pt: 'Os menus agora funcionam no controle: D-pad ou analógico esquerdo para navegar, A confirma, B volta e Start pausa.',
            en: 'Menus now work on a gamepad: D-pad or left stick to navigate, A confirms, B goes back and Start pauses.',
            es: 'Los menús ahora funcionan con control: D-pad o stick izquierdo para navegar, A confirma, B vuelve y Start pausa.',
          },
        ],
      },
      {
        title: { pt: 'Trilha chiptune original e Ajustes', en: 'Original chiptune soundtrack and Settings', es: 'Banda sonora chiptune original y Ajustes' },
        notes: [
          {
            pt: 'Trilha sonora original composta em código e sintetizada ao vivo: tema de vila nos menus, marcha na partida e tema de chefe.',
            en: 'An original soundtrack composed in code and synthesized live: a village theme in the menus, a march for the run and a boss theme.',
            es: 'Banda sonora original compuesta en código y sintetizada en vivo: tema de pueblo en los menús, marcha en la partida y tema de jefe.',
          },
          {
            pt: 'Tela de Ajustes, no título e na pausa: volume da música e dos efeitos, som, números de dano, tremor de tela e idioma.',
            en: 'A Settings screen, on the title screen and in the pause menu: music and effects volume, sound, damage numbers, screen shake and language.',
            es: 'Pantalla de Ajustes, en el título y en la pausa: volumen de la música y de los efectos, sonido, números de daño, vibración de pantalla e idioma.',
          },
        ],
      },
      {
        title: {
          pt: 'Páginas em português e inglês para buscadores',
          en: 'Portuguese and English pages for search engines',
          es: 'Páginas en portugués e inglés para buscadores',
        },
        notes: [
          {
            pt: 'Uma URL por idioma (/ e /en/), com descrição do jogo legível por buscadores e IAs.',
            en: 'One URL per language (/ and /en/), with a game description that search engines and AI assistants can read.',
            es: 'Una URL por idioma (/ y /en/), con una descripción del juego legible por buscadores e IA.',
          },
          {
            pt: 'Sitemap, robots.txt, llms.txt e dados estruturados.',
            en: 'Sitemap, robots.txt, llms.txt and structured data.',
            es: 'Sitemap, robots.txt, llms.txt y datos estructurados.',
          },
        ],
      },
      {
        title: { pt: 'Inglês e português', en: 'English and Portuguese', es: 'Inglés y portugués' },
        notes: [
          {
            pt: 'O jogo inteiro em português e inglês: menus, HUD, golpes, itens e Poké Mart. Nomes de Pokémon, golpes e itens seguem os oficiais em inglês.',
            en: 'The whole game in English and Portuguese: menus, HUD, moves, items and the Poké Mart. Pokémon, move and item names keep their official English names.',
            es: 'Todo el juego en portugués e inglés: menús, HUD, movimientos, objetos y Poké Mart. Los nombres de Pokémon, movimientos y objetos siguen los oficiales en inglés.',
          },
          {
            pt: 'O idioma vem do navegador e pode ser trocado no título (PT | EN ou tecla I) e na pausa.',
            en: 'The language follows your browser and can be switched on the title screen (PT | EN or the I key) and in the pause menu.',
            es: 'El idioma se toma del navegador y se puede cambiar en el título (PT | EN o tecla I) y en la pausa.',
          },
        ],
      },
      {
        title: { pt: 'Código aberto', en: 'Open source', es: 'Código abierto' },
        notes: [
          {
            pt: 'O código está no GitHub sob a licença MIT, com créditos para cada artista dos sprites.',
            en: 'The code is on GitHub under the MIT license, with credit for every sprite artist.',
            es: 'El código está en GitHub bajo la licencia MIT, con créditos para cada artista de los sprites.',
          },
          { pt: 'Avisos legais de fan game não oficial.', en: 'Legal notices for an unofficial fan game.', es: 'Avisos legales de fan game no oficial.' },
        ],
      },
      {
        title: { pt: 'Poké Dollars e Poké Mart', en: 'Poké Dollars and the Poké Mart', es: 'Poké Dollars y Poké Mart' },
        notes: [
          {
            pt: 'Inimigos soltam Poké Dollars (₽), e chefes soltam uma chuva deles. No fim da partida entra um bônus por tempo, derrotados e vitória.',
            en: 'Enemies drop Poké Dollars (₽), and bosses shower them. A bonus for time, fainted foes and winning comes at the end of the run.',
            es: 'Los enemigos sueltan Poké Dollars (₽), y los jefes sueltan una lluvia de ellos. Al final de la partida entra un bono por tiempo, derrotados y victoria.',
          },
          {
            pt: 'Poké Mart com melhorias permanentes: HP Up, Protein, Iron, Carbos, Calcium, Zinc, PP Up, Exp. Charm, Amulet Coin, Ability Capsule e Escape Rope.',
            en: 'A Poké Mart with permanent upgrades: HP Up, Protein, Iron, Carbos, Calcium, Zinc, PP Up, Exp. Charm, Amulet Coin, Ability Capsule and Escape Rope.',
            es: 'Poké Mart con mejoras permanentes: HP Up, Protein, Iron, Carbos, Calcium, Zinc, PP Up, Exp. Charm, Amulet Coin, Ability Capsule y Escape Rope.',
          },
          { pt: 'Trocar e Pular ofertas ao subir de nível.', en: 'Reroll and Skip on level up.', es: 'Cambiar y Saltar ofertas al subir de nivel.' },
        ],
      },
      {
        title: { pt: 'Evolução de golpes', en: 'Move evolutions', es: 'Evolución de movimientos' },
        notes: [
          {
            pt: 'Golpe no nível máximo + o item certo = um golpe evoluído, como Ember + Charcoal → Flamethrower.',
            en: 'A maxed move plus the right item becomes an evolved move, like Ember + Charcoal → Flamethrower.',
            es: 'Movimiento en el nivel máximo + el objeto correcto = un movimiento evolucionado, como Ember + Charcoal → Flamethrower.',
          },
          {
            pt: '10 evoluções e 7 itens de tipo novos (Charcoal, Mystic Water, Miracle Seed, Silk Scarf, Magnet, Poison Barb e Sharp Beak).',
            en: '10 evolutions and 7 new type items (Charcoal, Mystic Water, Miracle Seed, Silk Scarf, Magnet, Poison Barb and Sharp Beak).',
            es: '10 evoluciones y 7 objetos de tipo nuevos (Charcoal, Mystic Water, Miracle Seed, Silk Scarf, Magnet, Poison Barb y Sharp Beak).',
          },
        ],
      },
      {
        title: { pt: 'Shinies e chefes lendários', en: 'Shinies and legendary bosses', es: 'Shinies y jefes legendarios' },
        notes: [
          {
            pt: 'Pokémon selvagens shiny (1 em 450) viram elites que soltam Poké Ball, e o seu inicial pode ser shiny (1 em 64).',
            en: 'Shiny wild Pokémon (1 in 450) become elites that drop a Poké Ball, and your starter can be shiny (1 in 64).',
            es: 'Los Pokémon salvajes shiny (1 en 450) se vuelven élites que sueltan una Poké Ball, y tu inicial puede ser shiny (1 en 64).',
          },
          {
            pt: 'Articuno, Zapdos, Moltres e Mewtwo como chefes com ataques próprios. Às vezes Mew aparece no final.',
            en: 'Articuno, Zapdos, Moltres and Mewtwo as bosses with their own attacks. Sometimes Mew shows up at the end.',
            es: 'Articuno, Zapdos, Moltres y Mewtwo como jefes con ataques propios. A veces Mew aparece al final.',
          },
        ],
      },
      {
        title: { pt: 'Os 27 iniciais', en: 'All 27 starters', es: 'Los 27 iniciales' },
        notes: [
          {
            pt: 'O trio inicial de todas as regiões, de Kanto a Paldea, com as 3 evoluções (Nv 12 e Nv 28), status e golpes próprios.',
            en: 'The starter trio of every region, Kanto to Paldea, with all 3 stages (Lv 12 and Lv 28), their own stats and moves.',
            es: 'El trío inicial de todas las regiones, de Kanto a Paldea, con las 3 evoluciones (Nv. 12 y Nv. 28), estadísticas y movimientos propios.',
          },
          {
            pt: '13 golpes novos e os tipos Aço, Sombrio e Fada.',
            en: '13 new moves and the Steel, Dark and Fairy types.',
            es: '13 movimientos nuevos y los tipos Acero, Siniestro y Hada.',
          },
          {
            pt: 'Nova escolha de inicial com abas por região e painel de inspeção.',
            en: 'A new starter select with region tabs and an inspect panel.',
            es: 'Nueva selección de inicial con pestañas por región y panel de inspección.',
          },
        ],
      },
      {
        title: { pt: 'Itens no mapa', en: 'Map items', es: 'Objetos en el mapa' },
        notes: [
          {
            pt: 'Item Balls, Berry Trees e mato alto pelo mapa. Quebre para pegar Potion, Rare Candy, Exp. Share, Poké Flute, Max Repel, Voltorb, X Attack, X Speed e Revive.',
            en: 'Item Balls, Berry Trees and tall grass around the map. Break them for Potions, Rare Candies, Exp. Share, the Poké Flute, Max Repel, Voltorb, X Attack, X Speed and Revive.',
            es: 'Item Balls, Berry Trees y hierba alta por el mapa. Rómpelos para conseguir Potion, Rare Candy, Exp. Share, Poké Flute, Max Repel, Voltorb, X Attack, X Speed y Revive.',
          },
        ],
      },
      {
        title: { pt: 'Condições de status', en: 'Status conditions', es: 'Problemas de estado' },
        notes: [
          {
            pt: 'Queimadura, veneno e paralisia, como nos jogos. Novos itens King\'s Rock e Toxic Orb.',
            en: 'Burn, poison and paralysis, like on the handhelds. New held items: King\'s Rock and Toxic Orb.',
            es: "Quemadura, veneno y parálisis, como en los juegos. Nuevos objetos King's Rock y Toxic Orb.",
          },
        ],
      },
      {
        title: { pt: 'Ataque especial', en: 'Special attack', es: 'Ataque especial' },
        notes: [
          {
            pt: 'Um ataque manual com recarga (Espaço, botão na tela ou A / ✕ do controle): Flare Blitz, Hydro Pump e Grass Knot, que viram Blast Burn, Hydro Cannon e Frenzy Plant na evolução final.',
            en: 'A manual attack on a cooldown (Space, the on-screen button or the gamepad A / ✕): Flare Blitz, Hydro Pump and Grass Knot, which become Blast Burn, Hydro Cannon and Frenzy Plant at the final evolution.',
            es: 'Un ataque manual con recarga (Espacio, botón en pantalla o A / ✕ del control): Flare Blitz, Hydro Pump y Grass Knot, que se vuelven Blast Burn, Hydro Cannon y Frenzy Plant en la evolución final.',
          },
        ],
      },
      {
        title: { pt: 'Versão para celular', en: 'Mobile version', es: 'Versión para celular' },
        notes: [
          {
            pt: 'Joystick de toque flutuante, botão de pausa na tela e layout para retrato e paisagem.',
            en: 'A floating touch joystick, an on-screen pause button and layouts for portrait and landscape.',
            es: 'Joystick táctil flotante, botón de pausa en pantalla y diseño para vertical y horizontal.',
          },
          { pt: 'Dá para instalar como app em tela cheia.', en: 'Installable as a fullscreen app.', es: 'Se puede instalar como app a pantalla completa.' },
        ],
      },
      {
        title: { pt: 'Primeira versão', en: 'First release', es: 'Primera versión' },
        notes: [
          {
            pt: 'Sobreviva 15 minutos de hordas com Charmander, Squirtle ou Bulbasaur: golpes automáticos, níveis, evolução no meio da partida e chefes.',
            en: 'Survive 15 minutes of hordes with Charmander, Squirtle or Bulbasaur: automatic moves, level ups, mid-run evolution and bosses.',
            es: 'Sobrevive 15 minutos de hordas con Charmander, Squirtle o Bulbasaur: movimientos automáticos, niveles, evolución a mitad de partida y jefes.',
          },
        ],
      },
    ],
  },
]
