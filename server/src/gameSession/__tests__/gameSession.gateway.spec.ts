import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { WebSocket } from 'ws';
import { setTimeout } from 'timers/promises';
import DominoTile from '../entities/DominoTile.js';
import { PlayerName } from '../entities/Player.js';
import GameSessionGateway from '../gameSession.gateway.js';
import GameSessionService from '../gameSession.service.js';
import { MoveOption } from '../playMode/PlayMode.js';
import GameSessionError from '../wsTools/GameSessionError.js';
import GameSessionRes, { MovePermissionRes, PlayerRes } from '../wsTools/responseTypes.js';


const gameSessionServiceStub: Record<string, Mock> = {
  makeNewSession: vi.fn((): string => 'test-session-id'),
  removeSession: vi.fn(),
  removePlayer: vi.fn(),
  shouldWaitForPlayers: vi.fn(async (): Promise<boolean> => true),
  shouldMove: vi.fn((): boolean => true),
  joinSession: vi.fn((): object => ({ name: 'Bobo' })),
  ableToMove: vi.fn((): boolean => false),
  ableToPlay: vi.fn((): boolean => false),
  moveAction: vi.fn((): unknown[] => []),
  outOfTiles: vi.fn((): boolean => false),
  setNextPlayer: vi.fn(),
  getFromStock: vi.fn(),
  pickBotMove: vi.fn(),
};

describe('game session gateway', (): void => {
  let gateway: GameSessionGateway;
  beforeAll(async (): Promise<void> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GameSessionGateway, GameSessionService],
    })
      .overrideProvider(GameSessionService)
      .useValue(gameSessionServiceStub)
      .compile();
    gateway = module.get(GameSessionGateway);
  });

  afterEach((): void => {
    for (const sid of Object.keys(gateway['sessions']))
      delete gateway['sessions'][sid];
    gateway['locked'].clear();
    vi.clearAllMocks();
  });

  describe('makeNewSession', (): void => {    
    it('should return created session id', async (): Promise<void> => {
      const players: number = 2;
      const score: number = 56;
      const result: string = await gateway.newSession(players, score);
      expect(result).toEqual('test-session-id');
      expect(gameSessionServiceStub.makeNewSession).toBeCalledTimes(1);
      expect(gameSessionServiceStub.makeNewSession).toBeCalledWith(players, score, 0);
    });

    it('should create an empty session players array', async (): Promise<void> => {
      const id: string = await gateway.newSession(3, 10);
      const sessions: { [key: string]: unknown[] } = gateway['sessions'];
      expect(sessions).toHaveProperty(id);
      expect(Object.keys(sessions)).toHaveLength(1);
      expect(sessions[id]).toHaveLength(0);
    });
  });

  describe('newSession with bots', (): void => {
    it('should remove a session whose bots could not be seated', async (): Promise<void> => {
      gameSessionServiceStub.joinSession
        .mockImplementationOnce((): object => ({ name: 'Sasik' }))
        .mockImplementationOnce(async (): Promise<never> => { throw new Error('redis is down'); });
      await expect(gateway.newSession(4, 50, 3)).rejects.toThrow('redis is down');
      expect(gateway['sessions']['test-session-id']).toBeUndefined();
      expect(gameSessionServiceStub.removeSession).toBeCalledWith('test-session-id');
    });


    it('should join bot players right after the session creation', async (): Promise<void> => {
      gameSessionServiceStub.joinSession
        .mockImplementationOnce((): object => ({ name: 'Sasik' }))
        .mockImplementationOnce((): object => ({ name: 'Mavun' }));
      const id: string = await gateway.newSession(3, 50, 2);
      expect(gameSessionServiceStub.makeNewSession).toBeCalledWith(3, 50, 2);
      expect(gameSessionServiceStub.joinSession).toBeCalledTimes(2);
      expect(gateway['sessions'][id]).toStrictEqual([
        { name: 'Sasik', socket: null, bot: true },
        { name: 'Mavun', socket: null, bot: true },
      ]);
    });

    it('should remove the session when the last human leaves before start', async (): Promise<void> => {
      const sessions: { [key: string]: unknown[] } = gateway['sessions'];
      const id: string = 'test-session-id';
      const socket: object = {};
      sessions[id] = [{ name: 'Sasik', socket: null, bot: true }, { name: 'Bobo', socket }];
      await gateway.handleDisconnect(socket as WebSocket);
      expect(gameSessionServiceStub.removePlayer).toBeCalledWith(id, 'Bobo');
      expect(gameSessionServiceStub.removeSession).toBeCalledWith(id);
      expect(sessions).not.toHaveProperty(id);
    });

    it('should not treat bots as connected sockets', async (): Promise<void> => {
      const sessions: { [key: string]: unknown[] } = gateway['sessions'];
      const id: string = 'test-session-id';
      sessions[id] = [{ name: 'Sasik', socket: null, bot: true }];
      await gateway.handleDisconnect(null);
      expect(gameSessionServiceStub.removePlayer).toBeCalledTimes(0);
      expect(sessions).toHaveProperty(id);
    });

    it('should make a bot move with a playable tile', async (): Promise<void> => {
      const id: string = 'test-session-id';
      gateway['sessions'][id] = [{ name: 'Sasik', socket: null, bot: true }];
      const tile: DominoTile = DominoTile.of(2, 3);
      gameSessionServiceStub.pickBotMove.mockImplementationOnce(async (): Promise<unknown> => [tile, 'left']);
      await gateway['botMove'](id, 'Sasik');
      expect(gameSessionServiceStub.moveAction).toBeCalledWith(id, 'Sasik', tile, 'left');
      expect(gameSessionServiceStub.getFromStock).toBeCalledTimes(0);
    });

    it('should take a tile from the stock if a bot has nothing to play', async (): Promise<void> => {
      const id: string = 'test-session-id';
      gateway['sessions'][id] = [{ name: 'Sasik', socket: null, bot: true }];
      gameSessionServiceStub.pickBotMove.mockImplementationOnce(async (): Promise<unknown> => null);
      gameSessionServiceStub.getFromStock.mockImplementationOnce(async (): Promise<unknown[]> => []);
      await gateway['botMove'](id, 'Sasik');
      expect(gameSessionServiceStub.moveAction).toBeCalledTimes(0);
      expect(gameSessionServiceStub.getFromStock).toBeCalledWith(id, 'Sasik');
    });
  });

  describe('beforeApplicationShutdown', (): void => {
    it(
      'should call "removeSession" method 2 times with session id params',
      async (): Promise<void> => {
        const sessions: { [key: string]: unknown[] } = gateway['sessions'];
        sessions['session-1'] = [];
        sessions['session-2'] = [];
        gateway.beforeApplicationShutdown();
        expect(gameSessionServiceStub.removeSession).toBeCalledTimes(2);
        expect(gameSessionServiceStub.removeSession).nthCalledWith(1, 'session-1');
        expect(gameSessionServiceStub.removeSession).nthCalledWith(2, 'session-2');
      }
    );
  });

  describe('handleDisconnect', (): void => {
    it('should remove session if shouldWaitForPlayers is false', async (): Promise<void> => {
      gameSessionServiceStub.shouldWaitForPlayers
        .mockImplementationOnce(async (): Promise<boolean> => false);
      const sessions: { [key: string]: unknown[] } = gateway['sessions'];
      const id: string = 'test-session-id';
      const name: PlayerName = 'Bobo';
      sessions[id] = [{ name, socket: null }];
      await gateway.handleDisconnect(null);
      expect(gameSessionServiceStub.removePlayer).toBeCalledTimes(0);
      expect(gameSessionServiceStub.removeSession).toBeCalledTimes(1);
      expect(gameSessionServiceStub.removeSession).toBeCalledWith(id);
      expect(sessions).not.toHaveProperty(id);
    });

    it('should remove player if shouldWaitForPlayers is true', async (): Promise<void> => {
      const sessions: { [key: string]: unknown[] } = gateway['sessions'];
      const id: string = 'test-session-id';
      const name: PlayerName = 'Bobo';
      sessions[id] = [{ name, socket: null }];
      await gateway.handleDisconnect(null);
      expect(gameSessionServiceStub.removeSession).toBeCalledTimes(1);
      expect(gameSessionServiceStub.removePlayer).toBeCalledTimes(1);
      expect(gameSessionServiceStub.removePlayer).toBeCalledWith(id, name);
      expect(sessions).not.toHaveProperty(id);
    });
  });

  describe('onSessionJoin', (): void => {
    it('should return an error when type of session is not a string', async (): Promise<void> => {
      const expectedErr: GameSessionRes<string> = GameSessionError.badRequest().info();
      const result: GameSessionRes<PlayerRes> = await gateway.onSessionJoin(null, null);
      expect(result).toStrictEqual(expectedErr);
    });

    it('should return an error when the session doesn\'t exist', async (): Promise<void> => {
      const expectedErr: GameSessionRes<string> = GameSessionError.notExists().info();
      const result: GameSessionRes<PlayerRes> = await gateway.onSessionJoin(null, 'test-session-id');
      expect(result).toStrictEqual(expectedErr);
    });

    it('should return an error when the client has already joined', async (): Promise<void> => {
      const sessions: { [key: string]: unknown[] } = gateway['sessions'];
      const id: string = 'test-session-id';
      sessions[id] = [{ name: 'Bobo', socket: null }];
      const expectedErr: GameSessionRes<string> = GameSessionError.forbidden().info();
      const result: GameSessionRes<PlayerRes> = await gateway.onSessionJoin(null, id);
      expect(result).toStrictEqual(expectedErr);
    });

    it('should add client to session array', async (): Promise<void> => {
      const sessions: { [key: string]: unknown[] } = gateway['sessions'];
      const id: string = 'test-session-id';
      sessions[id] = [];
      const socket: object = { readyState: WebSocket.OPEN, send: vi.fn() };
      await gateway.onSessionJoin(socket as WebSocket, id);
      expect(gameSessionServiceStub.joinSession).toBeCalledTimes(1);
      expect(sessions[id]).toStrictEqual([{ name: 'Bobo', socket }]);
    });

    it('should free the seat of a client which disconnected while its join was queued', async (): Promise<void> => {
      const sessions: { [key: string]: unknown[] } = gateway['sessions'];
      const id: string = 'test-session-id';
      sessions[id] = [];
      const socket: object = { readyState: WebSocket.CLOSED, send: vi.fn() };
      await gateway.onSessionJoin(socket as WebSocket, id);
      expect(sessions[id]).toStrictEqual([]);
      expect(gameSessionServiceStub.removePlayer).toBeCalledWith(id, 'Bobo');
      expect(gameSessionServiceStub.shouldWaitForPlayers).toBeCalledTimes(0);
    });
  });

  describe('concurrent actions', (): void => {
    it('should apply only the first of two simultaneous moves of a player', async (): Promise<void> => {
      const sessions: { [key: string]: unknown[] } = gateway['sessions'];
      const id: string = 'test-session-id';
      const socket: object = { send: vi.fn() };
      sessions[id] = [{ name: 'Bobo', socket }];
      const results: unknown[] = await Promise.all([
        gateway.onMoveAction(socket as WebSocket, id, { left: '0', right: '1' }, 'right'),
        gateway.onMoveAction(socket as WebSocket, id, { left: '2', right: '1' }, 'left'),
      ]);
      expect(gameSessionServiceStub.moveAction).toBeCalledTimes(1);
      expect(results[1]).toStrictEqual(GameSessionError.unavailableMove().info());
      delete sessions[id];
      await setTimeout(1100);
    });

    it('should release the lock when a move is rejected', async (): Promise<void> => {
      const sessions: { [key: string]: unknown[] } = gateway['sessions'];
      const id: string = 'test-session-id';
      const socket: object = { send: vi.fn() };
      sessions[id] = [{ name: 'Bobo', socket }];
      gameSessionServiceStub.moveAction.mockImplementationOnce(async (): Promise<never> => {
        throw new Error('invalid deck entries');
      });
      await gateway.onMoveAction(socket as WebSocket, id, { left: '0', right: '1' }, 'right');
      expect(gateway['locked'].has(id)).toBe(false);
    });

    it('should end the session when a stored move cannot be finished', async (): Promise<void> => {
      const sessions: { [key: string]: unknown[] } = gateway['sessions'];
      const id: string = 'test-session-id';
      const socket: { send: Mock, close: Mock } = { send: vi.fn(), close: vi.fn() };
      sessions[id] = [{ name: 'Bobo', socket }];
      gameSessionServiceStub.outOfTiles.mockImplementationOnce(async (): Promise<never> => {
        throw new Error('redis is down');
      });
      const error: (typeof console)['error'] = console.error;
      console.error = vi.fn();
      await gateway.onMoveAction(socket as unknown as WebSocket, id, { left: '0', right: '1' }, 'right');
      await setTimeout(10);
      console.error = error;
      expect(sessions[id]).toBeUndefined();
      expect(gateway['locked'].has(id)).toBe(false);
      const statuses: string[] = socket.send.mock.calls.map((c: string[]): string => JSON.parse(c[0]).errorStatus);
      expect(statuses).toContain('INTERNAL_SERVER_ERROR');
      expect(socket.close).toBeCalledTimes(1);
    });

    it('should not let a bot move while the session is locked', async (): Promise<void> => {
      const sessions: { [key: string]: unknown[] } = gateway['sessions'];
      const id: string = 'test-session-id';
      sessions[id] = [{ name: 'Sasik', socket: null, bot: true }];
      gameSessionServiceStub.pickBotMove.mockImplementationOnce(async (): Promise<unknown> => {
        // a human action locks the session while the bot is deciding
        gateway['locked'].add(id);
        return [DominoTile.of(0, 1), 'right'];
      });
      await gateway['botMove'](id, 'Sasik');
      expect(gameSessionServiceStub.moveAction).toBeCalledTimes(0);
    });

    it('should end a session whose turn chain has failed', async (): Promise<void> => {
      const sessions: { [key: string]: unknown[] } = gateway['sessions'];
      const id: string = 'test-session-id';
      const socket: { send: Mock, close: Mock } = { send: vi.fn(), close: vi.fn() };
      sessions[id] = [{ name: 'Bobo', socket }, { name: 'Sasik', socket: null, bot: true }];
      gateway['runSafe'](id, Promise.reject(new Error('redis is down')));
      const error: (typeof console)['error'] = console.error;
      console.error = vi.fn();
      await setTimeout(10);
      console.error = error;
      expect(JSON.parse(socket.send.mock.calls[0][0]).errorStatus).toBe('INTERNAL_SERVER_ERROR');
      expect(socket.close).toBeCalledTimes(1);
      expect(sessions[id]).toBeUndefined();
      expect(gameSessionServiceStub.removeSession).toBeCalledWith(id);
    });
  });

  describe('onMoveCheck', (): void => {
    it('should return an error when type of session is not a string', async (): Promise<void> => {
      const expectedErr: GameSessionRes<string> = GameSessionError.badRequest().info();
      const result: GameSessionRes<MovePermissionRes> =
        await gateway.onMoveCheck(null, null, { left: '2', right: '4' }, 'left');
      expect(result).toStrictEqual(expectedErr);
    });

    it('should return an error when the session doesn\'t exist', async (): Promise<void> => {
      const expectedErr: GameSessionRes<string> = GameSessionError.forbidden().info();
      const result: GameSessionRes<MovePermissionRes> =
        await gateway.onMoveCheck(null, 'test-session-id', { left: '2', right: '4' }, 'left');
      expect(result).toStrictEqual(expectedErr);
    });

    it('should return an error when the player doesn\'t exist', async (): Promise<void> => {
      const sessions: { [key: string]: unknown[] } = gateway['sessions'];
      const id: string = 'test-session-id';
      sessions[id] = [];
      const result: GameSessionRes<MovePermissionRes> =
        await gateway.onMoveCheck(null, id, { left: '2', right: '4' }, 'left');
      const expectedErr: GameSessionRes<string> = GameSessionError.forbidden().info();
      expect(result).toStrictEqual(expectedErr);
    });

    it('should return an error when client cannot move', async (): Promise<void> => {
      gameSessionServiceStub.shouldMove
        .mockImplementationOnce((): boolean => false);
      const sessions: { [key: string]: unknown[] } = gateway['sessions'];
      const id: string = 'test-session-id';
      sessions[id] = [{ name: 'Bobo', socket: null }];
      const expectedErr: GameSessionRes<string> = GameSessionError.unavailableMove().info();
      const result: GameSessionRes<MovePermissionRes> =
        await gateway.onMoveCheck(null, id, { left: '2', right: '4' }, 'left');
      expect(result).toStrictEqual(expectedErr);
    });

    it('should return an error when move option is invalid', async (): Promise<void> => {
      const sessions: { [key: string]: unknown[] } = gateway['sessions'];
      const id: string = 'test-session-id';
      sessions[id] = [{ name: 'Bobo', socket: null }];
      const expectedErr: GameSessionRes<string> = GameSessionError.badRequest().info();
      const result: GameSessionRes<MovePermissionRes> =
        await gateway.onMoveCheck(null, id, { left: '2', right: '4' }, null);
      expect(result).toStrictEqual(expectedErr);
    });

    it.each([
      [null, 'no tile'],
      [{ left: '56ds', right: '4' }, 'data cannot be parsed'],
      [{ left: '8', right: '2' }, 'left end out of range'],
      [{ left: '0', right: '-2' }, 'right end out of range'],
    ])(
      'should return an error when tile is invalid (%s)',
      async (tile: { left: string, right: string }): Promise<void> => {
      const sessions: { [key: string]: unknown[] } = gateway['sessions'];
      const id: string = 'test-session-id';
      sessions[id] = [{ name: 'Bobo', socket: null }];
      const expectedErr: GameSessionRes<string> = GameSessionError.badRequest().info();
      const result: GameSessionRes<MovePermissionRes> =
        await gateway.onMoveCheck(null, id, tile, 'right');
      expect(result).toStrictEqual(expectedErr);
    });

    it('should call ableToMove', async (): Promise<void> => {
      const sessions: { [key: string]: unknown[] } = gateway['sessions'];
      const id: string = 'test-session-id';
      const tile: { left: string, right: string } = { left: '3', right: '5' };
      const side: MoveOption = 'right';
      const name: PlayerName = 'Bobo';
      sessions[id] = [{ name, socket: null }];
      await gateway.onMoveCheck(null, id, tile, side);
      expect(gameSessionServiceStub.ableToMove).toBeCalledTimes(1);
      expect(gameSessionServiceStub.ableToMove)
        .toBeCalledWith(id, name, DominoTile.of(3, 5), side);
    });
  });

  describe('onMoveAction', (): void => {
    it('should return an error when type of session is not a string', async (): Promise<void> => {
      const expectedErr: GameSessionRes<string> = GameSessionError.badRequest().info();
      const result: void =
        await gateway.onMoveAction(null, null, { left: '2', right: '4' }, 'left');
      expect(result).toStrictEqual(expectedErr);
    });

    it('should return an error when the session doesn\'t exist', async (): Promise<void> => {
      const expectedErr: GameSessionRes<string> = GameSessionError.forbidden().info();
      const result: void =
        await gateway.onMoveAction(null, 'test-session-id', { left: '2', right: '4' }, 'left');
      expect(result).toStrictEqual(expectedErr);
    });

    it('should return an error when the player doesn\'t exist', async (): Promise<void> => {
      const sessions: { [key: string]: unknown[] } = gateway['sessions'];
      const id: string = 'test-session-id';
      sessions[id] = [];
      const result: unknown =
        await gateway.onMoveAction(null, id, { left: '2', right: '4' }, 'left');
      const expectedErr: GameSessionRes<string> = GameSessionError.forbidden().info();
      expect(result).toStrictEqual(expectedErr);
    });

    it('should return an error when client cannot move', async (): Promise<void> => {
      gameSessionServiceStub.shouldMove
        .mockImplementationOnce((): boolean => false);
      const sessions: { [key: string]: unknown[] } = gateway['sessions'];
      const id: string = 'test-session-id';
      sessions[id] = [{ name: 'Bobo', socket: null }];
      const expectedErr: GameSessionRes<string> = GameSessionError.unavailableMove().info();
      const result: unknown =
        await gateway.onMoveAction(null, id, { left: '2', right: '4' }, 'left');
      expect(result).toStrictEqual(expectedErr);
    });

    it('should return an error when move option is invalid', async (): Promise<void> => {
      const sessions: { [key: string]: unknown[] } = gateway['sessions'];
      const id: string = 'test-session-id';
      sessions[id] = [{ name: 'Bobo', socket: null }];
      const expectedErr: GameSessionRes<string> = GameSessionError.badRequest().info();
      const result: unknown =
        await gateway.onMoveAction(null, id, { left: '2', right: '4' }, null);
      expect(result).toStrictEqual(expectedErr);
    });

    it.each([
      [null, 'no tile'],
      [{ left: '3', right: 'hjk' }, 'data cannot be parsed'],
      [{ left: '0078', right: '2' }, 'left end out of range'],
      [{ left: '3', right: '-123' }, 'right end out of range'],
    ])(
      'should return an error when tile is invalid (%s)',
      async (tile: { left: string, right: string }): Promise<void> => {
      const sessions: { [key: string]: unknown[] } = gateway['sessions'];
      const id: string = 'test-session-id';
      sessions[id] = [{ name: 'Bobo', socket: null }];
      const expectedErr: GameSessionRes<string> = GameSessionError.badRequest().info();
      const result: unknown = await gateway.onMoveAction(null, id, tile, 'right');
      expect(result).toStrictEqual(expectedErr);
    });

    it.each([
      ['moveAction', 'test-session-id', 'Bobo', DominoTile.of(0, 1), 'right'],
      ['outOfTiles', 'test-session-id', 'Bobo'],
    ])(
      'should call "%s" method',
      async (method: string, ...params: unknown[]): Promise<void> => {        
        const sessions: { [key: string]: unknown[] } = gateway['sessions'];
        const id: string = 'test-session-id';
        const sockeStub: object = { send: () => {} };
        sessions[id] = [{ name: 'Bobo', socket: sockeStub }];
        await gateway.onMoveAction(sockeStub as WebSocket, id, { left: '0', right: '1' }, 'right');
        expect(gameSessionServiceStub[method]).toBeCalledTimes(1);
        expect(gameSessionServiceStub[method]).toBeCalledWith(...params);
        // simulation of response sending
        await setTimeout(2100);
      }
    );
  });

  describe('onTakeFromStock', (): void => {
    it('should return an error when type of session is not a string', async (): Promise<void> => {
      const expectedErr: GameSessionRes<string> = GameSessionError.badRequest().info();
      const result: unknown = await gateway.onTakeFromStock(null, null);
      expect(result).toStrictEqual(expectedErr);
    });

    it('should return an error when the session doesn\'t exist', async (): Promise<void> => {
      const expectedErr: GameSessionRes<string> = GameSessionError.forbidden().info();
      const result: unknown = await gateway.onTakeFromStock(null, 'test-session-id');
      expect(result).toStrictEqual(expectedErr);
    });

    it('should return an error when the player doesn\'t exist', async (): Promise<void> => {
      const sessions: { [key: string]: unknown[] } = gateway['sessions'];
      const id: string = 'test-session-id';
      sessions[id] = [];
      const result: unknown = await gateway.onTakeFromStock(null, id);
      const expectedErr: GameSessionRes<string> = GameSessionError.forbidden().info();
      expect(result).toStrictEqual(expectedErr);
    });

    it('should return an error when client cannot move', async (): Promise<void> => {
      gameSessionServiceStub.shouldMove
        .mockImplementationOnce((): boolean => false);
      const sessions: { [key: string]: unknown[] } = gateway['sessions'];
      const id: string = 'test-session-id';
      sessions[id] = [{ name: 'Bobo', socket: null }];
      const expectedErr: GameSessionRes<string> = GameSessionError.unavailableMove().info();
      const result: unknown = await gateway.onTakeFromStock(null, id);
      expect(result).toStrictEqual(expectedErr);
    });

    it(
      'should return an error (from "getFromStock") when the stock is empty',
      async (): Promise<void> => {
        gameSessionServiceStub.getFromStock.mockImplementationOnce((): never => {
          throw new Error('there are no tiles in the stock');
        });
        const expectedErr: GameSessionRes<string> = GameSessionError.emptyStock().info();
        const sessions: { [key: string]: unknown[] } = gateway['sessions'];
        const id: string = 'test-session-id';
        sessions[id] = [{ name: 'Bobo', socket: null }];  
        const result: unknown = await gateway.onTakeFromStock(null, id);
        expect(result).toStrictEqual(expectedErr);
        expect(gameSessionServiceStub.getFromStock).toBeCalledTimes(1);
        expect(gameSessionServiceStub.getFromStock).toBeCalledWith(id, 'Bobo');
      }
    );
  });
});
