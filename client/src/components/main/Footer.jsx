import styles from '../../styles/main/Footer.module.scss';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <p className={styles.version}>
        <small>
          <b>version: {process.env.NEXT_PUBLIC_APP_VERSION}</b>
        </small>
      </p>

      <p className={styles.title}>
        <b>DichES</b>
      </p>

      <p>
        <b>
          <small>
            <a className={styles.refText} href="https://github.com/Andrew1407/Domino" target="_blank" rel="noreferrer">git repo</a>
          </small>
        </b>
      </p>
    </footer>
  );
};
