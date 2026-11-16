import '@testing-library/jest-dom';
import React from 'react';
import { render } from '@testing-library/react';
import PlayerInfo from '../PlayerInfo';

describe('PlayerInfo', () => {
  it('renders score', () => {
    const testData = {
      name: 'Mavun',
      score: 26,
      tiles: 5,
      you: false,
    };
    const { getByTestId } = render(< PlayerInfo {...testData} />);
    const playerInfo = getByTestId('player-info');
    expect(playerInfo).toHaveTextContent(testData.score);
  });
});

describe('PlayerInfo labels', () => {
  it('marks bots and the current player', () => {
    const { getByTestId } = render(<PlayerInfo name="Bobo" score={3} tiles={2} bot active />);
    const playerInfo = getByTestId('player-info');
    expect(playerInfo).toHaveTextContent('bot');
    expect(playerInfo).not.toHaveTextContent('▶');
    expect(playerInfo).toHaveAttribute('title', 'Bobo – bot: makes a move');
    expect(playerInfo).not.toHaveTextContent('(you)');
  });
});
