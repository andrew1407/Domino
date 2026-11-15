/**
 * @jest-environment node
 */
import { layoutChain, TILE, GHOST_ROOM } from '../layout';

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

describe('snake layout', () => {
  const deck = makeChain(24);
  const firstIdx = 10;
  const halfRow = 500;
  const { tiles, bounds } = layoutChain({ deck, firstTile: deck[firstIdx], halfRow });

  it('places every tile', () => {
    expect(tiles).toHaveLength(deck.length);
    expect(tiles[0]).toMatchObject({ x: 0, y: 0 });
  });

  it.each([0, 3, 7, 10, 15, 22])('never overlaps tiles (first tile index %s, various widths)', firstIdx => {
    for (const halfRow of [300, 420, 500, 700, 950]) {
      const { tiles } = layoutChain({ deck, firstTile: deck[firstIdx], halfRow });
      for (let i = 0; i < tiles.length; ++i)
        for (let j = i + 1; j < tiles.length; ++j)
          expect(overlap(tiles[i], tiles[j])).toBe(false);
    }
  });

  it('never overlaps tiles', () => {
    for (let i = 0; i < tiles.length; ++i)
      for (let j = i + 1; j < tiles.length; ++j)
        expect(overlap(tiles[i], tiles[j])).toBe(false);
  });

  it('keeps rows within the board width', () => {
    expect(bounds.maxX).toBeLessThanOrEqual(halfRow + TILE.long + 2 * TILE.short + 10);
    expect(bounds.minX).toBeGreaterThanOrEqual(-halfRow - TILE.long - 2 * TILE.short - 10);
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
    const res = layoutChain({ deck, firstTile: deck[firstIdx], pickedTile: picked, halfRow });
    expect(res.ghosts.left).toBeDefined();
    expect(res.ghosts.right).toBeDefined();
    for (const t of res.tiles) {
      expect(overlap(t, res.ghosts.left)).toBe(false);
      expect(overlap(t, res.ghosts.right)).toBe(false);
    }
  });

  it('returns nothing without the first tile', () => {
    expect(layoutChain({ deck, firstTile: null, halfRow }).tiles).toHaveLength(0);
  });
});

describe('ghost areas of a picked tile', () => {
  const inside = (p, b) => (
    p.x - p.w / 2 >= b.minX - GHOST_ROOM - 0.5 && p.x + p.w / 2 <= b.maxX + GHOST_ROOM + 0.5 &&
    p.y - p.h / 2 >= b.minY - GHOST_ROOM - 0.5 && p.y + p.h / 2 <= b.maxY + GHOST_ROOM + 0.5
  );

  it.each([1, 5, 12, 20, 27])('stay within one tile around a chain of %s tiles', n => {
    const deck = makeChain(n);
    for (const halfRow of [250, 400, 700]) {
      for (let firstIdx = 0; firstIdx < deck.length; ++firstIdx) {
        for (const pickedTile of [{ left: 3, right: 4 }, { left: 5, right: 5 }]) {
          const { ghosts, tileBounds } = layoutChain({ deck, firstTile: deck[firstIdx], pickedTile, halfRow });
          expect(inside(ghosts.left, tileBounds)).toBe(true);
          expect(inside(ghosts.right, tileBounds)).toBe(true);
        }
      }
    }
  });

  it('do not change the placed tiles or their bounds', () => {
    const deck = makeChain(15);
    const args = { deck, firstTile: deck[6], halfRow: 400 };
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
      for (const halfRow of [250, 330, 520]) {
        // the chain grows to the right from the first tile
        for (let n = 2; n <= deck.length; ++n) {
          const before = byKey(layoutChain({ deck: deck.slice(0, n - 1), firstTile: deck[0], halfRow }).tiles);
          const after = layoutChain({ deck: deck.slice(0, n), firstTile: deck[0], halfRow }).tiles;
          for (const t of after) if (before[t.key]) expect(t).toEqual(before[t.key]);
        }
      }
    },
  );

  it.each([['simple', makeChain(26)], ['with doubles', doublesChain()]])(
    'a ghost area shows exactly where the tile is placed (%s chain)',
    (_, deck) => {
      for (const halfRow of [250, 330, 520]) {
        for (let n = 1; n < deck.length; ++n) {
          const tile = deck[n];
          const { ghosts } = layoutChain({ deck: deck.slice(0, n), firstTile: deck[0], pickedTile: tile, halfRow });
          const placed = byKey(layoutChain({ deck: deck.slice(0, n + 1), firstTile: deck[0], halfRow }).tiles);
          const actual = placed[ghosts.right.key];
          expect({ x: ghosts.right.x, y: ghosts.right.y, w: ghosts.right.w, h: ghosts.right.h })
            .toEqual({ x: actual.x, y: actual.y, w: actual.w, h: actual.h });
        }
      }
    },
  );

  it('does not overlap a double placed right after a corner', () => {
    const deck = doublesChain();
    for (const halfRow of [250, 330, 400, 520]) {
      const { tiles } = layoutChain({ deck, firstTile: deck[0], halfRow });
      for (let i = 0; i < tiles.length; ++i)
        for (let j = i + 1; j < tiles.length; ++j)
          expect(overlap(tiles[i], tiles[j])).toBe(false);
    }
  });
});

