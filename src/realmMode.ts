/**
 * The Poké Realm in a chunk of its own: its screen, the bases' sheets and the
 * client's shell. `main.ts` loads it as a player goes in (`lazyScreen`), so a
 * player who only starts runs never downloads it.
 */
export { devRealmRoom, openRealm } from './ui/realm'
export { openBaseEditor } from './ui/baseEditor'
export { openBaseBoard } from './ui/baseBoard'
export { openCarpentry } from './ui/carpentry'
export { realmClient, realmDevState, realmInviteFrom, stageRealmTable, useLocalRealm } from './realmShell'
export { fakeRealm, fetchFriends, realmFaked } from './realm/api'
