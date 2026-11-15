import { useEffect } from 'react';
import Head from 'next/head';
import { Nunito } from 'next/font/google';
import { Provider } from 'react-redux';
import storage from '../storage';
import { assetPath } from '../tools';
import { registerServiceWorker } from '../offline';
import '../styles/styles.scss';

const nunito = Nunito({ subsets: ['latin', 'cyrillic'], display: 'swap' });

export default function App({ Component, pageProps }) {
  useEffect(registerServiceWorker, []);

  return (
    <Provider store={storage}>
      <Head>
        <title>Domino</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href={assetPath('/static/tiles/6-6.svg')} />
        <link rel="manifest" href={assetPath('/manifest.webmanifest')} />
        <meta name="theme-color" content="#cca85c" />
        <meta name="description" content="Classic domino for 2-4 players: online sessions and games with bots" />
      </Head>
      <style jsx global>{`
        :root { --font-body: ${nunito.style.fontFamily}; }
      `}</style>
      <Component {...pageProps} />
    </Provider>
  );
}
