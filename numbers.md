# WAV-142: cura por drain, antes × depois

Squirtle (HP máx. 120), regen zerado, inimigos com HP infinito e dano 0, HP do jogador recolocado em 50% a cada frame.
Navegador: `npm run dev` (depois, porta 5176) × cópia de HEAD 995c13d1 (antes, porta 5177), 6 s por linha, Drain Punch (35%).

## Navegador (Drain Punch)

| Caso | Antes: HP/acerto | Antes: HP/s | Depois: HP/acerto | Depois: HP/s | "+N" na tela (depois) |
|---|---|---|---|---|---|
| Lv1, Might ×0.5, 1 alvo (dano ~15) | 4.3 | 5.1 | 4.9–5.25 | 5.1 | +5 |
| Lv1, Might ×1, 1 alvo (dano ~29) | 4.3 | 4.7 | 9.5–10.9 | 11.8 | +10, +11 |
| Lv5 (fork Flurry), 1 alvo | 0.3–3 (média 1.0) | 5.3 | 0.8–6.8 (média 2.5) | 12.9 (teto) | +4 … +11 |
| Lv1, horda de 10 | 4.3 | 4.4 | 10.6–10.8 | 10.9 | +10, +11 |
| Lv8 + Might ×2, horda de 10 | 0.2–3.2 (média 0.9) | 5.3 | 0.8–8 (média 2.3) | 13.1 (teto) | +4 … +12 |

Antes, Might ×0.5 e ×1 curam o mesmo (~4.3 HP, o orçamento único de 4% de 120 HP/s). Depois, a cura dobra com o dano (5 → 10).

## Simulação (vitest, `before.json`/`after.json`), 6 s

| Caso | Antes HP/s | Depois HP/s |
|---|---|---|
| Drain Punch Lv1, chefe (Snorlax boss) | 4.3 | 12.4 |
| Drain Punch Lv8 + Might ×2, chefe | 4.6 | 13.8 (teto 12/s + o primeiro acerto com o orçamento cheio) |
| Drain Punch Lv1, horda de 10 | 4.3 | 12.8 |
| Drain Punch Lv8 + Might ×2, horda de 10 | 4.7 | 13.8 |
| Giga Drain Lv1, horda de 10 | 4.7 | 13.7 |
| Bitter Blade Lv1, chefe | 2.4 (4.8/acerto) | 5.0 (7–8/acerto, sem teto) |
| Drain Punch + Giga Drain, horda de 10 | 4.7 (dividido) | 26.4 (somam, cada um no teto) |
| Drain Punch Lv1, chefe, Pesadelo | 2.2 | 6.1 (metade) |
| Drain Punch Lv8 + Might ×2, chefe, Pesadelo | 2.4 | 7.0 (metade) |

Arquivos: `after-plusN-drainPunch-lv1.png` (o "+11" verde sobre o Squirtle), `before-no-plusN-drainPunch-lv1.png`, `after-drainPunch-plusN.mp4` (1 alvo e depois horda de 10).
