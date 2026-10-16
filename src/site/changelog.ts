import type { Locale } from '../i18n'

/** The same text in every language: the type makes a missing translation a compile error. */
type Bilingual = Readonly<Record<Locale, string>>

export type ChangelogEntry = {
  /** ISO date (`YYYY-MM-DD`) the change went live. */
  date: string
  /** GitHub pull request number, when there is one. */
  pr?: number
  title: Bilingual
  notes: readonly Bilingual[]
}

/**
 * Update history shown at `/novidades/` and `/en/changelog/`, newest first.
 * Add an entry at the top when a player-facing change ships.
 */
export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    date: '2026-10-16',
    title: { pt: 'Jogar com amigos: multijogador para até 4', en: 'Play with friends: co-op for up to 4' },
    notes: [
      {
        pt: 'Novo modo Jogar com amigos: crie uma sala e mande o link, ou entre com o código de 5 letras. Até 4 treinadores na mesma partida, cada um com seu Pokémon e suas melhorias do Poké Mart. Não precisa de conta.',
        en: 'New Play with friends mode: create a room and send the link, or join with its 5-letter code. Up to 4 trainers in the same run, each with their own Pokémon and Poké Mart upgrades. No account needed.',
      },
      {
        pt: 'A experiência é da equipe: todos sobem de nível juntos e cada um escolhe sua carta, com 15 segundos para decidir. A horda cresce e fica mais forte com cada treinador, e os chefes aguentam mais.',
        en: 'EXP belongs to the team: everyone levels up together and each player picks their own card, with 15 seconds to decide. The horde grows and gets tougher with every trainer, and bosses take more hits.',
      },
      {
        pt: 'Quem desmaia fica no chão até um amigo ficar 3 segundos ao lado para reanimar. A partida só acaba quando ninguém mais está de pé. Setas na borda da tela mostram onde estão os amigos.',
        en: 'Whoever faints stays down until a friend stands next to them for 3 seconds to revive them. The run only ends when nobody is left standing. Arrows on the screen edge show where your friends are.',
      },
      {
        pt: 'Amigos de verdade: seguir alguém agora é um pedido de amizade, e seguir de volta aceita. Na tela de Amigos você vê quem está online, aceita pedidos, procura pelo nome de usuário e convida para a sua sala.',
        en: 'Real friends: following someone is now a friend request, and following back accepts it. The Friends screen shows who is online, takes requests, searches by username and invites friends to your room.',
      },
    ],
  },
  {
    date: '2026-10-16',
    pr: 61,
    title: { pt: 'Competir: Desafio do dia e fitas', en: 'Compete: the Daily Challenge and ribbons' },
    notes: [
      {
        pt: 'Desafio do dia: uma partida por dia igual para todo mundo, com a mesma semente, o mesmo Pokémon (pode ser até uma família de ovo que você ainda não chocou) e a mesma dificuldade, sem melhorias da Poké Mart, Isca, Incenso ou Amuleto Brilhante. O surto do dia continua valendo. Fica no menu do título, com a contagem para o próximo.',
        en: "Daily Challenge: one run a day that is the same for everyone, with the same seed, the same Pokémon (even an egg family you haven't hatched yet) and the same difficulty, with no Poké Mart upgrades, Lure, Incense or Shiny Charm. Today's outbreak is still on. It's on the title menu, with a countdown to the next one.",
      },
      {
        pt: 'Só a sua primeira partida terminada do dia é a tentativa oficial e entra no ranking do desafio, que ganhou uma aba no Ranking (hoje e ontem). As outras são treino. O fim da partida mostra a sua posição, e o cartão para compartilhar também.',
        en: 'Only your first finished run of the day is the official attempt and goes on the challenge ranking, which has its own tab in the Ranking (today and yesterday). The rest are practice. The end of the run shows your place, and so does the card you share.',
      },
      {
        pt: 'Fitas: depois que o dia fecha, todo mundo no ranking do desafio ganha uma fita como Presente Misterioso, de ouro para os 10% melhores, de prata para a metade de cima e de bronze para quem participou. Elas aparecem no seu perfil e no Cartão de Treinador.',
        en: 'Ribbons: once the day closes, everyone on the challenge ranking gets a ribbon as a Mystery Gift, gold for the top 10%, silver for the top half and bronze for taking part. They show on your profile and Trainer Card.',
      },
    ],
  },
  {
    date: '2026-10-15',
    pr: 60,
    title: { pt: 'Traga amigos: convites, Presente Misterioso e Munchlax', en: 'Bring friends: invites, Mystery Gifts and Munchlax' },
    notes: [
      {
        pt: 'Convide amigos: todo link que você compartilha leva o seu nome. Quem chega por ele vê "Fulano te convidou!" na tela de título, e ao criar a conta ganha um Ovo da Amizade. Vocês dois passam a se seguir.',
        en: 'Invite friends: every link you share carries your name. Whoever lands through it sees "So-and-so invited you!" on the title screen, and gets a Friendship Egg on signing up. You two follow each other.',
      },
      {
        pt: 'Quando o amigo joga 3 partidas verificadas no ranking, o convite conta para você e chega um Presente Misterioso: com 1 amigo, um Ovo da Amizade; com 3, o título Embaixador(a) e uma moldura exclusiva para o cartão; com 10, um Munchlax shiny. O seu perfil mostra quantos amigos você trouxe.',
        en: 'Once your friend plays 3 verified ranked runs, the invite counts for you and a Mystery Gift arrives: at 1 friend, a Friendship Egg; at 3, the Ambassador title and an exclusive card frame; at 10, a shiny Munchlax. Your profile shows how many friends you brought.',
      },
      {
        pt: 'Família nova: Munchlax, que evolui em Snorlax no Nv 20. Um tanque guloso, com muita vida, defesa e regeneração, que abre caminho com Earthquake. Só sai do Ovo da Amizade.',
        en: 'New family: Munchlax, which evolves into Snorlax at Lv 20. A hungry tank with lots of HP, defense and regen that clears the way with Earthquake. It only hatches from the Friendship Egg.',
      },
    ],
  },
  {
    date: '2026-10-15',
    pr: 59,
    title: { pt: 'Hoje tem: Surto do dia e Poké Mart nova', en: "Today's outbreak and a new Poké Mart" },
    notes: [
      {
        pt: 'Surto do dia: todo dia (no horário de Brasília) uma espécie selvagem toma conta de todas as partidas, a mesma para todo mundo. Ela é o Pokémon mais comum da partida do começo ao fim, e por isso o shiny dela aparece umas duas vezes por partida. A tela de título mostra quem é o surto de hoje, e uma missão diária nova pede para derrotar os Pokémon do surto.',
        en: "Today's outbreak: every day (Brasília time) one wild species takes over every run, the same for everyone. It's the most common Pokémon of the run from start to finish, so its shiny shows up about twice a run. The title screen shows today's outbreak, and a new daily mission asks you to defeat it.",
      },
      {
        pt: 'A Poké Mart ganhou três prateleiras. Melhorias tem o novo Amuleto Brilhante (Shiny Charm): três níveis que levam a chance de shiny selvagem de 1/450 a 1/225. O Balcão do dia muda à meia-noite, igual para todos, com estoque limitado: Isca (shinies 2× mais comuns na próxima partida), Incenso (chance de ovo 2× maior), um ovo à venda e um item em promoção. Estilo vende molduras do cartão (Poké, Great, Ultra e Master Ball), fundos dos cinco lugares do jogo e papéis de parede para a Caixa do PC.',
        en: "The Poké Mart has three shelves now. Upgrades has the new Shiny Charm: three levels that take the wild shiny odds from 1/450 to 1/225. Today's counter turns over at midnight, the same for everyone, with a daily stock: Lure (shinies twice as common next run), Incense (eggs twice as likely), an egg for sale and one item on sale. Style sells card frames (Poké, Great, Ultra and Master Ball), backgrounds from the game's five places and PC Box wallpapers.",
      },
      {
        pt: 'Isca e Incenso vão para a Bolsa. Na escolha do Pokémon, ligue o que quiser usar (teclas C e V) e ele é gasto quando a partida começa. Algumas missões agora pagam uma Isca ou um Incenso junto com os ₽.',
        en: 'Lures and Incenses go into the Bag. On the select screen, turn on what you want to use (C and V keys) and it gets used up as the run starts. Some missions now pay a Lure or an Incense on top of the ₽.',
      },
      {
        pt: 'No celular, os botões redondos da partida (especial, Mega e bote) não ficam mais por cima dos botões da tela de resultados e dos menus.',
        en: "On phones, the run's round buttons (special, Mega and lunge) no longer sit on top of the results screen's and the menus' buttons.",
      },
    ],
  },
  {
    date: '2026-10-15',
    pr: 56,
    title: { pt: 'Mostre sua coleção', en: 'Show off your collection' },
    notes: [
      {
        pt: 'Nova tela de resultados com o botão Compartilhar: o jogo desenha um cartão da run em pixel art, com o seu Pokémon, o tempo, o nível, os shinies que você pegou e os lendários que venceu. No celular ele abre o compartilhar do sistema; no computador, copia a imagem.',
        en: 'The results screen has a new Share button: the game draws a pixel art card of your run, with your Pokémon, time, level, the shinies you caught and the legendaries you beat. On phones it opens the share sheet; on computers it copies the image.',
      },
      {
        pt: 'Caixa do PC: todo shiny que você pegou, em caixas de 30 como no PC dos jogos, com cada um se mexendo. Abra pela Pokédex. De lá (ou do seu perfil) sai o Cartão de Treinador, com suas medalhas, sua Pokédex, seu recorde e seus melhores shinies.',
        en: 'PC Box: every shiny you caught, in boxes of 30 like the PC in the games, each one moving. Open it from the Pokédex. From there (or your profile) comes your Trainer Card, with your medals, Pokédex, best time and best shinies.',
      },
      {
        pt: 'Tirou o seu inicial shiny (a chance de 1 em 64)? Agora ele fica liberado para sempre: na seleção, escolha Normal ou Shiny (tecla Z).',
        en: 'Rolled your starter shiny (the 1 in 64 chance)? It now stays unlocked for good: on the select screen, pick Normal or Shiny (Z key).',
      },
    ],
  },
  {
    date: '2026-10-15',
    pr: 58,
    title: { pt: '26 famílias de Kanto, Johto e Hoenn nos ovos', en: '26 Kanto, Johto and Hoenn families in eggs' },
    notes: [
      {
        pt: 'Os ovos agora podem chocar 26 famílias novas da Gen 1 à 3, 51 no total (78 Pokémon jogáveis). Comuns: Pidgey, Zubat, Poliwag, Geodude, Mareep, Azurill, Shroomish, Swinub e Snorunt. Raros: Growlithe, Vulpix, Cubone, Scyther, Magikarp, Horsea, Kabuto, Houndour, Teddiursa, Aron, Trapinch, Swablu, Electrike e Shuppet. Ultra raros: Bagon, Slakoth e Feebas.',
        en: 'Eggs can now hatch 26 new families from Gen 1 to 3, 51 in all (78 playable Pokémon). Common: Pidgey, Zubat, Poliwag, Geodude, Mareep, Azurill, Shroomish, Swinub and Snorunt. Rare: Growlithe, Vulpix, Cubone, Scyther, Magikarp, Horsea, Kabuto, Houndour, Teddiursa, Aron, Trapinch, Swablu, Electrike and Shuppet. Ultra rare: Bagon, Slakoth and Feebas.',
      },
      {
        pt: 'Cada uma tem seus status, golpe inicial e golpes. Magikarp e Feebas começam fraquíssimos e viram Gyarados e Milotic; Slakoth é lento para agir, mas bate muito forte. Swinub vai até Mamoswine (o único da Gen 4), para a linha ficar completa.',
        en: 'Each has its own stats, starting move and moves. Magikarp and Feebas start out very weak and become Gyarados and Milotic; Slakoth is slow to act but hits very hard. Swinub goes all the way to Mamoswine (the only Gen 4 member), so the line is complete.',
      },
      {
        pt: 'A caixa de ovos na escolha do Pokémon agora rola por dentro e mostra mais colunas, para caber todo mundo também no celular.',
        en: 'The egg box on the Pokémon select now scrolls on its own and shows more columns, so everyone fits on phones too.',
      },
    ],
  },
  {
    date: '2026-10-15',
    pr: 55,
    title: { pt: 'Golpes de Gelo, Pedra, Inseto e Dragão', en: 'Ice, Rock, Bug and Dragon moves' },
    notes: [
      {
        pt: 'Quatro golpes novos para os tipos que não tinham um: Ice Shard (estilhaços que se cravam no chão e desaceleram quem pisa), Rock Tomb (pedregulhos que caem nos inimigos mais próximos), Pin Missile (agulhas que fazem a curva até o alvo) e Dragon Breath (um cone de fogo dracônico).',
        en: 'Four new moves for the types that had none: Ice Shard (shards that stick in the ground and slow whoever steps on them), Rock Tomb (boulders that drop on the nearest foes), Pin Missile (needles that curve into their target) and Dragon Breath (a cone of dragon fire).',
      },
      {
        pt: 'Cada um evolui com seu item: Ice Shard + Never-Melt Ice vira Blizzard, Rock Tomb + Hard Stone vira Stone Edge, Pin Missile + Silver Powder vira Megahorn e Dragon Breath + Dragon Fang vira Outrage.',
        en: 'Each one evolves with its item: Ice Shard + Never-Melt Ice becomes Blizzard, Rock Tomb + Hard Stone becomes Stone Edge, Pin Missile + Silver Powder becomes Megahorn and Dragon Breath + Dragon Fang becomes Outrage.',
      },
      {
        pt: 'Spheal, Rockruff, Larvitar, Grubbin, Larvesta, Noibat, Dratini, Gible e Dreepy agora podem aprendê-los.',
        en: 'Spheal, Rockruff, Larvitar, Grubbin, Larvesta, Noibat, Dratini, Gible and Dreepy can now learn them.',
      },
    ],
  },
  {
    date: '2026-10-15',
    pr: 57,
    title: { pt: 'Os lendários da Gen 1 à 3', en: 'The legendaries of Gens 1 to 3' },
    notes: [
      {
        pt: 'As aves de Kanto agora dividem os horários das 7:00, 9:30 e 12:00 com as feras de Johto (Raikou, Entei e Suicune) e os Regis de Hoenn (Regirock, Regice e Registeel). Cada partida sorteia um trio, e cada um tem ataques próprios: Raikou deixa estática por onde corre, Entei faz chover fogo, Suicune solta ondas lentas e densas, Regirock derruba pedras, Regice congela o chão e Registeel fecha o caminho com anéis de aço.',
        en: "The Kanto birds now share the 7:00, 9:30 and 12:00 slots with the Johto beasts (Raikou, Entei and Suicune) and the Hoenn Regis (Regirock, Regice and Registeel). Each run draws one trio, and each member has its own attacks: Raikou leaves static where it runs, Entei rains fire, Suicune sends slow, dense waves, Regirock drops rocks, Regice freezes the ground and Registeel walls you in with steel rings.",
      },
      {
        pt: 'O HP, o dano e a velocidade são do horário, não do Pokémon: nenhum trio é mais fácil que outro.',
        en: 'HP, damage and speed belong to the time slot, not the Pokémon: no trio is easier than another.',
      },
      {
        pt: 'Novas fendas lendárias: Latias e Latios na Ilha do Sul, uma ilha de areia com palmeiras para se proteger e uma arrebentação em volta que deixa lento, e Deoxys num meteoro no espaço, com aglomerados de cristal no caminho. Agora são 9 lendários de fenda, e a conquista Domador de Lendas pede os 9 (quem já tinha continua com ela).',
        en: 'New legendary rifts: Latias and Latios on Southern Island, a sandy island with palms for cover and surf around it that slows you down, and Deoxys on a meteor in space, with crystal clusters in the way. There are 9 rift legendaries now, and the Legend Tamer achievement asks for all 9 (if you already had it, you keep it).',
      },
      {
        pt: 'O chefe raro do fim pode ser Mew, Celebi ou Jirachi. A chance de aparecer continua 10%.',
        en: 'The rare boss at the end can be Mew, Celebi or Jirachi. The chance it shows up is still 10%.',
      },
    ],
  },
  {
    date: '2026-10-15',
    pr: 54,
    title: { pt: 'Kanto, Johto e Hoenn completos na horda', en: 'Kanto, Johto and Hoenn complete in the horde' },
    notes: [
      {
        pt: '222 espécies da 1ª à 3ª geração entram na horda selvagem, de Metapod e Magikarp a Blissey, Slaking e Salamence. Agora todo Pokémon de Kanto, Johto e Hoenn que não é lendário nem mítico aparece no jogo (menos Unown e Castform, cujo visual depende da forma). A horda passa de 193 para 415 espécies e a Pokédex do jogo, de 334 para 556.',
        en: '222 species from generations 1 to 3 join the wild horde, from Metapod and Magikarp to Blissey, Slaking and Salamence. Every Kanto, Johto and Hoenn Pokémon that isn\'t legendary or mythical is now in the game (but Unown and Castform, whose look depends on their form). The horde grows from 193 to 415 species and the in-game Pokédex from 334 to 556.',
      },
      {
        pt: 'Cada partida continua sorteando o seu elenco do mesmo jeito, então rostos das três primeiras gerações vão aparecer bem mais.',
        en: 'Each run still draws its cast the same way, so faces from the first three generations show up a lot more.',
      },
    ],
  },
  {
    date: '2026-10-15',
    title: { pt: 'Uma arena para cada lendário', en: 'An arena for each legendary' },
    notes: [
      {
        pt: 'As fendas não levam mais para o mesmo círculo. Lugia espera num templo submerso, com ilhas em água rasa que deixa lento. Ho-Oh, num salão octogonal com pilares e o grande sino. Kyogre nada num poço cuja maré sobe e aperta o anel de pedra. Groudon fica numa caverna cortada por rios de lava (só se atravessa pelas pontes, a não ser que você seja do tipo Fogo). Rayquaza, num losango de jade cuja borda desaba durante a luta. E Dialga, numa nave de mármore com colunatas para se esconder do Roar of Time.',
        en: "Rifts no longer lead to the same circle. Lugia waits in a sunken temple, with islands in shallow water that slows you down. Ho-Oh, in an octagonal hall with pillars and the great bell. Kyogre swims in a pool whose tide rises and squeezes the stone ring. Groudon holds a cave split by lava rivers (cross on the bridges, unless you're a Fire type). Rayquaza, a jade diamond whose edge falls away during the fight. And Dialga, a marble nave with colonnades to hide from Roar of Time.",
      },
    ],
  },
  {
    date: '2026-10-15',
    title: { pt: 'Montanhas, árvores, torres e lagos no mapa', en: 'Mountains, trees, towers and lakes on the map' },
    notes: [
      {
        pt: 'O mapa ganhou relevo: pedras, bosques, montanhas em degraus, torres e lagos, que se vestem conforme o bioma (a colina da planície vira paredão na caverna e cripta na Torre). Quem anda não atravessa os sólidos, então dá para usar uma pedra de cobertura contra tiros ou fazer a horda dar a volta na montanha. Voadores, fantasmas e chefes passam por cima.',
        en: 'The map got some relief: rocks, groves, terraced mountains, towers and lakes, dressed for each biome (the meadow hill becomes a rock wall in the cave and a crypt at the Tower). Walkers can\'t go through solids, so a rock makes cover against shots and the horde has to go around a mountain. Flyers, ghosts and bosses go over it all.',
      },
      {
        pt: 'Água deixa mais lento (Pokémon do tipo Água nadam sem perder velocidade) e o lago congelado da neve faz escorregar. Árvores, torres e montanhas ficam transparentes quando você passa atrás.',
        en: 'Water slows you down (Water types swim at full speed) and the frozen lakes in the snow make you slide. Trees, towers and mountains turn see-through when you walk behind them.',
      },
    ],
  },
  {
    date: '2026-10-15',
    pr: 51,
    title: { pt: 'Cadastro com Google destravado', en: 'Google sign up unstuck' },
    notes: [
      {
        pt: 'Quem começou a criar a conta e parou na verificação anti-robô ficava preso numa tela de "Verification didn\'t complete in time" em toda tentativa seguinte. Agora uma nova tentativa recomeça o cadastro do zero e entra normalmente.',
        en: 'If you started creating your account and stopped at the bot check, every later try got stuck on a "Verification didn\'t complete in time" screen. Now a new try starts the sign up over and gets you in.',
      },
    ],
  },
  {
    date: '2026-10-15',
    pr: 50,
    title: { pt: 'Login com Google mais firme', en: 'Sturdier Google sign in' },
    notes: [
      {
        pt: 'Quando criar a conta pede uma etapa a mais depois do Google (uma verificação anti-robô ou um dado que faltou), o jogo agora te leva para a página da conta, termina por lá e te traz de volta, em vez de falhar o login.',
        en: 'When creating your account needs one more step after Google (a bot check or a missing detail), the game now takes you to the account page, finishes there and brings you back, instead of failing the sign in.',
      },
    ],
  },
  {
    date: '2026-10-15',
    title: { pt: 'Quick Attack no seu comando', en: 'Quick Attack on your command' },
    notes: [
      {
        pt: 'Quick Attack e Extreme Speed não disparam mais sozinhos: como movem você, agora o bote sai quando você aperta Shift, X / □ no controle ou o novo botão redondo à esquerda do especial no celular. Sem inimigo por perto, o bote avança reto para a frente, bom para escapar de um cerco.',
        en: "Quick Attack and Extreme Speed no longer fire on their own: since they move you, the lunge now goes when you press Shift, X / □ on a gamepad or the new round button left of the special on phones. With no foe in reach it hops straight ahead, handy to slip out of a crowd.",
      },
    ],
  },
  {
    date: '2026-10-15',
    title: { pt: 'Todas as Megas', en: 'Every Mega' },
    notes: [
      {
        pt: 'Agora toda linhagem do jogo que tem Mega Evolução Mega Evolui: são 26 Megas em 22 linhagens, com Venusaur, Blastoise, Charizard Y, Raichu X e Y, Dragonite, Meganium, Feraligatr, Sceptile, Blaziken, Swampert, Metagross, Staraptor, Garchomp e Garchomp Z, Lucario Z, Emboar, Chesnaught, Delphox e Greninja chegando agora, cada uma com status, especial, habilidade e grito próprios.',
        en: 'Every line in the game with a Mega Evolution can now Mega Evolve: 26 Megas across 22 lines, with Venusaur, Blastoise, Charizard Y, Raichu X and Y, Dragonite, Meganium, Feraligatr, Sceptile, Blaziken, Swampert, Metagross, Staraptor, Garchomp and Garchomp Z, Lucario Z, Emboar, Chesnaught, Delphox and Greninja joining now, each with its own stats, special, ability and cry.',
      },
      {
        pt: 'Charizard, Raichu, Garchomp e Lucario têm duas Megas: o lendário da fenda deixa as duas pedras no chão e a que você pegar decide a Mega. A outra se desfaz.',
        en: 'Charizard, Raichu, Garchomp and Lucario have two Megas: the rift legendary leaves both stones on the ground and the one you pick up decides the Mega. The other crumbles.',
      },
      {
        pt: 'As Megas que ainda não têm sprite no PMD SpriteCollab aparecem com o sprite da evolução final e um contorno arco-íris enquanto a forma dura.',
        en: 'Megas that don\'t have a PMD SpriteCollab sprite yet show the final evolution\'s sprite with a rainbow outline while the form lasts.',
      },
    ],
  },
  {
    date: '2026-10-15',
    pr: 47,
    title: { pt: 'Gritos das Megas', en: 'Mega cries' },
    notes: [
      {
        pt: 'As Megas agora têm o próprio cry: o Pokémon solta o grito da forma Mega ao terminar a transformação, ao usar o especial e se cair enquanto ela dura.',
        en: 'Megas now have their own cry: the Pokémon lets out its Mega form\'s cry as the transformation lands, when it uses its special and if it faints while the form lasts.',
      },
    ],
  },
  {
    date: '2026-10-15',
    pr: 46,
    title: { pt: 'Mega Evolução', en: 'Mega Evolution' },
    notes: [
      {
        pt: 'Charmander, Abra, Gastly, Ralts, Riolu e Larvitar agora podem Mega Evoluir. Vença um lendário de fenda com um deles para ganhar a Mega Stone da linhagem e, na evolução final, aperte o botão MEGA (tecla E, ou Y no controle).',
        en: 'Charmander, Abra, Gastly, Ralts, Riolu and Larvitar can now Mega Evolve. Beat a rift legendary with one of them to get the line\'s Mega Stone, then press the MEGA button at the final evolution (E key, or Y on a gamepad).',
      },
      {
        pt: 'A forma Mega dura 20 segundos e volta depois de 60. Ela começa com uma transformação com explosão de arco-íris que empurra a horda, ganha status, troca o especial por um mais forte e ativa a habilidade: o Dragon Flare em chamas azuis do Mega Charizard X, o Trace do Mega Alakazam (cada especial dispara dois dos seus golpes), o Shadow Tag do Mega Gengar (desacelera quem chega perto), o Pixilate do Mega Gardevoir, a cadeia de 6 saltos com Aura Spheres do Mega Lucario e a tempestade de areia do Mega Tyranitar.',
        en: "The Mega form lasts 20 seconds and comes back after 60. It starts with a transformation and a rainbow burst that pushes the horde back, gains stats, swaps the special for a stronger one and turns its ability on: Mega Charizard X's blue-flame Dragon Flare, Mega Alakazam's Trace (every special fires two of your moves), Mega Gengar's Shadow Tag (slows anyone who comes close), Mega Gardevoir's Pixilate, Mega Lucario's 6-jump chain dash with Aura Spheres and Mega Tyranitar's sandstorm.",
      },
      {
        pt: 'Duas conquistas novas: Laço Mega e Mestre Mega.',
        en: 'Two new achievements: Mega Bond and Mega Master.',
      },
    ],
  },
  {
    date: '2026-10-15',
    pr: 45,
    title: { pt: 'Aegislash na Forma Lâmina', en: 'Aegislash in Blade Forme' },
    notes: [
      {
        pt: 'Na Forma Lâmina, o Aegislash agora aparece com o sprite da Forma Lâmina (também na versão shiny), como nos jogos. O ícone sobre a cabeça saiu: o próprio sprite, o anel no chão e o botão do especial mostram a postura.',
        en: 'In Blade Forme, Aegislash now shows its Blade Forme sprite (shiny too), like in the games. The icon over its head is gone: the sprite itself, the ring at its feet and the special button show the stance.',
      },
    ],
  },
  {
    date: '2026-10-14',
    pr: 43,
    title: { pt: 'Metronome e Power Herb', en: 'Metronome and Power Herb' },
    notes: [
      {
        pt: 'Novo item, Metronome: ao fim de cada salto da investida em cadeia, da investida de fogo ou de uma troca de postura (e ao soltar os outros especiais), dispara um dos seus golpes dali. No nível máximo, dois (numa cadeia, o segundo só no último salto).',
        en: 'New item, Metronome: at the end of every chain dash jump, fire dash or stance swap (and when other specials go off), it fires one of your moves from there. Two at max level (in a chain, the second only on the last jump).',
      },
      {
        pt: 'Novo item, Power Herb: cada inimigo derrubado pelo especial, ou durante uma cadeia, corta 0,25 s da recarga dele (até 0,75 s no nível máximo). A recarga nunca fica abaixo do mínimo de 4 s.',
        en: 'New item, Power Herb: each foe the special defeats, or any defeated mid-chain, cuts 0.25 s off its cooldown (up to 0.75 s at max level). The cooldown never drops below the 4 s minimum.',
      },
    ],
  },
  {
    date: '2026-10-14',
    pr: 42,
    title: { pt: 'Investida em cadeia e Mudança de Postura', en: 'Chain dash and Stance Change' },
    notes: [
      {
        pt: 'Treecko, Sprigatito, Riolu, Gible, Starly e Honedge ganharam um especial novo: uma investida que corta até o inimigo mais próximo. Acertou? Aperte de novo em meio segundo para saltar ao próximo, até 3 saltos (4 na evolução final). A recarga só começa quando a cadeia acaba.',
        en: 'Treecko, Sprigatito, Riolu, Gible, Starly and Honedge get a new special: a dash that slashes through to the nearest foe. Landed a hit? Press again within half a second to jump to the next one, up to 3 jumps (4 at the final evolution). The cooldown only starts when the chain ends.',
      },
      {
        pt: 'O Aegislash troca o especial pela Mudança de Postura: alterna entre a Forma Escudo (recebe 30% menos dano, golpes ×0,7) e a Forma Lâmina (golpes ×1,3). A forma atual aparece sobre a cabeça dele e no botão do especial.',
        en: 'Aegislash trades its special for Stance Change: it swaps between Shield Forme (takes 30% less damage, moves ×0.7) and Blade Forme (moves ×1.3). The current forme shows over its head and on the special button.',
      },
    ],
  },
  {
    date: '2026-10-14',
    pr: 41,
    title: { pt: 'Cinco golpes novos: bote, corrente, minas e torres', en: 'Five new moves: lunges, chains, mines and turrets' },
    notes: [
      {
        pt: 'Quick Attack dá um bote curto contra o inimigo à frente, acerta tudo no caminho e deixa você invulnerável por um instante. Ele só avança na direção em que você já está andando e recarrega em no mínimo 1,5 s. Com Silk Scarf, evolui para Extreme Speed.',
        en: "Quick Attack lunges a short hop at the foe ahead, hits everything on the way and makes you invulnerable for an instant. It only lunges the way you're already walking and never recharges in under 1.5 s. With Silk Scarf it evolves into Extreme Speed.",
      },
      {
        pt: 'Shock Wave salta de inimigo em inimigo, perdendo 15% de força a cada salto, e evolui para Thunderbolt com Magnet. Hex faz o mesmo e causa ×1,7 de dano em quem está com algum status (queimado, envenenado, paralisado…).',
        en: 'Shock Wave jumps from foe to foe, losing 15% power per jump, and evolves into Thunderbolt with Magnet. Hex does the same and deals ×1.7 damage to foes with a status condition (burned, poisoned, paralyzed…).',
      },
      {
        pt: 'Toxic Spikes deixa espinhos que explodem quando um inimigo pisa (ou com metade do dano quando acabam) e evolui para Barb Barrage com Poison Barb. Will-O-Wisp deixa para trás um fogo-fátuo que atira sozinho e evolui para Inferno com Charcoal.',
        en: 'Toxic Spikes leaves spikes that burst when a foe steps on them (or for half damage when they run out) and evolves into Barb Barrage with Poison Barb. Will-O-Wisp leaves a wisp behind that shoots on its own and evolves into Inferno with Charcoal.',
      },
      {
        pt: 'Quem aprende: Pichu, Eevee, Starly, Riolu e Torchic (Quick Attack), Pichu, Toxel e Beldum (Shock Wave), Gastly, Dreepy, Honedge e Rowlet (Hex), Budew, Bulbasaur e Chespin (Toxic Spikes), Charmander, Cyndaquil, Fennekin, Litten e Charcadet (Will-O-Wisp).',
        en: 'Who learns them: Pichu, Eevee, Starly, Riolu and Torchic (Quick Attack), Pichu, Toxel and Beldum (Shock Wave), Gastly, Dreepy, Honedge and Rowlet (Hex), Budew, Bulbasaur and Chespin (Toxic Spikes), Charmander, Cyndaquil, Fennekin, Litten and Charcadet (Will-O-Wisp).',
      },
    ],
  },
  {
    date: '2026-10-14',
    pr: 44,
    title: { pt: 'Chefes furiosos, elites e corredores', en: 'Enraged bosses, elites and runners' },
    notes: [
      {
        pt: 'Os chefes do mapa agora alternam entre lutar de perto, avançando e batendo em área ao redor de si, e de longe, parados mirando em você. Abaixo da metade do HP eles ficam furiosos: contorno vermelho, cry, mais velocidade, menos pausa entre ataques e às vezes dois ataques seguidos.',
        en: 'Map bosses now switch between fighting up close, rushing in and slamming the area around them, and at range, standing back and aiming at you. Under half HP they enrage: red outline, a cry, more speed, shorter pauses between attacks and sometimes two attacks in a row.',
      },
      {
        pt: 'No primeiro minuto de cada chefe nascem bem menos inimigos comuns, então a luta é com ele. Depois disso a horda volta, então não vale enrolar.',
        en: "For each boss's first minute far fewer regular enemies spawn, so the fight is with it. After that the horde comes back, so don't drag it out.",
      },
      {
        pt: 'Quando a horda quase enche, quem nasce vem como elite: contorno vermelho, mais HP, mais EXP e mais dano (menos na luta com o Mewtwo, que segue um duelo). E uma espécie nova de cada fase corre, com rastros de velocidade, e mira em onde você vai estar, então correr em círculos não despista mais.',
        en: "When the horde is nearly full, new arrivals come in as elites: red outline, more HP, more EXP and more damage (not during the Mewtwo fight, which stays a duel). And one new species each stage runs, with speed lines, aiming where you're going to be, so running in circles no longer shakes it.",
      },
    ],
  },
  {
    date: '2026-10-14',
    pr: 40,
    title: { pt: 'Fim de partida sem impasse', en: 'No more endgame stalemates' },
    notes: [
      {
        pt: 'Os inimigos comuns não viram mais esponjas no fim da partida: o HP sobe mais devagar depois dos 8:00, e o Difícil e o Pesadelo agora apertam com hordas mais rápidas, mais cheias e que batem mais forte, em vez de HP de sobra. No fim, um inimigo do Pesadelo tem cerca de 2x o HP do Normal (antes eram 4,5x).',
        en: "Regular enemies no longer turn into sponges late in the run: their HP grows slower after 8:00, and Hard and Nightmare now press with faster, denser hordes that hit harder instead of piles of HP. Late on Nightmare an enemy has about 2x Normal's HP (it was 4.5x).",
      },
      {
        pt: 'Cada chefe tem até o próximo chegar: se ainda estiver de pé quando o seguinte aparecer, ele foge sem deixar recompensa, em vez de se acumular na horda.',
        en: "Each boss has until the next one arrives: if it's still standing when the next boss shows up, it flees without a reward instead of piling up in the horde.",
      },
      {
        pt: 'O Mewtwo virou o clímax: ao chegar, ele empurra a horda para longe e, enquanto estiver de pé, quase não nascem inimigos comuns. A horda só passa a crescer sem parar depois dos 15:00 se você escolher o modo sem fim.',
        en: 'Mewtwo is now the climax: it blasts the horde away when it arrives and, while it stands, regular enemies barely spawn. The horde only keeps escalating past 15:00 once you choose endless mode.',
      },
    ],
  },
  {
    date: '2026-10-14',
    pr: 39,
    title: { pt: 'Horda que se renova e menos números na tela', en: 'A horde that renews and fewer numbers on screen' },
    notes: [
      {
        pt: 'No fim da partida, a horda não vira mais um bloco parado: quando chega no limite, cada Pokémon novo toma o lugar do mais antigo fora da tela, e quem passa de um minuto fora da tela vai embora. Chefes, shinies, revoadas e quem está na tela nunca somem assim.',
        en: "Late in a run the horde no longer freezes into a still blob: at the cap, each new Pokémon takes the place of the oldest one off-screen, and anyone off-screen for over a minute leaves. Bosses, shinies, flocks and anything on screen never vanish this way.",
      },
      {
        pt: 'Números de dano agora têm três opções em Ajustes: Todos, Reduzidos (o novo padrão) e OFF. Em Reduzidos, com a tela cheia aparecem só os maiores acertos, mais os do chefe, e eles somem um pouco antes.',
        en: 'Damage numbers now have three options in Settings: All, Reduced (the new default) and OFF. On Reduced, a crowded screen only shows the biggest hits, plus the boss\'s, and they fade a little sooner.',
      },
    ],
  },
  {
    date: '2026-10-14',
    title: { pt: 'Entrar ou jogar como convidado', en: 'Sign in or play as a guest' },
    notes: [
      {
        pt: 'Ao tocar em Jogar sem estar conectado, o jogo pergunta se você quer entrar com o Google (a conta é criada no primeiro acesso) ou jogar como convidado. Escolhendo convidado, ele não pergunta de novo até recarregar a página.',
        en: "Tapping Play while signed out now asks whether you want to sign in with Google (the account is created the first time) or play as a guest. Pick guest and it won't ask again until the page reloads.",
      },
      {
        pt: 'Depois de entrar com o Google, o jogo volta direto para o menu, sem a tela de "Aperte qualquer tecla".',
        en: 'After signing in with Google, the game comes back straight to the menu, skipping the "Press any key" screen.',
      },
    ],
  },
  {
    date: '2026-10-14',
    pr: 35,
    title: { pt: 'Ranking conferido pelo servidor', en: 'A ranking the server checks' },
    notes: [
      {
        pt: 'Cada partida do ranking agora é jogada de novo pelo servidor, a partir do replay, e só fica no quadro se terminar igual. Enquanto isso, ela aparece como "Conferindo…".',
        en: 'Every ranked run is now played again by the server from its replay, and only stays on the board if it ends the same. Meanwhile it shows as "Checking…".',
      },
      {
        pt: 'O tamanho de cada Pokémon na hora de acertar e levar golpes agora vem pronto com o jogo. Antes, um inimigo que surgia antes do sprite baixar tinha um corpo diferente por alguns instantes.',
        en: 'Each Pokémon\'s hitbox now ships with the game. Before, an enemy that showed up before its sprite downloaded had a different body for a moment.',
      },
    ],
  },
  {
    date: '2026-10-14',
    pr: 34,
    title: { pt: 'Ranking, perfis e amigos', en: 'Ranking, profiles and friends' },
    notes: [
      {
        pt: 'Ranking por tempo sobrevivido na tela inicial, um para cada dificuldade, com as abas Hoje, Semana e Total. Dá para filtrar por Pokémon e ver só os amigos. Hoje e Semana viram à meia-noite de Brasília.',
        en: 'A ranking by time survived on the title screen, one per difficulty, with Today, Week and All time tabs. Filter it by Pokémon or show only your friends. Today and Week turn over at midnight Brasília time.',
      },
      {
        pt: 'Com uma conta, cada partida entra no ranking sozinha, e o resumo do fim mostra sua posição do dia, da semana e geral. Sem internet, ela entra quando a conexão voltar.',
        en: 'With an account, every run joins the ranking on its own, and the results screen shows where you stand today, this week and all time. Offline, it joins once you are back online.',
      },
      {
        pt: 'Perfil público: escolha um nome e um nome de usuário e compartilhe o link. Ele mostra seu título, os recordes de cada dificuldade, a Pokédex e as partidas recentes. Siga outros treinadores para montar o ranking dos amigos.',
        en: 'Public profiles: pick a name and a username and share the link. It shows your title, your records on each difficulty, your Pokédex and your recent runs. Follow other trainers to build your friends ranking.',
      },
    ],
  },
  {
    date: '2026-10-14',
    pr: 33,
    title: { pt: 'Dificuldades e um fim de partida que volta a assustar', en: 'Difficulty levels and an endgame that bites again' },
    notes: [
      {
        pt: 'Três níveis na tela de seleção do Pokémon: Normal, Difícil e Pesadelo. Todos já vêm liberados e a escolha fica salva. O Difícil traz hordas bem mais duras, que batem mais forte. O Pesadelo vai além e corta toda a cura pela metade.',
        en: 'Three levels on the Pokémon select screen: Normal, Hard and Nightmare. All of them are open from the start and your pick is saved. Hard brings much tougher hordes that hit harder. Nightmare goes further and halves every heal.',
      },
      {
        pt: 'A dificuldade aparece na pausa e no resumo do fim da partida, e cada partida guarda a sua para o ranking que vem aí.',
        en: 'The difficulty shows in the pause menu and on the results screen, and every run keeps its own for the upcoming ranking.',
      },
      {
        pt: 'No Normal, os últimos minutos voltaram a ser uma ameaça. A partir de 8:00 os inimigos ganham HP mais rápido e, de 10:00 em diante, aparecem mais deles. Antes, um time pronto limpava a tela antes de qualquer inimigo encostar.',
        en: 'On Normal, the last minutes are a threat again. From 8:00 enemies gain HP faster, and from 10:00 more of them show up. Before, a finished build cleared the screen before anything could touch you.',
      },
    ],
  },
  {
    date: '2026-10-14',
    pr: 32,
    title: { pt: 'Contas: seu progresso na nuvem', en: 'Accounts: your progress in the cloud' },
    notes: [
      {
        pt: 'Entre com o Google pelo botão no canto da tela inicial para guardar o progresso na nuvem e continuar em qualquer aparelho. Jogar como convidado continua sendo o padrão, e nada muda para quem não entrar.',
        en: 'Sign in with Google from the button in the corner of the title screen to keep your progress in the cloud and pick it up on any device. Playing as a guest is still the default, and nothing changes if you don\'t sign in.',
      },
      {
        pt: 'Ao entrar, o que você conquistou como convidado vai junto: a Pokédex, os ovos, os Pokémon chocados e as conquistas se somam aos da conta, e cada melhoria, recorde e missão fica com o maior valor.',
        en: 'When you sign in, everything you got as a guest comes along: the Pokédex, eggs, hatched Pokémon and achievements join the account\'s, and every upgrade, record and mission keeps the higher value.',
      },
      {
        pt: 'O progresso sincroniza no fim de cada partida. Sem internet, o jogo segue normal e sincroniza depois.',
        en: 'Progress syncs at the end of every run. Offline, the game plays as usual and syncs later.',
      },
    ],
  },
  {
    date: '2026-10-14',
    pr: 31,
    title: { pt: 'Um especial para cada tipo e números de dano legíveis', en: 'A special for every type and readable damage numbers' },
    notes: [
      {
        pt: 'Os 18 tipos agora têm o seu ataque especial, que fica mais forte na evolução final: Thunderbolt → Bolt Strike, Dragon Pulse → Draco Meteor, Shadow Ball → Astral Barrage, Bulldoze → Precipice Blades, Air Cutter → Aeroblast e mais. Raios do céu, chuvas de meteoros e de gelo, anéis de projéteis, muralhas que avançam e rastros de veneno, cada um com a cor e o efeito do tipo.',
        en: 'All 18 types now have their own special attack, which grows stronger at the final evolution: Thunderbolt → Bolt Strike, Dragon Pulse → Draco Meteor, Shadow Ball → Astral Barrage, Bulldoze → Precipice Blades, Air Cutter → Aeroblast and more. Bolts from the sky, meteor and icicle showers, rings of projectiles, sweeping walls and poison trails, each with its type\'s color and effect.',
      },
      {
        pt: 'Os Pokémon dos ovos usam o especial do primeiro tipo deles. O Guia lista os 18 e quem usa cada um.',
        en: 'Egg Pokémon use their first type\'s special. The guide lists all 18 and who uses each one.',
      },
      {
        pt: 'Números de dano num mesmo alvo se somam num número que cresce, com no máximo três por alvo em posições fixas. Chefes sob muitos golpes não viram mais uma tira ilegível, e os acertos super efetivos continuam em amarelo e por cima.',
        en: 'Damage numbers on the same target add up into one growing number, at most three per target in fixed spots. Bosses under many moves no longer turn into an unreadable strip, and super-effective hits stay yellow and on top.',
      },
    ],
  },
  {
    date: '2026-10-14',
    pr: 30,
    title: { pt: 'Aviso de captura só na primeira vez', en: 'Catch notice only the first time' },
    notes: [
      {
        pt: 'Derrotar um shiny de uma espécie que já é sua não mostra mais o aviso de captura. Ele aparece só quando o shiny é novo na sua Pokédex.',
        en: 'Defeating a shiny of a species you already own no longer shows the catch notice. It only shows when the shiny is new to your Pokédex.',
      },
    ],
  },
  {
    date: '2026-10-14',
    pr: 29,
    title: { pt: 'Ovos, Pokédex e missões juntos', en: 'Eggs, Pokédex and missions together' },
    notes: [
      {
        pt: 'O Pokémon que sai de um ovo entra na Pokédex como capturado, shiny se for o caso, e a linha evolutiva inteira dele conta como vista. Cada forma que você joga, inclusive as que alcança evoluindo, também conta como sua.',
        en: 'The Pokémon that comes out of an egg joins the Pokédex as caught, shiny if it is, and its whole evolution line counts as seen. Every form you play, the ones you evolve into included, counts as yours too.',
      },
      {
        pt: 'Quatro conquistas novas: veja 100 espécies, capture todas as formas dos 27 iniciais, choque o primeiro ovo e choque um shiny. Agora são 53.',
        en: 'Four new achievements: see 100 species, catch every form of the 27 starters, hatch your first egg and hatch a shiny. There are 53 now.',
      },
      {
        pt: 'Missões novas de andar, de ver espécies diferentes numa partida e de chocar ovos. Algumas semanais e toda medalha de ouro também dão um ovo, sem passar das 3 vagas da incubadora nem do limite de ovos por partida.',
        en: 'New missions to walk, to see different species in one run and to hatch eggs. Some weeklies and every gold medal also give an egg, within the incubator\'s 3 slots and the per-run egg limit.',
      },
      {
        pt: 'O resultado da partida ficou mais enxuto: Pokédex, ovos e missões num bloco só, que cabe no celular em pé.',
        en: 'A tidier run result: Pokédex, eggs and missions in one block that fits a phone held upright.',
      },
      {
        pt: 'No computador, as abas de região da escolha de Pokémon quebram em duas linhas, então Paldea e a aba Ovos ficam sempre à vista.',
        en: 'On a computer, the region tabs of the Pokémon select wrap onto two lines, so Paldea and the Eggs tab are always in sight.',
      },
      {
        pt: 'O Guia agora diz certo: os lendários das fendas podem ser shiny (1 em 8). Chefes do mapa, Mewtwo e Arceus nunca são.',
        en: 'The guide now gets it right: rift legendaries can be shiny (1 in 8). Map bosses, Mewtwo and Arceus never are.',
      },
    ],
  },
  {
    date: '2026-10-14',
    pr: 27,
    title: { pt: 'Missões, conquistas e títulos', en: 'Missions, achievements and titles' },
    notes: [
      {
        pt: 'Missões no menu do título: três diárias e duas semanais, iguais para todo mundo no mesmo dia, com recompensa em Poké Dollars. Derrote Pokémon de um tipo ou na chuva, vença fendas, abra baús, pegue o Pay Day do Meowth e mais.',
        en: 'Missions in the title menu: three daily and two weekly ones, the same for everyone on the same day, paid in Poké Dollars. Defeat Pokémon of a type or in the rain, win rifts, open chests, grab Meowth\'s Pay Day and more.',
      },
      {
        pt: '49 conquistas com medalhas de bronze, prata e ouro, de jogar a primeira partida a derrotar o Arceus. Cada medalha paga Poké Dollars.',
        en: '49 achievements with bronze, silver and gold medals, from playing your first run to defeating Arceus. Every medal pays Poké Dollars.',
      },
      {
        pt: 'Algumas conquistas dão um título, como Caçador de Shinies ou Domador de Lendas, que aparece na tela de título e no resultado da partida.',
        en: 'Some achievements grant a title, like Shiny Hunter or Legend Tamer, shown on the title screen and on the run results.',
      },
      {
        pt: 'O resultado da partida mostra o progresso de cada missão e as medalhas novas. Durante a partida, nada de avisos extras.',
        en: 'The run results show every mission\'s progress and the new medals. No extra pop-ups during the run.',
      },
    ],
  },
  {
    date: '2026-10-13',
    pr: 28,
    title: { pt: 'Ovos e 25 Pokémon novos para jogar', en: 'Eggs and 25 new Pokémon to play' },
    notes: [
      {
        pt: 'Chefes, baús trancados e fendas às vezes deixam um ovo. Ele vai para a incubadora (3 vagas) e choca com os passos que você dá nas partidas.',
        en: 'Bosses, locked chests and rifts sometimes leave an egg. It goes to the incubator (3 slots) and hatches with the steps you take in runs.',
      },
      {
        pt: '25 famílias jogáveis saem dos ovos, de todos os tipos e gerações: de Pichu, Eevee e Machop a Gastly, Riolu e Zorua, e os raros Dratini, Larvitar, Beldum, Gible e Dreepy. Cada uma com golpe, especial e evolução no meio da partida.',
        en: '25 playable families hatch from eggs, from every type and generation: from Pichu, Eevee and Machop to Gastly, Riolu and Zorua, plus the rare Dratini, Larvitar, Beldum, Gible and Dreepy. Each one with its own move, special and mid-run evolution.',
      },
      {
        pt: 'Chocar é um momento: o ovo balança, racha e o Pokémon aparece com o seu grito. 1% de chance de sair shiny, e aí ele é shiny em todas as partidas.',
        en: 'Hatching is a moment: the egg wobbles, cracks and the Pokémon pops out with its cry. A 1% chance to hatch shiny, and then it stays shiny in every run.',
      },
      {
        pt: 'A escolha de parceiro ganhou a aba Ovos, com os chocados e as silhuetas dos que faltam. Repetidos e ovos sem vaga viram Poké Dollars.',
        en: 'The Pokémon select has a new Eggs tab with your hatchlings and silhouettes of the rest. Duplicates and eggs with no room become Poké Dollars.',
      },
    ],
  },
  {
    date: '2026-10-13',
    pr: 25,
    title: { pt: 'Pokédex dentro do jogo', en: 'An in-game Pokédex' },
    notes: [
      {
        pt: 'O botão Pokédex do título agora abre a Pokédex do jogo: todas as espécies, com as que você viu, quantas derrotou e quais capturou. As que faltam aparecem como "?".',
        en: 'The Pokédex button on the title now opens the in-game Pokédex: every species, with the ones you have seen, how many you defeated and which you caught. Missing ones show as "?".',
      },
      {
        pt: 'Shiny derrotado vira seu: ele entra na Pokédex como capturado, com o brilho.',
        en: 'A defeated shiny is yours: it joins the Pokédex as caught, sparkle and all.',
      },
      {
        pt: 'O fim da partida mostra o que entrou de novo, como "+3 espécies novas · 1 shiny capturado".',
        en: 'The end of a run shows what is new, like "+3 new species · 1 shiny caught".',
      },
    ],
  },
  {
    date: '2026-10-13',
    pr: 26,
    title: { pt: 'Avisos em fila e 3 fendas por partida', en: 'Queued notices and 3 rifts per run' },
    notes: [
      {
        pt: 'Os avisos agora fazem fila numa coluna, sem cobrir um ao outro, o HUD ou o seu Pokémon. Eles esperam o menu de nível e a evolução terminarem, então nenhum se perde. No celular deitado, eles ficam no canto direito.',
        en: 'Notices now line up in a column, without covering each other, the HUD or your Pokémon. They wait for the level-up menu and evolutions to finish, so none get lost. On a phone held sideways, they sit on the right.',
      },
      {
        pt: 'A fenda lendária espera um chefe vivo cair por até 45 segundos e depois abre mesmo assim. Toda partida tem 3 fendas, mesmo quando os chefes demoram.',
        en: 'A legendary rift waits up to 45 seconds for a living boss to fall, then opens anyway. Every run gets 3 rifts, even when bosses take a while.',
      },
      {
        pt: 'Ao sair de uma fenda, a troca de clima espera alguns segundos, para não chegar junto com o loot.',
        en: 'When you leave a rift, the weather waits a few seconds to change, so it doesn\'t arrive along with the loot.',
      },
    ],
  },
  {
    date: '2026-10-13',
    pr: 24,
    title: { pt: 'Tudo junto: horda do bioma e Dragões', en: 'All together: biome hordes and Dragons' },
    notes: [
      {
        pt: 'A horda segue o bioma: as espécies novas de cada fase puxam para os tipos do lugar (Planta e Inseto na floresta, Pedra e Terra na caverna, Fantasma e Psíquico na torre).',
        en: 'The horde follows the biome: each stage\'s new species lean towards the local types (Grass and Bug in the forest, Rock and Ground in the cave, Ghost and Psychic in the tower).',
      },
      {
        pt: 'O tipo Dragão chegou à horda com 15 espécies, de Dratini a Flygon. Dragões resistem a Fogo, Água, Planta e Elétrico e sofrem com Gelo, Dragão e Fada. A horda agora tem 193 espécies.',
        en: 'Dragon types join the horde with 15 species, from Dratini to Flygon. Dragons resist Fire, Water, Grass and Electric and fall to Ice, Dragon and Fairy. The horde now has 193 species.',
      },
      {
        pt: 'Pokémon com comportamento entram no sorteio da partida, no máximo um por fase a partir de 1:00. Bronzor, Drifloon, Lokix e Vikavolt também ganharam um.',
        en: 'Pokémon with a behavior join each run\'s draw, at most one per stage from 1:00. Bronzor, Drifloon, Lokix and Vikavolt got one too.',
      },
      {
        pt: 'Dentro de uma fenda o clima e a troca de bioma esperam lá fora, e os lendários das fendas e o Arceus carregam em segundo plano.',
        en: 'Inside a rift, the weather and the biome change wait outside, and the rift legendaries and Arceus load in the background.',
      },
    ],
  },
  {
    date: '2026-10-13',
    pr: 23,
    title: { pt: 'Horda de todas as gerações', en: 'A horde from every generation' },
    notes: [
      {
        pt: '171 Pokémon selvagens das 9 gerações. Cada partida sorteia o seu elenco, com poucas espécies novas por fase.',
        en: '171 wild Pokémon from all 9 generations. Every run draws its own cast, with only a few new species per stage.',
      },
      {
        pt: 'Os inimigos são divididos em 5 faixas pelo total de status base: básicos no começo, evoluções no fim. Revoadas e cercos usam o elenco da partida.',
        en: 'Enemies are split into 5 tiers by base stat total: basic Pokémon early, evolved ones late. Swarms and rings use the run\'s cast.',
      },
      {
        pt: 'A partida começa mais rápido: só o primeiro elenco é baixado antes, o resto chega em segundo plano.',
        en: 'Runs start faster: only the opening cast is downloaded up front, the rest streams in the background.',
      },
      { pt: 'Pokédex com filtro por faixa e o Guia com a seção da horda selvagem.', en: 'A tier filter in the Pokédex and a wild horde section in the guide.' },
    ],
  },
  {
    date: '2026-10-13',
    pr: 22,
    title: { pt: 'Fendas lendárias e modo sem fim', en: 'Legendary rifts and endless mode' },
    notes: [
      {
        pt: 'Algumas vezes por partida, uma fenda se abre no mapa. Entre nela para enfrentar Lugia, Ho-Oh, Kyogre, Groudon, Rayquaza ou Dialga numa arena fechada, com ataques próprios de cada lendário.',
        en: 'A few times per run, a rift opens on the map. Step in to face Lugia, Ho-Oh, Kyogre, Groudon, Rayquaza or Dialga in a walled arena, each with its own attacks.',
      },
      {
        pt: 'Vencer paga muita EXP, Poké Dollars, Poké Balls, itens e cura. Às vezes o lendário é shiny e paga o dobro. Se o tempo acabar, a fenda colapsa e joga você de volta.',
        en: 'Winning pays lots of EXP, Poké Dollars, Poké Balls, items and a heal. Sometimes the legendary is shiny and pays double. If time runs out, the rift collapses and throws you back.',
      },
      {
        pt: 'Depois de derrotar Mewtwo, continue no modo sem fim: a horda não para de crescer e Arceus vem caçar você às 20:00. Dá para derrotá-lo, se você for muito forte.',
        en: 'After beating Mewtwo, keep going in endless mode: the horde keeps growing and Arceus comes hunting at 20:00. It can be beaten, if you are strong enough.',
      },
      {
        pt: 'O tempo sobrevivido agora vale mais: cada minuto além de 15:00 rende Poké Dollars extras no fim da partida.',
        en: 'Time survived is worth more now: every minute past 15:00 pays extra Poké Dollars at the end of the run.',
      },
    ],
  },
  {
    date: '2026-10-13',
    pr: 21,
    title: { pt: 'Biomas e clima', en: 'Biomes and weather' },
    notes: [
      {
        pt: 'A partida agora atravessa cinco biomas: Rota 1, Floresta de Viridian, Monte Moon, Monte Prateado e Torre de Lavender, cada um com visual, itens quebráveis e música próprios.',
        en: 'A run now walks through five biomes: Route 1, Viridian Forest, Mt. Moon, Mt. Silver and Lavender Tower, each with its own look, breakables and music.',
      },
      {
        pt: 'Clima que muda durante a partida e vale para todos: sol forte (Fogo ×1,5, Água ×0,75), chuva (o inverso), tempestade de areia, neve e névoa.',
        en: 'Weather that changes during the run and applies to everyone: harsh sunlight (Fire ×1.5, Water ×0.75), rain (the opposite), sandstorm, snow and fog.',
      },
      {
        pt: 'Quatro temas novos na trilha sonora, um por bioma.',
        en: 'Four new soundtrack themes, one per biome.',
      },
    ],
  },
  {
    date: '2026-10-13',
    pr: 20,
    title: { pt: 'Inimigos com personalidade', en: 'Enemies with personality' },
    notes: [
      {
        pt: 'Seis comportamentos novos na horda: Chansey cura os aliados, Bronzong protege com um escudo que absorve dano, Nidoqueen chama Nidoran, Voltorb e Electrode explodem, Magnemite dispara raios e Hitmonlee salta sobre a horda.',
        en: 'Six new behaviors in the horde: Chansey heals its allies, Bronzong shields them with a ward that soaks damage, Nidoqueen calls in Nidoran, Voltorb and Electrode explode, Magnemite fires beams and Hitmonlee leaps over the horde.',
      },
      {
        pt: 'Todo ataque avisa antes: círculo vermelho, linha ou sombra no chão, piscando mais rápido quando o golpe está perto. A explosão do Voltorb fere os inimigos também.',
        en: 'Every attack warns you first: a red circle, a line or a shadow on the ground, blinking faster as the hit gets close. Voltorb\'s blast hurts enemies too.',
      },
      { pt: 'Um cerco de Voltorb aos 4:30 e uma seção nova no guia.', en: 'A ring of Voltorb at 4:30 and a new guide section.' },
    ],
  },
  {
    date: '2026-10-13',
    pr: 19,
    title: { pt: 'Eventos no mapa', en: 'Map events' },
    notes: [
      {
        pt: 'Pontos de interesse surgem durante a partida e fazem você escolher para onde ir: altares de buff, fontes que curam e baús trancados que pedem 3 segundos dentro do anel enquanto uma emboscada fecha o cerco.',
        en: 'Points of interest show up during a run and make you choose where to go: buff altars, healing fountains and locked chests that need 3 seconds inside their ring while an ambush closes in.',
      },
      {
        pt: 'Armadilhas de espinhos e bombas ferem você e a horda: atraia os selvagens para cima delas.',
        en: 'Spike and bomb traps hurt you and the horde alike: lure the wild Pokémon onto them.',
      },
      {
        pt: 'Um Meowth foge com moedas: cada golpe derruba uma, e se ele desmaiar vem o Pay Day.',
        en: 'A Meowth runs off with coins: every hit knocks one loose, and if it faints you get the Pay Day.',
      },
      { pt: 'Setas na borda da tela apontam para os eventos importantes.', en: 'Arrows on the screen edge point to the important events.' },
    ],
  },
  {
    date: '2026-10-13',
    pr: 14,
    title: { pt: 'Site: Pokédex, guia, novidades e página legal', en: 'Website: Pokédex, guide, changelog and legal page' },
    notes: [
      {
        pt: 'Pokédex com todos os Pokémon do jogo, sprites animados, versão shiny, filtros por região, tipo e papel, e busca.',
        en: 'A Pokédex with every Pokémon in the game, animated sprites, shiny forms, region, type and role filters, and search.',
      },
      {
        pt: 'Guia completo de como jogar, com os números do próprio jogo.',
        en: 'A complete how-to-play guide, with the game\'s own numbers.',
      },
      { pt: 'Esta página de novidades e uma página de legal, privacidade e créditos.', en: 'This changelog and a legal, privacy and credits page.' },
    ],
  },
  {
    date: '2026-10-13',
    pr: 12,
    title: { pt: 'Nova tela de título', en: 'New title screen' },
    notes: [
      {
        pt: 'Tela de título com um campo vivo ao fundo, logo em pixel art e menu: Jogar, Pokédex, Como jogar e Ajustes.',
        en: 'A title screen with a living meadow behind it, a pixel-art logo and a menu: Play, Pokédex, How to play and Settings.',
      },
      {
        pt: 'Os menus agora funcionam no controle: D-pad ou analógico esquerdo para navegar, A confirma, B volta e Start pausa.',
        en: 'Menus now work on a gamepad: D-pad or left stick to navigate, A confirms, B goes back and Start pauses.',
      },
    ],
  },
  {
    date: '2026-10-13',
    pr: 13,
    title: { pt: 'Trilha chiptune original e Ajustes', en: 'Original chiptune soundtrack and Settings' },
    notes: [
      {
        pt: 'Trilha sonora original composta em código e sintetizada ao vivo: tema de vila nos menus, marcha na partida e tema de chefe.',
        en: 'An original soundtrack composed in code and synthesized live: a village theme in the menus, a march for the run and a boss theme.',
      },
      {
        pt: 'Tela de Ajustes, no título e na pausa: volume da música e dos efeitos, som, números de dano, tremor de tela e idioma.',
        en: 'A Settings screen, on the title screen and in the pause menu: music and effects volume, sound, damage numbers, screen shake and language.',
      },
    ],
  },
  {
    date: '2026-10-13',
    pr: 11,
    title: { pt: 'Páginas em português e inglês para buscadores', en: 'Portuguese and English pages for search engines' },
    notes: [
      {
        pt: 'Uma URL por idioma (/ e /en/), com descrição do jogo legível por buscadores e IAs.',
        en: 'One URL per language (/ and /en/), with a game description that search engines and AI assistants can read.',
      },
      { pt: 'Sitemap, robots.txt, llms.txt e dados estruturados.', en: 'Sitemap, robots.txt, llms.txt and structured data.' },
    ],
  },
  {
    date: '2026-10-13',
    pr: 10,
    title: { pt: 'Inglês e português', en: 'English and Portuguese' },
    notes: [
      {
        pt: 'O jogo inteiro em português e inglês: menus, HUD, golpes, itens e Poké Mart. Nomes de Pokémon, golpes e itens seguem os oficiais em inglês.',
        en: 'The whole game in English and Portuguese: menus, HUD, moves, items and the Poké Mart. Pokémon, move and item names keep their official English names.',
      },
      {
        pt: 'O idioma vem do navegador e pode ser trocado no título (PT | EN ou tecla I) e na pausa.',
        en: 'The language follows your browser and can be switched on the title screen (PT | EN or the I key) and in the pause menu.',
      },
    ],
  },
  {
    date: '2026-10-13',
    pr: 9,
    title: { pt: 'Código aberto', en: 'Open source' },
    notes: [
      {
        pt: 'O código está no GitHub sob a licença MIT, com créditos para cada artista dos sprites.',
        en: 'The code is on GitHub under the MIT license, with credit for every sprite artist.',
      },
      { pt: 'Avisos legais de fan game não oficial.', en: 'Legal notices for an unofficial fan game.' },
    ],
  },
  {
    date: '2026-10-13',
    pr: 2,
    title: { pt: 'Poké Dollars e Poké Mart', en: 'Poké Dollars and the Poké Mart' },
    notes: [
      {
        pt: 'Inimigos soltam Poké Dollars (₽), e chefes soltam uma chuva deles. No fim da partida entra um bônus por tempo, derrotados e vitória.',
        en: 'Enemies drop Poké Dollars (₽), and bosses shower them. A bonus for time, fainted foes and winning comes at the end of the run.',
      },
      {
        pt: 'Poké Mart com melhorias permanentes: HP Up, Protein, Iron, Carbos, Calcium, Zinc, PP Up, Exp. Charm, Amulet Coin, Ability Capsule e Escape Rope.',
        en: 'A Poké Mart with permanent upgrades: HP Up, Protein, Iron, Carbos, Calcium, Zinc, PP Up, Exp. Charm, Amulet Coin, Ability Capsule and Escape Rope.',
      },
      { pt: 'Trocar e Pular ofertas ao subir de nível.', en: 'Reroll and Skip on level up.' },
    ],
  },
  {
    date: '2026-10-13',
    pr: 4,
    title: { pt: 'Evolução de golpes', en: 'Move evolutions' },
    notes: [
      {
        pt: 'Golpe no nível máximo + o item certo = um golpe evoluído, como Ember + Charcoal → Flamethrower.',
        en: 'A maxed move plus the right item becomes an evolved move, like Ember + Charcoal → Flamethrower.',
      },
      {
        pt: '10 evoluções e 7 itens de tipo novos (Charcoal, Mystic Water, Miracle Seed, Silk Scarf, Magnet, Poison Barb e Sharp Beak).',
        en: '10 evolutions and 7 new type items (Charcoal, Mystic Water, Miracle Seed, Silk Scarf, Magnet, Poison Barb and Sharp Beak).',
      },
    ],
  },
  {
    date: '2026-10-13',
    pr: 3,
    title: { pt: 'Shinies e chefes lendários', en: 'Shinies and legendary bosses' },
    notes: [
      {
        pt: 'Pokémon selvagens shiny (1 em 450) viram elites que soltam Poké Ball, e o seu inicial pode ser shiny (1 em 64).',
        en: 'Shiny wild Pokémon (1 in 450) become elites that drop a Poké Ball, and your starter can be shiny (1 in 64).',
      },
      {
        pt: 'Articuno, Zapdos, Moltres e Mewtwo como chefes com ataques próprios. Às vezes Mew aparece no final.',
        en: 'Articuno, Zapdos, Moltres and Mewtwo as bosses with their own attacks. Sometimes Mew shows up at the end.',
      },
    ],
  },
  {
    date: '2026-10-13',
    pr: 8,
    title: { pt: 'Os 27 iniciais', en: 'All 27 starters' },
    notes: [
      {
        pt: 'O trio inicial de todas as regiões, de Kanto a Paldea, com as 3 evoluções (Nv 12 e Nv 28), status e golpes próprios.',
        en: 'The starter trio of every region, Kanto to Paldea, with all 3 stages (Lv 12 and Lv 28), their own stats and moves.',
      },
      { pt: '13 golpes novos e os tipos Aço, Sombrio e Fada.', en: '13 new moves and the Steel, Dark and Fairy types.' },
      {
        pt: 'Nova escolha de inicial com abas por região e painel de inspeção.',
        en: 'A new starter select with region tabs and an inspect panel.',
      },
    ],
  },
  {
    date: '2026-10-13',
    pr: 6,
    title: { pt: 'Itens no mapa', en: 'Map items' },
    notes: [
      {
        pt: 'Item Balls, Berry Trees e mato alto pelo mapa. Quebre para pegar Potion, Rare Candy, Exp. Share, Poké Flute, Max Repel, Voltorb, X Attack, X Speed e Revive.',
        en: 'Item Balls, Berry Trees and tall grass around the map. Break them for Potions, Rare Candies, Exp. Share, the Poké Flute, Max Repel, Voltorb, X Attack, X Speed and Revive.',
      },
    ],
  },
  {
    date: '2026-10-13',
    pr: 1,
    title: { pt: 'Condições de status', en: 'Status conditions' },
    notes: [
      {
        pt: 'Queimadura, veneno e paralisia, como nos jogos. Novos itens King\'s Rock e Toxic Orb.',
        en: 'Burn, poison and paralysis, like on the handhelds. New held items: King\'s Rock and Toxic Orb.',
      },
    ],
  },
  {
    date: '2026-10-13',
    pr: 7,
    title: { pt: 'Ataque especial', en: 'Special attack' },
    notes: [
      {
        pt: 'Um ataque manual com recarga (Espaço, botão na tela ou A / ✕ do controle): Flare Blitz, Hydro Pump e Grass Knot, que viram Blast Burn, Hydro Cannon e Frenzy Plant na evolução final.',
        en: 'A manual attack on a cooldown (Space, the on-screen button or the gamepad A / ✕): Flare Blitz, Hydro Pump and Grass Knot, which become Blast Burn, Hydro Cannon and Frenzy Plant at the final evolution.',
      },
    ],
  },
  {
    date: '2026-10-13',
    pr: 5,
    title: { pt: 'Versão para celular', en: 'Mobile version' },
    notes: [
      {
        pt: 'Joystick de toque flutuante, botão de pausa na tela e layout para retrato e paisagem.',
        en: 'A floating touch joystick, an on-screen pause button and layouts for portrait and landscape.',
      },
      { pt: 'Dá para instalar como app em tela cheia.', en: 'Installable as a fullscreen app.' },
    ],
  },
  {
    date: '2026-10-13',
    title: { pt: 'Primeira versão', en: 'First release' },
    notes: [
      {
        pt: 'Sobreviva 15 minutos de hordas com Charmander, Squirtle ou Bulbasaur: golpes automáticos, níveis, evolução no meio da partida e chefes.',
        en: 'Survive 15 minutes of hordes with Charmander, Squirtle or Bulbasaur: automatic moves, level ups, mid-run evolution and bosses.',
      },
    ],
  },
]
