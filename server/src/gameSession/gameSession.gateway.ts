import { setTimeout } from 'timers/promises';
import { BeforeApplicationShutdown } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { WebSocket } from 'ws';
import '../envConfig.js';
import GameSessionService from './gameSession.service.js';
import GameSessionError from './wsTools/GameSessionError.js';
import { PlayerName } from './entities/Player.js';
import GameSessionRes, { DecksInfoRes, PlayerRes, MoveRes, NameContainerRes, MovePermissionRes, RoundRes, NextMoveRes } from './wsTools/responseTypes.js';
import ErrorStatus from './wsTools/ErrorStatus.js';
import DominoTile, { EndValue } from './entities/DominoTile.js';
import { MoveOption } from './playMode/PlayMode.js';
import MoveState from './playMode/MoveState.js';
import gatewayShutdown from './wsTools/gatewayShutdown.js';

interface SessionPlayer {
  name: PlayerName,
  socket: WebSocket | null,
  bot?: boolean
}

type GameSessions = Record<string, SessionPlayer[]>;
type GameSessionResP<T> = Promise<GameSessionRes<T>>;
type TileData = { left: string, right: string };

const WS_PORT: number = parseInt(process.env.WS_PORT, 10) || 8081;
const parsedBotDelay: number = parseInt(process.env.BOT_MOVE_DELAY, 10);
// 0 is a valid delay (no pause before bot moves)
const BOT_MOVE_DELAY: number = Number.isNaN(parsedBotDelay) ? 800 : parsedBotDelay;

@WebSocketGateway(WS_PORT, { path: '/domino-session' })
export default class GameSessionGateway implements BeforeApplicationShutdown, OnGatewayDisconnect {
  private readonly sessions: GameSessions = {};
  // sessions which are switching moves/rounds and must not accept player actions
  private readonly locked: Set<string> = new Set();
  // pending join operations per session (joins are serialized to keep names unique)
  private readonly joinQueue: Map<string, Promise<unknown>> = new Map();

  constructor(public readonly sessionHandler: GameSessionService) {}

  public async newSession(
    players: number,
    finalScore: number,
    bots: number = 0
  ): Promise<string> {
    const id: string = await this.sessionHandler.makeNewSession(players, finalScore, bots);
    this.sessions[id] = [];
    try {
      for (let i: number = 0; i < bots; ++i) {
        const { name }: PlayerRes = await this.sessionHandler.joinSession(id);
        this.sessions[id].push({ name, socket: null, bot: true });
      }
    } catch (e) {
      // a half-seated session would never be cleaned up: no human can join it
      await this.removeSession(id).catch(gatewayShutdown);
      throw e;
    }
    return id;
  }

  public async beforeApplicationShutdown(): Promise<void> {
    const disconnectionError: GameSessionError = GameSessionError.serverClosed();
    const stringifiedData: string = JSON.stringify(disconnectionError.info());
    const onSessionClose = async (id: string): Promise<void> => {
      this.closeAll(id, stringifiedData);
      await this.removeSession(id);
    };

    await Promise.all(Object.keys(this.sessions).map(onSessionClose))
      .catch(gatewayShutdown);
  }

  public async handleDisconnect(client: WebSocket): Promise<void> {
    for (const sid in this.sessions) {
      const players: SessionPlayer[] = this.sessions[sid];
      const disconnected: SessionPlayer = players
        .find((p: SessionPlayer): boolean => !p.bot && p.socket === client);
      if (!disconnected) continue;
      const awaitStart: boolean | undefined = await this.sessionHandler.shouldWaitForPlayers(sid)
        .catch((e: Error): undefined | never => {
          gatewayShutdown(e);
          return undefined;
        });
      if (awaitStart === undefined) return;
      if (awaitStart) {
        const notifyData: PlayerRes = await this.sessionHandler.removePlayer(sid, disconnected.name);
        const removeIdx: number = this.sessions[sid].indexOf(disconnected);
        this.sessions[sid].splice(removeIdx, 1);
        const humansLeft: boolean = this.sessions[sid].some((p: SessionPlayer): boolean => !p.bot);
        if (!humansLeft)
          await this.removeSession(sid);
        else
          this.broadcast(sid, notifyData, 'leaveSession');
      } else {
        const disconnectedData: NameContainerRes = { name: disconnected.name };
        this.closeAll(sid, this.responseWrapperStr(disconnectedData, 'interruptedSession'), client);
        await this.removeSession(sid);
      }
      return;
    }
  }

  @SubscribeMessage('joinSession')
  @GameSessionError.catchHandler()
  public async onSessionJoin(
    @ConnectedSocket() client: WebSocket,
    @MessageBody('session') session: string
  ): GameSessionResP<PlayerRes> {
    if (typeof session !== 'string') throw GameSessionError.badRequest();
    if (!this.sessions[session]) throw GameSessionError.notExists();
    const previous: Promise<unknown> = this.joinQueue.get(session) ?? Promise.resolve();
    const current: GameSessionResP<PlayerRes> = previous
      .catch((): void => undefined)
      .then((): GameSessionResP<PlayerRes> => this.joinPlayer(client, session));
    this.joinQueue.set(session, current);
    try {
      return await current;
    } finally {
      if (this.joinQueue.get(session) === current) this.joinQueue.delete(session);
    }
  }

  private async joinPlayer(client: WebSocket, session: string): GameSessionResP<PlayerRes> {
    if (!this.sessions[session]) throw GameSessionError.notExists();
    const clientReserved: boolean = this.sessions[session]
      .some((c: SessionPlayer): boolean => !c.bot && c.socket === client);
    if (clientReserved) throw GameSessionError.forbidden();
    const joinedInfo: PlayerRes = await this.sessionHandler.joinSession(session);
    // the client may disconnect while its join is queued: free the reserved seat
    if (client.readyState !== WebSocket.OPEN || !this.sessions[session]) {
      if (this.sessions[session]) await this.sessionHandler.removePlayer(session, joinedInfo.name);
      return undefined;
    }
    const bots: PlayerName[] = this.getBots(session);
    if (bots.length) joinedInfo.bots = bots;
    this.broadcast(session, joinedInfo, 'sessionNewcomer');
    this.sessions[session].push({ name: joinedInfo.name, socket: client });
    const shouldWait: boolean = await this.sessionHandler.shouldWaitForPlayers(session);
    if (!shouldWait) this.runSafe(session, this.startNewRound(session));
    return this.responseWrapper(joinedInfo, 'joinSession');
  }

  @SubscribeMessage('moveCheck')
  @GameSessionError.catchHandler()
  public async onMoveCheck(
    @ConnectedSocket() client: WebSocket,
    @MessageBody('session') session: string,
    @MessageBody('tile') tileData: TileData,
    @MessageBody('side') moveSide: MoveOption
  ): GameSessionResP<MovePermissionRes> {
    const player: PlayerName = await this.validatePlayerParams(client, session);
    if (moveSide !== 'left' && moveSide !== 'right') throw GameSessionError.badRequest();
    const tile: DominoTile = this.parseTileData(tileData);
    const permission: boolean = await this.sessionHandler
      .ableToMove(session, player, tile, moveSide);
    const resData: MovePermissionRes = { permission, tile, side: moveSide };
    return this.responseWrapper(resData, 'moveCheck');
  }

  @SubscribeMessage('moveAction')
  @GameSessionError.catchHandler()
  public async onMoveAction(
    @ConnectedSocket() client: WebSocket,
    @MessageBody('session') session: string,
    @MessageBody('tile') tileData: TileData,
    @MessageBody('side') moveSide: MoveOption
  ): Promise<void> {
    const player: PlayerName = await this.validatePlayerParams(client, session);
    if (moveSide !== 'left' && moveSide !== 'right') throw GameSessionError.badRequest();
    const tile: DominoTile = this.parseTileData(tileData);
    if (!this.tryLock(session)) throw GameSessionError.unavailableMove();
    await this.makeMove(session, player, tile, moveSide);
  }

  @SubscribeMessage('fromStock')
  @GameSessionError.catchHandler()
  public async onTakeFromStock(
    @ConnectedSocket() client: WebSocket,
    @MessageBody('session') session: string
  ): Promise<void> {
    const player: PlayerName = await this.validatePlayerParams(client, session);
    if (!this.tryLock(session)) throw GameSessionError.unavailableMove();
    await this.takeFromStock(session, player);
  }

  // locks the session synchronously (after the async validation): of two
  // concurrent actions only the first one is applied. A move action keeps the
  // lock until the next turn; taking from the stock releases it.
  private tryLock(session: string): boolean {
    if (this.locked.has(session)) return false;
    this.locked.add(session);
    return true;
  }

  private async makeMove(
    session: string,
    player: PlayerName,
    tile: DominoTile,
    moveSide: MoveOption
  ): Promise<void> {
    // the caller holds the lock
    let moveRes: MoveRes[];
    try {
      moveRes = await this.sessionHandler.moveAction(session, player, tile, moveSide);
    } catch (e) {
      this.locked.delete(session);
      throw e;
    }
    this.notifyPlayers(session, moveRes, 'moveAction');
    // the move is stored: a failure from here on must end the session, or it
    // would stay locked with nobody to move
    this.runSafe(session, this.finishMove(session, player));
  }

  private async finishMove(session: string, player: PlayerName): Promise<void> {
    const emptyDeck: boolean = await this.sessionHandler.outOfTiles(session, player);
    if (emptyDeck) await this.endRound(session);
    else await this.nextPlayerMove(session);
  }

  private async takeFromStock(session: string, player: PlayerName): Promise<void> {
    // the caller holds the lock
    try {
      const stockRes: MoveRes[] = await this.sessionHandler.getFromStock(session, player);
      this.notifyPlayers(session, stockRes, 'fromStock');
      this.locked.delete(session);
      this.runSafe(session, this.handleMoveState(session, player));
    } catch(e) {
      this.locked.delete(session);
      const emptyStockMsg: string = 'there are no tiles in the stock';
      if (e.message !== emptyStockMsg) throw e;
      throw GameSessionError.emptyStock();
    }
  }

  private async botMove(session: string, player: PlayerName): Promise<void> {
    await setTimeout(BOT_MOVE_DELAY);
    if (!this.sessions[session] || this.locked.has(session)) return;
    const shouldMove: boolean = await this.sessionHandler.shouldMove(session, player);
    if (!shouldMove) return;
    const move: [DominoTile, MoveOption] | null =
      await this.sessionHandler.pickBotMove(session, player);
    if (!this.tryLock(session)) return;
    if (move) {
      const [ tile, side ]: [DominoTile, MoveOption] = move;
      await this.makeMove(session, player, tile, side);
    } else {
      await this.takeFromStock(session, player);
    }
  }

  private async validatePlayerParams(
    socket: WebSocket,
    session: string
  ): Promise<PlayerName> {
    if (typeof session !== 'string') throw GameSessionError.badRequest();
    const player: SessionPlayer = this.sessions[session]?.find(
      (p: SessionPlayer): boolean => !p.bot && p.socket === socket
    );
    if (!player) throw GameSessionError.forbidden();
    if (this.locked.has(session)) throw GameSessionError.unavailableMove();
    const shouldMove: boolean =
      await this.sessionHandler.shouldMove(session, player.name);
    if (!shouldMove) throw GameSessionError.unavailableMove();
    return player.name;
  }

  private async endRound(
    session: string,
    deadEnd: boolean = false
  ): Promise<void> {
    this.locked.add(session);
    const delay: number = 1000;
    await setTimeout(delay);
    if (!this.sessions[session]) return;
    const roundRes: RoundRes = await this.sessionHandler.endRound(session);
    roundRes.deadEnd = deadEnd;
    if (roundRes.endGame) {
      this.closeAll(session, this.responseWrapperStr(roundRes, 'endRound'));
      return this.removeSession(session);
    }
    this.broadcast(session, roundRes, 'endRound');
    await this.startNewRound(session);
  }

  private parseTileData(tile: TileData): DominoTile {
    if (!tile) throw GameSessionError.badRequest();
    const { left, right }: TileData = tile;
    const leftParsed: number = parseInt(left, 10);
    const rightParsed: number = parseInt(right, 10);
    if (isNaN(leftParsed) || isNaN(rightParsed))
      throw GameSessionError.badRequest();
    const invalidLeftValue: boolean = leftParsed < 0 || leftParsed > 6;
    const invalidRightValue: boolean = rightParsed < 0 || rightParsed > 6;
    if (invalidLeftValue || invalidRightValue)
      throw GameSessionError.badRequest();
    return DominoTile.of(leftParsed as EndValue, rightParsed as EndValue);
  }

  private async startNewRound(session: string): Promise<void> {
    this.locked.add(session);
    const delay: number = 1000;
    await setTimeout(delay);
    if (!this.sessions[session]) return;
    const decksInfo: DecksInfoRes[] = await this.sessionHandler.roundSetup(session);
    this.notifyPlayers(session, decksInfo, 'roundStart');
    await setTimeout(delay);
    if (!this.sessions[session]) return;
    const firstMoveInfo: MoveRes[] = await this.sessionHandler.firstMove(session);
    this.notifyPlayers(session, firstMoveInfo, 'firstMove');
    await this.nextPlayerMove(session);
  }

  private async nextPlayerMove(
    session: string,
    previous: PlayerName = null
  ): Promise<void> {
    const delay = 1000;
    await setTimeout(delay);
    if (!this.sessions[session]) return;
    this.locked.add(session);
    const nextPlayer: PlayerName = await this.sessionHandler.setNextPlayer(session);
    this.locked.delete(session);
    const nextMoveInfo: NextMoveRes = { name: nextPlayer };
    if (previous) nextMoveInfo.skippedBy = previous;
    this.broadcast(session, nextMoveInfo, 'nextMove');
    await this.handleMoveState(session, nextPlayer);
  }

  private async handleMoveState(
    session: string,
    player: PlayerName
  ): Promise<void> {
    if (!this.sessions[session]) return;
    const moveState: MoveState = await this.sessionHandler.ableToPlay(session, player);
    if (moveState !== MoveState.AVAILABLE) this.locked.add(session);
    if (moveState === MoveState.SKIPPABLE)
      this.runSafe(session, this.nextPlayerMove(session, player));
    else if (moveState === MoveState.DEAD_END)
      this.runSafe(session, this.endRound(session, true));
    else if (this.isBot(session, player))
      this.runSafe(session, this.botMove(session, player));
  }

  private runSafe(session: string, task: Promise<unknown>): void {
    task.catch(async (e: Error): Promise<void> => {
      // a session may be removed (player left) while a delayed action is pending
      if (!this.sessions[session]) return;
      console.error(e);
      // a failed turn chain would leave the session locked forever: end it
      this.closeAll(session, JSON.stringify(GameSessionError.internal().info()));
      await this.removeSession(session).catch(gatewayShutdown);
    });
  }

  private isBot(session: string, player: PlayerName): boolean {
    return !!this.sessions[session]?.some(
      (p: SessionPlayer): boolean => p.bot && p.name === player
    );
  }

  private getBots(session: string): PlayerName[] {
    return (this.sessions[session] ?? [])
      .filter((p: SessionPlayer): boolean => p.bot)
      .map((p: SessionPlayer): PlayerName => p.name);
  }

  private broadcast<T>(session: string, data: T, event: string): void {
    const stringified: string = this.responseWrapperStr(data, event);
    for (const { socket } of this.sessions[session] ?? [])
      socket?.send(stringified);
  }

  // sends the last message to the human players of a session and disconnects them
  private closeAll(session: string, message: string, except: WebSocket | null = null): void {
    for (const { socket } of this.sessions[session] ?? []) {
      if (!socket || socket === except) continue;
      socket.send(message);
      socket.close();
    }
  }

  private notifyPlayers<T extends NameContainerRes>(
    session: string,
    dataArr: T[],
    event: string
  ): void {
    for (const { name, socket } of this.sessions[session] ?? []) {
      if (!socket) continue;
      const data: T = dataArr.find((d: T): boolean => d.name === name);
      socket.send(this.responseWrapperStr(data, event));
    }
  }

  private responseWrapper<T>(data: T, event: string): GameSessionRes<T> {
    return { event, data, errorStatus: ErrorStatus.NONE };
  }

  private responseWrapperStr<T>(data: T, event: string): string {
    return JSON.stringify(this.responseWrapper(data, event));
  }

  private async removeSession(session: string): Promise<void> {
    delete this.sessions[session];
    this.locked.delete(session);
    await this.sessionHandler.removeSession(session);
  }
}
