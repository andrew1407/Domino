/**
 * @jest-environment node
 */
import { LocalServer } from '../localServer';

jest.mock('../rules', () => ({
  ...jest.requireActual('../rules'),
  distributeTiles: () => { throw new Error('broken'); },
}));

it('ends a session whose turn chain has failed instead of freezing it', async () => {
  jest.useFakeTimers();
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const server = new LocalServer();
  const id = server.createSession(2, 10);
  const socket = server.connect();
  const messages = [];
  let closed = false;
  socket.onmessage = ({ data }) => messages.push(JSON.parse(data));
  socket.onclose = () => { closed = true; };
  socket.onopen = () => socket.send(JSON.stringify({ event: 'joinSession', data: { session: id } }));
  await jest.advanceTimersByTimeAsync(2000);
  expect(messages.map(m => m.errorStatus)).toContain('INTERNAL_SERVER_ERROR');
  expect(closed).toBe(true);
  expect(server.getSession(id)).toBeNull();
  expect(error).toHaveBeenCalled();
  error.mockRestore();
  jest.useRealTimers();
});
