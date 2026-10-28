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
    date: '2026-10-28',
    title: { pt: 'Desafio do dia sem Pesadelo', en: 'No more Nightmare in the Daily Challenge', es: 'Desafío del día sin Pesadilla', fr: 'Plus de Cauchemar au Défi du jour', zh: '每日挑戰不再出現惡夢' },
    highlights: [
      { pt: 'A partir de 29/10, o Desafio do dia não cai mais no Pesadelo: quando o sorteio cair nele, o desafio é no Difícil.', en: 'From Oct 29 on, the Daily Challenge no longer lands on Nightmare: when the draw picks it, the challenge plays on Hard.', es: 'Desde el 29/10, el Desafío del día ya no cae en Pesadilla: cuando el sorteo la elige, el desafío se juega en Difícil.', fr: 'À partir du 29/10, le Défi du jour ne tombe plus sur Cauchemar : quand le tirage le choisit, le défi se joue en Difficile.', zh: '從 10 月 29 日起，每日挑戰不會再抽到惡夢：抽到時，挑戰改用困難難度。' },
      { pt: 'Sem as melhorias da loja, ninguém venceu os desafios no Pesadelo (Slakoth e Gastly, 0 vitórias em umas 4.800 partidas). Valeu a todo mundo que tentou!', en: 'With the shop’s upgrades off, no one beat the Nightmare challenges (Slakoth and Gastly, 0 wins in about 4,800 runs). Thanks to everyone who tried!', es: 'Sin las mejoras de la tienda, nadie ganó los desafíos en Pesadilla (Slakoth y Gastly, 0 victorias en unas 4.800 partidas). ¡Gracias a todos los que lo intentaron!', fr: 'Sans les améliorations de la boutique, personne n’a gagné les défis en Cauchemar (Slakoth et Gastly, 0 victoire sur environ 4 800 parties). Merci à tous ceux qui ont essayé !', zh: '在商店升級全部關閉的情況下，沒有人贏過惡夢難度的挑戰（Slakoth 和 Gastly，約 4,800 局 0 勝）。感謝所有挑戰過的玩家！' },
      { pt: 'Os rankings e as fitas dos dias já jogados continuam como estão.', en: 'The boards and ribbons of the days already played stay as they are.', es: 'Los rankings y las cintas de los días ya jugados quedan como están.', fr: 'Les classements et les rubans des jours déjà joués restent tels quels.', zh: '已經進行過的日子，排行榜和緞帶都維持原樣。' },
    ],
    changes: [
      {
        title: { pt: 'Desafio do dia', en: 'Daily Challenge', es: 'Desafío del día', fr: 'Défi du jour', zh: '每日挑戰' },
        notes: [
          { pt: 'O desafio desliga todas as melhorias e itens para que todos joguem igual, e no Pesadelo isso deixava a partida impossível. Do dia 29/10 em diante, um dia que sortearia Pesadelo é jogado no Difícil, com o mesmo Pokémon e o mesmo mapa; os outros dias seguem iguais.', en: 'The challenge turns every upgrade and item off so everyone plays the same, and on Nightmare that made the run impossible. From Oct 29 on, a day that would draw Nightmare plays on Hard, with the same Pokémon and the same map; every other day stays the same.', es: 'El desafío apaga todas las mejoras y objetos para que todos jueguen igual, y en Pesadilla eso hacía la partida imposible. Desde el 29/10, un día que sortearía Pesadilla se juega en Difícil, con el mismo Pokémon y el mismo mapa; los demás días siguen iguales.', fr: 'Le défi désactive toutes les améliorations et tous les objets pour que tout le monde joue pareil, et en Cauchemar ça rendait la partie impossible. À partir du 29/10, un jour qui tirerait Cauchemar se joue en Difficile, avec le même Pokémon et la même carte ; les autres jours ne changent pas.', zh: '挑戰會關閉所有升級和道具，讓大家在相同條件下遊玩，但在惡夢難度下這讓對局變得不可能。從 10 月 29 日起，原本會抽到惡夢的日子改用困難難度，寶可夢和地圖都不變；其他日子維持原樣。' },
        ],
      },
    ],
  },
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
        ],
      },
      {
        title: { pt: 'Correções', en: 'Fixes', es: 'Correcciones', fr: 'Corrections', zh: '修正' },
        notes: [
          { pt: 'O Pesadelo do Darkrai não engasga mais em celulares mais simples ao chegar nele, na troca de fase e na captura: as luzes no escuro ficaram bem mais leves de desenhar. O minimapa e os avisos na tela também pesam menos durante a partida.', en: 'Darkrai’s Nightmare no longer stutters on simpler phones as you reach it, between phases and at the capture: the lights in the dark are much lighter to draw now. The minimap and the on-screen news cost less during a run too.', es: 'La Pesadilla de Darkrai ya no se traba en celulares más sencillos al llegar a él, al cambiar de fase y en la captura: las luces en la oscuridad ahora son mucho más livianas de dibujar. El minimapa y los avisos en pantalla también pesan menos durante la partida.' },
