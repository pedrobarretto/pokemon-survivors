# Usage: python3 chart.py <before.jsonl> <after.jsonl> <out.svg> <out.md>
import json, sys
def load(p):
    snaps, acts = [], []
    for l in open(p):
        d = json.loads(l)
        if d.get('label') == 'act': acts.append(d)
        elif 'canvases' in d and d['label'] != 'title': snaps.append(d)
    return snaps, acts
b, ba = load(sys.argv[1]); a, aa = load(sys.argv[2])
W, H, L, R, T = 900, 620, 70, 30, 50
PH = 230; GAP = 70
def panel(y0, key, ymax, title, unit):
    out = [f'<text x="{L}" y="{y0-14}" class="t">{title}</text>']
    for i in range(0, 6):
        v = ymax * i / 5; y = y0 + PH - PH * i / 5
        out.append(f'<line x1="{L}" x2="{W-R}" y1="{y:.1f}" y2="{y:.1f}" class="g"/><text x="{L-8}" y="{y+4:.1f}" class="ax" text-anchor="end">{v:.0f}{unit}</text>')
    for m in range(0, 26, 5):
        x = L + (W - L - R) * m / 25
        out.append(f'<text x="{x:.1f}" y="{y0+PH+16}" class="ax" text-anchor="middle">{m} min</text>')
    def line(s, cls):
        pts = ' '.join(f'{L + (W-L-R) * d["wall"]/1500:.1f},{y0 + PH - PH * min(d[key], ymax)/ymax:.1f}' for d in s if d['wall'] <= 1500)
        return f'<polyline points="{pts}" class="{cls}"/>'
    out.append(line(b, 'before')); out.append(line(a, 'after'))
    return out
parts = []
parts += panel(T + 20, 'canvases', 450, 'Canvases guardados pelos caches (heldCanvases)', '')
# the target
y150 = T + 20 + PH - PH * 150 / 450
parts.append(f'<line x1="{L}" x2="{W-R}" y1="{y150:.1f}" y2="{y150:.1f}" class="goal"/><text x="{W-R-4}" y="{y150-5:.1f}" class="ax goalt" text-anchor="end">meta: ~150</text>')
parts += panel(T + 20 + PH + GAP, 'mb', 50, 'MB desses canvases (w×h×4)', '')
# acts
names = {"ps.boss('entei')": 'Entei', "ps.tera('enter', 'raidCharizard', 'fire', 6)": 'raid Charizard', "ps.boss('raikou')": 'Raikou', "ps.rift('kyogre')": 'fenda Kyogre', "ps.riftAct('capture')": 'captura', "ps.tera('enter', 'raidDragonite', 'dragon', 6)": 'raid Dragonite', "ps.boss('suicune')": 'Suicune', "ps.victory()": 'infinito', "ps.reaper()": 'Arceus'}
for d in ba:
    if d['code'] not in names: continue
    x = L + (W-L-R) * d['wall'] / 1500
    parts.append(f'<line x1="{x:.1f}" x2="{x:.1f}" y1="{T+20}" y2="{T+20+2*PH+GAP}" class="act"/><text transform="translate({x+3:.1f},{T+30}) rotate(90)" class="ax">{names[d["code"]]}</text>')
legend = f'<rect x="{L}" y="{H-28}" width="14" height="4" class="lb"/><text x="{L+20}" y="{H-22}" class="ax">antes (main, 526718f)</text><rect x="{L+200}" y="{H-28}" width="14" height="4" class="la"/><text x="{L+220}" y="{H-22}" class="ax">depois (WAV-154)</text><text x="{W-R}" y="{H-22}" class="ax" text-anchor="end">Rayquaza Lendário, iPhone 430×739 @3x, mesma semente</text>'
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
<style>
 svg {{ background:#ffffff; font-family: -apple-system, Segoe UI, Roboto, sans-serif }}
 .t {{ font-size:15px; font-weight:600; fill:#1b1f24 }} .ax {{ font-size:11px; fill:#57606a }}
 .g {{ stroke:#e6e8eb; stroke-width:1 }} .act {{ stroke:#c9ccd1; stroke-dasharray:3 3 }}
 .before {{ fill:none; stroke:#d1495b; stroke-width:2 }} .after {{ fill:none; stroke:#2e7dd7; stroke-width:2 }}
 .lb {{ fill:#d1495b }} .la {{ fill:#2e7dd7 }} .goal {{ stroke:#2a9d58; stroke-dasharray:6 4; stroke-width:1.5 }} .goalt {{ fill:#2a9d58 }}
</style>
<text x="{L}" y="26" class="t" style="font-size:18px">WAV-154: canvases numa partida de 25 min com chefes, raids e fenda</text>
{''.join(parts)}
{legend}
</svg>'''
open(sys.argv[3], 'w').write(svg)
# table: per minute
def at(s, m):
    c = [d for d in s if abs(d['wall'] - m * 60) <= 16]
    return c[0] if c else None
rows = ['| min (parede) | jogo | momento | antes: canvases | antes: MB | antes: heap MB | depois: canvases | depois: MB | depois: heap MB |', '|---|---|---|---|---|---|---|---|---|']
momento = {3: 'chefe Entei', 5: 'chefe da onda (5:00)', 6: 'raid Charizard', 9: 'chefe Raikou', 11: 'fenda Kyogre', 12: 'fenda, fase 2', 14: 'após a captura', 15: 'raid Dragonite', 17: 'chefe Suicune', 19: 'vitória → infinito', 21: 'Arceus', 25: 'fim'}
for m in range(0, 26):
    x, y = at(b, m), at(a, m)
    if not x or not y: continue
    lab = (x['label'].split(' ', 1) + [''])[1]
    rows.append(f"| {m} | {int(y['t'])//60}:{int(y['t'])%60:02d} | {momento.get(m, lab)} | {x['canvases']} | {x['mb']} | {x['heap']} | {y['canvases']} | {y['mb']} | {y['heap']} |")
def summary(s):
    run = [d for d in s if d['wall'] >= 60]
    cs = [d['canvases'] for d in run]; ms = [d['mb'] for d in run]
    return min(cs), round(sum(cs)/len(cs)), max(cs), min(ms), round(sum(ms)/len(ms), 1), max(ms)
sb, sa = summary(b), summary(a)
md = ['| | canvases (mín / média / máx) | MB (mín / média / máx) |', '|---|---|---|',
      f'| antes | {sb[0]} / {sb[1]} / **{sb[2]}** | {sb[3]} / {sb[4]} / {sb[5]} |',
      f'| depois | {sa[0]} / {sa[1]} / **{sa[2]}** | {sa[3]} / {sa[4]} / {sa[5]} |', '', *rows]
open(sys.argv[4], 'w').write('\n'.join(md) + '\n')
print('\n'.join(md[:4]))
