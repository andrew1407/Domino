import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, httpUrl } from '../../config/server';
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
    const { httpAddr, wsAddr, stun } = DEFAULT_SETTINGS;
    const next = saveSettings({ httpAddr, wsAddr, stun });
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

      <label className={styles.checkRow} htmlFor="p2p-stun">
        <input
          id="p2p-stun"
          type="checkbox"
          checked={!!settings.stun}
          onChange={e => update('stun', e.target.checked)}
        />
        <span>
          Direct games across different networks: use public STUN servers (Google, Cloudflare)
          to find a route. Off: direct games work only on the same Wi-Fi or hotspot and nothing leaves it.
        </span>
      </label>

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
