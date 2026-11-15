import Link from 'next/link';
import { useSelector } from 'react-redux';
import { getRoundInfo, getSessionId, getSessionStatus, getWaitForPlayers } from '../../../storage/selectors';
import { isLocalSession } from '../../../engine/localServer';
import SessionContainer from './SessionContainer';
import styles from '../../../styles/gameSession/HeaderInfo.module.scss';

export default function HeaderInfoBar() {
  const waitForPlayers = useSelector(getWaitForPlayers);
  const roundInfo = useSelector(getRoundInfo);
  const sessionId = useSelector(getSessionId);
  const { bots } = useSelector(getSessionStatus);
  const local = isLocalSession(sessionId);
  const direct = local && roundInfo.players - (bots?.length ?? 0) > 1;

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

      {local ?
        <p className={styles.infoEntryBordered}>Mode: <span>{direct ? 'direct' : 'offline'}</span></p> :
        <SessionContainer id={sessionId} highlight={waitForPlayers} />
      }

      <Link className={styles.leaveBtn} href="/game-session">leave</Link>
    </div>
  );
}
