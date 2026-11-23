import { playSfx } from '../engine/audio'
import { t } from '../i18n'
import { stickLockIcon } from '../render/art'
import { h } from './dom'
import { settings, updateSettings } from './settings'
import { toast } from './toasts'

/**
 * The padlock on the run's status box (touchscreens, CSS hides it elsewhere):
 * one tap fixes the joystick in its corner or lets it follow the thumb again.
 * It's the Controls setting, reachable mid-run; a finger already on the stick
 * keeps it until it lets go. `onChange` runs after a tap, as the status box moves.
 */
export const createStickLock = (root: HTMLElement, onChange: () => void) => {
  const icon = h('img', { alt: '' })
  const button = h('button', { class: 'stick-lock box', type: 'button', 'aria-label': t().hud.stickLock }, icon)

  // A click, not a pointerdown like the moves' buttons: a thumb landing here by accident mid-fight changes nothing unless it's a tap.
  button.addEventListener('click', () => {
    const fixing = settings().joystick !== 'fixed'
    updateSettings({ joystick: fixing ? 'fixed' : 'floating' })
    playSfx('select')
    toast(root, fixing ? t().hud.stickLocked : t().hud.stickFree, 2600, 'stick-lock')
    onChange()
  })

  let shown: boolean | null = null

  /** The Settings screen can change it too. */
  const update = () => {
    const fixed = settings().joystick === 'fixed'
    if (shown === fixed) return
    shown = fixed
    icon.setAttribute('src', stickLockIcon(fixed))
    button.setAttribute('aria-pressed', String(fixed))
  }

  return { button, update }
}
