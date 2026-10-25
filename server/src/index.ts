import { serverRole } from './env'

/**
 * One image, two roles (`ROLE`): the API (`api.ts`, the default) or the
 * verifier alone (`verifier.ts`, `ROLE=checks`), deployed as its own
 * low-priority app. Only the role's own module loads.
 */
if (serverRole() === 'checks') await import('./verifier')
else await import('./api')
