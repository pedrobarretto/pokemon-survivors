# Contributing

Thanks for wanting to help! Pokémon Survivors is a hobby project, so the best contributions are small, focused and easy to review.

## Issues

- **Bugs:** use the bug report template. Include your device and browser, and steps to reproduce. A screenshot or clip helps a lot.
- **Ideas:** use the feature request template. Check the [Roadmap](README.md#roadmap) and open issues first to avoid duplicates.
- Issues can be written in English or Portuguese.

## Pull requests

1. For anything bigger than a bug fix, open an issue first so we can agree on the approach.
2. Fork the repo and create a branch from `main`.
3. `npm install`, then `npm run dev`.
4. Before opening the PR, make sure `npm test` and `npm run build` pass. CI runs both.
5. Add screenshots or a short clip for anything visual, including how it looks on a phone.

## Code conventions

- **Functional TypeScript.** Plain data (types/records) and functions. No classes or `this`, and never `any`. Prefer inferred types and `as const satisfies` data tables. Content is data-driven (`src/data/*`, `MOVES` in `src/game/moves.ts`).
- **Simulation is separate from presentation.** `src/game/*` must not touch the DOM or audio. Push a `GameEvent` and let `main.ts` handle sounds and UI.
- **Keep hot loops allocation-light.** The simulation mutates plain state for hundreds of entities at 60 Hz.
- **Pixel-perfect rendering.** Snap draw positions to whole pixels and use the helpers in `src/engine/pixelart.ts`.
- **UI text lives in `src/i18n`, in Brazilian Portuguese, English, Spanish and Turkish.** `pt.ts` is the reference and `en.ts`, `es.ts` and `tr.ts` must match it (the type checker enforces it). Pokémon, move and item names stay in English (official names).
- **Mobile matters.** Every UI must work with touch and on small portrait and landscape screens.
- **Tests:** focused vitest tests (`*.test.ts`) for pure rules only. No snapshot or smoke tests.
- **Comments:** short doc comments above non-obvious functions.

## Assets

Pokémon sprites come from [PMD SpriteCollab](https://sprites.pmdcollab.org). To add a species, add its dex number to `scripts/dex.mjs` and run `npm run assets`, then `npm run credits`. Don't add official artwork ripped from other games, or any asset whose license doesn't allow non-commercial redistribution.

## License

By contributing, you agree that your code is released under the [MIT license](LICENSE).
