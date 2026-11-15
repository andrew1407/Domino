const tileStr = t => (t ? `[${t.left}|${t.right}]` : '');

export default class SessionListener {
  #gameState = null;

  constructor(gameState) {
    this.#gameState = gameState;
  }

  error(data, status) {
    if (status === 'SERVER_CLOSED') {
      this.#gameState?.setSessionStatus({ interrupted: 'The game server has been stopped.' });
      return;
    }
    if (status === 'MOVE_UNAVAILABLE') return;
    if (status === 'SESSION_NOT_EXISTS' || status === 'PLAYERS_LIMIT_REACHED') {
      this.#gameState?.setSessionStatus({
        unavailable: true,
        interrupted: status === 'SESSION_NOT_EXISTS' ?
          'This game session does not exist anymore: it has finished, or it was an offline/direct game and a page was reloaded.' :
          'This game session is already full.',
      });
      return;
    }
    if (status === 'EMPTY_STOCK') {
      this.#gameState?.addToLog('The stock is empty.');
      return;
    }
    const errorMesasge = `${status}: ${data}`;
    this.#gameState?.setErrorMessage(errorMesasge);
  }

  interruptedSession(data) {
    const message = `Player "${data.name}" has left: the game session is interrupted.`;
    this.#gameState?.addToLog(message);
    this.#gameState?.setSessionStatus({ interrupted: message });
  }

  joinSession(data) {
    this.#gameState?.setCurrentPlayer(data.name);
    this.#gameState?.setSessionStatus({ bots: data.bots ?? [], joined: true });
    this.#gameState?.setRoundInfo({
      players: data.players,
      finalScore: data.score,
      currentRound: data.round,
      stock: 0,
    });
    const playersData = Object.keys(data.scores).map(p => ({
      name: p, score: data.scores[p] ?? 0, tiles: 0
    }));
    this.#gameState?.setJoinedPlayers(playersData);
    this.#gameState?.addToLog(`You have joined the session as "${data.name}".`);
  }

  leaveSession(data) {
    this.#gameState?.removeJoinedPlayer(data.name);
    this.#gameState?.addToLog(`Player "${data.name}" has left the current session.`);
  }

  sessionNewcomer(data) {
    this.#gameState?.addJoinedPlayer(data.name);
    this.#gameState?.addToLog(`Player "${data.name}" has joined the current session.`);
  }

  moveAction(data) {
    if (data.deck) this.#gameState?.setPlayerDeck(data.deck);
    this.#gameState?.setCommonDeck(data.commonDeck);
    this.#gameState?.clearPickedTile();
    const logMessage = `Player "${data.current_move}" made a move with a tile ${tileStr(data.tile)}.`;
    // the turn is over: nobody moves until "nextMove" names the next player
    this.#setMainStateValues({ ...data, current_move: null }, logMessage);
  }

  fromStock(data) {
    if (data.deck) this.#gameState?.setPlayerDeck(data.deck);
    this.#gameState?.setCommonDeck(data.commonDeck);
    const logMessage = `Player "${data.current_move}" took a tile from the stock.`;
    this.#setMainStateValues(data, logMessage);
  }

  endRound(data) {
    const { winner, scores, endGame, deadEnd, round } = data;
    if (deadEnd) this.#gameState?.addToLog('Nobody can make a move: the round is blocked.');
    const winMessage = winner ?
      `Player "${winner}" won round ${round} and has ${scores[winner]} points.` :
      `Round ${round} ended with a draw.`;
    this.#gameState?.addToLog(winMessage);
    this.#gameState?.updateScores(scores);
    this.#gameState?.setCurrentMove(null);
    this.#gameState?.setSessionStatus({
      lastRound: { winner: winner ?? null, scores, endGame, deadEnd: !!deadEnd, round },
      finished: !!endGame,
    });
    if (endGame)
      this.#gameState?.addToLog(`Player "${winner}" won the game with the score ${scores[winner]}.`);
  }

  roundStart(data) {
    this.#gameState?.setCurrentPlayer(data.name);
    this.#gameState?.setPlayerDeck(data.deck);
    this.#gameState?.setCommonDeck([]);
    this.#gameState?.setFirstTile(null);
    this.#gameState?.clearPickedTile();
    const logMessage = `Round ${data.round} has started.`;
    // current_move still names the last mover of the previous round
    this.#setMainStateValues({ ...data, current_move: null }, logMessage);
  }

  firstMove(data) {
    if (data.deck) this.#gameState?.setPlayerDeck(data.deck);
    this.#gameState?.setCommonDeck(data.commonDeck);
    this.#gameState?.setFirstTile(data.commonDeck[0]);
    const logMessage = `Player "${data.current_move}" made a first move with a tile ${tileStr(data.tile)}.`;
    this.#setMainStateValues({ ...data, current_move: null }, logMessage);
  }

  nextMove(data) {
    const { name, skippedBy } = data;
    if (skippedBy)
      this.#gameState?.addToLog(`Player "${skippedBy}" is unable to make a move and skips it.`);
    this.#gameState?.setCurrentMove(name);
    this.#gameState?.addToLog(`The next move is for player "${name}".`);
  }

  #setMainStateValues(data, logMessage) {
    this.#gameState?.setRoundInfo({
      stock: data.stock,
      players: data.players,
      finalScore: data.score,
      currentRound: data.round,
      currentMove: data.current_move,
    });
    const playersData = Object.keys(data.tilesCount).map(p => ({
      name: p,
      score: data.scores[p],
      tiles: data.tilesCount[p],
    }));
    this.#gameState?.setJoinedPlayers(playersData);
    this.#gameState?.addToLog(logMessage);
  }
}
