import { makeReducer } from '../tools/state';
import { SESSION_STATUS_SET } from '../types';

const initial = {
  joined: false,
  bots: [],
  lastRound: null,
  finished: false,
  interrupted: null,
  unavailable: false,
  connectionClosed: false,
};

const actions = {
  [SESSION_STATUS_SET]: (state, payload) => ({ ...state, ...payload }),
};

export default makeReducer({ initial, actions });
