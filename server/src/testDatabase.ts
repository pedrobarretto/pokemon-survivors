/**
 * A fresh database of its own for one `*.db.test.ts` file, made on the server
 * `url` points at (as `<its database>_<name>`, dropped and made again) and
 * returned as a URL. Several files share one `*_TEST_DATABASE_URL` and each
 * wipes its tables before every test, so on one database a file running
 * beside another lost its rows halfway (the claw machine's tests failed in
 * full runs and passed alone); each in its own, they run in parallel safely.
 * Test-only: nothing in the API imports it. `postgres` loads lazily so the
 * root `npm test`, which runs before the server's packages are installed in CI,
 * can still import (and skip) the DB test files.
 */
export const ownTestDatabase = async (url: string, name: string) => {
  const { default: postgres } = await import('postgres')
  const at = new URL(url)
  const db = `${at.pathname.slice(1) || 'postgres'}_${name}`
  const admin = postgres(url, { max: 1, onnotice: () => {} })
  try {
    await admin.unsafe(`drop database if exists "${db}" with (force)`)
    await admin.unsafe(`create database "${db}"`)
  } finally {
    await admin.end()
  }
  at.pathname = `/${db}`
  return at.toString()
}
