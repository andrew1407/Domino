import '@testing-library/jest-dom';
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import SessionSearch, { parseSessionQuery } from '../SessionSearch';

const push = jest.fn();
jest.mock('next/router', () => ({ useRouter: () => ({ push }) }));

describe('parseSessionQuery', () => {
  it('accepts a bare session ID', () => {
    expect(parseSessionQuery('  5b0c-uuid ')).toEqual({ id: '5b0c-uuid' });
    expect(parseSessionQuery('')).toBeNull();
  });

  it('keeps the server address of an invite link', () => {
    const link = 'https://x.github.io/Domino/game-session/play/?id=abc&http=http%3A%2F%2F10.0.0.2%3A8080&ws=ws%3A%2F%2F10.0.0.2%3A8081';
    expect(parseSessionQuery(link)).toEqual({ id: 'abc', http: 'http://10.0.0.2:8080', ws: 'ws://10.0.0.2:8081' });
  });

  it('reads an invite link without a server address', () => {
    expect(parseSessionQuery('http://localhost:3000/game-session/play/?id=abc')).toEqual({ id: 'abc' });
  });
});

describe('SessionSearch', () => {
  it('joins with the server of a pasted invite link', async () => {
    await act(async () => { render(<SessionSearch />); });
    fireEvent.change(screen.getByLabelText(/Session ID/), {
      target: { value: 'http://h/game-session/play/?id=abc&http=10.0.0.2:8080&ws=10.0.0.2:8081' },
    });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'join' })));
    expect(push).toHaveBeenCalledWith({
      pathname: '/game-session/play',
      query: { id: 'abc', http: '10.0.0.2:8080', ws: '10.0.0.2:8081' },
    });
  });
});
