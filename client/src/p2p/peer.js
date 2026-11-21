// Serverless peer-to-peer games over WebRTC data channels.
//
// The host page runs the game engine (LocalServer). For every remote seat it
// makes an invite (an SDP offer packed into a code/link); the guest answers
// with a reply code which the host pastes back. No signalling server is used:
// on the same Wi-Fi or phone hotspot the peers connect directly, even offline.
// Optional public STUN servers help to connect across different networks,
// an optional TURN server relays the traffic when no direct route exists.
import { encode, decode } from './codec';
import { loadSettings, turnServer, stunUrls, isIceUrl } from '../config/server';

const PROTOCOL = 1;
const CHANNEL = 'domino';
const GATHER_TIMEOUT = 4000;
const CONNECT_TIMEOUT = 30_000;
const STUN_SERVERS = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];

export const isPeerSupported = () => typeof RTCPeerConnection === 'function';

const makeNonce = () => {
  const bytes = new Uint8Array(9);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
};

// a wrong code: the invite stays usable and the right code can be pasted
const retryable = message => Object.assign(new Error(message), { retryable: true });

const rtcConfig = (stun, own, turn) => ({
  iceServers: [...(stun ? STUN_SERVERS : []), ...(own?.length ? [{ urls: own }] : []), ...(turn ? [turn] : [])],
});

// a browser rejects a malformed STUN/TURN address: explain it instead of its parser error
const openConnection = (config, hint) => {
  try {
    return new RTCPeerConnection(config);
  } catch (e) {
    if (e?.name === 'SyntaxError' || e?.name === 'InvalidAccessError') throw new Error(hint);
    throw e;
  }
};

const validUrls = (urls, scheme) =>
  Array.isArray(urls) && urls.length > 0 && urls.every(url => typeof url === 'string' && scheme.test(url) && isIceUrl(url));

// own STUN servers from an invite: only well-formed stun: URLs are used
const inviteStun = u => (validUrls(u, /^stuns?:/i) ? u : null);

// a TURN server from an invite: only well-formed fields are used
const inviteTurn = r => {
  if (!r || !validUrls(r.urls, /^turns?:/i))
    return null;
  // browsers reject a TURN server without the login
  if (typeof r.username !== 'string' || typeof r.credential !== 'string' || !r.username || !r.credential)
    return null;
  return { urls: r.urls, username: r.username, credential: r.credential };
};

// resolves once all the local ICE candidates are inside the local description
const gathered = pc => new Promise(resolve => {
  if (pc.iceGatheringState === 'complete') return resolve();
  const done = () => {
    clearTimeout(timer);
    pc.removeEventListener('icegatheringstatechange', check);
    resolve();
  };
  const check = () => pc.iceGatheringState === 'complete' && done();
  const timer = setTimeout(done, GATHER_TIMEOUT);
  pc.addEventListener('icegatheringstatechange', check);
});

const channelOpened = (channel, pc) => new Promise((resolve, reject) => {
  if (channel.readyState === 'open') return resolve(channel);
  const timer = setTimeout(() => reject(new Error('The connection has timed out.')), CONNECT_TIMEOUT);
  channel.addEventListener('open', () => {
    clearTimeout(timer);
    resolve(channel);
  }, { once: true });
  pc.addEventListener('connectionstatechange', () => {
    if (pc.connectionState !== 'failed') return;
    clearTimeout(timer);
    reject(new Error('Unable to connect: try the same Wi-Fi, or enable STUN servers or set a TURN server in the settings.'));
  });
});

// closes the peer connection together with its channel
const bindLifetime = (channel, pc) => {
  channel.addEventListener('close', () => pc.close());
  pc.addEventListener('connectionstatechange', () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      if (channel.readyState !== 'closed') channel.close();
      channel.onclose?.({});
    }
  });
};

/**
 * Host side: creates an invite for one remote seat.
 * @returns {Promise<{ code: string, accept: (replyCode: string) => Promise<RTCDataChannel>, close: () => void }>}
 */
export const createInvite = async sessionId => {
  const settings = loadSettings();
  const stun = !!settings.stun;
  const own = stunUrls(settings.stunUrl);
  const turn = turnServer(settings);
  const pc = openConnection(rtcConfig(stun, own, turn), 'A STUN or TURN server address in the settings is wrong: check it and try again.');
  const channel = pc.createDataChannel(CHANNEL, { ordered: true });
  // every invite has its own id: a reply fits only the invite it answers
  const nonce = makeNonce();
  await pc.setLocalDescription(await pc.createOffer());
  await gathered(pc);
  // the guest needs the same relay: its credentials travel inside the invite
  const code = await encode({ v: PROTOCOL, s: sessionId, n: nonce, t: stun, ...(own.length && { u: own }), ...(turn && { r: turn }), sdp: pc.localDescription.sdp });
  let accepted = false;

  const accept = async replyCode => {
    if (accepted) throw new Error('This invite has already been used.');
    let reply;
    try {
      reply = await decode(replyCode);
    } catch {
      throw retryable('The reply code is damaged: copy it once again.');
    }
    if (reply?.v !== PROTOCOL || typeof reply.sdp !== 'string')
      throw retryable('This is not a Domino reply code.');
    if (reply.a !== sessionId || reply.n !== nonce)
      throw retryable('This reply code belongs to another invite.');
    accepted = true;
    await pc.setRemoteDescription({ type: 'answer', sdp: reply.sdp });
    await channelOpened(channel, pc);
    bindLifetime(channel, pc);
    return channel;
  };

  return { code, accept, close: () => pc.close() };
};

/**
 * Guest side: answers an invite.
 * @returns {Promise<{ sessionId: string, code: string, channel: Promise<RTCDataChannel>, close: () => void }>}
 */
export const answerInvite = async inviteCode => {
  let invite;
  try {
    invite = await decode(inviteCode);
  } catch {
    throw new Error('The invite is damaged: ask the host to send it once again.');
  }
  const invalid = invite?.v !== PROTOCOL || typeof invite.s !== 'string' ||
    typeof invite.n !== 'string' || typeof invite.sdp !== 'string';
  if (invalid)
    throw new Error('This is not a Domino invite.');
  // the guest follows the host's choice of STUN and TURN servers
  const pc = openConnection(rtcConfig(!!invite.t, inviteStun(invite.u), inviteTurn(invite.r)),
    'The invite has a wrong STUN or TURN server: ask the host to check the settings.');
  const channel = new Promise(resolve => {
    pc.addEventListener('datachannel', e => resolve(e.channel), { once: true });
  }).then(ch => channelOpened(ch, pc)).then(ch => {
    bindLifetime(ch, pc);
    return ch;
  });
  await pc.setRemoteDescription({ type: 'offer', sdp: invite.sdp });
  await pc.setLocalDescription(await pc.createAnswer());
  await gathered(pc);
  const code = await encode({ v: PROTOCOL, a: invite.s, n: invite.n, sdp: pc.localDescription.sdp });
  return { sessionId: invite.s, code, channel, close: () => pc.close() };
};

// open guest channels waiting for the game page, by session id
const guestChannels = new Map();

export const setGuestChannel = (sessionId, channel) => guestChannels.set(sessionId, channel);

export const takeGuestChannel = sessionId => {
  const channel = guestChannels.get(sessionId);
  guestChannels.delete(sessionId);
  return channel?.readyState === 'open' ? channel : null;
};

// a WebSocket-like wrapper of a data channel for the session API
export const channelSocket = channel => {
  const socket = {
    readyState: 0,
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
    send(raw) {
      if (socket.readyState !== 1) return;
      try {
        channel.send(raw);
      } catch {
        // the channel is closing: onclose reports it
      }
    },
    close() {
      if (socket.readyState >= 2) return;
      socket.readyState = 3;
      channel.close();
    },
  };
  channel.onmessage = e => socket.onmessage?.({ data: e.data });
  channel.onclose = () => {
    const wasOpen = socket.readyState < 2;
    socket.readyState = 3;
    if (wasOpen) socket.onclose?.({ code: 1000 });
  };
  setTimeout(() => {
    if (socket.readyState !== 0) return;
    if (channel.readyState !== 'open') {
      socket.readyState = 3;
      socket.onclose?.({ code: 1006 });
      return;
    }
    socket.readyState = 1;
    socket.onopen?.({});
  });
  return socket;
};

export const INVITE_PATH = '/game-session/peer';

export const makeInviteLink = code => {
  const url = new URL(window.location.href);
  url.pathname = url.pathname.replace(/\/game-session\/.*$/, INVITE_PATH + '/');
  url.search = '';
  url.hash = 'invite=' + code;
  return url.toString();
};

// accepts an invite link or a bare invite code
export const parseInvite = input => {
  const value = String(input ?? '').trim();
  const match = value.match(/[#&]invite=([\w-]+)/);
  if (match) return match[1];
  return /^[zp][\w-]{40,}$/.test(value) ? value : '';
};
