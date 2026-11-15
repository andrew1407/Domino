import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { getCurentPlayer, getSessionStatus } from '../../storage/selectors';
import styles from '../../styles/modals/RoundResultModal.module.scss';

export default function RoundResultModal() {
  const { lastRound, finished, interrupted, unavailable, connectionClosed, bots } = useSelector(getSessionStatus);
  const you = useSelector(getCurentPlayer);
  const [ dismissed, setDismissed ] = useState(null);

  // round results close automatically (a new round starts in a couple of seconds)
  useEffect(() => {
    if (!lastRound || lastRound.endGame) return;
    const timer = setTimeout(() => setDismissed(lastRound), 2500);
    return () => clearTimeout(timer);
  }, [lastRound]);

  const closedUnexpectedly = connectionClosed && !finished;
  const showRound = lastRound && dismissed !== lastRound;
  if (!(interrupted || closedUnexpectedly || showRound)) return null;

  if (interrupted || closedUnexpectedly) return (
    <div className={styles.background}>
      <div className={styles.modal} role="dialog">
        <h1>{unavailable ? 'Game unavailable' : 'Game interrupted'}</h1>
        <p>{interrupted ?? 'The connection to the game server has been closed.'}</p>
        <div className={styles.actions}>
          <Link className={styles.btn} href="/game-session">{unavailable ? 'new game' : 'back to menu'}</Link>
        </div>
      </div>
    </div>
  );

  const { winner, scores, endGame, deadEnd, round } = lastRound;
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  let title = winner ? `${winner === you ? 'You' : winner} won round ${round}` : `Round ${round}: draw`;
  if (endGame) title = winner === you ? 'You won the game!' : `${winner} won the game`;

  return (
    <div className={styles.background}>
      <div className={styles.modal} role="dialog">
        <h1>{title}</h1>
        {deadEnd && <p className={styles.note}>The round was blocked: nobody could move.</p>}
        <table className={styles.scores}>
          <tbody>
            {sorted.map(([name, score]) => (
              <tr key={name} className={name === winner ? styles.winner : undefined}>
                <td>
                  {name}
                  {name === you && <small> (you)</small>}
                  {bots.includes(name) && <small> bot</small>}
                </td>
                <td>{score}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className={styles.actions}>
          {endGame ?
            <Link className={styles.btn} href="/game-session">new game</Link> :
            <button className={styles.btn} onClick={() => setDismissed(lastRound)}>continue</button>
          }
        </div>
      </div>
    </div>
  );
}
