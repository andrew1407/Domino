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
