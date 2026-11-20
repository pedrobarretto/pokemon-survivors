import * as OpenCC from 'opencc-js/t2cn'
import { converterOf, useConverter } from './hans'

/**
 * Build time only (the site's pages, rendered in Node): the Simplified Chinese
 * converter at once, so the tables convert as they're read. The game never
 * imports this: it loads the converter's chunk when it needs it (`loadHans`).
 */
useConverter(converterOf(OpenCC))
