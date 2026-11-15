import { useCallback, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import ErrorMessageModal from '../modals/ErrorMessageModal';
import { createSession } from '../../api/http/session';
import { loadSettings, saveSettings } from '../../config/server';
import { applyStylesIf } from '../../tools';
import { isOnline } from '../../offline';
import styles from '../../styles/SessionOptions.module.scss';

const initialScore = 26;
const availablePlayers = [2, 3, 4];

const modes = {
  online: 'online (server)',
  peer: 'direct (no server)',
  offline: 'offline (bots)',
};

const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

const summary = (mode, humans, bots) => {
  if (mode === 'offline') return `You against ${plural(bots, 'bot')}, right in the browser.`;
  const players = plural(humans, 'human player') + (bots ? ` + ${plural(bots, 'bot')}` : '');
  if (mode === 'peer')
    return `${players}. This device hosts the game and other players connect to it directly ` +
      '(WebRTC): no game server, works on the same Wi-Fi or phone hotspot.';
  return players + (humans > 1 ? ': share the session ID with friends.' : '.');
};

export default function SessionCreator() {
  const router = useRouter();
  const [ errorMessage, setErrorMessage ] = useState('');
  const [ score, setScore ] = useState(initialScore);
  const [ players, setPlayers ] = useState(availablePlayers[0]);
  // online and direct games default to humans only; offline fills the free seats with bots
  const [ bots, setBots ] = useState(0);
  const [ mode, setMode ] = useState('online');
  const [ pending, setPending ] = useState(false);

  // without a connection only the game with bots works: switch to it, but keep the saved choice
  useEffect(() => {
    const sync = () => setMode(isOnline() ? loadSettings().mode : 'offline');
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  const offline = mode === 'offline';
  const botsCount = offline ? players - 1 : Math.min(bots, players - 1);
  const humans = players - botsCount;

  const pickMode = useCallback(m => {
    setMode(m);
    saveSettings({ mode: m });
  }, []);

  const closeErrorModal = useCallback(() => setErrorMessage(''), []);

  const setScoreParsed = useCallback(e => {
    const parsed = parseInt(e.target.value, 10);
    setScore(!isNaN(parsed) ? parsed : 0);
  }, []);

  const createNewSession = useCallback(async e => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const createdSession = await createSession(players, score, botsCount, mode);
      router.push({ pathname: '/game-session/play', query: { id: createdSession } });
    } catch (e) {
      setErrorMessage(e.message);
      setPending(false);
    }
  }, [score, players, botsCount, mode, pending]);

  return (
    <form className={styles.createOptionEntries} onSubmit={createNewSession}>
      <div className={styles.modeSelector}>
        {Object.entries(modes).map(([m, label]) => (
          <button
            key={m}
            type="button"
            className={applyStylesIf(m === mode, [styles.modeBtn, styles.modeBtnPicked], [styles.modeBtn])}
            onClick={() => pickMode(m)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.fieldRow}>
        <label htmlFor="players">Players:</label>
        <select id="players" value={players} onChange={e => setPlayers(parseInt(e.target.value, 10))}>
          {availablePlayers.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className={styles.fieldRow}>
        <label htmlFor="bots">Bots:</label>
        <select
          id="bots"
          value={botsCount}
          disabled={offline}
          onChange={e => setBots(parseInt(e.target.value, 10))}
        >
          {Array.from({ length: players }, (_, i) => i).map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      <div className={styles.fieldRow}>
        <label htmlFor="score">Finish score:</label>
        <input id="score" type="number" min="1" value={score} onChange={setScoreParsed} />
      </div>

      <p className={styles.summary}>{summary(mode, humans, botsCount)}</p>

      <input className={styles.optionsSubmitBtn} type="submit" value={pending ? 'creating…' : 'create'} disabled={pending} />

      <ErrorMessageModal
        visible={!!errorMessage}
        message={errorMessage}
        onClick={closeErrorModal}
      />
    </form>
  );
}
