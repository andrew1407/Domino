import Link from 'next/link';
import { useSelector } from 'react-redux';
import { getRoundInfo, getSessionId, getWaitForPlayers } from '../../../storage/selectors';
import { isLocalSession } from '../../../engine/localServer';
import SessionContainer from './SessionContainer';
import styles from '../../../styles/gameSession/HeaderInfo.module.scss';

export default function HeaderInfoBar() {
  const waitForPlayers = useSelector(getWaitForPlayers);
  const roundInfo = useSelector(getRoundInfo);
  const sessionId = useSelector(getSessionId);
  const local = isLocalSession(sessionId);

  return (
    <div className={styles.headerInfoContainer}>
      <p className={styles.infoEntryBordered}>Final score:
        <span> {roundInfo.finalScore || '–'}</span>
      </p>

      <p className={styles.infoEntryBordered}>Players:
        <span> {roundInfo.players || '–'}</span>
      </p>

      <p className={styles.infoEntryBordered}>Round:
        <span> {roundInfo.currentRound || '–'}</span>
      </p>

      {!local && <SessionContainer id={sessionId} highlight={waitForPlayers} />}

      <Link className={styles.leaveBtn} href="/game-session">leave</Link>
    </div>
  );
}
