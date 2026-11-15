import Head from 'next/head';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useRef, useState } from 'react';
import MainWrapper from '../../components/main/MainWrapper';
import CodeBox from '../../components/peer/CodeBox';
import { answerInvite, isPeerSupported, parseInvite, setGuestChannel } from '../../p2p/peer';
import styles from '../../styles/Peer.module.scss';

// a guest of a peer-to-peer game: answers the host's invite
export default function PeerJoinPage() {
  const router = useRouter();
  const [ input, setInput ] = useState('');
  const [ state, setState ] = useState({ status: 'idle' });
  const answer = useRef(null);

  const join = useCallback(async code => {
    if (!isPeerSupported()) {
      setState({ status: 'idle', error: 'This browser does not support direct (WebRTC) connections.' });
      return;
    }
    answer.current?.close();
    setState({ status: 'answering' });
    try {
      const res = await answerInvite(code);
      answer.current = res;
      setState({ status: 'waiting', reply: res.code });
      const channel = await res.channel;
      setGuestChannel(res.sessionId, channel);
      answer.current = null;
      router.replace({ pathname: '/game-session/play', query: { id: res.sessionId } });
    } catch (e) {
      answer.current?.close();
      answer.current = null;
      setState({ status: 'idle', error: e.message });
    }
  }, []);

  useEffect(() => {
    const invite = parseInvite(window.location.hash);
    if (invite) join(invite);
    return () => answer.current?.close();
  }, []);

  const submit = useCallback(e => {
    e.preventDefault();
    const invite = parseInvite(input);
    if (invite) join(invite);
    else setState({ status: 'idle', error: 'Paste the invite link or code sent by the host.' });
  }, [input]);

  return (
    <MainWrapper>
      <Head>
        <title>Domino: join a direct game</title>
      </Head>

      <div className={styles.joinPage}>
        <h1>Join a direct game</h1>

        {state.status === 'answering' && <p className={styles.muted}>Preparing the reply…</p>}

        {state.status === 'waiting' && (
          <>
            <p>
              <b>1.</b> Send this reply code back to the host (any messenger works).<br />
              <b>2.</b> Keep this page open: the game starts when the host pastes the code.
            </p>
            <CodeBox value={state.reply} label="reply code" shareTitle="Domino reply code" />
            <p className={styles.muted}>Waiting for the host…</p>
          </>
        )}

        {state.status === 'idle' && (
          <form className={styles.replyForm} onSubmit={submit}>
            <input
              type="text"
              spellCheck="false"
              placeholder="invite link or code"
              aria-label="invite"
              value={input}
              onChange={e => setInput(e.target.value)}
            />
            <button type="submit" className={styles.primaryBtn}>join</button>
          </form>
        )}

        {state.error && <p className={styles.error}>{state.error}</p>}
      </div>
    </MainWrapper>
  );
}
