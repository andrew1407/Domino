import Link from 'next/link';
import MainWrapper from '../components/main/MainWrapper';
import styles from '../styles/Home.module.scss';

export default function NotFound() {
  return (
    <MainWrapper>
      <div className={styles.home}>
        <section className={styles.hero}>
          <h2>Page not found</h2>
          <Link className={styles.playBtn} href="/">Home</Link>
        </section>
      </div>
    </MainWrapper>
  );
}
