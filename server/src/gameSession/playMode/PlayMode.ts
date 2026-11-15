import DominoTile, { TilesDeck } from '../entities/DominoTile.js';
import { PlayerName } from '../entities/Player.js';
import MoveState from './MoveState.js';

export type PlayersDecks = Partial<Record<PlayerName, TilesDeck>>;
export type MoveOption = 'left' | 'right';

export default interface PlayMode {
  createDeck(): TilesDeck;
  
  distributeTiles(
    players: PlayerName[],
    deck: TilesDeck
  ): [PlayersDecks, TilesDeck];
  
  pickFirstMove(playersDecks: PlayersDecks): [PlayerName, DominoTile];

  checkMovePermission(
    tile: DominoTile,
    comparable: DominoTile,
    side: MoveOption
  ): boolean;

  pickMove(
    deck: TilesDeck,
    ends: TilesDeck
  ): [DominoTile, MoveOption] | null;

  ableToPlay(
    currentPlayer: PlayerName,
    playersDecks: PlayersDecks,
    stockSize: number,
    ends: TilesDeck
  ): MoveState;
}
