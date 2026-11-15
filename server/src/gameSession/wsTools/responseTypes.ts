import { WsResponse } from '@nestjs/websockets';
import DominoTile, { TilesDeck } from '../entities/DominoTile.js';
import { PlayerName } from '../entities/Player.js';
import { MoveOption } from '../playMode/PlayMode.js';
import { PlayersScore } from '../playMode/ScoreKeeper.js';
import { SessionData } from '../storage/StorageClient.js';

export default interface GameSessionRes<T> extends WsResponse<T> {
  errorStatus: string
}

export interface PlayerRes extends SessionData {
  name: PlayerName,
  scores: PlayersScore,
  bots?: PlayerName[]
}

export interface DecksInfoRes extends PlayerRes {
  deck?: TilesDeck,
  tilesCount: PlayersScore,
  stock: number
}

export interface MoveRes extends DecksInfoRes {
  tile?: DominoTile,
  commonDeck: TilesDeck
}

export interface RoundRes extends SessionData {
  scores: PlayersScore,
  endGame: boolean,
  winner?: PlayerName,
  deadEnd?: boolean 
}

export interface NameContainerRes {
  name: PlayerName
}

export interface MovePermissionRes {
  permission: boolean,
  side: MoveOption,
  tile: DominoTile
}

export interface NextMoveRes extends NameContainerRes {
  skippedBy?: PlayerName
}
