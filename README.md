# WAV-17: evidências (fora do commit)

- `comparison.html` / `comparison.png`: gráficos e tabelas, antes × depois.
- `comparison.md`: as mesmas tabelas em texto (pico por minuto de canvas, canvases, PSS do renderer, `<img>` vivas).
- `before/`, `after/`: `samples.json` (uma amostra a cada 15 s de jogo), `measure.log`, prints da partida (`c<segundo>.png`).
- `after/after-run-20min.webm`: a partida longa inteira gravada (6,6 min reais, relógio 3×, até a vitória sobre Mewtwo, sem fechar); `after/after-run-last-75s.webm` o trecho final.
- `after-wearable-tophat.png`: acessório (Cartola) vestido com as folhas em ImageBitmap.
- `memdump/before-6min.json`, `memdump/after-6min.json`: dumps memory-infra do Chromium (por alocador) aos 0:30, 1:00 … 6:00.
- `scripts/`: os scripts Playwright usados (`measure.mjs`, `memdump.mjs`, `listeners.mjs`, `report.mjs`).

## Como foi medido

Chromium headless (Playwright 1.64), emulação Pixel 7. O relógio do jogo foi acelerado 3× multiplicando os
timestamps de `requestAnimationFrame` e `performance.now` (nenhuma mudança no jogo). Bot: HP cheio e i-frames a
cada 150 ms, Enter nas telas de escolha, anda em retas longas. Atalhos de dev usados: `ps.startRun('charmander')`,
`ps.rift('kyogre'|'lugia'|'palkia')` aos 6:00/10:00/13:00 (relógio), `ps.riftAct('battle', 2)` +25 s e
`ps.riftAct('capture')` +50 s, `ps.biome('cave'|'snow'|'tower'|'desert')`, `ps.canvases()`, `ps.sprites()`.
Chefes e anéis vêm das ondas normais (2:30, 4:00, 4:30, 5:00, 7:00, 8:00, 9:30, 11:00, 12:00, Mewtwo 15:00).
Antes = HEAD 995c13d servido de uma cópia isolada (porta 5176); depois = esta branch (porta 5175).
Cada amostra força GC antes de medir. PSS = `/proc/<pid>/smaps_rollup` do processo renderer.
