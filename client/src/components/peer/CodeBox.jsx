import { useCallback, useEffect, useState } from 'react';
import { canShare, copyText, shareText } from './share';
import styles from '../../styles/Peer.module.scss';

// a read-only connection code (or link) with copy/share buttons
export default function CodeBox({ value, label, shareTitle = 'Domino' }) {
  const [ copied, setCopied ] = useState(false);
  const [ shareable, setShareable ] = useState(false);

  const copy = useCallback(async () => {
    if (!(await copyText(value))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [value]);

  useEffect(() => setShareable(canShare()), []);

  const share = useCallback(() => shareText(shareTitle, value), [value, shareTitle]);

  return (
    <div className={styles.codeBox}>
      <textarea
        readOnly
        aria-label={label}
        value={value}
        rows={3}
        spellCheck="false"
        onFocus={e => e.target.select()}
      />
      <div className={styles.codeActions}>
        <button type="button" className={styles.btn} onClick={copy}>{copied ? 'copied!' : `copy ${label}`}</button>
        {shareable && <button type="button" className={styles.btn} onClick={share}>share…</button>}
      </div>
    </div>
  );
}
