import { useCallback, useState } from 'react';
import { assetPath, applyStylesIf } from '../../../tools';
import { httpUrl, isLocalAddress, wsUrl } from '../../../config/server';
import styles from '../../../styles/gameSession/HeaderInfo.module.scss';

// the link carries the server address, unless it is "localhost" (which would
// point the friend to their own machine): then the friend's settings are used
export const makeShareLink = id => {
  const http = httpUrl('');
  const ws = wsUrl('');
  const url = new URL(window.location.href);
  const params = { id };
  if (!isLocalAddress(http) && !isLocalAddress(ws)) Object.assign(params, { http, ws });
  url.search = new URLSearchParams(params).toString();
  url.hash = '';
  return url.toString();
};

export default function SessionContainer({ id, highlight }) {
  const [ copied, setCopied ] = useState('');

  const copy = useCallback(async (text, what) => {
    try {
      await navigator.clipboard?.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      setCopied('');
    }
  }, []);

  if (!id) return null;

  return (
    <div className={applyStylesIf(highlight, [styles.sessionComponent, styles.sessionHighlight], [styles.sessionComponent])}>
      <button type="button" title={id} onClick={() => copy(id, 'id')}>
        <img src={assetPath('/static/clipboard.png')} width={22} height={22} alt="" />
        {copied === 'id' ? 'copied!' : 'session ID'}
      </button>
      <button type="button" onClick={() => copy(makeShareLink(id), 'link')}>
        {copied === 'link' ? 'copied!' : 'invite link'}
      </button>
    </div>
  );
}
