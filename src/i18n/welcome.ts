/**
 * The first visit's welcome and first partner pick (`ui/welcome.ts`, `ui/firstPartner.ts`), Rotom's lines and the Settings' "see the tutorial again", a table per language (`pt` is the reference). Pokémon names stay in English.
 */
type Words = {
  /** Rotom's welcome, a line at a time (2 or 3, short). */
  lines: readonly string[]
  /** The welcome's buttons: the training run, or straight to the partner pick. */
  show: string
  knows: string
  /** The first partner pick: its title, Rotom's line (after the training run, or without it), the start button and the hint under it. */
  pickTitle: string
  pickAfterTutorial: string
  pickLine: string
  go: (name: string) => string
  pickHintKeys: string
  pickHintTouch: string
  /** Settings (Jogo): replays the training run, then the lobby tour. */
  replay: string
}

export const WELCOME_WORDS: Record<'pt' | 'en' | 'es' | 'fr' | 'zh', Words> = {
  pt: {
    lines: ['Bzzt! Oi, eu sou o Rotom! Primeira vez por aqui?', 'Aqui você sobrevive a hordas de Pokémon. Te mostro como em 2 minutinhos!'],
    show: 'Me mostra!',
    knows: 'Já sei jogar',
    pickTitle: 'Escolha seu parceiro',
    pickAfterTutorial: 'Mandou bem! Agora escolha quem vai com você de verdade.',
    pickLine: 'Então escolha quem vai com você! Dá pra trocar depois.',
    go: (name) => `Ir com ${name}!`,
    pickHintKeys: '← → ↑ ↓ escolher · 1-9 região · ENTER começar',
    pickHintTouch: 'Toque num Pokémon, depois em Ir',
    replay: 'Rever tutorial',
  },
  en: {
    lines: ['Bzzt! Hi, I’m Rotom! First time here?', 'Here you survive hordes of Pokémon. I’ll show you how in 2 minutes!'],
    show: 'Show me!',
    knows: 'I know how to play',
    pickTitle: 'Choose your partner',
    pickAfterTutorial: 'Nice moves! Now pick who goes with you for real.',
    pickLine: 'Then pick who goes with you! You can switch later.',
    go: (name) => `Go with ${name}!`,
    pickHintKeys: '← → ↑ ↓ choose · 1-9 region · ENTER start',
    pickHintTouch: 'Tap a Pokémon, then Go',
    replay: 'See the tutorial again',
  },
  es: {
    lines: ['¡Bzzt! ¡Hola, soy Rotom! ¿Primera vez por aquí?', 'Aquí sobrevives a hordas de Pokémon. ¡Te enseño en 2 minutitos!'],
    show: '¡Muéstrame!',
    knows: 'Ya sé jugar',
    pickTitle: 'Elige a tu compañero',
    pickAfterTutorial: '¡Bien hecho! Ahora elige quién va contigo de verdad.',
    pickLine: '¡Entonces elige quién va contigo! Puedes cambiarlo después.',
    go: (name) => `¡Ir con ${name}!`,
    pickHintKeys: '← → ↑ ↓ elegir · 1-9 región · ENTER empezar',
    pickHintTouch: 'Toca un Pokémon y luego Ir',
    replay: 'Ver el tutorial otra vez',
  },
  fr: {
    lines: ['Bzzt ! Salut, moi c’est Rotom ! C’est ta première fois ?', 'Ici, tu survis à des hordes de Pokémon. Je te montre en 2 minutes !'],
    show: 'Montre-moi !',
    knows: 'Je sais jouer',
    pickTitle: 'Choisis ton partenaire',
    pickAfterTutorial: 'Bien joué ! Maintenant, choisis qui t’accompagne pour de vrai.',
    pickLine: 'Alors choisis qui t’accompagne ! Tu pourras changer plus tard.',
    go: (name) => `Avec ${name} !`,
    pickHintKeys: '← → ↑ ↓ choisir · 1-9 région · ENTRÉE commencer',
    pickHintTouch: 'Touche un Pokémon, puis le bouton',
    replay: 'Revoir le tutoriel',
  },
  zh: {
    lines: ['嗶嗞！你好，我是 Rotom！第一次來嗎？', '在這裡你要在寶可夢大軍中生存下來。我花 2 分鐘教你！'],
    show: '教我吧！',
    knows: '我會玩了',
    pickTitle: '選擇你的夥伴',
    pickAfterTutorial: '做得好！現在正式選一位夥伴和你同行吧。',
    pickLine: '那就選一位夥伴和你同行吧！之後還可以換。',
    go: (name) => `和${name}出發！`,
    pickHintKeys: '← → ↑ ↓ 選擇 · 1-9 地區 · ENTER 開始',
    pickHintTouch: '點選寶可夢，再按出發',
    replay: '重看教學',
  },
}
