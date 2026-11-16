import MainWrapper from '../main/MainWrapper';
import HeaderInfoBar from './headerInfo/HeaderInfoBar';
import PlayersList from './playersList/PlayersList';
import LogTitle from './historyLog/LogTitle';
import HistoryLog from './historyLog/HistoryLog';
import DominoBoard from './dominoBoard/DominoBoard';
import PlayerDeck from './playerDeck/PlayerDeck';
import styles from '../../styles/gameSession/GameSession.module.scss';


export default function GameSession() {
  return (
    <MainWrapper HeaderInfo={HeaderInfoBar}>
      <div className={styles.sessionEntriesBlock}>
        {/* players, board & deck: one screen on phones/tablets, log below */}
        <div className={styles.playArea}>
          <PlayersList />
          <DominoBoard />
          <PlayerDeck />
        </div>
        <LogTitle />
        <HistoryLog />
      </div>
    </MainWrapper>
  );
};
