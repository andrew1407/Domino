import '@testing-library/jest-dom';
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import SessionCreator from '../SessionCreator';

jest.mock('next/router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

const renderCreator = async () => {
  await act(async () => { render(<SessionCreator />); });
};

const pickMode = async label => {
  await act(async () => fireEvent.click(screen.getByRole('button', { name: label })));
};

beforeEach(() => window.localStorage.clear());

describe('SessionCreator defaults', () => {
  it.each(['online (server)', 'direct (no server)'])('%s: 2 players and no bots', async mode => {
    await renderCreator();
    await pickMode(mode);
    expect(screen.getByLabelText('Players:')).toHaveValue('2');
    expect(screen.getByLabelText('Bots:')).toHaveValue('0');
    expect(screen.getByText(/^2 human players/)).toBeInTheDocument();
  });

  it('offline: 2 players, one of them a bot', async () => {
    await renderCreator();
    await pickMode('offline (bots)');
    expect(screen.getByLabelText('Players:')).toHaveValue('2');
    expect(screen.getByLabelText('Bots:')).toHaveValue('1');
    expect(screen.getByLabelText('Bots:')).toBeDisabled();
    expect(screen.getByText('You against 1 bot, right in the browser.')).toBeInTheDocument();
  });
});

describe('SessionCreator without a connection', () => {
  const setOnline = value => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value });
  };
  const picked = () => document.querySelector('[class*=modeBtnPicked]').textContent;

  afterEach(() => setOnline(true));

  it('switches to the offline game and back, keeping the saved mode', async () => {
    await renderCreator();
    await pickMode('online (server)');

    setOnline(false);
    await act(async () => window.dispatchEvent(new Event('offline')));
    expect(picked()).toBe('offline (bots)');

    setOnline(true);
    await act(async () => window.dispatchEvent(new Event('online')));
    expect(picked()).toBe('online (server)');
    expect(JSON.parse(window.localStorage.getItem('domino:server-settings')).mode).toBe('online');
  });

  it('opens on the offline game without a connection', async () => {
    setOnline(false);
    await renderCreator();
    expect(picked()).toBe('offline (bots)');
  });
});
