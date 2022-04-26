import { makeReducer } from '../tools/state';
import { LOG_ADD } from '../types';

const initial = [];

const actions = {
  [LOG_ADD]: (state, payload) => [ ...state, payload ],
};

export default makeReducer({ initial, actions });
