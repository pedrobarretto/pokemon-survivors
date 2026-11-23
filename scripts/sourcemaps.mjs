// Runs after `vite build`: uploads the build's source maps to PostHog, so error reports point at our code,
// then deletes them from dist. Only where the CLI's secrets are set (the Site workflow):
// POSTHOG_CLI_API_KEY (a personal key with error tracking write access) and POSTHOG_CLI_PROJECT_ID.
// A failed upload never fails the build: the game ships, its errors just show minified stacks.
// Usage: part of npm run build
import { spawnSync } from 'node:child_process'
import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'

const DIST = join(new URL('..', import.meta.url).pathname, 'dist')

if (process.env.POSTHOG_CLI_API_KEY && process.env.POSTHOG_CLI_PROJECT_ID) {
  const sha = process.env.GITHUB_SHA?.slice(0, 7)
  const release = ['--release-name', 'pokemon-survivors', ...(sha ? ['--release-version', sha] : [])]
  const cli = spawnSync('posthog-cli', ['sourcemap', 'process', '--directory', DIST, ...release, '--delete-after'], { stdio: 'inherit' })
  if (cli.status !== 0) console.warn('sourcemaps: the upload to PostHog failed; error reports from this build show minified stacks')
}

// Whatever the CLI left behind stays off the site.
const maps = (await readdir(DIST, { recursive: true })).filter((f) => f.endsWith('.js.map'))
await Promise.all(maps.map((f) => rm(join(DIST, f))))
