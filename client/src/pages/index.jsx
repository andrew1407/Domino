import Link from 'next/link';
import { useCallback, useState } from 'react';
import MainWrapper from '../components/main/MainWrapper';
import CommandsList from '../components/commands/CommandsList';
import ServerSettings from '../components/sessionOptions/ServerSettings';
import { loadCommandsList } from '../api/http/commands';
import { getTileImagePath } from '../tools';
import styles from '../styles/Home.module.scss';

const heroTiles = [{ left: 6, right: 6 }, { left: 6, right: 3 }, { left: 3, right: 1 }, { left: 1, right: 0 }];

export default function HomePage() {
  const [ commands, setCommands ] = useState(null);
  const [ commandsError, setCommandsError ] = useState('');

  const showCommands = useCallback(async () => {
    setCommandsError('');
    try {
      setCommands(await loadCommandsList());
    } catch (e) {
      setCommands(null);
      setCommandsError(`Unable to load the API reference: ${e.message}`);
    }
  }, []);

  return (
    <MainWrapper>
      <div className={styles.home}>
        <section className={styles.hero}>
          <div className={styles.heroTiles}>
            {heroTiles.map(t => <img key={`${t.left}-${t.right}`} src={getTileImagePath(t)} alt="" />)}
          </div>
          <h2>Classic domino for 2&ndash;4 players</h2>
          <p>
            Create a session and share its ID with friends, fill the free seats with bots,
            or play right in the browser against bots &mdash; no server required.
          </p>
          <Link className={styles.playBtn} href="/game-session">Play</Link>
        </section>

        <section className={styles.card}>
          <h3>Rules in short</h3>
          <ul>
            <li>The player with the heaviest double (or tile) makes the first move.</li>
            <li>Put a tile matching one of the chain ends; take tiles from the stock if you cannot.</li>
            <li>A move is skipped when the stock is empty and nothing fits.</li>
            <li>The round winner gets the sum of the rivals&apos; tiles. The game lasts until the final score.</li>
          </ul>
        </section>

        <section className={styles.card}>
          <h3>Game server</h3>
          <ServerSettings />
        </section>

        <section className={styles.card}>
          <h3>Server API</h3>
          <button className={styles.secondaryBtn} onClick={showCommands}>Load API reference</button>
          {commandsError && <p className={styles.error}>{commandsError}</p>}
          {commands && <CommandsList entries={commands} />}
        </section>
      </div>
    </MainWrapper>
  );
}
