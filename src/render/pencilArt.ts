/**
 * The pencil that stands for a species SpriteCollab's artists are still drawing,
 * as pixel rows and palette (no DOM): the game draws it from these
 * (`pencilSprite` in `render/art.ts`) and the site as an inline SVG
 * (`site/pages/pokedex.ts`). 1 outline, 2 its yellow, 3 the shade, 8 the shine,
 * 4 the wood, 5 the lead, 6 the eraser, 7 the ferrule.
 */
export const PENCIL = [
  '............1...',
  '...........161..',
  '..........16661.',
  '.........1666661',
  '........1776661.',
  '.......1827761..',
  '......1822371...',
  '.....1822331....',
  '....1822331.....',
  '...1822331......',
  '...142331.......',
  '..144431........',
  '..15441.........',
  '.1551...........',
  '.111............',
  '................',
] as const

export const PENCIL_PALETTE = { 1: '#201828', 2: '#f8c030', 3: '#c88018', 4: '#f0c890', 5: '#403848', 6: '#f08098', 7: '#c8d0e0', 8: '#fff0a0' } as const
