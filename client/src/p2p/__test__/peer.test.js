/**
 * @jest-environment node
 */
import {
  createInvite, answerInvite, channelSocket, setGuestChannel, takeGuestChannel, isPeerSupported,
} from '../peer';
import { encode, decode } from '../codec';
import { LocalServer } from '../../engine/localServer';

// --- an in-memory RTCPeerConnection: peers "connect" when the host applies the answer
class FakeChannel extends EventTarget {
  readyState = 'connecting';
  onmessage = null;
  onclose = null;
  peer = null;

  fire(type, data) {
    const event = Object.assign(new Event(type), data);
    this.dispatchEvent(event);
    this[`on${type}`]?.(event);
  }

  open() {
    this.readyState = 'open';
    this.fire('open');
  }

  send(data) {
    if (this.readyState !== 'open') throw new Error('InvalidStateError');
    setTimeout(() => this.peer?.fire('message', { data }));
  }

  close() {
    if (this.readyState === 'closed') return;
    this.readyState = 'closed';
    setTimeout(() => this.fire('close'));
    this.peer?.close();
  }
}

const offers = new Map();
const answers = new Map();
let counter = 0;

class FakePeerConnection extends EventTarget {
  iceGatheringState = 'new';
  connectionState = 'new';
  localDescription = null;
  channel = null;

  constructor(config) {
    super();
    this.config = config;
    this.id = ++counter;
  }

  createDataChannel() {
    this.channel = new FakeChannel();
    return this.channel;
  }

  async createOffer() { return { type: 'offer', sdp: `offer-${this.id}` }; }
  async createAnswer() { return { type: 'answer', sdp: `answer-${this.id}` }; }

  async setLocalDescription(desc) {
    this.localDescription = desc;
    (desc.type === 'offer' ? offers : answers).set(desc.sdp, this);
    setTimeout(() => {
      this.iceGatheringState = 'complete';
      this.dispatchEvent(new Event('icegatheringstatechange'));
    });
  }

  async setRemoteDescription(desc) {
    if (desc.type === 'offer' && !offers.has(desc.sdp)) throw new Error('unknown offer');
    if (desc.type === 'offer') this.remoteOffer = desc.sdp;
    if (desc.type !== 'answer') return;
    const guest = answers.get(desc.sdp);
    // an answer made for another offer can't connect
    if (!guest || guest.remoteOffer !== this.localDescription.sdp) {
      this.setState('failed');
      return;
    }
    const remote = new FakeChannel();
    remote.peer = this.channel;
    this.channel.peer = remote;
    guest.dispatchEvent(Object.assign(new Event('datachannel'), { channel: remote }));
    setTimeout(() => {
      this.setState('connected');
      guest.setState('connected');
      this.channel.open();
      remote.open();
    });
  }

  setState(state) {
    this.connectionState = state;
    this.dispatchEvent(new Event('connectionstatechange'));
  }

  close() {
    if (this.connectionState === 'closed') return;
    this.setState('closed');
  }
}

beforeAll(() => {
  globalThis.RTCPeerConnection = FakePeerConnection;
});

afterAll(() => {
  delete globalThis.RTCPeerConnection;
});

const tick = (ms = 10) => new Promise(res => setTimeout(res, ms));

describe('peer-to-peer connections', () => {
  it('detects WebRTC support', () => {
    expect(isPeerSupported()).toBe(true);
  });

  it('connects a guest to the host with an invite and a reply code', async () => {
    const invite = await createInvite('local-1');
    const guest = await answerInvite(invite.code);
    expect(guest.sessionId).toBe('local-1');
    const [hostChannel, guestChannel] = await Promise.all([invite.accept(guest.code), guest.channel]);
    expect(hostChannel.readyState).toBe('open');
    expect(guestChannel.readyState).toBe('open');

    const received = [];
    hostChannel.onmessage = e => received.push(e.data);
    guestChannel.send('hello');
    await tick();
    expect(received).toEqual(['hello']);
  });

  it('uses no STUN servers unless enabled', async () => {
    const invite = await createInvite('local-2');
    expect((await decode(invite.code)).t).toBe(false);
    expect(offers.get((await decode(invite.code)).sdp).config.iceServers).toEqual([]);
  });

  it('rejects a reply made for another invite of the same session', async () => {
    const first = await createInvite('local-3');
    const second = await createInvite('local-3');
    const guest = await answerInvite(first.code);
    await expect(second.accept(guest.code)).rejects.toMatchObject({ message: expect.stringContaining('another invite'), retryable: true });
    // the right invite still works
    await expect(first.accept(guest.code)).resolves.toBeDefined();
    await expect(first.accept(guest.code)).rejects.toThrow('already been used');
  });

  it('rejects damaged and foreign codes', async () => {
    const invite = await createInvite('local-4');
    await expect(invite.accept('zgarbage')).rejects.toThrow('damaged');
    await expect(invite.accept(await encode({ v: 1 }))).rejects.toThrow('not a Domino reply');
    await expect(answerInvite('zgarbage')).rejects.toThrow('damaged');
    await expect(answerInvite(await encode({ v: 1, s: 'local-4', sdp: 'x' }))).rejects.toThrow('not a Domino invite');
    await expect(answerInvite(await encode({ hello: 1 }))).rejects.toThrow('not a Domino invite');
  });

  it('hands an open guest channel to the game page only once', async () => {
    const channel = new FakeChannel();
    channel.readyState = 'open';
    setGuestChannel('local-5', channel);
    expect(takeGuestChannel('local-5')).toBe(channel);
    expect(takeGuestChannel('local-5')).toBeNull();

    const closed = new FakeChannel();
    closed.readyState = 'closed';
    setGuestChannel('local-6', closed);
    expect(takeGuestChannel('local-6')).toBeNull();
  });

  describe('channel socket', () => {
    const openPair = () => {
      const a = new FakeChannel();
      const b = new FakeChannel();
      a.peer = b;
      b.peer = a;
      a.readyState = b.readyState = 'open';
      return [a, b];
    };

    it('behaves like a WebSocket', async () => {
      const [a, b] = openPair();
      const socket = channelSocket(a);
      const events = [];
      socket.onopen = () => events.push('open');
      socket.onmessage = e => events.push(`message:${e.data}`);
      socket.onclose = () => events.push('close');
      socket.send('lost'); // not open yet
      await tick();
      expect(socket.readyState).toBe(1);
      b.send('ping');
      socket.send('pong');
      const sent = [];
      b.onmessage = e => sent.push(e.data);
      await tick();
      expect(sent).toEqual(['pong']);
      b.close();
      await tick();
      expect(events).toEqual(['open', 'message:ping', 'close']);
      expect(socket.readyState).toBe(3);
      expect(() => socket.send('late')).not.toThrow();
    });

    it('does not open after being closed', async () => {
      const [a] = openPair();
      const socket = channelSocket(a);
      const events = [];
      socket.onopen = () => events.push('open');
      socket.close();
      await tick();
      expect(events).toEqual([]);
      expect(socket.readyState).toBe(3);
    });

    it('reports a channel which closed before the page took it', async () => {
      const [a] = openPair();
      a.readyState = 'closed';
      const socket = channelSocket(a);
      const events = [];
      socket.onopen = () => events.push('open');
      socket.onclose = () => events.push('close');
      await tick();
      expect(events).toEqual(['close']);
    });
  });

  it('runs a game between a host page and a guest over the connection', async () => {
    const server = new LocalServer();
    const id = server.createSession(2, 1, 0);
    const host = server.connect();
    const hostEvents = [];
    host.onmessage = e => hostEvents.push(JSON.parse(e.data).event);
    host.onopen = () => host.send(JSON.stringify({ event: 'joinSession', data: { session: id } }));

    const invite = await createInvite(id);
    const answer = await answerInvite(invite.code);
    const [hostChannel, guestChannel] = await Promise.all([invite.accept(answer.code), answer.channel]);
    server.accept(hostChannel);
    const guest = channelSocket(guestChannel);
    const guestEvents = [];
    guest.onmessage = e => guestEvents.push(JSON.parse(e.data));
    guest.onopen = () => guest.send(JSON.stringify({ event: 'joinSession', data: { session: id } }));
    await tick(3000);

    expect(guestEvents[0].event).toBe('joinSession');
    expect(hostEvents).toContain('sessionNewcomer');
    expect(guestEvents.map(e => e.event)).toEqual(expect.arrayContaining(['roundStart', 'firstMove', 'nextMove']));

    // the guest leaves: the host is told and the game is over
    guest.close();
    await tick(200);
    expect(hostEvents).toContain('interruptedSession');
    expect(server.getSession(id)).toBeNull();
  }, 10000);
});
