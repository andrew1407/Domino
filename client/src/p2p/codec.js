// Compact text codes for exchanging connection data by hand (link, chat, QR...).
const PREFIX_DEFLATE = 'z';
const PREFIX_PLAIN = 'p';

const toBase64Url = bytes => {
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = str => {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - b64.length % 4) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
};

const pipe = async (bytes, stream) => {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
};

const canCompress = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

export const encode = async value => {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  if (!canCompress()) return PREFIX_PLAIN + toBase64Url(bytes);
  return PREFIX_DEFLATE + toBase64Url(await pipe(bytes, new CompressionStream('deflate-raw')));
};

export const decode = async code => {
  const value = String(code ?? '').trim();
  const kind = value[0];
  let bytes = fromBase64Url(value.slice(1));
  if (kind === PREFIX_DEFLATE) bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  else if (kind !== PREFIX_PLAIN) throw new Error('unknown code format');
  return JSON.parse(new TextDecoder().decode(bytes));
};
