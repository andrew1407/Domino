import { httpUrl } from '../../config/server';
import { getLocalServer } from '../../engine/localServer';

export const createSession = async (players, score, bots = 0, mode = 'online') => {
  if (mode === 'offline')
    return getLocalServer().createSession(players, score, players - 1);
  // peer-to-peer: this browser hosts the game, other humans join directly
  if (mode === 'peer')
    return getLocalServer().createSession(players, score, bots);

  let response;
  try {
    response = await fetch(httpUrl('/domino-session'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ players, score, bots }),
    });
  } catch {
    throw new Error(`Game server ${httpUrl('')} is unreachable. Check the server settings or play offline.`);
  }
  if (response.ok) return response.text();
  const { message = 'some error occured' } = await response.json().catch(() => ({}));
  throw new Error(Array.isArray(message) ? message.join(', ') : message);
};
