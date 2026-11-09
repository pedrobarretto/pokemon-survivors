import type { SEASON_ONE_EGGS } from '../../data/seasonOneEggs'
import type { SeasonOneEggMoveId } from '../../game/seasonOneEggMoves'
import type { ContentTexts } from '../pt'

/**
 * Temporada 1's egg and fossil families' words, a table per language (`pt` is the reference).
 * Each language's file spreads its `blurbs`, `moves` and `abilities` here.
 */
type Words = {
  blurbs: Record<keyof typeof SEASON_ONE_EGGS, string>
  moves: Pick<ContentTexts['moves'], SeasonOneEggMoveId>
  abilities: { pastelVeil: string }
}

export const SEASON_ONE_EGGS_WORDS: Record<'pt' | 'en' | 'es' | 'fr' | 'zh', Words> = {
  pt: {
    blurbs: {
      snom: 'Deixa um rastro de neve em pó que atrasa a horda.',
      joltik: 'Teias elétricas que saltam de inimigo em inimigo.',
      salandit: 'Um veneno que passa adiante quando a vítima cai.',
      hatenna: 'Um espelho na hora certa devolve os tiros inimigos.',
      applin: 'Maçãs ácidas e três caminhos: Dipplin, Flapple ou Appletun.',
      frigibax: 'Leques de cacos gelados de dragão, cada vez maiores.',
      cranidos: 'Cabeçada com tudo. Defesa? Depois a gente vê.',
      shieldon: 'Lento, mas um escudo que devolve o golpe.',
      archen: 'Bate, voa para longe e volta. Rápido, mas frágil.',
      tyrunt: 'Quanto mais morde o mesmo alvo, mais forte morde.',
      amaura: 'Uma aurora larga que gela tudo em volta.',
      ponyta: 'Quanto mais rápido galopa, mais queima. Parado, quase não arde.',
      ponytaGalar: 'Um clarão pastel em volta, que cura um pouco a cada golpe.',
    },
    moves: {
      powderSnow: {
        description: 'Solta uma lufada de neve em pó e, por alguns segundos, deixa um rastro por onde passa. Quem pisa nele fica lento.',
        upgrades: ['+2 de dano', '+0,4 s de duração', { fork: [{ name: 'Neve Pesada', desc: 'Inimigos derrotados explodem; +15% de área e +1 de dano' }, { name: 'Faísca Fria', desc: 'A neve salta para inimigos próximos; 0,3 s a menos de recarga' }] }, '+2 de dano', '0,3 s a menos de recarga', { fork: [{ name: 'Nevasca de Caça', desc: '×1,5 em elites e chefes; +0,6 s de duração' }, { name: 'Neve Vital', desc: 'Parte do dano cura você; +20% de área' }] }, '+3 de dano e +15% de área'],
      },
      electroweb: {
        description: 'Uma teia elétrica salta entre inimigos próximos, deixando cada um lento e um fio vivo sob seus pés.',
        upgrades: ['+1 salto', '+3 de dano', { fork: [{ name: 'Curto-Circuito', desc: 'Inimigos derrotados explodem; 0,2 s a menos de recarga' }, { name: 'Teia Longa', desc: '+1 salto e faíscas extras; -1 de dano' }] }, '+3 de dano', '+1 salto', { fork: [{ name: 'Teia de Caça', desc: '×1,5 em elites e chefes; +4 de dano' }, { name: 'Fio Cruel', desc: '×1,35 em inimigos afligidos; +25% de área' }] }, '+1 salto e +3 de dano'],
      },
      corrosiveGas: {
        description: 'Uma nuvem corrosiva na maior aglomeração envenena quem respira. Quando um envenenado cai, o veneno pula para os vizinhos.',
        upgrades: ['+1 de dano', '+15% de área', { fork: [{ name: 'Gás Volátil', desc: 'Inimigos derrotados explodem; +20% de dano de status' }, { name: 'Rastro Ácido', desc: 'Deixa chão corrosivo; 0,3 s a menos de recarga' }] }, '+2 de dano', '0,3 s a menos de recarga', { fork: [{ name: 'Toxina Fina', desc: '×1,5 em elites e chefes; +0,4 s de duração e +10% de dano de status' }, { name: 'Redemoinho Tóxico', desc: 'A nuvem puxa inimigos; +20% de área' }] }, '+3 de dano e +15% de dano de status'],
      },
      magicCoat: {
        description: 'Solta um pulso psíquico e cobre você com um espelho curto (até metade da recarga) que manda os tiros inimigos de volta.',
        upgrades: ['+3 de dano', '+0,2 s de espelho', { fork: [{ name: 'Espelho Partido', desc: 'Inimigos derrotados explodem; +4 de dano' }, { name: 'Reflexo em Arco', desc: 'Faíscas saltam do pulso; +20% de área' }] }, '0,4 s a menos de recarga', '+4 de dano', { fork: [{ name: 'Olhar Fixo', desc: '×1,5 em elites e chefes; +0,2 s de espelho e +15% de área' }, { name: 'Maldade Refletida', desc: '×1,35 em inimigos afligidos; +3 de dano e 0,3 s a menos de recarga' }] }, '+5 de dano e +0,2 s de espelho'],
      },
      appleAcid: {
        description: 'Lança maçãs nos inimigos mais próximos; o ácido enfraquece quem atinge. Flapple acerta mais forte, Appletun acerta mais longe.',
        upgrades: ['+4 de dano', '+1 maçã', { fork: [{ name: 'Polpa Ácida', desc: 'Deixa chão ácido; +15% de área' }, { name: 'Caroço Explosivo', desc: 'Inimigos derrotados explodem; +4 de dano' }] }, '0,25 s a menos de recarga', '+5 de dano', { fork: [{ name: 'Segunda Colheita', desc: 'Lança de novo logo em seguida; +1 maçã e -2 de dano' }, { name: 'Maçã Certeira', desc: '×1,5 em elites e chefes; +20% de chance de efeito' }] }, '+1 maçã e +5 de dano'],
      },
      icicleSpear: {
        description: 'Um leque de cacos gelados de dragão que freiam no ar e deixam lento quem cortam.',
        upgrades: ['+1 caco', '+3 de dano', { fork: [{ name: 'Estilhaços', desc: 'Inimigos derrotados explodem; +3 de dano' }, { name: 'Leque Partido', desc: '+2 cacos que se dividem; -2 de dano' }] }, '0,2 s a menos de recarga', '+4 de dano', { fork: [{ name: 'Corte Cruel', desc: '×1,35 em inimigos afligidos; +2 de dano e +20% de chance de efeito' }, { name: 'Arco Gélido', desc: 'Faíscas saltam para inimigos próximos; +20% de área' }] }, '+2 cacos e +3 de dano'],
      },
      headSmash: {
        description: 'Uma cabeçada com tudo no inimigo mais próximo. Acertar custa um pouco de HP, nunca o último ponto.',
        upgrades: ['+7 de dano', '+20% de área', { fork: [{ name: 'Crânio Explosivo', desc: 'Inimigos derrotados explodem; +8 de dano' }, { name: 'Rastro de Pedra', desc: 'Deixa pedras no caminho; 0,4 s a menos de recarga' }] }, '+8 de dano', '0,3 s a menos de recarga', { fork: [{ name: 'Crânio Caçador', desc: '×1,5 em elites e chefes; +10 de dano' }, { name: 'Abalo', desc: 'Faíscas saltam ao redor; +20% de área e +4 de dano' }] }, '+12 de dano e +20% de área'],
      },
      ironDefense: {
        description: 'Um escudo que bate em quem encosta e anula o próximo golpe (até metade da recarga), respondendo com uma onda. A armadura aumenta a resposta.',
        upgrades: ['+5 de dano', '+0,2 s de escudo', { fork: [{ name: 'Escudo Bomba', desc: 'Inimigos derrotados explodem; +6 de dano' }, { name: 'Escudo Rápido', desc: 'Faíscas na onda; 0,5 s a menos de recarga' }] }, '+6 de dano', '0,4 s a menos de recarga', { fork: [{ name: 'Muralha Caçadora', desc: '×1,5 em elites e chefes; +25% de área' }, { name: 'Muralha Vital', desc: 'Parte do dano cura você; +8 de dano' }] }, '+8 de dano e +0,2 s de escudo'],
      },
      dualWingbeat: {
        description: 'Duas asadas rápidas no inimigo mais próximo e um impulso de velocidade para sair dali.',
        upgrades: ['+3 de dano', '0,08 s a menos de recarga', { fork: [{ name: 'Asa Explosiva', desc: 'Inimigos derrotados explodem; +2 de dano' }, { name: 'Terceira Asa', desc: '+1 asada com faíscas; -2 de dano' }] }, '+3 de dano', '+20% de área', { fork: [{ name: 'Asa Caçadora', desc: '×1,5 em elites e chefes; +3 de dano' }, { name: 'Voo Duplo', desc: 'Repete logo em seguida; 0,1 s a menos de recarga' }] }, '+5 de dano'],
      },
      bite: {
        description: 'Morde o inimigo mais próximo e o marca; cada marca (até 3) torna a próxima mordida nele mais forte.',
        upgrades: ['+3 de dano', '+20% de área', { fork: [{ name: 'Mandíbula Explosiva', desc: 'Inimigos derrotados explodem; +3 de dano' }, { name: 'Dreno', desc: 'Parte do dano cura você; 0,08 s a menos de recarga' }] }, '+3 de dano', '0,08 s a menos de recarga', { fork: [{ name: 'Faro de Caça', desc: '×1,5 em elites e chefes; +4 de dano' }, { name: 'Mordida Cruel', desc: '×1,35 em inimigos afligidos; +25% de área' }] }, '+6 de dano'],
      },
      auroraVeil: {
        description: 'Um campo de aurora em volta de você que deixa lento quem toca e às vezes congela. O tamanho tem limite.',
        upgrades: ['+2 de dano', '+12% de área', { fork: [{ name: 'Aurora Explosiva', desc: 'Inimigos derrotados explodem; +2 de dano' }, { name: 'Aurora Puxante', desc: 'O campo puxa inimigos; +0,4 s de duração' }] }, '+2 de dano', '0,4 s a menos de recarga', { fork: [{ name: 'Aurora Caçadora', desc: '×1,5 em elites e chefes; +8% de congelar' }, { name: 'Arco de Aurora', desc: 'Faíscas saltam ao redor; +15% de área e +1 de dano' }] }, '+4 de dano e +0,3 s de duração'],
      },
      flareBlitz: {
        description: 'Queima em volta e, por alguns segundos, deixa fogo por onde pisa. Quanto mais rápido você corre, mais forte; parado, quase não arde.',
        upgrades: ['+2 de dano', '+0,4 s de duração', { fork: [{ name: 'Crina Explosiva', desc: 'Inimigos derrotados explodem; +15% de área e +1 de dano' }, { name: 'Fagulha Solta', desc: 'As chamas saltam para inimigos próximos; 0,3 s a menos de recarga' }] }, '+3 de dano', '0,3 s a menos de recarga', { fork: [{ name: 'Galope de Caça', desc: '×1,5 em elites e chefes; +0,6 s de duração' }, { name: 'Cascos Cruéis', desc: '×1,35 em inimigos afligidos; +20% de área' }] }, '+4 de dano e +15% de área'],
      },
      dazzlingGleam: {
        description: 'Um clarão pastel em volta de você confunde alguns inimigos, e parte do dano cura você.',
        upgrades: ['+3 de dano', '+15% de área', { fork: [{ name: 'Brilho Explosivo', desc: 'Inimigos derrotados explodem; 0,3 s a menos de recarga' }, { name: 'Chifre Caçador', desc: '×1,5 em elites e chefes; +3 de dano' }] }, '+4 de dano', '+15% de área', { fork: [{ name: 'Luz Cruel', desc: '×1,35 em inimigos afligidos; 0,4 s a menos de recarga' }, { name: 'Arco-Íris', desc: 'Faíscas saltam do clarão; +20% de área' }] }, '+5 de dano e +15% de área'],
      },
    },
    abilities: { pastelVeil: 'Recebe 60% menos dano de Veneno e recupera vida aos poucos.' },
  },
  en: {
    blurbs: {
      snom: 'Leaves a powder-snow trail that slows the horde.',
      joltik: 'Electric webs that jump from foe to foe.',
      salandit: 'A poison that moves on when its victim falls.',
      hatenna: 'A well-timed mirror sends enemy shots back.',
      applin: 'Acid apples and three paths: Dipplin, Flapple or Appletun.',
      frigibax: 'Ever-wider fans of icy dragon shards.',
      cranidos: 'All-in headbutts. Defense? Later, maybe.',
      shieldon: 'Slow, but its shield hits back.',
      archen: 'Strikes, flies off, comes back. Fast and fragile.',
      tyrunt: 'The more it bites one target, the harder it bites.',
      amaura: 'A wide aurora that chills everything around it.',
      ponyta: 'The faster it gallops, the more it burns. Standing still, it barely smolders.',
      ponytaGalar: 'A pastel flash all around that heals a little with every hit.',
    },
    moves: {
      powderSnow: {
        description: 'Puffs out powder snow and, for a few seconds, leaves a trail behind you. Whatever crosses it slows down.',
        upgrades: ['+2 damage', '+0.4s duration', { fork: [{ name: 'Heavy Snow', desc: 'Defeated foes explode; +15% area and +1 damage' }, { name: 'Cold Spark', desc: 'The snow jumps to nearby foes; 0.3s faster cooldown' }] }, '+2 damage', '0.3s faster cooldown', { fork: [{ name: 'Hunting Flurry', desc: '×1.5 on elites and bosses; +0.6s duration' }, { name: 'Vital Snow', desc: 'Some of the damage heals you; +20% area' }] }, '+3 damage and +15% area'],
      },
      electroweb: {
        description: 'An electric web jumps between nearby foes, slowing each one and leaving a live thread under its feet.',
        upgrades: ['+1 jump', '+3 damage', { fork: [{ name: 'Short Circuit', desc: 'Defeated foes explode; 0.2s faster cooldown' }, { name: 'Long Web', desc: '+1 jump and extra sparks; -1 damage' }] }, '+3 damage', '+1 jump', { fork: [{ name: 'Hunting Web', desc: '×1.5 on elites and bosses; +4 damage' }, { name: 'Cruel Thread', desc: '×1.35 on afflicted foes; +25% area' }] }, '+1 jump and +3 damage'],
      },
      corrosiveGas: {
        description: 'A corrosive cloud on the thickest crowd poisons whatever breathes it. When a poisoned foe falls, the poison jumps to its neighbors.',
        upgrades: ['+1 damage', '+15% area', { fork: [{ name: 'Volatile Gas', desc: 'Defeated foes explode; +20% status damage' }, { name: 'Acid Trail', desc: 'Leaves corrosive ground; 0.3s faster cooldown' }] }, '+2 damage', '0.3s faster cooldown', { fork: [{ name: 'Fine Toxin', desc: '×1.5 on elites and bosses; +0.4s duration and +10% status damage' }, { name: 'Toxic Whirl', desc: 'The cloud pulls foes in; +20% area' }] }, '+3 damage and +15% status damage'],
      },
      magicCoat: {
        description: 'Fires a psychic pulse and wraps you in a brief mirror (at most half its cooldown) that sends enemy shots back.',
        upgrades: ['+3 damage', '+0.2s mirror', { fork: [{ name: 'Shattered Mirror', desc: 'Defeated foes explode; +4 damage' }, { name: 'Arcing Reflection', desc: 'Sparks jump off the pulse; +20% area' }] }, '0.4s faster cooldown', '+4 damage', { fork: [{ name: 'Fixed Stare', desc: '×1.5 on elites and bosses; +0.2s mirror and +15% area' }, { name: 'Reflected Spite', desc: '×1.35 on afflicted foes; +3 damage and 0.3s faster cooldown' }] }, '+5 damage and +0.2s mirror'],
      },
      appleAcid: {
        description: 'Lobs apples at the nearest foes; the acid weakens what it splashes. Flapple hits harder, Appletun splashes wider.',
        upgrades: ['+4 damage', '+1 apple', { fork: [{ name: 'Acid Pulp', desc: 'Leaves acid ground; +15% area' }, { name: 'Bursting Core', desc: 'Defeated foes explode; +4 damage' }] }, '0.25s faster cooldown', '+5 damage', { fork: [{ name: 'Second Harvest', desc: 'Throws again right after; +1 apple and -2 damage' }, { name: 'Sure Apple', desc: '×1.5 on elites and bosses; +20% effect chance' }] }, '+1 apple and +5 damage'],
      },
      icicleSpear: {
        description: 'A fan of icy dragon shards that brake in the air and slow whatever they cut.',
        upgrades: ['+1 shard', '+3 damage', { fork: [{ name: 'Splinters', desc: 'Defeated foes explode; +3 damage' }, { name: 'Broken Fan', desc: '+2 shards that split; -2 damage' }] }, '0.2s faster cooldown', '+4 damage', { fork: [{ name: 'Cruel Cut', desc: '×1.35 on afflicted foes; +2 damage and +20% effect chance' }, { name: 'Frost Arc', desc: 'Sparks jump to nearby foes; +20% area' }] }, '+2 shards and +3 damage'],
      },
      headSmash: {
        description: 'An all-in charge at the nearest foe. Landing it costs a little HP, never your last point.',
        upgrades: ['+7 damage', '+20% area', { fork: [{ name: 'Blast Skull', desc: 'Defeated foes explode; +8 damage' }, { name: 'Stone Trail', desc: 'Leaves rocks in its wake; 0.4s faster cooldown' }] }, '+8 damage', '0.3s faster cooldown', { fork: [{ name: 'Hunter Skull', desc: '×1.5 on elites and bosses; +10 damage' }, { name: 'Shockwave', desc: 'Sparks jump around; +20% area and +4 damage' }] }, '+12 damage and +20% area'],
      },
      ironDefense: {
        description: 'A shield that bashes what touches it and negates the next hit (at most half its cooldown), answering with a shockwave. Armor makes the answer stronger.',
        upgrades: ['+5 damage', '+0.2s shield', { fork: [{ name: 'Bomb Shield', desc: 'Defeated foes explode; +6 damage' }, { name: 'Quick Shield', desc: 'Sparks on the wave; 0.5s faster cooldown' }] }, '+6 damage', '0.4s faster cooldown', { fork: [{ name: 'Hunter Wall', desc: '×1.5 on elites and bosses; +25% area' }, { name: 'Vital Wall', desc: 'Some of the damage heals you; +8 damage' }] }, '+8 damage and +0.2s shield'],
      },
      dualWingbeat: {
        description: 'Two quick wing blows on the nearest foe, then a burst of speed to get away.',
        upgrades: ['+3 damage', '0.08s faster cooldown', { fork: [{ name: 'Blast Wing', desc: 'Defeated foes explode; +2 damage' }, { name: 'Third Wing', desc: '+1 blow with sparks; -2 damage' }] }, '+3 damage', '+20% area', { fork: [{ name: 'Hunter Wing', desc: '×1.5 on elites and bosses; +3 damage' }, { name: 'Double Flight', desc: 'Strikes again right after; 0.1s faster cooldown' }] }, '+5 damage'],
      },
      bite: {
        description: 'Bites the nearest foe and marks it; each mark (up to 3) makes the next bite on it land harder.',
        upgrades: ['+3 damage', '+20% area', { fork: [{ name: 'Blast Jaw', desc: 'Defeated foes explode; +3 damage' }, { name: 'Drain', desc: 'Some of the damage heals you; 0.08s faster cooldown' }] }, '+3 damage', '0.08s faster cooldown', { fork: [{ name: 'Hunting Nose', desc: '×1.5 on elites and bosses; +4 damage' }, { name: 'Cruel Bite', desc: '×1.35 on afflicted foes; +25% area' }] }, '+6 damage'],
      },
      auroraVeil: {
        description: 'An aurora field around you that slows what it touches and sometimes freezes it. Its size has a limit.',
        upgrades: ['+2 damage', '+12% area', { fork: [{ name: 'Bursting Aurora', desc: 'Defeated foes explode; +2 damage' }, { name: 'Pulling Aurora', desc: 'The field pulls foes in; +0.4s duration' }] }, '+2 damage', '0.4s faster cooldown', { fork: [{ name: 'Hunter Aurora', desc: '×1.5 on elites and bosses; +8% freeze' }, { name: 'Aurora Arc', desc: 'Sparks jump around; +15% area and +1 damage' }] }, '+4 damage and +0.3s duration'],
      },
      flareBlitz: {
        description: 'Burns all around you and, for a few seconds, leaves fire where you step. The faster you run, the stronger it gets; standing still, it barely smolders.',
        upgrades: ['+2 damage', '+0.4s duration', { fork: [{ name: 'Blazing Mane', desc: 'Defeated foes explode; +15% area and +1 damage' }, { name: 'Loose Sparks', desc: 'The flames jump to nearby foes; 0.3s faster cooldown' }] }, '+3 damage', '0.3s faster cooldown', { fork: [{ name: 'Hunting Gallop', desc: '×1.5 on elites and bosses; +0.6s duration' }, { name: 'Cruel Hooves', desc: '×1.35 on afflicted foes; +20% area' }] }, '+4 damage and +15% area'],
      },
      dazzlingGleam: {
        description: 'A pastel flash around you confuses some foes, and part of the damage heals you.',
        upgrades: ['+3 damage', '+15% area', { fork: [{ name: 'Bursting Gleam', desc: 'Defeated foes explode; 0.3s faster cooldown' }, { name: 'Hunting Horn', desc: '×1.5 on elites and bosses; +3 damage' }] }, '+4 damage', '+15% area', { fork: [{ name: 'Cruel Light', desc: '×1.35 on afflicted foes; 0.4s faster cooldown' }, { name: 'Rainbow', desc: 'Sparks jump from the flash; +20% area' }] }, '+5 damage and +15% area'],
      },
    },
    abilities: { pastelVeil: 'You take 60% less Poison damage and slowly regain HP.' },
  },
  es: {
    blurbs: {
      snom: 'Deja un rastro de nieve en polvo que frena a la horda.',
      joltik: 'Telas eléctricas que saltan de enemigo en enemigo.',
      salandit: 'Un veneno que pasa adelante cuando cae su víctima.',
      hatenna: 'Un espejo a tiempo devuelve los disparos enemigos.',
      applin: 'Manzanas ácidas y tres caminos: Dipplin, Flapple o Appletun.',
      frigibax: 'Abanicos de esquirlas heladas de dragón, cada vez más amplios.',
      cranidos: 'Cabezazos con todo. ¿Defensa? Luego vemos.',
      shieldon: 'Lento, pero su escudo devuelve el golpe.',
      archen: 'Golpea, se aleja volando y vuelve. Rápido y frágil.',
      tyrunt: 'Cuanto más muerde al mismo blanco, más fuerte muerde.',
      amaura: 'Una aurora amplia que hiela todo a su alrededor.',
      ponyta: 'Cuanto más rápido galopa, más quema. Quieto, apenas arde.',
      ponytaGalar: 'Un destello pastel alrededor que cura un poco con cada golpe.',
    },
    moves: {
      powderSnow: {
        description: 'Suelta nieve en polvo y, por unos segundos, deja un rastro detrás de ti. Lo que lo cruza se ralentiza.',
        upgrades: ['+2 de daño', '+0,4 s de duración', { fork: [{ name: 'Nieve Pesada', desc: 'Los enemigos derrotados explotan; +15% de área y +1 de daño' }, { name: 'Chispa Fría', desc: 'La nieve salta a enemigos cercanos; 0,3 s menos de recarga' }] }, '+2 de daño', '0,3 s menos de recarga', { fork: [{ name: 'Ventisca de Caza', desc: '×1,5 contra élites y jefes; +0,6 s de duración' }, { name: 'Nieve Vital', desc: 'Parte del daño te cura; +20% de área' }] }, '+3 de daño y +15% de área'],
      },
      electroweb: {
        description: 'Una tela eléctrica salta entre enemigos cercanos, ralentiza a cada uno y deja un hilo vivo bajo sus pies.',
        upgrades: ['+1 salto', '+3 de daño', { fork: [{ name: 'Cortocircuito', desc: 'Los enemigos derrotados explotan; 0,2 s menos de recarga' }, { name: 'Tela Larga', desc: '+1 salto y chispas extra; -1 de daño' }] }, '+3 de daño', '+1 salto', { fork: [{ name: 'Tela de Caza', desc: '×1,5 contra élites y jefes; +4 de daño' }, { name: 'Hilo Cruel', desc: '×1,35 contra enemigos afectados; +25% de área' }] }, '+1 salto y +3 de daño'],
      },
      corrosiveGas: {
        description: 'Una nube corrosiva sobre el grupo más denso envenena a quien la respire. Cuando cae un envenenado, el veneno salta a sus vecinos.',
        upgrades: ['+1 de daño', '+15% de área', { fork: [{ name: 'Gas Volátil', desc: 'Los enemigos derrotados explotan; +20% de daño de estado' }, { name: 'Rastro Ácido', desc: 'Deja suelo corrosivo; 0,3 s menos de recarga' }] }, '+2 de daño', '0,3 s menos de recarga', { fork: [{ name: 'Toxina Fina', desc: '×1,5 contra élites y jefes; +0,4 s de duración y +10% de daño de estado' }, { name: 'Remolino Tóxico', desc: 'La nube atrae enemigos; +20% de área' }] }, '+3 de daño y +15% de daño de estado'],
      },
      magicCoat: {
        description: 'Lanza un pulso psíquico y te cubre con un espejo breve (como mucho la mitad de su recarga) que devuelve los disparos enemigos.',
        upgrades: ['+3 de daño', '+0,2 s de espejo', { fork: [{ name: 'Espejo Roto', desc: 'Los enemigos derrotados explotan; +4 de daño' }, { name: 'Reflejo en Arco', desc: 'Saltan chispas del pulso; +20% de área' }] }, '0,4 s menos de recarga', '+4 de daño', { fork: [{ name: 'Mirada Fija', desc: '×1,5 contra élites y jefes; +0,2 s de espejo y +15% de área' }, { name: 'Maldad Reflejada', desc: '×1,35 contra enemigos afectados; +3 de daño y 0,3 s menos de recarga' }] }, '+5 de daño y +0,2 s de espejo'],
      },
      appleAcid: {
        description: 'Lanza manzanas a los enemigos más cercanos; el ácido debilita lo que salpica. Flapple pega más fuerte, Appletun salpica más lejos.',
        upgrades: ['+4 de daño', '+1 manzana', { fork: [{ name: 'Pulpa Ácida', desc: 'Deja suelo ácido; +15% de área' }, { name: 'Núcleo Explosivo', desc: 'Los enemigos derrotados explotan; +4 de daño' }] }, '0,25 s menos de recarga', '+5 de daño', { fork: [{ name: 'Segunda Cosecha', desc: 'Lanza otra vez enseguida; +1 manzana y -2 de daño' }, { name: 'Manzana Certera', desc: '×1,5 contra élites y jefes; +20% de probabilidad de efecto' }] }, '+1 manzana y +5 de daño'],
      },
      icicleSpear: {
        description: 'Un abanico de esquirlas heladas de dragón que frenan en el aire y ralentizan lo que cortan.',
        upgrades: ['+1 esquirla', '+3 de daño', { fork: [{ name: 'Astillas', desc: 'Los enemigos derrotados explotan; +3 de daño' }, { name: 'Abanico Partido', desc: '+2 esquirlas que se dividen; -2 de daño' }] }, '0,2 s menos de recarga', '+4 de daño', { fork: [{ name: 'Corte Cruel', desc: '×1,35 contra enemigos afectados; +2 de daño y +20% de probabilidad de efecto' }, { name: 'Arco Helado', desc: 'Saltan chispas a enemigos cercanos; +20% de área' }] }, '+2 esquirlas y +3 de daño'],
      },
      headSmash: {
        description: 'Una embestida con todo contra el enemigo más cercano. Acertar cuesta un poco de PS, nunca el último punto.',
        upgrades: ['+7 de daño', '+20% de área', { fork: [{ name: 'Cráneo Explosivo', desc: 'Los enemigos derrotados explotan; +8 de daño' }, { name: 'Rastro de Piedra', desc: 'Deja rocas en el camino; 0,4 s menos de recarga' }] }, '+8 de daño', '0,3 s menos de recarga', { fork: [{ name: 'Cráneo Cazador', desc: '×1,5 contra élites y jefes; +10 de daño' }, { name: 'Sacudida', desc: 'Saltan chispas alrededor; +20% de área y +4 de daño' }] }, '+12 de daño y +20% de área'],
      },
      ironDefense: {
        description: 'Un escudo que golpea a quien lo toca y anula el siguiente golpe (como mucho la mitad de su recarga), respondiendo con una onda. La armadura la hace más fuerte.',
        upgrades: ['+5 de daño', '+0,2 s de escudo', { fork: [{ name: 'Escudo Bomba', desc: 'Los enemigos derrotados explotan; +6 de daño' }, { name: 'Escudo Rápido', desc: 'Chispas en la onda; 0,5 s menos de recarga' }] }, '+6 de daño', '0,4 s menos de recarga', { fork: [{ name: 'Muralla Cazadora', desc: '×1,5 contra élites y jefes; +25% de área' }, { name: 'Muralla Vital', desc: 'Parte del daño te cura; +8 de daño' }] }, '+8 de daño y +0,2 s de escudo'],
      },
      dualWingbeat: {
        description: 'Dos aletazos rápidos al enemigo más cercano y un impulso de velocidad para escapar.',
        upgrades: ['+3 de daño', '0,08 s menos de recarga', { fork: [{ name: 'Ala Explosiva', desc: 'Los enemigos derrotados explotan; +2 de daño' }, { name: 'Tercer Ala', desc: '+1 aletazo con chispas; -2 de daño' }] }, '+3 de daño', '+20% de área', { fork: [{ name: 'Ala Cazadora', desc: '×1,5 contra élites y jefes; +3 de daño' }, { name: 'Doble Vuelo', desc: 'Repite enseguida; 0,1 s menos de recarga' }] }, '+5 de daño'],
      },
      bite: {
        description: 'Muerde al enemigo más cercano y lo marca; cada marca (hasta 3) hace más fuerte el siguiente mordisco sobre él.',
        upgrades: ['+3 de daño', '+20% de área', { fork: [{ name: 'Mandíbula Explosiva', desc: 'Los enemigos derrotados explotan; +3 de daño' }, { name: 'Drenaje', desc: 'Parte del daño te cura; 0,08 s menos de recarga' }] }, '+3 de daño', '0,08 s menos de recarga', { fork: [{ name: 'Olfato Cazador', desc: '×1,5 contra élites y jefes; +4 de daño' }, { name: 'Mordisco Cruel', desc: '×1,35 contra enemigos afectados; +25% de área' }] }, '+6 de daño'],
      },
      auroraVeil: {
        description: 'Un campo de aurora a tu alrededor que ralentiza lo que toca y a veces lo congela. Su tamaño tiene un límite.',
        upgrades: ['+2 de daño', '+12% de área', { fork: [{ name: 'Aurora Explosiva', desc: 'Los enemigos derrotados explotan; +2 de daño' }, { name: 'Aurora Atrayente', desc: 'El campo atrae enemigos; +0,4 s de duración' }] }, '+2 de daño', '0,4 s menos de recarga', { fork: [{ name: 'Aurora Cazadora', desc: '×1,5 contra élites y jefes; +8% de congelar' }, { name: 'Arco de Aurora', desc: 'Saltan chispas alrededor; +15% de área y +1 de daño' }] }, '+4 de daño y +0,3 s de duración'],
      },
      flareBlitz: {
        description: 'Quema a tu alrededor y, durante unos segundos, deja fuego donde pisas. Cuanto más rápido corres, más fuerte; quieto, apenas arde.',
        upgrades: ['+2 de daño', '+0,4 s de duración', { fork: [{ name: 'Crin Explosiva', desc: 'Los enemigos derrotados explotan; +15% de área y +1 de daño' }, { name: 'Chispa Suelta', desc: 'Las llamas saltan a enemigos cercanos; 0,3 s menos de recarga' }] }, '+3 de daño', '0,3 s menos de recarga', { fork: [{ name: 'Galope de Caza', desc: '×1,5 contra élites y jefes; +0,6 s de duración' }, { name: 'Cascos Crueles', desc: '×1,35 contra enemigos afectados; +20% de área' }] }, '+4 de daño y +15% de área'],
      },
      dazzlingGleam: {
        description: 'Un destello pastel a tu alrededor confunde a algunos enemigos, y parte del daño te cura.',
        upgrades: ['+3 de daño', '+15% de área', { fork: [{ name: 'Brillo Explosivo', desc: 'Los enemigos derrotados explotan; 0,3 s menos de recarga' }, { name: 'Cuerno Cazador', desc: '×1,5 contra élites y jefes; +3 de daño' }] }, '+4 de daño', '+15% de área', { fork: [{ name: 'Luz Cruel', desc: '×1,35 contra enemigos afectados; 0,4 s menos de recarga' }, { name: 'Arcoíris', desc: 'Saltan chispas del destello; +20% de área' }] }, '+5 de daño y +15% de área'],
      },
    },
    abilities: { pastelVeil: 'Recibes 60% menos de daño de Veneno y recuperas vida poco a poco.' },
  },
  fr: {
    blurbs: {
      snom: 'Laisse une traînée de poudreuse qui ralentit la horde.',
      joltik: 'Des toiles électriques qui sautent d’ennemi en ennemi.',
      salandit: 'Un poison qui se transmet quand sa victime tombe.',
      hatenna: 'Un miroir au bon moment renvoie les tirs ennemis.',
      applin: 'Des pommes acides et trois voies : Dipplin, Flapple ou Appletun.',
      frigibax: 'Des éventails d’éclats de glace draconiques, toujours plus larges.',
      cranidos: 'Des coups de tête à fond. La défense ? On verra.',
      shieldon: 'Lent, mais son bouclier rend les coups.',
      archen: 'Frappe, s’envole et revient. Rapide mais fragile.',
      tyrunt: 'Plus il mord la même cible, plus il mord fort.',
      amaura: 'Une large aurore qui glace tout autour.',
      ponyta: 'Plus il galope vite, plus il brûle. À l’arrêt, il couve à peine.',
      ponytaGalar: 'Un éclat pastel tout autour qui soigne un peu à chaque coup.',
    },
    moves: {
      powderSnow: {
        description: 'Souffle de la poudreuse et, quelques secondes, laisse une traînée derrière vous. Ce qui la traverse ralentit.',
        upgrades: ['+2 dégâts', '+0,4 s de durée', { fork: [{ name: 'Neige Lourde', desc: 'Les ennemis vaincus explosent ; +15 % de zone et +1 dégât' }, { name: 'Étincelle Froide', desc: 'La neige saute vers les ennemis proches ; recharge -0,3 s' }] }, '+2 dégâts', 'Recharge -0,3 s', { fork: [{ name: 'Rafale de Chasse', desc: '×1,5 sur les élites et les boss ; +0,6 s de durée' }, { name: 'Neige Vitale', desc: 'Une partie des dégâts vous soigne ; +20 % de zone' }] }, '+3 dégâts et +15 % de zone'],
      },
      electroweb: {
        description: 'Une toile électrique saute entre les ennemis proches, les ralentit et laisse un fil vivant sous leurs pieds.',
        upgrades: ['+1 saut', '+3 dégâts', { fork: [{ name: 'Court-Circuit', desc: 'Les ennemis vaincus explosent ; recharge -0,2 s' }, { name: 'Longue Toile', desc: '+1 saut et étincelles en plus ; -1 dégât' }] }, '+3 dégâts', '+1 saut', { fork: [{ name: 'Toile de Chasse', desc: '×1,5 sur les élites et les boss ; +4 dégâts' }, { name: 'Fil Cruel', desc: '×1,35 sur les ennemis affligés ; +25 % de zone' }] }, '+1 saut et +3 dégâts'],
      },
      corrosiveGas: {
        description: 'Un nuage corrosif sur le groupe le plus dense empoisonne ce qui le respire. Quand un ennemi empoisonné tombe, le poison saute sur ses voisins.',
        upgrades: ['+1 dégât', '+15 % de zone', { fork: [{ name: 'Gaz Volatil', desc: 'Les ennemis vaincus explosent ; +20 % de dégâts de statut' }, { name: 'Traînée Acide', desc: 'Laisse un sol corrosif ; recharge -0,3 s' }] }, '+2 dégâts', 'Recharge -0,3 s', { fork: [{ name: 'Toxine Fine', desc: '×1,5 sur les élites et les boss ; +0,4 s de durée et +10 % de dégâts de statut' }, { name: 'Tourbillon Toxique', desc: 'Le nuage attire les ennemis ; +20 % de zone' }] }, '+3 dégâts et +15 % de dégâts de statut'],
      },
      magicCoat: {
        description: 'Lance une onde psychique et vous couvre d’un bref miroir (au plus la moitié de sa recharge) qui renvoie les tirs ennemis.',
        upgrades: ['+3 dégâts', '+0,2 s de miroir', { fork: [{ name: 'Miroir Brisé', desc: 'Les ennemis vaincus explosent ; +4 dégâts' }, { name: 'Reflet en Arc', desc: 'Des étincelles jaillissent de l’onde ; +20 % de zone' }] }, 'Recharge -0,4 s', '+4 dégâts', { fork: [{ name: 'Regard Fixe', desc: '×1,5 sur les élites et les boss ; +0,2 s de miroir et +15 % de zone' }, { name: 'Malice Renvoyée', desc: '×1,35 sur les ennemis affligés ; +3 dégâts et recharge -0,3 s' }] }, '+5 dégâts et +0,2 s de miroir'],
      },
      appleAcid: {
        description: 'Lance des pommes sur les ennemis les plus proches ; l’acide affaiblit ce qu’il éclabousse. Flapple frappe plus fort, Appletun éclabousse plus large.',
        upgrades: ['+4 dégâts', '+1 pomme', { fork: [{ name: 'Pulpe Acide', desc: 'Laisse un sol acide ; +15 % de zone' }, { name: 'Trognon Explosif', desc: 'Les ennemis vaincus explosent ; +4 dégâts' }] }, 'Recharge -0,25 s', '+5 dégâts', { fork: [{ name: 'Seconde Récolte', desc: 'Relance juste après ; +1 pomme et -2 dégâts' }, { name: 'Pomme Sûre', desc: '×1,5 sur les élites et les boss ; +20 % de chance d’effet' }] }, '+1 pomme et +5 dégâts'],
      },
      icicleSpear: {
        description: 'Un éventail d’éclats de glace draconiques qui freinent en l’air et ralentissent ce qu’ils coupent.',
        upgrades: ['+1 éclat', '+3 dégâts', { fork: [{ name: 'Échardes', desc: 'Les ennemis vaincus explosent ; +3 dégâts' }, { name: 'Éventail Brisé', desc: '+2 éclats qui se divisent ; -2 dégâts' }] }, 'Recharge -0,2 s', '+4 dégâts', { fork: [{ name: 'Coupe Cruelle', desc: '×1,35 sur les ennemis affligés ; +2 dégâts et +20 % de chance d’effet' }, { name: 'Arc de Givre', desc: 'Des étincelles sautent vers les ennemis proches ; +20 % de zone' }] }, '+2 éclats et +3 dégâts'],
      },
      headSmash: {
        description: 'Une charge à fond sur l’ennemi le plus proche. La réussir coûte un peu de PV, jamais le dernier.',
        upgrades: ['+7 dégâts', '+20 % de zone', { fork: [{ name: 'Crâne Explosif', desc: 'Les ennemis vaincus explosent ; +8 dégâts' }, { name: 'Traînée de Pierre', desc: 'Laisse des rochers derrière ; recharge -0,4 s' }] }, '+8 dégâts', 'Recharge -0,3 s', { fork: [{ name: 'Crâne Chasseur', desc: '×1,5 sur les élites et les boss ; +10 dégâts' }, { name: 'Onde de Choc', desc: 'Des étincelles sautent autour ; +20 % de zone et +4 dégâts' }] }, '+12 dégâts et +20 % de zone'],
      },
      ironDefense: {
        description: 'Un bouclier qui frappe ce qui le touche et annule le prochain coup (au plus la moitié de sa recharge), en répondant par une onde. L’armure la renforce.',
        upgrades: ['+5 dégâts', '+0,2 s de bouclier', { fork: [{ name: 'Bouclier Bombe', desc: 'Les ennemis vaincus explosent ; +6 dégâts' }, { name: 'Bouclier Vif', desc: 'Des étincelles sur l’onde ; recharge -0,5 s' }] }, '+6 dégâts', 'Recharge -0,4 s', { fork: [{ name: 'Rempart Chasseur', desc: '×1,5 sur les élites et les boss ; +25 % de zone' }, { name: 'Rempart Vital', desc: 'Une partie des dégâts vous soigne ; +8 dégâts' }] }, '+8 dégâts et +0,2 s de bouclier'],
      },
      dualWingbeat: {
        description: 'Deux coups d’aile rapides sur l’ennemi le plus proche, puis un élan de vitesse pour s’échapper.',
        upgrades: ['+3 dégâts', 'Recharge -0,08 s', { fork: [{ name: 'Aile Explosive', desc: 'Les ennemis vaincus explosent ; +2 dégâts' }, { name: 'Troisième Aile', desc: '+1 coup avec étincelles ; -2 dégâts' }] }, '+3 dégâts', '+20 % de zone', { fork: [{ name: 'Aile Chasseuse', desc: '×1,5 sur les élites et les boss ; +3 dégâts' }, { name: 'Double Vol', desc: 'Recommence aussitôt ; recharge -0,1 s' }] }, '+5 dégâts'],
      },
      bite: {
        description: 'Mord l’ennemi le plus proche et le marque ; chaque marque (jusqu’à 3) rend la morsure suivante plus forte sur lui.',
        upgrades: ['+3 dégâts', '+20 % de zone', { fork: [{ name: 'Mâchoire Explosive', desc: 'Les ennemis vaincus explosent ; +3 dégâts' }, { name: 'Drain', desc: 'Une partie des dégâts vous soigne ; recharge -0,08 s' }] }, '+3 dégâts', 'Recharge -0,08 s', { fork: [{ name: 'Flair de Chasse', desc: '×1,5 sur les élites et les boss ; +4 dégâts' }, { name: 'Morsure Cruelle', desc: '×1,35 sur les ennemis affligés ; +25 % de zone' }] }, '+6 dégâts'],
      },
      auroraVeil: {
        description: 'Un champ d’aurore autour de vous qui ralentit ce qu’il touche et parfois le gèle. Sa taille a une limite.',
        upgrades: ['+2 dégâts', '+12 % de zone', { fork: [{ name: 'Aurore Explosive', desc: 'Les ennemis vaincus explosent ; +2 dégâts' }, { name: 'Aurore Attirante', desc: 'Le champ attire les ennemis ; +0,4 s de durée' }] }, '+2 dégâts', 'Recharge -0,4 s', { fork: [{ name: 'Aurore Chasseuse', desc: '×1,5 sur les élites et les boss ; +8 % de gel' }, { name: 'Arc d’Aurore', desc: 'Des étincelles sautent autour ; +15 % de zone et +1 dégât' }] }, '+4 dégâts et +0,3 s de durée'],
      },
      flareBlitz: {
        description: 'Brûle autour de vous et, pendant quelques secondes, laisse du feu sous vos pas. Plus vous courez vite, plus c’est fort ; à l’arrêt, ça couve à peine.',
        upgrades: ['+2 dégâts', '+0,4 s de durée', { fork: [{ name: 'Crinière Explosive', desc: 'Les ennemis vaincus explosent ; +15 % de zone et +1 dégât' }, { name: 'Flammèches', desc: 'Les flammes sautent vers les ennemis proches ; recharge -0,3 s' }] }, '+3 dégâts', 'Recharge -0,3 s', { fork: [{ name: 'Galop de Chasse', desc: '×1,5 sur les élites et les boss ; +0,6 s de durée' }, { name: 'Sabots Cruels', desc: '×1,35 sur les ennemis affligés ; +20 % de zone' }] }, '+4 dégâts et +15 % de zone'],
      },
      dazzlingGleam: {
        description: 'Un éclat pastel autour de vous déroute certains ennemis, et une partie des dégâts vous soigne.',
        upgrades: ['+3 dégâts', '+15 % de zone', { fork: [{ name: 'Éclat Explosif', desc: 'Les ennemis vaincus explosent ; recharge -0,3 s' }, { name: 'Corne de Chasse', desc: '×1,5 sur les élites et les boss ; +3 dégâts' }] }, '+4 dégâts', '+15 % de zone', { fork: [{ name: 'Lumière Cruelle', desc: '×1,35 sur les ennemis affligés ; recharge -0,4 s' }, { name: 'Arc-en-Ciel', desc: 'Des étincelles jaillissent de l’éclat ; +20 % de zone' }] }, '+5 dégâts et +15 % de zone'],
      },
    },
    abilities: { pastelVeil: 'Tu subis 60% de dégâts Poison en moins et récupères lentement des PV.' },
  },
  zh: {
    blurbs: {
      snom: '留下粉雪軌跡，拖慢敵群。',
      joltik: '在敵人之間跳躍的電網。',
      salandit: '目標倒下時，毒素會傳染下去。',
      hatenna: '抓準時機的鏡子能把敵彈送回去。',
      applin: '酸蘋果與三條路線：Dipplin、Flapple 或 Appletun。',
      frigibax: '越來越寬的冰龍碎片扇形彈幕。',
      cranidos: '全力頭錘。防禦？之後再說。',
      shieldon: '行動緩慢，但盾牌會反擊。',
      archen: '攻擊、飛走、再回來。速度快但脆弱。',
      tyrunt: '咬同一目標越久，咬得越重。',
      amaura: '廣闊的極光讓周圍一切結凍。',
      ponyta: '跑得越快燒得越旺，停下來幾乎不燃燒。',
      ponytaGalar: '四周綻放柔和閃光，每次命中都恢復少許體力。',
    },
    moves: {
      powderSnow: {
        description: '噴出粉雪，並在數秒內於身後留下軌跡。踏上軌跡的敵人會減速。',
        upgrades: ['傷害 +2', '持續 +0.4 秒', { fork: [{ name: '厚雪', desc: '被擊敗的敵人爆炸；範圍 +15%、傷害 +1' }, { name: '寒冷火花', desc: '雪跳向附近敵人；冷卻 -0.3 秒' }] }, '傷害 +2', '冷卻 -0.3 秒', { fork: [{ name: '獵殺暴雪', desc: '對精英與頭目 ×1.5；持續 +0.6 秒' }, { name: '生命之雪', desc: '部分傷害治療自己；範圍 +20%' }] }, '傷害 +3、範圍 +15%'],
      },
      electroweb: {
        description: '電網在附近敵人間跳躍，使其減速，並在腳下留下帶電的絲線。',
        upgrades: ['跳躍 +1', '傷害 +3', { fork: [{ name: '短路', desc: '被擊敗的敵人爆炸；冷卻 -0.2 秒' }, { name: '長網', desc: '跳躍 +1 並產生火花；傷害 -1' }] }, '傷害 +3', '跳躍 +1', { fork: [{ name: '獵網', desc: '對精英與頭目 ×1.5；傷害 +4' }, { name: '殘酷之絲', desc: '對異常狀態敵人 ×1.4；範圍 +25%' }] }, '跳躍 +1、傷害 +3'],
      },
      corrosiveGas: {
        description: '在最密集的敵群上放出腐蝕毒雲，吸入者中毒。中毒的敵人倒下時，毒素會跳到鄰近敵人身上。',
        upgrades: ['傷害 +1', '範圍 +15%', { fork: [{ name: '揮發毒氣', desc: '被擊敗的敵人爆炸；狀態傷害 +20%' }, { name: '酸蝕軌跡', desc: '留下腐蝕地面；冷卻 -0.3 秒' }] }, '傷害 +2', '冷卻 -0.3 秒', { fork: [{ name: '精煉毒素', desc: '對精英與頭目 ×1.5；持續 +0.4 秒、狀態傷害 +10%' }, { name: '劇毒漩渦', desc: '毒雲吸引敵人；範圍 +20%' }] }, '傷害 +3、狀態傷害 +15%'],
      },
      magicCoat: {
        description: '放出超能脈衝，並以短暫的鏡面包覆自己（最多為冷卻的一半），將敵方射擊送回去。',
        upgrades: ['傷害 +3', '鏡面 +0.2 秒', { fork: [{ name: '碎鏡', desc: '被擊敗的敵人爆炸；傷害 +4' }, { name: '弧光反射', desc: '脈衝迸出火花；範圍 +20%' }] }, '冷卻 -0.4 秒', '傷害 +4', { fork: [{ name: '凝視', desc: '對精英與頭目 ×1.5；鏡面 +0.2 秒、範圍 +15%' }, { name: '惡意反射', desc: '對異常狀態敵人 ×1.4；傷害 +3、冷卻 -0.3 秒' }] }, '傷害 +5、鏡面 +0.2 秒'],
      },
      appleAcid: {
        description: '向最近的敵人拋出蘋果，酸液會削弱被濺到的目標。Flapple 打得更重，Appletun 濺得更廣。',
        upgrades: ['傷害 +4', '蘋果 +1', { fork: [{ name: '酸果泥', desc: '留下酸性地面；範圍 +15%' }, { name: '爆裂果核', desc: '被擊敗的敵人爆炸；傷害 +4' }] }, '冷卻 -0.25 秒', '傷害 +5', { fork: [{ name: '二次收成', desc: '隨即再投一次；蘋果 +1、傷害 -2' }, { name: '精準蘋果', desc: '對精英與頭目 ×1.5；效果機率 +20%' }] }, '蘋果 +1、傷害 +5'],
      },
      icicleSpear: {
        description: '扇形射出冰龍碎片，碎片在空中減速，並使被切到的敵人減速。',
        upgrades: ['碎片 +1', '傷害 +3', { fork: [{ name: '碎屑', desc: '被擊敗的敵人爆炸；傷害 +3' }, { name: '破碎之扇', desc: '碎片 +2 並會分裂；傷害 -2' }] }, '冷卻 -0.2 秒', '傷害 +4', { fork: [{ name: '殘酷之斬', desc: '對異常狀態敵人 ×1.4；傷害 +2、效果機率 +20%' }, { name: '霜弧', desc: '火花跳向附近敵人；範圍 +20%' }] }, '碎片 +2、傷害 +3'],
      },
      headSmash: {
        description: '全力衝撞最近的敵人。命中會消耗少量 HP，但絕不會耗盡最後一點。',
        upgrades: ['傷害 +7', '範圍 +20%', { fork: [{ name: '爆裂頭骨', desc: '被擊敗的敵人爆炸；傷害 +8' }, { name: '岩石軌跡', desc: '路徑留下岩石；冷卻 -0.4 秒' }] }, '傷害 +8', '冷卻 -0.3 秒', { fork: [{ name: '獵殺頭骨', desc: '對精英與頭目 ×1.5；傷害 +10' }, { name: '震波', desc: '四周迸出火花；範圍 +20%、傷害 +4' }] }, '傷害 +12、範圍 +20%'],
      },
      ironDefense: {
        description: '盾牌撞擊接觸者，並抵銷下一次攻擊（最多為冷卻的一半），以衝擊波回敬。護甲越高，回敬越強。',
        upgrades: ['傷害 +5', '護盾 +0.2 秒', { fork: [{ name: '爆炸護盾', desc: '被擊敗的敵人爆炸；傷害 +6' }, { name: '迅捷護盾', desc: '衝擊波帶火花；冷卻 -0.5 秒' }] }, '傷害 +6', '冷卻 -0.4 秒', { fork: [{ name: '獵殺之牆', desc: '對精英與頭目 ×1.5；範圍 +25%' }, { name: '生命之牆', desc: '部分傷害治療自己；傷害 +8' }] }, '傷害 +8、護盾 +0.2 秒'],
      },
      dualWingbeat: {
        description: '對最近的敵人快速揮翼兩次，接著爆發速度脫離。',
        upgrades: ['傷害 +3', '冷卻 -0.08 秒', { fork: [{ name: '爆裂之翼', desc: '被擊敗的敵人爆炸；傷害 +2' }, { name: '第三翼', desc: '揮擊 +1 並帶火花；傷害 -2' }] }, '傷害 +3', '範圍 +20%', { fork: [{ name: '獵殺之翼', desc: '對精英與頭目 ×1.5；傷害 +3' }, { name: '雙重飛行', desc: '隨即再次攻擊；冷卻 -0.1 秒' }] }, '傷害 +5'],
      },
      bite: {
        description: '咬住最近的敵人並留下印記；每個印記（最多 3 個）都會讓下一次咬擊更重。',
        upgrades: ['傷害 +3', '範圍 +20%', { fork: [{ name: '爆裂下顎', desc: '被擊敗的敵人爆炸；傷害 +3' }, { name: '吸取', desc: '部分傷害治療自己；冷卻 -0.08 秒' }] }, '傷害 +3', '冷卻 -0.08 秒', { fork: [{ name: '獵殺嗅覺', desc: '對精英與頭目 ×1.5；傷害 +4' }, { name: '殘酷咬擊', desc: '對異常狀態敵人 ×1.4；範圍 +25%' }] }, '傷害 +6'],
      },
      auroraVeil: {
        description: '在周圍展開極光場，使接觸者減速，有時使其冰凍。範圍有上限。',
        upgrades: ['傷害 +2', '範圍 +12%', { fork: [{ name: '爆裂極光', desc: '被擊敗的敵人爆炸；傷害 +2' }, { name: '牽引極光', desc: '光場吸引敵人；持續 +0.4 秒' }] }, '傷害 +2', '冷卻 -0.4 秒', { fork: [{ name: '獵殺極光', desc: '對精英與頭目 ×1.5；冰凍機率 +8%' }, { name: '極光弧', desc: '四周迸出火花；範圍 +15%、傷害 +1' }] }, '傷害 +4、持續 +0.3 秒'],
      },
      flareBlitz: {
        description: '灼燒周圍，並在數秒內於腳下留下火焰。跑得越快威力越強；停下來幾乎不燃燒。',
        upgrades: ['傷害 +2', '持續 +0.4 秒', { fork: [{ name: '爆裂鬃毛', desc: '被擊敗的敵人爆炸；範圍 +15%、傷害 +1' }, { name: '飛散火花', desc: '火焰跳向附近敵人；冷卻 -0.3 秒' }] }, '傷害 +3', '冷卻 -0.3 秒', { fork: [{ name: '獵殺奔馳', desc: '對精英與頭目 ×1.5；持續 +0.6 秒' }, { name: '殘酷馬蹄', desc: '對異常狀態敵人 ×1.4；範圍 +20%' }] }, '傷害 +4、範圍 +15%'],
      },
      dazzlingGleam: {
        description: '在周圍綻放柔和閃光，使部分敵人混亂，部分傷害治療自己。',
        upgrades: ['傷害 +3', '範圍 +15%', { fork: [{ name: '爆裂光芒', desc: '被擊敗的敵人爆炸；冷卻 -0.3 秒' }, { name: '獵殺之角', desc: '對精英與頭目 ×1.5；傷害 +3' }] }, '傷害 +4', '範圍 +15%', { fork: [{ name: '殘酷之光', desc: '對異常狀態敵人 ×1.4；冷卻 -0.4 秒' }, { name: '彩虹', desc: '閃光迸出火花；範圍 +20%' }] }, '傷害 +5、範圍 +15%'],
      },
    },
    abilities: { pastelVeil: '受到的毒屬性傷害減少60%，並緩慢恢復HP。' },
  },
}
