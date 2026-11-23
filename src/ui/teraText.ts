import type { TeraType } from '../data/tera'
import { t } from '../i18n'

/** A Tera type's name: the type's own, or Stellar's (`tera.stellar`). */
export const teraName = (type: TeraType) => (type === 'stellar' ? t().tera.stellar : t().types[type])
