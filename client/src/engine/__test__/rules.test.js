/**
 * @jest-environment node
 */
import {
  MoveState, createDeck, distributeTiles, pickFirstMove, pickMove,
  ableToPlay, roundSumUp, checkWinner,
} from '../rules';

const t = (left, right) => ({ left, right });

describe('domino rules', () => {
  it('creates a full double-six deck', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(28);
    expect(new Set(deck.map(x => `${x.left}-${x.right}`)).size).toBe(28);
  });

  it.each([[2, 7], [3, 5], [4, 5]])('distributes tiles for %s players', (players, size) => {
    const names = ['a', 'b', 'c', 'd'].slice(0, players);
    const [decks, stock] = distributeTiles(names, createDeck());
    for (const n of names) expect(decks[n]).toHaveLength(size);
    expect(stock).toHaveLength(28 - size * players);
  });

  it('picks the heaviest double for the first move', () => {
    const [player, tile] = pickFirstMove({ a: [t(6, 5), t(2, 2)], b: [t(4, 4), t(1, 0)] });
    expect(player).toBe('b');
    expect(tile).toEqual(t(4, 4));
  });

  it('picks the heaviest tile when there are no doubles', () => {
    expect(pickFirstMove({ a: [t(6, 5)], b: [t(4, 3)] })).toEqual(['a', t(6, 5)]);
  });

  it('bot puts the first playable tile', () => {
    const ends = [t(3, 1), t(2, 5)];
    expect(pickMove([t(0, 0), t(5, 6), t(3, 3)], ends)).toEqual([t(5, 6), 'right']);
    expect(pickMove([t(4, 3)], ends)).toEqual([t(4, 3), 'left']);
    expect(pickMove([t(0, 0)], ends)).toBeNull();
  });

  it('detects skippable moves and dead ends', () => {
    const ends = [t(3, 1), t(2, 5)];
    expect(ableToPlay('a', { a: [t(0, 0)], b: [t(5, 5)] }, 3, ends)).toBe(MoveState.AVAILABLE);
    expect(ableToPlay('a', { a: [t(0, 0)], b: [t(5, 5)] }, 0, ends)).toBe(MoveState.SKIPPABLE);
    expect(ableToPlay('a', { a: [t(0, 0)], b: [t(6, 6)] }, 0, ends)).toBe(MoveState.DEAD_END);
  });

  it('sums up a round', () => {
    const res = roundSumUp({ a: [], b: [t(6, 6)], c: [t(1, 0)] }, { a: 3, b: 0, c: 0 });
    expect(res).toEqual({ winner: 'a', scores: { a: 16, b: 0, c: 0 } });
    expect(roundSumUp({ a: [t(1, 0)], b: [t(0, 1)] }, { a: 0, b: 0 }).winner).toBeNull();
    expect(checkWinner({ a: 16, b: 0 }, 15)).toBe('a');
    expect(checkWinner({ a: 14, b: 0 }, 15)).toBeNull();
  });
});
