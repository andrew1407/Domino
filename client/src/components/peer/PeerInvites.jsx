import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { getSessionId } from '../../storage/selectors';
import { getLocalServer } from '../../engine/localServer';
import { createInvite, makeInviteLink } from '../../p2p/peer';
import CodeBox from './CodeBox';
import styles from '../../styles/Peer.module.scss';

const statusText = {
  creating: 'preparing the invite…',
  waiting: 'send the link, then paste the reply code',
  connecting: 'connecting…',
  joined: 'connected',
};

function InviteSlot({ index, sessionId, onJoined }) {
  const [ slot, setSlot ] = useState({ status: 'idle' });
  const [ reply, setReply ] = useState('');
  const invite = useRef(null);

  useEffect(() => () => {
    if (invite.current && !invite.current.joined) invite.current.close();
  }, []);

  const create = useCallback(async () => {
    setSlot({ status: 'creating' });
    setReply('');
    try {
      invite.current = await createInvite(sessionId);
      setSlot({ status: 'waiting', link: makeInviteLink(invite.current.code) });
    } catch (e) {
      setSlot({ status: 'idle', error: e.message });
    }
  }, [sessionId]);

  const connect = useCallback(async e => {
    e.preventDefault();
    if (!reply.trim() || !invite.current) return;
    setSlot(s => ({ ...s, status: 'connecting', error: '' }));
    try {
      const channel = await invite.current.accept(reply);
      invite.current.joined = true;
      getLocalServer().accept(channel);
      channel.addEventListener('close', () => setSlot({ status: 'idle', error: 'The player has disconnected.' }));
      setSlot({ status: 'joined' });
      onJoined?.();
    } catch (err) {
      if (err.retryable) {
        // a wrong code: the guest's reply still fits this invite
        setSlot(s => ({ ...s, status: 'waiting', error: err.message }));
        return;
      }
      invite.current?.close();
      invite.current = null;
      setSlot({ status: 'idle', error: err.message });
    }
  }, [reply, onJoined]);

  return (
    <li className={styles.slot}>
      <div className={styles.slotHead}>
        <b>Player {index + 2}</b>
        {statusText[slot.status] && (
          <span className={slot.status === 'joined' ? styles.ok : styles.muted}>{statusText[slot.status]}</span>
        )}
      </div>

      {slot.error && <p className={styles.error}>{slot.error}</p>}

      {slot.status === 'idle' && (
        <button type="button" className={styles.primaryBtn} onClick={create}>create invite</button>
      )}

      {(slot.status === 'waiting' || slot.status === 'connecting') && (
        <>
          <CodeBox value={slot.link} label="link" shareTitle="Join my Domino game" />
          <form className={styles.replyForm} onSubmit={connect}>
            <input
              type="text"
              spellCheck="false"
              placeholder="reply code from the player"
              aria-label="reply code"
              value={reply}
              onChange={e => setReply(e.target.value)}
              disabled={slot.status === 'connecting'}
            />
            <button type="submit" className={styles.primaryBtn} disabled={slot.status === 'connecting' || !reply.trim()}>
              connect
            </button>
          </form>
        </>
      )}
    </li>
  );
}

// host panel of a peer-to-peer game: an invite per remote seat
export default function PeerInvites() {
  const sessionId = useSelector(getSessionId);
  const [ seats, setSeats ] = useState(0);

  useEffect(() => {
    const info = getLocalServer().getSession(sessionId);
    if (info) setSeats(info.players - info.bots - 1);
  }, [sessionId]);

  if (!seats) return null;

  return (
    <div className={styles.invites} data-testid="peer-invites">
      <h2>Invite players</h2>
      <p className={styles.muted}>
        Each player opens their link on their own device and sends you back a reply code.
        Keep this page open: it hosts the game.
      </p>
      <ol className={styles.slots}>
        {Array.from({ length: seats }, (_, i) => (
          <InviteSlot key={i} index={i} sessionId={sessionId} />
        ))}
      </ol>
    </div>
  );
}
