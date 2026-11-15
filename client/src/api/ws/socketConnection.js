import SessionEmitter from './sessionEmitter';
import SessionListener from './sessionListener';
import { wsUrl } from '../../config/server';
import { getLocalServer, isLocalSession } from '../../engine/localServer';
import { channelSocket, takeGuestChannel } from '../../p2p/peer';

const openSocket = sessionId => {
  if (!isLocalSession(sessionId)) return new WebSocket(wsUrl('/domino-session'));
  // a guest of a peer-to-peer game talks to the host page through the channel
  const channel = takeGuestChannel(sessionId);
  return channel ? channelSocket(channel) : getLocalServer().connect();
};

export const socketConnection = (sessionId, stateHandlers) => {
  const socket = openSocket(sessionId);
  const listener = new SessionListener(stateHandlers);
  const emitter = new SessionEmitter(socket, sessionId);
  let closedByClient = false;

  socket.onopen = () => {
    emitter.joinSession();
  };

  socket.onerror = () => {
    const errorMessage = `Unable to connect to the game server (${wsUrl('')}).`;
    stateHandlers.setErrorMessage(errorMessage);
  };

  socket.onclose = () => {
    if (!closedByClient) stateHandlers.setConnectionClosed?.(true);
  };

  socket.onmessage = e => {
    const entries = JSON.parse(e.data);
    const { event, errorStatus, data } = entries;
    listener[event]?.(data, errorStatus);
  };

  emitter.close = () => {
    closedByClient = true;
    socket.close();
  };

  return emitter;
};
