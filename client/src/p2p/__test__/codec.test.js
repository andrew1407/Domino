/**
 * @jest-environment node
 */
import { encode, decode } from '../codec';
import { parseInvite } from '../peer';

describe('peer connection codes', () => {
  const sdp = 'v=0\r\no=- 46117 2 IN IP4 127.0.0.1\r\n'.repeat(20);

  it('packs and unpacks values', async () => {
    const value = { v: 1, s: 'local-abc', t: false, sdp };
    const code = await encode(value);
    expect(code).toMatch(/^z[\w-]+$/);
    expect(code.length).toBeLessThan(JSON.stringify(value).length);
    expect(await decode(code)).toEqual(value);
  });

  it('rejects damaged codes', async () => {
    const code = await encode({ sdp });
    await expect(decode(code.slice(0, 20))).rejects.toThrow();
    await expect(decode('x123')).rejects.toThrow();
  });

  it('finds an invite in a link or a bare code', async () => {
    const code = await encode({ sdp });
    expect(parseInvite(`https://host/Domino/game-session/peer/#invite=${code}`)).toBe(code);
    expect(parseInvite(code)).toBe(code);
    expect(parseInvite('local-123')).toBe('');
    expect(parseInvite('')).toBe('');
  });
});
