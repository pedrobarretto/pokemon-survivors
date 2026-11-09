import { HATCHLINGS, PLAYABLE, type HatchlingId } from '../data/hatchlings'
import { RESEARCH, RESEARCH_IDS, type ResearchId } from '../data/seasonOneUnlocks'
import { researchStatus } from '../game/seasonOneUnlocks'
import { formatNumber, t } from '../i18n'
import { portraitUrl } from '../render/sprites'
import { h } from './dom'
import { loadSave } from './save'

/**
 * The research chains' screen (the Missions dialog's third tab) and the words
 * the partner select's locked card shows for Temporada 1's families.
 */

/** Where a locked family is found, for the families with a way of their own; null for the rest, whose egg's line says it. */
export const lockedWhere = (id: HatchlingId): string | null => {
  const words = t().seasonUnlocks
  if (HATCHLINGS[id].egg === 'fossil') return words.fossilBlurb
  const where: Partial<Record<HatchlingId, string>> = words.where
  return where[id] ?? null
}

/** A step's line. */
const stepLine = (id: ResearchId, need: number) => {
  const r = t().seasonUnlocks.research
  const goal = RESEARCH[id].goal
  return goal === 'hits' ? r.hits(formatNumber(need)) : goal === 'wet' ? r.wet(need) : r.partners(need)
}

/** Every chain: its family's head with the steps done, its three steps and, for Tatsugiri, the partners that won so far. */
export const researchRows = (): HTMLElement[] => {
  const r = t().seasonUnlocks.research
  const { research } = loadSave()
  const chains = RESEARCH_IDS.flatMap((id) => {
    const status = researchStatus(research, id)
    const names = id === 'tatsugiri' ? research.partners.map((p) => PLAYABLE[p].name) : []
    return [
      h('div', { class: 'missions-head research-head' }, h('b', {}, h('img', { src: portraitUrl(HATCHLINGS[id].line[0].dex), alt: '' }), HATCHLINGS[id].name), h('span', {}, status.complete ? r.complete : `${status.done}/${status.steps.length}`)),
      ...status.steps.map((step) =>
        h('div', { class: `mission-row${step.done ? ' done' : ''}${step.current ? '' : ' research-later'}` }, h('span', { class: 'mission-text' }, stepLine(id, step.need)), h('span', { class: 'mission-reward' }, step.done ? '✓' : '')),
      ),
      ...(names.length > 0 ? [h('p', { class: 'research-note' }, r.have(names.join(', ')))] : []),
    ]
  })
  return [h('p', { class: 'research-note' }, r.intro), ...chains]
}
