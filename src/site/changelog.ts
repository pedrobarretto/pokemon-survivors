import type { Locale } from '../i18n'

/** The same text in every language: the type makes a missing translation a compile error. */
type Localized = Readonly<Record<Locale, string>>

export type ChangelogEntry = {
  /** ISO date (`YYYY-MM-DD`) the change went live. */
  date: string
  /** GitHub pull request number, when there is one. */
  pr?: number
  title: Localized
  notes: readonly Localized[]
}

/**
 * Update history shown at `/novidades/`, `/en/changelog/` and `/es/novedades/`, newest first.
 * Add an entry at the top when a player-facing change ships.
 */
export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    date: '2026-10-17',
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
    date: '2026-10-17',
    pr: 85,
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
    date: '2026-10-17',
    pr: 84,
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
    date: '2026-10-17',
    pr: 81,
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
    date: '2026-10-17',
    pr: 83,
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
    date: '2026-10-17',
    pr: 82,
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
    date: '2026-10-17',
    pr: 79,
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
    date: '2026-10-17',
    pr: 80,
    title: { pt: 'Runs legítimas voltam ao ranking', en: 'Legit runs are back on the leaderboards', es: 'Las partidas legítimas vuelven al ranking' },
    notes: [
      {
        pt: 'Uma parte das runs era tirada do ranking na verificação mesmo sem nada de errado: quando o jogo subia de nível ou o Pokémon desmaiava num quadro em que o aparelho atrasava, o replay ganhava alguns instantes a mais e a re-simulação não chegava ao mesmo resultado. Isso acontecia mais em celulares. O jogo não grava mais esses instantes, o servidor passou a aceitar os replays antigos e as runs recusadas por isso foram verificadas de novo.',
        en: 'Some runs were dropped from the leaderboards at verification with nothing wrong: when a level-up or a faint landed on a frame where the device lagged, the replay got a few extra moments and the re-simulation didn\'t end where the run did. It happened more on phones. The game no longer records those moments, the server now accepts the older replays, and the runs turned away by it were checked again.',
        es: 'Una parte de las partidas salía del ranking en la verificación sin nada malo: cuando subías de nivel o el Pokémon se debilitaba en un cuadro en que el dispositivo se atrasaba, el replay ganaba unos instantes de más y la re-simulación no llegaba al mismo resultado. Pasaba más en celulares. El juego ya no graba esos instantes, el servidor ahora acepta los replays antiguos y las partidas rechazadas por eso se verificaron de nuevo.',
      },
    ],
  },
  {
    date: '2026-10-16',
    pr: 78,
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
    date: '2026-10-16',
    pr: 71,
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
    date: '2026-10-16',
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
    date: '2026-10-16',
    pr: 74,
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
    date: '2026-10-16',
    pr: 73,
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
    date: '2026-10-16',
    pr: 69,
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
    date: '2026-10-16',
    pr: 72,
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
    date: '2026-10-16',
    pr: 67,
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
    date: '2026-10-16',
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
    date: '2026-10-16',
    pr: 62,
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
    date: '2026-10-16',
    pr: 61,
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
  {
    date: '2026-10-15',
    pr: 60,
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
    date: '2026-10-15',
    pr: 59,
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
    date: '2026-10-15',
    pr: 56,
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
    date: '2026-10-15',
    pr: 58,
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
    date: '2026-10-15',
    pr: 55,
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
    date: '2026-10-15',
    pr: 57,
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
    date: '2026-10-15',
    pr: 54,
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
    date: '2026-10-15',
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
    date: '2026-10-15',
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
    date: '2026-10-15',
    pr: 51,
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
    date: '2026-10-15',
    pr: 50,
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
    date: '2026-10-15',
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
    date: '2026-10-15',
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
    date: '2026-10-15',
    pr: 47,
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
    date: '2026-10-15',
    pr: 46,
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
    date: '2026-10-15',
    pr: 45,
    title: { pt: 'Aegislash na Forma Lâmina', en: 'Aegislash in Blade Forme', es: 'Aegislash en Forma Filo' },
    notes: [
      {
        pt: 'Na Forma Lâmina, o Aegislash agora aparece com o sprite da Forma Lâmina (também na versão shiny), como nos jogos. O ícone sobre a cabeça saiu: o próprio sprite, o anel no chão e o botão do especial mostram a postura.',
        en: 'In Blade Forme, Aegislash now shows its Blade Forme sprite (shiny too), like in the games. The icon over its head is gone: the sprite itself, the ring at its feet and the special button show the stance.',
        es: 'En Forma Filo, Aegislash ahora aparece con el sprite de la Forma Filo (también en la versión shiny), como en los juegos. El ícono sobre su cabeza ya no está: el propio sprite, el anillo en el suelo y el botón del especial muestran la postura.',
      },
    ],
  },
  {
    date: '2026-10-14',
    pr: 43,
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
    date: '2026-10-14',
    pr: 42,
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
    date: '2026-10-14',
    pr: 41,
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
    date: '2026-10-14',
    pr: 44,
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
    date: '2026-10-14',
    pr: 40,
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
    date: '2026-10-14',
    pr: 39,
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
    date: '2026-10-14',
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
    date: '2026-10-14',
    pr: 35,
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
    date: '2026-10-14',
    pr: 34,
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
    date: '2026-10-14',
    pr: 33,
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
    date: '2026-10-14',
    pr: 32,
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
    date: '2026-10-14',
    pr: 31,
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
    date: '2026-10-14',
    pr: 30,
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
    date: '2026-10-14',
    pr: 29,
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
    date: '2026-10-14',
    pr: 27,
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
  {
    date: '2026-10-13',
    pr: 28,
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
    date: '2026-10-13',
    pr: 25,
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
    date: '2026-10-13',
    pr: 26,
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
    date: '2026-10-13',
    pr: 24,
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
    date: '2026-10-13',
    pr: 23,
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
    date: '2026-10-13',
    pr: 22,
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
    date: '2026-10-13',
    pr: 21,
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
    date: '2026-10-13',
    pr: 20,
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
    date: '2026-10-13',
    pr: 19,
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
    date: '2026-10-13',
    pr: 14,
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
    date: '2026-10-13',
    pr: 12,
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
    date: '2026-10-13',
    pr: 13,
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
    date: '2026-10-13',
    pr: 11,
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
    date: '2026-10-13',
    pr: 10,
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
    date: '2026-10-13',
    pr: 9,
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
    date: '2026-10-13',
    pr: 2,
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
    date: '2026-10-13',
    pr: 4,
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
    date: '2026-10-13',
    pr: 3,
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
    date: '2026-10-13',
    pr: 8,
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
    date: '2026-10-13',
    pr: 6,
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
    date: '2026-10-13',
    pr: 1,
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
    date: '2026-10-13',
    pr: 7,
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
    date: '2026-10-13',
    pr: 5,
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
    date: '2026-10-13',
    title: { pt: 'Primeira versão', en: 'First release', es: 'Primera versión' },
    notes: [
      {
        pt: 'Sobreviva 15 minutos de hordas com Charmander, Squirtle ou Bulbasaur: golpes automáticos, níveis, evolução no meio da partida e chefes.',
        en: 'Survive 15 minutes of hordes with Charmander, Squirtle or Bulbasaur: automatic moves, level ups, mid-run evolution and bosses.',
        es: 'Sobrevive 15 minutos de hordas con Charmander, Squirtle o Bulbasaur: movimientos automáticos, niveles, evolución a mitad de partida y jefes.',
      },
    ],
  },
]
