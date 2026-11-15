import { useSelector } from 'react-redux';
import PlayerInfo from './PlayerInfo';
import { getJoinedPlayers, getCurentPlayer, getRoundInfo, getSessionStatus } from '../../../storage/selectors';
import styles from '../../../styles/gameSession/PlayersList.module.scss';

export default function PlayersList() {
  const players = useSelector(getJoinedPlayers);
  const currentPlayer = useSelector(getCurentPlayer);
  const { currentMove } = useSelector(getRoundInfo);
  const { bots } = useSelector(getSessionStatus);

  return (
    <div
      className={styles.playersListContainer}
      data-players={players.length}
      style={{ '--players': Math.max(players.length, 1) }}
    >
      {players.map(p => (
        <PlayerInfo
          key={p.name}
          {...p}
          you={p.name === currentPlayer}
          bot={bots.includes(p.name)}
          active={p.name === currentMove}
        />
      ))}
    </div>
  );
}
