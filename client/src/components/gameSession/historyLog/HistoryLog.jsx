import { useEffect, useLayoutEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useVirtualizer } from '@tanstack/react-virtual';
import { getLog } from '../../../storage/selectors';
import { applyStyles } from '../../../tools';
import styles from '../../../styles/gameSession/HistoryLog.module.scss';

const ESTIMATED_ROW = 40;
const STICK_DISTANCE = 60;

// virtualized log: only visible messages are rendered, rows are measured (they may wrap)
export default function HistoryLog() {
  const containerRef = useRef(null);
  const stickToBottom = useRef(true);
  const logMessages = useSelector(getLog);
  const count = logMessages.length;

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ESTIMATED_ROW,
    overscan: 8,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onScroll = () => {
      const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
      stickToBottom.current = distance < STICK_DISTANCE;
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  // follow new messages unless the user scrolled up to read the history
  useLayoutEffect(() => {
    if (count && stickToBottom.current)
      virtualizer.scrollToIndex(count - 1, { align: 'end' });
  }, [count]);

  return (
    <div ref={containerRef} className={styles.logContainer} data-testid="session-log">
      <div className={styles.logInner} style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(row => (
          <p
            key={row.key}
            data-index={row.index}
            ref={virtualizer.measureElement}
            className={applyStyles(styles.logMessage, row.index === count - 1 && styles.lastMessage)}
            style={{ transform: `translateY(${row.start}px)` }}
          >
            {logMessages[row.index]}
          </p>
        ))}
      </div>
    </div>
  );
}
