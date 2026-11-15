import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { INVITE_PATH, parseInvite } from '../../p2p/peer';
import styles from '../../styles/SessionOptions.module.scss';

// a session ID, or an invite link: its server address (if any) is kept, so the
// player joins on the host's server
export const parseSessionQuery = input => {
  const value = String(input ?? '').trim();
  if (!value) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return { id: value };
  }
  const id = url.searchParams.get('id');
  if (!id) return { id: value };
  const query = { id };
  const http = url.searchParams.get('http');
  const ws = url.searchParams.get('ws');
  if (http && ws) Object.assign(query, { http, ws });
  return query;
};

export default function SessionSearch() {
  const router = useRouter();
  const sessionInput = useRef();
  const [ sessionId, setSessionId ] = useState('');

  const joinSession = useCallback(e => {
    e.preventDefault();
    const invite = parseInvite(sessionId);
    if (invite) {
      router.push(`${INVITE_PATH}#invite=${invite}`);
      return;
    }
    const query = parseSessionQuery(sessionId);
    if (!query) return;
    router.push({ pathname: '/game-session/play', query });
  }, [sessionId]);

  useEffect(() => sessionInput.current?.focus(), []);

  return (
    <form className={styles.joinOptionEntries} onSubmit={joinSession}>
      <label htmlFor="session-id">Session ID, invite link or code:</label>
      <input
        id="session-id"
        ref={sessionInput}
        type="text"
        spellCheck="false"
        value={sessionId}
        onChange={e => setSessionId(e.target.value)}
      />
      <input className={styles.optionsSubmitBtn} type="submit" value="join"/>
    </form>
  );
}
