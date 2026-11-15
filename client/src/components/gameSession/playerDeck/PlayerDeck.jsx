import { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { getCommonDeck, getCurentPlayer, getPickedTile, getPlayerDeck, getRoundInfo, getSessionEmitter, getSessionStatus } from '../../../storage/selectors';
import { applyStyles, canPlaceTile, getTileImagePath, tilesEqual } from '../../../tools';
import { setPickedTile, clearPickedTile } from '../../../storage/actions/pickedTile';
import styles from '../../../styles/gameSession/PlayerDeck.module.scss';

export default function PlayerDeck() {
  const dispatch = useDispatch();
  const { stock, currentMove } = useSelector(getRoundInfo);
  const deck = useSelector(getPlayerDeck);
  const commonDeck = useSelector(getCommonDeck);
  const pickedTile = useSelector(getPickedTile);
  const sessionEmitter = useSelector(getSessionEmitter);
  const currentPlayer = useSelector(getCurentPlayer);
  const { finished, interrupted } = useSelector(getSessionStatus);
  const myMove = !!currentPlayer && currentMove === currentPlayer;
  const playable = deck.filter(t => canPlaceTile(t, commonDeck, 'left') || canPlaceTile(t, commonDeck, 'right'));

  const pickTile = useCallback(tile => {
    if (tilesEqual(tile, pickedTile)) dispatch(clearPickedTile());
    else dispatch(setPickedTile(tile));
  }, [pickedTile]);

  const fromStock = useCallback(() => {
    sessionEmitter?.takeFromStock();
  }, [sessionEmitter]);

  const place = useCallback(side => {
    if (pickedTile) sessionEmitter?.moveAction(side, pickedTile);
  }, [sessionEmitter, pickedTile]);

  const canLeft = myMove && canPlaceTile(pickedTile, commonDeck, 'left');
  const canRight = myMove && canPlaceTile(pickedTile, commonDeck, 'right');

  let status = currentMove ? `${currentMove} is moving…` :
    commonDeck.length ? 'Next turn…' : 'Waiting for the round…';
  if (finished) status = 'Game over.';
  else if (interrupted) status = 'The game is interrupted.';
  if (myMove) {
    if (pickedTile) status = canLeft || canRight ? 'Place the tile:' : 'This tile does not fit.';
    else if (playable.length) status = 'Your move: pick a tile.';
    else status = stock ? 'Nothing fits: take a tile from the stock.' : 'Nothing fits.';
  }

  return (
    <div className={styles.deckContainer}>
      <div className={styles.controls}>
        <p className={applyStyles(styles.status, myMove && styles.statusActive)}>{status}</p>
        <div className={styles.buttons}>
          <button className={styles.actionBtn} onClick={() => place('left')} disabled={!canLeft}>◀ left end</button>
          <button className={styles.actionBtn} onClick={() => place('right')} disabled={!canRight}>right end ▶</button>
          <button className={styles.stockBtn} onClick={fromStock} disabled={!myMove || !stock}>
            stock <b>({stock})</b>
          </button>
        </div>
      </div>

      <div className={styles.tilesContainer}>
        {deck.map(t => {
          const picked = tilesEqual(pickedTile, t);
          const fits = myMove && playable.includes(t);
          return (
            <img
              className={applyStyles(
                picked ? styles.pickedTileContainer : styles.tileContainer,
                fits && styles.playableTile,
              )}
              onClick={() => pickTile(t)}
              key={JSON.stringify(t)}
              src={getTileImagePath(t)}
              alt={`${t.left}|${t.right}`}
              data-testid="deck-tile"
            />
          );
        })}
      </div>
    </div>
  );
}
