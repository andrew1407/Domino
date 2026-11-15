import { combineReducers } from 'redux';
import joinedPlayers from './joinedPlayers';
import log from './log';
import pickedTile from './pickedTile';
import playerDeck from './playerDeck';
import commonDeck from './commonDeck';
import roundInfo from './roundInfo';
import currentPlayer from './currentPlayer';
import sessionEmitter from './sessionEmitter';
import sessionId from './sessionId';
import waitForPlayers from './waitForPlayers';
import firstTile from './firstTile';
import sessionStatus from './sessionStatus';
import { STATE_RESET } from '../types';

const combined = {
  joinedPlayers,
  log,
  currentPlayer,
  pickedTile,
  playerDeck,
  commonDeck,
  roundInfo,
  sessionEmitter,
  sessionId,
  waitForPlayers,
  firstTile,
  sessionStatus,
};

const combinedReducer = combineReducers(combined);

const rootReducer = (state, action) => (
  combinedReducer(action.type === STATE_RESET ? undefined : state, action)
);

export default rootReducer;
