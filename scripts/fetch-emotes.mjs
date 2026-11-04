// Downloads the Arena's emote animations (PMD SpriteCollab) for the species the Arena plays
// (`EMOTE_SPECIES`, `EMOTE_ANIMS` in scripts/dex.mjs), keeping only each sheet's first row: an
// emote always faces the camera, so the other seven directions would be dead weight. They land in
// public/assets/pokemon/<dex>/emote/<Anim>.png and src/data/emotes.generated.json (frame size and
// durations by species and animation; a species without an animation simply lacks it).
// Usage: node scripts/fetch-emotes.mjs (`npm run assets` runs it after fetch-assets.mjs)
import { access, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { crc32, deflateSync, inflateSync } from 'node:zlib'
import { EMOTE_ANIMS, EMOTE_SPECIES, pad } from './dex.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const OUT = join(ROOT, 'public/assets/pokemon')
const MANIFEST = join(ROOT, 'src/data/emotes.generated.json')
const SPRITES = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite'

const exists = (p) => access(p).then(() => true, () => false)
const tag = (xml, name) => xml.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1]

const parseAnims = (xml) =>
  Object.fromEntries(
    [...xml.matchAll(/<Anim>([\s\S]*?)<\/Anim>/g)].map(([, body]) => [
      tag(body, 'Name'),
      {
        copyOf: tag(body, 'CopyOf'),
        frameWidth: Number(tag(body, 'FrameWidth')),
        frameHeight: Number(tag(body, 'FrameHeight')),
        durations: [...body.matchAll(/<Duration>(\d+)<\/Duration>/g)].map(([, d]) => Number(d)),
      },
    ]),
  )

const resolveAnim = (anims, name) => {
  const anim = anims[name]
  return anim?.copyOf ? resolveAnim(anims, anim.copyOf) : anim && { name, ...anim }
}

const BYTES_PER_PIXEL = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }

const chunk = (type, data) => {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0)
  return Buffer.concat([head, data, crc])
}

/**
 * The top `rows` pixel rows of an 8-bit, non-interlaced PNG as a PNG of their own, its palette and
 * transparency kept (SpriteCollab's sheets are RGBA or indexed). Each row is re-filtered with Paeth,
 * which packs pixel art about as well as the original.
 */
export const cropTop = (png, rows) => {
  let at = 8
  let header = null
  const keep = []
  const idat = []
  while (at < png.length) {
    const length = png.readUInt32BE(at)
    const type = png.toString('ascii', at + 4, at + 8)
    const data = png.subarray(at + 8, at + 8 + length)
    if (type === 'IHDR') header = data
    else if (type === 'IDAT') idat.push(data)
    else if (type === 'PLTE' || type === 'tRNS') keep.push([type, data])
    at += 12 + length
  }
  const width = header.readUInt32BE(0)
  const height = header.readUInt32BE(4)
  const [depth, color, , , interlace] = header.subarray(8)
  const bpp = BYTES_PER_PIXEL[color]
  if (depth !== 8 || interlace !== 0 || !bpp) throw new Error(`unsupported PNG (depth ${depth}, color ${color}, interlace ${interlace})`)
  if (rows >= height) return png
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * bpp
  const out = Buffer.alloc(stride * rows)
  // Undo the per-row filters (PNG spec, section 9) for the rows kept.
  for (let y = 0; y < rows; y++) {
    const filter = raw[y * (stride + 1)]
    for (let x = 0; x < stride; x++) {
      const cur = raw[y * (stride + 1) + 1 + x]
      const a = x >= bpp ? out[y * stride + x - bpp] : 0
      const b = y > 0 ? out[(y - 1) * stride + x] : 0
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0
      const p = a + b - c
      const paeth = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c
      out[y * stride + x] = (cur + [0, a, b, (a + b) >> 1, paeth][filter]) & 0xff
    }
  }
  const filtered = Buffer.alloc((stride + 1) * rows)
  for (let y = 0; y < rows; y++) {
    filtered[y * (stride + 1)] = 4
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0
      const b = y > 0 ? out[(y - 1) * stride + x] : 0
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0
      const p = a + b - c
      const paeth = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c
      filtered[y * (stride + 1) + 1 + x] = (out[y * stride + x] - paeth) & 0xff
    }
  }
  const ihdr = Buffer.from(header)
  ihdr.writeUInt32BE(rows, 4)
  return Buffer.concat([
    png.subarray(0, 8),
    chunk('IHDR', ihdr),
    ...keep.map(([type, data]) => chunk(type, data)),
    chunk('IDAT', deflateSync(filtered, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const fetchEmotes = async (dex) => {
  const res = await fetch(`${SPRITES}/${pad(dex)}/AnimData.xml`)
  if (!res.ok) throw new Error(`#${dex}: missing AnimData.xml`)
  const anims = parseAnims(await res.text())
  const dir = join(OUT, String(dex), 'emote')
  await mkdir(dir, { recursive: true })
  const got = await Promise.all(
    EMOTE_ANIMS.map(async (name) => {
      const anim = resolveAnim(anims, name)
      if (!anim) return null
      const dest = join(dir, `${name}.png`)
      if (!(await exists(dest))) {
        const sheet = await fetch(`${SPRITES}/${pad(dex)}/${anim.name}-Anim.png`)
        if (!sheet.ok) return null
        await writeFile(dest, cropTop(Buffer.from(await sheet.arrayBuffer()), anim.frameHeight))
      }
      return [name, { frameWidth: anim.frameWidth, frameHeight: anim.frameHeight, durations: anim.durations }]
    }),
  )
  const found = Object.fromEntries(got.filter(Boolean))
  console.log(`#${dex}: ${Object.keys(found).join(', ')}`)
  return [dex, found]
}

const species = []
for (const dex of EMOTE_SPECIES) species.push(await fetchEmotes(dex))
await writeFile(MANIFEST, JSON.stringify(Object.fromEntries(species), null, 2) + '\n')
console.log(`Wrote ${MANIFEST}`)
