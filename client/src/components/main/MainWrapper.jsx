import Footer from './Footer';
import Header from './Header';
import styles from '../../styles/main/MainWrapper.module.scss';
const { centralBlock, mainBlock } = styles;

export default function MainWrapper({ HeaderInfo, children }) {
  return (
    <div className={mainBlock}>
      {HeaderInfo ? 
        <Header>
          <HeaderInfo />
        </Header> :
        <Header />
      }

      <div className={centralBlock}>
        {children}
      </div>

      <Footer />
    </div>
  );
};
