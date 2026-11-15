import { applyStyles, assetPath } from '../../../tools';
import styles from '../../../styles/gameSession/PlayersList.module.scss';

export default function PlayerInfo({ name, score, tiles, you, bot, active }) {
  return (
    <div
      className={applyStyles(styles.playerBlock, active && styles.activePlayer)}
      data-testid="player-info"
      title={`${name}${you ? ' (you)' : ''}${bot ? ' – bot' : ''}${active ? ': makes a move' : ''}`}
    >
      <div className={styles.nameBlock}>
        {active && <span className={styles.turnMarker}>▶</span>}
        <span className={applyStyles(styles.nameInfo, you && styles.setPlayer)}>{name}</span>
        {you && <small className={styles.youTag}>(you)</small>}
        {bot && <small className={styles.botTag}>bot</small>}
      </div>
      <div className={styles.infoEntries}>
        <span>{score}</span>
        <img className={styles.scoreImg} src={assetPath('/static/score.png')} alt="score" />
      </div>
      <span className={styles.separator}>|</span>
      <div className={styles.infoEntries}>
        <span>{tiles}</span>
        <img className={styles.tilesImg} src={assetPath('/static/tile.png')} alt="tiles" />
      </div>
    </div>
  );
};
