// Bakes skins (src/data/skins/<id>.json) into their sheets
// (public/assets/skins/<id>/<dex>[/<form>]/<Anim>.png) with the propagation in
// src/skins: shared by `npm run skins` and the Ateliê's save (vite.config.ts).
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { readPng, writePng } from './png.mjs'

export const ROOT = new URL('..', import.meta.url).pathname
export const SKINS_DIR = join(ROOT, 'src/data/skins')
const SPRITES = join(ROOT, 'public/assets/pokemon')
const OUT = join(ROOT, 'public/assets/skins')

/** A variant key's dex and form: `6`, `6:megaX`. */
export const parseVariant = (key) => {
  const [dex, form] = key.split(':')
  return { dex: Number(dex), form: form || undefined }
}

/** A variant's sheet metadata (`sprites.generated.json`), an anim it lacks standing in with Walk, as the game does. */
const animMeta = (manifest, { dex, form }, anim) => {
  const entry = form ? manifest[dex]?.forms?.[form] : manifest[dex]
  if (!entry) throw new Error(`no sprites for ${dex}${form ? `:${form}` : ''}`)
  const file = entry.anims[anim] ? anim : 'Walk'
  const m = entry.anims[file]
  return { file, fw: m.frameWidth, fh: m.frameHeight, frames: m.durations.length }
}

/** A variant's original sheets as the propagation's grids. */
export const loadSheets = async (S, manifest, key, colors) => {
  const v = parseVariant(key)
  const sheets = {}
  for (const anim of S.SKIN_ANIMS) {
    const m = animMeta(manifest, v, anim)
    const png = await readPng(join(SPRITES, String(v.dex), v.form ?? '', `${m.file}.png`))
    sheets[anim] = S.sheetGrids(png.rgba, png.width, m.fw, m.fh, m.frames, colors)
  }
  return sheets
}

/** Bakes every variant of a skin source into PNGs; returns, per variant, how many frames still carry doubts. */
export const bakeSkin = async (S, source) => {
  const manifest = JSON.parse(await readFile(join(ROOT, 'src/data/sprites.generated.json'), 'utf8'))
  const report = {}
  for (const [key, variant] of Object.entries(source.variants)) {
    const colors = S.newColors()
    const sheets = await loadSheets(S, manifest, key, colors)
    const baked = S.bakeVariant(sheets, variant, colors)
    const v = parseVariant(key)
    const dir = join(OUT, source.id, String(v.dex), v.form ?? '')
    await mkdir(dir, { recursive: true })
    for (const anim of S.SKIN_ANIMS) {
      const img = S.bakedRgba(baked[anim], sheets[anim].fw, sheets[anim].fh, colors)
      await writeFile(join(dir, `${anim}.png`), writePng(img.w, img.h, img.rgba))
    }
    report[key] = S.doubtCount(baked)
  }
  return report
}

/** A skin source as the repo keeps it: one grid row per line, so diffs read like the art. */
export const formatSkin = (source) => {
  const grid = (g, pad) => `[\n${g.map((l) => `${pad}  ${JSON.stringify(l)}`).join(',\n')}\n${pad}]`
  const frame = (f, pad) => `${pad}{ "anim": ${JSON.stringify(f.anim)}, "row": ${f.row}, "frame": ${f.frame}, "grid": ${grid(f.grid, pad)} }`
  const variant = ([key, v]) =>
    `    ${JSON.stringify(key)}: {\n      "palette": ${JSON.stringify(v.palette)},\n${v.recolor ? `      "recolor": ${JSON.stringify(v.recolor)},\n` : ''}      "keys": [\n${v.keys.map((k) => frame(k, '        ')).join(',\n')}\n      ],\n      "fixes": [\n${v.fixes.map((k) => frame(k, '        ')).join(',\n')}\n      ]\n    }`
  return `{\n  "id": ${JSON.stringify(source.id)},\n  "variants": {\n${Object.entries(source.variants).map(variant).join(',\n')}\n  }\n}\n`
}
