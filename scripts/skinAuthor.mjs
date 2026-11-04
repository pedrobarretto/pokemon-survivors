// `npm run skin -- <command> ...`: the Ateliê's text side, for drawing a skin
// as palette-letter grids from a terminal (how an agent draws one). Same
// sources as the Ateliê (src/data/skins/<id>.json), same propagation.
//  new   <skin> <variant> [palette.json]      adds a variant: its palette starts with the extra letters, then the sprite's colors
//  show  <skin> <variant> <anim> <row> <frame> [orig]   prints the baked (or original) frame as letters, line numbers 1-based, with a column ruler
//  big   <skin> <variant> <out.png> <anim> <row> <frame> [orig|baked]   one frame at 24×, a tick every 5 px (red) and 10 (blue)
//  key   <skin> <variant> <anim> <row> <frame> <patch.json>   the frame becomes a keyframe: its ORIGINAL plus the patches, in order:
//          [line, col, "chars"] writes chars from col on that line ('_' keeps a pixel, '.' clears it);
//          ["map", line0, line1, col0, col1, {"from": "to"}] swaps letters inside a box (recolors keeping the shading)
//  recolor <skin> <variant> <map.json>   sets the variant's recolor ({"from": "to"} letters, swapped on every frame after the keyframes; a theme or season of colors only the recolored part uses needs no keyframes); {} removes it
//  keys  <skin> <variant> <out.png> [scale] [cols]   every keyframe, original beside drawn
//  sheet <skin> <variant> <out.png> [anims] [scale]  the whole bake beside the original (keyframes on a yellow ground)
import { runnerImport } from 'vite'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, loadSheets, formatSkin } from './skinBake.mjs'
import { writePng } from './png.mjs'
const S = (await runnerImport('/src/skins/source.ts', { configFile: false, root: ROOT, logLevel: 'error' })).module
const man = JSON.parse(readFileSync(join(ROOT, 'src/data/sprites.generated.json')))
const [cmd, id, variant, ...rest] = process.argv.slice(2)
const file = join(ROOT, 'src/data/skins', `${id}.json`)
const skin = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { id, variants: {} }
const saveSkin = () => writeFileSync(file, formatSkin(skin))
const load = async () => {
  const c = S.newColors()
  const sheets = await loadSheets(S, man, variant, c)
  return { c, sheets }
}
const ruler = (w) => '    ' + Array.from({ length: w }, (_, i) => (i % 10 === 0 ? String((i / 10) % 10) : ' ')).join('') + '\n    ' + Array.from({ length: w }, (_, i) => i % 10).join('')
if (cmd === 'new') {
  const { c, sheets } = await load()
  const extra = rest[0] ? JSON.parse(readFileSync(rest[0], 'utf8')) : {}
  const palette = S.paletteFor(sheets, c, { ...extra })
  skin.variants[variant] ??= { palette, keys: [], fixes: [] }
  saveSkin()
  console.log(JSON.stringify(skin.variants[variant].palette))
} else if (cmd === 'recolor') {
  const map = JSON.parse(readFileSync(rest[0], 'utf8'))
  const v = skin.variants[variant]
  for (const ch of [...Object.keys(map), ...Object.values(map)]) if (!(ch in v.palette)) throw Error(`letter ${ch} not in palette`)
  if (Object.keys(map).length) v.recolor = map
  else delete v.recolor
  saveSkin()
} else if (cmd === 'show') {
  const [anim, row, frame, orig] = rest
  const { c, sheets } = await load()
  const v = skin.variants[variant]
  S.paletteFor(sheets, c, v.palette)
  const g = orig ? sheets[anim].frames[+row][+frame] : S.bakeVariant(sheets, v, c)[anim][+row][+frame].grid
  const lines = S.textFromGrid(g, v.palette, c)
  const first = lines.findIndex((l) => /[^.]/.test(l)), last = lines.length - 1 - [...lines].reverse().findIndex((l) => /[^.]/.test(l))
  console.log(ruler(g.w))
  lines.forEach((l, i) => i >= first - 1 && i <= last + 1 && console.log(String(i + 1).padStart(3) + ' ' + l))
  saveSkin()
} else if (cmd === 'key') {
  const [anim, row, frame, patchFile] = rest
  const { c, sheets } = await load()
  const v = skin.variants[variant]
  S.paletteFor(sheets, c, v.palette)
  const g = S.textFromGrid(sheets[anim].frames[+row][+frame], v.palette, c)
  const patches = JSON.parse(readFileSync(patchFile, 'utf8'))
  for (const entry of patches) {
    if (entry[0] === 'map') {
      // ["map", line0, line1, col0, col1, {from: to}] recolours a box by letter
      const [, l0, l1, c0, c1, m] = entry
      for (let ln = l0; ln <= l1; ln++) g[ln - 1] = [...g[ln - 1]].map((o, x) => (x >= c0 && x <= c1 && m[o] ? m[o] : o)).join('')
      continue
    }
    const [ln, col, str] = entry
    const l = g[ln - 1]
    if (col + str.length > l.length) throw Error(`line ${ln} too long`)
    for (const ch of str) if (ch !== '.' && ch !== '_' && !(ch in v.palette)) throw Error(`letter ${ch} not in palette`)
    // '_' in a patch keeps the original pixel
    g[ln - 1] = [...l].map((o, x) => (x >= col && x < col + str.length && str[x - col] !== '_' ? str[x - col] : o)).join('')
  }
  const ref = { anim, row: +row, frame: +frame }
  v.keys = v.keys.filter((k) => !S.sameFrame(k, ref))
  v.keys.push({ ...ref, grid: g })
  saveSkin()
} else if (cmd === 'sheet') {
  const [out, animsArg = 'Walk,Idle,Hurt', scArg = '5'] = rest
  const { c, sheets } = await load()
  const v = skin.variants[variant]
  S.paletteFor(sheets, c, v.palette)
  const b = S.bakeVariant(sheets, v, c)
  const anims = animsArg.split(',')
  const sc = +scArg, gap = 3
  const blocks = anims.map((a) => ({ a, s: sheets[a] }))
  const bw = Math.max(...blocks.map(({ s }) => s.fw * s.frames[0].length))
  const W = bw * 2 + gap, H = blocks.reduce((n, { s }) => n + s.fh * 8 + gap, 0)
  const img = new Uint8Array(W * sc * H * sc * 4).fill(255)
  let yo = 0
  for (const { a, s } of blocks) {
    for (let panel = 0; panel < 2; panel++)
      for (let r = 0; r < 8; r++)
        for (let f = 0; f < s.frames[r].length; f++) {
          const g = panel ? b[a][r][f].grid : s.frames[r][f]
          const own = panel && b[a][r][f].own
          for (let y = 0; y < s.fh; y++)
            for (let x = 0; x < s.fw; x++) {
              const id = g.px[y * s.fw + x]
              const bg = (x + y) % 2 ? (own ? 236 : 205) : (own ? 250 : 225)
              const col = id ? [0, 2, 4].map((k) => parseInt(c.hex[id].slice(k, k + 2), 16)) : [bg, bg, own ? bg - 40 : bg]
              const X = panel * (bw + gap) + f * s.fw + x, Y = yo + r * s.fh + y
              for (let yy = 0; yy < sc; yy++) for (let xx = 0; xx < sc; xx++) { const o = ((Y * sc + yy) * W * sc + X * sc + xx) * 4; img[o] = col[0]; img[o + 1] = col[1]; img[o + 2] = col[2] }
            }
        }
    yo += s.fh * 8 + gap
  }
  writeFileSync(out, writePng(W * sc, H * sc, img))
}
if (cmd === 'keys') {
  // keys <out.png> [scale] [crop: y0,y1] : each keyframe original | drawn, rows stacked
  const [out, scArg = '10'] = rest
  const { c, sheets } = await load()
  const v = skin.variants[variant]
  S.paletteFor(sheets, c, v.palette)
  const sc = +scArg, gap = 2
  const items = v.keys.map((k) => ({ K: sheets[k.anim].frames[k.row][k.frame], E: S.gridFromText(k.grid, v.palette, c) }))
  // crop each to the union bbox of opaque rows/cols
  const bbox = (g) => { let x0 = g.w, y0 = g.h, x1 = 0, y1 = 0; for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.px[y * g.w + x]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) } return { x0: Math.max(0, x0 - 1), y0: Math.max(0, y0 - 1), x1: x1 + 1, y1: y1 + 1 } }
  const boxes = items.map(({ K, E }) => { const a = bbox(K), b = bbox(E); return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) } })
  const cw = Math.max(...boxes.map((b) => b.x1 - b.x0 + 1)), ch = Math.max(...boxes.map((b) => b.y1 - b.y0 + 1))
  const cols = Math.min(items.length, +(rest[2] ?? 4))
  const W = cols * (cw * 2 + gap * 3), H = Math.ceil(items.length / cols) * (ch + gap)
  const img = new Uint8Array(W * sc * H * sc * 4).fill(40)
  items.forEach(({ K, E }, i) => {
    const b = boxes[i], ox = (i % cols) * (cw * 2 + gap * 3), oy = Math.floor(i / cols) * (ch + gap)
    for (const [p, g] of [[0, K], [1, E]]) for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const id = (b.x0 + x < g.w && b.y0 + y < g.h) ? g.px[(b.y0 + y) * g.w + b.x0 + x] : 0
      const bg = (x + y) % 2 ? 205 : 225
      const col = id ? [0, 2, 4].map((k) => parseInt(c.hex[id].slice(k, k + 2), 16)) : [bg, bg, bg]
      const X = ox + p * (cw + gap) + x, Y = oy + y
      for (let yy = 0; yy < sc; yy++) for (let xx = 0; xx < sc; xx++) { const o = ((Y * sc + yy) * W * sc + X * sc + xx) * 4; img[o] = col[0]; img[o + 1] = col[1]; img[o + 2] = col[2]; img[o + 3] = 255 }
    }
  })
  for (let i = 3; i < img.length; i += 4) img[i] = 255
  writeFileSync(out, writePng(W * sc, H * sc, img))
}
if (cmd === 'big') {
  // big <out.png> <anim> <row> <frame> [orig|baked] : one frame at scale 24 with a grid, a tick every 5 px (red) and 10 (blue)
  const [out, anim, row, frame, which = 'orig'] = rest
  const { c, sheets } = await load()
  const v = skin.variants[variant]
  S.paletteFor(sheets, c, v.palette)
  const g = which === 'orig' ? sheets[anim].frames[+row][+frame] : S.bakeVariant(sheets, v, c)[anim][+row][+frame].grid
  const sc = 24, W = (g.w + 1) * sc, H = (g.h + 1) * sc
  const img = new Uint8Array(W * H * 4).fill(255)
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    const x = Math.floor(X / sc) - 1, y = Math.floor(Y / sc) - 1, o = (Y * W + X) * 4
    let col
    if (x < 0 || y < 0) { const t = x < 0 ? y : x; col = t < 0 ? [255, 255, 255] : t % 10 === 0 ? [80, 80, 255] : t % 5 === 0 ? [255, 90, 90] : (t % 2 ? [235, 235, 235] : [200, 200, 200]) }
    else { const id = g.px[y * g.w + x]; const bg = (x + y) % 2 ? 205 : 225; col = id ? [0, 2, 4].map((k) => parseInt(c.hex[id].slice(k, k + 2), 16)) : [bg, bg, bg]
      if (X % sc === 0 || Y % sc === 0) col = col.map((v) => v * 0.8) }
    img[o] = col[0]; img[o + 1] = col[1]; img[o + 2] = col[2]; img[o + 3] = 255
  }
  writeFileSync(out, writePng(W, H, img))
}
