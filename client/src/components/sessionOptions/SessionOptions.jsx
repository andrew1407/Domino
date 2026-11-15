import { useState } from 'react';
import SessionCreator from './SessionCreator';
import SessionSearch from './SessionSearch';
import ServerSettings from './ServerSettings';
import { applyStylesIf } from '../../tools';
import styles from '../../styles/SessionOptions.module.scss';

const options = {
  'create session': SessionCreator,
  'join session': SessionSearch,
  'server': ServerSettings,
};

export default function SessionOptions() {
  const [ pickedOption, setPickedOption ] = useState('create session');
  const VisibleOption = options[pickedOption];

  return (
    <div className={styles.optionsContainer}>
      <div className={styles.optionsList}>
        {Object.keys(options).map(op => (
          <div
            key={op}
            role="tab"
            className={applyStylesIf(op === pickedOption, [styles.optionBlock, styles.pickedOptionBlock], [styles.optionBlock])}
            onClick={() => setPickedOption(op)}
          >
            <p>{op}</p>
          </div>
        ))}
      </div>

      <div className={styles.optionContent}>
        <VisibleOption />
      </div>
    </div>
  );
}
