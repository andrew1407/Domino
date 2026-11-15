import { useSelector } from 'react-redux';
import { getSessionId, getSessionStatus, getWaitForPlayers } from '../../../storage/selectors';
import { getLocalServer, isLocalSession } from '../../../engine/localServer';
import ConnectionLoading from './ConnectionLoading';
import TilesTable from './TilesTable';
import PeerInvites from '../../peer/PeerInvites';
import styles from '../../../styles/gameSession/DominoBoard.module.scss';

// this page hosts a peer-to-peer game with remote seats
const hostsPeerGame = id => {
  if (!isLocalSession(id)) return false;
  const info = getLocalServer().getSession(id);
  return !!info && info.players - info.bots > 1;
};

export default function DominoBoard() {
  const waitForPlayers = useSelector(getWaitForPlayers);
  const sessionId = useSelector(getSessionId);
  const { joined } = useSelector(getSessionStatus);

  const waitingScreen = joined && hostsPeerGame(sessionId) ?
    <div className={styles.peerWaiting}><PeerInvites /></div> :
    <ConnectionLoading
      title={joined ? 'Waiting for players...' : 'Connecting...'}
      hint={joined && !isLocalSession(sessionId) ? 'Share the session ID or the invite link (top right) with your friends.' : undefined}
    />;

  return (
    <div className={styles.boardContainer}>
      {waitForPlayers ? waitingScreen : <TilesTable />}
    </div>
  );
}
