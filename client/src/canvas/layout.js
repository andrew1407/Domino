// Snake ("serpentine") layout of the domino chain.
//
// The first tile is placed at the origin. The right branch goes right along the
// first row, turns up at the row limit and continues to the left along the next
// row (and so on, zigzagging upwards). The left branch mirrors it: it goes left,
// turns down and zigzags downwards. Doubles are placed across the line, except
// right after a corner, where there is no room for that.
//
// Coordinates are board units (1 unit = 1px at scale 1), y axis points down.

import { getTileKey } from '../tools';

export const TILE = Object.freeze({ short: 64, long: 122 });
const GAP = 2;

const MIN_HALF_ROW = TILE.long * 2.5;

// rotation (degrees, clockwise) of the vertical tile image, whose top half
// shows the bigger value, so that the bigger value points along the vector
const rotationFor = ({ x, y }) => {
  if (y < 0) return 0;
  if (x > 0) return 90;
  if (y > 0) return 180;
  return -90;
};

const flip = ({ x, y }) => ({ x: -x, y: -y });

// orientation of a tile whose "near" value looks in nearDir
const orient = (near, far, nearDir) => {
  if (near === far) return rotationFor(nearDir.x ? { x: 0, y: -1 } : { x: -1, y: 0 });
  return rotationFor(near > far ? nearDir : flip(nearDir));
};

const placement = (tile, x, y, w, h, rotation) => ({
  key: getTileKey(tile),
  tile,
  x,
  y,
  w,
  h,
  rotation,
});

const placeFirst = tile => {
  if (tile.left === tile.right)
    return placement(tile, 0, 0, TILE.short, TILE.long, 0);
  // tile.left looks to the left branch
  const rotation = rotationFor(tile.left > tile.right ? { x: -1, y: 0 } : { x: 1, y: 0 });
  return placement(tile, 0, 0, TILE.long, TILE.short, rotation);
};

/**
 * @param steps tiles walking away from the first tile: { tile, near, far }
 * @param first placement of the first tile
 * @param dir initial horizontal direction (+1 right branch, -1 left branch)
 * @param halfRow half-width of a row (row limit is ±halfRow)
 */
const placeBranch = (steps, first, dir, halfRow) => {
  const vertical = -dir; // right branch climbs up, left branch goes down
  const placed = [];
  let rowY = 0;
  let cursor = dir * (first.w / 2 + GAP);
  let direction = dir;

  let afterCorner = false;

  // a tile's placement depends only on the tiles before it: the chain never
  // shifts when a tile is added, and a ghost area shows exactly where the
  // picked tile will be placed
  steps.forEach(({ tile, near, far }) => {
    // a double right after a corner is laid along the row: across it would
    // overlap the corner
    const across = near === far && !afterCorner;
    const width = across ? TILE.short : TILE.long;
    const overflow = Math.abs(cursor + direction * width) > halfRow;
    afterCorner = false;

    if (overflow && near !== far) {
      // a corner: the tile turns the line to the next row
      const x = cursor + direction * TILE.short / 2;
      const y = rowY + vertical * (TILE.long / 2 - TILE.short / 2);
      const rotation = orient(near, far, { x: 0, y: -vertical });
      placed.push(placement(tile, x, y, TILE.short, TILE.long, rotation));
      rowY += vertical * (TILE.long + GAP);
      cursor = x + direction * (TILE.short / 2);
      direction = -direction;
      afterCorner = true;
      return;
    }

    const x = cursor + direction * width / 2;
    const rotation = across ?
      orient(near, far, { x: -direction, y: 0 }) :
      rotationFor(near >= far ? { x: -direction, y: 0 } : { x: direction, y: 0 });
    placed.push(across ?
      placement(tile, x, rowY, TILE.short, TILE.long, rotation) :
      placement(tile, x, rowY, TILE.long, TILE.short, rotation));
    cursor += direction * (width + GAP);
  });

  return placed;
};

const boundsOf = placements => placements.reduce((b, p) => ({
  minX: Math.min(b.minX, p.x - p.w / 2),
  maxX: Math.max(b.maxX, p.x + p.w / 2),
  minY: Math.min(b.minY, p.y - p.h / 2),
  maxY: Math.max(b.maxY, p.y + p.h / 2),
}), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });

// room around the chain for a ghost area (a next tile, possibly a corner)
export const GHOST_ROOM = TILE.long + GAP;

const findFirstIdx = (deck, firstTile) => {
  if (!firstTile) return -1;
  const exact = deck.findIndex(t => t.left === firstTile.left && t.right === firstTile.right);
  if (exact >= 0) return exact;
  return deck.findIndex(t => t.left === firstTile.right && t.right === firstTile.left);
};

/**
 * Computes positions of the common deck tiles and ghost areas for the picked tile.
 * @returns {{ tiles: object[], ghosts: { left?: object, right?: object }, bounds: object }}
 */
export const layoutChain = ({ deck, firstTile, pickedTile = null, halfRow }) => {
  const result = { tiles: [], ghosts: {}, bounds: null, tileBounds: null };
  const firstIdx = findFirstIdx(deck, firstTile);
  if (firstIdx < 0) return result;
  const limit = Math.max(halfRow, MIN_HALF_ROW);
  const first = placeFirst(deck[firstIdx]);

  const rightSteps = deck.slice(firstIdx + 1)
    .map(tile => ({ tile, near: tile.left, far: tile.right }));
  const leftSteps = deck.slice(0, firstIdx).reverse()
    .map(tile => ({ tile, near: tile.right, far: tile.left }));

  result.tiles = [
    first,
    ...placeBranch(rightSteps, first, 1, limit),
    ...placeBranch(leftSteps, first, -1, limit),
  ];

  if (pickedTile) {
    const ends = { left: deck[0].left, right: deck[deck.length - 1].right };
    const ghostStep = side => {
      const value = ends[side];
      const fits = pickedTile.left === value || pickedTile.right === value;
      const near = fits ? value : pickedTile.left;
      const far = pickedTile.left + pickedTile.right - near;
      return { tile: pickedTile, near, far };
    };
    const rightGhost = placeBranch([...rightSteps, ghostStep('right')], first, 1, limit).pop();
    const leftGhost = placeBranch([...leftSteps, ghostStep('left')], first, -1, limit).pop();
    result.ghosts = { left: leftGhost, right: rightGhost };
  }

  result.bounds = boundsOf([...result.tiles, ...Object.values(result.ghosts)]);
  // the placed tiles only: the view is fitted to them, so it does not move
  // when the ghost areas of a picked tile appear
  result.tileBounds = boundsOf(result.tiles);

  return result;
};

export const insideRect = (p, point) => (
  !!p &&
  point.x >= p.x - p.w / 2 && point.x <= p.x + p.w / 2 &&
  point.y >= p.y - p.h / 2 && point.y <= p.y + p.h / 2
);
