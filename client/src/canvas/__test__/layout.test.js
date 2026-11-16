/**
 * @jest-environment node
 */
import { layoutChain, TILE, GHOST_ROOM, HALF_ROW } from '../layout';

// builds a valid chain of n tiles where each tile.left matches the previous tile.right
const makeChain = (n, start = 6) => {
  const used = new Set();
  const chain = [];
  let value = start;
  for (let guard = 0; chain.length < n && guard < 1000; ++guard) {
    let next = null;
    for (let v = 0; v <= 6; ++v) {
      const key = [Math.max(value, v), Math.min(value, v)].join('-');
      if (!used.has(key)) { next = v; used.add(key); break; }
    }
    if (next === null) break;
    chain.push({ left: value, right: next });
    value = next;
  }
  return chain;
};

const overlap = (a, b) => {
  const dx = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2);
  const dy = Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2);
  return dx > 0.5 && dy > 0.5;
};

// pairwise check: a chain has at most 28 tiles (378 pairs), so it stays cheap
const expectNoOverlaps = tiles => {
  const overlapping = [];
  tiles.forEach((a, i) => tiles.slice(i + 1).forEach(b => {
    if (overlap(a, b)) overlapping.push([a.key, b.key]);
  }));
  expect(overlapping).toEqual([]);
};

describe('snake layout', () => {
  const deck = makeChain(24);
  const firstIdx = 10;
  const { tiles, bounds } = layoutChain({ deck, firstTile: deck[firstIdx] });

  it('places every tile', () => {
    expect(tiles).toHaveLength(deck.length);
    expect(tiles[0]).toMatchObject({ x: 0, y: 0 });
  });

  it.each([0, 3, 7, 10, 15, 22])('never overlaps tiles (first tile index %s, various widths)', firstIdx => {
    const { tiles } = layoutChain({ deck, firstTile: deck[firstIdx] });
    expectNoOverlaps(tiles);
  });

  it('never overlaps tiles', () => {
    expectNoOverlaps(tiles);
  });

  it('keeps rows within 9 tiles (plus the corner tiles)', () => {
    expect(HALF_ROW).toBe(TILE.long / 2 + 2 + 4 * (TILE.long + 2));
    expect(bounds.maxX).toBeLessThanOrEqual(HALF_ROW + TILE.short + 2);
    expect(bounds.minX).toBeGreaterThanOrEqual(-HALF_ROW - TILE.short - 2);
  });

  it('puts at most 4 tiles on each side of the first one before turning', () => {
    // corner tiles are shifted off the row line, doubles stand on it
    const firstRow = tiles.filter(t => t.y === 0);
    expect(firstRow.filter(t => t.x > 0)).toHaveLength(4);
    expect(firstRow.filter(t => t.x < 0)).toHaveLength(4);
  });

  it('turns at the row limit even with a double there', () => {
    // 4 tiles to the right of the first one, then a double: it turns the corner
    const deck = [{ left: 6, right: 0 }, { left: 0, right: 1 }, { left: 1, right: 2 },
      { left: 2, right: 3 }, { left: 3, right: 4 }, { left: 4, right: 4 }, { left: 4, right: 5 }];
    const { tiles: placed } = layoutChain({ deck, firstTile: deck[0] });
    expect(placed.filter(t => t.y === 0 && t.x > 0)).toHaveLength(4);
    const double = placed.find(t => t.key === layoutChain({ deck: [deck[5]], firstTile: deck[5] }).tiles[0].key);
    expect(double.y).toBeLessThan(0);
    expect(double.rotation).toBe(0);
    expectNoOverlaps(placed);
  });

  it('lays 9 tiles in the rows after a corner', () => {
    const long = makeChain(27);
    const { tiles: placed } = layoutChain({ deck: long, firstTile: long[0] });
    // the second row of the right branch: horizontal tiles above the first row
    const rowY = -(TILE.long + 2);
    expect(placed.filter(t => t.y === rowY)).toHaveLength(9);
  });

  it('turns the right branch up and the left branch down', () => {
    const rightBranch = tiles.slice(1, 1 + deck.length - firstIdx - 1);
    const leftBranch = tiles.slice(1 + rightBranch.length);
    expect(Math.min(...rightBranch.map(t => t.y))).toBeLessThan(0);
    expect(Math.max(...rightBranch.map(t => t.y))).toBeLessThanOrEqual(0);
    expect(Math.max(...leftBranch.map(t => t.y))).toBeGreaterThan(0);
    expect(Math.min(...leftBranch.map(t => t.y))).toBeGreaterThanOrEqual(0);
  });

  it('orients tiles so that touching halves show equal values', () => {
    // the right branch walks in deck order: tile.left touches the previous tile.right
    const value = (p, dir) => {
      // dir: unit vector from tile center; returns the value shown on that half
      const big = Math.max(p.tile.left, p.tile.right);
      const small = Math.min(p.tile.left, p.tile.right);
      const up = { 0: [0, -1], 90: [1, 0], 180: [0, 1], [-90]: [-1, 0] }[p.rotation];
      return up[0] * dir[0] + up[1] * dir[1] > 0 ? big : small;
    };
    const first = tiles[0];
    const second = tiles[1];
    const dir = [Math.sign(first.x - second.x), Math.sign(first.y - second.y)];
    if (second.tile.left !== second.tile.right && (dir[0] === 0 || dir[1] === 0))
      expect(value(second, dir)).toBe(deck[firstIdx + 1].left);
  });

  it('adds ghost areas for the picked tile at both ends', () => {
    const picked = { left: deck[0].left, right: 0 };
    const res = layoutChain({ deck, firstTile: deck[firstIdx], pickedTile: picked });
    expect(res.ghosts.left).toBeDefined();
    expect(res.ghosts.right).toBeDefined();
    for (const t of res.tiles) {
      expect(overlap(t, res.ghosts.left)).toBe(false);
      expect(overlap(t, res.ghosts.right)).toBe(false);
    }
  });

  it('returns nothing without the first tile', () => {
    expect(layoutChain({ deck, firstTile: null }).tiles).toHaveLength(0);
  });
});

describe('ghost areas of a picked tile', () => {
  const inside = (p, b) => (
    p.x - p.w / 2 >= b.minX - GHOST_ROOM - 0.5 && p.x + p.w / 2 <= b.maxX + GHOST_ROOM + 0.5 &&
    p.y - p.h / 2 >= b.minY - GHOST_ROOM - 0.5 && p.y + p.h / 2 <= b.maxY + GHOST_ROOM + 0.5
  );

  it.each([1, 5, 12, 20, 27])('stay within one tile around a chain of %s tiles', n => {
    const deck = makeChain(n);
    for (let firstIdx = 0; firstIdx < deck.length; ++firstIdx) {
      for (const pickedTile of [{ left: 3, right: 4 }, { left: 5, right: 5 }]) {
        const { ghosts, tileBounds } = layoutChain({ deck, firstTile: deck[firstIdx], pickedTile });
        expect(inside(ghosts.left, tileBounds)).toBe(true);
        expect(inside(ghosts.right, tileBounds)).toBe(true);
      }
    }
  });

  it('do not change the placed tiles or their bounds', () => {
    const deck = makeChain(15);
    const args = { deck, firstTile: deck[6] };
    const plain = layoutChain(args);
    const picked = layoutChain({ ...args, pickedTile: { left: 2, right: 6 } });
    expect(picked.tiles).toEqual(plain.tiles);
    expect(picked.tileBounds).toEqual(plain.tileBounds);
    expect(picked.ghosts.left).toBeDefined();
    expect(picked.ghosts.right).toBeDefined();
  });
});

describe('stable placement', () => {
  const byKey = tiles => Object.fromEntries(tiles.map(t => [t.key, t]));

  // chains rich in doubles, so doubles land right after corners
  const doublesChain = () => {
    const chain = [];
    let v = 6;
    const used = new Set();
    const add = (l, r) => {
      const key = [Math.max(l, r), Math.min(l, r)].join('-');
      if (used.has(key)) return false;
      used.add(key);
      chain.push({ left: l, right: r });
      return true;
    };
    for (let next = 5; next >= 0; --next) {
      add(v, v);
      add(v, next);
      v = next;
    }
    add(0, 0);
    return chain;
  };

  it.each([['simple', makeChain(26)], ['with doubles', doublesChain()]])(
    'adding a tile never moves the placed ones (%s chain)',
    (_, deck) => {
      // the chain grows to the right from the first tile
      for (let n = 2; n <= deck.length; ++n) {
        const before = byKey(layoutChain({ deck: deck.slice(0, n - 1), firstTile: deck[0] }).tiles);
        const after = layoutChain({ deck: deck.slice(0, n), firstTile: deck[0] }).tiles;
        for (const t of after) if (before[t.key]) expect(t).toEqual(before[t.key]);
      }
    },
  );

  it.each([['simple', makeChain(26)], ['with doubles', doublesChain()]])(
    'a ghost area shows exactly where the tile is placed (%s chain)',
    (_, deck) => {
      for (let n = 1; n < deck.length; ++n) {
        const tile = deck[n];
        const { ghosts } = layoutChain({ deck: deck.slice(0, n), firstTile: deck[0], pickedTile: tile });
        const placed = byKey(layoutChain({ deck: deck.slice(0, n + 1), firstTile: deck[0] }).tiles);
        const actual = placed[ghosts.right.key];
        expect({ x: ghosts.right.x, y: ghosts.right.y, w: ghosts.right.w, h: ghosts.right.h })
          .toEqual({ x: actual.x, y: actual.y, w: actual.w, h: actual.h });
      }
    },
  );

  it('does not overlap a double placed right after a corner', () => {
    const deck = doublesChain();
    const { tiles } = layoutChain({ deck, firstTile: deck[0] });
    expectNoOverlaps(tiles);
  });
});

