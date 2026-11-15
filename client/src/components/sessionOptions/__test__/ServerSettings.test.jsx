import '@testing-library/jest-dom';
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ServerSettings from '../ServerSettings';
import { loadSettings, saveSettings } from '../../../config/server';

jest.mock('../../../api/http/commands', () => ({ pingServer: jest.fn().mockResolvedValue(true) }));

it('resets the server addresses but keeps the chosen game mode', async () => {
  saveSettings({ mode: 'offline', httpAddr: '10.0.0.2:8080', wsAddr: '10.0.0.2:8081', stun: true });
  await act(async () => { render(<ServerSettings />); });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'defaults' })));
  expect(loadSettings()).toMatchObject({ mode: 'offline', httpAddr: 'localhost:8080', wsAddr: 'localhost:8081', stun: false });
});
