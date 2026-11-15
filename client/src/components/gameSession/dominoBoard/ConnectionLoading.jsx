import { useState, useEffect } from 'react';
import { getTileImagePath } from '../../../tools';
import styles from '../../../styles/gameSession/DominoBoard.module.scss';
const { loadingScreen, laodingTitle, tilesLoadContaner, loadingTile } = styles;

export default function ConnectionLoading({ title = 'Waiting for players...', hint }) {
  const [ loadingTiles, setLoadingTiles ] = useState([]);

  useEffect(() => {
    const loadTile = async () => {
      const currentCount = loadingTiles.length;
      const maxTilesCount = 7;
      const loadingDelay = 400;
      await new Promise(res => setTimeout(res, loadingDelay));
      if (!active) return;
      if (currentCount === maxTilesCount) {
        setLoadingTiles([]);
        return;
      }
      if (!currentCount) {
        const tile = { left: 0, right: 0 };
        setLoadingTiles([ ...loadingTiles, tile ]);
        return;
      }
      const lastTile = loadingTiles[currentCount - 1];
      const nextValue = lastTile.left + 1;
      const tile = { left: nextValue, right: nextValue };
      setLoadingTiles([ ...loadingTiles, tile ]);
    };

    let active = true;
    const timer = setTimeout(() => active && loadTile(), 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [loadingTiles]);

  return (
    <div className={loadingScreen}>
      <h1 className={laodingTitle}>{title}</h1>
      {hint && <p className={styles.loadingHint}>{hint}</p>}

      <div className={tilesLoadContaner}>
        {loadingTiles.map(t => (
          <img key={t.right} className={loadingTile} src={getTileImagePath(t)} alt="" />
        ))}
      </div>
    </div>
  );
};
