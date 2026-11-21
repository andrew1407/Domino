import '@testing-library/jest-dom';
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ServerSettings from '../ServerSettings';
import { loadSettings, saveSettings } from '../../../config/server';

jest.mock('../../../api/http/commands', () => ({ pingServer: jest.fn().mockResolvedValue(true) }));

it('resets the server addresses but keeps the chosen game mode', async () => {
  saveSettings({ mode: 'offline', httpAddr: '10.0.0.2:8080', wsAddr: '10.0.0.2:8081', stun: true, stunUrl: 's.example.com', turnUrl: 'turn:t.example.com', turnUser: 'u', turnPass: 'p' });
  await act(async () => { render(<ServerSettings />); });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'defaults' })));
  expect(loadSettings()).toMatchObject({ mode: 'offline', httpAddr: 'localhost:8080', wsAddr: 'localhost:8081', stun: false, stunUrl: '', turnUrl: '', turnUser: '', turnPass: '' });
});

it('saves the TURN server', async () => {
  await act(async () => { render(<ServerSettings />); });
  fireEvent.change(screen.getByLabelText('TURN server:'), { target: { value: 'turn.example.com:3478' } });
  fireEvent.change(screen.getByLabelText('TURN username:'), { target: { value: 'user' } });
  fireEvent.change(screen.getByLabelText('TURN password:'), { target: { value: 'secret' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'save' })));
  expect(loadSettings()).toMatchObject({ turnUrl: 'turn.example.com:3478', turnUser: 'user', turnPass: 'secret' });
});

it('warns about a TURN server without the login', async () => {
  saveSettings({ turnUrl: '', turnUser: '', turnPass: '' });
  await act(async () => { render(<ServerSettings />); });
  expect(screen.queryByRole('alert')).toBeNull();
  fireEvent.change(screen.getByLabelText('TURN server:'), { target: { value: 'turn.example.com:3478' } });
  expect(screen.getByRole('alert')).toHaveTextContent('needs both a username and a password');
  fireEvent.change(screen.getByLabelText('TURN username:'), { target: { value: 'u' } });
  fireEvent.change(screen.getByLabelText('TURN password:'), { target: { value: 'p' } });
  expect(screen.queryByRole('alert')).toBeNull();
});

it('warns about a malformed server address', async () => {
  saveSettings({ stunUrl: '', turnUrl: '', turnUser: '', turnPass: '' });
  await act(async () => { render(<ServerSettings />); });
  fireEvent.change(screen.getByLabelText('STUN server:'), { target: { value: 'stun.example.com:abc' } });
  expect(screen.getByRole('alert')).toHaveTextContent('Not a valid server address: stun:stun.example.com:abc');
  fireEvent.change(screen.getByLabelText('STUN server:'), { target: { value: 'stun.example.com:3478' } });
  expect(screen.queryByRole('alert')).toBeNull();
});
