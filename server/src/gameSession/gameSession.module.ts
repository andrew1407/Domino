import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import StorageService from './storage/storage.module.js';
import ClassicDominoService from './classicDomino.service.js';
import ScoreKeeperService from './scoreKeeper.service.js';
import GameSessionController from './gameSession.controller.js';
import GameSessionGateway from './gameSession.gateway.js';
import GameSessionService from './gameSession.service.js';
import { CLASSIC_DOMINO_SERVICE, SCORE_KEEPER_SERVICE } from './gameSession.options.js';

@Module({
  imports: [
    StorageService.register({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => configService.get('redis'),
    }),
  ],
  controllers: [GameSessionController],
  providers: [
    { provide: CLASSIC_DOMINO_SERVICE, useClass: ClassicDominoService },
    { provide: SCORE_KEEPER_SERVICE, useClass: ScoreKeeperService },
    GameSessionService,
    GameSessionGateway,
  ],
})
export default class GameSessionModule {}
