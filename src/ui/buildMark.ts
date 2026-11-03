import { planned } from '../game/builds'
import { localPlayer } from '../game/players'
import type { Game, Offer } from '../game/types'
import { t } from '../i18n'
import { h } from './dom'
import { loadSave } from './save'

/** Whether a pick card follows the local player's build planned at the Dojo (`game/builds.ts`), read from the save as the screen opens. */
export const followsBuild = (g: Game, offer: Offer) => planned(loadSave().builds[localPlayer(g).starter], offer)

/** The ★ tag a card wears when it follows the build. */
export const buildTag = () => h('span', { class: 'tag tag-build', title: t().training.buildHint }, `★ ${t().training.buildTag}`)
