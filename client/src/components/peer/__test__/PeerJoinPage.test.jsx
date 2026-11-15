import '@testing-library/jest-dom';
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import PeerJoinPage from '../../../pages/game-session/peer';

const replace = jest.fn();
jest.mock('next/router', () => ({ useRouter: () => ({ replace }) }));
jest.mock('../../main/MainWrapper', () => ({ children }) => <div>{children}</div>);
jest.mock('../../../p2p/peer', () => ({
  ...jest.requireActual('../../../p2p/peer'),
  answerInvite: jest.fn(),
  setGuestChannel: jest.fn(),
  isPeerSupported: () => true,
}));

const { answerInvite, setGuestChannel } = jest.requireMock('../../../p2p/peer');
const INVITE = 'z' + 'a'.repeat(60);

afterEach(() => {
  jest.clearAllMocks();
  window.location.hash = '';
});

describe('direct game join page', () => {
  it('answers the invite from the link and enters the game once connected', async () => {
    let connect;
    const channel = { readyState: 'open' };
    answerInvite.mockResolvedValue({
      sessionId: 'local-1',
      code: 'zREPLY',
      channel: new Promise(res => { connect = res; }),
      close: jest.fn(),
    });
    window.location.hash = `#invite=${INVITE}`;
    await act(async () => { render(<PeerJoinPage />); });

    expect(answerInvite).toHaveBeenCalledWith(INVITE);
    expect(screen.getByLabelText('reply code')).toHaveValue('zREPLY');
    expect(screen.getByText('Waiting for the host…')).toBeInTheDocument();

    await act(async () => connect(channel));
    expect(setGuestChannel).toHaveBeenCalledWith('local-1', channel);
    expect(replace).toHaveBeenCalledWith({ pathname: '/game-session/play', query: { id: 'local-1' } });
  });

  it('asks for an invite when the link has none and validates the input', async () => {
    await act(async () => { render(<PeerJoinPage />); });
    expect(answerInvite).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('invite'), { target: { value: 'local-123' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'join' })));
    expect(screen.getByText('Paste the invite link or code sent by the host.')).toBeInTheDocument();
    expect(answerInvite).not.toHaveBeenCalled();
  });

  it('shows the error of a damaged invite', async () => {
    answerInvite.mockRejectedValue(new Error('The invite is damaged: ask the host to send it once again.'));
    window.location.hash = `#invite=${INVITE}`;
    await act(async () => { render(<PeerJoinPage />); });
    expect(screen.getByText('The invite is damaged: ask the host to send it once again.')).toBeInTheDocument();
    expect(screen.getByLabelText('invite')).toBeInTheDocument();
  });

  it('closes a pending connection when the page is left', async () => {
    const close = jest.fn();
    answerInvite.mockResolvedValue({ sessionId: 'local-2', code: 'zR', channel: new Promise(() => {}), close });
    window.location.hash = `#invite=${INVITE}`;
    let view;
    await act(async () => { view = render(<PeerJoinPage />); });
    view.unmount();
    expect(close).toHaveBeenCalled();
  });
});
