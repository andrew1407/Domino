import { Injectable } from '@nestjs/common';
import DominoTile, { TilesDeck, EndValue } from './entities/DominoTile.js';
import { PlayerName } from './entities/Player.js';
import MoveState from './playMode/MoveState.js';
import PlayMode, { MoveOption, PlayersDecks } from './playMode/PlayMode.js';

@Injectable()
export default class ClassicDominoService implements PlayMode {
  public createDeck(): TilesDeck {
    const maxTileValue = 6;
    const tilesDeck: TilesDeck = [];
    for (let left: number = 0; left <= maxTileValue; ++left) 
      for (let right: number = 0; right <= left; ++right)
        tilesDeck.push(DominoTile.of(left as EndValue, right as EndValue));

    return tilesDeck;
  }

  public distributeTiles(
    players: PlayerName[],
    deck: TilesDeck
  ): [PlayersDecks, TilesDeck] {
    const tilesLeft: TilesDeck = deck
      .map((t: DominoTile): DominoTile => t.copy());
    const playersDecks: PlayersDecks = {};
    const usersCount: number = players.length;
    const userDeckSize: number = usersCount > 2 ? 5 : 7;
    for (const player of players)
      for (let i: number = 0; i < userDeckSize; ++i) {
        const pickedIdx: number = Math.floor(Math.random() * tilesLeft.length);
        const [ picked ]: TilesDeck = tilesLeft.splice(pickedIdx, 1);
        playersDecks[player] ??= [];
        playersDecks[player].push(picked);
      }
    return [playersDecks, tilesLeft];
  }

  public pickFirstMove(playersDecks: PlayersDecks): [PlayerName, DominoTile] {
    const copyReducer = (
      acc: PlayersDecks,
      [key, el]: [string, TilesDeck]
    ): PlayersDecks => ({
      ...acc, [key]: el.map((t: DominoTile): DominoTile => t.copy())
    });
    const leftDeck: PlayersDecks = Object.entries(playersDecks).reduce(copyReducer, {});
    type searchValues = { name?: PlayerName, value?: DominoTile };
    const maxDouble: searchValues = { name: null, value: null };
    const maxTileSum: searchValues = { name: null, value: null };
    const setSearchValues = (
      obj: searchValues,
      tile: DominoTile,
      player: PlayerName
    ): void => {
      obj.value = tile;
      obj.name = player as PlayerName;
    };
    
    for (const player in leftDeck)
      for (const tile of leftDeck[player]) {
        if (tile.isDouble()) {
          if (!maxDouble.value)
            setSearchValues(maxDouble, tile, player as PlayerName);
          else if (maxDouble.value.left < tile.left)
            setSearchValues(maxDouble, tile, player as PlayerName);
        } else {
          if (!maxTileSum.value)
            setSearchValues(maxTileSum, tile, player as PlayerName);
          else if (maxTileSum.value.tileSum() < tile.tileSum())
            setSearchValues(maxTileSum, tile, player as PlayerName);
        }
      }

    const foundTile: DominoTile = maxDouble.value ?? maxTileSum.value;
    const foundPlayer: PlayerName = maxDouble.name ?? maxTileSum.name;
    return [foundPlayer, foundTile];
  }

  public checkMovePermission(
    target: DominoTile,
    comparable: DominoTile,
    side: MoveOption
  ): boolean {
    return side === 'left' ?
      target.left === comparable.left || target.right === comparable.left :
      target.left === comparable.right || target.right === comparable.right;
  }

  public pickMove(
    deck: TilesDeck,
    [leftEnd, rightEnd]: TilesDeck
  ): [DominoTile, MoveOption] | null {
    for (const tile of deck) {
      if (this.checkMovePermission(tile, leftEnd, 'left')) return [tile, 'left'];
      if (this.checkMovePermission(tile, rightEnd, 'right')) return [tile, 'right'];
    }
    return null;
  }

  public ableToPlay(
    currentPlayer: PlayerName,
    playersDecks: PlayersDecks,
    stockSize: number,
    ends: TilesDeck
  ): MoveState {
    if (stockSize) return MoveState.AVAILABLE;
    const currentPlayerDeck: TilesDeck = playersDecks[currentPlayer];
    const ableForCurrentPlayer: boolean = this.availabeToMove(currentPlayerDeck, ends);
    if (ableForCurrentPlayer) return MoveState.AVAILABLE;
    const ableToPlayCheck = ([player, deck]: [string, TilesDeck]): boolean => (
      player !== currentPlayer ? this.availabeToMove(deck, ends) : false 
    );
    const ableForOthers: boolean = Object.entries(playersDecks).some(ableToPlayCheck);
    return ableForOthers ? MoveState.SKIPPABLE : MoveState.DEAD_END;
  }

  private availabeToMove(deck: TilesDeck, ends: TilesDeck): boolean {
    return this.pickMove(deck, ends) !== null;
  }
}
