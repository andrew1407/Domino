// Classic domino rules (a port of the server's ClassicDominoService & ScoreKeeperService)

export const MoveState = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  SKIPPABLE: 'SKIPPABLE',
  DEAD_END: 'DEAD_END',
});

export const PLAYER_NAMES = ['Bobo', 'Sasik', 'Mavun', 'Ruzur'];

const tile = (left, right) => ({ left, right });
const isDouble = t => t.left === t.right;
const tileSum = t => t.left + t.right;

export const createDeck = () => {
  const deck = [];
  for (let left = 0; left <= 6; ++left)
    for (let right = 0; right <= left; ++right)
      deck.push(tile(left, right));
  return deck;
};

export const distributeTiles = (players, deck, random = Math.random) => {
  const stock = deck.map(t => ({ ...t }));
  const deckSize = players.length > 2 ? 5 : 7;
  const decks = {};
  for (const player of players) {
    decks[player] = [];
    for (let i = 0; i < deckSize; ++i) {
      const [picked] = stock.splice(Math.floor(random() * stock.length), 1);
      decks[player].push(picked);
    }
  }
  return [decks, stock];
};

export const pickFirstMove = decks => {
  let double = null;
  let heaviest = null;
  for (const player in decks)
    for (const t of decks[player]) {
      if (isDouble(t)) {
        if (!double || double.tile.left < t.left) double = { player, tile: t };
      } else if (!heaviest || tileSum(heaviest.tile) < tileSum(t)) {
        heaviest = { player, tile: t };
      }
    }
  const found = double ?? heaviest;
  return [found.player, { ...found.tile }];
};

export const checkMovePermission = (target, comparable, side) => (
  side === 'left' ?
    target.left === comparable.left || target.right === comparable.left :
    target.left === comparable.right || target.right === comparable.right
);

export const getEnds = common => [common[0], common[common.length - 1]];

const availableToMove = (deck, ends) => pickMove(deck, ends) !== null;

// the simplest bot tactic: put the first playable tile
export const pickMove = (deck, [leftEnd, rightEnd]) => {
  for (const t of deck) {
    if (checkMovePermission(t, leftEnd, 'left')) return [t, 'left'];
    if (checkMovePermission(t, rightEnd, 'right')) return [t, 'right'];
  }
  return null;
};

export const ableToPlay = (current, decks, stockSize, ends) => {
  if (stockSize) return MoveState.AVAILABLE;
  if (availableToMove(decks[current], ends)) return MoveState.AVAILABLE;
  const othersCan = Object.entries(decks)
    .some(([player, deck]) => player !== current && availableToMove(deck, ends));
  return othersCan ? MoveState.SKIPPABLE : MoveState.DEAD_END;
};

export const roundSumUp = (decks, currentScore) => {
  const roundScore = Object.fromEntries(
    Object.entries(decks).map(([p, deck]) => [p, deck.reduce((s, t) => s + tileSum(t), 0)])
  );
  const entries = Object.entries(roundScore);
  const [winner, minScore] = entries.reduce((cur, next) => (next[1] < cur[1] ? next : cur));
  const draw = entries.filter(([, s]) => s === minScore).length > 1;
  if (draw) return { scores: currentScore, winner: null };
  const gained = entries.reduce((sum, [p, s]) => (p !== winner ? sum + s : sum), 0);
  return { scores: { ...currentScore, [winner]: currentScore[winner] + gained }, winner };
};

export const checkWinner = (scores, finalScore) => {
  for (const player in scores)
    if (scores[player] >= finalScore) return player;
  return null;
};
