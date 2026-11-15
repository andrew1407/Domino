import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import rootReducer from '../../../../storage/reducers';
import { setCurrentPlayer } from '../../../../storage/actions/currentPlayer';
import { setPlayerDeck } from '../../../../storage/actions/playerDeck';
import { setCommonDeck } from '../../../../storage/actions/commonDeck';
import { setRoundInfo } from '../../../../storage/actions/roundInfo';
import PlayerDeck from '../PlayerDeck';

const renderDeck = currentMove => {
  const store = createStore(rootReducer, {});
  store.dispatch(setCurrentPlayer('Bobo'));
  store.dispatch(setPlayerDeck([{ left: 6, right: 1 }, { left: 2, right: 3 }]));
  store.dispatch(setCommonDeck([{ left: 6, right: 6 }]));
  store.dispatch(setRoundInfo({ stock: 10, players: 2, finalScore: 50, currentRound: 1, currentMove }));
  render(<Provider store={store}><PlayerDeck /></Provider>);
};

const highlighted = () => screen.getAllByTestId('deck-tile').filter(t => /playableTile/.test(t.className));

describe('PlayerDeck', () => {
  it('highlights the playable tiles on your turn', () => {
    renderDeck('Bobo');
    expect(highlighted().map(t => t.alt)).toEqual(['6|1']);
    expect(screen.getByRole('button', { name: /stock/ })).toBeEnabled();
  });

  it('highlights nothing between turns, right after your move', () => {
    renderDeck(null);
    expect(highlighted()).toHaveLength(0);
    expect(screen.getByRole('button', { name: /stock/ })).toBeDisabled();
    expect(screen.getByText('Next turn…')).toBeInTheDocument();
  });

  it('highlights nothing on another player\'s turn', () => {
    renderDeck('Sasik');
    expect(highlighted()).toHaveLength(0);
    expect(screen.getByText('Sasik is moving…')).toBeInTheDocument();
  });
});
