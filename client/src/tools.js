import { checkMovePermission, getEnds } from './engine/rules';

export const applyStyles = (...styles) => styles.filter(Boolean).join(' ');

export const applyStylesIf = (condition, truthy, falsy) => (
  applyStyles(...(condition ? truthy : falsy))
);

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const assetPath = path => `${BASE_PATH}${path}`;

export const getTileKey = ({ left, right }) => (
  left >= right ? `${left}-${right}` : `${right}-${left}`
);

export const getTileImagePath = tile => assetPath(`/static/tiles/${getTileKey(tile)}.svg`);

export const tilesEqual = (first, second) => {
  if (!(first && second)) return false;
  return first.left === second.left &&
    first.right === second.right;
};

// the same rule the game engine checks moves with
export const canPlaceTile = (tile, commonDeck, side) => {
  if (!tile || !commonDeck?.length) return false;
  const [leftEnd, rightEnd] = getEnds(commonDeck);
  return checkMovePermission(tile, side === 'left' ? leftEnd : rightEnd, side);
};
