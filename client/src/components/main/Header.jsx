import Link from 'next/link';
import styles from '../../styles/main/Header.module.scss';

export default function Header({ children }) {
  return (
    <header className={styles.header}>
      <div className={styles.title}>
        <Link href="/"><h1>Domino</h1></Link>
      </div>

      {children}
    </header>
  );
};
