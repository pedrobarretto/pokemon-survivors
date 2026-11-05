import type { BaseLayout, Placed } from '../data/secretBases'

/**
 * Furnished bases for `fakeRealm` (`ps.realm('fake')`, `ps.base`): the
 * player's own (made only of what the fake owns, so the editor opens on a
 * valid room) and two neighbors' for the board, so the screens show
 * something lived in without an API.
 */

const at = (id: Placed['id'], x: number, y: number, turned = false): Placed => ({ id, x, y, turned })

export const DEMO_BASES = {
  mine: {
    exterior: 'tree',
    wallpaper: 'starryWallpaper',
    flooring: 'plankFloor',
    items: [
      at('regionMap', 2, 0),
      at('pottedPlant', 0, 2),
      at('pottedPlant', 11, 2),
      at('aquarium', 3, 2),
      at('doll:mewtwo', 4, 2),
      at('arcadeCabinet', 6, 2),
      at('arcadeCabinetTeal', 7, 2),
      at('goldTrophyCase', 8, 2),
      at('doll:groudon', 8, 2),
      at('doll:hoOh', 10, 2),
      at('pokeBallRug', 5, 4),
      at('woodTable', 1, 5),
      at('candle', 1, 5),
      at('woodChair', 1, 6),
      at('woodChair', 2, 6),
      at('pikachuBed', 9, 5, true),
      at('snorlaxBeanbag', 9, 7),
    ],
  },
  misty: {
    exterior: 'sand',
    wallpaper: null,
    flooring: null,
    items: [
      at('aquarium', 1, 2),
      at('aquarium', 8, 2),
      at('candle', 2, 2),
      at('doll:kyogre', 9, 2),
      at('pokeBallRug', 4, 4),
      at('snorlaxBeanbag', 1, 5),
      at('pottedPlant', 10, 6),
      at('regionMap', 5, 0),
    ],
  },
  brock: {
    exterior: 'cave',
    wallpaper: null,
    flooring: null,
    items: [
      at('regionMap', 1, 0),
      at('goldTrophyCase', 4, 2),
      at('doll:regirock', 4, 2),
      at('doll:groudon', 6, 2),
      at('woodTable', 8, 4),
      at('candle', 9, 4),
      at('woodChair', 8, 5),
      at('pottedPlant', 0, 7),
      at('pottedPlant', 11, 7),
      at('pikachuBed', 1, 3),
    ],
  },
} as const satisfies Record<string, BaseLayout>
