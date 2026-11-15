import { dispatchObj } from '../tools/state';
import { SESSION_STATUS_SET, STATE_RESET } from '../types';

export const setSessionStatus = dispatchObj.bind(null, SESSION_STATUS_SET);
export const resetState = dispatchObj.bind(null, STATE_RESET, null);
