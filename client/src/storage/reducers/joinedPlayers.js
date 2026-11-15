import { makeReducer } from '../tools/state';
import { JOINED_PLAYERS_ADD, JOINED_PLAYERS_SET, JOINED_PLAYERS_REMOVE, JOINED_PLAYERS_SCORES_UPDATE } from '../types';

const initial = [];

const actions = {
  [JOINED_PLAYERS_ADD]: (state, payload) => (
    state.some(p => p.name === payload) ? state : [...state, { name: payload, score: 0, tiles: 0 }]
  ),
  [JOINED_PLAYERS_SCORES_UPDATE]: (state, payload) => state.map(
    player => ({ ...player, score: payload?.[player.name] ?? player.score })
  ),
  [JOINED_PLAYERS_REMOVE]: (state, payload) => state.filter(
    player => player.name !== payload
  ),
  [JOINED_PLAYERS_SET]: (_, payload) => payload,
};

export default makeReducer({ initial, actions });
