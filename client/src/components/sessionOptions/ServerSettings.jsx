import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, httpUrl, turnMissingLogin, badServerUrls } from '../../config/server';
import { pingServer } from '../../api/http/commands';
import styles from '../../styles/ServerSettings.module.scss';

const statusText = {
  idle: '',
  checking: 'checking…',
  online: 'server is reachable',
  offline: 'server is unreachable',
};

export default function ServerSettings({ onChange }) {
  const [ settings, setSettings ] = useState(DEFAULT_SETTINGS);
  const [ status, setStatus ] = useState('idle');
  const [ saved, setSaved ] = useState(false);

  const check = useCallback(async () => {
    setStatus('checking');
    setStatus((await pingServer()) ? 'online' : 'offline');
  }, []);

  useEffect(() => {
    setSettings(loadSettings());
    check();
  }, []);

  const update = useCallback((key, value) => {
    setSaved(false);
    setSettings(s => ({ ...s, [key]: value }));
  }, []);

  const save = useCallback(e => {
    e.preventDefault();
    const next = saveSettings(settings);
    setSettings(next);
    setSaved(true);
    onChange?.(next);
    check();
  }, [settings, onChange]);

  const reset = useCallback(() => {
    // only what this form edits: the chosen game mode stays
    const { httpAddr, wsAddr, stun, stunUrl, turnUrl, turnUser, turnPass } = DEFAULT_SETTINGS;
    const next = saveSettings({ httpAddr, wsAddr, stun, stunUrl, turnUrl, turnUser, turnPass });
    setSettings(next);
    setSaved(true);
    onChange?.(next);
    check();
  }, [onChange]);

  return (
    <form className={styles.settings} onSubmit={save}>
      <div className={styles.row}>
        <label htmlFor="srv-http">HTTP API:</label>
        <input
          id="srv-http"
          type="text"
          spellCheck="false"
          placeholder="localhost:8080"
          value={settings.httpAddr}
          onChange={e => update('httpAddr', e.target.value)}
        />
      </div>

      <div className={styles.row}>
        <label htmlFor="srv-ws">WebSocket API:</label>
        <input
          id="srv-ws"
          type="text"
          spellCheck="false"
          placeholder="localhost:8081"
          value={settings.wsAddr}
          onChange={e => update('wsAddr', e.target.value)}
        />
      </div>

      <p className={styles.hint}>
        Use <code>host:port</code> or a full URL (<code>https://…</code>, <code>wss://…</code>).
        Default is the local server API.
      </p>

      <h4 className={styles.section}>Direct games (WebRTC)</h4>
      <p className={styles.hint}>
        Off by default: direct games work only on the same Wi-Fi or hotspot and nothing leaves it.
      </p>

      <div className={styles.row}>
        <label htmlFor="p2p-stun-url">STUN server:</label>
        <input
          id="p2p-stun-url"
          type="text"
          spellCheck="false"
          placeholder="stun:stun.example.com:3478"
          value={settings.stunUrl ?? ''}
          onChange={e => update('stunUrl', e.target.value)}
        />
      </div>

      <label className={styles.checkRow} htmlFor="p2p-stun">
        <input
          id="p2p-stun"
          type="checkbox"
          checked={!!settings.stun}
          onChange={e => update('stun', e.target.checked)}
        />
        <span>use public STUN servers (Google, Cloudflare)</span>
      </label>

      <p className={styles.hint}>
        STUN finds each player's public address so that direct games connect across different networks.
        Your own server, the public ones or both; <code>host:port</code> or <code>stun:…</code>, several separated by commas.
      </p>

      <div className={styles.row}>
        <label htmlFor="p2p-turn">TURN server:</label>
        <input
          id="p2p-turn"
          type="text"
          spellCheck="false"
          placeholder="turn:turn.example.com:3478"
          value={settings.turnUrl ?? ''}
          onChange={e => update('turnUrl', e.target.value)}
        />
      </div>

      <div className={styles.row}>
        <label htmlFor="p2p-turn-user">TURN username:</label>
        <input
          id="p2p-turn-user"
          type="text"
          spellCheck="false"
          autoComplete="off"
          value={settings.turnUser ?? ''}
          onChange={e => update('turnUser', e.target.value)}
        />
      </div>

      <div className={styles.row}>
        <label htmlFor="p2p-turn-pass">TURN password:</label>
        <input
          id="p2p-turn-pass"
          type="password"
          autoComplete="off"
          value={settings.turnPass ?? ''}
          onChange={e => update('turnPass', e.target.value)}
        />
      </div>

      {badServerUrls(settings).length > 0 && (
        <p className={styles.warning} role="alert">
          Not a valid server address: {badServerUrls(settings).join(', ')}. Use <code>host</code> or <code>host:port</code>.
        </p>
      )}

      {turnMissingLogin(settings) && (
        <p className={styles.warning} role="alert">
          A TURN server needs both a username and a password: without them it isn't used.
        </p>
      )}

      <p className={styles.hint}>
        TURN is a relay for direct games when STUN can't connect the players (mobile CGNAT, corporate networks).
        Use <code>host:port</code>, <code>turn:…</code> or <code>turns:…</code>; several URLs separated by commas.
        The password is kept in this tab only and has to be entered again in a new tab. The host's TURN login is sent inside the invite: prefer temporary logins of your TURN provider.
      </p>

      <div className={styles.actions}>
        <input className={styles.btn} type="submit" value="save" />
        <input className={styles.btn} type="button" value="defaults" onClick={reset} />
        <input className={styles.btn} type="button" value="check" onClick={check} />
        <span className={styles[status]} data-testid="server-status">
          {status !== 'idle' && `● ${statusText[status]}`}
        </span>
        {saved && <span className={styles.saved}>saved</span>}
      </div>
      {status === 'offline' && (
        <p className={styles.hint}>
          Start the server (see README) at <code>{httpUrl('')}</code> or choose the <b>offline</b> mode
          to play against bots in the browser.
        </p>
      )}
    </form>
  );
}
