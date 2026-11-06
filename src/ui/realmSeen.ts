/** Whether this device has been in the Poké Realm: the lobby's tile wears a NOVO tag until then (the realm's screen is a chunk of its own, this isn't). */
const SEEN = 'ps:realmSeen'

export const realmSeen = () => {
  try {
    return localStorage.getItem(SEEN) !== null
  } catch {
    return true
  }
}

export const markRealmSeen = () => {
  try {
    localStorage.setItem(SEEN, '1')
  } catch {
    // The tag just shows again next time.
  }
}
