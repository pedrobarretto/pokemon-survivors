// Builds the asset CDN's directory (`cdn/dist`, what `cdn/wrangler.jsonc` deploys): a copy of
// `public/assets/` under `assets/`, its `versions.json` and the `_headers` the Worker serves them with.
// `npm run cdn:build`; `npm run cdn:deploy` deploys it too.
import { cpSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ASSETS_DIR, assetVersions, filesUnder } from './versions.mjs'

const OUT = join(import.meta.dirname, 'dist')
/** The most files a Worker version holds on the Free plan (each up to 25 MiB). */
const MAX_FILES = 20_000

// URLs carry their group's version (`?v=`), so a file is cached for good; the CORS header keeps a
// canvas that draws one readable, and lets the workers and the cries' `fetch` read them.
const HEADERS = `/assets/*
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=31536000, stale-while-revalidate=604800, immutable
  X-Content-Type-Options: nosniff

/versions.json
  Access-Control-Allow-Origin: *
  Cache-Control: no-cache
`

rmSync(OUT, { recursive: true, force: true })
cpSync(ASSETS_DIR, join(OUT, 'assets'), { recursive: true, filter: (src) => !src.split(/[\\/]/).pop()?.startsWith('.') })
const versions = assetVersions()
writeFileSync(join(OUT, 'versions.json'), JSON.stringify(versions))
writeFileSync(join(OUT, '_headers'), HEADERS)

const files = filesUnder(OUT).length
if (files > MAX_FILES) throw new Error(`cdn/dist has ${files} files, over the ${MAX_FILES} a Worker version takes`)
console.log(`cdn/dist: ${files} files in ${Object.keys(versions).length} groups`)
