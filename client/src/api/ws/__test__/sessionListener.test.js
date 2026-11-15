import SessionListener from '../sessionListener';
import { canPlaceTile } from '../../../tools';

const handlers = () => new Proxy({}, { get: (t, k) => (t[k] ??= jest.fn()) });

describe('session listener', () => {
  it('starts a round without a current mover', () => {
    const state = handlers();
    new SessionListener(state).roundStart({
      name: 'Bobo', deck: [], round: 2, stock: 14, players: 2, score: 50,
      current_move: 'Bobo', scores: { Bobo: 10, Sasik: 0 }, tilesCount: { Bobo: 7, Sasik: 7 },
    });
    expect(state.setRoundInfo).toHaveBeenCalledWith(expect.objectContaining({ currentMove: null, currentRound: 2 }));
  });
});

describe('turn tracking', () => {
  const moveData = {
    current_move: 'Bobo', tile: { left: 6, right: 6 }, commonDeck: [{ left: 6, right: 6 }],
    round: 1, stock: 14, players: 2, score: 50, scores: { Bobo: 0, Sasik: 0 }, tilesCount: { Bobo: 6, Sasik: 7 },
  };

  it.each(['moveAction', 'firstMove'])('ends the turn after %s until the next player is named', event => {
    const state = handlers();
    new SessionListener(state)[event](moveData);
    expect(state.setRoundInfo).toHaveBeenCalledWith(expect.objectContaining({ currentMove: null }));
    expect(state.addToLog).toHaveBeenCalledWith(expect.stringContaining('Player "Bobo" made a'));
  });

  it('keeps the turn after a tile is taken from the stock', () => {
    const state = handlers();
    new SessionListener(state).fromStock(moveData);
    expect(state.setRoundInfo).toHaveBeenCalledWith(expect.objectContaining({ currentMove: 'Bobo' }));
  });
});

describe('canPlaceTile', () => {
  const deck = [{ left: 2, right: 5 }, { left: 5, right: 6 }];

  it('matches the end values of the chain', () => {
    expect(canPlaceTile({ left: 1, right: 2 }, deck, 'left')).toBe(true);
    expect(canPlaceTile({ left: 2, right: 1 }, deck, 'left')).toBe(true);
    expect(canPlaceTile({ left: 1, right: 2 }, deck, 'right')).toBe(false);
    expect(canPlaceTile({ left: 6, right: 0 }, deck, 'right')).toBe(true);
  });

  it('rejects missing tiles and an empty chain', () => {
    expect(canPlaceTile(null, deck, 'left')).toBe(false);
    expect(canPlaceTile({ left: 1, right: 2 }, [], 'left')).toBe(false);
  });
});
