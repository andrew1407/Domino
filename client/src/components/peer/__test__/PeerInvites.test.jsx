import '@testing-library/jest-dom';
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import rootReducer from '../../../storage/reducers';
import { setSessionId } from '../../../storage/actions/sessionId';
import { getLocalServer } from '../../../engine/localServer';
import PeerInvites from '../PeerInvites';

jest.mock('../../../p2p/peer', () => ({
  createInvite: jest.fn(),
  makeInviteLink: code => `https://host/game-session/peer/#invite=${code}`,
}));

const { createInvite } = jest.requireMock('../../../p2p/peer');

const renderFor = (players, bots) => {
  const id = getLocalServer().createSession(players, 20, bots);
  const store = createStore(rootReducer, {});
  store.dispatch(setSessionId(id));
  render(<Provider store={store}><PeerInvites /></Provider>);
  return id;
};

const fakeChannel = () => {
  const listeners = {};
  return {
    readyState: 'open',
    send: jest.fn(),
    close: jest.fn(),
    addEventListener: (type, fn) => { listeners[type] = fn; },
    fireClose() { listeners.close?.(); },
  };
};

afterEach(() => jest.clearAllMocks());

describe('PeerInvites', () => {
  it('has a slot for every remote human seat', () => {
    renderFor(4, 1);
    expect(screen.getAllByRole('button', { name: 'create invite' })).toHaveLength(2);
  });

  it('shows nothing for a game against bots only', () => {
    renderFor(3, 2);
    expect(screen.queryByTestId('peer-invites')).toBeNull();
  });

  it('creates an invite and connects the player with the reply code', async () => {
    const channel = fakeChannel();
    const accept = jest.fn().mockResolvedValue(channel);
    createInvite.mockResolvedValue({ code: 'zINVITE', accept, close: jest.fn() });
    const acceptSpy = jest.spyOn(getLocalServer(), 'accept');
    const id = renderFor(2, 0);

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'create invite' })));
    expect(createInvite).toHaveBeenCalledWith(id);
    expect(screen.getByLabelText('link')).toHaveValue('https://host/game-session/peer/#invite=zINVITE');

    const connect = screen.getByRole('button', { name: 'connect' });
    expect(connect).toBeDisabled();
    fireEvent.change(screen.getByLabelText('reply code'), { target: { value: ' zREPLY ' } });
    await act(async () => fireEvent.click(connect));
    expect(accept).toHaveBeenCalledWith(' zREPLY ');
    expect(acceptSpy).toHaveBeenCalledWith(channel);
    expect(screen.getByText('connected')).toBeInTheDocument();

    // the player disconnects before the start: the seat can be invited again
    await act(async () => channel.fireClose());
    expect(screen.getByText('The player has disconnected.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'create invite' })).toBeInTheDocument();
    acceptSpy.mockRestore();
  });

  it('keeps the invite when a wrong reply code is pasted', async () => {
    const close = jest.fn();
    const wrong = Object.assign(new Error('This reply code belongs to another invite.'), { retryable: true });
    const channel = fakeChannel();
    const accept = jest.fn().mockRejectedValueOnce(wrong).mockResolvedValueOnce(channel);
    createInvite.mockResolvedValue({ code: 'zINVITE', accept, close });
    renderFor(2, 0);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'create invite' })));
    fireEvent.change(screen.getByLabelText('reply code'), { target: { value: 'zWRONG' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'connect' })));
    expect(screen.getByText('This reply code belongs to another invite.')).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByLabelText('link')).toHaveValue('https://host/game-session/peer/#invite=zINVITE');

    fireEvent.change(screen.getByLabelText('reply code'), { target: { value: 'zRIGHT' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'connect' })));
    expect(accept).toHaveBeenLastCalledWith('zRIGHT');
    expect(screen.getByText('connected')).toBeInTheDocument();
  });

  it('drops the invite when the connection fails and lets to make a new one', async () => {
    const close = jest.fn();
    createInvite.mockResolvedValue({
      code: 'zINVITE',
      accept: jest.fn().mockRejectedValue(new Error('Unable to connect')),
      close,
    });
    renderFor(2, 0);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'create invite' })));
    fireEvent.change(screen.getByLabelText('reply code'), { target: { value: 'zWRONG' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'connect' })));
    expect(screen.getByText('Unable to connect')).toBeInTheDocument();
    expect(close).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'create invite' })).toBeInTheDocument();
  });
});
