/**
 * The training run's words (`game/tutorial.ts`, `ui/tutorialCoach.ts`): Rotom's lines step by step and the coach's buttons, a table per language (`pt` is the reference). Pokémon names stay in English.
 */
type Words = {
  /** The coach's skip button, and its accessible name. */
  skip: string
  skipLabel: string
  /** The first lesson, by the input at hand (`keys`: the bound movement keys, as `WASD`). */
  moveKeys: (keys: string) => string
  moveTouch: string
  movePad: string
  fight: string
  /** Said once, on the first hit taken. */
  hurt: string
  xp: string
  /** Over the first level-up's cards, then over the next ones. */
  pick: string
  pickAgain: string
  wave: string
  ball: string
  /** Over the Poké Ball's Take / Leave: take it. */
  ballPick: string
  boss: string
  end: string
  /** The last line's button: on to what comes next. */
  go: string
}

export const TUTORIAL_WORDS: Record<'pt' | 'en' | 'es' | 'fr' | 'zh', Words> = {
  pt: {
    skip: 'Pular',
    skipLabel: 'Pular o tutorial',
    moveKeys: (keys) => `Primeiro, mexa-se! Use ${keys} ou as setas.`,
    moveTouch: 'Primeiro, mexa-se! Arraste o dedo na tela.',
    movePad: 'Primeiro, mexa-se! Use o analógico esquerdo.',
    fight: 'Só chegue perto: seus golpes saem sozinhos!',
    hurt: 'Ai! Não deixe encostarem em você: de olho no seu HP.',
    xp: 'Eles deixaram EXP. Vai lá pegar!',
    pick: 'Subiu de nível! Escolha uma carta: um golpe novo, ou +1 nível num que você já tem.',
    pickAgain: 'Outro nível! Escolha o que te deixa mais forte.',
    wave: 'Lá vem uma horda! Agora você está mais forte.',
    ball: 'Uma Poké Ball! Pegue: ela traz um golpe ou um item.',
    ballPick: 'Fique com ele: mais golpes, mais poder!',
    boss: 'Um Alfa! Saia da linha vermelha e zere a barra de HP dele.',
    end: 'Mandou bem! Numa partida de verdade, sobreviva ao relógio: chefes aparecem e você evolui.',
    go: 'Bora jogar!',
  },
  en: {
    skip: 'Skip',
    skipLabel: 'Skip the tutorial',
    moveKeys: (keys) => `First, move! Use ${keys} or the arrow keys.`,
    moveTouch: 'First, move! Drag your finger on the screen.',
    movePad: 'First, move! Use the left stick.',
    fight: 'Just get close: your moves fire on their own!',
    hurt: "Ouch! Don't let them touch you: watch your HP.",
    xp: 'They dropped EXP. Go grab it!',
    pick: 'Level up! Pick a card: a new move, or +1 level for one you have.',
    pickAgain: 'Another level! Pick whatever makes you stronger.',
    wave: "Here comes a horde! You're stronger now.",
    ball: 'A Poké Ball! Grab it: it holds a move or an item.',
    ballPick: 'Take it: more moves, more power!',
    boss: 'An Alpha! Step off its red line and empty its HP bar.',
    end: 'Nice! In a real run, survive the clock: bosses show up and you evolve.',
    go: "Let's play!",
  },
  es: {
    skip: 'Saltar',
    skipLabel: 'Saltar el tutorial',
    moveKeys: (keys) => `¡Primero, muévete! Usa ${keys} o las flechas.`,
    moveTouch: '¡Primero, muévete! Desliza el dedo por la pantalla.',
    movePad: '¡Primero, muévete! Usa el stick izquierdo.',
    fight: '¡Solo acércate: tus movimientos salen solos!',
    hurt: '¡Auch! No dejes que te toquen: cuida tu HP.',
    xp: 'Soltaron EXP. ¡Ve por ella!',
    pick: '¡Subiste de nivel! Elige una carta: un movimiento nuevo, o +1 nivel para uno que ya tienes.',
    pickAgain: '¡Otro nivel! Elige lo que te haga más fuerte.',
    wave: '¡Ahí viene una horda! Ahora eres más fuerte.',
    ball: '¡Una Poké Ball! Tómala: trae un movimiento o un objeto.',
    ballPick: '¡Tómalo: más movimientos, más poder!',
    boss: '¡Un Alfa! Sal de su línea roja y vacía su barra de HP.',
    end: '¡Bien hecho! En una partida de verdad, sobrevive al reloj: llegan jefes y evolucionas.',
    go: '¡A jugar!',
  },
  fr: {
    skip: 'Passer',
    skipLabel: 'Passer le tutoriel',
    moveKeys: (keys) => `D'abord, bouge ! Utilise ${keys} ou les flèches.`,
    moveTouch: "D'abord, bouge ! Glisse ton doigt sur l'écran.",
    movePad: "D'abord, bouge ! Utilise le stick gauche.",
    fight: 'Approche-toi : tes attaques partent toutes seules !',
    hurt: 'Aïe ! Ne les laisse pas te toucher : surveille tes PV.',
    xp: "Ils ont laissé de l'EXP. Va la ramasser !",
    pick: 'Niveau supérieur ! Choisis une carte : une nouvelle attaque, ou +1 niveau pour une que tu as.',
    pickAgain: 'Encore un niveau ! Prends ce qui te rend plus fort.',
    wave: 'Voilà une horde ! Tu es plus fort maintenant.',
    ball: 'Une Poké Ball ! Prends-la : elle contient une attaque ou un objet.',
    ballPick: "Prends-le : plus d'attaques, plus de puissance !",
    boss: 'Un Alpha ! Sors de sa ligne rouge et vide sa barre de PV.',
    end: 'Bravo ! Dans une vraie partie, survis au chrono : des boss arrivent et tu évolues.',
    go: 'On joue !',
  },
  zh: {
    skip: '跳過',
    skipLabel: '跳過教學',
    moveKeys: (keys) => `先動起來！用 ${keys} 或方向鍵移動。`,
    moveTouch: '先動起來！在螢幕上拖曳手指。',
    movePad: '先動起來！用左搖桿移動。',
    fight: '靠近就好：招式會自己放出來！',
    hurt: '好痛！別讓牠們碰到你：注意你的 HP。',
    xp: '牠們掉了經驗值，快去撿！',
    pick: '升級了！選一張卡：學新招式，或讓已有的招式 +1 級。',
    pickAgain: '又升級了！選能讓你變更強的。',
    wave: '一大群來了！你現在更強了。',
    ball: '精靈球！撿起來：裡面有招式或道具。',
    ballPick: '收下吧：招式越多，力量越強！',
    boss: '頭目寶可夢！離開牠的紅線，把牠的 HP 條打空。',
    end: '做得好！正式遊玩時要撐過時間：頭目會出現，你也會進化。',
    go: '開始玩吧！',
  },
}
