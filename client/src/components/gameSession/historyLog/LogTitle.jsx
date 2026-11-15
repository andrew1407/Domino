import styles from '../../../styles/gameSession/HistoryLog.module.scss';
const { logHeader } = styles;

export default function LogTitle() {
  return (
    <div className={logHeader}>
      <h1>Session log</h1>
    </div>
  );
};
